/**
 * @file The groups of Servants a sheet names without an Attribute for them.
 * @see docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md readings 2, 3
 *
 * Layer 2 (rules). Pure.
 *
 * No Attribute marks them. Rapture's sheet is the one list: *"Note- Sakura Five:
 * Passionlip, Meltryllis, Kazuradrop, Violet, Kingprotea"*, and Hakuno's and
 * Rapture's own clauses read the same words as Kazuradrop's. BB is a True Name,
 * which `BB.md` and `BB Pele.md` both print. By True Name, as Gilles de Rais
 * (Saber)'s *"allied Jeanne d'Arc"* is (`rules/named-units.mjs`), so a summer form
 * belongs with its original. Violet has no sheet yet and stays a name until built.
 */

import { trueNameSlug } from "./named-units.mjs";

/** Each group, by True Name slug. */
export const UNIT_GROUPS = Object.freeze({
  bb: Object.freeze(["bb"]),
  sakuraFive: Object.freeze(["passionlip", "meltryllis", "kazuradrop", "violet", "kingprotea"]),
});

/**
 * The groups a Unit belongs to.
 *
 * @param {object|null|undefined} unit a board unit
 * @returns {string[]}
 */
export function groupsOf(unit) {
  if (unit?.kind !== "servant") return [];
  const slug = trueNameSlug(unit.trueName);
  if (!slug) return [];
  return Object.keys(UNIT_GROUPS).filter((g) => UNIT_GROUPS[g].includes(slug));
}
