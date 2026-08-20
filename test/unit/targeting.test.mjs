import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  TARGET_SHAPES, TARGET_ANCHORS, SHAPE_IDS,
} from "../../module/rules/targeting/vocabulary.mjs";
import { resolveTargets, legalPlacements, validate } from "../../module/rules/targeting/resolve.mjs";
import { expand, orthogonalAdjacentRect } from "../../module/rules/targeting/shapes.mjs";
import { squareBounds, key } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });
const bounds = squareBounds(13);

function unit(id, i, j, over = {}) {
  return { id, panel: at(i, j), kind: "servant", faction: "b", attributes: [], effects: [], ...over };
}

function boardWith(units, over = {}) {
  return { bounds, units, alliances: { a: ["a"], b: ["b"] }, seed: 1, ...over };
}

const caster = { id: "caster", panel: at(6, 6), kind: "servant", faction: "a", range: 3 };

/* -------------------------------------------------------------------------- */

describe("orthogonalAdjacentRect — the signature F/GT anchor", () => {
  it("places a 3×3 flush to the north, excluding the caster", () => {
    const p = orthogonalAdjacentRect(at(6, 6), 3, 3, "n");
    expect(p.length).toBe(9);
    expect(p.some((q) => q.i === 6 && q.j === 6)).toBe(false);
    expect(p.map(key).sort()).toEqual(
      ["3,5", "3,6", "3,7", "4,5", "4,6", "4,7", "5,5", "5,6", "5,7"].sort(),
    );
  });

  it("reproduces the chapter's 5×5-to-the-east diagram", () => {
    // Columns j+1..j+5, rows i-2..i+2. The caster's own column is excluded.
    const p = orthogonalAdjacentRect(at(6, 6), 5, 5, "e");
    expect(p.length).toBe(25);
    expect(p.every((q) => q.j >= 7 && q.j <= 11)).toBe(true);
    expect(p.every((q) => q.i >= 4 && q.i <= 8)).toBe(true);
  });

  it("keeps the block centred on the caster's axis in all four directions", () => {
    for (const d of ["n", "e", "s", "w"]) {
      const p = orthogonalAdjacentRect(at(6, 6), 3, 3, d);
      expect(p.length, d).toBe(9);
      expect(p.some((q) => q.i === 6 && q.j === 6), d).toBe(false);
    }
  });

  it("clips to the board rather than running off it", () => {
    expect(orthogonalAdjacentRect(at(0, 0), 3, 3, "n", bounds).length).toBe(0);
    expect(orthogonalAdjacentRect(at(1, 1), 3, 3, "n", bounds).length).toBe(3);
  });

  it("rejects an unknown direction", () => {
    expect(() => orthogonalAdjacentRect(at(6, 6), 3, 3, "up")).toThrow(RangeError);
  });
});

