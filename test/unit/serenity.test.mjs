/**
 * @file Serenity's kit, held against her sheet.
 * @see char_orig_sheets/Copia de Hassan (Serenity).md, docs/D-servant-data-sheets.md §D.17
 *
 * The eighth Servant, the first Assassin, and the one whose sheet is written
 * almost entirely in terms of **information**. Three of the mechanisms she needs
 * shipped as vocabulary with no reader: `system.concealed`, the `damageDealt`
 * event, and the `effect:` shorthand every on-hit rider in Appendix A is written
 * in.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { PERIODICS } from "../../module/engine/scheduler.mjs";
import { REQUIREMENT_KINDS } from "../../module/rules/items.mjs";
import { classifyAbility, needsTargeting, usageSpecFor } from "../../module/rules/ability-use.mjs";
import { canUseWhileConcealed } from "../../module/rules/concealment.mjs";
import { isEmittableOption } from "../../module/rules/options.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** @param {string} name */
const ability = (name) => parse(readFileSync(`packs/_source/abilities/${name}.yml`, "utf8"));
/** @param {string} name */
const effect = (name) => parse(readFileSync(`packs/_source/effects/${name}.yml`, "utf8"));
/** @param {string} name */
const classSkill = (name) => parse(readFileSync(`packs/_source/class-skills/${name}.yml`, "utf8"));

const serenity = parse(readFileSync("packs/_source/servants/serenity.yml", "utf8"));

const asItem = (doc) => ({
  id: doc.id,
  type: doc.isNP ? "noblePhantasm" : "ability",
  system: { ...doc, targeting: doc.targeting ?? null, phases: doc.phases ?? [] },
});

describe("the sheet's inventory", () => {
  it("is all seven abilities, in the order it prints them", () => {
    expect(serenity.abilities.map((a) => a.ref)).toEqual([
      "class-presence-concealment",
      "class-independent-action",
      "serenity-shapeshift",
      "serenity-projectile",
      "serenity-silent-dance",
      "serenity-danse-macabre",
      "serenity-zabaniya",
    ]);
  });

  it("matches the stat block", () => {
    expect(serenity.parameters).toEqual({ str: "D", end: "D", agi: "A+", mag: "C", luc: "A" });
    expect(serenity.baseHealth).toBe(750);
    expect(serenity.mov).toBe(7);
    expect(serenity.range).toEqual({ panels: 3, targets: 1 });
    expect(serenity.baseAttack).toEqual({ str: 65, mag: 100 });
    expect(serenity.sustainability).toBe("8◈");
  });
});

describe("Presence Concealment A+, as her sheet prints it", () => {
  const rank = Rank.of("A", 1);

  it("is discovered 5% of the time", () => {
    expect(lookup("presenceConcealmentDiscover", rank)).toBe(5);
  });

  it("adds 4 to the Defending Unit's Evade Roll", () => {
    expect(lookup("presenceConcealmentEvade", rank)).toBe(4);
  });

  it("sits on cooldown for 2◈ after it deactivates", () => {
    expect(lookup("presenceConcealmentCooldown", rank)).toBe("2◈");
  });

  it("starts that clock at DEACTIVATION, not at the use", () => {
    // The clock would otherwise run underneath the Skill's own 2◈ duration, so
    // a Servant could re-conceal the instant the first concealment lapsed --
    // half the cost the sheet charges. `countFrom` had been a declared field
    // with no reader since the ability schema was written.
    expect(classSkill("presence-concealment").cooldown).toEqual({ countFrom: "deactivation" });
  });

  it("is an ACTIVE skill with a duration, not a mode", () => {
    const pc = classSkill("presence-concealment");
    expect(pc.kind).toBe("skill");
    expect(pc.passive).toBeUndefined();
    expect(pc.phases[0]).toMatchObject({ kind: "applyEffects", target: "self" });
    expect(effect("presence-concealment").defaultDuration).toBe("2◈");
  });

  it("is neither a buff nor a debuff, and Unremovable — clause 8", () => {
    const def = effect("presence-concealment");
    expect(def.polarity).toBe("status");
    expect(def.unremovable).toBe(true);
  });

  it("carries clause 4 as two magnitudes that exclude Masters", () => {
    // "All damage dealt is increased by 100%; if NP, 50%. Does not apply to
    // Masters." A blanket modifier would double her damage against the Master
    // her own clause 3 lets her reach.
    const mod = effect("presence-concealment").rules.find((r) => r.key === "DamageModifier");
    expect(mod).toMatchObject({ value: 100, npValue: 50 });
    expect(mod.predicate).toEqual([{ not: "target:type:master" }]);
  });

  it("carries clause 3 as a suppression of Master protection", () => {
    // `resolve.mjs` has consulted `caster.bypassesMasterProtection` since Master
    // protection was written, and nothing set it.
    expect(effect("presence-concealment").rules)
      .toContainEqual({ key: "Suppress", scope: "masterProtection" });
  });
});

