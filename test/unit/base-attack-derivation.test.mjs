/**
 * @file Base Attack is derived from STR and MAG, and the table wins.
 * @see docs/06-stats-and-resources.md §6.4, docs/B-rank-tables.md, Ch. 41 Q50
 *
 * The author's conversion table, supplied in full:
 *
 * > *"STR: E => 50, D => 75, C => 100, B => 125, A => 150, EX => 200.
 * > MAG: E => 100, D => 125, C => 150, B => 175, A => 200, EX => 250.
 * > For every + or - added to the Servant's STR/MAG increase or decrease that
 * > Servant's corresponding Base Attack by 10. That makes the initial Base
 * > Attack (Mag), Base Attack (Str). **If you find a value of Base attack that
 * > differs from this calculation choose the value of this table instead of
 * > what is on the character sheet.** Then on top of it the + or - from other
 * > sources (High Rank Master, Region)."*
 *
 * The emphasised sentence is why this is a derivation rather than a validation:
 * three of the eleven authored sheets disagree with the table, and the table is
 * what the game is played with.
 */

import { describe, it, expect } from "vitest";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { baseAttackFor, needsSetupRolls } from "../../module/rules/setup-rolls.mjs";

const r = (s) => Rank.parse(s);

/* -------------------------------------------------------------------------- */

describe("the STR and MAG tables", () => {
  it("reproduces every stated STR grade", () => {
    expect([...["E", "D", "C", "B", "A", "EX"]].map((g) => lookup("baseAttackStrByStr", r(g))))
      .toEqual([50, 75, 100, 125, 150, 200]);
  });

  it("reproduces every stated MAG grade", () => {
    expect([...["E", "D", "C", "B", "A", "EX"]].map((g) => lookup("baseAttackMagByMag", r(g))))
      .toEqual([100, 125, 150, 175, 200, 250]);
  });

  it("moves by 10 per step, in both directions", () => {
    expect(lookup("baseAttackStrByStr", r("A+"))).toBe(160);
    expect(lookup("baseAttackStrByStr", r("A-"))).toBe(140);
    expect(lookup("baseAttackMagByMag", r("B+"))).toBe(185);
    expect(lookup("baseAttackMagByMag", r("B-"))).toBe(165);
  });

  it("takes more than one step", () => {
    // Nobody in the reference set is `A++`, but the rule says "for every +".
    expect(lookup("baseAttackStrByStr", r("A++"))).toBe(170);
  });
});

describe("baseAttackFor", () => {
  it("derives both components from the parameters", () => {
    expect(baseAttackFor({ parameters: { str: "C", mag: "C" } })).toEqual({ str: 100, mag: 150 });
  });

  it("OVERRIDES an authored figure that disagrees", () => {
    // Jack the Ripper's sheet says 85 at STR C; the table says 100.
    expect(baseAttackFor({ parameters: { str: "C", mag: "C" }, baseAttack: { str: 85, mag: 150 } }))
      .toEqual({ str: 100, mag: 150 });
  });

  it("counts granted rank steps, which arrive after the sheet was written", () => {
    // "Then on top of it the + or - from other sources (High Rank Master,
    // Region)." A granted step moves the RANK, so it moves the table row --
    // it is not a separate addend, which is why `sheetPatch` no longer adds
    // one and this reads `grantedSteps` instead. Both paths would otherwise
    // have applied it and a Region-granted Servant got +20 for one step.
    expect(baseAttackFor({
      parameters: { str: "C", mag: "B" },
      grantedSteps: { str: 1, mag: 2 },
    })).toEqual({ str: 110, mag: 195 });
  });

  it("falls back to the authored figure when a parameter is unstated", () => {
    // Summons and platforms state Base Attack outright and have no parameters
    // -- Bašmu's "Base Attack: 150/150" with no STR or MAG rank anywhere.
    expect(baseAttackFor({ baseAttack: { str: 150, mag: 150 } })).toEqual({ str: 150, mag: 150 });
    expect(baseAttackFor({ parameters: { str: "C" }, baseAttack: { str: 1, mag: 42 } }))
      .toEqual({ str: 100, mag: 42 });
  });

  it("is zero for a unit that states neither", () => {
    expect(baseAttackFor({})).toEqual({ str: 0, mag: 0 });
  });
});

describe("needsSetupRolls", () => {
  it("spots a Servant still carrying the template's zeroes", () => {
    // Agility is the number you must roll UNDER, so a maximum of 0 auto-fails
    // every Evade -- silently, which is why it is detected rather than trusted.
    expect(needsSetupRolls({ parameters: { agi: "A", luc: "A" }, agility: { max: 0 }, luck: { max: 0 } }))
      .toBe(true);
  });

  it("is satisfied once they are rolled", () => {
    expect(needsSetupRolls({
      parameters: { agi: "A", luc: "A" }, agility: { max: 20 }, luck: { max: 18 },
    })).toBe(false);
  });

  it("catches one of the two being unrolled", () => {
    expect(needsSetupRolls({
      parameters: { agi: "A", luc: "A" }, agility: { max: 20 }, luck: { max: 0 },
    })).toBe(true);
  });

  it("leaves alone a unit with no ranks to roll from", () => {
    // Summons and platforms state Agility and Luck outright -- Bašmu's 14 and
    // 7 -- and have no AGI or LUC rank at all. Nothing to roll, nothing to fix.
    expect(needsSetupRolls({ agility: { max: 14 }, luck: { max: 7 } })).toBe(false);
    expect(needsSetupRolls({})).toBe(false);
  });
});
