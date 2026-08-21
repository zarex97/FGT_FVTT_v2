/**
 * @file Every ◈ expression written anywhere must parse.
 * @see module/domain/tick.mjs
 *
 * The content validator already checks the YAML. Nothing checked the ◈
 * expressions written **in the code**, and `engine/copy.mjs` had one:
 * `"4◈−⅓◈"`, with a U+2212 MINUS SIGN where `parseTick` accepts only an ASCII
 * hyphen. It threw, `cooldownFor` caught it and warned, and every ability
 * Wisdom of Dún Scáith copied came back with **no cooldown at all** — reusable
 * every Turn, for ever.
 *
 * The two characters are visually identical in most fonts, which is exactly why
 * this needs a machine to check it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseTick } from "../../module/domain/tick.mjs";

/** @param {string} dir @param {RegExp} match @returns {string[]} */
function filesUnder(dir, match) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return filesUnder(path, match);
    return match.test(e.name) ? [path] : [];
  });
}

/** A quoted string containing a ◈. */
/** The line separator, kept out of a string literal that this file also scans. */
const NEWLINE = String.fromCharCode(10);

const LITERAL = /["'`]([^"'`\n]*◈[^"'`\n]*)["'`]/g;

describe("◈ expressions in source", () => {
  it("all parse", () => {
    /** @type {string[]} */
    const bad = [];

    for (const file of [...filesUnder("module", /\.mjs$/), ...filesUnder("tools", /\.mjs$/)]) {
      for (const [index, line] of readFileSync(file, "utf8").split(NEWLINE).entries()) {
        // Comments hold prose and worked examples; only code is a claim about
        // what the parser will be handed.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;

        for (const [, expr] of line.matchAll(LITERAL)) {
          if (expr.includes("${")) continue;            // an interpolated template
          if (!/[0-9½⅓⅔¼¾]/.test(expr)) continue;       // a bare ◈ used as a unit label
          try {
            parseTick(expr);
          } catch (err) {
            bad.push(`${file}:${index + 1}: "${expr}" — ${err.message}`);
          }
        }
      }
    }

    expect(bad).toEqual([]);
  });

  it("would catch a U+2212 minus, which is what it was written for", () => {
    // The mutation test. Without it, "all parse" passing proves nothing about
    // whether the scan can see the character it exists to find.
    expect(() => parseTick("4◈\u2212⅓◈")).toThrow();
    expect(parseTick("4◈-⅓◈")).toMatchObject({ kind: "rounds", whole: 4, sign: -1 });
  });
});
