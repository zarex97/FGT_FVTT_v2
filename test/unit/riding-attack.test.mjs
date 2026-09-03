/**
 * @file Riding Attack and Passenger Seat.
 * @see module/rules/movement.mjs, docs/08-board-and-geometry.md
 *
 * Both have been in `GRANTS` since grants were written, and **no engine ever
 * read either**. Medusa is the first Servant whose sheet needs them, and hers
 * are unlocked by Riding's Active rather than being permanent.
 */

import { describe, it, expect } from "vitest";
import { ridingAttackPath, passengerDestination } from "../../module/rules/movement.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });
const unit = (id, i, j, over = {}) =>
  ({ id, name: id, panel: at(i, j), kind: "servant", faction: "b", factionId: "b", ...over });

const medusa = { id: "m", name: "Medusa", panel: at(5, 1), mov: 7, kind: "servant", faction: "a", factionId: "a" };
const board = (units) => ({ bounds: squareBounds(13), units, alliances: { a: ["a"], b: ["b"] } });

describe("ridingAttackPath", () => {
  const x = unit("x", 5, 3);
  const y = unit("y", 5, 5);

  it("hits every enemy in a straight path, in path order", () => {
    // "Can Attack all Units in its path while Moving in a straight line."
    const out = ridingAttackPath(medusa, at(5, 6), board([medusa, x, y]), { movedAlready: 0 });
    expect(out.ok).toBe(true);
    expect(out.hits.map((u) => u.id)).toEqual(["x", "y"]);
  });

  it("includes whoever is standing on the destination", () => {
    const end = unit("end", 5, 4);
    const out = ridingAttackPath(medusa, at(5, 4), board([medusa, end]), { movedAlready: 0 });
    expect(out.hits.map((u) => u.id)).toEqual(["end"]);
  });

  it("does not hit an ally it rides past", () => {
    const friend = unit("friend", 5, 3, { faction: "a", factionId: "a" });
    const out = ridingAttackPath(medusa, at(5, 6), board([medusa, friend]), { movedAlready: 0 });
    expect(out.hits).toEqual([]);
  });

  it("does not hit a defeated unit, whose token is still on the board", () => {
    const corpse = unit("corpse", 5, 3, { defeated: true });
    const out = ridingAttackPath(medusa, at(5, 6), board([medusa, corpse]), { movedAlready: 0 });
    expect(out.hits).toEqual([]);
  });

  it("refuses a path that is not straight", () => {
    const out = ridingAttackPath(medusa, at(7, 6), board([medusa]), { movedAlready: 0 });
    expect(out).toMatchObject({ ok: false, reason: "notStraight" });
  });

  it("accepts an exact diagonal, which IS straight on a grid", () => {
    const diag = { ...medusa, panel: at(2, 2) };
    const out = ridingAttackPath(diag, at(5, 5), board([diag]), { movedAlready: 0 });
    expect(out.ok).toBe(true);
    expect(out.distance).toBe(3);
  });

  it("shortens by the distance already Moved", () => {
    // "the number of panels it can Move for its Riding Attack is equal to its
    // MOV minus the number of panels it has already Moved."
    const out = ridingAttackPath(medusa, at(5, 6), board([medusa]), { movedAlready: 4 });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/already Moved 4/);
  });

  it("reads the turn record when no allowance is passed", () => {
    const spent = { ...medusa, turnState: { movedPanels: 6 } };
    expect(ridingAttackPath(spent, at(5, 6), board([spent])).ok).toBe(false);
  });

  it("refuses standing still", () => {
    expect(ridingAttackPath(medusa, at(5, 1), board([medusa])).reason).toBe("noMovement");
  });
});

describe("passengerDestination", () => {
  it("moves the Master by the same delta, keeping its relative position", () => {
    // "after Moving, both Servant and Master must be in the same
    // orientation/position prior to the Move" -- the same RELATIVE position,
    // or the Master does not move at all and the clause says nothing.
    expect(passengerDestination(at(5, 5), at(5, 9), at(5, 4))).toEqual(at(5, 8));
  });

  it("carries a diagonal ride too", () => {
    expect(passengerDestination(at(5, 5), at(8, 8), at(4, 4))).toEqual(at(7, 7));
  });

  it("is null when the Master would land off the board", () => {
    const bounds = { iMin: 0, jMin: 0, iMax: 12, jMax: 12 };
    expect(passengerDestination(at(5, 1), at(5, 0), at(5, 0), bounds)).toBe(null);
  });

  it("is safe on missing input", () => {
    expect(passengerDestination(null, at(1, 1), at(1, 1))).toBe(null);
  });
});
