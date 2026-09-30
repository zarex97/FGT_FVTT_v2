/**
 * @file Damage over time ticks from the authored `periodic`, and from nothing else (#105).
 * @see module/engine/scheduler.mjs#tickPeriodics, packs/_source/effects/
 *
 * Every Effect definition carried a `periodic` block, and the registry copied it,
 * and nothing read it: the scheduler ticked from its own `PERIODICS` table. So
 * the file said one thing and the match did another, and a content fix to a
 * tick reached nobody. Freeze and Crystalfreeze were the other half: the table
 * ticked them 100 at Round end, and their files ALSO ticked 100 through an
 * `OnEvent: roundEnd`, so a Frozen Unit lost 200.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/** What one boundary deals Heracles carrying `effect`, read off the real registry. */
const ticks = (effect, when, { acted = false, def = null } = {}) => withSubjects(
  [{ from: "heracles", id: "heracles", effects: [effect] }],
  async ({ board }) => {
    const { tickPeriodics } = await import("../../module/engine/scheduler.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    const units = board.units.map((u) => ({ ...u, acted }));
    const effectDef = (id) => (def && id === effect.defId ? def : EffectRegistry.get(id));
    return tickPeriodics(units, when, { tick: 1, effectDef, activeFactionId: null })
      .map((i) => [i.t, i.amount]);
  },
);

describe("each authored periodic", () => {
  it.each([
    ["burn", {}, "roundEnd", false, [["damage", 50]]],
    ["poison", { stage: 3 }, "roundEnd", false, [["damage", 80]]],
    ["curse", { stage: 2 }, "turnEnd", false, [["damage", 50]]],
    ["bleed", {}, "turnEnd", true, [["damage", 50]]],
    ["bleed", {}, "turnEnd", false, []],
    ["sap", {}, "turnEnd", true, [["damage", 50]]],
    ["freeze", {}, "roundEnd", false, [["damage", 100]]],
    ["crystalfreeze", {}, "roundEnd", false, [["damage", 100]]],
    ["burn", {}, "turnEnd", false, []],
  ])("%s %o at %s (acted %s)", async (defId, extra, when, acted, expected) => {
    expect(await ticks({ defId, ...extra }, when, { acted })).toEqual(expected);
  });
});

describe("the file is the source", () => {
  it("ticks what the definition says, not a table in the scheduler", async () => {
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    await prepareSubjects();
    const burn = EffectRegistry.get("burn");
    const def = { ...burn, periodic: { ...burn.periodic, amount: 7 } };
    expect(await ticks({ defId: "burn" }, "roundEnd", { def })).toEqual([["damage", 7]]);
  });

  it("does not tick an effect whose definition has no periodic", async () => {
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    const def = { ...EffectRegistry.get("burn"), periodic: null };
    expect(await ticks({ defId: "burn" }, "roundEnd", { def })).toEqual([]);
  });
});

describe("a Frozen Unit at Round end", () => {
  it("takes Freeze's 100 once", async () => {
    const lost = await withSubjects(
      [{ from: "heracles", id: "heracles", effects: [{ defId: "freeze" }], state: { health: { value: 1000, max: 1500 } } }],
      async ({ board, world }) => {
        const { endRound } = await import("../../module/engine/scheduler.mjs");
        const { EffectRegistry } = await import("../../module/rules/registry.mjs");
        const { applyIntents } = await import("../../module/engine/applier.mjs");
        const { worldIO } = await import("../../module/engine/io.mjs");
        const intents = endRound(board, { tick: 1, round: 1, turnsPerRound: 3, activeFactionId: null, effectDef: (id) => EffectRegistry.get(id) });
        await applyIntents(intents.filter((i) => i.t === "damage" || i.t === "statDelta"), {
          io: worldIO(), canWrite: () => true, isGM: true, source: "test",
        });
        return 1000 - world.actor("heracles").system.health.value;
      },
    );
    expect(lost).toBe(100);
  });
});
