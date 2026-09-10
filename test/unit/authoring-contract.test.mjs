/**
 * @file The shape every authoring descriptor must have.
 * @see module/rules/authoring/contract.mjs
 *
 * D5: a keyword with no explanation fails this test. The hints are the point
 * of the whole vocabulary -- §29.6's argument is that a GM should never have
 * to know the internal name -- so they cannot be optional, or they rot into
 * decoration on the half of the table nobody got to.
 */

import { describe, it, expect } from "vitest";
import { describeTable, descriptorProblems, casesIn } from "../../module/rules/authoring/contract.mjs";

const good = {
  id: "GrantedAbility",
  label: "FGT.Authoring.Element.GrantedAbility",
  hint: "FGT.Authoring.Element.GrantedAbilityHint",
  doc: "11-effect-engine.md",
  fields: [{ key: "abilities", type: "tokenList" }],
};

describe("descriptorProblems", () => {
  it("accepts a complete descriptor", () => {
    expect(descriptorProblems(good)).toEqual([]);
  });

  it("refuses one with no hint", () => {
    const { hint: _hint, ...noHint } = good;
    expect(descriptorProblems(noHint).join(" ")).toMatch(/hint/);
  });

  it("refuses one with no label or no id", () => {
    expect(descriptorProblems({ ...good, label: "" }).join(" ")).toMatch(/label/);
    expect(descriptorProblems({ ...good, id: "" }).join(" ")).toMatch(/id/);
  });

  it("refuses a field type the editor cannot render", () => {
    const bad = { ...good, fields: [{ key: "x", type: "colourWheel" }] };
    expect(descriptorProblems(bad).join(" ")).toMatch(/colourWheel/);
  });

  it("refuses a field with no key", () => {
    expect(descriptorProblems({ ...good, fields: [{ type: "text" }] }).join(" ")).toMatch(/key/);
  });

  it("refuses a select with no choices, which would render an empty dropdown", () => {
    const bad = { ...good, fields: [{ key: "x", type: "select" }] };
    expect(descriptorProblems(bad).join(" ")).toMatch(/choices/);
  });

  it("allows a descriptor with no fields — some keywords take none", () => {
    const { fields: _fields, ...bare } = good;
    expect(descriptorProblems(bare)).toEqual([]);
  });

  it("reports every problem at once rather than the first", () => {
    // A table author fixing one thing at a time, told one thing at a time, is
    // a slow loop for 54 entries.
    const bad = { id: "", label: "", hint: "", fields: [{ type: "nope" }] };
    expect(descriptorProblems(bad).length).toBeGreaterThan(2);
  });
});

describe("describeTable", () => {
  it("indexes by id and freezes", () => {
    const table = describeTable([good]);
    expect(table.GrantedAbility.label).toBe(good.label);
    expect(Object.isFrozen(table)).toBe(true);
  });

  it("throws on a malformed entry rather than shipping a broken table", () => {
    // Loud at import time. A table that silently drops its bad rows produces
    // a picker missing a keyword, which is the failure this whole design is
    // built to prevent.
    expect(() => describeTable([{ id: "X" }])).toThrow(/X/);
  });

  it("throws on a duplicate id", () => {
    expect(() => describeTable([good, good])).toThrow(/GrantedAbility/);
  });
});

describe("casesIn", () => {
  const source = `
    function alpha(x) { switch (x) { case "one": return 1; case "two": return 2; } }
    function beta(x) { switch (x) { case "three": return 3; } }
  `;

  it("reads every case label in a source", () => {
    expect([...casesIn(source)].sort()).toEqual(["one", "three", "two"]);
  });

  it("scopes to one function when asked", () => {
    // `resolve.mjs` switches on anchors, selection modes and shapes in the
    // same file; an unscoped read would call all three anchors.
    expect([...casesIn(source, "beta")]).toEqual(["three"]);
  });

  it("returns nothing for a function that is not there", () => {
    expect([...casesIn(source, "gamma")]).toEqual([]);
  });
});
