/**
 * @file The `diceCount` damage formula — damage as a count of dice over a threshold.
 * @see docs/36-case-remaining.md §36.6, module/rules/damage/dice-count.mjs
 *
 * One ability in the corpus: Nemo's *Quickfire*. Its interest is not the
 * counting, which is trivial, but the THRESHOLD — four conditional modifiers,
 * one of which fires on a choice the defender makes mid-Combat-Process.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { thresholdFor, damageFromDice, thresholdModifiers } from "../../module/rules/damage/dice-count.mjs";
import { explain } from "../../module/rules/predicate.mjs";
import { record, renderBreakdown } from "../../module/rules/roll-log.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

/**
 * Quickfire's own formula block, **read from the authored file** rather than
 * copied here.
 *
 * Copied, it drifted: this test hand-wrote `@target.agility.value`, which is
 * the Actor document's spelling. The unit SNAPSHOT flattens Agility to a
 * number, so the real ability threw in a live world while this file stayed
 * green against a fixture that agreed with it and with nothing else.
 */
const SPEC = parse(
  readFileSync("packs/_source/abilities/nemo-quickfire.yml", "utf8"),
).damage.formula;

/**
 * A context in which NO modifier fires unless the caller asks for it: far away,
 * and against a target far faster than Nemo.
 *
 * @param {string[]} [opts]
 * @param {object} [refs]
 */
const ctx = (opts = [], refs = {}) => ({
  options: new Set(opts),
  refs: {
    self: { agility: 10 },
    target: { agility: 99 },
    distance: 5,
    ...refs,
  },
});

describe("Quickfire's threshold", () => {
  it("is the stated 5 with nothing true", () => {
    expect(thresholdFor(SPEC, ctx()).threshold).toBe(5);
  });

  it("worsens to 6 when the defender chooses to Evade", () => {
    expect(thresholdFor(SPEC, ctx(["target:reaction:evade"])).threshold).toBe(6);
  });

  it("improves to 4 at a Range of 2 or lower", () => {
    expect(thresholdFor(SPEC, ctx([], { distance: 2 })).threshold).toBe(4);
    expect(thresholdFor(SPEC, ctx([], { distance: 1 })).threshold).toBe(4);
    expect(thresholdFor(SPEC, ctx([], { distance: 3 })).threshold).toBe(5);
  });

  it("improves for Slow, Immobilize or Stun — any ONE of the three", () => {
    for (const e of ["slow", "immobilize", "stun"]) {
      expect(thresholdFor(SPEC, ctx([`target:effect:${e}`])).threshold, e).toBe(4);
    }
  });

  it("improves when the target's Agility is EQUAL to or lower than Nemo's", () => {
    // "equal or lower". An off-by-one here silently costs a die on every even
    // match-up, so both edges are named.
    expect(thresholdFor(SPEC, ctx([], { target: { agility: 10 } })).threshold).toBe(4);
    expect(thresholdFor(SPEC, ctx([], { target: { agility: 9 } })).threshold).toBe(4);
    expect(thresholdFor(SPEC, ctx([], { target: { agility: 11 } })).threshold).toBe(5);
  });

  it("compounds every modifier that applies", () => {
    const out = thresholdFor(SPEC, ctx(
      ["target:effect:stun"],
      { distance: 1, target: { agility: 1 } },
    ));
    expect(out.threshold).toBe(2);
  });

  it("lets the Evade penalty cancel an improvement rather than overriding it", () => {
    // +1 and -1 in the same use: the sheet gives one plus-clause and three
    // minus-clauses and no precedence between them, so they simply sum.
    const out = thresholdFor(SPEC, ctx(["target:reaction:evade"], { distance: 2 }));
    expect(out.threshold).toBe(5);
  });

  it("records every modifier and whether it was met, for the roll log", () => {
    // A four-modifier threshold that arrives unexplained is a number nobody at
    // the table can check against the sheet.
    const out = thresholdFor(SPEC, ctx([], { distance: 2 }));
    expect(out.applied).toHaveLength(4);
    expect(out.applied.filter((m) => m.met)).toHaveLength(1);
    expect(out.applied.find((m) => m.met).delta).toBe(-1);
  });

  it("survives a spec with no modifiers at all", () => {
    expect(thresholdFor({ threshold: { base: 4 } }, ctx()).threshold).toBe(4);
    expect(thresholdFor({ threshold: { base: 4 } }, ctx()).applied).toEqual([]);
  });
});

