/**
 * @file The Master's Luck Check against Overpower, played in the test world (#111).
 * @see module/engine/overpower-save.mjs, docs/32-relationships.md
 *
 * > A success prevents the instant defeat, and leaves the Master at 1 Health
 * > if the damage would be lethal (Ch. 32).
 *
 * `resolveOverpower` modelled it; the attack path read `state.luckChecks.overpower`,
 * which nothing wrote. Ruled 2026-10-19: asked of the Master's player before
 * the flip, 1 Luck whatever the die says, not on Beginner or Intermediate.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const MEDEA = "medeaOverpow0111", M = "masterOverpow111";
const at = (difficulty) => ({ tokens: true, combat: { round: 4, started: true, system: { globalTurn: 12, difficulty }, actingFactionId: "A" } });
const ASK = "FGT.Prompt.luckCheck";
const LUCK = 3;

/** Medea's Normal Attack on a Master of Blue, Player1's, at `health`. */
async function onMaster(difficulty, health, play) {
  await withSubjects([
    { from: "medea", id: MEDEA, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "master-advanced", id: M, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  ], async ({ world: w }) => {
    await w.actor(M).update({ "system.luck.max": LUCK, "system.luck.value": LUCK, "system.health.value": health });
    const attack = () => playAttack(w, { attacker: MEDEA, target: M, react: { [M]: ["nothing", "declined"] } });
    await play(w, attack);
  }, at(difficulty));
}
const flip = (w) => [...w.messages.values()].map((m) => m.getFlag?.("fgt", "result")?.flags?.overpower).find(Boolean);

describe("the Overpower save (#111)", () => {
  it("is asked of the Master's player; a pass stops the flip and survives lethal damage at 1", async () => {
    await onMaster("expert", 50, async (w, attack) => {
      w.answer({ title: ASK, by: "p1", value: true });
      // The attack rolls a 5d20 first; the save's die is the sixth.
      w.dice.set("d20", 10, 10, 10, 10, 10, 1);
      await attack();
      expect(flip(w)).toMatchObject({ saved: true, heads: false, luck: { success: true, before: LUCK, after: LUCK - 1 } });
      expect(w.actor(M).system.defeated).toBeFalsy();
      expect(w.actor(M).system.health.value).toBe(1);
      expect(w.actor(M).system.luck.value).toBe(LUCK - 1);
    });
  }, 30_000);

  it("costs the Luck when it fails, and the coin is flipped", async () => {
    await onMaster("expert", 300, async (w, attack) => {
      w.answer({ title: ASK, by: "p1", value: true });
      w.dice.set("d20", 10, 10, 10, 10, 10, 20);
      w.dice.set("d100", 1, 99);
      await attack();
      expect(flip(w)).toMatchObject({ saved: false, heads: false, luck: { success: false, before: LUCK, after: LUCK - 1 } });
      expect(w.actor(M).system.luck.value).toBe(LUCK - 1);
    });
  });

  it("is not asked on Intermediate, which removes the Luck Check", async () => {
    await onMaster("intermediate", 300, async (w, attack) => {
      // No answer scripted: an ask would find none and fail the world.
      w.dice.set("d100", 1, 99);
      await attack();
      expect(flip(w)).toMatchObject({ saved: false, luck: null });
      expect(w.actor(M).system.luck.value).toBe(LUCK);
    });
  });
});
