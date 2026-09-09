/**
 * @file The pure half of the summon and setup dialogs.
 * @see module/apps/summon-present.mjs
 */

import { describe, it, expect } from "vitest";
import { filterCatalogue, describe as describeLine } from "../../module/apps/summon-present.mjs";

const catalogue = [
  { contentId: "emiya", name: "EMIYA" },
  { contentId: "medea", name: "Medea" },
  { contentId: "medusa", name: "Medusa" },
  { contentId: "semiramis", name: "Semiramis" },
];

describe("filterCatalogue", () => {
  it("returns everything for a blank query", () => {
    expect(filterCatalogue(catalogue, "")).toHaveLength(4);
    expect(filterCatalogue(catalogue, "   ")).toHaveLength(4);
    expect(filterCatalogue(catalogue, undefined)).toHaveLength(4);
  });

  it("ranks a prefix match first, case-insensitively", () => {
    // `EM` is also a substring of S-em-iramis, so both match; the point is the
    // ORDER. A GM typing EM means EMIYA and gets it at the top.
    expect(filterCatalogue(catalogue, "EM").map((e) => e.contentId))
      .toEqual(["emiya", "semiramis"]);
    expect(filterCatalogue(catalogue, "me").map((e) => e.contentId)).toEqual(["medea", "medusa"]);
  });

  it("still matches a substring when nothing starts with the query", () => {
    // Neither EMIYA nor Semiramis STARTS with "mi"; both contain it.
    expect(filterCatalogue(catalogue, "mi").map((e) => e.contentId))
      .toEqual(["emiya", "semiramis"]);
    expect(filterCatalogue(catalogue, "ed").map((e) => e.contentId)).toEqual(["medea", "medusa"]);
  });

  it("puts a prefix hit first when a query matches both ways", () => {
    const rows = [{ contentId: "a", name: "Iskandar" }, { contentId: "b", name: "Kan" }];
    expect(filterCatalogue(rows, "kan").map((e) => e.contentId)).toEqual(["b", "a"]);
  });

  it("returns nothing when nothing matches, and tolerates an absent catalogue", () => {
    expect(filterCatalogue(catalogue, "zzz")).toEqual([]);
    expect(filterCatalogue(undefined, "a")).toEqual([]);
  });
});

describe("describe", () => {
  it("shows the arithmetic, not the answer", () => {
    const out = describeLine({
      id: "maxHealth", label: "Max Health", base: 1250, applied: -87,
      roll: { formula: "10d20" }, value: 1163,
    });
    expect(out.workings).toBe("1250 − 87 (10d20)");
    expect(out.value).toBe(1163);
    expect(out.rollable).toBe(true);
  });

  it("signs a subtraction from `applied`, so a tails roll never reads as a bonus", () => {
    const plus = describeLine({ base: 250, applied: 87, roll: { formula: "2d100" }, value: 337 });
    expect(plus.workings).toBe("250 + 87 (2d100)");
  });

  it("renders a summon variant's branch id rather than adding it to a base", () => {
    const out = describeLine({
      id: "summonVariant", label: "Variant", base: "", applied: "dsc",
      roll: { formula: "1d2" }, value: "dsc",
    });
    expect(out.workings).toBe("1d2 → dsc");
  });

  it("marks a line nobody rolled, so it is not read as a rolled zero", () => {
    const out = describeLine({
      id: "maxHealth", label: "Max Health", base: 1000, applied: null,
      roll: null, value: 1000, unrolled: true,
    });
    expect(out.workings).toBe("1000");
    expect(out.rollable).toBe(false);
    expect(out.unrolled).toBe(true);
  });
});
