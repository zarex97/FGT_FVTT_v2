/**
 * @file The turn budget.
 * @see docs/18-action-economy.md
 */

import { describe, it, expect } from "vitest";
import {
  emptyBudget, poolFor, preventedBy, canConsume, consume, movementRemaining,
  unmetCompulsions, canEndTurn, summarize, DEFAULT_MAXIMA,
} from "../../module/rules/budget.mjs";

/** A Servant snapshot with just the fields the budget reads. */
function servant(id, overrides = {}) {
  return { id, name: id, kind: "servant", mov: 5, effects: [], turnState: {}, ...overrides };
}

function master(id, overrides = {}) {
  return { id, name: id, kind: "master", mov: 3, effects: [], turnState: {}, ...overrides };
}

/** Spend a list of `[unit, action]` pairs, returning the final budget. */
function spend(budget, pairs) {
  let b = budget;
  for (const [unit, action] of pairs) {
    const r = consume(b, unit, action);
    b = r.budget;
  }
  return b;
}

describe("the four pools", () => {
  it("matches the rulebook's maxima", () => {
    expect(DEFAULT_MAXIMA.servantMove).toBe(4);
    expect(DEFAULT_MAXIMA.masterMove).toBe(3);
    expect(DEFAULT_MAXIMA.servantAttack).toBe(2);
    expect(DEFAULT_MAXIMA.masterAttack).toBe(Infinity);
  });

  it("routes each action to its pool", () => {
    expect(poolFor(servant("a"), "move")).toBe("servantMove");
    expect(poolFor(servant("a"), "attack")).toBe("servantAttack");
    expect(poolFor(servant("a"), "np")).toBe("servantAttack");
    expect(poolFor(master("m"), "move")).toBe("masterMove");
    expect(poolFor(master("m"), "attack")).toBe("masterAttack");
  });

  it("charges an Active Skill to the MOVE pool — decision D18.2", () => {
    expect(poolFor(servant("a"), "skill")).toBe("servantMove");
  });

  it("charges Gather to the move pool, as Semiramis's text states", () => {
    expect(poolFor(servant("a"), "gather")).toBe("servantMove");
  });

  it("exempts summons and platforms entirely", () => {
    expect(poolFor({ id: "b", kind: "summon" }, "attack")).toBeNull();
    expect(poolFor({ id: "p", kind: "platform" }, "move")).toBeNull();
    expect(poolFor({ id: "x", kind: "servant", exemptFromBudget: true }, "attack")).toBeNull();
  });

  it("lets a platform Move once and Attack once free, per Turn -- but not twice", () => {
    const b = emptyBudget();
    const platform = { id: "p", kind: "platform", turnState: {} };

    expect(canConsume(b, platform, "move").ok).toBe(true);
    expect(canConsume(b, platform, "attack").ok).toBe(true);

    // "Bašmu's actsOncePerTurn" shares the same cap; a platform is always
    // once-per-turn ("During Semiramis' Turn, the HGoB can Move/Attack once
    // per Turn"), so it needs no content flag of its own.
    const acted = { id: "p", kind: "platform", turnState: { moved: true, attacked: true } };
    expect(canConsume(b, acted, "move").ok).toBe(false);
    expect(canConsume(b, acted, "attack").ok).toBe(false);
    // Still free (no pool), even when refused.
    expect(canConsume(b, acted, "move").pool).toBeNull();
  });

  it("caps a summon with actsOncePerTurn -- Medea's Dragon Tooth Warriors", () => {
    const b = emptyBudget();
    const capped = { id: "s", kind: "summon", actsOncePerTurn: true, turnState: { moved: true } };
    expect(canConsume(b, capped, "move").ok).toBe(false);

    // A summon with the flag unset is exempt from every POOL regardless
    // (`poolFor`'s own unconditional `kind === "summon"` check), but is not
    // held to the once-per-turn cap -- that half is opt-in per the flag, and
    // the GENERIC rule below only refuses a second Move after an Attack, not
    // after a first Move (D18.2: "may Move as many times as MOV allows").
    const uncapped = { id: "w", kind: "summon", turnState: { moved: true } };
    const verdict = canConsume(b, uncapped, "move");
    expect(verdict.ok).toBe(true);
    expect(verdict.pool).toBeNull();
  });

  it("lets four Servants move and two DIFFERENT Servants attack — six units active", () => {
    const movers = ["a", "b", "c", "d"].map((id) => servant(id));
    const attackers = ["e", "f"].map((id) => servant(id));
    const b = spend(emptyBudget(), [
      ...movers.map((u) => [u, "move"]),
      ...attackers.map((u) => [u, "attack"]),
    ]);
    expect(b.pools.servantMove.used).toBe(4);
    expect(b.pools.servantAttack.used).toBe(2);
    expect(canConsume(b, servant("g"), "move").ok).toBe(false);
    expect(canConsume(b, servant("g"), "attack").ok).toBe(false);
  });

  it("refuses with a message naming the exhausted pool", () => {
    const b = spend(emptyBudget(), ["a", "b"].map((id) => [servant(id), "attack"]));
    expect(canConsume(b, servant("c"), "attack").reason).toMatch(/Servant attacks exhausted \(2\/2\)/);
  });
});

