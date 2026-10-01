/**
 * @file Quetzalcoatl — the numbers her sheet prints, checked against the tables.
 * @see char_orig_sheets/Copia de Quetzalcoatl.md, docs/D-servant-data-sheets.md §D.28
 *
 * A statline that reproduces from `domain/tables.mjs` is a statline nobody has
 * to maintain. These assertions exist so that a later correction to a rank
 * table either propagates to her sheet or fails here — the alternative is nine
 * numbers transcribed by hand that quietly stop agreeing with the game.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { lookupNumber } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { aoePassengerFactor } from "../../module/rules/platforms.mjs";
import { expectedDamage, neutralDefender } from "../../module/rules/np-strength.mjs";
import { damageBaseOf } from "../../module/rules/damage/instances.mjs";
import { importAttack } from "../helpers/engine.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";
import { budgetActionFor } from "../../module/rules/budget.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

const R = (s) => Rank.parse(s);

/** @param {string} dir @param {string} id */
const load = (dir, id) => parse(readFileSync(`packs/_source/${dir}/${id}.yml`, "utf8"));
const ability = (id) => load("abilities", id);
const servant = () => load("servants", "quetzalcoatl");

describe("Quetzalcoatl — the statline reproduces from the tables", () => {
  const sheet = servant();

  it("BA(STR) 125 from STR B", () => {
    expect(lookupNumber("baseAttackStrByStr", R("B"))).toBe(125);
    expect(sheet.baseAttack.str).toBe(125);
  });

  it("BA(MAG) 250 from MAG EX — the highest in either roster", () => {
    expect(lookupNumber("baseAttackMagByMag", R("EX"))).toBe(250);
    expect(sheet.baseAttack.mag).toBe(250);
  });

  it("Base Health 1250 from END B", () => {
    expect(lookupNumber("baseHealthByEnd", R("B"))).toBe(1250);
    expect(sheet.baseHealth).toBe(1250);
  });

  it("Riding EX gives MOV +6, which her sheet prints and does not author", () => {
    expect(lookupNumber("ridingMov", R("EX"))).toBe(6);
  });

  it("Riding EX bands to a 3◈ cooldown, which her sheet also prints", () => {
    const riding = sheet.abilities.find((a) => a.ref === "class-riding");
    expect(riding.cooldown).toBe("3◈");
  });

  it("Divine Core EX gives +120 — exactly twice Divinity EX", () => {
    expect(lookupNumber("divineCore", R("EX"))).toBe(120);
    expect(lookupNumber("divineCore", R("EX"))).toBe(2 * lookupNumber("divinity", R("EX")));
  });

  it("Magic Resistance A negates up to A and halves the rest", () => {
    expect(lookupNumber("magicResistancePercent", R("A"))).toBe(50);
  });

  it("Magic Resistance A reduces debuff chance by 25%", () => {
    expect(lookupNumber("magicResistanceDebuffResist", R("A"))).toBe(25);
  });

  it("reuses the SHARED Riding and Magic Resistance documents, unaltered", () => {
    // Her Riding and MR text are verbatim the class documents, including MR's
    // Instakill/Death/Erase paragraph. A variant would be four numbers and one
    // paragraph maintained twice.
    const refs = sheet.abilities.map((a) => a.ref);
    expect(refs).toContain("class-riding");
    expect(refs).toContain("class-magic-resistance");
    expect(refs).not.toContain("class-riding-quetz");
  });

  it("does not author the Divine attribute — the Skill grants it", () => {
    expect(sheet.attributes).not.toContain("divine");
    const core = ability("quetz-goddesses-divine-core");
    const grant = core.passiveRules.find((r) => r.key === "StatDelta");
    expect(grant.add).toEqual(["divine"]);
  });
});

describe("Charisma of the Sun", () => {
  const skill = ability("quetz-charisma-of-the-sun");

  it("buffs a 2-panel area, which is a 5x5 block", () => {
    expect(skill.targeting.shape).toEqual({ kind: "square", size: 5 });
  });

  it("includes herself, per the corpus reading of 'all allied Units'", () => {
    expect(skill.targeting.selection.includeSelf).toBe(true);
  });

  it("halves the Atk Up against Noble Phantasms, as the sheet states", () => {
    const atk = skill.phases[0].effects.find((e) => e.id === "atkUp");
    expect(atk.magnitude).toBe(30);
    expect(atk.npMagnitude).toBe(15);
  });

  it("applies Sol to herself alone, not to every ally in range", () => {
    const selfPhase = skill.phases.find((p) => p.target === "self" && p.kind === "applyEffects");
    expect(selfPhase.effects.map((e) => e.id)).toEqual(["sol"]);
  });

  it("paints FOLLOWING sunlight, which is what 'around Quetz' means", () => {
    const zone = skill.phases.find((p) => p.kind === "zone");
    expect(zone.spec.terrain).toEqual(["sunlight"]);
    expect(zone.spec.followsSource).toBe(true);
    expect(zone.spec.shape).toEqual({ kind: "square", size: 5 });
  });

  it("tags the area so the buff's expiry can erase it", () => {
    // The tag `sol:<unitId>` is what `Terrain.attach`'s deleteActiveEffect hook
    // clears; if these two ever disagree the daylight becomes permanent.
    expect(skill.phases.find((p) => p.kind === "zone").spec.tag).toBe("sol:@self.id");
  });
});

