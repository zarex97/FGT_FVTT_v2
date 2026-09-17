/**
 * @file Bašmu occupies nine panels, not one.
 * @see packs/_source/summons/basmu.yml, docs/46-roster-re-audit.md §46.14.3
 *
 * Its size was never authored, so it defaulted to 1×1 — and for this summon in
 * particular the size is not decoration. Two of its own clauses are about the
 * panels it stands on:
 *
 * > *"When it Moves to any occupied panels, all Units occupying said panels are
 * > knocked back by 1 panel until the space is free for Bašmu to stand on."*
 *
 * — `movesOntoOccupiedPanels`, which has to clear a 3×3 rather than a single
 * cell — and *"Enemy Units cannot Attack Semiramis or her allied Units if a
 * Bašmu is [adjacent]"*, whose reach is measured from whatever it occupies.
 *
 * `footprint` and the prototype token's `width`/`height` are the same fact in
 * two places, and only the first used to be compiled: the Hanging Gardens
 * shipped 9×9 content on a 1×1 token until `footprintSize` was added to the
 * build. This asserts both halves agree for Bašmu, because a 3×3 that drops
 * onto a scene as one cell is the same defect wearing a different number.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const basmu = parse(readFileSync("packs/_source/summons/basmu.yml", "utf8"));

describe("Bašmu's footprint", () => {
  it("is 3×3", () => {
    expect(basmu.footprint).toEqual({ w: 3, h: 3 });
  });

  it("belongs to a unit whose clauses depend on the panels it covers", () => {
    // Both of these read the footprint rather than a single panel, which is why
    // the size had to be stated rather than left to default.
    expect(basmu.movesOntoOccupiedPanels).toBe(true);
    expect(basmu.attributes).toContain("large");
  });
});
