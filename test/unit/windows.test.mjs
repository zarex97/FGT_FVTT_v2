/**
 * @file The ability timing window vocabulary.
 * @see module/rules/windows.mjs, docs/15-abilities.md §15.3
 *
 * `timing.window` is authored by 117 of 195 abilities and, until this module,
 * was matched by string comparison at three scattered call sites with no
 * enumeration anywhere. A typo authored cleanly, validated, passed CI, and
 * produced a reaction window that never fired.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  ABILITY_WINDOWS, ABILITY_WINDOW_IDS, REACTION_WINDOW, ALLY_WINDOW,
  NP_DECLARATION_WINDOW, ATTACKER_WINDOWS, isAbilityWindow, windowsOf,
} from "../../module/rules/windows.mjs";

describe("the vocabulary", () => {
  it("holds exactly the six windows an ability may name", () => {
    expect([...ABILITY_WINDOW_IDS].sort()).toEqual([
      "combatPhaseStart", "damageStep", "ownTurn",
      "whenAllyAttacked", "whenAttacked", "whenTargetedByNP",
    ]);
  });

  it("marks ownTurn as the one window nothing dispatches", () => {
    // It is documentary -- "usable during your Turn", the sheet button. No
    // dispatcher matches it, and a reader who assumes otherwise will go
    // looking for the call site that offers it.
    expect(ABILITY_WINDOWS.ownTurn.dispatched).toBe(false);
    for (const id of ABILITY_WINDOW_IDS.filter((w) => w !== "ownTurn")) {
      expect(ABILITY_WINDOWS[id].dispatched, id).toBe(true);
    }
  });

  it("gives every window a hint, so the editor can explain it", () => {
    for (const id of ABILITY_WINDOW_IDS) {
      expect(ABILITY_WINDOWS[id].hint.length, id).toBeGreaterThan(0);
    }
  });

  it("names the derived constants the dispatchers use", () => {
    expect(REACTION_WINDOW).toBe("whenAttacked");
    expect(ALLY_WINDOW).toBe("whenAllyAttacked");
    expect(NP_DECLARATION_WINDOW).toBe("whenTargetedByNP");
    expect([...ATTACKER_WINDOWS]).toEqual(["damageStep", "combatPhaseStart"]);
  });

  it("derives every constant from the table rather than restating it", () => {
    for (const w of [REACTION_WINDOW, ALLY_WINDOW, NP_DECLARATION_WINDOW, ...ATTACKER_WINDOWS]) {
      expect(ABILITY_WINDOW_IDS, w).toContain(w);
    }
  });
});

describe("isAbilityWindow", () => {
  it("accepts a known window and refuses anything else", () => {
    expect(isAbilityWindow("whenAttacked")).toBe(true);
    // The documented-but-wrong spelling from docs/15-abilities.md §15.3.
    expect(isAbilityWindow("damageStepStart")).toBe(false);
    // A command spell window. The two vocabularies stay separate.
    expect(isAbilityWindow("anyTime")).toBe(false);
    expect(isAbilityWindow(null)).toBe(false);
    expect(isAbilityWindow(42)).toBe(false);
  });
});

describe("windowsOf", () => {
  it("reads a single window", () => {
    expect(windowsOf({ window: "whenAttacked" })).toEqual(["whenAttacked"]);
  });

  it("reads a list, because an ability may name two", () => {
    // Karna's Uncrowned Arms Mastership: "used during your Turn OR at the
    // start of a Combat Phase."
    expect(windowsOf({ window: ["ownTurn", "combatPhaseStart"] }))
      .toEqual(["ownTurn", "combatPhaseStart"]);
  });

  it("reads an absent timing as no windows rather than throwing", () => {
    expect(windowsOf(null)).toEqual([]);
    expect(windowsOf(undefined)).toEqual([]);
    expect(windowsOf({})).toEqual([]);
  });
});

describe("drift: the vocabulary and the dispatchers", () => {
  // Modelled on test/unit/targeting.test.mjs:600-660, which tests BOTH
  // directions because it was written after the picker offered `point` and
  // the resolver only knew `withinRange`.
  /**
   * A window named in PROSE is not a dispatcher naming one. These files
   * explain themselves at length — `reactions.mjs` describes the very
   * inlining this module removed — so the comments come out before the
   * search, or the guard fails on its own documentation.
   */
  const code = (path) => readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  const sources = [
    code("module/rules/reactions.mjs"),
    code("module/engine/attack.mjs"),
    code("module/rules/ability-use.mjs"),
  ].join("\n");

  it("has no dispatcher naming a window as a bare string literal", () => {
    // The defect this module exists to end: `attack.mjs` matched
    // "whenTargetedByNP" as an inline literal, so nothing could enumerate it.
    for (const id of ABILITY_WINDOW_IDS) {
      const literal = new RegExp(`["'\`]${id}["'\`]`, "g");
      const hits = (sources.match(literal) ?? []).length;
      expect(hits, `"${id}" is still written as a literal in a dispatcher; import it from windows.mjs`)
        .toBe(0);
    }
  });
});
