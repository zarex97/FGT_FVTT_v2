/**
 * @file What may answer a Counter, and who may Counter a Counter.
 * @see module/rules/counter.mjs, docs/12-combat-process.md §12.8
 *
 * `beginCounter` has taken the attack as a parameter since it was written and
 * no caller ever passed one, so every Counter in the game was a Normal Attack
 * at exactly one target. These are the two rules that were missing underneath
 * that.
 *
 * Distinct from `counter.test.mjs`, which covers the ENGINE's counter step.
 */
import { describe, it, expect } from "vitest";
import {
  counterOffer, mayCounterAgain, MAX_COUNTER_DEPTH, COUNTER_CHAIN_MODES,
} from "../../module/rules/counter.mjs";

const np = (id, name) => ({ id, name, img: `${id}.webp`, type: "noblePhantasm", system: {} });
const attackSkill = (id, name) => ({
  id, name, img: `${id}.webp`, type: "ability",
  system: { isAttackSkill: true, phases: [{ kind: "damage" }] },
});
const buff = (id, name) => ({
  id, name, img: `${id}.webp`, type: "ability", system: { phases: [{ kind: "applyEffect" }] },
});
const mode = (id, name) => ({ id, name, type: "ability", system: { isMode: true } });
const passiveNP = (id, name) => ({ id, name, type: "noblePhantasm", system: { isPassive: true } });

describe("counterOffer", () => {
  it("always offers the Normal Attack first, and it is free", () => {
    const [first] = counterOffer([]);
    expect(first.isNormalAttack).toBe(true);
    expect(first.id).toBeNull();
  });

  it("offers Noble Phantasms and attack Skills", () => {
    const out = counterOffer([np("np1", "Nine Lives"), attackSkill("s1", "Overedge")]);
    expect(out.map((o) => o.id)).toEqual([null, "np1", "s1"]);
    expect(out[1].isNP).toBe(true);
    expect(out[2].isNP).toBe(false);
  });

  it("refuses anything that is not an Attack", () => {
    // The same predicate the action bar routes on, so "what is an Attack" has
    // one definition rather than two that drift.
    const out = counterOffer([
      buff("b1", "Argos"), mode("m1", "Mad Enhancement"), passiveNP("p1", "Goddess of War"),
    ]);
    expect(out.map((o) => o.id)).toEqual([null]);
  });

  it("survives a unit with no abilities at all", () => {
    expect(counterOffer(undefined)).toHaveLength(1);
  });
});

describe("mayCounterAgain", () => {
  const counter = (over = {}) => ({
    isCounter: true, requiredTargetId: "A", counterDepth: 1, ...over,
  });

  it("leaves an ordinary attack to the normal §12.8 rules", () => {
    expect(mayCounterAgain({ isCounter: false }, "B", "strict")).toBe(true);
  });

  it("never lets the unit a Counter was aimed at answer it — Rule 1", () => {
    // A attacks B, B counters A. Without this the two counter each other until
    // one of them dies, which is the safety property the whole rule exists for.
    expect(mayCounterAgain(counter(), "A", "collateral")).toBe(false);
    expect(mayCounterAgain(counter(), "A", "strict")).toBe(false);
  });

  it("lets a bystander answer in collateral mode", () => {
    // C was caught in B's area Counter aimed at A. C was not being countered,
    // so C keeps its own right to counter B.
    expect(mayCounterAgain(counter(), "C", "collateral")).toBe(true);
  });

  it("refuses a bystander in strict mode", () => {
    expect(mayCounterAgain(counter(), "C", "strict")).toBe(false);
  });

  it("treats a missing requiredTargetId as aimed at nobody, and refuses", () => {
    // A Counter with no recorded target is a bug upstream. Refusing is the safe
    // reading: the alternative opens the chain this rule closes.
    expect(mayCounterAgain(counter({ requiredTargetId: null }), "C", "collateral")).toBe(false);
  });
});

describe("the constants", () => {
  it("names both chain modes", () => {
    expect(COUNTER_CHAIN_MODES).toEqual(["collateral", "strict"]);
  });

  it("caps the depth", () => {
    expect(MAX_COUNTER_DEPTH).toBe(8);
  });
});
