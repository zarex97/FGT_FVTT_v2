/**
 * @file A `CheckModifier` whose magnitude is rolled.
 * @see module/rules/checks.mjs, module/rules/elements.mjs, docs/46-roster-re-audit.md §46.4-N
 *
 * `DamageModifier` has carried a `roll:` spec since Goddess of War was written
 * — the caller rolls, the total arrives in `ctx.rolls` keyed by source, and
 * `damage/pipeline.mjs` multiplies it. Penthesilea's clause 2 works that way
 * and was measured at −10 on a live board.
 *
 * `CheckModifier` never did. Its element handler read only `resolveValue` and
 * dropped `el.roll` on the floor, so the contribution reached the snapshot with
 * `value: 0`; `checkPlan` then filtered it out for being zero; and
 * `rollModifierDice` — whose own comment names Goddess of War — walked
 * `unit.modifiers` and never `unit.checkModifiers`, so nothing rolled the die
 * in the first place. Three places, each of which alone is enough to make the
 * clause inert.
 *
 * Her clause 3 is the **only** content in the corpus authoring one, so the one
 * clause that uses the feature was the one clause that did nothing. Measured
 * live: an Evade roll of 3 against a target of 16 with `modifiers: []`.
 */

import { describe, it, expect } from "vitest";
import { checkPlan } from "../../module/rules/checks.mjs";

/** Goddess of War clause 3: "Evade rolls reduced by 1d4". */
const sash = {
  check: "evade",
  direction: "outgoing",
  value: 0,
  roll: { key: "goddessOfWarEvade", formula: "1d4", multiplier: -1 },
  source: "Goddess of War: War God's Military Sash",
};

const penthesilea = (mods = [sash]) => ({ id: "p", checkModifiers: mods });

describe("a rolled CheckModifier reaches the check", () => {
  it("multiplies the caller's roll and contributes it", () => {
    const plan = checkPlan(penthesilea(), "evade", {
      options: new Set(), rolls: { goddessOfWarEvade: 3 },
    });
    expect(plan.modifiers).toEqual([
      { source: "Goddess of War: War God's Military Sash", value: -3 },
    ]);
  });

  it("scales with the die, not with a fixed number", () => {
    const at1 = checkPlan(penthesilea(), "evade", { options: new Set(), rolls: { goddessOfWarEvade: 1 } });
    const at4 = checkPlan(penthesilea(), "evade", { options: new Set(), rolls: { goddessOfWarEvade: 4 } });
    expect(at1.modifiers[0].value).toBe(-1);
    expect(at4.modifiers[0].value).toBe(-4);
  });

  it("contributes NOTHING when nobody rolled it", () => {
    // Distinct from rolling a zero, and the same reading the damage pipeline
    // takes: an unrolled die did not happen.
    const plan = checkPlan(penthesilea(), "evade", { options: new Set(), rolls: {} });
    expect(plan.modifiers).toEqual([]);
  });

  it("still honours the clause's predicate", () => {
    const gated = { ...sash, predicate: ["not:self:skillActive:madEnhancement"] };
    const calm = checkPlan(penthesilea([gated]), "evade", {
      options: new Set(), rolls: { goddessOfWarEvade: 2 },
    });
    const raging = checkPlan(penthesilea([gated]), "evade", {
      options: new Set(["self:skillActive:madEnhancement"]), rolls: { goddessOfWarEvade: 2 },
    });
    expect(calm.modifiers[0].value).toBe(-2);
    expect(raging.modifiers).toEqual([]);
  });

  it("leaves an ordinary numeric CheckModifier exactly as it was", () => {
    const flat = { check: "evade", direction: "outgoing", value: 4, source: "Doomsday Come" };
    const plan = checkPlan(penthesilea([flat]), "evade", { options: new Set(), rolls: {} });
    expect(plan.modifiers).toEqual([{ source: "Doomsday Come", value: 4 }]);
  });
});

describe("the element carries the roll spec through", () => {
  it("a CheckModifier keeps `roll` on the contribution", async () => {
    const { collectContributions } = await import("../../module/rules/elements.mjs");
    const out = collectContributions([{
      id: "gow", name: "Goddess of War", rank: null, active: true,
      passiveRules: [{
        key: "CheckModifier", check: "evade",
        roll: { key: "goddessOfWarEvade", formula: "1d4", multiplier: -1 },
      }],
    }]);

    expect(out.checkModifiers[0].roll).toEqual({
      key: "goddessOfWarEvade", formula: "1d4", multiplier: -1,
    });
  });
});
