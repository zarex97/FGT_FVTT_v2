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
  return snapshotUnit(actor, {
    token: doc, panel: panelOf(doc), tick: currentTick(), round: currentRound(),
    ownerUserId: ownerUserOf(actor),
    // The war's Region, so a sheet opened with no board built still shows the
    // Ranks the rules are actually using. `snapshotBoard` runs the same applier
    // and it refuses to fire twice, so handing this snapshot to a board is
    // safe. Resolved the same way `currentBoard` resolves it, from the match
    // first and the world setting second.
    warRegion: currentWarRegion(),
  });
}

/**
 * The Region this war is being fought in.
 *
 * @returns {string|null}
 */
export function currentWarRegion() {
  try {
    return game.combat?.system?.region || setting("region", null) || null;
  } catch {
    return null;
  }
}

/**
 * The player who owns this actor, or `null` for a GM-run one.
 *
 * Resolved here rather than in the projection because it needs the user list,
 * and `rules/` may not touch `game` (§3.6). Charm is what makes it matter:
 * `rules/control.mjs#controllerOf` has read `unit.ownerUserId` since the file
 * was written and **nothing ever projected it**, so every unit answered
 * `undefined` and the whole control map collapsed to the GM.
 *
 * Gamemasters are skipped deliberately. `Actor#ownership` grants a GM `OWNER`
 * on everything, so "the first owner" would name a Gamemaster for every unit
 * in the world and a charm could never move control off one.
 *
 * The ownership RECORD, not `Actor#isOwner` — the latter answers for whoever
 * is asking, which would give two players different board snapshots of the
 * same match.
 *
 * @param {object} actor
 * @returns {string|null}
 */
function ownerUserOf(actor) {
  const OWNER = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const ownership = actor?.ownership ?? {};
  for (const user of game?.users ?? []) {
    if (user.isGM) continue;
    if ((ownership[user.id] ?? ownership.default ?? 0) >= OWNER) return user.id;
  }
  return null;
}

/**
 * The Round a round state must carry to still be in force.
 *
 * `null` out of combat, for the same reason `currentTick` is: with no Rounds
 * there is nothing for the record to be stale against.
 *
 * @returns {number|null}
 */
export function currentRound() {
  const combat = game.combats?.active ?? null;
  if (!combat?.started) return null;
  return combat.round ?? null;
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
 * Not the same thing as `unitSnapshot(actor)`. `snapshotBoard` runs two passes
 * across its units once they all exist, and both answer questions a unit
 * projected alone cannot:
 *
 *   - `annotateZon`, because ZON is a property of the Master-Servant *pair*.
 *     Taking the attacker from the board is what lets pipeline stage 9 and the
 *     Noble Phantasm legality check see the same answer the ZON ring draws.
 *   - `annotateAuras`, because an aura is a property of who is standing near
 *     whom. A unit re-projected here would carry only its own auras and none of
 *     the ones it is standing in, which is the defect Ch. 45 A5 repaired.
 *
 * So: re-projecting a unit that the board already has is not a shortcut, it is
 * a wrong answer.
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
  const scene = canvas?.scene ?? null;
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
      // Terrain areas and home bases, read off the scene's Regions. Until this
      // existed the rules read `board.terrain.areas` and nothing ever filled
      // it, so terrain was correct and permanently empty.
      terrain: { areas: terrainAreasOf(scene) },
      // The war's Region and the Grail live on the match: chosen once at
      // setup, and read by every Servant from that region thereafter.
      //
      // Falling back to the WORLD SETTING, which is where a Region is actually
      // chosen. `MatchData.region` is declared on the schema and **nothing in
      // this system has ever written it** -- no setup flow, no sheet, no API --
      // while `fgt.region` is a registered setting the GM sets and which
      // `engine/summon.mjs` already reads. So `warRegion` was permanently
      // `null` in every world, and everything keyed on it was inert:
      // `annotateRegionBonus` (§5.6's Region Parameter grants, a core rule),
      // `regionScale` (the Hanging Gardens' Construction multiplier) and
      // Asterios's *"if the Region is Greece, it affects an 11x11 panel area
      // instead"*.
      //
      // The match field stays first because a per-match override is the right
      // shape once something writes one; the setting is the default rather than
      // a replacement.
      // Optional rules the table has switched off (§8.3 clause 4 today).
      rules: { masterProtection: setting("masterProtection", true) !== false },
      warRegion: currentWarRegion(),
      difficulty: combat?.system?.difficulty ?? "intermediate",
      grail: {
        threshold: combat?.system?.grailThreshold ?? 9,
        defeatedCount: combat?.system?.grailCounter ?? 0,
        materialized: Boolean(combat?.system?.grailMaterialized),
        destroyed: Boolean(combat?.system?.grailDestroyed),
        position: combat?.system?.grailPosition ?? null,
        contest: combat?.system?.grailContest ?? {},
      },
      zones: homeBaseZonesOf(scene),
      // Bounded fields (Ch. 43). Regions again, for the same reasons terrain
      // uses them: native membership, native enter/exit, and an area that may
      // be any shape at all.
      fields: boundedFieldsOf(scene),
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

/**
 * Terrain areas from the scene's Regions.
 *
 * A Region is the right carrier: membership is native, the enter/exit events
 * are native, and a terrain area *"may be non-contiguous"* — which a Region
 * already is.
 *
 * @param {object|null} scene
 * @returns {Array<{id: string, type: string, panels: object[]}>}
 */
function terrainAreasOf(scene) {
  /** @type {Array<{id: string, type: string, panels: object[]}>} */
  const areas = [];
  for (const region of scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "terrain" || behavior.disabled) continue;
      const panels = panelsOfRegion(region);
      for (const type of behavior.system?.types ?? []) {
        areas.push({ id: `${region.id}:${type}`, type, panels, regionId: region.id });
      }
    }
  }
  return areas;
}

