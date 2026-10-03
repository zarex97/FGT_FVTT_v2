/**
 * @file Xiuhcoatl's [Fortress] clause burns a Fortress NP, and only until it ends (#152).
 * @see module/engine/skill-use.mjs#fortressesNearby, #zonePaints, module/engine/terrain.mjs#clearTerrainBoundTo, docs/26-terrain.md
 *
 * > *"If this NP is used within or directly next to a [Fortress] NP (regardless
 * > of ally's or enemy's), that NP area and the panels directly outside/next to
 * > the NP area are now 'Burning' until the Fortress NP is deactivated."*
 *
 * Ruled by the author: a [Fortress] NP means one tagged `fortress` --
 * Ramesseum Tentyris -- and not `antiFortress`. The reader accepted both, so a
 * field tagged like Piedra Del Sol (`antiArmy, antiFortress`) read as a
 * Fortress and Xiuhcoatl used in or beside her own stone painted Burning over
 * the 9x9, permanently. And *"until the Fortress NP is deactivated"* had no
 * reader at all: the zone had `duration: null` and no field's `onEnd` named the
 * tag, so the Burning outlived the Fortress, a second use moved the one area off
 * the first Fortress, and a use beside none left the old area where it was.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { withWorld } from "../helpers/world.mjs";
import { fieldsOf, squareAround, compiled, prepareFields } from "../helpers/field.mjs";
import { fortressesNearby, zonePaints } from "../../module/engine/skill-use.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const QZ = "quetzalcoatlAct1";
const QUETZ = { from: "quetzalcoatl", id: QZ, state: { factionId: "A" }, panel: { i: 6, j: 6 } };

const stone = { ability: "quetz-piedra-del-sol", owner: QZ, faction: "A", panels: squareAround({ i: 6, j: 6 }, 7) };
const complex = (over = {}) => ({
  ability: "ozymandias-ramesseum-tentyris", owner: "ozymandiasAct001", faction: "B",
  panels: squareAround({ i: 6, j: 14 }, 11), ...over,
});

/** The Fortress fields Quetzalcoatl at (6, 6) can reach, on a board holding `casts`. */
async function nearby(casts, at = { i: 6, j: 6 }) {
  const fields = await fieldsOf(casts);
  return withSubjects([{ ...QUETZ, panel: at }], ({ board, unit }) => fortressesNearby(unit(QZ), board),
    { settings: { fields } });
}

describe("what counts as a [Fortress] NP", () => {
  it("is not Piedra Del Sol, which is tagged antiFortress and not fortress", async () => {
    expect((await compiled("quetz-piedra-del-sol")).system.npTags).toContain("antiFortress");
    // Quetzalcoatl at the stone's very centre, "within" it.
    expect(await nearby([stone])).toEqual([]);
  });

  it("is Ramesseum Tentyris, which is tagged fortress", async () => {
    expect((await compiled("ozymandias-ramesseum-tentyris")).system.npTags).toContain("fortress");
    // The Complex is an 11x11 around (6, 14): columns 9 to 19. Quetzalcoatl one panel outside it.
    const found = await nearby([complex()], { i: 6, j: 8 });
    expect(found).toHaveLength(1);
    expect(found[0].fieldId).toBe("ozymandias-ramesseum-tentyris");
  });

  it("is reached from beside it, and not from further away", async () => {
    expect(await nearby([complex()], { i: 6, j: 7 })).toEqual([]);
  });

  it("gives the field's own panels plus the ring outside it, once each", async () => {
    const [found] = await nearby([complex()], { i: 6, j: 8 });
    const keys = found.panels.map((p) => `${p.i},${p.j}`);
    expect(new Set(keys).size).toBe(keys.length);
    // 11x11 = 121, and with the ring around it the 13x13 = 169.
    expect(keys).toHaveLength(169);
    expect(keys).toContain("0,8");
    expect(keys).toContain("12,20");
  });
});

