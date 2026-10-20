/**
 * @file Classic and Revised: the two texts a shared Skill can carry, and which one a War plays.
 * @see CONTEXT.md (Classic and Revised), docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md reading 3
 *
 * Layer 1: pure data. The game's author is testing new wordings of three shared
 * Skills (#260 reading 3, ruled 2026-10-20). Each War picks one text for every
 * bearer, or *As printed*, which lets each sheet's own text stand:
 *
 *   Mad Enhancement      Revised clause 5: the mode locks when the Master falls, and
 *                        Sustainability loses 1 more at every Turn's end (no 2◈ at the
 *                        death); Revised clause 7: Skill Seal ends it at once
 *                        (Gilles de Rais (Saber), Darius III)
 *   Divinity             Revised: the flat bonus is Fixed Divine Damage, outside the
 *                        Injury count (Arjuna, Proto Gil, Cú Chulainn, Iskandar)
 *   Presence Concealment Revised clause 8: Skill Seal ends it at once (Hundred-Faced
 *                        Hassan, Sasaki)
 *
 * A bearer says which text ITS sheet prints with `printedRevision` on the
 * ability; the template's default is `classic`, the text most sheets print.
 */

/** The values a revision War Rule takes. */
export const REVISION_CHOICES = Object.freeze(["classic", "revised", "asPrinted"]);

/** The two texts. */
export const REVISIONS = Object.freeze(["classic", "revised"]);

/**
 * Each revisable Skill, by the slug every bearer's ability carries, and the War
 * Rule that picks its text.
 */
export const REVISION_RULES = Object.freeze({
  madEnhancement: "madEnhancementRevision",
  divinity: "divinityRevision",
  presenceConcealment: "presenceConcealmentRevision",
});

/** @param {string|null|undefined} slug @returns {boolean} */
export function isRevisable(slug) {
  return Boolean(slug) && Object.hasOwn(REVISION_RULES, slug);
}

/**
 * The text a bearer plays: the War's pick, or its own sheet's under *As printed*.
 *
 * An unknown or missing rule value is the published default, Revised (#260
 * reading 3c): the caller had no War to ask, and the next War would be Revised.
 * An unknown printed value is Classic, the text most sheets print.
 *
 * @param {string|null|undefined} printed the bearer's `printedRevision`
 * @param {string|null|undefined} ruleValue the War Rule's value
 * @returns {"classic"|"revised"}
 */
export function effectiveRevision(printed, ruleValue) {
  const rule = REVISION_CHOICES.includes(ruleValue) ? ruleValue : "revised";
  if (rule !== "asPrinted") return /** @type {"classic"|"revised"} */ (rule);
  return printed === "revised" ? "revised" : "classic";
}

/**
 * The text this ability plays in a War, or `null` for an ability that is not a
 * revisable Skill.
 *
 * @param {{slug?: string|null, printedRevision?: string|null}|null} ability a projected ability or an item's `system`
 * @param {Record<string, unknown>|null|undefined} rules the War's revision rules by slug (`board.rules.revisions`)
 * @returns {"classic"|"revised"|null}
 */
export function revisionOf(ability, rules) {
  const slug = ability?.slug ?? null;
  if (!isRevisable(slug)) return null;
  return effectiveRevision(ability?.printedRevision ?? null, /** @type {string|undefined} */ (rules?.[slug]));
}
