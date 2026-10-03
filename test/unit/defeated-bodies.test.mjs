/**
 * @file A defeated Unit's body leaves the board one tick after it fell, and may be passed through until then (#65, ruling 25).
 * @see module/engine/scheduler.mjs#clearBodies, module/engine/io.mjs#clearBody, module/rules/movement.mjs#canPassThrough
 *
 * > *"defeated units should dissapear from the field 1 turn after being defeated"*
 *
 * Ruled 2026-10-02: at the end of the next Turn, one tick later. The token is
 * removed and the actor kept. Until then other Units may pass through the body
 * but not stop on it. Servants, Masters, summons and Civilians alike.
 *
 * Live before this (#168): a defeated Nemo still blocked a drag at (13,5), and
 * a body stood on the board for the rest of the match.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { clearBodies, endTurn } from "../../module/engine/scheduler.mjs";
import { canPassThrough, canStopOn } from "../../module/rules/movement.mjs";

beforeAll(prepareSubjects, 60_000);

const body = (over = {}) => ({ id: "b", kind: "servant", defeated: true, defeatedAt: 40, panel: { i: 1, j: 1 }, ...over });
const cleared = (units, tick) => clearBodies(units, { tick }).filter((i) => i.t === "clearBody").map((i) => i.unitId);

describe("when a body leaves", () => {
  it("stays through the Turn it fell on, and goes at the end of the next", () => {
    expect(cleared([body()], 40)).toEqual([]);
    expect(cleared([body()], 41)).toEqual(["b"]);
  });

  it("every kind of Unit, but not an object", () => {
    const units = [
      body({ id: "s" }), body({ id: "m", kind: "master" }), body({ id: "c", kind: "summon" }),
      body({ id: "h", kind: "civilian" }), body({ id: "p", kind: "platform" }), body({ id: "x", kind: "structure" }),
    ];
    expect(cleared(units, 41)).toEqual(["s", "m", "c", "h"]);
  });

  it("not the living, and not a Unit off the board", () => {
    expect(cleared([body({ defeated: false }), body({ id: "gone", panel: null })], 41)).toEqual([]);
  });

  it("a body that fell before the tick was kept goes now", () => {
    expect(cleared([body({ defeatedAt: null })], 41)).toEqual(["b"]);
  });

  it("the end of the Turn takes it, through the real projection", async () => {
    const out = await withSubjects([
      { from: "heracles", id: "herc", state: { defeated: true, defeatedAt: 40, factionId: "B" }, panel: { i: 3, j: 3 } },
    ], ({ board }) => ({
      fell: board.units[0].defeatedAt,
      same: endTurn(board, { tick: 40, round: 14, turnsPerRound: 3, activeFactionId: "B" }).filter((i) => i.t === "clearBody").length,
      next: endTurn(board, { tick: 41, round: 14, turnsPerRound: 3, activeFactionId: "A" }).filter((i) => i.t === "clearBody").map((i) => i.unitId),
    }));
    expect(out).toEqual({ fell: 40, same: 0, next: ["herc"] });
  });
});

describe("until it leaves, the body is passed through and not stopped on", () => {
  const board = (defeated) => withSubjects([
    { from: "quetzalcoatl", id: "q", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from: "heracles", id: "herc", state: { factionId: "B", defeated, defeatedAt: defeated ? 40 : null }, panel: { i: 5, j: 6 } },
  ], ({ unit, board: b }) => ({
    pass: canPassThrough({ i: 5, j: 6 }, unit("q"), b),
    stop: canStopOn({ i: 5, j: 6 }, unit("q"), b),
  }), { settings: { alliances: { A: ["A"], B: ["B"] } } });

  it("a living enemy blocks the panel", async () => {
    expect(await board(false)).toEqual({ pass: false, stop: false });
  });

  it("a body does not block it, and is no panel to stop on", async () => {
    expect(await board(true)).toEqual({ pass: true, stop: false });
  });
});

describe("the writers", () => {
  const io = readFileSync("module/engine/io.mjs", "utf8").replaceAll("\r\n", "\n");

  it("a defeat stamps its tick once, and keeps the first", () => {
    const defeat = io.slice(io.indexOf("async defeat(unitId, cause, killerId = null)"));
    expect(defeat.slice(0, defeat.indexOf("// The skull."))).toMatch(/actor\.system\?\.defeated \? \{\} : \{ "system\.defeatedAt": game\.combat\?\.system\?\.globalTurn/);
  });

  it("a Master's fall that defeats a Servant stamps it too", () => {
    expect(io).toMatch(/d\.kind === "defeat"\) \{\s*await actor\.update\(\{\s*"system\.defeated": true, "system\.defeatCause": d\.cause,\s*\.\.\.\(actor\.system\?\.defeated \? \{\} : \{ "system\.defeatedAt"/);
  });

  it("clearing a body deletes its tokens and never the actor", () => {
    const fn = io.slice(io.indexOf("async clearBody(unitId)"));
    const body = fn.slice(0, fn.indexOf("\n    },"));
    expect(body).toMatch(/deleteEmbeddedDocuments\("Token", ids\)/);
    expect(body).not.toMatch(/actor\.delete|Actor\.delete/);
  });
});

describe("the game log", () => {
  it("records a body leaving, under defeat", () => {
    expect(readFileSync("module/engine/io.mjs", "utf8")).toMatch(/bodyCleared: "defeat"/);
  });
});
