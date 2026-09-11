/**
 * @file Captain Nemo — the pure halves of his kit.
 * @see docs/36-case-remaining.md §36.6, char_orig_sheets/Copia de Nemo.md
 *
 * Everything here is layer 1 or 2, so it runs without a world. The
 * document-touching halves — Zero Sail's entry and resurface, Quickfire's
 * no-Counter refund — are live-tested in `fgt2026` and recorded in Ch. 45.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { detectRangeOf } from "../../module/rules/identity.mjs";

/** `lookup` takes a Rank, never a string. @param {string} s @returns {Rank} */
const R = (s) => Rank.parse(s);

/** @param {string} id @returns {object} */
export function ability(id) {
  return parse(readFileSync(join("packs/_source/abilities", `${id}.yml`), "utf8"));
}

/** @param {string} id @returns {object} */
export function effect(id) {
  return parse(readFileSync(join("packs/_source/effects", `${id}.yml`), "utf8"));
}

export const SHEET = parse(readFileSync("packs/_source/servants/nemo.yml", "utf8"));

/* ========================================================================== */
/*  The statline                                                              */
/* ========================================================================== */

describe("Nemo's statline", () => {
  it("is a Rider from East India and Greece (R4)", () => {
    // The sheet states no Class. Riding is Rider's class skill and is the only
    // class skill he carries, which is the whole of the derivation.
    expect([...SHEET.servantClasses]).toEqual(["rider"]);
    // `eastIndia` is a DISTINCT region from `india` in REGION_ADJACENCY, and
    // the sheet says "East India".
    expect(SHEET.region).toEqual(["eastIndia", "greece"]);
  });

  it("carries the four attributes the sheet lists, and no others", () => {
    expect(SHEET.attributes).toEqual(["male", "servant", "sky", "humanoid"]);
  });

  it("states Base Attacks the parameter tables independently derive", () => {
    // "Base Attack (STR): 100 / Base Attack (MAG): 200" against STR C and MAG A.
    // If these ever disagree the sheet is wrong or the table is; either way it
    // should fail here rather than be silently overridden.
    expect(SHEET.baseAttack.str).toBe(lookup("baseAttackStrByStr", R(SHEET.parameters.str)));
    expect(SHEET.baseAttack.mag).toBe(lookup("baseAttackMagByMag", R(SHEET.parameters.mag)));
    expect(SHEET.baseAttack.str).toBe(100);
    expect(SHEET.baseAttack.mag).toBe(200);
  });

  it("reaches 3 panels at 1 target, and moves 6", () => {
    expect(SHEET.range).toEqual({ panels: 3, targets: 1 });
    expect(SHEET.mov).toBe(6);
    expect(SHEET.baseHealth).toBe(1250);
    expect(SHEET.sustainability).toBe("2◈");
  });
});

/* ========================================================================== */
/*  "Nemo's Normal Attacks use Base Attack (MAG) and deal Water damage, with   */
/*  a 10% chance of inflicting Slow for 1◈ Turns."                            */
/* ========================================================================== */

describe("the Normal Attack note", () => {
  it("swings MAG and types the damage Water", () => {
    expect(SHEET.normalAttack).toEqual({ mode: "fixed", component: "mag", element: "water" });
  });

  it("rides a 10% Slow on the attack itself, not on a named Skill", () => {
    // The sheet states this as a Note on the statline rather than as a Skill,
    // so it lives in the Servant's own `rules:` the way Pale Rider's
    // RelationshipProxy does -- inventing a skill file to hold it would put a
    // row on his sheet that his sheet does not have.
    const rider = SHEET.rules.find((r) => r.key === "OnEvent" && r.effect?.id === "slow");
    expect(rider).toBeDefined();
    expect(rider.event).toBe("damageDealt");
    expect(rider.predicate).toContain("attack:kind:normal");
    expect(rider.target).toBe("victim");
    expect(rider.chance).toBe(10);
    expect(rider.duration).toBe("1◈");
    expect(rider.automatic).toBe(true);
  });
});

