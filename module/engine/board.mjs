/**
 * @file The current board, and the faction roster it is read against.
 * @see docs/03-domain-overview.md §3.4
 *
 * Layer 3. Four call sites were each building a board snapshot from the canvas
 * with their own idea of which settings to include, and **not one of them passed
 * `alliances`** — so `relationOf` saw an empty map and every faction was an
 * island. That is one builder now.
 */

import { snapshotBoard, snapshotUnit } from "../rules/snapshot.mjs";
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
 * Snapshot one actor, **with its position resolved**.
 *
 * `snapshotUnit` cannot find a token on its own: it is layer 2 and the canvas
 * is a global. Called with a bare actor it therefore places the unit at
 * `{0, 0}` — which is what made every attack report its target out of range,
 * because the attacker was at the origin and the defender was wherever it
 * actually stood.
 *
 * Every caller in the engine and the interface should use this rather than
 * `snapshotUnit` directly.
 *
 * @param {object} actor an `FGTActor`
 * @param {object} [token] the placed token, when the caller already has one
 * @returns {object} a `UnitSnapshot`
 */
export function unitSnapshot(actor, token = null) {
  if (!actor) return null;
  const doc = token ?? activeToken(actor);
  return snapshotUnit(actor, { token: doc, panel: panelOf(doc), tick: currentTick() });
}

/**
 * The ◈ tick a turn state must carry to still be in force.
 *
 * `null` out of combat: with no turns there is nothing for state to be stale
 * against, and a GM arranging the board should not have it silently forgotten.
 *
 * @returns {number|null}
 */
export function currentTick() {
  const combat = game.combats?.active ?? null;
  if (!combat?.started) return null;
  return combat.system?.globalTurn ?? 0;
}

/**
 * The token this actor is standing on, if it is on the current scene.
 *
 * @param {object} actor
 * @returns {object|null} a `TokenDocument`
 */
function activeToken(actor) {
  if (actor.token) return actor.token;
  const placed = actor.getActiveTokens?.(false, true) ?? [];
  if (placed.length > 0) return placed[0];
  return (canvas?.tokens?.placeables ?? []).find((t) => t.actor?.id === actor.id)?.document ?? null;
}

/**
 * A token's top-left grid offset, converted from its pixel position.
 *
 * `getOccupiedGridSpaceOffsets` is preferred and handles multi-panel tokens, so
 * this is only the fallback for a scene where it returns nothing.
 *
 * @param {object|null} doc
 * @returns {object|null}
 */
function panelOf(doc) {
  if (!doc || !canvas?.grid) return null;
  if (typeof doc.getOccupiedGridSpaceOffsets === "function") {
    if (doc.getOccupiedGridSpaceOffsets()?.length) return null; // the snapshot will use it
  }
  const offset = canvas.grid.getOffset({ x: doc.x, y: doc.y });
  return { i: offset.i, j: offset.j };
}

/**
 * One unit **as the board sees it**.
 *
 * Not the same thing as `unitSnapshot(actor)`: `snapshotBoard` runs
 * `annotateZon` across its units once they all exist, because ZON is a property
 * of the Master-Servant *pair* and a unit projected alone cannot know it.
 * Taking the attacker from the board rather than re-projecting it is what lets
 * pipeline stage 9 and the Noble Phantasm legality check see the same answer
 * the ZON ring is drawing.
 *
 * Falls back to a standalone projection for an actor with no token, so a
 * console call still works.
 *
 * @param {object} board a board snapshot
 * @param {object} actor an `FGTActor`
 * @returns {object|null} the unit snapshot
 */
export function unitFrom(board, actor) {
  if (!actor) return null;
  return board?.units?.find((u) => u.id === actor.id) ?? unitSnapshot(actor);
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
    // Pre-resolved, so the board's units carry real panels rather than the
    // origin. `snapshotBoard` cannot do this itself for the same reason
    // `snapshotUnit` cannot.
    actors: (canvas?.tokens?.placeables ?? [])
      .filter((t) => t.actor)
      .map((t) => ({ actor: t.actor, token: t.document, snapshot: unitSnapshot(t.actor, t.document) })),
    settings: {
      boardSize: setting("boardSize", 13),
      turnsPerRound: setting("turnsPerRound", 3),
      alliances: alliancesOf(factions()),
      tickForTurnState: currentTick(),
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
