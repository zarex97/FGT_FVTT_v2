/**
 * @file Quetzalcoatl — the numbers her sheet prints, checked against the tables.
 * @see char_orig_sheets/Copia de Quetzalcoatl.md, docs/D-servant-data-sheets.md §D.28
 *
 * A statline that reproduces from `domain/tables.mjs` is a statline nobody has
 * to maintain. These assertions exist so that a later correction to a rank
 * table either propagates to her sheet or fails here — the alternative is nine
 * numbers transcribed by hand that quietly stop agreeing with the game.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { lookupNumber } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { aoePassengerFactor } from "../../module/rules/platforms.mjs";

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
    // Parameter moves the half it should.
    expect(np.damage.sources).toEqual([
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

  it("bypasses Magic Resistance on both resolutions", () => {
    expect(np.damage.ignoresMagicResistance).toBe(true);
    expect(np.aftermath.damage.ignoresMagicResistance).toBe(true);
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
