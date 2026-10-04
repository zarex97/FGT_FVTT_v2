/**
 * @file A field's Health loss that empties a Health bar defeats the Unit (#180).
 * @see module/engine/fields.mjs (HealthLoss), module/engine/applier.mjs (statDelta)
 *
 * Contagion: *"Health is reduced by 100. Not affected by effects that modify
 * damage taken (does not count as 'damage')."* Not damage, but still Health.
 * Live, it took Medea from 122 to 0 at the end of Pale Rider's Turn and she
 * stood on at 0, undefeated: the loss is a stat write, and nothing asked
 * whether it was lethal.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

const FOE = "foeMedeaActor001";

/** Apply a Health loss through the REAL applier, and say whether it asked for the lethal check. */
async function lose(amount, defeatsAtZero) {
  return withSubjects([{ from: "medea", id: FOE, state: { factionId: "B" }, panel: { i: 3, j: 3 } }], async ({ world }) => {
    const { applyIntents } = await import("../../module/engine/applier.mjs");
    const { worldIO } = await import("../../module/engine/io.mjs");
    const I = await import("../../module/engine/intents.mjs");
    await world.actor(FOE).update({ "system.health.value": 122 });
    const asked = [];
    // `defeatIfLethal` itself resolves the defeat through the attack module,
    // which needs the client's application classes; what is under test is
    // that the applier asks it, and with whom.
    const io = Object.assign(Object.create(worldIO()), { defeatIfLethal: async (id) => { asked.push(id); } });
    const intent = { ...I.statDelta(FOE, "health.value", -amount), ...(defeatsAtZero ? { defeatsAtZero: true } : {}) };
    await applyIntents([intent], { io, canWrite: () => true, isGM: true, source: "test" });
    return { health: world.actor(FOE).system.health.value, asked };
  });
}

describe("a Health loss that is not damage", () => {
  it("asks whether the loss was lethal, once the Health is written", async () => {
    expect(await lose(150, true)).toEqual({ health: 0, asked: [FOE] });
  });

  it("an unmarked stat write asks nothing: a cost, a drain, a heal", async () => {
    expect(await lose(150, false)).toEqual({ health: 0, asked: [] });
  });

  it("the field's HealthLoss marks its intent", () => {
    expect(readFileSync("module/engine/fields.mjs", "utf8")).toMatch(/I\.statDelta\(unit\.id, "health\.value", -amount\), defeatsAtZero: true/);
  });
});
