import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  TARGET_SHAPES, TARGET_ANCHORS, SHAPE_IDS, ANCHOR_IDS,
} from "../../module/rules/targeting/vocabulary.mjs";
import {
  resolveTargets, legalPlacements, validate, pendingChoiceErrors,
} from "../../module/rules/targeting/resolve.mjs";
import { expand, orthogonalAdjacentRect } from "../../module/rules/targeting/shapes.mjs";
import { choicePreselection, choiceIsComplete } from "../../module/apps/canvas/target-review.mjs";
import { squareBounds, key } from "../../module/domain/geometry.mjs";
import { targetSpecFor } from "../../module/rules/ability-use.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

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

// Presence Concealment clause 1: *"This Unit cannot be targeted for an **Attack or
// an enemy Unit's Skill**."* Step 7 dropped every concealed Unit from a chosen
// selection whatever its relation, so a concealed ALLY could not be healed,
// guarded or buffed by a single-target Skill (#133). The spec comes from the real
// ability through `targetSpecFor`, and the Units from the real projection, the
// ally holding the real `presenceConcealment` effect.
describe("a concealed ally and an allied Skill", () => {
  beforeAll(prepareSubjects, 60_000);

  /** `owner` (a corpus Servant) and an ally or enemy standing next to them, `hidden` or not. */
  const scene = (owner, { relation = "ally", hidden = true } = {}, fn) => withSubjects([
    { from: owner, id: owner, panel: { i: 6, j: 6 }, state: { factionId: "f1" } },
    {
      from: "heracles", id: "other", panel: { i: 6, j: 7 }, state: { factionId: relation === "ally" ? "f1" : "f2" },
      effects: hidden ? [{ defId: "presenceConcealment" }] : [],
    },
  ], ({ unit, board, world }) => fn({ unit, board, world, caster: unit(owner), other: unit("other") }), { settings: {} });

  /** The ability's real spec, as the Skill path builds it. */
  const specOf = ({ caster, world }, abilityId) => {
    const item = world.actor(caster.id).items.find((i) => i.system.contentId === abilityId);
    const reach = typeof caster.range === "number" ? caster.range : 1;
    return targetSpecFor(item, reach, rollOptionsFor({ attacker: caster }));
  };

  /** Who the resolver offers or picks, whether the pick is made yet or not. */
  const reached = (r) => [...r.units, ...(r.candidates ?? [])].map((t) => t.unitId);

  it("resolves a concealed ally for Medea's Teachings of Circe, which refused it", async () => {
    await scene("medea", {}, (ctx) => {
      expect(ctx.other.concealed).toBe(true);
      const spec = specOf(ctx, "medea-teachings-of-circe");
      expect(spec.limits.forAttack).toBe(false);
      const r = resolveTargets(spec, ctx.caster, ctx.board, { unitId: "other", panel: ctx.other.panel });
      expect(r.errors).toEqual([]);
      expect(r.units.map((u) => u.unitId)).toEqual(["other"]);
    });
  });

  it("still resolves the same ally when it is not concealed (the control)", async () => {
    await scene("medea", { hidden: false }, (ctx) => {
      const r = resolveTargets(specOf(ctx, "medea-teachings-of-circe"), ctx.caster, ctx.board,
        { unitId: "other", panel: ctx.other.panel });
      expect(r.units.map((u) => u.unitId)).toEqual(["other"]);
    });
  });

  it("still refuses a concealed ENEMY under the same spec shape: an enemy Unit's Skill is shut out", async () => {
    await scene("medea", { relation: "enemy" }, (ctx) => {
      const base = specOf(ctx, "medea-teachings-of-circe");
      const spec = { ...base, selection: { ...base.selection, relations: ["ally", "self", "enemy"] } };
      const r = resolveTargets(spec, ctx.caster, ctx.board, { unitId: "other", panel: ctx.other.panel });
      expect(r.units).toEqual([]);
      expect(r.errors.join(" ")).toMatch(/concealed/);
    });
  });

  it("still refuses a concealed ally for an ATTACK: forAttack holds it out whoever it is aimed at", async () => {
    await scene("medea", {}, (ctx) => {
      const base = specOf(ctx, "medea-teachings-of-circe");
      const spec = { ...base, limits: { ...base.limits, forAttack: true } };
      const r = resolveTargets(spec, ctx.caster, ctx.board, { unitId: "other", panel: ctx.other.panel });
      expect(r.units).toEqual([]);
      expect(r.errors.join(" ")).toMatch(/concealed/);
    });
  });

  it("a spec that does not say whether it is an Attack is held out as before", async () => {
    await scene("medea", {}, (ctx) => {
      const { limits: _dropped, ...spec } = specOf(ctx, "medea-teachings-of-circe");
      const r = resolveTargets(spec, ctx.caster, ctx.board, { unitId: "other", panel: ctx.other.panel });
      expect(r.units).toEqual([]);
    });
  });

  // The seven abilities a scan of `packs/_source` found authoring an ally relation with a chosen or
  // counted selection. The last two cannot be used from the interface yet (#129); this holds the
  // targeting half for when they can.
  it.each([
    ["jack-the-ripper", "jack-surgical-procedure"],
    ["kiritsugu", "kiritsugu-scapegoat"],
    ["medea", "medea-teachings-of-circe"],
    ["scathach", "scathach-ar"],
    ["scathach", "scathach-primordial-rune"],
    ["quetzalcoatl", "quetz-good-gods-wisdom"],
    ["van-gogh", "gogh-shadow-of-longing"],
  ])("%s's %s reaches a concealed ally", async (owner, abilityId) => {
    await scene(owner, {}, (ctx) => {
      const r = resolveTargets(specOf(ctx, abilityId), ctx.caster, ctx.board, { unitId: "other", panel: ctx.other.panel });
      expect(reached(r)).toContain("other");
    });
  });
});

