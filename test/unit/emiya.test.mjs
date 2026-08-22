/**
 * @file EMIYA's kit, held against his sheet.
 * @see char_orig_sheets/Copia de EMIYA.md, packs/_source/servants/emiya.yml
 *
 * Not a re-test of the engine: a check that each clause on the sheet is
 * *expressed* somewhere the engine reads, which is the failure this codebase
 * keeps meeting. Every assertion below names the sentence it comes from.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { REQUIREMENT_KINDS } from "../../module/rules/items.mjs";
import { classifyAbility, needsTargeting, countsAsAttack } from "../../module/rules/ability-use.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { critChance, checkPlan, mergePlans } from "../../module/rules/checks.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";

/** @param {string} name */
const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));
/** @param {string} name */
const effect = (name) => parse(readFileSync(`packs/_source/effects/${name}.yml`, "utf8"));

const emiya = parse(readFileSync("packs/_source/servants/emiya.yml", "utf8"));

/** An ability document as an Item-shaped object, for the classifiers. */
const asItem = (doc) => ({
  id: doc.id,
  type: doc.isNP ? "noblePhantasm" : "ability",
  system: { ...doc, targeting: doc.targeting ?? null, phases: doc.phases ?? [] },
});

describe("the sheet's stat block", () => {
  it("matches, including the two Base Attacks", () => {
    expect(emiya.parameters).toEqual({ str: "D", end: "C", agi: "C", mag: "B", luc: "E" });
    expect(emiya.baseHealth).toBe(1000);
    expect(emiya.mov).toBe(4);
    expect(emiya.range).toEqual({ panels: 4, targets: 1 });
    expect(emiya.baseAttack).toEqual({ str: 75, mag: 175 });
    expect(emiya.sustainability).toBe("7◈");
  });

  it("carries the Aria pool at the size Unlimited Blade Works spends", () => {
    // "Can only be used by consuming 6 Aria" and "maximum number of Aria stored
    // is 6" — the pool holds exactly one activation, which is what makes the
    // gain rate the real cost.
    expect(emiya.resources.aria).toEqual({ value: 0, max: 6 });
    const gate = ability("emiya-unlimited-blade-works").requirements
      .find((r) => r.kind === "resourceAtLeast");
    expect(gate).toMatchObject({ key: "aria", amount: 6 });
  });
});

describe("the range-banded Normal Attack", () => {
  it("is authored as one, with the MAG fifth and the Magic Resistance exemption", () => {
    const band = emiya.normalAttack.bands[0];
    expect(emiya.normalAttack.mode).toBe("rangeBanded");
    expect(band.from).toBe(3);
    expect(band.ignoresMagicResistance).toBe(true);
    expect(band.sources).toEqual([
      { component: "str", factor: 1 },
      { component: "mag", factor: 0.2 },
    ]);
  });
});

describe("Clairvoyance", () => {
  const clairvoyance = ability("emiya-clairvoyance");

  it("forces the table on the DEFENDER, not on EMIYA", () => {
    // "The DU has an 80% chance of using Evade-". A contribution on his sheet
    // that lands on somebody else's roll — the only one in the reference set.
    const el = clairvoyance.passiveRules[0];
    expect(el).toMatchObject({
      key: "TableOverride", check: "evade", forceTable: "unfavourable",
      direction: "imposed", chance: 80,
    });
  });

  it("only reaches an attacker's own Evade when merged as `imposed`", () => {
    // The half that makes it not a self-inflicted penalty: his own Evade must
    // be untouched by it.
    const carrier = { checkModifiers: [{
      check: "evade", forceTable: "unfavourable", direction: "imposed", chance: 100, source: "Clairvoyance",
    }] };

    expect(checkPlan(carrier, "evade").forceTable).toBe(null);
    expect(checkPlan(carrier, "evade", { direction: "imposed" }).forceTable).toBe("unfavourable");
    expect(mergePlans(checkPlan({}, "evade"), checkPlan(carrier, "evade", { direction: "imposed" })).forceTable)
      .toBe("unfavourable");
  });

  it("is a Normal Attack at 3 or more, and nothing else", () => {
    expect(clairvoyance.passiveRules[0].predicate).toEqual(["attack:kind:normal", "attack:range:gte:3"]);
  });
});

