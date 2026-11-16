/**
 * #415: an attack that rolls ONE Injury Roll on the total of its hits (`damage.singleInjuryRoll`, Dragon Wing
 * Warriors' 50 a hit) waited for every hit's damage, and a hit that was Evaded never has any: it counted as pending for
 * ever and no hit rolled. A hit that ended before its Damage Step takes 0; one still before it is pending.
 */
import { describe, it, expect } from "vitest";
import { injuryTotalsOf, BEFORE_DAMAGE_STATES } from "../../module/rules/injury.mjs";
import { STATES } from "../../module/engine/combat-process.mjs";

const hit = (total, extra = 0) => ({ state: { state: "injury" }, result: { total, flags: { fixedExtra: extra } } });

describe("one Injury Roll on the total (#415)", () => {
  it("counts an Evaded hit as 0, not as pending", () => {
    const out = injuryTotalsOf([{ state: { state: "noDamage" }, result: null }, hit(50), hit(50)]);
    expect(out).toEqual({ total: 100, counted: 100, pending: 0 });
  });

  it("counts a missed, a withdrawn and a finished hit with no damage as 0", () => {
    for (const s of ["missed", "withdrawn", "done", "counter", "facing"]) {
      expect(injuryTotalsOf([{ state: { state: s }, result: null }, hit(120)]).pending, s).toBe(0);
    }
  });

  it("still waits for a hit standing before its Damage Step", () => {
    for (const s of ["react", "evadeRoll", "s24_luckyEvasion", "damage"]) {
      expect(injuryTotalsOf([{ state: { state: s }, result: null }, hit(50)]).pending, s).toBe(1);
    }
  });

  it("keeps a fixed bonus out of what counts toward the roll", () => {
    expect(injuryTotalsOf([hit(80, 30), hit(80)])).toEqual({ total: 160, counted: 130, pending: 0 });
  });

  it("names only states the Combat Process has, every one before `noDamage`", () => {
    for (const s of BEFORE_DAMAGE_STATES) expect(STATES).toContain(s);
    expect(BEFORE_DAMAGE_STATES).not.toContain("noDamage");
  });
});