describe("shape expansion", () => {
  const anchor = { panel: at(6, 6), casterPanel: at(6, 6) };

  it("chebyshevRadius is the party area — (2r+1)², including the centre", () => {
    expect(expand({ kind: "chebyshevRadius", r: 2 }, anchor).panels.length).toBe(25);
  });

  it("attackRange uses the corrected octagonal shape", () => {
    expect(expand({ kind: "attackRange", r: 3 }, anchor).panels.length).toBe(37);
    expect(expand({ kind: "attackRange", r: 4 }, anchor).panels.length).toBe(61);
  });

  it("square is sugar for an equal-sided rect", () => {
    expect(expand({ kind: "square", size: 5 }, anchor).panels.length).toBe(25);
  });

  it("a directional anchor projects the rect instead of centring it", () => {
    const directional = { panel: at(6, 6), casterPanel: at(6, 6), direction: "n" };
    const p = expand({ kind: "rect", w: 3, h: 3 }, directional).panels;
    expect(p.some((q) => q.i === 6 && q.j === 6)).toBe(false);
    const centred = expand({ kind: "rect", w: 3, h: 3 }, anchor).panels;
    expect(centred.some((q) => q.i === 6 && q.j === 6)).toBe(true);
  });

  it("orientedRect swaps its axes with the platform's facing", () => {
    const ns = expand({ kind: "orientedRect", long: 7, short: 3 }, { ...anchor, direction: "n" }).panels;
    const ew = expand({ kind: "orientedRect", long: 7, short: 3 }, { ...anchor, direction: "e" }).panels;
    expect(ns.length).toBe(21);
    expect(ew.length).toBe(21);
    // Projected forward: N covers 7 rows × 3 columns, E covers 3 rows × 7 columns.
    expect(new Set(ns.map((p) => p.j)).size).toBe(3);
    expect(new Set(ew.map((p) => p.j)).size).toBe(7);
  });

  it("banded attaches a band index per panel", () => {
    const r = expand(
      { kind: "banded", bands: [{ maxDistance: 1, multiplier: 1.5 }, { maxDistance: 2, multiplier: 0.5 }] },
      anchor,
      { caster: at(6, 6) },
    );
    expect(r.panels.length).toBe(25);
    expect(r.bands.get(key(at(6, 6)))).toBe(0);
    expect(r.bands.get(key(at(5, 6)))).toBe(0);
    expect(r.bands.get(key(at(4, 6)))).toBe(1);
  });

  it("line supports bidirectional and diagonal-shortened projection", () => {
    const bidir = expand(
      { kind: "line", length: 6, width: 1, bidirectional: true },
      { ...anchor, direction: "e" },
    ).panels;
    expect(bidir.length).toBe(12);
    const diag = expand(
      { kind: "line", length: 5, width: 1, diagonalLength: 4 },
      { ...anchor, direction: "se" },
    ).panels;
    expect(diag.length).toBe(4);
  });

  it("throws on an unknown shape rather than returning nothing", () => {
    expect(() => expand({ kind: "hexagon" }, anchor)).toThrow(RangeError);
  });
});

/* -------------------------------------------------------------------------- */

describe("T3 — 'affects all allied Units within a 2 panel area'", () => {
  const spec = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 2 },
    selection: { relations: ["ally", "self"], chooser: "all" },
  };

  it("includes the caster, because 'allied' includes the user", () => {
    // This is not a nicety: Van Gogh's Het Gele Huis curses herself and that is
    // the entire point of her design.
    const board = boardWith([
      { ...caster, faction: "a" },
      unit("ally", 6, 7, { faction: "a" }),
      unit("enemy", 6, 8, { faction: "b" }),
    ]);
    const r = resolveTargets(spec, caster, board);
    expect(r.units.map((u) => u.unitId).sort()).toEqual(["ally", "caster"]);
  });

  it("excludes the caster when the ability states 'other allied Units'", () => {
    const board = boardWith([{ ...caster, faction: "a" }, unit("ally", 6, 7, { faction: "a" })]);
    const r = resolveTargets(
      { ...spec, selection: { ...spec.selection, includeSelf: false } }, caster, board);
    expect(r.units.map((u) => u.unitId)).toEqual(["ally"]);
  });

  it("excludes the caster from a damaging AoE NP by default — Note 11", () => {
    const board = boardWith([{ ...caster, faction: "a" }, unit("ally", 6, 7, { faction: "a" })]);
    const r = resolveTargets({ ...spec, isDamagingAoE: true }, caster, board);
    expect(r.units.map((u) => u.unitId)).toEqual(["ally"]);
  });
});

describe("T1 — 'Range: 3 panels, 1 target'", () => {
  const spec = {
    anchor: { kind: "targetUnit", range: 3 },
    shape: { kind: "unit" },
    selection: { relations: ["enemy"], chooser: "all", count: 1 },
  };

  it("targets a single enemy inside the attack-range shape", () => {
    const board = boardWith([caster, unit("foe", 6, 9)]);
    const r = resolveTargets(spec, caster, board, { unitId: "foe" });
    expect(r.errors).toEqual([]);
    expect(r.units.map((u) => u.unitId)).toEqual(["foe"]);
  });

  it("rejects a target outside Range with a reason the UI can show", () => {
    const board = boardWith([caster, unit("foe", 6, 10)]);
    const r = resolveTargets(spec, caster, board, { unitId: "foe" });
    expect(r.errors[0]).toMatch(/out of Range \(3\)/);
  });

  it("rejects a diagonal corner clipped by the Range shape at R = 3", () => {
    // (3,3) offset: d = 3, s = 3 → excluded by the outer-ring corner rule.
    const board = boardWith([caster, unit("foe", 9, 9)]);
    expect(resolveTargets(spec, caster, board, { unitId: "foe" }).errors.length).toBe(1);
  });
});

