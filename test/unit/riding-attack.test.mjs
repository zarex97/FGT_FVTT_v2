/**
 * @file Riding Attack and Passenger Seat.
 * @see module/rules/movement.mjs, docs/05-board-geometry.md
 *
 * Both have been in `GRANTS` since grants were written, and **no engine ever
 * read either**. Medusa is the first Servant whose sheet needs them, and hers
 * are unlocked by Riding's Active rather than being permanent.
 */

import { describe, it, expect } from "vitest";
import { ridingAttackPath, ridingDestinations, passengerDestination } from "../../module/rules/movement.mjs";
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

describe("ridingDestinations (#113)", () => {
  // The overlay a player picks a ride's end from, and the engine that judges it,
  // must be one rule: two readers of one rule drift (Ch. 46 §46.3), and an
  // overlay that offers a panel the engine then refuses is the silent no-op the
  // action bar was built to stop.
  const key = (p) => `${p.i},${p.j}`;

  /** Every in-bounds panel on one of the eight lines, up to `allowance` away, by brute force. */
  const brute = (from, allowance, size = 13) => {
    const out = [];
    for (let i = 0; i < size; i += 1) {
      for (let j = 0; j < size; j += 1) {
        const di = i - from.i; const dj = j - from.j;
        const d = Math.max(Math.abs(di), Math.abs(dj));
        const straight = di === 0 || dj === 0 || Math.abs(di) === Math.abs(dj);
        if (d >= 1 && d <= allowance && straight) out.push({ i, j });
      }
    }
    return out;
  };

  it("is exactly the straight-line panels within MOV minus the panels already Moved", () => {
    const panels = ridingDestinations(medusa, board([medusa]));
    expect(panels.map(key).sort()).toEqual(brute(medusa.panel, 7).map(key).sort());
    expect(panels).toHaveLength(34);
  });

  it("has ridingAttackPath accept every one of them, and refuse one panel further", () => {
    const b = board([medusa]);
    for (const panel of ridingDestinations(medusa, b)) {
      expect(ridingAttackPath(medusa, panel, b).ok, key(panel)).toBe(true);
    }
    // MOV 7 from (5,1): (5,8) is the last panel east, (5,9) is one further.
    expect(ridingAttackPath(medusa, at(5, 8), b).ok).toBe(true);
    expect(ridingAttackPath(medusa, at(5, 9), b).ok).toBe(false);
  });

  it("shortens by the panels already Moved", () => {
    const spent = { ...medusa, turnState: { movedPanels: 4 } };
    const panels = ridingDestinations(spent, board([spent]));
    expect(panels.map(key).sort()).toEqual(brute(medusa.panel, 3).map(key).sort());
  });

  it("takes the ability's own distance when it states one, as Troias Tragōidia does", () => {
    // *"This NP is used in the form of a Riding Attack, with a distance of 13
    // panels"* -- MOV is not what bounds it.
    const panels = ridingDestinations(medusa, board([medusa]), { distanceOverride: 13 });
    expect(panels.map(key).sort()).toEqual(brute(medusa.panel, 13).map(key).sort());
    expect(panels.length).toBeGreaterThan(34);
  });

  it("offers nothing to a Unit with no allowance left, or no panel", () => {
    const spent = { ...medusa, turnState: { movedPanels: 7 } };
    expect(ridingDestinations(spent, board([spent]))).toEqual([]);
    expect(ridingDestinations({ ...medusa, panel: null }, board([medusa]))).toEqual([]);
  });

  it("never offers a panel off the board", () => {
    const corner = { ...medusa, panel: at(0, 0) };
    for (const panel of ridingDestinations(corner, board([corner]))) {
      expect(panel.i).toBeGreaterThanOrEqual(0);
      expect(panel.j).toBeGreaterThanOrEqual(0);
      expect(panel.i).toBeLessThanOrEqual(12);
      expect(panel.j).toBeLessThanOrEqual(12);
    }
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
