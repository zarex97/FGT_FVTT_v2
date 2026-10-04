/**
 * @file A caster-only choice on an Attack Skill is asked once, in words (#180).
 * @see module/engine/attack.mjs#resolveChoosePhases, module/engine/skill-use.mjs#runChoice
 *
 * Live: Castor's Mana Burst asked "choose the restoration" twice in one attack.
 * The first prompt showed the raw keys "FGT.Dioscuri.SelfRestore" and
 * "FGT.Dioscuri.SplitRestore". `choose` is a caster phase, so the declaration
 * asks it and runs the branch; the rider step asked again.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("a choice whose branches only touch the caster", () => {
  it("is not asked again by the rider step", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const fn = src.slice(src.indexOf("async function resolveChoosePhases"));
    expect(fn).toMatch(/const perDefender = \(o\) => \(o\.phases \?\? \[\]\)\.some\(\(p\) => p\.kind === "applyEffects" \|\| p\.kind === "applyEffect"\);\s*if \(!\(phase\.options \?\? \[\]\)\.some\(perDefender\)\) continue;/);
  });

  it("is still a caster phase, asked at declaration", () => {
    const src = readFileSync("module/engine/skill-use.mjs", "utf8");
    const set = src.slice(src.indexOf("export const CASTER_PHASES"), src.indexOf("]);", src.indexOf("export const CASTER_PHASES")));
    expect(set).toMatch(/"choose"/);
  });

  it("shows its labels localized", () => {
    const src = readFileSync("module/engine/skill-use.mjs", "utf8");
    expect(src).toMatch(/name: o\.label \? game\.i18n\.localize\(o\.label\) : \(EffectRegistry\.get\(o\.id\)\?\.name \?\? o\.id\),/);
  });

  it("Mana Burst's branches carry no rider", () => {
    for (const twin of ["castor", "pollux"]) {
      const yml = readFileSync(`packs/_source/abilities/dioscuri-mana-burst-${twin}.yml`, "utf8");
      const choice = yml.slice(yml.indexOf("kind: choose"), yml.indexOf("- kind: damage"));
      expect(choice).not.toMatch(/applyEffects?/);
    }
  });
});
