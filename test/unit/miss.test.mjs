/**
 * @file Blind's Miss chance, and Combat Process step 1.5.
 * @see docs/A-effect-catalogue.md §A (Blind), docs/12-combat-process.md §12.2
 *
 * Appendix A has catalogued Blind since it was written and nothing ever
 * authored it, because clause 1 needs a step the Combat Process did not have:
 * an Evade is the DEFENDER answering a swing that happened, and a Miss is the
 * swing not happening at all.
 */

import { describe, it, expect } from "vitest";
import { missChance, missSourceOf, MISS_SOURCES } from "../../module/rules/miss.mjs";
import {
  begin, advance, isComplete, didHit, pendingPrompt, windowFor, serialize, deserialize, STATES,
} from "../../module/engine/combat-process.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";

const blind = { id: "u", kind: "servant", effects: ["blind"] };
const sighted = { id: "u", kind: "servant", effects: [] };
const opts = (...o) => new Set(o);

describe("Blind's Miss chance (B1, B4, B5)", () => {
  it("is zero for a unit that is not Blind", () => {
    expect(missChance(sighted)).toBe(0);
  });

  it("is 80% for a Blind unit", () => {
    expect(missChance(blind)).toBe(80);
    expect(MISS_SOURCES.blind).toBe(80);
  });

  it("drops to 40% with Clairvoyance (clause 4)", () => {
    expect(missChance(blind, opts("self:skill:clairvoyance"))).toBe(40);
  });

  it("is zero with Eye of the Mind active, at either Rank (clause 5)", () => {
    // EMIYA carries (True) and Heracles carries (False); the catalogue's
    // exemption names neither rank, so both qualify. Both are authored, which
    // is what makes this exemption testable rather than speculative.
    expect(missChance(blind, opts("self:skillActive:eyeOfTheMind"))).toBe(0);
    expect(missChance(blind, opts("self:skillActive:eyeOfTheMindFalse"))).toBe(0);
  });

  it("lets Eye of the Mind beat Clairvoyance rather than stacking with it", () => {
    // Ordered, not summed: clause 5 exempts 1, 2 and 4 together, so a unit
    // with both is simply exempt -- not 20%, and not 0%-by-way-of-40%.
    expect(missChance(blind, opts("self:skill:clairvoyance", "self:skillActive:eyeOfTheMind")))
      .toBe(0);
  });

  it("ignores a HELD but unactivated Eye of the Mind", () => {
    // *"with Eye of the Mind ACTIVE"*. Holding the Skill is not the exemption.
    expect(missChance(blind, opts("self:skill:eyeOfTheMind"))).toBe(80);
  });

  it("names the effect causing the miss, for the card", () => {
    expect(missSourceOf(blind)).toBe("blind");
    expect(missSourceOf(sighted)).toBeNull();
  });
});

describe("Combat Process step 1.5 (R8)", () => {
  const proc = () => begin({ attackerId: "a", defenderId: "d", attack: {} });

  it("declares both new states", () => {
    expect(STATES).toContain("missCheck");
    expect(STATES).toContain("missed");
  });

  it("routes declaration through the miss check rather than straight to react", () => {
    expect(advance(proc(), "done").state).toBe("missCheck");
  });

  it("continues to the reaction on a hit", () => {
    expect(advance(advance(proc(), "done"), "hit").state).toBe("react");
  });

  it("ends the Process on a miss, with no facing and no counter", () => {
    let s = advance(advance(proc(), "done"), "miss");
    expect(s.state).toBe("missed");
    s = advance(s, "done");
    expect(s.state).toBe("done");
    expect(isComplete(s)).toBe(true);
  });

  it("reports a miss as not having hit", () => {
    const s = advance(advance(proc(), "done"), "miss");
    expect(didHit(s)).toBe(false);
  });

  it("never reaches the counter rung after a miss", () => {
    const s = advance(advance(advance(proc(), "done"), "miss"), "done");
    expect(s.history.some((h) => h.state === "facing")).toBe(false);
    expect(s.history.some((h) => h.state === "counter")).toBe(false);
  });

  it("serializes a miss as a terminal state", () => {
    // The Process crosses a socket and is rebuilt on the other side. A miss
    // that deserialized as "waiting for a reaction" would hang for ever.
    const s = advance(advance(advance(proc(), "done"), "miss"), "done");
    expect(isComplete(deserialize(serialize(s)))).toBe(true);
  });

  it("offers no prompt at the miss check", () => {
    // A roll resolved automatically, like the damage step -- not a question.
    // A PROMPTS entry here would stop the ladder to ask something nobody can
    // answer, which is how heelResolve once hung in play.
    expect(pendingPrompt(advance(proc(), "done"))).toBeNull();
  });

  it("opens no Command Spell window at either new state", () => {
    const check = advance(proc(), "done");
    expect(windowFor(check)).toBeNull();
    expect(windowFor(advance(check, "miss"))).toBeNull();
  });

  it("records the roll that caused the miss", () => {
    const s = advance(advance(proc(), "done"), "miss", {
      rollRecord: { check: "miss", total: 12, target: 80, outcome: "miss" },
    });
    expect(s.rolls.some((r) => r.check === "miss")).toBe(true);
  });
});

describe("Blind clause 3 — Mystic Eye and Glam Sight Skills cannot be used", () => {
  const suppressed = { id: "medusa", kind: "servant", suppressions: [{ scope: "mysticEye" }] };
  const clear = { id: "medusa", kind: "servant", suppressions: [] };
  const eyes = { id: "a", name: "Mystic Eyes", categorizedAs: ["mysticEye"] };
  const other = { id: "b", name: "Monstrous Strength", categorizedAs: [] };

  it("refuses an ability tagged with the suppressed category", () => {
    const v = canUseAbility({ ability: eyes, unit: suppressed, clockRunning: true });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("suppressedCategory");
    expect(v.detail.category).toBe("mysticEye");
  });

  it("leaves the same ability usable when nothing suppresses it", () => {
    expect(canUseAbility({ ability: eyes, unit: clear, clockRunning: true }).reason)
      .not.toBe("suppressedCategory");
  });

  it("does not touch an ability outside the family", () => {
    expect(canUseAbility({ ability: other, unit: suppressed, clockRunning: true }).reason)
      .not.toBe("suppressedCategory");
  });

  it("is NOT lifted by Eye of the Mind", () => {
    // Clause 5 exempts 1, 2 and 4, and says nothing about 3 -- so a Unit with
    // Eye of the Mind still cannot use a Mystic Eye while Blind. The gate does
    // not consult the skill at all, which is what makes that true.
    const withEye = { ...suppressed, skills: ["eyeOfTheMind"] };
    expect(canUseAbility({ ability: eyes, unit: withEye, clockRunning: true }).reason)
      .toBe("suppressedCategory");
  });
});
