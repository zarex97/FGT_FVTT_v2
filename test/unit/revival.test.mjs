/**
 * @file Coming back from zero Health, in the order the sheet states.
 * @see module/rules/revival.mjs, docs/31-case-heracles.md §31.2, §31.3
 *
 * Heracles has four ways back and his sheet names the order:
 *
 * > *"Undying > normal Guts > Battle Continuation > God Hand."*
 *
 * The defeat handler used to take **any** handler that healed, in collection
 * order. With one source that is indistinguishable from correct; with four it
 * spends whichever happened to be listed first, which for him means burning a
 * God Hand charge while `Undying` sits unused.
 */

import { describe, it, expect } from "vitest";
import {
  availableRevivals, resolveRevival, pendingRevivalRolls,
  attackIdentity, recordedAttack, REVIVAL_PRIORITY,
} from "../../module/rules/revival.mjs";

const undying = {
  id: "undying", priority: REVIVAL_PRIORITY.specialGuts, charges: 1,
  cascading: false, formula: null, percentOfMax: 25, consumesOnUse: true,
  defId: "undying", abilityId: null, source: "Undying",
};

const battleContinuation = {
  id: "battleContinuation", priority: REVIVAL_PRIORITY.skill, charges: null,
  cascading: false, formula: "5d20", percentOfMax: null, consumesOnUse: true,
  defId: null, abilityId: "bc", source: "Battle Continuation",
  requiresHealthRestoredSince: 0.5,
};

const godHand = {
  id: "godHand", priority: REVIVAL_PRIORITY.passive, charges: 11,
  cascading: true, formula: "10d20", percentOfMax: null, consumesOnUse: true,
  defId: null, abilityId: "gh", source: "God Hand",
};

/** Heracles, with all four and nothing blocking any of them. */
const heracles = (over = {}) => ({
  id: "h",
  health: 0,
  maxHealth: 1500,
  abilities: [
    { id: "bc", name: "Battle Continuation", cooldownRemaining: 0, lastUsedTick: null },
    { id: "gh", name: "God Hand", cooldownRemaining: 0, lastUsedTick: null },
  ],
  healthWatermarks: {},
  revivals: [godHand, battleContinuation, undying],
  ...over,
});

describe("the order", () => {
  it("is by priority, not by declaration", () => {
    // The list is deliberately given worst-first above.
    expect(availableRevivals(heracles()).map((s) => s.id))
      .toEqual(["undying", "battleContinuation", "godHand"]);
  });

  it("spends Undying before anything else", () => {
    const out = resolveRevival({ unit: heracles(), overkill: 0 });

    expect(out.source.id).toBe("undying");
    expect(out.restored).toBe(375);       // 25% of 1500
    expect(out.chargesUsed).toBe(1);
  });

  it("falls to the next source when the one above is spent", () => {
    const unit = heracles({ revivals: [godHand, battleContinuation, { ...undying, charges: 0 }] });
    const out = resolveRevival({ unit, overkill: 0, rolls: { "revival:battleContinuation:0": 60 } });

    expect(out.source.id).toBe("battleContinuation");
    expect(out.restored).toBe(60);
  });

  it("defeats the unit when nothing is available", () => {
    const out = resolveRevival({ unit: heracles({ revivals: [] }), overkill: 0 });

    expect(out.revived).toBe(false);
    expect(out.source).toBe(null);
  });
});

describe("availability", () => {
  it("refuses a source whose own ability is on cooldown", () => {
    // The gate reuses the clock `advanceCooldowns` already turns, so the window
    // is visible on the sheet where a player can see why the revive did not
    // happen.
    const unit = heracles({
      abilities: [
        { id: "bc", name: "Battle Continuation", cooldownRemaining: 4, lastUsedTick: null },
        { id: "gh", name: "God Hand", cooldownRemaining: 0, lastUsedTick: null },
      ],
      revivals: [battleContinuation, godHand],
    });

    expect(availableRevivals(unit).map((s) => s.id)).toEqual(["godHand"]);
  });

  it("refuses a source that has not recovered since its last use", () => {
    // "The Unit's Health must have been RESTORED BACK to above half its maximum
    // value at least once since the last activation." A question about history —
    // Battle Continuation has carried it since it was written with nothing
    // enforcing it, because nothing recorded the crossing.
    const notYet = heracles({
      abilities: [{ id: "bc", name: "Battle Continuation", cooldownRemaining: 0, lastUsedTick: 9 }],
      healthWatermarks: { 0.5: 4 },
      revivals: [battleContinuation],
    });
    expect(availableRevivals(notYet)).toEqual([]);

    const recovered = heracles({
      abilities: [{ id: "bc", name: "Battle Continuation", cooldownRemaining: 0, lastUsedTick: 9 }],
      healthWatermarks: { 0.5: 11 },
      revivals: [battleContinuation],
    });
    expect(availableRevivals(recovered).map((s) => s.id)).toEqual(["battleContinuation"]);
  });

  it("allows a source that has never been used, whatever the watermark says", () => {
    // "Since the last usage", and there has not been one.
    const fresh = heracles({
      abilities: [{ id: "bc", name: "Battle Continuation", cooldownRemaining: 0, lastUsedTick: null }],
      healthWatermarks: {},
      revivals: [battleContinuation],
    });
    expect(availableRevivals(fresh)).toHaveLength(1);
  });
});

