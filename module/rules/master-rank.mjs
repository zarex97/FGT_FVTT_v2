/**
 * @file A Master's rank, and what it buys.
 * @see docs/04-units.md §4.5, docs/15-abilities.md §15.4, docs/17-command-spells.md
 *
 * Layer 2. Pure.
 *
 * The stored value is a LETTER (Ch. 04: Masters are A–D) because that is what a
 * character sheet prints. Every rule in the corpus asks a coarser question —
 * High, Low, or Rankless — so the tier is derived here, once, rather than by
 * each reader parsing the grade for itself. Two copies of that parse already
 * existed, in `rules/costs.mjs` and `rules/command-spells.mjs`, and this
 * replaces both without changing what either decides.
 *
 * `paysHighColumn` and `isHighRank` look like the same predicate and are not.
 * A **Rankless** Master pays the cheaper Noble Phantasm price — Ch. 15 §15.4:
 * *"Rankless Masters use the left column"*, because the right column is the Low
 * Rank penalty rather than the default — while earning none of a High Rank
 * Master's benefits. Collapsing them would either overcharge every Rankless
 * Master or hand them a ZON they have not earned.
 */

import { Rank } from "../domain/rank.mjs";

/** The grades that count as High Rank (Ch. 04 §4.5). */
export const HIGH_GRADES = Object.freeze(["A", "B"]);

/**
 * Which tier this Master belongs to.
 *
 * An absent, blank or unparseable rank is **Rankless**, which is a real state
 * with rules of its own rather than a missing value — Ch. 17 prices a table on
 * which every Master is Rankless differently from one that merely has not been
 * filled in.
 *
 * @param {object|null|undefined} master a Master's `system` or unit snapshot
 * @returns {"high"|"low"|"rankless"}
 */
export function tierOf(master) {
  // `Rank.parseOrNull` does NOT return null for everything it cannot parse: it
  // handles `null`, blank and the unranked dash, and THROWS on anything else
  // (`RangeError: Cannot parse rank "Rank A"`). Both cost readers call it bare,
  // so a Master whose rank is junk -- hand-edited, carried over from an older
  // schema, written by a module -- crashes `npCostAt` rather than being priced.
  //
  // Unparseable is treated as Rankless, which is the safe direction and the
  // same answer blank already gives. This cannot change a working outcome,
  // because the only inputs it newly accepts are ones that used to throw.
  try {
    const rank = Rank.parseOrNull(master?.rank ?? null);
    if (!rank) return "rankless";
    return HIGH_GRADES.includes(rank.grade) ? "high" : "low";
  } catch {
    return "rankless";
  }
}

/** @param {object|null|undefined} master @returns {boolean} */
export function isHighRank(master) {
  return tierOf(master) === "high";
}

/** @param {object|null|undefined} master @returns {boolean} */
export function isRankless(master) {
  return tierOf(master) === "rankless";
}

/**
 * Whether this Master pays the LEFT (cheaper) column.
 *
 * High and Rankless both do. This is exactly the behaviour the two cost readers
 * already had; it is moved here, not changed. See the file header for why it is
 * a separate function from {@link isHighRank}.
 *
 * @param {object|null|undefined} master
 * @returns {boolean}
 */
export function paysHighColumn(master) {
  return tierOf(master) !== "low";
}

/**
 * How many parameter steps this Master may grant its Servant at summon.
 *
 * *"High Rank Masters additionally grant … a free `+` to one of their Servant's
 * Parameters"* (Ch. 04 §4.5). The summon dialog has always offered the CHOICE
 * of which parameter; this is the allowance it spends against, which nothing
 * enforced — so a GM could type any number into any row and `prepareSummon`
 * would honour it.
 *
 * @param {object|null|undefined} master
 * @returns {number}
 */
export function grantBudget(master) {
  return isHighRank(master) ? 1 : 0;
}
