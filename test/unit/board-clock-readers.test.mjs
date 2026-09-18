/**
 * @file Every clock reader in `engine/board.mjs` asks the same match.
 * @see module/engine/board.mjs, test/helpers/world.mjs, #42
 *
 * Foundry keeps two names for a Combat and they mean different things:
 * `game.combats.active` is the match being **played**, `game.combat` is the
 * tracker being **viewed**. This file had readers of both, twenty lines apart:
 *
 *   - `currentTick()` / `currentRound()` read the active one, and `gateContext`
 *     carries a comment explaining why ("this read the tick of whatever tracker
 *     happened to be on screen and disagreed with every other clock reader in
 *     the system").
 *   - `turnRecordOf`, `roundRecordOf` and `currentWarRegion` read the viewed
 *     one.
 *
 * So with any second Combat open, one stored Turn Record had two projections —
 * `skill-use#usedThisTurn` and `items#transfersThisTurn` got one, `unitSnapshot`
 * and `snapshotBoard` got the other — and a board snapshot carried a war Region
 * from a different match than its own war type and ruleset. A Region is worth a
 * rank on every parameter and +10 Base Attack per step (Ch. 46 §46.4-AO).
 *
 * `test/helpers/world.mjs` pointed both names at one object, which is why no
 * test could see any of it; `spec.viewedCombat` is what separates them.
 */

import { describe, it, expect } from "vitest";
import { withWorld } from "../helpers/world.mjs";

const servant = (turnState, roundState) => ({
  id: "asterios",
  name: "Asterios",
  type: "servant",
  system: {
    parameters: { str: "A++", end: "A++", agi: "C", mag: "D", luc: "E" },
    turnState,
    roundState,
  },
});

/** A match at tick 9 / Round 3, with a *different* tracker open on tick 0. */
const twoCombats = (over = {}) => ({
  actors: [servant(
    { tick: 9, acted: true, abilitiesUsed: ["asterios-avyssos-of-labrys"], itemTransfers: 2 },
    { round: 3, abilitiesUsed: ["karna-uncrowned-arms-mastership"] },
  )],
  tokens: [{ id: "t1", actorId: "asterios" }],
  combat: { started: true, round: 3, system: { globalTurn: 9, region: "greece" } },
  viewedCombat: { started: true, round: 1, system: { globalTurn: 0, region: "japan" } },
  settings: { region: "" },
  ...over,
});

async function board() {
  return import("../../module/engine/board.mjs");
}

describe("the clock readers agree with each other", () => {
  it("projects a Turn Record against the match being PLAYED", async () => {
    await withWorld(twoCombats(), async (w) => {
      const { turnRecordOf, currentTick } = await board();
      const record = turnRecordOf(w.actor("asterios"));

      expect(currentTick()).toBe(9);
      // Read against the viewed combat's tick 0 the record is stale, and every
      // field blanks: the Servant would have read as not having acted, with no
      // abilities used and no item transfers spent.
      expect(record.tick).toBe(9);
      expect(record.acted).toBe(true);
      expect(record.abilitiesUsed).toEqual(["asterios-avyssos-of-labrys"]);
      expect(record.itemTransfers).toBe(2);
    });
  });

  it("projects a Round Record against the same match", async () => {
    await withWorld(twoCombats(), async (w) => {
      const { roundRecordOf, currentRound } = await board();
      const record = roundRecordOf(w.actor("asterios"));

      expect(currentRound()).toBe(3);
      expect(record.round).toBe(3);
      expect(record.abilitiesUsed).toEqual(["karna-uncrowned-arms-mastership"]);
    });
  });

  it("reads the war Region off the same match as the rest of the board", async () => {
    await withWorld(twoCombats(), async () => {
      const { currentWarRegion } = await board();
      expect(currentWarRegion()).toBe("greece");
    });
  });

  it("still falls back to the world setting when the match names no Region", async () => {
    // The fallback `commitWar` now keeps in step (Ch. 46 §46.4-AO) — the match
    // is authoritative, and the setting answers only when it says nothing.
    await withWorld(twoCombats({
      combat: { started: true, round: 3, system: { globalTurn: 9, region: null } },
      settings: { region: "ireland" },
    }), async () => {
      const { currentWarRegion } = await board();
      expect(currentWarRegion()).toBe("ireland");
    });
  });

  it("applies no staleness at all before the match starts", async () => {
    // `currentTick()` returns null out of a started match on purpose: with no
    // turns there is nothing to be stale against, and a GM arranging the board
    // should not have it silently forgotten. `?? 0` blanked exactly that case.
    await withWorld({
      actors: [servant({ tick: 4, acted: true, abilitiesUsed: [], itemTransfers: 0 }, { round: 2 })],
      tokens: [{ id: "t1", actorId: "asterios" }],
      combat: { started: false, round: 0, system: { globalTurn: 0 } },
      settings: { region: "" },
    }, async (w) => {
      const { turnRecordOf, roundRecordOf, currentTick, currentRound } = await board();

      expect(currentTick()).toBe(null);
      expect(currentRound()).toBe(null);
      expect(turnRecordOf(w.actor("asterios")).acted).toBe(true);
      expect(roundRecordOf(w.actor("asterios")).round).toBe(2);
    });
  });
});
