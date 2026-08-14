/**
 * @file The document → snapshot boundary.
 *
 * Every other test in this suite hands the rules layer a snapshot it built by
 * hand, with `panel: {i, j}` and an explicit faction. That is the right way to
 * test the rules — and it is exactly why 492 of them passed while a normal
 * attack between two adjacent Servants could not find a target: nothing
 * exercised the projection *from* a `TokenDocument`, which is where all three
 * bugs were.
 *
 * These tests drive the projection with simulated Foundry documents, and then
 * push the result through the real resolver, so the two cannot drift apart
 * again.
 */

import { describe, it, expect } from "vitest";
import { snapshotUnit, snapshotBoard, panelOf } from "../../module/rules/snapshot.mjs";
import { resolveTargets, legalPlacements, relationOf } from "../../module/rules/targeting/resolve.mjs";
import { NEUTRAL_FACTION } from "../../module/domain/enums.mjs";

const GRID = 100;

/** A stand-in for `foundry.grid.SquareGrid`. */
const grid = {
  size: GRID,
  getOffset: ({ x, y }) => ({ i: Math.floor(y / GRID), j: Math.floor(x / GRID) }),
};

const scene = { grid, dimensions: { rows: 13, columns: 13 } };

/**
 * An actor plus the token it stands on, shaped like the real documents:
 * `system.range` is a SchemaField, and the token's x/y are **pixels**.
 */
function placed(id, name, { i, j }, over = {}) {
  const { disposition = -1, factionId = null, type = "servant", width = 1, height = 1 } = over;
  const actor = {
    id, uuid: `Actor.${id}`, name, type,
    items: [], effects: [],
    system: {
      factionId,
      health: { value: 500, max: 500 },
      agility: { value: 40, max: 40 },
      luck: { value: 20, max: 20 },
      mov: 4,
      range: { panels: over.range ?? 1, targets: 1 },
      parameters: { str: "A", end: "A", agi: "A", mag: "E", luc: "C" },
      baseAttack: { str: 100, mag: 0 },
      normalAttack: { mode: "fixed", component: over.component ?? "str" },
      attributes: [], turnState: {},
    },
  };
  const token = {
    x: j * GRID, y: i * GRID, width, height,
    elevation: 0, disposition, actor, parent: scene,
  };
  return { actor, token };
}

/** The spec a normal attack uses — `engine/attack.mjs#targetSpecFor`. */
function normalAttackSpec(actor) {
  return {
    anchor: { kind: "targetUnit", range: actor.system.range?.panels ?? 1 },
    shape: { kind: "unit" },
    selection: { relations: ["enemy"], chooser: "all", count: 1 },
  };
}

/* -------------------------------------------------------------------------- */

describe("panelOf — pixels are not grid offsets", () => {
  it("converts a token's pixel position to a grid offset", () => {
    // The bug: {i: doc.y, j: doc.x} put a token standing on panel (6,6) at
    // panel (600,600), off every 13x13 board, where the bounds check silently
    // deleted it from every shape.
    expect(panelOf({ x: 600, y: 600 }, grid)).toEqual({ i: 6, j: 6 });
    expect(panelOf({ x: 700, y: 600 }, grid)).toEqual({ i: 6, j: 7 });
    expect(panelOf({ x: 0, y: 0 }, grid)).toEqual({ i: 0, j: 0 });
  });

  it("reads i and j straight through when the caller already has offsets", () => {
    expect(panelOf({ i: 3, j: 9 })).toEqual({ i: 3, j: 9 });
  });

  it("finds the grid on the token's own scene when none is passed", () => {
    const { token } = placed("a", "A", { i: 4, j: 5 });
    expect(panelOf(token)).toEqual({ i: 4, j: 5 });
  });

  it("falls back to the grid size when the grid has no getOffset", () => {
    expect(panelOf({ x: 250, y: 350 }, { size: 100 })).toEqual({ i: 3, j: 2 });
  });

  it("returns null rather than an invented origin for an unplaced unit", () => {
    // {i:0, j:0} is a *position*, and a wrong one. Answering "nowhere" is what
    // lets the resolver say so instead of measuring from the corner of the map.
    expect(panelOf(null)).toBe(null);
    expect(panelOf({ x: 100 }, grid)).toBe(null);
  });
});

