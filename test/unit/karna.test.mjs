/**
 * @file Karna — the clauses that needed engine that did not exist.
 * @see char_orig_sheets/Copia de Karna.md, docs/36-case-remaining.md §36.1
 *
 * Nine of his thirteen abilities were unauthored when this pass started,
 * including both of the two that define him. Each case below is either a clause
 * that could not be written at all before this pass or one that was written and
 * silently wrong.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { collectContributions } from "../../module/rules/elements.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { applyStatDeltas } from "../../module/rules/derived.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { test as testPredicate } from "../../module/rules/predicate.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** @param {string} id @returns {object} */
function ability(id) {
  return parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
}

/** @param {string} id @returns {object} */
function effect(id) {
  return parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));
}

/** Karna's own Parameters, as his sheet prints them. */
const KARNA_PARAMS = {
  str: Rank.of("B"), end: Rank.of("C"), agi: Rank.of("A"), mag: Rank.of("B"), luc: Rank.of("D"),
};

describe("Brahmastra — the 4x/2x fork", () => {
  const branches = ability("karna-brahmastra").damage.branches;

  /**
   * Which branch fires against a defender with these Parameters.
   * @param {Record<string, Rank>} parameters
   * @returns {number} the multiplier
   */
  function branchFor(parameters) {
    const options = rollOptionsFor({
      attacker: { parameters: KARNA_PARAMS },
      defender: { parameters },
      attack: { kind: "np" },
    });
    const match = branches.find((b) => testPredicate(b.predicate, { options }));
    return match?.multiplier ?? null;
  }

  it("deals 4x when every Parameter is equal or lower", () => {
    expect(branchFor({
      str: Rank.of("C"), end: Rank.of("C"), agi: Rank.of("B"), mag: Rank.of("E"), luc: Rank.of("E"),
    })).toBe(4);
  });

  it("deals 4x against an exact match on all five", () => {
    // "Equal OR lower" -- an identical Servant is on the 4x branch.
    expect(branchFor({ ...KARNA_PARAMS })).toBe(4);
  });

  it("drops to 2x on a single higher Parameter", () => {
    // §36.1's own example: Heracles's LUC A against Karna's D, and nothing else
    // needs to beat him.
    expect(branchFor({
      str: Rank.of("E"), end: Rank.of("E"), agi: Rank.of("E"), mag: Rank.of("E"), luc: Rank.of("A"),
    })).toBe(2);
  });

  it("drops to 2x on a + STEP, which the grade ladder could not see", () => {
    // The reason `paramVsSelf` had to exist. `not:target:rank:str:gte:A` is TRUE
    // for a B+ defender, so the old vocabulary would have paid 4x here -- the
    // largest single damage swing any predicate in this game decides.
    expect(branchFor({
      str: Rank.of("B", 1), end: Rank.of("E"), agi: Rank.of("E"), mag: Rank.of("E"), luc: Rank.of("E"),
    })).toBe(2);
  });
});

