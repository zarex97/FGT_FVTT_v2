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
  // The aura is COLLECTED FROM THE ABILITY rather than hand-written here.
  // The first version of this test built the post-executor shape by hand, and
  // passed while `Aura` was dropping `check:` on the floor -- so `checkPlan`
  // filtered the contribution out for being a modifier to no check at all, and
  // nobody on a real board ever received it. A test that writes its own
  // fixture can only prove the half of the path below the fixture.
  const auraFromAbility = () => collectContributions([
    src("abilities", "kiritsugu-affection-of-the-holy-grail.yml"),
  ]).auras;

  // Two allies and an enemy, all within 2 panels of Kiritsugu.
  const board = () => ({
    units: [
      {
        id: "kiritsugu", panel: { i: 5, j: 5 }, factionId: "red",
        auras: auraFromAbility(),
      },
      { id: "ally", panel: { i: 5, j: 6 }, factionId: "red", auras: [] },
      { id: "enemy", panel: { i: 6, j: 6 }, factionId: "blue", auras: [] },
      { id: "distant", panel: { i: 5, j: 12 }, factionId: "red", auras: [] },
    ],
  });
  const annotated = () => { const b = board(); annotateAuras(b.units, b); return b; };
  const find = (b, id) => b.units.find((u) => u.id === id);

  it("names the check it modifies, or checkPlan cannot match it", () => {
    const [aura] = auraFromAbility();
    expect(aura.key).toBe("checkModifier");
    expect(aura.check).toBe("luck");
    expect(aura.value).toBe(4);
    expect(aura.radius).toBe(2);
  });

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
import * as normalizeMod from "../../module/rules/elements.mjs";

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

import { canUseAbility } from "../../module/rules/costs.mjs";

describe("Magecraft — one Thaumaturgy Spell per Turn", () => {
  const SPELLS = [
    { id: "i1", contentId: "kiritsugu-reinforcement", category: "thaumaturgy" },
    { id: "i2", contentId: "kiritsugu-familiars", category: "thaumaturgy" },
    { id: "i3", contentId: "kiritsugu-penetration", category: "thaumaturgy" },
    { id: "i4", contentId: "kiritsugu-scapegoat", category: null },
  ];
  const unit = (used) => ({
    id: "kiritsugu",
    abilities: SPELLS,
    categoryUseLimits: [{ category: "thaumaturgy", perTurn: 1, source: "Magecraft" }],
    turnState: { abilitiesUsed: used },
    effects: [], modifiers: [], suppressions: [], health: { value: 1000, max: 1000 },
  });
  const ability = (contentId, extra = {}) => ({
    id: SPELLS.find((s) => s.contentId === contentId).id,
    contentId,
    category: SPELLS.find((s) => s.contentId === contentId).category,
    cooldown: { remaining: 0, gatedDelay: 0 },
    ...extra,
  });
  const use = (a, u) => canUseAbility({ ability: a, unit: u, round: 1, turn: 1 });

  it("allows the first Spell of the Turn", () => {
    expect(use(ability("kiritsugu-reinforcement"), unit([])).ok).toBe(true);
  });

  it("refuses the SECOND, naming the category", () => {
    const r = use(ability("kiritsugu-familiars"), unit(["kiritsugu-reinforcement"]));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("categoryUseLimit");
    expect(r.detail.category).toBe("thaumaturgy");
  });

  it("counts a use recorded by its ITEM id as well as its content id", () => {
    // `recordAbilityUse` stamps both, and the two use paths had drifted before.
    const r = use(ability("kiritsugu-familiars"), unit(["i1"]));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("categoryUseLimit");
  });

  it("does not refuse an ability of a DIFFERENT category", () => {
    expect(use(ability("kiritsugu-scapegoat"), unit(["kiritsugu-reinforcement"])).ok).toBe(true);
  });

  it("exempts a use flagged bypassesCategoryLimit — the LGS free Spell", () => {
    // "This does not count towards the one Thaumaturgy Spell usage per Turn,
    // but it will still enter Cooldown." The exemption is why this cannot be
    // `sameTurnExclusive`, which names ids and has nowhere to put one.
    const a = ability("kiritsugu-penetration", { bypassesCategoryLimit: true });
    expect(use(a, unit(["kiritsugu-reinforcement"])).ok).toBe(true);
  });

  it("does not limit a Servant whose sheet declares no such rule", () => {
    const emiya = { ...unit(["kiritsugu-reinforcement"]), categoryUseLimits: [] };
    expect(use(ability("kiritsugu-familiars"), emiya).ok).toBe(true);
  });
});

