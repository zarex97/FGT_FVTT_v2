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
import { resolveValue } from "../../module/rules/elements.mjs";
import { ridingAttackPath, knockbackPanel } from "../../module/rules/movement.mjs";
import { allyReactions } from "../../module/rules/reactions.mjs";

/** @param {string} dir @param {string} id @returns {object} */
const doc = (dir, id) => parse(readFileSync(join("packs/_source", dir, `${id}.yml`), "utf8"));
const ability = (id) => doc("abilities", id);
const effectDoc = (id) => doc("effects", id);
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
    expect(grant.predicate).toContain("self:stance:dismounted");
  });

  it("lowers the value of his Evade rolls by 4, and only on foot", () => {
    // A `CheckModifier`, not a new element: `checks.mjs` already folds numeric
    // modifiers into an Evade, which is how Jack's Mist raises everyone else's.
    const mod = np.passiveRules.find((r) => r.key === "CheckModifier");
    expect(mod).toMatchObject({ check: "evade", direction: "outgoing", value: -4 });
    expect(mod.predicate).toContain("self:stance:dismounted");
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
    expect(skill.phases[0].kind).toBe("resource");
    expect(skill.phases[0].changes).toEqual([{ key: "agility", delta: 3 }]);
    expect(skill.phases.slice(1).every((p) => p.kind === "applyEffects")).toBe(true);
  });

  it("applies both buffs at 30 for that Turn only, while his Heel is whole", () => {
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
    expect(np.passiveRules[0]).toMatchObject({
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

/* ========================================================================== */
/*  A Heel Attack's damage                                                    */
/* ========================================================================== */

describe("ignoresDefensiveBuffs", () => {
  // "If the AU's Heel Attack succeeded, Achilles receives damage that ignores
  // all Defensive Buffs and damage reducing effects." Everything he has is a
  // damage-reducing effect, so this is the clause that makes the Heel matter.
  const defended = {
    id: "achilles",
    magicResistance: { mode: "rankComparison", negatesUpToRank: "C", percent: 30, includesNP: true },
    modifiers: [
      { key: "defUp", value: 50, source: "Affections of the Goddess" },
      { key: "dmgCut", value: 100, source: "Dmg Cut" },
      {
        key: "attackerPropertyTier", property: "divinity",
        table: "andreiasAmarantosByAttackerDivinity", source: "Andreias Amarantos",
      },
    ],
  };
  const attacker = { id: "foe", baseAttack: { str: 1000, mag: 1000 }, abilities: [] };
  /** @param {boolean} bypass */
  const hit = (bypass) => computeDamage({
    attacker,
    defender: defended,
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    component: "str",
    attack: { kind: "normal", ignoresDefensiveBuffs: bypass },
    rolls: { attackMinus: 0, battleContinuation: 220 },
  });

  it("takes nothing at all through his standing defences", () => {
    // Andreias Amarantos alone: the attacker has no Divinity, so ×0.
    expect(hit(false).total).toBe(0);
  });

  it("lands the full number when the Heel is struck", () => {
    expect(hit(true).total).toBe(1000);
  });

  it("names every bypassed source in the breakdown rather than hiding them", () => {
    // A reduction that silently did not apply is indistinguishable from one
    // that was never collected, which is the failure this reports its way out
    // of — the same reason `Ignore Def` contributes a visible zero.
    const labels = hit(true).breakdown.flatMap((b) => (b.contributors ?? []).map((c) => c.note ?? ""));
    for (const source of ["Affections of the Goddess", "Dmg Cut", "Battle Continuation", "Andreias Amarantos"]) {
      expect(labels.some((l) => l.includes(source) && l.includes("bypassed")), source).toBe(true);
    }
  });
});

/* ========================================================================== */
/*  Achilles' Heel, and the wound                                             */
/* ========================================================================== */

describe("Achilles' Heel", () => {
  const heel = ability("achilles-heel").weakPoint;

  it("carries his sheet's table exactly", () => {
    expect(heel.baseChanceBySide).toEqual({ front: 0, left: 5, right: 5, back: 10 });
    expect(heel.agilityBonus).toBe(5);
    expect(heel.rangeBonus).toEqual({ atLeast: 3, value: 5 });
    expect(heel.initiatorBonus).toBe(5);
    expect(heel.aoePenalty).toBe(-10);
    expect(heel.fogOfWarBonus).toBe(10);
    // His sheet prints "25%(?)" — the author's own uncertainty, taken as 25.
    expect(heel.luckCheckBonus).toBe(25);
  });

  it("is available only while he is Unmounted, and cannot be Blocked", () => {
    expect(heel.availableWhen).toEqual(["self:stance:dismounted"]);
    expect(heel.blockable).toBe(false);
  });

  it("goes through every defence and wounds him permanently", () => {
    expect(heel.onSuccess).toEqual({ ignoresDefensiveBuffs: true, applies: "heelWounded" });
  });
});

describe("heelWounded", () => {
  const wound = effectDoc("heel-wounded");
  /** @param {boolean} wounded */
  const options = (wounded) => new Set([
    "self:stance:dismounted", ...(wounded ? ["self:effect:heelWounded"] : []),
  ]);

  it("is a permanent status rather than a debuff, and nothing lifts it", () => {
    expect(wound.polarity).toBe("status");
    expect(wound.unremovable).toBe(true);
    expect(wound.defaultDuration).toBeUndefined();
  });

  it("takes Andreias Amarantos away", () => {
    const np = ability("achilles-andreias-amarantos");
    const tiers = (wounded) => collectContributions(
      [{ id: "aa", name: "Andreias Amarantos", rank: "B", passiveRules: np.passiveRules }],
      { options: options(wounded) },
    ).modifiers.filter((m) => m.key === "attackerPropertyTier");
    expect(tiers(false)).toHaveLength(1);
    expect(tiers(true)).toHaveLength(0);
  });

  it("swings his Evade by five points: −4 lost, +1 imposed", () => {
    const np = ability("achilles-dromeus-kometes");
    const value = (rules, wounded) => collectContributions(
      [{ id: "x", name: "x", rank: "A+", passiveRules: rules }],
      { options: options(wounded) },
    ).checkModifiers.filter((m) => m.check === "evade").reduce((a, m) => a + m.value, 0);

    expect(value(np.passiveRules, false)).toBe(-4);
    expect(value(np.passiveRules, true)).toBe(0);
    expect(value(wound.rules, true)).toBe(1);
  });

  it("costs him a panel of MOV on foot, and nothing while Mounted", () => {
    const mov = (opts) => collectContributions(
      [{ id: "w", name: "Heel Wounded", rules: wound.rules }],
      { options: opts },
    ).statDeltas.filter((d) => d.stat === "mov").reduce((a, d) => a + d.value, 0);
    expect(mov(options(true))).toBe(-1);
    expect(mov(new Set(["self:stance:mounted", "self:effect:heelWounded"]))).toBe(0);
  });

  it("halves Runner Comet's buffs to 10, through two predicated phases", () => {
    const comet = ability("achilles-runner-comet");
    const phases = comet.phases.filter((p) => p.kind === "applyEffects");
    expect(phases).toHaveLength(2);
    expect(phases[0].predicate).toEqual([{ not: "self:effect:heelWounded" }]);
    expect(phases[0].effects.map((e) => e.magnitude)).toEqual([30, 30]);
    expect(phases[1].predicate).toEqual(["self:effect:heelWounded"]);
    expect(phases[1].effects.map((e) => e.magnitude)).toEqual([10, 10]);
  });
});

/* ========================================================================== */
/*  Troias Tragōidia                                                          */
/* ========================================================================== */

describe("Troias Tragōidia", () => {
  const np = ability("achilles-troias-tragoidia");

  it("rides 13 panels, which is the NP's distance and not his MOV", () => {
    expect(np.ridingAttack).toEqual({ distance: 13 });
    // His MOV is 8 at best, so without the override the ride could not happen.
    expect(SHEET.mov + 1).toBeLessThan(np.ridingAttack.distance);
  });

  it("lets an ability state the ride's reach", () => {
    const unit = { id: "a", panel: { i: 5, j: 5 }, mov: 7, turnState: { movedPanels: 0 }, effects: [] };
    const board = { units: [unit], bounds: { rows: 25, cols: 25 } };
    const far = { i: 5, j: 18 };
    expect(ridingAttackPath(unit, far, board).ok).toBe(false);
    expect(ridingAttackPath(unit, far, board, { distanceOverride: 13 }).ok).toBe(true);
  });

  it("hits in both directions on the normal board only", () => {
    expect(np.targeting.shape).toMatchObject({ kind: "line", length: 13, bidirectional: "unlessLargeBoard" });
  });

  it("deals 4x on Base Attack (STR), and is Mounted-only", () => {
    expect(np.damage).toEqual({ component: "str", multiplier: 4 });
    expect(np.requirements).toEqual([{ kind: "stance", stance: "mounted" }]);
    expect(np.cooldown).toBe("7◈+⅓◈");
  });

  it("computes X from what was left of his movement, rounded down", () => {
    /** `10 * @ride.x`, resolved the way the attack path resolves it. */
    const atkUp = np.phases.find((p) => p.kind === "applyEffects" && p.when === "beforeDamage").effects[0];
    const at = (x, field) => resolveValue(atkUp, null, { refs: { ride: { x, xLessOne: Math.max(0, x - 1) } } }, field);
    // MOV 8, moved 3 → 5 left → X = 2 → 20% and 10%.
    expect(at(2, "magnitude")).toBe(20);
    expect(at(2, "npMagnitude")).toBe(10);
    // A full allowance of 8 → X = 4 → 40% and 30%.
    expect(at(4, "magnitude")).toBe(40);
    expect(at(4, "npMagnitude")).toBe(30);
    // Nothing left: no buff either way, and never a negative one.
    expect(at(0, "magnitude")).toBe(0);
    expect(at(0, "npMagnitude")).toBe(0);
  });

  it("restores the same X in Agility, not a second number", () => {
    const restore = np.phases.find((p) => p.kind === "resource");
    expect(restore.changes).toEqual([{ key: "agility", delta: "@ride.x" }]);
    expect(restore.when).toBe("beforeDamage");
  });

  it("computes Y from the Units it actually reached, after the damage", () => {
    const rider = np.phases.filter((p) => p.kind === "applyEffects").at(-1);
    expect(rider.when).toBeUndefined();
    const critDmUp = rider.effects[0];
    const at = (hitCount) => resolveValue(critDmUp, null, { refs: { hitCount } }, "magnitude");
    expect(at(0)).toBe(0);
    expect(at(4)).toBe(40);
  });

  it("does not buff itself with its own Riding Attack passive", () => {
    // "Riding Attack damage is increased by 25%, does not affect NP" — and this
    // NP *is* a Riding Attack, so the exclusion is what stops it compounding.
    const passive = np.passiveRules.find((r) => r.key === "DamageModifier");
    expect(passive).toMatchObject({ value: 25, npValue: 0, predicate: ["attack:kind:ridingAttack"] });
  });

  it("bills his Master 25 Health at the end of any Turn he Acts while Mounted", () => {
    const upkeep = np.passiveRules.find((r) => r.key === "OnEvent");
    expect(upkeep).toMatchObject({ event: "actedTurnEnd", predicate: ["self:stance:mounted"] });
    expect(upkeep.then[0]).toEqual({
      key: "StatDelta", subject: "master", stat: "health.value", amount: 25, direction: "down",
    });
  });
});

/* ========================================================================== */
/*  Akhilleus Kosmos                                                          */
/* ========================================================================== */

describe("Akhilleus Kosmos — the push", () => {
  const np = ability("achilles-akhilleus-kosmos");

  it("walks through people only on foot", () => {
    const grant = np.passiveRules.find((r) => r.key === "GrantedAbility");
    expect(grant.abilities).toEqual(["ignoresOccupancy"]);
    expect(grant.predicate).toEqual(["self:stance:dismounted"]);
  });

  it("shoves along his travel, and hurts whoever has nowhere to go", () => {
    const push = np.passiveRules.find((r) => r.key === "Knockback");
    expect(push).toMatchObject({ direction: "travel", sidestep: { damage: "normalAttack" } });
  });

  it("differs from Kingprotea's cascade in both direction and outcome", () => {
    // `inBounds` reads `iMin`/`iMax`/`jMin`/`jMax`, not a size.
    const board = { units: [], bounds: { iMin: 0, iMax: 12, jMin: 0, jMax: 12 } };
    const victim = { id: "v", panel: { i: 6, j: 7 }, level: 0 };
    const walled = [8, 9, 10, 11, 12].map((j, n) => ({ id: `w${n}`, panel: { i: 6, j }, level: 0 }));
    const full = { ...board, units: [victim, ...walled] };

    // His: pushed east, along the travel, and stepped aside when the line jams.
    expect(knockbackPanel({ i: 6, j: 6 }, victim, full, {
      preferredDirection: { i: 0, j: 1 }, allowSidestep: true,
    })).toEqual({ panel: { i: 5, j: 7 }, sidestepped: true });

    // Hers: no preferred direction, no sidestep — the occupant simply stays.
    expect(knockbackPanel({ i: 6, j: 6 }, victim, full)).toBe(null);
  });
});

describe("Akhilleus Kosmos — the barrier", () => {
  const np = ability("achilles-akhilleus-kosmos");

  it("answers an AoE Noble Phantasm of Rank A or above, within 2 panels", () => {
    expect(np.timing).toEqual({
      window: "whenAllyAttacked", againstKind: "np", againstRank: "A", requiresAoE: true, radius: 2,
    });
  });

  it("is offered only against what its sheet names", () => {
    const achilles = {
      id: "achilles", name: "Achilles", panel: { i: 5, j: 5 }, factionId: "a",
      turnState: {}, effects: [],
    };
    const board = { units: [achilles], alliances: { a: ["a"] } };
    const item = { id: "ak", name: "Akhilleus Kosmos", system: { timing: np.timing, cooldown: {} } };
    const offer = (attack) => allyReactions({
      defender: achilles, board, attack, actorFor: () => ({ items: [item], name: "Achilles" }),
    }).length;

    expect(offer({ kind: "np", rank: "A+", isAoE: true })).toBe(1);
    expect(offer({ kind: "np", rank: "A", isAoE: true })).toBe(1);
    // Below Rank A, single-target, or not a Noble Phantasm at all: silent.
    expect(offer({ kind: "np", rank: "B", isAoE: true })).toBe(0);
    expect(offer({ kind: "np", rank: "A+", isAoE: false })).toBe(0);
    expect(offer({ kind: "normal", rank: "A+", isAoE: true })).toBe(0);
  });

  it("is silent once it has been spent", () => {
    const achilles = {
      id: "achilles", name: "Achilles", panel: { i: 5, j: 5 }, factionId: "a",
      turnState: {}, effects: [],
    };
    const board = { units: [achilles], alliances: { a: ["a"] } };
    const spent = { id: "ak", name: "AK", system: { timing: np.timing, cooldown: {}, expended: true } };
    expect(allyReactions({
      defender: achilles, board, attack: { kind: "np", rank: "A+", isAoE: true },
      actorFor: () => ({ items: [spent], name: "Achilles" }),
    })).toEqual([]);
  });

  it("negates damage AND effects, which is why it is Anti-Purge and not Invuln", () => {
    // Invuln zeroes the number at stage 16 and Appendix A says plainly that it
    // does not stop a rider debuff; Anti-Purge halts at stage 0, before the
    // attack is measured, so the riders never fire either.
    expect(np.phases[0].effects).toEqual([{ id: "antiPurge", duration: "this turn", uses: 1 }]);
    expect(effectDoc("anti-purge").id).toBe("antiPurge");
  });

  it("is spent for the rest of the game rather than put on a cooldown", () => {
    expect(np.expendsPermanently).toBe(true);
    expect(np.cooldown).toBeUndefined();
  });
});
