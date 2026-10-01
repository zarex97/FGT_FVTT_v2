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

/**
 * Every file that asks whether an ability may be used.
 *
 * `engine/attack.mjs` joined in #156: `runCounter` computed the verdict only to
 * price the use and never refused on it, and the obvious fix -- refuse on
 * `!usage.ok` -- refuses every predicate-gated Counter unless the call carries
 * an evaluator. Four calls live there; each is guarded.
 */
const CALLERS = [
  "module/apps/hud/action-bar.mjs",
  "module/apps/actor-sheet/context.mjs",
  "module/engine/attack.mjs",
  "module/engine/skill-use.mjs",
];

/**
 * The argument of every `canUseAbility(...)` call in a source, however long
 * its comments are: balanced to the closing parenthesis rather than cut at a
 * fixed length, which stopped short of `testPredicate` in the attack path's
 * own call and so asserted nothing there.
 *
 * @param {string} source
 * @returns {string[]}
 */
function callArguments(source) {
  // Comments carry apostrophes and unbalanced brackets; the code does not.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const out = [];
  for (const m of code.matchAll(/(?<!function )canUseAbility\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < code.length && depth > 0) {
      if (code[i] === "(") depth += 1;
      else if (code[i] === ")") depth -= 1;
      i += 1;
    }
    out.push(code.slice(start, i - 1));
  }
  return out;
}

describe("canUseAbility call sites", () => {
  for (const file of CALLERS) {
    it(`${file} supplies testPredicate`, () => {
      const src = readFileSync(file, "utf8");
      const calls = callArguments(src);
      expect(calls.length, `${file} does not call canUseAbility at all`).toBeGreaterThan(0);

      for (const call of calls) {
        expect(call, `${file}: canUseAbility(…) without testPredicate`).toMatch(/testPredicate\s*:/);
      }
    });
  }

  it("sees every call in the attack path, not only the first", () => {
    // resolveAttack, runCounter, the Noble Phantasm cancellation's offer and
    // its price.
    expect(callArguments(readFileSync("module/engine/attack.mjs", "utf8")).length).toBe(4);
  });

  it("the refusing default is still what `meetsRequirement` does", () => {
    // If this ever stops being true the call sites above no longer need to
    // care, and this whole test can go. Stated so the next reader knows which
    // fact the fix depends on.
    const src = readFileSync("module/rules/items.mjs", "utf8");
    expect(src).toMatch(/typeof ctx\.testPredicate === "function"/);
  });
});