describe("Magecraft — the cap is declared on the category", () => {
  const a = src("abilities", "kiritsugu-magecraft.yml");

  it("caps thaumaturgy at one a Turn", () => {
    const [rule] = a.passiveRules.filter((r) => r.key === "CategoryUseLimit");
    expect(rule.category).toBe("thaumaturgy");
    expect(rule.perTurn).toBe(1);
  });

  it("names a category rather than listing the Spells", () => {
    // A list of ids goes stale the moment a fourth Spell is authored, and --
    // decisively -- has nowhere to put the exemption the sheet grants.
    expect(a.passiveRules.some((r) => r.key === "sameTurnExclusive")).toBe(false);
    expect(JSON.stringify(a.passiveRules)).not.toMatch(/kiritsugu-reinforcement/);
  });

  it("catches every Spell he has by their own declared category", () => {
    for (const id of ["kiritsugu-reinforcement", "kiritsugu-familiars"]) {
      expect(src("abilities", `${id}.yml`).category).toBe("thaumaturgy");
    }
  });

  it("does not grant Thaumaturgy as a rule — `isSpell` routes it", () => {
    // A grant that added nothing would be a second, quieter place for the same
    // fact to be wrong. EMIYA's Magecraft makes the same argument.
    expect(a.passiveRules.some((r) => r.key === "GrantedAbility")).toBe(false);
  });
});

describe("Penetration — Invuln halves instead of negating", () => {
  const e = src("effects", "penetration.yml");

  it("grants both properties the sheet names", () => {
    const props = Object.fromEntries(
      e.rules.filter((r) => r.key === "AttackProperty").map((r) => [r.property, r.value]),
    );
    expect(props.ignoresDefUp).toBe(true);
    // "halves the effect of Invuln" -- half the damage gets through, so the
    // factor is what SURVIVES, not what is removed.
    expect(props.invulnFactor).toBe(0.5);
  });

  it("is not Pierce, and must not become it", () => {
    // Pierce is "Invuln does not apply"; this is "Invuln applies at half
    // strength". Collapsing them hands Penetration a bypass the sheet withholds
    // -- and he carries real Pierce separately, from Affection of the Holy Grail.
    expect(e.rules.some((r) => r.property === "pierce")).toBe(false);
  });

  it("lasts ⅓◈ and costs 3◈", () => {
    const a = src("abilities", "kiritsugu-penetration.yml");
    expect(a.phases[0].effects[0]).toEqual(
      expect.objectContaining({ id: "penetration", duration: "⅓◈" }),
    );
    expect(a.cooldown).toBe("3◈");
    expect(a.category).toBe("thaumaturgy");
  });
});

import { expand } from "../../module/rules/targeting/shapes.mjs";
import { ALLY_WINDOW } from "../../module/rules/windows.mjs";

describe("Scapegoat", () => {
  const a = src("abilities", "kiritsugu-scapegoat.yml");

  it("is offered on his own Turn AND when an ally is attacked", () => {
    expect(a.timing.window).toContain("ownTurn");
    expect(a.timing.window).toContain(ALLY_WINDOW);
  });

  it("applies its own Decoy variant, not the shared one", () => {
    // Lethal Gunfire Suppression triggers on THIS decoy specifically, so
    // sharing `decoy` would make Mannanán's self-applied Decoy fire his gun.
    expect(a.phases[0].effects[0].id).toBe("decoyScapegoat");
    expect(a.phases[0].effects[0].duration).toBe("1◈");
  });

  it("bypasses resistance, because it is applied to an ALLY", () => {
    // Without this a high-Debuff-Resist ally shrugs off the protection his own
    // side is trying to give him.
    expect(src("effects", "decoy-scapegoat.yml").allySelfBypassesResistance).toBe(true);
  });

  it("grants S.Crit Up at 15% for ⅓◈, unpreventable and unremovable", () => {
    const crit = a.phases[1].effects.find((e) => e.id === "sCritUp");
    expect(crit.magnitude).toBe(15);
    expect(crit.duration).toBe("⅓◈");
    const e = src("effects", "s-crit-up.yml");
    expect(e.unremovable).toBe(true);
    expect(e.baseChance).toBe(500);
  });

  it("costs 3◈ and spends no Attack", () => {
    expect(a.cooldown).toBe("3◈");
    expect(a.countsAsAttack).toBe(false);
  });
});

