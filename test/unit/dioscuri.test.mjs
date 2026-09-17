/**
 * @file Castor and Pollux, against their sheet.
 * @see char_orig_sheets/Copia de Dioscuri.md, docs/45-case-studies.md
 *
 * Pinned to the SHEET and to the documentation rather than to the
 * implementation, which is what the rest of this suite does. Every `it` here
 * names the clause it is holding.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolveRef } from "../../tools/lib/content.mjs";
import { parse } from "yaml";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { baseAttackFor } from "../../module/domain/base-attack.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const classSkill = (id) => parse(readFileSync(`packs/_source/class-skills/${id}.yml`, "utf8"));

/** A class skill as one Servant's own sheet instantiates it (Ch. 46 §46.4-C). */
function madEnhancementFor(servant) {
  const sv = parse(readFileSync(`packs/_source/servants/${servant}.yml`, "utf8"));
  const ref = sv.abilities.find((a) => a.ref === "class-mad-enhancement");
  const library = new Map([["class-mad-enhancement", classSkill("mad-enhancement")]]);
  const problems = [];
  const built = resolveRef(ref, library, problems, servant);
  expect(problems).toEqual([]);
  return built;
}

const castor = servant("castor");
const pollux = servant("pollux");

/* ── The binding (D1–D8) ─────────────────────────────────────────────────── */

describe("the sheet's opening paragraph, as data", () => {
  it("binds both twins with the same group", () => {
    for (const twin of [castor, pollux]) {
      expect(twin.linkedGroup.id).toBe("dioscuri");
      expect(twin.linkedGroup.leash).toBe(2);
      expect(twin.linkedGroup.linkedDeath).toBe("ignoresRevival");
      expect(twin.linkedGroup.sharedCooldowns).toBe("byName");
      expect(twin.linkedGroup.unitWeight).toBe(0.5);
      expect(twin.linkedGroup.zonSatisfaction).toBe("any");
      expect(twin.linkedGroup.summonTogether).toBe(true);
    }
  });

  it("points each twin at the other", () => {
    expect(castor.linkedGroup.partners).toEqual(["pollux"]);
    expect(pollux.linkedGroup.partners).toEqual(["castor"]);
  });
});

/* ── Stats (C1–C4, P1–P4, R1) ────────────────────────────────────────────── */

describe("the stat blocks", () => {
  it("gives both 1500 Health at END A++, as the sheet prints", () => {
    // The table would step A++ to 1700; the sheet says 1500 and is stated, the
    // way `asterios.yml` states his at the same rank.
    expect(castor.baseHealth).toBe(1500);
    expect(pollux.baseHealth).toBe(1500);
  });

  it("gives Castor MOV 6 and Range 3, Pollux MOV 5 and Range 1", () => {
    expect(castor.mov).toBe(6);
    expect(castor.range).toEqual({ panels: 3, targets: 1 });
    expect(pollux.mov).toBe(5);
    expect(pollux.range).toEqual({ panels: 1, targets: 1 });
  });

  it("R1 — plays Pollux's BA(STR) at the table's 150, not her sheet's 200", () => {
    // Ch. 41 Q50: *"If you find a value of Base attack that differs from this
    // calculation choose the value of this table instead of what is on the
    // character sheet."* The written 200 is kept so the deviation stays
    // visible, and `validate:content` warns about it.
    expect(pollux.baseAttack.str).toBe(200);
    expect(baseAttackFor(pollux)).toEqual({ str: 150, mag: 150 });
  });

  it("R1 — Castor's figures need no correction", () => {
    expect(baseAttackFor(castor)).toEqual({ str: 150, mag: 150 });
  });
});

/* ── Mad Enhancement B− (C13–C15, C21, R5) ───────────────────────────────── */

describe("Castor's Mad Enhancement B− reproduces all three figures his sheet prints", () => {
  it("reduces damage taken by 35%, and NP damage by 15%", () => {
    expect(lookup("madEnhancementDefence", Rank.parse("B-"))).toEqual([35, 15]);
  });

  it("increases damage dealt by 55%", () => {
    expect(lookup("madEnhancementOffence", Rank.parse("B-"))).toBe(55);
  });

  it("drains 20 from his Master", () => {
    expect(lookup("madEnhancementDrain", Rank.parse("B-"))).toBe(20);
  });

  it("is carried at B−, which is what produces those three", () => {
    const me = castor.abilities.find((a) => a.ref === "class-mad-enhancement");
    expect(me.rank).toBe("B-");
  });
});

