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
import { npCost, npCostAt, canUseAbility, resolveCosts } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";

const master = (over = {}) => ({ id: "m", rank: "A", health: { value: 500, max: 500 }, ...over });
const servant = (over = {}) => ({
  id: "s", kind: "servant", contract: "contracted", masterId: "m",
  // The Round gate reads the class: Assassin opens two Rounds early.
  servantClasses: ["saber"], ...over,
});
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
    // Round 6, because §7.9's global gate is live: these assertions are about
    // Master Health, ZON, Sustainability and the requirement list, and the
    // Round they run in was only ever "some Round". The two tests below that
    // ARE about Rounds state their own `requiresRound`, which overrides the
    // global gate, so they say what they mean without this number.
    ability: np(), unit: servant(), master: master(), round: 6, ...over,
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

  it("consults the rest of §15.4's requirement list", () => {
    // The list was implemented in `rules/items.mjs` and consulted by nothing:
    // an ability could carry a requirement that never refused anything.
    expect(canUseAbility(ok({
      ability: np({ requirements: [{ kind: "hasSkill", abilityId: "doubleSummonCaster" }] }),
    }))).toMatchObject({ ok: false, reason: "hasSkill" });
  });

  it("allows one whose requirements are met", () => {
    expect(canUseAbility(ok({
      ability: np({ requirements: [{ kind: "roundAtLeast", round: 3 }] }),
    }))).toMatchObject({ ok: true });
  });

  it("checks the cheap gates before the requirement list", () => {
    // A cooldown is the answer a player can act on; a failed requirement two
    // rounds from now is not.
    expect(canUseAbility(ok({
      ability: np({ cooldown: { remaining: 1 }, requirements: [{ kind: "hasSkill", abilityId: "x" }] }),
    }))).toMatchObject({ reason: "cooldown" });
  });

  it("names the first failing gate rather than resolving them all", () => {
    // A refusal a player can act on names one thing to fix.
    const verdict = canUseAbility(ok({
      ability: np({ cooldown: { remaining: 2 }, requiresRound: 9 }),
    }));
    expect(verdict.reason).toBe("cooldown");
  });
});

describe("the shape the SNAPSHOT actually provides", () => {
  // `snapshotUnit` stores `health: sys.health?.value ?? null` -- a NUMBER. Every
  // fixture in this file used `{value, max}`, so the code and the tests agreed
  // with each other and not with the system: `health.value` came out undefined,
  // `?? 0` made it zero, and the strict comparison refused every Noble Phantasm
  // ever attempted. It surfaced the first time one was fired in a live world.
  const snapshotServant = (over = {}) => ({
    id: "medea", kind: "servant", contract: "contracted", masterId: "m", ...over,
  });
  const snapshotMaster = (health) => ({ id: "m", kind: "master", rank: "A", health });

  // Round 6 throughout, because §7.9's global gate is live and these assertions
  // are about the SHAPE of the health field rather than about any Round.

  it("accepts a Master whose health is a bare number", () => {
    expect(canUseAbility({
      ability: np(), unit: snapshotServant(), master: snapshotMaster(250), round: 6,
    })).toMatchObject({ ok: true });
  });

  it("still refuses when that number is at or below the cost", () => {
    expect(canUseAbility({
      ability: np(), unit: snapshotServant(), master: snapshotMaster(50), round: 6,
    })).toMatchObject({ ok: false, reason: "masterHealth" });
  });

  it("accepts the document shape too, because both reach this function", () => {
    expect(canUseAbility({
      ability: np(), unit: snapshotServant(), master: snapshotMaster({ value: 250, max: 250 }), round: 6,
    })).toMatchObject({ ok: true });
  });

  it("reads a Free Servant's own health the same way", () => {
    expect(canUseAbility({
      ability: np(), unit: snapshotServant({ contract: "free", sustainability: null, health: 500 }),
      master: null, round: 6,
    })).toMatchObject({ ok: true });
  });
});

