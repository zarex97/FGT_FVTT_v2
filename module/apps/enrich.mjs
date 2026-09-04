/**
 * @file Turning authored prose into rendered prose.
 * @see docs/29-user-interface.md §29.2, docs/37-content-pipeline.md §37.8
 *
 * Layer 4. The ONE place this system calls `enrichHTML`, which until now it
 * never did anywhere — so a `@UUID` link written into a description rendered
 * as literal text, and no rules term in the game was clickable.
 *
 * Separated from the sheets because "which fields get enriched" is a decision
 * worth testing, and because `enrichHTML` is async while Handlebars is not:
 * enrichment has to happen in `_prepareContext`, never in a helper.
 */

/**
 * Enrich one piece of prose.
 *
 * `rolls: false` is deliberate. This system resolves every die through the
 * engine, and an inline `[[/r]]` in a description would open a second path to
 * a roll that no rule agrees with.
 *
 * @param {string|null|undefined} text
 * @returns {Promise<string>}
 */
export async function enrichText(text) {
  if (!text) return "";
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(String(text), {
    documents: true,
    links: true,
    rolls: false,
  });
}

/**
 * Enrich every ability card's description, in place.
 *
 * Takes the whole group object `abilitiesContext` returns rather than one
 * array, so a new group added there is covered without a second edit here.
 * Non-array members are skipped: `anyAbilities` is a boolean.
 *
 * @param {object|null} groups
 * @returns {Promise<void>}
 */
export async function enrichAbilityCards(groups) {
  if (!groups) return;
  for (const group of Object.values(groups)) {
    if (!Array.isArray(group)) continue;
    for (const card of group) card.description = await enrichText(card.description);
  }
}
