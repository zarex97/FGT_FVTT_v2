/**
 * @file Blood Fort Andromeda's drain pool.
 * @see module/rules/fields/pool.mjs, docs/43-bounded-fields.md §43.7
 */

import { describe, it, expect } from "vitest";
import { distributePool } from "../../module/rules/fields/pool.mjs";

const two = [{ unitId: "medusa" }, { unitId: "master" }];

describe("distributePool", () => {
  it("never pays out more than was drained", () => {
    // "total amount healed between the two cannot exceed the amount of Health
    // drained from victims."
    const out = distributePool(60, two);
    expect(out.reduce((a, h) => a + h.amount, 0)).toBe(60);
  });

  it("splits evenly, with the remainder to the field's owner", () => {
    expect(distributePool(61, two).map((h) => h.amount)).toEqual([31, 30]);
  });

  it("gives it all to a lone beneficiary", () => {
    expect(distributePool(40, [{ unitId: "medusa" }])).toEqual([{ unitId: "medusa", amount: 40 }]);
  });

  it("pays nothing from an empty pool", () => {
    expect(distributePool(0, two)).toEqual([]);
    expect(distributePool(-10, two)).toEqual([]);
  });

  it("pays nothing when nobody is named", () => {
    expect(distributePool(100, [])).toEqual([]);
  });

  it("omits a zero share rather than emitting a no-op heal", () => {
    // 1 between two: the owner takes it and the other is not listed.
    expect(distributePool(1, two)).toEqual([{ unitId: "medusa", amount: 1 }]);
  });
});
