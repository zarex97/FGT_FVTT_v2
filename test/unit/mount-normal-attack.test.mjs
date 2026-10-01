/**
 * @file A rider's replaced Normal Attack is previewed and ranged as the mount's (#167, #171).
 * @see module/engine/attack.mjs#previewContext, #targetSpecFor, #counterAvailable, module/rules/platforms.mjs#attackSourceOf, docs/27-platforms-and-levels.md
 *
 * > *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack is replaced with
 * > Quetzalcoatlus'."*
 *
 * The damage half of that sentence swapped the whole source (`baseSpecFor`, `attackFacts`) while two
 * other readers kept her own: the targeting preview showed her BA(STR) 125 where the card dealt the
 * mount's 150 (#167), and Range was the mount's number measured from her ONE panel instead of from the
 * mount's footprint (#171). Found live by the Quetzalcoatl audit (#65).
 *
 * Every subject is authored content through the real compile, the real DataModel and the real projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { importAttack } from "../helpers/engine.mjs";
import { attackSourceOf } from "../../module/rules/platforms.mjs";
import { damageRange, rollsFor } from "../../module/rules/preview.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = { quetz: "quetzSubject0001", mast: "mastrSubject0001", mount: "mountSubject0001", enemy: "enemySubject0001" };

/**
 * The mount is 2x2 from (5,5): panels (5,5) (5,6) (6,5) (6,6). She rides its top-right panel (5,6), aboard
 * (level 1), and an enemy stands at `panel`, on the ground. `quetzPanel` puts her somewhere else.
 */
const FOOTPRINT = [{ i: 5, j: 5, k: 1 }, { i: 5, j: 6, k: 1 }, { i: 6, j: 5, k: 1 }, { i: 6, j: 6, k: 1 }];
const ride = (panel, quetzPanel = { i: 5, j: 6, k: 1 }) => [
  { from: "quetzalcoatl", id: ID.quetz, state: { masterId: ID.mast, factionId: "red" }, panel: quetzPanel },
  { from: "master-advanced", id: ID.mast, state: { factionId: "red" }, panel: { i: 5, j: 5, k: 1 } },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz, factionId: "red" }, footprint: FOOTPRINT },
  { from: "heracles", id: ID.enemy, state: { factionId: "blue" }, panel },
];

/** She is not on the mount: the same board, with her afoot. */
const afoot = { i: 9, j: 9, k: 0 };

describe("the targeting preview of her Normal Attack is the mount's (#167)", () => {
  it("is built from the mount's Base Attack, and the range contains the total the resolution reaches", async () => {
    const { previewContext } = await importAttack();
    const out = await withSubjects(ride({ i: 8, j: 6, k: 0 }), ({ units, unit, board }) => {
      // The sheet hands the preview a bare `unitSnapshot`, which carries no `platformId`: the board has it.
      const ctx = previewContext({ caster: units[0], defender: unit(ID.enemy), ability: null, board, isNP: false });
      const range = damageRange(ctx);
      const at = (which) => rollsFor(which, { isCrit: false });

      // What the resolution builds: `baseSpecFor` -> the mount's source, `namedUnits` -> `ctx.units.mount`.
      const resolve = (base, units, which) => computeDamage({ ...ctx, base, units, rolls: at(which) }).total;
      const mount = { sources: [{ unit: "mount", component: "str", factor: 1 }] };
      const hers = { sources: [{ unit: "self", component: "str", factor: 1 }] };
      return {
        sources: ctx.base.sources,
        named: Object.keys(ctx.units ?? {}),
        range,
        resolved: [resolve(mount, { mount: unit(ID.mount) }, "min"), resolve(mount, { mount: unit(ID.mount) }, "max")],
        herOwn: resolve(hers, {}, "max"),
      };
    });

    expect(out.sources).toEqual([{ unit: "mount", component: "str", factor: 1 }]);
    expect(out.named).toEqual(["mount"]);
    // The range's two ends ARE the resolved totals at the two ends of the dice, so any total between them is inside.
    expect(out.range.min).toBe(Math.min(...out.resolved));
    expect(out.range.max).toBe(Math.max(...out.resolved));
    // Her own BA(STR) is 125 and the mount's 150: the number the player was shown was the lesser one.
    expect(out.range.max).toBeGreaterThan(out.herOwn);
  });

  it("is her own while she is not riding", async () => {
    const { previewContext } = await importAttack();
    const out = await withSubjects(ride({ i: 8, j: 6, k: 0 }, afoot), ({ unit, board }) => {
      const ctx = previewContext({ caster: unit(ID.quetz), defender: unit(ID.enemy), ability: null, board, isNP: false });
      return { sources: ctx.base.sources, units: ctx.units };
    });
    expect(out.sources[0].unit).toBe("self");
    expect(out.units).toEqual({});
  });

  it("builds the base through the one function the resolution uses", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    // The definition, `baseSpecFor` and `previewContext`.
    expect(src.match(/normalAttackBase\(/g)).toHaveLength(3);
    expect(src.slice(src.indexOf("export function previewContext"))).toMatch(/units: namedUnits\(caster, board\)/);
  });
});

