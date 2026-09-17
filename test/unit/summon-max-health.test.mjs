/**
 * @file One Max Health derivation, not two.
 * @see module/rules/setup-rolls.mjs, module/domain/health.mjs, docs/46-roster-re-audit.md §46.4-K
 *
 * §46.6 settled that **the END table beats the sheet's stated `baseHealth`**,
 * the same way Base Attack's table does, and `domain/health.mjs#maxHealthFor`
 * implements it — so a Servant imported from the pack and prepared by
 * `ServantData#prepareBaseData` gets the table's figure.
 *
 * `servantSetupPlan` kept the opposite rule (`sheet.baseHealth ?? table`), and
 * it is the path the **war-setup wizard** actually uses. So which Max Health a
 * Servant played at depended on how it reached the board, and the four sheets
 * §46.6 was written about were the only ones that could tell the difference.
 *
 * Found by building a war through `commitWar` instead of by hand: Asterios
 * arrived at 1600 where the table says 1700 (+100 for his Greece END grant =
 * 1800). Every audit before it had hand-imported its actors, which is the one
 * hazard §46.2 lists and the reason this survived.
 */

import { describe, it, expect } from "vitest";
import { servantSetupPlan } from "../../module/rules/setup-rolls.mjs";
import { maxHealthFor } from "../../module/domain/health.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const baseOf = (sheet) => servantSetupPlan(sheet).lines.find((l) => l.id === "maxHealth").base;

describe("the summon plan's Max Health is the END table's", () => {
  it("Asterios: END A++ is 1700, not the 1500 his sheet states for the record", () => {
    expect(baseOf({ parameters: { end: "A++" }, baseHealth: 1500 })).toBe(1700);
  });

  it("Penthesilea: END B+ is 1350, not 1250", () => {
    expect(baseOf({ parameters: { end: "B+" }, baseHealth: 1250 })).toBe(1350);
  });

  it("a sheet that states nothing still gets the table", () => {
    expect(baseOf({ parameters: { end: "C" } })).toBe(1000);
  });

  it("a sheet with no readable END falls back to its stated figure", () => {
    // The only case the sheet still wins, and the reason `baseHealth` is not
    // simply deleted: there is nothing to look up.
    expect(baseOf({ parameters: {}, baseHealth: 777 })).toBe(777);
  });
});

describe("the two derivations agree", () => {
  // The actual defect was not a wrong number but TWO rules, so the assertion
  // that matters is that the summon path and the sheet path answer alike.
  const sheets = [
    { parameters: { end: "A++" }, baseHealth: 1500 },   // Asterios, Castor, Pollux
    { parameters: { end: "B+" }, baseHealth: 1250 },    // Penthesilea
    { parameters: { end: "A" }, baseHealth: 1500 },     // the agreeing majority
    { parameters: { end: "EX" }, baseHealth: 750 },
    { parameters: { end: "D-" } },
  ];

  it.each(sheets)("summon plan matches maxHealthFor for %o", (sheet) => {
    expect(baseOf(sheet)).toBe(maxHealthFor(sheet, lookup, Rank));
  });
});
