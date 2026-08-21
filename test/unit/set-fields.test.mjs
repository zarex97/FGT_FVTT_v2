/**
 * @file `SetField` values are Sets, and Sets have no `.includes`.
 * @see docs/22-data-models.md
 *
 * This shipped and broke every Servant sheet:
 *
 * ```js
 * (this.document.system?.servantClasses ?? []).includes("caster")
 * //                                            ^ TypeError: not a function
 * ```
 *
 * `SetField` instantiates as a **`Set`**, which has `.has` and not `.includes`.
 * The `?? []` fallback reads like a guard and defends against nothing here: the
 * field is required, so it is always present and always a Set.
 *
 * Two reasons no other test caught it. The rules layer works on **snapshots**,
 * where `snapshotUnit` has always spread these into arrays — so `.includes` is
 * correct there and the pattern looks safe when read. And the layers that touch
 * documents directly have no unit tests, because they need a live world.
 *
 * So the rule this pins is narrow and mechanical: **in the layers that read
 * documents, a SetField must be spread before `.includes`.**
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** @param {string} dir @returns {string[]} */
function mjsUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return mjsUnder(path);
    return e.name.endsWith(".mjs") ? [path] : [];
  });
}

/** Every field declared as a `SetField` anywhere in the schema. */
function setFieldNames() {
  const names = new Set();
  for (const file of mjsUnder("module/data")) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(\w+):\s*new fields\.SetField\(/g)) names.add(m[1]);
  }
  return names;
}

/**
 * The layers that hold real documents. `module/rules` and `module/domain` are
 * pure and see snapshots, where these fields are already arrays.
 */
const DOCUMENT_LAYERS = ["module/apps", "module/engine", "module/documents", "module/data"];

/**
 * Pure-layer files that are nonetheless handed **document** data by some
 * caller, so the array assumption does not hold for them either.
 *
 * `setup-rolls` is here because `summonServant` passes a compendium Servant's
 * `system` straight in, and `region.includes(...)` threw on the first real
 * summon. The engine now normalizes at that boundary — this list is the
 * reminder that the exemption for `module/rules` is an assumption rather than
 * a guarantee.
 */
const MIXED_LAYERS = ["module/rules/setup-rolls.mjs"];

describe("SetField access", () => {
  const names = setFieldNames();

  it("finds the SetFields it is meant to police", () => {
    // A scan that silently matched nothing would pass every assertion below.
    expect(names.size).toBeGreaterThan(3);
    expect(names).toContain("servantClasses");
  });

  it("never calls .includes on one without spreading it first", () => {
    /** @type {string[]} */
    const bad = [];

    const files = [...DOCUMENT_LAYERS.flatMap(mjsUnder), ...MIXED_LAYERS];
    {
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        const lines = src.split("\n");

        lines.forEach((line, index) => {
          // Prose, not code. A comment describing the bug is not the bug, and
          // this guard's own explanation would otherwise fail it.
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

          for (const name of names) {
            // `.includes` reached through this field, on the same line.
            if (!new RegExp(`\\b${name}\\b[^\\n]*\\.includes\\(`).test(line)) continue;
            // Spread first — `[...(x.foo ?? [])].includes(...)` — is correct,
            // and is what `snapshotUnit` does.
            if (new RegExp(`\\[\\s*\\.\\.\\.[^\\n]*\\b${name}\\b`).test(line)) continue;
            // `Array.from(...)` is the same thing said differently.
            if (new RegExp(`Array\\.from\\([^\\n]*\\b${name}\\b`).test(line)) continue;

            bad.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }

    expect(bad).toEqual([]);
  });
});
