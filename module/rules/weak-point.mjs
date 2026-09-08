/**
 * @file A weak point — a declared sub-attack with its own hit table.
 * @see docs/44-case-expanded-roster.md §44.2
 *
 * Layer 2. Pure: the chance is computed from two Unit projections and the state
 * of the Combat Process, and nothing here rolls or writes.
 *
 * Achilles' Heel is the only one in either roster, and Ch. 44 §44.2 calls it
 * *"the most involved single mechanic"* there. Three things make it novel:
 *
 * 1. **The attacker opts in at declaration**, and it is resolved after a failed
 *    Evade — an optional branch in a ladder that was otherwise fixed.
 * 2. **Six conditional modifiers over a base that depends on the side struck**,
 *    one of them bought with a Luck Check.
 * 3. **Failure is better than not trying**: *"if the AU's Heel Attack fails,
 *    Achilles successfully Evades the Attack"*, so losing the sub-roll turns a
 *    failed Evade into a successful one. That is the ladder's business, not
 *    this file's, but it is why the chance has to be honest about being zero:
 *    an attacker who declares a 0% Heel Attack has thrown the attack away.
 *
 * The spec is data, so any later "aim for the weak spot" content reuses it
 * without touching this module.
 */

import { coneOf, chebyshev } from "../domain/geometry.mjs";
import { detectRangeOf } from "./identity.mjs";
import { stanceOf } from "./stance.mjs";

/**
 * @typedef {object} WeakPointSpec
 * @property {string} id
 * @property {string[]} [availableWhen] roll options the DEFENDER must satisfy
 * @property {Record<string, number>} baseChanceBySide `front`/`left`/`right`/`back`
 * @property {number} [agilityBonus] when the attacker's Agility is >= the defender's
 * @property {{atLeast: number, value: number}} [rangeBonus]
 * @property {number} [initiatorBonus] when the attacker initiated rather than Countered
 * @property {number} [aoePenalty] negative
 * @property {number} [fogOfWarBonus] struck from outside the defender's Detect range
 * @property {number} [luckCheckBonus]
 */

/**
 * The chance this weak-point attack succeeds, and why.
 *
 * `breakdown` carries every clause that was CONSIDERED, including the ones that
 * contributed nothing — the offer shows its working, and "the Range bonus did
 * not apply" is information the attacker is deciding with.
 *
 * @param {WeakPointSpec} spec
 * @param {object} ctx
 * @param {object} ctx.defender the Unit projection being aimed at
 * @param {object} ctx.attacker
 * @param {object} ctx.state the Combat Process state
 * @param {object|null} [ctx.board]
 * @param {boolean} [ctx.luckCheckPassed]
 * @returns {{chance: number, breakdown: Array<{label: string, delta: number}>, available: boolean}}
 */
