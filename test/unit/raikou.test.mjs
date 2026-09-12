/**
 * @file Minamoto no Yorimitsu — the pure halves of her kit.
 * @see docs/D-servant-data-sheets.md §D.32, char_orig_sheets/Copia de Raikou.md
 * @see docs/superpowers/specs/2026-09-12-raikou-design.md
 *
 * Everything here is layer 1 or 2, so it runs without a world. The
 * document-touching halves — the forced mode, the Command Spell override, the
 * clone spawn, the Master upkeep, both Noble Phantasms in flight — are
 * live-tested in `fgt2026` and recorded in Ch. 45.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

/** @param {string} id @returns {object} */
export function ability(id) {
  return parse(readFileSync(join("packs/_source/abilities", `${id}.yml`), "utf8"));
}

/** @param {string} id @returns {object} */
export function effect(id) {
  return parse(readFileSync(join("packs/_source/effects", `${id}.yml`), "utf8"));
}

/** @param {string} id @returns {object} */
export function summon(id) {
  return parse(readFileSync(join("packs/_source/summons", `${id}.yml`), "utf8"));
}

export const SHEET = parse(readFileSync("packs/_source/servants/raikou.yml", "utf8"));

/* ========================================================================== */
/*  The statline                                                              */
/* ========================================================================== */

describe("Raikou's statline", () => {
  it("is a Berserker from Japan (R9)", () => {
    // The sheet states no Class and lists three class skills. Mad Enhancement
    // is Berserker's and is the one that decides her; §D.32 has recorded
    // Berserker since the data sheets were transcribed.
    expect([...SHEET.servantClasses]).toEqual(["berserker"]);
    expect(SHEET.classContainer).toBe("berserker");
    expect(SHEET.region).toEqual(["japan"]);
    expect(SHEET.alignment).toEqual({ order: "chaotic", morality: "good" });
  });

  it("carries the four attributes the sheet lists, and no others", () => {
    // `spirit` and `hominidae` are NOT here: `domain/attributes.mjs` closes the
    // implication table for every Unit, and stating a derived attribute by hand
    // is how the two spellings drift apart.
    expect([...SHEET.attributes].sort()).toEqual(["female", "humanoid", "servant", "sky"]);
  });

  it("attacks with BA(STR), which makes her NOT a Magus (R8)", () => {
    // The sheet gives both Base Attacks and never says which. STR, on Karna's
    // precedent: his Mana Burst (Flames) carries the identical sentence --
    // "the Base Attack used is his BA(STR) and BA(MAG) combined" -- and it
    // reads as a departure from a STR default.
    //
    // Had it been MAG, `isMagus` would have made her a Magus ("all Units whose
    // Normal Attacks use Base Attack (MAG)") and every ordinary swing would
    // have taken Mad Enhancement's HALVED +50% instead of +100%.
    expect(SHEET.normalAttack).toEqual({ mode: "fixed", component: "str" });
  });

  it("states no number the rank tables do not already derive", () => {
    const p = SHEET.parameters;
    expect(SHEET.baseAttack.str).toBe(lookup("baseAttackStrByStr", Rank.parse(p.str)));
    expect(SHEET.baseAttack.mag).toBe(lookup("baseAttackMagByMag", Rank.parse(p.mag)));
    expect(SHEET.baseHealth).toBe(lookup("baseHealthByEnd", Rank.parse(p.end)));
    expect(SHEET.mov).toBe(4);
    expect(SHEET.range).toEqual({ panels: 4, targets: 1 });
    expect(SHEET.sustainability).toBe("2◈");
  });

  it("has no Normal Attack rider of its own", () => {
    // Unlike Nemo, whose unnamed 10% Slow belongs to no skill, every rider
    // Raikou has belongs to a named ability. A `rules:` block here would put a
    // row on her sheet that her sheet does not have.
    expect(SHEET.rules ?? []).toEqual([]);
  });
});

/* ========================================================================== */
/*  The four shared class skills                                              */
/* ========================================================================== */

describe("the class skills she takes off the shelf", () => {
  const refs = Object.fromEntries(
    SHEET.abilities.filter((a) => a.ref).map((a) => [a.ref, a]),
  );

  it("takes Mad Enhancement at EX, whose every magnitude the tables already hold", () => {
    expect(refs["class-mad-enhancement"].rank).toBe("EX");
    // "All damage taken is reduced by 75%; if NP, 30%."
    expect(lookup("madEnhancementDefence", Rank.parse("EX"))).toEqual([75, 30]);
    // "All damage dealt is increased by 100%... halved for BA(MAG)" -- 50,
    // exact, so `magnitudeRoundTo: 5` has nothing to round.
    expect(lookup("madEnhancementOffence", Rank.parse("EX"))).toBe(100);
    // "Master loses 30 Health... when Health is 30 or less, forcibly deactivated."
    expect(lookup("madEnhancementDrain", Rank.parse("EX"))).toBe(30);
  });

  it("takes Riding at A+ with the ⅓◈ regen the sheet states, and adds nothing", () => {
    expect(refs["class-riding"]).toEqual({ ref: "class-riding", rank: "A+", cooldown: "3◈-⅓◈" });
    expect(lookup("ridingMov", Rank.parse("A+"))).toBe(5);
    expect(lookup("ridingCooldown", Rank.parse("A+"))).toBe("3◈");
  });

  it("takes Magic Resistance at D, and adds nothing", () => {
    expect(refs["class-magic-resistance"].rank).toBe("D");
    expect(lookup("magicResistancePercent", Rank.parse("D"))).toBe(20);
    expect(lookup("magicResistanceDebuffResist", Rank.parse("D"))).toBe(10);
  });

  it("takes Divinity at C for a flat +30", () => {
    expect(refs.divinity.rank).toBe("C");
    expect(lookup("divinity", Rank.parse("C"))).toBe(30);
  });
});
