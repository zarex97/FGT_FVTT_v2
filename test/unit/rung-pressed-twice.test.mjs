/**
 * @file A Process rung answered twice at once runs once.
 * @see module/engine/attack.mjs#advanceAttack, docs/surprises/2026-10-14-one-rung-pressed-twice-runs-twice.md
 *
 * Pressed live during Wave A: the GM's card and Player1's both answered the
 * same reaction rung, and Kiritsugu's Return Fire was declared twice.
 * `advanceAttack` read the rung from the message, then awaited -- a question,
 * a roll, a write -- before it stored the next one, so a second press read the
 * same rung and ran it again. A reaction timeout firing while the player's own
 * press was still running did the same. Two presses on one card are ordinary:
 * the GM sees every button.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import * as process from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 120_000);

const HERACLES = "heraclesAttacker";
const MEDEA = "medeaDefender000";

describe("one reaction rung, pressed twice at once", () => {
  it("deals the attack's damage once", async () => {
    await withSubjects([
      { from: "heracles", id: HERACLES, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "medea", id: MEDEA, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      const { resolveAttack, advanceAttack } = await import("../../module/engine/attack.mjs");
      const before = w.actor(MEDEA).system.health.value;
      const { messageId } = await resolveAttack({ attackerId: HERACLES, abilityId: null, placement: { unitId: MEDEA, chosenIds: [MEDEA] } });

      await Promise.all([
        advanceAttack({ messageId, event: "nothing" }),
        advanceAttack({ messageId, event: "nothing" }),
      ]);
      const state = process.deserialize(w.messages.get(messageId).getFlag("fgt", "process"));
      if (process.pendingPrompt(state)?.kind === "counter") await advanceAttack({ messageId, event: "declined" });

      const { total } = w.messages.get(messageId).getFlag("fgt", "result");
      expect(w.actor(MEDEA).system.health.value).toBe(before - total);
      expect(w.rolls.filter((r) => r.formula === "5d10")).toHaveLength(1);
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});
