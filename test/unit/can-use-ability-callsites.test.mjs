/**
 * @file Every `canUseAbility` call site supplies a predicate evaluator.
 * @see docs/46-roster-re-audit.md §46.4-AX
 *
 * A `kind: "predicate"` requirement **refuses** when `ctx.testPredicate` is
 * absent, on purpose — `rules/items.mjs` says so in as many words: *"a gate
 * nobody can answer is not an open gate."* That is the right default for the
 * execution path, where letting an unanswerable gate through would run an
 * ability whose conditions nobody checked.
 *
 * It is exactly the wrong default for a **display**. The action bar and the
 * actor sheet both called `canUseAbility` without an evaluator, so every
 * ability carrying such a requirement was shown greyed and captioned *"Its
 * conditions are not met right now"* — permanently, whether or not they were.
 *
 * Ten abilities across five Servants carry one, including Karna's Vasavi Shakti
 * and four of Quetzalcoatl's. Found on Semiramis, whose Hanging Gardens could
 * not be pressed at Construction 100, in her Home Base, on the right Round.
 *
 * A behavioural test is awkward here — the defect lives in what a caller
 * omitted, not in what any function computed — so this reads the source, which
 * is where an omitted argument is visible.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

/** Every file that asks whether an ability may be used. */
const CALLERS = [
  "module/apps/hud/action-bar.mjs",
  "module/apps/actor-sheet/context.mjs",
];

describe("canUseAbility call sites", () => {
  for (const file of CALLERS) {
    it(`${file} supplies testPredicate`, () => {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} does not call canUseAbility at all`).toMatch(/canUseAbility\s*\(/);

      // The call, however it is line-wrapped, up to its closing brace.
      for (const m of src.matchAll(/canUseAbility\(\{([\s\S]{0,600}?)\}\)/g)) {
        expect(m[1], `${file}: canUseAbility({…}) without testPredicate`)
          .toMatch(/testPredicate\s*:/);
      }
    });
  }

  it("the refusing default is still what `meetsRequirement` does", () => {
    // If this ever stops being true the call sites above no longer need to
    // care, and this whole test can go. Stated so the next reader knows which
    // fact the fix depends on.
    const src = readFileSync("module/rules/items.mjs", "utf8");
    expect(src).toMatch(/typeof ctx\.testPredicate === "function"/);
  });
});
