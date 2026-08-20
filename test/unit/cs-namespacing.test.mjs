/**
 * @file Command Spell namespacing — per-relationship, not per-Master.
 * @see docs/16-relationships.md §16.9
 */

import { describe, it, expect } from "vitest";
import { availableFor, spendPlan, isUnbound, poolsOf } from "../../module/rules/cs-namespacing.mjs";

const master = (over = {}) => ({
  id: "kayneth", commandSpells: 3, commandSpellsPerServant: {}, servantIds: ["lancer"], ...over,
});

describe("availableFor", () => {
  it("counts the Master's own spells", () => {
    expect(availableFor(master(), "lancer")).toBe(3);
  });

  it("adds the spells granted for that Servant specifically", () => {
    // "own spells work on any contracted Servant; perServant spells only on
    // the named one."
    expect(availableFor(master({ commandSpellsPerServant: { lancer: 3 } }), "lancer")).toBe(6);
  });

  it("does NOT lend another Servant's spells", () => {
    expect(availableFor(master({ commandSpellsPerServant: { lancer: 3 } }), "archer")).toBe(3);
  });

  it("is zero for a Master with nothing", () => {
    expect(availableFor(master({ commandSpells: 0 }), "lancer")).toBe(0);
  });
});

describe("spendPlan", () => {
  it("spends the per-Servant pool FIRST", () => {
    // They are the more restricted pool, so spending them first is strictly
    // better for the player -- the own spells survive to be used on anyone.
    const plan = spendPlan(master({ commandSpells: 3, commandSpellsPerServant: { lancer: 2 } }), "lancer", 1);

    expect(plan).toMatchObject({ ok: true, fromPerServant: 1, fromOwn: 0 });
  });

  it("spills into the own pool once the per-Servant one is empty", () => {
    const plan = spendPlan(master({ commandSpells: 3, commandSpellsPerServant: { lancer: 2 } }), "lancer", 3);

    expect(plan).toMatchObject({ ok: true, fromPerServant: 2, fromOwn: 1 });
  });

  it("refuses when the two pools together are not enough", () => {
    expect(spendPlan(master({ commandSpells: 1 }), "lancer", 2))
      .toMatchObject({ ok: false, reason: "cost" });
  });

  it("reports which pool was used, because the sheet shows them apart", () => {
    expect(spendPlan(master({ commandSpellsPerServant: { lancer: 1 } }), "lancer", 1).pools)
      .toEqual(["perServant"]);
  });

  it("uses only the own pool when there is no grant", () => {
    expect(spendPlan(master(), "lancer", 2)).toMatchObject({ fromOwn: 2, fromPerServant: 0 });
  });
});

describe("isUnbound", () => {
  it("is derived from having nothing available for that Servant", () => {
    // "The Unbound state is derived from availableFor(master, servantId) === 0."
    expect(isUnbound(master({ commandSpells: 0 }), "lancer")).toBe(true);
  });

  it("leaves a Servant contracted while any spell can reach it", () => {
    expect(isUnbound(master({ commandSpells: 1 }), "lancer")).toBe(false);
  });

  it("produces the split state §16.9 calls genuinely interesting", () => {
    // Zero own spells, three borrowed for Servant B: A is Unbound and B is not.
    const m = master({ commandSpells: 0, commandSpellsPerServant: { b: 3 }, servantIds: ["a", "b"] });

    expect(isUnbound(m, "a")).toBe(true);
    expect(isUnbound(m, "b")).toBe(false);
  });
});

describe("poolsOf", () => {
  it("describes every contracted Servant, for the Master sheet", () => {
    const m = master({ commandSpells: 2, commandSpellsPerServant: { archer: 3 }, servantIds: ["lancer", "archer"] });

    expect(poolsOf(m)).toEqual([
      { servantId: "lancer", own: 2, granted: 0, total: 2, unbound: false },
      { servantId: "archer", own: 2, granted: 3, total: 5, unbound: false },
    ]);
  });

  it("flags the unbound ones", () => {
    const m = master({ commandSpells: 0, commandSpellsPerServant: {}, servantIds: ["lancer"] });

    expect(poolsOf(m)[0].unbound).toBe(true);
  });

  it("includes a Servant with a grant but no contract, because the grant is real", () => {
    // Spells granted for a Servant survive the contract that produced them --
    // that is the whole reason they are namespaced.
    const m = master({ commandSpells: 0, commandSpellsPerServant: { ghost: 2 }, servantIds: [] });

    expect(poolsOf(m).map((p) => p.servantId)).toEqual(["ghost"]);
  });
});