/**
 * Home-base zones from the scene's Regions.
 *
 * Keyed by region id rather than by faction, because a faction may own more
 * than one: Semiramis's Hanging Gardens *"counts as a second Home Base"*.
 *
 * @param {object|null} scene
 * @returns {Record<string, {faction: string, panels: object[], secondary: boolean}>}
 */
function homeBaseZonesOf(scene) {
  /** @type {Record<string, object>} */
  const zones = {};
  for (const region of scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "homeBase" || behavior.disabled) continue;
      zones[region.id] = {
        faction: behavior.system?.factionId ?? null,
        panels: panelsOfRegion(region),
        secondary: Boolean(behavior.system?.isSecondary),
      };
    }
  }
  return zones;
}

/**
 * Every grid offset a Region covers.
 *
 * @param {object} region
 * @returns {Array<{i: number, j: number}>}
 */
function panelsOfRegion(region) {
  const grid = canvas?.grid;
  if (!grid) return [];
  // Foundry can answer this directly for a Region; the manual sweep below is
  // the fallback for a shape it cannot enumerate.
  if (typeof region.getOccupiedGridSpaceOffsets === "function") {
    const offsets = region.getOccupiedGridSpaceOffsets();
    if (offsets?.length) return offsets.map((o) => ({ i: o.i, j: o.j }));
  }
  const bounds = region.bounds;
  if (!bounds) return [];
  /** @type {Array<{i: number, j: number}>} */
  const panels = [];
  const topLeft = grid.getOffset({ x: bounds.x, y: bounds.y });
  const bottomRight = grid.getOffset({ x: bounds.right, y: bounds.bottom });
  // `RegionDocument#testPoint` is a real method in v14 but always answers
  // `false` -- containment lives on the canvas PLACEABLE (`region.object`),
  // not the document. Found live setting up a Home Base region for Semiramis's
  // Hanging Gardens: every panel swept out, so `inOwnHomeBase` refused a unit
  // standing in the middle of its own Region.
  const tester = region.object?.testPoint?.bind(region.object) ?? region.testPoint?.bind(region);
  for (let i = topLeft.i; i <= bottomRight.i; i++) {
    for (let j = topLeft.j; j <= bottomRight.j; j++) {
      const centre = grid.getCenterPoint({ i, j });
      if (tester?.(centre) !== false) panels.push({ i, j });
    }
  }
  return panels;
}

/**
 * Bounded fields from the scene's Regions.
 *
 * The behaviour carries the six axes; the Region carries the panels. A field
 * whose geometry is `freeform` or `markDefined` was drawn by a player or fixed
 * by its marks, so its panels come from the Region rather than a shape spec.
 *
 * @param {object|null} scene
 * @returns {object[]}
 */
function boundedFieldsOf(scene) {
  /** @type {object[]} */
  const out = [];
  for (const region of scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "npField" || behavior.disabled) continue;
      const sys = behavior.system ?? {};
      out.push({
        id: sys.fieldId,
        ownerId: sys.ownerUnitId ?? null,
        ownerMasterId: sys.ownerMasterId ?? null,
        ownerFaction: sys.ownerFaction ?? null,
        npTags: sys.npTags ?? [],
        geometry: sys.geometry ?? null,
        membership: sys.membership ?? null,
        isolation: sys.isolation ?? null,
        interior: sys.interior ?? [],
        interiorEvents: sys.interiorEvents ?? [],
        expiry: sys.expiry ?? null,
        lastExtendedAt: sys.lastExtendedAt ?? null,
        extension: sys.extension ?? null,
        vulnerabilities: sys.vulnerabilities ?? [],
        duration: sys.duration ?? null,
        upkeep: sys.upkeep ?? null,
        deactivation: sys.deactivation ?? null,
        passive: Boolean(sys.passive),
        createdAt: sys.createdAt ?? null,
        lastUpkeepAt: sys.state?.lastUpkeepAt ?? null,
        state: sys.state ?? { escapeHistory: {} },
        panels: panelsOfRegion(region),
        regionId: region.id,
      });
    }
  }
  return out;
}