describe("R5 — the drain halves beside Pollux, and its floor and threshold with it", () => {
  // INSTANTIATED for Castor, not read off the template. Clause 1 is
  // parameterized -- the six sheets carrying Mad Enhancement print three
  // different shapes of it (Ch. 46 §46.4-C) -- so the template alone no longer
  // says what any particular Servant has, and asking it would test a Servant
  // that does not exist.
  const clause = madEnhancementFor("castor").activeRules
    .find((r) => r.key === "OnEvent" && r.event === "actedTurnEnd");

  it("gives Castor the forced deactivation and no floor, as his sheet prints it", () => {
    const [drain, setMode] = clause.then;
    expect(drain.floorTable).toBe(null);
    expect(setMode.key).toBe("SetMode");
  });

  /** @param {number|null} distance @returns {object[]} */
  const actionsAt = (distance) => collectContributions(
    [{ id: "me", name: "Mad Enhancement", rank: "B-", active: true, activeRules: [clause] }],
    { options: rollOptionsFor({ attacker: { id: "castor", partnerDistance: distance } }) },
  ).eventHandlers[0].actions;

  it("drains 20 and deactivates at 20 when the twins are apart", () => {
    const [drain, mode] = actionsAt(3);
    expect(drain.amount).toBe(20);
    expect(mode.whenValue.lte).toBe(20);
    // NO floor. *"Castor's Master loses 20 Health at the end of every Turn he
    // Acts; when its Health is 20 or less, ME is forcibly deactivated"* -- the
    // threshold and nothing about a minimum. The floor belongs to Heracles's
    // wording of the same clause, and the shared template gave it to all six
    // bearers until 2026-09-16 (Ch. 46 §46.4-C).
    expect(drain.floor).toBeUndefined();
  });

  it("drains 10 and deactivates at 10 when Castor stands beside Pollux", () => {
    // BOTH readings move together. `madEnhancementDrain` is deliberately one
    // number said twice for him, and halving only the drain would leave Mad
    // Enhancement running until the Master was under 20.
    const [drain, mode] = actionsAt(1);
    expect(drain.amount).toBe(10);
    expect(mode.whenValue.lte).toBe(10);
    expect(drain.floor).toBeUndefined();
  });

  it("does not halve for a Servant with no partner at all", () => {
    // The clause is on the SHARED template; this is what makes it inert for
    // Heracles, Asterios, Penthesilea, Kingprotea and Raikou.
    expect(actionsAt(null)[0].amount).toBe(20);
  });
});

/* ── Twin God's Divine Core (C22–C24, P15–P17, R10) ──────────────────────── */

describe("Twin God's Divine Core — one name, two abilities", () => {
  const his = ability("dioscuri-twin-gods-divine-core-castor");
  const hers = ability("dioscuri-twin-gods-divine-core-pollux");

  it("gives both the +80 the sheet prints, from the table", () => {
    expect(lookup("divineCore", Rank.parse("B"))).toBe(80);
    for (const doc of [his, hers]) {
      expect(doc.passiveRules.some((r) => r.key === "FlatDamage" && r.table === "divineCore"))
        .toBe(true);
    }
  });

  it("R10 — shares the NAME, which is what would share the cooldown", () => {
    expect(his.name).toBe(hers.name);
  });

  it("R10 — differs only in Passive 2", () => {
    expect(his.passiveRules.some((r) => r.key === "OnEvent" && r.chance === 5)).toBe(true);
    expect(hers.passiveRules.some((r) => r.key === "CritModifier" && r.value === 5)).toBe(true);
  });

  it("counts as Divinity, in both halves the clause needs", () => {
    for (const doc of [his, hers]) {
      expect(doc.categorizedAs).toContain("divinity");
      expect(doc.passiveRules.some((r) => r.stat === "attributes" && r.add?.includes("divine")))
        .toBe(true);
    }
  });
});

