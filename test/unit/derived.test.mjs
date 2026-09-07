/**
 * @file Stat deltas folded into derived data.
 * @see module/rules/derived.mjs
 */

import { describe, it, expect } from "vitest";
import { applyStatDeltas, writeDerived, restoreModifiable } from "../../module/rules/derived.mjs";

/** A Servant-shaped `system` object. */
function servant(overrides = {}) {
  return {
    health: { value: 400, max: 400 },
    agility: { value: 12, max: 12 },
    luck: { value: 8, max: 8 },
    mov: 4,
    range: { panels: 1, targets: 1 },
    shield: 0,
    parameters: { str: "B", end: "A", agi: "B", mag: "C", lck: "D" },
    ...overrides,
  };
}

describe("applyStatDeltas", () => {
  it("returns no changes for no deltas", () => {
    const { changes, trace } = applyStatDeltas(servant(), []);
    expect(changes).toEqual({});
    expect(trace).toEqual([]);
  });

  it("applies Mad Enhancement's MOV +2 and Range +1", () => {
    const { changes } = applyStatDeltas(servant(), [
      { stat: "mov", value: 2, isBuff: false, source: "Mad Enhancement" },
      { stat: "range.panels", value: 1, source: "Mad Enhancement" },
    ]);
    expect(changes.mov).toBe(6);
    expect(changes["range.panels"]).toBe(2);
  });

  it("sums two deltas on the same stat", () => {
    const { changes } = applyStatDeltas(servant(), [
      { stat: "mov", value: 2, source: "Mad Enhancement" },
      { stat: "mov", value: 1, source: "Riding" },
    ]);
    expect(changes.mov).toBe(7);
  });

  it("normalises the bare stat names the sheets use", () => {
    const { changes } = applyStatDeltas(servant(), [
      { stat: "agility", value: 3, source: "Agi Up" },
      { stat: "range", value: 1, source: "Range Up" },
    ]);
    expect(changes["agility.value"]).toBe(15);
    expect(changes["range.panels"]).toBe(2);
  });

  it("clamps a reduced stat at zero rather than going negative", () => {
    const { changes } = applyStatDeltas(servant(), [
      { stat: "mov", value: -9, source: "Immobilize" },
    ]);
    expect(changes.mov).toBe(0);
  });

  it("clamps current health to the derived maximum", () => {
    const { changes } = applyStatDeltas(servant({ health: { value: 400, max: 400 } }), [
      { stat: "health.max", value: -100, source: "Max HpDwn" },
    ]);
    expect(changes["health.max"]).toBe(300);
    expect(changes["health.value"]).toBe(300);
  });

  it("Max HpUp restores current by the same amount", () => {
    const { changes } = applyStatDeltas(servant({ health: { value: 250, max: 400 } }), [
      { stat: "health.max", value: 100, alsoCurrent: true, source: "Max HpUp" },
    ]);
    expect(changes["health.max"]).toBe(500);
    expect(changes["health.value"]).toBe(350);
  });

  it("Max HpDwn does NOT reduce current beyond the new cap", () => {
    const { changes } = applyStatDeltas(servant({ health: { value: 120, max: 400 } }), [
      { stat: "health.max", value: -100, alsoCurrent: true, source: "Max HpDwn" },
    ]);
    expect(changes["health.max"]).toBe(300);
    // 120 is already under 300, so nothing touches the current value.
    expect(changes["health.value"]).toBeUndefined();
  });

  it("shifts a parameter rank", () => {
    const { changes } = applyStatDeltas(servant(), [
      { stat: "parameters.str", rankShift: 1, source: "Str Up" },
    ]);
    expect(changes["parameters.str"]).toBe("B+");
  });

  it("moves a whole grade for rankGrades, not five steps of '+' — the HGoB owner buff's 'one Rank'", () => {
    // Found live: the Hanging Gardens' owner buff ("STR: E to D... one Rank")
    // used the default `rankShift` and landed on `E+` instead of `D`, the
    // exact wrong-way-round failure this file's own RankShift comment already
    // documents for Kanshou & Bakuya's Magic Resistance.
    const { changes } = applyStatDeltas(servant({ parameters: { str: "D" } }), [
      { stat: "parameters.str", rankGrades: 1, source: "Aboard the Hanging Gardens" },
    ]);
    expect(changes["parameters.str"]).toBe("C");
  });

  it("keeps the modifier across a rankGrades shift — 'D+' one grade up is 'C+', not 'C'", () => {
    const { changes } = applyStatDeltas(servant({ parameters: { str: "D+" } }), [
      { stat: "parameters.str", rankGrades: 1, source: "Aboard the Hanging Gardens" },
    ]);
    expect(changes["parameters.str"]).toBe("C+");
  });

  it("ignores a rank shift aimed at somebody else", () => {
    const { changes } = applyStatDeltas(servant(), [
      { stat: "parameters.str", rankShift: -1, target: "target", source: "Enkidu" },
    ]);
    expect(changes).toEqual({});
  });

  it("ignores a shift on a parameter the unit does not have", () => {
    const { changes } = applyStatDeltas(servant({ parameters: { str: "-" } }), [
      { stat: "parameters.str", rankShift: 1, source: "Str Up" },
    ]);
    expect(changes).toEqual({});
  });

  it("records a trace naming every source", () => {
    const { trace } = applyStatDeltas(servant(), [
      { stat: "mov", value: 2, source: "Mad Enhancement" },
      { stat: "range.panels", value: 1, source: "Mad Enhancement" },
    ]);
    expect(trace.map((t) => t.source)).toEqual(["Mad Enhancement", "Mad Enhancement"]);
  });

  it("does not mutate the input", () => {
    const sys = servant();
    applyStatDeltas(sys, [{ stat: "mov", value: 2, source: "x" }]);
    expect(sys.mov).toBe(4);
  });
});