describe("Master protection", () => {
  const spec = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 3 },
    selection: { relations: ["enemy"], chooser: "all" },
  };

  /** The same reach, but picking one unit rather than sweeping an area. */
  const chosen = { ...spec, selection: { ...spec.selection, chooser: "chosen", count: 1 } };

  it("excludes a Master standing next to its own Servant from a CHOSEN attack", () => {
    // Ch. 32 rule 1: "Masters cannot be TARGETED for an Attack when their
    // Servant is within 2 panels of their Master."
    const board = boardWith([
      caster,
      unit("master", 6, 8, { kind: "master" }),
      unit("guard", 6, 9),
    ]);
    // A chosen selection hands back CANDIDATES and waits for the pick, so the
    // exclusion shows there rather than in `units`.
    const r = resolveTargets(chosen, caster, board);
    expect(r.candidates.map((u) => u.unitId ?? u.id)).toEqual(["guard"]);
    expect(r.excluded.find((e) => e.unitId === "master").reason)
      .toMatch(/protected by an adjacent Servant/);
    expect(r.warnings).toContain("Protected Masters were excluded.");
  });

  it("still CATCHES that Master in an area, which is what Cover is about", () => {
    // Rule 1 refuses targeting; rule 4 opens with a Master who "gets CAUGHT IN
    // an AoE Noble Phantasm" while a Servant stands within those same 2 panels.
    // Filtering the splash too would make rule 4 — the Agility Check, the
    // shove, the divided +100%, the "not within the NP area" exclusion —
    // describe a state that could never occur. Found live: Cover was wired
    // end-to-end and never fired, because the Master was never in the area.
    const board = boardWith([
      caster,
      unit("master", 6, 8, { kind: "master" }),
      unit("guard", 6, 9),
    ]);
    const r = resolveTargets(spec, caster, board);
    expect(r.units.map((u) => u.unitId).sort()).toEqual(["guard", "master"]);
    expect(r.warnings).not.toContain("Protected Masters were excluded.");
  });

  it("refuses to AIM an area at a protected Master", () => {
    // The splash is not targeting; the anchor is. Aiming a Noble Phantasm at a
    // Master is exactly the thing rule 1 names.
    const board = boardWith([
      caster,
      unit("master", 6, 8, { kind: "master" }),
      unit("guard", 6, 9),
    ]);
    const aimed = { ...spec, anchor: { kind: "targetUnit", range: 6 } };
    const r = resolveTargets(aimed, caster, board, { unitId: "master" });
    expect(r.errors.join(" ")).toMatch(/protected by an adjacent Servant/);
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

describe("Bašmu's protection (Ch. 45, TargetabilityModifier)", () => {
  const spec = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 3 },
    selection: { relations: ["enemy"], chooser: "all" },
  };

  it("excludes a Unit an untargetable aura is protecting from an ENEMY caster", () => {
    const board = boardWith([
      caster,
      unit("protected", 6, 8, { untargetableBy: [{ source: "basmu" }] }),
      unit("exposed", 6, 9),
    ]);
    const r = resolveTargets(spec, caster, board);
    expect(r.units.map((u) => u.unitId)).toEqual(["exposed"]);
    // Names the protector rather than assuming Bašmu (§46.4-O).
    expect(r.warnings).toContain("A Unit protected by basmu was excluded.");
  });

  it("does not exclude it for an ALLY caster — the sheet says 'enemy Units'", () => {
    const ally = { id: "ally-caster", panel: at(6, 6), kind: "servant", faction: "b", range: 3 };
    const board = boardWith([
      ally,
      unit("protected", 6, 8, { untargetableBy: [{ source: "basmu" }] }),
    ], { alliances: { a: ["a"], b: ["b"] } });
    const allySpec = { ...spec, selection: { relations: ["ally"], chooser: "all", includeSelf: false } };
    expect(resolveTargets(allySpec, ally, board).units.map((u) => u.unitId)).toEqual(["protected"]);
  });

  it("names the protector that is actually standing there", () => {
    // The refusal and the warning both read "Bašmu" for every protector in the
    // game. TEN content files author a `TargetabilityModifier` -- Bašmu, the
    // three Dragon Tooth Warriors, Raikou's four retainers, the Sphinx Queen
    // and Tenmokaikai -- and the aura entry carries the real name on `source`.
    // Measured live: a Medea ringed by her own Dragon Tooth Warriors refused an
    // attack with "protected by a nearby Bašmu" (Ch. 46 §46.4-O).
    const board = boardWith([
      caster,
      unit("protected", 6, 8, { untargetableBy: [{ source: "Dragon Tooth Warrior (Blade)" }] }),
    ]);
    const r = resolveTargets(spec, caster, board);

    expect(r.warnings.join(" ")).toContain("Dragon Tooth Warrior (Blade)");
    expect(r.warnings.join(" ")).not.toContain("Bašmu");
  });

  it("still names Bašmu when Bašmu is the one protecting", () => {
    const board = boardWith([
      caster,
      unit("protected", 6, 8, { untargetableBy: [{ source: "Bašmu" }] }),
    ]);
    expect(resolveTargets(spec, caster, board).warnings.join(" ")).toContain("Bašmu");
  });

  it("falls back to a generic sentence when the aura names no source", () => {
    const board = boardWith([caster, unit("protected", 6, 8, { untargetableBy: [{}] })]);
    const r = resolveTargets(spec, caster, board);
    expect(r.units).toEqual([]);
    expect(r.warnings.length).toBe(1);
  });

  it("allows it once no untargetable aura reaches", () => {
    const board = boardWith([caster, unit("free", 6, 8)]);
    expect(resolveTargets(spec, caster, board).units.map((u) => u.unitId)).toEqual(["free"]);
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

// Found by the Quetzalcoatl paper trace (#65), then #129. The resolver answers a
// `chooser: chosen` selection with `units: []` and `needsChoice: true` until
// the placement carries `chosenIds`, and the session built that list from
// `resolved.units` -- always empty for this chooser, and an empty array is
// truthy, so the resolver read it as "the player chose nobody" and refused.
// 23 abilities author the chooser; 21 name their unit with the anchor, so for
// them there is one candidate and nothing to choose.
describe("chooser: chosen — a choice among one is no choice (#129)", () => {
  const targetingOf = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8")).targeting;
  const quetz = { id: "quetz", panel: at(6, 6), kind: "servant", faction: "a", range: 2 };
  const foe = unit("foe", 6, 8);

  it("Brahmastra (`targetUnit`, unit shape) settles on its one candidate", () => {
    const spec = targetingOf("karna-brahmastra");
    const board = boardWith([caster, foe]);
    const { resolved, ok } = validate(spec, caster, board, { unitId: "foe", panel: at(6, 8) });
    expect(ok).toBe(true);
    expect(resolved.needsChoice).toBe(false);
    expect(resolved.units.map((u) => u.unitId)).toEqual(["foe"]);
  });

  it("Xiuhcoatl (`withinRange`, unit shape) settles on its one candidate", () => {
    const spec = targetingOf("quetz-xiuhcoatl");
    const board = boardWith([quetz, foe]);
    const { resolved } = validate(spec, quetz, board, { panel: at(6, 8) });
    expect(resolved.needsChoice).toBe(false);
    expect(resolved.units.map((u) => u.unitId)).toEqual(["foe"]);
  });

  it("hands back ids the resolver accepts, which is what the session sends", () => {
    const spec = targetingOf("karna-brahmastra");
    const board = boardWith([caster, foe]);
    const placement = { unitId: "foe", panel: at(6, 8) };
    const settled = validate(spec, caster, board, placement).resolved;
    const sent = resolveTargets(spec, caster, board, {
      ...placement, chosenIds: settled.units.map((u) => u.unitId),
    });
    expect(sent.errors).toEqual([]);
    expect(sent.units.map((u) => u.unitId)).toEqual(["foe"]);
  });

  it("settles with the limits applied, not around them", () => {
    // A second resolution under the single candidate's id: a Counter that must
    // catch the attacker still refuses when the one candidate is not it.
    const spec = { ...targetingOf("karna-brahmastra"), limits: { requireUnitId: "someone-else" } };
    const board = boardWith([caster, foe]);
    const { ok, reasons } = validate(spec, caster, board, { unitId: "foe", panel: at(6, 8) });
    expect(ok).toBe(false);
    expect(reasons.join(" ")).toMatch(/must include/);
  });

  it("leaves the resolver's own contract alone: no choice made is still a choice owed", () => {
    const spec = targetingOf("karna-brahmastra");
    const board = boardWith([caster, foe]);
    const raw = resolveTargets(spec, caster, board, { unitId: "foe", panel: at(6, 8) });
    expect(raw.needsChoice).toBe(true);
    expect(raw.units).toEqual([]);
    expect(raw.candidates.map((c) => c.unitId)).toEqual(["foe"]);
  });

  describe("Good God's Wisdom, where there is something to choose", () => {
    const spec = targetingOf("quetz-good-gods-wisdom");
    const ally = unit("ally", 6, 7, { faction: "a" });
    const board = boardWith([quetz, ally]);

    it("still asks when two Units could be chosen", () => {
      const { resolved, ok } = validate(spec, quetz, board, {});
      expect(ok).toBe(true);
      expect(resolved.needsChoice).toBe(true);
      expect(resolved.candidates.map((c) => c.unitId).sort()).toEqual(["ally", "quetz"]);
    });

    it("resolves to the one she picked", () => {
      const r = resolveTargets(spec, quetz, board, { chosenIds: ["ally"] });
      expect(r.errors).toEqual([]);
      expect(r.units.map((u) => u.unitId)).toEqual(["ally"]);
    });

    it("refuses nobody, and refuses two", () => {
      expect(resolveTargets(spec, quetz, board, { chosenIds: [] }).errors.length).toBeGreaterThan(0);
      expect(resolveTargets(spec, quetz, board, { chosenIds: ["ally", "quetz"] }).errors[0])
        .toMatch(/at most 1 target/);
    });

    it("settles on herself when she is alone in the square", () => {
      const { resolved } = validate(spec, quetz, boardWith([quetz]), {});
      expect(resolved.needsChoice).toBe(false);
      expect(resolved.units.map((u) => u.unitId)).toEqual(["quetz"]);
    });
  });

  it("a choice that survives to the engine is refused, not run", () => {
    // `resolveAttack` returned `{needsChoice}` and did nothing, silently, and
    // `resolveSkillTargets` returned `units: []` and `errors: []` -- a Skill
    // from a macro ran its phases against nobody and still paid its cost.
    const spec = targetingOf("quetz-good-gods-wisdom");
    const board = boardWith([quetz, unit("ally", 6, 7, { faction: "a" })]);
    const raw = resolveTargets(spec, quetz, board, {});
    expect(raw.needsChoice).toBe(true);
    expect(pendingChoiceErrors(raw)).toEqual(["Choose a target."]);
    expect(pendingChoiceErrors({ needsChoice: false })).toEqual([]);
  });

  it("both engine entry points read the refusal, and the sheet's fallback sends a choice", () => {
    expect(readFileSync("module/engine/attack.mjs", "utf8")).toMatch(/pendingChoiceErrors\(targets\)/);
    expect(readFileSync("module/engine/skill-use.mjs", "utf8")).toMatch(/pendingChoiceErrors\(resolved\)/);
    const sheet = readFileSync("module/apps/actor-sheet/sheet.mjs", "utf8");
    const body = sheet.slice(sheet.indexOf("function legacyPlacement"));
    expect(body.slice(0, body.indexOf("\n}"))).toMatch(/chosenIds:\s*\[/);
  });
});

describe("the review dialog asks for a choice (#129)", () => {
  const two = [{ unitId: "a" }, { unitId: "b" }];

  it("ticks nothing when there is a real choice to make", () => {
    expect(choicePreselection(two, 1)).toEqual([]);
  });

  it("ticks everything when the ability takes every candidate anyway", () => {
    expect(choicePreselection(two, 2)).toEqual(["a", "b"]);
    expect(choicePreselection(two, Infinity)).toEqual(["a", "b"]);
  });

  it("keeps Use disabled until between one and the count are ticked", () => {
    expect(choiceIsComplete(0, 1)).toBe(false);
    expect(choiceIsComplete(1, 1)).toBe(true);
    expect(choiceIsComplete(2, 1)).toBe(false);
    expect(choiceIsComplete(5, Infinity)).toBe(true);
  });

  it("the session asks for an owed choice whatever the review setting says", () => {
    const layer = readFileSync("module/apps/canvas/targeting-layer.mjs", "utf8");
    const from = layer.indexOf("async #confirm");
    const confirm = layer.slice(from, layer.indexOf("async #run", from));
    expect(confirm).toMatch(/!resolved\.needsChoice && !game\.settings\.get\("fgt", "targetingReview"\)/);
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
  // Read at step 4d off the PLATFORM on the board. These were written against a
  // `board.crossLevel` map that was a second, redundant reader and is gone
  // (#138): hand-built boards that only confirmed the dead one.
  const deck = (crossLevel) => ({
    id: "hgob", kind: "platform", faction: "a", panel: at(5, 5), level: 1, footprint: { w: 1, h: 1 }, crossLevel,
  });
  const flyer = unit("flyer", 6, 7, { level: 1, platformId: "hgob" });
  const around = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 2 },
    selection: { relations: ["enemy"], chooser: "all" },
  };
  const melee = { ...caster, range: 1 };

  it("blocks a melee reach against a unit aboard a platform that requires ranged", () => {
    const board = boardWith([melee, deck({ occupantTargeting: "rangedOnly" }), flyer]);
    const r = resolveTargets(around, melee, board);
    expect(r.units.map((u) => u.unitId)).not.toContain("flyer");
    expect(r.excluded.find((e) => e.unitId === "flyer")?.reason).toMatch(/too short/);
  });

  it("allows the same reach from further away", () => {
    const board = boardWith([caster, deck({ occupantTargeting: "rangedOnly" }), flyer]);
    expect(resolveTargets(around, caster, board).units.map((u) => u.unitId)).toContain("flyer");
  });

  it("allows the same attack when the platform has no such rule", () => {
    const board = boardWith([melee, deck({ occupantTargeting: "free" }), flyer]);
    expect(resolveTargets(around, melee, board).units.map((u) => u.unitId)).toContain("flyer");
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

describe("the picker vocabulary against the resolver (Ch. 34)", () => {
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

  it("offers only anchors `resolveTargets` can resolve", () => {
    // The half this guard was missing, and it cost a live failure: the picker
    // listed `point` and the resolver's name for that is `withinRange`, so
    // Medea's Rain of Light authored cleanly, validated, and threw
    // `Unknown targeting anchor "point"` the first time anyone aimed it.
    const implemented = new Set(
      readFileSync("module/rules/targeting/resolve.mjs", "utf8")
        .match(/case "(\w+)":/g)
        ?.map((m) => m.slice(6, -2)) ?? [],
    );

    for (const id of ANCHOR_IDS) {
      expect(implemented.has(id), `the picker offers anchor "${id}" and the resolver has no case for it`)
        .toBe(true);
    }
  });

  it("offers every anchor the resolver implements, so none is unreachable", () => {
    // `resolve.mjs` also switches on selection modes and shapes, so only the
    // names that appear in BOTH files are anchors -- an id the vocabulary knows
    // nothing about is either an anchor nobody can choose or another switch.
    const anchorCases = readFileSync("module/rules/targeting/resolve.mjs", "utf8")
      .split("function resolveAnchor")[1] ?? "";
    const implemented = new Set(
      (anchorCases.match(/case "(\w+)":/g) ?? []).map((m) => m.slice(6, -2)),
    );

    for (const id of implemented) {
      expect(ANCHOR_IDS, `the resolver implements anchor "${id}" and no GM can choose it`).toContain(id);
    }
  });

  it("gives every entry a schematic the picker can draw", () => {
    // Ch. 34: "they should see four little diagrams and click one". An entry
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

describe("limits.requireUnitId", () => {
  // A Counter may be aimed anywhere as long as it catches the unit that
  // attacked you (Ch. 21). Expressed as a targeting LIMIT rather than a check
  // after the fact, so the refusal is drawn under the cursor while the player
  // is still aiming — Ch. 20's rule for every other legality clause.
  const board = boardWith([caster, unit("attacker", 6, 8), unit("bystander", 6, 9)]);
  const spec = (limits) => ({
    anchor: { kind: "targetUnit", range: 3 },
    shape: { kind: "unit" },
    selection: { relations: ["enemy"], chooser: "all", count: 1 },
    limits,
  });

  it("passes when the required unit is caught", () => {
    const v = validate(spec({ requireUnitId: "attacker" }), caster, board, { unitId: "attacker" });
    expect(v.ok).toBe(true);
  });

  it("refuses when it is not, and names whose fault it is", () => {
    const v = validate(spec({ requireUnitId: "attacker" }), caster, board, { unitId: "bystander" });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/Counter must include/);
  });

  it("changes nothing when the limit is absent", () => {
    expect(validate(spec({}), caster, board, { unitId: "bystander" }).ok).toBe(true);
  });
});

describe("limits.excludeUnitIds", () => {
  // Ch. 21's redirect has two halves. `requireUnitId` is the half that says who
  // must be caught; this is the half that says who must NOT be, so a Master
  // whose Servant shields it takes nothing even from an area that covers it.
  const board = boardWith([caster, unit("master", 6, 7, { kind: "master" }), unit("guard", 6, 8)]);
  const spec = (limits) => ({
    anchor: { kind: "withinRange", range: 4 },
    shape: { kind: "rect", w: 3, h: 3 },
    selection: { relations: ["enemy"], chooser: "all" },
    limits,
  });

  it("drops the named unit from the targets", () => {
    const out = resolveTargets(spec({ excludeUnitIds: ["master"] }), caster, board, { panel: at(6, 7) });
    expect(out.units.map((u) => u.unitId)).not.toContain("master");
  });

  it("keeps everything else the area caught", () => {
    const out = resolveTargets(spec({ excludeUnitIds: ["master"] }), caster, board, { panel: at(6, 7) });
    expect(out.units.map((u) => u.unitId)).toContain("guard");
  });

  it("records WHY, so the targeting preview can show it", () => {
    // A unit that silently vanishes from the preview reads as a bug. The
    // exclusion has to say the rule that caused it.
    const out = resolveTargets(spec({ excludeUnitIds: ["master"] }), caster, board, { panel: at(6, 7) });
    const row = out.excluded.find((e) => e.unitId === "master");
    expect(row).toBeTruthy();
    expect(row.reason).toMatch(/Counter is redirected/);
  });

  it("changes nothing when the limit is absent", () => {
    const out = resolveTargets(spec({}), caster, board, { panel: at(6, 7) });
    expect(out.units.map((u) => u.unitId)).toContain("master");
  });

  it("combines with requireUnitId", () => {
    // The redirect in one call: the Master out, the Servant required.
    const out = resolveTargets(
      spec({ excludeUnitIds: ["master"], requireUnitId: "guard" }), caster, board, { panel: at(6, 7) },
    );
    expect(out.errors).toEqual([]);
    expect(out.units.map((u) => u.unitId)).toEqual(["guard"]);
  });
});

/* -------------------------------------------------------------------------- */

describe("Range from a multi-panel unit (Ch. 05)", () => {
  // The Hanging Gardens: a 9x9 platform anchored at (2,2), so its deck runs
  // (2,2)..(10,10). Its own Dragon Wing Warriors is Range 4.
  const deck = [];
  for (let i = 2; i <= 10; i++) for (let j = 2; j <= 10; j++) deck.push(at(i, j));
  const garden = {
    id: "hgob", kind: "platform", faction: "a", panel: at(2, 2), panels: deck, range: 4,
  };
  const spec = {
    anchor: { kind: "withinRange", range: 4, metric: "chebyshev" },
    shape: { kind: "square", size: 5 },
    selection: { relations: ["enemy"] },
  };
  // Wide enough that four panels past the deck's far edge is still on the
  // board, and seeded with enemies so the shape always has something to hit --
  // an empty area is refused for a reason that has nothing to do with Range.
  const wide = squareBounds(21);
  const board = boardWith([unit("far", 10, 10), unit("beyond", 10, 14)], { bounds: wide });

  it("reaches its own far corner, which its anchor panel cannot", () => {
    // (10,10) is 8 panels from the anchor at (2,2) and 0 from the deck.
    expect(validate(spec, garden, board, { panel: at(10, 10) }).ok).toBe(true);
  });

  it("reaches four panels beyond its far edge", () => {
    expect(validate(spec, garden, board, { panel: at(10, 14) }).ok).toBe(true);
  });

  it("still refuses a panel beyond that", () => {
    const verdict = validate(spec, garden, board, { panel: at(10, 15) });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join(" ")).toContain("Range is 4");
  });

  it("offers those panels in the overlay, without repeating any", () => {
    const options = legalPlacements(spec, garden, board, { max: 10000 });
    const keys = options.map((o) => key(o.placement.panel));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("10,14");
  });

  it("measures a one-panel unit from where it stands, as before", () => {
    const lone = { ...caster, range: 4 };
    expect(validate(spec, lone, board, { panel: at(9, 9) }).ok).toBe(true);
    expect(validate(spec, lone, board, { panel: at(10, 14) }).ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */

// A Unit is in Range if any part of it is. Bašmu is 3x3, and the target-a-unit
// anchor measured Range to its TOP-LEFT panel only: on the Semiramis audit
// (#68), Heracles standing beside the garden's middle was told the Hanging
// Gardens was "out of Range (2)", measured to its (0,0) corner (§46.4-BT).
describe("targetUnit — measured to the whole target", () => {
  const block = (i0, j0, w) => Array.from({ length: w }, (_, di) =>
    Array.from({ length: w }, (_, dj) => at(i0 + di, j0 + dj))).flat();
  const basmu = unit("basmu", 3, 3, { panels: block(3, 3, 3) });
  const spec = { anchor: { kind: "targetUnit", range: 1 }, shape: { kind: "unit" }, selection: { relations: ["enemy"], count: 1 } };

  it("reaches a 3x3 Unit from beside its far edge", () => {
    const beside = { ...caster, panel: at(6, 4), range: 1 };
    const r = resolveTargets(spec, beside, boardWith([basmu]), { unitId: "basmu" });
    expect(r.errors).toEqual([]);
    expect(r.units.map((u) => u.unitId)).toEqual(["basmu"]);
  });

  it("still refuses one genuinely out of Range", () => {
    const far = { ...caster, panel: at(8, 4), range: 1 };
    expect(resolveTargets(spec, far, boardWith([basmu]), { unitId: "basmu" }).errors).toEqual(["Target is out of Range (1)."]);
  });
});

/* -------------------------------------------------------------------------- */

describe("cross-level protection in the target ladder (Ch. 27)", () => {
  // A 3x3 platform at level 2 anchored at (5,5), forbidding attacks straight
  // down — the Hanging Gardens' own configuration, in miniature.
  const deck = [at(5, 5), at(5, 6), at(5, 7), at(6, 5), at(6, 6), at(6, 7), at(7, 5), at(7, 6), at(7, 7)];
  const hgob = {
    id: "hgob", kind: "platform", faction: "a", panel: at(5, 5), panels: deck, level: 2,
    footprint: { w: 3, h: 3 },
    crossLevel: {
      occupantTargeting: "forbidden", aoePassengerFactor: 0,
      aoeMastersImmune: false, outboundTargeting: "rangedOnly", forbidDirectlyBelow: true,
    },
  };
  // The platform firing its own Skill. `range: 0` is the sheet's "does not
  // Normal Attack", which is exactly what must NOT be used as the reach.
  const gunner = { ...hgob, range: 0 };
  const below = unit("below", 6, 6, { level: 0 });
  const board = boardWith([hgob, below]);
  const spec = (over = {}) => ({
    anchor: { kind: "withinRange", range: 4, metric: "chebyshev" },
    shape: { kind: "square", size: 3 },
    selection: { relations: ["enemy"] },
    ...over,
  });

  it("refuses a target directly below the platform", () => {
    const v = validate(spec(), gunner, board, { panel: at(6, 6) });
    expect(v.ok).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/directly below/);
  });

  it("allows it for the one ability whose sheet says it reaches under", () => {
    expect(validate(spec({ allowDirectlyBelow: true }), gunner, board, { panel: at(6, 6) }).ok).toBe(true);
  });

  it("measures the ability's Range, not the platform's own", () => {
    // `gunner.range` is 0 — "does not Normal Attack" — so reading it would
    // refuse every cross-level shot as melee, including this one.
    expect(validate(spec({ allowDirectlyBelow: true }), gunner, board, { panel: at(6, 6) }).ok).toBe(true);
  });

  // *"Range=7. Cannot hit under or above the HGoB."* Against Dragon Wing
  // Warriors' *"plus the area under the HGoB and the area of the HGoB"*, the
  // area OF the garden is what "above" names: a Unit standing on its deck.
  // Only "under" was modelled, so on the Semiramis audit (#68) the preview of
  // Aerial Garden of Vanity listed Heracles, aboard, as a target.
  describe("Aerial Garden of Vanity and the deck", () => {
    const targetingOf = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8")).targeting;
    const aboard = unit("aboard", 6, 7, { level: 2 });
    const ground = unit("ground", 6, 9, { level: 0 });
    const decked = boardWith([hgob, aboard, ground]);

    it("does not hit a Unit standing on the garden", () => {
      const agv = targetingOf("semiramis-hgob-aerial-garden-of-vanity");
      const ids = resolveTargets(agv, gunner, decked, { panel: at(6, 8) }).units.map((u) => u.unitId);
      expect(ids).not.toContain("aboard");
      expect(ids).toContain("ground");
    });

    it("while Dragon Wing Warriors, which names the area of the garden, still does", () => {
      const dww = targetingOf("semiramis-hgob-dragon-wing-warriors");
      const ids = resolveTargets(dww, gunner, decked, { panel: at(6, 8) }).units.map((u) => u.unitId);
      expect(ids).toContain("aboard");
    });
  });

  // *"Enemy Units on the ground can only Attack the HGoB with ranged
  // Attacks"* -- which says they CAN, and *"Destroyed when ... its Health drops
  // to 0"* needs a way for it to. Step 5 dropped every platform as "a
  // platform" unless an ability named `kinds`, and no Normal Attack does, so
  // `hullTargeting` was reached by nothing and the garden could not be
  // attacked at all (§46.4-BS).
  describe("the garden's own hull", () => {
    const hull = { ...hgob, faction: "a", maxHealth: 6000, health: 6000, crossLevel: { ...hgob.crossLevel, hullTargeting: "rangedOnly" } };
    const archer = unit("archer", 6, 10, { level: 0, faction: "b", range: 3 });
    const decked = boardWith([hull, archer]);
    const shot = (over = {}) => ({
      anchor: { kind: "withinRange", range: 3, metric: "chebyshev" },
      shape: { kind: "square", size: 1 },
      selection: { relations: ["enemy"] },
      ...over,
    });

    it("can be shot from the ground at range", () => {
      const ids = resolveTargets(shot(), archer, decked, { panel: at(6, 7) }).units.map((u) => u.unitId);
      expect(ids).toEqual(["hgob"]);
    });

    it("stays out of reach of a platform with no Health to lose", () => {
      const scenery = { ...hull, maxHealth: null, health: null };
      const ids = resolveTargets(shot(), archer, boardWith([scenery, archer]), { panel: at(6, 7) }).units.map((u) => u.unitId);
      expect(ids).toEqual([]);
    });
  });

  it("leaves same-level targeting untouched", () => {
    const ground = boardWith([unit("foe", 6, 6)]);
    expect(validate(spec(), { ...caster, range: 4 }, ground, { panel: at(6, 6) }).ok).toBe(true);
  });
});

/**
 * A facing that reaches the shape.
 *
 * `orientedRect` reads `anchor.direction`, and until Drake only
 * `selfEdgeAdjacent` ever supplied one -- which is why Nemo's Barrel Bombing
 * pairs the two. The `platform` and `self` anchors returned no direction at
 * all, so a 7x3 anchored on the Golden Hind would have fired due north
 * whichever way the bow pointed, and the shipless branch the same.
 *
 * The facing itself was never missing: `PlatformData` spreads `unitCommon()`,
 * so a platform has carried `system.facing` all along and `snapshot.mjs`
 * projects it. Nothing had ever asked the anchor for it.
 */
describe("orientedRect — the vocabulary matches the shape", () => {
  it("declares the fields the shape actually reads", () => {
    // `shapes.mjs` reads `shape.short` and `shape.long`; the entry said w/h,
    // so the ability editor prompted for two fields nothing reads.
    const entry = TARGET_SHAPES.find((s) => s.id === "orientedRect");
    expect(entry.needs).toEqual(["short", "long"]);
  });

  it("is authored as short/long by the content that already uses it", () => {
    const berserker = parse(readFileSync(
      "packs/_source/abilities/normal-berserker-np-a.yml", "utf8",
    ));
    expect(berserker.targeting.shape).toMatchObject({ kind: "orientedRect" });
    expect(berserker.targeting.shape.short).toBeDefined();
    expect(berserker.targeting.shape.w).toBeUndefined();
  });
});
