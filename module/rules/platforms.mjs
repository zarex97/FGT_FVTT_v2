/**
 * @file Platforms and levels.
 * @see docs/27-platforms-and-levels.md
 *
 * Layer 2 (rules). Pure — it takes the board and returns verdicts and
 * descriptors. The engine turns descriptors into intents.
 *
 * `resolveTargets` has had a `crossLevelAllows` step since it was written, and
 * it is gated on `board.crossLevel` — which **nothing ever supplied**. So the
 * cross-level rule was implemented, called, and permanently inert. Same shape
 * as `MatchData.grailCounter` and `ctx.resist` before them.
 *
 * The load-bearing decision (D20.1) is that **each active platform gets its own
 * Scene Level**. Almost everything else follows: separate occupancy, separate
 * fog, boarding as a native movement operation — and, usefully here, a
 * passenger manifest that is a *consequence* of position rather than a list
 * somebody has to keep in sync.
 */

import { Rank } from "../domain/rank.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { test as testPredicate } from "./predicate.mjs";
import { rollOptionsFor } from "./options.mjs";

/**
 * The default protection model. A platform that says nothing is transparent —
 * it carries units without shielding them.
 *
 * @type {Readonly<object>}
 */
export const OPEN_PLATFORM = Object.freeze({
  occupantTargeting: "free",
  requiresBoarding: false,
  aoePassengerFactor: 1,
  aoeMastersImmune: false,
  outboundTargeting: "free",
  forbidDirectlyBelow: false,
  hullTargeting: "free",
});

/**
 * Every platform on the board.
 * @param {object} board
 * @returns {object[]}
 */
export function platformsOn(board) {
  return (board?.units ?? []).filter((u) => u.kind === "platform");
}

/**
 * The content ids of the platforms an ability raises.
 *
 * Reads the ability's `summonPlatform` phases. Accepts the ability in EITHER
 * shape the gate is handed -- the item's own `system` (the action bar's) or the
 * `usageSpecFor` projection (the use paths'), which carries this list as
 * `summonsPlatforms` and not the phases it came from.
 *
 * @param {object|null} ability
 * @returns {string[]}
 */
export function platformsSummonedBy(ability) {
  if (Array.isArray(ability?.summonsPlatforms)) return ability.summonsPlatforms;
  const phases = ability?.phases ?? ability?.system?.phases ?? [];
  return phases.filter((p) => p?.kind === "summonPlatform" && p.platformId).map((p) => p.platformId);
}

/**
 * The platform an ability would raise that its user already has standing.
 *
 * > *"Cooldown: 7◈ Turns after Quetzalcoatlus is defeated."*
 *
 * `countFrom: destroyed` and `countFrom: deactivation` start no clock at the cast,
 * so nothing refused a second cast while the first mount stood: it raised a second
 * mount at her panel, moved her and her Master onto it, charged the Master's
 * Health again, and left two platforms each charging its own toll (#142). The
 * cooldown starts from ANY end of the mount (ruled, 2026-10-01), so it cannot
 * be what refuses the cast while the mount is up -- this is its own rule, and
 * derived from the phases, so there is no authored key for a guard to miss.
 *
 * Only the caster's own: another Servant's Quetzalcoatlus is no reason. A
 * defeated one is on its way out and is not standing.
 *
 * @param {object|null} ability
 * @param {object|null} unit the caster
 * @param {object|null} board
 * @returns {object|null} the standing platform
 */
export function standingPlatformOf(ability, unit, board) {
  const raised = platformsSummonedBy(ability);
  if (raised.length === 0 || !unit?.id) return null;
  return platformsOn(board).find(
    (p) => raised.includes(p.contentId) && p.ownerId === unit.id && !p.defeated,
  ) ?? null;
}

/**
 * Everyone aboard a platform.
 *
 * Membership is *"units on the platform's level"*, not a stored manifest. A
 * separate Scene Level per platform is what makes that safe: nothing else
 * occupies that level, so there is no list to fall out of step with the board.
 *
 * @param {object} platform
 * @param {object} board
 * @returns {object[]}
 */
export function passengersOf(platform, board) {
  // A platform on the GROUND has no passengers. Ch. 27 gives every active
  // platform a level of its own, stacked above the ground, so a platform still
  // sitting at level 0 has not been activated — and reading membership off
  // `level ?? 0` made it the owner of everyone standing on the ground.
  //
  // That is exactly what happened: `activatePlatform` created the Hanging
  // Gardens' level and never moved the platform's own token onto it, so it flew
  // at elevation 0 and `passengersOf` returned **21 of 21** units on the board.
  // Moving it would have carried the entire match one panel sideways.
  //
  // The guard stays even though the assignment bug is fixed, because "everyone
  // on the ground belongs to this platform" is never a correct answer.
  if ((platform?.level ?? 0) === 0) return [];

  return (board?.units ?? []).filter(
    (u) => u.id !== platform.id && (u.level ?? 0) === (platform.level ?? 0),
  );
}

/* -------------------------------------------------------------------------- */
/*  20.8 — movement linkage                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Move a platform, carrying everyone aboard.
 *
 * Passengers move **forced**, which is what keeps the carry off their own
 * movement budget and away from movement-triggered effects (Ch. 05). A
 * passenger has not moved; it has been carried, and the two are different
 * events as far as every rule that watches movement is concerned.
 *
 * Relative position is preserved rather than recomputed, so a formation
 * survives the journey.
 *
 * @param {object} platform
 * @param {{i: number, j: number}} delta
 * @param {object} board
 * @returns {object[]} descriptors
 */
export function movePlatform(platform, delta, board) {
  const shift = (panel) => ({ i: panel.i + (delta.i ?? 0), j: panel.j + (delta.j ?? 0) });

  return [
    { kind: "move", unitId: platform.id, to: shift(platform.panel), forced: false },
    ...passengersOf(platform, board).map((p) => ({
      kind: "move", unitId: p.id, to: shift(p.panel), forced: true, carriedBy: platform.id,
    })),
  ];
}

/* -------------------------------------------------------------------------- */
/*  20.7 — cross-level targeting                                              */
/* -------------------------------------------------------------------------- */

/**
 * The platform a unit is aboard, if any.
 * @param {object} unit
 * @param {object} board
 * @returns {object|null}
 */
function platformOf(unit, board) {
  if (!unit) return null;
  if (unit.kind === "platform") return unit;
  // Never the ground, for the same reason `passengersOf` refuses it: a platform
  // still at level 0 is not activated, and matching on it would put every unit
  // in the scene "aboard" — which `annotatePlatforms` then stamps as
  // `self:onPlatform:<id>`, making Semiramis's own platform predicates true for
  // her opponents.
  const level = unit.level ?? 0;
  if (level === 0) return null;
  return platformsOn(board).find((p) => (p.level ?? 0) === level) ?? null;
}

