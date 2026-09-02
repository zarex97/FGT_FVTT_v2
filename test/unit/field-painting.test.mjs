/**
 * Redrawing a bounded field, and the storage that has to survive it.
 * @see docs/superpowers/specs/2026-09-02-master-rank-and-field-painting-design.md
 */
import { describe, it, expect } from "vitest";
import { shapeOf } from "../../module/engine/fields.mjs";

const scene = { grid: { size: 100 } };

describe("shapeOf — a field's stored geometry", () => {
  it("keeps an L-shape's exact panels instead of its bounding box", () => {
    // The whole point. A rectangle would fill in {i:1,j:1} and the board
    // would read a 2x2 where the author drew an L.
    const panels = [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 1, j: 0 }];
    const shape = shapeOf(panels, scene);

    expect(shape.type).toBe("grid");
    expect(shape.offsets).toEqual(panels);
    expect(shape.offsets).toHaveLength(3);
  });

  it("anchors at absolute board offsets, not deltas", () => {
    // `origin: null` is what makes the offsets absolute -- the resolver works
    // in whole-board panels, and a relative origin would shift the field.
    expect(shapeOf([{ i: 4, j: 7 }], scene).origin).toBeNull();
  });

  it("still describes a square exactly", () => {
    const square = [];
    for (let i = 2; i <= 4; i++) for (let j = 2; j <= 4; j++) square.push({ i, j });
    expect(shapeOf(square, scene).offsets).toHaveLength(9);
  });
});
