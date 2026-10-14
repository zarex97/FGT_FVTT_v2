/**
 * @file Every die the game rolls is a Foundry Roll.
 * @see docs/13-checks-and-randomness.md, docs/surprises/patterns/dice-outside-the-table.md
 *
 * A die rolled with `Math.random` leaves no record on the card or in the log,
 * and a scripted test die cannot reach it. Suppression's removal die and
 * Trofa's coin against a Noble Phantasm were both rolled that way (Wave B).
 * This scan refuses a new one; the places listed below are not dice.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every `.mjs` under `module/`, with `/` separators on any checkout. */
function sources(dir = "module") {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".mjs") ? [path.replace(/\\/g, "/")] : [];
  });
}

/**
 * `Math.random` that is not a die, and why.
 *
 * - An id for a fan-out group, used only when `crypto` is missing.
 * - Where a Unit lands inside a field: a random free panel, injectable
 *   (`random = Math.random`) so a test can pass its own.
 */
const NOT_DICE = new Set([
  "module/engine/combat-process.mjs",
  "module/engine/fields.mjs",
  "module/rules/bounded-fields.mjs",
  "module/engine/skill-use.mjs",
]);

describe("dice", () => {
  it("are rolled with Roll, never Math.random", () => {
    const hits = sources().flatMap((f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n").split("\n")
      .map((line, n) => [line.replace(/\/\/.*$/, ""), n])
      .filter(([line]) => /Math\.random\(/.test(line) || /=\s*Math\.random\b/.test(line))
      .map(([, n]) => `${f}:${n + 1}`));
    expect(hits.filter((h) => !NOT_DICE.has(h.split(":")[0]))).toEqual([]);
  });
});
