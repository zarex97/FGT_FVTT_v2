/**
 * @file Switching a mode on and off.
 * @see module/rules/modes.mjs
 *
 * The toggle was a bare write — press the button, flip `system.active` — so
 * every rule about *when* a mode may be switched had nowhere to live. There are
 * three in the reference set and Penthesilea needs two of them.
 */

import { describe, it, expect } from "vitest";
import { canToggleMode, compelledOn, forcedModes } from "../../module/rules/modes.mjs";
import { invalidationsFor, INVALIDATION_TARGETS } from "../../module/rules/invalidation.mjs";

const mode = (system = {}) => ({ id: "me", system: { isMode: true, slug: "madEnhancement", ...system } });
const unit = (over = {}) => ({ id: "p", compulsions: [], ...over });

const hatred = {
  id: "hatred", forcesSkill: "madEnhancement", forcesTarget: true,
  targetIds: ["achilles"], source: "Hatred of Achilles",
};

describe("cannotDeactivate", () => {
  it("refuses switching off, and allows switching on", () => {
    // Heracles: "cannot deactivate Mad Enhancement".
    expect(canToggleMode(mode({ cannotDeactivate: true }), unit(), { active: false }))
      .toMatchObject({ ok: false, reason: "cannotDeactivate" });
    expect(canToggleMode(mode({ cannotDeactivate: true }), unit(), { active: true }).ok).toBe(true);
  });
});

describe("the two-way lockout", () => {
  const locked = mode({ toggleLock: "2◈", toggledAt: 10 });

  it("refuses either direction inside the window", () => {
    // "It can only be deactivated 2◈ Turns after it was activated AND VICE
    // VERSA" — one clock, both directions.
    for (const active of [true, false]) {
      expect(canToggleMode(locked, unit(), { active, tick: 12, turnsPerRound: 3 }))
        .toMatchObject({ ok: false, reason: "toggleLock", detail: { remaining: 4 } });
    }
  });

  it("allows it once the window has passed", () => {
    expect(canToggleMode(locked, unit(), { active: false, tick: 16, turnsPerRound: 3 }).ok).toBe(true);
  });

  it("resolves the window against the world's turns per Round", () => {
    // 2◈ is six turns at three per Round and sixteen at eight, so the same
    // elapsed time frees the toggle in one world and not in the other.
    expect(canToggleMode(locked, unit(), { active: false, tick: 16, turnsPerRound: 3 }).ok).toBe(true);
    expect(canToggleMode(locked, unit(), { active: false, tick: 16, turnsPerRound: 8 }).ok).toBe(false);
  });

  it("does nothing to a mode that has never been toggled", () => {
    expect(canToggleMode(mode({ toggleLock: "2◈" }), unit(), { active: true, tick: 4 }).ok).toBe(true);
  });
});

describe("a compulsion holding a mode on", () => {
  it("refuses to switch it off while the compulsion stands", () => {
    // "Mad Enhancement cannot be deactivated until there are no Greek Male
    // Units within a 4 panel area of Penthesilea."
    expect(canToggleMode(mode(), unit({ compulsions: [hatred] }), { active: false }))
      .toMatchObject({ ok: false, reason: "compelled" });
  });

  it("lifts the moment the compulsion finds nobody", () => {
    // Positional, like the aura it is modelled on: it lifts the instant the
    // Greek Male leaves, with no cleanup step.
    const gone = { ...hatred, targetIds: [] };
    expect(canToggleMode(mode(), unit({ compulsions: [gone] }), { active: false }).ok).toBe(true);
    expect(compelledOn(mode(), unit({ compulsions: [gone] }))).toBe(false);
  });

  it("does not refuse switching it ON", () => {
    expect(canToggleMode(mode(), unit({ compulsions: [hatred] }), { active: true }).ok).toBe(true);
  });

  it("ignores a compulsion aimed at a different skill", () => {
    const other = { ...hatred, forcesSkill: "riding" };
    expect(canToggleMode(mode(), unit({ compulsions: [other] }), { active: false }).ok).toBe(true);
  });
});

describe("forcedModes", () => {
  it("names a switched-off mode the compulsion should turn on", () => {
    // "Her Mad Enhancement is IMMEDIATELY ACTIVATED regardless of Cooldown or
    // any other factors" — a write, not a refusal, which is why this file
    // answers two questions rather than one.
    const items = [mode({ active: false }), { id: "x", system: { isMode: true, slug: "riding" } }];
    expect(forcedModes(unit({ compulsions: [hatred] }), items).map((i) => i.id)).toEqual(["me"]);
  });

  it("leaves one that is already on", () => {
    expect(forcedModes(unit({ compulsions: [hatred] }), [mode({ active: true })])).toEqual([]);
  });

  it("leaves a non-mode alone, even if the compulsion names it", () => {
    const notAMode = { id: "n", system: { isMode: false, slug: "madEnhancement" } };
    expect(forcedModes(unit({ compulsions: [hatred] }), [notAMode])).toEqual([]);
  });

  it("is empty when nothing compels", () => {
    expect(forcedModes(unit(), [mode()])).toEqual([]);
  });
});

describe("the invalidation that drives it", () => {
  it("names `compulsions` on everything that can move somebody", () => {
    // A compulsion's answer is POSITIONAL, so the moment it becomes true is a
    // moment somebody moved. `forcedModes` was built and tested and nothing
    // called it, which is this project's signature defect — a rule that is
    // right and inert.
    expect(invalidationsFor("tokenMoved", {})).toContain("compulsions");
    expect(invalidationsFor("turnAdvanced", {})).toContain("compulsions");
    expect(invalidationsFor("roundAdvanced", {})).toContain("compulsions");
    // Deleting a token clears everything, which covers the Greek Male dying.
    expect(invalidationsFor("tokenDeleted", {})).toContain("all");
  });

  it("does not name it on a change that cannot move anybody", () => {
    // Health ticks every burn; rebuilding the board on each one is the
    // expensive mistake §23.9 warns about.
    expect(invalidationsFor("actorField", { actorId: "p" })).not.toContain("compulsions");
    expect(invalidationsFor("effectChanged", { actorId: "p" })).not.toContain("compulsions");
  });

  it("is a target the table admits, so a typo would clear nothing", () => {
    expect(INVALIDATION_TARGETS).toContain("compulsions");
  });
});
