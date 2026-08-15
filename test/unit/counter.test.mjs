/**
 * @file The Counter — Combat Process step 6.
 * @see docs/12-combat-process.md §12.8, docs/45-implementation-status.md A4
 *
 * The defect: `case "counter": return process.advance(state, "done")`. The step
 * existed, was reached, and did nothing. `canCounter` existed too but was never
 * consulted, and was missing the clause that matters most — a counter must not
 * itself be counterable, or two Servants in range of each other trade blows
 * until the stack gives out.
 */

import { describe, it, expect } from "vitest";
import {
  begin, beginCounter, beginFanOut, canCounter, advance, pendingPrompt,
} from "../../module/engine/combat-process.mjs";

const attack = { abilityId: null, kind: "normal" };
const proc = (over = {}) => ({ ...begin({ attackerId: "atk", defenderId: "def", attack }), ...over });

/** Everything the check needs, all permissive; each test spoils one thing. */
const eligible = {
  defenderAlive: true,
  attackerInRange: true,
  attackerHasAccel: false,
  defenderCanAct: true,
  defenderHasBerserk: false,
  defenderHasFragarach: false,
  attackerConcealedAndFaster: false,
};

describe("canCounter", () => {
  it("allows a counter when the defender survived and the attacker is in range", () => {
    expect(canCounter(proc(), eligible)).toBe(true);
  });

  it("allows a counter when the defender evaded", () => {
    // "If the DU successfully Evaded the Attack **or** survives the Attack."
    expect(canCounter(proc({ evaded: true }), { ...eligible, defenderAlive: false })).toBe(true);
  });

  it("refuses when the defender did not survive and did not evade", () => {
    expect(canCounter(proc(), { ...eligible, defenderAlive: false })).toBe(false);
  });

  it("refuses when the attacker is out of the defender's range", () => {
    expect(canCounter(proc(), { ...eligible, attackerInRange: false })).toBe(false);
  });

  it("refuses when the attacker has Accel, which forbids reacting at all", () => {
    expect(canCounter(proc(), { ...eligible, attackerHasAccel: true })).toBe(false);
  });

  it("refuses when the defender is bound and cannot act", () => {
    expect(canCounter(proc(), { ...eligible, defenderCanAct: false })).toBe(false);
  });

  it("refuses a counter to a counter", () => {
    // The A4 gate. Without this two Servants in range of each other counter
    // one another until something gives out.
    expect(canCounter(proc({ isCounter: true }), eligible)).toBe(false);
  });

  it("refuses a Berserk defender", () => {
    expect(canCounter(proc(), { ...eligible, defenderHasBerserk: true })).toBe(false);
  });

  it("refuses a defender under Fragarach, which cannot perform a normal Counter", () => {
    // Mannanán trades the normal counter for an automatic one (Ch. 24 §24.8).
    expect(canCounter(proc(), { ...eligible, defenderHasFragarach: true })).toBe(false);
  });

  it("refuses when a concealed attacker is faster than the defender", () => {
    expect(canCounter(proc(), { ...eligible, attackerConcealedAndFaster: true })).toBe(false);
  });
});

describe("beginCounter", () => {
  it("swaps the attacker and the defender", () => {
    const counter = beginCounter(proc());

    expect(counter.attackerId).toBe("def");
    expect(counter.defenderId).toBe("atk");
  });

  it("marks the new process as a counter", () => {
    expect(beginCounter(proc()).isCounter).toBe(true);
  });

  it("produces a process that cannot itself be countered", () => {
    // The two halves together: a counter is marked, and a marked process is
    // refused. This is the property that actually stops the recursion.
    expect(canCounter(beginCounter(proc()), eligible)).toBe(false);
  });

  it("counters with a normal attack unless told otherwise", () => {
    expect(beginCounter(proc()).attack).toMatchObject({ kind: "normal", abilityId: null });
  });

  it("can counter with a named ability", () => {
    expect(beginCounter(proc(), { abilityId: "gaeBolg", kind: "np" }).attack)
      .toMatchObject({ abilityId: "gaeBolg", kind: "np" });
  });

  it("is never an AoE resolution, so the counter turns its target", () => {
    const [aoe] = beginFanOut({ attackerId: "atk", targetIds: ["def", "d2"], attack });

    expect(beginCounter(aoe).isAoE).toBe(false);
  });

  it("starts a fresh ladder rather than inheriting the original's state", () => {
    const spent = advance(proc(), "done");

    expect(beginCounter(spent).state).toBe("declare");
    expect(beginCounter(spent).history).toEqual([]);
  });
});

describe("the counter offer", () => {
  const atCounter = (over = {}) => proc({ state: "counter", ...over });

  it("asks nobody when the defender cannot counter", () => {
    // The ladder must drive straight through an unavailable counter rather
    // than stopping to offer one that would be refused.
    expect(pendingPrompt(atCounter({ counterAvailable: false }))).toBeNull();
    expect(pendingPrompt(atCounter())).toBeNull();
  });

  it("asks the defender when a counter is available", () => {
    expect(pendingPrompt(atCounter({ counterAvailable: true }))).toMatchObject({
      side: "defender", kind: "counter", unitId: "def",
    });
  });

  it("finishes the process whether the counter is taken or declined", () => {
    expect(advance(atCounter({ counterAvailable: true }), "counter").state).toBe("done");
    expect(advance(atCounter({ counterAvailable: true }), "declined").state).toBe("done");
  });

  it("still finishes when the step resolves itself", () => {
    expect(advance(atCounter(), "done").state).toBe("done");
  });
});
