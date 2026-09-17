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
import { readFileSync } from "node:fs";
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

/**
 * The same defect, twice more, found by the architecture review that followed
 * the Turn Record work.
 *
 * `offerAttackerWindow` was fixed when this file was written; `offeredReactions`
 * and `offerNPCancellation` went on hand-building their subjects, each throwing
 * away a snapshot computed on the line above it. Both carried a RAW turn record,
 * so staleness never applied — and neither passed `roundState` at all, which
 * meant `abilitiesAtWindow`'s `usedThisRound` read `[]` and the `oncePerRound` /
 * `sameRoundExclusive` half of the gate had never refused anything, anywhere.
 *
 * Read as TEXT, in the house style for holding code against code: these live in
 * `engine/`, which needs a world to run. The shape is what is asserted, because
 * the shape is what was wrong.
 */
describe("drift: no window subject is hand-built", () => {
  const source = readFileSync("module/engine/attack.mjs", "utf8");

  it("passes a snapshot to every window query, never a field literal", () => {
    // `{ items: …, turnState: … }` — the shape Ch. 23 and Ch. 24 both condemn.
    const handBuilt = [...source.matchAll(/\{[^{}]*\bitems:[^{}]*\bturnState:[^{}]*\}/g)];
    expect(handBuilt.map((m) => m[0])).toEqual([]);
  });

  it("still asks its three window questions", () => {
    // So the test above cannot pass by the call sites having been deleted.
    expect(source.match(/windowSubject\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});
