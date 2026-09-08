/**
 * @file The weak-point chance table.
 * @see module/rules/weak-point.mjs, docs/44-case-expanded-roster.md §44.2
 *
 * Achilles' Heel is the only weak point in either roster and the most involved
 * single mechanic in it: six conditional modifiers, one of them a Luck Check,
 * over a base that depends on which side he was struck from. Everything here is
 * pure — the ladder rung that consumes it is layer 3 and is tested live.
 */

import { describe, it, expect } from "vitest";
import { weakPointChance, weakPointOffered } from "../../module/rules/weak-point.mjs";

/** Achilles' Heel, as his sheet states it. */
const HEEL = {
  id: "achillesHeel",
  availableWhen: ["self:stance:dismounted"],
  baseChanceBySide: { front: 0, left: 5, right: 5, back: 10 },
  agilityBonus: 5,
  rangeBonus: { atLeast: 3, value: 5 },
  initiatorBonus: 5,
  aoePenalty: -10,
  fogOfWarBonus: 10,
  luckCheckBonus: 25,
};

/**
 * Achilles at (5,5) facing north; the attacker's panel decides the cone.
 * @param {object} over
 */
const defender = (over = {}) => ({
  id: "achilles", panel: { i: 5, j: 5 }, facing: "n", detect: 3,
  agility: { value: 18, max: 18 }, stance: "dismounted",
  stanceSpec: { states: ["mounted", "dismounted"], default: "dismounted" },
  ...over,
});

/** @param {object} over */
const attacker = (over = {}) => ({
  id: "foe", panel: { i: 4, j: 5 }, agility: { value: 12, max: 12 }, ...over,
});

/** @param {object} over */
const state = (over = {}) => ({ isAoE: false, isCounter: false, ...over });

/**
 * @param {object} [parts]
 * @returns {number}
 */
const chanceOf = (parts = {}) => weakPointChance(HEEL, {
  defender: defender(parts.defender),
  attacker: attacker(parts.attacker),
  state: state(parts.state),
  board: parts.board ?? null,
  luckCheckPassed: parts.luckCheckPassed ?? false,
}).chance;

describe("the base, by the side he was struck from", () => {
  // He faces north, so (4,5) is his front and the rest follow. Measured on a
  // COUNTER throughout, so the initiator bonus is not also in the number.
  const counter = { isCounter: true };

  it("is 0 from the front, which is the point of facing him", () => {
    expect(chanceOf({ attacker: { panel: { i: 4, j: 5 } }, state: counter })).toBe(0);
  });

  it("is 5 from either side", () => {
    expect(chanceOf({ attacker: { panel: { i: 5, j: 4 } }, state: counter })).toBe(5);
    expect(chanceOf({ attacker: { panel: { i: 5, j: 6 } }, state: counter })).toBe(5);
  });

  it("is 10 from behind", () => {
    expect(chanceOf({ attacker: { panel: { i: 6, j: 5 } }, state: counter })).toBe(10);
  });
});

