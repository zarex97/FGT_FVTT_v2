/**
 * @file Riding Attack runs along the eight grid lines, or rows and columns only by a GM setting (#65, ruling 18).
 * @see module/rules/movement.mjs#ridesDiagonally, #ridingDestinations, module/engine/board.mjs, module/settings.mjs
 *
 * > *"Riding Attack: Can Attack all Units in its path while Moving in a
 * > straight line…"*
 *
 * Ruled 2026-10-02: the eight grid lines, diagonals included, stay the default.
 * A GM world setting, `ridingAttackLines`, holds the ride to rows and columns.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { ridingAttackPath, ridingDestinations, ridesDiagonally } from "../../module/rules/movement.mjs";

beforeAll(prepareSubjects, 60_000);

/** Quetzalcoatl afoot at (6,6), MOV 7, with the board's rules as given. */
const ride = (rules, fn) => withSubjects(
  [{ from: "quetzalcoatl", id: "q", panel: { i: 6, j: 6 } }],
  ({ unit, board }) => fn(unit("q"), board),
  { settings: rules ? { rules } : {} },
);

describe("the eight lines are the default", () => {
  it("a diagonal ride is straight on a board with no setting", async () => {
    const out = await ride(null, (q, board) => ({
      diagonal: ridingAttackPath(q, { i: 9, j: 9 }, board).ok,
      lines: new Set(ridingDestinations(q, board).map((p) => `${Math.sign(p.i - 6)},${Math.sign(p.j - 6)}`)).size,
    }));
    expect(out).toEqual({ diagonal: true, lines: 8 });
  });

  it("absent reads as the eight lines", () => {
    expect(ridesDiagonally({})).toBe(true);
    expect(ridesDiagonally({ rules: { ridingAttackLines: "eight" } })).toBe(true);
  });
});

describe("rows and columns only", () => {
  it("refuses a diagonal and keeps a row and a column", async () => {
    const out = await ride({ ridingAttackLines: "orthogonal" }, (q, board) => ({
      diagonal: ridingAttackPath(q, { i: 9, j: 9 }, board),
      row: ridingAttackPath(q, { i: 6, j: 10 }, board).ok,
      column: ridingAttackPath(q, { i: 2, j: 6 }, board).ok,
      lines: new Set(ridingDestinations(q, board).map((p) => `${Math.sign(p.i - 6)},${Math.sign(p.j - 6)}`)).size,
    }));
    expect(out.diagonal).toEqual({ ok: false, reason: "notStraight" });
    expect(out).toMatchObject({ row: true, column: true, lines: 4 });
  });
});

describe("the setting reaches the rules", () => {
  it("is a GM world setting, eight by default", () => {
    const src = readFileSync("module/settings.mjs", "utf8").replaceAll("\r\n", "\n");
    const block = src.slice(src.indexOf('s("ridingAttackLines"'));
    expect(block.slice(0, block.indexOf("});"))).toMatch(/default: "eight"/);
  });

  it("the live board carries it on board.rules", () => {
    expect(readFileSync("module/engine/board.mjs", "utf8")).toMatch(/ridingAttackLines: setting\("ridingAttackLines", "eight"\)/);
  });
});
