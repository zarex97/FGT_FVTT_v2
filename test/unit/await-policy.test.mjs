/**
 * @file Timeouts and absence — what happens when nobody answers.
 * @see docs/27-reaction-protocol.md §27.5
 */

import { describe, it, expect } from "vitest";
import {
  policyFor, AWAIT_SITUATIONS, expiryOutcome, remainingMs, formatCountdown,
} from "../../module/rules/await-policy.mjs";

describe("policyFor", () => {
  it("defaults a reaction to taking the hit", () => {
    // The safest default: it never spends a resource the player might have
    // wanted to keep.
    expect(policyFor("reaction")).toMatchObject({ defaultChoice: "none" });
  });

  it("declines every optional contest", () => {
    for (const situation of ["luckCheck", "commandSpell", "counter"]) {
      expect(policyFor(situation).defaultChoice).toBe("declined");
    }
  });

  it("faces the attacker when nobody chooses a facing", () => {
    expect(policyFor("facing").defaultChoice).toBe("attacker");
  });

  it("gives reactions 60 seconds and optional contests 45", () => {
    expect(policyFor("reaction").timeoutMs).toBe(60_000);
    expect(policyFor("luckCheck").timeoutMs).toBe(45_000);
  });

  it("takes a configured timeout over the default", () => {
    expect(policyFor("reaction", { reaction: 30 }).timeoutMs).toBe(30_000);
  });

  it("SPENDS NOTHING on every documented situation", () => {
    // §27.5's decision, as a property rather than six separate assertions: a
    // player who was disconnected must never come back to find their Luck and
    // Command Spells drained by auto-decisions.
    for (const situation of AWAIT_SITUATIONS) {
      expect(policyFor(situation).spends, `${situation} spends a resource on timeout`).toBe(false);
    }
  });

  it("lets the GM decide rather than guessing, where there is no safe default", () => {
    expect(policyFor("reaction").onExpiry).toBe("default");
    expect(policyFor("gmRuling").onExpiry).toBe("gmDecides");
  });

  it("falls back to a hold for a situation it does not know", () => {
    // Holding is the one outcome that cannot be wrong: it decides nothing.
    expect(policyFor("somethingNew")).toMatchObject({ onExpiry: "hold", spends: false });
  });
});

describe("expiryOutcome", () => {
  it("returns the default choice when the policy says to default", () => {
    expect(expiryOutcome(policyFor("reaction"))).toMatchObject({ decided: true, choice: "none" });
  });

  it("decides nothing on a hold", () => {
    expect(expiryOutcome(policyFor("somethingNew"))).toMatchObject({ decided: false });
  });

  it("asks the GM when the policy says so", () => {
    expect(expiryOutcome(policyFor("gmRuling"))).toMatchObject({ decided: false, escalate: true });
  });
});

describe("remainingMs", () => {
  it("counts down toward the deadline", () => {
    expect(remainingMs({ deadline: 10_000 }, 4_000)).toBe(6_000);
  });

  it("never goes negative", () => {
    // A negative remaining renders as "-0:03 left", which reads as a bug.
    expect(remainingMs({ deadline: 10_000 }, 15_000)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("renders the GM's waiting indicator", () => {
    // "waiting for X (0:23)".
    expect(formatCountdown(23_000)).toBe("0:23");
  });

  it("pads the seconds", () => {
    expect(formatCountdown(63_000)).toBe("1:03");
  });

  it("renders zero rather than an empty string", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });
});
