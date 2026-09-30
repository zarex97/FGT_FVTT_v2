/**
 * @file A bounded field is on one level (#68).
 * @see module/rules/bounded-fields.mjs#contains, module/engine/fields.mjs#openField
 *
 * Found on the Semiramis audit's board III: Sikera Ušum's Throne Room is on the
 * Hanging Gardens, twenty levels up, and the enemy Master standing on the
 * ground UNDER it was a member -- he carried the field's Poison-Immune
 * downgrade and its Turn-end Poison override. `contains` compared a panel's
 * `i` and `j` and never its level, so every field reached every level above
 * and below it: a Reality Marble on the ground reached a Unit aboard a
 * platform over it, and a platform's field reached the ground.
 */

import { describe, it, expect } from "vitest";
import { contains } from "../../module/rules/bounded-fields.mjs";

const square = (anchor) => ({ id: "f", ownerId: "caster", geometry: { kind: "fixedArea", shape: { kind: "square", size: 5 }, anchor } });

describe("a field on a level", () => {
  it("holds a Unit on its own level", () => {
    expect(contains(square({ i: 4, j: 4, k: 20 }), { i: 4, j: 4, k: 20 }, { units: [] })).toBe(true);
  });

  it("does not hold a Unit on the ground under it", () => {
    expect(contains(square({ i: 4, j: 4, k: 20 }), { i: 4, j: 4, k: 0 }, { units: [] })).toBe(false);
  });

  it("follows its anchor Unit's level when it follows the Unit", () => {
    const field = { id: "f", ownerId: "caster", geometry: { kind: "followsUnit", shape: { kind: "square", size: 5 } } };
    const board = { units: [{ id: "caster", panel: { i: 4, j: 4, k: 20 } }] };
    expect(contains(field, { i: 5, j: 5, k: 20 }, board)).toBe(true);
    expect(contains(field, { i: 5, j: 5, k: 0 }, board)).toBe(false);
  });

  it("takes an unstamped field's level from its owner, for fields opened before this", () => {
    const board = { units: [{ id: "caster", panel: { i: 4, j: 4, k: 20 } }] };
    expect(contains(square({ i: 4, j: 4 }), { i: 4, j: 4, k: 20 }, board)).toBe(true);
    expect(contains(square({ i: 4, j: 4 }), { i: 4, j: 4, k: 0 }, board)).toBe(false);
  });

  it("asks nothing of a panel that names no level", () => {
    expect(contains(square({ i: 4, j: 4, k: 20 }), { i: 4, j: 4 }, { units: [] })).toBe(true);
  });
});
