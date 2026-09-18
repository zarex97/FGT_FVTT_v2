/**
 * @file The Ch. 32 tax says its own number on the sheet.
 * @see module/apps/actor-sheet/context.mjs, templates/actor/overview.hbs, #44
 *
 * `masterContext` computed `multiServantTax` on every render of every Master's
 * sheet and no template read it. The comment beside it claimed to restore *"the
 * one warning a Master gets about the Ch. 32 tax"* — that warning is
 * `taxWarning`, a boolean that was already there — so the value loaded,
 * computed, and reached nobody. It was misnamed too: it holds a weighted count
 * of Units, while a "tax" is a Health amount everywhere else in the system.
 *
 * The number matters because the charge lands at turn end, by which point the
 * decision that caused it cannot be taken back. A boolean cannot say how much.
 *
 * These cover the two halves a template cannot: that the threshold is the
 * tax's own constant rather than a second `25`, and that the weight is the
 * same one the scheduler charges on.
 */

import { describe, it, expect } from "vitest";
import {
  actedWeight, multiServantTax, mayOrderAnotherServant, MULTI_SERVANT_COST,
} from "../../module/rules/relationships.mjs";

const master = (health) => ({ id: "m1", health: { value: health, max: 400 } });
const acted = (id, over = {}) => ({ id, turnState: { acted: true }, ...over });
const idle = (id) => ({ id, turnState: { acted: false } });

describe("the sheet's tax badge reads the rule's own numbers", () => {
  it("shares one threshold with the refusal", () => {
    // `taxWarning` is `health <= MULTI_SERVANT_COST`; `mayOrderAnotherServant`
    // allows on `health > MULTI_SERVANT_COST`. One number, two readings that
    // must not drift — the sheet carried its own `25` literal.
    expect(MULTI_SERVANT_COST).toBe(25);
    expect(mayOrderAnotherServant(master(MULTI_SERVANT_COST + 1), [acted("s1")]).ok).toBe(true);
    expect(mayOrderAnotherServant(master(MULTI_SERVANT_COST), [acted("s1")]).ok).toBe(false);
  });

  it("charges exactly what the badge announces", () => {
    const [descriptor] = multiServantTax(master(400), [acted("s1"), acted("s2")]);
    expect(descriptor.delta).toBe(-MULTI_SERVANT_COST);
  });

  it("shows the badge on the same comparison the tax fires on", () => {
    // The template renders above a weight of 1, which is where `multiServantTax`
    // starts charging. Below it, both are silent.
    const one = [acted("s1"), idle("s2")];
    const two = [acted("s1"), acted("s2")];

    expect(actedWeight(one)).toBe(1);
    expect(multiServantTax(master(400), one)).toEqual([]);

    expect(actedWeight(two)).toBe(2);
    expect(multiServantTax(master(400), two)).toHaveLength(1);
  });

  it("counts both Dioscuri Acting as one Servant having Acted", () => {
    // Weighted rather than counted, which is why the badge shows the weight and
    // not a headcount: two half-Units is one order, and one order is untaxed.
    const half = { linkedGroup: { unitWeight: 0.5 } };
    const twins = [acted("castor", half), acted("pollux", half)];
    expect(actedWeight(twins)).toBe(1);
    expect(multiServantTax(master(400), twins)).toEqual([]);
  });
});
