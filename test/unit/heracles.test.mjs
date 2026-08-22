/**
 * @file Heracles's kit, held against his sheet.
 * @see char_orig_sheets/Copia de Heracles.md, docs/31-case-heracles.md
 *
 * He shipped with four of his eight abilities. The four that were missing are
 * the four Ch. 31 was written about: the revival chain, God Hand's two
 * passives, the Skill his own Mad Enhancement switches off for the whole match,
 * and the third `evadeSucceeded` clause in the reference set.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { REVIVAL_PRIORITY } from "../../module/rules/revival.mjs";
import { REQUIREMENT_KINDS } from "../../module/rules/items.mjs";
import { classifyAbility, needsTargeting, countsAsAttack } from "../../module/rules/ability-use.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** @param {string} name */
const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));
/** @param {string} name */
const effect = (name) => parse(readFileSync(`packs/_source/effects/${name}.yml`, "utf8"));
/** @param {string} name */
const classSkill = (name) => parse(readFileSync(`packs/_source/class-skills/${name}.yml`, "utf8"));

const heracles = parse(readFileSync("packs/_source/servants/heracles.yml", "utf8"));

const asItem = (doc) => ({
  id: doc.id,
  type: doc.isNP ? "noblePhantasm" : "ability",
  system: { ...doc, targeting: doc.targeting ?? null, phases: doc.phases ?? [] },
});

describe("the sheet's inventory", () => {
  it("is all eight abilities", () => {
    expect(heracles.abilities.map((a) => a.ref)).toEqual([
      "class-mad-enhancement",
      "divinity",
      "class-battle-continuation",
      "heracles-indomitable",
      "heracles-bravery",
      "heracles-eye-of-the-mind-false",
      "heracles-god-hand",
      "heracles-nine-lives",
    ]);
  });

  it("matches the stat block", () => {
    expect(heracles.parameters).toEqual({ str: "A+", end: "A", agi: "A", mag: "B", luc: "A" });
    expect(heracles.baseHealth).toBe(1500);
    expect(heracles.baseAttack).toEqual({ str: 160, mag: 175 });
    expect(heracles.mov).toBe(6);
  });
});

describe("Mad Enhancement B, as his sheet prints it", () => {
  // The class skill is table-driven and instantiated eleven times across the
  // roster; his sheet states the B column outright, which is the check that the
  // tables and the sheets agree.
  const b = Rank.of("B");

  it("drains his Master 20 a Turn", () => {
    expect(lookup("madEnhancementDrain", b)).toBe(20);
  });

  it("reduces damage taken by 40%, and 20% against a Noble Phantasm", () => {
    expect(lookup("madEnhancementDefence", b)).toEqual([40, 20]);
  });

  it("increases damage dealt by 60%", () => {
    expect(lookup("madEnhancementOffence", b)).toBe(60);
  });

  it("is on and cannot be switched off", () => {
    const entry = heracles.abilities.find((a) => a.ref === "class-mad-enhancement");
    expect(entry).toMatchObject({ rank: "B", active: true, cannotDeactivate: true });
  });
});

describe("the revival chain", () => {
  it("declares all four priorities, in the order the sheet states", () => {
    // "Undying > normal Guts > Battle Continuation > God Hand."
    const priorityOf = (rules) => rules.find((r) => r.key === "RevivalSource").revivalPriority;

    expect(priorityOf(effect("undying").rules)).toBe(REVIVAL_PRIORITY.specialGuts);
    expect(priorityOf(effect("guts").rules)).toBe(REVIVAL_PRIORITY.guts);
    expect(priorityOf(classSkill("battle-continuation").passiveRules)).toBe(REVIVAL_PRIORITY.skill);
    expect(priorityOf(ability("heracles-god-hand").passiveRules)).toBe(REVIVAL_PRIORITY.passive);
  });

  it("does not name `priority`, which means something else on a rule element", () => {
    // `priority` reorders an element within its ordering band (§24.6) and
    // `orderElements` sorts on it — so §31.2's `priority: 300` would have moved
    // the element itself into a band it does not belong to, silently.
    for (const rules of [effect("undying").rules, ability("heracles-god-hand").passiveRules]) {
      expect(rules.find((r) => r.key === "RevivalSource").priority).toBeUndefined();
    }
  });

  it("gates Battle Continuation on recovery as well as on its clock", () => {
    // "Cooldown 3◈ Turns, AND the Unit's Health must have been restored back to
    // above half its maximum value at least once since the last activation."
    const source = classSkill("battle-continuation").passiveRules
      .find((r) => r.key === "RevivalSource");

    expect(source.requiresHealthRestoredSince).toBe(0.5);
    expect(source.restore.cooldownTable).toBe("battleContinuationCooldown");
    expect(source.charges).toBeUndefined();     // clock-gated, not budget-gated
  });

  it("restores 5d20 at Rank A, which is what his sheet prints", () => {
    expect(lookup("battleContinuationRevive", Rank.of("A"))).toBe("5d20");
    expect(lookup("battleContinuationCooldown", Rank.of("A"))).toBe("3◈");
  });

  it("consumes Undying on use and refuses to stack it with itself", () => {
    const undying = effect("undying");
    expect(undying.uses).toBe(1);
    expect(undying.stacking).toBe("noneRefresh");
    // "Stacks with other Guts buffs" — a different definition, so nothing to do.
    expect(undying.blocks).toBeUndefined();
    expect(undying.rules[0].restore).toEqual({ percentOfMax: 25 });
  });
});