describe("Scapegoat — 'Kiritsugu OR the target' is one area, not two", () => {
  const disc = (origin, casterPanel, alsoAroundCaster) =>
    expand(
      { kind: "chebyshevRadius", r: 2, ...(alsoAroundCaster ? { alsoAroundCaster: true } : {}) },
      { panel: origin, casterPanel },
      {},
    ).panels;
  const keys = (panels) => panels.map((p) => `${p.i},${p.j}`);

  it("unions the caster's disc into the target's", () => {
    // Kiritsugu at (5,5), the chosen ally at (5,7) — two panels apart, the
    // farthest Scapegoat can reach.
    const both = disc({ i: 5, j: 7 }, { i: 5, j: 5 }, true);
    expect(keys(both)).toContain("5,9");   // the far edge of the target's disc
    expect(keys(both)).toContain("5,3");   // the far edge of Kiritsugu's
  });

  it("never lists a panel twice, so the overlap is buffed ONCE", () => {
    // `sCritUp` is `magnitudeStacks`. Two phases, one anchored on each, would
    // give everybody in the overlap 30% where the sheet says 15 — and it would
    // be the allies standing closest to both, which is most of them.
    const both = disc({ i: 5, j: 7 }, { i: 5, j: 5 }, true);
    expect(new Set(keys(both)).size).toBe(both.length);
  });

  it("is a strict superset of either disc alone", () => {
    const both = new Set(keys(disc({ i: 5, j: 7 }, { i: 5, j: 5 }, true)));
    const targetOnly = keys(disc({ i: 5, j: 7 }, { i: 5, j: 5 }, false));
    expect(targetOnly.every((k) => both.has(k))).toBe(true);
    expect(both.size).toBeGreaterThan(targetOnly.length);
  });

  it("leaves every other chebyshevRadius in the game untouched", () => {
    // The option is opt-in; without it the shape is exactly what it always was.
    const plain = disc({ i: 5, j: 7 }, { i: 5, j: 5 }, false);
    expect(plain).toHaveLength(25);
  });
});

describe("Scapegoat — the ally window needs a radius to fire at all", () => {
  it("declares the 2-panel reach the sheet states", () => {
    // `reactions.mjs` gates the ally-window offer on `timing.radius ?? 0`, so
    // an ability that names the window and omits the radius is offered only
    // when its owner is the defender -- the one case "an ALLIED Unit ... is
    // Attacked" does not describe. Authored without it first; caught by reading
    // the offer builder rather than by any test.
    expect(src("abilities", "kiritsugu-scapegoat.yml").timing.radius).toBe(2);
  });
});

import { reactionsRefused, reactionRefusedByAgility }
  from "../../module/rules/concealment.mjs";

describe("Lethal Gunfire Suppression — the reaction boundary", () => {
  const u = (agi) => ({ parameters: { agi }, effects: [] });

  it("refuses the whole ladder unless the AU's AGI is STRICTLY higher", () => {
    // "cannot be Reacted to unless the AU's AGI Rank is HIGHER than
    // Kiritsugu's." He is A+, so only EX escapes.
    expect(reactionRefusedByAgility(u("A+"), u("A"))).toEqual(["block", "counter", "evade"]);
    expect(reactionRefusedByAgility(u("A+"), u("A+"))).toEqual(["block", "counter", "evade"]);
    expect(reactionRefusedByAgility(u("A+"), u("EX"))).toEqual([]);
  });

  it("is ONE BOUNDARY apart from Presence Concealment's, deliberately", () => {
    // PC escapes on "equal to or higher" and names only Block and Counter,
    // leaving Evade open at +4. This escapes only on "higher" and names the
    // whole ladder. An equal-AGI defender keeps its reactions against PC and
    // loses them against the shot -- which is why the two comparisons live in
    // one file: two copies that must differ by exactly one step end up
    // differing by two.
    const concealed = { ...u("A+"), effects: ["presenceConcealment"] };
    expect(reactionsRefused(concealed, u("A+"))).toEqual([]);
    expect(reactionRefusedByAgility(u("A+"), u("A+"))).not.toEqual([]);
    expect(reactionsRefused(concealed, u("A"))).toEqual(["block", "counter"]);
    expect(reactionRefusedByAgility(u("A+"), u("A"))).toContain("evade");
  });

  it("refuses nothing when the shooter has no AGI Rank to compare", () => {
    expect(reactionRefusedByAgility(u(null), u("A"))).toEqual([]);
  });
});

import { allyReactions } from "../../module/rules/reactions.mjs";

