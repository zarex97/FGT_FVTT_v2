/**
 * @file A Unit at zero Health stays at zero.
 * @see module/data/actor/_shared.mjs, docs/06-stats-and-resources.md §6.1
 *
 * Each actor type's `prepareBaseData` backfills a Health pool that content
 * never filled in — a Servant dragged straight onto the board gets the END
 * table's maximum, a Master gets 250, a Summon gets its `baseHealth`. All three
 * recognised "never filled in" as **zero**, which is also what a Unit that has
 * just been killed looks like. So the next data preparation put it back to
 * maximum, and every Servant in the game was unkillable by damage.
 *
 * Found live: Mannanán was reduced to 0 by a Normal Attack, came back at 1250
 * before her own revival's heal was written, and the heal then clamped to the
 * maximum she was already at — which made a 50%-of-maximum revival look like a
 * full one.
 *
 * A DataModel needs Foundry to instantiate, so this guards the condition in the
 * source rather than the behaviour. That is the same discipline
 * `applier-callsites.test.mjs` and `skill-references.test.mjs` apply, and it is
 * what keeps a one-character regression from being silent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** The three files that backfill a Health pool. */
const DERIVATIONS = [
  "module/data/actor/servant.mjs",
  "module/data/actor/master.mjs",
  "module/data/actor/simple.mjs",
];

describe("the Health backfill", () => {
  it("starts from null, so zero is a value rather than an absence", () => {
    const shared = readFileSync("module/data/actor/_shared.mjs", "utf8");
    expect(shared).toMatch(/health:\s*resourceField\(null\)/);
    // Agility and Luck keep their zero: they are spent down to it routinely and
    // are never backfilled from a table, so the distinction does not arise.
    expect(shared).toMatch(/agility:\s*resourceField\(0\)/);
    expect(shared).toMatch(/luck:\s*resourceField\(0\)/);
  });

  for (const path of DERIVATIONS) {
    it(`${path} never treats a zero Health value as unset`, () => {
      const src = readFileSync(path, "utf8");
      const lines = src.split("\n");

      for (const [index, line] of lines.entries()) {
        // Only the lines that WRITE the pool's current value from a default.
        if (!/this\.health\.value\s*=/.test(line)) continue;
        // The guard sits on the same line (`if (…) this.health.value = …`).
        const guard = line.slice(0, line.indexOf("this.health.value ="));

        // A guard that fires on zero is the defect.
        expect(
          /health\.value\s*===\s*0/.test(guard) || /!\s*this\.health\.value/.test(guard),
          `${path}:${index + 1} backfills Health from a zero value`,
        ).toBe(false);
      }
    });
  }

  it("still backfills a Unit that was never given any", () => {
    // The positive half: each file must have a `=== null` guard, or the
    // backfill has been removed rather than narrowed and a Servant dragged
    // onto the board would arrive with no Health at all.
    for (const path of DERIVATIONS) {
      const src = readFileSync(path, "utf8");
      expect(src).toMatch(/this\.health\.value\s*===\s*null/);
    }
  });
});