/**
 * Is this attack legal across the levels involved?
 *
 * Cross-level rules are **per-platform data, decided case by case** — the
 * game's author confirmed as much (Ch. 41 Q37), so there is no global rule to
 * derive, only a four-axis model each platform picks a point in.
 *
 * The platform **itself** is always a legal target: the protection is for its
 * occupants, and a vehicle nobody can shoot at is not a vehicle.
 *
 * This function was written, documented and unit-tested, and **no caller ever
 * consulted it** — so every axis below, and every `crossLevel` block authored
 * on a platform, was inert in play. `rules/targeting/resolve.mjs` step 4d is
 * the reader. Found by aiming the Hanging Gardens' own Aerial Garden of Vanity
 * — *"Cannot hit under or above the HGoB"* — straight down at a Unit standing
 * under it, and watching it land.
 *
 * @param {object} attacker
 * @param {object} target
 * @param {object} board
 * @param {object} [options]
 * @param {number|null} [options.range] the reach of the ATTACK, when that is
 *   not the attacker's own Range. The Hanging Gardens *"does not Normal
 *   Attack"* and carries `range: 0`, while both of its Skills are Range 4 and
 *   Range 7 — reading the unit's Range would refuse them as melee.
 * @param {boolean} [options.allowDirectlyBelow] the one axis an ability may
 *   overrule, because one in the reference set says so in as many words:
 *   Dragon Wing Warriors is *"Range=4 plus the area UNDER the HGoB"* while the
 *   platform it is fired from forbids exactly that for everything else.
 * @returns {{ok: boolean, reason?: string}}
 */
export function crossLevelLegal(attacker, target, board, { range = null, allowDirectlyBelow = false } = {}) {
  if ((attacker?.level ?? 0) === (target?.level ?? 0)) return { ok: true };
  const ranged = (range ?? attacker?.range ?? 1) >= 2;
  // The platform ITSELF, from another level: its own `hullTargeting`. The
  // Hanging Gardens may be attacked from the ground only at range, and this
  // waved every such attack through at any reach (#68).
  if (target?.kind === "platform") {
    const hull = (target.crossLevel ?? OPEN_PLATFORM).hullTargeting ?? "free";
    if (hull === "forbidden") return { ok: false, reason: "hullForbidden" };
    if (hull === "rangedOnly" && !ranged) return { ok: false, reason: "requiresRanged" };
    return { ok: true };
  }

  // Shooting IN: the target's platform decides.
  const inbound = platformOf(target, board);
  if (inbound) {
    const rules = inbound.crossLevel ?? OPEN_PLATFORM;
    if (rules.occupantTargeting === "forbidden") return { ok: false, reason: "occupantsForbidden" };
    if (rules.occupantTargeting === "rangedOnly" && !ranged) return { ok: false, reason: "requiresRanged" };
  }

  // Shooting OUT: the attacker's platform decides, and it is a different axis.
  // A fortress that nobody can shoot into may still let its occupants shoot
  // out, or may not; the two are not the same permission.
  const outbound = platformOf(attacker, board);
  if (outbound && outbound.id !== inbound?.id) {
    const rules = outbound.crossLevel ?? OPEN_PLATFORM;
    if (rules.outboundTargeting === "forbidden") return { ok: false, reason: "outboundForbidden" };
    if (rules.outboundTargeting === "rangedOnly" && !ranged) return { ok: false, reason: "requiresRanged" };
    if (rules.forbidDirectlyBelow && !allowDirectlyBelow && isDirectlyBelow(target, outbound)) {
      return { ok: false, reason: "directlyBelow" };
    }
  }

  return { ok: true };
}

/**
 * Is this panel underneath the platform's footprint?
 * @param {object} unit
 * @param {object} platform
 * @returns {boolean}
 */
function isDirectlyBelow(unit, platform) {
  const { w = 1, h = 1 } = platform.footprint ?? {};
  const di = (unit.panel?.i ?? 0) - (platform.panel?.i ?? 0);
  const dj = (unit.panel?.j ?? 0) - (platform.panel?.j ?? 0);
  return di >= 0 && di < h && dj >= 0 && dj < w;
}

/**
 * May a Unit be knocked off this Platform at all (ADR 0001)?
 *
 * Opt-in per Platform. The rulebook states the ladder only for Semiramis'
 * Hanging Gardens, and "the edge" is not a coherent idea for the Storm Border,
 * which is a pocket dimension with no ground footprint. A Platform that authors
 * no `knockOff` block holds its edge: the knockback simply finds no landing
 * there and the Unit stays put.
 *
 * @param {object} platform
 * @returns {boolean}
 */
export function canFallFrom(platform) {
  return Boolean(platform?.knockOff);
}

/**
 * Is this panel part of the platform's own footprint?
 *
 * The panel-addressed half of {@link isDirectlyBelow}, which asks the same
 * question about a Unit. Being ON a Platform and being directly UNDER one are
 * the same arithmetic on the same grid; only the level differs.
 *
 * @param {{i: number, j: number}|null} panel
 * @param {object} platform
 * @returns {boolean}
 */
export function withinFootprint(panel, platform) {
  if (!panel || !platform?.panel) return false;
  const { w = 1, h = 1 } = platform.footprint ?? {};
  const di = panel.i - platform.panel.i;
  const dj = panel.j - platform.panel.j;
  return di >= 0 && di < h && dj >= 0 && dj < w;
}

/**
 * The nearest unoccupied panel of the Platform, never the one it was on.
 *
 * > *"it has a choice of Moving to the nearest unoccupied HGoB panel **other
 * > than the panel it was previously occupying**"*
 *
 * `null` when the Platform is full, which is not a refusal: the choice then
 * collapses to the damage-free landing, because passing the check earned the
 * Unit BOTH not being hurt and not being where it was.
 *
 * @param {object} unit
 * @param {object} platform
 * @param {object} board
 * @returns {{i: number, j: number}|null}
 */
export function nearestFreePlatformPanel(unit, platform, board) {
  const { w = 1, h = 1 } = platform?.footprint ?? {};
  const taken = (board?.units ?? [])
    .filter((u) => u.id !== platform?.id && (u.level ?? 0) === (platform?.level ?? 0))
    .flatMap((u) => u.panels ?? (u.panel ? [u.panel] : []));

  let best = null;
  let bestDistance = Infinity;
  for (let di = 0; di < h; di += 1) {
    for (let dj = 0; dj < w; dj += 1) {
      const panel = { i: platform.panel.i + di, j: platform.panel.j + dj };
      if (unit?.panel && panel.i === unit.panel.i && panel.j === unit.panel.j) continue;
      if (taken.some((p) => p.i === panel.i && p.j === panel.j)) continue;
      const distance = unit?.panel ? chebyshev(unit.panel, panel) : 0;
      if (distance < bestDistance) { best = panel; bestDistance = distance; }
    }
  }
  return best;
}

/**
 * Where a Unit that has just boarded stands on the deck.
 *
 * Directly above where it stood, when that deck panel is free; otherwise the
 * nearest free one. `reserved` holds panels already promised in the same
 * boarding -- the Servant's, when its Master comes with it -- so the two never
 * share one. The platform's anchor was used for both, which put every boarder
 * in the garden's corner (Ch. 46 §46.4-BX).
 *
 * @param {object} unit the boarder, on the ground
 * @param {object} platform
 * @param {object} board
 * @param {Array<{i: number, j: number}>} [reserved]
 * @returns {{i: number, j: number}|null}
 */