describe("snapshotUnit — the fields the resolver compares", () => {
  it("places a unit at the panel its token stands on", () => {
    const { actor, token } = placed("heracles", "Heracles", { i: 6, j: 6 });
    const unit = snapshotUnit(actor, { token, grid });
    expect(unit.panel).toEqual({ i: 6, j: 6 });
    expect(unit.onBoard).toBe(true);
  });

  it("marks an actor with no token as off the board", () => {
    const { actor } = placed("heracles", "Heracles", { i: 6, j: 6 });
    const unit = snapshotUnit(actor);
    expect(unit.panel).toBe(null);
    expect(unit.onBoard).toBe(false);
  });

  it("projects range as the number of panels, not the schema object", () => {
    // `system.range` is {panels, targets}. Passing the object through made
    // `caster.range` an object, so `spec.range ?? caster.range ?? 1` handed a
    // `{panels: 1}` to a numeric comparison and every anchor check failed.
    const { actor, token } = placed("karna", "Karna", { i: 0, j: 0 }, { range: 4 });
    const unit = snapshotUnit(actor, { token, grid });
    expect(unit.range).toBe(4);
    expect(unit.rangeTargets).toBe(1);
  });

  it("carries the normal-attack component so the preview matches the attack", () => {
    const { actor, token } = placed("medea", "Medea", { i: 1, j: 1 }, { component: "mag" });
    expect(snapshotUnit(actor, { token, grid }).normalAttack.component).toBe("mag");
  });

  it("derives a multi-panel footprint from the token's size", () => {
    const { actor, token } = placed("asterios", "Asterios", { i: 2, j: 3 }, { width: 2, height: 2 });
    expect(snapshotUnit(actor, { token, grid }).panels).toEqual([
      { i: 2, j: 3 }, { i: 2, j: 4 }, { i: 3, j: 3 }, { i: 3, j: 4 },
    ]);
  });
});

describe("factions", () => {
  it("prefers an explicit factionId over anything the token says", () => {
    const { actor, token } = placed("a", "A", { i: 0, j: 0 }, { factionId: "red", disposition: 1 });
    expect(snapshotUnit(actor, { token, grid }).faction).toBe("red");
  });

  it("treats Foundry's default HOSTILE disposition as no information", () => {
    // Every new token is HOSTILE. Reading that as a faction id makes two freshly
    // placed Servants allies, which is the state in which nothing is targetable.
    const { actor, token } = placed("a", "A", { i: 0, j: 0 }, { disposition: -1 });
    expect(snapshotUnit(actor, { token, grid }).faction).toBe(null);
  });

  it("uses a deliberate FRIENDLY or NEUTRAL disposition as a stand-in faction", () => {
    const friendly = placed("a", "A", { i: 0, j: 0 }, { disposition: 1 });
    const neutral = placed("b", "B", { i: 0, j: 1 }, { disposition: 0 });
    expect(snapshotUnit(friendly.actor, { token: friendly.token, grid }).faction)
      .toBe("disposition:friendly");
    expect(snapshotUnit(neutral.actor, { token: neutral.token, grid }).faction)
      .toBe(NEUTRAL_FACTION);
  });

  it("makes Civilians neutral by kind whatever their token says", () => {
    const { actor, token } = placed("c", "C", { i: 0, j: 0 }, { type: "civilian", disposition: -1 });
    expect(snapshotUnit(actor, { token, grid }).faction).toBe(NEUTRAL_FACTION);
  });
});