describe("Kavacha and Kundala", () => {
  const kk = ability("karna-kavacha-and-kundala");

  it("reduces by 90% including NP, and Pierce ignores it", () => {
    const mods = collectContributions([{
      id: "kk", slug: "kavachaAndKundala", rank: "A", active: false,
      rules: [], passiveRules: kk.passiveRules, activeRules: [],
    }]).modifiers;
    const defUp = mods.find((m) => m.key === "defUp");

    expect([defUp.value, defUp.npValue]).toEqual([90, 90]);
    // The clause travels as a DEFERRED predicate, because whether the attack
    // pierces is not knowable when the contribution is collected.
    expect(defUp.predicate).toEqual(["not:attack:pierce"]);
  });

  it("takes 90% off an ordinary attack and nothing off a piercing one", () => {
    const mods = collectContributions([{
      id: "kk", slug: "kavachaAndKundala", rank: "A", active: false,
      rules: [], passiveRules: kk.passiveRules, activeRules: [],
    }]).modifiers;

    /** @param {boolean} pierce @returns {number} */
    const hit = (pierce) => computeDamage({
      attacker: { baseAttack: { str: 1000, mag: 0 }, modifiers: [] },
      defender: { health: 9999, modifiers: mods },
      attack: { kind: "normal", component: "str", pierce },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      rolls: { attackMinus: 0 },
      crit: { isCrit: false },
      options: rollOptionsFor({
        attacker: {}, defender: {}, attack: { kind: "normal", component: "str", pierce },
      }),
    }).total;

    expect(hit(false)).toBe(100);
    expect(hit(true)).toBe(1000);
  });

  it("is negated by the status Vasavi Shakti's activation applies", () => {
    expect(kk.negatedBy).toEqual(["vasaviActivated"]);
    // The DECISION recorded in §36.1: the trailing "?" on the NP Seal clause is
    // in the source, and a question mark is not a statement.
    expect(kk.negatedBy).not.toContain("npSeal");
  });

  it("charges the Master 20 unless a Noble Phantasm already billed them", () => {
    const [handler] = collectContributions([{
      id: "kk", slug: "kavachaAndKundala", rank: "A", active: false,
      rules: [], passiveRules: kk.passiveRules, activeRules: [],
    }]).eventHandlers;

    expect(handler.events).toEqual(["actedTurnEnd"]);
    // Note 2: the NP cost "overwrites" the 20 rather than stacking with it.
    expect(handler.unlessUsedThisTurn).toEqual({ category: "karnaNP" });
    expect(handler.actions[0]).toMatchObject({
      subject: "master", stat: "health.value", amount: 20, direction: "down", floor: 1,
    });
  });
});

describe("Vasavi Shakti — the activation", () => {
  const status = effect("vasavi-activated");
  const contributions = collectContributions([{
    id: "vs", slug: "vasaviActivated", rank: null, active: true,
    fromEffect: true, defId: "vasaviActivated",
    rules: status.rules, passiveRules: [], activeRules: [],
  }]);

  it("raises STR from B to A rather than to B+", () => {
    // `RankShift`'s parameter branch DROPPED `to:` and fell through to
    // `rankShift: 1`, one dense step. "From B to A" would have made him B+.
    const out = applyStatDeltas({ parameters: { str: "B" } }, contributions.statDeltas);
    expect(out.changes["parameters.str"]).toBe("A");
  });

  it("adds 25 to Base Attack (STR)", () => {
    const out = applyStatDeltas(
      { parameters: { str: "B" }, baseAttack: { str: 125, mag: 175 } },
      contributions.statDeltas,
    );
    expect(out.changes["baseAttack.str"]).toBe(150);
  });

  it("counts Divinity grades, so Rank C is +90", () => {
    // The sheet's own worked example, reached by counting grades from E rather
    // than by restating the answer: gte:E + gte:D + gte:C = 3 x 30.
    const flat = (divinity) => {
      const options = rollOptionsFor({
        attacker: {},
        defender: { abilities: [{ id: "d", slug: "divinity", rank: divinity }] },
        attack: { kind: "normal" },
      });
      return contributions.modifiers
        .filter((m) => m.key === "divinity" && testPredicate(m.predicate, { options }))
        .reduce((n, m) => n + m.value, 0);
    };

    expect(flat("C")).toBe(90);
    expect(flat("E")).toBe(30);
    expect(flat("A")).toBe(150);
    expect(flat("EX")).toBe(180);
  });

  it("gives a Divine Unit with no Divinity Skill a flat 100 instead", () => {
    const options = rollOptionsFor({
      attacker: {},
      defender: { attributes: ["divine"], abilities: [] },
      attack: { kind: "normal" },
    });
    const total = contributions.modifiers
      .filter((m) => m.key === "divinity" && testPredicate(m.predicate, { options }))
      .reduce((n, m) => n + m.value, 0);

    expect(total).toBe(100);
  });

  it("charges the Master per Combat PROCESS, not per Phase", () => {
    const upkeep = contributions.eventHandlers.find((h) => h.events.includes("combatProcessEnd"));
    expect(upkeep).toBeDefined();
    expect(upkeep.actions[0]).toMatchObject({ subject: "master", amount: 20, floor: 1 });
  });

  it("replaces Mana Burst's 25% Burn rider rather than adding to it", () => {
    const burn50 = contributions.eventHandlers.find((h) => h.actions.some((a) => a.chance === 50));
    expect(burn50).toBeDefined();

    // The mirror predicate is what makes "instead of" true.
    const manaBurst = ability("karna-mana-burst-flames");
    const rider = manaBurst.passiveRules.find((r) => r.chance === 25);
    expect(rider.predicate).toContain("not:self:effect:vasaviActivated");
  });
});

