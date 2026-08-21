/**
 * @file The environment — Day/Night, Home Base and the Holy Grail.
 * @see docs/19-environment.md
 *
 * Layer 2 (rules). Pure: it takes the board and returns modifiers, effect
 * descriptors and new state values. Never intents — an intent is how layer 3
 * writes, and this layer does not.
 *
 * Three subsystems that share one property — they are facts about the *field*
 * rather than about any unit, so a unit projected alone can never know them.
 * That is the same shape as ZON, auras and terrain, and they are settled in the
 * same place for the same reason.
 */

import { chebyshev } from "../domain/geometry.mjs";

/* -------------------------------------------------------------------------- */
/*  19.2 — the Day/Night cycle                                                */
/* -------------------------------------------------------------------------- */

/**
 * Which phase a Round is in.
 *
 * *"When the game starts, Flip a Coin. If Heads, the first Round is 'Day'. The
 * next Round will be 'Night' and so on."* One flip, at the start — so the phase
 * is a **pure function of the round number**, with no stored alternation to
 * drift and nothing a reconnect can lose.
 *
 * @param {number} round 1-based
 * @param {boolean} startedAtDay the opening coin flip
 * @returns {"day"|"night"}
 */
export function phase(round, startedAtDay) {
  const isOdd = round % 2 === 1;
  return isOdd === Boolean(startedAtDay) ? "day" : "night";
}

/**
 * What the phase does to a unit carrying the `Dark` attribute.
 *
 * Symmetric: *"During a Day Round, all damage received by Units with the 'Dark'
 * Attribute is increased by 25% including NP, while all damage dealt ... is
 * reduced by 25%. Vice versa during a Night Round."*
 *
 * **Including NP** is load-bearing — an `npValue` here would silently halve it,
 * which is the difference between the rule as written and a rule that looks
 * similar. None of the 12 reference Servants carry `Dark`, so nothing exercises
 * this in play yet; it is implemented because content will need it and because
 * an unimplemented rule that looks implemented is this project's worst outcome.
 *
 * @param {object} unit
 * @param {"day"|"night"} current
 * @returns {object[]} modifiers for the stage-4 bucket
 */
export function darkModifiers(unit, current) {
  if (!(unit?.attributes ?? []).includes("dark")) return [];
  const source = current === "day" ? "Day Round" : "Night Round";
  const good = current === "night";

  return [
    { key: good ? "atkUp" : "atkDwn", value: 25, direction: "dealt", source },
    { key: good ? "defUp" : "defDwn", value: 25, direction: "taken", source },
  ];
}

/* -------------------------------------------------------------------------- */
/*  19.1 — the Home Base                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The zone a unit is standing in that belongs to its own faction.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {object|null}
 */
export function ownBaseOf(unit, board) {
  for (const zone of Object.values(board?.zones ?? {})) {
    if (zone.faction !== unit?.faction) continue;
    if ((zone.panels ?? []).some((p) => chebyshev(p, unit.panel) === 0)) return zone;
  }
  return null;
}

/**
 * Is this unit standing in its OWN Home Base?
 *
 * Its own, not any: Medea's Territory Creation reduces damage taken by allies
 * "who are in **their** Home Base", so a unit sheltering in someone else's gets
 * nothing. The distinction is invisible until two allied factions share a map.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {boolean}
 */
export function inOwnHomeBase(unit, board) {
  return ownBaseOf(unit, board) !== null;
}

/**
 * E3 and E4 — the standing damage modifiers of being in your own base.
 *
 * E4 needs the *opponent*, because it applies only when both are inside:
 * *"both Units have to be in the Home Base"*. Passing the opponent in rather
 * than searching the board keeps this honest about what it needs.
 *
 * @param {object} unit
 * @param {object} board
 * @param {object} [ctx]
 * @param {object} [ctx.opponent] the other party to a Combat Process
 * @returns {object[]}
 */
