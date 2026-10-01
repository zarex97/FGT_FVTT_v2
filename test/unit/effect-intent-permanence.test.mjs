/**
 * @file An effect intent can say "permanent" and "unremovable", and a field's or terrain's effect ends on leaving (#147).
 * @see module/engine/applier.mjs#resolveEffects, module/engine/effect-applier.mjs, module/engine/fields.mjs, docs/15-effect-application.md
 *
 * > *"…inflicted with Burn; this Burn debuff is permanent as long as the Unit is
 * > within the Piedra Del Sol area."* — Quetzalcoatl
 *
 * Piedra Del Sol authors `{ key: ApplyEffect, effect: { id: burn }, duration:
 * null, unremovable: true }`. The field action never read `unremovable`, and an
 * emitted `expiry: null` -- "no expiry" to its author -- was merged as "not
 * stated" by `resolveEffects`, so the flow's own default (Burn's 2◈) won. The
 * Burn lasted 2◈ and not "as long as inside", a cleanse removed it, and it
 * outlived leaving. Burning terrain's own Burn had the same two losses and a
 * third: `sourceTerrain` was stamped and read by nobody, so "leaving is what
 * ends it" ended nothing.
 *
 * The routes run end to end here -- the real compiled content, the real
 * applier, the real DataModel -- rather than through a hand-built intent, which
 * is how the first `unremovable` that reached the applier was lost (#80).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, areasOf, squareAround, compiled, prepareFields } from "../helpers/field.mjs";
import { runFieldEvents } from "../../module/engine/fields.mjs";
import { zonePaintArgs } from "../../module/engine/skill-use.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";
import * as I from "../../module/engine/intents.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

// A d100 that always lands on 1: Burn's chance is automatic, and the roll is not what this is about.
beforeEach(() => { globalThis.Roll = class { async evaluate() { this.total = 1; return this; } }; });
afterEach(() => { delete globalThis.Roll; });

// Document ids: an effect's `sourceUnitId` is a real DocumentIdField, sixteen alphanumerics.
const QZ = "quetzalcoatlAct1";
const FOE_ID = "foeHeraclesAct01";
const QUETZ = { from: "quetzalcoatl", id: QZ, state: { factionId: "A" }, panel: { i: 6, j: 6 } };
const FOE = { from: "heracles", id: FOE_ID, state: { factionId: "B" }, panel: { i: 6, j: 8 } };

/** Apply intents through the REAL applier into the world, and return what `id` carries. */
async function landed(world, intents, id) {
  const { applyIntents } = await import("../../module/engine/applier.mjs");
  const { worldIO } = await import("../../module/engine/io.mjs");
  await applyIntents(intents, { io: worldIO(), canWrite: () => true, isGM: true, source: "test" });
  return [...world.actor(id).effects].map((e) => ({ ...e.system }));
}

describe("Piedra Del Sol's Burn: permanent, unremovable, tied to the stone", () => {
  /** The stone's clause 2, run for the enemy's own Turn end, and applied. */
  async function burn() {
    const fields = await fieldsOf([{
      ability: "quetz-piedra-del-sol", owner: QZ, faction: "A", panels: squareAround({ i: 6, j: 6 }, 7),
    }]);
    return withSubjects([QUETZ, FOE], async ({ board, world }) => {
      const intents = await runFieldEvents("turnEnd", { board, activeFactionId: "B" });
      const emitted = intents.find((i) => i.t === "applyEffect");
      const instances = await landed(world, intents.filter((i) => i.t === "applyEffect"), FOE_ID);
      return { emitted, burn: instances.find((e) => e.defId === "burn") };
    }, { settings: { fields } });
  }

  it("emits an intent that says permanent, unremovable and tied to the field", async () => {
    const { emitted } = await burn();
    expect(emitted.effect).toMatchObject({
      defId: "burn", permanent: true, unremovable: true, sourceFieldId: "quetz-piedra-del-sol",
    });
  });

  it("lands with no expiry, unremovable, and the field's tie", async () => {
    const { burn: instance } = await burn();
    expect(instance).toMatchObject({ expiry: null, unremovable: true, sourceFieldId: "quetz-piedra-del-sol" });
  });
});

