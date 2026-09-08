/**
 * @file The stance — a per-action declaration, free but window-constrained.
 * @see module/rules/stance.mjs, docs/44-case-expanded-roster.md §44.1
 *
 * Achilles is the only Servant in either roster with one, and Ch. 44 §44.1
 * argues at length that it is NOT a mode: a mode carries a duration, a cooldown
 * and a toggle lock, and may be forced on by a compulsion. A stance has none of
 * those. What it has instead is a set of moments at which it may change, and a
 * default it is dragged back to whenever it is not its owner's Turn.
 */

import { describe, it, expect } from "vitest";
import { stanceOf, mayChangeStance, forcedStanceFor, STANCE_WINDOWS } from "../../module/rules/stance.mjs";

/** Achilles's stance, as his sheet states it. */
const achillesSpec = {
  states: ["mounted", "dismounted"],
  default: "dismounted",
  forcedOutsideOwnTurn: "dismounted",
  transitions: [{ from: "mounted", to: "dismounted", at: "combatPhaseStart" }],
};

/** @param {object} over */
const achilles = (over = {}) => ({ id: "achilles", stanceSpec: achillesSpec, stance: "dismounted", ...over });

describe("stanceOf", () => {
  it("reads the current stance", () => {
    expect(stanceOf(achilles({ stance: "mounted" }))).toBe("mounted");
  });

  it("falls back to the spec's default when nothing is set", () => {
    expect(stanceOf(achilles({ stance: "" }))).toBe("dismounted");
  });

  it("is null for a Unit with no stance at all, which is every other Unit", () => {
    expect(stanceOf({ id: "medusa" })).toBe(null);
    expect(stanceOf(null)).toBe(null);
  });

  it("refuses a stance the spec does not list", () => {
    // A stored value that is not one of the states is a bug elsewhere; reading
    // it back as the default is the recoverable answer.
    expect(stanceOf(achilles({ stance: "swimming" }))).toBe("dismounted");
  });
});

describe("mayChangeStance", () => {
  it("lets him drop out of Mounted at the start of a Combat Phase", () => {
    const out = mayChangeStance(achilles({ stance: "mounted" }), "dismounted", { at: "combatPhaseStart" });
    expect(out.ok).toBe(true);
  });

  it("refuses the same drop at any other moment", () => {
    // "If Mounted AT THE START OF A COMBAT PHASE, Achilles can Dismount at the
    // start of the Combat Phase" -- the window is the clause, not a detail of it.
    const out = mayChangeStance(achilles({ stance: "mounted" }), "dismounted", { at: "damageStep" });
    expect(out).toMatchObject({ ok: false, reason: "window" });
  });

  it("never lets him Mount once the action is under way", () => {
    // "...but he cannot Mount his chariot when he initiates Combat while
    // Dismounted." He may DECLARE Mounted when he acts -- that is the first
    // sentence of the clause -- but his sheet offers no entry transition after
    // that, and the absence of one is the rule rather than an omission.
    for (const at of STANCE_WINDOWS.filter((w) => w !== "declare")) {
      expect(mayChangeStance(achilles(), "mounted", { at }).ok, at).toBe(false);
    }
  });

  it("allows a free declaration on his own Turn before he has acted", () => {
    // "When Achilles Acts, the player must state whether he is Mounted or
    // Dismounted." Declaring is not a transition; it is choosing the stance the
    // action is taken in, and it is the one moment both states are reachable.
    expect(mayChangeStance(achilles(), "mounted", { at: "declare", acted: false }).ok).toBe(true);
    expect(mayChangeStance(achilles({ stance: "mounted" }), "dismounted", { at: "declare", acted: false }).ok).toBe(true);
  });

  it("refuses the declaration when it is not his Turn", () => {
    // "Achilles is always Dismounted when it is not his Turn." The Turn
    // boundary puts him back on foot, and nothing stopped a player toggling him
    // up again during an enemy's Turn — he would then have defended Mounted,
    // with the Heel switched off. Found live, on the first toggle.
    expect(mayChangeStance(achilles(), "mounted", { at: "declare", isOwnTurn: false }))
      .toMatchObject({ ok: false, reason: "notYourTurn" });
    expect(mayChangeStance(achilles(), "mounted", { at: "declare", isOwnTurn: true }).ok).toBe(true);
  });

  it("refuses the declaration once he has already acted this Turn", () => {
    const out = mayChangeStance(achilles(), "mounted", { at: "declare", acted: true });
    expect(out).toMatchObject({ ok: false, reason: "acted" });
  });

  it("refuses a state the spec does not list", () => {
    expect(mayChangeStance(achilles(), "flying", { at: "declare" })).toMatchObject({ ok: false, reason: "unknownState" });
  });

  it("says yes to everything for a Unit with no stance", () => {
    // Nothing to constrain, so nothing is refused -- the caller can ask without
    // first checking whether the Unit has a stance at all.
    expect(mayChangeStance({ id: "medusa" }, "mounted", { at: "declare" }).ok).toBe(true);
  });
});

describe("forcedStanceFor", () => {
  it("drags him back to Dismounted when it is not his Turn", () => {
    // "Achilles is always Dismounted when it is not his Turn" -- which is what
    // makes Achilles' Heel a threat at all: he defends on foot, always.
    expect(forcedStanceFor(achilles({ stance: "mounted" }), { isOwnTurn: false })).toBe("dismounted");
  });

  it("forces nothing on his own Turn", () => {
    expect(forcedStanceFor(achilles({ stance: "mounted" }), { isOwnTurn: true })).toBe(null);
  });

  it("forces nothing when he is already Dismounted", () => {
    // The caller writes only when something changes, so "already there" and
    // "nothing to do" are the same answer.
    expect(forcedStanceFor(achilles(), { isOwnTurn: false })).toBe(null);
  });

  it("forces nothing on a Unit with no stance", () => {
    expect(forcedStanceFor({ id: "medusa" }, { isOwnTurn: false })).toBe(null);
  });
});