describe("resolveCosts — supersession (§15.4)", () => {
  const actCost = { kind: "masterHealth", amount: 20, unitId: "m", id: "servantActs" };
  const npKarna = { kind: "masterHealth", amount: 50, unitId: "m", id: "npCost", supersedes: ["servantActs"] };

  it("charges both when neither supersedes the other", () => {
    expect(resolveCosts([actCost, { ...npKarna, supersedes: [] }]).charged).toHaveLength(2);
  });

  it("drops the cost that is superseded", () => {
    // Karna: "his Master's Health loss from him using the NP OVERWRITES the 20
    // Health loss from when Karna would normally Act/Attack." Overwrites, not
    // stacks -- charging both would bill 70 where the rules say 50.
    const out = resolveCosts([actCost, npKarna]);

    expect(out.charged.map((c) => c.id)).toEqual(["npCost"]);
  });

  it("records what it dropped and why, so the card can explain the number", () => {
    // A Master who paid 50 instead of 70 needs to see which rule did that;
    // a silently smaller number reads as a bug.
    expect(resolveCosts([actCost, npKarna]).superseded).toEqual([
      { id: "servantActs", by: "npCost" },
    ]);
  });

  it("does not care what order they arrive in", () => {
    expect(resolveCosts([npKarna, actCost]).charged.map((c) => c.id)).toEqual(["npCost"]);
  });

  it("lets a platform upkeep supersede the NP cost the same way", () => {
    // HGoB: "This effect overwrites the normal Master Health loss when a
    // Servant uses its NP." Same mechanism, different content (Ch. 20).
    const upkeep = { kind: "masterHealth", amount: 50, unitId: "m", id: "hgobUpkeep", supersedes: ["npCost"] };

    expect(resolveCosts([npKarna, upkeep]).charged.map((c) => c.id)).toEqual(["hgobUpkeep"]);
  });

  it("survives a cycle of mutual supersession", () => {
    // Nonsense content, but two costs that each cancel the other must not
    // cancel BOTH -- that would make a Noble Phantasm free.
    const a = { kind: "masterHealth", amount: 10, id: "a", supersedes: ["b"] };
    const b = { kind: "masterHealth", amount: 20, id: "b", supersedes: ["a"] };

    expect(resolveCosts([a, b]).charged).toHaveLength(1);
  });

  it("ignores a supersedes naming a cost that is not being charged", () => {
    expect(resolveCosts([npKarna]).charged).toHaveLength(1);
  });

  it("handles an empty list", () => {
    expect(resolveCosts([])).toMatchObject({ charged: [], superseded: [] });
  });
});

describe("a Noble Phantasm charged at a Rank it does not have", () => {
  it("uses the stated Rank's column", () => {
    // EMIYA's Rho Aias prints "?" for a Rank and charges "equivalent to if an
    // EX Rank NP is used"; his Unlimited Blade Works prints `E~A++` and charges
    // as B. Derived from the ability's own `rank`, both read null and cost
    // nothing at all.
    const master = { id: "m", rank: "A", health: 500 };
    const ex = npCostAt({ rank: "EX", unit: { id: "s", contract: "contracted" }, master });
    const b = npCostAt({ rank: "B", unit: { id: "s", contract: "contracted" }, master });

    expect(ex.kind).toBe("masterHealth");
    expect(ex.amount).toBeGreaterThan(b.amount);
    expect(ex.unitId).toBe("m");
  });

  it("falls back to Sustainability for a Free Servant", () => {
    // Found live: EMIYA's Master was defeated mid-test, which freed him — and
    // the cost still named a Master, producing an intent with no target that
    // aborted the whole batch instead of charging him.
    const out = npCostAt({
      rank: "EX",
      unit: { id: "s", contract: "free", sustainability: "7◈" },
      master: null,
    });

    expect(out.kind).toBe("sustainability");
    expect(out.unitId).toBe("s");
  });
});

describe("npGateRound", () => {
  // Ch. 44 §44.5: a per-ability Round gate that composes with the global one by
  // `max()`. The field was declared in the ability schema when it was written,
  // authored on two abilities, and read by NOBODY -- it was not in the content
  // pipeline's allowlist either, so every document read `null` and Ozymandias's
  // "after 7 full Rounds have passed" opened in Round 1.
  const spec = (over) => usageSpecFor({ id: "np", type: "noblePhantasm", system: over });

  it("gates on the ability's own field", () => {
    expect(spec({ npGateRound: 8 }).requiresRound).toBe(8);
  });

  it("takes the LATER of the two gates an ability may state", () => {
    expect(spec({ npGateRound: 8, targeting: { limits: { requiresRound: 3 } } }).requiresRound).toBe(8);
    expect(spec({ npGateRound: 3, targeting: { limits: { requiresRound: 9 } } }).requiresRound).toBe(9);
  });

  it("is null when neither is stated", () => {
    expect(spec({}).requiresRound).toBe(null);
  });

  it("refuses a ◈ expression rather than gating on NaN", () => {
    // `npGateRound` is an integer field and `"3◈"` -- which is what the
    // Normal-mode Assassin NP first said -- would coerce to NaN and gate
    // nothing while looking authored.
    expect(spec({ npGateRound: "3◈" }).requiresRound).toBe(null);
  });
});