export function weakPointChance(spec, { defender, attacker, state, board = null, luckCheckPassed = false }) {
  const available = isAvailable(spec, defender);
  /** @type {Array<{label: string, delta: number}>} */
  const breakdown = [];

  // Which of his four cones the attack came from. `coneOf` has answered this
  // since it was written and named Achilles' Heel in its own docstring; this is
  // its second caller and the one it was written for.
  const side = defender?.panel && attacker?.panel
    ? coneOf(defender.facing ?? "n", defender.panel, attacker.panel)
    : "front";
  let chance = spec.baseChanceBySide?.[side] ?? 0;
  breakdown.push({ label: side, delta: chance });

  const add = (label, delta) => {
    breakdown.push({ label, delta });
    chance += delta;
  };

  // (a) "if the AU's Agility is equal to or higher than Achilles'."
  //
  // Both readings of the field, because the two projections disagree:
  // `snapshotUnit` carries `{value, max}` and the BOARD carries a plain number.
  // Reading only the first gave `undefined` on both sides, compared them as
  // zeroes, and awarded the bonus every time — found live, on a board where
  // Achilles's Agility is 19 and his attacker's is 14.
  if (typeof spec.agilityBonus === "number") {
    const mine = agilityOf(attacker);
    const theirs = agilityOf(defender);
    // Unknowable on either side is not "equal": the clause compares two numbers
    // and a missing one is not a number.
    const applies = mine !== null && theirs !== null && mine >= theirs;
    add("agility", applies ? spec.agilityBonus : 0);
  }

  // (b) "if the Attack was performed at a Range of 3 or higher." Chebyshev, the
  // same measure `attackFacts` uses for every other range question.
  if (spec.rangeBonus) {
    const distance = defender?.panel && attacker?.panel
      ? chebyshev(defender.panel, attacker.panel)
      : 0;
    add("range", distance >= spec.rangeBonus.atLeast ? spec.rangeBonus.value : 0);
  }

  // (c) "if Combat was initiated by the AU (i.e. not a Counter Attack after
  // being Attacked by Achilles himself)."
  if (typeof spec.initiatorBonus === "number") {
    add("initiated", state?.isCounter ? 0 : spec.initiatorBonus);
  }

  // (d) "Reduce ... by 10% if the Attack was an AoE Attack." The only negative
  // clause, and the reason the total is clamped below.
  if (typeof spec.aoePenalty === "number" && state?.isAoE) add("aoe", spec.aoePenalty);

  // (e) "if Achilles was Attacked from within the Fog of War (meaning from a
  // place where he had no vision of)." His own Detect range is what "vision"
  // means everywhere else on this board, so it is what it means here.
  if (typeof spec.fogOfWarBonus === "number" && defender?.panel && attacker?.panel) {
    const seen = chebyshev(defender.panel, attacker.panel) <= detectRangeOf(defender, board);
    if (!seen) add("fogOfWar", spec.fogOfWarBonus);
  }

  // (f) "Luck Check can be used to increase the success chance." The caller
  // rolls it, as with every other check in the system, and passes the outcome.
  if (typeof spec.luckCheckBonus === "number" && luckCheckPassed) {
    add("luckCheck", spec.luckCheckBonus);
  }

  return { chance: Math.max(0, chance), breakdown, available };
}

/**
 * Should the attacker be offered this at all?
 *
 * Only when it can succeed. *"The player states whether the AU performs a Heel
 * Attack or not"* is a real decision, and putting it in front of an ordinary
 * frontal attack that cannot land is a prompt asking nothing — while hiding it
 * when it CAN land would take the decision away.
 *
 * The Luck Check is deliberately NOT counted. It would make every angle
 * offerable — +25 over a base of zero is still 25 — and a prompt in front of
 * every ordinary frontal attack on him is the thing this test exists to avoid.
 * The Luck Check is an opt-in INSIDE the offer, so it raises a chance that was
 * already worth asking about rather than conjuring one.
 *
 * @param {WeakPointSpec} spec
 * @param {object} ctx as {@link weakPointChance}
 * @returns {boolean}
 */
export function weakPointOffered(spec, ctx) {
  const out = weakPointChance(spec, { ...ctx, luckCheckPassed: false });
  return out.available && out.chance > 0;
}

/**
 * A Unit's current Agility, however its projection spells it.
 *
 * @param {object} unit
 * @returns {number|null}
 */
function agilityOf(unit) {
  const raw = unit?.agility;
  if (typeof raw === "number") return raw;
  if (typeof raw?.value === "number") return raw.value;
  return null;
}

/**
 * @param {WeakPointSpec} spec
 * @param {object} defender
 * @returns {boolean}
 */
function isAvailable(spec, defender) {
  // *"Whenever Achilles participates in a Combat Phase while UNMOUNTED"* — the
  // condition is on the DEFENDER, which is why it is read here rather than
  // through the attack's own option set.
  for (const option of spec.availableWhen ?? []) {
    const [side, key, value] = option.split(":");
    if (side !== "self") continue;
    if (key === "stance" && stanceOf(defender) !== value) return false;
  }
  return true;
}
