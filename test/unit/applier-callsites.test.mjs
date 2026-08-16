/**
 * @file Every `applyIntents` call site passes the options object it expects.
 * @see docs/25-intents-and-application.md
 *
 * `applyIntents(intents, { io, canWrite, isGM, source })` destructures its
 * second argument. Four call sites passed `worldIO()` there positionally, with
 * a third `{ reason }` argument that no signature has ever accepted — so `io`
 * and `canWrite` both came out `undefined` and the first non-log intent threw
 * `canWrite is not a function`. Spending a Command Spell and every platform
 * write were dead on arrival.
 *
 * A unit test cannot catch this: the broken calls only run inside a live world.
 * So this reads the source, which is where the mistake is visible.
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

describe("applyIntents call sites", () => {
  it("always passes an options object as the second argument", () => {
    /** @type {string[]} */
    const bad = [];

    for (const file of mjsUnder("module")) {
      if (file.endsWith("applier.mjs")) continue;
      const src = readFileSync(file, "utf8");

      for (const m of src.matchAll(/applyIntents\(([\s\S]{0,200}?)\)\s*;/g)) {
        // The second argument, however the call was line-wrapped.
        const afterFirstComma = m[1].slice(m[1].indexOf(",") + 1).trimStart();
        if (!afterFirstComma.startsWith("{")) {
          bad.push(`${file}: applyIntents(…, ${afterFirstComma.split("\n")[0]}…)`);
        }
      }
    }

    expect(bad).toEqual([]);
  });
});
