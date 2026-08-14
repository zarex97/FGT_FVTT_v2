/**
 * @file The current board, and the faction roster it is read against.
 * @see docs/03-domain-overview.md §3.4
 *
 * Layer 3. Four call sites were each building a board snapshot from the canvas
 * with their own idea of which settings to include, and **not one of them passed
 * `alliances`** — so `relationOf` saw an empty map and every faction was an
 * island. That is one builder now.
 */

import { snapshotBoard } from "../rules/snapshot.mjs";
import { normalizeFactions, alliancesOf, factionChoices, factionForUser } from "../rules/factions.mjs";

/** The world setting the roster lives in. */
export const FACTIONS_SETTING = "factions";

/**
 * The faction roster, normalized.
 * @returns {import("../rules/factions.mjs").Faction[]}
 */
export function factions() {
  try {
    return normalizeFactions(game.settings.get("fgt", FACTIONS_SETTING));
  } catch {
    // Before `init` completes, or in a world where the setting was never
    // written. An empty roster is a legal state, not an error.
    return [];
  }
}

/**
 * Write the roster back. GM only — the settings menu is the only caller.
 * @param {object[]} list
 * @returns {Promise<void>}
 */
export async function setFactions(list) {
  await game.settings.set("fgt", FACTIONS_SETTING, normalizeFactions(list));
  Hooks.callAll("fgtFactionsChanged", factions());
}

/**
 * @param {string} id
 * @returns {import("../rules/factions.mjs").Faction|null}
 */
export function faction(id) {
  return factions().find((f) => f.id === id) ?? null;
}

/**
 * The `{id: name}` map a `<select>` wants.
 * @returns {Record<string, string>}
 */
export function choices() {
  return factionChoices(factions());
}

/**
 * The faction a user has been assigned, if any.
 * @param {string} [userId]
 * @returns {import("../rules/factions.mjs").Faction|null}
 */
export function factionOfUser(userId = game.user.id) {
  return factionForUser(factions(), userId);
}

/**
 * Snapshot the board as it currently stands.
 *
 * @param {object} [overrides] extra `settings` for the snapshot
 * @returns {object}
 */
export function currentBoard(overrides = {}) {
  const combat = game.combats?.active ?? null;
  return snapshotBoard({
    scene: canvas?.scene,
    actors: (canvas?.tokens?.placeables ?? []).map((t) => ({ actor: t.actor, token: t.document })),
    settings: {
      boardSize: setting("boardSize", 13),
      turnsPerRound: setting("turnsPerRound", 3),
      alliances: alliancesOf(factions()),
      round: combat?.round ?? 1,
      tick: combat?.system?.globalTurn ?? 0,
      phase: combat?.system?.phase ?? "day",
      // Seeded on the turn index so a replayed resolution picks the same
      // random targets as the original.
      seed: combat?.system?.globalTurn ?? 0,
      ...overrides,
    },
  });
}

/**
 * @param {string} key
 * @param {unknown} fallback
 * @returns {unknown}
 */
function setting(key, fallback) {
  try {
    return game.settings.get("fgt", key) ?? fallback;
  } catch {
    return fallback;
  }
}
