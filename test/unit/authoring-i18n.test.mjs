/**
 * @file Every authoring label and hint resolves to real text.
 * @see module/rules/authoring/, docs/29-user-interface.md §29.9
 *
 * D5 says a keyword must carry a hint. This is the other half: a hint that is
 * a localization key nothing defines renders as `FGT.Authoring.Element.AuraHint`
 * on screen, which is worse than no hint — it looks like a bug in the system
 * rather than a gap in the vocabulary.
 *
 * The `english` field on each descriptor is held against `lang/en.json` in both
 * directions, so the sentence a maintainer reads beside the executor is the
 * sentence a GM reads in the tooltip. They cannot drift apart silently.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ELEMENT_DESCRIPTORS, ELEMENT_IDS } from "../../module/rules/authoring/elements.mjs";
import { PHASE_DESCRIPTORS, PHASE_IDS } from "../../module/rules/authoring/phases.mjs";
import {
  REQUIREMENT_DESCRIPTORS, REQUIREMENT_IDS,
  CS_REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_IDS,
} from "../../module/rules/authoring/requirements.mjs";

const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

describe("every authoring key resolves", () => {
  it("defines a label for every rule element", () => {
    for (const id of ELEMENT_IDS) {
      const key = ELEMENT_DESCRIPTORS[id].label;
      expect(lang[key], `${key} is not in lang/en.json`).toBeTruthy();
    }
  });

  it("defines a hint for every rule element", () => {
    for (const id of ELEMENT_IDS) {
      const key = ELEMENT_DESCRIPTORS[id].hint;
      expect(lang[key], `${key} is not in lang/en.json`).toBeTruthy();
    }
  });

  it("keeps the source sentence and the shipped sentence identical", () => {
    // The whole reason `english` is on the descriptor: a maintainer reading
    // the table beside the executor must be reading what a GM actually sees.
    for (const id of ELEMENT_IDS) {
      const d = ELEMENT_DESCRIPTORS[id];
      expect(lang[d.hint], `${id}: lang/en.json disagrees with the table`).toBe(d.english);
    }
  });

  it("gives every element a hint that is a sentence, not a restated name", () => {
    // "Aura: aura" helps nobody. The shortest real hint in the table is well
    // over this, so the bar catches a placeholder rather than a terse entry.
    for (const id of ELEMENT_IDS) {
      expect(ELEMENT_DESCRIPTORS[id].english.length, id).toBeGreaterThan(20);
    }
  });
});

describe("every phase key resolves", () => {
  it("defines a label and a hint for every phase kind", () => {
    for (const id of PHASE_IDS) {
      const d = PHASE_DESCRIPTORS[id];
      expect(lang[d.label], `${d.label} is not in lang/en.json`).toBeTruthy();
      expect(lang[d.hint], `${d.hint} is not in lang/en.json`).toBeTruthy();
    }
  });

  it("keeps the source sentence and the shipped sentence identical", () => {
    for (const id of PHASE_IDS) {
      const d = PHASE_DESCRIPTORS[id];
      expect(lang[d.hint], `${id}: lang/en.json disagrees with the table`).toBe(d.english);
    }
  });
});

describe("every requirement key resolves", () => {
  const tables = [
    ["ability", REQUIREMENT_IDS, REQUIREMENT_DESCRIPTORS],
    ["command spell", CS_REQUIREMENT_IDS, CS_REQUIREMENT_DESCRIPTORS],
  ];

  it("defines a label and a hint for every requirement kind", () => {
    for (const [which, ids, table] of tables) {
      for (const id of ids) {
        const d = table[id];
        expect(lang[d.label], `${which} ${d.label} is not in lang/en.json`).toBeTruthy();
        expect(lang[d.hint], `${which} ${d.hint} is not in lang/en.json`).toBeTruthy();
      }
    }
  });

  it("keeps the source sentence and the shipped sentence identical", () => {
    // `inZone` exists in BOTH vocabularies with different fields. They share a
    // localization key, so the two English sentences have to agree -- and this
    // is what notices if someone edits one of them.
    for (const [which, ids, table] of tables) {
      for (const id of ids) {
        const d = table[id];
        expect(lang[d.hint], `${which} ${id}: lang/en.json disagrees with the table`).toBe(d.english);
      }
    }
  });
});

describe("D29.15: no key is the prefix of another", () => {
  it("holds across the whole file", () => {
    // One collision silently voids the entire localization file. The
    // `<id>Hint` suffix has no dot for exactly this reason.
    const keys = Object.keys(lang);
    const collisions = [];
    for (const a of keys) {
      for (const b of keys) {
        if (a !== b && b.startsWith(`${a}.`)) collisions.push(`${a} < ${b}`);
      }
    }
    expect(collisions).toEqual([]);
  });
});
