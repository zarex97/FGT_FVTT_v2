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
  const decoys = decoysOn(units);

  for (const unit of units ?? []) {
    unit.compulsions = compulsionsFor(unit, board);

    // Decoy pulls the OTHER way round from every other compulsion in the game.
    // A `Compulsion` rule element describes something its own bearer is under;
    // Decoy sits on the decoy and constrains everybody else, which is why
    // nothing carried it and the effect had been authorable-but-inert.
    const pull = decoyPullOn(unit, decoys, board);
    if (!pull) {
      unit.decoy = null;
      continue;
    }
    // Read by `apps/canvas/overlay-layer.mjs#drawDecoyPull`, which has drawn
    // an arrow from `unit.decoy.sourceUnitId` since it was written against a
    // projection that never had one -- and by `rules/movement.mjs`, which
    // refuses a step that increases the distance.
    unit.decoy = { sourceUnitId: pull.id, radius: pull.radius };
    unit.compulsions = [
      ...unit.compulsions,
      { id: "decoy", forcesTarget: true, forcesSkill: null, targetIds: [pull.id], source: pull.source },
    ];
  }
}

/**
 * Every Unit currently acting as a Decoy, with the radius it declares.
 *
 * *"Inert while the bearer is concealed"* (Appendix A §A.10): a decoy nobody
 * can see is not drawing anybody, and the alternative is an enemy compelled to
 * attack a Unit it is not allowed to target.
 *
 * @param {object[]} units
 * @returns {Array<{id: string, radius: number, source: string, panel: object|null, factionId: unknown}>}
 */
function decoysOn(units) {
  /** @type {Array<{id: string, radius: number, source: string, panel: object|null, factionId: unknown}>} */
  const out = [];
  for (const unit of units ?? []) {
    if (unit.concealed) continue;
    for (const sup of unit.suppressions ?? []) {
      if (sup?.scope !== "targeting" || !sup.decoy) continue;
      out.push({
        id: unit.id,
        radius: sup.radius ?? 3,
        source: sup.source ?? "Decoy",
        panel: unit.panel ?? null,
        factionId: unit.factionId ?? null,
      });
    }
  }
  return out;
}

/**
 * The Decoy this Unit is pulled toward, or `null`.
 *
 * > *"Enemies within `max(3, their Range)`."*
 *
 * The reach is the LARGER of the effect's own radius and the pulled Unit's own
 * Range, which is why it is measured per enemy rather than once per decoy: a
 * sniper standing at Range 4 is caught by a 3-panel Decoy, and a Servant at
 * Range 1 standing four panels away is not.
 *
 * The NEAREST, when two enemies both carry one: the rule does not say which,
 * and an arbitrary answer is one that changes when a token is re-placed.
 *
 * @param {object} unit
 * @param {Array<object>} decoys
 * @param {object} board
 * @returns {object|null}
 */
function decoyPullOn(unit, decoys, board) {
  if (decoys.length === 0 || !unit.panel) return null;
  // A decoy does not pull itself, and does not pull its own side.
  let best = null;
  let bestDistance = Infinity;
  const reach = typeof unit.range === "number" ? unit.range : (unit.range?.panels ?? 1);

  for (const decoy of decoys) {
    if (decoy.id === unit.id || !decoy.panel) continue;
    const allied = board?.alliances?.[unit.factionId]?.includes(decoy.factionId)
      ?? (decoy.factionId != null && decoy.factionId === unit.factionId);
    if (allied) continue;
    const distance = chebyshev(decoy.panel, unit.panel);
    if (distance > Math.max(decoy.radius, reach) || distance >= bestDistance) continue;
    best = decoy;
    bestDistance = distance;
  }
  return best;
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
