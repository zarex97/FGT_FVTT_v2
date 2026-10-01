/**
 * @file An ability that deals no damage opens no attack card (#68).
 * @see module/rules/ability-use.mjs#classifyAbility, module/engine/skill-use.mjs#useSkill
 *
 * Ruled by the user on the Semiramis audit: *"It doesn't make sense for these
 * kind of thing to open an attack card, as it doesn't have a damage phase, same
 * with effect application-only abilities."* Every Noble Phantasm classified as
 * an attack, damage or not, so pressing the Hanging Gardens opened a Combat
 * Process against Semiramis herself, offering her Block, Evade and Command
 * Spells against her own activation. Twenty-one Noble Phantasms in the corpus
 * deal no damage (§46.4-CK).
 *
 * A non-damaging Noble Phantasm still costs the Servant's Attack and is still
 * refused by NP Seal: `useSkill` bills it as `np`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { classifyAbility } from "../../module/rules/ability-use.mjs";

const item = (file, type = "noblePhantasm") =>
  ({ type, system: parse(readFileSync(`packs/_source/abilities/${file}.yml`, "utf8")) });

describe("which abilities open a Combat Process", () => {
  it("not the Hanging Gardens' activation, which only opens a channel", () => {
    expect(classifyAbility(item("semiramis-hanging-gardens-of-babylon"))).toMatchObject({ kind: "active", isAttack: false });
  });

  it("not Sikera Ušum, which only opens a field", () => {
    expect(classifyAbility(item("semiramis-sikera-usum"))).toMatchObject({ kind: "active", isAttack: false });
  });

  it("not an effect-only Noble Phantasm", () => {
    expect(classifyAbility(item("gogh-de-sterrennacht"))).toMatchObject({ kind: "active", isAttack: false });
  });

  it("still every ability that deals damage", () => {
    expect(classifyAbility(item("semiramis-hgob-aerial-garden-of-vanity", "ability"))).toMatchObject({ kind: "attack" });
  });
});

describe("the price of one", () => {
  const src = readFileSync("module/engine/skill-use.mjs", "utf8");
  const body = src.slice(src.indexOf("export async function useSkill"), src.indexOf("const targets = resolveSkillTargets"));
  it("is billed as a Noble Phantasm, which NP Seal refuses and the Attack pool pays", () => {
    expect(body).toMatch(/isNP \? "np"/);
  });
});
