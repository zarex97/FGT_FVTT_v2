/**
 * @file The four panels around a Unit, read off its facing.
 * @see docs/08-board-and-geometry.md §8.8
 * @see docs/superpowers/specs/2026-09-12-raikou-design.md R4
 *
 * Layer 2 (rules). Pure.
 *
 * Raikou's Goō Shōrai・Tenmōkaikai: *"four extra clones of herself, which
 * appear on the panels in front of her, behind her, and her left and right."*
 *
 * **An ordered formation, not a disc.** Every placement in the corpus until now
 * took the first N free panels out of `chebyshevDisc` in whatever order it
 * produced — *"within a 5x5 area"*, *"on a panel directly next to her"* — and
 * that is right when the summons are interchangeable. Raikou's are not: the
 * four differ in Range, element and rider, so **which one is in front** is part
 * of the clause rather than a detail of the spawn.
 *
 * **Derived from the facing by rotation, not tabulated.** Four of the eight
 * facings are diagonals, so *"in front of"* a Servant facing `ne` is
 * `(i−1, j+1)`. An 8×4 table would be 32 entries obliged to agree with
 * `geometry.mjs#coneOf` for ever; `rotateFacing` is the same arithmetic from
 * the other end.
 *
 * **Displacement is OUTWARD along the same axis.** *"In front of her"* stays in
 * front of her: sliding a blocked clone onto a neighbouring axis would put two
 * copies on one side and none on another, which is a different formation from
 * the one the sheet draws. A clone with nowhere to go on its own axis does not
 * appear, and the caller says which one and why — a summon that quietly failed
 * to exist is worse than one that appeared further out, which is the ruling
 * `engine/summoning.mjs#placeSummons` already made for Medea's Warriors.
 */

import { FACING_OFFSETS, rotateFacing } from "../../domain/geometry.mjs";

/**
 * How far clockwise from the Unit's own facing each named direction lies.
 *
 * @type {Readonly<Record<string, number>>}
 */
export const ROTATION = Object.freeze({ front: 0, right: 90, back: 180, left: 270 });

/** The order the sheet lists them in: *"in front of her, behind her, left and right"*. */
export const SHEET_ORDER = Object.freeze(["front", "back", "left", "right"]);

/**
 * One panel per named direction, in order, displaced outward where blocked.
 *
 * @param {{i: number, j: number}} origin the Unit's own panel
 * @param {string} facing one of `domain/enums.mjs#FACINGS`
 * @param {readonly string[]} order which directions, and in which order
 * @param {object} opts
 * @param {{width: number, height: number}|null} [opts.bounds] the board, if it has edges
 * @param {ReadonlySet<string>} [opts.occupied] `"i,j"` keys already taken
 * @param {number} [opts.maxDistance] how far out to search before giving up
 * @returns {Array<{i: number, j: number}|null>} one entry per `order` entry;
 *   `null` where that direction offered no free panel
 */
export function orthogonalPanels(origin, facing, order = SHEET_ORDER, {
  bounds = null, occupied = new Set(), maxDistance = 6,
} = {}) {
  // A live copy: each placement blocks the next, so a displaced clone can never
  // land on a sibling that has not been placed yet.
  const taken = new Set(occupied);
  /** @type {Array<{i: number, j: number}|null>} */
  const out = [];

  for (const name of order) {
    const step = FACING_OFFSETS[rotateFacing(facing, ROTATION[name] ?? 0)];
    let found = null;

    for (let d = 1; d <= maxDistance; d++) {
      const panel = { i: origin.i + step.i * d, j: origin.j + step.j * d };
      // Off the board ends the search on this axis rather than skipping past
      // it: there is nothing further out in that direction.
      if (bounds && (panel.i < 0 || panel.j < 0
        || panel.i >= bounds.height || panel.j >= bounds.width)) break;

      const key = `${panel.i},${panel.j}`;
      if (taken.has(key)) continue;

      taken.add(key);
      found = panel;
      break;
    }

    out.push(found);
  }

  return out;
}
