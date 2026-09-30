/**
 * @file Rule-element keys the content authors and an executor never read (#103).
 * @see module/rules/elements.mjs, test/unit/rule-survival.test.mjs
 *
 * The rule-survival test found them: each key is authored inside a rule
 * element, and nothing on its Route reads it, so each Clause silently does not
 * happen. One section per executor. Every element is read from the real
 * content file and run through the real executor; the pipeline then gets what
 * the executor produced, never a shape written by hand.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { collectContributions } from "../../module/rules/elements.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { critChance } from "../../module/rules/checks.mjs";

/** A content file under packs/_source, parsed. */
const content = (path) => parse(readFileSync(`packs/_source/${path}`, "utf8"));

/** What one authored ability contributes, through the real executors. */
const contributions = (ability, ctx = {}) => collectContributions([{ active: true, ...ability }], ctx);

/** A plain STR hit carrying the attacker's modifiers. */
const hit = (modifiers, { kind = "normal" } = {}) => computeDamage({
  attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers, effects: [] },
  defender: { id: "d", health: 9999, modifiers: [], effects: [] },
  attack: { kind, component: "str" },
  base: { fixedValue: 200 },
  rolls: { attackMinus: 0 },
  crit: { isCrit: false },
  options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind } }),
});

/** The stage-7 flat total a set of modifiers adds. */
const flatOf = (modifiers, opts) => hit(modifiers, opts).total - hit([], opts).total;

describe("FlatDamage", () => {
  it("carries npValue: Vorpal Blade's +50 adds nothing to a Noble Phantasm", () => {
    const blade = content("abilities/vorpal-blade.yml");
    const [bonus] = contributions({ name: blade.name, rules: [blade.rules[0]] }).modifiers;
    expect(bonus).toMatchObject({ value: 50, npValue: 0 });
    expect(flatOf([{ ...bonus, predicate: null }], { kind: "np" })).toBe(0);
  });

  // "Goddess' Divine Core: All damage dealt is increased by 180" while the
  // Sun Stone stands. The file's DECISION is that 180 replaces her Skill's 120.
  it("carries supersedes: the Sun Stone's 180 replaces Goddess's Divine Core's 120", () => {
    const core = content("abilities/quetz-goddesses-divine-core.yml");
    const stone = content("abilities/quetz-piedra-del-sol.yml");
    const [skill] = contributions(
      { name: core.name, contentId: core.id, rank: core.rank, passiveRules: [core.passiveRules[0]] },
    ).modifiers;
    const [field] = contributions({ name: stone.name, rules: [stone.field.interior[0]] }).modifiers;
    expect(skill).toMatchObject({ value: 120, sourceContentId: "quetz-goddesses-divine-core" });
    expect(field).toMatchObject({ value: 180, supersedes: ["quetz-goddesses-divine-core"] });
    expect(flatOf([skill, field])).toBe(180);
    expect(flatOf([skill])).toBe(120);
  });
});

// Found beside #103's `npValue` row, and the larger half of it: `aspect:
// chance` produced a `critUp` modifier that NOTHING reads. Crit chance is read
// off `checkModifiers` (`rules/checks.mjs#critChance`) since the coin flip was
// replaced, so six clauses raised nobody's crit chance: Oblivion Correction,
// Existence Outside the Domain, Independent Action (Viy), Pollux's Twin God's
// Divine Core, Area Crit Up and Crit Up (Viy).
describe("CritModifier", () => {
  const chance = (checkModifiers, options = new Set()) =>
    critChance({ checkModifiers, effects: [] }, null, { options }).percent;

  it("raises crit chance: Oblivion Correction C", () => {
    const skill = content("class-skills/oblivion-correction.yml");
    const out = contributions({ name: skill.name, rank: "C", passiveRules: skill.passiveRules });
    expect(chance(out.checkModifiers)).toBeGreaterThan(50);
  });

  it("carries npValue: Crit Up (Viy) is 50% on a MAG attack, 20% if NP", () => {
    const viy = content("effects/crit-up-viy.yml");
    // `@magnitude`/`@npMagnitude` as `rules/snapshot.mjs#resolveRuleValues`
    // substitutes them on an instance.
    const out = contributions({ name: viy.name, rules: [{ ...viy.rules[0], value: 50, npValue: 20 }] });
    const mag = new Set(["attack:component:mag"]);
    expect(chance(out.checkModifiers, mag)).toBe(100);
    expect(chance(out.checkModifiers, new Set([...mag, "attack:kind:np"]))).toBe(70);
    expect(chance(out.checkModifiers, new Set(["attack:component:str"]))).toBe(50);
  });

  it("reaches an ally through an aura: Area Crit Up", () => {
    const area = content("effects/area-crit-up.yml");
    const aura = { ...area.rules[0], elements: [{ ...area.rules[0].elements[0], value: 20 }] };
    const [delivered] = contributions({ name: area.name, rules: [aura] }).auras[0].elements;
    expect(delivered).toMatchObject({ key: "checkModifier", check: "crit", value: 20 });
    expect(chance([delivered])).toBe(70);
  });
});
