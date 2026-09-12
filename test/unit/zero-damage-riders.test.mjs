/**
 * @file A hit that dealt zero is still a hit.
 * @see docs/superpowers/specs/2026-09-12-raikou-design.md §5 (R7)
 *
 * Layer 3 behaviour, tested at the one seam that is pure: the predicate the
 * Damage Step uses to decide whether the event-declared rider rungs fire. The
 * full flow needs a world and is live-tested; this holds the decision itself.
 *
 * The defect this was written after: the Damage Step ran its ABILITY-declared
 * riders on `!(skipped || veiled)` and its EVENT-declared riders on
 * `!skipped && result.total > 0`, one line apart. So a defender whose Def Up,
 * Dmg Cut or Ward reduced the total to zero took the phase-authored rider and
 * none of `Bleed Atk`, `Queen's Poison`, Serenity's daggers, Nemo's Slow or
 * Karna's Burn -- every on-hit rider in Appendix A, silent against exactly the
 * targets worth riding.
 */

import { describe, it, expect } from "vitest";

import { ridersFire } from "../../module/rules/damage/riders.mjs";

describe("whether a resolved Damage Step fires its on-hit riders", () => {
  it("fires them on an ordinary hit", () => {
    expect(ridersFire({ skipped: null, result: { total: 120 } })).toBe(true);
  });

  it("fires them on a hit whose total was reduced to zero", () => {
    // A defender whose reductions ate the whole number was still HIT. The
    // author's ruling, stated as a general rule rather than as a Raikou
    // clause: "every unit that was hit, even if they didn't take damage --
    // that's how it should be for every Attack that also applies effects."
    expect(ridersFire({ skipped: null, result: { total: 0 } })).toBe(true);
  });

  it("does NOT fire them when the attack was suppressed outright", () => {
    // "If Heads, no damage AND EFFECTS are received." A complete negation
    // refuses the riders by the same coin that refused the damage; applying
    // them anyway would make a total negation the strongest debuff delivery in
    // the game.
    expect(ridersFire({ skipped: "Rho Aias", result: { total: 0 } })).toBe(false);
  });

  it("does NOT fire them behind a concealment veil", () => {
    expect(ridersFire({
      skipped: null,
      result: { total: 90, flags: { concealmentVeil: { effects: false } } },
    })).toBe(false);
  });

  it("survives a result object with no flags at all", () => {
    // `applyDamage` returns a bare `{total, flags, breakdown}` on the skipped
    // path and a fuller one otherwise; the gate must not assume either.
    expect(ridersFire({ skipped: null, result: { total: 5 } })).toBe(true);
    expect(ridersFire({ skipped: null, result: {} })).toBe(true);
  });
});
