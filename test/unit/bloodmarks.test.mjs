/**
 * @file The four Bloodmarks, and the square they define.
 * @see module/rules/bloodmarks.mjs, docs/43-bounded-fields.md §43.4
 */

import { describe, it, expect } from "vitest";
import { squareFrom, completedSquare, LEGAL_SIZES } from "../../module/rules/bloodmarks.mjs";

const at = (i, j) => ({ i, j });
const corners = (i, j, n) => [at(i, j), at(i, j + n - 1), at(i + n - 1, j), at(i + n - 1, j + n - 1)];

describe("squareFrom", () => {
  it("accepts each of the three stated sizes", () => {
    // "the four corner panels of a 5x5, 7x7, or 9x9 panel area"
    for (const n of LEGAL_SIZES) {
      const out = squareFrom(corners(3, 3, n));
      expect(out?.size, `${n}x${n}`).toBe(n);
      expect(out.panels.length, `${n}x${n} interior`).toBe(n * n);
    }
  });

  it("refuses a size the sheet does not name", () => {
    expect(squareFrom(corners(3, 3, 6))).toBe(null);
    expect(squareFrom(corners(3, 3, 3))).toBe(null);
    expect(squareFrom(corners(3, 3, 11))).toBe(null);
  });

  it("refuses a RECTANGLE — the sheet says NxN", () => {
    expect(squareFrom([at(0, 0), at(0, 6), at(4, 0), at(4, 6)])).toBe(null);
  });

  it("refuses four marks that are not corners", () => {
    // Three collinear and one adrift is four panels, not a square.
    expect(squareFrom([at(0, 0), at(0, 2), at(0, 4), at(4, 4)])).toBe(null);
  });

  it("refuses a duplicate standing in for a missing corner", () => {
    expect(squareFrom([at(0, 0), at(0, 0), at(0, 4), at(4, 4)])).toBe(null);
  });

  it("refuses fewer or more than four", () => {
    expect(squareFrom(corners(3, 3, 5).slice(0, 3))).toBe(null);
    expect(squareFrom([...corners(3, 3, 5), at(9, 9)])).toBe(null);
  });

  it("does not care what order they were placed in", () => {
    // Four separate Turns, and nothing says which corner comes first.
    expect(squareFrom([...corners(3, 3, 7)].reverse())?.size).toBe(7);
  });

  it("reports the corners it used, which is what survives activation", () => {
    const out = squareFrom(corners(2, 2, 5));
    expect(out.corners).toHaveLength(4);
    expect(out.corners).toContainEqual(at(2, 2));
    expect(out.corners).toContainEqual(at(6, 6));
  });
});

describe("completedSquare", () => {
  it("finds a square among more than four marks", () => {
    // "Whenever Bloodfort Andromeda is complete, all OTHER Bloodmarks will
    // vanish" only means anything if a stray mark can coexist with a set.
    const marks = [...corners(3, 3, 5), at(11, 11)];
    expect(completedSquare(marks)?.size).toBe(5);
  });

  it("is null while fewer than four are placed", () => {
    expect(completedSquare(corners(3, 3, 5).slice(0, 3))).toBe(null);
  });

  it("is null when no four of them make a legal square", () => {
    expect(completedSquare([at(0, 0), at(0, 3), at(3, 0), at(9, 9), at(1, 1)])).toBe(null);
  });
});
