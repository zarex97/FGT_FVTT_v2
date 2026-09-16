/**
 * @file Medea, held against her sheet.
 * @see char_orig_sheets/Copia de Medea.md, docs/46-roster-re-audit.md §46.11
 *
 * Thirteen abilities, seven of them Spells, and a Noble Phantasm that rewrites
 * the relationship graph. The defect her audit found is not hers alone: the same
 * narrowing reached two of Van Gogh's class skills.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

const doc = (path) => parse(readFileSync(path, "utf8"));
const ability = (id) => doc(`packs/_source/abilities/${id}.yml`);
const classSkill = (id) => doc(`packs/_source/class-skills/${id}.yml`);

/** Every authored effect, by id. */
const effects = readdirSync("packs/_source/effects")
  .filter((f) => f.endsWith(".yml"))
  .map((f) => doc(`packs/_source/effects/${f}`));

describe("a debuff-chance contribution says `debuff`, not `offensive`", () => {
  // `polarity` is the buff/debuff axis and `chanceContribution` already filters
  // on it. `valence` is a different axis entirely — what an effect DOES — so
  // narrowing a debuff-chance clause by it drops debuffs the sheet grants.
  const defensiveDebuffs = effects
    .filter((e) => e.polarity === "debuff" && e.valence !== "offensive")
    .map((e) => e.id)
    .sort();

  it("would have excluded a third of the debuff catalogue", () => {
    // Named rather than counted, so a new defensive debuff shows up here as a
    // name instead of a changed number. `Def Dwn` is the commonest debuff in
    // the game — four Noble Phantasms in the reference set inflict it.
    expect(defensiveDebuffs).toContain("defDwn");
    expect(defensiveDebuffs.length).toBeGreaterThanOrEqual(10);
  });

  /** Every `ApplicationChance` a document contributes, at any nesting. */
  const chances = (node, out = []) => {
    if (Array.isArray(node)) { node.forEach((n) => chances(n, out)); return out; }
    if (!node || typeof node !== "object") return out;
    if (node.key === "ApplicationChance") out.push(node);
    Object.values(node).forEach((v) => chances(v, out));
    return out;
  };

  it("is unqualified wherever a sheet says plain `debuffs`", () => {
    // All three sheets say "debuffs" with no further qualifier: Medea's Item
    // Construction, Van Gogh's, and his Existence Outside The Domain.
    for (const d of [
      ability("medea-item-construction"),
      classSkill("item-construction-gogh"),
      classSkill("existence-outside-the-domain"),
    ]) {
      const narrowed = chances(d.passiveRules).filter((c) => c.valence);
      expect(narrowed, d.id).toEqual([]);
    }
  });
});

describe("Item Construction", () => {
  const ic = ability("medea-item-construction");
  const aura = ic.passiveRules.find((r) => r.key === "Aura");

  it("reaches allies within 2 panels, herself included", () => {
    expect(aura).toMatchObject({ radius: 2, relations: ["ally", "self"] });
  });

  it("does not stack — only the highest Rank takes effect", () => {
    // Resolved across the whole GROUP by rank, so a C-rank instance cannot win
    // one severity tier and lose another.
    expect(aura).toMatchObject({ stacking: "highestOnly", group: "itemConstruction" });
  });

  it("states all three severity tiers, halved and re-halved", () => {
    const by = (dir, sev) => aura.elements
      .find((e) => e.direction === dir && e.severity === sev)?.value;

    for (const dir of ["outgoing", "incoming"]) {
      expect([by(dir, "normal"), by(dir, "instakill"), by(dir, "death")]).toEqual([50, 25, 10]);
    }
  });
});

describe("her sheet", () => {
  const m = doc("packs/_source/servants/medea.yml");

  it("matches the stat block", () => {
    expect(m.parameters).toEqual({ str: "E", end: "D", agi: "C", mag: "A+", luc: "B" });
    expect(m.baseAttack).toEqual({ str: 50, mag: 210 });
    expect(m.range).toEqual({ panels: 3, targets: 1 });
    expect(m.sustainability).toBe("4\u25c8");
  });

  it("attacks with MAG, being a Caster", () => {
    expect(m.normalAttack).toMatchObject({ component: "mag" });
  });

  it("gives High-Speed Divine Words no `category`, so it cannot reset itself", () => {
    // It resets *"all of Medea's Spells"* and is not one: a `category: spell`
    // on the resetter would zero its own 3◈ Cooldown the moment it was pressed.
    const hsdw = ability("medea-high-speed-divine-words");
    expect(hsdw.category).toBeUndefined();
    expect(hsdw.phases[0].changes).toEqual([{ category: "spell", set: 0 }]);
  });

  it("prices Dragon Tooth Warriors per warrior conjured", () => {
    // *"Cooldown: (Number of Dragon Tooth Warriors x ⅔◈) Turns."*
    expect(ability("medea-dragon-tooth-warriors").cooldown)
      .toEqual({ perUnit: "\u2154\u25c8", countFrom: "summonCount" });
  });
});
