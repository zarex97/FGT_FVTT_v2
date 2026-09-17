/**
 * @file What an attacker's timing window asks its questions of.
 * @see module/rules/reactions.mjs, docs/46-roster-re-audit.md §46.4-V
 *
 * `abilitiesAtWindow` filters an ability by everything the Unit can answer
 * alone, including its `requirements`. Four of Achilles's abilities are *"can
 * only be used when Unmounted"*, and `stance` is in the set of requirements a
 * window checks.
 *
 * `engine/attack.mjs#offerAttackerWindow` hand-built the subject it asked:
 *
 *     { items, effects, turnState, roundState }
 *
 * `rules/stance.mjs#stanceOf` reads `unit.stanceSpec` and returns **null**
 * without it — so the comparison was `null === "dismounted"`, the requirement
 * could never pass, and **Runner Comet was never offered at the only window its
 * sheet gives it**. §46.4-P had just made such an ability runnable; this is what
 * kept it unreachable.
 *
 * Measured live: a dismounted Achilles, Runner Comet off cooldown and every
 * other gate passing, and no window opened. `abilitiesAtWindow` given his
 * snapshot offered it; given the hand-built shape it offered nothing.
 */

import { describe, it, expect } from "vitest";
import { windowSubject, abilitiesAtWindow } from "../../module/rules/reactions.mjs";

const runnerComet = {
  id: "rc", name: "Runner Comet",
  system: {
    slug: "runnerComet", timing: { window: "combatPhaseStart" },
    cooldown: { remaining: 0 },
    requirements: [{ kind: "stance", stance: "dismounted" }],
  },
};

const snapshot = (stance) => ({
  id: "achilles", stance,
  stanceSpec: { states: ["mounted", "dismounted"], default: "dismounted" },
  effects: [], turnState: {}, roundState: {}, abilities: [], health: { value: 1600, max: 1600 },
});

describe("the subject a window asks its questions of", () => {
  it("carries the stance AND the spec that makes it readable", () => {
    const subject = windowSubject(snapshot("dismounted"), [runnerComet]);
    expect(subject.stance).toBe("dismounted");
    expect(subject.stanceSpec?.states).toEqual(["mounted", "dismounted"]);
  });

  it("carries the Items, which the filter reads `system` off", () => {
    expect(windowSubject(snapshot("dismounted"), [runnerComet]).items).toEqual([runnerComet]);
  });

  it("survives a snapshot that has no stance at all", () => {
    const subject = windowSubject({ id: "x", effects: [], turnState: {}, roundState: {} }, []);
    expect(subject.items).toEqual([]);
  });
});

describe("a dismounted-only ability at a window", () => {
  it("is OFFERED to a dismounted Unit", () => {
    const offered = abilitiesAtWindow(windowSubject(snapshot("dismounted"), [runnerComet]), "combatPhaseStart");
    expect(offered.map((i) => i.name)).toEqual(["Runner Comet"]);
  });

  it("is REFUSED to a mounted one — the sheet refuses the press", () => {
    const offered = abilitiesAtWindow(windowSubject(snapshot("mounted"), [runnerComet]), "combatPhaseStart");
    expect(offered).toEqual([]);
  });

  it("is refused when the subject cannot answer the question at all", () => {
    // The shape the window used to build: no `stanceSpec`, so `stanceOf` is
    // null and the requirement can never pass. Pinned so the regression is
    // visible rather than silent.
    const blind = { items: [runnerComet], effects: [], turnState: {}, roundState: {} };
    expect(abilitiesAtWindow(blind, "combatPhaseStart")).toEqual([]);
  });
});
