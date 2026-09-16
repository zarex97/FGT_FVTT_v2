/**
 * @file The Queen's Glass Game, against her sheet and Ch. 43 §43.11.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 * @see docs/43-bounded-fields.md §43.11
 *
 * Part 4 of four, and the first ability in either roster that reads the past.
 */

import { describe, it, expect } from "vitest";
import { historyWanted, snapshotUnit, diffSnapshots, applyPatch } from "../../module/rules/history.mjs";

describe("E2 — the gate, which is the whole performance story", () => {
  it("is OFF for a board with nobody who wants history", () => {
    // This assertion is worth more than any of the restore tests. If the
    // recorder is ever on by default, every match in the game pays for a
    // feature one Servant uses.
    expect(historyWanted({ units: [
      { id: "a", abilities: [{ id: "x", requiresHistory: false }] },
      { id: "b", abilities: [{ id: "y" }] },
    ] })).toBe(false);
  });

  it("is ON as soon as one unit declares it", () => {
    expect(historyWanted({ units: [
      { id: "a", abilities: [{ id: "x" }] },
      { id: "n", abilities: [{ id: "glass", requiresHistory: true }] },
    ] })).toBe(true);
  });

  it("is OFF again once that unit is gone", () => {
    expect(historyWanted({ units: [{ id: "a", abilities: [{ id: "x" }] }] })).toBe(false);
  });

  it("stays ON for a DEFEATED declarer", () => {
    // Effect 2 fires on her defeat and rewinds six Rounds. A gate that closed
    // the moment she died would throw away the buffer one step before the
    // clause reads it.
    expect(historyWanted({ units: [
      { id: "n", defeated: true, abilities: [{ id: "glass", requiresHistory: true }] },
    ] })).toBe(true);
  });

  it("handles an empty board", () => {
    expect(historyWanted({})).toBe(false);
  });
});

describe("E1 — the snapshot shape, from §43.11", () => {
  const unit = () => ({
    id: "foe",
    panel: { i: 4, j: 7 }, facing: "north",
    health: { value: 600, max: 1000 }, agility: 12, luck: { value: 6, max: 8 },
    parameters: { str: "B", end: "C", agi: "B", mag: "E", luc: "C" },
    grantedSteps: { str: 1 },
    baseAttackPenalty: { str: 10, mag: 10 },
    effectInstances: [
      { defId: "atkUp", magnitude: 30, expiry: 14, sourceUnitId: "nursery", uses: 0 },
    ],
    abilities: [
      { id: "someNp", isNP: true, cooldownRemaining: 4 },
      { id: "madEnh", isMode: true, active: true },
    ],
    resources: { namelessForestTokens: { value: 2, max: null } },
    turnState: { movedPanels: 3, acted: true },
    contract: "free",
  });

  it("records the things the sheet names", () => {
    const s = snapshotUnit(unit(), 9);
    expect(s.globalTurn).toBe(9);
    expect(s.stats.health).toEqual({ value: 600, max: 1000 });
    expect(s.parameters.mag).toBe("E");
    expect(s.effects).toHaveLength(1);
    expect(s.cooldowns.someNp).toEqual({ remaining: 4 });
    expect(s.resources.namelessForestTokens).toEqual({ value: 2, max: 0 });
    expect(s.modes.madEnh).toEqual({ active: true });
  });

  it("R1/Q45 — and records NEITHER position NOR facing", () => {
    // "The source lists 'Stats, Parameters, Buffs, Debuffs, Cooldowns, and
    // other existing effects' -- not location. Units are not teleported back."
    //
    // Excluded from the BUFFER rather than filtered by the applier, which is
    // what makes Q45 cheap to keep and expensive to reverse.
    const s = snapshotUnit(unit(), 9);
    expect(s.panel).toBeUndefined();
    expect(s.facing).toBeUndefined();
    expect(JSON.stringify(s)).not.toContain("north");
  });

  it("R1 — nor turn budget, nor contract", () => {
    const s = snapshotUnit(unit(), 9);
    expect(s.turnState).toBeUndefined();
    expect(s.contract).toBeUndefined();
  });

  it("R8 — an effect snapshot records the id of its SOURCE", () => {
    // §43.11's own RISK: the applier drops instances whose source no longer
    // exists, and it can only do that if the snapshot recorded one.
    expect(snapshotUnit(unit(), 9).effects[0].sourceUnitId).toBe("nursery");
  });

  it("stores FULL instances, not ids", () => {
    // An id alone cannot restore a magnitude or an expiry.
    expect(snapshotUnit(unit(), 9).effects[0])
      .toMatchObject({ defId: "atkUp", magnitude: 30, expiry: 14 });
  });

  it("normalises a pool the board flattened to a number", () => {
    // Agility arrives as a bare number and Health as a pair; a buffer that
    // stored whichever it was handed would restore two different shapes.
    expect(snapshotUnit(unit(), 9).stats.agility).toEqual({ value: 12, max: 12 });
  });

  it("carries the permanent Base Attack penalty", () => {
    // Part 3's reduction is a stored number the derivation subtracts, so a
    // rewind that ignored it would hand back Base Attack the Nameless Forest
    // took -- which is a different clause's business, and not this one's to
    // undo by accident.
    expect(snapshotUnit(unit(), 9).baseAttackPenalty).toEqual({ str: 10, mag: 10 });
  });

  it("round-trips through a patch", () => {
    const a = snapshotUnit(unit(), 9);
    const moved = unit(); moved.health.value = 250;
    const b = snapshotUnit(moved, 10);
    expect(applyPatch(a, diffSnapshots(a, b))).toEqual(b);
  });

  it("a patch between identical states is empty", () => {
    // The diffing is what keeps the buffer inside its budget. A patch that
    // always carries everything is a ring of full snapshots in disguise.
    expect(Object.keys(diffSnapshots(snapshotUnit(unit(), 9), snapshotUnit(unit(), 9))))
      .toHaveLength(0);
  });

  it("a patch carries only what moved", () => {
    const a = snapshotUnit(unit(), 9);
    const hurt = unit(); hurt.health.value = 250;
    const patch = diffSnapshots(a, snapshotUnit(hurt, 10));
    expect(Object.keys(patch).sort()).toEqual(["globalTurn", "stats"]);
  });
});
