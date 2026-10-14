/**
 * @file A Round's end reads the Round that ended: no Home Base heal for a Master who fought in it (#199).
 * @see module/engine/board.mjs#currentBoard, module/domain/moment.mjs, docs/surprises/2026-10-12-round-end-read-next-rounds-records.md
 *
 * Pressed live on 2026-10-12: Serenity's Attack landed on Heracles's Master in
 * its Home Base in Round 9, and at Round 9's end E1 healed it 100 anyway. Its
 * `roundState` read `{round: 9, combatInBaseThisRound: true}`, but the Round's
 * end runs after `combat.round` has moved to 10, and the Board projected every
 * Unit at the live Round: the Round 9 record read as stale, so "it fought here"
 * read false. The only tests of the fix read `board.mjs` as text, or hand-built
 * the Unit the projection would have produced. This builds the real Master in
 * the real world at Round 10 and asks the Board for the Moment that ended.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { endOfRoundHomeBase } from "../../module/rules/environment.mjs";

beforeAll(prepareSubjects, 120_000);

const MASTER = "masterOfHeracles";
const zones = { red: { faction: "red", panels: [{ i: 0, j: 0 }] } };

const master = {
  from: "master-advanced",
  id: MASTER,
  panel: { i: 0, j: 0 },
  state: {
    factionId: "red",
    homeBase: { consecutiveRounds: 9 },
    roundState: { round: 9, abilitiesUsed: [], combatInBaseThisRound: true },
  },
};

/** Round 10 has begun; the end of Round 9 is running. */
const atRound10 = { tokens: true, combat: { round: 10, started: true, system: { globalTurn: 30 } } };

describe("the end of Round 9, run once the clock reads Round 10", () => {
  it("projects the Master at Round 9, where it fought in its base", async () => {
    await withSubjects([master], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { moment } = await import("../../module/domain/moment.mjs");
      const board = currentBoard({ moment: moment(9, 29), zones });
      const unit = board.units.find((u) => u.id === MASTER);
      expect(unit.homeBase.combatInBaseThisRound).toBe(true);
      expect(endOfRoundHomeBase(board.units, board).filter((o) => o.kind === "heal")).toEqual([]);
    }, atRound10);
  });

  it("while the live Board, at Round 10, rightly reads that Round's record as not yet written", async () => {
    await withSubjects([master], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const unit = currentBoard({ zones }).units.find((u) => u.id === MASTER);
      expect(unit.homeBase.combatInBaseThisRound).toBe(false);
    }, atRound10);
  });
});
