/**
 * @file Content-authored **Total Damage** modifiers — stage 15.
 * @see module/rules/damage/pipeline.mjs, docs/13-damage-pipeline.md §13.4
 *
 * Stage 15 has read `ctx.totalDamageModifiers` since the pipeline was written,
 * and until Drake it had exactly ONE producer in the whole codebase —
 * `coverModifiersFor`, for §16.4's Cover rule. `DamageModifier` had no `stage`
 * field at all, so every authored modifier landed at stage 4 and the "Total
 * Damage" family of clauses had a stage of its own with no way into it.
 *
 * The distinction is not cosmetic, though it is subtler than it first looks.
 * Stage 3 already applies the multiplier and the flat bonus TOGETHER
 * (`200 × 4 + 100 = 900`), so against a bare target the two stages agree. They
 * diverge on the eleven stages between them, and in two ways:
 *
 *   1. **Stage 4 pools additively.** Every attacker and defender percentage
 *      sums into one bucket, so Atk Up 30 and Atk Up 20 make ×1.50. Stage 15
 *      multiplies each modifier independently — ×1.30 then ×1.20 is ×1.56 —
 *      because each is stated as acting on the finished number.
 *   2. **Flat reductions (stage 12) fall between them.** A Dmg Cut of 100
 *      subtracts from a stage-4-boosted number and is then not boosted, where a
 *      stage-15 modifier boosts a number the Dmg Cut has already left.
 *
 * Both are tested below, because "it made no difference in my one example" is
 * exactly how a modifier ends up at the wrong stage.
 */

import { describe, it, expect } from "vitest";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

/** Drake's broadside, without the Galleon clauses. */
const broadside = (over = {}) => ({
  attacker: { id: "drake", baseAttack: { mag: 200 }, abilities: [], ...over.attacker },
  defender: { id: "d", abilities: [] },
  base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
  component: "mag",
  multiplier: 4,
  flatBonus: 100,
  attack: { kind: "np", component: "mag" },
  rolls: { attackMinus: 0, attackPlus: 0 },
  ...over.ctx,
});

describe("a Total Damage modifier lands at stage 15", () => {
  it("multiplies the finished number, after the flat bonus", () => {
    const out = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [{
          key: "totalDamage", stage: "total", direction: "dealt",
          value: 30, source: "3 Galleon Tokens",
        }],
      },
    }));
    // (200 x 4) + 100 = 900, then x1.3 at the END.
    expect(out.total).toBe(1170);
  });

  it("reduces the finished number the same way", () => {
    const out = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [{
          key: "totalDamage", stage: "total", direction: "dealt",
          value: -15, source: "no Galleon Tokens",
        }],
      },
    }));
    // 900 x 0.85 = 765.
    expect(out.total).toBe(765);
  });

  it("is NOT also counted at stage 4", () => {
    // The trap: `DamageModifier`'s default bucket key is `atkUp`, which stage 4
    // reads. A Total modifier that kept it would be applied twice -- once in
    // the stage-4 bucket and once here -- so it carries its own key, which is
    // in neither bucket set.
    const out = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [{
          key: "totalDamage", stage: "total", direction: "dealt",
          value: 30, source: "3 Galleon Tokens",
        }],
      },
    }));
    expect(out.total).not.toBe(1521); // 900 x 1.3 x 1.3
    expect(out.total).toBe(1170);
  });

  it("agrees with stage 4 against a bare target, which is the trap", () => {
    // Stage 3 applies the multiplier AND the flat bonus together, so there is
    // nothing between the two stages to tell them apart here. A test that
    // stopped at this case would call the distinction cosmetic.
    const atStage4 = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [{ key: "atkUp", value: 30, direction: "dealt", source: "Atk Up" }],
      },
    }));
    expect(atStage4.total).toBe(1170);
  });

  it("multiplies independently where stage 4 pools additively", () => {
    // Two 30% modifiers. Stage 4: +60% in one bucket = x1.60 -> 1440.
    // Stage 15: x1.30 then x1.30 = x1.69 -> 1521.
    const pooled = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [
          { key: "atkUp", value: 30, direction: "dealt", source: "Atk Up" },
          { key: "dmgUp", value: 30, direction: "dealt", source: "Dmg Up" },
        ],
      },
    }));
    const independent = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [
          { key: "totalDamage", stage: "total", direction: "dealt", value: 30, source: "A" },
          { key: "totalDamage", stage: "total", direction: "dealt", value: 30, source: "B" },
        ],
      },
    }));
    expect(pooled.total).toBe(1440);
    expect(independent.total).toBe(1521);
  });

  it("names itself in the breakdown at stage 15", () => {
    const out = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [{
          key: "totalDamage", stage: "total", direction: "dealt",
          value: 30, source: "3 Galleon Tokens",
        }],
      },
    }));
    const stage15 = out.breakdown.find((b) => b.name === "totalDamageModifiers");
    const entry = (stage15.contributors ?? []).find((c) => c.note === "3 Galleon Tokens");
    expect(entry, "the clause must name itself in the chat card's breakdown").toBeDefined();
    expect(entry.source).toBe("totalDamage");
    expect(entry.value).toBeCloseTo(1.3);
  });

  it("leaves a Total modifier of zero alone", () => {
    const out = computeDamage(broadside({
      attacker: {
        id: "drake", baseAttack: { mag: 200 }, abilities: [],
        modifiers: [{
          key: "totalDamage", stage: "total", direction: "dealt",
          value: 0, source: "no Galleon Tokens",
        }],
      },
    }));
    expect(out.total).toBe(900);
  });
});

describe("perResource — a magnitude counted off a pool", () => {
  const withTokens = (n) => computeDamage(broadside({
    attacker: {
      id: "drake",
      baseAttack: { mag: 200 },
      abilities: [],
      resources: { galleonTokens: { value: n, max: null } },
      modifiers: [{
        key: "totalDamage", stage: "total", direction: "dealt",
        value: 10, perResource: { resource: "galleonTokens", each: 1 },
        source: "Galleon Tokens",
      }],
    },
  }));

  it("scales with the pool: +10% for every Galleon Token", () => {
    expect(withTokens(3).total).toBe(1170); // 900 x 1.30
    expect(withTokens(1).total).toBe(990); // 900 x 1.10
  });

  it("contributes nothing at all at zero, rather than a factor of zero", () => {
    // The -15% clause is a SEPARATE modifier; this one simply stops. A factor
    // of 0 here would delete the Noble Phantasm.
    expect(withTokens(0).total).toBe(900);
  });
});
