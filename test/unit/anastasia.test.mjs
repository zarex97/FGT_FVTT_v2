/**
 * @file Anastasia & Viy, against her sheet.
 * @see char_orig_sheets/Copia de Anastasia & Viy.md
 *
 * Pinned to the SHEET and to the documentation rather than to the
 * implementation. Every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { chanceFromDistance, missChance } from "../../module/rules/miss.mjs";
import { parseTick } from "../../module/domain/tick.mjs";
import { baseAttackFor } from "../../module/domain/base-attack.mjs";
import { normalAttackAt } from "../../module/rules/normal-attack.mjs";

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
    // `effect`, which is the key the executor reads (`effectId: el.effect`) and
    // the one the authoring descriptor offers. This assertion said `effectId`
    // and passed against a file that said `effectId`, so the pair agreed with
    // each other and with nothing else: the clause resolved to a NULL scope and
    // raised every debuff's chance rather than Freeze's (Ch. 46 §46.4-AH).
    expect(r.effect).toBe("freeze");
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

describe("her passive abilities", () => {
  const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
  const band = ["self:effect:blind", "attack:range:lte:2"];

  it("W1 — Swimsuit! halves Water damage taken, including NP", () => {
    const ward = ability("anastasia-swimsuit").passiveRules.find((r) => r.key === "Ward");
    expect(ward).toMatchObject({ value: 50, npValue: 50 });
    expect(ward.predicate).toContain("attack:element:water");
  });

  it("F1/F2 — Fae Contract moves debuff chance in both directions by 5", () => {
    const rules = ability("anastasia-fae-contract").passiveRules;
    expect(rules.find((r) => r.direction === "incoming").value).toBe(5);
    expect(rules.find((r) => r.direction === "outgoing").value).toBe(5);
  });

  it("K1 — Rock Snowball rides the ranged band only (R8)", () => {
    const rule = ability("anastasia-rock-snowball").passiveRules[0];
    expect(rule.chance).toBe(10);
    expect(rule.effect.id).toBe("bleed");
    expect(rule.duration).toBe("½◈");
    // The SAME boundary her Note draws, so the two cannot disagree about where
    // her stance changes.
    expect(rule.predicate).toContain("attack:range:gte:3");
  });

  it("M1–M4 — Watermelon converts Blind into an offensive buff at Range 1–2", () => {
    const rules = ability("anastasia-watermelon").passiveRules;

    const suppress = rules.find((r) => r.key === "Suppress");
    expect(suppress.scope).toBe("miss");
    expect(suppress.predicate).toEqual(band);

    const props = rules.filter((r) => r.key === "AttackProperty").map((r) => r.property);
    expect(props).toContain("pierce");
    expect(props).toContain("ignoreDef");

    const evade = rules.find((r) => r.key === "CheckModifier");
    expect(evade).toMatchObject({ check: "evade", direction: "imposed", value: 4 });
    expect(evade.predicate).toEqual(band);
  });

  it("M1 — and the suppression really does silence the Miss check", () => {
    // End to end against the engine, not just against the YAML: the same
    // predicate the file authors, run through missChance.
    const rules = ability("anastasia-watermelon").passiveRules;
    const unit = {
      id: "anastasia", kind: "servant", effects: ["blind"],
      suppressions: rules.filter((r) => r.key === "Suppress")
        .map((r) => ({ scope: r.scope, predicate: r.predicate })),
    };
    expect(missChance(unit, new Set(["self:effect:blind", "attack:range:lte:2"]))).toBe(0);
    expect(missChance(unit, new Set(["self:effect:blind", "attack:range:gte:3"]))).toBe(80);
  });

  it("R4 — she keeps Blind's OTHER clauses; only the miss is exempted", () => {
    // *"it does not have a chance of Missing"* is singular and specific. Her own
    // Evade rolls stay at +3, through a window the defender may Counter in.
    const rules = ability("anastasia-watermelon").passiveRules;
    const scopes = rules.filter((r) => r.key === "Suppress").map((r) => r.scope);
    expect(scopes).toEqual(["miss"]);
  });

  it("M5 — the Active blinds her until the Combat Process ends", () => {
    const phase = ability("anastasia-watermelon").phases[0];
    expect(phase.target).toBe("self");
    expect(phase.effects[0]).toMatchObject({ id: "blind", duration: "until combatProcessEnd" });
  });

  it("M5 — and that duration parses", () => {
    expect(parseTick("until combatProcessEnd")).toMatchObject({ kind: "untilEvent" });
  });
});

describe("her three active skills", () => {
  const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));

  it("Shvibzik restores 3 Luck, buffs, and turns the NP clock by 1◈+⅔◈", () => {
    const a = ability("anastasia-shvibzik");
    expect(a.cooldown).toBe("4◈-⅓◈");
    expect(a.phases.find((p) => p.kind === "statChange").changes[0])
      .toMatchObject({ stat: "luck", delta: 3, clamp: true });
    expect(a.phases.find((p) => p.effects)?.effects[0])
      .toMatchObject({ id: "atkUp", magnitude: 30, npMagnitude: 20, duration: "1◈" });
    expect(a.phases.at(-1).rules[0])
      .toMatchObject({ key: "CooldownDelta", scope: "np", ticks: "1◈+⅔◈" });
  });

  it("Shvibzik's cooldown expressions both parse", () => {
    expect(parseTick("4◈-⅓◈").kind).toBe("rounds");
    expect(parseTick("1◈+⅔◈").kind).toBe("rounds");
  });

  it("Freezing Summertime keeps two effects to herself and gives one away", () => {
    const a = ability("anastasia-freezing-summertime");
    expect(a.cooldown).toBe("3◈");
    const mine = a.phases.find((p) => p.target === "self").effects.map((e) => e.id);
    expect(mine).toEqual(["invuln", "buffRemovalResUp"]);
    // Defaulting effect 3 to `reuse` would have put Invuln on her whole team.
    const allies = a.phases.find((p) => p.targeting);
    expect(allies.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
    expect(allies.effects[0]).toMatchObject({ id: "sCritUp", magnitude: 20, duration: "⅓◈" });
  });

  it("Spirit Eyes applies all four of its buffs", () => {
    const e = ability("anastasia-spirit-eyes").phases[0].effects;
    expect(ability("anastasia-spirit-eyes").cooldown).toBe("4◈");
    expect(e.find((x) => x.id === "aim")).toMatchObject({ duration: "1◈" });
    expect(e.find((x) => x.id === "critUpViy")).toMatchObject({ magnitude: 50, npMagnitude: 20 });
    expect(e.find((x) => x.id === "critDmUp")).toMatchObject({ magnitude: 30 });
    expect(e.find((x) => x.id === "npDmUp")).toMatchObject({ magnitude: 20 });
  });
});

describe("Ice Bucket Challenge (B1–B10)", () => {
  const a = parse(readFileSync("packs/_source/abilities/anastasia-ice-bucket-challenge.yml", "utf8"));

  it("B1/B2/B3 — an Attack Skill at Range 2, off BA(MAG), dealing Water", () => {
    expect(a.isAttackSkill).toBe(true);
    expect(a.targeting.anchor).toMatchObject({ kind: "targetUnit", range: 2 });
    expect(a.damage.base.sources).toEqual([{ unit: "self", component: "mag", factor: 1 }]);
    expect(a.damage.component).toBe("mag");
    expect(a.damage.element).toBe("water");
  });

  it("B4/B5 — 20% Slow, and Soaked with no chance at all", () => {
    const e = a.phases.find((p) => p.kind === "applyEffects").effects;
    expect(e.find((x) => x.id === "slow")).toMatchObject({ chance: 20, duration: "1◈" });
    // "Applies the 'Soaked' effect" -- stated flatly, so it lands.
    expect(e.find((x) => x.id === "soaked").chance).toBeUndefined();
  });

  it("B10 — carries the cooldown her sheet prints", () => {
    expect(a.cooldown).toBe("3◈");
  });
});

describe("her two Noble Phantasms", () => {
  const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));

  it("Snegleta: BA(MAG), Range+1, 3.5x, and a 6◈ clock", () => {
    const np = ability("anastasia-snegleta");
    expect(np).toMatchObject({ rank: "B", isNP: true, cooldown: "6◈" });
    expect(np.npTags).toEqual(["antiUnit"]);
    expect(np.targeting.anchor.rangeBonus).toBe(1);
    expect(np.damage.component).toBe("mag");
    expect(np.damage.multiplier).toBe(3.5);
  });

  it("Snegleta: the phase ORDER is the clause", () => {
    // *"First, inflict Def Dwn (A) ... Then, deals 3.5x damage"* -- and Def Dwn
    // (A) raises damage taken by 30%, so applying it first is worth 30% of THIS
    // attack. After the damage it would be worth 30% of the next one.
    const np = ability("anastasia-snegleta");
    const kinds = np.phases.map((p) => p.kind);
    expect(kinds.indexOf("applyEffects")).toBeLessThan(kinds.indexOf("damage"));
    expect(np.phases[0].effects[0]).toMatchObject({ id: "defDwnA", magnitude: 30, duration: "⅓◈" });
    expect(np.phases.at(-1).effects[0]).toMatchObject({ id: "skillSeal", duration: "⅓◈" });
  });

  it("Ice Block Launcher: BA(STR), Range+3, Aim, 3x, Ice", () => {
    const np = ability("anastasia-ice-block-launcher");
    expect(np).toMatchObject({ rank: "C", cooldown: "5◈" });
    expect(np.targeting.anchor.rangeBonus).toBe(3);
    expect(np.damage).toMatchObject({ component: "str", multiplier: 3, element: "ice", aim: true });
  });

  it("Ice Block Launcher: the Instakill scales with distance, to 30% (R3)", () => {
    const rider = ability("anastasia-ice-block-launcher")
      .phases.find((p) => p.kind === "applyEffects").effects[0];
    expect(rider).toMatchObject({ id: "instakill", chancePerPanel: 5 });
    // Range 3 + 3 = 6 panels.
    expect(chanceFromDistance(rider.chancePerPanel, 6)).toBe(30);
    expect(chanceFromDistance(rider.chancePerPanel, 1)).toBe(5);
  });
});

describe("the Servant document", () => {
  const a = parse(readFileSync("packs/_source/servants/anastasia.yml", "utf8"));

  it("R1 — her printed figures all agree with the rank tables", () => {
    // Unlike Pollux, nothing here is overruled. STR D++ -> 75 + 2x10 = 95;
    // MAG C -> 150; END E -> 500.
    expect(baseAttackFor(a)).toEqual({ str: 95, mag: 150 });
    expect(a.baseHealth).toBe(500);
    expect(lookup("baseHealthByEnd", Rank.parse("E"))).toBe(500);
  });

  it("N1–N4 — the banded Normal Attack, EMIYA's idiom at 10%", () => {
    const na = a.normalAttack;
    expect(na.mode).toBe("rangeBanded");
    expect(na.component).toBe("str");
    const band = na.bands.find((b) => b.from === 3);
    expect(band.ignoresMagicResistance).toBe(true);
    expect(band.element).toBe("ice");
    expect(band.sources).toEqual([
      { component: "str", factor: 1 },
      { component: "mag", factor: 0.1 },
    ]);
  });

  it("N1 — she swings BA(STR) alone in the melee band", () => {
    const spec = normalAttackAt({ normalAttack: a.normalAttack }, 2);
    expect(spec.sources).toEqual([{ unit: "self", component: "str", factor: 1 }]);
    expect(spec.element).toBeNull();
    expect(spec.ignoresMagicResistance).toBe(false);
  });

  it("N2/N3/N4 — and all three things change together at Range 3", () => {
    const spec = normalAttackAt({ normalAttack: a.normalAttack }, 3);
    expect(spec.sources).toEqual([
      { unit: "self", component: "str", factor: 1 },
      { unit: "self", component: "mag", factor: 0.1 },
    ]);
    // It still COUNTS AS str, which is what stops a Rank D Magic Resistance
    // negating her ranged shot outright.
    expect(spec.component).toBe("str");
    expect(spec.element).toBe("ice");
    expect(spec.ignoresMagicResistance).toBe(true);
  });

  it("N2 — the ranged band totals the 110 her sheet prints", () => {
    const ba = baseAttackFor(a);
    expect(ba.str * 1 + ba.mag * 0.1).toBe(110);
  });

  it("I1 — has no Sustainability clock at all", () => {
    expect(a.sustainability).toBeNull();
  });

  it("R7 — carries both Noble Phantasms, and stores no ranking", () => {
    const refs = a.abilities.map((x) => x.ref);
    expect(refs).toContain("anastasia-snegleta");
    expect(refs).toContain("anastasia-ice-block-launcher");
    // Ch. 33 §33.4 REJECTED storing it; np-strength computes it.
    expect(a.strongestNP).toBeUndefined();
  });

  it("carries the alignment the rulebook does not list", () => {
    expect(a.alignment.morality).toBe("summer");
  });

  it("carries all eleven of her abilities", () => {
    expect(a.abilities).toHaveLength(11);
  });
});