describe("selection filters", () => {
  it("drops platforms and structures unless explicitly included", () => {
    const board = boardWith([
      caster,
      unit("foe", 6, 7),
      unit("ship", 6, 8, { kind: "platform" }),
    ]);
    const spec = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 3 },
      selection: { relations: ["enemy"], chooser: "all" },
    };
    expect(resolveTargets(spec, caster, board).units.map((u) => u.unitId)).toEqual(["foe"]);

    const withPlatform = { ...spec, selection: { ...spec.selection, kinds: ["servant", "platform"] } };
    expect(resolveTargets(withPlatform, caster, board).units.map((u) => u.unitId).sort())
      .toEqual(["foe", "ship"]);
  });

  it("filters by attribute predicate", () => {
    const board = boardWith([
      caster,
      unit("divine", 6, 7, { attributes: ["divine"] }),
      unit("mortal", 6, 8, { attributes: [] }),
    ]);
    const spec = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 3 },
      selection: { relations: ["enemy"], chooser: "all", attributes: ["target:attribute:divine"] },
    };
    expect(resolveTargets(spec, caster, board).units.map((u) => u.unitId)).toEqual(["divine"]);
  });

  it("blocks direct targeting of a concealed unit but still catches it in an AoE", () => {
    const board = boardWith([caster, unit("hidden", 6, 7, { concealed: true })]);
    const single = {
      anchor: { kind: "targetUnit", range: 3 },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all", count: 1 },
    };
    expect(resolveTargets(single, caster, board, { unitId: "hidden" }).units).toEqual([]);

    const aoe = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 2 },
      selection: { relations: ["enemy"], chooser: "all" },
    };
    const r = resolveTargets(aoe, caster, board);
    expect(r.units.map((u) => u.unitId)).toEqual(["hidden"]);
    expect(r.units[0].concealedAoE).toBe(true);
  });
});

describe("Master protection", () => {
  const spec = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 3 },
    selection: { relations: ["enemy"], chooser: "all" },
  };

  it("excludes a Master standing next to its own Servant", () => {
    const board = boardWith([
      caster,
      unit("master", 6, 8, { kind: "master" }),
      unit("guard", 6, 9),
    ]);
    const r = resolveTargets(spec, caster, board);
    expect(r.units.map((u) => u.unitId)).toEqual(["guard"]);
    expect(r.warnings).toContain("Protected Masters were excluded.");
  });

  it("allows the Master once no Servant is adjacent", () => {
    const board = boardWith([caster, unit("master", 6, 8, { kind: "master" })]);
    expect(resolveTargets(spec, caster, board).units.map((u) => u.unitId)).toEqual(["master"]);
  });

  it("allows the Master when the caster bypasses protection — Presence Concealment", () => {
    const board = boardWith([
      caster,
      unit("master", 6, 8, { kind: "master" }),
      unit("guard", 6, 9),
    ]);
    const concealed = { ...caster, bypassesMasterProtection: true };
    expect(resolveTargets(spec, concealed, board).units.map((u) => u.unitId).sort())
      .toEqual(["guard", "master"]);
  });

  it("ignores a Servant that cannot act", () => {
    const board = boardWith([
      caster,
      unit("master", 6, 8, { kind: "master" }),
      unit("guard", 6, 9, { canAct: false }),
    ]);
    expect(resolveTargets(spec, caster, board).units.map((u) => u.unitId).sort())
      .toEqual(["guard", "master"]);
  });
});