/* ========================================================================== */
/*  Riding A+ and Divinity A                                                  */
/* ========================================================================== */

describe("the two class skills", () => {
  /** @param {string} ref @returns {object} */
  const skill = (ref) => SHEET.abilities.find((a) => a.ref === ref);

  it("takes Riding at A+ on a 3◈ cooldown that regenerates ⅓◈", () => {
    expect(skill("class-riding")).toEqual({ ref: "class-riding", rank: "A+", cooldown: "3◈-⅓◈" });
    // "Increases MOV by 5 panels for this Turn." A+ and A agree because
    // `ridingMov` has `perStep: 0`.
    expect(lookup("ridingMov", R("A+"))).toBe(5);
  });

  it("takes Divinity at A, which the table prices at the sheet's own +50", () => {
    expect(skill("divinity")).toEqual({ ref: "divinity", rank: "A" });
    expect(lookup("divinity", R("A"))).toBe(50);
  });

  it("does NOT carry Magic Resistance", () => {
    // Rider normally has it. The sheet grants Riding alone (R4), and a class
    // skill nobody wrote down is a buff nobody agreed to.
    expect(SHEET.abilities.some((a) => a.ref === "class-magic-resistance")).toBe(false);
  });
});

/* ========================================================================== */
/*  Poseidon's Protection — Rank B                                            */
/* ========================================================================== */

describe("Poseidon's Protection (Rank B)", () => {
  const A = ability("nemo-poseidons-protection");

  it("is a passive that never enters a cooldown", () => {
    expect(A.passive).toBe(true);
    expect(A.cooldown).toBeUndefined();
  });

  it("raises crit damage only for MAG attacks, and never for an NP", () => {
    const clause = A.passiveRules.find((r) => r.key === "CritModifier");
    expect(clause.aspect).toBe("damage");
    expect(clause.value).toBe(10);
    // "Attacks which use Base Attack (MAG)" -- component-scoped, so a STR
    // attack of his (Quickfire, the NP) gets nothing.
    expect(clause.component).toBe("mag");
    // "Does not affect NP." Crit-damage modifiers are already not-NP by
    // default in Appendix A, but the exclusion is stated here because the
    // sheet states it and a reader should not have to know the default.
    expect(clause.predicate).toContain("not:attack:kind:np");
  });

  it("cuts 50 off any damage taken on Waterside or in Imaginary Numbers Space", () => {
    const clause = A.passiveRules.find((r) => r.key === "DamageNegation");
    expect(clause.mode).toBe("flat");
    expect(clause.value).toBe(50);
    // "if NP, 100" -- the ONLY flat reduction in the corpus that is LARGER
    // against a Noble Phantasm. Every other npValue in the catalogue is
    // smaller, so this is worth a test of its own rather than a shared one.
    expect(clause.npValue).toBe(100);
    expect(clause.includesNP).toBe(true);
    expect(clause.predicate).toEqual([
      { anyOf: ["self:terrain:waterside", "self:terrain:imaginaryNumbers"] },
    ]);
  });

  it("has no uses limit — it is standing ground, not a charge", () => {
    const clause = A.passiveRules.find((r) => r.key === "DamageNegation");
    expect(clause.uses).toBeUndefined();
  });
});

/* ========================================================================== */
/*  Stage 6 — banded AoE. The stage is named after Triton's Conch and had     */
/*  no input at all: nothing in the repository wrote `ctx.bandMultiplier`.    */
/* ========================================================================== */

