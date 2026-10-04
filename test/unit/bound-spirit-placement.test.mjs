/**
 * @file A Spirit bound to a field appears inside it (#180).
 * @see module/engine/fields.mjs#boundPlacement
 *
 * Live: Achilles and Ozymandias stood on Doomsday Come's last row. The first
 * free panel beside each was the row below, so both Kagome Spirits appeared
 * outside the area, where its isolation forbade the Attack they exist to make.
 */

import { describe, it, expect } from "vitest";
import { boundPlacement } from "../../module/engine/fields.mjs";

const at = (i, j) => ({ i, j });
/** A 7x7 Doomsday Come, rows and columns 5-11. */
const field = { id: "dc", geometry: { kind: "fixedArea", anchor: at(8, 8), shape: { size: 7 } } };
const board = { units: [], bounds: { iMin: 0, iMax: 20, jMin: 0, jMax: 20 } };

describe("boundPlacement", () => {
  it("skips the free panels beside the enemy that lie outside", () => {
    // Achilles at (11,9): the nearest free panel was (12,8), below the area.
    const beside = [at(12, 8), at(12, 9), at(10, 8), at(11, 8)];
    expect(boundPlacement(beside, field, board)).toEqual([at(10, 8)]);
  });

  it("falls back to a free panel anywhere inside", () => {
    const [p] = boundPlacement([at(12, 8), at(12, 9)], field, board, () => 0);
    expect(p.i).toBeGreaterThanOrEqual(5);
    expect(p.i).toBeLessThanOrEqual(11);
    expect(p.j).toBeGreaterThanOrEqual(5);
    expect(p.j).toBeLessThanOrEqual(11);
  });

  it("places nothing when the area is full", () => {
    const units = [];
    for (let i = 5; i <= 11; i += 1) for (let j = 5; j <= 11; j += 1) units.push({ id: `${i}-${j}`, panel: at(i, j) });
    expect(boundPlacement([at(12, 8)], field, { ...board, units })).toEqual([]);
  });
});