/* ── Oblivion Correction and Self-Replenishment (C8–C10) ─────────────────── */

describe("the rest of the Avenger set", () => {
  it("gives Oblivion Correction C the +15% Crit Chance his sheet prints", () => {
    expect(lookup("oblivionCorrection", Rank.parse("C"))).toBe(15);
  });

  it("restores 40 Health at Self-Replenishment D", () => {
    expect(lookup("selfReplenishmentHealth", Rank.parse("D"))).toBe(40);
  });

  it("R4 — fires on BOTH turn-end events, which Appendix E deduplicates", () => {
    const rule = classSkill("self-replenishment-mana").passiveRules[0];
    expect(rule.event).toEqual(["unitTurnEnd", "actedTurnEnd"]);
  });

  it("C10 — reduces the NP cooldown by LITERAL Turns, not ◈", () => {
    // `CooldownDelta` splits the two by field: `ticks` is a ◈ expression,
    // `delta` a raw count, and a `table:` feeds `delta`.
    const rule = classSkill("self-replenishment-mana").passiveRules[0];
    const cd = rule.then.find((a) => a.key === "CooldownDelta");
    expect(cd.table).toBe("selfReplenishmentCooldown");
    expect(cd.ticks).toBeUndefined();
    expect(lookup("selfReplenishmentCooldown", Rank.parse("D"))).toBe(2);
  });
});

/* ── The joint Noble Phantasm (N1–N10, R6, R11) ──────────────────────────── */

describe("Dioscures Tyndaridae", () => {
  const np = ability("dioscuri-tyndaridae");

  it("N3 — requires the twins to be adjacent", () => {
    expect(np.requirements).toEqual([{ kind: "counterpartAdjacent" }]);
  });

  it("N4/R1 — halves each twin's BA(STR), for a Base Attack of 150", () => {
    expect(np.damage.base.sources).toEqual([
      { unit: "self", component: "str", factor: 0.5 },
      { unit: "partner", component: "str", factor: 0.5 },
    ]);

    const twin = (id) => ({ id, name: id, baseAttack: { str: 150, mag: 150 }, modifiers: [] });
    const out = computeDamage({
      attacker: twin("castor"),
      units: { partner: twin("pollux") },
      defender: { id: "enemy", health: 9999, modifiers: [] },
      attack: { kind: "np", component: "str" },
      base: np.damage.base,
      rolls: { attackMinus: 0 },
      crit: { isCrit: false },
      options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "np" } }),
    });
    expect(out.breakdown.find((b) => b.name === "base").after.phys).toBe(150);
  });

  it("N5 — deals 3.5x, with Pierce and Ignore Def", () => {
    expect(np.damage.multiplier).toBe(3.5);
    expect(np.damage.pierce).toBe(true);
    expect(np.damage.ignoresDefUp).toBe(true);
  });

  it("N6/N7 — inflicts BOTH Def Dwn variants, at 15% each", () => {
    const effects = np.phases.find((p) => p.kind === "applyEffects").effects;
    expect(effects.map((e) => e.id).sort()).toEqual(["defDwnA", "defDwnC"]);
    for (const e of effects) expect(e.magnitude).toBe(15);
  });

  it("N8/R11 — counts as both twins' Attack", () => {
    expect(np.alsoCountsAsAttackFor).toBe("partner");
  });

  it("N9/R6 — combines both twins' modifier bags", () => {
    expect(np.damage.modifierSources).toEqual(["partner"]);
  });

  it("N10 — is a 6◈ Anti-Unit Noble Phantasm at Rank B", () => {
    expect(np.cooldown).toBe("6◈");
    expect(np.rank).toBe("B");
    expect(np.npTags).toEqual(["antiUnit"]);
    expect(np.isNP).toBe(true);
  });

  it("is carried by BOTH twins, as one document", () => {
    for (const twin of [castor, pollux]) {
      expect(twin.abilities.some((a) => a.ref === "dioscuri-tyndaridae")).toBe(true);
    }
  });
});

/* ── Mana Burst (C34–C41, P18–P19) ───────────────────────────────────────── */

