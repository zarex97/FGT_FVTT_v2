/**
 * @file A Combat Process whose run is lost with the GM's client neither replays
 * its damage nor stalls (#250).
 * @see module/engine/attack.mjs#closeRung, #resumeStalledProcesses, docs/21-combat-process.md
 *
 * Found live during #249: Rain of Light's Processes wrote the damage, then held
 * the Command Spell window; the GM page was reloaded, `react` answered again,
 * and Kingprotea took the damage twice (1700 → 986 → 487). After 12f979b2 wrote
 * the held rung before holding it, the same reload left Medea's card at
 * `injury` for good (pressed 2026-10-19): no run was left to drive it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const A = "yanQingAttack250", D = "medeaDefend00250";
const MATCH = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };
const SCENE = "sceneLostRun0250";

async function hit(play) {
  await withSubjects([
    { from: "yan-qing", id: A, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from: "medea", id: D, owner: "p1", state: { factionId: "B", health: { value: 2000, max: 3000 } }, panel: { i: 5, j: 6 } },
  ], async ({ world: w }) => {
    w.dice.every(10);
    await play(w);
  }, MATCH);
}
const processWrites = (w, id) => w.writes
  .map((write, at) => ({ at, write }))
  .filter(({ write: [label, path] }) => label === `ChatMessage(${id})` && path === "flags.fgt.process");
const stateOf = (raw) => JSON.parse(raw).state;

describe("a lost run (#250)", () => {
  it("stores the Process the moment the damage is written, past the damage rung", async () => {
    await hit(async (w) => {
      const { declared: { messageId: id } } = await playAttack(w, { attacker: A, target: D, react: { [D]: ["nothing", "declined"] } });
      const health = w.writes.findIndex(([label, path]) => label.startsWith("Actor") && path === "system.health.value");
      expect(health, "the damage was written").toBeGreaterThan(-1);
      // The first store after the damage write is past it: a run lost from here
      // leaves the card at `injury`, and nothing answers the damage rung again.
      const next = processWrites(w, id).find(({ at }) => at > health);
      expect(stateOf(next.write[2])).toBe("injury");
    });
  }, 30_000);

  it("drives on from where the lost run stored it, and the damage lands once", async () => {
    await hit(async (w) => {
      const { declared: { messageId: id } } = await playAttack(w, { attacker: A, target: D, react: { [D]: ["nothing", "declined"] } });
      const message = w.messages.get(id);
      const afterDamage = w.actor(D).system.health.value;
      expect(afterDamage).toBeLessThan(2000);
      // Put the card back where a GM reload in the Injury window left it.
      const stored = processWrites(w, id).map(({ write }) => write[2]).find((raw) => stateOf(raw) === "injury");
      await message.setFlag("fgt", "process", stored);
      message.speaker.scene = SCENE;
      globalThis.canvas.scene.id = SCENE;

      const { resumeStalledProcesses } = await import("../../module/engine/attack.mjs");
      expect(resumeStalledProcesses()).toEqual([id]);
      await new Promise((r) => setTimeout(r, 0));
      const { serialized } = await import("../../module/engine/attack.mjs");
      await serialized(id, async () => null);

      const after = JSON.parse(message.getFlag("fgt", "process"));
      expect(after.state).not.toBe("injury");
      expect(after.history.map((h) => h.state)).toContain("injury");
      expect(w.actor(D).system.health.value).toBe(afterDamage);
    });
  });

  it("leaves a rung that waits on a player, and another scene's card, alone", async () => {
    await hit(async (w) => {
      const { resolveAttack, resumeStalledProcesses } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: A, abilityId: null, placement: { unitId: D, chosenIds: [D] } });
      const message = w.messages.get(declared.messageId);
      expect(stateOf(message.getFlag("fgt", "process"))).toBe("react");
      message.speaker.scene = SCENE;
      globalThis.canvas.scene.id = SCENE;
      expect(resumeStalledProcesses()).toEqual([]);
      // ...and a card from a scene this canvas does not show, at a rung that needs nobody.
      const raw = JSON.parse(message.getFlag("fgt", "process"));
      await message.setFlag("fgt", "process", JSON.stringify({ ...raw, state: "injury" }));
      message.speaker.scene = "anotherScene0000";
      expect(resumeStalledProcesses()).toEqual([]);
    });
  });
});
