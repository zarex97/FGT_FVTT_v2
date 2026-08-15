/**
 * @file Ability costs and requirements.
 * @see docs/15-abilities.md §15.4, docs/16-relationships.md §16.5
 * @see docs/45-implementation-status.md B4
 *
 * `npCostByRank` and `freeServantNPSustainabilityCost` have been in
 * `domain/tables.mjs` since the tables were transcribed, and nothing has ever
 * looked at either of them. Using a Noble Phantasm cost its Master nothing.
 */

import { describe, it, expect } from "vitest";
import { npCost, canUseAbility } from "../../module/rules/costs.mjs";

const master = (over = {}) => ({ id: "m", rank: "A", health: { value: 500, max: 500 }, ...over });
const servant = (over = {}) => ({ id: "s", kind: "servant", contract: "contracted", masterId: "m", ...over });
const np = (over = {}) => ({ id: "np", rank: "A", isNP: true, cooldown: { remaining: 0 }, ...over });

describe("npCost", () => {
  it("charges a High Rank Master the left column", () => {
    // Masters come in four ranks; A and B are High Rank (Ch. 04).
    expect(npCost({ ability: np(), unit: servant(), master: master({ rank: "A" }) }))
      .toMatchObject({ kind: "masterHealth", amount: 50 });
  });

  it("charges a Low Rank Master the right column", () => {
    expect(npCost({ ability: np(), unit: servant(), master: master({ rank: "C" }) }))
      .toMatchObject({ kind: "masterHealth", amount: 60 });
  });

  it("charges a rankless Master the left column", () => {
    // "Rankless Masters use the left column" — the cheaper one, which reads
    // backwards until you notice it is the *default*, not a reward.
    expect(npCost({ ability: np(), unit: servant(), master: master({ rank: "" }) }))
      .toMatchObject({ amount: 50 });
  });

  it("adds 3 per rank step of the Noble Phantasm", () => {
    expect(npCost({ ability: np({ rank: "A+" }), unit: servant(), master: master() }))
      .toMatchObject({ amount: 53 });
  });

  it("costs a Free Servant Sustainability instead of its Master's Health", () => {
    // A Free Servant has no Master to charge (Ch. 16 §16.5).
    expect(npCost({ ability: np(), unit: servant({ contract: "free", sustainability: 8 }), master: null }))
      .toMatchObject({ kind: "sustainability", amount: 5 });
  });

  it("costs a Free Servant with no Sustainability clock double its own Health", () => {
    // "N/A trades a timer for a per-NP health cost of 2 x highRankMasterCost."
    expect(npCost({ ability: np(), unit: servant({ contract: "free", sustainability: null }), master: null }))
      .toMatchObject({ kind: "selfHealth", amount: 100 });
  });

  it("charges nothing for an ability that is not a Noble Phantasm", () => {
    expect(npCost({ ability: np({ isNP: false }), unit: servant(), master: master() })).toBeNull();
  });
});

describe("canUseAbility", () => {
  const ok = (over = {}) => ({
    ability: np(), unit: servant(), master: master(), round: 3, ...over,
  });

  it("allows a Noble Phantasm the Master can pay for", () => {
    expect(canUseAbility(ok())).toMatchObject({ ok: true });
  });

  it("refuses when the Master's Health equals the cost exactly", () => {
    // "The Servant cannot use its NP if its Master's Health is equal to or
    // less than the amount that would be lost." Strictly greater.
    expect(canUseAbility(ok({ master: master({ health: { value: 50, max: 500 } }) })))
      .toMatchObject({ ok: false, reason: "masterHealth" });
  });

  it("allows it one point above the cost", () => {
    expect(canUseAbility(ok({ master: master({ health: { value: 51, max: 500 } }) })))
      .toMatchObject({ ok: true });
  });

  it("refuses an ability still on cooldown", () => {
    expect(canUseAbility(ok({ ability: np({ cooldown: { remaining: 2 } }) })))
      .toMatchObject({ ok: false, reason: "cooldown" });
  });

  it("refuses a Noble Phantasm before the round it unlocks", () => {
    expect(canUseAbility(ok({ ability: np({ requiresRound: 3 }), round: 2 })))
      .toMatchObject({ ok: false, reason: "round" });
  });

  it("allows it on the round it unlocks", () => {
    expect(canUseAbility(ok({ ability: np({ requiresRound: 3 }), round: 3 })))
      .toMatchObject({ ok: true });
  });

  it("refuses a Servant outside its Master's ZON", () => {
    // The check ZON already had, now on the same path as every other gate so
    // one call answers "can this be used" completely.
    expect(canUseAbility(ok({ unit: servant({ outsideZon: true }) })))
      .toMatchObject({ ok: false, reason: "zon" });
  });

  it("reports the cost it would charge, so the caller can pay exactly that", () => {
    expect(canUseAbility(ok()).cost).toMatchObject({ kind: "masterHealth", amount: 50 });
  });

  it("refuses a Free Servant with less Sustainability than the cost", () => {
    expect(canUseAbility(ok({
      unit: servant({ contract: "free", sustainability: 4 }), master: null,
    }))).toMatchObject({ ok: false, reason: "sustainability" });
  });

  it("names the first failing gate rather than resolving them all", () => {
    // A refusal a player can act on names one thing to fix.
    const verdict = canUseAbility(ok({
      ability: np({ cooldown: { remaining: 2 }, requiresRound: 9 }),
    }));
    expect(verdict.reason).toBe("cooldown");
  });
});