describe("Vasavi Shakti — the Active", () => {
  const vs = ability("karna-vasavi-shakti");

  it("is free to activate but not free to use", () => {
    // The activation is a separate, non-NP document precisely because `npCost`
    // prices every `isNP` ability and `canUseAbility` refuses it when the
    // Master cannot pay -- so an EX activation would have been gated behind 75
    // Health the sheet says it does not cost.
    const activation = ability("karna-vasavi-shakti-activation");
    expect(activation.isNP).toBeUndefined();
    expect(activation.maxUses).toBe(1);
    expect(vs.isNP).toBe(true);
  });

  it("cannot be used until it has been activated", () => {
    expect(vs.requirements).toContainEqual({
      kind: "predicate", predicate: ["self:effect:vasaviActivated"],
    });
  });

  it("keeps its three anti-Divine tiers mutually exclusive", () => {
    /** @param {object} defender @returns {number[]} */
    const factors = (defender) => {
      const options = rollOptionsFor({ attacker: {}, defender, attack: { kind: "np" } });
      return vs.damage.conditionalMultipliers
        .filter((m) => testPredicate(m.predicate, { options }))
        .map((m) => m.factor);
    };

    expect(factors({ abilities: [{ id: "d", slug: "divinity", rank: "A" }] })).toEqual([3]);
    expect(factors({ abilities: [{ id: "d", slug: "divinity", rank: "C" }] })).toEqual([2]);
    expect(factors({ attributes: ["divine"], abilities: [] })).toEqual([2.5]);
    expect(factors({ abilities: [] })).toEqual([]);
  });

  it("has a minimum Range as well as a maximum", () => {
    // "Range=3 to 4" -- he cannot drop the sun on somebody standing next to him.
    expect(vs.targeting.anchor).toMatchObject({ range: 4, minRange: 3 });
  });
});

describe("Uncrowned Arms Mastership — two states and a third", () => {
  const uam = ability("karna-uncrowned-arms-mastership");

  /** @param {{active?: boolean, charity?: boolean}} state @returns {object[]} */
  function live({ active = false, charity = false }) {
    const options = new Set([
      ...(active ? ["self:skillActive:uncrownedArmsMastership"] : []),
      ...(charity ? ["self:effect:charity"] : []),
    ]);
    return collectContributions([{
      id: "uam", slug: "uncrownedArmsMastership", rank: null, active,
      rules: [], passiveRules: uam.passiveRules, activeRules: [],
    }], { options });
  }

  it("starts on effect 1: +20% Crit Chance", () => {
    const out = live({});
    expect(out.checkModifiers.map((m) => m.value)).toEqual([20]);
    expect(out.modifiers).toEqual([]);
  });

  it("switches to effect 2: +40% Crit Damage", () => {
    const out = live({ active: true });
    expect(out.checkModifiers).toEqual([]);
    expect(out.modifiers.map((m) => m.value)).toEqual([40]);
  });

  it("runs BOTH while Charity is up, in either state", () => {
    // End of Charity: "as long as Karna has this buff, both effects of
    // 'Uncrowned Arms Mastership' are Active." The reason both live in
    // `passiveRules` with predicates rather than split across passive/active:
    // `activeRules` has no way to be true while `active` is false.
    for (const active of [false, true]) {
      const out = live({ active, charity: true });
      expect(out.checkModifiers.map((m) => m.value)).toEqual([20]);
      expect(out.modifiers.map((m) => m.value)).toEqual([40]);
    }
  });

  it("is limited by the Round, because it has no cooldown at all", () => {
    expect(uam.oncePerRound).toBe(true);
    expect(uam.cooldown).toBeUndefined();
  });
});

