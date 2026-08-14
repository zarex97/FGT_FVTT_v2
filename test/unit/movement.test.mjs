/**
 * @file Movement legality, reachability and the Riding segments.
 * @see docs/08-board-and-geometry.md §8.3
 */

import { describe, it, expect } from "vitest";
import {
  planMovement, validatePath, remainingMovement, effectiveMov, segmentCheck,
  canPassThrough, canStopOn, inEnemyMasterProtection,
} from "../../module/rules/movement.mjs";
import { squareBounds, key } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });
const bounds = squareBounds(13);

function mover(over = {}) {
  return {
    id: "me", kind: "servant", factionId: "a", panel: at(6, 6), mov: 4,
    effects: [], turnState: {}, ...over,
  };
}

function board(units = [], over = {}) {
  return { bounds, units, alliances: { a: ["a"], b: ["b"] }, ...over };
}

function other(id, i, j, over = {}) {
  return { id, kind: "servant", factionId: "b", panel: at(i, j), effects: [], ...over };
}

describe("effectiveMov", () => {
  it("returns MOV untouched by default", () => {
    expect(effectiveMov(mover({ mov: 5 }))).toBe(5);
  });

  it("halves MOV under Slow, rounding down — not doubling step cost", () => {
    expect(effectiveMov(mover({ mov: 5, effects: ["slow"] }))).toBe(2);
    expect(effectiveMov(mover({ mov: 4, effects: ["slow"] }))).toBe(2);
  });

  it("never goes negative", () => {
    expect(effectiveMov(mover({ mov: 0, effects: ["slow"] }))).toBe(0);
  });
});

describe("remainingMovement — one allowance across both Riding segments", () => {
  it("subtracts what has already been walked", () => {
    expect(remainingMovement(mover({ mov: 6, turnState: { movedPanels: 4 } }))).toBe(2);
  });

  it("clamps at zero rather than going negative", () => {
    expect(remainingMovement(mover({ mov: 6, turnState: { movedPanels: 9 } }))).toBe(0);
  });
});

describe("reachability is orthogonal only", () => {
  it("produces the Manhattan diamond, never the diagonal square", () => {
    const plan = planMovement(mover({ mov: 2 }), board());
    // |di| + |dj| <= 2, minus the origin: 12 panels.
    expect(plan.reachable.size).toBe(12);
    // A Chebyshev square of radius 2 would include (4,4); the diamond does not.
    expect(plan.reachable.has(key(at(4, 4)))).toBe(false);
    expect(plan.reachable.has(key(at(5, 5)))).toBe(true); // two orthogonal steps
    expect(plan.reachable.has(key(at(4, 6)))).toBe(true); // two steps north
  });

  it("shrinks with the movement already spent", () => {
    const partial = planMovement(mover({ mov: 4, turnState: { movedPanels: 3 } }), board());
    expect(partial.budget).toBe(1);
    expect(partial.reachable.size).toBe(4);
  });

  it("stops at the board edge", () => {
    const corner = planMovement(mover({ mov: 2, panel: at(0, 0) }), board());
    expect([...corner.reachable.keys()].every((k) => !k.startsWith("-"))).toBe(true);
  });
});

describe("clause 3 — through, not onto", () => {
  const foe = other("foe", 6, 7);

  it("refuses to pass through an enemy", () => {
    expect(canPassThrough(at(6, 7), mover(), board([foe]))).toBe(false);
  });

  it("lets an ally be passed through but not stopped on", () => {
    const ally = { ...other("ally", 6, 7), factionId: "a" };
    const b = board([ally]);
    expect(canPassThrough(at(6, 7), mover(), b)).toBe(true);
    expect(canStopOn(at(6, 7), mover(), b)).toBe(false);
  });

  it("cuts off everything behind an enemy in a corridor", () => {
    const wall = [other("a1", 5, 6), other("a2", 7, 6), other("a3", 6, 5), other("a4", 6, 7)];
    expect(planMovement(mover({ mov: 3 }), board(wall)).reachable.size).toBe(0);
  });

  it("is bypassed by Presence Concealment", () => {
    const sneaky = mover({ effects: ["presenceConcealment"] });
    expect(canPassThrough(at(6, 7), sneaky, board([other("foe", 6, 7)]))).toBe(true);
  });

  it("lets any unit stop on a platform", () => {
    const platform = { id: "p", kind: "platform", factionId: "b", panel: at(6, 7) };
    expect(canStopOn(at(6, 7), mover(), board([platform]))).toBe(true);
  });
});

