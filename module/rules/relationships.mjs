/**
 * @file Overpower, Underpower, Sustainability and the multi-Servant tax.
 * @see docs/16-relationships.md §16.5, §16.6, §16.7
 *
 * Layer 2 (rules). Pure.
 *
 * The rules that govern what a Master and its Servant are to each other, other
 * than ZON (which lives in `zon.mjs` because it is a geometry question) and
 * Master protection (which is enforced by movement and targeting).
 */

import { Rank } from "../domain/rank.mjs";
import { currentHealth } from "../domain/health.mjs";
import { lookup } from "../domain/tables.mjs";

/** Base chance for both coin flips. */
const BASE_FLIP = 50;

/** The multi-Servant tax, and the Health floor below which it becomes a ban. */
const MULTI_SERVANT_COST = 25;

/* -------------------------------------------------------------------------- */
/*  §16.5 Overpower and Underpower                                            */
/* -------------------------------------------------------------------------- */

/**
 * Whether a Servant attacking a Master may instantly defeat it, and how likely.
 *
 * *"When a Servant successfully Attacks a Master, the player controlling the
 * Servant flips a coin. If Heads, the Master is instantly defeated."*
 *
 * Direction matters: Servant→Master only. A Servant attacking a Servant runs
 * neither this nor Underpower, and nor does a Master attacking a Master —
 * which is why this returns `applies: false` rather than a zero chance. Zero
 * chance and "the rule does not apply" are different facts, and the UI shows
 * them differently.
 *
 * @param {object} attacker
 * @param {object} defender
 * @returns {{applies: boolean, chance: number, reason?: string}}
 */
export function overpowerCheck(attacker, defender) {
  if (attacker?.kind !== "servant" || defender?.kind !== "master") {
    return { applies: false, chance: 0, reason: "wrongDirection" };
  }

  const held = defender.effects ?? [];
  // Invuln and Shield are absolute, not modifiers — a Master carrying either
  // cannot be Overpowered at all.
  if (held.includes("invuln")) return { applies: false, chance: 0, reason: "invuln" };
  if (held.includes("shield")) return { applies: false, chance: 0, reason: "shield" };

  let chance = BASE_FLIP;
  if (held.includes("defUp") || held.includes("dmgCut")) chance -= 10;

  return { applies: true, chance: Math.max(0, chance) };
}

/**
 * Resolve an Overpower flip, including the Luck Check that saves the Master.
 *
 * The Luck Check covers **both** the flip and the subsequent lethal-damage
 * case in one success, which makes it disproportionately valuable — a Master
 * who passes is neither instantly defeated nor killed by the damage that
 * follows. §16.5 asks for that to be surfaced clearly, so the result says
 * `survivesLethal` rather than leaving the caller to infer it.
 *
 * @param {object} args
 * @param {object} args.attacker
 * @param {object} args.defender
 * @param {number} args.roll 1–100
 * @param {boolean} [args.luckCheckPassed]
 * @returns {{defeated: boolean, survivesLethal: boolean, chance: number, applies: boolean}}
 */
export function resolveOverpower({ attacker, defender, roll, luckCheckPassed = false }) {
  const { applies, chance } = overpowerCheck(attacker, defender);
  if (!applies) return { defeated: false, survivesLethal: false, chance: 0, applies: false };

  if (luckCheckPassed) return { defeated: false, survivesLethal: true, chance, applies: true };
  return { defeated: roll <= chance, survivesLethal: false, chance, applies: true };
}

/**
 * Whether a Master attacking a Servant risks having its damage halved.
 *
 * Note the asymmetry in the source's phrasing: both this modifier and
 * Overpower's favour the **Master**. `Atk Up` or `NP DmUp` on the Master
 * reduces the chance of the penalty, exactly as `Def Up` reduces the chance of
 * being Overpowered.
 *
 * @param {object} attacker
 * @param {object} defender
 * @returns {{applies: boolean, chance: number, reason?: string}}
 */
export function underpowerCheck(attacker, defender) {
  if (attacker?.kind !== "master" || defender?.kind !== "servant") {
    return { applies: false, chance: 0, reason: "wrongDirection" };
  }

  const held = attacker.effects ?? [];
  let chance = BASE_FLIP;
  if (held.includes("atkUp") || held.includes("npDmUp")) chance -= 10;

  return { applies: true, chance: Math.max(0, chance) };
}

/**
 * The Total Damage factor a Master's attack suffers.
 *
 * Applied at pipeline stage 15 as a ×0.5 on Total Damage, "including NP" — so
 * there is no reduced magnitude for a Noble Phantasm.
 *
 * @param {object} args
 * @param {object} args.attacker
 * @param {object} args.defender
 * @param {number} args.roll
 * @returns {{underpowered: boolean, factor: number, chance: number}}
 */
