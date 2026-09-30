/**
 * @file A boarding roll is shown to the table (#68).
 * @see module/engine/platforms.mjs#boardPlatform, docs/46 §46.4-BY
 *
 * > *"An enemy Unit can attempt to board the HGoB. Roll a twelve-sided die."*
 *
 * The roll went to the scheduler log and nowhere else. On the Semiramis audit
 * Heracles rolled 1 against 8 and the player read *"That cannot be used right
 * now"*: the failure came back with no reason, and the action bar's generic
 * refusal filled the gap. A success was no more visible -- the token moved.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("module/engine/platforms.mjs", "utf8");
const body = src.slice(src.indexOf("export async function boardPlatform"), src.indexOf("async function comeAboard"));
const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

describe("boardPlatform announces its roll", () => {
  it("posts the roll and the target to chat", () => {
    expect(body).toMatch(/announceBoarding\(/);
    expect(src).toMatch(/async function announceBoarding[\s\S]*ChatMessage\.create/);
  });

  it("names a failed roll, rather than returning no reason", () => {
    expect(body).toMatch(/reason: ok \? null : "boardFailed"/);
    expect(lang["FGT.Action.Refusal.boardFailed"]).toBeTruthy();
  });

  it("has a line for each outcome", () => {
    expect(lang["FGT.Platform.BoardSuccess"]).toMatch(/\{roll\}.*\{target\}|\{target\}.*\{roll\}/);
    expect(lang["FGT.Platform.BoardFailed"]).toMatch(/\{roll\}.*\{target\}|\{target\}.*\{roll\}/);
  });
});

// > *"...it performs an Agility Check. If successful, it has a choice ... If
// > failed, it lands on the Game Board panel directly under it and takes
// > (10*2d6) STR damage."*
//
// Rolled, and never shown: Heracles fell off the garden with no card, and the
// only trace of the check was his Health dropping (§46.4-CA).
describe("knockOff announces its Agility Check", () => {
  const off = src.slice(src.indexOf("export async function knockOff"), src.indexOf("async function agilityCheckPasses"));

  it("posts the roll, the target and the outcome", () => {
    expect(off).toMatch(/announceFall\(/);
    expect(src).toMatch(/async function announceFall[\s\S]*ChatMessage\.create/);
  });

  it("has a line for passing, failing, and being caught by the Servant", () => {
    for (const k of ["FGT.Platform.FallPassed", "FGT.Platform.FallFailed", "FGT.Platform.FallRescued"]) {
      expect(lang[k]).toMatch(/\{roll\}/);
    }
  });
});
