/**
 * @file What each difficulty level takes out of the game.
 * @see char_orig_sheets/extra docs/Normal Great Holy Grail War.md
 *
 * Layer 2 (rules). Pure.
 *
 * > *"Beginner: Damage modifiers & Luck Check removed. Intermediate: Luck Check
 * > removed. Expert: Nothing removed. Lunatic: Random Event rate up."*
 * > *"To play without damage modifiers, just use Base Attack for damage
 * > calculation instead of Attack+/Attack-."*
 *
 * An unknown level reads as **Expert**, not as Beginner: a corrupt setting must
 * fail towards the full rules rather than quietly switching two of them off,
 * because a missing rule is invisible and an extra one is not.
 *
 * Lunatic removes nothing. Its one mechanical clause — *"there should always be
 * at least 2 Civilians on the board"* — is `rules/environment.mjs`'s
 * `civiliansNeeded`, which has been implemented since it was written against a
 * difficulty value the setting could not produce.
 */

/** Levels that switch the `Attack+`/`Attack−` `5d10` off. */
const NO_DAMAGE_MODIFIERS = Object.freeze(["beginner"]);

/** Levels that switch the Luck Check off. */
const NO_LUCK_CHECK = Object.freeze(["beginner", "intermediate"]);

/**
 * Does the `5d10` damage-modifier roll apply?
 * @param {string|undefined} difficulty
 * @returns {boolean}
 */
export function damageModifiersApply(difficulty) {
  return !NO_DAMAGE_MODIFIERS.includes(difficulty);
}

/**
 * Is a Luck Check offered at all?
 * @param {string|undefined} difficulty
 * @returns {boolean}
 */
export function luckChecksApply(difficulty) {
  return !NO_LUCK_CHECK.includes(difficulty);
}