export function boardingLanding(unit, platform, board, reserved = []) {
  const { w = 1, h = 1 } = platform?.footprint ?? {};
  const taken = [
    ...(board?.units ?? [])
      .filter((u) => u.id !== platform?.id && u.id !== unit?.id && (u.level ?? 0) === (platform?.level ?? 0))
      .flatMap((u) => u.panels ?? (u.panel ? [u.panel] : [])),
    ...reserved,
  ];
  const free = (p) => !taken.some((q) => q.i === p.i && q.j === p.j);

  if (unit?.panel && withinFootprint(unit.panel, platform) && free(unit.panel)) {
    return { i: unit.panel.i, j: unit.panel.j };
  }
  let best = null;
  let bestDistance = Infinity;
  for (let di = 0; di < h; di += 1) {
    for (let dj = 0; dj < w; dj += 1) {
      const panel = { i: platform.panel.i + di, j: platform.panel.j + dj };
      if (!free(panel)) continue;
      const distance = unit?.panel ? chebyshev(unit.panel, panel) : 0;
      if (distance < bestDistance) { best = panel; bestDistance = distance; }
    }
  }
  return best;
}

/**
 * The Servant that may catch this Master, if one is standing there.
 *
 * > *"If a Master who is directly next to **its Servant** fails its Agility
 * > Check, its Servant can perform an Agility Check too; if successful, its
 * > Master is not knocked off."*
 *
 * Its OWN contracted Servant, and **directly next to** is one panel -- which is
 * deliberately not the two-panel reach the Master carry uses when boarding
 * (#24). Two different clauses, two different distances.
 *
 * @param {object} master
 * @param {object} board
 * @returns {object|null}
 */
export function rescuerFor(master, board) {
  if (master?.kind !== "master" || !master.panel) return null;
  return (board?.units ?? []).find(
    (u) => u.kind === "servant" && u.masterId === master.id
      // Beside it on the deck: a Servant on the ground below catches nobody
      // (Ch. 46 §46.4-CG).
      && (u.level ?? 0) === (master.level ?? 0)
      && u.panel && chebyshev(u.panel, master.panel) <= 1,
  ) ?? null;
}

/**
 * The Platform this Unit is standing on, if any.
 *
 * Membership is the Scene Level, exactly as `passengersOf` reads it: a Unit on
 * the ground is aboard nothing, and a Platform is not standing on itself.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {object|null}
 */
export function platformUnderUnit(unit, board) {
  if (!unit || unit.kind === "platform" || (unit.level ?? 0) === 0) return null;
  return (board?.units ?? []).find(
    (u) => u.kind === "platform" && (u.level ?? 0) === (unit.level ?? 0),
  ) ?? null;
}

/**
 * The Unit kinds that may Jump.
 *
 * *"A non-Civilian or non-Master Unit standing on an edge panel of a HGoB can
 * Jump off."* So Servants and Summons; a Master leaves by being carried or by
 * being knocked off, and a Civilian does not leave at all.
 */
const JUMPING_KINDS = Object.freeze(["servant", "summon"]);

/**
 * Is this panel on the boundary of the platform's footprint?
 *
 * On the footprint AND orthogonally adjacent to something off it -- the outer
 * ring. A Unit in the interior has Platform between it and the drop, which is
 * why the sheet says *"standing on an edge panel"*.
 *
 * @param {{i: number, j: number}|null} panel
 * @param {object} platform
 * @returns {boolean}
 */
export function isEdgePanel(panel, platform) {
  if (!withinFootprint(panel, platform)) return false;
  return [{ i: 1, j: 0 }, { i: -1, j: 0 }, { i: 0, j: 1 }, { i: 0, j: -1 }]
    .some((d) => !withinFootprint({ i: panel.i + d.i, j: panel.j + d.j }, platform));
}

/**
 * May this Unit Jump off the Platform it is standing on (#31)?
 *
 * Distinct from being Knocked Off in every respect: voluntary, no Agility
 * Check, no damage, and open only to the kinds the sheet names.
 *
 * `remaining` defaults to **0**, so a caller that forgets it is refused rather
 * than waved through. `undefined < 1` is `false`, which made the omission skip
 * the movement rung entirely and return `{ok: true}` for a Unit with nothing
 * left — the exact case the rung was written to catch. `jumpLandings` beside it
 * failed closed on the same mistake (no landings, so `"nowhereToLand"`), which
 * is why only a test ever noticed, and only by being silently vacuous.
 *
 * @param {object} unit
 * @param {object} platform
 * @param {number} [remaining] panels of MOV left this Turn
 * @returns {{ok: boolean, reason?: string}}
 */
export function jumpVerdict(unit, platform, remaining = 0) {
  if (!platform || (unit?.level ?? 0) !== (platform.level ?? 0) || (unit?.level ?? 0) === 0) {
    return { ok: false, reason: "notAboard" };
  }
  if (!JUMPING_KINDS.includes(unit?.kind)) return { ok: false, reason: "wrongKind" };

  // *"Drake cannot unboard the Golden Hind."* A rider the Platform holds does
  // not get out by jumping either. Before the edge rung: the bar still shows a
  // Jump blocked `notOnEdge`, and a Unit that can never leave has nothing to
  // step towards.
  const off = canUnboard(unit, platform);
  if (!off.ok) return off;

  if (!isEdgePanel(unit.panel, platform)) return { ok: false, reason: "notOnEdge" };

  // *"land on a Game Board panel within its MOV; in this case, the Unit's MOV
  // is reduced by 1"* -- the shortest jump lands one panel out and costs two,
  // so a Unit with one panel left has nowhere it can afford (§46.4-BW).
  if (remaining < 2) return { ok: false, reason: "noMovement" };

  return { ok: true };
}

/**
 * Every ground panel this Unit could Jump to.
 *
 * *"land on a Game Board panel within its MOV"*: off the footprint, on the
 * ground, unoccupied, on the board, and within the movement it has left.
 *
 * @param {object} unit
 * @param {object} platform
 * @param {object} board
 * @param {number} [remaining] panels of MOV left this Turn — the reach
 * @returns {Array<{i: number, j: number}>}
 */
export function jumpLandings(unit, platform, board, remaining = 0) {
  // The jump costs its distance PLUS ONE, so the reach is one short of what is
  // left. Offering the full allowance let the Jump write a `movedPanels` past
  // the Unit's MOV (§46.4-BW).
  const reach = remaining - 1;
  const bounds = board?.bounds ?? null;
  const taken = (board?.units ?? [])
    .filter((u) => u.id !== unit?.id && (u.level ?? 0) === 0)
    .flatMap((u) => u.panels ?? (u.panel ? [u.panel] : []));

  const out = [];
  for (let di = -reach; di <= reach; di += 1) {
    for (let dj = -reach; dj <= reach; dj += 1) {
      const panel = { i: unit.panel.i + di, j: unit.panel.j + dj };
      if (withinFootprint(panel, platform)) continue;
      if (bounds && (panel.i < 0 || panel.j < 0
        || panel.i >= (bounds.rows ?? Infinity) || panel.j >= (bounds.cols ?? Infinity))) continue;
      // A real board's bounds are `{iMin, iMax, jMin, jMax}`, which the line
      // above never read (§46.4-BW).
      if (bounds && bounds.iMax !== undefined && !inBoardBounds(panel, bounds)) continue;
      if (taken.some((p) => p.i === panel.i && p.j === panel.j)) continue;
      out.push(panel);
    }
  }
  return out;
}