describe("an ability spent for the rest of the game", () => {
  const ok = (over = {}) => ({
    // Round 6, because §7.9's global gate is live: these assertions are about
    // Master Health, ZON, Sustainability and the requirement list, and the
    // Round they run in was only ever "some Round". The two tests below that
    // ARE about Rounds state their own `requiresRound`, which overrides the
    // global gate, so they say what they mean without this number.
    ability: np(), unit: servant(), master: master(), round: 6, ...over,
  });

  // `expended` has been written since Akhilleus Kosmos was authored and read
  // only by `rules/reactions.mjs`, so the ORDINARY use route never refused one:
  // a Noble Phantasm broken for the rest of the match was still on the sheet
  // and still pressable.
  it("is refused, and says why", () => {
    const verdict = canUseAbility(ok({ ability: np({ expended: true }) }));
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("expended");
  });

  it("is refused even with the cooldown clear and the Round past", () => {
    expect(canUseAbility(ok({ ability: np({ expended: true, cooldown: { remaining: 0 } }), round: 99 })).ok)
      .toBe(false);
  });

  it("leaves an unspent ability alone", () => {
    expect(canUseAbility(ok({ ability: np({}) })).ok).toBe(true);
  });
});

describe("the usage spec carries what the gate reads", () => {
  const spec = (over) => usageSpecFor({ id: "np", type: "ability", system: over });

  it("projects categorizedAsNP", () => {
    // The gate covers `isNP || categorizedAsNP` (spec R2) and this projection
    // carried only `isNP` -- so the gate would have missed exactly the four
    // abilities the ruling put in scope.
    expect(spec({ categorizedAsNP: true }).categorizedAsNP).toBe(true);
    expect(spec({}).categorizedAsNP).toBe(false);
  });

  it("projects the gated cooldown delay", () => {
    expect(spec({ cooldown: { remaining: 0, gatedDelay: 5 } }).cooldown.gatedDelay).toBe(5);
  });
});

describe("the global Noble Phantasm gate", () => {
  const ok = (over = {}) => ({
    ability: np(), unit: servant(), master: master(), round: 6, ...over,
  });

  it("refuses a Noble Phantasm before Round 6", () => {
    const verdict = canUseAbility(ok({ round: 5 }));
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("round");
    expect(verdict.detail).toMatchObject({ requiresRound: 6, round: 5 });
  });

  it("...and allows it at Round 6", () => {
    expect(canUseAbility(ok({ round: 6 })).ok).toBe(true);
  });

  it("opens two Rounds early for an Assassin", () => {
    const assassin = servant({ servantClasses: ["assassin"] });
    expect(canUseAbility(ok({ unit: assassin, round: 4 })).ok).toBe(true);
    expect(canUseAbility(ok({ unit: assassin, round: 3 })).ok).toBe(false);
  });

  it("covers an ability that is only CATEGORIZED as a Noble Phantasm", () => {
    const crest = { id: "c", categorizedAsNP: true, cooldown: { remaining: 0 } };
    expect(canUseAbility(ok({ ability: crest, round: 5 })).ok).toBe(false);
  });

  it("leaves an ordinary Skill alone", () => {
    const skill = { id: "s", cooldown: { remaining: 0 } };
    expect(canUseAbility(ok({ ability: skill, round: 1 })).ok).toBe(true);
  });

  it("lets a stated gate override the global one -- LATER", () => {
    // Ozymandias: "can only be used after 7 full Rounds have passed."
    const late = np({ requiresRound: 8 });
    expect(canUseAbility(ok({ ability: late, round: 7 })).ok).toBe(false);
    expect(canUseAbility(ok({ ability: late, round: 8 })).ok).toBe(true);
  });

  it("...and EARLIER, which is what keeps the Magic Crest's own row alive", () => {
    // Spec R3. This is the direction `max()` could not express, and it is why
    // the composition rule Ch. 44 recorded is replaced.
    const crest = { id: "c", categorizedAsNP: true, requiresRound: 3, cooldown: { remaining: 0 } };
    expect(canUseAbility(ok({ ability: crest, round: 2 })).ok).toBe(false);
    expect(canUseAbility(ok({ ability: crest, round: 3 })).ok).toBe(true);
  });

  it("takes the gate numbers it is handed", () => {
    expect(canUseAbility(ok({ round: 3, gates: { round: 3, assassinRound: 2 } })).ok).toBe(true);
  });

  it("defaults to the published gate when handed none", () => {
    // The failure mode this whole change exists to close: a call site that
    // forgets must get the RULE, never no rule.
    expect(canUseAbility(ok({ round: 5 })).ok).toBe(false);
  });

  it("adds a cooldown increase taken while gated", () => {
    // Gate turn for Round 6 at three Turns to the Round is 16; a delay of 5
    // pushes availability to turn 21, which is Round 7.
    const locked = np({ cooldown: { remaining: 0, gatedDelay: 5 } });
    expect(canUseAbility(ok({ ability: locked, round: 6, turn: 16, turnsPerRound: 3 })).ok)
      .toBe(false);
    expect(canUseAbility(ok({ ability: locked, round: 7, turn: 21, turnsPerRound: 3 })).ok)
      .toBe(true);
  });
});
