/**
 * @file The Quetzalcoatlus as a mount: its size, who sits on it, and where.
 * @see packs/_source/platforms/quetzalcoatlus.yml, module/rules/platforms.mjs, docs/27-platforms-and-levels.md
 *
 * Ruled by the user (2026-10-01, #65): the Quetzalcoatlus is 2x2 panels, which the content
 * authored as 1x1; Winged Serpent puts her adjacent Master ON the mount; and her own Master may
 * board it freely at any time, with no roll, while nobody else takes its seat.
 *
 * Every subject is authored content through the real compile, the real DataModel and the real
 * projection (`test/helpers/subject.mjs`).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

describe("the Quetzalcoatlus's size", () => {
  it("is 2x2 panels to the rules, as authored content states it", async () => {
    const footprint = await withSubjects(
      [{ from: "quetzalcoatlus", id: "mount", panel: { i: 5, j: 5, k: 1 } }],
      ({ unit }) => unit("mount").footprint,
    );
    expect(footprint).toEqual({ w: 2, h: 2 });
  });
});

describe("where a summoned mount is placed", () => {
  // *"…summons a Quetzalcoatlus at her position"*. A token is placed by its top-left panel, which at
  // 1x1 was her own. At 2x2 a summoner on the last row or column would put half the mount off the board.
  const bounds = { iMin: 0, jMin: 0, iMax: 12, jMax: 12 };
  const size = { w: 2, h: 2 };

  it("anchors on her own panel when the whole mount fits", async () => {
    const { summonAnchor } = await import("../../module/rules/platforms.mjs");
    expect(summonAnchor({ i: 5, j: 6 }, size, bounds)).toEqual({ i: 5, j: 6 });
  });

  it("slides back inside the board from the last row, keeping her panel under it", async () => {
    const { summonAnchor, withinFootprint } = await import("../../module/rules/platforms.mjs");
    const anchor = summonAnchor({ i: 12, j: 12 }, size, bounds);
    expect(anchor).toEqual({ i: 11, j: 11 });
    expect(withinFootprint({ i: 12, j: 12 }, { panel: anchor, footprint: size })).toBe(true);
  });

  it("is her own panel when the board's bounds are not known", async () => {
    const { summonAnchor } = await import("../../module/rules/platforms.mjs");
    expect(summonAnchor({ i: 3, j: 4 }, size, null)).toEqual({ i: 3, j: 4 });
  });
});
