/**
 * @file Predicate evaluation.
 * @see module/rules/predicate.mjs, docs/24-rules-engine.md §24.4
 *
 * The module had no tests of its own, which is how a notation used in five
 * places — the `not:` prefix — stayed unimplemented. A bare string is a
 * set-membership test and an unrecognised one is simply absent from the set, so
 * a clause that should have negated instead answered **false for ever**. The
 * content validator's `looksLikeRollOption` accepts the prefixed form as
 * well-formed, so nothing anywhere objected.
 */

import { describe, it, expect } from "vitest";
import { test, referencedOptions } from "../../module/rules/predicate.mjs";


describe("the `not:` prefix", () => {
  const ctx = (...options) => ({ options: new Set(options) });

  it("negates the option that follows it", () => {
    // Never implemented, and used in five places. The whole string was looked
    // up as one option — which is never in the set — so every such clause was
    // permanently FALSE. Penthesilea's Charisma is gated
    // `not:self:skillActive:madEnhancement` in both its passive and its active
    // form, so her signature aura contributed nothing in any world.
    expect(test(["not:self:skillActive:madEnhancement"], ctx())).toBe(true);
    expect(test(["not:self:skillActive:madEnhancement"], ctx("self:skillActive:madEnhancement")))
      .toBe(false);
  });

  it("leaves an unprefixed option alone", () => {
    expect(test(["self:attribute:female"], ctx("self:attribute:female"))).toBe(true);
    expect(test(["self:attribute:female"], ctx())).toBe(false);
  });

  it("agrees with the object form", () => {
    const options = ctx("target:skill:divinity");
    expect(test(["not:target:skill:divinity"], options))
      .toBe(test([{ not: "target:skill:divinity" }], options));
  });

  it("composes with the rest of an implicit AND", () => {
    // Penthesilea's Goddess of War, clause 1.
    const clause = ["not:self:skillActive:madEnhancement", "attack:kind:normal"];
    expect(test(clause, ctx("attack:kind:normal"))).toBe(true);
    expect(test(clause, ctx("attack:kind:normal", "self:skillActive:madEnhancement"))).toBe(false);
    expect(test(clause, ctx("attack:kind:np"))).toBe(false);
  });
});

describe("referencedOptions and the `not:` prefix", () => {
  it("reports the bare option, not the negation of it", () => {
    // Both readers want the bare name: the validator is checking for typos,
    // and the deferral pass is asking WHOSE state the clause is about —
    // `not:target:skill:divinity` is a question about the target either way.
    expect([...referencedOptions(["not:target:skill:divinity"])]).toEqual(["target:skill:divinity"]);
  });

  it("looks inside anyOf too", () => {
    expect([...referencedOptions([{ anyOf: ["not:target:attribute:divine", "self:acted"] }])])
      .toEqual(["target:attribute:divine", "self:acted"]);
  });
});