describe("Mana Burst (Light/Ancient) — one name, two abilities", () => {
  const his = ability("dioscuri-mana-burst-castor");
  const hers = ability("dioscuri-mana-burst-pollux");

  it("shares the name, which is what shares the cooldown (D8)", () => {
    expect(his.name).toBe(hers.name);
    expect(his.cooldown).toBe("3◈-⅓◈");
    expect(hers.cooldown).toBe("3◈-⅓◈");
  });

  it("C36/P18 — combines BA(STR) and BA(MAG) for 300 on both", () => {
    for (const doc of [his, hers]) {
      expect(doc.damage.base.sources).toEqual([
        { unit: "self", component: "str", factor: 1 },
        { unit: "self", component: "mag", factor: 1 },
      ]);
    }
    // 150 + 150 on each twin. Her sheet's 350 is computed from the BA(STR) 200
    // the rank table overrules (R1).
    expect(baseAttackFor(castor).str + baseAttackFor(castor).mag).toBe(300);
    expect(baseAttackFor(pollux).str + baseAttackFor(pollux).mag).toBe(300);
  });

  it("C37/C38 — bypasses Magic Resistance and is half Light", () => {
    for (const doc of [his, hers]) {
      expect(doc.damage.ignoresMagicResistance).toBe(true);
      expect(doc.damage.element).toBe("light");
      expect(doc.damage.elementFraction).toBe(0.5);
    }
  });

  it("C35 — opens with a branching choice, before the damage", () => {
    const kinds = his.phases.map((p) => p.kind);
    expect(kinds[0]).toBe("choose");
    expect(kinds.indexOf("choose")).toBeLessThan(kinds.indexOf("damage"));

    const [alone, both] = his.phases[0].options;
    expect(alone.phases[0].changes).toEqual([
      { stat: "agility", delta: 2, clamp: true },
      { stat: "luck", delta: 2, clamp: true },
    ]);
    expect(both.phases[0].target).toBe("linkedGroup");
    expect(both.phases[0].changes).toEqual([
      { stat: "agility", delta: 1, clamp: true },
      { stat: "luck", delta: 1, clamp: true },
    ]);
  });

  it("C39 — inflicts Blind at 50% for 1◈", () => {
    for (const doc of [his, hers]) {
      const rider = doc.phases.find((p) => p.kind === "applyEffects" && p.target === "reuse")
        .effects.find((e) => e.id === "blind");
      expect(rider).toMatchObject({ chance: 50, duration: "1◈" });
    }
  });

  it("C40/P19 — differ only in the last clause", () => {
    // His reduces his NP Cooldown by 1◈; hers applies Evade for ⅓◈. That
    // difference is the whole reason these are two documents.
    const hisLast = his.phases.at(-1);
    expect(hisLast.rules[0]).toMatchObject({ key: "CooldownDelta", scope: "np", ticks: "1◈" });
    expect(hers.phases.at(-1).effects[0]).toMatchObject({ id: "evade", duration: "⅓◈" });
  });

  it("C34 — is an Attack Skill on both", () => {
    for (const doc of [his, hers]) expect(doc.isAttackSkill).toBe(true);
  });
});

/* ── The party skills (C25–C33, P20–P21, R7) ─────────────────────────────── */

describe("the two party skills, shared by both twins", () => {
  const stars = ability("dioscuri-stars-of-the-chief-god");
  const guardians = ability("dioscuri-guardians-of-navigation");

  it("R7 — both always include the partner, wherever she stands", () => {
    for (const doc of [stars, guardians]) {
      expect(doc.targeting.selection.alsoIncludes).toBe("partner");
    }
  });

  it("C25 — Stars applies BOTH buffs, to self and partner only", () => {
    expect(stars.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 0 });
    expect(stars.phases[0].effects.map((e) => e.id).sort()).toEqual(["castorBuff", "polluxBuff"]);
    for (const e of stars.phases[0].effects) expect(e.duration).toBe("1◈");
  });

  it("C29 — Guardians reaches allies within 2 panels", () => {
    expect(guardians.targeting.shape).toEqual({ kind: "chebyshevRadius", r: 2 });
  });

  it("C30–C32 — Guardians applies its three effects at the stated figures", () => {
    const e = guardians.phases[0].effects;
    expect(e.find((x) => x.id === "npDmUp")).toMatchObject({ magnitude: 15, duration: "⅓◈" });
    // 5 is not half of 15, so the NP figure is absolute rather than a factor.
    expect(e.find((x) => x.id === "atkUp")).toMatchObject({ magnitude: 15, npMagnitude: 5 });
    expect(e.find((x) => x.id === "debuffImmune")).toMatchObject({ applications: 1, duration: "1◈" });
  });

  it("C28/C33 — carry the cooldowns the sheet prints", () => {
    expect(stars.cooldown).toBe("4◈");
    expect(guardians.cooldown).toBe("3◈");
  });

  it("are one document each, referenced by both twins", () => {
    for (const twin of [castor, pollux]) {
      expect(twin.abilities.some((a) => a.ref === "dioscuri-stars-of-the-chief-god")).toBe(true);
      expect(twin.abilities.some((a) => a.ref === "dioscuri-guardians-of-navigation")).toBe(true);
    }
  });
});

