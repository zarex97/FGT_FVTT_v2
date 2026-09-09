/**
 * @file What each difficulty level removes.
 * @see module/rules/difficulty.mjs
 * @see char_orig_sheets/extra docs/Normal Great Holy Grail War.md
 */

import { describe, it, expect } from "vitest";
import { damageModifiersApply, luckChecksApply } from "../../module/rules/difficulty.mjs";

describe("damageModifiersApply", () => {
  it("removes the 5d10 on Beginner only", () => {
    expect(damageModifiersApply("beginner")).toBe(false);
    for (const d of ["intermediate", "expert", "lunatic"]) {
      expect(damageModifiersApply(d)).toBe(true);
    }
  });

  it("treats an unknown level as Expert — remove nothing", () => {
    // A corrupt setting must fail towards the FULL rules: a missing rule is
    // invisible and an extra one is not.
    for (const d of [undefined, null, "", "standard", "lunatick"]) {
      expect(damageModifiersApply(d)).toBe(true);
    }
  });
});

describe("luckChecksApply", () => {
  it("removes the Luck Check on Beginner and Intermediate", () => {
    expect(luckChecksApply("beginner")).toBe(false);
    expect(luckChecksApply("intermediate")).toBe(false);
    expect(luckChecksApply("expert")).toBe(true);
    expect(luckChecksApply("lunatic")).toBe(true);
  });

  it("treats an unknown level as Expert", () => {
    for (const d of [undefined, null, "", "standard"]) expect(luckChecksApply(d)).toBe(true);
  });
});