describe("chooser: chosen — Gate of Skye's subset selection", () => {
  const spec = {
    anchor: { kind: "selfEdgeAdjacent" },
    shape: { kind: "rect", w: 5, h: 5 },
    selection: { relations: ["enemy", "ally"], chooser: "chosen", count: "unlimited" },
  };

  it("asks for a choice before committing, so allies are not caught", () => {
    const board = boardWith([
      caster,
      unit("foe1", 4, 6),
      unit("foe2", 3, 6),
      unit("friend", 5, 6, { faction: "a" }),
    ]);
    const r = resolveTargets(spec, caster, board, { direction: "n" });
    expect(r.needsChoice).toBe(true);
    expect(r.units).toEqual([]);
    expect(r.candidates.map((c) => c.unitId).sort()).toEqual(["foe1", "foe2", "friend"]);
  });

  it("resolves once the player has picked", () => {
    const board = boardWith([caster, unit("foe1", 4, 6), unit("friend", 5, 6, { faction: "a" })]);
    const r = resolveTargets(spec, caster, board, { direction: "n", chosenIds: ["foe1"] });
    expect(r.needsChoice).toBe(false);
    expect(r.units.map((u) => u.unitId)).toEqual(["foe1"]);
  });

  it("rejects picking more than the allowed count", () => {
    const limited = { ...spec, selection: { ...spec.selection, count: 1 } };
    const board = boardWith([caster, unit("foe1", 4, 6), unit("foe2", 3, 6)]);
    const r = resolveTargets(limited, caster, board, { direction: "n", chosenIds: ["foe1", "foe2"] });
    expect(r.errors[0]).toMatch(/at most 1 target/);
  });
});

describe("choosers: nearest and random", () => {
  const board = boardWith([caster, unit("near", 6, 7), unit("mid", 6, 8), unit("far", 6, 9)]);
  const spec = (chooser) => ({
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 4 },
    selection: { relations: ["enemy"], chooser, count: 2 },
  });

  it("nearest sorts by distance", () => {
    expect(resolveTargets(spec("nearest"), caster, board).units.map((u) => u.unitId))
      .toEqual(["near", "mid"]);
  });

  it("random is deterministic for a given seed, so replays reproduce", () => {
    const a = resolveTargets(spec("random"), caster, board).units.map((u) => u.unitId);
    const b = resolveTargets(spec("random"), caster, board).units.map((u) => u.unitId);
    expect(a).toEqual(b);
    expect(a.length).toBe(2);
  });
});

describe("limits and legality", () => {
  const spec = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 2 },
    selection: { relations: ["enemy"], chooser: "all" },
    limits: { requiresZon: true },
  };

  it("blocks an NP from a Servant outside its Master's ZON, with the numbers", () => {
    const out = { ...caster, outsideZon: true, zonDistance: 4, zon: 2 };
    const board = boardWith([out, unit("foe", 6, 7)]);
    const r = resolveTargets(spec, out, board);
    expect(r.errors[0]).toMatch(/within its Master's ZON \(currently 4 panels away, ZON is 2\)/);
  });

  it("blocks a good-aligned Servant's AoE NP when a Civilian is in the area", () => {
    const good = { ...caster, alignment: { moral: "good" } };
    const board = boardWith([good, unit("civ", 6, 7, { kind: "civilian", faction: null })]);
    const r = resolveTargets(
      { ...spec, limits: { forbidCivilians: "ifGoodAligned" },
        selection: { relations: ["enemy", "neutral"], chooser: "all", kinds: ["servant", "civilian"] } },
      good, board);
    expect(r.errors[0]).toMatch(/Kill Humans/);
  });

  it("requires the caster to be inside a named zone", () => {
    const board = boardWith([caster, unit("foe", 6, 7)]);
    const r = resolveTargets({ ...spec, limits: { requiresCasterIn: "throneRoom" } }, caster, board);
    expect(r.errors[0]).toMatch(/only be used within throneRoom/);

    const inside = { ...caster, zones: ["throneRoom"] };
    expect(resolveTargets({ ...spec, limits: { requiresCasterIn: "throneRoom" } }, inside,
      boardWith([inside, unit("foe", 6, 7)])).errors).toEqual([]);
  });

  it("makes an empty area an error for an attack and a warning for a zone placement", () => {
    const board = boardWith([caster]);
    expect(resolveTargets({ ...spec, limits: {} }, caster, board).errors)
      .toContain("No legal targets in the selected area.");
    expect(resolveTargets({ ...spec, limits: {}, targetsRequired: false }, caster, board).warnings)
      .toContain("No legal targets in the selected area.");
  });
});

