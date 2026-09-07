/**
 * @file Achilles — the pure halves of his kit.
 * @see docs/44-case-expanded-roster.md §44.1–44.3, char_orig_sheets/Copia de Achilles.md
 *
 * He is the acceptance test for GATING, so most of what is checked here is not
 * a magnitude but a condition: which clauses are collected in which stance, and
 * which are refused outright. The parts that need documents — the ladder rung,
 * the duel field, the token — are live-tested in `fgt2026` and recorded in
 * Ch. 45.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { collectContributions } from "../../module/rules/elements.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { meetsRequirements } from "../../module/rules/items.mjs";

/** @param {string} dir @param {string} id @returns {object} */
const doc = (dir, id) => parse(readFileSync(join("packs/_source", dir, `${id}.yml`), "utf8"));
const ability = (id) => doc("abilities", id);
const classSkill = (id) => doc("class-skills", id);

const SHEET = doc("servants", "achilles");

/** His stance, as the sheet declares it. */
const STANCE = SHEET.stance;
/** @param {string} state */
const inStance = (state) => ({ id: "achilles", stance: state, stanceSpec: STANCE });

/* ========================================================================== */
/*  Statline                                                                  */
/* ========================================================================== */

describe("Achilles's statline", () => {
  it("derives every printed figure from the tables", () => {
    expect(lookup("baseAttackStrByStr", Rank.parse("B+"))).toBe(SHEET.baseAttack.str);
    expect(lookup("baseAttackMagByMag", Rank.parse("C"))).toBe(SHEET.baseAttack.mag);
    expect(lookup("baseHealthByEnd", Rank.parse("A"))).toBe(SHEET.baseHealth);
  });

  it("has a Base Attack (MAG) higher than its (STR), which is correct", () => {
    // Unusual, and not a transcription slip: the tables give it, and nothing on
    // his sheet draws on BA(MAG) anyway. Asserted so it survives a tidy-up.
    expect(SHEET.baseAttack.mag).toBeGreaterThan(SHEET.baseAttack.str);
  });

  it("carries MOV 7 with the mounted panel as a contribution, not a second statline", () => {
    expect(SHEET.mov).toBe(7);
    const mounted = SHEET.passiveRules.find((r) => r.key === "MovDelta");
    expect(mounted).toMatchObject({ value: 1, isBuff: false, predicate: ["self:stance:mounted"] });
  });

  it("states its stance the way his sheet does", () => {
    expect(STANCE.default).toBe("dismounted");
    expect(STANCE.forcedOutsideOwnTurn).toBe("dismounted");
    // One transition, and only downward: he may drop out of Mounted at a Combat
    // Phase start and there is no way back in.
    expect(STANCE.transitions).toEqual([{ from: "mounted", to: "dismounted", at: "combatPhaseStart" }]);
  });
});

/* ========================================================================== */
/*  Riding, gated                                                             */
/* ========================================================================== */

describe("Riding A+", () => {
  const riding = classSkill("riding-achilles");

  it("keeps Double Move ungated, which is the exception his sheet names", () => {
    const grants = riding.passiveRules.filter((r) => r.key === "GrantedAbility");
    const free = grants.find((g) => g.abilities.includes("doubleMove"));
    expect(free.predicate).toBeUndefined();
  });

  it("gates Riding Attack and Passenger Seat on the stance", () => {
    const grants = riding.passiveRules.filter((r) => r.key === "GrantedAbility");
    const gated = grants.find((g) => g.abilities.includes("ridingAttack"));
    expect(gated.abilities).toEqual(["ridingAttack", "passengerSeat"]);
    expect(gated.predicate).toEqual(["self:stance:mounted"]);
  });

  it("collects the gated grants only while Mounted", () => {
    const collect = (state) => collectContributions(
      [{ id: "r", name: "Riding", rank: "A+", passiveRules: riding.passiveRules }],
      { options: new Set([`self:stance:${state}`]) },
    ).grantedAbilities ?? [];
    expect(collect("mounted")).toEqual(expect.arrayContaining(["doubleMove", "ridingAttack", "passengerSeat"]));
    expect(collect("dismounted")).toEqual(["doubleMove"]);
  });

  it("refuses the Active on foot", () => {
    expect(meetsRequirements(riding.requirements, { unit: inStance("dismounted") }))
      .toEqual({ ok: false, reason: "stance" });
    expect(meetsRequirements(riding.requirements, { unit: inStance("mounted") })).toEqual({ ok: true });
  });

  it("takes MOV +5 from the shared table at A+", () => {
    expect(lookup("ridingMov", Rank.parse("A+"))).toBe(5);
    const active = riding.activeRules.find((r) => r.key === "MovDelta");
    expect(active).toMatchObject({ table: "ridingMov", isBuff: false, duration: "this turn" });
    // NOT a buff: "cannot be removed by buff removal and is not prevented by an
    // effect that blocks buffs."
    expect(active.isBuff).toBe(false);
  });
});

