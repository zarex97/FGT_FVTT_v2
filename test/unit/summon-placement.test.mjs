/**
 * @file Where a summon lands — `engine/summoning.mjs#freePanels`.
 * @see docs/27-platforms-and-levels.md, docs/17-abilities.md
 *
 * A summon appears on a free panel beside its summoner. What counts as free is
 * the whole of this file: a platform is stood on rather than blocked by, and a
 * Unit on the ground twenty feet below is not beside anybody.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/** The board `freePanels` reads, swapped per test. */
let board = { units: [], bounds: { iMin: 0, iMax: 24, jMin: 0, jMax: 24 } };
vi.mock("../../module/engine/board.mjs", () => ({
  currentBoard: () => board,
  unitSnapshot: () => null,
}));

const { freePanels } = await import("../../module/engine/summoning.mjs");

const at = (i, j) => ({ i, j });
const key = (p) => `${p.i},${p.j}`;

/** Semiramis in the Throne Room of her own 9x9 garden, which is on level 20. */
const semiramis = { id: "sem", panel: at(19, 19), level: 20 };
const garden = {
  id: "hgob", kind: "platform", level: 20,
  panels: Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => at(15 + i, 15 + j))).flat(),
};

beforeEach(() => {
  board = { units: [semiramis], bounds: { iMin: 0, iMax: 24, jMin: 0, jMax: 24 } };
});

describe("free panels beside a summoner", () => {
  it("does not count the platform she is standing on", () => {
    board.units = [semiramis, garden];
    // *"on a panel directly next to her"* -- radius 1, so eight candidates once
    // her own panel is taken. Measured live before the fix: zero.
    const panels = freePanels({ id: "sem" }, { size: 3 }, 1);
    expect(panels).toHaveLength(1);
    expect(garden.panels.map(key)).toContain(key(panels[0]));
  });

  it("does not count a Unit standing on the ground below", () => {
    board.units = [semiramis, garden, { id: "foe", panel: at(19, 18), level: 0 }];
    expect(freePanels({ id: "sem" }, { size: 3 }, 8).map(key)).toContain("19,18");
  });

  it("does count a Unit standing beside her on her own level", () => {
    board.units = [semiramis, garden, { id: "ally", panel: at(19, 18), level: 20 }];
    expect(freePanels({ id: "sem" }, { size: 3 }, 8).map(key)).not.toContain("19,18");
  });

  it("does not count a Unit that shares its panel", () => {
    board.units = [semiramis, { id: "sun", panel: at(19, 18), level: 20, sharesPanel: true }];
    expect(freePanels({ id: "sem" }, { size: 3 }, 8).map(key)).toContain("19,18");
  });

  it("is empty for a summoner who is not on the board", () => {
    expect(freePanels({ id: "nobody" }, { size: 3 }, 1)).toEqual([]);
  });
});

// *"Semiramis summons a Bašmu on a panel directly next to her"* -- and Bašmu is
// 3x3. The panel returned is the token's top-left, and only that one panel was
// tested for occupancy, so the Bašmu summoned live on the Semiramis audit
// (#68) was anchored diagonally beside her at (3,3) and covered her own panel,
// (4,4). The whole footprint must be free, beside her, and -- for a summon that
// *"cannot leave the HGoB"* -- on the garden.
describe("free panels for a summon larger than one panel", () => {
  const covered = (p, w = 3) => Array.from({ length: w }, (_, di) =>
    Array.from({ length: w }, (_, dj) => at(p.i + di, p.j + dj))).flat();
  const cheb = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));

  it("never covers the summoner, and stands directly next to her", () => {
    board.units = [semiramis, garden];
    const panels = freePanels({ id: "sem" }, { size: 3 }, 1, { footprint: { w: 3, h: 3 } });
    expect(panels).toHaveLength(1);
    const cells = covered(panels[0]);
    expect(cells.map(key)).not.toContain(key(semiramis.panel));
    expect(Math.min(...cells.map((c) => cheb(c, semiramis.panel)))).toBe(1);
  });

  it("never covers another Unit on her level", () => {
    const ally = { id: "ally", panel: at(19, 21), level: 20 };
    board.units = [semiramis, garden, ally];
    for (const p of freePanels({ id: "sem" }, { size: 3 }, 8, { footprint: { w: 3, h: 3 } })) {
      expect(covered(p).map(key)).not.toContain(key(ally.panel));
    }
  });

  it("stays on the platform it is bound to", () => {
    const edge = { id: "sem", panel: at(15, 19), level: 20 };
    board.units = [edge, garden];
    const onGarden = new Set(garden.panels.map(key));
    const panels = freePanels({ id: "sem" }, { size: 3 }, 8, { footprint: { w: 3, h: 3 }, within: "hgob" });
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) expect(covered(p).every((c) => onGarden.has(key(c)))).toBe(true);
  });
});
