/**
 * @file A Luck rung its Unit cannot take is never offered (#252).
 * @see module/engine/attack.mjs#closedLuckRung, docs/29-environment.md, docs/21-combat-process.md
 *
 * > *"Intermediate: Luck Check removed."*
 *
 * The difficulty was read only when the drive reached a rung that needed
 * nobody, and a Luck rung always needs its Unit: on Intermediate a defender who
 * failed to Evade was shown *"Contest (costs 1 Luck)"*, and a press rolled it
 * (found live, 2026-10-18 and again 2026-10-19).
 */

import { readFileSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const A = "yanQingAttack252", D = "medeaDefend00252";
// The difficulty is the Combat's own, which the board reads before the setting.
const at = (difficulty) => ({ tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, difficulty }, actingFactionId: "A" } });
const LUCK = 3;

/** Yan Qing's Normal Attack on Medea, Player1's, whose Evade fails. */
async function failedEvade(difficulty, play) {
  await withSubjects([
    { from: "yan-qing", id: A, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from: "medea", id: D, owner: "p1", state: { factionId: "B" }, panel: { i: 5, j: 6 } },
  ], async ({ world: w }) => {
    // Luck to spend. The pool is rolled at war setup, which a subject never went through.
    await w.actor(D).update({ "system.luck.max": LUCK, "system.luck.value": LUCK });
    w.dice.set("d20", 20);
    await play(w);
  }, at(difficulty));
}
const rungs = (state) => state.history.map((h) => `${h.state}:${h.event}${h.detail?.reason ? `(${h.detail.reason})` : ""}`);

describe("a Luck rung the difficulty removes (#252)", () => {
  it("is declined with its reason on Intermediate, before anybody is asked", async () => {
    await failedEvade("intermediate", async (w) => {
      // The script answers the Evade, the hit and the Counter: a Luck rung asked would take "accept" and throw.
      const { processes: [state] } = await playAttack(w, { attacker: A, target: D, react: { [D]: ["evade", "accept", "declined"] } });
      expect(rungs(state)).toContain("evadeRoll:fail");
      expect(rungs(state)).toContain("s24_luckyEvasion:declined(luckChecksRemoved)");
      expect(w.actor(D).system.luck.value).toBe(LUCK);
      // The card says why the option is gone, and the template prints the line.
      const card = w.cards.filter((c) => c.path.endsWith("chat/attack.hbs")).at(-1);
      // The test world's i18n hands the key back; the key's English is checked below.
      expect(card.data.luckClosed).toEqual(["FGT.Card.LuckClosed.luckChecksRemoved"]);
      expect(JSON.parse(readFileSync("lang/en.json", "utf8"))["FGT.Card.LuckClosed.luckChecksRemoved"])
        .toBe("No Luck Check: this War's difficulty removes it.");
      expect(readFileSync("templates/chat/attack.hbs", "utf8")).toMatch(/\{\{#each luckClosed as \|line\|\}\}/);
    });
  }, 30_000);

  it("is still asked on Expert", async () => {
    await failedEvade("expert", async (w) => {
      // Medea's player is asked, and declines: no reason on the rung.
      const { processes: [state] } = await playAttack(w, { attacker: A, target: D, react: { [D]: ["evade", "declined", "accept", "declined"] } });
      expect(rungs(state)).toContain("s24_luckyEvasion:declined");
      const card = w.cards.filter((c) => c.path.endsWith("chat/attack.hbs")).at(-1);
      expect(card.data.luckClosed).toEqual([]);
    });
  });

  it("rolls nothing for a Contest pressed on a card drawn before the rung closed", async () => {
    await failedEvade("expert", async (w) => {
      // Expert: the Process waits on the Luck rung, and the script has no answer.
      await expect(playAttack(w, { attacker: A, target: D, react: { [D]: ["evade"] } }))
        .rejects.toThrow(/asks medeaDefend00252 \(luckCheck/);
      const card = [...w.messages.values()].find((m) => m.getFlag?.("fgt", "process"));
      // The War's difficulty changes under the open card; the press comes after.
      await w.combat.update({ "system.difficulty": "intermediate" });
      const { advanceAttack } = await import("../../module/engine/attack.mjs");
      const state = await advanceAttack({ messageId: card.id, event: "contest" });
      expect(rungs(state)).toContain("s24_luckyEvasion:declined(luckChecksRemoved)");
      expect(w.actor(D).system.luck.value).toBe(LUCK);
    });
  });
});