describe("Lethal Gunfire Suppression — when the shot is offered", () => {
  const shot = {
    id: "shot", name: "Lethal Gunfire Suppression",
    system: {
      timing: {
        window: "whenAllyAttacked",
        radius: "@self.range.panels",
        radiusTo: "attacker",
        requiresDefenderEffect: "decoyScapegoat",
      },
      cooldown: { remaining: 0 },
    },
  };
  // Kiritsugu at (5,5) with Range 3; the bait ally far away at (5,12); the
  // attacker where the shooter can or cannot reach.
  const setup = ({ attackerPanel, defenderEffects = ["decoyScapegoat"], range = 3 }) => {
    const kiritsugu = {
      id: "kiritsugu", name: "Kiritsugu", panel: { i: 5, j: 5 },
      // A NUMBER, which is what `snapshotBoard` flattens `range` to. The first
      // version of this fixture wrote `{ panels: range }` -- the document's
      // shape -- and passed while the real board withheld the offer at every
      // distance, because `.panels` on a number is `undefined`.
      factionId: "red", range, effects: [], turnState: {},
    };
    const bait = {
      id: "bait", panel: { i: 5, j: 12 }, factionId: "red",
      effects: defenderEffects, turnState: {},
    };
    const foe = { id: "foe", panel: attackerPanel, factionId: "blue", effects: [] };
    const board = { units: [kiritsugu, bait, foe] };
    return allyReactions({
      defender: bait, attacker: foe, board, attack: { kind: "normal" },
      actorFor: (id) => (id === "kiritsugu" ? { items: [shot] } : { items: [] }),
    });
  };

  const setupUnits = ({ attackerPanel }) => {
    const run = (rangeValue) => {
      const kiritsugu = {
        id: "kiritsugu", name: "Kiritsugu", panel: { i: 5, j: 5 },
        factionId: "red", range: rangeValue, effects: [], turnState: {},
      };
      const bait = {
        id: "bait", panel: { i: 5, j: 12 }, factionId: "red",
        effects: ["decoyScapegoat"], turnState: {},
      };
      const foe = { id: "foe", panel: attackerPanel, factionId: "blue", effects: [] };
      const board = { units: [kiritsugu, bait, foe] };
      return allyReactions({
        defender: bait, attacker: foe, board, attack: { kind: "normal" },
        actorFor: (id) => (id === "kiritsugu" ? { items: [shot] } : { items: [] }),
      }).length;
    };
    return { withNumber: run(3), withObject: run({ panels: 3, targets: 1 }) };
  };

  it("offers the shot when the ATTACKER is inside his Range", () => {
    // The bait is 7 panels away and that is irrelevant: he is shooting the foe.
    expect(setup({ attackerPanel: { i: 5, j: 8 } })).toHaveLength(1);
  });

  it("withholds it when the attacker is out of his Range", () => {
    expect(setup({ attackerPanel: { i: 5, j: 9 } })).toHaveLength(0);
  });

  it("widens with his Range, so Familiars' +2 reaches further", () => {
    expect(setup({ attackerPanel: { i: 5, j: 10 }, range: 3 })).toHaveLength(0);
    expect(setup({ attackerPanel: { i: 5, j: 10 }, range: 5 })).toHaveLength(1);
  });

  it("reads the reach from either shape a Unit's range arrives in", () => {
    // `snapshotBoard` flattens to a number; a document carries
    // `{panels, targets}`. Three readers in the corpus have each been caught
    // assuming one of the two.
    const asObject = { ...setupUnits({ attackerPanel: { i: 5, j: 8 } }) };
    expect(asObject.withNumber).toBe(1);
    expect(asObject.withObject).toBe(1);
  });

  it("fires only for a Unit carrying HIS decoy", () => {
    // Without this the passive answers every attack on every ally in range,
    // and Scapegoat -- which is what pays for it -- stops mattering.
    expect(setup({ attackerPanel: { i: 5, j: 8 }, defenderEffects: [] })).toHaveLength(0);
    expect(setup({ attackerPanel: { i: 5, j: 8 }, defenderEffects: ["decoy"] })).toHaveLength(0);
  });
});

import { countsAsAttack, classifyAbility } from "../../module/rules/ability-use.mjs";

describe("The suppression shot is a NORMAL Attack, not an Attack Skill", () => {
  const doc = { system: src("abilities", "kiritsugu-suppression-shot.yml") };

  it("classifies as an attack, so it actually resolves damage", () => {
    expect(classifyAbility(doc).isAttack).toBe(true);
  });

  it("is NOT an Attack Skill or a Spell", () => {
    // The sheet says "perform a NORMAL Attack", and two of his own clauses read
    // that word: Reinforcement buffs `nAtkUp`, and Suppression's strip fires on
    // "Successful Normal Attacks". `isAttackSkill: true` would classify this as
    // `attackSkill` and quietly exclude it from both.
    expect(doc.system.isAttackSkill).toBeUndefined();
    expect(doc.system.isSpell).toBeUndefined();
    expect(doc.system.isNP).toBeUndefined();
    // A bare `damage` phase is what makes `abilityKind` answer "normal".
    expect(doc.system.phases.some((p) => p.kind === "damage")).toBe(true);
  });

  it("costs him nothing, but still reaches the damage pipeline (R1)", () => {
    // TWO separate fields, and the first draft used one. `countsAsAttack:
    // false` is the obvious way to make an attack free and it is wrong: that
    // flag also decides whether the ability resolves through the attack flow
    // at all, so it made the shot free AND toothless -- `useSkill` refuses a
    // `damage` phase outright. Found on the board: the button fired, the skill
    // reported success, and the target's Health did not move.
    expect(doc.system.freeAction).toBe(true);      // bills nobody
    expect(countsAsAttack(doc)).toBe(true);        // and still an Attack
  });

  it("has no cooldown of its own; Scapegoat is what it costs", () => {
    // Decoy (Scapegoat) lasts 1◈ behind a 3◈ cooldown and the attacker must be
    // in Range. That is the limiter, paid in advance.
    expect(doc.system.cooldown).toBeNull();
  });

  it("swings with his Base Attack once, no multiplier and no bonus", () => {
    expect(doc.system.damage).toEqual({ multiplier: 1, component: "str" });
  });

  it("aims at whoever swung", () => {
    expect(doc.system.targeting.anchor.kind).toBe("sourceOfAttack");
    expect(doc.system.targeting.selection.relations).toEqual(["enemy"]);
  });

  it("declares both the refusal and the free Spell it grants", () => {
    expect(doc.system.refusesReactionsUnlessFaster).toBe(true);
    expect(doc.system.offersSpellCategory).toBe("thaumaturgy");
  });
});