describe("God Hand", () => {
  const gh = ability("heracles-god-hand");

  it("is a passive NP: no button, no targeting, no Attack spent", () => {
    const item = asItem(gh);
    expect(classifyAbility(item).kind).toBe("passive");
    expect(needsTargeting(item)).toBe(false);
    expect(countsAsAttack(item)).toBe(false);
  });

  it("has eleven charges and cascades", () => {
    const source = gh.passiveRules.find((r) => r.key === "RevivalSource");
    expect(gh.maxUses).toBe(11);
    expect(source.charges).toBe(11);
    expect(source.cascading).toBe(true);
    expect(source.restore.formula).toBe("10d20");
  });

  it("records the attacks that empty his Health", () => {
    expect(gh.recordsAttacks).toBe(true);
  });

  it("cannot be copied", () => {
    expect(gh.copyable).toEqual({ allowed: false, reason: "unique" });
  });
});

describe("Bravery", () => {
  const bravery = ability("heracles-bravery");

  it("is refused while Mad Enhancement is Active — which for him is always", () => {
    expect(bravery.requirements).toContainEqual({ kind: "modeInactive", mode: "madEnhancement" });
  });

  it("switches its PASSIVE off too, which is the other half of the note", () => {
    // "Cannot be used AND has no effects when Mad Enhancement is Active."
    const passive = bravery.passiveRules[0];
    expect(passive.predicate).toEqual([{ not: "self:skillActive:madEnhancement" }]);
  });

  it("resists Mental debuffs by classification, not by a list of names", () => {
    const passive = bravery.passiveRules[0];
    expect(passive).toMatchObject({ key: "ApplicationChance", direction: "incoming", volatility: "mental", value: -50 });
  });

  it("buffs STR damage only", () => {
    // "STR damage dealt is increased by 25%" — a blanket Atk Up would buff the
    // MAG half of a combined attack the sheet does not touch.
    expect(bravery.phases[0].effects[0]).toMatchObject({ id: "atkUpStr", magnitude: 25, npMagnitude: 15 });
  });
});

describe("Eye of the Mind (False)", () => {
  const eye = ability("heracles-eye-of-the-mind-false");

  it("is a reaction", () => {
    expect([eye.timing.window].flat()).toEqual(["whenAttacked"]);
  });

  it("pays out on a successful Evade", () => {
    // The third of three such clauses in the reference set, and none of them
    // could fire until `evadeSucceeded` did.
    const handler = eye.passiveRules.find((r) => r.event === "evadeSucceeded");
    expect(handler.then).toEqual([{ key: "CooldownDelta", ticks: "⅓◈" }]);
  });

  it("applies Dodge and Crit DmUp at the sheet's magnitudes", () => {
    expect(eye.phases[0].effects).toEqual([
      { id: "dodge", duration: "⅔◈" },
      { id: "critDmUp", magnitude: 35, duration: "1◈" },
    ]);
  });
});

describe("Indomitable", () => {
  const ind = ability("heracles-indomitable");

  it("applies both buffs from one press", () => {
    expect(ind.phases[0].effects.map((e) => e.id)).toEqual(["undying", "indomitable"]);
    expect(ind.phases[0].effects.every((e) => e.duration === "1◈+⅔◈")).toBe(true);
  });

  it("pays out on a revival by ANY source, not just its own", () => {
    // "Whenever Heracles is defeated and revived through any effect" — so it
    // cannot hang off Undying, and firing it from each of the four would fire
    // it four times.
    const handler = effect("indomitable").rules.find((r) => r.event === "unitRevived");
    expect(handler.then[0].effect).toMatchObject({ id: "atkUp", magnitude: 30, npMagnitude: 20 });
  });
});

describe("Nine Lives", () => {
  it("carries the cooldown the sheet prints", () => {
    // `7◈`, not `7◈+⅓◈`. A third of a Round is one Turn here and five in a
    // Holy Grail War, so the difference is not rounding.
    expect(ability("heracles-nine-lives").cooldown).toBe("7◈+⅓◈");
  });
});

describe("every requirement he uses is one the engine implements", () => {
  it("holds", () => {
    const kinds = new Set(REQUIREMENT_KINDS);
    const used = ["heracles-bravery", "heracles-indomitable", "heracles-god-hand", "heracles-nine-lives"]
      .flatMap((id) => (ability(id).requirements ?? []).map((r) => r.kind));

    expect(used.filter((k) => !kinds.has(k))).toEqual([]);
  });
});
