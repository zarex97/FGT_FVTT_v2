/**
 * @file Emiya Kiritsugu — the pure halves of his kit.
 * @see char_orig_sheets/Copia de Kiritsugu.md
 * @see docs/superpowers/specs/2026-09-12-kiritsugu-design.md
 *
 * Everything here is layer 1 or 2, so it runs without a world. The
 * document-touching halves — the out-of-turn shot, the damage-step strip, both
 * Noble Phantasms in flight — are live-tested and recorded in Ch. 45.
 *
 * Tests that assert an authored YAML shape are here to catch DRIFT, not to
 * prove behaviour: the Raikou pass produced a unit test that passed the whole
 * time while its clause did nothing, because it asserted the shape rather than
 * what the shape did.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { baseAttackFor } from "../../module/domain/base-attack.mjs";

const src = (dir, file) =>
  parse(readFileSync(join(process.cwd(), "packs/_source", dir, file), "utf8"));

describe("Kiritsugu — the statline", () => {
  const k = src("servants", "kiritsugu.yml");

  it("is the sheet's statline exactly", () => {
    expect(k.parameters).toEqual({ str: "D", end: "C", agi: "A+", mag: "B", luc: "E" });
    expect(k.baseHealth).toBe(1000);
    expect(k.mov).toBe(7);
    expect(k.range).toEqual({ panels: 3, targets: 1 });
    expect(k.baseAttack).toEqual({ str: 65, mag: 175 });
    expect(k.sustainability).toBe("8◈");
  });

  it("writes LUC as E so the rank shift to EX is observable (spec R2)", () => {
    // Authoring `luc: EX` would make Affection's RankShift invisible and leave
    // Skill Seal with nothing to take away.
    expect(k.parameters.luc).toBe("E");
  });

  it("reproduces Base Attack (MAG) and Base Health from the tables", () => {
    expect(lookup("baseAttackMagByMag", Rank.parse("B"))).toBe(175);
    expect(lookup("baseHealthByEnd", Rank.parse("C"))).toBe(1000);
  });

  it("PLAYS at the table's BA(STR) 75, not the sheet's 65 (Ch. 41 Q50)", () => {
    // The sheet prints 65 and Serenity's prints 65 too, so it looked like a
    // deliberate authorial figure for the set's two Assassins. It is not: the
    // author settled this generally --
    //
    //   "If you find a value of Base attack that differs from this calculation
    //    choose the value of this table instead of what is on the character
    //    sheet."
    //
    // So `baseAttackFor` DERIVES from the rank and the authored 65 is ignored.
    // The first draft of this test asserted `k.baseAttack.str === 65` and
    // passed while the game played 75 -- an assertion about the YAML rather
    // than about the behaviour, which is the exact failure this file's header
    // warns about. `validate:content` is what caught it.
    expect(baseAttackFor(k)).toEqual({ str: 75, mag: 175 });
    expect(k.baseAttack.str).toBe(65);   // what the sheet records, and is overruled
  });

  it("derives BA(MAG) to the same number the sheet prints", () => {
    // MAG B agrees at 175, which is why only the STR half was ever in dispute.
    expect(baseAttackFor(k).mag).toBe(k.baseAttack.mag);
  });

  it("swings with STR, as Semiramis does on the same silence (spec R7)", () => {
    expect(k.normalAttack).toEqual({ mode: "fixed", component: "str" });
    expect(src("servants", "semiramis.yml").normalAttack.component).toBe("str");
  });
});

describe("Kiritsugu — the two class skills are a ref and nothing else", () => {
  const k = src("servants", "kiritsugu.yml");
  const ref = (id) => k.abilities.find((a) => a.ref === id);

  it("carries Presence Concealment at A+ and Independent Action at A", () => {
    expect(ref("class-presence-concealment")).toEqual(
      { ref: "class-presence-concealment", rank: "A+" },
    );
    expect(ref("class-independent-action")).toEqual(
      { ref: "class-independent-action", rank: "A" },
    );
  });

  it("gets all six of their numbers from the rank tables", () => {
    // Presence Concealment A+ — the sheet says 5%, +4, 2◈.
    expect(lookup("presenceConcealmentDiscover", Rank.parse("A+"))).toBe(5);
    expect(lookup("presenceConcealmentEvade", Rank.parse("A+"))).toBe(4);
    expect(lookup("presenceConcealmentCooldown", Rank.parse("A+"))).toBe("2◈");
    // Independent Action A — the sheet says 8◈, 3 panels, 4 rolls.
    expect(lookup("independentActionSustainability", Rank.parse("A"))).toBe(8);
    expect(lookup("independentActionZon", Rank.parse("A"))).toBe(3);
    expect(lookup("independentActionContract", Rank.parse("A"))).toBe(4);
  });

  it("states the Sustainability the table already gives", () => {
    expect(k.sustainability).toBe(`${lookup("independentActionSustainability", Rank.parse("A"))}◈`);
  });
});

import { annotateAuras } from "../../module/rules/auras.mjs";
import { checkPlan } from "../../module/rules/checks.mjs";

describe("Affection of the Holy Grail — the aura", () => {
  // Two allies and an enemy, all within 2 panels of Kiritsugu.
  const board = () => ({
    units: [
      {
        id: "kiritsugu", panel: { i: 5, j: 5 }, factionId: "red",
        auras: [{
          key: "checkModifier", check: "luck", value: 4,
          radius: 2, relations: ["ally", "enemy"], stacking: "highestOnly",
          source: "Affection of the Holy Grail",
        }],
      },
      { id: "ally", panel: { i: 5, j: 6 }, factionId: "red", auras: [] },
      { id: "enemy", panel: { i: 6, j: 6 }, factionId: "blue", auras: [] },
      { id: "distant", panel: { i: 5, j: 12 }, factionId: "red", auras: [] },
    ],
  });
  const annotated = () => { const b = board(); annotateAuras(b.units, b); return b; };
  const find = (b, id) => b.units.find((u) => u.id === id);

  it("reaches an ALLY's checkModifiers, where checkPlan can read it", () => {
    // The whole defect this task fixes: without the route the contribution
    // lands in `modifiers` and `checkPlan` never sees it.
    const ally = find(annotated(), "ally");
    expect(ally.checkModifiers ?? []).toHaveLength(1);
    expect(checkPlan(ally, "luck").modifiers.map((m) => m.value)).toEqual([4]);
  });

  it("reaches an ENEMY too — the sheet says 'all Units'", () => {
    const enemy = find(annotated(), "enemy");
    expect(checkPlan(enemy, "luck").modifiers.map((m) => m.value)).toEqual([4]);
  });

  it("never reaches Kiritsugu himself — 'except himself'", () => {
    expect(checkPlan(find(annotated(), "kiritsugu"), "luck").modifiers).toEqual([]);
  });

  it("does not reach past 2 panels", () => {
    expect(checkPlan(find(annotated(), "distant"), "luck").modifiers).toEqual([]);
  });

  it("HINDERS the recipient — a check that passed at 10 now fails (spec R3)", () => {
    // `resolveCheck` succeeds on `total <= target`, so +4 moves a roll AWAY
    // from success. If this ever reads as a benefit, the sign is inverted.
    const mods = checkPlan(find(annotated(), "ally"), "luck").modifiers;
    const total = 10 + mods.reduce((a, m) => a + m.value, 0);
    expect(total).toBe(14);
    expect(total <= 12).toBe(false);   // a Luck of 12: passed at 10, fails now
  });
});

describe("Affection of the Holy Grail — Skill Seal is a hard counter (R2)", () => {
  const a = src("abilities", "kiritsugu-affection-of-the-holy-grail.yml");
  const rule = (key) => a.passiveRules.filter((r) => r.key === key);

  it("shifts LUC to EX by naming the rank, not by stepping", () => {
    const [shift] = rule("RankShift");
    expect(shift.parameter).toBe("luc");
    expect(shift.to).toBe("EX");
    // Stepping the dense +/- ladder from E would land on E+, not EX.
    expect(shift.steps).toBeUndefined();
  });

  it("turns the rank shift AND the aura off under Skill Seal", () => {
    for (const r of [rule("RankShift")[0], rule("Aura")[0]]) {
      expect(r.predicate).toContainEqual({ not: "self:effect:skillSeal" });
    }
  });

  it("adds +20 to his own Luck Checks only under Skill Seal", () => {
    const twenty = rule("CheckModifier").find((r) => r.value === 20);
    expect(twenty.check).toBe("luck");
    expect(twenty.predicate).toEqual(["self:effect:skillSeal"]);
  });

  it("never negates Skill Seal's own lockout", () => {
    // R2: his Skills stay sealed. Nothing here may Suppress the skill/spell
    // prevention `rules/budget.mjs` applies.
    expect(a.passiveRules.some((r) => r.key === "Suppress")).toBe(false);
  });

  it("addresses allies and enemies but omits self", () => {
    const [aura] = rule("Aura");
    expect(aura.relations).toEqual(["ally", "enemy"]);
    expect(aura.relations).not.toContain("self");
    expect(aura.radius).toBe(2);
    // The route added in this task — without it the contribution is inert.
    expect(aura.modifierKey).toBe("checkModifier");
  });
});

import { collectContributions } from "../../module/rules/elements.mjs";

describe("AttackProperty — a buff that grants an attack property", () => {
  const collect = (rules) =>
    collectContributions([{ name: "test", rules }]);

  it("collects onto attackProperties, not into modifiers", () => {
    const out = collect([{ key: "AttackProperty", property: "pierce", value: true }]);
    expect(out.attackProperties).toEqual([
      expect.objectContaining({ property: "pierce", value: true }),
    ]);
    // The whole point: `modifiers` is where an unrouted contribution goes to die.
    expect(out.modifiers).toEqual([]);
  });

  it("keeps a boolean boolean and a fraction numeric", () => {
    expect(collect([{ key: "AttackProperty", property: "ignoresDefUp", value: true }])
      .attackProperties[0].value).toBe(true);
    expect(collect([{ key: "AttackProperty", property: "invulnFactor", value: 0.5 }])
      .attackProperties[0].value).toBe(0.5);
  });

  it("defaults a bare property to true", () => {
    expect(collect([{ key: "AttackProperty", property: "pierce" }])
      .attackProperties[0].value).toBe(true);
  });

  it("is not silently dropped as an unknown key", () => {
    expect(collect([{ key: "AttackProperty", property: "pierce", value: true }])
      .unhandled).toEqual([]);
  });
});

describe("The Thaumaturgy Spells share a shape", () => {
  const ids = ["kiritsugu-reinforcement", "kiritsugu-familiars"];

  it.each(ids)("%s is a Spell of category thaumaturgy that is not an Attack", (id) => {
    const a = src("abilities", `${id}.yml`);
    expect(a.category).toBe("thaumaturgy");
    expect(a.isSpell).toBe(true);
    // `isSpell` is one of the three things that make an ability count as an
    // Attack, so leaving this unset would spend his Attack for the Turn.
    expect(a.countsAsAttack).toBe(false);
    expect(a.negatedBy).toContain("silence");
  });

  it("Reinforcement buffs NORMAL attacks only, for one Combat Phase", () => {
    const a = src("abilities", "kiritsugu-reinforcement.yml");
    const [eff] = a.phases[0].effects;
    // nAtkUp, not atkUp -- "Normal Attack damage" is explicit and a blanket
    // Atk Up would quietly buff both his Noble Phantasms.
    expect(eff.id).toBe("nAtkUp");
    expect(eff.magnitude).toBe(40);
    expect(eff.duration).toBe("⅓◈");
    expect(a.cooldown).toBe("2◈");
    expect(a.timing.window).toContain("combatPhaseStart");
  });

  it("is EMIYA's Reinforcement at a higher number", () => {
    const k = src("abilities", "kiritsugu-reinforcement.yml");
    const e = src("abilities", "emiya-reinforcement.yml");
    expect(k.phases[0].effects[0].id).toBe(e.phases[0].effects[0].id);
    expect(k.phases[0].effects[0].magnitude).toBeGreaterThan(e.phases[0].effects[0].magnitude);
  });

  it("Familiars grants both its buffs for 1◈", () => {
    const a = src("abilities", "kiritsugu-familiars.yml");
    const byId = Object.fromEntries(a.phases[0].effects.map((e) => [e.id, e]));
    expect(byId.rangeUp.magnitude).toBe(2);
    expect(byId.critUpFamiliar.magnitude).toBe(30);
    expect(byId.rangeUp.duration).toBe("1◈");
    expect(byId.critUpFamiliar.duration).toBe("1◈");
    expect(a.cooldown).toBe("4◈");
  });

  it("Crit Up (Familiar) is range-conditional and DEFERRED", () => {
    const [rule] = src("effects", "crit-up-familiar.yml").rules;
    expect(rule.check).toBe("crit");
    // The distance does not exist when the buff is applied, so answering the
    // predicate at collection time answers it wrong and drops the modifier.
    expect(rule.predicate).toEqual(["attack:range:gte:3"]);
  });

  it("Familiars' +2 Range widens the band its Crit Up applies to", () => {
    // His Range is 3, the Crit Up starts at 3, and the Range Up takes him to 5.
    // If the two numbers ever drift apart the Spell stops making sense.
    const k = src("servants", "kiritsugu.yml");
    const a = src("abilities", "kiritsugu-familiars.yml");
    const rangeUp = a.phases[0].effects.find((e) => e.id === "rangeUp");
    const critBand = Number(
      src("effects", "crit-up-familiar.yml").rules[0].predicate[0].split(":").pop(),
    );
    expect(critBand).toBe(k.range.panels);
    expect(k.range.panels + rangeUp.magnitude).toBe(5);
  });
});
