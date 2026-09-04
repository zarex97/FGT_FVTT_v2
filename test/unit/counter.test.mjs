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
import { readFileSync } from "node:fs";
import {
  begin, beginCounter, beginFanOut, canCounter, advance, pendingPrompt,
} from "../../module/engine/combat-process.mjs";
import { MAX_COUNTER_DEPTH } from "../../module/rules/counter.mjs";

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
    const [counter] = beginCounter(proc());

    expect(counter.attackerId).toBe("def");
    expect(counter.defenderId).toBe("atk");
  });

  it("marks the new process as a counter", () => {
    expect(beginCounter(proc())[0].isCounter).toBe(true);
  });

  it("produces a process the unit it was aimed at cannot counter", () => {
    // The property that actually stops the recursion. It used to be "a marked
    // process is refused"; it is now "the unit it was AIMED at is refused", so
    // that `fgt.counterChain` can let a bystander answer without reopening it.
    const [counter] = beginCounter(proc());
    expect(canCounter(counter, { ...eligible, chainMode: "collateral" })).toBe(false);
    expect(canCounter(counter, { ...eligible, chainMode: "strict" })).toBe(false);
  });

  it("counters with a normal attack unless told otherwise", () => {
    expect(beginCounter(proc())[0].attack).toMatchObject({ kind: "normal", abilityId: null });
  });

  it("can counter with a named ability", () => {
    const [counter] = beginCounter(proc(), { attack: { abilityId: "gaeBolg", kind: "np" } });
    expect(counter.attack).toMatchObject({ abilityId: "gaeBolg", kind: "np" });
  });

  it("is single-target by default, and an area when the ability is", () => {
    // It used to be single-target ALWAYS -- "a counter is one unit hitting one
    // unit" -- which was only true because the `attack` parameter was never
    // passed and every counter was a Normal Attack. A counter declared with an
    // area Noble Phantasm has that Noble Phantasm's shape.
    const [aoe] = beginFanOut({ attackerId: "atk", targetIds: ["def", "d2"], attack });

    expect(beginCounter(aoe)[0].isAoE).toBe(false);
    expect(beginCounter(aoe, { targetIds: ["atk", "d3"] })[0].isAoE).toBe(true);
  });

  it("starts a fresh ladder rather than inheriting the original's state", () => {
    const spent = advance(proc(), "done");

    expect(beginCounter(spent)[0].state).toBe("declare");
    expect(beginCounter(spent)[0].history).toEqual([]);
  });
});

describe("counter process fields", () => {
  it("gives every process a requiredTargetId and a depth", () => {
    const s = begin({ attackerId: "A", defenderId: "B", attack });
    expect(s.requiredTargetId).toBeNull();
    expect(s.counterDepth).toBe(0);
  });

  it("fans a counter out over every unit the ability caught", () => {
    const states = beginCounter(proc(), { targetIds: ["atk", "C"] });
    expect(states.map((x) => x.defenderId)).toEqual(["atk", "C"]);
  });

  it("marks every process of the fan-out as a counter aimed at the attacker", () => {
    // Not just the one against the attacker. A bystander's process that forgot
    // `isCounter` would reopen the chain through the side door -- and
    // `beginFanOut` dropped the flag entirely before this.
    const states = beginCounter(proc(), { targetIds: ["atk", "C"] });
    for (const x of states) {
      expect(x.isCounter).toBe(true);
      expect(x.requiredTargetId).toBe("atk");
      expect(x.counterDepth).toBe(1);
    }
  });

  it("keeps the parent's groupId, because a Counter is part of the same Phase", () => {
    // §12.1: a Phase is the declaration plus any Counters.
    // `engine/attack.mjs#fireCombatPhaseEnd` counts unfinished siblings by
    // groupId and says so outright -- "a counter can add a process to the group
    // after the first one finished" -- so a counter with its own group would
    // let the phase end while the counter is still running.
    const [aoe] = beginFanOut({ attackerId: "atk", targetIds: ["def", "d2"], attack });
    expect(beginCounter(aoe)[0].groupId).toBe(aoe.groupId);
  });

  it("counts depth upward through a chain", () => {
    const first = beginCounter(proc(), { targetIds: ["atk", "C"] });
    const second = beginCounter({ ...first[1], state: "counter" }, { targetIds: ["def"] });
    expect(second[0].counterDepth).toBe(2);
  });
});

