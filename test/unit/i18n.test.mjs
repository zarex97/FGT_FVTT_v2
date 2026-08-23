/**
 * @file Every localization key a template or module asks for exists.
 * @see docs/29-user-interface.md
 *
 * A missing key does not throw. Foundry renders the key itself, so the button
 * reads `FGT.Summon.Confirm` and the system looks broken in a way no test and
 * no lint pass would ever mention — the same "loads correctly, does nothing"
 * shape as an unread rule element, moved into the interface.
 *
 * Dynamic keys (`FGT.Use.${kind}`, built with `concat`) cannot be checked
 * statically, so their prefixes are listed and their families are checked
 * instead: a family with no keys at all is the failure worth catching.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const strings = JSON.parse(readFileSync("lang/en.json", "utf8"));

/** @param {string} dir @param {string} ext @returns {string[]} */
function filesUnder(dir, ext) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return filesUnder(path, ext);
    return e.name.endsWith(ext) ? [path] : [];
  });
}

/**
 * Key families built at runtime, which a static scan cannot resolve.
 * Each is checked for having *some* member rather than for an exact key.
 */
const DYNAMIC_FAMILIES = ["FGT.Use.", "FGT.Ladder.", "FGT.Prompt.", "FGT.Check."];

describe("localization keys", () => {
  it("exist for every literal key the templates use", () => {
    /** @type {string[]} */
    const missing = [];

    for (const file of filesUnder("templates", ".hbs")) {
      const src = readFileSync(file, "utf8");
      // `{{localize "KEY"}}` and `{{localize 'KEY' a=b}}`, but not
      // `{{localize (concat ...)}}` — that one has no literal to check.
      for (const m of src.matchAll(/\{\{#?localize\s+["']([^"']+)["']/g)) {
        if (!(m[1] in strings)) missing.push(`${file}: ${m[1]}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("exist for every literal key the modules use", () => {
    /** @type {string[]} */
    const missing = [];

    for (const file of filesUnder("module", ".mjs")) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/i18n\.(?:localize|format)\(\s*["'`]([^"'`$]+)["'`]/g)) {
        if (!(m[1] in strings)) missing.push(`${file}: ${m[1]}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("has at least one key in every family built at runtime", () => {
    const keys = Object.keys(strings);

    for (const prefix of DYNAMIC_FAMILIES) {
      expect(keys.some((k) => k.startsWith(prefix)), `no keys under "${prefix}"`).toBe(true);
    }
  });

  it("has no key that is also the prefix of another key", () => {
    // Foundry expands the flat dotted keys into a tree. A key that is both a
    // STRING and the prefix of another key asks that tree to hold a string and
    // an object at the same node, `expandObject` throws, and the merge of the
    // WHOLE file is abandoned -- so one bad pair takes down all 591 keys and
    // every string in the system renders as its own name.
    //
    // Found the honest way: `FGT.Editor.Kind` was the label on a field whose
    // options were `FGT.Editor.Kind.classSkill` and friends. Nothing failed
    // loudly; the entire interface just started showing key names.
    const keys = Object.keys(strings);
    const all = new Set(keys);

    /** @type {string[]} */
    const clashes = [];
    for (const key of keys) {
      const parts = key.split(".");
      for (let i = 1; i < parts.length; i++) {
        const prefix = parts.slice(0, i).join(".");
        if (all.has(prefix)) clashes.push(`"${prefix}" is a string, but "${key}" needs it to be an object`);
      }
    }

    expect(clashes).toEqual([]);
  });

  it("has no key whose value is empty", () => {
    // An empty value renders as nothing at all, which reads as a layout bug
    // rather than as a missing string.
    expect(Object.entries(strings).filter(([, v]) => typeof v === "string" && v.trim() === ""))
      .toEqual([]);
  });
});
