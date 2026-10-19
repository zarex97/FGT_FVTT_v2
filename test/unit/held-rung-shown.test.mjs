/**
 * A rung held open for a Command Spell is on the card while it is held.
 *
 * `closeRung` drives a Process through every rung that needs nobody and holds
 * an interruptible one open (`awaitInterrupt`, up to `commandSpellTimeout`).
 * The flag and the card were written only once the whole run ended, so for the
 * whole wait the card still showed the question just answered: Player2 pressed
 * Block and nothing moved for 45 seconds a rung, and the Damage Block the wait
 * was for never appeared (found live, 2026-10-18).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
import { CommandSpellRegistry } from "../../module/rules/cs-registry.mjs";
import { deserialize } from "../../module/engine/combat-process.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

const src = (dir, file) => yaml.load(readFileSync(new URL(`../../packs/_source/${dir}/${file}`, import.meta.url), "utf8"));

beforeAll(prepareSubjects, 120_000);

describe("a rung held for a Command Spell", () => {
  it("is written to the card before the wait, not after it", async () => {
    const H = "heraclesHeldRung", D = "drakeHeldRungDef", MA = "masterHeldRungAt", MD = "masterHeldRungDf";
    CommandSpellRegistry.load(readdirSync(new URL("../../packs/_source/command-spells/", import.meta.url))
      .map((f) => src("command-spells", f)).map((y) => ({ name: y.name, system: { ...y, contentId: y.id } })));
    await withSubjects([
      { from: "heracles", id: H, state: { factionId: "A", masterId: MA, contract: "contracted" }, panel: { i: 5, j: 4 } },
      { from: "master-advanced", id: MA, state: { factionId: "A" }, panel: { i: 5, j: 2 } },
      { from: "drake", id: D, state: { factionId: "B", masterId: MD, contract: "contracted" }, panel: { i: 5, j: 5 } },
      { from: "master-advanced", id: MD, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      // The attacker's side buys nothing, so no window opens before the ladder;
      // the defender's Master holds three spells, so a later rung is held.
      await w.actor(MA).update({ "system.commandSpells": 0 });
      await w.actor(MD).update({ "system.commandSpells": 3 });
      const { resolveAttack, advanceAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: H, abilityId: null, placement: { unitId: D, chosenIds: [D] } });
      const id = declared.processes?.[0]?.messageId ?? declared.messageId;
      const flag = () => deserialize(w.messages.get(id).getFlag("fgt", "process"));
      expect(flag().state).toBe("react");

      const answered = advanceAttack({ messageId: id, event: "nothing" });
      // Well inside the 5-second hold: the card has left the answered rung.
      let seen = flag();
      for (let k = 0; k < 30 && seen.state === "react"; k += 1) {
        await new Promise((r) => setTimeout(r, 100));
        seen = flag();
      }
      expect(seen.state, "the card still showed the rung that was answered").not.toBe("react");
      expect(seen.history.map((h) => `${h.state}→${h.event}`)).toContain("react→nothing");
      await answered;
    }, {
      tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" },
      // The test world closes every window (timeout 0); this one has to open.
      worldSettings: { commandSpellTimeout: 5 },
    });
  }, 90_000);
});
