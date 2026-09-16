/**
 * @file Anastasia & Viy, against her sheet.
 * @see char_orig_sheets/Copia de Anastasia & Viy.md
 *
 * Pinned to the SHEET and to the documentation rather than to the
 * implementation. Every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { chanceFromDistance } from "../../module/rules/miss.mjs";

describe("a distance-scaled chance (R3)", () => {
  // *"a 5% chance of inflicting Instakill for each panel between Anastasia and
  // the DU."* The corpus's only other use of "panels between" is the Dioscuri
  // sheet's *"the maximum distance between the two is 2 panels between them"*,
  // which means Chebyshev 2 and is implemented as such -- so this is the
  // DISTANCE, not the gap.
  it("scales with the distance", () => {
    expect(chanceFromDistance(5, 1)).toBe(5);
    expect(chanceFromDistance(5, 3)).toBe(15);
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("reaches 30% at her maximum reach -- Range 3 plus the NP's +3", () => {
    // Not a clamp in the function; a fact about her, recorded so a later reach
    // change shows up as a test failure rather than as a silent buff.
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("is zero at no distance at all", () => {
    expect(chanceFromDistance(5, 0)).toBe(0);
  });

  it("never exceeds 100", () => {
    expect(chanceFromDistance(5, 40)).toBe(100);
  });

  it("answers zero when the distance is unknown", () => {
    // A snapshot taken off the board has no panel. Guessing would be worse than
    // declining -- the same reading `normalAttackAt` takes of an unknown range.
    expect(chanceFromDistance(5, null)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { applicationChance } from "../../module/rules/checks.mjs";
import { test as testPredicate } from "../../module/rules/predicate.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));

const hit = (over = {}) => computeDamage({
  attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [] },
  defender: { id: "d", health: 9999, modifiers: [], effects: [] },
  attack: { kind: "normal", component: "str" },
  base: { fixedValue: 200 },
  rolls: { attackMinus: 0 },
  crit: { isCrit: false },
  options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
  ...over,
});

const frozen = (over = {}) => hit({
  defender: { id: "d", health: 9999, modifiers: [], effects: ["freeze"] }, ...over,
});

describe("Freeze — the pipeline has carried its behaviour unexercised", () => {
  it("is authored at all", () => {
    expect(effect("freeze").id).toBe("freeze");
  });

  it("prevents the bearer acting", () => {
    // `rules/budget.mjs#preventedBy` reads `freeze` in its blanket list, and
    // has since it was written.
    expect(effect("freeze").preventsAction).toBe(true);
  });

  it("absorbs an attack under 150 entirely", () => {
    const out = frozen({ base: { fixedValue: 120 } });
    expect(out.total).toBe(0);
    expect(out.flags.negatedBy).toBe("Freeze");
  });

  it("passes the excess of an attack at or over 150, and breaks", () => {
    const out = frozen({ base: { fixedValue: 200 } });
    expect(out.total).toBe(200);
    expect(out.flags.removeFreeze).toBe(true);
  });

  it("is broken by ANY Fire damage, with no damage and no effects", () => {
    const out = frozen({
      attack: { kind: "normal", component: "str", element: "fire" },
      base: { fixedValue: 500 },
    });
    expect(out.total).toBe(0);
    expect(out.flags.removeFreeze).toBe(true);
  });

  it("ticks 100 Ice at the end of each Round", () => {
    const rule = effect("freeze").rules[0];
    expect(rule.event).toBe("roundEnd");
    expect(rule.then[0]).toMatchObject({ stat: "health.value", delta: -100 });
  });
});

describe("Invuln — likewise", () => {
  const invulnerable = (over = {}) => hit({
    defender: { id: "d", health: 9999, modifiers: [], effects: ["invuln"] }, ...over,
  });

  it("is authored at all", () => {
    expect(effect("invuln").id).toBe("invuln");
  });

  it("negates an ordinary attack", () => {
    expect(invulnerable({ base: { fixedValue: 300 } }).total).toBe(0);
  });

  it("is ignored by Pierce", () => {
    const out = invulnerable({
      attack: { kind: "normal", component: "str", pierce: true },
      base: { fixedValue: 300 },
    });
    expect(out.total).toBeGreaterThan(0);
  });

  it("forbids the Block rung", () => {
    expect(effect("invuln").rules[0]).toMatchObject({ key: "ForbidReaction", reactions: ["block"] });
  });
});

describe("Soaked (B6–B9, R2)", () => {
  const soaked = () => effect("soaked");
  const ruleOf = (key, over = {}) => soaked().rules.find(
    (r) => r.key === key && Object.entries(over).every(([k, v]) => r[k] === v),
  );

  it("B9 — is neither a buff nor a debuff, and is Unremovable", () => {
    expect(soaked().polarity).toBe("status");
    expect(soaked().unremovable).toBe(true);
  });

  it("B6 — raises the Freeze chance of an Ice attack by 25, additively", () => {
    // `applicationChance` computes `base + inflictBonus - resist`, so a
    // NEGATIVE incoming contribution is a vulnerability. Scoped to `freeze` by
    // `effectId` and to Ice by an attack-time predicate.
    const r = ruleOf("ApplicationChance");
    expect(r.direction).toBe("incoming");
    expect(r.effectId).toBe("freeze");
    expect(r.value).toBe(-25);
    expect(r.predicate).toContain("attack:element:ice");
  });

  it("B6 — and the arithmetic really does add, not replace", () => {
    // A 20% Freeze rider on an Ice attack meets a Soaked defender at 45%.
    expect(applicationChance({ base: 20, resist: -25 }).percent).toBe(45);
  });

  it("B7 — halves Total Fire Damage taken, including NP", () => {
    const w = ruleOf("Ward");
    expect(w.value).toBe(50);
    expect(w.npValue).toBe(50);
    expect(w.predicate).toContain("attack:element:fire");
  });

  it("B7/R2 — removes itself on ANY Fire attack, even one Freeze negated", () => {
    // `fireDamageTaken` fires `damageTaken` once the Damage Step has resolved,
    // INCLUDING at a total of zero -- so it fires even when stage 0 halted on
    // "Freeze broken by Fire". A Unit that is both Soaked and Frozen loses both
    // to one Fire attack without taking a point, which is the user's ruling,
    // and it needs no carve-out at all.
    const r = ruleOf("OnEvent", { event: "damageTaken" });
    expect(r.predicate).toContain("attack:element:fire");
    expect(r.then[0]).toMatchObject({ key: "RemoveEffect", effect: "soaked" });
  });

  it("B8 — is removed at the end of a Day Round", () => {
    const r = ruleOf("OnEvent", { event: "roundEnd" });
    expect(r.predicate).toContain("self:phase:day");
    expect(r.then[0]).toMatchObject({ key: "RemoveEffect", effect: "soaked" });
  });

  it("B8 — and NOT at the end of a Night one", () => {
    // The predicate is what makes the difference, and it is positional: a Unit
    // standing in `sunlight` terrain reads `day` at night, and dries off.
    const r = ruleOf("OnEvent", { event: "roundEnd" });
    expect(testPredicate(r.predicate, { options: new Set(["self:phase:night"]) })).toBe(false);
    expect(testPredicate(r.predicate, { options: new Set(["self:phase:day"]) })).toBe(true);
  });
});

describe("her two bespoke buffs", () => {
  it("BuffRemoval ResUp writes to a bucket that had an executor and no writer", () => {
    const rule = effect("buff-removal-res-up").rules[0];
    expect(rule.key).toBe("BuffRemovalResist");
    expect(rule.value).toBe("@magnitude");
  });

  it("Crit Up (Viy) raises crit on BA(MAG) attacks only, with its own NP figure", () => {
    // *"Crit Chance of Attacks which use Base Attack (MAG) is increased by 50%;
    // if NP, 20%."* Exactly the half of her kit that throws.
    const rule = effect("crit-up-viy").rules[0];
    expect(rule).toMatchObject({ key: "CritModifier", aspect: "chance" });
    expect(rule.value).toBe("@magnitude");
    expect(rule.npValue).toBe("@npMagnitude");
    expect(rule.predicate).toContain("attack:component:mag");
  });

  it("Crit Up (Viy) is its own effect, so a generic Crit Up removal cannot take it", () => {
    expect(effect("crit-up-viy").id).toBe("critUpViy");
    expect(effect("crit-up-viy").families).toContain("critUp");
  });
});

describe("Independent Action with Viy EX (I1–I4, R6)", () => {
  const skill = parse(readFileSync("packs/_source/class-skills/independent-action-viy.yml", "utf8"));

  it("keeps the shared slug, so contract.mjs still finds it", () => {
    // `rollsRequired` matches on the camelCase slug. A variant that renamed it
    // would make her as easy to steal as a Servant with no class skill at all,
    // which is the exact defect the shared template's own header records.
    expect(skill.slug).toBe("independentAction");
  });

  it("I2 — takes ZON from the table, which gives EX the 3 her sheet prints", () => {
    expect(skill.passiveRules.some((r) => r.key === "ZonBonus" && r.table === "independentActionZon"))
      .toBe(true);
    expect(lookup("independentActionZon", Rank.parse("EX"))).toBe(3);
  });

  it("I1 — EX has no Sustainability clock at all", () => {
    expect(lookup("independentActionSustainability", Rank.parse("EX"))).toBeNull();
  });

  it("I4 — adds the passive that is hers alone", () => {
    const crit = skill.passiveRules.filter((r) => r.key === "CritModifier");
    expect(crit.find((r) => r.aspect === "chance").value).toBe(10);
    expect(crit.find((r) => r.aspect === "damage").value).toBe(10);
  });

  it("is a variant document, not a ref override", () => {
    expect(skill.name).toBe("Independent Action with Viy");
    expect(skill.id).toBe("class-independent-action-viy");
  });
});
