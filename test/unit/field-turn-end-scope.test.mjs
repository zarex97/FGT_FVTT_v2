/**
 * @file A field's `turnEnd` is the victim's own Turn, and `anyTurnEnd` is every Turn (#145).
 * @see module/engine/fields.mjs#runFieldEvents, module/engine/scheduler-hooks.mjs, docs/E-event-reference.md, docs/46 §46.4
 *
 * `onTurnChange` dispatched `runFieldEvents("turnEnd")` at the end of EVERY Turn
 * and `runFieldEvent` never asked whose Turn it was. The handler-level `turnEnd`
 * is scoped to the active faction's Units (`scheduler.endTurn` step 1); the
 * field-level one was not, so three authors who wrote it for "its own Turn" got
 * "every Turn":
 *
 * - Piedra Del Sol: *"When an enemy Unit ends its Turn within the 7x7 panel
 *   area ... it receives 50 Fire damage"* was charged three times a Round.
 * - Contagion's trigger 2a: *"an enemy Unit ended its Turn within the area"*.
 * - Jack's Mist: Poison on enemy Masters *"at the end of its Turn"*.
 *
 * A Civilian has no faction and so no Turn of its own, and two clauses mean
 * "any Turn" for it (Blood Fort Andromeda, Ramesseum Tentyris). Those say
 * `anyTurnEnd`, which the handler vocabulary already uses for the same thing.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, compiled, prepareFields } from "../helpers/field.mjs";
import { runFieldEvents } from "../../module/engine/fields.mjs";
import { unitIdsOfTurn } from "../../module/rules/bounded-fields.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

// A die that always lands on 1. These tests are about WHOSE Turn it is, and
// Contagion rolls a chance for its Poison and its Charm.
beforeAll(() => {
  globalThis.Roll = class { async evaluate() { this.total = 1; return this; } };
});
afterAll(() => { delete globalThis.Roll; });

const hooks = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");
const turnHook = hooks.slice(hooks.indexOf("async function onTurnChange"), hooks.indexOf("async function onRoundChange"));

const QUETZ = { from: "quetzalcoatl", id: "qz", state: { factionId: "A" }, panel: { i: 6, j: 6 } };
const FOE = { from: "heracles", id: "foe", state: { factionId: "B" }, panel: { i: 6, j: 8 } };
const FOE_MASTER = { from: "master-advanced", id: "foeMaster", state: { factionId: "B" }, panel: { i: 6, j: 7 } };
const CIVILIAN = { from: { type: "civilian", id: "civ", name: "Civilian" }, id: "civ", panel: { i: 6, j: 5 } };

/** The intents `runFieldEvents` produces for one event, the way the Turn-end dispatcher asks. */
async function turnEnd(event, { specs, casts, endedFaction }) {
  const fields = await fieldsOf(casts);
  return withSubjects(specs, ({ board }) => runFieldEvents(event, { board, activeFactionId: endedFaction }),
    { settings: { fields } });
}

const piedra = (extra = {}) => ({
  ability: "quetz-piedra-del-sol", owner: "qz", ownerMaster: null, faction: "A",
  panels: squareAround({ i: 6, j: 6 }, 7), ...extra,
});

describe("Piedra Del Sol: an enemy takes the toll at the end of ITS OWN Turn", () => {
  it("charges nothing when the stone's owner's faction ends its Turn", async () => {
    const intents = await turnEnd("turnEnd", { specs: [QUETZ, FOE], casts: [piedra()], endedFaction: "A" });
    expect(intents.filter((i) => i.t === "damage")).toEqual([]);
  });

  it("charges the enemy 50 when the enemy's faction ends its Turn", async () => {
    const intents = await turnEnd("turnEnd", { specs: [QUETZ, FOE], casts: [piedra()], endedFaction: "B" });
    const damage = intents.filter((i) => i.t === "damage");
    expect(damage).toHaveLength(1);
    expect(damage[0]).toMatchObject({ unitId: "foe", amount: 50 });
  });

  it("charges nothing at the end of a THIRD faction's Turn either", async () => {
    const intents = await turnEnd("turnEnd", { specs: [QUETZ, FOE], casts: [piedra()], endedFaction: "C" });
    expect(intents).toEqual([]);
  });
});

