/**
 * @file The bar asks the War's first-Round rule, not the world's (found live, #256).
 * @see module/engine/budget.mjs#affordable, #endTurnVerdict
 *
 * War *Heracles Audit* was set up with `noAttackRound: 0`. Its preflight read
 * the War and allowed an Attack in Round 1, while every Attack slot on the bar
 * greyed: *"Attack — no attacks are permitted during the first Round"*. The bar
 * read the world setting, still 1.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/** Round 1 of a War whose own rule is `war`, in a world whose setting is 1. */
const inRound1 = (war, fn) => withSubjects([
  { from: "karna", panel: { i: 5, j: 2 }, state: { factionId: "red" } },
  { from: "emiya", panel: { i: 5, j: 5 }, state: { factionId: "blue" } },
], async ({ world }) => {
  const budget = await import("../../module/engine/budget.mjs");
  const { currentBoard } = await import("../../module/engine/board.mjs");
  const unit = currentBoard().units.find((u) => u.id === "karna");
  return fn({ budget, combat: world.combat, unit });
}, {
  round: 1,
  tick: 1,
  tokens: true,
  combat: { round: 1, started: true, actingFactionId: "red", system: { globalTurn: 1, noAttackRound: war } },
  worldSettings: { noAttackRound: 1, grandOrder: false },
});

describe("the first-Round ban on the bar", () => {
  it("is off when the War switched it off, whatever the world says", async () => {
    await inRound1(0, async ({ budget, combat, unit }) => {
      expect(String(budget.affordable(combat, unit, "attack").reason ?? "")).not.toMatch(/first Round/);
    });
  });

  it("holds when the War keeps it", async () => {
    await inRound1(1, async ({ budget, combat, unit }) => {
      expect(budget.affordable(combat, unit, "attack")).toMatchObject({ ok: false, reason: expect.stringMatching(/first Round/) });
    });
  });
});