describe("the budget counts units, not actions — D18.3", () => {
  it("charges a move and then a skill by the same unit only once", () => {
    const u = servant("a");
    const after = spend(emptyBudget(), [[u, "move"], [u, "skill"]]);
    expect(after.pools.servantMove.used).toBe(1);
  });

  it("still charges the attack pool separately for a unit that moved", () => {
    const u = servant("a");
    const after = spend(emptyBudget(), [[u, "move"], [u, "attack"]]);
    expect(after.pools.servantMove.used).toBe(1);
    expect(after.pools.servantAttack.used).toBe(1);
  });

  it("lets a Master attack once and refuses a second, despite the unlimited pool", () => {
    const m = master("m");
    const after = spend(emptyBudget(), [[m, "attack"]]);
    expect(canConsume(after, m, "attack").ok).toBe(false);
    expect(canConsume(after, master("m2"), "attack").ok).toBe(true);
  });
});

describe("per-unit limits sit on top of the pools", () => {
  it("refuses a second attack by the same unit", () => {
    expect(canConsume(emptyBudget(), servant("a", { turnState: { attacked: true } }), "attack").ok)
      .toBe(false);
  });

  it("allows repeated moves before the attack, and refuses one after it", () => {
    // MOV is the limit on how far, and `segmentCheck` measures it; the budget's
    // only say is that Attacking fixes the Unit in place unless it has Riding.
    const moved = { turnState: { moved: true, moveSegments: 3 } };
    expect(canConsume(emptyBudget(), servant("a", moved), "move").ok).toBe(true);

    const attacked = servant("a", { turnState: { moved: true, attacked: true } });
    expect(canConsume(emptyBudget(), attacked, "move").ok).toBe(false);
    expect(canConsume(emptyBudget(), attacked, "move").reason).toMatch(/attacked and cannot move/);

    const rider = servant("a", { hasRiding: true, turnState: { moved: true, attacked: true } });
    expect(canConsume(emptyBudget(), rider, "move").ok).toBe(true);
  });

  it("makes Riding Attack terminal for that unit's turn", () => {
    const after = servant("a", { turnState: { usedRidingAttack: true } });
    expect(canConsume(emptyBudget(), after, "move").ok).toBe(false);
    expect(canConsume(emptyBudget(), after, "move").reason).toMatch(/Riding Attack ends/);
  });

  it("counts remaining movement across both Riding segments", () => {
    expect(movementRemaining(servant("a", { mov: 6, turnState: { movedPanels: 4 } }))).toBe(2);
    expect(movementRemaining(servant("a", { mov: 6, turnState: { movedPanels: 9 } }))).toBe(0);
  });
});

