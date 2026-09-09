/**
 * @file The Noble Phantasm availability gate.
 * @see docs/07-time-model.md §7.9, module/rules/np-gate.mjs
 *
 * `CONFIG.FGT.gates` held all four of §7.9's numbers from the day the config
 * was written and NOTHING read that object. Measured live before this existed:
 * a Noble Phantasm fires in Round 1.
 */

import { describe, it, expect } from "vitest";
import {
  NP_GATE, ESSENCE_SHIFT, isGated, baseGateRound, essenceShift,
  gateRoundFor, gateTurnFor, npAvailableTurn,
} from "../../module/rules/np-gate.mjs";

const servant = (classes) => ({ id: "s", kind: "servant", servantClasses: classes });

describe("the published defaults", () => {
  it("are §7.9's own numbers", () => {
    expect(NP_GATE).toEqual({ round: 6, assassinRound: 4 });
  });

  it("name the four essences that move the gate", () => {
    expect(ESSENCE_SHIFT).toEqual({
      kaleidoscope: 4, imaginaryNumber: 3, leyline: 2, harvest: 1,
    });
  });
});

describe("isGated", () => {
  it("covers a real Noble Phantasm", () => {
    expect(isGated({ isNP: true })).toBe(true);
  });

  it("...and one that is only CATEGORIZED as one", () => {
    // The same predicate §15.5's other three scoping questions use. EMIYA's
    // Overedge, Bašmu's Dragonfire, Mannanán's Fragarach Counter and the
    // Hanging Gardens are all in scope.
    expect(isGated({ categorizedAsNP: true })).toBe(true);
  });

  it("leaves an ordinary Skill alone", () => {
    expect(isGated({ isNP: false, categorizedAsNP: false })).toBe(false);
    expect(isGated({})).toBe(false);
    expect(isGated(null)).toBe(false);
  });
});

describe("baseGateRound", () => {
  it("opens at Round 6 for everyone", () => {
    expect(baseGateRound(servant(["saber"]))).toBe(6);
  });

  it("...and two Rounds earlier for an Assassin", () => {
    expect(baseGateRound(servant(["assassin"]))).toBe(4);
  });

  it("gives a multi-class Servant the EARLIEST of its classes", () => {
    // The mirror of ZON's rule that the widest zone applies: a rule that opens
    // sooner is not cancelled by one that opens later.
    expect(baseGateRound(servant(["saber", "assassin"]))).toBe(4);
    expect(baseGateRound(servant(["assassin", "berserker"]))).toBe(4);
  });

  it("gives a unit with no classes the general gate, not an exemption", () => {
    // Exemption is a decision and no sheet states one.
    expect(baseGateRound(servant([]))).toBe(6);
    expect(baseGateRound({ id: "m", kind: "master" })).toBe(6);
    expect(baseGateRound(undefined)).toBe(6);
  });

  it("takes its numbers from the gates it is handed", () => {
    expect(baseGateRound(servant(["saber"]), { round: 3, assassinRound: 2 })).toBe(3);
    expect(baseGateRound(servant(["assassin"]), { round: 3, assassinRound: 2 })).toBe(2);
  });
});

describe("essenceShift", () => {
  it("is zero for every Master in the game today", () => {
    // The seam. `MasterData.essences` is a SetField that nothing writes and
    // nothing reads; the essence subsystem is unbuilt (spec §2).
    expect(essenceShift({ id: "m", essences: [] })).toBe(0);
    expect(essenceShift({ id: "m" })).toBe(0);
    expect(essenceShift(null)).toBe(0);
  });

  it("reads the table when a Master carries one", () => {
    expect(essenceShift({ essences: ["kaleidoscope"] })).toBe(4);
    expect(essenceShift({ essences: ["harvest"] })).toBe(1);
  });

  it("takes the LARGEST when a Master somehow carries two", () => {
    // One essence per Master is the rule; the arithmetic must not silently
    // stack two into a Round-0 gate if the setup UI ever admits both.
    expect(essenceShift({ essences: ["harvest", "kaleidoscope"] })).toBe(4);
  });

  it("ignores an essence that does not shift the gate", () => {
    expect(essenceShift({ essences: ["formalcraft"] })).toBe(0);
  });
});

describe("gateRoundFor", () => {
  it("subtracts the shift", () => {
    expect(gateRoundFor(servant(["saber"]), { essences: ["kaleidoscope"] })).toBe(2);
    expect(gateRoundFor(servant(["assassin"]), { essences: ["leyline"] })).toBe(2);
  });

  it("never returns a Round before the first", () => {
    // Round 0 does not exist, and a gate of 0 would read as "no gate".
    expect(gateRoundFor(servant(["assassin"]), { essences: ["kaleidoscope"] })).toBe(1);
  });

  it("is the base gate for a Servant with no Master", () => {
    expect(gateRoundFor(servant(["saber"]), null)).toBe(6);
  });
});

describe("gateTurnFor", () => {
  it("converts the Round to the first Turn of it", () => {
    // Round 6 at three Turns to the Round starts on global turn 16.
    expect(gateTurnFor(servant(["saber"]), null, { turnsPerRound: 3 })).toBe(16);
    expect(gateTurnFor(servant(["assassin"]), null, { turnsPerRound: 3 })).toBe(10);
  });

  it("holds across every turnsPerRound the harness exercises", () => {
    // §7.10 tests the time model against {3, 8, 15} rather than sampling.
    expect(gateTurnFor(servant(["saber"]), null, { turnsPerRound: 8 })).toBe(41);
    expect(gateTurnFor(servant(["saber"]), null, { turnsPerRound: 15 })).toBe(76);
  });

  it("defaults to three Turns to the Round", () => {
    expect(gateTurnFor(servant(["saber"]), null, {})).toBe(16);
  });
});

describe("npAvailableTurn", () => {
  const np = (over = {}) => ({ isNP: true, cooldown: { remaining: 0, gatedDelay: 0 }, ...over });

  it("is the gate turn for an ability nothing has delayed", () => {
    expect(npAvailableTurn(servant(["saber"]), np(), null, { turnsPerRound: 3 })).toBe(16);
  });

  it("adds a cooldown increase taken while still gated", () => {
    // > "If a Unit has its NP Cooldown increased before its NP would be
    // > available, then its NP would only be usable X Turns AFTER its NP would
    // > be available, X being the number of Turns its NP Cooldown was increased
    // > by."
    //
    // Additive, not `max()` — §7.9's own pseudocode says max and is wrong
    // (spec R1). Under max() an NP Lock spent before the gate is free, which is
    // the outcome the clause exists to prevent.
    const locked = np({ cooldown: { remaining: 0, gatedDelay: 5 } });
    expect(npAvailableTurn(servant(["saber"]), locked, null, { turnsPerRound: 3 })).toBe(21);
  });

  it("is the gate turn for an ability the gate does not cover", () => {
    // An ordinary Skill is available whenever its own cooldown allows.
    expect(npAvailableTurn(servant(["saber"]), { isNP: false }, null, { turnsPerRound: 3 })).toBe(0);
  });
});
