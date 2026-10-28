/**
 * @file An Effect definition's damage-over-time tick, read from its own `periodic`.
 * @see module/engine/scheduler.mjs#tickPeriodics, docs/15-effect-application.md
 *
 * Pure: the scheduler, the sheet and the content validator all read it.
 */

import { parseTick, resolveTicks } from "../domain/tick.mjs";

/** Keys an authored `periodic` may carry. The validator refuses any other. */
export const PERIODIC_KEYS = Object.freeze([
  "when", "amount", "scaling", "actedOnly", "healConversion", "bypassModifiers", "kind", "every",
]);

/** The boundaries a periodic ticks at. */
export const PERIODIC_WHEN = Object.freeze(["turnEnd", "roundEnd", "actedTurnEnd"]);

/** How an authored periodic's `amount` grows with the instance's stage. */
export const PERIODIC_SCALINGS = Object.freeze(["flat", "perStage", "doubling"]);

/**
 * The damage-over-time tick an Effect definition authors, or `null`.
 *
 * Read from the definition's own `periodic` and nowhere else (#105). Until
 * this, every file carried a `periodic` the registry copied and nobody read,
 * and the scheduler ticked from a table of its own -- so a content fix to a
 * tick reached no match, and Freeze ticked twice: 100 from the table and 100
 * from its file's own Round-end rule.
 *
 * `amount` is the tick at stage 1. `scaling` says how it grows with the stage:
 * Poison's *"20 × 2^(N−1)"* is `doubling`, Curse's *"25 per stage"* is
 * `perStage`. A periodic of another `kind` (Np Cooldown Regen's) is not damage
 * and has its own reader.
 *
 * @param {object|null} def an Effect definition from the registry
 * @returns {{when: string, amount: (e: object) => number, actedOnly: boolean,
 *   healConversion: string|null}|null}
 */
export function periodicOf(def) {
  const p = def?.periodic;
  if (!p || (p.kind && p.kind !== "damage") || typeof p.amount !== "number") return null;
  const amount = (e) => {
    const stage = e?.stage || 1;
    if (p.scaling === "doubling") return p.amount * 2 ** (stage - 1);
    if (p.scaling === "perStage") return p.amount * stage;
    return p.amount;
  };
  return {
    when: p.when, amount, actedOnly: Boolean(p.actedOnly), healConversion: p.healConversion ?? null,
    every: p.every ?? null,
  };
}

/**
 * Is a periodic tick due at this Turn's end?
 *
 * Curse: *"at the end of the turn, every ⅓◈"* (Appendix A). ⅓◈ is a Turn with
 * three a Round and two with eight (`domain/tick.mjs#fractionTicks`), counted
 * from the Turn the instance landed on, which ticks first (ruled 2026-10-28,
 * the user). A periodic that states no `every` ticks at each of its boundaries,
 * as before.
 *
 * @param {{every?: string|null}} spec from {@link periodicOf}
 * @param {{appliedTick?: number|null}} instance the held instance
 * @param {number} tick the Turn ending
 * @param {number} turnsPerRound
 * @returns {boolean}
 */
export function periodicDue(spec, instance, tick, turnsPerRound) {
  if (!spec?.every) return true;
  const interval = Math.max(1, resolveTicks(parseTick(spec.every), { turnsPerRound }));
  const since = tick - (typeof instance?.appliedTick === "number" ? instance.appliedTick : tick);
  return since >= 0 && since % interval === 0;
}
