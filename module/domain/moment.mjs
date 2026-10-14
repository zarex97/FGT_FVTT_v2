/**
 * @file The Moment: a point in the match.
 * @see CONTEXT.md (Moment, Tick, ◈), docs/04-time-model.md
 *
 * Layer 1 (domain). Pure.
 *
 * A Moment is a Round and the Tick of the match: how many Turns have passed
 * since it began (`combat.system.globalTurn`). Whatever happens at a Round's
 * or a Turn's end reads the Moment that ENDED, not the clock -- because the
 * clock has already moved on by the time it runs. Foundry advances
 * `combat.round` before the end-of-Round handlers fire, so a reader of the live
 * Round found the ended Round's records stale: Home Base healed a Master who
 * had fought in it (#199). A boundary therefore names its Moment and hands it
 * to the Board, the Unit view and Expiry, rather than each of them reading the
 * clock for itself.
 *
 * Either part may be `null`: out of a started match there is no clock, and a
 * record read against `null` is never stale.
 */

/**
 * @typedef {{round: number|null, tick: number|null}} Moment
 */

/**
 * @param {number|null} [round]
 * @param {number|null} [tick]
 * @returns {Readonly<Moment>}
 */
export function moment(round = null, tick = null) {
  return Object.freeze({ round: round ?? null, tick: tick ?? null });
}

/** No clock: before the match starts, or outside one. */
export const NO_MOMENT = moment(null, null);