/**
 * @param {{i: number, j: number}} p
 * @param {{iMin: number, iMax: number, jMin: number, jMax: number}} b
 * @returns {boolean}
 */
function inBoardBounds(p, b) {
  return p.i >= (b.iMin ?? 0) && p.i <= b.iMax && p.j >= (b.jMin ?? 0) && p.j <= b.jMax;
}

/**
 * The platform a grounded unit may board right now, if any (#24).
 *
 * "Other allied Units can board and unboard the Golden Hind by Moving onto it
 * normally" -- a unit becomes eligible to board by moving onto an active
 * platform's footprint while still on the ground (`level 0`), the same
 * footprint test `isDirectlyBelow` uses for cross-level targeting. A platform
 * at level 0 has not been activated (`passengersOf`'s own guard), and a unit
 * already aboard (`level > 0`) has nothing left to board.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {object|null}
 */
export function boardablePlatform(unit, board) {
  if (!unit?.panel || (unit.level ?? 0) !== 0) return null;
  // A platform with seats of its own offers none to a Unit that has no claim on one.
  return platformsOn(board).find(
    (p) => (p.level ?? 0) > 0 && isDirectlyBelow(unit, p) && seatVerdict(unit, p, board)?.ok !== false,
  ) ?? null;
}

/**
 * May this Unit take a seat on a platform that names its seats, and if not, why not.
 *
 * > *"…otherwise her Master can get on the Quetzalcoatlus at any time."* -- Winged Serpent
 *
 * Ruled by the user (2026-10-01, #65): her Master boards freely, with no roll, and nobody else
 * takes the seat -- not an enemy, and not an ally who is not her Master. A platform says so by
 * authoring `boarding.seats`, a list of ROLES (`owner`, `ownerMaster`), because the platform
 * document is authored long before it has an owner (`canUnboard`'s `lockAboard` is the same
 * shape). The Hanging Gardens and the Golden Hind author none and keep their own rolls.
 *
 * @param {object} unit the Unit asking to board
 * @param {object} platform
 * @param {object} board
 * @returns {{ok: true}|{ok: false, reason: "notYourSeat"}|null} `null` when the platform names no seats
 */
export function seatVerdict(unit, platform, board) {
  const seats = platform?.boarding?.seats;
  if (!Array.isArray(seats)) return null;

  const owner = (board?.units ?? []).find((u) => u.id === platform.ownerId) ?? null;
  const roles = [];
  if (unit?.id === platform.ownerId) roles.push("owner");
  if (owner?.masterId && unit?.id === owner.masterId) roles.push("ownerMaster");
  return roles.some((role) => seats.includes(role)) ? { ok: true } : { ok: false, reason: "notYourSeat" };
}

/**
 * Is this panel on the platform's footprint, or one panel from it in any direction?
 *
 * The distance is to the nearest panel of the FOOTPRINT, not to its anchor: a Master two panels
 * from a summoner's own panel can still be next to a 2x2 mount she stands on.
 *
 * @param {{i: number, j: number}|null} panel
 * @param {{panel: {i: number, j: number}, footprint?: {w?: number, h?: number}}} platform
 * @returns {boolean}
 */
export function nextToFootprint(panel, platform) {
  if (!panel || !platform?.panel) return false;
  const { w = 1, h = 1 } = platform.footprint ?? {};
  const gap = (at, from, size) => Math.max(from - at, 0, at - (from + size - 1));
  return Math.max(gap(panel.i, platform.panel.i, h), gap(panel.j, platform.panel.j, w)) <= 1;
}

/**
 * Where her Master is put when the mount is summoned beside him.
 *
 * > *"…she is Moved onto the Quetzalcoatlus together with her Master (if her Master is next to
 * > the Quetzalcoatlus; otherwise her Master can get on the Quetzalcoatlus at any time)."*
 *
 * Level assignment changes a token's level and never its x or y, so a Master who was merely
 * beside the mount was left on its deck standing on nothing. He lands on a free panel of the
 * footprint -- where he stands if that is one, else the nearest -- and never on hers. `null`
 * when he is not next to it, which is not a refusal: he boards later, freely.
 *
 * @param {object} summoner the Servant, at the panel the mount is placed on
 * @param {object} master
 * @param {{panel: {i: number, j: number}, footprint: {w: number, h: number}}} mount where it is placed
 * @returns {{i: number, j: number}|null}
 */
export function masterSeat(summoner, master, mount) {
  if (!summoner?.panel || !master?.panel) return null;
  if ((master.level ?? 0) !== (summoner.level ?? 0)) return null;
  if (!nextToFootprint(master.panel, mount)) return null;
  // The mount is not on the board yet, so nobody is aboard it: only her own panel is promised.
  return boardingLanding(master, mount, { units: [] }, [summoner.panel]);
}

/**
 * May a boarding Servant bring its Master along (#24)?
 *
 * *"A boarding Servant may bring its Master if the Master was within 2
 * panels."* Measured against where the Servant stood BEFORE boarding, not
 * where it lands -- the platform's own panel plays no part in this
 * comparison at all.
 *
 * @param {object} unit the boarding Servant, at its pre-board panel
 * @param {object} master
 * @param {number} [radius]
 * @returns {boolean}
 */
export function mayBringMaster(unit, master, radius = 2) {
  if (!unit?.panel || !master?.panel) return false;
  // On the Servant's own level: a Master already standing on the deck is not
  // "brought" aboard, and one twenty feet below is not beside a Servant on the
  // deck. The carry measured i and j only (Ch. 46 §46.4-CB).
  if ((unit.level ?? 0) !== (master.level ?? 0)) return false;
  return chebyshev(unit.panel, master.panel) <= radius;
}

/**
 * The top-left panel a summoned platform is placed by, so that it stands where its
 * summoner does.
 *
 * > *"…summons a Quetzalcoatlus at her position"*
 *
 * A token is placed by its top-left panel, which for a 1x1 mount was the summoner's own. A
 * larger one summoned from the last row or column would hang off the board, so the anchor
 * slides back just far enough to stay on it -- and never so far that the summoner's panel
 * leaves the footprint.
 *
 * @param {{i: number, j: number}} panel the summoner's panel
 * @param {{w?: number, h?: number}|null} footprint
 * @param {{iMin?: number, jMin?: number, iMax?: number, jMax?: number}|null} [bounds]
 * @returns {{i: number, j: number}}
 */
