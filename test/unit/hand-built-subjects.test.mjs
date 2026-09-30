/**
 * @file Hand-built test subjects only ever get fewer.
 * @see test/helpers/subject.mjs, docs/44-testing.md
 *
 * A test that writes the projection's output itself — a unit literal carrying
 * `effectInstances`, `auras` or `checkModifiers` — tests the reader against the
 * author's idea of the projection, and the projection is exactly where
 * `unremovable`, `requiresHistory` and an Aura's `check` were lost. New tests
 * build their subjects with `test/helpers/subject.mjs`. Existing ones move when
 * they are next touched rather than in one sweep, and this count is how the
 * move is watched: it prints, and it fails if it ever rises.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Keys only the projection produces. A literal assigning one of them is a
 * subject built in the reader's shape rather than from authored content.
 */
const PROJECTED = [
  "effectInstances", "checkModifiers", "auras", "eventHandlers", "statDeltas", "grantedAbilities",
  "autoSucceeds", "immunities", "revivals", "applicationChances", "damageFloors", "suppressions",
];
const LITERAL = new RegExp(String.raw`^\s*(${PROJECTED.join("|")})\s*:\s*[\[{]`, "gm");

/** The count when this guard landed. Lower it as tests move; never raise it. */
const CEILING = 58;

describe("hand-built test subjects", () => {
  it("are no more than when the fixture builder landed", () => {
    const dir = "test/unit";
    const counts = readdirSync(dir)
      .filter((f) => f.endsWith(".mjs"))
      .map((f) => [f, (readFileSync(join(dir, f), "utf8").match(LITERAL) ?? []).length])
      .filter(([, n]) => n > 0);
    const total = counts.reduce((sum, [, n]) => sum + n, 0);
    console.info(`  hand-built subjects: ${total} across ${counts.length} file(s) (ceiling ${CEILING})`);
    expect(total, "build new subjects with test/helpers/subject.mjs").toBeLessThanOrEqual(CEILING);
  });
});
