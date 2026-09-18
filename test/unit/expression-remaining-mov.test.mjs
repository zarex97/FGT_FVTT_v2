/**
 * @file `@self.remainingMov`, and the override a ride has to pass.
 * @see module/rules/snapshot.mjs, module/engine/attack.mjs, #45
 *
 * *"X = (the amount of remaining MOV Achilles has divided by 2)"* — Troias
 * Tragōidia, and the only clause in the corpus that asks. It is asked **after**
 * the ride, because `performRidingAttack` awaits its `markTurn` before the
 * attack resolves, so the figure on the document by then is what is left
 * AFTER the ride: zero for a ride that spent the whole allowance.
 *
 * `riding.mjs` captures the pre-ride figure deliberately and says why:
 *
 *   > *"Captured BEFORE the ride writes its own movement, and deliberately: the
 *   > NP's distance is 13 and his MOV is 8 at best, so measuring afterwards
 *   > would make X zero every time and the clause dead."*
 *
 * It then had nowhere to hand it. `expressionRefs` honours
 * `extras.self.remainingMov` ahead of the value it computes, and nothing passed
 * one — the ride's facts went to a top-level `@ride` ref and `self` was never
 * touched — while a comment in `engine/attack.mjs` said the override happened.
 */

import { describe, it, expect } from "vitest";
import { expressionRefs } from "../../module/rules/snapshot.mjs";

/** Achilles mid-ride: MOV 8, and the whole of it already spent by the ride. */
const achilles = () => ({
  system: {
    mov: 8,
    turnState: { tick: 4, movedPanels: 8 },
    health: { value: 1500, max: 1500 },
    resources: {},
    parameters: { str: "A", end: "A", agi: "A+", mag: "C", luc: "B" },
  },
  effects: [],
});

describe("@self.remainingMov during a ride", () => {
  it("reads the post-ride allowance when nothing overrides it", () => {
    // The shape the bug shipped in: the ride's own figure never reaches `self`.
    const refs = expressionRefs(achilles(), { tick: 4, ride: { remainingMov: 8 } });
    expect(refs.self.remainingMov).toBe(0);
  });

  it("reads the pre-ride allowance when the ride passes it", () => {
    const refs = expressionRefs(achilles(), {
      tick: 4,
      ride: { remainingMov: 8 },
      self: { remainingMov: 8 },
    });
    expect(refs.self.remainingMov).toBe(8);
  });

  it("keeps the ride's own ref alongside it", () => {
    // `@ride.remainingMov` is the honest name for the same number and does not
    // go away: a clause may ask either, and they now agree.
    const refs = expressionRefs(achilles(), {
      tick: 4,
      ride: { remainingMov: 8, x: 4, xLessOne: 3 },
      self: { remainingMov: 8 },
    });
    expect(refs.ride.remainingMov).toBe(8);
    expect(refs.self.remainingMov).toBe(refs.ride.remainingMov);
  });

  it("still computes from the document when there is no ride at all", () => {
    // An ordinary Turn: four panels walked of eight, and the record is current.
    const walked = achilles();
    walked.system.turnState = { tick: 4, movedPanels: 4 };
    expect(expressionRefs(walked, { tick: 4 }).self.remainingMov).toBe(4);
  });

  it("does not let a stale movement record eat the allowance", () => {
    // The record belongs to tick 3; at tick 9 it is stale and the Servant has
    // its whole MOV again.
    const stale = achilles();
    stale.system.turnState = { tick: 3, movedPanels: 8 };
    expect(expressionRefs(stale, { tick: 9 }).self.remainingMov).toBe(8);
  });
});