describe("Hawkeye", () => {
  it("grants crit buffs that only pay out at Range 3 or higher", () => {
    // A plain Crit Up would raise his crit rate in melee, where the sheet gives
    // him nothing at all.
    const applied = ability("emiya-hawkeye").phases[0].effects.map((e) => e.id);
    expect(applied).toEqual(["critUpHawkeye", "critDmUpHawkeye"]);

    const held = {
      checkModifiers: collectContributions([{
        id: "e", name: "Crit Up (Hawkeye)", active: true,
        rules: effect("crit-up-hawkeye").rules.map((r) => ({ ...r, value: 50 })),
      }]).checkModifiers,
    };

    const far = rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal", range: 3 } });
    const near = rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal", range: 2 } });

    expect(critChance(held, null, { options: far }).percent).toBe(100);
    expect(critChance(held, null, { options: near }).percent).toBe(50);
  });
});

describe("Eye of the Mind (True), at two Ranks", () => {
  const b = ability("emiya-eye-of-the-mind-true");
  const ex = ability("emiya-eye-of-the-mind-true-ex");

  it("partitions the Health bar, so exactly one form is ever offered", () => {
    expect(b.requirements).toContainEqual({ kind: "healthAbove", fraction: 0.2 });
    expect(ex.requirements).toContainEqual({ kind: "healthBelow", fraction: 0.2 });
  });

  it("shares one clock, because it is one Skill", () => {
    expect(b.exclusionSet).toBe("eyeOfTheMind");
    expect(ex.exclusionSet).toBe("eyeOfTheMind");
    expect(b.alsoTriggers).toContainEqual({ exclusionSet: "eyeOfTheMind" });
    expect(ex.alsoTriggers).toContainEqual({ exclusionSet: "eyeOfTheMind" });
  });

  it("both pay out on a successful Evade", () => {
    // "Upon a successful Evade, reduce the Cooldown of this Skill by ⅓◈."
    for (const doc of [b, ex]) {
      const handler = doc.passiveRules.find((r) => r.event === "evadeSucceeded");
      expect(handler.then).toEqual([{ key: "CooldownDelta", ticks: "⅓◈" }]);
    }
  });

  it("is a reaction at B and both a reaction and an action at EX", () => {
    expect([b.timing.window].flat()).toEqual(["whenAttacked"]);
    expect([ex.timing.window].flat()).toEqual(["ownTurn", "whenAttacked"]);
  });

  it("reaches EMIYA's neighbours with its own targeting, not the Skill's", () => {
    // The clause that needed a phase to carry a target spec: on a reaction,
    // `reuse` resolves to whoever just attacked him.
    const aura = ex.phases.find((p) => p.targeting);
    expect(aura.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(aura.effects[0].id).toBe("sCritUp");
  });
});

describe("the two projected Noble Phantasms", () => {
  const caladbolg = ability("emiya-caladbolg");
  const hrunting = ability("emiya-hrunting");

  it("exclude each other by ROUND, which a Turn cannot express", () => {
    // He acts three times a Round, so a same-Turn exclusion would forbid only
    // something he cannot do anyway. Declared on both sides.
    expect(caladbolg.sameRoundExclusive).toEqual(["emiya-hrunting"]);
    expect(hrunting.sameRoundExclusive).toEqual(["emiya-caladbolg"]);
  });

  it("Caladbolg II pierces only the panel it was aimed at", () => {
    expect(caladbolg.damage).toMatchObject({ multiplier: 4, component: "mag", pierce: true, pierceOn: "primary" });
    expect(caladbolg.targeting.limits.casterOutsideArea).toBe(true);
    expect(caladbolg.targeting.shape).toEqual({ kind: "square", size: 3 });
    // Range 4 + 2 for the Combat Process.
    expect(caladbolg.targeting.anchor.range).toBe(6);
  });

  it("Hrunting aims, bypasses Magic Resistance, and refuses point blank", () => {
    expect(hrunting.damage).toMatchObject({ multiplier: 4, component: "mag", aim: true, ignoresMagicResistance: true });
    // Range 4 + 3, and "cannot be used on a Unit directly next to EMIYA".
    expect(hrunting.targeting.anchor).toMatchObject({ range: 7, minRange: 2 });
  });
});

describe("Kanshou & Bakuya", () => {
  const kb = ability("emiya-kanshou-and-bakuya");

  it("is a passive NP: no button, no targeting, no Attack spent", () => {
    const item = asItem(kb);
    expect(classifyAbility(item).kind).toBe("passive");
    expect(needsTargeting(item)).toBe(false);
    expect(countsAsAttack(item)).toBe(false);
  });

  it("switches off entirely while Overedge is on Cooldown", () => {
    expect(kb.negatedWhile).toEqual({ abilityOnCooldown: ["emiya-overedge"] });
  });

  it("reaches 2 panels on its own", () => {
    expect(kb.passiveRules.map((r) => r.predicate))
      .toEqual([["attack:kind:normal", "attack:range:lte:2"]]);
  });

  it("is extended to 3 by OVEREDGE, which is the only place it can be", () => {
    // The two sentences on the sheet cancel if both are read from Kanshou &
    // Bakuya: using Overedge is what starts the Cooldown that negates it, so
    // the document would switch itself off before the swing it was extending.
    // Found live — Overedge projected nothing at all.
    const grant = ability("emiya-overedge").passiveRules
      .find((r) => r.event === "attackDeclared");
    expect(grant.predicate).toEqual(["attack:kind:attackSkill", "attack:range:lte:3"]);
    expect(grant.then[0].effect.id).toBe("dualWieldGuard");
  });
});

describe("Overedge", () => {
  const overedge = ability("emiya-overedge");

  it("swings twice and is categorized as a Noble Phantasm without being one", () => {
    expect(overedge.damage.repeat).toBe(2);
    expect(overedge.categorizedAsNP).toBe(true);
    expect(overedge.isNP).toBeUndefined();
    // "Counts as EMIYA's Attack for the Turn."
    expect(countsAsAttack(asItem(overedge))).toBe(true);
  });
});

describe("Trace, On", () => {
  const trace = ability("emiya-trace-on");

  it("charges 5% of maximum Health from the second use onwards", () => {
    const cost = trace.phases.find((p) => p.afterFirstUse);
    expect(cost.changes[0]).toMatchObject({ stat: "health", percentOfMax: -5, floor: 1 });
  });

  it("asks which circuits, rather than picking one", () => {
    const choice = trace.phases.find((p) => p.kind === "choose");
    expect(choice.options.map((o) => o.id)).toEqual(["activatedCircuits", "blazingCircuits"]);
    expect(choice.count).toBe(1);
  });

  it("cannot leave him holding both, and can still be swapped", () => {
    // The sheet says both things at once: "EMIYA cannot have both the AC and BC
    // effects at the same time" AND "you can choose to swap from AC to BC or
    // vice-versa". `blocks` can only say the first, by refusing the swap.
    expect(effect("activated-circuits").replaces).toEqual(["blazingCircuits"]);
    expect(effect("blazing-circuits").replaces).toEqual(["activatedCircuits"]);
    expect(effect("activated-circuits").blocks).toBeUndefined();
  });

  it("takes the circuits with it when its buff goes", () => {
    // "When Atk Up (Trace) is removed from EMIYA, remove the AC effect from him
    // as well." The one thing that can remove an Unremovable effect.
    expect(effect("atk-up-trace").onRemove.map((a) => a.effect))
      .toEqual(["activatedCircuits", "blazingCircuits"]);
  });

  it("extends rather than stacking, and lengthens on a Thaumaturgy use", () => {
    const buff = effect("atk-up-trace");
    expect(buff.stacking).toBe("noneExtend");
    const extend = buff.rules.find((r) => r.event === "abilityUsed");
    expect(extend.ofCategory).toEqual(["thaumaturgy", "projection"]);
    expect(extend.then[0]).toMatchObject({ key: "ExtendEffect", ticks: "⅓◈" });
  });
});

describe("Rho Aias", () => {
  const rho = ability("emiya-rho-aias");

  it("is offered to a third party, against Noble Phantasms, within 3 panels", () => {
    expect(rho.timing).toEqual({ window: "whenAllyAttacked", againstKind: "np", radius: 3 });
  });

  it("carries the pool, the owner's share and both floors", () => {
    expect(rho.shield).toMatchObject({
      health: 1400,
      ownerLoss: { per: 200, amount: 100 },
      ownerFloor: 1,
      poolFloor: 1,
    });
    expect(rho.shield.poolFloorWhen).toEqual(["attack:thrownWeapon"]);
  });

  it("decays rather than refilling", () => {
    // "Restored by half of its CURRENT Health" — 1400, then 700+350, then less.
    // A refill to maximum would leave the cooldown as its only limit.
    expect(rho.shield.refresh).toEqual({ kind: "halfOfCurrent", afterFirstUse: true });
  });

  it("gates on recovery as well as on the clock", () => {
    expect(rho.requirements).toContainEqual({ kind: "healthRestoredSince", fraction: 0.5 });
    expect(rho.cooldown).toBe("8◈");
  });

  it("charges his Master as an EX Rank NP despite having no Rank", () => {
    expect(rho.additionalCosts[0]).toMatchObject({ kind: "masterHealthByNPRank", rank: "EX" });
  });
});

describe("Unlimited Blade Works", () => {
  const ubw = ability("emiya-unlimited-blade-works");

  it("gains its Aria per Combat PHASE, and not while Silenced", () => {
    const gain = ubw.passiveRules.find((r) => r.event === "combatPhaseEnd");
    expect(gain.then[0]).toMatchObject({ key: "ResourceDelta", resource: "aria", delta: 1 });
    expect(gain.predicate).toEqual([{ not: "self:effect:silence" }]);
  });

  it("seals the boundary in both directions, with no escape roll", () => {
    // The difference between a Reality Marble and Asterios's Labyrinth: his
    // gives the trapped a ladder out, and this does not.
    expect(ubw.field.membership).toEqual({
      enemyEntry: "forbidden", enemyExit: "forbidden",
      allyEntry: "forbidden", allyExit: "forbidden",
    });
    expect(ubw.field.membership.escape).toBeUndefined();
    expect(ubw.field.isolation.outsideCanTargetInside).toBe(false);
    expect(ubw.field.isolation.insideCanTargetOutside).toBe(false);
  });

  it("raises the Base Attack itself, not the damage", () => {
    // Everything downstream that multiplies the base multiplies the 50 too,
    // which a stage-4 percentage would not.
    expect(ubw.field.interior[0]).toMatchObject({ stat: "baseAttack.str", value: 50, relations: ["self"] });
  });

  it("tolls the trapped at every Turn boundary, bypassing his own modifiers", () => {
    const toll = ubw.field.interiorEvents[0];
    expect(toll).toMatchObject({ event: "turnStart", relations: ["enemy"], kinds: ["servant"], check: "evade" });
    expect(toll.onFail[0]).toMatchObject({ key: "Damage", bypassModifiers: true, component: "str" });
    expect(toll.onFail[0].roll).toEqual({ formula: "1d4", factor: 25 });
  });

  it("spends the Aria in a phase, after the gate that refuses without it", () => {
    const spend = ubw.phases.find((p) => p.kind === "resource");
    expect(spend.changes[0]).toEqual({ key: "resources.aria.value", delta: -6 });
    expect(ubw.phases.at(-1).kind).toBe("createField");
  });
});

describe("the Thaumaturgy family", () => {
  it("every Spell and Projection refuses under Silence, both ways", () => {
    // Two halves, and both are needed: the requirement stops it being used, and
    // `negatedBy` stops it working if Silence lands after declaration (§15.3).
    const gated = [
      "emiya-reinforcement", "emiya-tracing", "emiya-trace-on",
      "emiya-caladbolg", "emiya-hrunting", "emiya-overedge", "emiya-rho-aias",
    ];
    for (const id of gated) {
      const doc = ability(id);
      expect(doc.negatedBy, id).toEqual(["silence"]);
      expect(doc.requirements, id).toContainEqual({ kind: "notHasEffect", effectId: "silence" });
    }
  });

  it("Magecraft widens his Range on any of them", () => {
    const handler = ability("emiya-magecraft").passiveRules[0];
    expect(handler).toMatchObject({ event: "abilityUsed", ofCategory: "thaumaturgy" });
    expect(handler.then[0].effect.id).toBe("rangeUp");
  });

  it("Reinforcement buffs Normal Attacks only", () => {
    // "Normal Attack damage dealt is increased by 30%" — a blanket Atk Up would
    // quietly buff his Noble Phantasms too.
    expect(ability("emiya-reinforcement").phases[0].effects[0].id).toBe("nAtkUp");
  });

  it("Tracing offers the sheet's two shapes and neither is a default", () => {
    const choose = ability("emiya-tracing").phases[0].choose;
    expect(choose.category).toBe("projection");
    expect(choose.options).toEqual([
      { id: "spread", label: "Two Projections by 1◈", count: 2, ticks: "1◈" },
      { id: "focus", label: "One Projection by 2◈", count: 1, ticks: "2◈" },
    ]);
  });
});

describe("every requirement he uses is one the engine implements", () => {
  it("holds", () => {
    const kinds = new Set(REQUIREMENT_KINDS);
    const used = [
      "emiya-eye-of-the-mind-true", "emiya-eye-of-the-mind-true-ex", "emiya-rho-aias",
      "emiya-unlimited-blade-works", "emiya-reinforcement", "emiya-tracing",
      "emiya-trace-on", "emiya-caladbolg", "emiya-hrunting", "emiya-overedge",
    ].flatMap((id) => (ability(id).requirements ?? []).map((r) => r.kind));

    expect(used.length).toBeGreaterThan(8);
    expect(used.filter((k) => !kinds.has(k))).toEqual([]);
  });
});
