/**
 * @file The Noble Phantasm availability gate.
 * @see docs/04-time-model.md, module/rules/np-gate.mjs
 *
 * `CONFIG.FGT.gates` held all four of Ch. 04's numbers from the day the config
 * was written and NOTHING read that object. Measured live before this existed:
 * a Noble Phantasm fires in Round 1.
 */

import { describe, it, expect } from "vitest";
import {
  NP_GATE, isGated, baseGateRound, essenceShift,
  gateRoundFor, gateTurnFor, npAvailableTurn,
} from "../../module/rules/np-gate.mjs";

const servant = (classes) => ({ id: "s", kind: "servant", servantClasses: classes });

describe("the published defaults", () => {
  it("are Ch. 04's own numbers", () => {
    expect(NP_GATE).toEqual({ round: 6, assassinRound: 4 });
  });
});

describe("isGated", () => {
  it("covers a real Noble Phantasm", () => {
    expect(isGated({ isNP: true })).toBe(true);
  });

  it("...and one that is only CATEGORIZED as one", () => {
    // The same predicate Ch. 17's other three scoping questions use. EMIYA's
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

// The shift is the SERVANT's: a Master Essence reaches it as a copy it holds
// while the Contract stands (#241), carrying `NpGateShift`. It read the
// Master's `essences`, a set nothing wrote.
const shifted = (classes, ...rounds) => ({
  ...servant(classes), npGateShifts: rounds.map((r) => ({ rounds: r, source: "Essence" })),
});

describe("essenceShift", () => {
  it("is zero for a Servant whose Master holds no gate Essence", () => {
    expect(essenceShift(servant(["saber"]))).toBe(0);
    expect(essenceShift(null)).toBe(0);
  });

  it("reads the Servant's own shift", () => {
    expect(essenceShift(shifted(["saber"], 4))).toBe(4);
    expect(essenceShift(shifted(["saber"], 1))).toBe(1);
  });

  it("takes the LARGEST of two, never the sum", () => {
    expect(essenceShift(shifted(["saber"], 1, 4))).toBe(4);
  });
});

describe("gateRoundFor", () => {
  it("subtracts the shift", () => {
    expect(gateRoundFor(shifted(["saber"], 4), null)).toBe(2);
    expect(gateRoundFor(shifted(["assassin"], 2), null)).toBe(2);
  });

  it("opens from the first Round when the shift reaches Round 0 (#241 reading 10)", () => {
    // Kaleidoscope on an Assassin: 4 - 4 = 0, ruled open from the war's start.
    expect(gateRoundFor(shifted(["assassin"], 4), null)).toBe(1);
  });

  it("does not read the Master: a Master's Essence reaches only through the copy", () => {
    expect(gateRoundFor(servant(["saber"]), { essences: ["kaleidoscope"] })).toBe(6);
  });

  it("is the base gate for a Servant with no shift", () => {
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
    // Ch. 04 tests the time model against {3, 8, 15} rather than sampling.
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
    // Additive, not `max()` — Ch. 04's own pseudocode says max and is wrong
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
