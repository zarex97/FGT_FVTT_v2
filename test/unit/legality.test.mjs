/**
 * @file Legality rendering — why a placement is refused.
 * @see docs/28-targeting-implementation.md §28.8
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  presentRefusal, presentVerdict, needsHardConfirm, isBlocked, REFUSALS, LEGALITY_KINDS,
} from "../../module/rules/legality.mjs";

describe("presentRefusal", () => {
  it("carries the numbers the message interpolates", () => {
    // "Anchor is 7 panels away; Range is 4" is a refusal a player fixes by
    // moving the cursor. "Illegal target" is one they fix by guessing.
    expect(presentRefusal("outOfRange", { distance: 7, range: 4 }))
      .toMatchObject({ kind: "hard", params: { distance: 7, range: 4 } });
  });

  it("marks a Command-Spell-overridable refusal with the command that lifts it", () => {
    expect(presentRefusal("notInZon", { distance: 9, zon: 2 }))
      .toMatchObject({ kind: "overridable", command: "forceNoblePhantasm" });
  });

  it("marks the Grail as a CONFIRM, not a refusal", () => {
    // The placement is legal. It is just catastrophic — ALL factions lose.
    expect(presentRefusal("grailAtRisk", { chance: 30 })).toMatchObject({ kind: "confirm" });
  });

  it("still renders a reason nobody worded", () => {
    // Better than a silent failure to place: the player learns something
    // refused, and the reason string names what to search for.
    expect(presentRefusal("somethingNew")).toMatchObject({ kind: "hard", unrecognised: true });
  });

  it("only ever uses a documented kind", () => {
    for (const reason of Object.keys(REFUSALS)) {
      expect(LEGALITY_KINDS).toContain(presentRefusal(reason).kind);
    }
  });

  it("gives every refusal a message key that exists", () => {
    const strings = JSON.parse(readFileSync("lang/en.json", "utf8"));

    for (const [reason, spec] of Object.entries(REFUSALS)) {
      expect(strings, reason).toHaveProperty(spec.i18n);
    }
    expect(strings).toHaveProperty("FGT.Legality.unknown");
  });

  it("declares every parameter its message actually interpolates", () => {
    // A message with a {placeholder} nobody supplies renders with a blank,
    // which reads as a bug in the number rather than a missing field.
    const strings = JSON.parse(readFileSync("lang/en.json", "utf8"));

    for (const [reason, spec] of Object.entries(REFUSALS)) {
      const placeholders = [...String(strings[spec.i18n]).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const name of placeholders) {
        expect(spec.params, `${reason} interpolates {${name}} and does not declare it`).toContain(name);
      }
    }
  });
});

describe("presentVerdict", () => {
  it("puts the unfixable refusal first", () => {
    // A player facing both should read the one a Command Spell cannot lift:
    // spending on the other still leaves them unable to act.
    const out = presentVerdict([
      { reason: "notInZon", distance: 9, zon: 2 },
      { reason: "crossLevelMelee" },
    ]);

    expect(out[0].reason).toBe("crossLevelMelee");
  });

  it("puts the confirm last, because it is not a refusal", () => {
    const out = presentVerdict([{ reason: "grailAtRisk", chance: 30 }, { reason: "noTargets" }]);

    expect(out.at(-1).reason).toBe("grailAtRisk");
  });

  it("handles an empty verdict", () => {
    expect(presentVerdict([])).toEqual([]);
  });
});

describe("needsHardConfirm", () => {
  it("is true only for the Grail", () => {
    expect(needsHardConfirm(presentVerdict([{ reason: "grailAtRisk", chance: 5 }]))).toBe(true);
    expect(needsHardConfirm(presentVerdict([{ reason: "noTargets" }]))).toBe(false);
  });
});

describe("isBlocked", () => {
  it("blocks on a hard refusal", () => {
    expect(isBlocked(presentVerdict([{ reason: "noTargets" }]))).toBe(true);
  });

  it("does not block on a confirm", () => {
    expect(isBlocked(presentVerdict([{ reason: "grailAtRisk", chance: 5 }]))).toBe(false);
  });

  it("blocks on an overridable refusal the player cannot actually afford", () => {
    // §17.6: an unusable option should never appear. Offering the spend button
    // for a command the Master cannot pay for is that failure exactly.
    expect(isBlocked(presentVerdict([{ reason: "notInZon" }]), [])).toBe(true);
  });

  it("does not block when the overriding command IS available", () => {
    expect(isBlocked(presentVerdict([{ reason: "notInZon" }]), ["forceNoblePhantasm"])).toBe(false);
  });
});
