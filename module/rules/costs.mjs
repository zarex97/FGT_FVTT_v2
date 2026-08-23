/**
 * @file Ability costs and requirements.
 * @see docs/15-abilities.md §15.4, docs/16-relationships.md §16.5
 *
 * Layer 2 (rules). Pure — takes snapshots, returns a verdict and a price.
 *
 * `npCostByRank` and `freeServantNPSustainabilityCost` sat in
 * `domain/tables.mjs` from the day the tables were transcribed, and nothing
 * ever read either of them: using a Noble Phantasm cost its Master nothing.
 * Same shape as the ZON defect and the `fireEvent` defect — data that loads
 * correctly and is never asked a question.
 *
 * One call answers "can this be used", because a refusal that names the *first*
 * problem is actionable and a refusal that names four is a wall of text.
 */

import { lookup } from "../domain/tables.mjs";
import { currentHealth } from "../domain/health.mjs";
import { Rank } from "../domain/rank.mjs";
import { meetsRequirements } from "./items.mjs";
import { isConcealed, canUseWhileConcealed } from "./concealment.mjs";

/** Master ranks that pay the cheaper column. Masters come in four ranks (Ch. 04). */
const HIGH_RANK_MASTER = Object.freeze(["A", "B"]);

/**
 * What using this ability costs, or `null` when it is free.
 *
 * Only Noble Phantasms have a cost today. The shape is a discriminated `Cost`
 * so the caller pays it without re-deriving who is charged — which matters,
 * because *who* is charged changes with the Servant's contract and the payer
 * is not always the user.
 *
 * @param {object} args
 * @param {object} args.ability
 * @param {object} args.unit the Servant using it
 * @param {object|null} args.master its Master, if it has one
 * @returns {{kind: string, amount: number, unitId?: string}|null}
 */
export function npCost({ ability, unit, master }) {
  if (!ability?.isNP) return null;
  return npCostAt({ rank: ability.rank, unit, master });
}

/**
 * The same cost, for a Noble Phantasm charged at a Rank it does not have.
 *
 * Two of EMIYA's need it and neither could state the cost any other way: Rho
 * Aias prints "?" for a Rank and charges *"equivalent to if an EX Rank NP is
 * used"*, and Unlimited Blade Works prints the range `E~A++` and charges as B.
 * Derived from the ability's own `rank`, both read null and cost nothing.
 *
 * Routed through here rather than looked up at the call site so the **Free
 * Servant** branch below applies to them too. A Servant whose Master has just
 * been defeated has nobody to charge, and an `additionalCosts` entry that
 * named a Master anyway produced an intent with no target — which aborts the
 * whole batch rather than falling back to Sustainability the way §16.5 says.
 *
 * @param {object} args
 * @param {string|null} args.rank
 * @param {object} args.unit
 * @param {object|null} args.master
 * @returns {{kind: string, amount: number, unitId?: string}}
 */
export function npCostAt({ rank, unit, master }) {
  const npRank = Rank.parseOrNull(rank);
  const [high, low] = columnsFor(npRank);

  // A Free Servant has no Master to charge, so the cost moves onto the Servant
  // itself — first as Sustainability, and if it has no clock at all, as double
  // the High Rank Master figure in its own Health (Ch. 16 §16.5).
  if (isFree(unit)) {
    if (unit.sustainability === null || unit.sustainability === undefined) {
      return { kind: "selfHealth", amount: high * 2, unitId: unit.id };
    }
    return {
      kind: "sustainability",
      amount: Number(lookup("freeServantNPSustainabilityCost", npRank) ?? 0),
      unitId: unit.id,
    };
  }

  return {
    kind: "masterHealth",
    amount: isHighRankMaster(master) ? high : low,
    unitId: master?.id ?? null,
  };
}

/**
 * Whether an ability can be used right now, and what it will cost.
 *
 * Gates are checked in the order a player can act on them: something they can
 * fix by waiting, then something they can fix by moving, then something they
 * cannot fix at all. The **first** failure is reported, not all of them.
 *
 * @param {object} args
 * @param {object} args.ability
 * @param {object} args.unit
 * @param {object|null} [args.master]
 * @param {number} [args.round]
 * @returns {{ok: boolean, reason?: string, detail?: object, cost: object|null}}
 */
