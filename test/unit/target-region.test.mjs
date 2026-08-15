/**
 * @file The grid-shape payload a targeting Region is built from.
 * @see module/apps/canvas/target-region.mjs
 *
 * `GridShapeData` validates its offsets, and it rejected the first encoding
 * this shipped with — `[i, j]` pairs — as *"i: may not be undefined"*. The
 * payload is pure and worth pinning, because the failure surfaces only inside
 * Foundry, as a validation error at the moment the player confirms an attack.
 */

import { describe, it, expect } from "vitest";
import { gridShape } from "../../module/apps/canvas/target-region.mjs";

describe("gridShape", () => {
  const panels = [{ i: 6, j: 6 }, { i: 6, j: 7 }, { i: 7, j: 6 }];

  it("declares the grid shape type", () => {
    expect(gridShape(panels)).toHaveLength(1);
    expect(gridShape(panels)[0].type).toBe("grid");
  });

  it("encodes offsets as {i, j} objects, never as [i, j] pairs", () => {
    const [shape] = gridShape(panels);
    expect(shape.offsets).toEqual([{ i: 6, j: 6 }, { i: 6, j: 7 }, { i: 7, j: 6 }]);
    for (const offset of shape.offsets) {
      expect(Array.isArray(offset)).toBe(false);
      expect(offset.i).toBeTypeOf("number");
      expect(offset.j).toBeTypeOf("number");
    }
  });

  it("carries every panel the resolver produced, in order", () => {
    expect(gridShape(panels)[0].offsets).toHaveLength(panels.length);
  });

  it("drops anything beyond i and j, so a panel's k never reaches the shape", () => {
    expect(gridShape([{ i: 1, j: 2, k: 3 }])[0].offsets[0]).toEqual({ i: 1, j: 2 });
  });

  it("anchors at the first offset, because panels are absolute", () => {
    expect(gridShape(panels)[0].origin).toBeNull();
  });

  it("handles an empty area without inventing an offset", () => {
    expect(gridShape([])[0].offsets).toEqual([]);
  });
});
