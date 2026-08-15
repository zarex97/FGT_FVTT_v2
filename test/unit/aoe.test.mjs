/**
 * @file The AoE fan-out — one Combat Process per defender.
 * @see docs/12-combat-process.md §12.10, docs/45-implementation-status.md A2
 *
 * The defect: `resolveAttack` took `targets.units[0]` and discarded the rest,
 * keeping them only long enough to set an `isAoE` flag. A Noble Phantasm that
 * hit seven units damaged one, and nothing said so — the card showed a correct
 * calculation against a correct target, and the other six vanished.
 */

import { describe, it, expect } from "vitest";
import { beginFanOut, advance, shouldUpdateFacing } from "../../module/engine/combat-process.mjs";

const attack = { abilityId: "np", kind: "np" };
const fanOf = (...ids) => beginFanOut({ attackerId: "atk", targetIds: ids, attack });

describe("beginFanOut", () => {
  it("produces one process per defender", () => {
    // The A2 gate: a 5x5 NP over four defenders is four processes, not one.
    expect(fanOf("d1", "d2", "d3", "d4")).toHaveLength(4);
  });

  it("gives each process its own defender, in target order", () => {
    expect(fanOf("d1", "d2", "d3").map((s) => s.defenderId)).toEqual(["d1", "d2", "d3"]);
  });

  it("marks every process as AoE when more than one unit is caught", () => {
    expect(fanOf("d1", "d2").every((s) => s.isAoE)).toBe(true);
  });

  it("does not mark a single-target attack as AoE", () => {
    // One defender caught by an area attack is still not an AoE resolution:
    // facing updates apply, and the card should not claim a fan-out.
    expect(fanOf("d1")[0].isAoE).toBe(false);
  });

  it("ties the processes together with one shared group id", () => {
    // The counter step resolves "sequentially in turn order" across the whole
    // fan-out, and the budget is spent once for the group — both need to know
    // which processes were one attack.
    const [a, b, c] = fanOf("d1", "d2", "d3");

    expect(a.groupId).toBeTruthy();
    expect(b.groupId).toBe(a.groupId);
    expect(c.groupId).toBe(a.groupId);
  });

  it("gives two separate attacks different group ids", () => {
    expect(fanOf("d1")[0].groupId).not.toBe(fanOf("d1")[0].groupId);
  });

  it("is empty when the attack caught nobody", () => {
    expect(fanOf()).toEqual([]);
  });

  it("lets one defender's ladder advance without touching the others", () => {
    // Each defender reacts independently (§12.10: "parallel prompt: all DUs
    // choose react"). States are values, so advancing one must not be visible
    // in another.
    const [first, second] = fanOf("d1", "d2");
    const moved = advance(first, "done");

    expect(moved.state).not.toBe(first.state);
    expect(second.state).toBe(first.state);
  });

  it("suppresses the facing update for a fanned-out process", () => {
    // "At the end of the Combat Process, the DU turns to face the AU.
    //  **Does not apply to AoE Attacks.**"
    const [aoe] = fanOf("d1", "d2");
    const [single] = fanOf("d1");

    expect(shouldUpdateFacing(aoe)).toBe(false);
    expect(shouldUpdateFacing(single)).toBe(true);
  });
});
