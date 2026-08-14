/**
 * @file Projecting the live scene into the snapshots the rules layer consumes.
 * @see docs/03-domain-overview.md §3.4, docs/23-documents-and-derived-data.md
 *
 * Layer 3. `module/rules/snapshot.mjs` does the projection and stays pure by
 * taking documents as arguments; this is the one place that knows where those
 * documents come from — `canvas`, `game`, the active scene's grid.
 *
 * It exists because the alternative was every call site building the snapshot
 * itself, and two of them forgot the token. A unit projected without its token
 * has no panel, and a caster with no panel could not reach anything: the attack
 * flow measured every Range from a unit that was nowhere, and reported it as
 * "no legal targets". One helper, used everywhere, is the fix that stays fixed.
 */

import { snapshotUnit, snapshotBoard } from "../rules/snapshot.mjs";

/**
 * The grid the current scene measures in.
 * @returns {object|null}
 */
export function activeGrid() {
  return canvas?.grid ?? canvas?.scene?.grid ?? null;
}

/**
 * The token an actor is standing on in the current scene.
 *
 * `Actor#getActiveTokens` covers both linked and unlinked actors. `actor.token`
 * is the fallback for a synthetic actor whose token is not on the active scene —
 * and is *only* populated in that case, which is why reading it alone left every
 * ordinary linked Servant unplaced.
 *
 * @param {object} actor an `FGTActor`
 * @returns {object|null} a `TokenDocument`
 */
export function tokenFor(actor) {
  if (!actor) return null;
  const active = actor.getActiveTokens?.(false, true) ?? [];
  return active[0] ?? actor.token ?? null;
}

/**
 * Snapshot an actor **as it stands on the board**.
 *
 * @param {object} actor an `FGTActor`
 * @returns {object} a `UnitSnapshot`, with `onBoard: false` when the actor has
 *   no token on the scene
 */
export function unitSnapshot(actor) {
  return snapshotUnit(actor, { token: tokenFor(actor), grid: activeGrid() });
}

/**
 * Snapshot the whole board from the active scene.
 *
 * @param {object} [settings] extra settings merged over the ones read from the
 *   world — the combat's round and tick, mostly
 * @returns {object} a board snapshot
 */
export function boardSnapshot(settings = {}) {
  return snapshotBoard({
    scene: canvas?.scene,
    grid: activeGrid(),
    actors: (canvas?.tokens?.placeables ?? []).map((t) => ({ actor: t.actor, token: t.document })),
    settings: {
      boardSize: setting("boardSize", 13),
      turnsPerRound: setting("turnsPerRound", 3),
      round: game.combat?.round ?? 1,
      tick: game.combat?.system?.globalTurn ?? 0,
      phase: game.combat?.system?.phase ?? "day",
      region: setting("region", null) || null,
      // Seeded so a replayed combat picks the same random targets.
      seed: game.combat?.system?.globalTurn ?? 0,
      ...settings,
    },
  });
}

/**
 * A world setting, or a default when the system has not registered it yet —
 * which happens when a macro reaches for the board before `ready`.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function setting(key, fallback) {
  try {
    return game.settings.get("fgt", key);
  } catch {
    return fallback;
  }
}
