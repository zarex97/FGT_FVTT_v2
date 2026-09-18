/**
 * @file `checkSightings` is asked at every moment a Unit can newly be seen.
 * @see docs/46-roster-re-audit.md §46.14.5
 *
 * `unitFirstSeen` is the event half of Detect, and Semiramis's Familiar: Doves
 * is the corpus' only consumer of it: *"Whenever Semiramis sees a Unit for the
 * first time, the 'Dove' effect is applied to it"*, which is what lets her
 * track that Unit through Fog of War afterwards.
 *
 * The event, the rule that decides it (`rules/identity.mjs#newlySeenBy`) and
 * the effect were all correct and all tested. **The question was only ever
 * asked on a move.** `checkSightings` had exactly one call site, in
 * `engine/movement-hooks.mjs`, so two Units deployed in sight of each other
 * were never first-seen by anybody until somebody walked.
 *
 * Found on a live board during her audit: Semiramis stood adjacent to an enemy
 * Servant for five Rounds and attacked him twice, and had Dove'd nobody.
 *
 * A unit test of `newlySeenBy` cannot catch this — it answered correctly every
 * time it was asked, and the defect is that nothing asked. So this reads the
 * source, which is where a missing call site is visible.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

/**
 * Where a Unit can become newly visible, and so where the sighting check owes
 * an appearance. Movement is the obvious one and was the only one.
 */
const CALLERS = [
  ["module/engine/movement-hooks.mjs", "a Unit moved into or out of someone's Detect range"],
  ["module/engine/war-setup.mjs", "the opening board: everyone is placed in sight of somebody"],
];

describe("checkSightings call sites", () => {
  for (const [file, why] of CALLERS) {
    it(`is called from ${file} — ${why}`, () => {
      const src = readFileSync(file, "utf8");
      // The dynamic import and the call itself, so a lingering import with the
      // call deleted does not pass.
      expect(src, `${file} does not import checkSightings`).toMatch(/checkSightings/);
      expect(src, `${file} imports checkSightings but never calls it`)
        .toMatch(/await\s+checkSightings\s*\(/);
    });
  }

  it("still has newlySeenBy as its only source of truth for what is new", () => {
    // Guards against a call site that re-derives "newly seen" itself and then
    // disagrees with the rule every other call site uses.
    const vision = readFileSync("module/engine/vision.mjs", "utf8");
    expect(vision).toMatch(/newlySeenBy/);
    for (const [file] of CALLERS) {
      expect(readFileSync(file, "utf8"), `${file} should ask checkSightings, not re-derive sightings`)
        .not.toMatch(/newlySeenBy/);
    }
  });
});
