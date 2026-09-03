/**
 * @file Bellerophon's line: diagonal, and board-size dependent.
 * @see module/rules/targeting/shapes.mjs, docs/44-case-expanded-roster.md §44.3
 *
 * §44.3 reads this as two novelties for the targeting engine — diagonal lines
 * and bidirectional projection. Only half of that was true: `geometry.line` has
 * stepped a diagonal correctly since it was written and `DELTA` has held all
 * eight compass values, so a diagonal line was **expressible and unofferable**.
 * The gap was in `legalPlacements`, which offered four directions.
 */

import { describe, it, expect } from "vitest";
import { expand } from "../../module/rules/targeting/shapes.mjs";
import { legalPlacements } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });
const small = squareBounds(13);
const large = squareBounds(25);
const line = (over = {}) => ({ kind: "line", length: 13, width: 1, ...over });
const anchor = (direction) => ({ panel: at(12, 12), casterPanel: at(12, 12), direction });

describe("the direction picker", () => {
  const caster = { id: "m", panel: at(6, 6), kind: "servant", faction: "a", range: 3 };
  const board = { bounds: small, units: [caster], alliances: {} };

  it("offers eight when the shape asks for all of them", () => {
    const spec = { anchor: { kind: "selfEdgeAdjacent" }, shape: line({ directions: "all" }) };
    expect(legalPlacements(spec, caster, board).map((p) => p.placement.direction))
      .toEqual(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
  });

  it("still offers four for a shape that does not", () => {
    const spec = { anchor: { kind: "selfEdgeAdjacent" }, shape: line() };
    expect(legalPlacements(spec, caster, board).map((p) => p.placement.direction))
      .toEqual(["n", "e", "s", "w"]);
  });
});

describe("the line itself", () => {
  it("projects a diagonal, which the geometry always could", () => {
    // From (12, 6) north-east on the 25x25 there is room for all thirteen.
    const room = { panel: at(15, 6), casterPanel: at(15, 6), direction: "ne" };
    const p = expand(line({ directions: "all" }), room, { bounds: large }).panels;
    expect(p.length).toBe(13);
    // North-east is lower `i` and higher `j`, one step of each per panel.
    expect(p).toContainEqual(at(14, 7));
    expect(p).toContainEqual(at(2, 19));
  });

  it("hits both ways on the 13x13 board", () => {
    const p = expand(line({ bidirectional: "unlessLargeBoard" }), anchor("e"), { bounds: small }).panels;
    // Clipped by the board on both sides of a caster at column 12 of 0..12.
    expect(p.some((q) => q.j < 12)).toBe(true);
  });

  it("treats any board bigger than the standard 13x13 as Large", () => {
    // A table on some other size gets the conservative projection: a Noble
    // Phantasm reaching further than the sheet intends is the worse error.
    const odd = squareBounds(21);
    const p = expand(line({ bidirectional: "unlessLargeBoard" }), anchor("e"), { bounds: odd }).panels;
    expect(p.every((q) => q.j > 12)).toBe(true);
  });

  it("hits ONE way on the 25x25 board", () => {
    // "but only hits in one direction (Front) if playing on the Large Board."
    const p = expand(line({ bidirectional: "unlessLargeBoard" }), anchor("e"), { bounds: large }).panels;
    expect(p.every((q) => q.j > 12)).toBe(true);
    expect(p.length).toBe(12);
  });

  it("leaves a plain `bidirectional: true` alone on either board", () => {
    const both = expand(line({ bidirectional: true }), anchor("e"), { bounds: large }).panels;
    expect(both.some((q) => q.j < 12)).toBe(true);
  });
});
