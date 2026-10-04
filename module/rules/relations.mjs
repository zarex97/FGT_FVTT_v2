/**
 * @file How one Unit sees another.
 * @see docs/20-targeting.md, docs/32-relationships.md
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
 * The side a Unit is on: its charmer's while it is charmed, its own otherwise.
 *
 * Ruled 2026-10-04 (#180): *"The Unit is controlled by the inflicter's Faction
 * for the duration"* makes a charmed Unit the charmer's ALLY and its own
 * Faction's ENEMY, for every rule at once -- one relation per pair. So
 * Contagion and Innocent World (*"enemy Units"*) skip a Unit Pale Rider has
 * charmed, a Kagome Spirit's chase lifts, Doomsday Come lets it out, it guards
 * nobody, and its own side may attack it. `actingFactionId` is the charm chain
 * `rules/control.mjs#annotateControl` already settles on the board, before the
 * field and aura passes read any relation; a Unit projected alone has none and
 * reads its own faction.
 *
 * @param {object|null} unit
 * @returns {string|null}
 */
export function sideOf(unit) {
  return unit?.actingFactionId ?? unit?.faction ?? unit?.factionId ?? null;
}

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

  const mine = sideOf(source);
  const theirs = sideOf(unit);
  const allied = board?.alliances?.[mine]?.includes(theirs) ?? theirs === mine;
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
 * relationship rules (Ch. 32).
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
  const faction = sideOf(master);

  /** @type {object[]} */
  const out = [];
  for (const unit of units) {
    if (unit.kind !== "servant") continue;
    // A defeat leaves the token on the board, and a corpse guards nobody: not
    // the protection, the Counter redirect, the zone denial or the cover that
    // read this list (#168).
    if (unit.defeated) continue;
    // Its SIDE, not its faction: a charmed Servant is its own Master's enemy
    // for the Charm's duration and guards nobody (ruled 2026-10-04, #180).
    if (sideOf(unit) !== faction) continue;

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
