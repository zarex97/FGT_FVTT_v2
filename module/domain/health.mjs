/**
 * @file Reading a unit's Health, whichever shape it arrived in.
 * @see docs/06-stats-and-resources.md, docs/23-documents-and-derived-data.md
 *
 * Layer 1 (domain). Pure.
 *
 * There are **two** shapes in this system and both are legitimate:
 *
 *   - a **document** stores `health: { value, max }`;
 *   - a **snapshot** stores `health: <number>` — `snapshotUnit` flattens it to
 *     the current value, because that is all any rule needs.
 *
 * Six rules files read `unit.health.value` directly, which is correct against a
 * document and silently wrong against a snapshot: `.value` comes out
 * `undefined`, the `?? 0` beside it turns that into zero, and the comparison
 * then fails in whichever direction zero fails.
 *
 * The consequences were not small. `cannotPay` refused **every Noble Phantasm
 * ever attempted**, because a Master's health read as 0 and the comparison is
 * strictly greater. `mayOrderAnotherServant` refused every second Servant, for
 * the same reason and with the opposite sign. Neither showed up in the unit
 * tests, because every fixture used the document shape — so the code and the
 * tests agreed with each other and not with the system.
 *
 * `null` means intrinsically undamageable rather than dead (Pale Rider, the
 * Kagome Spirits), and is the one case a caller must distinguish itself.
 */

/**
 * A unit's current Health.
 *
 * @param {object|null} unit either a snapshot or a document's system data
 * @param {number} [fallback] what an absent or null resource reads as
 * @returns {number}
 */
export function currentHealth(unit, fallback = 0) {
  const health = unit?.health;
  if (health === null || health === undefined) return fallback;
  if (typeof health === "number") return health;
  return health.value ?? fallback;
}

/**
 * A unit's maximum Health.
 *
 * A snapshot flattens `health` to the current value and keeps the maximum
 * separately, so this looks in both places rather than assuming either.
 *
 * @param {object|null} unit
 * @param {number} [fallback]
 * @returns {number}
 */
export function maxHealth(unit, fallback = 0) {
  const health = unit?.health;
  if (health && typeof health === "object" && health.max !== undefined && health.max !== null) {
    return health.max;
  }
  return unit?.healthMax ?? unit?.maxHealth ?? fallback;
}

/**
 * Is this unit intrinsically undamageable?
 *
 * `null` health is not zero health: one cannot be hurt at all, the other is
 * about to be defeated, and a check that conflates them defeats Pale Rider.
 *
 * @param {object|null} unit
 * @returns {boolean}
 */
export function isUndamageable(unit) {
  return unit?.health === null;
}
