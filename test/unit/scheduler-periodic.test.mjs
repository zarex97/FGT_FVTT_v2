/**
 * @file Periodic damage is computed in one place.
 * @see docs/29-user-interface.md §29.2
 *
 * The Effects tab has to print "Poison Stage 3 · 80 damage at end of Round",
 * and 160 when the bearer also holds Deadly Poison. `tickPeriodics` already
 * knew both numbers and kept them behind a module-private `amplify`, so the
 * only way for a sheet to show them was to write Appendix A §A.12 out a second
 * time -- and the copy is the one nobody updates when a stage curve changes.
 */

import { describe, it, expect } from "vitest";
import { periodicDamageFor } from "../../module/engine/scheduler.mjs";

describe("periodicDamageFor", () => {
  it("is null for an effect with no periodic tick", () => {
    expect(periodicDamageFor({ defId: "defUp", stage: 0 }, { effects: [] })).toBe(null);
  });

  it("doubles Poison per stage — the number D29.4 says players get wrong", () => {
    const unit = { effects: ["poison"] };
    expect(periodicDamageFor({ defId: "poison", stage: 1 }, unit)).toBe(20);
    expect(periodicDamageFor({ defId: "poison", stage: 3 }, unit)).toBe(80);
    expect(periodicDamageFor({ defId: "poison", stage: 4 }, unit)).toBe(160);
  });

  it("treats stage 0 as stage 1, as the tick does", () => {
    expect(periodicDamageFor({ defId: "poison", stage: 0 }, { effects: [] })).toBe(20);
  });

  it("applies Deadly Poison's amplifier, so Stage 4 reads 320 not 160", () => {
    const unit = { effects: ["poison", "deadlyPoison"] };
    expect(periodicDamageFor({ defId: "poison", stage: 4 }, unit)).toBe(320);
  });

  it("does not amplify an effect the amplifier does not name", () => {
    const unit = { effects: ["burn", "deadlyPoison"] };
    expect(periodicDamageFor({ defId: "burn", stage: 0 }, unit)).toBe(50);
  });

  it("scales Curse by stage", () => {
    expect(periodicDamageFor({ defId: "curse", stage: 3 }, { effects: [] })).toBe(75);
  });

  it("survives a unit with no effect list at all", () => {
    expect(periodicDamageFor({ defId: "burn" }, null)).toBe(50);
  });
});

describe("Sikera Ušum clause e — the field's VulnerabilityAmplifier", () => {
  // "Units in the NP area who are weak to Poison ... receive double Poison
  // Damage ... has to be an effect the Unit already has" -- the amplifier
  // (populated by `rules/bounded-fields.mjs`'s `annotateFields` for a unit
  // standing in a matching field) only ever widens a weakness the unit
  // independently carries.
  const inField = (over = {}) => ({
    effects: ["poison"], vulnerabilityAmplifiers: [{ effectId: "poison", factor: 2 }], ...over,
  });

  it("doubles Poison damage for a unit with a standing weakTo marker", () => {
    const unit = inField({ effects: ["poison", "weakToPoison"] });
    expect(periodicDamageFor({ defId: "poison", stage: 1 }, unit)).toBe(40);
  });

  it("doubles it for a unit whose own resist contribution already raises Poison's chance", () => {
    const unit = inField({
      applicationChances: [{ direction: "incoming", effectId: "poison", value: -20 }],
    });
    expect(periodicDamageFor({ defId: "poison", stage: 1 }, unit)).toBe(40);
  });

  it("does nothing for an ordinary unit standing in the same field", () => {
    // Not weak to Poison at all -- the field widens an EXISTING weakness, it
    // does not invent one.
    expect(periodicDamageFor({ defId: "poison", stage: 1 }, inField())).toBe(20);
  });

  it("does not amplify an unrelated effect the amplifier does not name", () => {
    const unit = inField({ effects: ["burn", "weakToPoison"] });
    expect(periodicDamageFor({ defId: "burn", stage: 0 }, unit)).toBe(50);
  });

  it("stacks with Deadly Poison rather than replacing it", () => {
    const unit = inField({ effects: ["poison", "deadlyPoison", "weakToPoison"] });
    expect(periodicDamageFor({ defId: "poison", stage: 1 }, unit)).toBe(80);
  });
});
