/**
 * @file Home Base membership across Levels (#177).
 * @see module/rules/environment.mjs#ownBaseOf, #inPocketDimension, module/rules/identity.mjs
 *
 * Ruled 2026-10-03: a Unit on a platform's Level, above its own Home Base rows,
 * IS inside it -- membership reads (i, j), as it always has. A Unit inside a
 * pocket dimension is not: the Storm Border's Imaginary Numbers Space is
 * somewhere else, not a deck above the board, so whoever is in it is in no Home
 * Base whatever panel it stands on.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { detectRangeOf } from "../../module/rules/identity.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = { rider: "riderSubject0001", deck: "deckSubject00001" };
const HOME = { baseF1: { faction: "f1", panels: [{ i: 5, j: 5 }, { i: 5, j: 6 }, { i: 6, j: 5 }, { i: 6, j: 6 }] } };

/** A Faction 1 Unit aboard `platform`, standing over Faction 1's Home Base rows. */
const aboard = (platform, rider = "heracles") => withSubjects([
  { from: rider, id: ID.rider, state: { factionId: "f1" }, panel: { i: 5, j: 5, k: 1 } },
  { from: platform, id: ID.deck, state: { ownerId: ID.rider, factionId: "f1" }, panel: { i: 5, j: 5, k: 1 } },
], ({ unit, board }) => ({
  aboard: unit(ID.rider).platformId === ID.deck,
  inHomeBase: unit(ID.rider).inHomeBase,
  dimension: unit(ID.deck).isDimension,
  detect: detectRangeOf(unit(ID.rider), board),
}), { settings: { zones: HOME } });

describe("a deck above the Home Base", () => {
  it("is inside it: the Quetzalcoatlus over her rows", async () => {
    const out = await aboard("quetzalcoatlus");
    expect(out).toMatchObject({ aboard: true, inHomeBase: true, dimension: false });
  });

  it("the same on the ground", async () => {
    const out = await withSubjects([
      { from: "heracles", id: ID.rider, state: { factionId: "f1" }, panel: { i: 5, j: 5 } },
    ], ({ unit }) => unit(ID.rider).inHomeBase, { settings: { zones: HOME } });
    expect(out).toBe(true);
  });
});

describe("a pocket dimension over the Home Base", () => {
  it("is in no Home Base: the Storm Border", async () => {
    const out = await aboard("platform-storm-border");
    expect(out).toMatchObject({ aboard: true, inHomeBase: false, dimension: true });
  });

  it("a Caster inside it reads the Detect for outside her base", async () => {
    // Caster Detect is 5 in its own Home Base and 3 outside (Ch. 30).
    const deck = await aboard("quetzalcoatlus", "medea");
    const dimension = await aboard("platform-storm-border", "medea");
    expect([deck.detect, dimension.detect]).toEqual([5, 3]);
  });
});

describe("a dimension with no token", () => {
  // Live: Zero Sail put Nemo on "The Storm Border" Level, and the Storm Border
  // has no ground footprint, so no token: nothing stamped his `platformId`, and
  // he still read `inHomeBase: true`. The Level he stands on is the answer.
  it("is told by the Level the Unit stands on", async () => {
    const { inPocketDimension, inOwnHomeBase } = await import("../../module/rules/environment.mjs");
    const board = { zones: HOME, dimensionLevels: ["stormLevel"], units: [] };
    const nemo = { id: "n", faction: "f1", panel: { i: 5, j: 5 }, levelId: "stormLevel", platformId: null };
    expect(inPocketDimension(nemo, board)).toBe(true);
    expect(inOwnHomeBase(nemo, board)).toBe(false);
    expect(inOwnHomeBase({ ...nemo, levelId: "deckLevel" }, board)).toBe(true);
  });

  it("the live board lists the dimension Levels off the platform actors", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("module/engine/board.mjs", "utf8")).toMatch(/dimensionLevels: game\.actors\s*\.filter\(\(a\) => a\.type === "platform" && a\.system\?\.dimension/);
  });
});
