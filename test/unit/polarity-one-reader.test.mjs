/**
 * @file An Effect's polarity has one reader (#315).
 * @see module/rules/effect-instance.mjs
 *
 * Polarity is decided when an Effect lands and stored on it: Romulus's Roma
 * Stacks are a buff on an ally and a debuff on an enemy (#303). Some 25 places
 * read it off the DEFINITION before, and each of them would still have called
 * an ally's stacks a debuff. So a `.polarity` read in `module/` is asked of
 * `polarityOf` or `landedPolarity`, in `rules/effect-instance.mjs`, unless it
 * is one of these:
 *
 * - a file that describes the definition DOCUMENT itself (the registry that
 *   copies it, the chip a journal link renders), or the landing, which reads
 *   the definition `landedDefinition` made for this one application;
 * - a line marked `// fgt-polarity-ok: <reason>`: a selector's own value
 *   (`selector.polarity`, a removal candidate, an element's field), never an
 *   Effect's.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** Files that read polarity off something that is not a standing Effect, with why. */
const ALLOWED = {
  "module/rules/effect-instance.mjs": "the one reader",
  "module/rules/registry.mjs": "copies the definition document into the registry",
  "module/apps/enrich.mjs": "renders a definition document's own chip",
  "module/engine/effect-applier.mjs": "reads the landed definition `landing.mjs#landEffect` decided",
};

/** A read of `.polarity`, not a write. */
const READ = /\.polarity\b(?!\s*=[^=])/;

function sources(dir = "module") {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".mjs") ? [path.replace(/\\/g, "/")] : [];
  });
}

/** Code lines, block comments blanked so line numbers hold. */
function codeLines(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ""));
  return text.split("\n");
}

describe("an Effect's polarity", () => {
  it("is read through rules/effect-instance.mjs, or by a line that says why not", () => {
    const offenders = [];
    for (const path of sources()) {
      if (path in ALLOWED) continue;
      codeLines(path).forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        if (!READ.test(code)) return;
        const marker = line.match(/\/\/\s*fgt-polarity-ok:\s*(\S.*)?$/);
        if (marker && marker[1]) return;
        offenders.push(`${path}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, "read polarity with polarityOf(instance, def), or mark a selector's own value").toEqual([]);
  });

  it("refuses a bare marker", () => {
    expect("x.polarity // fgt-polarity-ok:".match(/\/\/\s*fgt-polarity-ok:\s*(\S.*)?$/)?.[1]).toBeUndefined();
  });
});
