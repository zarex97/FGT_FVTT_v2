/**
 * @file Switching a mode on is an Act (ruled 2026-10-19, #194).
 * @see module/apps/actor-sheet/sheet.mjs#toggleMode, docs/23-reactions.md
 *
 * > *"This Servant's Master loses 30 Health at the end of every Turn it Acts."*
 *
 * Pressed live: Penthesilea switched Mad Enhancement on, and her Master lost
 * nothing at that Turn's end, while a Turn she only Evaded cost 30. The toggle
 * wrote the mode and nothing on the Turn record. Its writer is on the sheet,
 * which the test world does not stand in for, so this reads the source.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const SRC = readFileSync("module/apps/actor-sheet/sheet.mjs", "utf8").replace(/\r\n/g, "\n");
const toggle = SRC.slice(SRC.indexOf("static async toggleMode("), SRC.indexOf("static async #onUseAbility("));

describe("a mode switched on (#194)", () => {
  it("marks its Unit as having Acted, after the switch is written", () => {
    // The switch's patch, shared with the engine's forced switch (#319).
    const write = toggle.indexOf("item.update(modeSwitchPatch(active");
    const mark = toggle.search(/I\.markTurn\(actor\.id, \{ acted: true \}\)/);
    expect(write).toBeGreaterThan(-1);
    expect(mark, "the Turn record is marked").toBeGreaterThan(write);
  });

  it("only when switched on, and only while a War's clock runs", () => {
    expect(toggle).toMatch(/if \(active && clockRunning\(\)\) \{[\s\S]{0,400}?I\.markTurn\(actor\.id, \{ acted: true \}\)/);
  });
});
