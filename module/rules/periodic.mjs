/**
 * @file An Effect definition's damage-over-time tick, read from its own `periodic`.
 * @see module/engine/scheduler.mjs#tickPeriodics, docs/15-effect-application.md
 *
 * Pure: the scheduler, the sheet and the content validator all read it.
 */

/** Keys an authored `periodic` may carry. The validator refuses any other. */
export const PERIODIC_KEYS = Object.freeze([
  "when", "amount", "scaling", "actedOnly", "healConversion", "bypassModifiers", "kind",
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
  return { when: p.when, amount, actedOnly: Boolean(p.actedOnly), healConversion: p.healConversion ?? null };
}
