/**
 * @file The build's known Silent Drops only ever shrink.
 * @see tools/lib/known-drops.mjs, tools/lib/model-check.mjs
 *
 * Each entry is an Authored Key in shipped content that the DataModel does not
 * keep, so a Clause does not happen in a live world. The list exists so the
 * model check could land without fixing thirty lost Clauses blind; it must not
 * become the place a new drop goes to be ignored.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { KNOWN_BUILD_DROPS } from "../../tools/lib/known-drops.mjs";

describe("the known build drops", () => {
  it("only shrinks", () => {
    // Lower this whenever an entry's issue is fixed. Raising it needs an issue
    // filed for every new entry, and a reason the drop cannot be fixed now.
    expect(KNOWN_BUILD_DROPS.length).toBeLessThanOrEqual(11);
  });

  it("names an issue for every entry", () => {
    for (const d of KNOWN_BUILD_DROPS) expect(d.issue, `${d.file} ${d.path}`).toMatch(/^#\d+$/);
  });

  it("names files that exist", () => {
    for (const d of KNOWN_BUILD_DROPS) expect(existsSync(d.file), d.file).toBe(true);
  });

  it("lists each drop once", () => {
    const keys = KNOWN_BUILD_DROPS.map((d) => `${d.file} ${d.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