describe("clause 4 — enemy Master protection", () => {
  const master = { id: "m", kind: "master", factionId: "b", panel: at(6, 9), effects: [] };
  const guard = { id: "g", kind: "servant", factionId: "b", panel: at(6, 10), effects: [] };

  it("blocks the ring around a guarded Master", () => {
    expect(inEnemyMasterProtection(at(6, 8), mover(), board([master, guard]))).toBe(true);
    expect(inEnemyMasterProtection(at(6, 7), mover(), board([master, guard]))).toBe(false);
  });

  it("does not block when the Master's Servant is more than 2 panels away", () => {
    const distant = { ...guard, panel: at(0, 0) };
    expect(inEnemyMasterProtection(at(6, 8), mover(), board([master, distant]))).toBe(false);
  });

  it("does not protect a Master from its own faction's units", () => {
    const friendly = { ...master, factionId: "a" };
    expect(inEnemyMasterProtection(at(6, 8), mover(), board([friendly, guard]))).toBe(false);
  });

  it("removes the protected panels from reachability", () => {
    const plan = planMovement(mover({ mov: 3 }), board([master, guard]));
    expect(plan.reachable.has(key(at(6, 8)))).toBe(false);
  });
});

describe("validatePath", () => {
  const b = board([other("foe", 6, 8)]);

  it("accepts a legal orthogonal path", () => {
    const v = validatePath([at(6, 7), at(5, 7)], mover(), b);
    expect(v.ok).toBe(true);
    expect(v.cost).toBe(2);
  });

  it("rejects a diagonal step by name", () => {
    expect(validatePath([at(5, 7)], mover(), b).reasons[0]).toMatch(/cannot Move diagonally/);
  });

  it("rejects a path through an enemy", () => {
    expect(validatePath([at(6, 7), at(6, 8)], mover(), b).reasons.join(" "))
      .toMatch(/may not enter/);
  });

  it("rejects a path longer than the remaining budget, quoting both numbers", () => {
    const tired = mover({ mov: 4, turnState: { movedPanels: 3 } });
    const path = [at(6, 7), at(6, 6), at(6, 5)];
    expect(validatePath(path, tired, board()).reasons.join(" "))
      .toMatch(/3 panels; 1 remain of MOV 4/);
  });

  it("reports every reason, not only the first", () => {
    const tired = mover({ mov: 1 });
    const v = validatePath([at(5, 7), at(4, 8)], tired, board());
    expect(v.reasons.length).toBeGreaterThan(1);
  });

  it("accepts an empty path as a no-op", () => {
    expect(validatePath([], mover(), board()).ok).toBe(true);
  });
});

describe("Riding's two segments", () => {
  it("refuses a second move without Riding", () => {
    expect(segmentCheck(mover({ turnState: { moved: true } }), false))
      .toMatch(/already Moved this Turn/);
  });

  it("refuses Riding's second move before the attack", () => {
    expect(segmentCheck(mover({ turnState: { moved: true, attacked: false } }), true))
      .toMatch(/requires an Attack between/);
  });

  it("allows Riding's second move after the attack", () => {
    expect(segmentCheck(mover({ turnState: { moved: true, attacked: true, moveSegments: 1 } }), true))
      .toBeNull();
  });

  it("refuses a third segment", () => {
    expect(segmentCheck(mover({ turnState: { moved: true, attacked: true, moveSegments: 2 } }), true))
      .toMatch(/both of Riding's Move segments/);
  });

  it("makes Riding Attack terminal", () => {
    expect(segmentCheck(mover({ turnState: { usedRidingAttack: true } }), true))
      .toMatch(/ends this Unit's Turn/);
  });

  it("caps both segments against one MOV allowance", () => {
    // MOV 6, 4 already walked before the attack: 2 left, not another 6.
    const rider = mover({ mov: 6, turnState: { moved: true, attacked: true, movedPanels: 4, moveSegments: 1 } });
    expect(remainingMovement(rider)).toBe(2);
    expect(validatePath([at(6, 7), at(6, 8), at(6, 9)], rider, board(), { hasRiding: true }).ok)
      .toBe(false);
  });

  it("reports the segment allowance in the plan", () => {
    const plan = planMovement(mover(), board(), { hasRiding: true });
    expect(plan.maxSegments).toBe(2);
    expect(planMovement(mover(), board()).maxSegments).toBe(1);
  });
});
