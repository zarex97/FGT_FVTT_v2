/**
 * @file Summon-time variants.
 * @see docs/05-ranks-and-parameters.md, module/rules/summon-variant.mjs
 */

import { describe, it, expect } from "vitest";
import { resolveSummonVariant } from "../../module/rules/summon-variant.mjs";

const spec = {
  heads: { id: "dsc", overrides: { sustainability: "4◈" } },
  tails: { id: "noDsc", overrides: { sustainability: "2◈" } },
};

describe("resolveSummonVariant", () => {
  it("is null with no spec — an ordinary Servant has no variant", () => {
    expect(resolveSummonVariant(null, 1)).toBeNull();
  });

  it("picks heads on a roll of 1", () => {
    expect(resolveSummonVariant(spec, 1)).toEqual({ id: "dsc", overrides: { sustainability: "4◈" } });
  });

  it("picks tails on a roll of 2", () => {
    expect(resolveSummonVariant(spec, 2)).toEqual({ id: "noDsc", overrides: { sustainability: "2◈" } });
  });

  it("defaults overrides to an empty object when the branch does not declare any", () => {
    expect(resolveSummonVariant({ heads: { id: "dsc" } }, 1).overrides).toEqual({});
  });
});