export function homeBaseModifiers(unit, board, ctx = {}) {
  const base = ownBaseOf(unit, board);
  if (!base) return [];

  // E3 — "All damage taken by a Unit in its Home Base is reduced by 10%
  // including NP." No npValue, for the same reason as the Dark rule.
  const out = [{ key: "defUp", value: 10, direction: "taken", source: "Home Base" }];

  // E4 — and this one IS NP-reduced: "increased by 20%; if NP, 10%".
  const opponent = ctx.opponent;
  if (opponent && (opponent.panels ?? [opponent.panel]).some(
    (p) => p && (base.panels ?? []).some((q) => chebyshev(p, q) === 0),
  )) {
    out.push({ key: "atkUp", value: 20, npValue: 10, direction: "dealt", source: "Home Base" });
  }

  return out;
}

/**
 * E1 and E2 — what the Home Base gives back at the end of a Round.
 *
 * E1's exclusion is narrower than it first reads: a unit is excluded only if
 * the combat happened **within the base**. One that sortied out, fought, and
 * came home still regenerates — which is why the flag is
 * `combatInBaseThisRound` rather than `foughtThisRound`.
 *
 * E2 is checked after E1 and needs three *consecutive* Rounds. The counter
 * resets on leaving, not on fighting.
 *
 * Returns **effect descriptors**, not intents: this is layer 2, and an intent
 * is how layer 3 writes. `scheduler.endRound` maps them, the same division the
 * `OnEvent` action table uses.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {object[]} descriptors
 */