describe("multi-panel units", () => {
  it("are caught if ANY occupied panel intersects the area", () => {
    const giant = { ...unit("giant", 6, 10), panels: [at(6, 10), at(6, 11), at(7, 10), at(7, 11)] };
    const board = boardWith([caster, giant]);
    const spec = {
      anchor: { kind: "withinRange", range: 5, metric: "chebyshev" },
      shape: { kind: "rect", w: 3, h: 3 },
      selection: { relations: ["enemy"], chooser: "all" },
    };
    // A 3×3 centred on (6,9) covers (6,10) but not (6,11).
    const r = resolveTargets(spec, caster, board, { panel: at(6, 9) });
    expect(r.units.map((u) => u.unitId)).toEqual(["giant"]);
  });
});

describe("cross-level rules are per-platform, not global", () => {
  it("blocks a melee attack against a unit aboard a platform that requires ranged", () => {
    const flyer = unit("flyer", 6, 7, { level: 1, platformId: "hgob" });
    const board = boardWith([caster, flyer], { crossLevel: { hgob: { requiresRanged: true } } });
    const spec = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 2 },
      selection: { relations: ["enemy"], chooser: "all" },
      isMelee: true,
    };
    const r = resolveTargets(spec, caster, board);
    expect(r.units).toEqual([]);
    expect(r.warnings.some((w) => /ranged Attacks/.test(w))).toBe(true);
  });

  it("allows the same attack when the platform has no such rule", () => {
    const flyer = unit("flyer", 6, 7, { level: 1, platformId: "golden-hind" });
    const board = boardWith([caster, flyer], { crossLevel: { hgob: { requiresRanged: true } } });
    const spec = {
      anchor: { kind: "self" },
      shape: { kind: "chebyshevRadius", r: 2 },
      selection: { relations: ["enemy"], chooser: "all" },
      isMelee: true,
    };
    expect(resolveTargets(spec, caster, board).units.map((u) => u.unitId)).toEqual(["flyer"]);
  });
});

/* -------------------------------------------------------------------------- */