describe("Suppression — two clocks, and a use is a SUCCESSFUL strip (R5, R6)", () => {
  const e = src("effects", "suppression.yml");
  const handler = e.rules.find((r) => r.key === "OnEvent");

  it("carries a use count AND a duration", () => {
    expect(e.uses).toBe(5);
    expect(e.defaultDuration).toBe("1◈");
  });

  it("fires at the START of the damage step, not the end (R6)", () => {
    // If the strip lands late, a Def Up that should have been torn off still
    // reduces the hit -- and a test asserting only "a buff was removed" passes
    // anyway. The ordering IS the clause.
    expect(handler.event).toBe("damageStepStart");
  });

  it("is restricted to Normal Attacks", () => {
    expect(handler.predicate).toContain("attack:kind:normal");
  });

  it("strips from the DEFENDER, not from its own bearer", () => {
    // `RemoveEffect` names an effect and takes it off the bearer; this takes
    // whatever is there, off somebody else, and reports whether it managed it.
    const strip = handler.then.find((t) => t.key === "StripBuff");
    expect(strip.target).toBe("defender");
    expect(strip.count).toBe(1);
  });

  it("pays the follow-on ONLY when a buff actually came off", () => {
    const follow = handler.then.find((t) => t.key === "ApplyEffect");
    expect(follow.requiresRemoval).toBe(true);
    expect(follow.effect.id).toBe("atkUp");
    expect(follow.effect.magnitude).toBe(15);
    expect(follow.effect.npMagnitude).toBe(5);
    expect(follow.duration).toBe("1◈");
  });

  it("spends a use only on success, via consumesUse", () => {
    // `fireEvent` spends `consumesUse` the moment a handler fires;
    // `runDamageStepStartHandlers` honours it only when a strip succeeded,
    // which is what "SUCCESSFUL Normal Attacks" asks for.
    expect(handler.consumesUse).toBe(true);
  });

  it("does not refresh its uses when reapplied", () => {
    // `noneExtend`, so Magecraft's extension lengthens the clock without
    // handing him more strips than the five he paid for.
    expect(e.stacking).toBe("noneExtend");
  });
});

describe("Magecraft — Passive 2 extends the clock, not the uses", () => {
  const a = src("abilities", "kiritsugu-magecraft.yml");
  const ev = a.passiveRules.find((r) => r.key === "OnEvent");

  it("extends rather than reapplies", () => {
    expect(ev.ofCategory).toBe("thaumaturgy");
    const [then] = ev.then;
    expect(then.key).toBe("DurationExtension");
    expect(then.effect).toBe("suppression");
    expect(then.ticks).toBe("1◈");
    // A reapplication would refill the five uses.
    expect(ev.then.some((t) => t.key === "ApplyEffect")).toBe(false);
  });
});

describe("Lethal Gunfire Suppression — the Active", () => {
  const a = src("abilities", "kiritsugu-lethal-gunfire-suppression.yml");

  it("RESTORES 4 Luck without exceeding his maximum", () => {
    const [change] = a.phases.find((p) => p.kind === "resource").changes;
    expect(change.key).toBe("luck");
    expect(change.delta).toBe(4);
    expect(change.clampToMax).toBe(true);
  });

  it("applies Atk Up at 40%, or 30% for a Noble Phantasm", () => {
    const eff = a.phases.flatMap((p) => p.effects ?? []).find((e) => e.id === "atkUp");
    expect(eff.magnitude).toBe(40);
    expect(eff.npMagnitude).toBe(30);
  });

  it("states the five uses in ONE place — the effect", () => {
    const eff = a.phases.flatMap((p) => p.effects ?? []).find((e) => e.id === "suppression");
    expect(eff.uses).toBeUndefined();
    expect(src("effects", "suppression.yml").uses).toBe(5);
  });

  it("costs 4◈ and spends no Attack", () => {
    expect(a.cooldown).toBe("4◈");
    expect(a.countsAsAttack).toBe(false);
  });
});

