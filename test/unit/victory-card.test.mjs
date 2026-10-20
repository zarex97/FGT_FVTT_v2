/**
 * @file A won War says so once, naming the faction (found live 2026-10-19).
 * @see module/engine/scheduler-hooks.mjs#advanceGrail
 *
 * War 157 was won by elimination, and the chat log read *"Every rival has
 * fallen. Victory goes to faction-1."* at one Round's end and again at the
 * next: the faction by its id, and the card at every boundary after the win.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const SRC = readFileSync("module/engine/scheduler-hooks.mjs", "utf8").replace(/\r\n/g, "\n");
const body = SRC.slice(SRC.indexOf("async function advanceGrail"), SRC.indexOf('Hooks.callAll("fgtVictory"'));

describe("the victory card", () => {
  it("is posted once per War: a flag on the War remembers it", () => {
    expect(body).toMatch(/if \(combat\.getFlag\?\.\("fgt", "victory"\)\) return;/);
    expect(body.indexOf('setFlag?.("fgt", "victory"')).toBeLessThan(body.indexOf("ChatMessage.create({\n    content: `<h2>"));
  });

  it("names the winner by the faction's name, not its id", () => {
    expect(body).toMatch(/factions\(combat\)\.find\(\(f\) => f\.id === victory\.faction\)\?\.name/);
    expect(body).not.toMatch(/\{ faction: victory\.faction \}/);
  });
});
