/**
 * @file Where a summon lands — `engine/summoning.mjs#freePanels`.
 * @see docs/20-platforms-and-levels.md, docs/15-abilities.md §15.2
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