import { cooldownChanges } from "../../module/engine/skill-use.mjs";

describe("Chronos Rose — the cooldown it imposes is the DEFENDER's", () => {
  // `cooldownChanges` is layer 3: a ◈ expression is resolved against the
  // world's turns-per-round, which only Foundry knows.
  globalThis.game ??= { settings: { get: () => 3 } };

  const np = (id) => ({ id, type: "noblePhantasm", system: {} });
  const caster = { id: "kiritsugu", items: [np("k-np1"), np("k-np2")] };
  caster.items.filter = Array.prototype.filter.bind(caster.items);
  const victim = { id: "victim", items: [np("v-np1")] };
  victim.items.filter = Array.prototype.filter.bind(victim.items);

  it("emits the change against the target, not the caster", () => {
    const phase = {
      kind: "cooldown",
      changes: [{ unit: "target", scope: "np", ticks: "1◈", direction: "up" }],
    };
    const out = cooldownChanges(phase, caster, null, null, victim);
    expect(out).toHaveLength(1);
    expect(JSON.stringify(out[0])).toContain("victim");
    expect(JSON.stringify(out[0])).not.toContain("kiritsugu");
  });

  it("still defaults to the caster when no unit is named", () => {
    // Every cooldown clause authored before this one is the caster's own, and
    // must stay that way.
    const phase = { kind: "cooldown", changes: [{ scope: "np", ticks: "1◈", direction: "down" }] };
    const out = cooldownChanges(phase, caster, null, null, victim);
    expect(out).toHaveLength(2);
    expect(JSON.stringify(out)).toContain("kiritsugu");
    expect(JSON.stringify(out)).not.toContain("victim");
  });
});

describe("Chronos Rose — the Noble Phantasm", () => {
  const a = src("abilities", "kiritsugu-chronos-rose.yml");

  it("is 3.5x + 100 with BA(STR) at Range 3", () => {
    expect(a.damage.multiplier).toBe(3.5);
    expect(a.damage.flatBonus).toBe(100);
    expect(a.damage.component).toBe("str");
    expect(a.targeting.anchor.range).toBe(3);
  });

  it("ignores Def on its own damage block, not via a buff", () => {
    // It belongs to this swing rather than to him; Penetration is the buff.
    expect(a.damage.ignoresDefUp).toBe(true);
  });

  it("inflicts Crit Dwn at 30% for 1◈", () => {
    const eff = a.phases.flatMap((p) => p.effects ?? []).find((e) => e.id === "critDwn");
    expect(eff.magnitude).toBe(30);
    expect(eff.duration).toBe("1◈");
  });

  it("pushes the DEFENDER's NP cooldown up by 1◈, not its own down", () => {
    const [change] = a.phases.find((p) => p.kind === "cooldown").changes;
    expect(change.unit).toBe("target");
    expect(change.scope).toBe("np");
    expect(change.ticks).toBe("1◈");
    expect(change.direction).toBe("up");
  });

  it("costs 6◈+⅓◈", () => expect(a.cooldown).toBe("6◈+⅓◈"));
});

import { applyBaseAttackModifiers } from "../../module/rules/snapshot.mjs";

describe("The Kiritsugu mark — both Base Attack components (R4)", () => {
  const marked = (baseAttack) => ({
    id: "victim",
    baseAttack: { ...baseAttack },
    baseAttackModifiers: [
      { factor: 0.5, components: ["str", "mag"], source: "Kiritsugu" },
    ],
  });

  it("halves BOTH components, not just the one the attack uses", () => {
    const u = marked({ str: 50, mag: 210 });
    applyBaseAttackModifiers(u);
    expect(u.baseAttack).toEqual({ str: 25, mag: 105 });
  });

  it("hurts a MAG attacker far more, which is the sheet's design", () => {
    // Medea 50/210 loses 105 off the number she actually attacks with; a STR
    // attacker loses the smaller half of theirs. A pipeline hook keyed on the
    // attack's own component would have missed whichever half was not in use
    // and passed every single-attack test.
    const caster = marked({ str: 50, mag: 210 });
    const swordsman = marked({ str: 150, mag: 100 });
    applyBaseAttackModifiers(caster);
    applyBaseAttackModifiers(swordsman);
    expect(210 - caster.baseAttack.mag).toBe(105);
    expect(150 - swordsman.baseAttack.str).toBe(75);
  });

  it("is idempotent — 'half of their ORIGINAL value', and it does not stack", () => {
    const u = marked({ str: 50, mag: 210 });
    applyBaseAttackModifiers(u);
    applyBaseAttackModifiers(u);
    expect(u.baseAttack).toEqual({ str: 25, mag: 105 });
  });

  it("leaves an unmarked Unit alone", () => {
    const u = { id: "x", baseAttack: { str: 65, mag: 175 }, baseAttackModifiers: [] };
    applyBaseAttackModifiers(u);
    expect(u.baseAttack).toEqual({ str: 65, mag: 175 });
  });

  it("floors rather than leaving a fraction on the sheet", () => {
    const u = marked({ str: 65, mag: 175 });
    applyBaseAttackModifiers(u);
    expect(u.baseAttack).toEqual({ str: 32, mag: 87 });
  });
});

