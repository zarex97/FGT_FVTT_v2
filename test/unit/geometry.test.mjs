import { describe, it, expect } from "vitest";
import {
  chebyshev, manhattan, inAttackRange, attackRangeArea, attackRangePanels,
  squareBounds, chebyshevDisc, centredRect, adjacentBlock, line, ring,
  reachablePanels, coneOf, cardinalToward, key,
} from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });

describe("the three metrics", () => {
  it("chebyshev counts diagonals as 1", () => {
    expect(chebyshev(at(0, 0), at(2, 2))).toBe(2);
    expect(chebyshev(at(0, 0), at(0, 3))).toBe(3);
  });

  it("manhattan counts orthogonal steps only", () => {
    expect(manhattan(at(0, 0), at(2, 2))).toBe(4);
    expect(manhattan(at(0, 0), at(0, 3))).toBe(3);
  });

  it("adjacency is chebyshev 1, which the source says includes diagonals", () => {
    expect(chebyshev(at(5, 5), at(4, 4))).toBe(1);
  });
});

describe("inAttackRange — the corrected diagonal reduction", () => {
  it("is pure chebyshev at R = 1 and R = 2", () => {
    expect(attackRangeArea(1)).toBe(9);
    expect(attackRangeArea(2)).toBe(25);
    expect(inAttackRange(at(0, 0), at(2, 2), 2)).toBe(true);
  });

  it("matches the counts supplied by the game's author", () => {
    // docs/08-board-and-geometry.md §8.2. Excluded = 8R - 12 for R >= 3.
    const expected = { 1: 9, 2: 25, 3: 37, 4: 61, 5: 93, 6: 133 };
    for (const [R, count] of Object.entries(expected)) {
      expect(attackRangeArea(Number(R)), `R=${R} closed form`).toBe(count);
      expect(attackRangePanels(at(50, 50), Number(R)).length, `R=${R} enumerated`).toBe(count);
    }
  });

  it("excludes exactly the twelve corner panels the rulebook names at R = 3", () => {
    const excluded = [];
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        if (!inAttackRange(at(0, 0), at(i, j), 3)) excluded.push([i, j]);
      }
    }
    expect(excluded.length).toBe(12);
    // The clipped set is the outer ring where the off-axis offset is >= 2.
    for (const [i, j] of excluded) {
      expect(Math.max(Math.abs(i), Math.abs(j))).toBe(3);
      expect(Math.min(Math.abs(i), Math.abs(j))).toBeGreaterThanOrEqual(2);
    }
  });

  it("clips only the outermost ring — the superseded d+s<=R+1 reading clipped one ring further", () => {
    // (3,3) at R=4 is inside the outer ring and MUST be in range.
    // The old formula excluded it: 3+3 = 6 > 4+1 = 5.
    expect(inAttackRange(at(0, 0), at(3, 3), 4)).toBe(true);
    // (4,4) is on the outer ring with s=4 >= 2, so it is excluded.
    expect(inAttackRange(at(0, 0), at(4, 4), 4)).toBe(false);
    // (4,1) is on the outer ring but s=1 < 2, so it stays.
    expect(inAttackRange(at(0, 0), at(4, 1), 4)).toBe(true);
  });

  it("reproduces the R = 4 diagram from the chapter", () => {
    const rows = [];
    for (let i = -4; i <= 4; i++) {
      let row = "";
      for (let j = -4; j <= 4; j++) row += inAttackRange(at(0, 0), at(i, j), 4) ? "X" : ".";
      rows.push(row);
    }
    expect(rows).toEqual([
      "...XXX...",
      ".XXXXXXX.",
      ".XXXXXXX.",
      "XXXXXXXXX",
      "XXXXXXXXX",
      "XXXXXXXXX",
      ".XXXXXXX.",
      ".XXXXXXX.",
      "...XXX...",
    ]);
  });

  it("clips to the board", () => {
    const b = squareBounds(13);
    expect(attackRangePanels(at(0, 0), 3, b).length).toBeLessThan(37);
    for (const p of attackRangePanels(at(0, 0), 3, b)) {
      expect(p.i).toBeGreaterThanOrEqual(0);
      expect(p.j).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("shapes", () => {
  it("chebyshevDisc is the (2r+1) square — 'within an N panel area'", () => {
    expect(chebyshevDisc(at(5, 5), 2).length).toBe(25);
  });

  it("centredRect refuses even dimensions rather than guessing a corner", () => {
    expect(centredRect(at(5, 5), 3, 3).length).toBe(9);
    expect(centredRect(at(5, 5), 5, 3).length).toBe(15);
    expect(() => centredRect(at(5, 5), 2, 2)).toThrow(/odd dimensions/);
  });

  it("adjacentBlock places a 3x3 flush against the caster, excluding the caster", () => {
    const panels = adjacentBlock(at(5, 5), { i: -1, j: 0 }, 3, 3); // north
    expect(panels.length).toBe(9);
    expect(panels.some((p) => p.i === 5 && p.j === 5)).toBe(false);
    // Near edge touches the caster's panel.
    expect(panels.some((p) => p.i === 4 && p.j === 5)).toBe(true);
    expect(panels.every((p) => p.i >= 2 && p.i <= 4)).toBe(true);
    expect(panels.every((p) => p.j >= 4 && p.j <= 6)).toBe(true);
  });

  it("adjacentBlock rotates correctly for all four cardinals", () => {
    for (const dir of [{ i: -1, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 0, j: -1 }]) {
      const panels = adjacentBlock(at(9, 9), dir, 3, 3);
      expect(panels.length).toBe(9);
      expect(panels.some((p) => p.i === 9 && p.j === 9)).toBe(false);
    }
  });

  it("line projects one way by default and both ways when asked", () => {
    const one = line(at(6, 6), { i: 0, j: 1 }, 6);
    expect(one.length).toBe(6);
    const both = line(at(6, 6), { i: 0, j: 1 }, 6, { bidirectional: true });
    expect(both.length).toBe(12);
  });

  it("line supports diagonals, and shortens on them when told to", () => {
    // Danzo's Dongyu: 1x5 cardinal, 1x4 diagonal.
    expect(line(at(9, 9), { i: 0, j: 1 }, 5, { diagonalLength: 4 }).length).toBe(5);
    expect(line(at(9, 9), { i: 1, j: 1 }, 5, { diagonalLength: 4 }).length).toBe(4);
  });

  it("line stops at the board edge", () => {
    const b = squareBounds(13);
    expect(line(at(0, 11), { i: 0, j: 1 }, 6, { bounds: b }).length).toBe(1);
  });

  it("ring is the shell at exactly distance r", () => {
    expect(ring(at(5, 5), 0).length).toBe(1);
    expect(ring(at(5, 5), 1).length).toBe(8);
    expect(ring(at(5, 5), 2).length).toBe(16);
  });
});

describe("reachablePanels", () => {
  const never = () => false;

  it("is the manhattan diamond on open ground", () => {
    const r = reachablePanels(at(10, 10), 3, never);
    // |di| + |dj| <= 3, minus the origin: 2*3*(3+1) + 1 - 1 = 24
    expect(r.size).toBe(24);
    expect(r.get(key(at(7, 10)))).toBe(3);
    expect(r.has(key(at(10, 10)))).toBe(false);
  });

  it("routes around obstacles instead of assuming the diamond", () => {
    // Wall the entire column to the east, one step out.
    const blocked = (p) => p.j === 11;
    const r = reachablePanels(at(10, 10), 2, blocked);
    expect(r.has(key(at(10, 12)))).toBe(false); // no way through
    expect(r.has(key(at(10, 9)))).toBe(true);
  });

  it("cannot leave a fully enclosed panel", () => {
    const blocked = (p) => chebyshev(p, at(5, 5)) === 1;
    expect(reachablePanels(at(5, 5), 5, blocked).size).toBe(0);
  });

  it("respects board bounds", () => {
    const r = reachablePanels(at(0, 0), 2, never, squareBounds(13));
    expect([...r.keys()].every((k) => !k.startsWith("-"))).toBe(true);
  });
});

describe("facing cones", () => {
  it("classifies an attacker into the four cones", () => {
    const self = at(5, 5);
    expect(coneOf("n", self, at(3, 5))).toBe("front");
    expect(coneOf("n", self, at(7, 5))).toBe("back");
    expect(coneOf("n", self, at(5, 7))).toBe("right");
    expect(coneOf("n", self, at(5, 3))).toBe("left");
  });

  it("rotates with the unit", () => {
    const self = at(5, 5);
    expect(coneOf("e", self, at(5, 7))).toBe("front");
    expect(coneOf("e", self, at(3, 5))).toBe("left");
    expect(coneOf("s", self, at(7, 5))).toBe("front");
  });

  it("rejects an unknown facing rather than defaulting to front", () => {
    expect(() => coneOf("up", at(0, 0), at(1, 1))).toThrow(RangeError);
  });
});

describe("cardinalToward", () => {
  it("never returns a diagonal, because movement is orthogonal", () => {
    for (const target of [at(3, 7), at(7, 3), at(0, 0), at(9, 9)]) {
      const d = cardinalToward(at(5, 5), target);
      expect(Math.abs(d.i) + Math.abs(d.j)).toBeLessThanOrEqual(1);
    }
  });

  it("resolves perfect diagonals to the row axis", () => {
    expect(cardinalToward(at(5, 5), at(7, 7))).toEqual({ i: 1, j: 0 });
  });
});