describe("the zone phase paints one area per Fortress, each bound to its own", () => {
  const zone = async () => {
    const ability = await compiled("quetz-xiuhcoatl");
    return { ability, spec: ability.system.phases.find((p) => p.kind === "zone").spec };
  };

  /**
   * What the zone paints for Xiuhcoatl aimed at a Unit standing on `target`,
   * with Quetzalcoatl at `at`. The check is measured from the TARGET since the
   * user ruled it so (2026-10-02, #65); the attack flow hands the panels it
   * resolved against in as `areaPanels`.
   */
  async function painted(casts, target = { i: 6, j: 8 }, at = { i: 6, j: 2 }) {
    const fields = await fieldsOf(casts);
    const { ability, spec } = await zone();
    return withSubjects([{ ...QUETZ, panel: at }], ({ board, unit }) =>
      zonePaints(spec, ability, { id: QZ }, unit(QZ), { ...board, bounds: squareBounds(13) }, { areaPanels: [target] }),
    { settings: { fields } });
  }

  it("measures from the target: aimed beside the Fortress from far away, it paints", async () => {
    const { spec } = await zone();
    expect(spec.from).toBe("target");
    expect(await painted([complex()], { i: 6, j: 8 }, { i: 6, j: 2 })).toHaveLength(1);
  });

  it("measures from the target: she beside the Fortress, aimed away from it, paints nothing", async () => {
    expect(await painted([complex()], { i: 6, j: 4 }, { i: 6, j: 8 })).toEqual([]);
  });

  it("paints one Burning area for one Fortress, bound to that field", async () => {
    const paints = await painted([complex()]);
    expect(paints).toHaveLength(1);
    expect(paints[0]).toMatchObject({
      types: ["burning"], boundToFieldId: "ozymandias-ramesseum-tentyris", duration: null,
    });
    expect(paints[0].panels).toHaveLength(169);
  });

  it("paints two areas under two tags for two Fortresses, each bound to its own", async () => {
    const paints = await painted([
      complex(),
      complex({ as: "second-fortress", owner: "ozymandiasAct002", panels: squareAround({ i: 8, j: 8 }, 3), faction: "C" }),
    ]);
    expect(paints.map((p) => p.boundToFieldId).sort()).toEqual(["ozymandias-ramesseum-tentyris", "second-fortress"]);
    expect(new Set(paints.map((p) => p.tag)).size).toBe(2);
    // One does not take the other's panels, so ending one cannot clear the other's ground.
    const [a, b] = paints;
    expect(a.panels).not.toEqual(b.panels);
  });

  it("paints nothing beside no Fortress, so a second use cannot leave or move an old area", async () => {
    expect(await painted([stone])).toEqual([]);
  });

  it("still paints an ordinary zone as one area, bound to nothing", async () => {
    const ability = await compiled("quetz-charisma-of-the-sun");
    const spec = ability.system.phases.find((p) => p.kind === "zone").spec;
    const paints = await withSubjects([QUETZ], ({ board, unit }) =>
      zonePaints(spec, ability, { id: QZ }, unit(QZ), { ...board, bounds: squareBounds(13) }));
    expect(paints).toHaveLength(1);
    expect(paints[0].boundToFieldId ?? null).toBeNull();
  });

  it("is what the zone case paints, one call per area", () => {
    const source = readFileSync("module/engine/skill-use.mjs", "utf8");
    const zoneCase = source.slice(source.indexOf('case "zone": {'), source.indexOf('case "dragInto"'));
    expect(zoneCase).toMatch(/zonePaints\(/);
    expect(zoneCase).toMatch(/for \(const paint of paints\)/);
  });
});

describe("the Burning ends with its Fortress", () => {
  /** A scene whose Regions are these `terrain` behaviours, the way `terrainBehaviors` reads them. */
  async function withScene(paints, fn) {
    const models = await (await import("../../tools/lib/foundry.mjs")).installSystem();
    const { terrainDataOf } = await import("../../module/engine/terrain.mjs");
    const regions = paints.map((paint, n) => ({
      id: `r${n}`,
      behaviors: [{ type: "terrain", disabled: false, system: new models.RegionBehavior.terrain(
        structuredClone(terrainDataOf(paint, null)), { strict: true }).toObject() }],
    }));
    const deleted = [];
    return withWorld({}, async () => {
      globalThis.canvas = {
        ...globalThis.canvas,
        scene: {
          regions, grid: { size: 100 },
          deleteEmbeddedDocuments: async (type, ids) => { deleted.push(...ids); },
        },
      };
      return fn(deleted);
    });
  }

  const paint = (tag, boundToFieldId) => ({ types: ["burning"], panels: [{ i: 1, j: 1 }], tag, boundToFieldId });

  it("clears the areas bound to the closing field, and no other", async () => {
    const deleted = await withScene(
      [paint("a", "fortress-one"), paint("b", "fortress-two"), paint("c", null), paint("d", "fortress-one")],
      async (gone) => {
        const { clearTerrainBoundTo } = await import("../../module/engine/terrain.mjs");
        const out = await clearTerrainBoundTo("fortress-one", { sweep: false });
        expect(out.removed).toBe(2);
        return gone;
      },
    );
    expect(deleted.sort()).toEqual(["r0", "r3"]);
  });

  it("is what endField asks for, beside its onEnd ClearTerrain", () => {
    const fields = readFileSync("module/engine/fields.mjs", "utf8");
    const end = fields.slice(fields.indexOf("export async function endField"), fields.indexOf("async function setCooldownOnDeactivation"));
    expect(end).toMatch(/clearTerrainBoundTo\(fieldId\)/);
  });

  it("is carried by a following area's repaint, and declared on the behaviour", () => {
    const terrain = readFileSync("module/engine/terrain.mjs", "utf8");
    expect(terrain.slice(terrain.indexOf("export async function repaintFollowing"))).toMatch(/boundToFieldId/);
  });
});

describe("the stale notes are gone", () => {
  it("says no Fortress NP is unauthored, and that one is demonstrable", () => {
    const yaml = readFileSync("packs/_source/abilities/quetz-xiuhcoatl.yml", "utf8");
    const code = readFileSync("module/engine/skill-use.mjs", "utf8");
    expect(yaml).not.toMatch(/NO LIVE REFERENT/);
    expect(code).not.toMatch(/There is no live referent/);
  });
});
