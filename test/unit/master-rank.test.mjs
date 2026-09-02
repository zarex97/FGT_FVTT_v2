/**
 * A Master's rank, and the two different questions asked of it.
 * @see docs/superpowers/specs/2026-09-02-master-rank-and-field-painting-design.md §2
 */
import { describe, it, expect } from "vitest";
import {
  tierOf, isHighRank, isRankless, paysHighColumn, grantBudget,
} from "../../module/rules/master-rank.mjs";
import { npCostAt } from "../../module/rules/costs.mjs";
import { costOf } from "../../module/rules/command-spells.mjs";
import { masterSetupPlan, resolveSetupPlan } from "../../module/rules/setup-rolls.mjs";

const master = (rank) => ({ id: "m1", kind: "master", rank });

describe("tierOf", () => {
  it("reads A and B as High", () => {
    expect(tierOf(master("A"))).toBe("high");
    expect(tierOf(master("B"))).toBe("high");
  });

  it("reads C and D as Low", () => {
    expect(tierOf(master("C"))).toBe("low");
    expect(tierOf(master("D"))).toBe("low");
  });

  it("reads an absent, blank or unparseable rank as Rankless", () => {
    // A world that predates the `choices` list stores "", and a typo stores
    // junk. Both are Rankless -- which is a real state, not an error.
    expect(tierOf(master(null))).toBe("rankless");
    expect(tierOf(master(""))).toBe("rankless");
    expect(tierOf(master("Rank A"))).toBe("rankless");
    expect(tierOf(undefined)).toBe("rankless");
  });
});

describe("the two price questions", () => {
  it("pays the High column for High AND Rankless", () => {
    // Ch. 15 §15.4: "Rankless Masters use the left column." The right column
    // is the Low Rank penalty, not the default -- this is the behaviour the
    // two cost readers already had, moved rather than changed.
    expect(paysHighColumn(master("A"))).toBe(true);
    expect(paysHighColumn(master(null))).toBe(true);
    expect(paysHighColumn(master("C"))).toBe(false);
  });

  it("keeps High Rank distinct from paying the High column", () => {
    // A Rankless Master pays the cheap price and gets none of a High Rank
    // Master's benefits. One predicate for both would be wrong.
    expect(paysHighColumn(master(null))).toBe(true);
    expect(isHighRank(master(null))).toBe(false);
    expect(isRankless(master(null))).toBe(true);
  });
});

describe("grantBudget", () => {
  it("gives a High Rank Master one parameter step and everyone else none", () => {
    expect(grantBudget(master("B"))).toBe(1);
    expect(grantBudget(master("C"))).toBe(0);
    expect(grantBudget(master(null))).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  The de-duplication must change nothing                                     */
/* -------------------------------------------------------------------------- */

/**
 * These are written and passing BEFORE `costs.mjs` and `command-spells.mjs`
 * stop carrying their own copies of `isHighRankMaster`, so they capture
 * today's behaviour rather than tomorrow's. If one of them fails after the
 * refactor, the refactor changed a price -- revert it, do not adjust the
 * expectation. `if (!rank) return true` is Ch. 15 §15.4, not a defect.
 */
describe("de-duplication is behaviour-preserving", () => {
  const servant = { id: "s1", kind: "servant", contract: "contracted", sustainability: 6 };
  const killYourself = { cost: 2, costByMasterRank: { high: 1, low: 2 } };

  it.each([["A"], ["B"], ["C"], ["D"], [null], [""]])(
    "Noble Phantasm cost for a %s-rank Master is unchanged",
    (rank) => {
      const cost = npCostAt({ rank: "A", unit: servant, master: master(rank) });
      // A Rank A Noble Phantasm: 50 on the left column, 60 on the right.
      expect(cost.amount).toBe(tierOf(master(rank)) === "low" ? 60 : 50);
      expect(cost.kind).toBe("masterHealth");
    },
  );

  it("Kill Yourself is 1 for High, 2 for Low, and 1 for Rankless", () => {
    expect(costOf(killYourself, master("A"))).toBe(1);
    expect(costOf(killYourself, master("C"))).toBe(2);
    expect(costOf(killYourself, master(null))).toBe(1);
  });

  it("Kill Yourself is 1 for everyone when the whole table is Rankless", () => {
    expect(costOf(killYourself, master("C"), { allMastersRankless: true })).toBe(1);
  });
});

describe("the coin flip keeps the rank it determines", () => {
  it("emits a rank line in coinFlip mode", () => {
    const plan = masterSetupPlan({}, { mode: "coinFlip" });
    const rank = plan.lines.find((l) => l.id === "rank");
    expect(rank).toBeDefined();
    expect(rank.roll.map).toEqual(["A", "C"]);
  });

  it("does not in the other two modes", () => {
    for (const mode of ["essences", "rankless"]) {
      expect(masterSetupPlan({}, { mode }).lines.find((l) => l.id === "rank")).toBeUndefined();
    }
  });

  it("derives Base Attack (MAG) from the rank rather than rolling it again", () => {
    const line = masterSetupPlan({}, { mode: "coinFlip" }).lines
      .find((l) => l.id === "baseAttackMag");
    expect(line.derivedFrom).toBe("rank");
    expect(line.roll).toBeNull();
    expect(line.map.A).toBe(125);
    expect(line.map.C).toBe(100);
  });

  it("resolves heads to a High Rank Master with 125", () => {
    // The coin is a 1d2: 1 is heads.
    const lines = resolveSetupPlan(masterSetupPlan({}, { mode: "coinFlip" }), { rank: 1 });
    expect(lines.find((l) => l.id === "rank").value).toBe("A");
    expect(lines.find((l) => l.id === "baseAttackMag").value).toBe(125);
  });

  it("resolves tails to a Low Rank Master with 100", () => {
    const lines = resolveSetupPlan(masterSetupPlan({}, { mode: "coinFlip" }), { rank: 2 });
    expect(lines.find((l) => l.id === "rank").value).toBe("C");
    expect(lines.find((l) => l.id === "baseAttackMag").value).toBe(100);
  });

  it("leaves the other modes' Base Attack untouched", () => {
    const rankless = resolveSetupPlan(masterSetupPlan({}, { mode: "rankless" }), {});
    expect(rankless.find((l) => l.id === "baseAttackMag").value).toBe(100);
    const byEssence = resolveSetupPlan(masterSetupPlan({ rank: "A" }, { mode: "essences" }), {});
    expect(byEssence.find((l) => l.id === "baseAttackMag").value).toBe(125);
  });
});