describe("relationOf — D4.10", () => {
  const board = { alliances: { red: ["red", "gold"] } };
  const red = { id: "a", faction: "red", kind: "servant" };

  it("is self for the same unit", () => {
    expect(relationOf(red, red, board)).toBe("self");
  });

  it("is ally within a faction and enemy across factions", () => {
    expect(relationOf(red, { id: "b", faction: "red", kind: "servant" }, board)).toBe("ally");
    expect(relationOf(red, { id: "b", faction: "blue", kind: "servant" }, board)).toBe("enemy");
  });

  it("is ally across an alliance declared for the match", () => {
    expect(relationOf(red, { id: "b", faction: "gold", kind: "servant" }, board)).toBe("ally");
  });

  it("is neutral for the neutral faction and for Civilians", () => {
    expect(relationOf(red, { id: "b", faction: NEUTRAL_FACTION, kind: "servant" }, board)).toBe("neutral");
    expect(relationOf(red, { id: "b", faction: "blue", kind: "civilian" }, board)).toBe("neutral");
  });

  it("treats an unassigned faction as an enemy, not as neutral", () => {
    // Conflating null with neutral is what made every unconfigured unit
    // untargetable by everything, in silence.
    expect(relationOf({ id: "a", faction: null, kind: "servant" },
      { id: "b", faction: null, kind: "servant" }, board)).toBe("enemy");
  });
});

describe("two Servants side by side — the M1 acceptance case", () => {
  const heracles = placed("heracles", "Heracles", { i: 6, j: 6 });
  const karna = placed("karna", "Karna", { i: 6, j: 7 });

  const board = snapshotBoard({
    scene,
    actors: [heracles, karna].map((u) => ({ actor: u.actor, token: u.token })),
    settings: { boardSize: 13 },
  });

  it("puts both units on adjacent panels", () => {
    expect(board.units.map((u) => u.panel)).toEqual([{ i: 6, j: 6 }, { i: 6, j: 7 }]);
  });

  it("lets Heracles make a normal attack against Karna", () => {
    const caster = snapshotUnit(heracles.actor, { token: heracles.token, grid });
    const spec = normalAttackSpec(heracles.actor);

    const options = legalPlacements(spec, caster, board);
    expect(options.filter((o) => o.legal).map((o) => o.placement.unitId)).toEqual(["karna"]);

    const resolved = resolveTargets(spec, caster, board, { unitId: "karna" });
    expect(resolved.errors).toEqual([]);
    expect(resolved.units.map((u) => u.unitId)).toEqual(["karna"]);
    expect(resolved.units[0].distance).toBe(1);
  });

  it("says the caster is not on the board rather than measuring from the corner", () => {
    const unplaced = snapshotUnit(heracles.actor);
    const resolved = resolveTargets(normalAttackSpec(heracles.actor), unplaced, board, { unitId: "karna" });
    expect(resolved.errors[0]).toMatch(/not placed on the board/);
  });

  it("warns that an unaffiliated attacker treats everyone as an enemy", () => {
    const caster = snapshotUnit(heracles.actor, { token: heracles.token, grid });
    const resolved = resolveTargets(normalAttackSpec(heracles.actor), caster, board, { unitId: "karna" });
    expect(resolved.warnings.join(" ")).toMatch(/no Faction set/);
  });
});

