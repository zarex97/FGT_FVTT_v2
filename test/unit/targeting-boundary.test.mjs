/**
 * @file What the resolver says when it says no.
 * @see module/rules/targeting/resolve.mjs, docs/28-targeting-implementation.md §28.6
 *
 * `test/unit/snapshot.test.mjs` pins the position projection. This pins the
 * other half of the same failure: a target list that came back empty used to
 * say only that it was empty, so a unit dropped by a filter was indistinguishable
 * from a unit that had never been in the area. Every exclusion now carries the
 * reason it was excluded, recorded where the decision is made.
 *
 * Also covers board bounds, which are derived from the scene rather than from
 * the `boardSize` setting: a scene bigger than the setting used to clip every
 * unit past the last row out of every shape, silently.
 */

import { describe, it, expect } from "vitest";
import { snapshotBoard } from "../../module/rules/snapshot.mjs";
import { resolveTargets, legalPlacements } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });

function unit(id, name, panel, over = {}) {
  return {
    id, name, panel, kind: "servant", faction: "red", factionId: "red",
    attributes: [], effects: [], servantClasses: ["saber"], contract: "free", ...over,
  };
}

function boardWith(units, over = {}) {
  return { bounds: squareBounds(13), units, alliances: {}, ...over };
}

/** An area centred on the caster, wide enough to catch its neighbours. */
const AREA = {
  anchor: { kind: "self" },
  shape: { kind: "chebyshevRadius", r: 2 },
  selection: { relations: ["enemy"], chooser: "all" },
};

/* -------------------------------------------------------------------------- */

/** Everything dropped except the caster excluding itself from its own AoE. */
const others = (r) => r.excluded.filter((e) => e.unitId !== "me");

describe("exclusion reasons", () => {
  it("names an ally and says which faction made it one", () => {
    const me = unit("me", "Heracles", at(6, 6));
    const ally = unit("ally", "Karna", at(6, 7));
    const r = resolveTargets(AREA, me, boardWith([me, ally]));

    expect(others(r)).toEqual([
      { unitId: "ally", name: "Karna", reason: expect.stringContaining("an ally") },
    ]);
    expect(r.errors[0]).toMatch(/No legal targets: Karna is an ally/);
  });

  it("points an unassigned faction at the roster, which is where it is fixed", () => {
    const me = unit("me", "Heracles", at(6, 6));
    const nobody = unit("x", "Unassigned", at(6, 7), { faction: null, factionId: null });
    const r = resolveTargets(AREA, me, boardWith([me, nobody]));
    expect(others(r)[0].reason).toMatch(/no Faction — assign one in the faction roster/);
  });

  it("explains a Civilian, which is neutral by kind", () => {
    const me = unit("me", "Heracles", at(6, 6));
    const bystander = unit("c", "Bystander", at(6, 7), { kind: "civilian" });
    expect(others(resolveTargets(AREA, me, boardWith([me, bystander])))[0].reason)
      .toMatch(/Civilian/);
  });

  it("explains a Master shielded by an adjacent Servant of its own faction", () => {
    const me = unit("me", "Heracles", at(6, 6), { faction: "red", factionId: "red" });
    const foe = unit("m", "Enemy Master", at(6, 7), { kind: "master", faction: "blue", factionId: "blue" });
    const guard = unit("g", "Guard", at(6, 8), { faction: "blue", factionId: "blue" });
    const r = resolveTargets(AREA, me, boardWith([me, foe, guard]));

    expect(r.excluded.find((e) => e.unitId === "m").reason).toMatch(/protected by an adjacent Servant/);
    expect(r.units.map((u) => u.unitId)).toEqual(["g"]);
  });

  it("explains a unit excluded by the ability's own predicate", () => {
    const me = unit("me", "Heracles", at(6, 6));
    const foe = unit("f", "Karna", at(6, 7), { faction: "blue", factionId: "blue" });
    const spec = { ...AREA, selection: { ...AREA.selection, attributes: ["target:attribute:divine"] } };
    expect(others(resolveTargets(spec, me, boardWith([me, foe])))[0].reason)
      .toMatch(/target predicate/);
  });

  it("counts the remainder instead of listing every one", () => {
    const me = unit("me", "Heracles", at(6, 6));
    const allies = [at(6, 7), at(5, 6), at(7, 6)].map((p, n) => unit(`a${n}`, `Ally ${n}`, p));
    const r = resolveTargets(AREA, me, boardWith([me, ...allies]));
    expect(others(r)).toHaveLength(3);
    expect(r.errors[0]).toMatch(/and 2 more excluded/);
  });

  it("does not let the caster's own exclusion masquerade as a diagnosis", () => {
    // Every AoE excludes its caster. That is not why the list is empty, so it
    // is listed for the preview and never quoted in the error.
    const me = unit("me", "Heracles", at(6, 6));
    const r = resolveTargets(AREA, me, boardWith([me]));
    expect(r.errors).toEqual(["No legal targets in the selected area."]);
    expect(r.excluded.map((e) => e.unitId)).toEqual(["me"]);
  });

  it("reports nothing excluded when the area really was empty", () => {
    const me = unit("me", "Heracles", at(0, 0));
    const far = unit("f", "Karna", at(12, 12), { faction: "blue", factionId: "blue" });
    const r = resolveTargets(AREA, me, boardWith([me, far]));
    // Karna was never in the area, so there is nothing to explain about it --
    // which is the case that still gets the plain message.
    expect(others(r)).toEqual([]);
    expect(r.errors).toEqual(["No legal targets in the selected area."]);
  });
});

