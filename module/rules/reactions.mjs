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

/** The window an ability must name to be offered as a reaction. */
const REACTION_WINDOW = "whenAttacked";

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
