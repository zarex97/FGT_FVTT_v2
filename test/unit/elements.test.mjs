/**
 * These tests exist because the content pipeline shipped a working compendium
 * whose rule elements did nothing. Loading Divinity is not the same as Divinity
 * adding +50, and only this layer closes that gap.
 */
import { describe, it, expect } from "vitest";
import { collectContributions, resolveValue, EXECUTORS, handledKeys , deferredPredicate} from "../../module/rules/elements.mjs";
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
      // `predicate: null` means "collection answered it" -- as opposed to a
      // deferred clause, which travels to the damage pipeline.
      { key: "divinity", value: 50, component: null, predicate: null, source: "Divinity" },
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
  it("omits the element rather than contributing zero, for a clause it can answer", () => {
    // A `self:` clause is about the owner, and collection has the owner.
    const el = { key: "FlatDamage", value: 100, predicate: ["self:effect:blessed"] };
    const withIt = collectContributions([ability({ passiveRules: [el] })], {
      options: new Set(["self:effect:blessed"]),
    });
    const without = collectContributions([ability({ passiveRules: [el] })], { options: new Set() });

    expect(withIt.modifiers.length).toBe(1);
    expect(without.modifiers.length).toBe(0);
  });

  it("DEFERS a clause about the target, rather than answering it as false", () => {
    // Collection runs per unit with only that unit's options in scope: there is
    // no target and no attack yet. Testing `target:attribute:divine` here
    // answered "false" and dropped the element for ever -- which is why
    // Scáthach's God Slayer added nothing against a Divine Unit, Penthesilea's
    // Goddess of War never fired on a Normal Attack, and `NP DmUp` raised no
    // Noble Phantasm's damage. Three shipped abilities, one line.
    const el = { key: "FlatDamage", value: 100, predicate: ["target:attribute:divine"] };
    const out = collectContributions([ability({ passiveRules: [el] })], { options: new Set() });

    expect(out.modifiers).toHaveLength(1);
    expect(out.modifiers[0].predicate).toEqual(["target:attribute:divine"]);
  });

  it("defers a clause about the attack too", () => {
    const el = { key: "DamageModifier", modifierKey: "npDmUp", value: 30, predicate: ["attack:kind:np"] };
    const out = collectContributions([ability({ passiveRules: [el] })], { options: new Set() });

    expect(out.modifiers[0].predicate).toEqual(["attack:kind:np"]);
  });

  it("defers the WHOLE clause when any part of it is deferred", () => {
    // A predicate is an implicit AND, so deferring all of it is equivalent to
    // splitting it -- the pipeline has the owner's options too -- and splitting
    // would need the two halves kept in step through every executor.
    const el = {
      key: "DamageModifier", value: 25,
      predicate: ["self:effect:blessed", "target:attribute:divine"],
    };
    const out = collectContributions([ability({ passiveRules: [el] })], { options: new Set() });

    expect(out.modifiers[0].predicate).toHaveLength(2);
  });

  it("marks a self-only clause as answered, so the pipeline does not re-test it", () => {
    const el = { key: "DamageModifier", value: 25, predicate: ["self:effect:blessed"] };
    const out = collectContributions([ability({ passiveRules: [el] })], {
      options: new Set(["self:effect:blessed"]),
    });

    expect(out.modifiers[0].predicate).toBe(null);
  });

  it("DEFERS self:inHomeBase and self:onPlatform:, rather than answering them as false", () => {
    // `contributionsOf` (rules/snapshot.mjs) collects with a board-blind,
    // actor-only options set -- `inHomeBase` and `platformContentId` are board
    // annotations `annotateEnvironment`/`annotatePlatforms` stamp on later, in
    // `snapshotBoard`. Answering these here as false silently dropped Medea's
    // and Semiramis's OWN Territory Creation bonus ("all damage dealt by it is
    // increased") -- the recipient-side aura half kept working because it is
    // tested later, against the annotated board, which is why only half of
    // Territory Creation ever looked broken.
    const home = { key: "DamageModifier", value: 100, predicate: ["self:inHomeBase"] };
    const platform = {
      key: "DamageModifier", value: 200,
      predicate: ["self:variant:dsc", "self:onPlatform:hanging-gardens-of-babylon"],
    };
    const out = collectContributions(
      [ability({ passiveRules: [home, platform] })],
      { options: new Set() },
    );

    expect(out.modifiers).toHaveLength(2);
    expect(out.modifiers[0].predicate).toEqual(["self:inHomeBase"]);
    expect(out.modifiers[1].predicate).toEqual([
      "self:variant:dsc", "self:onPlatform:hanging-gardens-of-babylon",
    ]);
  });
});

