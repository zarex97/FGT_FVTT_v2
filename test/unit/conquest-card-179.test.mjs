/**
 * @file A Conquest moves the Servant to its new Master's side, and says so (#179).
 * @see module/engine/io.mjs#resolveConquest, docs/32-relationships.md
 *
 * The faction write landed with #190. Pressed again 2026-10-19, it held: Yan
 * Qing, conquered by Saber's Master, stood in Blue's faction. And nothing told
 * anyone: the chat log read *"Master of Assassin of Red is defeated by Saber."*
 * and no more, so Player1 found their Servant on the other side's Turn.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const YQ = "yanQingConq00179", MR = "masterRedConq179", MEDEA = "medeaConquer0179", JACK = "jackConquer00179";
const MATCH = { tokens: true, combat: { round: 4, started: true, system: { globalTurn: 12 }, actingFactionId: "B" } };

/** Yan Qing under his Master, Red's; Medea, a Caster of Blue, at a distance `medeaJ`. */
const party = (medeaJ = 4) => [
  { from: "yan-qing", id: YQ, owner: "p1", panel: { i: 5, j: 6 }, state: { factionId: "A", masterId: MR, contract: "contracted" } },
  { from: "master-advanced", id: MR, owner: "p1", panel: { i: 5, j: 3 }, state: { factionId: "A", commandSpells: 2 } },
  { from: "medea", id: MEDEA, panel: { i: 5, j: medeaJ }, state: { factionId: "B" } },
  // A Servant of Blue whose Master is not on the board.
  { from: "jack-the-ripper", id: JACK, panel: { i: 4, j: 3 }, state: { factionId: "B" } },
];

async function kill(w, killerId) {
  const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
  const I = await import("../../module/engine/intents.mjs");
  await applyWorldIntents([I.defeat(MR, "damage", killerId)], "test");
}
const chat = (w) => [...w.messages.values()];

describe("a Conquest (#179)", () => {
  it("puts the Servant on the claimant's side, and its card follows the defeat card", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await kill(w, MEDEA);
      // The faction half, shipped with #190: Turn, owner and relations read it.
      expect(w.actor(YQ).system).toMatchObject({ masterId: MEDEA, contract: "contracted", factionId: "B" });
      const log = chat(w);
      const defeat = log.findIndex((m) => m.getFlag?.("fgt", "defeat")?.unitId === MR);
      const conquest = log.findIndex((m) => m.getFlag?.("fgt", "conquest"));
      expect(defeat, "the defeat card").toBeGreaterThan(-1);
      expect(conquest, "the Conquest card, after it").toBeGreaterThan(defeat);
      expect(log[conquest].getFlag("fgt", "conquest")).toMatchObject({ deadMasterId: MR, claimed: [YQ], declined: null });
      // The test world's i18n hands the key back; a public card, to everyone.
      expect(log[conquest].content).toMatch(/FGT\.Conquest\.Claimed/);
      expect(log[conquest].whisper ?? []).toEqual([]);
    }, MATCH);
  }, 30_000);

  it("says so when nobody may claim, and the Servant is not moved", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      // Jack kills him, and Jack has no Master on the board to claim anyone.
      await kill(w, JACK);
      const card = chat(w).find((m) => m.getFlag?.("fgt", "conquest"));
      expect(card, "the refusal's card").toBeTruthy();
      expect(card.getFlag("fgt", "conquest")).toMatchObject({ claimed: [], declined: "noMaster" });
      expect(w.actor(YQ).system.factionId).toBe("A");
    }, MATCH);
  });
});
