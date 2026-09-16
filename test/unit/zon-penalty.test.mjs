/**
 * @file §16.5's ZON penalty, and the roll that never reached it.
 * @see module/rules/damage/pipeline.mjs stage 9, docs/16-relationships.md §16.5
 *
 * > *"When a Servant deals damage with an Attack while outside of its Master's
 * > ZON, damage dealt is reduced by 5d10."*
 *
 * Stage 9 has implemented this since the pipeline was written: correctly gated
 * on `outsideZon`, correctly exempted by Ozymandias's `zonPenalty` suppression,
 * and reading the die from `ctx.rolls.zonPenalty`. **Nothing in the resolution
 * ever supplied that roll**, so it subtracted `?? 0` — collected, right, and
 * worth nothing. `rules/preview.mjs` *did* supply it, so the confirmation
 * dialog promised a reduction the resolution declined to apply, and it supplied
 * it from `{min: 1, max: 20}` — a `1d20`, which is not a die this rule has ever
 * named.
 *
 * Found by pressing a clause that had only been traced: Medea attacking from
 * six panels outside a ZON of five, with the breakdown naming the stage and
 * showing `0`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { DICE_BOUNDS } from "../../module/rules/preview.mjs";

/** One swing of 200, from a Servant who may or may not be outside the zone. */
const swing = (attacker, rolls = {}) => computeDamage({
  attacker: { baseAttack: { str: 200, mag: 0 }, modifiers: [], ...attacker },
  defender: { health: 9999, modifiers: [] },
  attack: { kind: "normal", component: "str" },
  base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
  rolls: { attackMinus: 0, ...rolls },
  crit: { isCrit: false },
  options: new Set(),
});

describe("stage 9", () => {
  it("subtracts the roll it is given", () => {
    expect(swing({ outsideZon: true }, { zonPenalty: 30 }).total).toBe(170);
  });

  it("does nothing for a Servant inside the zone", () => {
    expect(swing({ outsideZon: false }, { zonPenalty: 30 }).total).toBe(200);
  });

  it("is waived by a `zonPenalty` suppression without lifting the zone itself", () => {
    // Ozymandias: *"his Master's ZON is ignored when he Attacks (no damage
    // reduction)"* — about damage, and only about damage.
    const waived = { outsideZon: true, suppressions: [{ scope: "zonPenalty" }] };
    expect(swing(waived, { zonPenalty: 30 }).total).toBe(200);
  });

  it("subtracts nothing when the roll is absent, which is what the defect looked like", () => {
    // The stage still fires and still names its reason — so the breakdown reads
    // as though the rule applied. That is why it survived: the log said
    // "outside the Master's ZON" and the number beside it was zero.
    const r = swing({ outsideZon: true });
    const stage = r.breakdown.find((s) => s.name === "zonPenalty");

    expect(r.total).toBe(200);
    expect(stage.contributors).toHaveLength(1);
    expect(stage.contributors[0].source).toBe("zonPenalty");
    // `toBeCloseTo`, because negating a zero roll yields `-0`.
    expect(stage.contributors[0].value).toBeCloseTo(0);
  });
});

describe("the roll reaches it", () => {
  const source = readFileSync("module/engine/attack.mjs", "utf8");

  it("is supplied by the resolution, beside the other pipeline dice", () => {
    // `attack.mjs` is the client boundary — it rolls and writes documents — so
    // this guards the condition in the source, the discipline
    // `applier-callsites.test.mjs` already applies. The behaviour is verified on
    // a live board: 228 → 194 on a −34.
    expect(source).toMatch(/zonPenalty: attacker\?\.outsideZon \? \(await new Roll\("5d10"\)/);
  });

  it("is rolled only when it can apply", () => {
    expect(source).toMatch(/outsideZon \? \(await new Roll\("5d10"\)\.evaluate\(\)\)\.total : 0/);
  });
});

describe("the preview's bounds", () => {
  it("are 5d10's, not a d20's", () => {
    // Ch. C lists it as `5d10`, the same die `attack+`/`attack-` roll.
    expect(DICE_BOUNDS.zonPenalty).toEqual({ min: 5, max: 50 });
    expect(DICE_BOUNDS.zonPenalty).toEqual(DICE_BOUNDS.attackPlus);
  });
});