describe("the enemy Master's Poison from Jack's Mist, and Contagion's trigger 2a", () => {
  const mist = { ability: "jack-the-mist", owner: "qz", faction: "A", panels: squareAround({ i: 6, j: 6 }, 5) };
  const contagion = { ability: "pale-rider-contagion", owner: "qz", faction: "A", panels: squareAround({ i: 6, j: 6 }, 5) };

  it("Jack's Mist poisons an enemy Master at the end of his own Turn only", async () => {
    const specs = [QUETZ, FOE_MASTER];
    const own = await turnEnd("turnEnd", { specs, casts: [mist], endedFaction: "B" });
    const other = await turnEnd("turnEnd", { specs, casts: [mist], endedFaction: "A" });
    expect(own.filter((i) => i.t === "applyEffect" && i.unitId === "foeMaster")).toHaveLength(1);
    expect(other).toEqual([]);
  });

  it("Contagion 2a charges an enemy inside only when it ended ITS Turn", async () => {
    const specs = [QUETZ, FOE];
    const own = await turnEnd("turnEnd", { specs, casts: [contagion], endedFaction: "B" });
    const owners = await turnEnd("turnEnd", { specs, casts: [contagion], endedFaction: "A" });
    expect(own.filter((i) => i.t === "statDelta" && i.unitId === "foe")).toHaveLength(1);
    expect(owners).toEqual([]);
  });
});

describe("a Unit with no faction has no Turn", () => {
  it("is never in the list of whose Turn ended", async () => {
    await withSubjects([QUETZ, CIVILIAN], ({ board }) => {
      expect(unitIdsOfTurn(board, "A")).toEqual(["qz"]);
      expect(unitIdsOfTurn(board, null)).toEqual([]);
    });
  });
});

describe("anyTurnEnd: the clauses that mean every Turn", () => {
  const blood = {
    ability: "medusa-blood-fort-andromeda", owner: "qz", faction: "A",
    panels: squareAround({ i: 6, j: 6 }, 7),
  };

  it("Blood Fort Andromeda's Civilian tier is authored on anyTurnEnd, and kills at any faction's Turn end", async () => {
    const events = (await compiled("medusa-blood-fort-andromeda")).system.field.interiorEvents;
    const civilianTier = events.find((e) => (e.kinds ?? []).includes("civilian"));
    expect(civilianTier.event).toBe("anyTurnEnd");

    const specs = [QUETZ, CIVILIAN];
    for (const faction of ["A", "B"]) {
      const intents = await turnEnd("anyTurnEnd", { specs, casts: [blood], endedFaction: faction });
      expect(intents.filter((i) => i.t === "defeat" && i.unitId === "civ"), faction).toHaveLength(1);
    }
  });

  it("is not reached by turnEnd, which a Civilian never has", async () => {
    const intents = await turnEnd("turnEnd", { specs: [QUETZ, CIVILIAN], casts: [blood], endedFaction: "A" });
    expect(intents).toEqual([]);
  });

  it("Blood Fort's Master and Servant tiers say actedTurnEnd, with the filter they had", async () => {
    const events = (await compiled("medusa-blood-fort-andromeda")).system.field.interiorEvents;
    const acted = events.filter((e) => e.requiresActed);
    expect(acted).toHaveLength(2);
    for (const e of acted) expect(e.event).toBe("actedTurnEnd");
  });

  it("Ramesseum Tentyris' Civilian tier is authored on anyTurnEnd", async () => {
    const events = (await compiled("ozymandias-ramesseum-tentyris")).system.field.interiorEvents;
    const tier = events.find((e) => (e.kinds ?? []).includes("civilian"));
    expect(tier.event).toBe("anyTurnEnd");
  });
});

describe("the Turn-end dispatcher", () => {
  it("tells turnEnd whose Turn ended, and hands it the board", () => {
    expect(turnHook).toMatch(/runFieldEvents\("turnEnd",\s*\{(?=[^}]*\bboard\b)(?=[^}]*\bactiveFactionId\b)[^}]*\}/s);
  });

  it("dispatches anyTurnEnd beside it, unscoped", () => {
    expect(turnHook).toMatch(/runFieldEvents\("anyTurnEnd",\s*\{\s*board\s*\}\)/);
  });
});