describe("the Range of her Normal Attack is measured from the mount's footprint (#171)", () => {
  /** Her bare Normal Attack on the enemy, through the spec the engine declares. */
  const aimAt = (panel, { stamped = true } = {}) => withSubjects(ride(panel), async ({ unit, board, world }) => {
    const { targetSpecForAttack } = await importAttack();
    const spec = targetSpecForAttack(world.actor(ID.quetz), null, null, board);
    const used = stamped ? spec : { ...spec, anchor: { ...spec.anchor, originUnitId: undefined } };
    const resolved = resolveTargets(used, unit(ID.quetz), board, { unitId: ID.enemy });
    return { anchor: spec.anchor, errors: resolved.errors, hit: resolved.units.map((u) => u.unitId) };
  });

  it("allows a target 2 panels from the footprint's far side, which is 3 from her own panel", async () => {
    // She stands on (5,6) and the footprint's far edge is row 6: (8,6) is 2 from (6,6) and 3 from (5,6).
    const out = await aimAt({ i: 8, j: 6, k: 0 });
    expect(out.anchor).toMatchObject({ kind: "targetUnit", range: 2, originUnitId: ID.mount });
    expect(out.errors).toEqual([]);
    expect(out.hit).toEqual([ID.enemy]);
  });

  it("would have refused him from her own panel, which is what the bug did", async () => {
    const out = await aimAt({ i: 8, j: 6, k: 0 }, { stamped: false });
    expect(out.errors.join(" ")).toMatch(/out of Range \(2\)/);
  });

  it("refuses a target out of reach of the whole footprint", async () => {
    const out = await aimAt({ i: 9, j: 6, k: 0 });
    // 3 from (6,6) and 4 from her own panel. The resolver names the refusal; the placement is illegal.
    expect(out.errors.join(" ")).toMatch(/Heracles is out of Range \(2\)/);
  });

  it("names the mount as the origin of her Normal Attack only, and not of what she casts herself", async () => {
    const out = await withSubjects(ride({ i: 8, j: 6, k: 0 }), async ({ board, world }) => {
      const { targetSpecForAttack } = await importAttack();
      const doc = world.actor(ID.quetz);
      const spell = doc.items.find((i) => i.system.contentId === "quetz-tlahuitequiliztli");
      return {
        found: Boolean(spell),
        normal: targetSpecForAttack(doc, null, null, board).anchor.originUnitId,
        spell: targetSpecForAttack(doc, spell, null, board).anchor?.originUnitId,
      };
    });
    expect(out.found).toBe(true);
    expect(out.normal).toBe(ID.mount);
    expect(out.spell).toBeUndefined();
  });

  it("does not name it once she is afoot", async () => {
    const out = await withSubjects(ride({ i: 8, j: 6, k: 0 }, afoot), async ({ board, world }) => {
      const { targetSpecForAttack } = await importAttack();
      return targetSpecForAttack(world.actor(ID.quetz), null, null, board).anchor;
    });
    expect(out.originUnitId).toBeUndefined();
  });

  it("is one answer: `attackSourceOf` gives the footprint and Range she swings from, hers when afoot", async () => {
    const out = await withSubjects(ride({ i: 8, j: 6, k: 0 }), ({ unit, board }) => ({
      riding: attackSourceOf(unit(ID.quetz), board),
      master: attackSourceOf(unit(ID.mast), board),
    }));
    expect(out.riding.range).toBe(2);
    expect(out.riding.attacksAsPlatform).toBe(true);
    expect(out.riding.panels).toHaveLength(4);
    expect(out.master.attacksAsPlatform).toBe(false);
    expect(out.master.panels).toHaveLength(1);

    const own = await withSubjects(ride({ i: 8, j: 6, k: 0 }, afoot), ({ unit, board }) => attackSourceOf(unit(ID.quetz), board));
    expect(own.attacksAsPlatform).toBe(false);
    expect(own.panels).toEqual([afoot]);
  });

  it("is asked by the Counter rung, the threat overlay and the resolver, and not re-derived", () => {
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    const rung = attack.slice(attack.indexOf("function counterAvailable"), attack.indexOf("async function runCounter"));
    expect(rung).toMatch(/attackSourceOf\(defender, board\)/);
    expect(rung).not.toMatch(/defender\.panels/);
    expect(readFileSync("module/apps/canvas/overlay-layer.mjs", "utf8")).toMatch(/attackSourceOf\(unit, board\)/);
    expect(readFileSync("module/rules/targeting/resolve.mjs", "utf8")).toMatch(/spec\.originUnitId/);
  });
});