describe("the six modifiers", () => {
  /** Struck from behind, so the base is 10 and every modifier is visible. */
  const behind = { i: 6, j: 5 };

  it("adds 5 when the attacker's Agility is equal or higher", () => {
    const counter = { isCounter: true };
    expect(chanceOf({ attacker: { panel: behind, agility: { value: 18, max: 18 } }, state: counter })).toBe(15);
    expect(chanceOf({ attacker: { panel: behind, agility: { value: 19, max: 19 } }, state: counter })).toBe(15);
    expect(chanceOf({ attacker: { panel: behind, agility: { value: 17, max: 17 } }, state: counter })).toBe(10);
  });

  it("reads Agility however the projection spells it, and not at all when missing", () => {
    // `snapshotUnit` carries `{value, max}` and the BOARD carries a plain
    // number. Reading only the first gave `undefined` on both sides, compared
    // them as zeroes, and awarded the bonus every time. Found live.
    const counter = { isCounter: true };
    const plain = chanceOf({
      defender: { agility: 18 },
      attacker: { panel: behind, agility: 20 },
      state: counter,
    });
    expect(plain).toBe(15);

    // Neither side known: not "equal", because the clause compares two numbers.
    expect(chanceOf({
      defender: { agility: undefined },
      attacker: { panel: behind, agility: undefined },
      state: counter,
    })).toBe(10);
  });

  it("adds 5 at a Range of 3 or higher", () => {
    const counter = { isCounter: true };
    expect(chanceOf({ attacker: { panel: { i: 8, j: 5 } }, state: counter })).toBe(15);
    expect(chanceOf({ attacker: { panel: { i: 7, j: 5 } }, state: counter })).toBe(10);
  });

  it("adds 5 when the attacker initiated, and nothing on a Counter", () => {
    expect(chanceOf({ attacker: { panel: behind }, state: { isCounter: false } })).toBe(15);
    expect(chanceOf({ attacker: { panel: behind }, state: { isCounter: true } })).toBe(10);
  });

  it("takes 10 off an AoE", () => {
    expect(chanceOf({ attacker: { panel: behind }, state: { isAoE: true, isCounter: true } })).toBe(0);
  });

  it("adds 10 from within the Fog of War", () => {
    // "from a place where he had no vision of" — outside his own Detect range.
    // Detect 3, so a panel 4 away is unseen.
    expect(chanceOf({ attacker: { panel: { i: 9, j: 5 } }, state: { isCounter: true } })).toBe(25);
    // ...and 3 away is seen, so only the Range bonus applies.
    expect(chanceOf({ attacker: { panel: { i: 8, j: 5 } }, state: { isCounter: true } })).toBe(15);
  });

  it("adds 25 for a successful Luck Check", () => {
    expect(chanceOf({ attacker: { panel: behind }, state: { isCounter: true }, luckCheckPassed: true })).toBe(35);
  });

  it("stacks all six, which is the worst case his sheet allows", () => {
    // Behind (10) + Agility (5) + Range≥3 (5) + initiated (5) + Fog (10)
    // + Luck (25) = 60, less nothing because it is not an AoE.
    expect(chanceOf({
      attacker: { panel: { i: 9, j: 5 }, agility: { value: 20, max: 20 } },
      state: { isCounter: false, isAoE: false },
      luckCheckPassed: true,
    })).toBe(60);
  });

  it("never goes below zero", () => {
    // Front (0) on an AoE (−10) is −10 before the clamp.
    expect(chanceOf({ attacker: { panel: { i: 4, j: 5 } }, state: { isAoE: true, isCounter: true } })).toBe(0);
  });
});

describe("the breakdown", () => {
  it("names every contribution, so the offer can show its working", () => {
    const out = weakPointChance(HEEL, {
      defender: defender(),
      attacker: attacker({ panel: { i: 6, j: 5 }, agility: { value: 20, max: 20 } }),
      state: state(),
      luckCheckPassed: false,
    });
    expect(out.breakdown.map((b) => b.label)).toEqual([
      "back", "agility", "range", "initiated",
    ]);
    expect(out.breakdown.map((b) => b.delta)).toEqual([10, 5, 0, 5]);
    expect(out.chance).toBe(20);
  });
});

describe("weakPointOffered", () => {
  it("is silent when the chance cannot exceed zero", () => {
    // A frontal Counter with no modifiers: asking the attacker to declare a
    // Heel Attack that cannot succeed is a prompt in front of every ordinary
    // attack on him.
    expect(weakPointOffered(HEEL, {
      defender: defender(),
      attacker: attacker({ panel: { i: 4, j: 5 }, agility: { value: 1, max: 1 } }),
      state: state({ isCounter: true }),
    })).toBe(false);
  });

  it("offers as soon as anything can land", () => {
    expect(weakPointOffered(HEEL, {
      defender: defender(),
      attacker: attacker({ panel: { i: 6, j: 5 } }),
      state: state({ isCounter: true }),
    })).toBe(true);
  });

  it("is silent while he is Mounted, whatever the angle", () => {
    // "Whenever Achilles participates in a Combat Phase while UNMOUNTED."
    expect(weakPointOffered(HEEL, {
      defender: defender({ stance: "mounted" }),
      attacker: attacker({ panel: { i: 6, j: 5 } }),
      state: state(),
    })).toBe(false);
  });

  it("does NOT count the Luck Check toward the offer", () => {
    // +25 over a base of zero is still 25, so counting it would make every
    // angle offerable and put a prompt in front of every ordinary frontal
    // attack on him. The Luck Check is an opt-in inside an offer that was
    // already worth making.
    const front = {
      defender: defender(),
      attacker: attacker({ panel: { i: 4, j: 5 }, agility: { value: 1, max: 1 } }),
      state: state({ isCounter: true }),
    };
    expect(weakPointOffered(HEEL, front)).toBe(false);
    // ...and it still raises a chance that exists.
    expect(weakPointChance(HEEL, { ...front, luckCheckPassed: true }).chance).toBe(25);
  });
});