export function canUseAbility({ ability, unit, master = null, round = 1, ...ctx }) {
  const cost = npCost({ ability, unit, master });

  // Cooldown first: it is the most common refusal and the easiest to
  // understand, and every other gate is irrelevant while it is running.
  const remaining = ability?.cooldown?.remaining ?? 0;
  if (remaining > 0) return { ok: false, reason: "cooldown", detail: { remaining }, cost };

  // The whole-match budget. Before the Round gate because it is permanent:
  // "can only be used 11 times" is never going to become true again by waiting.
  const maxUses = ability?.maxUses ?? null;
  if (maxUses !== null && (ability?.timesUsed ?? 0) >= maxUses) {
    return { ok: false, reason: "exhausted", detail: { maxUses, timesUsed: ability.timesUsed ?? 0 }, cost };
  }

  const requiresRound = ability?.requiresRound ?? null;
  if (requiresRound !== null && round < requiresRound) {
    return { ok: false, reason: "round", detail: { requiresRound, round }, cost };
  }

  // "Can only be used once per Turn." A field on the ability rather than a
  // requirement, because the question is about the ability ITSELF and a
  // requirement has no way to name its own declarer without repeating the id.
  //
  // Not redundant with the cooldown gate above, and Scathach is why: a
  // Primordial Rune Spell used while she holds a PRS Token does not enter
  // Cooldown at all, so Ar's `3◈` never runs and this clause is the only thing
  // standing between her and using it every Turn for free.
  if (ability?.oncePerTurn && usedThisTurn(unit).some(
    (id) => id === ability.id || id === ability.contentId,
  )) {
    return { ok: false, reason: "oncePerTurn", cost };
  }

  // Mutual exclusion, at both scales. Checked here rather than only on the
  // Skill path, which is where it used to live -- so Medea's Keraino/Trofa pair
  // was enforced and EMIYA's Caladbolg/Hrunting pair, both Noble Phantasms,
  // would not have been.
  const turnPartner = firstUsed(ability?.sameTurnExclusive, usedThisTurn(unit));
  if (turnPartner) return { ok: false, reason: "sameTurnExclusive", detail: { partner: turnPartner }, cost };

  const roundPartner = firstUsed(ability?.sameRoundExclusive, usedThisRound(unit));
  if (roundPartner) return { ok: false, reason: "sameRoundExclusive", detail: { partner: roundPartner }, cost };

  // Presence Concealment clause 7:
  //
  //   "Active Skills targeting/affecting an enemy Unit(s) cannot be used unless
  //    stated. Note: Does not include Attack Skills and Spells that deal damage."
  //
  // The one gate in the reference set whose subject is the USER'S OWN STATE
  // rather than the ability's -- concealment refuses a Skill that would give
  // the position away, and refuses it by category rather than by a list.
  if (isConcealed(unit)) {
    const veiled = canUseWhileConcealed(ability);
    if (!veiled.ok) return { ok: false, reason: "presenceConcealment", cost };
  }

  // A Noble Phantasm needs its user inside its Master's ZON. The targeting
  // resolver has always refused this; asking here too means one call answers
  // the whole question rather than half of it.
  if (ability?.isNP && unit?.outsideZon) {
    return { ok: false, reason: "zon", cost };
  }

  // Everything else §15.4 lists. Checked after the gates above because those
  // three are the common refusals and this is the long tail.
  const met = meetsRequirements(ability?.requirements ?? [], {
    unit, master, target: ctx.target ?? null, board: ctx.board ?? null,
    round, testPredicate: ctx.testPredicate,
    // The declaring ability, so `abilityOffCooldown` can exclude it. Without
    // this a Spell gates on its own cooldown, which the gate above already
    // checked -- so the requirement would never say anything new.
    ability,
  });
  if (!met.ok) return { ok: false, reason: met.reason, cost };

  const unpayable = cannotPay(cost, unit, master);
  if (unpayable) return { ok: false, reason: unpayable, cost };

  return { ok: true, cost };
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Which abilities this Unit has already used this Turn.
 *
 * Stale-by-tick like the rest of turn state, and the snapshot has already
 * applied that rule -- `turnStateAt` blanks a list stamped with an earlier
 * tick, so a missed reset cannot leave a Servant permanently unable to act.
 *
 * @param {object} unit
 * @returns {string[]}
 */
function usedThisTurn(unit) {
  return unit?.turnState?.abilitiesUsed ?? [];
}

/**
 * Which abilities this Unit has used this ROUND. Stale-by-round, like the above.
 * @param {object} unit
 * @returns {string[]}
 */
function usedThisRound(unit) {
  return unit?.roundState?.abilitiesUsed ?? [];
}

/**
 * The first partner in an exclusion list that has already gone.
 * @param {string[]|undefined} exclusive
 * @param {string[]} used
 * @returns {string|null}
 */
function firstUsed(exclusive, used) {
  if (!exclusive?.length) return null;
  const seen = new Set(used);
  return exclusive.find((id) => seen.has(id)) ?? null;
}

/**
 * Why the cost cannot be met, or `null` when it can.
 *
 * Health is **strictly** greater: *"the Servant cannot use its Noble Phantasm
 * if its Master's Health is equal to or less than the amount that would be
 * lost."* A Master at exactly 50 cannot pay a 50-cost NP, which is the kind of
 * boundary that is wrong in half the implementations that meet it.
 *
 * @param {object|null} cost
 * @param {object} unit
 * @param {object|null} master
 * @returns {string|null}
 */
function cannotPay(cost, unit, master) {
  if (!cost) return null;
  switch (cost.kind) {
    case "masterHealth":
      return currentHealth(master) > cost.amount ? null : "masterHealth";
    case "selfHealth":
      return currentHealth(unit) > cost.amount ? null : "selfHealth";
    case "sustainability":
      return (unit?.sustainability ?? 0) > cost.amount ? null : "sustainability";
    default:
      return null;
  }
}

/**
 * The `[highRankMaster, lowRankMaster]` pair for a Noble Phantasm rank.
 * @param {Rank|null} npRank
 * @returns {[number, number]}
 */
function columnsFor(npRank) {
  const v = lookup("npCostByRank", npRank);
  return Array.isArray(v) ? [v[0], v[1]] : [0, 0];
}

/**
 * A rankless Master pays the **left** column — the cheaper one. That reads
 * backwards until you notice it is the default rather than a reward: the right
 * column is the penalty a Low Rank Master carries.
 *
 * @param {object|null} master
 * @returns {boolean}
 */
function isHighRankMaster(master) {
  const rank = Rank.parseOrNull(master?.rank ?? null);
  if (!rank) return true;
  return HIGH_RANK_MASTER.includes(rank.grade);
}

/** @param {object} unit @returns {boolean} */
function isFree(unit) {
  return unit?.contract === "free" || unit?.contract === "unbound";
}

/**
 * Resolve a set of pending costs against each other (§15.4).
 *
 * A `Cost` may carry `supersedes: string[]`, naming other costs it **replaces
 * rather than stacks with**. Karna is the reference case: *"his Master's Health
 * loss from him using the NP overwrites the 20 Health loss from when Karna
 * would normally Act/Attack"* — charging both would bill 70 where the rules say
 * 50. Ch. 20's Hanging Gardens upkeep uses the same mechanism in the other
 * direction: the 50/round replaces the NP cost rather than adding to it.
 *
 * Supersession is resolved in **one pass over the original set**, not
 * transitively. A cost that was itself superseded still suppresses what it
 * names, which keeps the result independent of arrival order and makes a cycle
 * of mutual supersession collapse to one survivor rather than to none — and
 * "none" would make a Noble Phantasm free, which is the one outcome no reading
 * of the rule supports.
 *
 * @param {object[]} costs each optionally with `id` and `supersedes`
 * @returns {{charged: object[], superseded: Array<{id: string, by: string}>}}
 */
export function resolveCosts(costs) {
  const all = (costs ?? []).filter(Boolean);

  /** @type {Array<{id: string, by: string}>} */
  const superseded = [];
  const dropped = new Set();

  for (const cost of all) {
    for (const target of cost.supersedes ?? []) {
      // Only against costs actually being charged: a `supersedes` naming
      // something absent is content describing a case that did not arise.
      if (!all.some((c) => c.id === target)) continue;
      // A cycle would otherwise drop both. The first to be examined wins, and
      // the survivor is deterministic because the input order is.
      if (dropped.has(cost.id)) continue;
      if (dropped.has(target)) continue;
      dropped.add(target);
      superseded.push({ id: target, by: cost.id });
    }
  }

  return { charged: all.filter((c) => !dropped.has(c.id)), superseded };
}