describe("Good God's Wisdom", () => {
  const skill = ability("quetz-good-gods-wisdom");

  it("revives at 10% of Max Health — a fraction, not a number", () => {
    // `guts.yml` reads its magnitude as `restore: {percentOfMax: "@magnitude"}`,
    // so 10 is 10% and the chosen ally's own maximum decides the rest.
    expect(skill.phases[0].effects.find((e) => e.id === "guts").magnitude).toBe(10);
  });

  it("targets exactly one ally, chosen", () => {
    expect(skill.targeting.selection.count).toBe(1);
    expect(skill.targeting.selection.chooser).toBe("chosen");
  });

  it("carries the banded cooldown her sheet prints", () => {
    expect(skill.cooldown).toBe("4◈-⅓◈");
  });
});

describe("Lucha Libre", () => {
  const skill = ability("quetz-lucha-libre");

  it("names Xiuhcoatl by CONTENT id, which is what content can name", () => {
    const change = skill.phases.find((p) => p.kind === "cooldown").changes[0];
    expect(change.abilityIds).toEqual(["quetz-xiuhcoatl"]);
    expect(change.ticks).toBe("1◈");
    expect(change.direction).toBe("down");
  });

  it("does not use `abilityId`, which takes an id no sheet can know", () => {
    const change = skill.phases.find((p) => p.kind === "cooldown").changes[0];
    expect(change.abilityId).toBeUndefined();
  });
});

describe("Xiuhcoatl", () => {
  const np = ability("quetz-xiuhcoatl");

  it("combines BA(STR) with HALF BA(MAG) to reach the 250 her sheet prints", () => {
    const str = lookupNumber("baseAttackStrByStr", R("B"));
    const mag = lookupNumber("baseAttackMagByMag", R("EX"));
    expect(str + mag / 2).toBe(250);
    // Authored as two sources rather than the literal, so a buff to either
    // Parameter moves the half it should. Under `damage.base`, the long
    // spelling every reader has always known; what the engine DOES with them is
    // proved below, on the real item.
    expect(np.damage.base.sources).toEqual([
      { unit: "self", component: "str", factor: 1 },
      { unit: "self", component: "mag", factor: 0.5 },
    ]);
  });

  it("uses a DIFFERENT base attack for the splash — MAG alone", () => {
    // The same number as the primary by coincidence, from a different source.
    expect(np.aftermath.damage.sources).toEqual([
      { unit: "self", component: "mag", factor: 1 },
    ]);
    expect(lookupNumber("baseAttackMagByMag", R("EX"))).toBe(250);
  });

  it("deals 4x on the primary and 1x on the splash", () => {
    expect(np.damage.multiplier).toBe(4);
    expect(np.aftermath.damage.multiplier).toBe(1);
  });

  it("fires the splash unconditionally, as 'regardless of whether' demands", () => {
    expect(np.aftermath.unconditional).toBe(true);
  });

  it("spares herself and the Unit already targeted", () => {
    expect(np.aftermath.targeting.selection.includeSelf).toBe(false);
    expect(np.aftermath.targeting.selection.excludePrimaryTarget).toBe(true);
  });

  it("gives the splash WEAKER riders than the primary — four different numbers", () => {
    const seal = np.aftermath.effects.find((e) => e.id === "npSeal");
    const burn = np.aftermath.effects.find((e) => e.id === "burn");
    expect(seal.chance).toBe(25);
    expect(seal.duration).toBe("1◈");
    expect(burn.duration).toBe("1◈");

    const primaryRules = np.phases.find((p) => p.kind === "applyEffects").rules;
    expect(primaryRules.find((r) => r.effect.id === "burn").duration).toBe("2◈");
    // The primary's NP Seal has no chance at all: it is unconditional.
    expect(primaryRules.find((r) => r.effect.id === "npSeal").chance).toBeUndefined();
  });

  it("carries elementFraction 0.5 for '(half)', and the splash does not", () => {
    expect(np.damage.elementFraction).toBe(0.5);
    expect(np.aftermath.damage.elementFraction).toBeUndefined();
  });

  it("bypasses Magic Resistance on the hit on the DU, and NOT on the splash (ruled 2026-10-01)", () => {
    // "That hit on the DU is not affected by Magic Resistance": only the hit.
    // The splash was authored exempt as well, and deleting the line changed
    // nothing, because the aftermath inherited the primary's flag. That is what
    // the behavioural block below proves.
    expect(np.damage.ignoresMagicResistance).toBe(true);
    expect(np.aftermath.damage.ignoresMagicResistance).toBeUndefined();
  });

  it("cannot be used while she is Riding the Quetzalcoatlus", () => {
    const gate = np.requirements.find((r) => r.kind === "predicate");
    expect(gate.predicate).toEqual([{ not: "self:onPlatform:quetzalcoatlus" }]);
  });

  it("paints Burning on a nearby Fortress NP, permanently", () => {
    const zone = np.phases.find((p) => p.kind === "zone");
    expect(zone.spec.terrain).toEqual(["burning"]);
    expect(zone.spec.shape).toBe("fortressNearby");
    // "until the Fortress NP is deactivated" -- not a duration.
    expect(zone.spec.duration).toBe(null);
  });
});

