/**
 * @file Ability-specific pools — the `Resource` mechanism of §6.10.
 * @see docs/06-stats-and-resources.md §6.10
 *
 * Layer 1 (domain). Pure.
 *
 * §6.10 counted eight pools across the reference set and drew the conclusion
 * that they deserve *"a general mechanism rather than bespoke fields"*. It also
 * drew the line that keeps this file small: a pool that an enemy can **dispel**
 * is not a resource, it is a stack of effects (Kingprotea's Proliferation), and
 * a pool that stores *identities* rather than a number is a set field
 * (Heracles's recorded attacks). What is left is a clamped integer.
 *
 * Scáthach's PRS Tokens are the first: max 2, +2 per *Primordial Rune*, and one
 * spent to waive a Primordial Rune Spell's cooldown. The clamp is the whole
 * reason this is not a bare number — *"the maximum number of PRS Tokens
 * Scáthach can have is 2"*, so her Skill granting two while she already holds
 * one gives her two, not three.
 */

/**
 * What a unit currently holds of one pool.
 *
 * @param {object} unit a document's `system` or a snapshot
 * @param {string} key
 * @returns {number}
 */
export function resourceValue(unit, key) {
  return unit?.resources?.[key]?.value ?? 0;
}

/**
 * The pool's ceiling, or `null` for an uncapped counter.
 *
 * Heracles's recorded attacks and Semiramis's Construction sit at opposite ends
 * of this — one uncapped, one capped at 100 — so "no maximum" has to be
 * expressible rather than defaulted to some large number.
 *
 * @param {object} unit
 * @param {string} key
 * @returns {number|null}
 */
export function resourceMax(unit, key) {
  const max = unit?.resources?.[key]?.max;
  return typeof max === "number" ? max : null;
}

/**
 * Can this unit pay `amount` from the pool?
 *
 * @param {object} unit
 * @param {string} key
 * @param {number} [amount]
 * @returns {boolean}
 */
export function canSpend(unit, key, amount = 1) {
  return resourceValue(unit, key) >= amount;
}

/**
 * Where a pool lands after a change, respecting both bounds.
 *
 * @param {object} unit
 * @param {string} key
 * @param {number} delta
 * @returns {number}
 */
export function afterChange(unit, key, delta) {
  const max = resourceMax(unit, key);
  const raw = resourceValue(unit, key) + delta;
  const floored = Math.max(0, raw);
  return max === null ? floored : Math.min(max, floored);
}

/**
 * The document path a resource intent writes to.
 *
 * One place, because the intent, the writer and the sheet each need it and
 * three copies of `system.resources.${key}.value` is three chances to typo one.
 *
 * @param {string} key
 * @returns {string}
 */
export function resourcePath(key) {
  return `resources.${key}.value`;
}
