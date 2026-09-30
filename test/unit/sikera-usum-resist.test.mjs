/**
 * @file Sikera Ušum clause d halves only a resistance that names Poison (#68).
 * @see module/engine/effect-applier.mjs#chanceContribution, packs/_source/abilities/semiramis-sikera-usum.yml
 *
 * > *"Units with Poison Resist effects that are not Poison Immune in this area
 * > have the magnitude of those Poison Resist effects halved. Only applies to
 * > effects that specify Poison."* — char_orig_sheets/Copia de Semiramis.md, line 115
 *
 * Found on the Semiramis audit: the field halved EVERY incoming resistance a
 * Unit held against Poison -- Queen's Poison's resistance to volatile debuffs,
 * Magic Resistance's debuff resistance -- because Poison matches them all. The
 * sheet's last sentence limits it to a resistance that specifies Poison.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { effectDef } from "../helpers/effect-defs.mjs";

const sikera = parse(readFileSync("packs/_source/abilities/semiramis-sikera-usum.yml", "utf8"));

/** What a Unit standing in the Throne Room carries from the field's clause d. */
const inField = () => collectContributions(
  [{ name: sikera.name, active: true, rules: sikera.field.interior.filter((r) => r.key === "ImmunityDowngrade") }],
).suppressions;

/** The resistances a Unit's own effects give it. */
const resists = (rules) => collectContributions([{ name: "own", active: true, rules }]).applicationChances;

/** Poison's application chance against this target, at a stated 50%. */
const chanceOf = (target) => {
  const r = applyEffect({
    def: { ...effectDef("poison"), id: "poison" },
    target: { id: "t", effects: [], effectInstances: [], ...target },
    source: {}, chance: 50,
    ctx: { turnsPerRound: 3, currentTick: 0, roll: 1, options: new Set() },
  });
  return Number(/(\d+(?:\.\d+)?)%/.exec(r.trace.find((s) => s.step === "chance").detail)[1]);
};

describe("Sikera Ušum clause d, the resistance half", () => {
  it("halves a resistance that specifies Poison: 40 → 20", () => {
    const own = resists([{ key: "ApplicationChance", direction: "incoming", effect: "poison", value: 40 }]);
    expect(chanceOf({ applicationChances: own })).toBe(10);
    expect(chanceOf({ applicationChances: own, suppressions: inField() })).toBe(30);
  });

  it("leaves one that does not: Queen's Poison's resistance to volatile debuffs stays 15", () => {
    const own = resists(effectDef("queensPoison").rules.filter((r) => r.key === "ApplicationChance"));
    expect(chanceOf({ applicationChances: own })).toBe(35);
    expect(chanceOf({ applicationChances: own, suppressions: inField() })).toBe(35);
  });
});
