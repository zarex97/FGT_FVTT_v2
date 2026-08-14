/**
 * @file The faction roster, and the alliance graph derived from it.
 * @see docs/04-units.md §4.10, docs/16-relationships.md
 *
 * Layer 2 (rules). Pure: it takes the roster as an argument and returns the
 * shapes the resolver wants. The GM edits it through a settings menu; the world
 * setting is the only place it is stored.
 *
 * A faction is an **id plus a display name**, not a free-text label. Two units
 * whose faction strings differ by a typo are enemies, silently and
 * irrecoverably, which is exactly the kind of failure a tactical game must not
 * have.
 *
 * Alliances are **symmetric and reflexive**, and this module enforces both
 * rather than trusting the stored data: a roster in which red allies blue but
 * blue does not ally red is a roster someone edited halfway, and the safe
 * reading of a half-finished edit is the one where nobody is surprised by an
 * attack from an ally.
 */

/**
 * @typedef {object} Faction
 * @property {string} id stable, machine-generated, never edited
 * @property {string} name what the GM typed
 * @property {string} color a CSS colour for the board and the HUD
 * @property {string|null} userId the player who controls it, if assigned
 * @property {string[]} allies other faction ids
 */

/** The colours offered when creating a faction, in order. */
export const FACTION_COLORS = Object.freeze([
  "#c0392b", "#2980b9", "#27ae60", "#8e44ad",
  "#d35400", "#16a085", "#f39c12", "#2c3e50",
]);

/**
 * Normalize a stored roster: drop malformed entries, fill defaults, and make
 * the alliance graph symmetric and reflexive.
 *
 * @param {unknown} raw the stored setting
 * @returns {Faction[]}
 */
export function normalizeFactions(raw) {
  const list = Array.isArray(raw) ? raw : [];
  /** @type {Faction[]} */
  const factions = [];
  const seen = new Set();

  for (const [index, entry] of list.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const id = String(entry.id ?? "").trim();
    // An entry with no id cannot be referenced by an actor, so it is not a
    // faction -- it is a partially-typed row that should not survive a reload.
    if (!id || seen.has(id)) continue;
    seen.add(id);

    factions.push({
      id,
      name: String(entry.name ?? id),
      color: String(entry.color ?? FACTION_COLORS[index % FACTION_COLORS.length]),
      userId: entry.userId ? String(entry.userId) : null,
      allies: [...new Set((entry.allies ?? []).map(String))].filter((a) => a !== id),
    });
  }

  // Drop allies that name a faction which no longer exists, then symmetrize.
  const ids = new Set(factions.map((f) => f.id));
  for (const faction of factions) faction.allies = faction.allies.filter((a) => ids.has(a));
  for (const faction of factions) {
    for (const ally of faction.allies) {
      const other = factions.find((f) => f.id === ally);
      if (other && !other.allies.includes(faction.id)) other.allies.push(faction.id);
    }
  }

  return factions;
}

/**
 * The alliance map the board snapshot carries: faction id → every id it counts
 * as an ally, **including itself**.
 *
 * `relationOf` reads this. Without it every faction is an island, which is the
 * correct default — a faction with no declared allies has none — but it means
 * the map must always contain the faction itself or a unit would be an enemy of
 * its own side.
 *
 * @param {Faction[]} factions a normalized roster
 * @returns {Record<string, string[]>}
 */
export function alliancesOf(factions) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const faction of factions) out[faction.id] = [faction.id, ...faction.allies];
  return out;
}

/**
 * Options for a `<select>`, as `selectOptions` wants them.
 *
 * @param {Faction[]} factions
 * @returns {Record<string, string>}
 */
export function factionChoices(factions) {
  return Object.fromEntries(factions.map((f) => [f.id, f.name]));
}

/**
 * A new faction, with an id derived from the name and made unique.
 *
 * The id is generated rather than typed because it is what every actor stores:
 * renaming a faction must not orphan the units in it, so the name is free to
 * change and the id never does.
 *
 * @param {string} name
 * @param {Faction[]} existing
 * @returns {Faction}
 */
export function createFaction(name, existing = []) {
  const base = String(name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const stem = base || "faction";
  const taken = new Set(existing.map((f) => f.id));

  let id = stem;
  for (let n = 2; taken.has(id); n++) id = `${stem}-${n}`;

  return {
    id,
    name: String(name ?? "").trim() || id,
    color: FACTION_COLORS[existing.length % FACTION_COLORS.length],
    userId: null,
    allies: [],
  };
}

/**
 * Which faction a user controls, if any.
 *
 * @param {Faction[]} factions
 * @param {string} userId
 * @returns {Faction|null}
 */
export function factionForUser(factions, userId) {
  return factions.find((f) => f.userId === userId) ?? null;
}
