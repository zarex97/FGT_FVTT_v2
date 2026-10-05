/**
 * @file A field's forced end is a standing threshold, tested at its own boundary (#149).
 * @see module/rules/platforms.mjs#forcedEndDue, #upkeepPlan, module/engine/fields.mjs#runUpkeep, docs/28-bounded-fields.md
 *
 * > *"If her Master's Health drops to/is 50 or less at any time, this NP is
 * > forcefully deactivated at the end of the Turn."* — Piedra Del Sol
 * >
 * > *"If her Master's Health is 25 or less, this NP is forcefully deactivated at
 * > the end of the Round."* — the Quetzalcoatlus
 *
 * `runUpkeep` tested the payer's Health only when its toll fell due, so a Master
 * at 50 or less kept the stone open for up to 1◈, a Master healed back before the
 * due boundary was never checked, and a mount whose `every: 1◈` is a tick period
 * (`upkeepDue` refuses a tick period at a Round boundary) was never asked at the
 * end of a Round at all. Jack's Mist ties its end to the toll and is unchanged.
 *
 * The decision is a pure function over the REAL compiled `upkeep` of each sheet,
 * with the payer's Health read off a Master projected from the real corpus.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { compiled, prepareFields } from "../helpers/field.mjs";
import { currentHealth } from "../../module/domain/health.mjs";
import { forcedEndDue, upkeepDue, upkeepPlan } from "../../module/rules/platforms.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const stone = async () => (await compiled("quetz-piedra-del-sol")).system.field.upkeep;
const mount = async () => (await compiled("quetzalcoatlus")).system.upkeep;
const jack = async () => (await compiled("jack-the-mist")).system.field.upkeep;

/** A Master's Health as a live board reads it, projected from the real corpus. */
const healthOf = (value) => withSubjects(
  [{ from: "master-advanced", id: "master", state: { health: { value, max: 800 } } }],
  ({ unit }) => currentHealth(unit("master")),
);

const TURN = { atRoundBoundary: false };
const ROUND = { atRoundBoundary: true };

describe("Piedra Del Sol: 50 or less at the end of a Turn, due toll or not", () => {
  it("authors the threshold and the boundary it is read at", async () => {
    expect((await stone()).closeWhen).toEqual({ payerHealthAtMost: 50, at: "turnEnd" });
  });

  it("is due at exactly 50 on a Turn end where no toll is due", async () => {
    expect(forcedEndDue(await stone(), { payerHealth: await healthOf(50), ...TURN })).toEqual({ due: true });
  });

  it("is not due at 51", async () => {
    expect(forcedEndDue(await stone(), { payerHealth: await healthOf(51), ...TURN }).due).toBe(false);
  });

  it("is not read at a Round's end, which is not its boundary", async () => {
    expect(forcedEndDue(await stone(), { payerHealth: await healthOf(10), ...ROUND }).due).toBe(false);
  });

  it("closes a stone cast with the Master already at 50, with no toll due", async () => {
    const plan = upkeepPlan(await stone(), { due: false, payerHealth: await healthOf(50), ...TURN });
    expect(plan).toEqual({ close: "forcedEnd" });
  });

  it("leaves a stone alone at 51 when no toll is due", async () => {
    expect(upkeepPlan(await stone(), { due: false, payerHealth: await healthOf(51), ...TURN })).toEqual({});
  });

  it("closes it at the end of the SAME Turn the toll takes him to 50 or less", async () => {
    // "If the upkeep takes her Master to 50 Health or less, ... forcefully
    // deactivated at the end of the Turn": charged, and closed at that boundary.
    const plan = upkeepPlan(await stone(), { due: true, payerHealth: await healthOf(100), ...TURN });
    expect(plan).toEqual({ charge: 50, closeAfter: "forcedEnd" });
  });

  it("charges and stays open while the toll leaves him above 50", async () => {
    const plan = upkeepPlan(await stone(), { due: true, payerHealth: await healthOf(120), ...TURN });
    expect(plan).toEqual({ charge: 50, closeAfter: null });
  });

  it("does not charge a Master already at the threshold: it closes instead", async () => {
    const plan = upkeepPlan(await stone(), { due: true, payerHealth: await healthOf(50), ...TURN });
    expect(plan).toEqual({ close: "forcedEnd" });
  });
});

describe("the Quetzalcoatlus: 25 or less at the end of the Round", () => {
  it("authors the threshold and the boundary it is read at", async () => {
    expect((await mount()).closeWhen).toEqual({ payerHealthAtMost: 25, at: "roundEnd" });
  });

  it("is due at 25 at a Round's end, which its 1◈ toll never reaches", async () => {
    const upkeep = await mount();
    // The reason it needed a rule of its own: a tick period is refused at a Round boundary.
    expect(upkeepDue(upkeep, { tick: 9, round: 3, atRoundBoundary: true, createdAt: 3 }))
      .toEqual({ due: false, reason: "tickPeriodAtRoundBoundary" });
    expect(forcedEndDue(upkeep, { payerHealth: await healthOf(25), ...ROUND })).toEqual({ due: true });
  });

  it("is not due at 25 at a Turn's end", async () => {
    expect(forcedEndDue(await mount(), { payerHealth: await healthOf(25), ...TURN }).due).toBe(false);
  });

  it("is not due at 26 at a Round's end", async () => {
    expect(forcedEndDue(await mount(), { payerHealth: await healthOf(26), ...ROUND }).due).toBe(false);
  });

  it("a Master dropped to 25 by other damage mid-period closes it at the Round, toll or none", async () => {
    const plan = upkeepPlan(await mount(), { due: false, payerHealth: await healthOf(25), ...ROUND });
    expect(plan).toEqual({ close: "forcedEnd" });
  });
});

