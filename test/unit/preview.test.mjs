/**
 * @file Speculative damage for the targeting preview.
 * @see docs/28-targeting-implementation.md §28.7
 */

import { describe, it, expect } from "vitest";
import {
  damageRange, rollsFor, formulaBounds, negationBounds, formatRange, DICE_BOUNDS,
} from "../../module/rules/preview.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

/** A minimal unit snapshot. */
function unit(overrides = {}) {
  return {
    id: "u", kind: "servant", panel: { i: 0, j: 0 }, health: 400, maxHealth: 400,
    effects: [], modifiers: [], parameters: {}, baseAttack: { str: 0, mag: 0 },
    attributes: [], damageNegation: [], ...overrides,
  };
}

/** A damage context with no rolls, as `damageRange` expects. */
function ctx(overrides = {}) {
  return {
    attacker: unit({ baseAttack: { str: 200, mag: 0 } }),
    defender: unit(),
    board: {},
    attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    multiplier: 1,
    flatBonus: 0,
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" },
    luckChecks: {},
    options: new Set(),
    ...overrides,
  };
}

describe("rollsFor", () => {
  it("maximises the SUBTRACTED attack roll for the low end", () => {
    // attackMinus subtracts, so its maximum is the minimum damage. Getting this
    // backwards inverts the range shown to the player.
    expect(rollsFor("min").attackMinus).toBe(DICE_BOUNDS.attackMinus.max);
    expect(rollsFor("max").attackMinus).toBe(DICE_BOUNDS.attackMinus.min);
  });

  it("minimises the ADDED crit roll for the low end", () => {
    expect(rollsFor("min", { isCrit: true }).attackPlus).toBe(DICE_BOUNDS.attackPlus.min);
    expect(rollsFor("max", { isCrit: true }).attackPlus).toBe(DICE_BOUNDS.attackPlus.max);
  });

  it("uses only the roll the crit flip selects", () => {
    expect(rollsFor("min", { isCrit: true }).attackMinus).toBeUndefined();
    expect(rollsFor("min", { isCrit: false }).attackPlus).toBeUndefined();
  });

  it("maximises negation for the low end", () => {
    const negation = [{ source: "Battle Continuation", min: 17, max: 35 }];
    expect(rollsFor("min", { negation }).negation[0].value).toBe(35);
    expect(rollsFor("max", { negation }).negation[0].value).toBe(17);
  });
});

describe("damageRange", () => {
  it("brackets the real pipeline's output", () => {
    const c = ctx();
    const range = damageRange(c);
    const actual = computeDamage({ ...c, rolls: { attackMinus: 22 } }).total;
    expect(actual).toBeGreaterThanOrEqual(range.min);
    expect(actual).toBeLessThanOrEqual(range.max);
  });

  it("produces 150 – 195 for a 200 Base Attack with no modifiers", () => {
    // 200 - 50 at worst, 200 - 5 at best.
    const range = damageRange(ctx());
    expect(range.min).toBe(150);
    expect(range.max).toBe(195);
  });

  it("reports the crit range separately, and higher", () => {
    const range = damageRange(ctx());
    expect(range.crit.min).toBeGreaterThan(range.max);
  });

  it("narrows when the defender has dice negation, at the correct end", () => {
    const withNegation = ctx({
      defender: unit({
        damageNegation: [{ mode: "dice", formula: "2d10+15", source: "Battle Continuation" }],
      }),
    });
    const negation = negationBounds(withNegation.defender);
    const range = damageRange(withNegation, { negation });
    // Low end: 200 - 50 - 35. High end: 200 - 5 - 17.
    expect(range.min).toBe(115);
    expect(range.max).toBe(178);
  });

  it("flags a certain result when nothing varies", () => {
    const fixed = ctx({ attack: { kind: "normal", isFixedDamage: true }, base: { flat: 100 } });
    expect(damageRange(fixed).certain).toBe(true);
  });

  it("does not mutate the context it is given", () => {
    const c = ctx();
    damageRange(c);
    expect(c.rolls).toBeUndefined();
    expect(c.crit.isCrit).toBe(false);
  });
});

describe("formulaBounds", () => {
  it("reads the NdF+B forms the rank tables use", () => {
    expect(formulaBounds("2d10+15")).toEqual({ min: 17, max: 35 });
    expect(formulaBounds("5d20")).toEqual({ min: 5, max: 100 });
    expect(formulaBounds("1d6-2")).toEqual({ min: -1, max: 4 });
  });

  it("returns a zero range for anything it does not understand, rather than guessing", () => {
    expect(formulaBounds("2d10 + @mod")).toEqual({ min: 0, max: 0 });
    expect(formulaBounds(null)).toEqual({ min: 0, max: 0 });
  });
});

describe("negationBounds", () => {
  it("doubles the dice count against a Noble Phantasm, not the total", () => {
    const defender = unit({
      damageNegation: [{ mode: "dice", formula: "2d10+15", npDiceDoubled: true, source: "BC" }],
    });
    expect(negationBounds(defender, false)[0]).toEqual({ source: "BC", min: 17, max: 35 });
    // 4d10+15 -- not 2*(2d10+15), which would be 34-70.
    expect(negationBounds(defender, true)[0]).toEqual({ source: "BC", min: 19, max: 55 });
  });

  it("ignores flat-mode negation, which the pipeline reads elsewhere", () => {
    expect(negationBounds(unit({ damageNegation: [{ mode: "flat", formula: 20 }] }))).toEqual([]);
  });
});

describe("formatRange", () => {
  it("collapses a certain value to one number", () => {
    expect(formatRange({ min: 409, max: 409, certain: true })).toBe("409");
  });

  it("prints an en-dash range otherwise", () => {
    expect(formatRange({ min: 150, max: 195, certain: false })).toBe("150 – 195");
  });
});
