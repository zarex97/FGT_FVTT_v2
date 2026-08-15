/**
 * @file Terrain — a property of panels, evaluated for whoever stands on them.
 * @see docs/42-terrain.md, docs/45-implementation-status.md C1
 *
 * The snapshot has carried a `terrain` field since it was written and nothing
 * has ever populated or read it.
 *
 * Terrain is mechanically *a positional aura whose source is a region rather
 * than a unit* (§42.1), so it reuses the pass A5 built: collected for the panel
 * a unit occupies, applied while it stays, gone the instant it leaves — with no
 * removal step, because a unit never carried the terrain in the first place.
 */

import { describe, it, expect } from "vitest";
import { TERRAIN, terrainAt, terrainEffects, annotateTerrain } from "../../module/rules/terrain.mjs";

const at = (i, j) => ({ i, j });

/** A board with one terrain area covering a single panel. */
const boardWith = (type, panels = [at(0, 0)]) => ({
  bounds: { rows: 13, columns: 13 },
  units: [],
  terrain: { areas: [{ id: "t1", type, panels }] },
});

const unit = (over = {}) => ({
  id: "u", panel: at(0, 0), mov: 5, attributes: [], modifiers: [], checkModifiers: [], ...over,
});

describe("terrainAt", () => {
  it("reports the types covering a panel", () => {
    expect(terrainAt(at(0, 0), boardWith("forest"))).toEqual(["forest"]);
  });

  it("reports nothing for a panel outside every area", () => {
    expect(terrainAt(at(5, 5), boardWith("forest"))).toEqual([]);
  });

  it("reports both types where two areas overlap", () => {
    // "Two units on different panels of the same area can be under different
    // terrain if the areas overlap unevenly."
    const board = boardWith("forest");
    board.terrain.areas.push({ id: "t2", type: "snowfield", panels: [at(0, 0)] });

    expect(terrainAt(at(0, 0), board)).toEqual(["forest", "snowfield"]);
  });
});

/* ========================================================================== */
/*  The catalogue, as a table test — the C1 gate                              */
/* ========================================================================== */

describe("movement and evasion by terrain type", () => {
  const cases = [
    // type,        attributes,      movDelta, evadeDelta, note
    ["forest", [], -1, -2, "MOV −1; Evade −2, the rare terrain that helps evasion"],
    ["snowfield", [], -1, +1, "MOV −1, Evade +1"],
    ["snowfield", ["santa"], 0, 0, "does not affect units with the Santa attribute"],
    ["waterside", [], -1, +1, "without Swimsuit!"],
    ["waterside", ["swimsuit"], +1, -1, "with Swimsuit!"],
    ["city", [], 0, -1, "Evade −1"],
    ["lava", [], -1, 0, "MOV −1"],
    ["frozen", [], 0, +3, "Evade +3"],
    ["airspace", [], -1, 0, "without Levitating"],
    ["airspace", ["levitating"], +1, 0, "with Levitating"],
  ];

  it.each(cases)("%s with [%s] gives MOV %d and Evade %d", (type, attributes, mov, evade) => {
    const effects = terrainEffects(unit({ attributes }), boardWith(type));

    expect(effects.movDelta).toBe(mov);
    expect(effects.evadeDelta).toBe(evade);
  });

  it("leaves a unit standing on no terrain entirely alone", () => {
    const effects = terrainEffects(unit({ panel: at(9, 9) }), boardWith("forest"));

    expect(effects).toMatchObject({ movDelta: 0, evadeDelta: 0, modifiers: [] });
  });

  it("sums the movement penalties of overlapping areas", () => {
    const board = boardWith("forest");
    board.terrain.areas.push({ id: "t2", type: "snowfield", panels: [at(0, 0)] });

    expect(terrainEffects(unit(), board).movDelta).toBe(-2);
  });
});

describe("damage modifiers by terrain type", () => {
  const modifierFor = (type, key, attributes = []) =>
    terrainEffects(unit({ attributes }), boardWith(type)).modifiers.find((m) => m.key === key);

  it("reduces all damage taken in a Forest by 10%", () => {
    expect(modifierFor("forest", "defUp")).toMatchObject({ value: 10 });
  });

  it("halves Fire damage taken in a Snowfield by 25%", () => {
    expect(modifierFor("snowfield", "elementDefUp")).toMatchObject({ element: "fire", value: 25 });
  });

  it("increases all damage taken in an Eldritch area by 20%", () => {
    expect(modifierFor("eldritch", "defDwn")).toMatchObject({ value: 20 });
  });

  it("halves Water damage taken in a Burning area", () => {
    expect(modifierFor("burning", "elementDefUp")).toMatchObject({ element: "water", value: 50 });
  });
});

/* ========================================================================== */
/*  The pass                                                                  */
/* ========================================================================== */

describe("annotateTerrain", () => {
  it("records which terrain each unit is standing in", () => {
    const board = boardWith("forest");
    const u = unit();
    board.units = [u];

    annotateTerrain(board.units, board);

    expect(u.terrain).toEqual(["forest"]);
  });

  it("appends the terrain's modifiers to the unit's own", () => {
    const board = boardWith("forest");
    const u = unit({ modifiers: [{ key: "atkUp", value: 5, source: "own" }] });
    board.units = [u];

    annotateTerrain(board.units, board);

    // Forest carries two: all damage taken −10%, and Nature damage dealt +25%.
    expect(u.modifiers.map((m) => m.key)).toEqual(["atkUp", "defUp", "elementAtkUp"]);
  });

  it("marks the source, so the explainer can say why", () => {
    const board = boardWith("forest");
    const u = unit();
    board.units = [u];

    annotateTerrain(board.units, board);

    expect(u.modifiers[0]).toMatchObject({ terrain: "forest" });
  });

  it("gives a unit off the terrain nothing at all", () => {
    const board = boardWith("forest");
    const u = unit({ panel: at(9, 9) });
    board.units = [u];

    annotateTerrain(board.units, board);

    expect(u.terrain).toEqual([]);
    expect(u.modifiers).toEqual([]);
  });
});

describe("the catalogue itself", () => {
  it("gives every type a documented entry", () => {
    // A type nothing describes would silently do nothing to whoever stands in
    // it, which is this project's recurring defect.
    for (const [id, entry] of Object.entries(TERRAIN)) {
      expect(entry, `${id} has no effects`).toHaveProperty("effects");
    }
  });
});
