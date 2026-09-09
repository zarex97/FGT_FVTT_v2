/**
 * @file The Normal ruleset's setup rolls.
 * @see module/rules/setup-rolls-normal.mjs
 * @see char_orig_sheets/extra docs/Normal Great Holy Grail War.md
 */

import { describe, it, expect } from "vitest";
import {
  normalServantSetupPlan, normalMasterSetupPlan,
} from "../../module/rules/setup-rolls-normal.mjs";
import { resolveSetupPlan } from "../../module/rules/setup-rolls.mjs";

const sheet = (over = {}) => ({ baseHealth: 750, classContainer: "berserker", ...over });
const line = (plan, id) => plan.lines.find((l) => l.id === id);
const resolved = (plan, rolls, signs = {}) => {
  const out = resolveSetupPlan(plan, rolls, signs);
  return (id) => out.find((l) => l.id === id)?.value;
};

describe("normalServantSetupPlan", () => {
  it("rolls Max Health as the Base Health plus or minus 10d20", () => {
    const plan = normalServantSetupPlan(sheet());
    expect(line(plan, "maxHealth").base).toBe(750);
    expect(line(plan, "maxHealth").roll).toEqual({ formula: "10d20", signCoin: true });
  });

  it("adds on Heads and subtracts on Tails", () => {
    const plan = normalServantSetupPlan(sheet());
    expect(resolved(plan, { maxHealth: 87 })("maxHealth")).toBe(837);
    expect(resolved(plan, { maxHealth: 87 }, { maxHealth: true })("maxHealth")).toBe(663);
  });

  it("rolls Max Agility as 1d10 over a flat base of 10", () => {
    const plan = normalServantSetupPlan(sheet({ classContainer: "saber" }));
    expect(line(plan, "maxAgility").base).toBe(10);
    expect(line(plan, "maxAgility").roll).toEqual({ formula: "1d10" });
  });

  it("applies every Agility class delta the rulebook states", () => {
    const agility = (c) => line(normalServantSetupPlan(sheet({ classContainer: c })), "maxAgility").base;
    expect(agility("lancer")).toBe(12);
    expect(agility("rider")).toBe(11);
    expect(agility("caster")).toBe(8);
    expect(agility("assassin")).toBe(13);
    for (const c of ["saber", "archer", "berserker"]) expect(agility(c)).toBe(10);
  });

  it("applies every Luck class delta the rulebook states", () => {
    const luck = (c) => line(normalServantSetupPlan(sheet({ classContainer: c })), "maxLuck").base;
    expect(luck("lancer")).toBe(-2);
    expect(luck("assassin")).toBe(2);
    for (const c of ["saber", "archer", "rider", "caster", "berserker"]) expect(luck(c)).toBe(0);
    expect(line(normalServantSetupPlan(sheet()), "maxLuck").roll).toEqual({ formula: "1d20" });
  });

  it("notes a delta on the line, so the sheet says where it came from", () => {
    const plan = normalServantSetupPlan(sheet({ classContainer: "assassin" }));
    expect(line(plan, "maxAgility").note).toBe("assassin +3");
    expect(line(plan, "maxLuck").note).toBe("assassin +2");
    expect(line(normalServantSetupPlan(sheet({ classContainer: "saber" })), "maxLuck").note)
      .toBeNull();
  });

  it("gives a container the table does not name no delta, rather than throwing", () => {
    const plan = normalServantSetupPlan(sheet({ classContainer: "ruler" }));
    expect(line(plan, "maxAgility").base).toBe(10);
    expect(line(plan, "maxLuck").base).toBe(0);
  });
});

describe("normalMasterSetupPlan", () => {
  it("rolls Max Health as 250 plus or minus 5d20", () => {
    const plan = normalMasterSetupPlan({}, { mode: "rankless" });
    expect(line(plan, "maxHealth").base).toBe(250);
    expect(line(plan, "maxHealth").roll).toEqual({ formula: "5d20", signCoin: true });
  });

  it("rolls Agility on 1d12 and Luck on 1d20, from no flat base", () => {
    const plan = normalMasterSetupPlan({}, { mode: "rankless" });
    expect(line(plan, "maxAgility")).toMatchObject({ base: 0, roll: { formula: "1d12" } });
    expect(line(plan, "maxLuck")).toMatchObject({ base: 0, roll: { formula: "1d20" } });
  });

  it("gives every Master Base Attack (MAG) 100 when ranks are not in play", () => {
    const plan = normalMasterSetupPlan({}, { mode: "rankless" });
    expect(resolved(plan, {})("baseAttackMag")).toBe(100);
    expect(line(plan, "rank")).toBeUndefined();
  });

  it("flips a coin for the rank, and Base Attack follows the rank it picked", () => {
    const plan = normalMasterSetupPlan({}, { mode: "coinFlip" });
    expect(line(plan, "rank").roll).toEqual({ formula: "1d2", map: ["A", "C"] });
    expect(resolved(plan, { rank: 1 })("baseAttackMag")).toBe(125);
    expect(resolved(plan, { rank: 2 })("baseAttackMag")).toBe(100);
  });

  it("keeps the rank the coin picked, rather than folding it into Base Attack", () => {
    // The Advanced plan had this defect: a Master who flipped Heads got 125 and
    // was Rankless for ZON, Sustainability, the parameter grant and the Kill
    // Yourself price. One coin, one answer.
    const plan = normalMasterSetupPlan({}, { mode: "coinFlip" });
    expect(resolved(plan, { rank: 1 })("rank")).toBe("A");
    expect(resolved(plan, { rank: 2 })("rank")).toBe("C");
  });

  it("emits the rank before the line that derives from it", () => {
    const ids = normalMasterSetupPlan({}, { mode: "coinFlip" }).lines.map((l) => l.id);
    expect(ids.indexOf("rank")).toBeLessThan(ids.indexOf("baseAttackMag"));
  });

  it("gives three Command Spells and rolls nothing for them", () => {
    const plan = normalMasterSetupPlan({}, { mode: "rankless" });
    expect(line(plan, "commandSpells")).toMatchObject({ base: 3, roll: null });
  });
});