describe("the paired buffs are complementary (C26–C27)", () => {
  const read = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));

  it("fire on opposite halves of one Normal Attack, so exactly one applies", () => {
    const polluxBuff = read("pollux-buff").rules[0];
    const castorBuff = read("castor-buff").rules[0];
    expect(polluxBuff.predicate).toEqual(["attack:kind:normal", { not: "attack:crit" }]);
    expect(castorBuff.predicate).toEqual(["attack:kind:normal", "attack:crit"]);
  });

  it("C26 — the Pollux buff hands out S.Crit Up at +10% for ⅓◈", () => {
    const action = read("pollux-buff").rules[0].then[0];
    expect(action).toMatchObject({ key: "ApplyEffect", duration: "⅓◈", magnitude: 10 });
    expect(action.effect.id).toBe("sCritUp");
  });

  it("C27 — the Castor buff turns the attacker's own NP clock by 1 literal Turn", () => {
    const action = read("castor-buff").rules[0].then[0];
    expect(action).toMatchObject({ key: "CooldownDelta", target: "self", scope: "np", delta: -1 });
    expect(action.ticks).toBeUndefined();
  });
});

/* ── Pollux's class skills (P5–P14, R9) ──────────────────────────────────── */

describe("Pollux's Riding is a fourth variant (R9)", () => {
  const riding = classSkill("riding-pollux");

  it("gates ALL THREE passives on the Active, unlike Medusa's two", () => {
    const grant = riding.passiveRules.find((r) => r.key === "GrantedAbility");
    expect(grant.abilities.sort()).toEqual(["doubleMove", "passengerSeat", "ridingAttack"]);
    expect(grant.predicate).toEqual(["self:effect:ridingActive"]);

    const medusa = classSkill("riding-medusa").passiveRules;
    expect(medusa.find((r) => !r.predicate).abilities).toEqual(["doubleMove"]);
  });

  it("P10 — grants MOV +4, which is ridingMov at B", () => {
    expect(riding.phases[0].rules[0].magnitude).toBe(4);
    expect(lookup("ridingMov", Rank.parse("B"))).toBe(4);
  });

  it("P14 — the MOV Up rides on an effect, not on activeRules", () => {
    // An ability with phases is USED rather than toggled, and
    // `contributionsOf` collects `activeRules` only for a mode -- so a MOV Up
    // authored there would be applied by nothing.
    expect(riding.activeRules).toBeUndefined();
  });
});

describe("P7 — Magic Resistance reaches Castor when he stands beside her", () => {
  const mr = classSkill("magic-resistance");

  it("carries a radius-1 aura scoped to the linked partner alone", () => {
    const aura = mr.passiveRules.find((r) => r.key === "Aura");
    expect(aura.radius).toBe(1);
    expect(aura.recipientRoles).toEqual(["linkedPartner"]);
  });

  it("is a ROLE, not a new relation — the partner is still an ordinary ally", () => {
    // `relationOf` returns one of self/ally/enemy/neutral. Returning `partner`
    // would have dropped Castor out of every ally-aura on the board, Pollux's
    // own Guardians of Navigation included.
    const aura = mr.passiveRules.find((r) => r.key === "Aura");
    expect(aura.relations).toEqual(["ally"]);
  });
});
