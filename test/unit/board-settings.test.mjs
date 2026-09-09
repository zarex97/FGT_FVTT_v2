/**
 * @file The war-shape settings the board projects.
 * @see module/rules/snapshot.mjs, module/engine/board.mjs
 */

import { describe, it, expect } from "vitest";
import { snapshotBoard } from "../../module/rules/snapshot.mjs";

const base = { scene: null, actors: [] };

describe("war shape on the board", () => {
  it("takes the match's values when the match states them", () => {
    const board = snapshotBoard({
      ...base,
      settings: {
        warType: "holyGrailWar", ruleset: "normal",
        difficulty: "lunatic", drawPolicy: "unique", homeBaseDepth: 2,
      },
    });
    expect(board.warType).toBe("holyGrailWar");
    expect(board.ruleset).toBe("normal");
    expect(board.difficulty).toBe("lunatic");
    expect(board.drawPolicy).toBe("unique");
    expect(board.homeBaseDepth).toBe(2);
  });

  it("defaults to a Great Holy Grail War under the Advanced ruleset", () => {
    const board = snapshotBoard({ ...base, settings: {} });
    expect(board.warType).toBe("greatHolyGrailWar");
    expect(board.ruleset).toBe("advanced");
    expect(board.drawPolicy).toBe("duplicates");
    expect(board.homeBaseDepth).toBe(3);
  });
});

describe("the difficulty vocabulary", () => {
  const at = (difficulty) => snapshotBoard({ ...base, settings: { difficulty } }).difficulty;

  it("keeps each of the rulebook's four", () => {
    for (const d of ["beginner", "intermediate", "expert", "lunatic"]) expect(at(d)).toBe(d);
  });

  it("reads the retired 'standard' as Intermediate", () => {
    // The setting offered `standard` for this system's whole life and MatchData
    // never accepted it, so a world on the old vocabulary would otherwise carry
    // a difficulty no rule matches.
    expect(at("standard")).toBe("intermediate");
  });

  it("reads anything unrecognised as Intermediate", () => {
    for (const d of [undefined, null, "", "lunatick", 3]) expect(at(d)).toBe("intermediate");
  });
});
