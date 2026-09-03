/**
 * @file Where the caster is looking, and what is standing in the way.
 * @see module/rules/targeting/facing.mjs, docs/44-case-expanded-roster.md §44.3
 *
 * D44.8: *"No general line of sight; `requiresClearPath` is a per-ability
 * targeting predicate."* Medusa's Mystic Eyes is the only ability in the corpus
 * that asks either question.
 */

import { describe, it, expect } from "vitest";
import { facingAllows, pathClear } from "../../module/rules/targeting/facing.mjs";
import { panelsBetween } from "../../module/domain/geometry.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });
const unit = (id, i, j, over = {}) =>
  ({ id, name: id, panel: at(i, j), kind: "servant", faction: "b", factionId: "b", attributes: [], effects: [], ...over });

/* -------------------------------------------------------------------------- */

describe("panelsBetween", () => {
  it("yields the panels strictly between, on a row", () => {
    expect(panelsBetween(at(5, 2), at(5, 5))).toEqual([at(5, 3), at(5, 4)]);
  });

  it("does the same on a column", () => {
    expect(panelsBetween(at(2, 5), at(5, 5))).toEqual([at(3, 5), at(4, 5)]);
  });

  it("does the same on an exact diagonal", () => {
    expect(panelsBetween(at(2, 2), at(5, 5))).toEqual([at(3, 3), at(4, 4)]);
  });

  it("walks backwards as readily as forwards", () => {
    expect(panelsBetween(at(5, 5), at(5, 2))).toEqual([at(5, 4), at(5, 3)]);
  });

  it("is empty for adjacent panels — nothing can stand between them", () => {
    expect(panelsBetween(at(5, 2), at(5, 3))).toEqual([]);
    expect(panelsBetween(at(5, 2), at(5, 2))).toEqual([]);
  });

  it("is empty off the three axes, which have no 'between' to obstruct", () => {
    // The conservative reading, and the only one the sheet's single worked
    // example supports: there is no line of sight in this game to interpolate.
    expect(panelsBetween(at(0, 0), at(1, 5))).toEqual([]);
    expect(panelsBetween(at(0, 0), at(2, 3))).toEqual([]);
  });
});

describe("facingAllows", () => {
  // Screen coordinates: +i is south, +j is east. A north-facing caster looks
  // toward lower `i`.
  const medusa = (facing) => unit("m", 5, 5, { facing, faction: "a", factionId: "a" });

  it("allows a target the caster is facing", () => {
    expect(facingAllows(medusa("n"), unit("t", 3, 5))).toBe(true);
  });

  it("refuses one behind", () => {
    expect(facingAllows(medusa("n"), unit("t", 7, 5))).toBe(false);
  });

  it("refuses one to either side", () => {
    expect(facingAllows(medusa("n"), unit("t", 5, 8))).toBe(false);
    expect(facingAllows(medusa("n"), unit("t", 5, 2))).toBe(false);
  });

  it("follows a diagonal facing", () => {
    expect(facingAllows(medusa("ne"), unit("t", 3, 7))).toBe(true);
    expect(facingAllows(medusa("ne"), unit("t", 7, 3))).toBe(false);
  });

  it("lets a caster target itself, which is not a question about looking", () => {
    const self = medusa("n");
    expect(facingAllows(self, self)).toBe(true);
  });

  it("refuses an unplaced unit rather than guessing", () => {
    expect(facingAllows(medusa("n"), { id: "t" })).toBe(false);
  });
});

describe("pathClear", () => {
  // The sheet's own example is the specification:
  //   Unit [Cannot be targeted] - Unit [Can be targeted] - Medusa
  const medusa = unit("m", 5, 5, { faction: "a", factionId: "a" });
  const near = unit("near", 5, 6);
  const far = unit("far", 5, 7);

  it("allows the nearer unit", () => {
    expect(pathClear(medusa, near, { units: [medusa, near, far] })).toBe(true);
  });

  it("refuses the one behind it", () => {
    expect(pathClear(medusa, far, { units: [medusa, near, far] })).toBe(false);
  });

  it("blocks along a diagonal too", () => {
    const mid = unit("mid", 6, 6);
    const beyond = unit("beyond", 7, 7);
    expect(pathClear(medusa, beyond, { units: [medusa, mid, beyond] })).toBe(false);
    expect(pathClear(medusa, beyond, { units: [medusa, beyond] })).toBe(true);
  });

  it("is not blocked by a Civilian, who is a bystander and not cover", () => {
    const bystander = { ...near, kind: "civilian" };
    expect(pathClear(medusa, far, { units: [medusa, bystander, far] })).toBe(true);
  });

  it("is not blocked by a defeated unit, whose token stays on the board", () => {
    const corpse = { ...near, defeated: true };
    expect(pathClear(medusa, far, { units: [medusa, corpse, far] })).toBe(true);
  });

  it("is unrestricted off the three axes, which have no between", () => {
    const oblique = unit("oblique", 7, 8);
    expect(pathClear(medusa, oblique, { units: [medusa, near, oblique] })).toBe(true);
  });
});

describe("the resolver honours both limits", () => {
  const caster = {
    id: "m", name: "Medusa", panel: at(5, 5), kind: "servant",
    faction: "a", factionId: "a", range: 3, facing: "e",
  };
  const spec = (limits) => ({
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 3 },
    selection: { relations: ["enemy"], chooser: "all" },
    limits,
  });
  const board = (units) => ({ bounds: squareBounds(13), units, alliances: { a: ["a"], b: ["b"] } });

  it("drops a unit behind the caster, and says so", () => {
    const behind = unit("behind", 5, 3);
    const r = resolveTargets(spec({ requiresFacing: true }), caster, board([caster, behind]));
    expect(r.units.map((u) => u.unitId)).toEqual([]);
    expect(r.excluded.find((e) => e.unitId === "behind").reason).toMatch(/not facing it/);
  });

  it("keeps a unit in front", () => {
    const ahead = unit("ahead", 5, 7);
    const r = resolveTargets(spec({ requiresFacing: true }), caster, board([caster, ahead]));
    expect(r.units.map((u) => u.unitId)).toEqual(["ahead"]);
  });

  it("drops the far unit of a line and keeps the near one", () => {
    const near = unit("near", 5, 6);
    const far = unit("far", 5, 7);
    const r = resolveTargets(spec({ requiresClearPath: true }), caster, board([caster, near, far]));
    expect(r.units.map((u) => u.unitId)).toEqual(["near"]);
    expect(r.excluded.find((e) => e.unitId === "far").reason).toMatch(/in the way/);
  });

  it("applies neither limit when the ability does not ask", () => {
    const behind = unit("behind", 5, 3);
    const far = unit("far", 5, 7);
    const near = unit("near", 5, 6);
    const r = resolveTargets(spec({}), caster, board([caster, behind, near, far]));
    expect(r.units.map((u) => u.unitId).sort()).toEqual(["behind", "far", "near"]);
  });
});