export function summonAnchor(panel, footprint, bounds = null) {
  const { w = 1, h = 1 } = footprint ?? {};
  const fit = (at, size, min, max) => Math.max(min ?? 0, Math.min(at, (max ?? Infinity) - size + 1));
  return {
    i: fit(panel.i, h, bounds?.iMin, bounds?.iMax),
    j: fit(panel.j, w, bounds?.jMin, bounds?.jMax),
  };
}

/**
 * The geometric centre of a platform's own footprint.
 *
 * `panel` is a token's own anchor corner (top-left), not the middle of a 9x9
 * (or any other) multi-panel footprint -- the same `panel` + `footprint.{w,h}`
 * shape `isDirectlyBelow` already reasons about occupancy with.
 *
 * @param {object} platform
 * @returns {{i: number, j: number}|null}
 */
export function platformCentre(platform) {
  if (!platform?.panel) return null;
  const { w = 1, h = 1 } = platform.footprint ?? {};
  return { i: platform.panel.i + Math.floor(h / 2), j: platform.panel.j + Math.floor(w / 2) };
}

/**
 * Is this unit within a `radius`-Chebyshev square of the platform's centre --
 * Semiramis's own "Throne Room", the middle 5x5 of her Hanging Gardens
 * (radius 2).
 *
 * @param {object} unit
 * @param {object} platform
 * @param {number} [radius]
 * @returns {boolean}
 */
export function withinPlatformCentre(unit, platform, radius = 2) {
  const centre = platformCentre(platform);
  if (!centre || !unit?.panel) return false;
  return Math.max(Math.abs(unit.panel.i - centre.i), Math.abs(unit.panel.j - centre.j)) <= radius;
}

/**
 * Whose Move and Normal Attack this unit actually uses.
 *
 * > *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack
 * > is replaced with Quetzalcoatlus'."*
 *
 * Not a buff and not a stat override: while she is aboard, her Move **is** the
 * mount's move and her Normal Attack **is** the mount's attack, spending *her*
 * action rather than the platform's own.
 *
 * Every other platform in the reference set carries its passengers — the
 * Hanging Gardens, the Golden Hind, the Storm Border — and a passenger's own
 * action is untouched. This is the first that a passenger DRIVES, which is why
 * it is an authored capability rather than a property of riding.
 *
 * `roles` exists because the substitution is the **owner's** alone. Her Master
 * rides as cargo: *"the Servant's Master can Move together with its Servant"*
 * is Passenger Seat, and it does not hand him the reins.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {{unit: object, platform: object|null,
 *            movesAsPlatform: boolean, attacksAsPlatform: boolean}}
 */
export function actionSourceFor(unit, board) {
  const none = { unit, platform: null, ability: null, movesAsPlatform: false, attacksAsPlatform: false };

  // An ABILITY the unit carries that replaces its own Normal Attack, gated on
  // a predicate it answers itself. Dendera Electric Bulb is *"can be used by
  // Ozymandias as his Normal Attack while within Ramesseum Tentyris"* -- the
  // same substitution a driven mount performs, with a condition instead of a
  // mount. Tested before the platform, because an ability a Unit carries is
  // its own and a platform is something it is standing on.
  const replacing = (unit?.abilities ?? []).find((a) => a.replacesNormalAttack
    && (!a.replacesNormalAttack.predicate
      || testPredicate(a.replacesNormalAttack.predicate, { options: rollOptionsFor({ attacker: unit }) })));
  if (replacing) return { ...none, ability: replacing, attacksAsAbility: true };

  if (!unit?.platformId) return none;

  const platform = (board?.units ?? []).find((u) => u.id === unit.platformId) ?? null;
  const spec = platform?.replacesRiderAction;
  if (!platform || !spec) return { ...none, platform };

  // "owner" is a role in its own right, not a unit kind: the mount belongs to
  // one Servant, and every other passenger is identified by what it is.
  const role = platform.ownerId === unit.id ? "owner" : unit.kind;
  if (!(spec.roles ?? ["owner"]).includes(role)) return { ...none, platform };

  return {
    unit,
    platform,
    movesAsPlatform: Boolean(spec.move),
    attacksAsPlatform: Boolean(spec.normalAttack),
  };
}

/**
 * Is a recurring toll due on this sweep?
 *
 * **Two clocks, and the sheets distinguish them.** Jack's Mist and
 * Quetzalcoatl's mount charge every N *ticks* from when they opened:
 * *"After every 1◈ Turns, Quetz's Master's Health is reduced by 25 at the end
 * of the Turn."* The Golden Hind charges on the Round:
 *
 * > *"At the end of every ~~Round/1◈ Turns~~ **full Round** Golden Hind is
 * > Active, Drake's Master loses 50 Health."*
 *
 * The strikethrough is the author's, and it is the whole reason this is a
 * branch rather than a conversion: `turnsPerRound` is a world setting, so
 * "1◈ since activation" and "the end of the Round" are different moments in
 * every world where a Round is not exactly one turn long (spec R6).
 *
 * The two sweeps are **disjoint** — the turn-end call passes
 * `atRoundBoundary: false` and never sees a Round toll, the round-end call
 * passes `true` and never sees a tick period. So a platform cannot be charged
 * twice on a turn that also happens to end a Round.
 *
 * A block with an `amount` and no `every` is the OTHER documented shape of
 * `upkeep` — a cost that supersedes another (Ch. 17) rather than a recurring
 * toll — and is not due here at any tick. The Golden Hind carries both at once
 * and is the first platform to do so.
 *
 * @param {object|null} upkeep the authored block
 * @param {object} ctx
 * @param {number} ctx.tick now
 * @param {number} [ctx.round] the Round now, for a Round toll
 * @param {boolean} ctx.atRoundBoundary which sweep is asking
 * @param {number|null} [ctx.lastUpkeepAt] the tick it last charged
 * @param {number|null} [ctx.lastUpkeepRound] the Round it last charged
 * @param {number} [ctx.createdAt] activation tick, which a period counts from
 * @param {number} ctx.turnsPerRound
 * @returns {{due: boolean, reason?: string}}
 */
export function upkeepDue(upkeep, {
  tick, round = null, atRoundBoundary = false,
  lastUpkeepAt = null, lastUpkeepRound = null, createdAt = 0, turnsPerRound = 3,
} = {}) {
  if (!upkeep?.every) return { due: false, reason: "noPeriod" };

  if (upkeep.every === "round") {
    if (!atRoundBoundary) return { due: false, reason: "notRoundBoundary" };
    // Compare ROUNDS, never a derived tick count: deriving one would silently
    // reinstate the reading the sheet struck out.
    if (lastUpkeepRound !== null && lastUpkeepRound === round) {
      return { due: false, reason: "alreadyThisRound" };
    }
    return { due: true };
  }

  // A tick period belongs to the turn-end sweep alone.
  if (atRoundBoundary) return { due: false, reason: "tickPeriodAtRoundBoundary" };

  const period = resolveTicks(parseTick(upkeep.every), { turnsPerRound });
  if (!(period > 0)) return { due: false, reason: "unparseablePeriod" };
  const since = tick - (lastUpkeepAt ?? createdAt ?? tick);
  return since < period ? { due: false, reason: "tooSoon" } : { due: true };
}