describe("Mana Burst (Flames)", () => {
  const mb = ability("karna-mana-burst-flames");

  it("combines both Base Attacks: 125 + 175 = 300", () => {
    // docs/06-stats-and-resources.md §6.7 states the number.
    const result = computeDamage({
      attacker: { baseAttack: { str: 125, mag: 175 }, modifiers: [] },
      defender: { health: 9999, modifiers: [] },
      attack: { kind: "attackSkill", component: "str" },
      base: mb.damage.base,
      rolls: { attackMinus: 0 },
      crit: { isCrit: false },
      options: new Set(),
    });
    expect(result.total).toBe(300);
  });

  it("is not affected by Magic Resistance", () => {
    expect(mb.damage.ignoresMagicResistance).toBe(true);
  });

  it("halves Fire damage taken, including from a Noble Phantasm", () => {
    const mods = collectContributions([{
      id: "mb", slug: "manaBurstFlames", rank: "A", active: false,
      rules: [], passiveRules: mb.passiveRules, activeRules: [],
    }]).modifiers;

    /** @param {string|null} element @param {string} kind @returns {number} */
    const taken = (element, kind) => computeDamage({
      attacker: { baseAttack: { str: 400, mag: 0 }, modifiers: [] },
      defender: { health: 9999, modifiers: mods },
      attack: { kind, component: "str", element },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      rolls: { attackMinus: 0 },
      crit: { isCrit: false },
      options: rollOptionsFor({
        attacker: {}, defender: {}, attack: { kind, component: "str", element },
      }),
    }).total;

    expect(taken("fire", "normal")).toBe(200);
    expect(taken("fire", "np")).toBe(200);
    // Not fire: untouched.
    expect(taken(null, "normal")).toBe(400);
    expect(taken("water", "normal")).toBe(400);
  });

  it("makes him immune to the Burn he spreads", () => {
    const out = collectContributions([{
      id: "mb", slug: "manaBurstFlames", rank: "A", active: false,
      rules: [], passiveRules: mb.passiveRules, activeRules: [],
    }]);
    expect(out.immunities).toContain("burn");
  });
});

describe("Fated Rivals of the Mahabharata", () => {
  const fr = ability("karna-fated-rivals");

  it("names Arjuna by content id, the one name a world cannot rename", () => {
    const [compulsion] = collectContributions([{
      id: "fr", slug: "fatedRivals", rank: null, active: false,
      rules: [], passiveRules: fr.passiveRules, activeRules: [],
    }]).compulsions;

    // `targetPredicate`, not `predicate`: a `predicate` is answered at
    // collection time against Karna alone, which would drop the element before
    // any board exists.
    expect(compulsion.targetPredicate).toEqual(["target:contentId:arjuna"]);
    expect(compulsion.within).toBe(2);
  });

  it("matches a unit carrying that content id", () => {
    const options = rollOptionsFor({ attacker: {}, defender: { contentId: "arjuna" } });
    expect(testPredicate(["target:contentId:arjuna"], { options })).toBe(true);

    const other = rollOptionsFor({ attacker: {}, defender: { contentId: "heracles" } });
    expect(testPredicate(["target:contentId:arjuna"], { options: other })).toBe(false);
  });
});

describe("Brahmastra Kundala", () => {
  const bk = ability("karna-brahmastra-kundala");

  it("is Anti-Country, which is a bigger scale tag than Anti-Army", () => {
    expect(bk.npTags).toEqual(["antiCountry"]);
  });

  it("is fenced behind two other clocks", () => {
    expect(bk.requirements).toEqual([
      { kind: "abilityOffCooldown", abilityId: "karna-mana-burst-flames" },
      { kind: "abilityOffCooldown", abilityId: "karna-vasavi-shakti" },
    ]);
  });

  it("puts Mana Burst (Flames) on cooldown when it fires", () => {
    expect(bk.alsoTriggers).toEqual([{ ability: "karna-mana-burst-flames" }]);
  });

  it("inflicts a Def Dwn that is STRONGER against Noble Phantasms", () => {
    // The one in the corpus whose NP magnitude is higher than its normal one --
    // the family's usual direction is the other way, so an omitted `npMagnitude`
    // would have silently applied 30% to Noble Phantasms.
    const defDwn = bk.phases
      .flatMap((p) => p.rules ?? [])
      .find((r) => r.effect?.id === "defDwn");
    expect(defDwn.effect).toMatchObject({ magnitude: 30, npMagnitude: 40 });
  });
});