describe("Independent Action A", () => {
  it("gives her Master 3 panels of ZON, from the table", () => {
    // The class skill carried a literal `value: 2`, which is right for EMIYA's
    // B and wrong for every other rank the corpus uses.
    expect(lookup("independentActionZon", Rank.of("A"))).toBe(3);
    expect(classSkill("independent-action").passiveRules.find((r) => r.key === "ZonBonus"))
      .toEqual({ key: "ZonBonus", table: "independentActionZon" });
  });

  it("takes four successful contract rolls to steal", () => {
    expect(lookup("independentActionContract", Rank.of("A"))).toBe(4);
  });

  it("is the reason her Sustainability is 8◈", () => {
    expect(lookup("independentActionSustainability", Rank.of("A"))).toBe(8);
  });
});

describe("Shapeshift", () => {
  const ss = ability("serenity-shapeshift");

  it("buys its way out of clause 7, and pays 20% for it", () => {
    expect(ss.usableWhileConcealed).toBe(true);
    expect(ss.concealmentBreakChance).toBe(20);
    expect(canUseWhileConcealed(asItem(ss)).ok).toBe(true);
  });

  it("LENGTHENS the target's NP cooldown", () => {
    // `increase` is the one direction `setCooldown` did not have -- it could set
    // or reduce -- and `set` would have replaced a longer clock with a shorter
    // one, turning the debuff into a favour.
    expect(ss.phases[0]).toMatchObject({ kind: "cooldown", target: "reuse" });
    expect(ss.phases[0].changes).toEqual([{ scope: "np", ticks: "1◈" }]);
  });

  it("names a scope rather than an ability, because the target may have two", () => {
    expect(ss.phases[0].changes[0].abilityId).toBeUndefined();
  });

  it("applies Crit Dwn 20 for 1◈ at Range 2", () => {
    expect(ss.targeting.anchor).toEqual({ kind: "targetUnit", range: 2 });
    expect(ss.phases[1].effects).toEqual([{ id: "critDwn", magnitude: 20, duration: "1◈" }]);
  });
});

describe("Projectile (Poisoned Daggers)", () => {
  const p = ability("serenity-projectile");

  it("is a passive with no button", () => {
    expect(needsTargeting(asItem(p))).toBe(false);
    expect(classifyAbility(asItem(p)).kind).toBe("passive");
  });

  it("raises her crit chance by 15", () => {
    expect(p.passiveRules[0]).toMatchObject({ key: "CheckModifier", check: "crit", value: 15 });
  });

  it("inflicts Poison on the DEFENDING Unit, not on herself", () => {
    // The `effect:` shorthand applies to the handler's owner by default, which
    // for an on-hit rider is the attacker. Every rider in Appendix A is written
    // this way and `target: victim` had no reader.
    const rider = p.passiveRules.find((r) => r.effect?.id === "poison");
    expect(rider.target).toBe("victim");
    expect(rider.event).toBe("damageDealt");
    expect(rider.predicate).toEqual(["attack:kind:normal"]);
  });

  it("keeps the 25% Deadly Poison as its own handler", () => {
    // A shared handler would roll one chance for two effects at 100% and 25%.
    const deadly = p.passiveRules.find((r) => r.effect?.id === "deadlyPoison");
    expect(deadly.chance).toBe(25);
    expect(deadly.duration).toBe("1◈");
    expect(deadly).not.toBe(p.passiveRules.find((r) => r.effect?.id === "poison"));
  });
});

describe("Silent Dance and Danse Macabre — the two chance ladders", () => {
  it("keeps ordinary debuffs and the terminal tier apart, at both sizes", () => {
    // Appendix A keeps Instakill/Death/Erase out of ordinary chance modifiers
    // "unless stated", so one clause cannot do both jobs.
    const sd = ability("serenity-silent-dance").passiveRules;
    expect(sd[0]).toEqual({ key: "ApplicationChance", direction: "outgoing", value: 10 });
    expect(sd[1]).toEqual({
      key: "ApplicationChance", direction: "outgoing",
      severity: ["instakill", "death"], value: 10,
    });

    expect(effect("debuff-ch-up").rules[0].severity).toBeUndefined();
    expect(effect("death-ch-up").rules[0].severity).toEqual(["instakill", "death"]);
  });

  it("applies all four buffs from one press, for 1◈", () => {
    const effects = ability("serenity-danse-macabre").phases[0].effects;
    expect(effects.map((e) => e.id)).toEqual(["debuffChUp", "deathChUp", "atkUp", "macabre"]);
    expect(effects.every((e) => e.duration === "1◈")).toBe(true);
  });

  it("gives Atk Up two magnitudes, as the sheet does", () => {
    const atk = ability("serenity-danse-macabre").phases[0].effects.find((e) => e.id === "atkUp");
    expect(atk).toMatchObject({ magnitude: 30, npMagnitude: 20 });
  });

  it("costs 4◈", () => {
    expect(ability("serenity-danse-macabre").cooldown).toBe("4◈");
  });
});

