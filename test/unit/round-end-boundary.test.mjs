/**
 * @file A whole Round boundary, played in the test world: the end of Round 9 reads Round 9.
 * @see module/engine/scheduler-hooks.mjs#onTurnChange, module/domain/moment.mjs, docs/04-time-model.md
 *
 * Foundry moves `combat.round` on before the end-of-Round sequence runs, so a
 * step that reads the live Round at a Round's end reads the NEXT one. The
 * Board and the Unit view take the boundary's Moment now; these play a real
 * Round boundary -- `combatRound`, the write, `combatTurnChange`, the system's
 * own scheduler -- and hold what the table sees to the Round that ended.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const MASTER = "masterOfHeracles";
const SERENITY = "serenityAttacker";

const subjects = [
  {
    from: "master-advanced", id: MASTER, panel: { i: 0, j: 0 },
    state: { factionId: "red", homeBase: { consecutiveRounds: 9 }, roundState: { round: 9, abilitiesUsed: [], combatInBaseThisRound: true } },
  },
  { from: "serenity", id: SERENITY, panel: { i: 5, j: 5 }, state: { factionId: "blue" } },
];

/** Round 9, the blue faction's Turn: the last of the Round. */
const round9 = {
  tokens: true,
  regions: [{ id: "hbRed", panels: [{ i: 0, j: 0 }], behaviors: [{ type: "homeBase", system: { factionId: "red" } }] }],
  combat: { round: 9, started: true, factions: ["red", "blue"], actingFactionId: "blue", system: { globalTurn: 29 } },
};

describe("the end of Round 9", () => {
  it("does not heal a Master who fought in its Home Base that Round (#199)", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      const master = w.actor(MASTER);
      await master.update({ "system.health.value": master.system.health.value - 100 });
      const before = master.system.health.value;
      await w.combat.passTurn({ to: "red", newRound: true });
      expect(w.combat.round).toBe(10);
      expect(master.system.health.value).toBe(before);
    }, round9);
  });

  it("is logged under Round 9", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      await w.combat.passTurn({ to: "red", newRound: true });
      const log = w.combat.system.log;
      const roundEnd = log.find((e) => e.detail?.kind === "roundEnd");
      expect(roundEnd).toMatchObject({ round: 9, globalTurn: 29 });
      const roundStart = log.find((e) => e.detail?.kind === "roundStart");
      expect(roundStart).toMatchObject({ round: 10, globalTurn: 30 });
    }, round9);
  });
});
