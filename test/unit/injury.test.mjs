/**
 * @file The Injury Roll — Combat Process step 4.
 * @see docs/12-combat-process.md §12.6, docs/45-implementation-status.md A3
 *
 * Step 4 was a stub: `attack.mjs` advanced straight through with `"done"`, and
 * the pipeline's `flags.exceededInjuryThreshold` had no reader at all.
 */

import { describe, it, expect } from "vitest";
import { injuryCheck } from "../../module/rules/injury.mjs";

/** A hit that qualifies, which each test then spoils in exactly one way. */
const hit = (over = {}) => ({
  exceededThreshold: true,
  damage: 250,
  healthAfter: 300,
  defender: { attributes: [] },
  isNP: false,
  lightWound: false,
  ...over,
});

describe("injuryCheck", () => {
  it("rolls when a surviving unit takes more than 100", () => {
    expect(injuryCheck(hit())).toMatchObject({ roll: true });
  });

  it("does not roll when the damage is over 100 only because of Def Crk", () => {
    // The threshold is snapshotted before stage 16 adds Def Crk, because that
    // bonus "does not count towards the amount required for an Injury Roll".
    // So a 250-point hit can still be under threshold, and the flag is the only
    // thing that knows it — comparing `damage` to 100 here would be wrong.
    expect(injuryCheck(hit({ exceededThreshold: false }))).toMatchObject({
      roll: false, reason: "belowThreshold",
    });
  });

  it("does not roll for a unit that did not survive", () => {
    expect(injuryCheck(hit({ healthAfter: 0 }))).toMatchObject({ roll: false, reason: "defeated" });
  });

  it("does not roll when no damage was actually taken", () => {
    expect(injuryCheck(hit({ damage: 0, exceededThreshold: false }))).toMatchObject({
      roll: false, reason: "noDamage",
    });
  });

  it("is cancelled by a successful Light Wound Luck Check", () => {
    expect(injuryCheck(hit({ lightWound: true }))).toMatchObject({ roll: false, reason: "lightWound" });
  });

  describe("the Golden Hind override — Injury Rolls only from a Noble Phantasm", () => {
    const goldenHind = { attributes: ["injuryOnlyFromNP"] };

    it("skips the roll on a normal attack", () => {
      expect(injuryCheck(hit({ defender: goldenHind }))).toMatchObject({
        roll: false, reason: "npOnly",
      });
    });

    it("still rolls when the damage came from a Noble Phantasm", () => {
      expect(injuryCheck(hit({ defender: goldenHind, isNP: true }))).toMatchObject({ roll: true });
    });
  });
});