describe("exclusion reasons", () => {
  const spec = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 2 },
    selection: { relations: ["enemy"], chooser: "all" },
  };

  function boardOf(...units) {
    return snapshotBoard({
      scene,
      actors: units.map((u) => ({ actor: u.actor, token: u.token })),
      settings: { boardSize: 13 },
    });
  }

  /** The exclusions other than the caster excluding itself from its own AoE. */
  const others = (resolved) => resolved.excluded.filter((e) => e.unitId !== "a");

  it("names the unit and the reason when an ally is the only thing in the area", () => {
    const a = placed("a", "Heracles", { i: 6, j: 6 }, { factionId: "red" });
    const b = placed("b", "Karna", { i: 6, j: 7 }, { factionId: "red" });
    const caster = snapshotUnit(a.actor, { token: a.token, grid });

    const resolved = resolveTargets(spec, caster, boardOf(a, b), {});
    expect(others(resolved)).toEqual([
      { unitId: "b", name: "Karna", reason: expect.stringContaining("an ally") },
    ]);
    expect(resolved.errors[0]).toMatch(/No legal targets: Karna is an ally/);
  });

  it("lists the caster's own exclusion for the preview, as §28.6 shows it", () => {
    const a = placed("a", "Heracles", { i: 6, j: 6 }, { factionId: "red" });
    const b = placed("b", "Karna", { i: 6, j: 7 }, { factionId: "blue" });
    const caster = snapshotUnit(a.actor, { token: a.token, grid });

    const resolved = resolveTargets(spec, caster, boardOf(a, b), {});
    expect(resolved.units.map((u) => u.unitId)).toEqual(["b"]);
    expect(resolved.excluded).toEqual([
      { unitId: "a", name: "Heracles", reason: "the attacker itself" },
    ]);
  });

  it("explains a Civilian excluded by relation", () => {
    const a = placed("a", "Heracles", { i: 6, j: 6 }, { factionId: "red" });
    const c = placed("c", "Bystander", { i: 6, j: 7 }, { type: "civilian" });
    const caster = snapshotUnit(a.actor, { token: a.token, grid });

    const resolved = resolveTargets(spec, caster, boardOf(a, c), {});
    expect(others(resolved)[0].reason).toMatch(/Civilian/);
  });

  it("counts the rest rather than listing all of them", () => {
    const a = placed("a", "Heracles", { i: 6, j: 6 }, { factionId: "red" });
    // All three inside the radius-2 area, which spans columns 4..8.
    const allies = ["b", "c", "d"].map((id, n) =>
      placed(id, `Ally ${n}`, { i: 6 + n - 1, j: 7 }, { factionId: "red" }));
    const caster = snapshotUnit(a.actor, { token: a.token, grid });

    const resolved = resolveTargets(spec, caster, boardOf(a, ...allies), {});
    expect(others(resolved)).toHaveLength(3);
    expect(resolved.errors[0]).toMatch(/and 2 more excluded/);
  });

  it("does not let the caster's own self-exclusion masquerade as a diagnosis", () => {
    const a = placed("a", "Heracles", { i: 6, j: 6 }, { factionId: "red" });
    const caster = snapshotUnit(a.actor, { token: a.token, grid });

    const resolved = resolveTargets(spec, caster, boardOf(a), {});
    expect(resolved.errors).toEqual(["No legal targets in the selected area."]);
    expect(resolved.excluded.map((e) => e.unitId)).toEqual(["a"]);
  });
});

describe("board bounds follow the scene, not only the setting", () => {
  it("uses the scene's dimensions when it has them", () => {
    const big = { grid, dimensions: { rows: 25, columns: 25 } };
    const board = snapshotBoard({ scene: big, actors: [], settings: { boardSize: 13 } });
    expect(board.bounds).toEqual({ iMin: 0, jMin: 0, iMax: 24, jMax: 24 });
  });

  it("falls back to the configured board size for a scene that cannot answer", () => {
    const board = snapshotBoard({ scene: null, actors: [], settings: { boardSize: 13 } });
    expect(board.bounds).toEqual({ iMin: 0, jMin: 0, iMax: 12, jMax: 12 });
  });

  it("keeps a unit in the lower half of a 25x25 scene targetable", () => {
    // With bounds pinned to boardSize 13, every panel past row 12 was clipped
    // out of every shape and the units standing there vanished from the game.
    const big = { grid, dimensions: { rows: 25, columns: 25 } };
    const a = placed("a", "Heracles", { i: 20, j: 20 }, { factionId: "red" });
    const b = placed("b", "Karna", { i: 20, j: 21 }, { factionId: "blue" });
    const board = snapshotBoard({
      scene: big,
      actors: [a, b].map((u) => ({ actor: u.actor, token: u.token })),
      settings: { boardSize: 13 },
    });
    const caster = snapshotUnit(a.actor, { token: a.token, grid });
    const resolved = resolveTargets(normalAttackSpec(a.actor), caster, board, { unitId: "b" });
    expect(resolved.errors).toEqual([]);
    expect(resolved.units.map((u) => u.unitId)).toEqual(["b"]);
  });
});