describe("an intent that only says expiry: null still gets the definition's duration", () => {
  it("lands Burn for its default 2◈ at the current tick", async () => {
    const instances = await withSubjects([FOE], async ({ world }) => {
      await world.combat.update({ "system.globalTurn": 10 });
      return landed(world, [I.applyEffect(FOE_ID, { defId: "burn", expiry: null }, null)], FOE_ID);
    });
    // 2◈ at 3 Turns a Round, from tick 10.
    expect(instances.find((e) => e.defId === "burn")).toMatchObject({ expiry: 16, unremovable: false });
  });
});

describe("Burning terrain's Burn: permanent, unremovable, and tied to the terrain", () => {
  it("lands with no expiry, unremovable, and sourceTerrain", async () => {
    const areas = await areasOf([{ paint: { types: ["burning"], panels: squareAround({ i: 6, j: 6 }, 7), tag: "gm" } }]);
    const instance = await withSubjects([QUETZ, FOE], async ({ board, world }) => {
      const { endTurn } = await import("../../module/engine/scheduler.mjs");
      const intents = endTurn(board, {
        tick: 1, round: 1, turnsPerRound: 3, activeFactionId: "B", effectDef: () => null,
      });
      const burns = intents.filter((i) => i.t === "applyEffect" && i.unitId === FOE_ID && i.effect.defId === "burn");
      expect(burns).toHaveLength(1);
      const instances = await landed(world, burns, FOE_ID);
      return instances.find((e) => e.defId === "burn");
    }, { settings: { terrain: { areas } } });
    expect(instance).toMatchObject({ expiry: null, unremovable: true, sourceTerrain: "burning" });
  });
});

describe("a terrain-tied effect ends when its bearer is not on that terrain", () => {
  const tied = [{ defId: "burn", expiry: null, unremovable: true, sourceTerrain: "burning" }];
  const burning = (centre) => ({ types: ["burning"], panels: squareAround(centre, 3), tag: "gm" });

  /** What the snapshot says `foe` carries, standing at `panel` with a Burning area at (6,6). */
  async function carried(panel, paint = burning({ i: 6, j: 6 })) {
    const areas = await areasOf([{ paint }]);
    return withSubjects([{ ...FOE, panel, effects: tied }], ({ unit }) => ({
      effects: unit(FOE_ID).effects, instances: unit(FOE_ID).effectInstances.map((e) => e.defId),
    }), { settings: { terrain: { areas } } });
  }

  it("is read while the bearer stands in Burning", async () => {
    expect((await carried({ i: 6, j: 7 })).instances).toEqual(["burn"]);
  });

  it("is not read once the bearer is outside any Burning area", async () => {
    const out = await carried({ i: 0, j: 0 });
    expect(out.instances).toEqual([]);
    expect(out.effects).toEqual([]);
  });

  it("is not kept by a Burning area that is only a label", async () => {
    const ability = await compiled("quetz-piedra-del-sol");
    const spec = ability.system.phases.find((p) => p.kind === "zone").spec;
    const label = zonePaintArgs(spec, ability, { id: QZ }, { panel: { i: 6, j: 6 } }, { bounds: squareBounds(13) });
    expect((await carried({ i: 6, j: 7 }, label)).instances).toEqual([]);
  });
});

describe("the document goes too: a Unit that leaves, or whose ground is erased", () => {
  const tied = [
    { defId: "burn", expiry: null, unremovable: true, sourceTerrain: "burning" },
    { defId: "poison", expiry: null },
  ];

  /** `foe`'s effect ids after `dropLeftTerrainEffects` at `panel`, over a Burning area at (6,6). */
  async function afterDrop(panel) {
    const areas = await areasOf([{ paint: { types: ["burning"], panels: squareAround({ i: 6, j: 6 }, 3), tag: "gm" } }]);
    return withSubjects([{ ...FOE, panel: { i: 6, j: 7 }, effects: tied }], async ({ board, world }) => {
      const { dropLeftTerrainEffects } = await import("../../module/engine/terrain.mjs");
      const dropped = await dropLeftTerrainEffects(world.actor(FOE_ID), panel, board);
      return { dropped, left: [...world.actor(FOE_ID).effects].map((e) => e.system.defId) };
    }, { settings: { terrain: { areas } } });
  }

  it("keeps it on the ground that holds it", async () => {
    expect(await afterDrop({ i: 6, j: 7 })).toEqual({ dropped: 0, left: ["burn", "poison"] });
  });

  it("deletes it on leaving, and only it", async () => {
    // Poison carries no tie: it ends when it is cured, not when its bearer walks.
    expect(await afterDrop({ i: 0, j: 0 })).toEqual({ dropped: 1, left: ["poison"] });
  });
});
