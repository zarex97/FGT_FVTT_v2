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
import { phaseAt } from "../../module/rules/environment.mjs";
import { snapshotBoard } from "../../module/rules/snapshot.mjs";

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

/* ========================================================================== */
/*  §42.6 — the per-panel day/night override                                  */
/* ========================================================================== */

/**
 * Ch. 19 §19.2 treated the phase as a global property of the Round. §42.6 makes
 * it a property of the PANEL, and names Quetzalcoatl's `Sol` as the reason:
 * *"the 5x5 panel area around Quetz is 'Day', even if it is during a Night
 * Round."*
 */
describe("phaseAt", () => {
  const areas = (...entries) => ({
    bounds: { rows: 13, columns: 13 },
    units: [],
    terrain: { areas: entries.map((e, n) => ({ id: `t${n}`, ...e })) },
  });

  it("reports Day inside a sunlight area during a Night round", () => {
    const b = { ...areas({ type: "sunlight", panels: [at(1, 1), at(1, 2)] }), phase: "night" };
    expect(phaseAt(at(1, 1), b)).toBe("day");
  });

  it("reports the round's own phase outside the area", () => {
    const b = { ...areas({ type: "sunlight", panels: [at(1, 1)] }), phase: "night" };
    expect(phaseAt(at(9, 9), b)).toBe("night");
  });

  it("reports Night inside a darkness area during a Day round", () => {
    const b = { ...areas({ type: "darkness", panels: [at(2, 2)] }), phase: "day" };
    expect(phaseAt(at(2, 2), b)).toBe("night");
  });

  it("reports neither when Indoors — 'there is no Day or Night when Indoors'", () => {
    const b = { ...areas({ type: "indoors", panels: [at(3, 3)] }), phase: "day" };
    expect(phaseAt(at(3, 3), b)).toBe("none");
  });

  it("lets Indoors beat Sunlight, because an absence is not a value", () => {
    const b = {
      ...areas(
        { type: "sunlight", panels: [at(3, 3)] },
        { type: "indoors", panels: [at(3, 3)] },
      ),
      phase: "night",
    };
    expect(phaseAt(at(3, 3), b)).toBe("none");
  });

  it("defaults to day for a board carrying no phase at all", () => {
    expect(phaseAt(at(0, 0), areas())).toBe("day");
  });

  it("carries no standing effects — it changes the phase, it is not a modifier", () => {
    for (const type of ["sunlight", "darkness", "indoors"]) {
      expect(TERRAIN[type].effects).toEqual([]);
    }
  });
});

/**
 * The read path from `engine/board.mjs`'s projection into `board.terrain`.
 *
 * `terrainAreasOf` computes the areas into `settings.terrain`; this line read
 * `scene.terrain`, a property no Scene document has, so `board.terrain` was
 * always `{}` in a live world and the whole of Ch. 42 answered for empty
 * ground. The identical bug had already been found and fixed for `zones` in the
 * same object. Found live, painting Quetzalcoatl's `Sol`.
 */
describe("snapshotBoard wires the terrain projection", () => {
  const areas = [{ id: "t1", type: "forest", panels: [at(1, 1)] }];

  it("reads terrain from settings, where board.mjs actually puts it", () => {
    const board = snapshotBoard({
      scene: { grid: { size: 100 } },     // a real Scene has no `.terrain`
      actors: [],
      settings: { terrain: { areas } },
    });
    expect(board.terrain.areas).toHaveLength(1);
    expect(terrainAt(at(1, 1), board)).toEqual(["forest"]);
  });

  it("still accepts a scene-shaped fixture, so older callers keep working", () => {
    const board = snapshotBoard({
      scene: { grid: { size: 100 }, terrain: { areas } },
      actors: [],
      settings: {},
    });
    expect(board.terrain.areas).toHaveLength(1);
  });
});

/* ========================================================================== */
/*  Imaginary Numbers Space — Nemo's Storm Border (Ch. 20 §20.6)              */
/* ========================================================================== */

describe("Imaginary Numbers Space (Nemo, Ch. 20 §20.6)", () => {
  it("is in the catalogue", () => {
    expect(TERRAIN.imaginaryNumbers).toBeDefined();
    expect(TERRAIN.imaginaryNumbers.name).toBe("Imaginary Numbers Space");
  });

  it("carries no standing effects, and that is its finished state", () => {
    // Like `sunlight`/`darkness`/`indoors`: the space modifies nobody. Every
    // Imaginary Numbers clause in the game is on Nemo's own abilities, which
    // read it as a PREDICATE rather than receiving a modifier from it.
    expect(TERRAIN.imaginaryNumbers.effects).toEqual([]);
  });

  it("leaves a unit standing in it otherwise unmodified", () => {
    const out = terrainEffects({ panel: at(0, 0), attributes: [] }, boardWith("imaginaryNumbers"));
    expect(out.types).toEqual(["imaginaryNumbers"]);
    expect(out.movDelta).toBe(0);
    expect(out.evadeDelta).toBe(0);
    expect(out.modifiers).toEqual([]);
  });
});
