/**
 * @file Health is read through one helper, because it has two shapes.
 * @see module/domain/health.mjs
 *
 * A document stores `health: {value, max}`; `snapshotUnit` flattens it to a
 * NUMBER. Six rules files read `unit.health.value` directly, which is right
 * against a document and silently zero against a snapshot — and the `?? 0`
 * beside each one turned that into a plausible-looking answer.
 *
 * Two consequences, both found only by firing a Noble Phantasm in a live world:
 * `cannotPay` refused **every** NP ever attempted, and `mayOrderAnotherServant`
 * refused every second Servant. Every fixture in the unit tests used the
 * document shape, so the code and the tests agreed with each other.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { currentHealth, maxHealth, isUndamageable } from "../../module/domain/health.mjs";

/** @param {string} dir @returns {string[]} */
function mjsUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return mjsUnder(path);
    return e.name.endsWith(".mjs") ? [path] : [];
  });
}

describe("currentHealth", () => {
  it("reads the snapshot shape, which is a bare number", () => {
    expect(currentHealth({ health: 250 })).toBe(250);
  });

  it("reads the document shape", () => {
    expect(currentHealth({ health: { value: 250, max: 500 } })).toBe(250);
  });

  it("reads zero as zero rather than as absent", () => {
    // A Servant at 0 is about to be defeated; the fallback must not rescue it.
    expect(currentHealth({ health: 0 })).toBe(0);
    expect(currentHealth({ health: { value: 0, max: 500 } })).toBe(0);
  });

  it("returns the fallback for a missing resource", () => {
    expect(currentHealth({}, 7)).toBe(7);
  });

  it("treats null as the fallback, and says so separately", () => {
    // `null` is intrinsically undamageable, not dead. A check that conflates
    // them defeats Pale Rider.
    expect(currentHealth({ health: null })).toBe(0);
    expect(isUndamageable({ health: null })).toBe(true);
    expect(isUndamageable({ health: 0 })).toBe(false);
  });
});

describe("maxHealth", () => {
  it("reads the document shape", () => {
    expect(maxHealth({ health: { value: 10, max: 500 } })).toBe(500);
  });

  it("falls back to the snapshot's separate maximum", () => {
    expect(maxHealth({ health: 10, healthMax: 500 })).toBe(500);
  });
});

describe("the rules layer", () => {
  it("never reads `.health.value` off a unit directly", () => {
    /** @type {string[]} */
    const bad = [];

    for (const file of [...mjsUnder("module/rules"), ...mjsUnder("module/domain")]) {
      if (file.endsWith("health.mjs")) continue;
      const src = readFileSync(file, "utf8");

      src.split("\n").forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

        // `"health.value"` as a STAT PATH string is legal, so quoted spans go
        // first. What remains is code.
        const code = line
          .replaceAll(/"[^"]*"/g, "")
          .replaceAll(/'[^']*'/g, "")
          .replaceAll(/`[^`]*`/g, "");

        // A read off a DOCUMENT's system data is legal too — `system.health`,
        // or the `sys` alias this codebase uses for it. `snapshotUnit` is where
        // the flat form is created, and it has to read the nested one to do so.
        if (code.includes("system.health") || code.includes("system?.health")) return;
        if (code.includes("sys.health") || code.includes("sys?.health")) return;

        if (code.includes("health.value") || code.includes("health?.value")) {
          bad.push(`${file}:${index + 1}: ${trimmed}`);
        }
      });
    }

    expect(bad).toEqual([]);
  });
});
