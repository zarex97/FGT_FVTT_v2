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

/**
 * The Units that stand as "this Master's Servant" for the Servant–Master
 * relationship rules (Ch. 16).
 *
 * Ordinarily the Master's own Servants. For a Servant carrying a
 * `RelationshipProxy`, its live bound summons instead — Pale Rider:
 *
 * > *"The following Servant-Master Relationship Rules have no effect between
 * > Pale Rider and its Master; but apply between Kagome Spirits and Pale
 * > Rider's Master (replace 'Servant' with 'Kagome Spirit')."*
 *
 * `RelationshipProxy` has been in the executor table since it was written,
 * emitted into `suppressions`, **read by nothing and authored by nobody**.
 * This is its first reader, and Pale Rider is its first author.
 *
 * The substitution is total: a proxying Servant does **not** protect its own
 * Master, which is the clause's own first half and the reason the Spirits
 * matter tactically at all.
 *
 * @param {object} master
 * @param {object} board
 * @returns {object[]}
 */
export function guardsOf(master, board) {
  const units = board?.units ?? [];
  const faction = master?.factionId ?? master?.faction ?? null;

  /** @type {object[]} */
  const out = [];
  for (const unit of units) {
    if (unit.kind !== "servant") continue;
    if ((unit.factionId ?? unit.faction ?? null) !== faction) continue;

    const proxy = (unit.suppressions ?? [])
      .find((s) => s?.scope === "relationship")?.proxy ?? null;
    if (!proxy) {
      out.push(unit);
      continue;
    }
    if (proxy === "summons") {
      // Its LIVE bound summons: a Spirit that has been torn down with its
      // field, or defeated, guards nobody.
      out.push(...units.filter((u) =>
        u.summonerId === unit.id && u.boundToFieldId && !u.defeated));
    }
  }
  return out;
}