describe("Quickfire's damage", () => {
  it("pays 25 per die at or above the threshold", () => {
    expect(damageFromDice(SPEC, [6, 5, 4, 3, 2, 1], 5)).toEqual({ successes: 2, total: 50 });
  });

  it("counts the threshold itself as a success — 'X or higher'", () => {
    expect(damageFromDice(SPEC, [5, 5, 5, 5, 5, 5], 5)).toEqual({ successes: 6, total: 150 });
  });

  it("pays nothing when every die misses", () => {
    expect(damageFromDice(SPEC, [1, 1, 1, 1, 1, 1], 5)).toEqual({ successes: 0, total: 0 });
  });

  it("pays on every die once the threshold drops to 1", () => {
    // The floor of the ability: base 5 minus all three −1 clauses is 2, and
    // there is no clamp, so 1 is reachable only if a future clause adds one.
    expect(damageFromDice(SPEC, [1, 2, 3, 4, 5, 6], 1)).toEqual({ successes: 6, total: 150 });
  });

  it("pays 150 at the compounded floor of 2 on a lucky roll", () => {
    expect(damageFromDice(SPEC, [2, 3, 4, 5, 6, 6], 2).total).toBe(150);
  });
});

describe("the pipeline takes the counted figure", () => {
  it("deals it, and names the count in the breakdown", () => {
    const out = computeDamage({
      attacker: { id: "a", baseAttack: { str: 100 }, abilities: [] },
      defender: { id: "d", abilities: [] },
      base: { diceTotal: 75, successes: 3, diceRolled: 6, threshold: 3 },
      component: "str",
      attack: { kind: "skill", component: "str", bypassModifiers: { attacker: true, defender: false } },
      rolls: { attackMinus: 0 },
    });
    expect(out.total).toBe(75);
    const c = out.breakdown.flatMap((b) => b.contributors ?? []).find((x) => x.source === "diceCount");
    expect(c).toBeDefined();
    expect(c.note).toBe("3 of 6 dice at 3+");
  });

  it("keeps the defender's Def Up, because the bypass is one-sided", () => {
    const out = computeDamage({
      attacker: { id: "a", baseAttack: { str: 100 }, abilities: [] },
      defender: {
        id: "d", abilities: [],
        modifiers: [{ key: "defUp", value: 50, direction: "taken", source: "Def Up" }],
      },
      base: { diceTotal: 100, successes: 4, diceRolled: 6, threshold: 4 },
      component: "str",
      attack: { kind: "skill", component: "str", bypassModifiers: { attacker: true, defender: false } },
      rolls: { attackMinus: 0 },
    });
    expect(out.total).toBe(50);
  });
});

describe("the threshold reaches the roll log", () => {
  it("records every modifier, fired at its delta and unfired at zero", () => {
    const c = ctx([], { distance: 2 });
    const mods = thresholdModifiers(thresholdFor(SPEC, c), c, explain);
    expect(mods).toHaveLength(4);
    expect(mods.filter((m) => m.delta !== 0)).toHaveLength(1);
    // The one that fired says why, in words.
    expect(mods.find((m) => m.delta === -1).source).toBeTruthy();
    // And the three that did not are still in the log, which is the whole
    // point: "why was it 4 and not 2" is the question this ability provokes.
    expect(mods.filter((m) => m.delta === 0)).toHaveLength(3);
  });

  it("renders through the roll log's own breakdown", () => {
    const c = ctx(["target:effect:stun"], { distance: 1 });
    const result = thresholdFor(SPEC, c);
    const entry = record({
      id: "r1", entryId: "quickfire", formula: "6d6", raw: 21, total: result.threshold,
      modifiers: thresholdModifiers(result, c, explain),
      purpose: "Quickfire threshold",
    });
    const lines = renderBreakdown(entry);
    expect(lines[0]).toContain("6d6");
    expect(lines.join("\n")).toContain("total 3");
  });
});