// #135. Her primary authored its two sources at the top of the damage block; the
// resolution read `damage.base`, failed, and built one source from
// `component: str`, so she dealt the STR half of `BA = 250` and lost the rest.
// The card, the preview and the ranking read the same way and agreed on 500.
// A YAML-shape assertion cannot see that, so these go through the real item.
describe("Xiuhcoatl's base attack, on the real item (#135)", () => {
  beforeAll(prepareSubjects, 60_000);

  const halves = [
    { unit: "self", component: "str", factor: 1 },
    { unit: "self", component: "mag", factor: 0.5 },
  ];
  const strOnly = [{ unit: "self", component: "str", factor: 1 }];

  /** `damage` rewritten: the real item's block with another base under it. */
  const variant = (sys, over) => ({ ...sys, damage: { ...sys.damage, base: undefined, sources: undefined, ...over } });
  const onBoard = (fn) => withSubjects([{ from: "quetzalcoatl" }], ({ unit, world }) => {
    const item = world.actor("quetzalcoatl").items.find((i) => i.system.contentId === "quetz-xiuhcoatl");
    return fn({ item, sys: item.system.toObject?.() ?? item.system, self: unit("quetzalcoatl") });
  });

  it("is the real item that the corpus authors, with both halves on it", async () => {
    const base = await onBoard(({ sys }) => damageBaseOf(sys.damage));
    expect(base.sources).toEqual(halves);
  });

  it("deals the whole of 'BA(STR) plus half of BA(MAG)', not the STR half alone", async () => {
    const [real, both, half] = await onBoard(({ item, sys, self }) => [
      expectedDamage(item, self),
      expectedDamage({ id: item.id, system: variant(sys, { base: { sources: halves } }) }, self),
      expectedDamage({ id: item.id, system: variant(sys, { base: { sources: strOnly } }) }, self),
    ]);
    expect(real).toBe(both);
    expect(real).toBeGreaterThan(half * 1.5);
  });

  it("reads the short spelling the same as the long one, wherever a block authors it", async () => {
    // Nemo's two blocks author `damage.sources` and are right only because it
    // equals their `component`; adding a factor to either must not drop it.
    const [short, long] = await onBoard(({ item, sys, self }) => [
      expectedDamage({ id: item.id, system: variant(sys, { sources: halves }) }, self),
      expectedDamage({ id: item.id, system: variant(sys, { base: { sources: halves } }) }, self),
    ]);
    expect(short).toBe(long);
  });
});

