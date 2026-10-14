/**
 * @file The Unit view counts a ◈ lock in the world's own Round length.
 * @see module/engine/board.mjs#unitSnapshot, module/rules/snapshot.mjs#lockedAt
 *
 * Mad Enhancement's "2◈" toggle lockout is 6 Turns at three Turns a Round and
 * 16 at eight. `unitSnapshot` never passed the world's `turnsPerRound` to the
 * projection, which defaults to 3, so in a Holy Grail War world (8) every ◈ lock
 * and sustainability on a projected Unit was counted as if it were the Great
 * Holy Grail War's. Found while giving the Unit view its Moment (Wave A).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const ASTERIOS = "asteriosMinotaur";

describe("Mad Enhancement's 2◈ lockout, eight Turns a Round", () => {
  it("still holds ten Turns after the toggle", async () => {
    await withSubjects([{ from: "asterios", id: ASTERIOS, state: { factionId: "A" }, panel: { i: 3, j: 3 } }], async ({ world: w }) => {
      const mad = [...w.actor(ASTERIOS).items].find((i) => i.system.toggleLock);
      await mad.update({ "system.active": true, "system.toggledAt": 20 });
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const unit = currentBoard().units.find((u) => u.id === ASTERIOS);
      expect(unit.abilities.find((a) => a.id === mad.id).locked).toBe(true);
    }, { tokens: true, worldSettings: { turnsPerRound: 8 }, combat: { round: 4, started: true, system: { globalTurn: 30 } } });
  });
});