describe("stage 6 — banded AoE", () => {
  /** @param {number|undefined} bandMultiplier @param {number} [band] */
  const hit = (bandMultiplier, band = 0) => computeDamage({
    attacker: { id: "a", baseAttack: { mag: 200 }, abilities: [] },
    defender: { id: "d", abilities: [] },
    base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
    component: "mag",
    attack: { kind: "skill", component: "mag" },
    rolls: { attackMinus: 0 },
    bandMultiplier,
    band,
  });

  it("scales the adjacent band up and the outer band down", () => {
    const flat = hit(undefined).total;
    expect(flat).toBeGreaterThan(0);
    expect(hit(1.5, 0).total).toBeCloseTo(flat * 1.5, 5);
    expect(hit(0.5, 1).total).toBeCloseTo(flat * 0.5, 5);
  });

  it("names the band in the breakdown rather than folding it into the total", () => {
    const contributors = hit(1.5, 0).breakdown.flatMap((b) => b.contributors ?? []);
    const band = contributors.find((c) => c.source === "band");
    expect(band, "stage 6 contributed nothing the card could show").toBeDefined();
    expect(band.value).toBe(1.5);
    // Which ring, in words. A multiplier with no ring named is a number the
    // player cannot check against the sheet.
    expect(band.note).toContain("band 0");
  });
});

/* ========================================================================== */
/*  Triton's Conch                                                            */
/* ========================================================================== */

describe("Triton's Conch", () => {
  const A = ability("nemo-tritons-conch");

  it("hits a 5x5 around Nemo as two distance bands", () => {
    expect(A.targeting.anchor).toEqual({ kind: "self" });
    expect(A.targeting.shape.kind).toBe("banded");
    // A 5x5 centred on him is everything within Chebyshev 2.
    expect(A.targeting.shape.bands).toEqual([{ maxDistance: 1 }, { maxDistance: 2 }]);
  });

  it("deals 1.5x directly next to him and 0.5x at two panels", () => {
    expect(A.damage.bands).toEqual([{ multiplier: 1.5 }, { multiplier: 0.5 }]);
    expect(A.damage.sources).toEqual([{ unit: "self", component: "mag", factor: 1 }]);
    expect(A.damage.component).toBe("mag");
  });

  it("inflicts Deafen outright adjacent and on a coin at two panels", () => {
    const phase = A.phases.find((p) => p.kind === "applyEffects");
    const deafen = phase.effects.find((e) => e.id === "deafen");
    expect(deafen.duration).toBe("1◈");
    // "If the Unit was 2 panels away from Nemo, the chance of being inflicted
    // with Deafen is 50% instead." The SAME band index the multiplier uses.
    expect(deafen.bands).toEqual([{ chance: 100 }, { chance: 50 }]);
  });

  it("runs on a 2◈ cooldown as an Attack Skill", () => {
    expect(A.isAttackSkill).toBe(true);
    expect(A.cooldown).toBe("2◈");
  });
});

describe("the Deafen debuff", () => {
  const E = effect("deafen");

  it("raises Evade rolls by 2 and drops MOV by 1", () => {
    expect(E.polarity).toBe("debuff");
    const evade = E.rules.find((r) => r.key === "CheckModifier" && r.check === "evade");
    expect(evade.value).toBe(2);
    expect(E.rules.find((r) => r.key === "MovDelta").value).toBe(-1);
  });

  it("drops Detect by 1 WITHOUT a rule element, because identity.mjs hard-wires it", () => {
    // `detectRangeOf` subtracts 1 for an effect literally called `deafen` --
    // it has since it was written, against a game in which nothing could apply
    // one. So the -1 arrives by NAME and the effect must not also carry a
    // rule for it.
    //
    // `DetectOverride` would be the wrong element in any case: it pushes a
    // `{scope: "detect", maximum}` CAP, which is Jack's Mist reducing Detect
    // "to 1 panel". Authored here it would cap Nemo's victims at 1 rather than
    // costing them one panel, and then identity.mjs would take another off.
    expect(E.rules.some((r) => r.key === "DetectOverride")).toBe(false);
    expect(E.id).toBe("deafen");

    const base = detectRangeOf({ kind: "servant", servantClasses: ["rider"], effects: [] });
    const deaf = detectRangeOf({ kind: "servant", servantClasses: ["rider"], effects: ["deafen"] });
    expect(deaf).toBe(base - 1);
  });
});

/* ========================================================================== */
/*  Two-sided bypassModifiers (Ch. 13 §13.8)                                  */
/* ========================================================================== */