/* ========================================================================== */
/*  The shared skills                                                         */
/* ========================================================================== */

describe("his shared class skills", () => {
  const refs = Object.fromEntries(SHEET.abilities.map((a) => [a.ref, a]));

  it("takes Magic Resistance C, Battle Continuation A and Divinity C by reference", () => {
    expect(refs["class-magic-resistance"].rank).toBe("C");
    expect(refs["class-battle-continuation"].rank).toBe("A");
    expect(refs.divinity.rank).toBe("C");
  });

  it("reproduces their printed figures from the tables", () => {
    expect(lookup("magicResistancePercent", Rank.parse("C"))).toBe(30);
    expect(lookup("magicResistanceDebuffResist", Rank.parse("C"))).toBe(15);
    expect(lookup("battleContinuationReduction", Rank.parse("A"))).toBe("2d10+20");
    expect(lookup("battleContinuationRevive", Rank.parse("A"))).toBe("5d20");
    expect(lookup("battleContinuationCooldown", Rank.parse("A"))).toBe("3◈");
    expect(lookup("divinity", Rank.parse("C"))).toBe(30);
  });

  it("shares Bravery with Heracles rather than copying it", () => {
    const bravery = classSkill("bravery");
    expect(refs["class-bravery"].rank).toBe("A+");
    expect(refs["class-bravery"].cooldown).toBe("4◈-⅓◈");
    const buff = bravery.phases[0].effects[0];
    // His sheet omits the magnitude — "STR damage dealt is increased by; if NP,
    // 15%" — and Heracles's A+ Bravery prints 25/15. Read as 25.
    expect(buff).toMatchObject({ id: "atkUpStr", magnitude: 25, npMagnitude: 15, duration: "1◈" });
    const mental = bravery.passiveRules.find((r) => r.key === "ApplicationChance");
    expect(mental).toMatchObject({ volatility: "mental", value: -50, direction: "incoming" });
  });

  it("leaves Heracles's Mad Enhancement clauses out of the shared document", () => {
    const bravery = classSkill("bravery");
    expect(bravery.requirements).toBeUndefined();
    expect(JSON.stringify(bravery)).not.toContain("madEnhancement");
  });
});

/* ========================================================================== */
/*  Affections of the Goddess                                                 */
/* ========================================================================== */

describe("Affections of the Goddess", () => {
  const skill = ability("achilles-affections-of-the-goddess");

  it("applies all three clauses for 1◈ on a 4◈ cooldown", () => {
    expect(skill.cooldown).toBe("4◈");
    expect(skill.phases[0].effects).toEqual([
      { id: "defUp", magnitude: 50, npMagnitude: 25, duration: "1◈" },
      { id: "atkUp", magnitude: 20, npMagnitude: 10, duration: "1◈" },
      { id: "debuffResUp", magnitude: 50, duration: "1◈" },
    ]);
  });

  it("works in either stance, so it carries no requirement", () => {
    expect(skill.requirements).toBeUndefined();
  });

  it("does not spend his Attack for the Turn", () => {
    expect(skill.countsAsAttack).toBe(false);
  });
});
