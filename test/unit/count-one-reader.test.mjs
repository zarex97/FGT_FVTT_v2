/**
 * @file Every old count spelling has one reader: the Count module (#319).
 * @see module/rules/count.mjs
 *
 * `perStack`, `countTargets` and `countMatching` stay in content (Q2), and
 * six engine sites read them before the Count module, each with its own
 * arithmetic -- the handler's `times` counted stages and suppressed instances
 * differently from every other (Q3). So a read of one of them in `module/` is
 * a read through `rules/count.mjs` (`fromPerStack`, `fromCountTargets`,
 * `fromCountMatching`, on the same line), unless the line says why not with
 * `// fgt-count-ok: <reason>`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** Files that may name the old spellings, with why. */
const ALLOWED = {
  "module/rules/count.mjs": "the one reader",
};

/** A read of an old count spelling. */
const READ = /\.(perStack|countTargets|countMatching)\b/;

/** A line that hands the spelling straight to its adapter is a read through the Count module. */
const ADAPTED = /\bfrom(PerStack|CountTargets|CountMatching)\(/;

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

/** Every line reading an old spelling, marked or not. */
function sites() {
  return sources().filter((path) => !(path in ALLOWED)).flatMap((path) => codeLines(path).flatMap((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    return READ.test(code) ? [{ path, line: i + 1, text: line.trim() }] : [];
  }));
}

describe("the old count spellings", () => {
  it("are read through rules/count.mjs, or by a line that says why not", () => {
    const offenders = sites()
      .filter((s) => !ADAPTED.test(s.text) && !s.text.match(/\/\/\s*fgt-count-ok:\s*\S/))
      .map((s) => `${s.path}:${s.line}: ${s.text}`);
    expect(offenders, "size it with countOf/countedValue and the from* adapters").toEqual([]);
  });

  it("are still found where content hands them in, so the guard is not matching nothing", () => {
    // The sites that pass a spelling to its adapter: an element value, an
    // entry's magnitude and its `times`, a handler's `times`, a cooldown change.
    expect(sites().length).toBeGreaterThanOrEqual(5);
  });

  it("refuses a bare marker", () => {
    expect("x.perStack // fgt-count-ok:".match(/\/\/\s*fgt-count-ok:\s*\S/)).toBeNull();
  });
});
