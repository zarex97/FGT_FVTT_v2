/**
 * @file Table-driven abilities — Scáthach's Primordial Rune.
 * @see module/rules/roll-table.mjs
 */

import { describe, it, expect } from "vitest";
import { tableFor, entriesFor, choicesIn, effectsOf } from "../../module/rules/roll-table.mjs";

const phase = {
  dice: "2d8",
  tables: {
    ally: {
      1: { effects: [{ id: "atkUp", magnitude: 25 }] },
      5: { effects: [{ id: "npDmUp", magnitude: 30 }] },
      8: { choose: true },
    },
    enemy: {
      1: { effects: [{ id: "atkDwn", magnitude: 25 }] },
      8: { choose: true },
    },
  },
};

describe("tableFor", () => {
  it("picks the allied table for an ally and for herself", () => {
    // "Every allied Unit" includes the speaker: Scáthach may rune herself.
    expect(tableFor(phase, "ally")).toBe(phase.tables.ally);
    expect(tableFor(phase, "self")).toBe(phase.tables.ally);
  });

  it("picks the enemy table for an enemy", () => {
    expect(tableFor(phase, "enemy")).toBe(phase.tables.enemy);
  });

  it("accepts a single table for the common case", () => {
    const one = { entries: { 1: { effects: [] } } };
    expect(tableFor(one, "enemy")).toBe(one.entries);
  });

  it("returns null when the phase declares no table at all", () => {
    expect(tableFor({}, "ally")).toBe(null);
  });
});

describe("entriesFor", () => {
  it("resolves each die separately, so a duplicate applies twice", () => {
    // "If a duplicate number is rolled, apply the effect twice." Collapsing
    // the dice into a set is the obvious implementation and the bug this
    // clause exists to forbid.
    const rows = entriesFor(phase.tables.ally, [5, 5]);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.entry === phase.tables.ally["5"])).toBe(true);
  });

  it("keeps the order rolled", () => {
    expect(entriesFor(phase.tables.ally, [5, 1]).map((r) => r.roll)).toEqual([5, 1]);
  });

  it("reports a face with no row rather than dropping it", () => {
    // A Skill that silently does nothing on a 7 is indistinguishable from a
    // Skill that worked, so the missing row reaches the caller.
    expect(entriesFor(phase.tables.ally, [7])).toEqual([{ roll: 7, entry: null }]);
  });
});

describe("choicesIn", () => {
  it("offers the rows above it, never itself", () => {
    // "Your choice of any of THE ABOVE effect(s)" — a wildcard that could pick
    // itself would resolve to another question.
    expect(choicesIn(phase.tables.ally).map((c) => c.roll)).toEqual([1, 5]);
  });

  it("sorts by row, because the sheet numbers them", () => {
    expect(choicesIn({ 3: { effects: [] }, 1: { effects: [] } }).map((c) => c.roll)).toEqual([1, 3]);
  });
});

describe("effectsOf", () => {
  it("reads an entry's effects, and an empty one as none", () => {
    expect(effectsOf(phase.tables.ally["1"])).toHaveLength(1);
    expect(effectsOf(null)).toEqual([]);
  });
});
