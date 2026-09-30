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
import { applyEffect } from "../../module/engine/effect-applier.mjs";

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

// Penthesilea's Charisma, active: *"all damage dealt by allied Units within a
// 2 panel area of herself is increased by 20%; if NP, 10%."*
describe("Aura", () => {
  it("carries npValue: Atk Up (Charisma) is 20% to a Normal Attack, 10% to an NP", () => {
    const charisma = content("effects/atk-up-charisma.yml");
    const aura = { ...charisma.rules[0], value: 20, npValue: 10 };
    const [delivered] = contributions({ name: charisma.name, rules: [aura] }).auras;
    expect(delivered).toMatchObject({ key: "atkUp", value: 20, npValue: 10 });
    const bonus = (kind) => hit([{ ...delivered, predicate: null }], { kind }).total / hit([], { kind }).total;
    expect(bonus("normal")).toBeCloseTo(1.2);
    expect(bonus("np")).toBeCloseTo(1.1);
  });
});

// Appendix A: *"Cannot be inflicted with debuffs. Does not affect Instakill,
// Death or Erase."* The file said so in `scope` and `except`, the executor
// read neither, and the applier gated on the held effect's id instead -- so
// the file's list of exceptions was decoration.
describe("Immunity", () => {
  const immune = (except) => {
    const file = content("effects/debuff-immune.yml");
    const rule = except ? { ...file.rules[0], except } : file.rules[0];
    return contributions({ name: file.name, rules: [rule] }).immunities;
  };
  const land = (def, immunities) => applyEffect({
    def: { stacking: "noneRefresh", baseChance: 100, ...def },
    target: { id: "t", effects: [], effectInstances: [], immunities },
    source: {},
    ctx: { turnsPerRound: 3, currentTick: 0, roll: 1, options: new Set() },
  }).outcome;

  it("blocks a debuff, from the rule alone", () => {
    expect(land({ id: "poison", polarity: "debuff", volatility: "volatile" }, immune())).toBe("blocked");
  });

  it("leaves the exceptions it names: Instakill lands", () => {
    expect(land({ id: "instakill", polarity: "debuff", volatility: "terminal" }, immune())).toBe("applied");
  });

  it("reads the exceptions from the file: an Instakill it does not except is blocked", () => {
    expect(land({ id: "instakill", polarity: "debuff", volatility: "terminal" }, immune(["death"]))).toBe("blocked");
  });

  it("does not touch a buff", () => {
    expect(land({ id: "atkUp", polarity: "buff", stacking: "magnitudeStacks" }, immune())).toBe("applied");
  });
});

// Normal Presence Concealment, Hidden Strike: *"Attacks performed by Assassin
// while Presence Concealment is Active cannot be Blocked or Countered."* The
// rungs are taken from the Assassin's TARGET. `direction: incoming` is the
// same convention as the Evade +4 beside it: a clause on what is done against
// this unit's attacks. Unread, the executor forbade the Assassin's OWN Block
// and Counter, and left his targets theirs.
describe("ForbidReaction", () => {
  const pc = () => {
    const file = content("effects/normal-presence-concealment-effect.yml");
    return contributions({ name: file.name, rules: file.rules.filter((r) => r.key === "ForbidReaction") });
  };

  it("takes Block and Counter from whoever this unit attacks", () => {
    expect(pc().refusesReactions).toEqual(["block", "counter"]);
  });

  it("leaves the Assassin's own reactions alone", () => {
    expect(pc().forbiddenReactions).toEqual([]);
  });

  it("still forbids the bearer's own rung when no direction is given: Invuln cannot Block", () => {
    const invuln = content("effects/invuln.yml");
    const out = contributions({ name: invuln.name, rules: invuln.rules.filter((r) => r.key === "ForbidReaction") });
    expect(out.forbiddenReactions).toEqual(["block"]);
    expect(out.refusesReactions).toEqual([]);
  });
});

// Mad Enhancement: *"MOV is increased by 2, Range is increased by 1 ... The
// effects of Mad Enhancement are neither a buff or a debuff."* Its MOV and
// Range deltas both say `isBuff: false`, and only the MOV one kept it.
describe("RangeDelta", () => {
  it("carries isBuff, as StatDelta and MovDelta do: Mad Enhancement's Range +1 is not a buff", () => {
    const skill = content("class-skills/mad-enhancement.yml");
    const deltas = skill.activeRules.filter((r) => r.key === "MovDelta" || r.key === "RangeDelta");
    const out = contributions({ name: skill.name, rank: "B", activeRules: deltas });
    expect(out.statDeltas.map((d) => [d.stat, d.value, d.isBuff])).toEqual([["mov", 2, false], ["range.panels", 1, false]]);
  });

  it("is a buff unless it says otherwise", () => {
    expect(contributions({ name: "Range Up", rules: [{ key: "RangeDelta", value: 1 }] }).statDeltas[0].isBuff).toBe(true);
  });
});

// Kingprotea's Huge Scale: *"Max and current Health is increased by 20% of
// Kingprotea's ORIGINAL Max Health"* per Proliferation stock. The survival test
// listed `perStack.effect` as unread, and it is not: the magnitude is an `@`
// expression, and `stackScaled` reads the stack only once that resolves to a
// number, which it cannot without a Unit's refs. The test's exemption knew
// that for an expression that STARTS with `@`, and this one starts with `0.2`.
describe("MaxDelta", () => {
  it("scales per stock: 0, 200, 600 for 0, 1 and 3 stocks at a base of 1000", () => {
    const skill = content("abilities/kingprotea-huge-scale.yml");
    const el = skill.passiveRules.find((r) => r.key === "MaxDelta");
    const at = (n) => contributions(
      { name: skill.name, passiveRules: [el] },
      { stacks: { proliferationStock: n }, refs: { self: { baseHealth: 1000 } } },
    ).statDeltas[0].value;
    expect([at(0), at(1), at(3)]).toEqual([0, 200, 600]);
  });
});

// Castor's Avenger B: *"All damage taken by Castor is increased by 80
// including NP."* The file said `mode: flat`, a key DamageModifier does not
// have: its bucket is `modifierKey: avenger`, which stage 11 reads as a flat
// addition to damage taken. The executor spells the percent/flat choice
// `stage`, and only asks when there is no `modifierKey`.
describe("DamageModifier", () => {
  const avenger = () => {
    const skill = content("class-skills/avenger.yml");
    return contributions({ name: skill.name, rank: "B", passiveRules: [skill.passiveRules[0]] }).modifiers[0];
  };
  const taken = (modifiers) => computeDamage({
    attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [], effects: [] },
    defender: { id: "d", health: 9999, modifiers, effects: [] },
    attack: { kind: "normal", component: "str" },
    base: { fixedValue: 200 },
    rolls: { attackMinus: 0 },
    crit: { isCrit: false },
    options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
  }).total;

  it("adds Avenger B's 80 to every hit Castor takes", () => {
    expect(avenger()).toMatchObject({ key: "avenger", value: 80 });
    expect(taken([avenger()]) - taken([])).toBe(80);
  });

  it("is authored without a key the executor does not read", () => {
    expect(content("class-skills/avenger.yml").passiveRules[0].mode).toBeUndefined();
  });
});