describe("validate — the same rules the resolver already knows", () => {
  const spec = {
    anchor: { kind: "withinRange", range: 3 },
    shape: { kind: "point" },
    selection: { relations: ["enemy"] },
  };
  const board = boardWith([unit("foe", 6, 8)]);

  it("passes a legal placement", () => {
    const v = validate(spec, caster, board, { panel: at(6, 8) });
    expect(v.ok).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  it("fails an out-of-range one, saying by how much", () => {
    const v = validate(spec, caster, board, { panel: at(6, 12) });
    expect(v.ok).toBe(false);
    expect(v.reasons[0]).toMatch(/6 panels away; Range is 3/);
  });

  it("carries the resolution through, so the caller need not resolve twice", () => {
    expect(validate(spec, caster, board, { panel: at(6, 8) }).resolved.units[0].unitId).toBe("foe");
  });
});

describe("legalPlacements — one function, four targeting modes", () => {
  const board = boardWith([unit("foe", 6, 8), unit("ally", 6, 5, { faction: "a" })]);

  it("returns exactly four options for the direction picker, always", () => {
    const spec = {
      anchor: { kind: "selfEdgeAdjacent" },
      shape: { kind: "orientedRect", short: 3, long: 3 },
      selection: { relations: ["enemy"] },
    };
    const options = legalPlacements(spec, caster, board);
    expect(options.length).toBe(4);
    expect(options.map((o) => o.placement.direction)).toEqual(["n", "e", "s", "w"]);
  });

  it("resolves each direction to its own panel set", () => {
    const spec = {
      anchor: { kind: "selfEdgeAdjacent" },
      shape: { kind: "orientedRect", short: 3, long: 3 },
      selection: { relations: ["enemy"] },
    };
    const options = legalPlacements(spec, caster, board);
    const east = options.find((o) => o.placement.direction === "e");
    expect(east.resolved.panels.every((p) => p.j > 6)).toBe(true);
    expect(east.resolved.units.map((u) => u.unitId)).toEqual(["foe"]);
  });

  it("returns illegal placements too, so the picker can explain them", () => {
    const spec = {
      anchor: { kind: "withinRange", range: 1 },
      shape: { kind: "point" },
      selection: { relations: ["enemy"] },
    };
    const options = legalPlacements(spec, caster, board);
    expect(options.some((o) => !o.legal)).toBe(true);
    expect(options.find((o) => !o.legal).reasons.length).toBeGreaterThan(0);
  });

  it("stays inside the board bounds", () => {
    const corner = { ...caster, panel: at(0, 0) };
    const spec = { anchor: { kind: "withinRange", range: 2 }, shape: { kind: "point" }, selection: {} };
    const options = legalPlacements(spec, corner, board);
    expect(options.every((o) => o.placement.panel.i >= 0 && o.placement.panel.j >= 0)).toBe(true);
  });

  it("lists every unit for the unit picker, and marks the unreachable ones", () => {
    const far = boardWith([unit("near", 6, 8), unit("far", 0, 0)]);
    const spec = {
      anchor: { kind: "targetUnit", range: 3 },
      shape: { kind: "point" },
      selection: { relations: ["enemy"] },
    };
    const options = legalPlacements(spec, caster, far);
    expect(options.length).toBe(2);
    expect(options.find((o) => o.placement.unitId === "near").legal).toBe(true);
    expect(options.find((o) => o.placement.unitId === "far").legal).toBe(false);
  });

  it("returns a single automatic placement for an anchor with no choice", () => {
    const spec = { anchor: { kind: "self" }, shape: { kind: "point" }, selection: { relations: ["self"] } };
    expect(legalPlacements(spec, caster, board).length).toBe(1);
  });

  it("honours the cap, so free placement on a huge board stays bounded", () => {
    const spec = { anchor: { kind: "withinRange", range: 6 }, shape: { kind: "point" }, selection: {} };
    expect(legalPlacements(spec, caster, board, { max: 10 }).length).toBe(10);
  });
});

describe("the picker vocabulary against the resolver (§29.6)", () => {
  it("offers only shapes `expand` can actually expand", () => {
    // The same drift guard the rule elements carry, for the same reason: a
    // shape offered in the editor that the resolver cannot expand produces an
    // ability that authors cleanly, validates, and targets nothing.
    const implemented = new Set(
      readFileSync("module/rules/targeting/shapes.mjs", "utf8")
        .match(/case "(\w+)":/g)
        ?.map((m) => m.slice(6, -2)) ?? [],
    );

    for (const id of SHAPE_IDS) {
      expect(implemented.has(id), `the picker offers "${id}" and expand() has no case for it`).toBe(true);
    }
  });

  it("offers every shape `expand` implements, so none is unreachable", () => {
    const implemented = new Set(
      readFileSync("module/rules/targeting/shapes.mjs", "utf8")
        .match(/case "(\w+)":/g)
        ?.map((m) => m.slice(6, -2)) ?? [],
    );

    for (const id of implemented) {
      expect(SHAPE_IDS, `expand() implements "${id}" and no GM can choose it`).toContain(id);
    }
  });

  it("gives every entry a schematic the picker can draw", () => {
    // §29.6: "they should see four little diagrams and click one". An entry
    // with no diagram is one a GM has to know the internal name of.
    for (const entry of [...TARGET_SHAPES, ...TARGET_ANCHORS]) {
      expect(entry.schematic.length, entry.id).toBe(5);
    }
  });

  it("gives every entry a label key that exists", () => {
    const strings = JSON.parse(readFileSync("lang/en.json", "utf8"));

    for (const entry of [...TARGET_SHAPES, ...TARGET_ANCHORS]) {
      expect(strings, entry.id).toHaveProperty(entry.label);
      expect(strings, entry.id).toHaveProperty(entry.hint);
    }
  });
});
