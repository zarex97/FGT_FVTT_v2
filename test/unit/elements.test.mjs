/**
 * These tests exist because the content pipeline shipped a working compendium
 * whose rule elements did nothing. Loading Divinity is not the same as Divinity
 * adding +50, and only this layer closes that gap.
 */
import { describe, it, expect } from "vitest";
import { collectContributions, resolveValue, EXECUTORS, handledKeys } from "../../module/rules/elements.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const ability = (over = {}) => ({ id: "a", name: "Ability", rank: null, active: true, ...over });

describe("table-driven values resolve against the owning ability's rank", () => {
  it("turns Divinity A into +50, the value on the sheet", () => {
    const out = collectContributions([
      ability({ name: "Divinity", rank: "A", passiveRules: [{ key: "FlatDamage", table: "divinity", includesNP: true }] }),
    ]);
    expect(out.modifiers).toEqual([
      { key: "divinity", value: 50, component: null, source: "Divinity" },
    ]);
  });

  it("scales with steps, so Divinity B+ is 45 and E− is 5", () => {
    const at = (rank) => collectContributions([
      ability({ name: "Divinity", rank, passiveRules: [{ key: "FlatDamage", table: "divinity" }] }),
    ]).modifiers[0].value;
    expect(at("B+")).toBe(45);
    expect(at("E-")).toBe(5);
  });

  it("resolves a literal when there is no table", () => {
    expect(resolveValue({ value: 30 }, null, {})).toBe(30);
  });

  it("resolves an @-expression against the context", () => {
    expect(resolveValue({ value: "@self.magnitude" }, null, { refs: { self: { magnitude: 40 } } })).toBe(40);
  });

  it("returns null for an unresolvable expression rather than guessing zero", () => {
    expect(resolveValue({ value: "@self.nope" }, null, { refs: { self: {} } })).toBeNull();
  });
});

describe("Magic Resistance", () => {
  const mr = (rank) => collectContributions([
    ability({
      name: "Magic Resistance", rank,
      passiveRules: [{
        key: "Resistance", component: "mag", mode: "rankComparison",
        negatesUpToRank: rank, table: "magicResistancePercent", includesNP: true,
      }],
    }),
  ]).magicResistance;

  it("carries the rank it negates up to and the percentage table value", () => {
    const r = mr("C");
    expect(r.mode).toBe("rank");
    expect(r.rank.toString()).toBe("C");
    expect(r.percent).toBe(30);
  });

  it("makes A+ negate up to A+, not up to A", () => {
    expect(mr("A+").rank.toString()).toBe("A+");
  });

  it("is a distinct field, not a modifier — the pipeline reads it at stage 11", () => {
    const out = collectContributions([
      ability({ name: "Magic Resistance", rank: "B", passiveRules: [{ key: "Resistance", table: "magicResistancePercent" }] }),
    ]);
    expect(out.modifiers).toEqual([]);
    expect(out.magicResistance).not.toBeNull();
  });

  it("dice mode never carries a percentage, because it never negates", () => {
    const out = collectContributions([
      ability({ name: "Proto Gil MR", rank: "C", passiveRules: [{ key: "Resistance", mode: "dice", formula: "3d20", npDiceDoubled: true }] }),
    ]);
    expect(out.magicResistance).toEqual({
      mode: "dice", formula: "3d20", npDiceDoubled: true, source: "Proto Gil MR",
    });
  });
});

describe("active versus passive rules", () => {
  const riding = (active) => collectContributions([
    ability({
      name: "Riding", rank: "A", active,
      passiveRules: [{ key: "GrantedAbility", abilities: ["doubleMove", "ridingAttack"] }],
      activeRules: [{ key: "MovDelta", table: "ridingMov", duration: "this turn", isBuff: false }],
    }),
  ]);

  it("applies passives always", () => {
    expect(riding(false).grantedAbilities).toEqual(["doubleMove", "ridingAttack"]);
  });

  it("applies actives only while the ability is active", () => {
    expect(riding(false).statDeltas).toEqual([]);
    expect(riding(true).statDeltas[0]).toMatchObject({ stat: "mov", value: 5, isBuff: false });
  });

  it("keeps Riding's MOV Up marked as not-a-buff, so buff removal cannot strip it", () => {
    expect(riding(true).statDeltas[0].isBuff).toBe(false);
  });
});

