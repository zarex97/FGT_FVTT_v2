/**
 * @file An End Turn warning about the other side's Unit names it publicly (found live, #256).
 * @see module/apps/hud/turn-panel.mjs#forViewer, module/rules/budget.mjs#copyPicksOwed
 *
 * Pressed live: Red's player read *"Scáthach must pick the two Skills Wisdom of
 * Dún Scáith copies before this Turn ends."* and *"Karna must choose which effect
 * a Skill starts with"*, about two Blue Lancers whose True Names were hidden.
 * The gate reads the whole board, so the other side's choice blocks this side's
 * Turn, and its message was built for the Unit's own player. The panel is a
 * Foundry application the test world does not stand in for, so this reads the
 * source; the press is in #256.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const SRC = readFileSync("module/apps/hud/turn-panel.mjs", "utf8").replace(/\r\n/g, "\n");
const LANG = JSON.parse(readFileSync("lang/en.json", "utf8"));

describe("End Turn warnings, as the viewer reads them", () => {
  it("both the panel and the refused press pass through forViewer", () => {
    expect(SRC).toMatch(/unmet: forViewer\(verdict\.unmet, board\)/);
    expect(SRC).toMatch(/ui\.notifications\.warn\(forViewer\(verdict\.unmet, currentBoard\(\)\)\[0\]\.message\)/);
    expect(SRC).not.toMatch(/ui\.notifications\.warn\(verdict\.unmet\[0\]\.message\)/);
  });

  it("a Unit the viewer does not own is named by shownNameById, with no Skill", () => {
    const fn = SRC.slice(SRC.indexOf("function forViewer("), SRC.indexOf("async function onWarRules"));
    expect(fn).toMatch(/\.isOwner/);
    expect(fn).toMatch(/FGT\.HUD\.UnmetOther", \{ name: shownNameById\(w\.unitId, board\) \}/);
    expect(LANG["FGT.HUD.UnmetOther"]).toBe("{name} owes a choice before this Turn ends.");
  });
});
