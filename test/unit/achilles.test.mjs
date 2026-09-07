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
import { checkPlan, evade } from "../../module/rules/checks.mjs";
import { categoryRankOf } from "../../module/rules/items.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

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

/* ========================================================================== */
/*  Dromeus Komētēs and Runner Comet                                          */
/* ========================================================================== */

describe("Dromeus Komētēs", () => {
  const np = ability("achilles-dromeus-kometes");

  it("is a Noble Phantasm that is purely passive and deals nothing", () => {
    expect(np.isNP).toBe(true);
    expect(np.passive).toBe(true);
    expect(np.damage).toBeUndefined();
    expect(np.phases).toBeUndefined();
  });

  it("re-grants Double Move on foot, so a Seal on either document leaves it standing", () => {
    const grant = np.passiveRules.find((r) => r.key === "GrantedAbility");
    expect(grant.abilities).toEqual(["doubleMove"]);
    expect(grant.predicate).toEqual(["self:stance:dismounted"]);
  });

  it("lowers the value of his Evade rolls by 4, and only on foot", () => {
    // A `CheckModifier`, not a new element: `checks.mjs` already folds numeric
    // modifiers into an Evade, which is how Jack's Mist raises everyone else's.
    const mod = np.passiveRules.find((r) => r.key === "CheckModifier");
    expect(mod).toMatchObject({ check: "evade", direction: "outgoing", value: -4 });
    expect(mod.predicate).toEqual(["self:stance:dismounted"]);
  });

  it("turns a failed Evade into a successful one at the margin", () => {
    // `success: total <= target`, so a NEGATIVE modifier is the helpful one.
    const unit = {
      checkModifiers: [{ check: "evade", direction: "outgoing", value: -4, source: "Dromeus Komētēs" }],
    };
    const plan = checkPlan(unit, "evade", { options: new Set(["self:stance:dismounted"]) });
    expect(plan.modifiers).toEqual([{ source: "Dromeus Komētēs", value: -4 }]);
    // Agility 14, rolled 17: fails bare, succeeds with the comet.
    expect(evade({ roll: 17, agility: 14 }).success).toBe(false);
    expect(evade({ roll: 17, agility: 14, modifiers: plan.modifiers }).success).toBe(true);
  });
});

describe("Runner Comet", () => {
  const skill = ability("achilles-runner-comet");

  it("opens at the start of a Combat Phase rather than on his Turn", () => {
    expect(skill.timing.window).toBe("combatPhaseStart");
    expect(skill.cooldown).toBe("3◈-⅓◈");
  });

  it("is refused mounted, and refused under either Seal", () => {
    const kinds = skill.requirements.map((r) => r.kind);
    expect(kinds).toEqual(["stance", "notHasEffect", "notHasEffect"]);
    expect(skill.requirements[0].stance).toBe("dismounted");
    expect(skill.requirements.slice(1).map((r) => r.effectId)).toEqual(["skillSeal", "npSeal"]);

    expect(meetsRequirements(skill.requirements, { unit: inStance("mounted") }))
      .toEqual({ ok: false, reason: "stance" });
    expect(meetsRequirements(skill.requirements, {
      unit: { ...inStance("dismounted"), effects: ["npSeal"] },
    })).toEqual({ ok: false, reason: "notHasEffect" });
    expect(meetsRequirements(skill.requirements, { unit: { ...inStance("dismounted"), effects: [] } }))
      .toEqual({ ok: true });
  });

  it("restores 3 Agility before it buffs, in the sheet's order", () => {
    expect(skill.phases.map((p) => p.kind)).toEqual(["resource", "applyEffects"]);
    expect(skill.phases[0].changes).toEqual([{ key: "agility", delta: 3 }]);
  });

  it("applies both buffs at 30 for that Turn only", () => {
    expect(skill.phases[1].effects).toEqual([
      { id: "nAtkUp", magnitude: 30, duration: "this turn" },
      { id: "critDmUp", magnitude: 30, duration: "this turn" },
    ]);
  });
});

/* ========================================================================== */
/*  Andreias Amarantos                                                        */
/* ========================================================================== */

describe("Andreias Amarantos", () => {
  const np = ability("achilles-andreias-amarantos");

  it("reads the table that was written for it and never read", () => {
    const rule = np.passiveRules[0];
    expect(rule).toEqual({
      key: "AttackerPropertyTier",
      property: "divinity",
      table: "andreiasAmarantosByAttackerDivinity",
    });
  });

  it("returns the percentage that gets through, not the reduction", () => {
    const at = (r) => lookup("andreiasAmarantosByAttackerDivinity", r === null ? null : Rank.parse(r));
    expect(at(null)).toBe(0);   // no Divinity at all: nothing gets through
    expect(at("E")).toBe(50);   // "reduced by 50% (halved)"
    expect(at("D")).toBe(75);   // "reduced by 25%"
    expect(at("C")).toBe(100);  // "receives normal damage"
    expect(at("A")).toBe(100);
    expect(at("EX")).toBe(100);
  });

  it("finds Divinity through the category, so a Divine Core counts too", () => {
    const shared = { abilities: [{ slug: "divinity", categorizedAs: ["divinity"], rank: "C" }] };
    const core = { abilities: [{ slug: "goddessesDivineCore", categorizedAs: ["divinity"], rank: "A" }] };
    expect(categoryRankOf(shared, "divinity").toString()).toBe("C");
    expect(categoryRankOf(core, "divinity").toString()).toBe("A");
    expect(categoryRankOf({ abilities: [] }, "divinity")).toBe(null);
  });

  it("scales the whole Total Damage by the attacker's tier", () => {
    const defender = {
      id: "achilles",
      modifiers: [{
        key: "attackerPropertyTier", property: "divinity",
        table: "andreiasAmarantosByAttackerDivinity", source: "Andreias Amarantos",
      }],
    };
    /** @param {string|null} rank the ATTACKER's Divinity */
    const dealt = (rank) => computeDamage({
      attacker: {
        id: "foe",
        baseAttack: { str: 1000, mag: 1000 },
        abilities: rank ? [{ slug: "divinity", categorizedAs: ["divinity"], rank }] : [],
      },
      defender,
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      component: "str",
      rolls: { attackMinus: 0 },
    }).total;

    expect(dealt(null)).toBe(0);
    expect(dealt("E")).toBe(500);
    expect(dealt("D")).toBe(750);
    expect(dealt("C")).toBe(1000);
  });
});
