/**
 * @file A client viewing a deleted Level goes where its selected token landed, or to the ground (#176).
 * @see module/engine/level-exit.mjs, module/engine/scene-levels.mjs
 *
 * Live: the GM viewed the Quetzalcoatlus's deck and pressed End. The ground's
 * `visibility.levels` write redrew the canvas, Foundry's move off the deleted
 * Level landed in that draw, and the client was left on no scene. Ruled
 * 2026-10-02: the Level the selected token lands on, else the ground, for every
 * path that deletes a Level.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { exitLevelFor } from "../../module/engine/level-exit.mjs";

const base = { deletedIds: new Set(["deck"]), levelIds: ["ground", "garden"], groundId: "ground" };

describe("exitLevelFor", () => {
  it("stays put when this client was not viewing the deleted Level", () => {
    expect(exitLevelFor({ ...base, viewedId: "ground", tokenLevelId: null })).toBeNull();
    expect(exitLevelFor({ ...base, viewedId: null, tokenLevelId: null })).toBeNull();
  });

  it("follows the selected token to the Level it landed on", () => {
    expect(exitLevelFor({ ...base, viewedId: "deck", tokenLevelId: "garden" })).toBe("garden");
  });

  it("goes to the ground with no token selected, or one still on the deleted Level", () => {
    expect(exitLevelFor({ ...base, viewedId: "deck", tokenLevelId: null })).toBe("ground");
    expect(exitLevelFor({ ...base, viewedId: "deck", tokenLevelId: "deck" })).toBe("ground");
  });
});

describe("every Level deletion", () => {
  const src = readFileSync("module/engine/scene-levels.mjs", "utf8").replaceAll("\r\n", "\n");

  it("deletes the Level before the ground write, in both deleters", () => {
    for (const fn of ["export async function destroyLevel", "deleteEmbeddedDocuments(\"Level\", ids)"]) {
      const at = src.indexOf(fn);
      expect(at, fn).toBeGreaterThan(-1);
    }
    const one = src.slice(src.indexOf("export async function destroyLevel"));
    expect(one.indexOf('deleteEmbeddedDocuments("Level", [level.id])')).toBeLessThan(one.indexOf('"visibility.levels"'));
    const sweep = src.slice(src.lastIndexOf("\n", src.indexOf('deleteEmbeddedDocuments("Level", ids)') - 400));
    expect(sweep.indexOf('deleteEmbeddedDocuments("Level", ids)')).toBeLessThan(sweep.indexOf('"visibility.levels"'));
  });

  it("every client listens for it", () => {
    const boot = readFileSync("module/fgt.mjs", "utf8");
    expect(boot).toMatch(/LevelExit\.attach\(\)/);
    expect(readFileSync("module/engine/level-exit.mjs", "utf8")).toMatch(/Hooks\.on\("deleteLevel"/);
  });
});
