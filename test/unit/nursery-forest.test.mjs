/**
 * @file Nameless Forest, against her sheet.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 *
 * Part 3 of four. The only ability in either roster that wins by waiting.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { lookup, HOME_BASE_ESCAPE_MODIFIER } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { resolveCheck } from "../../module/rules/checks.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";

const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));

describe("R3 — the MAG ladder, at all six grades", () => {
  // The sign question decides the whole ability, so every row is pinned. An
  // implementer who reads "EX: -3" as "harder for EX" flips all six and
  // produces a Noble Phantasm strongest against exactly the Servants it should
  // struggle with.
  it.each([
    ["EX", -3], ["A", -2], ["B", -1], ["C", 0], ["D", 1], ["E", 2],
  ])("MAG %s modifies the dice by %i", (grade, expected) => {
    expect(lookup("namelessForestEscape", Rank.parse(grade))).toBe(expected);
  });

  it("and a NEGATIVE modifier makes escape MORE likely", () => {
    // The direction proved against the check itself rather than asserted:
    // `resolveCheck` computes total = roll + mods and succeeds on total <= target.
    const ex = resolveCheck({ roll: 8, target: 7, modifiers: [{ source: "MAG EX", value: -3 }] });
    const e = resolveCheck({ roll: 8, target: 7, modifiers: [{ source: "MAG E", value: 2 }] });
    expect(ex.success).toBe(true);
    expect(e.success).toBe(false);
  });

  it("R4 — the Home Base term STACKS with it", () => {
    // "(stacks with the MAG Rank modifiers as seen below)". A MAG EX unit at
    // home rolls at -6.
    const both = resolveCheck({
      roll: 12, target: 7,
      modifiers: [{ source: "MAG EX", value: -3 }, { source: "Home Base", value: -3 }],
    });
    expect(both.total).toBe(6);
    expect(both.success).toBe(true);
  });

  it("R3 — and both terms point the SAME way", () => {
    // The coherence check. The sheet separately refuses to delete a Unit at
    // home, so safety and magical power each make the forest easier to walk out
    // of. If the MAG rows were flipped, these two would disagree.
    expect(lookup("namelessForestEscape", Rank.parse("EX"))).toBeLessThan(0);
    expect(HOME_BASE_ESCAPE_MODIFIER).toBeLessThan(0);
  });

  it("does not interpolate a `+` step the sheet never mentions", () => {
    // The sheet names grades, not the dense ladder. A+ escapes exactly as A.
    expect(lookup("namelessForestEscape", Rank.parse("A+"))).toBe(-2);
  });
});

describe("E2 — a rank table indexed by the target's own parameter", () => {
  const collect = (rules, refs) =>
    collectContributions([{ id: "nf", name: "Nameless Forest", rank: "C", passiveRules: rules }],
      { options: new Set(), refs });

  it("reads the grade off a ref path instead of the owning ability's rank", () => {
    const out = collect(
      [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape", rankFrom: "@self.parameters.mag" }],
      { self: { parameters: { mag: "A" } } },
    );
    // A, not C. The ability is Rank C, and reading the table by the ability's
    // rank -- which is what every other table in the corpus does -- gives 0
    // here and silently makes the whole ladder do nothing.
    expect(out.checkModifiers[0].value).toBe(-2);
  });

  it("falls back to the owning ability's rank when no rankFrom is given", () => {
    const out = collectContributions(
      [{ id: "x", rank: "B", passiveRules: [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape" }] }],
      { options: new Set(), refs: {} },
    );
    expect(out.checkModifiers[0].value).toBe(-1);
  });

  it("contributes NOTHING when the path resolves to no grade", () => {
    // A Master has no `parameters`. Reading `undefined` as EX would hand every
    // Master the best escape in the game -- and a contribution of 0 is
    // indistinguishable from MAG C, which is why this drops the element rather
    // than scaling it to zero.
    const out = collect(
      [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape", rankFrom: "@self.parameters.mag" }],
      { self: { parameters: {} } },
    );
    expect(out.checkModifiers).toEqual([]);
  });

  it("and nothing when the refs carry no such path at all", () => {
    const out = collect(
      [{ key: "CheckModifier", check: "luck", table: "namelessForestEscape", rankFrom: "@self.parameters.mag" }],
      {},
    );
    expect(out.checkModifiers).toEqual([]);
  });
});
