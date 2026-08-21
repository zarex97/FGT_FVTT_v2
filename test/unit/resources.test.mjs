/**
 * @file Ability-specific pools (§6.10).
 * @see module/domain/resources.mjs
 */

import { describe, it, expect } from "vitest";
import {
  resourceValue, resourceMax, canSpend, afterChange, resourcePath,
} from "../../module/domain/resources.mjs";

const scathach = (value = 0) => ({ resources: { prs: { value, max: 2 } } });

describe("resourceValue", () => {
  it("reads a pool", () => {
    expect(resourceValue(scathach(1), "prs")).toBe(1);
  });

  it("reads an absent pool as zero rather than as undefined", () => {
    expect(resourceValue({}, "prs")).toBe(0);
    expect(resourceValue(null, "prs")).toBe(0);
  });
});

describe("resourceMax", () => {
  it("reads a cap", () => {
    expect(resourceMax(scathach(), "prs")).toBe(2);
  });

  it("reports an uncapped counter as null, not as a large number", () => {
    // Heracles's recorded attacks are unbounded; "no maximum" has to be
    // expressible or the clamp invents one.
    expect(resourceMax({ resources: { recorded: { value: 4 } } }, "recorded")).toBe(null);
  });
});

describe("canSpend", () => {
  it("compares against the amount, not against zero", () => {
    expect(canSpend(scathach(1), "prs")).toBe(true);
    expect(canSpend(scathach(0), "prs")).toBe(false);
    expect(canSpend(scathach(1), "prs", 2)).toBe(false);
    expect(canSpend(scathach(2), "prs", 2)).toBe(true);
  });
});

describe("afterChange", () => {
  it("clamps to the maximum", () => {
    // "The maximum number of PRS Tokens Scáthach can have is 2." Primordial
    // Rune grants TWO, so a Scáthach already holding one must end at 2.
    expect(afterChange(scathach(1), "prs", 2)).toBe(2);
    expect(afterChange(scathach(0), "prs", 2)).toBe(2);
  });

  it("clamps to zero", () => {
    expect(afterChange(scathach(0), "prs", -1)).toBe(0);
  });

  it("leaves an uncapped counter alone at the top", () => {
    expect(afterChange({ resources: { c: { value: 99 } } }, "c", 5)).toBe(104);
  });
});

describe("resourcePath", () => {
  it("is the one place the shape is written", () => {
    expect(resourcePath("prs")).toBe("resources.prs.value");
  });
});
