/**
 * @file The 'Kiritsugu' debuff ignores Debuff Resist and Debuff Immune (#98).
 * @see packs/_source/effects/kiritsugu-mark.yml, module/engine/effect-applier.mjs
 *
 * > *"...apply the 'Kiritsugu' debuff to the DU ... this effect ignores Debuff
 * > Resist and Debuff Immune effects, and the 'Kiritsugu' debuff is
 * > Unremovable."* — char_orig_sheets/Copia de Kiritsugu.md, line 79
 *
 * The file said `bypassesImmunity: true`, the registry and the applier read it,
 * and `AbilityData` declared no such field, so the pack never kept it. Kept, it
 * still did nothing against Debuff Immune: the applier's immunity gate runs
 * before the chance, and only the chance looked at the flag. And nothing said
 * the second half, Debuff Resist, at all.
 */

import { describe, it, expect } from "vitest";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { effectDef } from "../helpers/effect-defs.mjs";

const mark = () => ({ ...effectDef("kiritsuguMark"), id: "kiritsuguMark" });
const immune = () => collectContributions([{ name: "Debuff Immune", active: true, rules: effectDef("debuffImmune").rules }]).immunities;
const land = (def, target, roll = 100) => applyEffect({
  def, target: { id: "t", effects: [], effectInstances: [], ...target }, source: {},
  ctx: { turnsPerRound: 3, currentTick: 0, roll, options: new Set() },
}).outcome;

describe("the 'Kiritsugu' debuff", () => {
  it("lands on a Unit holding Debuff Immune", () => {
    expect(land(mark(), { effects: ["debuffImmune"], immunities: immune() })).toBe("applied");
  });

  it("lands through Debuff Resist: 60% resistance, a roll of 99", () => {
    const resisting = { applicationChances: [{ direction: "incoming", value: 60, polarity: null, source: "Debuff ResUp" }] };
    expect(land(mark(), resisting, 99)).toBe("applied");
  });

  it("is still an ordinary debuff to everything else: Poison is blocked by the same immunity", () => {
    const poison = { ...effectDef("poison"), id: "poison" };
    expect(land(poison, { effects: ["debuffImmune"], immunities: immune() })).toBe("blocked");
  });
});

describe("the pack keeps the flags", () => {
  it("an Item built from the Mark keeps bypassesImmunity and bypassesResistance", async () => {
    const { keptByModel } = await import("../helpers/world.mjs");
    const kept = await keptByModel("Item", {
      name: "Kiritsugu", type: "ability",
      system: { bypassesImmunity: true, bypassesResistance: true },
    });
    expect(kept.system).toMatchObject({ bypassesImmunity: true, bypassesResistance: true });
  }, 60_000);
});
