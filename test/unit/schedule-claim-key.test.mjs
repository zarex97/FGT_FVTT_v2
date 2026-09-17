/**
 * @file The identity a scheduler boundary is claimed under.
 * @see module/rules/schedule-claim.mjs, docs/46-roster-re-audit.md §46.4-AB
 *
 * §46.4-D gave each boundary a claim so that two browser tabs on one Gamemaster
 * could not both run the turn-end sequence — real, and measured as Mad
 * Enhancement draining 40 where the sheet says 20. It keyed the claim on
 * `system.globalTurn`.
 *
 * `globalTurn` is advanced **by the very sequence the claim guards**, at
 * `scheduler-hooks.mjs` line 162, a hundred lines below the claim. So if
 * anything between the two throws — and the endTurn sequence is the most
 * failure-prone path in the system — the claim is written and the counter is
 * not. Every later boundary then reads the same tick, sees `claim.turn >= tick`,
 * and refuses. **The scheduler freezes for the life of the world**: no drains,
 * no periodics, no expiries, no cooldown advances, no channel ticks.
 *
 * Measured on the live Semiramis board: `globalTurn` 0 and `scheduleClaim`
 * `{turn: 0, token: "PP9RrW7AXI5R3qoc", round: 8}` after fourteen Turn changes,
 * with her Hanging Gardens channel sitting at `elapsedTicks: 0` forever.
 *
 * The cure is to stop keying the claim on our own derived counter and key it on
 * the boundary's own identity instead. Foundry advances `round` and `turn`
 * before it fires `updateCombat`, so they are already the NEW boundary's by the
 * time a hook reads them, and they do not depend on our sequence succeeding.
 */

import { describe, it, expect } from "vitest";
import { boundaryKey, alreadyClaimed } from "../../module/rules/schedule-claim.mjs";

describe("boundaryKey", () => {
  it("names a Turn by its round AND its place in the round", () => {
    expect(boundaryKey("turn", { round: 3, turn: 1 })).toBe("r3t1");
  });

  it("names a Round by the round alone", () => {
    expect(boundaryKey("round", { round: 3, turn: 1 })).toBe("r3");
  });

  it("gives two consecutive Turns of one round different keys", () => {
    expect(boundaryKey("turn", { round: 3, turn: 0 }))
      .not.toBe(boundaryKey("turn", { round: 3, turn: 1 }));
  });

  it("gives the same place in two rounds different keys", () => {
    expect(boundaryKey("turn", { round: 3, turn: 0 }))
      .not.toBe(boundaryKey("turn", { round: 4, turn: 0 }));
  });

  it("survives a combat that has not started counting", () => {
    expect(boundaryKey("turn", {})).toBe("r1t0");
  });
});

describe("alreadyClaimed", () => {
  it("refuses the same boundary twice — the second tab", () => {
    expect(alreadyClaimed({ turn: "r3t1", turnToken: "abc" }, "turn", "r3t1")).toBe(true);
  });

  it("lets the NEXT boundary through even though the last one was claimed", () => {
    expect(alreadyClaimed({ turn: "r3t1", turnToken: "abc" }, "turn", "r3t2")).toBe(false);
  });

  it("is not fooled by a claim with no token", () => {
    expect(alreadyClaimed({ turn: "r3t1" }, "turn", "r3t1")).toBe(false);
  });

  it("lets a fresh combat through", () => {
    expect(alreadyClaimed({}, "turn", "r1t0")).toBe(false);
    expect(alreadyClaimed(null, "turn", "r1t0")).toBe(false);
  });

  it("ignores a §46.4-D numeric claim left in an existing world", () => {
    // The old shape stored `{turn: 0, token, round: 8}`. A number is never a
    // key, so a frozen world thaws on the next boundary rather than needing a
    // migration.
    expect(alreadyClaimed({ turn: 0, turnToken: "abc", round: 8 }, "turn", "r9t0")).toBe(false);
  });

  it("keeps the two scales independent", () => {
    const claim = { turn: "r3t1", turnToken: "abc", round: "r3", roundToken: "def" };
    expect(alreadyClaimed(claim, "round", "r4")).toBe(false);
    expect(alreadyClaimed(claim, "round", "r3")).toBe(true);
  });
});

describe("the two scales do not share a token", () => {
  // A round change is ALWAYS also a turn change, so `onTurnChange` and
  // `onRoundChange` both claim at the same instant. §46.4-D gave them one
  // shared `token` field: the turn claim's token landed last, the round claim
  // compared and found a foreign token, concluded it had lost, and returned
  // false -- so the whole `roundEnd` sequence never ran. Measured live:
  //
  //   [FGTDBG-ROUND] ENTER round= 42 sched= true started= true dir= 1
  //   [FGTDBG-ROUND] claim won= false
  //
  // with Poison (whose native trigger IS roundEnd) dealing 0 and HGoB
  // Construction gaining 0 across every round boundary (Ch. 46 §46.4-AL).
  it("reads the token belonging to its own scale", () => {
    const claim = { turn: "r3t1", turnToken: "aaa", round: "r3", roundToken: "bbb" };
    expect(alreadyClaimed(claim, "round", "r3")).toBe(true);
    expect(alreadyClaimed(claim, "turn", "r3t1")).toBe(true);
  });

  it("is not satisfied by the OTHER scale's token", () => {
    // The round has been claimed; the turn has not. A shared field made this
    // indistinguishable.
    const claim = { round: "r3", roundToken: "bbb" };
    expect(alreadyClaimed(claim, "turn", "r3t1")).toBe(false);
  });

  it("still ignores a claim whose own token is missing", () => {
    expect(alreadyClaimed({ round: "r3" }, "round", "r3")).toBe(false);
  });

  it("ignores §46.4-D's single shared `token` field", () => {
    // An existing world holds `{turn, round, token}`. Neither scale has its own
    // token, so both proceed once and write the new shape.
    expect(alreadyClaimed({ turn: "r3t1", round: "r3", token: "old" }, "round", "r3")).toBe(false);
  });
});

