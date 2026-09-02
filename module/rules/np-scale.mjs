/**
 * @file The Noble Phantasm scale, and comparisons against it.
 * @see docs/43-bounded-fields.md §43.8, docs/41-open-questions.md Q44
 *
 * Layer 2 (rules). Pure, and deliberately tiny.
 *
 * Split out of `bounded-fields.mjs` because two modules on opposite sides of an
 * import edge both need it: the fields themselves (a vulnerability keyed on
 * *"an [Anti-World] NP or higher"*) and `options.mjs` (the `attack:npScale:gte`
 * ladder a predicate tests). `bounded-fields.mjs` imports `options.mjs` for its
 * per-unit interior predicates, so leaving the scale there would make the two
 * files import each other.
 */

/**
 * The ordered scale, ascending.
 *
 * "Anti-World or higher" and "Anti-Fortress or higher" are comparisons, so the
 * tags cannot be a flat vocabulary. Ch. 41 Q44 records that this ordering is a
 * construction from conventional usage rather than a stated rule.
 */
export const NP_TAG_SCALE = Object.freeze([
  "antiUnit", "antiArmy", "antiFortress", "antiCountry", "antiWorld",
]);

/**
 * Qualifiers that do **not** participate in the comparison.
 *
 * Listed rather than inferred, so a new tag is a deliberate decision about
 * which kind it is instead of an accident of not appearing in the scale.
 */
export const NP_TAG_QUALIFIERS = Object.freeze([
  "antiDivine", "antiBeast", "antiUnitSelf", "barrier", "fortress",
  "labyrinth", "counter", "boundedField", "unknown",
]);

/**
 * The highest scale an NP's tags reach, or `-1` for none.
 *
 * Ozymandias's is `[Anti-Fortress/Fortress/Anti-Unit]`; the comparison uses
 * Anti-Fortress, not the Anti-Unit it also carries.
 *
 * @param {string[]} tags
 * @returns {number}
 */
export function scaleOf(tags) {
  let best = -1;
  for (const t of tags ?? []) best = Math.max(best, NP_TAG_SCALE.indexOf(t));
  return best;
}

/**
 * The scale's own id at that height, or `null`.
 *
 * The ladder `options.mjs` emits needs the NAME rather than the index, because
 * a predicate is a set-membership test on strings.
 *
 * @param {string[]} tags
 * @returns {string|null}
 */
export function scaleTagOf(tags) {
  const index = scaleOf(tags);
  return index === -1 ? null : NP_TAG_SCALE[index];
}

/**
 * Does this Noble Phantasm reach the required scale?
 *
 * `???` sorts as unknown and **never** satisfies a threshold: the field's check
 * surfaces a prompt for the GM rather than silently deciding either way.
 *
 * @param {string[]} npTags
 * @param {string} required
 * @returns {boolean}
 */
export function meetsTagThreshold(npTags, required) {
  const needed = NP_TAG_SCALE.indexOf(required);
  if (needed === -1) return false;
  return scaleOf(npTags) >= needed;
}
