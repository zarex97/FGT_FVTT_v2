/**
 * @file A painted area ends at the same boundary, by the same comparison, as the effect that painted it (#161).
 * @see module/engine/terrain.mjs#expireTerrain, module/engine/scheduler.mjs#expireEffects, module/domain/tick.mjs#expiryReached, docs/26-terrain.md
 *
 * > *"Applies the 'Sol' buff to herself for 1◈ Turns, its effects are as
 * > follows- The 5x5 panel area around Quetz is 'Day'."* — Charisma of the Sun
 *
 * Pressed at globalTurn 1, the Sol buff, Atk Up and the sunlight Region were all
 * stamped `expiry: 4`. At the start of tick 4 the Region was gone while Sol and
 * Atk Up were still on her. One "1◈" was read on two clocks: the terrain sweep
 * removed `expiry <= tick` when the Turn BEGAN (it was handed the NEXT tick),
 * the effect sweep removes it when the Turn ENDS (it is handed the tick that
 * just ended). So for the last Turn of Sol's life the 5x5 was not Day.
 *
 * Both now ask `expiryReached(expiry, tick)` of the tick of the Turn that just
 * ended, so an area and an effect stamped with one expiry are present through
 * that Turn and gone at its end, together.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { withWorld } from "../helpers/world.mjs";
import { prepareFields } from "../helpers/field.mjs";
import { installSystem } from "../../tools/lib/foundry.mjs";
import { expiryReached } from "../../module/domain/tick.mjs";
import { expireEffects } from "../../module/engine/scheduler.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const QZ = "quetzalcoatlAct1";
const EXPIRY = 4;

/** The Regions still on a scene after a sweep, for a scene holding one area stamped `expiry`. */
async function areaAfterSweep(expiry, tick) {
  const models = await installSystem();
  const { terrainDataOf, expireTerrain } = await import("../../module/engine/terrain.mjs");
  const system = new models.RegionBehavior.terrain(
    structuredClone(terrainDataOf({ types: ["sunlight"], panels: [{ i: 1, j: 1 }], tag: `sol:${QZ}` }, expiry)),
    { strict: true },
  ).toObject();
  const regions = [{ id: "sol", behaviors: [{ type: "terrain", disabled: false, system }] }];
  return withWorld({}, async () => {
    const deleted = [];
    globalThis.canvas = {
      ...globalThis.canvas,
      scene: { regions, grid: { size: 100 }, deleteEmbeddedDocuments: async (_t, ids) => { deleted.push(...ids); } },
    };
    // The same sweep, without the effect hygiene that needs a whole board.
    await expireTerrain(tick, { sweep: false });
    return deleted.length === 0;
  });
}

/** Whether the Sol buff is swept by the effect sweep of the Turn at `tick`. */
const effectSwept = (tick) => withSubjects(
  [{ from: "quetzalcoatl", id: QZ, state: { factionId: "A" }, effects: [{ defId: "sol", expiry: EXPIRY }] }],
  ({ unit }) => expireEffects([unit(QZ)], { tick, effectDef: () => null }).some((i) => i.t === "removeEffect"),
);

describe("one comparison for effects and areas", () => {
  it("is reached AT the expiry tick and not before it", () => {
    expect(expiryReached(4, 3)).toBe(false);
    expect(expiryReached(4, 4)).toBe(true);
    expect(expiryReached(4, 5)).toBe(true);
  });

  it("is never reached by an effect or an area with no expiry", () => {
    expect(expiryReached(null, 99)).toBe(false);
    expect(expiryReached(undefined, 99)).toBe(false);
    expect(expiryReached(Number.POSITIVE_INFINITY, 99)).toBe(false);
  });
});

describe("Sol's daylight and Sol itself end together", () => {
  it("both are still there through the Turn before the expiry ends", async () => {
    // The end of the Turn at tick 3: the sweep is handed 3.
    expect(await effectSwept(3)).toBe(false);
    expect(await areaAfterSweep(EXPIRY, 3)).toBe(true);
  });

  it("both are still there when the Turn AT the expiry begins, which is when the area used to go", async () => {
    // The old dispatcher asked `expireTerrain(nextTick)`: at the end of tick 3 that
    // was 4, and the area was gone while Sol, swept at the end of tick 4, was not.
    // Now the sweep at the end of tick 3 is handed 3, and nothing here is reached.
    expect(await areaAfterSweep(EXPIRY, 3)).toBe(true);
  });

  it("both are gone at the end of the Turn at the expiry", async () => {
    expect(await effectSwept(EXPIRY)).toBe(true);
    expect(await areaAfterSweep(EXPIRY, EXPIRY)).toBe(false);
  });
});

describe("the Turn boundary hands each sweep the tick that just ended", () => {
  const hooks = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");
  const turnHook = hooks.slice(hooks.indexOf("async function onTurnChange"), hooks.indexOf("async function onRoundChange"));

  it("sweeps terrain with the ended Turn's tick, as endTurn sweeps effects", () => {
    expect(turnHook).toMatch(/expireTerrain\(tick\)/);
    expect(turnHook).not.toMatch(/expireTerrain\(nextTick\)/);
  });
});
