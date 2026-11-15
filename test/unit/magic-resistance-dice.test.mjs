/**
 * @file Magic Resistance in dice mode, and the roll that never reached it.
 * @see module/rules/damage/pipeline.mjs stage 11, test/unit/zon-penalty.test.mjs (the same defect, one stage earlier)
 *
 * > *"(Passive) All MAG damage taken is reduced by 5d20; if NP, double the number of dice rolled."* (Normal Saber)
 *
 * Stage 11 reads `ctx.rolls.magicResistanceDice` and nothing in the resolution supplied it, so the Normal Saber's
 * resistance read "dice mode (5d20) — never negates" with a 0 beside it. Found pressing the Godot port's Card (M2).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { DICE_BOUNDS } from "../../module/rules/preview.mjs";

const mr = { mode: "dice", formula: "5d20", npDiceDoubled: true };
/** One MAG swing of 150 at a defender with dice-mode Magic Resistance. */
const swing = (rolls = {}) => computeDamage({
  attacker: { baseAttack: { str: 0, mag: 150 }, modifiers: [] },
  defender: { health: 9999, modifiers: [], magicResistance: mr },
  attack: { kind: "normal", component: "mag" },
  base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
  rolls: { attackMinus: 0, ...rolls },
  crit: { isCrit: false },
  options: new Set(),
});

describe("stage 11 in dice mode", () => {
  it("takes the roll it is given off the MAG share", () => {
    expect(swing({ magicResistanceDice: 40 }).total).toBe(110);
  });

  it("takes nothing when the roll is absent, which is what the defect looked like", () => {
    expect(swing().total).toBe(150);
  });
});

describe("the roll reaches it", () => {
  const source = readFileSync("module/engine/attack.mjs", "utf8");

  it("is supplied by the resolution beside the negation dice", () => {
    expect(source).toMatch(/magicResistanceDice: await rollMagicResistance\(defender, isNPAttack\(state\.attack\), usesBaseOptions\(baseSpec\)\)/);
  });

  it("doubles its dice against a Noble Phantasm when the resistance says so, and rolls only for dice mode against MAG", () => {
    const fn = source.slice(source.indexOf("async function rollMagicResistance"), source.indexOf("function doubleDice"));
    expect(fn).toMatch(/if \(mr\?\.mode !== "dice" \|\| !mr\.formula \|\| !uses\.includes\("attack:usesBase:mag"\)\) return 0;/);
    expect(fn).toMatch(/isNP && mr\.npDiceDoubled \? doubleDice\(mr\.formula\) : mr\.formula/);
  });
});

describe("the preview's bounds", () => {
  it("are 5d20's", () => {
    expect(DICE_BOUNDS.magicResistanceDice).toEqual({ min: 5, max: 100 });
  });
});