describe("Mystery Bisection", () => {
  const a = src("abilities", "kiritsugu-mystery-bisection.yml");
  const e = src("effects", "kiritsugu-mark.yml");

  it("is 3x + 100 with BA(STR) at Range 1", () => {
    expect(a.damage.multiplier).toBe(3);
    expect(a.damage.flatBonus).toBe(100);
    expect(a.damage.component).toBe("str");
    expect(a.targeting.anchor.range).toBe(1);
  });

  it("rolls Instakill at 35% AFTER the damage, not before", () => {
    // The opposite of Scáthach's Gáe Bolg Alternative, which rolls first and
    // lets a success SUPPRESS the damage. Here the damage is the precondition.
    const phase = a.phases.find((p) => (p.effects ?? []).some((x) => x.id === "instakill"));
    expect(phase.when).toBe("afterDamage");
    expect(phase.effects.find((x) => x.id === "instakill").chance).toBe(35);
    expect(src("abilities", "scathach-gae-bolg-alternative.yml")
      .phases[0].when).toBe("beforeDamage");
  });

  it("marks with kiritsuguMark — never `kiritsugu` (R9)", () => {
    // An effect sharing a content id with its Servant is a build-breaking
    // collision; `raikou` hit it and had to become `raikouBuff`.
    expect(e.id).toBe("kiritsuguMark");
    expect(e.id).not.toBe(src("servants", "kiritsugu.yml").id);
  });

  it("is unremovable, non-stacking, and past BOTH protections", () => {
    expect(e.unremovable).toBe(true);
    expect(e.stacking).toBe("noneNoRefresh");
    // The immunity half rides the effect; the resistance half is a property of
    // the application, so it is named on the phase.
    expect(e.bypassesImmunity).toBe(true);
    const spec = a.phases.flatMap((p) => p.effects ?? [])
      .find((x) => x.id === "kiritsuguMark");
    expect(spec.ignoresResistanceFrom).toContain("debuffResUp");
    expect(spec.duration).toBe("permanent");
  });

  it("halves both components in the effect's own rule", () => {
    const [rule] = e.rules;
    expect(rule.key).toBe("BaseAttackModifier");
    expect(rule.factor).toBe(0.5);
    expect(rule.components).toEqual(["str", "mag"]);
  });

  it("costs 5◈+⅓◈", () => expect(a.cooldown).toBe("5◈+⅓◈"));
});

describe("Lethal Gunfire Suppression — a player can tell its two halves apart", () => {
  it("gives the shot a name distinct from the Active's", () => {
    // Both halves are one sheet entry, and both carried the same name -- two
    // identical rows on his sheet, and "Lethal Gunfire Suppression (Kiritsugu)"
    // twice in a reaction prompt. Found by looking at the live actor, not by
    // any test: nothing here compares two documents' names.
    const active = src("abilities", "kiritsugu-lethal-gunfire-suppression.yml").name;
    const shot = src("abilities", "kiritsugu-suppression-shot.yml").name;
    expect(shot).not.toBe(active);
    expect(shot.startsWith(active)).toBe(true);   // still recognisably the skill
  });
});

describe("Setup rolls read the Rank in force, not the one on paper", () => {
  it("rolls Max Luck from EX, which is what the passive grants", () => {
    // `sheetSnapshot` returned `toObject().system` -- the WRITTEN rank -- so
    // Kiritsugu was summoned with Max Luck off `E` (0 + 1d4) instead of `EX`
    // (20 + 1d4): FOUR Luck where he should have had twenty-odd, making an A+
    // rank Skill worth nothing at all. Measured live: 4, then 23.
    //
    // The clause that reverses it reads "instead of REDUCING his Max Luck",
    // which only means anything if the Rank was raising it to begin with.
    expect(lookup("baseLuckByLuc", Rank.parse("E"))).not.toEqual(
      lookup("baseLuckByLuc", Rank.parse("EX")),
    );
    // His written LUC is E precisely so the passive has something to raise.
    expect(src("servants", "kiritsugu.yml").parameters.luc).toBe("E");
    const shift = src("abilities", "kiritsugu-affection-of-the-holy-grail.yml")
      .passiveRules.find((r) => r.key === "RankShift");
    expect(shift.to).toBe("EX");
  });
});

