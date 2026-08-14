/**
 * @file Speculative damage — what the targeting preview shows before committing.
 * @see docs/28-targeting-implementation.md §28.7
 *
 * Layer 2 (rules). Pure, and deliberately so: the preview runs the **real**
 * pipeline rather than an approximation of it, which is only possible because
 * the pipeline takes a pre-populated roll map and has no side effects (Ch. 13
 * §13.3). An approximation would drift from the real thing exactly when a
 * player was relying on it.
 *
 * Two runs per target — every die at its minimum, then every die at its maximum
 * — give an exact range, not an estimate. The dice are enumerated here rather
 * than probed from the pipeline because the roll map's keys are a fixed, short,
 * documented list (Appendix C) and a probe run would cost a third pipeline call
 * to learn something already known.
 */

import { computeDamage } from "./damage/pipeline.mjs";

/**
 * Every die the pipeline can consume, with its bounds.
 *
 * `attackPlus` and `attackMinus` are the same `5d10`; which one is live depends
 * on the crit flip, so both carry the same bounds and only one is ever read.
 * @see docs/C-dice-registry.md
 */
export const DICE_BOUNDS = Object.freeze({
  attackPlus: { min: 5, max: 50 },
  attackMinus: { min: 5, max: 50 },
  zonPenalty: { min: 1, max: 20 },
  magicResistanceDice: { min: 1, max: 100 },
  battleContinuation: { min: 0, max: 0 },
  territoryCreationAtk: { min: 0, max: 0 },
  territoryCreationDef: { min: 0, max: 0 },
});

/**
 * The damage range a placement would produce against one target.
 *
 * The bounds are **not** symmetric in the obvious way: `attackMinus` subtracts,
 * so its maximum produces the *minimum* damage. Getting that backwards would
 * show a range inverted against a defender who has Battle Continuation, which
 * is precisely the case a player checks the preview for.
 *
 * @param {object} ctx a damage context, without `rolls`
 * @param {object} [opts]
 * @param {object[]} [opts.negation] the defender's rolled-formula bounds
 * @returns {{min: number, max: number, crit: {min: number, max: number}, certain: boolean}}
 */
export function damageRange(ctx, { negation = [] } = {}) {
  const noCrit = { ...ctx, crit: { ...(ctx.crit ?? {}), isCrit: false } };
  const crit = { ...ctx, crit: { ...(ctx.crit ?? {}), isCrit: true } };

  const low = computeDamage({ ...noCrit, rolls: rollsFor("min", { negation, isCrit: false }) }).total;
  const high = computeDamage({ ...noCrit, rolls: rollsFor("max", { negation, isCrit: false }) }).total;
  const critLow = computeDamage({ ...crit, rolls: rollsFor("min", { negation, isCrit: true }) }).total;
  const critHigh = computeDamage({ ...crit, rolls: rollsFor("max", { negation, isCrit: true }) }).total;

  return {
    min: Math.min(low, high),
    max: Math.max(low, high),
    crit: { min: Math.min(critLow, critHigh), max: Math.max(critLow, critHigh) },
    certain: low === high,
  };
}

/**
 * Build the roll map for one end of the range.
 *
 * `which: "min"` means *minimum resulting damage*, which is the maximum of
 * every roll that subtracts and the minimum of every roll that adds.
 *
 * @param {"min"|"max"} which
 * @param {object} args
 * @param {object[]} args.negation
 * @param {boolean} args.isCrit
 * @returns {object}
 */
export function rollsFor(which, { negation = [], isCrit = false } = {}) {
  const wantLow = which === "min";
  const rolls = {};

  // The attack roll: `attackPlus` adds on a crit, `attackMinus` subtracts.
  const attack = DICE_BOUNDS.attackPlus;
  if (isCrit) rolls.attackPlus = wantLow ? attack.min : attack.max;
  else rolls.attackMinus = wantLow ? attack.max : attack.min;

  // The ZON penalty subtracts, so its maximum is the low end.
  rolls.zonPenalty = wantLow ? DICE_BOUNDS.zonPenalty.max : DICE_BOUNDS.zonPenalty.min;

  rolls.negation = negation.map((n) => ({
    source: n.source,
    value: wantLow ? (n.max ?? 0) : (n.min ?? 0),
  }));

  return rolls;
}

/**
 * Bounds for a dice formula, without rolling it.
 *
 * Handles the `NdF+B` forms the rank tables use and nothing else — an unknown
 * formula returns a zero range rather than guessing, because a preview that
 * silently invents a number is worse than one that omits it.
 *
 * @param {string} formula
 * @returns {{min: number, max: number}}
 */
export function formulaBounds(formula) {
  const match = /^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(String(formula ?? ""));
  if (!match) return { min: 0, max: 0 };
  const [, count, faces, sign, bonus] = match;
  const flat = bonus ? (sign === "-" ? -Number(bonus) : Number(bonus)) : 0;
  return { min: Number(count) + flat, max: Number(count) * Number(faces) + flat };
}

/**
 * The defender's dice-mode negation, as bounds the preview can use.
 *
 * @param {object} defender a `UnitSnapshot`
 * @param {boolean} isNP whether the previewed attack is a Noble Phantasm
 * @returns {Array<{source: string, min: number, max: number}>}
 */
export function negationBounds(defender, isNP = false) {
  return (defender?.damageNegation ?? [])
    .filter((n) => n.mode === "dice" && n.formula)
    .map((n) => {
      const doubled = isNP && n.npDiceDoubled
        ? String(n.formula).replace(/(\d+)d(\d+)/gi, (_, c, f) => `${Number(c) * 2}d${f}`)
        : n.formula;
      const bounds = formulaBounds(doubled);
      return {
        source: n.source,
        min: bounds.min + (n.bonus ?? 0),
        max: bounds.max + (n.bonus ?? 0),
      };
    });
}

/**
 * Format a range for the preview HUD.
 *
 * @param {{min: number, max: number, certain: boolean}} range
 * @returns {string}
 */
export function formatRange(range) {
  if (range.certain || range.min === range.max) return String(range.min);
  return `${range.min} – ${range.max}`;
}
