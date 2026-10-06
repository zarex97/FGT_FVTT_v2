/**
 * @file Blood Fort Andromeda's four Bloodmarks, and the square they define.
 * @see docs/28-bounded-fields.md (`markDefined`), Ch. 28
 *
 * Layer 2 (rules). Pure.
 *
 * The only bounded field in the corpus that is **built rather than cast**:
 *
 * > *"To use this Noble Phantasm, Medusa has to first Mark the four corner
 * > panels of a 5x5, 7x7, or 9x9 panel area, these Marks will be known as
 * > Bloodmarks. Using the 'Mark' Action places a Bloodmark on the panel Medusa
 * > is standing on, and counts as her Attack for the Turn. ... If all four
 * > Bloodmarks are complete, Bloodfort Andromeda is activated."*
 *
 * So the area exists four Actions and at least four Turns after the decision to
 * make it, and the half-built state is four objects on the board rather than
 * anything held in a dialog. That is the safer half of the design.
 */

import { chebyshev } from "../domain/geometry.mjs";
import { alliancesOf, factionForUser } from "./factions.mjs";

/** *"the four corner panels of a 5x5, 7x7, or 9x9 panel area"*. */
export const LEGAL_SIZES = Object.freeze([5, 7, 9]);

/**
 * The area four marks define, or `null` if they define none.
 *
 * **Corners**, not merely four panels: the sheet says *"the four CORNER
 * panels"*, so three in a row and a fourth adrift is not a field. A square, not
 * a rectangle, and only at the three stated sizes — a 5×7 is not on the list
 * and a 6×6 is not either.
 *
 * Order-independent, because the marks are placed over four separate Turns and
 * nothing says which corner comes first.
 *
 * @param {Array<{i: number, j: number}>} marks
 * @returns {{panels: Array<{i: number, j: number}>, size: number,
 *            corners: Array<{i: number, j: number}>}|null}
 */
export function squareFrom(marks) {
  if (!Array.isArray(marks) || marks.length !== 4) return null;
  if (marks.some((m) => !Number.isInteger(m?.i) || !Number.isInteger(m?.j))) return null;

  const is = [...new Set(marks.map((m) => m.i))].sort((a, b) => a - b);
  const js = [...new Set(marks.map((m) => m.j))].sort((a, b) => a - b);
  // Exactly two distinct rows and two distinct columns is what "four corners"
  // means. Anything else is four panels that happen to number four.
  if (is.length !== 2 || js.length !== 2) return null;

  const height = is[1] - is[0] + 1;
  const width = js[1] - js[0] + 1;
  if (height !== width || !LEGAL_SIZES.includes(height)) return null;

  // All four combinations must be present. Two rows and two columns could
  // otherwise be satisfied with a duplicate standing in for a missing corner.
  const seen = new Set(marks.map((m) => `${m.i},${m.j}`));
  const corners = [];
  for (const i of is) {
    for (const j of js) {
      if (!seen.has(`${i},${j}`)) return null;
      corners.push({ i, j });
    }
  }

  const panels = [];
  for (let i = is[0]; i <= is[1]; i++) {
    for (let j = js[0]; j <= js[1]; j++) panels.push({ i, j });
  }
  return { panels, size: height, corners };
}

/**
 * Which of a unit's placed marks complete a square, if any four of them do.
 *
 * A fifth mark does not invalidate the first four: *"Whenever Bloodfort
 * Andromeda is complete (Activated), all other Bloodmarks will vanish"* only
 * makes sense if a stray mark can coexist with a completed set. So this looks
 * for **any** completing four rather than requiring exactly four to exist.
 *
 * @param {Array<{i: number, j: number}>} marks every mark this unit has placed
 * @returns {{panels: object[], size: number, corners: object[]}|null}
 */
export function completedSquare(marks) {
  const all = marks ?? [];
  if (all.length < 4) return null;

  for (let a = 0; a < all.length - 3; a++) {
    for (let b = a + 1; b < all.length - 2; b++) {
      for (let c = b + 1; c < all.length - 1; c++) {
        for (let d = c + 1; d < all.length; d++) {
          const found = squareFrom([all[a], all[b], all[c], all[d]]);
          if (found) return found;
        }
      }
    }
  }
  return null;
}

/**
 * Does this viewer see this Bloodmark?
 *
 * > *"Bloodmarks can only be seen from a distance of 3 cells Maximum."*
 *
 * Ruled (#188 reading 6): **her side always sees her marks**, and every other
 * side only while one of its Units stands within reach. The first build hid a
 * mark from everyone while no enemy stood near, Medusa's own player included,
 * because the only lever it used was the token's `hidden` flag, which is one
 * value for every client.
 *
 * Asked per viewer, so the canvas can answer it client by client
 * (`apps/canvas/token.mjs#isVisible`). The GM always sees. A viewer with no
 * faction has no Units to see with, so sees nothing.
 *
 * @param {{factionId: string|null, panel: {i: number, j: number}|null, visibleWithin: number|null}} mark
 * @param {{userId: string|null, isGM: boolean}} viewer
 * @param {object[]} factions the normalized roster
 * @param {object[]} units board units, `{factionId, panel, defeated}`
 * @returns {boolean}
 */
export function markSeenBy(mark, viewer, factions, units) {
  if (!mark) return false;
  if (viewer?.isGM) return true;
  if (mark.visibleWithin === null || mark.visibleWithin === undefined) return true;

  const mine = factionForUser(factions ?? [], viewer?.userId);
  if (!mine) return false;
  const side = alliancesOf(factions ?? [])[mine.id] ?? [mine.id];
  if (side.includes(mark.factionId)) return true;
  if (!mark.panel) return false;

  return (units ?? []).some((u) =>
    u.panel && !u.defeated && side.includes(u.factionId)
    && chebyshev(u.panel, mark.panel) <= mark.visibleWithin);
}