export function endOfRoundHomeBase(units, board) {
  /** @type {object[]} */
  const out = [];

  for (const u of units ?? []) {
    if (!ownBaseOf(u, board)) continue;
    const residency = u.homeBase ?? { consecutiveRounds: 0, combatInBaseThisRound: false };

    // E1 — 100 Health and 1 Agility, unless it fought here.
    if (!residency.combatInBaseThisRound) {
      out.push({ kind: "heal", unitId: u.id, amount: 100, source: "Home Base" });
      out.push({ kind: "statDelta", unitId: u.id, stat: "agility.value", delta: 1 });
    }

    // E2 — three full Rounds cures every removable debuff.
    if ((residency.consecutiveRounds ?? 0) >= 3) {
      for (const e of u.effectInstances ?? []) {
        if (e.unremovable) continue;
        if (e.polarity && e.polarity !== "debuff") continue;
        out.push({ kind: "removeEffect", unitId: u.id, effectId: e.id ?? e.defId, reason: "Home Base" });
      }
    }
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  19.4 — the Holy Grail                                                     */
/* -------------------------------------------------------------------------- */

/** How far from the Grail counts as "the Grail Area". */
const GRAIL_AREA = 2;

/**
 * A fresh Grail.
 * @param {object} [opts]
 * @returns {object}
 */
export function grailState({ threshold = 9 } = {}) {
  return {
    threshold, defeatedCount: 0, materialized: false,
    position: null, contest: {}, destroyed: false,
  };
}

/**
 * Count a removal towards materialization.
 *
 * *"A disappeared Servant counts towards the number of Servants needed for the
 * Grail to materialize (but not if inflicted with Erase)."* So the cause
 * matters, and only Servants count.
 *
 * @param {object} state
 * @param {object} unit
 * @param {string} [cause]
 * @returns {object} a new state
 */
export function registerDefeat(state, unit, cause = "damage") {
  if (unit?.kind !== "servant") return state;
  if (cause === "erase") return state;

  const defeatedCount = state.defeatedCount + 1;
  return { ...state, defeatedCount, materialized: state.materialized || defeatedCount >= state.threshold };
}

/**
 * Advance the acquisition contest by one Round.
 *
 * Two positions matter and they are **different distances**: a claimant must be
 * *"on a panel next to"* the Grail (Chebyshev 1), while a blocker need only be
 * within the Grail Area (Chebyshev 2). Conflating them would let a unit claim
 * the Grail with an enemy two panels away.
 *
 * Any enemy in the Area resets **every** contender, not just the ones it
 * threatens — and because each rival is an enemy for the other, two adjacent
 * claimants from different factions produce a standoff rather than a race.
 *
 * @param {object} state
 * @param {object[]} units
 * @returns {{contest: object, claimedBy: string|null}}
 */
export function grailContest(state, units) {
  if (!state.materialized || !state.position || state.destroyed) {
    return { contest: state.contest ?? {}, claimedBy: null };
  }

  const inArea = (units ?? []).filter((u) => chebyshev(u.panel, state.position) <= GRAIL_AREA);
  const adjacent = inArea.filter((u) => chebyshev(u.panel, state.position) <= 1);

  /** @type {Record<string, {unitId: string, roundsHeld: number}>} */
  const contest = {};
  let claimedBy = null;

  for (const u of adjacent) {
    // Anyone of another faction inside the Area denies this unit its Round.
    const contested = inArea.some((other) => other.faction !== u.faction);
    if (contested) continue;

    const held = (state.contest?.[u.id]?.roundsHeld ?? 0) + 1;
    contest[u.id] = { unitId: u.id, roundsHeld: held };
    if (held >= 1) claimedBy = u.id;
  }

  return { contest, claimedBy };
}

/**
 * The chance an AoE Noble Phantasm destroys the Grail.
 *
 * *"The chance is X%, where X = the amount of damage dealt by the NP divided by
 * 20."* A 2,000-damage NP is therefore a guaranteed loss **for everyone**,
 * which is why §19.4 requires the targeting preview to warn and take a second
 * confirmation before it is thrown.
 *
 * @param {number} damage
 * @returns {number} a percentage, 0–100
 */
export function grailDestructionChance(damage) {
  return Math.max(0, Math.min(100, (damage ?? 0) / 20));
}

/* -------------------------------------------------------------------------- */
/*  19.3 — the war's Region                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which regions border which.
 *
 * *"Directly next to"* is a geographic adjacency the source does not tabulate,
 * so this ships as curated, editable data (§19.3). Semiramis's HGoB Construction
 * counter is the only consumer today — but the mechanism is general, and a
 * one-way edge would make her counter depend on the order two regions happened
 * to be compared in, so the graph is kept **symmetric** and a test enforces it.
 *
 * @type {Readonly<Record<string, {adjacent: string[]}>>}
 */
export const REGION_ADJACENCY = Object.freeze({
  greece: { adjacent: ["europe", "middleEast", "mesopotamia"] },
  europe: { adjacent: ["greece", "netherlands", "england", "middleEast"] },
  netherlands: { adjacent: ["europe", "england"] },
  england: { adjacent: ["europe", "netherlands", "ireland"] },
  ireland: { adjacent: ["england"] },
  middleEast: { adjacent: ["greece", "europe", "mesopotamia", "india"] },
  mesopotamia: { adjacent: ["greece", "middleEast", "india"] },
  india: { adjacent: ["middleEast", "mesopotamia", "eastIndia", "farEast"] },
  eastIndia: { adjacent: ["india", "farEast"] },
  farEast: { adjacent: ["india", "eastIndia", "japan"] },
  japan: { adjacent: ["farEast"] },
  // The Moon borders nothing. Stated rather than omitted, so "no entry" and
  // "no neighbours" stay distinguishable.
  moon: { adjacent: [] },
});

/**
 * The parameter steps a unit gains from the war's Region.
 *
 * *"All Servants from the corresponding Region selected receive a + to all
 * Parameters."* Servants only, and matching is **any** — Van Gogh lists
 * Netherlands, Europe and Greece, and benefits from a war in any of the three.
 *
 * Because it grants parameter *steps* it also moves Base Attack by ±10 per step
 * (Ch. 05 §5.6), which is why `parameters` separates `base` from `granted`.
 *
 * @param {object} unit
 * @param {string|null} warRegion
 * @returns {number} steps granted
 */
export function regionBonusFor(unit, warRegion) {
  if (!warRegion) return 0;
  if (unit?.kind !== "servant") return 0;
  return (unit.region ?? []).includes(warRegion) ? 1 : 0;
}

/**
 * Are two regions geographically adjacent?
 *
 * A region is never adjacent to itself: *"in a Middle East region"* and
 * *"directly next to a Middle East region"* are the two separate branches of
 * Semiramis's rule, and collapsing them would give her both bonuses at once.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function regionsAdjacent(a, b) {
  if (!a || !b || a === b) return false;
  return (REGION_ADJACENCY[a]?.adjacent ?? []).includes(b);
}

/* -------------------------------------------------------------------------- */
/*  19.5 — Civilians                                                          */
/* -------------------------------------------------------------------------- */

/**
 * May this Servant attack a Civilian at all?
 *
 * *"Servants with the 'Good' Alignment will not kill Civilians. They will only
 * kill Civilians if a Command Spell is used."* — so this is a refusal with a
 * named override, not a hard prohibition.
 *
 * @param {object} attacker
 * @param {object} [ctx]
 * @param {string[]} [ctx.overrides] reasons a Command Spell has overridden
 * @returns {{ok: boolean, reason?: string}}
 */
export function mayAttackCivilian(attacker, ctx = {}) {
  if (attacker?.alignment?.morality !== "good") return { ok: true };
  if ((ctx.overrides ?? []).includes("goodAligned")) return { ok: true };
  return { ok: false, reason: "goodAligned" };
}

/**
 * Killing a Civilian.
 *
 * A distinct resolution path (Ch. 04 §4.6): no damage calculation, no reaction
 * ladder, no Overpower. The Civilian dies and the killer is paid.
 *
 * @param {object} attacker
 * @param {object} civilian
 * @returns {object[]} descriptors
 */
export function civilianKill(attacker, civilian) {
  return [
    { kind: "defeat", unitId: civilian.id, cause: "civilianKilled" },
    { kind: "heal", unitId: attacker.id, amount: 100, source: "Civilian" },
    { kind: "statDelta", unitId: attacker.id, stat: "agility.value", delta: 1 },
  ];
}

/**
 * How many Civilians the board is short of its invariant.
 *
 * *"On Lunatic, there should always be at least 2 Civilians on the board."*
 * Checked at round start and topped up by spawning on random unoccupied
 * non-home-base panels.
 *
 * @param {object[]} units
 * @param {string} difficulty
 * @returns {number}
 */
export function civiliansNeeded(units, difficulty) {
  if (difficulty !== "lunatic") return 0;
  const present = (units ?? []).filter((u) => u.kind === "civilian").length;
  return Math.max(0, 2 - present);
}

/* -------------------------------------------------------------------------- */
/*  19.4 — victory, and 19.7 — the setup gates                                */
/* -------------------------------------------------------------------------- */

/**
 * Has anybody won, or has everybody lost?
 *
 * Order matters: **destruction is checked first**, so throwing an area Noble
 * Phantasm over the Grail can never be a way to win. A player who destroys it
 * while holding it has still ended the game with no winners.
 *
 * @param {object} board
 * @returns {{outcome: string, faction?: string|null}|null}
 */
export function checkVictory(board) {
  if (board?.grail?.destroyed) return { outcome: "noWinner", faction: null };

  const held = Object.values(board?.grail?.contest ?? {}).find((c) => (c.roundsHeld ?? 0) >= 1);
  if (held) {
    const holder = (board.units ?? []).find((u) => u.id === held.unitId);
    return { outcome: "grailObtained", faction: holder?.faction ?? null };
  }

  const alive = [...new Set((board.units ?? [])
    .filter((u) => (u.health?.value ?? 0) > 0 && u.faction)
    .map((u) => u.faction))];
  if (alive.length === 1) return { outcome: "elimination", faction: alive[0] };

  return null;
}

/**
 * *"During the first Round, neither Player/Faction is allowed to Attack."*
 *
 * A hard gate on declaration, so the refusal names the rule rather than letting
 * a player discover it by having their targeting rejected for no visible reason.
 *
 * @param {number} round
 * @returns {boolean}
 */
export function attacksPermitted(round) {
  return (round ?? 1) > 1;
}

/**
 * E5 — is Territory Creation amplified for this owner right now?
 *
 * Keyed on where the **owner** stands, not on where its target is: the
 * offensive bonus applies *"even to attacks out of the base"*. Reading it off
 * the target would silently halve the skill's value.
 *
 * @param {object} owner
 * @param {object} board
 * @param {object} [_targetPanel] accepted and ignored, deliberately
 * @returns {boolean}
 */
export function territoryCreationAmplified(owner, board, _targetPanel = null) {
  void _targetPanel;
  return ownBaseOf(owner, board) !== null;
}