describe("canCounter and the chain", () => {
  const counterState = (over = {}) => ({
    ...begin({ attackerId: "def", defenderId: "atk", attack }),
    isCounter: true, requiredTargetId: "atk", counterDepth: 1, ...over,
  });

  it("still allows a counter on an ordinary attack", () => {
    expect(canCounter(proc(), { ...eligible, chainMode: "collateral" })).toBe(true);
  });

  it("refuses the unit the counter was aimed at, in both modes", () => {
    expect(canCounter(counterState(), { ...eligible, chainMode: "collateral" })).toBe(false);
    expect(canCounter(counterState(), { ...eligible, chainMode: "strict" })).toBe(false);
  });

  it("allows a bystander in collateral mode and refuses in strict", () => {
    const bystander = counterState({ defenderId: "C" });
    expect(canCounter(bystander, { ...eligible, chainMode: "collateral" })).toBe(true);
    expect(canCounter(bystander, { ...eligible, chainMode: "strict" })).toBe(false);
  });

  it("stops at the depth cap even in collateral mode", () => {
    const deep = counterState({ defenderId: "C", counterDepth: MAX_COUNTER_DEPTH });
    expect(canCounter(deep, { ...eligible, chainMode: "collateral" })).toBe(false);
  });

  it("still refuses for every §12.8 reason it always did", () => {
    expect(canCounter(proc(), { ...eligible, attackerInRange: false })).toBe(false);
    expect(canCounter(proc(), { ...eligible, attackerHasAccel: true })).toBe(false);
    expect(canCounter(proc(), { ...eligible, defenderHasBerserk: true })).toBe(false);
    expect(canCounter(proc(), { ...eligible, defenderHasFragarach: true })).toBe(false);
    expect(canCounter(proc(), { ...eligible, defenderCanAct: false })).toBe(false);
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

describe("the counter keeps its parent's Combat Phase", () => {
  // A source check, because the wiring it guards lives in `engine/attack.mjs`
  // and needs a live Foundry to exercise. It is here because the property is a
  // RULE (§12.1: a Phase is the declaration plus its counters) and because it
  // has already broken once: `runCounter` stopped going through `beginCounter`
  // when it started sharing the ordinary declaration path, and
  // `declareProcesses` quietly minted a fresh group. Nothing failed. The phase
  // simply ended while the counter was still resolving, and it was found by
  // reading ids off two cards in a live game.
  const source = readFileSync("module/engine/attack.mjs", "utf8");

  it("threads the parent's groupId into the counter's declaration", () => {
    expect(source).toMatch(/groupId: state\.groupId/);
  });

  it("lets declareProcesses accept one, or the line above would do nothing", () => {
    expect(source).toMatch(/counterDepth = 0, groupId = null,/);
  });
});

describe("the redirect travels on the Process", () => {
  it("defaults to null on every process", () => {
    expect(begin({ attackerId: "A", defenderId: "B", attack }).counterRedirectId).toBeNull();
  });

  it("is carried to every process of a fan-out", () => {
    const states = beginFanOut({
      attackerId: "A", targetIds: ["B", "C"], attack, counterRedirectId: "S",
    });
    for (const s of states) expect(s.counterRedirectId).toBe("S");
  });
});

describe("the redirect reaches the declaration", () => {
  // A source check, because the wiring lives in `engine/attack.mjs` and needs a
  // live Foundry to exercise. The property is a RULE: a Counter against a
  // shielded Master must hit the Servant and must not touch the Master, and
  // both halves have to be threaded or one silently does nothing.
  const source = readFileSync("module/engine/attack.mjs", "utf8");

  it("decides the redirect at the counter rung, beside counterAvailable", () => {
    expect(source).toMatch(/counterRedirect\(/);
  });

  it("makes the redirect target the one the Counter must catch", () => {
    expect(source).toMatch(/state\.counterRedirectId \?\? state\.attackerId/);
  });

  it("excludes the protected Master from the Counter's targets", () => {
    expect(source).toMatch(/excludeUnitIds/);
  });
});
