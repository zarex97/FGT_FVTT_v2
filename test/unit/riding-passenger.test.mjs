/**
 * @file A Riding Attack carries the Master along (#115).
 * @see module/engine/passenger-seat.mjs, module/engine/riding.mjs, docs/05-board-geometry.md
 *
 * Every Riding sheet says the ride *"Can be combined with Passenger Seat"*. It
 * could not be. The Master was carried by `movement-hooks.mjs#carryMaster`, which
 * runs from the `moveToken` hook, and that hook returns for any forced move
 * before it reaches the carry -- while `performRidingAttack` moves the token with
 * `displaceToken`, which is forced. Nothing else called the carry.
 *
 * Run through the world model with real Units (`test/helpers/subject.mjs`): the
 * defect is that two engine paths never met, which only running both can show.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

// A DocumentId is sixteen alphanumerics; the Servant's `masterId` holds one.
const MASTER = "MasterAAAAAAAAAA";

/**
 * Karna at (5,5) on the red side, her Master two panels behind her at (5,3), and
 * the ride is made four panels along row 5.
 *
 * @param {object} servantState what the Servant's own document holds
 * @param {(ctx: object) => Promise<unknown>} fn
 */
const rideWith = (servantState, fn) => withSubjects([
  { from: "karna", id: "karna", panel: { i: 5, j: 5 }, state: { factionId: "red", masterId: MASTER, ...servantState } },
  { from: "master-advanced", id: MASTER, panel: { i: 5, j: 3 }, state: { factionId: "red" } },
], async ({ world }) => {
  const { performRidingAttack } = await import("../../module/engine/riding.mjs");
  const at = (id) => {
    const { x, y } = world.tokens.get(`token-${id}`);
    return { i: y / 100, j: x / 100 };
  };
  return fn({
    world, at,
    ride: (destination = { i: 5, j: 9 }) => performRidingAttack({ unitId: "karna", destination }),
    entries: () => (world.combat.getFlag("fgt", "log") ?? []).filter((e) => e.kind === "passengerSeat"),
    master: () => world.actor(MASTER).system,
  });
}, {
  round: 2,
  tick: 6,
  tokens: true,
  combat: { round: 2, started: true, actingFactionId: "red", system: { globalTurn: 6 } },
  worldSettings: { noAttackRound: 1, grandOrder: false },
});

describe("a Riding Attack made with Passenger Seat", () => {
  it("carries the Master by the same delta, with one log entry and no pool spent", async () => {
    await rideWith({}, async ({ ride, at, entries, master }) => {
      const out = await ride();
      expect(out).toMatchObject({ ok: true });
      expect(at("karna")).toEqual({ i: 5, j: 9 });
      // Two panels behind her, and still two behind her.
      expect(at(MASTER)).toEqual({ i: 5, j: 7 });
      expect(entries()).toHaveLength(1);
      expect(entries()[0]).toMatchObject({
        unitId: MASTER, carriedBy: "karna", from: { i: 5, j: 3 }, to: { i: 5, j: 7 },
      });
      // *"Counts as only Moving one Unit"*: the Master did not Move, he was
      // carried, so his own record is untouched.
      expect(master().turnState?.moved ?? false).toBe(false);
      expect(master().turnState?.movedPanels ?? 0).toBe(0);
    });
  });

  it("leaves him where he was when the switch is off", async () => {
    await rideWith({ carriesMaster: false }, async ({ ride, at, entries }) => {
      await ride();
      expect(at("karna")).toEqual({ i: 5, j: 9 });
      expect(at(MASTER)).toEqual({ i: 5, j: 3 });
      expect(entries()).toEqual([]);
    });
  });

  it("carries a Master who stands directly behind her, where a drag at moveToken could not", async () => {
    // One move-length behind: the landing is the Servant's own origin, which the
    // board still reports her on at `moveToken` (#118). After a ride the document
    // has caught up (`displaceToken` passes `animate: false`), so this is judged
    // against the board as it now is.
    await withSubjects([
      { from: "karna", id: "karna", panel: { i: 5, j: 5 }, state: { factionId: "red", masterId: MASTER } },
      { from: "master-advanced", id: MASTER, panel: { i: 5, j: 4 }, state: { factionId: "red" } },
    ], async ({ world }) => {
      const { performRidingAttack } = await import("../../module/engine/riding.mjs");
      await performRidingAttack({ unitId: "karna", destination: { i: 5, j: 6 } });
      const { x } = world.tokens.get(`token-${MASTER}`);
      expect(x / 100).toBe(5);
    }, {
      round: 2, tick: 6, tokens: true,
      combat: { round: 2, started: true, actingFactionId: "red", system: { globalTurn: 6 } },
      worldSettings: { noAttackRound: 1, grandOrder: false },
    });
  });
});

describe("the carry, as a single function with two callers", () => {
  it("is exported from passenger-seat.mjs, which movement-hooks.mjs and riding.mjs both call", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("module/engine/riding.mjs", "utf8")).toMatch(/carryMasterAlong\(/);
    expect(readFileSync("module/engine/movement-hooks.mjs", "utf8")).toMatch(/carryMasterAlong\(/);
    const seat = await import("../../module/engine/passenger-seat.mjs");
    expect(typeof seat.carryMasterAlong).toBe("function");
  });
});
