/**
 * @file Abilities usable "when Attacked".
 * @see docs/15-abilities.md §15.3, docs/27-reaction-protocol.md §27.2
 *
 * Layer 2 (rules). Pure.
 *
 * Medea has the two that made this necessary. *Argos* is *"used during your
 * Turn **or when Attacked**"*, and *Trofa* is *"used **when Attacked**"* and
 * automatically Evades. Neither can be reached from the Skill button on the
 * sheet, because the moment they matter their owner is standing inside somebody
 * else's Combat Process — so they have to be offered **at the reaction rung**,
 * beside Block and Evade.
 *
 * Everything that would refuse the ability is checked *before* it is offered,
 * for §17.6's reason: an option that refuses when pressed teaches nothing that
 * a missing option does not teach faster.
 */

import { blockedThisTurn, isNegated } from "./ability-use.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { relationOf } from "./relations.mjs";

/** The window an ability must name to be offered as a reaction. */
const REACTION_WINDOW = "whenAttacked";

/**
 * The window for an ability somebody ELSE's peril triggers.
 *
 * EMIYA's *Rho Aias* is the only one in the reference set: *"used when any
 * allied Unit (including EMIYA) within a 3 panel area of EMIYA is about to be
 * hit by a Noble Phantasm."* The Unit that may act is neither the attacker nor
 * the defender, which no other ability in the game is true of.
 */
const ALLY_WINDOW = "whenAllyAttacked";

/**
 * The abilities this unit could use in response to being attacked.
 *
 * @param {object} unit an actor-shaped object with `items`
 * @returns {object[]}
 */
export function reactionAbilities(unit) {
  const used = unit?.turnState?.abilitiesUsed ?? [];
  const effects = unit?.effects ?? [];

  return [...(unit?.items ?? [])].filter((item) => {
    const sys = item.system ?? {};

    // A window may be a single string or a list; both are legitimate, and
    // Medea has one of each.
    const windows = [sys.timing?.window ?? []].flat();
    if (!windows.includes(REACTION_WINDOW)) return false;

    if ((sys.cooldown?.remaining ?? 0) > 0) return false;
    if (blockedThisTurn(item, used)) return false;
    if (isNegated(item, effects)) return false;

    return true;
  });
}

/**
 * The reaction prompt's options, with any usable abilities appended.
 *
 * Prefixed `ability:` so the ladder can tell them from its own three without
 * a second field — the defender is choosing between "Evade" and "Trofa" in one
 * list, and they are the same kind of decision.
 *
 * @param {string[]} base the standard options for this rung
 * @param {object} unit
 * @returns {string[]}
 */
export function reactionOptions(base, unit) {
  return [...base, ...reactionAbilities(unit).map((a) => `ability:${a.id}`)];
}

/**
 * The ability id behind a chosen reaction option, or `null`.
 * @param {string} event
 * @returns {string|null}
 */
export function abilityFromOption(event) {
  return typeof event === "string" && event.startsWith("ability:") ? event.slice("ability:".length) : null;
}

/**
 * Abilities a **third party** may use because this defender is about to be hit.
 *
 * Returned with their owner, because the ability does not belong to the Unit
 * whose Combat Process it interrupts — which is the whole difficulty. Ch. 27's
 * ladder prompts one side per rung, so the offer is appended to the defender's
 * rung and carries the projector's name; the GM or the projector's player is
 * the one who answers.
 *
 * Every gate an ordinary reaction is checked against is checked here too, plus
 * two of its own: the distance from the projector, and what kind of attack it
 * answers. *"About to be hit by a Noble Phantasm"* is not a note — a barrier
 * offered against every Normal Attack would be a different ability.
 *
 * @param {object} args
 * @param {object} args.defender the defender's snapshot
 * @param {object} args.board
 * @param {object} args.attack `{kind}`
 * @param {(id: string) => object|null} args.actorFor resolves a unit id to a document
 * @returns {Array<{ability: object, ownerId: string, ownerName: string}>}
 */
export function allyReactions({ defender, board, attack, actorFor }) {
  /** @type {Array<{ability: object, ownerId: string, ownerName: string}>} */
  const out = [];
  if (!defender?.panel) return out;

  for (const unit of board?.units ?? []) {
    if (!unit.panel) continue;
    // "Any allied Unit (INCLUDING EMIYA)" -- the projector may itself be the
    // defender, which is why `self` counts and the id is not excluded.
    const relation = unit.id === defender.id ? "self" : relationOf(unit, defender, board);
    if (relation !== "ally" && relation !== "self") continue;

    const doc = actorFor(unit.id);
    if (!doc) continue;
    const used = unit.turnState?.abilitiesUsed ?? [];

    for (const item of doc.items ?? []) {
      const sys = item.system ?? {};
      const timing = sys.timing ?? {};
      if (![timing.window ?? []].flat().includes(ALLY_WINDOW)) continue;

      // Reach, measured from the PROJECTOR to the Unit in peril.
      const radius = timing.radius ?? 0;
      if (chebyshev(unit.panel, defender.panel) > radius) continue;

      // What it answers. "About to be hit by a Noble Phantasm" is a
      // restriction, not a note: a barrier offered against every Normal Attack
      // would be a different ability entirely.
      if (timing.againstKind && timing.againstKind !== (attack?.kind ?? "normal")) continue;

      if ((sys.cooldown?.remaining ?? 0) > 0) continue;
      if (blockedThisTurn(item, used)) continue;
      if (isNegated(item, unit.effects ?? [])) continue;

      out.push({ ability: item, ownerId: unit.id, ownerName: unit.name ?? doc.name });
    }
  }
  return out;
}
