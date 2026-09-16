/**
 * @file Max Health is derived from END, and the table beats the sheet.
 * @see module/domain/health.mjs, docs/06-stats-and-resources.md §6.1
 *
 * The mirror of `base-attack-derivation.test.mjs`. Base Attack has read from
 * its table since it was written, with an explicit rulebook sentence behind it;
 * Health honoured the authored figure instead, and four of the reference sheets
 * disagree with the table — every one of them downward.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";

import { maxHealthFor } from "../../module/domain/health.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const derive = (sheet) => maxHealthFor(sheet, lookup, Rank);

describe("maxHealthFor", () => {
  it("reads the END table", () => {
    expect(derive({ parameters: { end: "A" } })).toBe(1500);
    expect(derive({ parameters: { end: "B" } })).toBe(1250);
    expect(derive({ parameters: { end: "EX" } })).toBe(2000);
  });

  it("moves 100 per step", () => {
    expect(derive({ parameters: { end: "A++" } })).toBe(1700);
    expect(derive({ parameters: { end: "B+" } })).toBe(1350);
    expect(derive({ parameters: { end: "A-" } })).toBe(1400);
  });

  it("beats an authored figure that disagrees", () => {
    // Asterios's own sheet prints 1500 against A++'s 1700.
    expect(derive({ parameters: { end: "A++" }, baseHealth: 1500 })).toBe(1700);
  });

  it("keeps the authored figure where there is no parameter to derive from", () => {
    // Summons and platforms state Base Health outright and carry no END rank —
    // the same escape `baseAttackFor` leaves them.
    expect(derive({ baseHealth: 400 })).toBe(400);
    expect(derive({ parameters: {}, baseHealth: 400 })).toBe(400);
  });

  it("folds a granted step in by moving the rank, not by adding twice", () => {
    // A Region or a high-Rank Master grants steps; `baseAttackFor` applies them
    // the same way, and adding a separate ±100 on top would double-count.
    expect(derive({ parameters: { end: "A" }, grantedSteps: { end: 1 } })).toBe(1600);
    expect(derive({ parameters: { end: "A" }, grantedSteps: { end: -1 } })).toBe(1400);
  });

  it("is zero for a sheet with neither, rather than NaN", () => {
    expect(derive({})).toBe(0);
    expect(derive(null)).toBe(0);
  });
});

describe("the reference sheets", () => {
  const servants = readdirSync("packs/_source/servants")
    .map((f) => parse(readFileSync(`packs/_source/servants/${f}`, "utf8")))
    .filter((s) => s && s.parameters?.end);

  it("are played at the table's figure wherever the two disagree", () => {
    // Named rather than counted, so a sheet that starts disagreeing shows up
    // here as a new name instead of a changed number.
    const disagree = servants
      .filter((s) => s.baseHealth !== undefined && s.baseHealth !== null)
      .filter((s) => s.baseHealth !== derive(s))
      .map((s) => `${s.id}: sheet ${s.baseHealth}, END ${s.parameters.end} → ${derive(s)}`);

    expect(disagree.sort()).toEqual([
      "asterios: sheet 1500, END A++ → 1700",
      "castor: sheet 1500, END A++ → 1700",
      "penthesilea: sheet 1250, END B+ → 1350",
      "pollux: sheet 1500, END A++ → 1700",
    ]);
  });

  it("leaves an undamageable Servant with no Health at all", () => {
    // Pale Rider: "Base Health: —". `undamageable` is answered before the
    // derivation is reached (`ServantData#prepareBaseData`), because `null` is
    // "cannot be damaged" and not "has not been given a number" — deriving one
    // would hand him the 1500 his END would otherwise grant.
    const paleRider = parse(readFileSync("packs/_source/servants/pale-rider.yml", "utf8"));
    expect(paleRider.baseHealth).toBe(null);
    expect(paleRider.undamageable).toBe(true);
    expect(readFileSync("module/data/actor/servant.mjs", "utf8"))
      .toMatch(/if \(this\.undamageable\)[\s\S]{0,200}return;[\s\S]{0,400}maxHealthFor/);
  });
});