describe("God Hand's cascade", () => {
  const only = (over = {}) => heracles({ revivals: [{ ...godHand, ...over }] });

  it("keeps what one charge restores beyond the overkill", () => {
    const out = resolveRevival({ unit: only(), overkill: 0, rolls: { "revival:godHand:0": 105 } });

    expect(out.restored).toBe(105);
    expect(out.chargesUsed).toBe(1);
  });

  it("burns several charges against one very large hit", () => {
    // §31.3's worked figure: 4,000 damage into a Heracles at 1,500 leaves 2,500
    // of overkill, which is two or three charges at an average of 105 a roll.
    const rolls = {
      "revival:godHand:0": 1000, "revival:godHand:1": 1000,
      "revival:godHand:2": 700, "revival:godHand:3": 100,
    };
    const out = resolveRevival({ unit: only(), overkill: 2500, rolls });

    expect(out.chargesUsed).toBe(3);
    expect(out.restored).toBe(200);       // 2700 rolled − 2500 overkill
    expect(out.revived).toBe(true);
  });

  it("is defeated, and still spends the charges, when they run out", () => {
    // "And so on" describes an attempt, not a refund.
    const out = resolveRevival({
      unit: only({ charges: 2 }),
      overkill: 5000,
      rolls: { "revival:godHand:0": 100, "revival:godHand:1": 100 },
    });

    expect(out.revived).toBe(false);
    expect(out.chargesUsed).toBe(2);
  });

  it("does not cascade a source that is not declared cascading", () => {
    const out = resolveRevival({
      unit: heracles({ revivals: [{ ...battleContinuation, charges: 5 }] }),
      overkill: 500,
      rolls: { "revival:battleContinuation:0": 60, "revival:battleContinuation:1": 60 },
    });

    expect(out.chargesUsed).toBe(1);
    expect(out.revived).toBe(false);
  });
});

describe("the rolls the caller has to make", () => {
  it("asks for one per charge a cascading source might spend", () => {
    const specs = pendingRevivalRolls(heracles({ revivals: [godHand] }));

    expect(specs).toHaveLength(11);
    expect(specs[0]).toEqual({ key: "revival:godHand:0", formula: "10d20" });
  });

  it("asks for one for a source that cannot cascade", () => {
    expect(pendingRevivalRolls(heracles({ revivals: [battleContinuation] }))).toHaveLength(1);
  });

  it("asks for none from a source with no formula", () => {
    // Undying restores a fraction of maximum; there is nothing to roll.
    expect(pendingRevivalRolls(heracles({ revivals: [undying] }))).toEqual([]);
  });
});

describe("God Hand's ledger", () => {
  it("identifies an attack by its ABILITY, and a Normal Attack by its attacker", () => {
    // §31.3's decision. Recording the attacking Unit would mean one kill locks
    // that Servant out for ever by any means; recording the instance is
    // vacuous, because an instance never recurs.
    expect(attackIdentity({ abilityId: "vasavi" }, "karna")).toBe("ability:vasavi");
    expect(attackIdentity({}, "karna")).toBe("normal:karna");
  });

  it("floors an attack it has already survived", () => {
    const unit = {
      abilities: [{ id: "gh", name: "God Hand", recordedAttacks: ["ability:vasavi"] }],
    };

    expect(recordedAttack(unit, "ability:vasavi")).toEqual({ floored: true, source: "God Hand" });
    expect(recordedAttack(unit, "ability:brahmastra").floored).toBe(false);
    // Karna's Normal Attacks are a separate identity from his Noble Phantasms.
    expect(recordedAttack(unit, "normal:karna").floored).toBe(false);
  });
});

describe("a source with no percentOfMax", () => {
  it("uses its dice, rather than restoring nothing", () => {
    // Found live. `resolveValue` scalarises an absent value to 0, and
    // `resolveRevival` reads "has a percentOfMax" as "is not null" — so a zero
    // beat the formula to the branch and every roll-based revival in the game
    // restored nothing at all.
    const source = { ...battleContinuation, percentOfMax: null };
    const out = resolveRevival({
      unit: heracles({ revivals: [source] }),
      rolls: { "revival:battleContinuation:0": 77 },
    });

    expect(out.restored).toBe(77);
  });

  it("prefers the fraction when one IS stated", () => {
    const out = resolveRevival({ unit: heracles({ revivals: [undying] }) });
    expect(out.restored).toBe(375);
  });
});

describe("what a spent source costs", () => {
  it("names the effect for a buff-borne source and the ability for a skill-borne one", () => {
    // Exactly one of the two, and the executor has to be able to tell them
    // apart: an effect-borne source is spent by consuming a charge, an
    // ability-borne one by turning its own clock. Without the distinction
    // `Undying` revived Heracles and was never consumed — which makes a
    // one-use buff permanent. Found live.
    expect(undying.defId).toBe("undying");
    expect(undying.abilityId).toBe(null);

    expect(godHand.defId).toBe(null);
    expect(godHand.abilityId).toBe("gh");
  });
});
