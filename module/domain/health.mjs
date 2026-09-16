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

/**
 * Lower a resource's ceiling, taking its current value down only if it would
 * otherwise sit above it.
 *
 * > *"For every Nameless Forest Counter on a Unit, reduce its Max Health by
 * > 25 … and Max Luck by 1."*
 *
 * A Unit at full Health must not end up above its own maximum; a WOUNDED one
 * must not be healed on the way down. So the current value is clamped to the
 * new ceiling rather than moved by the same delta: 1000/1000 becomes 975/975,
 * and 400/1000 becomes 400/975.
 *
 * @param {{value: number, max: number}} pool
 * @param {number} delta signed, applied to the ceiling
 * @returns {{value: number, max: number}}
 */
export function clampToMax(pool, delta) {
  const max = Math.max(0, (pool?.max ?? 0) + delta);
  return { value: Math.min(pool?.value ?? 0, max), max };
}

/**
 * A Servant's maximum Health, from its END parameter.
 *
 * > *"END: E => 500, D => 750, C => 1000, B => 1250, A => 1500, EX => 2000.
 * > For every + or - added to the Servant's END increase or decrease that
 * > Servant's corresponding Base Health by 100."*
 *
 * **The table beats the sheet**, the same way `baseAttackFor`'s does and for
 * the same reason: a Servant is played with the figure its END derives, not the
 * one somebody wrote down. Four of the reference sheets disagree and every one
 * of them disagrees *downward* — Asterios, Castor and Pollux print 1500 against
 * A++'s 1700, Penthesilea prints 1250 against B+'s 1350 — so honouring the
 * authored number meant three of the sturdiest Servants in the game were played
 * two hundred Health short of what their own END grants.
 *
 * The authored figure survives only where there is no parameter to derive
 * **from**: summons and platforms state Base Health outright and carry no END
 * rank at all, which is the same escape `baseAttackFor` leaves them.
 *
 * `undamageable` is a different question and is answered before this is called:
 * `null` means *cannot be damaged* (Pale Rider, the Kagome Spirits), not *has
 * not been given a number*, and deriving one from the table would give him a
 * Health bar his sheet spells `—`.
 *
 * Granted steps fold in by moving the **rank**, which is the operation an
 * innate step performs and the one `baseAttackFor` applies to the same input.
 *
 * @param {object} sheet a Servant's system data
 * @param {(table: string, rank: object) => unknown} lookup the table reader
 * @param {object} Rank the rank algebra (injected, so this stays layer 1 pure)
 * @returns {number}
 */
export function maxHealthFor(sheet, lookup, Rank) {
  const rank = Rank.parseOrNull(sheet?.parameters?.end ?? null);
  const granted = sheet?.grantedSteps?.end ?? 0;
  const derived = rank
    ? lookup("baseHealthByEnd", granted ? Rank.of(rank.grade, rank.steps + granted) : rank)
    : null;
  if (typeof derived === "number") return derived;
  return sheet?.baseHealth ?? 0;
}
