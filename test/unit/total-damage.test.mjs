/**
 * @file An ability's own **Total Damage** modifiers — stage 15.
 * @see module/rules/damage/pipeline.mjs, module/engine/attack.mjs, docs/22-damage-pipeline.md
 *
 * Stage 15 has read `ctx.totalDamageModifiers` since the pipeline was written,
 * and until Drake it had exactly ONE producer in the whole codebase —
 * `coverModifiersFor`, for Ch. 32's Cover rule. A sheet that says *"**Total**
 * damage dealt is increased"* had no way into it at all.
 *
 * **Why the ability's `damage:` block and not a rule element.** The first
 * attempt authored the two clauses as `DamageModifier` elements on the Noble
 * Phantasm's `rules:`. `contributionsOf` collects an ability's `rules`
 * UNCONDITIONALLY, beside its `passiveRules` — so they would have applied to
 * every Normal Attack Drake makes for the rest of the match. Her NP2 is the
 * only ability in the corpus with a top-level `rules:`, so nothing had ever
 * exercised that. The clause belongs to ONE Noble Phantasm, and the damage
 * block is what that Noble Phantasm is.
 *
 * **Why stage 15 and not stage 4.** Stage 3 applies the multiplier and the
 * flat bonus together (`200 × 4 + 100 = 900`), so against a bare target the
 * two stages agree — which is the trap. They diverge on the eleven stages
 * between them: stage 4 pools every percentage into one additive bucket, where
 * stage 15 multiplies each modifier independently on the finished number.
 */

import { describe, it, expect } from "vitest";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

/** Drake's broadside: `4× BA(MAG) 200 + 100`, read off the platform document. */
const broadside = (totalDamageModifiers = [], attackerOver = {}) => computeDamage({
  attacker: { id: "drake", baseAttack: { mag: 100 }, abilities: [], ...attackerOver },
  defender: { id: "d", abilities: [] },
  base: { sources: [{ contentId: "platform-golden-hind", component: "mag", factor: 1 }] },
  contentBaseAttack: { "platform-golden-hind": { baseAttack: { mag: 200 } } },
  component: "mag",
  multiplier: 4,
  flatBonus: 100,
  attack: { kind: "np", component: "mag" },
  rolls: { attackMinus: 0, attackPlus: 0 },
  totalDamageModifiers,
});

describe("a damage source may name a compendium document (spec R1)", () => {
  it("reads the ship's 200 with no ship on the board", () => {
    // "The Golden Hind's Base Attack (MAG) is used", and the shipless clause
    // exempts only the Range. A `unit` source resolves against the BOARD and
    // falls back to the attacker -- which would hand back her own 100 and
    // halve the Noble Phantasm.
    expect(broadside().total).toBe(900);
  });

  it("contributes nothing, loudly, when the content id resolves to nothing", () => {
    const out = computeDamage({
      attacker: { id: "drake", baseAttack: { mag: 100 }, abilities: [] },
      defender: { id: "d", abilities: [] },
      base: { sources: [{ contentId: "platform-missing", component: "mag", factor: 1 }] },
      contentBaseAttack: {},
      component: "mag", multiplier: 4, flatBonus: 100,
      attack: { kind: "np", component: "mag" },
      rolls: { attackMinus: 0, attackPlus: 0 },
    });
    // The flat 100 and nothing else -- NOT the attacker's own Base Attack.
    expect(out.total).toBe(100);
    const note = out.breakdown
      .flatMap((b) => b.contributors ?? [])
      .find((c) => (c.note ?? "").includes("unknown content"));
    expect(note, "an unresolved source must say so").toBeDefined();
  });
});

describe("a Total Damage modifier lands at stage 15", () => {
  it("multiplies the finished number, after the flat bonus", () => {
    // (200 x 4) + 100 = 900, then x1.3 at the END.
    expect(broadside([{ key: "totalDamage", factor: 1.3, source: "3 Galleon Tokens" }]).total)
      .toBe(1170);
  });

  it("reduces the finished number the same way", () => {
    expect(broadside([{ key: "totalDamage", factor: 0.85, source: "no Galleon Tokens" }]).total)
      .toBe(765);
  });

  it("multiplies independently where stage 4 pools additively", () => {
    // Two 30% clauses. Stage 15: x1.30 then x1.30 = x1.69 -> 1521.
    const independent = broadside([
      { key: "totalDamage", factor: 1.3, source: "A" },
      { key: "totalDamage", factor: 1.3, source: "B" },
    ]);
    // Stage 4: +60% in ONE bucket = x1.60 -> 1440.
    const pooled = broadside([], {
      modifiers: [
        { key: "atkUp", value: 30, direction: "dealt", source: "Atk Up" },
        { key: "dmgUp", value: 30, direction: "dealt", source: "Dmg Up" },
      ],
    });
    expect(independent.total).toBe(1521);
    expect(pooled.total).toBe(1440);
  });

  it("agrees with stage 4 against a bare target, which is the trap", () => {
    // Stage 3 applies the multiplier AND the flat bonus together, so a single
    // modifier and a bare defender cannot tell the two stages apart. A test
    // that stopped here would call the distinction cosmetic.
    const atStage4 = broadside([], {
      modifiers: [{ key: "atkUp", value: 30, direction: "dealt", source: "Atk Up" }],
    });
    expect(atStage4.total).toBe(1170);
  });

  it("names itself in the breakdown at stage 15", () => {
    const out = broadside([{ key: "totalDamage", factor: 1.3, source: "3 Galleon Tokens" }]);
    const stage15 = out.breakdown.find((b) => b.name === "totalDamageModifiers");
    const entry = (stage15.contributors ?? []).find((c) => c.note === "3 Galleon Tokens");
    expect(entry, "the clause must name itself on the chat card").toBeDefined();
  });

  it("leaves the attack alone when there are none", () => {
    expect(broadside([]).total).toBe(900);
  });
});