describe("Macabre", () => {
  const m = effect("macabre").rules[0];

  it("adds a Poison stage on a Normal Attack CRIT", () => {
    expect(m.event).toBe("damageDealt");
    expect(m.predicate).toEqual(["attack:kind:normal", "attack:crit"]);
    expect(m.target).toBe("victim");
    expect(m.effect).toEqual({ id: "poison" });
  });

  it("asks a question the option set can answer", () => {
    // `attack:crit` was not a string anything emitted, so a clause about a
    // Normal Attack that crit could not be written at all.
    expect(isEmittableOption("attack:crit")).toBe(true);
  });
});

describe("Zabaniya: Delusional Poison Body", () => {
  const z = ability("serenity-zabaniya");

  it("uses Base Attack (MAG) and is not affected by Magic Resistance", () => {
    // Base Attack (MAG) 100 against Base Attack (STR) 65. Without the exemption
    // her only damaging Noble Phantasm is negated outright by any Magic
    // Resistance of Rank C or better.
    expect(z.damage).toMatchObject({ multiplier: 3, flatBonus: 100, component: "mag", ignoresMagicResistance: true });
  });

  it("makes her immune to what she spreads", () => {
    // Also the reason the passive cloud can name "any Unit": without this she
    // would poison herself from her own body every Turn.
    expect(z.passiveRules[0]).toEqual({ key: "Immunity", effects: ["poison", "deadlyPoison"] });
  });

  it("poisons every Unit within 2 at the end of her Turn", () => {
    const aura = z.passiveRules.find((r) => r.event === "turnEnd");
    expect(aura.then[0]).toMatchObject({
      key: "ApplyEffect", target: "nearby", radius: 2, relations: ["any"], secret: true,
    });
  });

  it("hides that Poison only while there is something to hide behind", () => {
    // The disclosure trigger is her concealment ending, so an unconcealed
    // Serenity poisons openly and the clause is self-limiting.
    expect(z.passiveRules.find((r) => r.event === "turnEnd").then[0].secret).toBe(true);
  });

  it("inflicts Stage 3 Poison as ONE application", () => {
    // Three applications would roll the chance three times and be improved
    // three times by a Debuff ChUp.
    const riders = z.phases.find((p) => p.kind === "applyEffects").effects;
    expect(riders.find((e) => e.id === "poison")).toEqual({ id: "poison", stages: 3 });
  });

  it("carries the five riders at the chances the sheet prints", () => {
    const riders = z.phases.find((p) => p.kind === "applyEffects").effects;
    expect(riders.map((e) => [e.id, e.chance ?? null])).toEqual([
      ["poison", null],
      ["deadlyPoison", null],
      ["skillSeal", 40],
      ["npSeal", 40],
      ["instakill", 60],
    ]);
    expect(riders.find((e) => e.id === "deadlyPoison").duration).toBe("2◈");
  });

  it("costs 5◈+⅓◈", () => {
    expect(z.cooldown).toBe("5◈+⅓◈");
  });
});

describe("the poison family", () => {
  it("has a definition for the staging the scheduler has always known", () => {
    // `PERIODICS.poison` carried the formula since the scheduler was written and
    // there was no document for it to key on -- so the whole poison family, every
    // Servant that inflicts it and the Poison Swamp terrain all pointed at an
    // effect that did not exist.
    expect(PERIODICS.poison.when).toBe("roundEnd");
    expect(PERIODICS.poison.amount({ stage: 1 })).toBe(20);
    expect(PERIODICS.poison.amount({ stage: 3 })).toBe(80);
    expect(PERIODICS.poison.amount({ stage: 5 })).toBe(320);
    expect(effect("poison").stacking).toBe("stage");
  });

  it("never expires on its own", () => {
    // Appendix A gives Poison no duration, because it runs until it is cured.
    expect(effect("poison").defaultDuration).toBeUndefined();
  });

  it("declares Deadly Poison with no rule element, and says why", () => {
    // Its subject is another effect's periodic tick, which is authored
    // `bypassModifiers` precisely so the damage pipeline does not touch it.
    expect(effect("deadly-poison").rules).toEqual([]);
    expect(effect("deadly-poison").stacking).toBe("noneNoRefresh");
  });

  it("declares Skill Seal with no rule element either", () => {
    // What refuses a Skill is `rules/budget.mjs`'s prevention table, which has
    // listed `skillSeal` since it was written with no document to name.
    expect(effect("skill-seal").rules).toEqual([]);
  });
});

describe("every requirement she uses is one the engine implements", () => {
  it("holds", () => {
    const kinds = new Set(REQUIREMENT_KINDS);
    const used = [
      "serenity-shapeshift", "serenity-projectile", "serenity-silent-dance",
      "serenity-danse-macabre", "serenity-zabaniya",
    ].flatMap((id) => (ability(id).requirements ?? []).map((r) => r.kind));

    expect(used.filter((k) => !kinds.has(k))).toEqual([]);
  });

  it("projects the four fields clause 7 needs onto the usage spec", () => {
    const spec = usageSpecFor(asItem(ability("serenity-shapeshift")));
    expect(spec.usableWhileConcealed).toBe(true);
    expect(spec.targeting).not.toBeNull();
    expect(spec.isAttackSkill).toBe(false);
  });
});
