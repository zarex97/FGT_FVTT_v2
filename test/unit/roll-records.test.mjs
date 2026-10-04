/**
 * @file Field events, rider chances and Round-end ticks leave a record (#182).
 * @see module/engine/field-report.mjs, module/engine/fields.mjs#runFieldEvent,
 *   module/engine/attack.mjs#fireDamageDealt, module/engine/io.mjs#defeat
 *
 * Ruled 2026-10-04: one public card per field per Turn end listing each Unit's
 * loss and each roll; a rider's chance in the attack card's Rolls; one card at
 * Round end for periodic ticks; a log entry for each, defeats included.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { runFieldEvents } from "../../module/engine/fields.mjs";
import { fieldEventsIn, fieldReportCards, periodicTicksIn, periodicCard } from "../../module/engine/field-report.mjs";
import { pendingRolls } from "../../module/engine/scheduler.mjs";
import * as process from "../../module/engine/combat-process.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);
// Every chance roll lands on 1: Poison and Charm both hit.
beforeEach(() => { globalThis.Roll = class { async evaluate() { return { total: 1 }; } }; });
afterEach(() => { delete globalThis.Roll; });

const t = (key, data) => `${key}${data ? JSON.stringify(data) : ""}`;
const PR = "paleRiderRecord1";
const FOE = "foeMedeaRecord01";

describe("a field's Turn-end events", () => {
  it("file a loss and each chance roll for the Unit they hit", async () => {
    const fields = await fieldsOf([{ ability: "pale-rider-contagion", owner: PR, faction: "A", panels: squareAround({ i: 6, j: 6 }, 5) }]);
    const entries = await withSubjects([
      { from: "pale-rider", id: PR, state: { factionId: "A" }, panel: { i: 6, j: 6 } },
      { from: "medea", id: FOE, state: { factionId: "B" }, panel: { i: 6, j: 7 } },
    ], async ({ board }) => fieldEventsIn(await runFieldEvents("turnEnd", { board, activeFactionId: "B" })),
    { settings: { fields } });
    expect(entries).toEqual([
      expect.objectContaining({ fieldId: "pale-rider-contagion", unitId: FOE, healthLoss: 100 }),
      expect.objectContaining({ roll: expect.objectContaining({ effect: "poison", total: 1, chance: 50, outcome: "hit" }) }),
      expect.objectContaining({ roll: expect.objectContaining({ effect: "charm", total: 1, chance: 10, outcome: "hit" }) }),
    ]);
  });

  it("make one card per field", () => {
    const entries = [
      { fieldId: "f1", unitId: "a", unitName: "A", healthLoss: 100 },
      { fieldId: "f2", unitId: "b", unitName: "B", damage: 50 },
      { fieldId: "f1", unitId: "c", unitName: "C", roll: { effect: "poison", total: 60, chance: 50, outcome: "missed" } },
    ];
    const cards = fieldReportCards(entries, (id) => id.toUpperCase(), t);
    expect(cards.map((c) => c.fieldId)).toEqual(["f1", "f2"]);
    expect(cards[0].content).toContain("FGT.FieldReport.HealthLoss");
    expect(cards[0].content).toContain("FGT.FieldReport.Chance");
  });

  it("are gathered at every Turn-end dispatch and posted", () => {
    const src = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");
    for (const event of ["actedTurnEnd", "turnEnd", "anyTurnEnd", "unitTurnEnd"]) {
      expect(src).toContain(`reported(await fields.runFieldEvents("${event}"`);
    }
    expect(src).toMatch(/await postFieldReports\(fieldEvents\);/);
  });
});

describe("a Round end's periodic ticks", () => {
  it("are read off the periodic damage intents, never who inflicted them", () => {
    const intents = [
      { t: "damage", unitId: "u1", amount: 160, periodic: true, defId: "poison", attributionHidden: true },
      { t: "damage", unitId: "u2", amount: 40, breakdown: [] },
    ];
    const ticks = periodicTicksIn(intents, () => "Asterios", 15);
    expect(ticks).toEqual([{ kind: "periodicTick", unitId: "u1", unitName: "Asterios", defId: "poison", amount: 160, tick: 15 }]);
    expect(periodicCard(ticks, t)).toContain("FGT.FieldReport.Periodic");
    expect(periodicCard([], t)).toBeNull();
  });
});

describe("a rider's chance", () => {
  it("says what it rolls against", async () => {
    const specs = await withSubjects([
      { from: "kagome-sword", id: "swordRecord00001", state: { factionId: "A" }, panel: { i: 2, j: 2 } },
    ], ({ unit }) => pendingRolls(unit("swordRecord00001"), "damageDealt"));
    expect(specs).toContainEqual(expect.objectContaining({ formula: "1d100", chance: 5, label: "death" }));
  });

  it("files several records in one step", () => {
    const s = { state: "damage", history: [], rolls: [] };
    const out = process.advance(s, "done", { rollRecords: [{ id: "r1" }, { id: "r2" }] });
    expect(out.rolls.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("a defeat", () => {
  it("is logged whoever caused it", () => {
    const src = readFileSync("module/engine/io.mjs", "utf8");
    expect(src).toMatch(/if \(!actor\.system\?\.defeated\) \{\s*await this\.log\(\[\{ kind: "defeat", event: "defeated"/);
  });
});