describe("predicates gate contribution entirely", () => {
  it("omits the element rather than contributing zero", () => {
    const el = { key: "FlatDamage", value: 100, predicate: ["target:attribute:divine"] };
    const withIt = collectContributions([ability({ passiveRules: [el] })], {
      options: new Set(["target:attribute:divine"]),
    });
    const without = collectContributions([ability({ passiveRules: [el] })], { options: new Set() });
    expect(withIt.modifiers.length).toBe(1);
    expect(without.modifiers.length).toBe(0);
  });
});

describe("attribute grants", () => {
  it("Divinity grants the divine attribute, which other content keys on", () => {
    const out = collectContributions([
      ability({
        name: "Divinity", rank: "A",
        passiveRules: [
          { key: "FlatDamage", table: "divinity" },
          { key: "StatDelta", stat: "attributes", add: ["divine"] },
        ],
      }),
    ]);
    expect(out.attributes).toEqual(["divine"]);
    // The attribute grant must not also register as a numeric stat change.
    expect(out.statDeltas).toEqual([]);
  });
});

describe("unhandled keys are surfaced, not swallowed", () => {
  it("records the key and its source so the bug is findable", () => {
    const out = collectContributions([ability({ name: "Bad", passiveRules: [{ key: "Nonsense" }] })]);
    expect(out.unhandled).toEqual([{ key: "Nonsense", source: "Bad" }]);
  });

  it("covers every key the content validator accepts", async () => {
    const { RULE_ELEMENT_KEYS } = await import("../../tools/lib/content.mjs");
    const missing = [...RULE_ELEMENT_KEYS].filter((k) => !handledKeys().includes(k));
    expect(missing, `no executor for: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not accept keys the validator would reject", async () => {
    const { RULE_ELEMENT_KEYS } = await import("../../tools/lib/content.mjs");
    const extra = handledKeys().filter((k) => !RULE_ELEMENT_KEYS.has(k));
    expect(extra, `executor exists but validator rejects: ${extra.join(", ")}`).toEqual([]);
  });
});

describe("other executors", () => {
  it("Suppress records what is switched off", () => {
    const out = collectContributions([
      ability({ name: "NP Seal", passiveRules: [{ key: "Suppress", scope: "abilities" }] }),
    ]);
    expect(out.suppressions[0]).toMatchObject({ scope: "abilities", source: "NP Seal" });
  });

  it("AutoSucceed records what beats it", () => {
    const out = collectContributions([
      ability({ name: "Dodge", passiveRules: [{ key: "AutoSucceed", check: "evade", beatenBy: ["aim"] }] }),
    ]);
    expect(out.autoSucceeds[0]).toMatchObject({ check: "evade", beatenBy: ["aim"] });
  });

  it("OnEvent carries its revival spec through", () => {
    const out = collectContributions([
      ability({
        name: "Battle Continuation", rank: "A",
        passiveRules: [{ key: "OnEvent", event: "unitDefeated", revive: { table: "battleContinuationRevive" } }],
      }),
    ]);
    expect(out.eventHandlers[0]).toMatchObject({ event: "unitDefeated" });
    expect(out.eventHandlers[0].revive.table).toBe("battleContinuationRevive");
  });

  it("DamageNegation splits a formula table into formula plus bonus", () => {
    const out = collectContributions([
      ability({
        name: "Battle Continuation", rank: "A+",
        passiveRules: [{ key: "DamageNegation", mode: "dice", table: "battleContinuationReduction", npDiceDoubled: true }],
      }),
    ]);
    // A+ is one step above A, so the table returns {formula, bonus}.
    expect(out.damageNegation[0]).toMatchObject({ mode: "dice", formula: "2d10+20", bonus: 2 });
  });

  it("StatDelta carries a negative literal, as Burn's Base Attack penalty does", () => {
    const out = collectContributions([
      ability({ name: "Burn", passiveRules: [{ key: "StatDelta", stat: "baseAttack.str", value: -30 }] }),
    ]);
    expect(out.statDeltas[0]).toMatchObject({ stat: "baseAttack.str", value: -30 });
  });

  it("has an executor for every key it claims to handle", () => {
    for (const key of handledKeys()) expect(typeof EXECUTORS[key]).toBe("function");
  });
});

/* ========================================================================== */

describe("end to end: authored content reaches the damage pipeline", () => {
  it("Divinity A on the attacker adds 50 at stage 7", () => {
    // This is the assertion that would have failed before elements.mjs existed:
    // the compendium held Divinity, and the pipeline saw nothing.
    const contributions = collectContributions([
      ability({ name: "Divinity", rank: "A", passiveRules: [{ key: "FlatDamage", table: "divinity" }] }),
    ]);

    const unit = (o = {}) => ({
      baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: [],
      health: 1000, shield: 0, magicResistance: null, outsideZon: false, ...o,
    });

    const result = computeDamage({
      attacker: unit({ baseAttack: { str: 100, mag: 0 }, modifiers: contributions.modifiers }),
      defender: unit(),
      board: {},
      attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      multiplier: 1, flatBonus: 0,
      crit: { isCrit: false, chanceUsed: 0 },
      reaction: { kind: "none" }, luckChecks: {}, rolls: {}, options: new Set(),
    });

    expect(result.total).toBe(150);
    const stage7 = result.breakdown.find((s) => s.index === 7);
    expect(stage7.contributors[0]).toMatchObject({ source: "divinity", value: 50 });
  });

  it("Magic Resistance C from content negates a C-rank MAG attack", () => {
    const contributions = collectContributions([
      ability({
        name: "Magic Resistance", rank: "C",
        passiveRules: [{ key: "Resistance", component: "mag", negatesUpToRank: "C", table: "magicResistancePercent" }],
      }),
    ]);

    const unit = (o = {}) => ({
      baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: [],
      health: 1000, shield: 0, magicResistance: null, outsideZon: false, ...o,
    });

    const result = computeDamage({
      attacker: unit({ baseAttack: { str: 0, mag: 200 } }),
      defender: unit({ magicResistance: contributions.magicResistance }),
      board: {},
      attack: { kind: "np", rank: Rank.parse("C"), categorizedAsNP: false, element: null },
      base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
      multiplier: 1, flatBonus: 0,
      crit: { isCrit: false, chanceUsed: 0 },
      reaction: { kind: "none" }, luckChecks: {}, rolls: {}, options: new Set(),
    });

    expect(result.total).toBe(0);
    expect(result.flags.negatedBy).toBe("Magic Resistance");
  });
});

/* ========================================================================== */

describe("EffectRegistry", () => {
  const docs = [
    { name: "Burn", system: { contentId: "burn", polarity: "debuff", volatility: "volatile", stacking: "noneNoRefresh", defaultDuration: "2◈" } },
    { name: "Atk Up", system: { contentId: "atkUp", polarity: "buff", stacking: "magnitudeStacks" } },
    // Same pack, but a class-skill template rather than an effect definition.
    { name: "Magic Resistance", system: { contentId: "class-magic-resistance", parameterized: ["rank"] } },
  ];

  it("registers only documents that declare a polarity", () => {
    expect(EffectRegistry.load(docs)).toBe(2);
    expect(EffectRegistry.has("burn")).toBe(true);
    expect(EffectRegistry.has("class-magic-resistance")).toBe(false);
  });

  it("preserves the fields the applier needs", () => {
    EffectRegistry.load(docs);
    expect(EffectRegistry.get("burn")).toMatchObject({
      id: "burn", polarity: "debuff", volatility: "volatile",
      stacking: "noneNoRefresh", defaultDuration: "2◈", baseChance: 100,
    });
  });

  it("returns null for an unknown id rather than throwing", () => {
    EffectRegistry.load(docs);
    expect(EffectRegistry.get("nonsense")).toBeNull();
  });

  it("catches a cross-reference to an effect that is not registered", () => {
    EffectRegistry.load([
      { name: "Charm", system: { contentId: "charm", polarity: "debuff", blockedBy: ["berserk"] } },
    ]);
    expect(EffectRegistry.validate().errors[0]).toMatch(/blockedBy references unknown effect "berserk"/);
  });

  it("warns on a one-sided exclusion", () => {
    EffectRegistry.load([
      { name: "Charm", system: { contentId: "charm", polarity: "debuff", blockedBy: ["berserk"] } },
      { name: "Berserk", system: { contentId: "berserk", polarity: "debuff" } },
    ]);
    const { errors, warnings } = EffectRegistry.validate();
    expect(errors).toEqual([]);
    expect(warnings[0]).toMatch(/not reciprocated/);
  });

  it("clears on reload rather than accumulating across worlds", () => {
    EffectRegistry.load(docs);
    EffectRegistry.load([]);
    expect(EffectRegistry.size).toBe(0);
  });
});
