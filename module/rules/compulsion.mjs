/**
 * @file Compulsions — being forced to attack a particular unit.
 * @see docs/18-action-economy.md §18.5, docs/24-rules-engine.md Group 4
 *
 * Layer 2 (rules). Pure.
 *
 * Two halves that had never met. `budget.unmetCompulsions` has read a `hatred`
 * effect since it was written and **nothing applied one**; and §45.4 records
 * that the four targeting executors *"write keys that nothing in the targeting
 * resolver reads"*. A compulsion could therefore be neither acquired nor
 * obeyed, from either end.
 *
 * A compulsion is **positional** — it holds while somebody is standing nearby,
 * and lifts the moment they are not. That makes it the same shape as an aura,
 * and it is settled in the same board pass for the same reason: only the board
 * knows who is standing where.
 */

import { chebyshev } from "../domain/geometry.mjs";
import { test as testPredicate } from "./predicate.mjs";
import { rollOptionsFor } from "./options.mjs";

/**
 * Give every unit the compulsions it is currently under.
 *
 * @param {object[]} units
 * @param {object} board
 * @returns {void} mutates `unit.compulsions`
 */
export function annotateCompulsions(units, board) {
  for (const unit of units ?? []) {
    unit.compulsions = compulsionsFor(unit, board);
  }
}

/**
 * The units this caster is forced to attack, if any.
 *
 * The targeting resolver narrows to these: a compelled unit *"will ignore all
 * orders/Player commands"*, so offering it a free choice of target would be
 * offering something the rules have already taken away.
 *
 * @param {object} unit
 * @returns {string[]}
 */
export function compelledTargetsOf(unit) {
  return (unit?.compulsions ?? [])
    .filter((c) => c.forcesTarget)
    .flatMap((c) => c.targetIds ?? []);
}

/* -------------------------------------------------------------------------- */

/**
 * @param {object} unit
 * @param {object} board
 * @returns {object[]}
 */
function compulsionsFor(unit, board) {
  /** @type {object[]} */
  const out = [];

  for (const rule of unit.compulsionRules ?? []) {
    const targetIds = [];

    for (const other of board.units ?? []) {
      // A unit can never compel itself, however well it matches. Penthesilea
      // is Greek; without this she would be trapped by her own predicate.
      if (other.id === unit.id) continue;
      if (chebyshev(other.panel ?? {}, unit.panel ?? {}) > (rule.within ?? 0)) continue;
      if (!relationAllowed(rule, unit, other, board)) continue;
      if (rule.targetPredicate && !testPredicate(rule.targetPredicate, {
        options: rollOptionsFor({ attacker: unit, defender: other }),
      })) continue;

      targetIds.push(other.id);
    }

    if (targetIds.length > 0) {
      out.push({ id: rule.id, forcesTarget: Boolean(rule.forcesTarget), forcesSkill: rule.forcesSkill ?? null, targetIds, source: rule.source });
    }
  }

  return out;
}

/**
 * Hatred of Achilles applies *"regardless of enemy or ally"*, which is what
 * makes it a liability rather than a targeting aid — so the relation list
 * defaults to both.
 *
 * @param {object} rule
 * @param {object} unit
 * @param {object} other
 * @param {object} board
 * @returns {boolean}
 */
function relationAllowed(rule, unit, other, board) {
  const relations = rule.relations ?? ["ally", "enemy"];
  const allied = board.alliances?.[unit.faction]?.includes(other.faction)
    ?? other.faction === unit.faction;
  return relations.includes(allied ? "ally" : "enemy");
}