describe("a toll that is its own limit is unchanged", () => {
  it("Jack's Mist ties its end to the toll: no standing threshold, closes instead of charging", async () => {
    const upkeep = await jack();
    expect(upkeep.closeWhen).toBeUndefined();
    expect(upkeepPlan(upkeep, { due: false, payerHealth: 5, ...TURN })).toEqual({});
    expect(upkeepPlan(upkeep, { due: true, payerHealth: 15, ...TURN })).toEqual({ close: "upkeep" });
    expect(upkeepPlan(upkeep, { due: true, payerHealth: 16, ...TURN })).toEqual({ charge: 15, closeAfter: null });
  });

  it("a toll with nobody to pay it closes the field, as before", async () => {
    expect(upkeepPlan(await jack(), { due: true, payerHealth: null, ...TURN })).toEqual({ close: "upkeep" });
  });

  it("upkeepDue is untouched: a 1◈ toll is due from its period on and not before", async () => {
    const upkeep = await stone();
    expect(upkeepDue(upkeep, { tick: 5, lastUpkeepAt: 3, createdAt: 0, turnsPerRound: 3 }).due).toBe(false);
    expect(upkeepDue(upkeep, { tick: 6, lastUpkeepAt: 3, createdAt: 0, turnsPerRound: 3 }).due).toBe(true);
  });
});

describe("runUpkeep follows the plan", () => {
  const fields = readFileSync("module/engine/fields.mjs", "utf8");
  const sweep = fields.slice(fields.indexOf("export async function runUpkeep"), fields.indexOf("async function stampUpkeep"));

  it("asks upkeepPlan, so the threshold is tested before the toll's own due check", () => {
    expect(sweep).toMatch(/upkeepPlan\(/);
    expect(sweep.indexOf("upkeepPlan(")).toBeLessThan(sweep.indexOf("stampUpkeep("));
  });

  it("no longer skips a field whose toll is not due before looking at it", () => {
    expect(sweep).not.toMatch(/if \(!verdict\.due\) continue;/);
  });
});

describe("a field its owner's defeat is closing charges no toll (#185)", () => {
  // Live: EMIYA defeated Jack on Turn 28, a toll Turn for the Mist. Her Master
  // paid 15 at the Turn's end, and the Mist closed at the next Turn's start.
  // *"Her Master does not lose Health on the same Turn this NP is deactivated."*
  const fields = readFileSync("module/engine/fields.mjs", "utf8");
  const sweep = fields.slice(fields.indexOf("export async function runUpkeep"), fields.indexOf("async function stampUpkeep"));

  it("skips the field before anything is charged", () => {
    const skip = sweep.indexOf("if (endsForOwnerDefeat(field)) continue;");
    expect(skip).toBeGreaterThan(0);
    expect(skip).toBeLessThan(sweep.indexOf("upkeepPlan("));
  });

  it("asks the same question the close does", () => {
    const close = fields.slice(fields.indexOf("function closeReason"), fields.indexOf("function endsForOwnerDefeat"));
    expect(close).toMatch(/return endsForOwnerDefeat\(field\) \? "ownerDefeat" : null;/);
  });

  it("the Mist states both halves", async () => {
    const { parse } = await import("yaml");
    const mist = parse(readFileSync("packs/_source/abilities/jack-the-mist.yml", "utf8"));
    expect(mist.field.vulnerabilities).toContainEqual({ kind: "ownerDefeat", result: "end" });
    expect(mist.field.upkeep.cost).toMatchObject({ kind: "health", amount: 15, payer: "ownerMaster" });
  });
});

describe("a fallen owner is not offered the reshape (#185)", () => {
  it("offerReshape skips a defeated owner", () => {
    const fields = readFileSync("module/engine/fields.mjs", "utf8");
    const offer = fields.slice(fields.indexOf("export async function offerReshape"), fields.indexOf("export async function offerReshape") + 900);
    expect(offer).toMatch(/if \(!owner\?\.acted \|\| owner\.defeated \|\| !mayReshape\(field, owner\)\) continue;/);
  });
});

describe("a closing field tells the table (#185)", () => {
  // Live: the Mist closing because her Master could not pay was a log line,
  // and its close at her defeat was not even that.
  const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
  const t = (key, data) => {
    const text = lang[key] ?? key;
    return data ? text.replace(/\{(\w+)\}/g, (_, k) => data[k]) : text;
  };

  it("names the field and the reason", async () => {
    const { fieldClosedCard } = await import("../../module/engine/field-report.mjs");
    const card = fieldClosedCard("The Mist", "upkeep", t);
    expect(card).toContain("The Mist ends.");
    expect(card).toContain(lang["FGT.Field.Closed.upkeep"]);
    expect(fieldClosedCard("The Mist", "ownerDefeat", t)).toContain(lang["FGT.Field.Closed.ownerDefeat"]);
  });

  it("falls back for a reason it has no words for", async () => {
    const { fieldClosedCard } = await import("../../module/engine/field-report.mjs");
    expect(fieldClosedCard("X", "somethingNew", t)).toContain(lang["FGT.Field.Closed.ended"]);
  });

  it("every close path posts it, with its reason", () => {
    const fields = readFileSync("module/engine/fields.mjs", "utf8");
    const end = fields.slice(fields.indexOf("export async function endField"), fields.indexOf("export async function endField") + 1600);
    expect(end).toMatch(/await postFieldClosed\(region\.name \?\? fieldId, fieldId, reason\);/);
    expect(fields).toMatch(/await endField\(field\.id, closeReason\(field, tick\) \?\? "ended"\)/);
    expect(fields).toMatch(/return endField\(fieldId, reason, \{ logged: true \}\);/);
  });
});
