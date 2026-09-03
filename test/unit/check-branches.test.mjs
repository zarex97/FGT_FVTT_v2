/**
 * @file Branch selection for a check phase.
 * @see module/rules/checks/branches.mjs, docs/14-checks-and-randomness.md
 *
 * Medusa's Mystic Eyes is three outcomes chosen by what the target **is**, one
 * of which rolls a second time on failure. A check phase used to be one Luck
 * Check with a flat `onSuccess`/`onFail`.
 */

import { describe, it, expect } from "vitest";
import { selectBranch, isNestedCheck, MAX_CHECK_DEPTH } from "../../module/rules/checks/branches.mjs";

const phase = {
  kind: "check",
  check: "agility",
  branches: [
    { when: ["target:attribute:human"], onSuccess: { effects: [{ id: "stun" }] } },
    { when: ["target:rank:mag:gte:B"], onSuccess: { statDeltas: [{ path: "agility.value", delta: -2 }] } },
    { when: [], onSuccess: { effects: [{ id: "stun" }] } },
  ],
};

/* -------------------------------------------------------------------------- */

describe("selectBranch", () => {
  it("takes the first branch whose predicate holds", () => {
    expect(selectBranch(phase, new Set(["target:attribute:human"]))).toBe(phase.branches[0]);
  });

  it("respects AUTHORED order, which is load-bearing here", () => {
    // A Master is a Human AND has a MAG rank, so both of the first two
    // branches match. Medusa's sheet lists the human case first and means it:
    // Masters take the Stun-or-Petrify ladder, not the Servant one.
    const both = new Set(["target:attribute:human", "target:rank:mag:gte:B"]);
    expect(selectBranch(phase, both)).toBe(phase.branches[0]);
  });

  it("falls through to a later branch", () => {
    expect(selectBranch(phase, new Set(["target:rank:mag:gte:B"]))).toBe(phase.branches[1]);
  });

  it("treats an empty `when` as the catch-all", () => {
    expect(selectBranch(phase, new Set(["target:kind:summon"]))).toBe(phase.branches[2]);
  });

  it("returns null when nothing matches and there is no catch-all", () => {
    const narrow = { ...phase, branches: [phase.branches[0]] };
    expect(selectBranch(narrow, new Set())).toBe(null);
  });

  it("reads a phase with NO branches as one implicit branch", () => {
    // Scáthach's Gate of Skye authors `onSuccess`/`onFail` directly and is the
    // only check phase that shipped before this one. It must keep resolving
    // exactly as it did.
    const flat = { kind: "check", check: "luck", onFail: { effects: [{ id: "death" }] } };
    expect(selectBranch(flat, new Set())).toBe(flat);
  });

  it("is safe on nothing at all", () => {
    expect(selectBranch(null, new Set())).toBe(null);
  });
});

describe("isNestedCheck", () => {
  it("recognises a branch that is itself a check", () => {
    // "If Failed, roll again. On the second time, if Successful..."
    expect(isNestedCheck({ check: "agility", onFail: { effects: [] } })).toBe(true);
    expect(isNestedCheck({ branches: [] })).toBe(true);
  });

  it("does not mistake an ordinary outcome for one", () => {
    expect(isNestedCheck({ effects: [{ id: "stun" }] })).toBe(false);
    expect(isNestedCheck({ statDeltas: [{ path: "agility.value", delta: -2 }] })).toBe(false);
    expect(isNestedCheck(null)).toBe(false);
  });
});

describe("the recursion has a floor", () => {
  it("stops at a depth the sheet never reaches", () => {
    // Medusa's deepest ladder is two rolls. The cap is a guard against an
    // authored cycle, not a rule.
    expect(MAX_CHECK_DEPTH).toBeGreaterThanOrEqual(2);
  });
});