describe("A Seal is visible on the button, not only at the bill (R2)", () => {
  const unit = (effects) => ({
    id: "kiritsugu", effects, abilities: [], modifiers: [], suppressions: [],
    turnState: { abilitiesUsed: [] }, categoryUseLimits: [],
    health: { value: 1000, max: 1000 },
  });
  const use = (ability, effects) => canUseAbility({
    ability: { cooldown: { remaining: 0, gatedDelay: 0 }, ...ability },
    // Round 6: a Noble Phantasm is gated until then, and that refusal lands
    // BEFORE this one -- so a round-1 fixture would test the gate, not the seal.
    unit: unit(effects), round: 6, turn: 18,
  });

  it("refuses a Skill under Skill Seal", () => {
    const r = use({ id: "s", contentId: "s" }, ["skillSeal"]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("prevented");
    expect(r.detail.by).toBe("skillSeal");
  });

  it("refuses a Spell under Skill Seal, and under Silence", () => {
    for (const seal of ["skillSeal", "silence"]) {
      const r = use({ id: "p", contentId: "p", isSpell: true }, [seal]);
      expect(r.ok, seal).toBe(false);
      expect(r.detail.by).toBe(seal);
    }
  });

  it("leaves Noble Phantasms alone under Skill Seal — Appendix A's own split", () => {
    // `Seal` spares Spells, `Silence` hits only them, `Skill Seal` takes both
    // and leaves NPs. Collapsing any two makes a different effect wrong.
    expect(use({ id: "np", contentId: "np", isNP: true }, ["skillSeal"]).reason)
      .not.toBe("prevented");
    expect(use({ id: "np", contentId: "np", isNP: true }, ["npSeal"]).detail?.by)
      .toBe("npSeal");
  });

  it("does not refuse a Spell under NP Seal", () => {
    expect(use({ id: "p", contentId: "p", isSpell: true }, ["npSeal"]).reason)
      .not.toBe("prevented");
  });

  it("refuses nothing when the Unit holds none of them", () => {
    expect(use({ id: "s", contentId: "s" }, []).ok).toBe(true);
  });
});

describe("An OnEvent's interior actions are `kind` once normalized", () => {
  it("authors `key` and normalizes to `kind` — a reader must accept both", () => {
    // `runDamageStepStartHandlers` read `action.key`, which is what the YAML
    // says. `normalizeActions` renames it to `kind`, so every action compared
    // `undefined` and the handler fired, matched its predicate, iterated its
    // two actions and did nothing with either. The strip silently never
    // happened; measured on the board as a Def Up that survived an attack it
    // should have been torn off before.
    const rule = src("effects", "suppression.yml").rules
      .find((r) => r.key === "OnEvent");
    for (const action of rule.then) expect(action.key).toBeTruthy();
    const { normalizeHandler } = normalizeMod;
    const h = normalizeHandler(rule, { rank: null, source: "suppression", ability: null, ctx: {} });
    for (const action of h.actions) expect(action.kind).toBeTruthy();
  });
});

describe("Mystery Bisection — 'if damage was dealt' is inherited, not authored", () => {
  const a = src("abilities", "kiritsugu-mystery-bisection.yml");

  it("puts both riders AFTER the damage", () => {
    // The opposite of Scáthach's Gáe Bolg Alternative, which rolls first and
    // lets a success SUPPRESS the damage. Here the damage is the precondition.
    const phase = a.phases.find((p) => (p.effects ?? []).some((x) => x.id === "instakill"));
    expect(phase.when).toBe("afterDamage");
    expect(phase.effects.map((e) => e.id)).toEqual(["instakill", "kiritsuguMark"]);
  });

  it("relies on the rider gate rather than restating it", () => {
    // `applyAbilityEffects` already refuses every rider on a negated attack --
    // "Nothing rides on an attack that dealt nothing" -- so the clause needs no
    // `requiresDamage` of its own, and authoring one would be a second place
    // for the same rule to be wrong.
    //
    // Measured live: against `antiPurge`, which halts the pipeline at stage 0,
    // eight uses produced 0 Instakills and 0 marks where ~3 Instakills would be
    // expected at 35%. Against an ordinary target, 30 uses produced 12
    // Instakills (40%) and 30 marks.
    const phase = a.phases.find((p) => (p.effects ?? []).some((x) => x.id === "instakill"));
    expect(phase.requiresDamage).toBeUndefined();
  });

  it("does not let a successful Instakill suppress the mark", () => {
    // Both riders sit in one `afterDamage` phase with no `skipIf` between them,
    // so a landed Instakill does not stop the debuff. Measured: the mark landed
    // on all 30 uses, including all 12 that killed.
    expect(a.damage.skipIf).toBeUndefined();
  });
});
