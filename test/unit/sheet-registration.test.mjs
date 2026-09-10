/**
 * @file Who gets which sheet.
 * @see module/apps/sheet-choice.mjs, docs/29-user-interface.md §29.6
 *
 * The reported bug: Items -> Create Item -> Ability opened the plain display
 * sheet -- a name, a rank, a cooldown -- because AbilityEditor was registered
 * as no Item sheet at all. It could only be reached from the pencil on an
 * actor's ability card, so an ability had to be OWNED before it could be
 * authored.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sheetFor, EDITOR_TYPES } from "../../module/apps/sheet-choice.mjs";

describe("sheetFor", () => {
  it("gives a GM the editor for every authorable item type", () => {
    for (const type of EDITOR_TYPES) {
      expect(sheetFor(type, { isGM: true }), type).toBe("editor");
    }
  });

  it("gives a player the read sheet", () => {
    // The editor writes rule elements, and a player who reorders a phase has
    // changed the ability for the whole table.
    expect(sheetFor("ability", { isGM: false })).toBe("read");
    expect(sheetFor("noblePhantasm", { isGM: false })).toBe("read");
  });

  it("gives everyone the read sheet for a type the editor cannot author", () => {
    expect(sheetFor("masterEssence", { isGM: true })).toBe("read");
    expect(sheetFor("equipment", { isGM: true })).toBe("read");
  });

  it("treats a missing user as not a GM rather than throwing", () => {
    expect(sheetFor("ability", undefined)).toBe("read");
  });

  it("names only Item types that actually exist", () => {
    // `classSkill` is NOT an Item type -- class skills are `ability`
    // documents in the class-skills pack. Registering a sheet for a type
    // system.json does not declare throws during `init` and takes settings
    // registration down with it.
    const declared = JSON.parse(readFileSync("system.json", "utf8"));
    const types = Object.keys(declared.documentTypes?.Item ?? {});
    for (const type of EDITOR_TYPES) {
      expect(types, `system.json declares no Item type "${type}"`).toContain(type);
    }
  });
});