describe("prevention costs no budget, because the action never happens", () => {
  it("blocks everything under a blanket status", () => {
    for (const id of ["stun", "freeze", "sleep", "petrify", "webbed"]) {
      expect(preventedBy(servant("a", { effects: [id] }), "move").prevented).toBe(true);
      expect(preventedBy(servant("a", { effects: [id] }), "attack").prevented).toBe(true);
    }
  });

  it("blocks movement only under Immobilize", () => {
    const u = servant("a", { effects: ["immobilize"] });
    expect(preventedBy(u, "move").prevented).toBe(true);
    expect(preventedBy(u, "attack").prevented).toBe(false);
  });

  it("spares Spells from Seal and spares everything else from Silence", () => {
    expect(preventedBy(servant("a", { effects: ["seal"] }), "spell").prevented).toBe(false);
    expect(preventedBy(servant("a", { effects: ["seal"] }), "np").prevented).toBe(true);
    expect(preventedBy(servant("a", { effects: ["silence"] }), "spell").prevented).toBe(true);
    expect(preventedBy(servant("a", { effects: ["silence"] }), "attack").prevented).toBe(false);
  });

  it("blocks only Noble Phantasms under NP Seal", () => {
    const u = servant("a", { effects: ["npSeal"] });
    expect(preventedBy(u, "np").prevented).toBe(true);
    expect(preventedBy(u, "attack").prevented).toBe(false);
  });

  it("does not spend the pool when the action is prevented", () => {
    const u = servant("a", { effects: ["stun"] });
    const r = consume(emptyBudget(), u, "move");
    expect(r.ok).toBe(false);
    expect(r.budget.pools.servantMove.used).toBe(0);
  });
});

describe("compulsions are validated at turn end — D18.4", () => {
  it("is silent when the player attacked with nobody", () => {
    const units = [servant("berserker", { effects: ["decoy:target"] }), servant("saber")];
    expect(unmetCompulsions(units)).toEqual([]);
  });

  it("fires when the player attacked with somebody else", () => {
    const units = [
      servant("lancer", { effects: ["decoy:target"] }),
      servant("saber", { turnState: { attacked: true } }),
    ];
    const unmet = unmetCompulsions(units);
    expect(unmet.length).toBe(1);
    expect(unmet[0].effect).toBe("Decoy");
    expect(unmet[0].message).toMatch(/must be one of the attackers/);
  });

  it("is satisfied when the compelled unit is among the attackers", () => {
    const units = [
      servant("lancer", { effects: ["decoy:target"], turnState: { attacked: true } }),
      servant("saber", { turnState: { attacked: true } }),
    ];
    expect(unmetCompulsions(units)).toEqual([]);
  });

  it("compels a Berserked unit even when nobody attacked", () => {
    const unmet = unmetCompulsions([servant("berserker", { effects: ["berserk"] })]);
    expect(unmet.length).toBe(1);
    expect(unmet[0].message).toMatch(/must Move and Attack/);
  });

  it("does not fault a unit that could not have attacked", () => {
    expect(unmetCompulsions([
      servant("lancer", { effects: ["berserk", "stun"] }),
      servant("saber", { turnState: { attacked: true } }),
    ])).toEqual([]);
  });

  it("blocks ending the turn and says why", () => {
    const verdict = canEndTurn([
      servant("lancer", { effects: ["decoy:target"] }),
      servant("saber", { turnState: { attacked: true } }),
    ]);
    expect(verdict.ok).toBe(false);
    expect(verdict.unmet[0].unitName).toBe("lancer");
  });

  it("allows ending the turn when nothing is unmet", () => {
    expect(canEndTurn([servant("saber")]).ok).toBe(true);
  });
});

describe("summarize — what the HUD draws", () => {
  it("returns a pip row per finite pool", () => {
    const rows = summarize(spend(emptyBudget(), [[servant("a"), "move"], [servant("b"), "move"]]));
    const moves = rows.find((r) => r.pool === "servantMove");
    expect(moves.label).toBe("Servant moves");
    expect(moves.pips).toEqual([true, true, false, false]);
  });

  it("omits the unbounded Master attack pool, which has nothing to draw", () => {
    expect(summarize(emptyBudget()).map((r) => r.pool)).not.toContain("masterAttack");
  });
});
