/**
 * @file A Region override has to move the area, not half of it.
 * @see module/engine/fields.mjs, docs/28-bounded-fields.md, Ch. 46 §46.4
 *
 * Chaos Labyrinthos states its area twice — `targeting.shape.size: 9` for the
 * Units its activation debuffs reach, and `field.geometry.shape.size: 9` for
 * the Labyrinth those Units are trapped in — and only the second carried
 * `regionSizeOverride`. The sheet states it once, and says outright that they
 * are the same thing: *"Affects a 9x9 panel area around Asterios when used,
 * **this NP area will now be termed as the 'Labyrinth'**; if the Region is
 * Greece, it affects an 11x11 panel area instead."*
 *
 * Measured live in a Greece war: the Labyrinth opened at **121** panels, rows
 * and columns 3–13, while the targeting still expanded the 9x9. An EMIYA at
 * (3,8) was inside the Labyrinth — trapped, slowed and isolated by it — and
 * `resolveTargets` returned no targets at all, not even an exclusion for him.
 */

import { describe, it, expect } from "vitest";
import { regionSizedShape, regionSizedTargeting } from "../../module/engine/fields.mjs";

/** Chaos Labyrinthos, as authored: one area, spelled in two places. */
const labyrinthos = (over = {}) => ({
  system: {
    field: {
      geometry: {
        kind: "fixedArea",
        shape: { kind: "square", size: 9 },
        regionSizeOverride: { greece: 11 },
      },
      ...(over.field ?? {}),
    },
  },
});

const targeting = (shape = { kind: "square", size: 9 }) => ({
  anchor: { kind: "self" },
  shape,
  selection: { relations: ["enemy"], chooser: "all", includeSelf: false },
});

describe("regionSizedShape", () => {
  it("grows the square in the Region the sheet names", () => {
    const geometry = labyrinthos().system.field.geometry;
    expect(regionSizedShape(geometry, "greece")).toEqual({ kind: "square", size: 11 });
  });

  it("leaves it alone everywhere else, and in no Region at all", () => {
    const geometry = labyrinthos().system.field.geometry;
    expect(regionSizedShape(geometry, "japan")).toEqual({ kind: "square", size: 9 });
    expect(regionSizedShape(geometry, null)).toEqual({ kind: "square", size: 9 });
  });
});

describe("regionSizedTargeting", () => {
  it("moves the targeting with the field it names", () => {
    const out = regionSizedTargeting(targeting(), labyrinthos(), "greece");
    expect(out.shape).toEqual({ kind: "square", size: 11 });
    // Everything else about the block survives untouched.
    expect(out.anchor).toEqual({ kind: "self" });
    expect(out.selection).toEqual({ relations: ["enemy"], chooser: "all", includeSelf: false });
  });

  it("leaves the targeting alone outside that Region", () => {
    expect(regionSizedTargeting(targeting(), labyrinthos(), "japan").shape)
      .toEqual({ kind: "square", size: 9 });
    expect(regionSizedTargeting(targeting(), labyrinthos(), null).shape)
      .toEqual({ kind: "square", size: 9 });
  });

  it("does not touch an ability that declares no field", () => {
    const spec = targeting();
    expect(regionSizedTargeting(spec, { system: {} }, "greece")).toBe(spec);
  });

  it("does not touch a targeting area that is NOT the field's", () => {
    // An ability whose targeting differs from its field is stating two areas on
    // purpose — Sikera Ušum's Throne Room is a different size from the Aria
    // that opens it — and resizing one to match the other would invent a rule.
    const different = targeting({ kind: "square", size: 5 });
    expect(regionSizedTargeting(different, labyrinthos(), "greece")).toBe(different);

    const otherKind = targeting({ kind: "line", length: 9 });
    expect(regionSizedTargeting(otherKind, labyrinthos(), "greece")).toBe(otherKind);
  });
});
