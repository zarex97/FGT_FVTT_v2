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
