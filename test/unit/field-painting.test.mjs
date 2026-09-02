/**
 * Redrawing a bounded field, and the storage that has to survive it.
 * @see docs/superpowers/specs/2026-09-02-master-rank-and-field-painting-design.md
 */
import { describe, it, expect } from "vitest";
import { shapeOf } from "../../module/engine/fields.mjs";
import { legalRepaint, mayReshape } from "../../module/rules/bounded-fields.mjs";
import { turnStateAt } from "../../module/rules/snapshot.mjs";

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

/* -------------------------------------------------------------------------- */
/*  Redrawing a freeform footprint                                            */
/* -------------------------------------------------------------------------- */

const mist = (over = {}) => ({
  id: "jack-the-mist", ownerId: "jack",
  geometry: { kind: "freeform", maxPanels: 25, maxDistance: 4 },
  panels: [{ i: 5, j: 5 }],
  deactivation: { byOwner: true },
  ...over,
});
const at = (i, j) => ({ i, j });

describe("legalRepaint", () => {
  it("accepts a footprint within the cap and the leash", () => {
    expect(legalRepaint(mist(), [at(5, 5), at(5, 6), at(6, 5)], at(5, 5))).toEqual({ ok: true });
  });

  it("refuses more panels than the cap", () => {
    const panels = Array.from({ length: 26 }, (_, n) => at(5, n));
    expect(legalRepaint(mist(), panels, at(5, 5))).toMatchObject({ ok: false, reason: "tooManyPanels" });
  });

  it("refuses a panel beyond the leash, measured from the anchor", () => {
    // "cannot expand past a distance of 4 panels from Jack (including
    // diagonal)" -- Chebyshev, so {10,10} is 5 away from {5,5}.
    expect(legalRepaint(mist(), [at(5, 5), at(10, 10)], at(5, 5)).reason).toBe("outsideLeash");
  });

  it("accepts a panel at exactly the leash distance", () => {
    expect(legalRepaint(mist(), [at(9, 9)], at(5, 5))).toEqual({ ok: true });
  });

  it("refuses an empty footprint", () => {
    // A field with no panels is a field deleted by accident.
    expect(legalRepaint(mist(), [], at(5, 5)).reason).toBe("empty");
  });

  it("refuses a field whose shape is fixed", () => {
    const fixed = mist({ geometry: { kind: "fixedArea", shape: { kind: "square", size: 5 } } });
    expect(legalRepaint(fixed, [at(5, 5)], at(5, 5)).reason).toBe("notFreeform");
  });

  it("measures the leash from the ANCHOR, so the owner need not stand in the fog", () => {
    // Jack's own note: "Jack does not need to be within the Mist." It falls
    // out of measuring owner-to-panel rather than fog-to-owner.
    expect(legalRepaint(mist(), [at(1, 1), at(1, 2)], at(4, 4))).toEqual({ ok: true });
  });
});

describe("mayReshape", () => {
  const jack = (turnState = {}) => ({ id: "jack", turnState });

  it("lets the owner reshape a freeform field it has not reshaped this Turn", () => {
    expect(mayReshape(mist(), jack())).toBe(true);
  });

  it("refuses a second reshape in the same Turn", () => {
    expect(mayReshape(mist(), jack({ reshapedField: true }))).toBe(false);
  });

  it("refuses anyone who is not the owner", () => {
    expect(mayReshape(mist(), { id: "somebody-else", turnState: {} })).toBe(false);
  });

  it("refuses a fixed-area field even for its owner", () => {
    expect(mayReshape(mist({ geometry: { kind: "fixedArea" } }), jack())).toBe(false);
  });
});

describe("the once-per-Turn flag survives the snapshot", () => {
  it("carries `reshapedField` through `turnStateAt`", () => {
    // The projection copies a FIXED key list. A flag added to the schema and
    // not added there is written to the document and invisible to every rule
    // that reads a snapshot -- so `mayReshape` kept saying yes to a Servant who
    // had already redrawn. Found live, not by this test.
    const state = turnStateAt({ tick: 4, reshapedField: true }, 4);
    expect(state.reshapedField).toBe(true);
  });

  it("blanks it with the rest of the state at a later tick", () => {
    expect(turnStateAt({ tick: 4, reshapedField: true }, 5).reshapedField).toBe(false);
  });
});