describe("the attacker's own narrowing, from the confirmation dialog", () => {
  const board = () => {
    const me = unit("me", "Heracles", at(6, 6), { faction: "red", factionId: "red" });
    const a = unit("a", "Foe A", at(6, 7), { faction: "blue", factionId: "blue" });
    const b = unit("b", "Foe B", at(6, 5), { faction: "blue", factionId: "blue" });
    return { me, a, b, board: boardWith([me, a, b]) };
  };

  it("attacks only the units the player left checked", () => {
    const { me, board: bd } = board();
    const r = resolveTargets(AREA, me, bd, { chosenIds: ["a"] });
    expect(r.units.map((u) => u.unitId)).toEqual(["a"]);
  });

  it("records the deselected unit with a reason rather than dropping it silently", () => {
    const { me, board: bd } = board();
    const r = resolveTargets(AREA, me, bd, { chosenIds: ["a"] });
    expect(others(r).find((e) => e.unitId === "b").reason).toBe("not selected by the attacker");
  });

  it("can only ever remove — an excluded unit cannot be added back by id", () => {
    // The dialog runs on the player's client, so its output is untrusted: a
    // crafted `chosenIds` naming an ally must not make that ally a target.
    const { me, board: bd } = board();
    const ally = unit("ally", "Karna", at(7, 6), { faction: "red", factionId: "red" });
    const withAlly = boardWith([...bd.units, ally]);
    const r = resolveTargets(AREA, me, withAlly, { chosenIds: ["a", "b", "ally"] });
    expect(r.units.map((u) => u.unitId).sort()).toEqual(["a", "b"]);
  });

  it("leaves the explicit `chosen` chooser to handle its own ids", () => {
    const { me, board: bd } = board();
    const spec = { ...AREA, selection: { ...AREA.selection, chooser: "chosen", count: 1 } };
    const r = resolveTargets(spec, me, bd, { chosenIds: ["a"] });
    expect(r.units.map((u) => u.unitId)).toEqual(["a"]);
    expect(r.errors).toEqual([]);
  });

  it("is inert when the player checked everything", () => {
    const { me, board: bd } = board();
    const r = resolveTargets(AREA, me, bd, { chosenIds: ["a", "b"] });
    expect(r.units.map((u) => u.unitId).sort()).toEqual(["a", "b"]);
    expect(others(r)).toEqual([]);
  });
});

describe("an unplaced caster is said to be unplaced", () => {
  it("refuses rather than measuring every distance from the corner of the map", () => {
    const me = { ...unit("me", "Heracles", at(0, 0)), panel: null };
    const foe = unit("f", "Karna", at(6, 7), { faction: "blue", factionId: "blue" });
    const r = resolveTargets(AREA, me, boardWith([me, foe]));
    expect(r.errors[0]).toMatch(/Heracles is not placed on the board/);
    expect(r.units).toEqual([]);
  });

  it("refuses a target that is not placed either", () => {
    const me = unit("me", "Heracles", at(6, 6));
    const foe = { ...unit("f", "Karna", at(6, 7), { faction: "blue" }), panel: null };
    const spec = {
      anchor: { kind: "targetUnit", range: 3 },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all" },
    };
    expect(resolveTargets(spec, me, boardWith([me, foe]), { unitId: "f" }).errors[0])
      .toMatch(/Karna is not placed on the board/);
  });
});

describe("board bounds follow the scene, not only the setting", () => {
  const grid = { size: 100, getOffset: ({ x, y }) => ({ i: Math.floor(y / 100), j: Math.floor(x / 100) }) };

  it("uses the scene's dimensions when it has them", () => {
    const scene = { grid, dimensions: { rows: 25, columns: 25 } };
    expect(snapshotBoard({ scene, actors: [], settings: { boardSize: 13 } }).bounds)
      .toEqual({ iMin: 0, jMin: 0, iMax: 24, jMax: 24 });
  });

  it("falls back to the configured board size for a scene that cannot answer", () => {
    expect(snapshotBoard({ scene: null, actors: [], settings: { boardSize: 13 } }).bounds)
      .toEqual({ iMin: 0, jMin: 0, iMax: 12, jMax: 12 });
  });

  it("keeps a unit in the lower half of a 25×25 scene targetable", () => {
    // Pinned to boardSize 13, every panel past row 12 was clipped out of every
    // shape and the units standing there vanished from the game.
    const scene = { grid, dimensions: { rows: 25, columns: 25 } };
    const me = unit("me", "Heracles", at(20, 20));
    const foe = unit("f", "Karna", at(20, 21), { faction: "blue", factionId: "blue" });
    const board = snapshotBoard({
      scene,
      actors: [{ snapshot: me }, { snapshot: foe }],
      settings: { boardSize: 13 },
    });

    const spec = {
      anchor: { kind: "targetUnit", range: 1 },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all" },
    };
    const r = resolveTargets(spec, me, board, { unitId: "f" });
    expect(r.errors).toEqual([]);
    expect(r.units.map((u) => u.unitId)).toEqual(["f"]);
  });
});

describe("legalPlacements carries the reasons the picker reports", () => {
  it("returns illegal placements rather than filtering them away", () => {
    const me = unit("me", "Heracles", at(6, 6));
    const ally = unit("ally", "Karna", at(6, 7));
    const spec = {
      anchor: { kind: "targetUnit", range: 3 },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all" },
    };

    const options = legalPlacements(spec, me, boardWith([me, ally]));
    expect(options).toHaveLength(1);
    expect(options[0].legal).toBe(false);
    expect(options[0].reasons.join(" ")).toMatch(/an ally/);
  });
});
