/**
 * @file Projecting an actor's position.
 * @see module/rules/snapshot.mjs
 *
 * A token's `x`/`y` are **pixels**. Reading them as grid offsets put two
 * adjacent tokens a hundred panels apart and made every attack report its
 * target out of range, so the projection is pinned here.
 */

import { describe, it, expect } from "vitest";
import { snapshotUnit, snapshotBoard } from "../../module/rules/snapshot.mjs";

/** A minimal actor. */
function actor(over = {}) {
  return {
    id: "a", uuid: "Actor.a", name: "Heracles", type: "servant",
    system: { factionId: "red", range: { panels: 1, targets: 1 }, ...(over.system ?? {}) },
    items: over.items ?? [],
    effects: over.effects ?? [],
    ...over,
  };
}

/** A token document at a pixel position, with the v14 offset API. */
function token({ x, y, offsets, elevation = 0 }) {
  return {
    x, y, elevation,
    getOccupiedGridSpaceOffsets: () => offsets ?? [],
  };
}

describe("panel projection", () => {
  it("uses the token's grid offsets, not its pixels", () => {
    const doc = token({ x: 1500, y: 1600, offsets: [{ i: 16, j: 15, k: 0 }] });
    expect(snapshotUnit(actor(), { token: doc }).panel).toEqual({ i: 16, j: 15, k: 0 });
  });

  it("puts two adjacent tokens one panel apart", () => {
    const left = snapshotUnit(actor(), { token: token({ x: 500, y: 600, offsets: [{ i: 6, j: 5 }] }) });
    const right = snapshotUnit(actor(), { token: token({ x: 600, y: 600, offsets: [{ i: 6, j: 6 }] }) });
    expect(Math.abs(left.panel.j - right.panel.j)).toBe(1);
    expect(left.panel.i).toBe(right.panel.i);
  });

  it("prefers an explicitly resolved panel over anything on the token", () => {
    const doc = token({ x: 1500, y: 1600, offsets: [{ i: 99, j: 99 }] });
    expect(snapshotUnit(actor(), { token: doc, panel: { i: 3, j: 4 } }).panel).toEqual({ i: 3, j: 4 });
  });

  it("carries a multi-panel unit's whole footprint", () => {
    const doc = token({ x: 0, y: 0, offsets: [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }, { i: 1, j: 1 }] });
    const unit = snapshotUnit(actor(), { token: doc });
    expect(unit.panels).toHaveLength(4);
    expect(unit.panel).toEqual({ i: 0, j: 0, k: undefined });
  });

  it("keeps a single-panel unit's `panels` as null rather than a one-item list", () => {
    const doc = token({ x: 0, y: 0, offsets: [{ i: 2, j: 2 }] });
    expect(snapshotUnit(actor(), { token: doc }).panels).toBeNull();
  });

  it("takes the level from the offset's k, not from elevation in feet", () => {
    const doc = token({ x: 0, y: 0, elevation: 20, offsets: [{ i: 1, j: 1, k: 2 }] });
    expect(snapshotUnit(actor(), { token: doc }).level).toBe(2);
  });

  it("falls back to the origin with no token, which is why callers resolve first", () => {
    expect(snapshotUnit(actor()).panel).toEqual({ i: 0, j: 0 });
  });

  it("falls back to the origin when the scene is gridless and returns no offsets", () => {
    expect(snapshotUnit(actor(), { token: token({ x: 640, y: 480, offsets: [] }) }).panel)
      .toEqual({ i: 0, j: 0 });
  });

  // The regression itself: pixels must never be read as offsets.
  it("never treats a pixel coordinate as a panel index", () => {
    const doc = token({ x: 1500, y: 1600, offsets: [{ i: 16, j: 15 }] });
    const unit = snapshotUnit(actor(), { token: doc });
    expect(unit.panel.i).not.toBe(1600);
    expect(unit.panel.j).not.toBe(1500);
  });
});

describe("snapshotBoard", () => {
  it("uses a pre-resolved snapshot when the caller supplies one", () => {
    const resolved = { id: "a", panel: { i: 7, j: 7 } };
    const board = snapshotBoard({ scene: null, actors: [{ actor: actor(), snapshot: resolved }] });
    expect(board.units[0]).toBe(resolved);
  });

  it("projects an actor itself when no snapshot is supplied", () => {
    const doc = token({ x: 0, y: 0, offsets: [{ i: 4, j: 5 }] });
    const board = snapshotBoard({ scene: null, actors: [{ actor: actor(), token: doc }] });
    expect(board.units[0].panel).toEqual({ i: 4, j: 5, k: undefined });
  });

  it("carries the alliance map through", () => {
    const board = snapshotBoard({
      scene: null, actors: [], settings: { alliances: { red: ["red", "blue"] } },
    });
    expect(board.alliances.red).toEqual(["red", "blue"]);
  });
});

describe("range projection", () => {
  it("is the panel count, not the schema object", () => {
    expect(snapshotUnit(actor({ system: { range: { panels: 3, targets: 2 } } })).range).toBe(3);
    expect(snapshotUnit(actor({ system: { range: { panels: 3, targets: 2 } } })).maxTargets).toBe(2);
  });

  it("accepts a bare number, for a hand-built fixture", () => {
    expect(snapshotUnit(actor({ system: { range: 4 } })).range).toBe(4);
  });

  it("defaults to 1 when unset", () => {
    expect(snapshotUnit(actor({ system: {} })).range).toBe(1);
  });
});