describe("writeDerived", () => {
  it("writes flat paths onto the live object", () => {
    const sys = servant();
    writeDerived(sys, applyStatDeltas(sys, [
      { stat: "mov", value: 2, source: "Mad Enhancement" },
      { stat: "range.panels", value: 1, source: "Mad Enhancement" },
      { stat: "parameters.str", rankShift: 1, source: "Str Up" },
    ]));
    expect(sys.mov).toBe(6);
    expect(sys.range.panels).toBe(2);
    expect(sys.parameters.str).toBe("B+");
  });

  it("creates intermediate objects for a path that does not exist yet", () => {
    const sys = {};
    writeDerived(sys, { changes: { "a.b.c": 3 }, trace: [] });
    expect(sys.a.b.c).toBe(3);
  });
});

describe("restoreModifiable — preparation is idempotent", () => {
  // Foundry prepares data in place, and `prepareDerivedData` reads the field it
  // is about to write. Nothing put MOV or Range back, so every preparation
  // applied the same delta again: Mad Enhancement's `MOV +2` had Heracles at 6,
  // 8, 10 and 12 across four of them, and the number on his sheet was whichever
  // one the last preparation reached. Found live, on Kingprotea's sheet reading
  // MOV 11 over a stored 7.
  const deltas = [
    { stat: "mov", value: 2, source: "Mad Enhancement" },
    { stat: "range", value: 1, source: "Mad Enhancement" },
  ];

  /** One preparation: restore the stored values, then fold the deltas in. */
  function prepare(system, source) {
    restoreModifiable(system, source);
    writeDerived(system, applyStatDeltas(system, deltas));
    return system;
  }

  it("gives the same answer however many times it runs", () => {
    const source = servant();
    const system = servant();
    for (let k = 0; k < 5; k++) prepare(system, source);
    expect(system.mov).toBe(6);
    expect(system.range.panels).toBe(2);
  });

  it("compounds without the restore, which is the defect", () => {
    const system = servant();
    for (let k = 0; k < 3; k++) writeDerived(system, applyStatDeltas(system, deltas));
    expect(system.mov).toBe(10);
  });

  it("leaves a field the model derives for itself alone", () => {
    // A Servant with no stated Max Health has `null` stored and the END table
    // fills it in at base time. Restoring "nothing" over that would undo it.
    const system = servant({ health: { value: 1500, max: 1500 } });
    restoreModifiable(system, servant({ health: { value: null, max: null } }));
    expect(system.health.max).toBe(1500);
  });

  it("restores a stated one", () => {
    const system = servant({ health: { value: 400, max: 900 } });
    restoreModifiable(system, servant());
    expect(system.health.max).toBe(400);
  });

  it("ignores a field this actor type does not have", () => {
    const system = { mov: 9 };
    expect(() => restoreModifiable(system, servant())).not.toThrow();
    expect(system.mov).toBe(4);
    expect(system.range).toBeUndefined();
  });
});
