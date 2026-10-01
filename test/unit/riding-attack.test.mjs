/**
 * @file Riding Attack and Passenger Seat.
 * @see module/rules/movement.mjs, docs/05-board-geometry.md
 *
 * Both have been in `GRANTS` since grants were written, and **no engine ever
 * read either**. Medusa is the first Servant whose sheet needs them, and hers
 * are unlocked by Riding's Active rather than being permanent.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
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

  it("refuses a destination an enemy stands on", () => {
    // This pinned the opposite -- "includes whoever is standing on the
    // destination" -- while a drag refuses a panel anyone occupies (`canStopOn`).
    // The exemption the clause grants is for an enemy IN THE LINE, not for one on
    // the panel the ride ends on (#114).
    const end = unit("end", 5, 4);
    const out = ridingAttackPath(medusa, at(5, 4), board([medusa, end]), { movedAlready: 0 });
    expect(out).toMatchObject({ ok: false, reason: "cannotStop" });
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

describe("ridingAttackPath — the gates a drag and an attack both pass (#114)", () => {
  // Latent while nothing could start a ride (#113). A drag passes `validatePath`
  // (bounds, `canPassThrough`, `canStopOn`) and the pursuit and Decoy verdicts;
  // an attack passes the targeting resolver's filters. The ride passed neither.
  const rider = { ...medusa, panel: at(5, 10) };

  it("refuses a ride that ends off the board", () => {
    expect(ridingAttackPath(rider, at(5, 15), board([rider]), { movedAlready: 0 }))
      .toMatchObject({ ok: false, reason: "offBoard" });
  });

  it("refuses a destination an ally stands on", () => {
    const friend = unit("friend", 5, 6, { faction: "a", factionId: "a" });
    expect(ridingAttackPath(medusa, at(5, 6), board([medusa, friend]), { movedAlready: 0 }))
      .toMatchObject({ ok: false, reason: "cannotStop" });
  });

  it("rides THROUGH an enemy that is not on the destination, and hits it", () => {
    // *"Can Attack all Units in its path"* -- the point of the clause. A drag
    // would be stopped by the enemy; the ride is not.
    const x = unit("x", 5, 3);
    const out = ridingAttackPath(medusa, at(5, 4), board([medusa, x]), { movedAlready: 0 });
    expect(out.ok).toBe(true);
    expect(out.hits.map((u) => u.id)).toEqual(["x"]);
  });

  it("rides through an ally without hitting it", () => {
    const friend = unit("friend", 5, 3, { faction: "a", factionId: "a" });
    const out = ridingAttackPath(medusa, at(5, 4), board([medusa, friend]), { movedAlready: 0 });
    expect(out).toMatchObject({ ok: true, hits: [] });
  });

  describe("an enemy Master whose Servant stands within 2 of it", () => {
    const master = unit("mstr", 3, 5, { kind: "master" });
    const guard = unit("g", 3, 7);

    it("refuses a ride that ends beside it", () => {
      // (4,5) is within 1 of the Master at (3,5): `canPassThrough` says no.
      expect(ridingAttackPath({ ...medusa, panel: at(5, 5) }, at(4, 5), board([medusa, master, guard]), { movedAlready: 0 }))
        .toMatchObject({ ok: false, reason: "blocked" });
    });

    it("refuses a ride that passes through its zone and ends outside it", () => {
      // Along row 4 from (4,1) to (4,8): (4,4) to (4,6) are within 1 of (3,5).
      const out = ridingAttackPath({ ...medusa, panel: at(4, 1) }, at(4, 8), board([medusa, master, guard]), { movedAlready: 0 });
      expect(out).toMatchObject({ ok: false, reason: "blocked" });
    });

    it("lets it by once its Servant has left", () => {
      const lone = board([medusa, master]);
      expect(ridingAttackPath({ ...medusa, panel: at(4, 1) }, at(4, 8), lone, { movedAlready: 0 }).ok).toBe(true);
    });
  });

  it("refuses a ride that leaves a field its rider may not leave", () => {
    const sealed = {
      id: "duel", ownerId: "m", npTags: [],
      geometry: { kind: "fixedArea", shape: { kind: "square", size: 3 }, anchor: at(5, 2) },
      membership: { allyEntry: "free", enemyEntry: "free", allyExit: "sealed", enemyExit: "sealed" },
      isolation: {}, interior: [], vulnerabilities: [], state: {},
    };
    const b = { ...board([medusa]), fields: [sealed] };
    // (5,1) is inside the 3x3 about (5,2); (5,3) is inside too, (5,5) is out.
    expect(ridingAttackPath(medusa, at(5, 3), b, { movedAlready: 0 }).ok).toBe(true);
    expect(ridingAttackPath(medusa, at(5, 5), b, { movedAlready: 0 })).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("refuses a ride away from a Decoy, as a drag is", () => {
    const decoy = unit("d", 5, 0, { faction: "b", factionId: "b" });
    const pulled = { ...medusa, decoy: { sourceUnitId: "d" } };
    const away = ridingAttackPath(pulled, at(5, 5), board([pulled, decoy]), { movedAlready: 0 });
    expect(away.ok).toBe(false);
    expect(away.reason).toMatch(/cannot Move away/);
    expect(ridingAttackPath(pulled, at(4, 0), board([pulled, decoy]), { movedAlready: 0 }).ok).toBe(true);
  });

  it("refuses a Kagome Spirit's ride away from its prey, as a drag is", () => {
    const prey = unit("prey", 5, 9);
    const spirit = { ...medusa, panel: at(5, 5), pursuitTargetId: "prey" };
    expect(ridingAttackPath(spirit, at(5, 3), board([spirit, prey]), { movedAlready: 0 }).ok).toBe(false);
    expect(ridingAttackPath(spirit, at(5, 7), board([spirit, prey]), { movedAlready: 0 }).ok).toBe(true);
  });

  it("refuses a rider whose mount replaces her Move, so a ride cannot strand her off her deck", () => {
    // Ruled only half-way: *"Quetz's Move and Normal Attack is replaced with
    // Quetzalcoatlus'"*, but not what a Riding Attack is then. Refused with a
    // stated reason until the author rules (#114 item 4).
    const mount = { id: "mount", kind: "platform", level: 1, panel: at(5, 1), replacesRiderAction: { move: true, normalAttack: true, roles: ["owner"] } };
    const aboard = { ...medusa, level: 1, platformId: "mount", ownerId: undefined };
    const platform = { ...mount, ownerId: "m" };
    expect(ridingAttackPath(aboard, at(5, 4), board([aboard, platform]), { movedAlready: 0 }))
      .toMatchObject({ ok: false, reason: "mounted" });
  });

  describe("who it hits", () => {
    const x = unit("x", 5, 3);

    it("leaves a Unit on another Level alone, though it stands above the line", () => {
      const above = unit("above", 5, 3, { level: 1 });
      const out = ridingAttackPath(medusa, at(5, 6), board([medusa, above, x]), { movedAlready: 0 });
      expect(out.hits.map((u) => u.id)).toEqual(["x"]);
    });

    it("leaves a platform and a Structure alone: terrain, not a Unit in the path", () => {
      const hull = unit("hull", 5, 4, { kind: "platform", maxHealth: 500 });
      const wall = unit("wall", 5, 5, { kind: "structure" });
      const out = ridingAttackPath(medusa, at(5, 6), board([medusa, hull, wall, x]), { movedAlready: 0 });
      expect(out.hits.map((u) => u.id)).toEqual(["x"]);
    });

    it("catches a multi-panel Unit by any panel of its footprint, not only its corner", () => {
      const big = unit("big", 4, 3, { panels: [at(4, 3), at(4, 4), at(5, 3), at(5, 4)] });
      const out = ridingAttackPath(medusa, at(5, 6), board([medusa, big]), { movedAlready: 0 });
      expect(out.hits.map((u) => u.id)).toEqual(["big"]);
    });

    it("hits a Unit once, however many of its panels the line crosses", () => {
      const big = unit("big", 4, 3, { panels: [at(4, 3), at(4, 4), at(5, 3), at(5, 4)] });
      const out = ridingAttackPath(medusa, at(5, 6), board([medusa, big]), { movedAlready: 0 });
      expect(out.hits).toHaveLength(1);
    });

    it("passes everyone through the targeting resolver's filters: a protected Unit is not hit", () => {
      // Bašmu's aura -- *"Enemy Units cannot Attack Semiramis or her allied
      // Units if a Bašmu is next to them"* -- is read by `resolveTargets` at
      // step 8b, which `pathTargets` skipped.
      const shielded = unit("shielded", 5, 4, { untargetableBy: [{ source: "Bašmu" }] });
      const out = ridingAttackPath(medusa, at(5, 6), board([medusa, shielded, x]), { movedAlready: 0 });
      expect(out.hits.map((u) => u.id)).toEqual(["x"]);
    });
  });
});

describe("a ground rider and the Quetzalcoatlus (#114)", () => {
  beforeAll(prepareSubjects, 60_000);

  // *"Quetz or her Master cannot be targeted for an Attack while they are Riding
  // the Quetzalcoatlus."* The mount authors `crossLevel.occupantTargeting:
  // forbidden` and flies on Level 1. `pathTargets` matched Units by `i` and `j`
  // alone, so a rider on the ground hit whoever was aboard, and the mount.
  // Built through the real projection: the Levels, the platform and the grants
  // are all authored content.
  const scene = (quetz) => withSubjects([
    { from: "karna", id: "rider", state: { factionId: "red" }, panel: { i: 5, j: 1 } },
    { from: "quetzalcoatlus", id: "mount", state: { factionId: "blue" }, panel: { i: 5, j: 4, k: 1 } },
    { from: "quetzalcoatl", id: "quetz", state: { factionId: "blue" }, panel: quetz },
  ], ({ unit, board }) => ridingAttackPath(unit("rider"), { i: 5, j: 7 }, board));

  it("hits neither her nor the mount while she is aboard it", async () => {
    const out = await scene({ i: 5, j: 4, k: 1 });
    expect(out.ok).toBe(true);
    expect(out.hits.map((u) => u.id)).toEqual([]);
  });

  it("hits her once she stands on the ground in the line, which is the control", async () => {
    const out = await scene({ i: 5, j: 4 });
    expect(out.hits.map((u) => u.id)).toEqual(["quetz"]);
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
