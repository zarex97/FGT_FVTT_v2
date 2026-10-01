/**
 * @file A Riding Attack that is refused changes nothing (#114).
 * @see module/engine/riding.mjs, module/engine/attack.mjs, docs/05-board-geometry.md
 *
 * `performRidingAttack` displaced the token and stamped `moved`, `acted` and
 * `usedRidingAttack` BEFORE `resolveAttack` ran its own gates, and those throw:
 * the first-Round ban, the 25-Health Master order limit, `canUseAbility` for a
 * Noble Phantasm ride. So in Round 1 a ride that reached somebody left the token
 * on its destination with `usedRidingAttack: true` and no attack at all.
 *
 * Run through the world model with real Units (`test/helpers/subject.mjs`): the
 * defect is in the order of the engine's own writes, which nothing above the
 * engine can see.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/**
 * Karna on the red side rides along row 5 from (5,2), past Emiya at (5,5).
 *
 * @param {number} round
 * @param {(ctx: {world: object, ride: Function, token: Function, turnState: Function}) => Promise<unknown>} fn
 */
const inRound = (round, fn) => withSubjects([
  { from: "karna", panel: { i: 5, j: 2 }, state: { factionId: "red" } },
  { from: "emiya", panel: { i: 5, j: 5 }, state: { factionId: "blue" } },
], async ({ world }) => {
  const { performRidingAttack } = await import("../../module/engine/riding.mjs");
  const token = () => {
    const { x, y } = world.tokens.get("token-karna");
    return { x, y };
  };
  const turnState = () => ({ ...world.actor("karna").system.turnState });
  return fn({
    world, token, turnState,
    ride: (destination = { i: 5, j: 7 }) => performRidingAttack({ unitId: "karna", destination }),
  });
}, {
  round,
  tick: round * 3,
  tokens: true,
  combat: { round, started: true, actingFactionId: "red", system: { globalTurn: round * 3 } },
  // The world's own settings the attack gates read.
  worldSettings: { noAttackRound: 1, grandOrder: false },
});

describe("a Riding Attack in the first Round, when nobody may attack", () => {
  it("is refused with the rule named, and the token stays where it was", async () => {
    await inRound(1, async ({ ride, token }) => {
      const before = token();
      const out = await ride();
      expect(out).toMatchObject({ ok: false });
      expect(out.reason).toMatch(/first Round/);
      expect(token()).toEqual(before);
    });
  });

  it("leaves the Turn Record as it was, so the Unit may still act", async () => {
    await inRound(1, async ({ ride, turnState }) => {
      const before = turnState();
      await ride();
      const after = turnState();
      expect(after.usedRidingAttack).toBeFalsy();
      expect(after.moved).toBeFalsy();
      expect(after.acted).toBeFalsy();
      expect(after.movedPanels ?? 0).toBe(0);
      expect(after).toEqual(before);
    });
  });
});

describe("a Riding Attack that reaches nobody, in a Round when it may be made", () => {
  it("moves the Unit and spends the Turn, as it did", async () => {
    // The control for the two above: the order is what changed, not the ride.
    await withSubjects([
      { from: "karna", panel: { i: 5, j: 2 }, state: { factionId: "red" } },
    ], async ({ world }) => {
      const { performRidingAttack } = await import("../../module/engine/riding.mjs");
      const out = await performRidingAttack({ unitId: "karna", destination: { i: 5, j: 7 } });
      expect(out).toMatchObject({ ok: true, hit: [] });
      expect(world.tokens.get("token-karna")).toMatchObject({ x: 700, y: 500 });
      expect(world.actor("karna").system.turnState).toMatchObject({
        moved: true, acted: true, attacked: true, usedRidingAttack: true, movedPanels: 5,
      });
    }, {
      round: 2,
      tick: 6,
      tokens: true,
      combat: { round: 2, started: true, actingFactionId: "red", system: { globalTurn: 6 } },
      worldSettings: { noAttackRound: 1, grandOrder: false },
    });
  });
});
