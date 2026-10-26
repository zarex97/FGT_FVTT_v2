/**
 * @file A Master its guard stepped in for is still involved in the Combat Phase,
 * and an open Process previews its damage for the side that decides.
 * @see module/engine/attack.mjs#fireCombatPhaseEnd, #processDamagePreview
 *
 * Found live 2026-10-25: Heracles's Master was the target of an Attack that went
 * to Heracles, took nothing, and the Home Base gave him its Round-end heal
 * (*"unless it fought here"*). And the DU's player asked to see the damage
 * before spending Eye of the Mind or a Command Spell.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import * as cp from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 120_000);

const H = "heraclesAttack00", D = "drakeGuard000000", M = "drakesMaster0000";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

/** Heracles 2 from the Master, Drake beside it and out of his Range: case 2. */
const subjects = [
  { from: "heracles", id: H, state: { factionId: "A" }, panel: { i: 5, j: 2 } },
  { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 5, j: 4 } },
  { from: "drake", id: D, state: { factionId: "B", masterId: M }, panel: { i: 5, j: 5 } },
];

describe("a Master a guard took the Attack from", () => {
  it("is involved in the Combat Phase", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      const { resolveAttack, advanceAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: H, abilityId: null, placement: { unitId: M, chosenIds: [M] } });
      const id = declared.processes[0].messageId;
      const opened = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
      // The guard took it: otherwise the involvement below proves nothing.
      expect(opened.defenderId).toBe(D);
      expect(opened.guardedMasterId).toBe(M);

      for (let n = 0; n < 12; n += 1) {
        const st = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
        const prompt = cp.pendingPrompt(st);
        if (cp.isComplete(st) || !prompt) break;
        await advanceAttack({ messageId: id, event: prompt.kind === "reaction" ? "nothing" : "declined" });
      }
      expect(w.actor(M).system.turnState.inCombatPhase).toBe(true);
    }, at);
  }, 60_000);
});

describe("the damage preview of an open Process", () => {
  it("is the targeting preview's range before the damage, and nothing after", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      const { resolveAttack, advanceAttack, processDamagePreview, previewContext } = await import("../../module/engine/attack.mjs");
      const { damageRange, negationBounds } = await import("../../module/rules/preview.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const declared = await resolveAttack({ attackerId: H, abilityId: null, placement: { unitId: M, chosenIds: [M] } });
      const id = declared.processes[0].messageId;
      const open = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
      const now = currentBoard();

      const range = processDamagePreview(open, now);
      const caster = now.units.find((u) => u.id === H);
      const defender = now.units.find((u) => u.id === D);
      const expected = damageRange(
        previewContext({ caster, defender, ability: null, board: now, isNP: false, targets: [defender] }),
        { negation: negationBounds(defender, false) },
      );
      expect(range).toEqual(expected);
      expect(range.max).toBeGreaterThan(0);

      for (let n = 0; n < 12; n += 1) {
        const st = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
        const prompt = cp.pendingPrompt(st);
        if (cp.isComplete(st) || !prompt) break;
        await advanceAttack({ messageId: id, event: prompt.kind === "reaction" ? "nothing" : "declined" });
      }
      const done = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
      expect(cp.isComplete(done)).toBe(true);
      expect(processDamagePreview(done, currentBoard())).toBeNull();
    }, at);
  }, 60_000);
});
