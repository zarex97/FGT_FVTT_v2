/**
 * @file The Queen's Glass Game's clock, and who it catches.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 * @see docs/43-bounded-fields.md §43.11
 *
 * Layer 2 (rules). Pure.
 */

import { chebyshev } from "../domain/geometry.mjs";

/** *"…all Units within a 3 panel area of Nursery."* */
export const GLASS_GAME_RADIUS = 3;

/**
 * How far along effect 1's countdown this Unit is, and whether it fires.
 *
 * > *"Activates at the end of the Turn, 3◈ Turns after Nursery enters Combat,
 * > if there are still enemy Units within a 3 panel area of Nursery at the end
 * > of that Turn."*
 * > *"At the end of every Round, if there are no enemy Units within a 3 panel
 * > area of Nursery, the effect of / duration of time passed for this NP is
 * > reset."*
 *
 * **"Enters Combat" is a moment this engine does not have.** There is no
 * `enterCombat` event, no combat-lock flag and no `inCombat` state anywhere in
 * `module/`; the phrase occurs once in the whole repository, in Ch. 43 §43.11's
 * quotation of this same sheet.
 *
 * So it is DEFINED here as *the first Turn end at which an enemy Unit stands
 * within her 3-panel ring*, and the derivation is the clause's own next
 * sentence: the RESET is keyed on exactly that predicate, so the START must be
 * too — a clock that begins on one condition and resets on another cannot be
 * reasoned about. Reading it as "when the match starts" would also leave the
 * reset clause meaningless for the first three Rounds of every game.
 *
 * One predicate, read at one boundary, doing both jobs.
 *
 * @param {{ticks: number}} clock
 * @param {object[]} ring the Units within 3 panels of her
 * @param {object} [options]
 * @param {number} [options.turnsPerRound]
 * @param {boolean} [options.roundEnd] apply the reset rather than the advance
 * @returns {{ticks: number, fires: boolean, reason: string|null}}
 */
export function glassGameClock(clock, ring, { turnsPerRound = 3, roundEnd = false } = {}) {
  const enemies = ring.filter((u) => u.relation === "enemy").length;

  // THE RESET, and it is the CLOCK that resets, not the buffer. *"the effect of
  // / duration of time passed for this NP is reset"* -- the recorded history
  // must survive, because effect 2 still needs six Rounds of it.
  if (roundEnd && enemies === 0) {
    return { ticks: 0, fires: false, reason: "ringEmpty", clearsHistory: false };
  }
  if (roundEnd) return { ...clock, fires: false, reason: null, clearsHistory: false };

  if (enemies === 0) {
    // The clock does not advance while nobody is there to be caught, and it is
    // not reset either -- that happens at Round end, which is what the sheet
    // says.
    return { ticks: clock.ticks ?? 0, fires: false, reason: "ringEmpty", clearsHistory: false };
  }

  const ticks = (clock.ticks ?? 0) + 1;
  // *"…if there are STILL enemy Units within a 3 panel area at the end of that
  // Turn."* The clock reaching three Rounds is necessary and not sufficient,
  // and the second test is the one just made above.
  const fires = ticks >= 3 * turnsPerRound;
  return { ticks, fires, reason: null, clearsHistory: false };
}

/**
 * Everyone the rewind reaches.
 *
 * > *"…all Units within a 3 panel area of Nursery."* — not *enemy* Units. The
 * > clause that gates the firing names enemies; the clause that says who is
 * > affected does not, and effect 2 adds *"(includes herself)"* in case there
 * > were any doubt.
 *
 * @param {object} self Nursery's projection
 * @param {object[]} units
 * @param {boolean} includesSelf
 * @returns {string[]}
 */
export function glassGameTargets(self, units, includesSelf) {
  if (!self?.panel) return [];
  return units
    .filter((u) => u.panel)
    .filter((u) => (u.id === self.id ? includesSelf : true))
    .filter((u) => chebyshev(u.panel, self.panel) <= GLASS_GAME_RADIUS)
    .map((u) => u.id);
}
