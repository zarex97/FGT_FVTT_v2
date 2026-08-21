/**
 * @file How one Unit sees another.
 * @see docs/09-targeting.md §9.5, docs/16-relationships.md
 *
 * Layer 2 (rules). Pure.
 *
 * Three copies of this existed — in the targeting resolver, in the aura pass,
 * and about to be a fourth for Scáthach's *Primordial Rune*, whose 2d8 table is
 * chosen by whether the target is an ally or an enemy. The aura copy carried a
 * comment explaining why it was not an import: pulling `rules/targeting/resolve`
 * in for three lines would couple the aura pass to the eleven-step resolver's
 * whole module graph.
 *
 * That argument is against importing *the resolver*, not against sharing *the
 * rule*. A module with no dependencies costs nothing to import, and three
 * copies of "who counts as an ally" is three chances for a war with a named
 * alliance to answer differently depending on which one asked.
 */

/**
 * @param {object} source the Unit doing the looking
 * @param {object} unit the Unit being looked at
 * @param {object} board carries `alliances`
 * @returns {"self"|"ally"|"enemy"|"neutral"}
 */
export function relationOf(source, unit, board) {
  if (unit?.id === source?.id) return "self";

  // A Civilian belongs to nobody, and a Unit with no faction has not been
  // assigned one yet — neither is an ally and neither is a legal enemy.
  if (unit?.kind === "civilian" || unit?.faction === null) return "neutral";

  const allied = board?.alliances?.[source?.faction]?.includes(unit?.faction)
    ?? unit?.faction === source?.faction;
  return allied ? "ally" : "enemy";
}

/**
 * Does this relation count as friendly?
 *
 * *"Every allied Unit"* includes the speaker unless the text says otherwise,
 * which is the reading auras take and the reading Scáthach's Primordial Rune
 * takes — she may rune herself.
 *
 * @param {string} relation
 * @returns {boolean}
 */
export function isFriendly(relation) {
  return relation === "ally" || relation === "self";
}
