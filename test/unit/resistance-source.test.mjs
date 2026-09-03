/**
 * @file A resistance bypass scoped to one SOURCE.
 * @see module/engine/effect-applier.mjs, docs/11-effect-engine.md
 *
 * > Medusa's Mystic Eyes: *"Debuffs inflicted by this Skill ignore the DU's
 * > debuff resistance due to Magic Resistance."*
 *
 * Not a bypass of resistance at large: Magic Resistance's other halves — the
 * MAG-damage negation and the Instakill/Death interaction — are untouched,
 * which is what the sheet says. So the contribution has to remember where it
 * came from, and the bypass has to name it.
 */

import { describe, it, expect } from "vitest";
import { applyEffect } from "../../module/engine/effect-applier.mjs";

const def = { id: "stun", name: "Stun", polarity: "debuff", severity: "normal", baseChance: 100 };

/**
 * A target resisting debuffs by 20%, from Magic Resistance B.
 *
 * A POSITIVE magnitude: `applicationChance` computes
 * `base + inflictBonus - resist`, and `magicResistanceDebuffResist` at B is
 * `20`. A resistance is how much is taken away, not a negative addend.
 */
const target = () => ({
  id: "t", name: "Target", kind: "servant", effects: [], attributes: [],
  applicationChances: [
    { direction: "incoming", value: 20, source: "Magic Resistance", sourceSlug: "magicResistance" },
  ],
});

const apply = (ignoresResistanceFrom, roll) => applyEffect({
  def,
  target: target(),
  source: { unitId: "m", abilityId: "eyes" },
  ctx: { turnsPerRound: 3, currentTick: 0, roll, options: new Set(), ignoresResistanceFrom },
});

describe("ignoresResistanceFrom", () => {
  it("lets the resistance bite when nothing bypasses it", () => {
    // 100 base − 20 resist = 80%. A roll of 90 misses.
    expect(apply([], 90).outcome).toBe("resisted");
  });

  it("removes the named source's contribution", () => {
    // The same roll lands once Magic Resistance is bypassed: 100%.
    expect(apply(["magicResistance"], 90).outcome).toBe("applied");
  });

  it("leaves a DIFFERENT source's resistance alone", () => {
    expect(apply(["presenceConcealment"], 90).outcome).toBe("resisted");
  });

  it("accepts the display name too, for a skill that states no slug", () => {
    expect(apply(["Magic Resistance"], 90).outcome).toBe("applied");
  });
});

describe("resistance applies at all", () => {
  it("is read off the target rather than forced to zero", () => {
    // Both callers in `engine/attack.mjs` used to pass `resist: 0`, and
    // `0 ?? x` is `0` — so the applier's fallback to `resistanceOf(target)`
    // never fired and Magic Resistance's "chance of being inflicted by debuffs
    // is reduced by 20%" reduced nothing, anywhere.
    expect(apply([], 85).outcome).toBe("resisted");
    expect(apply([], 75).outcome).toBe("applied");
  });
});
