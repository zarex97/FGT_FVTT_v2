/**
 * @file A mode's `oncePerRound`, on the path a mode is actually switched by.
 * @see module/rules/modes.mjs, docs/46-roster-re-audit.md §46.4-L
 *
 * `rules/costs.mjs` has read `oncePerRound` since it was written, and its
 * comment names the ability it was written for: *"Karna's Uncrowned Arms
 * Mastership is 'can only be used once per Round' with no cooldown, so without
 * this gate it is a free toggle every Turn and the choice between its two
 * effects stops being a choice."*
 *
 * That gate is on the ABILITY-USE path. Uncrowned Arms Mastership is a **mode**
 * with no `phases`, so the sheet's toggle never calls `useSkill`, never reaches
 * `costs.mjs`, and never records the use — and it is the only content in the
 * corpus carrying the field. The one ability the gate exists for is the one
 * ability that could not reach it.
 *
 * Measured live: toggled twice in a row, `{ok: true}` both times, with
 * `roundState.abilitiesUsed` still empty.
 */

import { describe, it, expect } from "vitest";
import { canToggleMode } from "../../module/rules/modes.mjs";

/** Karna's skill: a mode, no cooldown, `oncePerRound` its only limit. */
const mastership = (over = {}) => ({
  id: "uam",
  system: {
    slug: "uncrownedArmsMastership", isMode: true, oncePerRound: true,
    contentId: "karna-uncrowned-arms-mastership", active: false, ...over,
  },
});

const karna = (abilitiesUsed = []) => ({
  id: "karna", effects: [], abilities: [],
  roundState: { round: 6, abilitiesUsed },
});

const opts = (active) => ({ active, tick: 6, turnsPerRound: 3, clockRunning: true });

describe("a mode that may only be switched once per Round", () => {
  it("allows the first switch of the Round", () => {
    expect(canToggleMode(mastership(), karna([]), opts(true))).toEqual({ ok: true });
  });

  it("refuses a second switch in the same Round, by item id", () => {
    const verdict = canToggleMode(mastership({ active: true }), karna(["uam"]), opts(false));
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("oncePerRound");
  });

  it("refuses by contentId too, which is the other half of the use record", () => {
    // `recordUse` stamps both, and matching only one counted half the uses --
    // the drift `costs.mjs` records for `oncePerTurn`.
    const verdict = canToggleMode(
      mastership({ active: true }), karna(["karna-uncrowned-arms-mastership"]), opts(false),
    );
    expect(verdict.reason).toBe("oncePerRound");
  });

  it("refuses switching OFF as well as ON", () => {
    // Both directions are "using" the Skill: its active clause is *"switch the
    // effect from 1 to 2, OR 2 to 1"*. Gating only the ON direction would leave
    // a free switch every other press.
    expect(canToggleMode(mastership({ active: true }), karna(["uam"]), opts(false)).ok).toBe(false);
    expect(canToggleMode(mastership(), karna(["uam"]), opts(true)).ok).toBe(false);
  });

  it("leaves a mode WITHOUT the flag alone, however often it is switched", () => {
    const madEnhancement = { id: "me", system: { slug: "madEnhancement", isMode: true } };
    expect(canToggleMode(madEnhancement, karna(["me"]), opts(true))).toEqual({ ok: true });
  });

  it("is not confused by a use recorded in an EARLIER Round", () => {
    // `roundState` is stale-by-reading like every other per-Round record: the
    // scheduler clears it, and a stamp from Round 5 must not bite in Round 6.
    const stale = { id: "karna", effects: [], abilities: [], roundState: { round: 5, abilitiesUsed: ["uam"] } };
    expect(canToggleMode(mastership(), stale, { ...opts(true), round: 6 }).ok).toBe(true);
  });
});
