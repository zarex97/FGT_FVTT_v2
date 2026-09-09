/**
 * @file Where each faction's Home Base sits on the board.
 * @see module/rules/home-base.mjs
 */

import { describe, it, expect } from "vitest";
import { homeBaseRects } from "../../module/rules/home-base.mjs";

const two = [{ id: "red" }, { id: "blue" }];
const board13 = { rows: 13, columns: 13, depth: 3 };
const board25 = { rows: 25, columns: 25, depth: 3 };

const key = (o) => `${o.i},${o.j}`;
const factionsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: `f${i}` }));

describe("greatHolyGrailWar", () => {
  it("gives the first faction the top three rows and the second the bottom three", () => {
    const [red, blue] = homeBaseRects("greatHolyGrailWar", two, board13);
    expect(red.factionId).toBe("red");
    expect(new Set(red.offsets.map((o) => o.i))).toEqual(new Set([0, 1, 2]));
    expect(blue.factionId).toBe("blue");
    expect(new Set(blue.offsets.map((o) => o.i))).toEqual(new Set([10, 11, 12]));
  });

  it("spans the full width of the board", () => {
    const [red] = homeBaseRects("greatHolyGrailWar", two, board13);
    expect(red.offsets).toHaveLength(3 * 13);
    expect(new Set(red.offsets.map((o) => o.j)).size).toBe(13);
  });

  it("honours the depth on a large board", () => {
    const [red, blue] = homeBaseRects("greatHolyGrailWar", two, board25);
    expect(red.offsets).toHaveLength(75);
    expect(new Set(blue.offsets.map((o) => o.i))).toEqual(new Set([22, 23, 24]));
  });

  it("never overlaps the two bases", () => {
    const [red, blue] = homeBaseRects("greatHolyGrailWar", two, board13);
    const reds = new Set(red.offsets.map(key));
    expect(blue.offsets.some((o) => reds.has(key(o)))).toBe(false);
  });

  it("refuses a war that is not two-sided rather than guessing", () => {
    expect(() => homeBaseRects("greatHolyGrailWar", [{ id: "red" }], board13)).toThrow(RangeError);
    expect(() => homeBaseRects("greatHolyGrailWar", [...two, { id: "green" }], board13))
      .toThrow(RangeError);
  });
});

describe("holyGrailWar", () => {
  it("gives every faction a block, for three through seven factions", () => {
    for (let n = 3; n <= 7; n++) {
      const out = homeBaseRects("holyGrailWar", factionsOf(n), board25);
      expect(out).toHaveLength(n);
      for (const rect of out) expect(rect.offsets.length).toBeGreaterThan(0);
    }
  });

  it("never overlaps two blocks", () => {
    const out = homeBaseRects("holyGrailWar", factionsOf(5), board25);
    const seen = new Set();
    for (const rect of out) {
      for (const o of rect.offsets) {
        expect(seen.has(key(o))).toBe(false);
        seen.add(key(o));
      }
    }
  });

  it("puts nothing outside the board", () => {
    const out = homeBaseRects("holyGrailWar", factionsOf(4), { rows: 13, columns: 13, depth: 2 });
    for (const rect of out) {
      for (const o of rect.offsets) {
        expect(o.i).toBeGreaterThanOrEqual(0);
        expect(o.j).toBeGreaterThanOrEqual(0);
        expect(o.i).toBeLessThan(13);
        expect(o.j).toBeLessThan(13);
      }
    }
  });

  it("divides the band as evenly as it divides, differing by at most one panel", () => {
    for (let n = 3; n <= 7; n++) {
      const sizes = homeBaseRects("holyGrailWar", factionsOf(n), board25)
        .map((r) => r.offsets.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("leaves the middle of the board free — the Grail needs somewhere to appear", () => {
    const taken = new Set(
      homeBaseRects("holyGrailWar", factionsOf(4), board13).flatMap((r) => r.offsets.map(key)),
    );
    expect(taken.has("6,6")).toBe(false);
  });

  it("returns nothing for no factions rather than dividing by zero", () => {
    expect(homeBaseRects("holyGrailWar", [], board13)).toEqual([]);
  });
});

describe("custom", () => {
  it("draws nothing — the GM does", () => {
    expect(homeBaseRects("custom", two, board13)).toEqual([]);
  });
});