/**
 * Which platforms an effect landing on a unit switches off.
 *
 * > *"If Drake is inflicted with NP Seal, Golden Hind is immediately
 * > deactivated."*
 *
 * Keyed on the OWNER, because the clause is about her rather than about the
 * ship: the Hind itself *"cannot be affected by buffs and/or debuffs"* at all,
 * so an NP Seal can never land on it and a rule watching the platform would
 * never fire.
 *
 * Authored on the platform rather than on the effect, so a second platform may
 * name a different effect without `npSeal` growing a list of ships.
 *
 * @param {object[]} platforms every platform on the board
 * @param {string} unitId whoever was just affected
 * @param {string} defId the effect that landed
 * @returns {string[]} platform ids to deactivate
 */
export function deactivatedBy(platforms, unitId, defId) {
  return (platforms ?? [])
    .filter((p) => p.ownerId === unitId && (p.deactivateOn ?? []).includes(defId))
    .map((p) => p.id);
}

/**
 * Whether a rider may step off.
 *
 * > *"Drake cannot unboard the Golden Hind."*
 *
 * A ROLE list rather than a unit id, because a platform document is authored
 * long before it has an owner -- `golden-hind.yml` ships in the compendium and
 * only learns whose it is when `summonPlatform` stamps `ownerId` at activation.
 *
 * `owner` is the only role any sheet names so far. Every other rider on the
 * Hind is free to go: *"Other allied Units can board and unboard the Golden
 * Hind by Moving onto it normally."*
 *
 * A platform with no `lockAboard` holds nobody, which is every other platform
 * in the game.
 *
 * @param {object} unit the rider asking to leave
 * @param {object} platform
 * @returns {{ok: boolean, reason?: string}}
 */
export function canUnboard(unit, platform) {
  // *"Bašmu cannot leave the HGoB."* A summon bound to THIS platform, stamped
  // by `summoning.mjs` at the summons, goes nowhere -- not by Jump, and not
  // off the edge either (`movement-hooks.mjs` holds the push).
  if (unit?.boundToPlatformId && unit.boundToPlatformId === platform?.id) {
    return { ok: false, reason: "boundToPlatform" };
  }
  const locked = platform?.lockAboard ?? [];
  if (locked.includes("owner") && unit?.id === platform?.ownerId) {
    return { ok: false, reason: "lockedAboard" };
  }
  return { ok: true };
}

/**
 * May this unit switch the thing off, and if not, why not.
 *
 * Shared by bounded fields and platform Noble Phantasms because they carry the
 * same authored block. Quetzalcoatl is the reason the `lockout` axis exists:
 *
 * @see canUnboard — the other half: whether a rider may step off at all.
 *
 * > *"This NP can be deactivated during Quetz's Turn or at the start or end of
 * > any Round or Turn, **but cannot be deactivated for 2◈ Turns after it was
 * > activated**."* — Quetzalcoatl: Winged Serpent
 *
 * Her Piedra Del Sol carries the identical block **without** a lockout, which
 * is exactly the difference between the two sheets' final paragraphs. So the
 * absence has to be expressible, and `lockout` is optional rather than a number
 * that defaults to something.
 *
 * A missing spec refuses. Most things in this game cannot be switched off — a
 * Reality Marble runs its clock out — so silence means no.
 *
 * @param {object|null} spec the authored `deactivation` block
 * @param {object} ctx
 * @param {number} ctx.createdAt the tick it opened on
 * @param {number} ctx.tick now
 * @param {string} ctx.unitId who is asking
 * @param {string} ctx.ownerId
 * @param {number} ctx.turnsPerRound
 * @returns {{ok: boolean, reason?: string, unlocksAt?: number}}
 */
export function deactivationVerdict(spec, { createdAt, tick, unitId, ownerId, turnsPerRound }) {
  if (!spec?.byOwner) return { ok: false, reason: "notAllowed" };
  if (unitId !== ownerId) return { ok: false, reason: "notOwner" };
  if (!spec.lockout) return { ok: true };

  const unlocksAt = (createdAt ?? 0) + resolveTicks(parseTick(spec.lockout), { turnsPerRound });
  if (tick < unlocksAt) return { ok: false, reason: "locked", unlocksAt };
  return { ok: true };
}

/**
 * May this Unit switch this platform off now -- {@link deactivationVerdict} on a
 * platform snapshot.
 *
 * The one place a platform's `deactivation` block meets its `activatedAt` and its
 * owner, so the bar's slot, its tooltip and the GM's re-check cannot read them
 * differently. **A VOLUNTARY end only**: the lockout holds off an owner who
 * would switch the mount off, not one that is forced to close -- an unpayable
 * toll, or an effect on the owner, is not held off by the 2◈ lock (ruled,
 * 2026-10-01), and those paths call `destroyPlatform` and never ask this.
 *
 * @param {object} platform a platform snapshot
 * @param {string} unitId who would end it
 * @param {object} ctx
 * @param {number} ctx.tick now
 * @param {number} ctx.turnsPerRound
 * @returns {{ok: boolean, reason?: string, unlocksAt?: number}}
 */
export function platformDeactivation(platform, unitId, { tick, turnsPerRound }) {
  return deactivationVerdict(platform?.deactivation, {
    createdAt: platform?.activatedAt ?? 0, tick, unitId, ownerId: platform?.ownerId, turnsPerRound,
  });
}

/**
 * The platforms a Unit owns that it may be offered an End control for, each with its verdict.
 *
 * > *"This NP can be deactivated during Quetz's Turn or at the start or end of
 * > any Round or Turn, but cannot be deactivated for 2◈ Turns after it was
 * > activated."*
 *
 * `deactivation` was projected, routed and read by nobody that reached a
 * player: the bar built its End slots from `board.fields`, and a platform is a
 * Unit. A locked platform is LISTED with its `locked` verdict and `unlocksAt`,
 * so the control can say when it opens rather than show nothing. A platform that
 * authors no `byOwner` deactivation is not listed -- silence means no. `window:
 * any` is no timing gate: the offer stands whenever the owner's bar does.
 *
 * @param {object} unit the owner
 * @param {object} board
 * @param {{tick: number, turnsPerRound: number}} ctx
 * @returns {Array<{platform: object, verdict: {ok: boolean, reason?: string, unlocksAt?: number}}>}
 */
export function deactivatablePlatforms(unit, board, ctx) {
  return platformsOn(board)
    .filter((p) => p.ownerId === unit?.id && p.deactivation?.byOwner)
    .map((platform) => ({ platform, verdict: platformDeactivation(platform, unit.id, ctx) }));
}

/**
 * How much of an area attack reaches this unit through its platform.
 *
 * The Golden Hind soaks half for everyone and **all** of it for Masters;
 * Quetzalcoatlus soaks nothing for the mount itself. Which is why this is a
 * per-platform number rather than a constant.
 *
 * @param {object} unit
 * @param {object} platform
 * @returns {number} 0 = fully soaked, 1 = nothing soaked
 */