describe("deferredPredicate", () => {
  it("answers null for a clause collection can settle", () => {
    expect(deferredPredicate(["self:attribute:female"])).toBe(null);
    expect(deferredPredicate(null)).toBe(null);
    expect(deferredPredicate([])).toBe(null);
  });

  it("looks inside operators, not only at bare strings", () => {
    // God Slayer's own predicate is an `anyOf`, and a scan that only saw
    // top-level strings would have called it answerable and dropped it.
    expect(deferredPredicate([{ anyOf: ["target:attribute:undead", "target:attribute:divine"] }]))
      .toBeTruthy();
    expect(deferredPredicate([{ not: "attack:isAoE" }])).toBeTruthy();
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

  it("OnEvent desugars its revival spec into a dispatchable action", () => {
    const out = collectContributions([
      ability({
        name: "Battle Continuation", rank: "A",
        passiveRules: [{ key: "OnEvent", event: "unitDefeated", revive: { table: "battleContinuationRevive" } }],
      }),
    ]);
    // The handler must arrive at the scheduler already resolved: rank is in
    // scope here and nowhere downstream, so `5d20` is settled now or never.
    expect(out.eventHandlers[0]).toMatchObject({
      events: ["unitDefeated"],
      actions: [{ kind: "Revive", roll: { key: "battleContinuationRevive", formula: "5d20", bonus: 0 } }],
    });
  });

  it("OnEvent normalizes a single event into the one-element list", () => {
    const out = collectContributions([
      ability({ passiveRules: [{ key: "OnEvent", event: "turnEnd", then: [] }] }),
    ]);
    expect(out.eventHandlers[0].events).toEqual(["turnEnd"]);
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

describe("a RankShift aimed at another ability", () => {
  const divinity = (rank) => ability({
    id: "div", name: "Divinity", slug: "divinity", rank,
    passiveRules: [{ key: "FlatDamage", table: "divinity", includesNP: true }],
  });
  const goddessOfWar = (predicate) => ability({
    id: "gow", name: "Goddess of War", rank: "A",
    passiveRules: [{ key: "RankShift", ability: "divinity", to: "A", ...(predicate ? { predicate } : {}) }],
  });

  it("raises the table lookup the shifted ability performs", () => {
    // "Penthesilea's Divinity Rank is increased from B to A" — the one clause
    // of hers that had nowhere to live. Divinity B is +40 and A is +50, and
    // the shift is what moves the lookup.
    expect(collectContributions([divinity("B")]).modifiers[0].value).toBe(40);
    expect(collectContributions([divinity("B"), goddessOfWar()]).modifiers[0].value).toBe(50);
  });

  it("names the destination rather than counting steps across a grade", () => {
    // `B` to `A` is five positions on the dense ladder (`B+`, `B++`, `A--`,
    // `A-`, `A`). Making an author count them is how the clause gets written
    // wrong; `to: A` is what the sheet says.
    const stepped = ability({
      id: "s", name: "Stepped", passiveRules: [{ key: "RankShift", ability: "divinity", steps: 5 }],
    });
    expect(collectContributions([divinity("B"), stepped]).modifiers[0].value).toBe(50);
  });

  it("honours the shift's own predicate", () => {
    // Goddess of War is "only active when Mad Enhancement is deactivated", so
    // the rank goes back to B while she is raging.
    const gated = [divinity("B"), goddessOfWar(["not:self:skillActive:madEnhancement"])];

    expect(collectContributions(gated, { options: new Set() }).modifiers[0].value).toBe(50);
    expect(collectContributions(gated, {
      options: new Set(["self:skillActive:madEnhancement"]),
    }).modifiers[0].value).toBe(40);
  });

  it("never lowers a rank", () => {
    // Every such clause in the source is a grant. A Divinity already at A+
    // does not drop to A because something offers it A.
    expect(collectContributions([divinity("A+"), goddessOfWar()]).modifiers[0].value).toBe(55);
  });

  it("leaves a parameter RankShift alone", () => {
    const out = collectContributions([ability({
      passiveRules: [{ key: "RankShift", parameter: "str", steps: 1 }],
    })]);
    expect(out.statDeltas[0]).toMatchObject({ stat: "parameters.str", rankShift: 1 });
    expect(out.abilityRankShifts).toEqual([]);
  });

  it("carries a parameter RankShift's `grades` through instead of defaulting to steps", () => {
    // The Hanging Gardens' owner buff: "STR: E to D... one Rank" is a whole
    // grade, not the default `steps: 1` this branch used to fall back to
    // regardless of what was authored.
    const out = collectContributions([ability({
      passiveRules: [{ key: "RankShift", parameter: "str", grades: 1 }],
    })]);
    expect(out.statDeltas[0]).toMatchObject({ stat: "parameters.str", rankGrades: 1 });
    expect(out.statDeltas[0].rankShift).toBeUndefined();
  });
});

describe("an event handler gated on the attack", () => {
  it("carries the clause through to the handler instead of dropping it", () => {
    // Found live. `collectContributions` classifies an `attack:`-scoped
    // predicate as DEFERRED and hands it to the executor; `OnEvent` ignored the
    // argument, so the clause vanished and the handler fired unconditionally.
    // EMIYA's Kanshou & Bakuya is "at a Range of 2 or lower" and it projected
    // the swords at every distance — twice, once per range clause.
    const el = {
      key: "OnEvent",
      event: "attackDeclared",
      predicate: ["attack:kind:normal", "attack:range:lte:2"],
      then: [{ key: "ApplyEffect", effect: { id: "dualWieldGuard" } }],
    };
    const out = collectContributions([{ id: "kb", rank: null, active: true, name: "Kanshou & Bakuya", passiveRules: [el] }]);

    expect(out.eventHandlers).toHaveLength(1);
    expect(out.eventHandlers[0].targetPredicate).toEqual(["attack:kind:normal", "attack:range:lte:2"]);
  });

  it("keeps an authored targetPredicate as well, as a conjunction", () => {
    const el = {
      key: "OnEvent",
      event: "damageStepEnd",
      predicate: ["attack:kind:np"],
      targetPredicate: ["target:attribute:divine"],
      then: [],
    };
    const out = collectContributions([{ id: "a", name: "A", rank: null, active: true, passiveRules: [el] }]);

    expect(out.eventHandlers[0].targetPredicate)
      .toEqual(["target:attribute:divine", "attack:kind:np"]);
  });

  it("still answers a self-only clause at collection time", () => {
    // Unlimited Blade Works gains Aria unless Silenced — a question about its
    // own bearer, so it is settled here and never reaches the handler.
    const el = {
      key: "OnEvent", event: "combatPhaseEnd",
      predicate: [{ not: "self:effect:silence" }], then: [],
    };
    const silenced = collectContributions(
      [{ id: "u", name: "UBW", rank: null, active: true, passiveRules: [el] }],
      { options: new Set(["self:effect:silence"]) },
    );
    expect(silenced.eventHandlers).toHaveLength(0);
    expect(collectContributions([{ id: "u", name: "UBW", rank: null, active: true, passiveRules: [el] }]).eventHandlers).toHaveLength(1);
  });

  it("carries excludeCategory/excludeContentId through (Ch. 32, HGoB Construction source 5)", () => {
    // "A non-Spell Skill used, EXCLUDING Item Construction" -- two exclusions
    // `ofCategory`'s include-list cannot express together.
    const el = {
      key: "OnEvent", event: "abilityUsed",
      excludeCategory: "spell", excludeContentId: "semiramis-item-construction",
      then: [{ key: "ResourceDelta", resource: "hgobConstruction", delta: 2 }],
    };
    const out = collectContributions([{ id: "u", name: "U", rank: null, active: true, passiveRules: [el] }]);

    expect(out.eventHandlers[0].excludeCategory).toEqual(["spell"]);
    expect(out.eventHandlers[0].excludeContentId).toEqual(["semiramis-item-construction"]);
  });
});
