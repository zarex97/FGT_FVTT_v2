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
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

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

/* ========================================================================== */
/*  Xiuhcoatl's second resolution                                             */
/* ========================================================================== */

/**
 * > *"Then (regardless of whether the NP hits the DU or not), deals normal
 * > damage to all Units within a 2 panel area of Quetzalcoatl **except herself
 * > and the previously targeted Unit**..."*
 *
 * Not an area attack with a hole in it: a separate resolution, from a different
 * anchor, on a different base attack, at a different multiplier. `includeSelf:
 * false` already drops the caster; this drops the anchor of the resolution that
 * came first, which only a second resolution has.
 */
describe("excludePrimaryTarget", () => {
  const at = (i, j) => ({ i, j });
  const quetz = { id: "quetz", name: "Quetzalcoatl", kind: "servant", factionId: "a", panel: at(6, 6) };
  const primary = { id: "primary", name: "Primary", kind: "servant", factionId: "b", panel: at(6, 7) };
  const bystander = { id: "bystander", name: "Bystander", kind: "servant", factionId: "b", panel: at(5, 6) };
  const board = {
    bounds: squareBounds(13),
    units: [quetz, primary, bystander],
    alliances: { a: ["a"], b: ["b"] },
  };
  const splash = (over = {}) => ({
    anchor: { kind: "self" },
    shape: { kind: "square", size: 5 },
    selection: {
      relations: ["enemy", "ally", "neutral"], includeSelf: false, chooser: "all", ...over,
    },
  });

  it("drops the anchor of the first resolution from the second", () => {
    const out = resolveTargets(splash({ excludePrimaryTarget: true }), quetz, board, {
      primaryTargetId: "primary",
    });
    expect(out.units.map((t) => t.unitId)).toEqual(["bystander"]);
  });

  it("keeps the primary when the filter is absent", () => {
    const out = resolveTargets(splash(), quetz, board, { primaryTargetId: "primary" });
    expect(out.units.map((t) => t.unitId).sort()).toEqual(["bystander", "primary"]);
  });

  it("is inert when no primary was recorded", () => {
    const out = resolveTargets(splash({ excludePrimaryTarget: true }), quetz, board, {});
    expect(out.units.map((t) => t.unitId).sort()).toEqual(["bystander", "primary"]);
  });

  it("never catches the caster, primary or not", () => {
    const out = resolveTargets(splash({ excludePrimaryTarget: true }), quetz, board, {
      primaryTargetId: "primary",
    });
    expect(out.units.map((t) => t.unitId)).not.toContain("quetz");
  });
});
