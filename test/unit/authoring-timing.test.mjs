/**
 * @file The timing windows as the editor offers them.
 * @see module/rules/authoring/timing.mjs
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ABILITY_WINDOW_IDS, ABILITY_WINDOWS } from "../../module/rules/windows.mjs";
import { descriptorProblems } from "../../module/rules/authoring/contract.mjs";
import {
  TIMING_DESCRIPTORS, TIMING_IDS, AGAINST_FIELDS,
} from "../../module/rules/authoring/timing.mjs";

const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

describe("drift: descriptors and the window vocabulary", () => {
  it("describes every window an ability may name", () => {
    for (const id of ABILITY_WINDOW_IDS) {
      expect(TIMING_IDS, `windows.mjs knows "${id}" and no GM can choose it`).toContain(id);
    }
  });

  it("describes no window the vocabulary does not know", () => {
    for (const id of TIMING_IDS) {
      expect(ABILITY_WINDOW_IDS, `the picker offers "${id}" and windows.mjs has never heard of it`)
        .toContain(id);
    }
  });

  it("takes its sentence from the vocabulary rather than restating it", () => {
    // Four partial lists once disagreed about what a window was. A second copy
    // of the prose would be a fifth.
    for (const id of TIMING_IDS) {
      expect(TIMING_DESCRIPTORS[id].english).toBe(ABILITY_WINDOWS[id].hint);
    }
  });
});

describe("every timing descriptor is well formed", () => {
  it("has an id, a label, a hint and renderable fields", () => {
    for (const id of TIMING_IDS) {
      expect(descriptorProblems(TIMING_DESCRIPTORS[id]), id).toEqual([]);
    }
  });

  it("marks the one window nothing dispatches", () => {
    expect(TIMING_DESCRIPTORS.ownTurn.dispatched).toBe(false);
    for (const id of TIMING_IDS.filter((w) => w !== "ownTurn")) {
      expect(TIMING_DESCRIPTORS[id].dispatched, id).toBe(true);
    }
  });

  it("resolves every label and hint in lang/en.json", () => {
    for (const id of TIMING_IDS) {
      const d = TIMING_DESCRIPTORS[id];
      expect(lang[d.label], `${d.label} missing`).toBeTruthy();
      expect(lang[d.hint], `${d.hint} missing`).toBe(d.english);
    }
  });
});

describe("AGAINST_FIELDS", () => {
  it("carries the four modifiers Akhilleus Kosmos needs", () => {
    // timing: { window: whenAllyAttacked, againstKind: np, againstRank: A,
    //           requiresAoE: true, radius: 2 }
    expect(AGAINST_FIELDS.map((f) => f.key)).toEqual(
      expect.arrayContaining(["againstKind", "againstRank", "requiresAoE", "radius"]),
    );
  });

  it("renders the rank modifier with the rank picker, not free text", () => {
    // "A and above" is a comparison against a rank ladder; a typo in free text
    // silently never matches.
    expect(AGAINST_FIELDS.find((f) => f.key === "againstRank").type).toBe("rank");
  });

  it("resolves every label and hint in lang/en.json", () => {
    for (const f of AGAINST_FIELDS) {
      expect(lang[f.label], `${f.label} missing`).toBeTruthy();
      expect(lang[f.hint], `${f.hint} missing`).toBe(f.english);
    }
  });

  it("covers every against-key the corpus authors", async () => {
    const { readdirSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const known = new Set([...AGAINST_FIELDS.map((f) => f.key), "window"]);
    const missing = [];

    for (const dir of ["abilities", "class-skills"]) {
      for (const f of readdirSync(`packs/_source/${dir}`).filter((n) => n.endsWith(".yml"))) {
        let doc;
        try {
          doc = parse(readFileSync(`packs/_source/${dir}/${f}`, "utf8"));
        } catch {
          continue;
        }
        for (const key of Object.keys(doc?.timing ?? {})) {
          if (!known.has(key)) missing.push(`${dir}/${f}: timing.${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
