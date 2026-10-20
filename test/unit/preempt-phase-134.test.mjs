/**
 * @file Murderer of the Misty Night reads the phase at Jack's panel, and says
 * what it cost (#134, #185 reading 12).
 * @see module/engine/attack.mjs#offerPreemptions, docs/29-environment.md
 *
 * > *"If it is a Day Round, the activation of this effect requires a Successful
 * > Luck Check. Luck Check is not required during Night Rounds."*
 *
 * Ruled 2026-10-05: a rule reads the phase where the Unit that originates it
 * stands, sunlight and darkness zones included. Pressed 2026-10-19 on a Night
 * Round with Jack in a sunlit panel: the Luck Check was charged (2 → 1), and
 * nothing on the chat log said so -- nor that Jack had swung first.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const MEDEA = "medeaPreempt0134", JACK = "jackPreempt00134";
const at = (regions = []) => ({
  tokens: true, regions,
  // `system.phase` is the opening flip, and the Rounds alternate from it:
  // opened by Day, Round 2 is a Night Round (`rules/snapshot.mjs#annotateEnvironment`).
  combat: { round: 2, started: true, system: { globalTurn: 4, phase: "day" }, actingFactionId: "A" },
});
const sunlit = [{ id: "sun", panels: [{ i: 5, j: 6 }], behaviors: [{ type: "terrain", system: { types: ["sunlight"] } }] }];
const LUCK = 2;

async function attacked(regions, play, { luckDie = null } = {}) {
  await withSubjects([
    { from: "medea", id: MEDEA, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "jack-the-ripper", id: JACK, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  ], async ({ world: w }) => {
    await w.actor(JACK).update({ "system.luck.max": LUCK, "system.luck.value": LUCK });
    // Jack's player takes the swing.
    w.answer({ title: "FGT.Preempt.Title", by: "p1", pick: ["preempt"] });
    // The Luck Check's die, scripted only where one is rolled: the world fails an unrolled script.
    if (luckDie) w.dice.set("d20", luckDie);
    const { resolveAttack } = await import("../../module/engine/attack.mjs");
    await resolveAttack({ attackerId: MEDEA, abilityId: null, placement: { unitId: JACK, chosenIds: [JACK] } }).catch(() => null);
    await play(w, [...w.messages.values()].find((m) => m.getFlag?.("fgt", "preempt")));
  }, at(regions));
}

describe("the pre-emption's Luck Check reads Jack's panel (#134)", () => {
  it("is charged on a Night Round when Jack stands in sunlight, and the card says so", async () => {
    await attacked(sunlit, (w, card) => {
      expect(card, "the pre-emption's card").toBeTruthy();
      expect(card.getFlag("fgt", "preempt")).toMatchObject({
        unitId: JACK, against: MEDEA, phase: "day", check: { success: true, roll: 1, before: LUCK, after: LUCK - 1 },
      });
      expect(card.content).toMatch(/FGT\.Preempt\.Taken/);
      expect(card.content).toMatch(/FGT\.Preempt\.LuckPassed/);
      expect(w.actor(JACK).system.luck.value).toBe(LUCK - 1);
    }, { luckDie: 1 });
  }, 30_000);

  it("is not charged on a Night Round in the open, and the card says that too", async () => {
    await attacked([], (w, card) => {
      expect(card.getFlag("fgt", "preempt")).toMatchObject({ phase: "night", check: null });
      expect(card.content).toMatch(/FGT\.Preempt\.NoLuck/);
      expect(w.actor(JACK).system.luck.value).toBe(LUCK);
    });
  });
});
