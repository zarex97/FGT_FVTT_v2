/**
 * @file Every `system.` path the writers touch must exist on a schema.
 * @see module/engine/io.mjs, module/data/actor/
 *
 * A Foundry DataModel **silently drops** an update to a field it does not
 * declare. There is no error, no warning, and the write returns successfully —
 * so the only symptom is that the value never changes.
 *
 * `io.defeat` wrote `system.defeated` from the day it was written and no actor
 * schema had the field. Every defeat in the game put a skull on the token,
 * incremented the Grail counter, freed the contracted Servants, and left the
 * Unit unmarked: still a legal target, still taking its turn, still alive to
 * anything that asked.
 *
 * This is the same defect shape as `system.active`, `timing.window` and
 * `alsoTriggers`. It is worth a machine.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Literal `system.<path>` writes in the IO layer. */
const WRITES = [...readFileSync("module/engine/io.mjs", "utf8").matchAll(/"system\.([A-Za-z0-9_.]+)"/g)]
  .map((m) => m[1])
  // Only the root matters: a DataModel that declares `health` accepts
  // `health.value`, and `resources` is an untyped object by design.
  .map((p) => p.split(".")[0]);

/** @param {string} dir @returns {string[]} */
function sourcesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory()
    ? sourcesUnder(`${dir}/${e.name}`)
    : (e.name.endsWith(".mjs") ? [`${dir}/${e.name}`] : [])));
}

/**
 * Every field name any DataModel declares.
 *
 * Across `module/data` as a whole rather than the actor schemas alone: the IO
 * layer writes to items and to the match document too, and a guard that only
 * knew about actors would report those as missing.
 *
 * The pattern is deliberately loose — `new fields.X(...)`, `new RankField()`,
 * `resourceField(0)` — because the point is "somebody declared this name", not
 * which field class they used.
 */
const DECLARED = new Set(
  sourcesUnder("module/data").flatMap((f) => [...readFileSync(f, "utf8")
    .matchAll(/^\s+([A-Za-z][A-Za-z0-9_]*): (?:new [A-Za-z.]+|[a-z][A-Za-z]*Field)\(/gm)].map((m) => m[1])),
);

describe("the actor schemas", () => {
  it("declare at least the fields this guard knows about", () => {
    // Proves the scan found something; an empty set would make the next test
    // pass for the wrong reason.
    expect(DECLARED.has("health")).toBe(true);
    expect(DECLARED.has("grailCounter")).toBe(true);
    expect(WRITES.length).toBeGreaterThan(3);
  });

  it("declare every field the IO layer writes", () => {
    const missing = [...new Set(WRITES)].filter((f) => !DECLARED.has(f));
    expect(missing).toEqual([]);
  });

  it("declare `defeated`, which is what this guard was written for", () => {
    expect(DECLARED.has("defeated")).toBe(true);
    expect(DECLARED.has("defeatCause")).toBe(true);
  });
});

describe("a schema's own defaults must satisfy its own validation", () => {
  /**
   * Every `StringField` that carries BOTH `choices` and an `initial` must
   * accept that initial.
   *
   * Foundry's `StringField` defaults to `blank: false` when `choices` is
   * given, so `{initial: "", choices: ["", ...]}` fails its own validation --
   * and because an invalid field makes the whole `system` invalid, EVERY actor
   * in the world then fails to initialize. That is what `linkedGroup`'s
   * `linkedDeath` and `sharedCooldowns` did: shipped, merged, and silently
   * breaking every Servant that was not half of a linked pair.
   *
   * A source scan rather than a schema walk, because the failure is in the
   * DECLARATION and a walk would need a live Foundry to instantiate.
   */
  it("never declares a blank initial with choices and no `blank: true`", () => {
    const files = readdirSync("module/data/actor").filter((f) => f.endsWith(".mjs"));
    /** @type {string[]} */
    const bad = [];

    for (const file of files) {
      const src = readFileSync(join("module/data/actor", file), "utf8");
      // One declaration may span several lines, so normalise whitespace and
      // look at each `new fields.StringField({...})` as a unit.
      for (const m of src.replace(/\s+/g, " ").matchAll(/new fields\.StringField\(\{([^}]*)\}\)/g)) {
        const body = m[1];
        if (!body.includes("choices")) continue;
        if (!/initial:\s*""/.test(body)) continue;
        if (/blank:\s*true/.test(body)) continue;
        bad.push(`module/data/actor/${file}: ${m[0].slice(0, 110)}`);
      }
    }

    expect(bad).toEqual([]);
  });
});
