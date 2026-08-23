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