export function resolveUnderpower({ attacker, defender, roll }) {
  const { applies, chance } = underpowerCheck(attacker, defender);
  if (!applies) return { underpowered: false, factor: 1, chance: 0 };

  const underpowered = roll <= chance;
  return { underpowered, factor: underpowered ? 0.5 : 1, chance };
}

/* -------------------------------------------------------------------------- */
/*  §16.6 Sustainability                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What happens to a Servant when its Master dies.
 *
 * `null` is **not** zero, and the distinction is the whole rule: a Servant with
 * `null` has no clock at all and stays indefinitely, while one with `0`
 * disappears immediately. Treating the two the same would delete a Servant that
 * should be permanent, or keep one that should be gone.
 *
 * Mad Enhancement's state preservation is part of the same moment: *"it remains
 * in whatever state it was in before its Master died until contracted to
 * another Master"* — so an active Mad Enhancement is locked on, which locks in
 * its own −2◈ penalty.
 *
 * @param {object} servant
 * @returns {object[]} descriptors
 */
export function onMasterDefeated(servant) {
  if (servant?.kind !== "servant") return [];

  /** @type {object[]} */
  const out = [{ kind: "setContract", unitId: servant.id, contract: "free" }];

  // "It remains in whatever state it was in" — the modes lock rather than
  // resetting, and cannot be changed while Free.
  out.push({ kind: "lockModes", unitId: servant.id, reason: "masterDefeated" });

  if (servant.sustainability === null || servant.sustainability === undefined) {
    // No clock. It stays until it spends itself on a Noble Phantasm.
    return out;
  }
  if (typeof servant.sustainability !== "number") {
    // Not resolved. Refusing to act is the safe direction: the alternative is
    // NaN arithmetic that silently defeats a Servant with time left.
    return out;
  }
  if (servant.sustainability <= 0) {
    out.push({ kind: "defeat", unitId: servant.id, cause: "sustainabilityExhausted" });
    return out;
  }

  // Mad Enhancement active at the moment the Master died costs 2 more.
  if ((servant.modes ?? []).includes("madEnhancement")) {
    out.push({ kind: "resource", unitId: servant.id, key: "sustainability", delta: -2 });
  }
  return out;
}

/**
 * The Sustainability a Free Servant spends to use a Noble Phantasm.
 *
 * @param {object} servant
 * @param {string|null} npRank
 * @returns {number}
 */
export function sustainabilityCostOf(servant, npRank) {
  if (servant?.contract === "contracted") return 0;
  const rank = Rank.parseOrNull(npRank ?? null);
  return Number(lookup("freeServantNPSustainabilityCost", rank) ?? 0);
}

/* -------------------------------------------------------------------------- */
/*  §16.7 The multi-Servant tax                                               */
/* -------------------------------------------------------------------------- */

/**
 * The Health a Master loses at the end of a Turn in which several of its
 * Servants Acted.
 *
 * **Flat, not per-Servant**: acting with two costs 25 and acting with five
 * also costs 25. The rule checks "more than one Acted", not how many.
 *
 * A `loss`, not damage (Ch. 06 §6.2), so it bypasses every reduction effect —
 * which is why this returns a descriptor rather than a damage figure.
 *
 * @param {object} master
 * @param {object[]} servants its contracted Servants
 * @param {object} [settings]
 * @param {boolean} [settings.grandOrder] the tax does not apply in a Grand Order war
 * @returns {object[]} descriptors
 */
export function multiServantTax(master, servants, settings = {}) {
  if (settings.grandOrder) return [];

  const acted = (servants ?? []).filter((s) => s.turnState?.acted).length;
  if (acted <= 1) return [];

  return [{
    kind: "statDelta", unitId: master.id, stat: "health.value",
    delta: -MULTI_SERVANT_COST, isLoss: true, source: "Multi-Servant tax",
  }];
}

/**
 * May this Master order another of its Servants to Act?
 *
 * The prohibition half of §16.7: *"If a Master has 25 Health or less, it cannot
 * order more than one of its Servants to Act during its Turn."* Enforced at
 * declaration, where it composes with the ordinary budget.
 *
 * @param {object} master
 * @param {object[]} servants
 * @param {object} [settings]
 * @returns {{ok: boolean, reason?: string}}
 */
export function mayOrderAnotherServant(master, servants, settings = {}) {
  if (settings.grandOrder) return { ok: true };
  if (currentHealth(master) > MULTI_SERVANT_COST) return { ok: true };

  const acted = (servants ?? []).filter((s) => s.turnState?.acted).length;
  return acted >= 1
    ? { ok: false, reason: "multiServantTaxUnaffordable" }
    : { ok: true };
}
