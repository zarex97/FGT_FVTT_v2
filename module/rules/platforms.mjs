/**
 * @file Platforms and levels.
 * @see docs/20-platforms-and-levels.md
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
  // A platform on the GROUND has no passengers. §20.2 gives every active
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
 * movement budget and away from movement-triggered effects (Ch. 08 §8.3). A
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
  if (target?.kind === "platform") return { ok: true };

  const ranged = (range ?? attacker?.range ?? 1) >= 2;

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
 * May this unit switch the thing off, and if not, why not.
 *
 * Shared by bounded fields and platform Noble Phantasms because they carry the
 * same authored block. Quetzalcoatl is the reason the `lockout` axis exists:
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
export function fallOff(unit, platform, { passedAgility, servantRescued = false }) {
  if (passedAgility || servantRescued) return [];

  const below = { ...unit.panel };
  const out = [
    { kind: "move", unitId: unit.id, to: below, toLevel: 0, forced: true },
    { kind: "damage", unitId: unit.id, formula: "10x2d6", component: "str", fixed: true,
      source: `Fell from ${platform.id}` },
  ];

  // "If the Unit knocked off was a Master, it has to perform an Overpower roll
  // if it lands on the Game Board -- EVEN IF it had already performed one from
  // the initial Attack."
  if (unit.kind === "master") out.push({ kind: "overpower", unitId: unit.id, reason: "fell" });

  return out;
}

/**
 * The platform coming apart (§20.9).
 *
 * Ordered, and the order is the specification's: save, damage the failures,
 * scatter **everyone**, then remove the level. Surviving the fall is not the
 * same as staying in the air, which is why a passenger who made its save is
 * still scattered — and why the level is removed last, once nobody is on it.
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

  for (const p of passengers) {
    if (saves[p.id] === true) continue;
    out.push({
      kind: "damage", unitId: p.id, amount: 100, component: "str", fixed: true,
      source: `${platform.id} destroyed`,
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
