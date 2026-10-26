/**
 * @file Teleport Servant spent by an attacked Master switches the attack to the Servant.
 * @see module/engine/command-spells.mjs#interruptsOf
 *
 * > *"When CS: Teleport Servant is used by a Master when it is Attacked, the AU's
 * > target is switched to the newly-teleported Servant. The newly-teleported
 * > Servant cannot use Evade or Block in this Combat Process."* (Rules – Relationships)
 *
 * Found live 2026-10-25: Medusa was teleported beside her Master, and the Master
 * took EMIYA's arrow, was Overpowered and lost her to a Conquest.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { CommandSpellRegistry } from "../../module/rules/cs-registry.mjs";
import * as cp from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 120_000);

const E = "emiyaAttacker000", D = "drakeDefender000", M = "drakesMaster0000";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

function loadCommands() {
  const docs = readdirSync("packs/_source/command-spells").filter((f) => f.endsWith(".yml")).map((f) => f.slice(0, -4)).map((id) => {
    const y = parse(readFileSync(`packs/_source/command-spells/${id}.yml`, "utf8"));
    return { name: y.name, system: { ...y, contentId: y.id } };
  });
  CommandSpellRegistry.load(docs);
}

describe("Teleport Servant on an attacked Master", () => {
  it("switches the AU's target to the Servant, who may not Evade or Block", async () => {
    loadCommands();
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 1 } },
      // The Servant well away, so Teleport Servant may bring her in.
      { from: "drake", id: D, state: { factionId: "B", masterId: M }, panel: { i: 11, j: 11 } },
      { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 5, j: 4 } },
    ], async ({ world: w }) => {
      await w.actor(M).update({ "system.commandSpells": 3 });
      const masterHealth = w.actor(M).system.health.value;
      const drakeHealth = w.actor(D).system.health.value;
      // EMIYA's Reinforcement asks at the Combat Phase start; not used here.
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      const { resolveAttack, advanceAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: E, abilityId: null, placement: { unitId: M, chosenIds: [M] } });
      const id = declared.processes[0].messageId;

      const { spendCommandSpell } = await import("../../module/engine/command-spells.mjs");
      const out = await spendCommandSpell({ masterId: M, commandId: "cs-teleport-servant", messageId: id, context: { destination: { i: 5, j: 5 } } });
      expect(out).toMatchObject({ ok: true });

      const switched = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
      expect(switched.defenderId).toBe(D);
      expect(switched.forbiddenReactions).toEqual(expect.arrayContaining(["evade", "block"]));
      expect(switched.interrupts).toEqual([expect.objectContaining({ kind: "retarget", command: "cs-teleport-servant", applied: true })]);
      expect(w.messages.get(id).getFlag("fgt", "defenderId")).toBe(D);

      for (let n = 0; n < 12; n += 1) {
        const st = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
        const prompt = cp.pendingPrompt(st);
        if (cp.isComplete(st) || !prompt) break;
        await advanceAttack({ messageId: id, event: prompt.kind === "reaction" ? "nothing" : "declined" });
      }
      expect(w.actor(M).system.health.value).toBe(masterHealth);
      expect(w.actor(M).system.defeated).toBeFalsy();
      expect(w.actor(D).system.health.value).toBeLessThan(drakeHealth);
      expect(w.actor(M).system.commandSpells).toBe(2);
      // The Master the Attack left was still involved in the Phase: Home Base
      // gave Heracles's Master its Round-end heal regardless (found live).
      expect(w.actor(M).system.turnState.inCombatPhase).toBe(true);
      expect(cp.deserialize(w.messages.get(id).getFlag("fgt", "process")).interrupts[0].fromId).toBe(M);
    }, at);
  }, 60_000);
});
