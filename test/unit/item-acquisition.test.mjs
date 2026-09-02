/**
 * @file Who actually ends up holding an item.
 * @see module/rules/items.mjs, docs/15-abilities.md §15.8
 *
 * Every route by which a unit comes to hold an item passes through
 * `acquisitionTarget` first, so a clause that redirects or refuses acquisition
 * is stated once rather than at each acquisition site. Pale Rider is the only
 * author in the reference set and states both halves:
 *
 * > *"Items held: Pale Rider cannot hold Items. All Items that would be
 * > obtained by Pale Rider are instead obtained by his Master if he/she is
 * > within a 2 panel area."*
 */

import { describe, it, expect } from "vitest";
import { acquisitionTarget, ITEM_REDIRECT_RANGE } from "../../module/rules/items.mjs";

const at = (i, j) => ({ i, j });

const master = (over = {}) => ({
  id: "m", name: "Our Master", kind: "master", factionId: "a", panel: at(5, 5), ...over,
});
const rider = (over = {}) => ({
  id: "pr", name: "Pale Rider", kind: "servant", factionId: "a", panel: at(5, 6),
  masterId: "m", cannotHoldItems: true, itemHandling: "redirectToMaster", ...over,
});
const board = (units) => ({ units, alliances: {} });

/* -------------------------------------------------------------------------- */

describe("acquisitionTarget", () => {
  it("leaves an ordinary unit holding its own item", () => {
    const u = { id: "x", kind: "servant", panel: at(1, 1) };
    expect(acquisitionTarget(u, board([u]))).toEqual({ ok: true, unitId: "x", redirected: false });
  });

  it("hands Pale Rider's item to his Master", () => {
    const m = master();
    const pr = rider();
    expect(acquisitionTarget(pr, board([m, pr])))
      .toEqual({ ok: true, unitId: "m", redirected: true });
  });

  it("honours the 2 panel condition, which the clause states outright", () => {
    // "instead obtained by his Master IF HE/SHE IS WITHIN A 2 PANEL AREA" --
    // the same range every other Master-Servant rule is keyed on.
    const m = master({ panel: at(5, 5 + ITEM_REDIRECT_RANGE) });
    expect(acquisitionTarget(rider(), board([m, rider()])).redirected).toBe(true);

    const far = master({ panel: at(5, 5 + ITEM_REDIRECT_RANGE + 1) });
    const out = acquisitionTarget(rider({ panel: at(5, 5) }), board([far, rider({ panel: at(5, 5) })]));
    expect(out).toEqual({ ok: false, reason: "cannotHoldItems" });
  });

  it("refuses when the Master is off the board entirely", () => {
    const pr = rider();
    expect(acquisitionTarget(pr, board([pr]))).toEqual({ ok: false, reason: "cannotHoldItems" });
  });

  it("refuses a unit that cannot hold items and redirects nowhere", () => {
    // The two halves are separable: `cannotHoldItems` alone is a refusal, and
    // nothing in the corpus pairs a redirect with a unit that CAN hold items.
    const u = { id: "x", kind: "servant", panel: at(1, 1), cannotHoldItems: true };
    expect(acquisitionTarget(u, board([u]))).toEqual({ ok: false, reason: "cannotHoldItems" });
  });

  it("does not redirect into a Master who cannot hold items either", () => {
    // No cycles, and no silently vanishing item.
    const m = master({ cannotHoldItems: true });
    const pr = rider();
    expect(acquisitionTarget(pr, board([m, pr]))).toEqual({ ok: false, reason: "cannotHoldItems" });
  });

  it("refuses a defeated Master, who holds nothing", () => {
    const m = master({ defeated: true });
    const pr = rider();
    expect(acquisitionTarget(pr, board([m, pr]))).toEqual({ ok: false, reason: "cannotHoldItems" });
  });

  it("is safe on a missing unit", () => {
    expect(acquisitionTarget(null, board([])).ok).toBe(false);
  });
});
