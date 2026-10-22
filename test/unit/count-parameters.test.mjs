/**
 * @file A DU compared with the caster: its Parameters counted, its Health set against his (#283).
 * @see module/rules/count.mjs (`parameters`), module/rules/options.mjs (`target:healthVsSelf`)
 *
 * Excalibur Proto's criteria 1, 4 and 5: *"At least two DUs have at least 3
 * Parameters respectively that are equal to or higher than Arthur's"*, *"Arthur's
 * Health is less than at least two of the DUs"*, *"None of the DUs have at least 3
 * Parameters respectively that are two Ranks below Arthur's"*.
 */

import { describe, it, expect } from "vitest";
import { countOf } from "../../module/rules/count.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { parseOption } from "../../module/rules/facets.mjs";

const params = (str, end, agi, mag, luc) => ({ str, end, agi, mag, luc });
const gte = { of: "parameters", vs: "self", compare: "gte" };
const belowBy2 = { of: "parameters", vs: "self", compare: "belowBy", by: 2 };

describe("a DU's Parameters counted against the caster's", () => {
  it("counts those equal to or higher", () => {
    const self = { id: "arthur", kind: "servant", parameters: params("B", "B", "B", "B", "B") };
    const target = { id: "du", kind: "servant", parameters: params("A", "A", "B", "C", "EX") };
    expect(countOf(gte, { self, target })).toBe(4);
  });

  it("counts those two whole grades below, the modifier kept (C under A, not B+ or C+)", () => {
    const self = { id: "arthur", kind: "servant", parameters: params("A", "A", "A", "A", "A") };
    const target = { id: "du", kind: "servant", parameters: params("C", "D", "B+", "C+", "E") };
    // C, D and E are at or below A two grades down; B+ and C+ are above C.
    expect(countOf(belowBy2, { self, target })).toBe(3);
  });

  it("counts none for a Unit with no Parameters (a Master)", () => {
    const self = { id: "arthur", kind: "servant", parameters: params("B", "B", "B", "B", "B") };
    expect(countOf(gte, { self, target: { id: "m", kind: "master" } })).toBe(0);
  });

  it("skips a Parameter either side leaves unranked", () => {
    const self = { id: "arthur", kind: "servant", parameters: params("B", "B", "B", "B", null) };
    const target = { id: "du", kind: "servant", parameters: params("A", "A", "A", "A", "A") };
    expect(countOf(gte, { self, target })).toBe(4);
  });
});

describe("target:healthVsSelf", () => {
  const unit = (id, health) => ({ id, kind: "servant", health });
  const verdicts = (attacker, defender) => [...rollOptionsFor({ attacker, defender })].filter((o) => o.startsWith("target:healthVsSelf:"));

  it("says the DU has more, less or the same current Health as the caster", () => {
    expect(verdicts(unit("a", 300), unit("d", 500))).toEqual(["target:healthVsSelf:gt"]);
    expect(verdicts(unit("a", 500), unit("d", 300))).toEqual(["target:healthVsSelf:lt"]);
    expect(verdicts(unit("a", 400), unit("d", 400))).toEqual(["target:healthVsSelf:eq"]);
  });

  it("says nothing when either side has no Health", () => {
    expect(verdicts(unit("a", 300), { id: "d", kind: "servant" })).toEqual([]);
    expect(verdicts({ id: "a", kind: "servant" }, unit("d", 300))).toEqual([]);
  });

  it("is an option the predicate grammar admits, on the target only", () => {
    expect(parseOption("target:healthVsSelf:gt")).not.toBeNull();
    expect(parseOption("self:healthVsSelf:gt")).toBeNull();
    expect(parseOption("target:healthVsSelf:more")).toBeNull();
  });
});
