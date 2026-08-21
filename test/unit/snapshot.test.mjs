/**
 * @file Projecting an actor's position.
 * @see module/rules/snapshot.mjs
 *
 * A token's `x`/`y` are **pixels**. Reading them as grid offsets put two
 * adjacent tokens a hundred panels apart and made every attack report its
 * target out of range, so the projection is pinned here.
 */

import { describe, it, expect } from "vitest";
import { snapshotUnit, snapshotBoard, turnStateAt } from "../../module/rules/snapshot.mjs";
import { remainingMovement, segmentCheck } from "../../module/rules/movement.mjs";

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

describe("turn state expires by tick, not by being cleared", () => {
  const spent = {
    tick: 4, acted: true, moved: true, attacked: true,
    movedPanels: 7, moveSegments: 3, usedRidingAttack: true,
  };

  it("keeps the state while the tick it was written on is current", () => {
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: 4 });
    expect(unit.turnState.movedPanels).toBe(7);
    expect(unit.turnState.attacked).toBe(true);
  });

  it("reads blank once the turn has moved on", () => {
    // The bug this replaces: the state was cleared by *writing* a blank one at
    // each turn boundary, so one hook that did not fire left a Unit with
    // "0 remain of MOV 7" for the rest of the match. Staleness is decided on
    // read now, so no write has to succeed for the turn to end.
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: 5 });
    expect(unit.turnState.movedPanels).toBe(0);
    expect(unit.turnState.attacked).toBe(false);
    expect(unit.turnState.usedRidingAttack).toBe(false);
    expect(unit.acted).toBe(false);
  });

  it("treats state written before the stamp existed as stale", () => {
    const legacy = { acted: true, moved: true, movedPanels: 7 };
    expect(snapshotUnit(actor({ system: { turnState: legacy } }), { tick: 0 }).turnState.movedPanels)
      .toBe(0);
  });

  it("leaves the state alone out of combat, where there are no ticks", () => {
    // `tick: null` means the rule does not apply: a GM arranging the board
    // between matches should not have a Unit's state silently forgotten.
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: null });
    expect(unit.turnState.movedPanels).toBe(7);
  });

  it("expires every field together, so nothing survives its turn", () => {
    const unit = snapshotUnit(actor({ system: { turnState: spent } }), { tick: 99 });
    expect(unit.turnState).toMatchObject({
      acted: false, moved: false, attacked: false, movedPanels: 0,
      moveSegments: 0, usedActiveSkill: false, mayMoveAgain: false, usedRidingAttack: false,
    });
  });
});

describe("turnStateAt is what movement reads", () => {
  it("restores the full MOV allowance on the next tick", () => {
    const walked = { tick: 2, moved: true, movedPanels: 7 };
    const stale = turnStateAt(walked, 3);
    expect(remainingMovement({ mov: 7, turnState: stale })).toBe(7);
    expect(segmentCheck({ mov: 7, turnState: stale })).toBeNull();
  });

  it("still refuses while the same tick is current", () => {
    const walked = { tick: 2, moved: true, movedPanels: 7 };
    const fresh = turnStateAt(walked, 2);
    expect(remainingMovement({ mov: 7, turnState: fresh })).toBe(0);
    expect(segmentCheck({ mov: 7, turnState: fresh })).toMatch(/spent all 7 panels/);
  });
});

describe("turnStateAt", () => {
  it("projects which abilities went, which every same-Turn rule depends on", () => {
    // Absent from the projection until Scáthach's `oncePerTurn` needed it, so
    // every snapshot reader of the turn record saw `undefined`: the gate never
    // refused, and `reactionAbilities` offered a Skill whose same-Turn partner
    // had already been used.
    const projected = turnStateAt({ tick: 7, abilitiesUsed: ["medea-keraino"], itemTransfers: 1 }, 7);
    expect(projected.abilitiesUsed).toEqual(["medea-keraino"]);
    expect(projected.itemTransfers).toBe(1);
  });

  it("blanks the list when the record is stale, rather than leaving it undefined", () => {
    // The safe direction, and the reason turn state is stale-by-tick: a Servant
    // must never be permanently unable to use half its Skills because one
    // reset hook did not fire.
    const stale = turnStateAt({ tick: 3, abilitiesUsed: ["medea-keraino"] }, 7);
    expect(stale.abilitiesUsed).toEqual([]);
  });
});

describe("sustainability", () => {
  const actor = (system) => ({ id: "s", name: "S", type: "servant", items: [], effects: [], system });

  it("projects a NUMBER of turns, not the authored ◈ expression", () => {
    // Four rules-layer readers do arithmetic on this. The document holds "2◈",
    // so `cannotPay` compared `"2◈" > 5`, `checkRemovals` computed `"2◈" - 1`,
    // and `onMasterDefeated` wrote `Math.max(0, NaN)`. A Free Servant could
    // never pay for a Noble Phantasm and never ran out of time.
    const snap = snapshotUnit(actor({ sustainability: "2◈" }), { turnsPerRound: 3 });

    expect(snap.sustainability).toBe(6);
    expect(snap.sustainabilityMax).toBe("2◈");
  });

  it("resolves against the world's turns per Round", () => {
    expect(snapshotUnit(actor({ sustainability: "2◈" }), { turnsPerRound: 8 }).sustainability).toBe(16);
  });

  it("prefers what is left once something has been spent", () => {
    const snap = snapshotUnit(
      actor({ sustainability: "2◈", sustainabilityRemaining: 4 }), { turnsPerRound: 3 },
    );
    expect(snap.sustainability).toBe(4);
  });

  it("reads a spent clock as zero rather than as absent", () => {
    // Zero is "about to disappear"; null is "has no clock at all". Conflating
    // them makes a Servant out of time immortal.
    const snap = snapshotUnit(
      actor({ sustainability: "2◈", sustainabilityRemaining: 0 }), { turnsPerRound: 3 },
    );
    expect(snap.sustainability).toBe(0);
  });

  it("keeps null meaning no clock at all — Independent Action A+/EX", () => {
    expect(snapshotUnit(actor({ sustainability: null })).sustainability).toBe(null);
  });
});