describe("two-sided bypassModifiers", () => {
  const attacker = {
    id: "a", baseAttack: { str: 100 }, abilities: [],
    modifiers: [{
      key: "atkUp", value: 100, direction: "dealt", source: "Atk Up",
    }],
  };
  const defender = {
    id: "d", abilities: [],
    modifiers: [{
      key: "defUp", value: 50, direction: "taken", source: "Def Up",
    }],
  };
  const base = { sources: [{ unit: "self", component: "str", factor: 1 }] };

  /** @param {boolean|object|undefined} bypassModifiers */
  const hit = (bypassModifiers) => computeDamage({
    attacker, defender, base, component: "str",
    attack: { kind: "skill", component: "str", bypassModifiers },
    rolls: { attackMinus: 0 },
  });

  /** @param {object} r @param {string} key */
  const contributor = (r, key) =>
    r.breakdown.flatMap((b) => b.contributors ?? []).find((c) => c.source === key);

  it("attacker-only bypass zeroes his Atk Up and leaves her Def Up alone", () => {
    // "Damage of this Attack Skill is not affected by damaging modifying
    // effects ON NEMO" -- his own go, hers stay.
    //
    // Zeroed and NAMED, not removed: a modifier that vanishes from the
    // breakdown is indistinguishable from one that was never collected, which
    // is the rule `Ignore Def`, `ignoresAttackerIncreases` and a Heel Attack
    // all already follow.
    const out = hit({ attacker: true, defender: false });
    expect(contributor(out, "atkUp").value).toBe(0);
    expect(contributor(out, "atkUp").note).toContain("bypassed");
    expect(contributor(out, "defUp").value).not.toBe(0);
  });

  it("a bare true still skips both sides, so nothing already authored changes", () => {
    const out = hit(true);
    expect(contributor(out, "atkUp")).toBeUndefined();
    expect(contributor(out, "defUp")).toBeUndefined();
    // 100 base, untouched by either side.
    expect(out.total).toBe(100);
  });

  it("leaves an ordinary attack collecting both", () => {
    const out = hit(undefined);
    expect(contributor(out, "atkUp").value).not.toBe(0);
    expect(contributor(out, "defUp").value).not.toBe(0);
  });

  it("costs the attacker his increase and nothing else, numerically", () => {
    // 100 base. Ordinary: +100% and -50% sum in one additive bucket to +50%.
    // Attacker-bypassed: only the -50% survives.
    expect(hit(undefined).total).toBe(150);
    expect(hit({ attacker: true, defender: false }).total).toBe(50);
  });

  it("leaves Fixed damage exactly as it was — 'both the AU and DU' by definition", () => {
    const out = computeDamage({
      attacker, defender, base: { fixedValue: 150 }, component: "str",
      attack: { kind: "skill", component: "str", isFixedDamage: true },
      rolls: { attackMinus: 0 },
    });
    expect(out.total).toBe(150);
  });
});

/* ========================================================================== */
/*  Barrel Bombing                                                            */
/* ========================================================================== */

describe("Barrel Bombing", () => {
  const A = ability("nemo-barrel-bombing");

  it("hits a 3x3 block flush against him on one cardinal side", () => {
    // "in any non-diagonal direction next to Nemo" -- he is NOT inside it.
    expect(A.targeting.anchor).toEqual({ kind: "selfEdgeAdjacent" });
    expect(A.targeting.shape).toEqual({ kind: "orientedRect", short: 3, long: 3 });
  });

  it("deals a flat 150 of Fire and burns for 2◈", () => {
    expect(A.damage.fixed).toBe(true);
    expect(A.damage.base).toEqual({ fixedValue: 150 });
    expect(A.damage.element).toBe("fire");
    const burn = A.phases.find((p) => p.kind === "applyEffects").effects.find((e) => e.id === "burn");
    expect(burn.duration).toBe("2◈");
  });

  it("skips Nemo's own damage modifiers and none of the defender's", () => {
    expect(A.damage.bypassModifiers).toEqual({ attacker: true, defender: false });
  });

  it("runs on a 3◈ cooldown", () => {
    expect(A.cooldown).toBe("3◈");
    expect(A.isAttackSkill).toBe(true);
  });
});