export function aoePassengerFactor(unit, platform) {
  if (!platform || unit?.id === platform.id) return 1;
  const rules = platform.crossLevel ?? OPEN_PLATFORM;
  if (rules.aoeMastersImmune && unit?.kind === "master") return 0;
  return rules.aoePassengerFactor ?? 1;
}

/**
 * The `board.crossLevel` map the targeting resolver reads.
 *
 * Keyed by platform id, in the shape `crossLevelAllows` already expects — the
 * resolver was written against this map and has never been given one.
 *
 * @param {object} board
 * @returns {Record<string, {requiresRanged: boolean, untargetable: boolean, aoePassengerFactor: number}>}
 */
export function crossLevelRulesFor(board) {
  /** @type {Record<string, object>} */
  const out = {};
  for (const p of platformsOn(board)) {
    const rules = p.crossLevel ?? OPEN_PLATFORM;
    out[p.id] = {
      requiresRanged: rules.occupantTargeting === "rangedOnly" || rules.outboundTargeting === "rangedOnly",
      untargetable: rules.occupantTargeting === "forbidden",
      aoePassengerFactor: rules.aoePassengerFactor ?? 1,
    };
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  20.4 — boarding, falling, destruction                                     */
/* -------------------------------------------------------------------------- */

/**
 * What a unit must roll to board.
 *
 * *"Roll 1d12. Success on 12."* Modifiers **reduce the required value** rather
 * than adding to the roll, which is the same arithmetic and a very different
 * thing to get backwards.
 *
 * @param {object} unit
 * @param {object} [ctx]
 * @param {boolean} [ctx.hitByDragonWingWarriors]
 * @returns {{die: number, target: number}}
 */
export function boardingTarget(unit, ctx = {}) {
  // A platform that states its own roll states it COMPLETELY. The Golden
  // Hind's *"rolls a ten-sided die… successfully boards if a 10 is rolled"*
  // carries no relief clause and no Levitating branch, and lending it either
  // would put an AGI-A LUC-A Servant aboard on a 6 instead of a 10.
  //
  // Everything below this line is the Hanging Gardens' rule, which stays the
  // default for every platform that does not author one.
  const authored = ctx.platform?.boarding ?? null;
  if (authored) return { die: authored.die, target: authored.target };

  // "Has the Levitating attribute: roll 1d8 instead, base target 8."
  const levitating = (unit?.attributes ?? []).includes("levitating");
  const die = levitating ? 8 : 12;
  let target = die;

  target -= rankRelief(unit?.parameters?.agi);
  target -= rankRelief(unit?.parameters?.luc);
  if (ctx.hitByDragonWingWarriors) target -= 2;

  return { die, target: Math.max(1, target) };
}

/**
 * Does the platform's boarding relief apply to a Unit attacked this Turn by these?
 *
 * The Hanging Gardens names the ability: *"on the same Turn it was Attacked by
 * Dragon Wing Warriors"*. Authored as `boardingReliefAfter`, a list of content
 * ids, so a platform names its own; the size of the relief is the Hanging
 * Gardens' 2, in {@link boardingTarget}.
 *
 * @param {string[]} attackedBy the Unit's Turn Record
 * @param {object|null} platform
 * @returns {boolean}
 */
export function attackedByReliefApplies(attackedBy, platform) {
  const after = platform?.boardingReliefAfter ?? [];
  return (attackedBy ?? []).some((id) => after.includes(id));
}

/**
 * −1 at rank C–B, −2 at A or better.
 * @param {string|null|undefined} raw
 * @returns {number}
 */
function rankRelief(raw) {
  const rank = Rank.parseOrNull(raw ?? null);
  if (!rank) return 0;
  if (["EX", "A"].includes(rank.grade)) return 2;
  if (["B", "C"].includes(rank.grade)) return 1;
  return 0;
}

/**
 * Being knocked off the edge.
 *
 * Three tiers, in this order: the unit's own Agility Check, then a Servant's
 * rescue check for an adjacent Master, then the fall. The rescue is checked
 * before the damage because *"if successful, its Master is not knocked off"* —
 * it prevents the fall rather than softening it.
 *
 * @param {object} unit
 * @param {object} platform
 * @param {object} outcome
 * @param {boolean} outcome.passedAgility
 * @param {boolean} [outcome.servantRescued]
 * @returns {object[]} descriptors
 */
export function fallOff(unit, platform, {
  passedAgility, servantRescued = false, choice = "land", landingPanel = null,
} = {}) {
  // Caught by its own Servant: *"its Master is not knocked off"*. Not moved and
  // not hurt -- and note the wording differs from the passed-check case, which
  // explicitly puts the Unit somewhere else. The difference is read as real.
  if (servantRescued) return [];

  // *"it has to perform an Overpower roll IF IT LANDS ON THE GAME BOARD"* --
  // conditioned on landing, not on failing, so a Master who passed its check
  // and chose to drop still rolls one.
  const landing = () => [
    { kind: "move", unitId: unit.id, to: { ...unit.panel }, toLevel: 0, forced: true },
    ...(unit.kind === "master" ? [{ kind: "overpower", unitId: unit.id, reason: "fell" }] : []),
  ];

  if (passedAgility) {
    // The choice a passed check earns: somewhere else aboard, or the ground
    // unhurt. With nowhere aboard free, `landingPanel` is null and the choice
    // collapses to the landing -- staying put is not on offer, because the
    // clause excludes the panel it was occupying.
    if (choice === "stay" && landingPanel) {
      return [{ kind: "move", unitId: unit.id, to: landingPanel, forced: true }];
    }
    return landing();
  }

  const [move, ...rest] = landing();
  return [
    move,
    {
      kind: "damage", unitId: unit.id,
      formula: platform?.knockOff?.damage ?? "10x2d6",
      component: platform?.knockOff?.component ?? "str",
      fixed: true, source: `Fell from ${platform.id}`,
    },
    ...rest,
  ];
}

/**
 * The platforms a defeat takes with it.
 *
 * > *"The HGoB is destroyed when Semiramis is defeated or its Health drops to
 * > 0."*
 *
 * A platform that is itself defeated -- its Health gone -- is destroyed; a
 * Unit at 0 stays on the board until the chain says otherwise, a platform in
 * the air does not. One whose sheet says it goes with its owner
 * (`destroyedWithOwner`) is destroyed when its owner is. Neither trigger
 * existed (Ch. 46 §46.4-CH).
 *
 * @param {string} defeatedId
 * @param {object} board
 * @returns {string[]} platform ids
 */
export function platformsDestroyedBy(defeatedId, board) {
  const units = board?.units ?? [];
  const self = units.find((u) => u.id === defeatedId);
  if (self?.kind === "platform") return [self.id];
  return units
    .filter((u) => u.kind === "platform" && u.ownerId === defeatedId && u.destroyedWithOwner === true)
    .map((u) => u.id);
}

/**
 * A fall's damage formula, as a Roll can read it.
 *
 * Authored the way the sheets print it -- *"(10*2d6)"*, written `10x2d6` in
 * content. The engine rolled a hard-coded `10*2d6` whatever the Platform said
 * (Ch. 46 §46.4-CD).
 *
 * @param {string} formula
 * @returns {string}
 */
export function fallFormula(formula) {
  return String(formula ?? "10x2d6").replace(/(\d+)\s*x\s*(?=\d)/gi, "$1*");
}

/**
 * Who a platform's destruction spares.
 *
 * > *"all Units on it perform either an Agility Check or a Luck Check roll. If
 * > the roll fails, the Unit takes 100 Fixed STR damage. A Master who was within
 * > a 2 panel area of its Servant does not need to roll if its Servant
 * > succeeded its roll."*
 *
 * `results` holds every passenger's own check, rolled by the caller; a Master
 * whose Servant passed within 2 panels is spared without its own. `destroyPlatform`
 * used to pass no saves at all, so every passenger took the damage (Ch. 46
 * §46.4-CI).
 *
 * @param {object[]} passengers
 * @param {Record<string, {success: boolean}>} results
 * @returns {{saves: Record<string, boolean>, exempt: string[]}}
 */
export function destructionSaves(passengers, results) {
  const saves = {};
  const exempt = [];
  for (const p of passengers) {
    if (p.kind === "master") {
      const servant = passengers.find((s) => s.kind === "servant" && s.masterId === p.id
        && results[s.id]?.success && s.panel && p.panel && chebyshev(s.panel, p.panel) <= 2);
      if (servant) {
        saves[p.id] = true;
        exempt.push(p.id);
        continue;
      }
    }
    saves[p.id] = Boolean(results[p.id]?.success);
  }
  return { saves, exempt };
}

/**
 * Where each passenger lands when a platform comes apart.
 *
 * > *"Then, all Units onboard the HGoB are randomly scattered below it."*
 *
 * A random free GROUND panel under the footprint for each, no two alike, drawn
 * from `rand` (0 ≤ x < 1) so the caller owns the dice. The `scatter`
 * descriptor was logged and nothing else, so every passenger landed directly
 * under where it stood (Ch. 46 §46.4-CJ).
 *
 * **When the footprint runs out, the landing goes outward** (#140). The draw
 * stopped there, so a one-panel mount, or a footprint with a Unit on it, left
 * everyone it had no panel for standing where they were -- on top of whoever
 * held it. A platform that `sharesPanel` falls over such a Unit in ordinary
 * play. The rest land on the nearest free ground panels by Chebyshev distance
 * from the footprint, ring by ring, random within a ring, inside the board.
 * "Free" is the same rule as under the footprint: a ground Unit holds a panel,
 * a platform, a structure or a Unit that shares its panel does not. A board
 * with no free ground panel left leaves the passenger out of the answer, so it
 * keeps its own.
 *
 * @param {object[]} passengers
 * @param {object} platform
 * @param {object} board
 * @param {() => number} rand
 * @returns {Record<string, {i: number, j: number}>}
 */
export function scatterPanels(passengers, platform, board, rand) {
  const { w = 1, h = 1 } = platform?.footprint ?? {};
  const taken = new Set((board?.units ?? [])
    .filter((u) => (u.level ?? 0) === 0 && u.kind !== "platform" && u.kind !== "structure" && !u.sharesPanel)
    .flatMap((u) => u.panels ?? (u.panel ? [u.panel] : []))
    .map((p) => `${p.i},${p.j}`));

  const bounds = board?.bounds ?? null;
  const onBoard = (p) => p.i >= (bounds?.iMin ?? 0) && p.j >= (bounds?.jMin ?? 0)
    && p.i <= (bounds?.iMax ?? Infinity) && p.j <= (bounds?.jMax ?? Infinity);
  const open = (p) => onBoard(p) && !taken.has(`${p.i},${p.j}`);
  // The farthest a landing can be: across the whole board, and the largest is 25 wide.
  const reach = bounds?.iMax !== undefined
    ? Math.max(bounds.iMax - (bounds.iMin ?? 0), bounds.jMax - (bounds.jMin ?? 0)) + 1
    : 25;
  // Panels exactly `d` panels from the footprint (0 is the footprint itself).
  const at = platform.panel;
  const gap = (x, from, size) => Math.max(from - x, 0, x - (from + size - 1));
  const ring = (d) => {
    const found = [];
    for (let i = at.i - d; i <= at.i + h - 1 + d; i += 1) {
      for (let j = at.j - d; j <= at.j + w - 1 + d; j += 1) {
        if (Math.max(gap(i, at.i, h), gap(j, at.j, w)) === d && open({ i, j })) found.push({ i, j });
      }
    }
    return found;
  };

  const out = {};
  let d = 0;
  let free = ring(0);
  for (const unit of passengers) {
    while (free.length === 0 && d < reach) { d += 1; free = ring(d); }
    if (free.length === 0) break;
    const k = Math.min(free.length - 1, Math.floor(rand() * free.length));
    out[unit.id] = free.splice(k, 1)[0];
  }
  return out;
}

/**
 * The platform coming apart (Ch. 27).
 *
 * Ordered, and the order is the specification's: save, damage the failures,
 * scatter **everyone**, then remove the level. Surviving the fall is not the
 * same as staying in the air, which is why a passenger who made its save is
 * still scattered — and why the level is removed last, once nobody is on it.
 *
 * **The save and the damage are the platform's own, and opt-in** (ADR 0001,
 * #139): only a platform that authors a `collapse` block states the ladder —
 * the Hanging Gardens' *"fails, takes 100 Fixed STR damage"* — and one that
 * says nothing (the Quetzalcoatlus, the Golden Hind) drops its riders to the
 * ground unhurt. The damage rows come from the block, never from a constant.
 *
 * @param {object} platform
 * @param {object} board
 * @param {object} ctx
 * @param {Record<string, boolean>} ctx.saves unitId → passed
 * @returns {object[]} descriptors
 */
export function destructionSequence(platform, board, { saves = {} } = {}) {
  /** @type {object[]} */
  const out = [];
  const passengers = passengersOf(platform, board);

  const ladder = platform.collapse ?? null;
  for (const p of ladder ? passengers : []) {
    if (saves[p.id] === true) continue;
    out.push({
      kind: "damage", unitId: p.id, amount: ladder.damage ?? 100, component: ladder.component ?? "str",
      fixed: true, source: `${platform.id} destroyed`,
    });
  }

  for (const p of passengers) {
    out.push({ kind: "scatter", unitId: p.id, toLevel: 0, from: platform.id });
  }

  // Reversing the owner's effects is why rank shifts declare explicit,
  // subtractable stat deltas (D20.7) rather than re-rolling.
  out.push({ kind: "removeOwnerEffects", platformId: platform.id, ownerId: platform.ownerId ?? null });
  out.push({ kind: "dismissBoundSummons", platformId: platform.id });
  out.push({ kind: "removeLevel", platformId: platform.id, level: platform.level ?? null });

  return out;
}