// #136. `declareAftermath` overlaid a few keys on the PRIMARY's attack spec and
// `applyDamage` then re-read everything else from the primary's damage block, so
// the splash inherited the primary's element fraction ("Fire damage (half)"
// where the sheet says plain "Fire damage"), its Magic Resistance exemption (the
// author ruled the splash IS affected), and an `areaPanels` holding the DU's one
// panel. Built from the real corpus, because the YAML says what was written and
// not what the engine read.
describe("Xiuhcoatl's splash is its own resolution (#136)", () => {
  beforeAll(async () => { await prepareSubjects(); await importAttack(); }, 60_000);

  const at = (i, j) => ({ i, j });

  /** Quetzalcoatl and a Magic Resistance A defender (Pollux), with the engine in reach. */
  const seen = (fn) => withSubjects([
    { from: "quetzalcoatl", panel: at(6, 6) },
    { from: "pollux", panel: at(5, 7) },
  ], async ({ unit, world }) => {
    const engine = await importAttack();
    const doc = world.actor("quetzalcoatl");
    const item = doc.items.find((i) => i.system.contentId === "quetz-xiuhcoatl");
    const options = rollOptionsFor({ attacker: unit("quetzalcoatl") });
    const caught = (panels = []) => ({ panels, units: [] });
    return fn({
      engine, doc, item, options, unit,
      hit: () => engine.buildAttackSpec({ attacker: doc, ability: item, abilityId: item.id, options }),
      splash: (panels) => engine.aftermathSpecFor({ attacker: doc, ability: item, options, caught: caught(panels) }),
    });
  });

  /** What the pipeline deals under one resolution's spec and block, against one defender. */
  const dealt = ({ unit, attack, defender, block }) => computeDamage({
    // Without her passives: Divine Core's +120 is not what this block is about.
    attacker: { ...unit("quetzalcoatl"), modifiers: [] },
    defender,
    board: {},
    attack: { ...attack, rank: Rank.parse("A"), categorizedAsNP: false },
    base: damageBaseOf(block),
    multiplier: block.multiplier ?? 1,
    flatBonus: block.flatBonus ?? 0,
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" }, luckChecks: {}, rolls: {}, options: new Set(),
  });

  // What a Waterside panel puts on whoever stands on it (`rules/terrain.mjs`);
  // added here because the thing under test is the attack spec, not the terrain's
  // projection.
  const waterside = (u) => ({
    ...u,
    modifiers: [...(u.modifiers ?? []), { key: "elementDefUp", element: "fire", value: 50, source: "Waterside", predicate: null }],
  });

  it("damageBlockFor is the aftermath's own block for the splash, and the primary's otherwise", async () => {
    const [primary, splash, plain] = await seen(({ engine, item, options }) => [
      engine.damageBlockFor(item, options, { isAftermath: false }),
      engine.damageBlockFor(item, options, { isAftermath: true }),
      engine.damageBlockFor(item, options, null),
    ]);
    expect(primary.multiplier).toBe(4);
    expect(plain.multiplier).toBe(4);
    expect(splash.multiplier).toBe(1);
    expect(splash.component).toBe("mag");
  });

  it("the hit on the DU is Fire (half) and the splash is whole Fire", async () => {
    const [hit, splash] = await seen(({ hit, splash }) => [hit(), splash()]);
    expect(hit.element).toBe("fire");
    expect(hit.elementFraction).toBe(0.5);
    expect(splash.element).toBe("fire");
    expect(splash.elementFraction).toBeUndefined();
  });

  it("the splash is affected by Magic Resistance, and the hit on the DU is not (ruled)", async () => {
    const [hit, splash] = await seen(({ hit, splash }) => [hit(), splash()]);
    expect(hit.ignoresMagicResistance).toBe(true);
    expect(splash.ignoresMagicResistance).toBe(false);
  });

  it("a Magic Resistance A defender in the splash has stage 11 applied, not bypassed", async () => {
    const out = await seen(({ hit, splash, item, unit }) => ({
      splash: dealt({ unit, attack: splash(), defender: unit("pollux"), block: item.system.aftermath.damage }),
      hit: dealt({ unit, attack: hit(), defender: unit("pollux"), block: item.system.damage }),
    }));
    const stage11 = (result) => JSON.stringify(result.breakdown.find((b) => b.index === 11));
    expect(stage11(out.hit)).toMatch(/bypass/i);
    expect(stage11(out.splash)).not.toMatch(/bypass/i);
    expect(stage11(out.splash)).toMatch(/MR/);
  });

  it("deals 250 on plain ground and 125 on Waterside, as whole Fire does", async () => {
    const [plain, wet] = await seen(({ splash, item, unit }) => {
      const block = item.system.aftermath.damage;
      return [
        dealt({ unit, attack: splash(), defender: neutralDefender(), block }).total,
        dealt({ unit, attack: splash(), defender: waterside(neutralDefender()), block }).total,
      ];
    });
    expect(plain).toBe(250);
    // Whole Fire against Fire def +50 is 125. "Fire damage (half)", which the
    // splash inherited, gave 187: the half that is Fire is resisted, the rest not.
    expect(wet).toBe(125);
  });

  it("the splash's area is the panels it caught, not the DU's one panel", async () => {
    const panels = Array.from({ length: 25 }, (_, n) => at(4 + Math.floor(n / 5), 4 + (n % 5)));
    const spec = await seen(({ splash }) => splash(panels));
    expect(spec.areaPanels.length).toBe(25);
    expect(spec.isAftermath).toBe(true);
  });

  it("applyDamage reads the splash's block through the one answer, and no overlay is left", () => {
    const engine = readFileSync("module/engine/attack.mjs", "utf8").replaceAll("\r\n", "\n");
    const from = engine.indexOf("async function applyDamage");
    const body = engine.slice(from, engine.indexOf("\n}\n", from));
    expect(body).toMatch(/damageBlockFor\(ability, options, state\.attack\)/);
    expect(body).not.toMatch(/facts\.isAftermath/);
    expect(body).not.toMatch(/resolvedDamage\(/);
    const declare = engine.slice(engine.indexOf("async function declareAftermath"));
    expect(declare.slice(0, declare.indexOf("\n}\n"))).not.toMatch(/\.\.\.\(spec\.damage/);
  });
});

describe("the Quetzalcoatlus", () => {
  const mount = load("platforms", "quetzalcoatlus");

  it("shares panels rather than displacing — not Bašmu's flag", () => {
    expect(mount.sharesPanel).toBe(true);
    expect(mount.movesOntoOccupiedPanels).toBeUndefined();
  });

  it("gives the three AoE tiers her sheet states", () => {
    const platform = { id: "m", crossLevel: mount.crossLevel };
    // "the Quetzalcoatlus receives full damage" — the function's own
    // `unit.id === platform.id` branch, which is the third tier and is not
    // authored anywhere.
    expect(aoePassengerFactor({ id: "m", kind: "platform" }, platform)).toBe(1);
    // "Quetz receives 50% Total Damage"
    expect(aoePassengerFactor({ id: "q", kind: "servant" }, platform)).toBe(0.5);
    // "her Master receives no damage and effects"
    expect(aoePassengerFactor({ id: "k", kind: "master" }, platform)).toBe(0);
  });

  it("cannot be targeted at all from outside", () => {
    expect(mount.crossLevel.occupantTargeting).toBe("forbidden");
  });

  it("lets its riders shoot out, which is her whole reason to be up there", () => {
    expect(mount.crossLevel.outboundTargeting).toBe("free");
  });

  it("is driven by its owner and not by her Master", () => {
    expect(mount.replacesRiderAction).toEqual({
      roles: ["owner"], move: true, normalAttack: true,
    });
  });

  it("charges her Master 25 per period and closes rather than overdrawing", () => {
    expect(mount.upkeep.every).toBe("1◈");
    expect(mount.upkeep.cost.amount).toBe(25);
    expect(mount.upkeep.cost.payer).toBe("ownerMaster");
    expect(mount.upkeep.endWhenUnaffordable).toBe(true);
  });

  it("cannot be switched off for 2 Rounds' worth of Turns", () => {
    expect(mount.deactivation).toEqual({ byOwner: true, window: "any", lockout: "2◈" });
  });

  it("shares Quetz's Luck rather than stating a number", () => {
    expect(mount.inherit.luck).toEqual({ from: "summoner" });
  });

  it("is one panel, not the schema's default 3x3", () => {
    expect(mount.footprint).toEqual({ w: 1, h: 1 });
  });
});

describe("Quetzalcoatl: Winged Serpent", () => {
  const np = ability("quetz-winged-serpent");

  it("is non-damaging: phases, and no damage phase among them", () => {
    expect(np.phases.some((p) => p.kind === "damage")).toBe(false);
    expect(np.damage).toBeUndefined();
  });

  it("counts its cooldown from the mount's DEATH, not from the cast", () => {
    expect(np.cooldown).toEqual({ max: "7◈", countFrom: "destroyed" });
  });

  it("boards her Master only if he is already adjacent", () => {
    const phase = np.phases.find((p) => p.kind === "summonPlatform");
    expect(phase.platformId).toBe("quetzalcoatlus");
    expect(phase.boardMasterIfAdjacent).toBe(true);
  });
});

describe("the three Quetzalcoatlus Spells", () => {
  const ids = ["quetz-tlahuitequiliztli", "quetz-ehecatle", "quetz-tlaelquiyahuitl"];
  const spells = ids.map(ability);

  it("share one cooldown, and each starts the others' clocks", () => {
    for (const s of spells) {
      expect(s.exclusionSet).toBe("quetzalcoatlusSpells");
      // The set alone would gate nothing: something has to START the other two.
      expect(s.alsoTriggers).toEqual([{ exclusionSet: "quetzalcoatlusSpells" }]);
      expect(s.cooldown).toBe("2◈");
    }
  });

  it("each hits a 3x3 within Range 4 for 2x", () => {
    for (const s of spells) {
      expect(s.targeting.anchor.range).toBe(4);
      expect(s.targeting.shape).toEqual({ kind: "square", size: 3 });
      expect(s.damage.multiplier).toBe(2);
    }
  });

  it("hit ENEMIES only: not her allies, her mount or her Master (ruled 2026-10-01)", () => {
    // The sheet says "hits a 3x3 panel area" and is silent on who; the author
    // ruled enemies only. The content authored every relation, so the Spell
    // hit the Units standing beside her too.
    const at = (i, j) => ({ i, j });
    const unit = (id, i, j, over = {}) => ({
      id, panel: at(i, j), kind: "servant", faction: "b", attributes: [], effects: [], ...over,
    });
    const quetz = unit("quetz", 6, 6, { faction: "a", range: 2 });
    const board = {
      bounds: squareBounds(13),
      alliances: { a: ["a"], b: ["b"] },
      seed: 1,
      units: [
        quetz,
        unit("ally", 6, 9, { faction: "a" }),
        unit("master", 7, 9, { faction: "a", kind: "master" }),
        unit("mount", 6, 10, { faction: "a", kind: "platform" }),
        unit("foe", 5, 9),
        unit("foe2", 5, 10),
      ],
    };
    for (const s of spells) {
      const hit = resolveTargets(s.targeting, quetz, board, { panel: at(6, 9) }).units.map((u) => u.unitId).sort();
      expect(hit, s.id).toEqual(["foe", "foe2"]);
    }
  });

  it("carry three different elements and three different riders", () => {
    expect(spells.map((s) => s.element)).toEqual(["lightning", "wind", "water"]);
    expect(spells.map((s) => s.phases.find((p) => p.kind === "applyEffects").rules[0].effect.id))
      .toEqual(["shock", "sap", "slow"]);
  });

  it("inflict for the durations the sheet states, which are not uniform", () => {
    const durations = spells.map(
      (s) => s.phases.find((p) => p.kind === "applyEffects").rules[0].duration,
    );
    expect(durations).toEqual(["2◈", "1◈", "2◈"]);
  });

  it("require the mount and refuse while Piedra Del Sol stands", () => {
    for (const s of spells) {
      const preds = s.requirements.map((r) => r.predicate);
      expect(preds).toContainEqual(["self:onPlatform:quetzalcoatlus"]);
      expect(preds).toContainEqual([{ not: "self:fieldActive:quetz-piedra-del-sol" }]);
    }
  });

  it("count as her Attack and cannot be used as a Counter", () => {
    for (const s of spells) {
      expect(s.countsAsAttack).toBe(true);
      // A reaction window is what a Counter needs; `ownTurn` refuses one.
      expect(s.timing.window).toBe("ownTurn");
    }
  });
});

// #159. The three authored `kind: spell`, which nothing reads, so `isSpell` was
// false and each resolved as a STR Normal Attack: Def Dwn (MAG) never applied,
// N.Atk Up and every `attack:kind:normal` rider did, STR Reflect answered where
// MAG Reflect should, and the bill was `attack`, not `spell`. Built from the
// real corpus, because the YAML says what was written and not what was read.
describe("the three Quetzalcoatlus Spells are Damage Spells (#159)", () => {
  // The engine's first import takes seconds, which a first test would spend
  // inside its own timeout.
  beforeAll(async () => { await prepareSubjects(); await importAttack(); }, 60_000);
  const ids = ["quetz-tlahuitequiliztli", "quetz-ehecatle", "quetz-tlaelquiyahuitl"];

  /** What the engine makes of one real Spell in her hands, against a Medea. */
  const seen = (id) => withSubjects(
    [{ from: "quetzalcoatl", panel: { i: 6, j: 6 } }, { from: "medea", panel: { i: 6, j: 9 } }],
    async ({ unit, world }) => {
      const { abilityKind, buildAttackSpec, attackFacts } = await importAttack();
      const doc = world.actor("quetzalcoatl");
      const item = doc.items.find((i) => i.system.contentId === id);
      const options = rollOptionsFor({ attacker: unit("quetzalcoatl") });
      const attack = buildAttackSpec({ attacker: doc, ability: item, abilityId: item.id, options });
      const facts = attackFacts(unit("quetzalcoatl"), unit("medea"), { attack });
      return {
        isSpell: item.system.isSpell,
        kind: abilityKind(item),
        bill: budgetActionFor(abilityKind(item)),
        attack,
        facts,
        options: rollOptionsFor({ attacker: unit("quetzalcoatl"), defender: unit("medea"), attack: facts }),
      };
    },
  );

  for (const id of ids) {
    it(`${id} is a Damage Spell, billed as a Spell`, async () => {
      const out = await seen(id);
      expect(out.isSpell).toBe(true);
      expect(out.kind).toBe("damageSpell");
      expect(out.bill).toBe("spell");
    });

    it(`${id} keeps her MAG as what the attack counts as`, async () => {
      const out = await seen(id);
      expect(out.attack.kind).toBe("damageSpell");
      expect(out.attack.component).toBe("mag");
      // `attackFacts` rewrites a NORMAL attack's component to the Normal Attack's
      // own, which on a rider is the mount's STR; a Spell is exempt.
      expect(out.facts.component).toBe("mag");
    });

    it(`${id} is seen as MAG damage and not as a Normal Attack`, async () => {
      const { options } = await seen(id);
      expect(options.has("attack:component:mag")).toBe(true);
      expect(options.has("attack:kind:normal")).toBe(false);
    });
  }
});

describe("Piedra Del Sol", () => {
  const np = ability("quetz-piedra-del-sol");
  const stone = load("structures", "piedra-del-sol");

  it("is undamageable — her sheet gives it no destruction clause", () => {
    // Bloodmark got 1 Health because its sheet says a Master destroys it by
    // attacking it. This sheet says nothing of the kind, so Health would
    // invent a way to remove it that the sheet does not offer.
    expect(stone.undamageable).toBe(true);
    expect(stone.baseHealth).toBe(null);
  });

  it("shares its panel, so a Unit may walk under it", () => {
    expect(stone.sharesPanel).toBe(true);
  });

  it("OVERRIDES the Divine Core rather than stacking with it", () => {
    const flat = np.field.interior.find((r) => r.key === "FlatDamage");
    expect(flat.value).toBe(180);
    expect(flat.supersedes).toEqual(["quetz-goddesses-divine-core"]);
    // The Skill it supersedes gives 120, so the reading is 180 and not 300.
    expect(lookupNumber("divineCore", R("EX"))).toBe(120);
  });

  it("reduces her damage taken by 50% INCLUDING NP", () => {
    const ward = np.field.interior.find((r) => r.key === "Ward");
    // `npValue` equal to `value` is what "including NP" means: most defensive
    // percentages are halved against a Noble Phantasm and this one is not.
    expect(ward.value).toBe(50);
    expect(ward.npValue).toBe(50);
    expect(ward.relations).toEqual(["self"]);
  });

  it("burns enemies for 50 at their turn end, permanently while inside", () => {
    const clause = np.field.interiorEvents.find((e) => e.event === "turnEnd");
    expect(clause.relations).toEqual(["enemy"]);
    const dmg = clause.onFail.find((a) => a.key === "Damage");
    expect(dmg).toMatchObject({ amount: 50, element: "fire", fixed: true });
    const burn = clause.onFail.find((a) => a.key === "ApplyEffect");
    expect(burn.duration).toBe(null);
    expect(burn.unremovable).toBe(true);
  });

  it("charges her Master 50 — twice the mount's toll", () => {
    expect(np.field.upkeep.cost.amount).toBe(50);
    expect(np.field.upkeep.cost.payer).toBe("ownerMaster");
    expect(np.field.upkeep.endWhenUnaffordable).toBe(true);
  });

  it("has NO deactivation lockout, unlike the Quetzalcoatlus", () => {
    // The entire difference between the two sheets' final paragraphs.
    expect(np.field.deactivation).toEqual({ byOwner: true, window: "any" });
    expect(np.field.deactivation.lockout).toBeUndefined();
  });

  it("is a fixed area, so she may Move out of her own", () => {
    expect(np.field.geometry.kind).toBe("fixedArea");
    expect(np.field.geometry.shape).toEqual({ kind: "square", size: 7 });
  });

  it("paints Burning that does not follow her, and erases it on close", () => {
    const zone = np.phases.find((p) => p.kind === "zone");
    expect(zone.spec.terrain).toEqual(["burning"]);
    expect(zone.spec.followsSource).toBe(false);
    expect(zone.spec.duration).toBe(null);
    // The tag the `onEnd` clears must be the one the zone wrote.
    const onEnd = np.field.onEnd.find((a) => a.key === "ClearTerrain");
    expect(onEnd.tag).toBe(zone.spec.tag);
  });

  it("places the stone before opening the field it anchors", () => {
    const kinds = np.phases.map((p) => p.kind);
    expect(kinds.indexOf("createStructure")).toBeLessThan(kinds.indexOf("createField"));
  });

  it("counts its cooldown from deactivation, like Jack's Mist", () => {
    expect(np.cooldown).toEqual({ max: "8◈", countFrom: "deactivation" });
  });
});

/**
 * A guard for the failure that has now cost this codebase six authored keys:
 * the compiler emits a value and the DataModel has no field to receive it, so
 * the document builds, the pack builds, the validator passes, the sheet loads,
 * and the clause does nothing.
 *
 * `tools/validate-content.mjs`'s `unitKeyCoverage` checks the COMPILER; this
 * checks the schema on the other side of it. Found live: the Quetzalcoatlus
 * placed at Luck 0 while Quetzalcoatl stood beside it with 20.
 */
describe("the platform's authored keys survive its DataModel", () => {
  // Read as TEXT, from before the models could be imported. The build's model
  // check now holds every authored Platform key to the real PlatformData
  // (tools/lib/model-check.mjs); this stays as the record of the one it found.
  const SOURCE = readFileSync("module/data/actor/simple.mjs", "utf8");
  const COMMON = readFileSync("module/data/actor/_shared.mjs", "utf8");
  const platformBody = SOURCE.slice(
    SOURCE.indexOf("export class PlatformData "),
    SOURCE.indexOf("export class StructureData "),
  );
  const declares = (key) => new RegExp(`^\\s+${key}:\\s`, "m").test(platformBody)
    || new RegExp(`^\\s+${key}:\\s`, "m").test(COMMON);

  it("declares every key quetzalcoatlus.yml authors", () => {
    const notSystem = new Set([
      "schema", "id", "name", "type", "img", "description", "notes", "source", "abilities",
    ]);
    const missing = Object.keys(load("platforms", "quetzalcoatlus"))
      .filter((k) => !notSystem.has(k) && !declares(k));
    expect(missing).toEqual([]);
  });

  it("declares every key piedra-del-sol.yml authors", () => {
    const structureBody = SOURCE.slice(SOURCE.indexOf("export class StructureData "));
    const declaresStructure = (key) => new RegExp(`^\\s+${key}:\\s`, "m").test(structureBody)
      || new RegExp(`^\\s+${key}:\\s`, "m").test(COMMON);
    const notSystem = new Set([
      "schema", "id", "name", "type", "img", "description", "notes", "source", "abilities",
    ]);
    const missing = Object.keys(load("structures", "piedra-del-sol"))
      .filter((k) => !notSystem.has(k) && !declaresStructure(k));
    expect(missing).toEqual([]);
  });
});

/**
 * The two ends of a painted area's tag must agree.
 *
 * A `zone` phase writes the ground under `spec.tag`; the field's `onEnd`
 * `ClearTerrain` erases it by the same string. Both carry placeholders, and if
 * only one side resolves them the area is painted under a literal
 * `piedra:@field.id` while the closure looks for `piedra:quetz-piedra-del-sol`.
 * They never meet, and the Burning outlives the field forever.
 *
 * Found live: exactly that, on the first activation.
 */
describe("a painted area's tag resolves the same on both sides", () => {
  it("uses matching placeholders in the zone and the onEnd", () => {
    const np = ability("quetz-piedra-del-sol");
    const zone = np.phases.find((p) => p.kind === "zone");
    const onEnd = np.field.onEnd.find((a) => a.key === "ClearTerrain");
    expect(zone.spec.tag).toBe(onEnd.tag);
    expect(zone.spec.tag).toContain("@field.id");
  });

  it("Sol's tag names the unit, which is what its remover resolves", () => {
    const zone = ability("quetz-charisma-of-the-sun").phases.find((p) => p.kind === "zone");
    // `Terrain.attach`'s deleteActiveEffect hook clears `${defId}:${unitId}`.
    expect(zone.spec.tag).toBe("sol:@self.id");
  });
});

describe("the shared Riding card (#122)", () => {
  beforeAll(prepareSubjects, 60_000);

  // `riding.yml` printed "(Passive 1) Double Move. (Passive 2) Riding Attack.
  // (Passive 3) Passenger Seat. (Active) Increases MOV for this Turn." -- the names
  // of the grants and none of the rules they switch on, where every variant file
  // spells them out. Her Servant file said her Riding was "word-for-word
  // `class-riding.yml`", which it was not. Read off the real projection: this is
  // what the card shows.
  const card = () => withSubjects([{ from: "quetzalcoatl" }], ({ world }) => {
    const riding = world.actor("quetzalcoatl").items.find((i) => i.system?.slug === "riding");
    return riding.system.description;
  });

  it("states each rule its grants switch on", async () => {
    const text = await card();
    // Double Move
    expect(text).toMatch(/Move twice during its Turn, once before and once after Attacking/);
    expect(text).toMatch(/cannot exceed the Unit's MOV/);
    // Riding Attack: the line, the stop, the allowance
    expect(text).toMatch(/straight line/);
    expect(text).toMatch(/Cannot Attack or Move after it has stopped/);
    expect(text).toMatch(/MOV minus the panels already Moved/);
    expect(text).toMatch(/Can be combined\s+with Passenger Seat/);
    // Passenger Seat: the relative position, the one Unit
    expect(text).toMatch(/same relative position/);
    expect(text).toMatch(/only Moving one Unit/);
  });

  it("says what the Active does and that it has a cooldown, without a per-rank number", async () => {
    // An inline "@" is not substituted, so no number can be written into the string.
    const text = await card();
    expect(text).toMatch(/\(Active\) Used during your Turn\. Increases MOV/);
    expect(text).toMatch(/for this Turn/);
    expect(text).toMatch(/Cooldown/);
  });

  it("keeps the note that the MOV Up is not a buff, without a link to an effect that reads Buff", async () => {
    // `@effect[movUp]` opens a buff-polarity effect, inside the sentence that says
    // it is not a buff.
    const text = await card();
    expect(text).toMatch(/is NOT a buff/);
    expect(text).not.toMatch(/@effect\[/);
  });
});

describe("the comments around Riding say what the code does (#122)", () => {
  const read = (p) => readFileSync(p, "utf8");

  it("does not call Passenger Seat unread: `carryMasterAlong` reads it", () => {
    expect(read("module/rules/granted.mjs")).not.toMatch(/nothing reads it yet/);
    expect(read("module/rules/movement.mjs")).not.toMatch(/has existed with no reader/);
  });

  it("does not send a reader of the Normal Rider to `mayMoveAgain`, which was deleted", () => {
    const text = read("packs/_source/abilities/normal-riding.yml");
    expect(text).not.toMatch(/mayMoveAgain/);
    expect(text).toMatch(/passenger-seat\.mjs/);
  });

  it("does not say Pale Rider's EX is not a row of the Riding table", () => {
    expect(read("packs/_source/class-skills/riding-pale-rider.yml")).not.toMatch(/EX is not a row/);
  });

  it("does not say Quetzalcoatl's Riding is word-for-word the shared document", () => {
    expect(read("packs/_source/servants/quetzalcoatl.yml")).not.toMatch(/word-for-word `class-riding.yml`/);
  });
});
