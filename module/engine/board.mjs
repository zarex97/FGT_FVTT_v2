/**
 * @file The current board, and the faction roster it is read against.
 * @see docs/02-architecture.md
 *
 * Layer 3. Four call sites were each building a board snapshot from the canvas
 * with their own idea of which settings to include, and **not one of them passed
 * `alliances`** — so `relationOf` saw an empty map and every faction was an
 * island. That is one builder now.
 */

import { moment, NO_MOMENT } from "../domain/moment.mjs";
import { snapshotBoard, snapshotUnit, turnStateAt, roundStateAt } from "../rules/snapshot.mjs";
import { normalizeFactions, alliancesOf, factionChoices, factionForUser } from "../rules/factions.mjs";
import { warRule, currentWar, revisionRules } from "./war.mjs";

/**
 * The world setting holding the roster a NEW War starts from. A War holds its
 * own (`MatchData.factions`, a War Rule): two Wars on two scenes have two
 * rosters, and the other table's players are on neither.
 */
export const FACTIONS_SETTING = "factions";

/**
 * The faction roster of a War, normalized: the current War's by default, or
 * the world's default roster when there is no War at all.
 *
 * @param {object|null} [war]
 * @returns {import("../rules/factions.mjs").Faction[]}
 */
export function factions(war = currentWar()) {
  try {
    return normalizeFactions(warRule(FACTIONS_SETTING, war));
  } catch {
    // Before `init` completes. An empty roster is a legal state, not an error.
    return [];
  }
}

/**
 * Write a roster back: onto the War, or onto the world's default roster when
 * there is no War. GM only -- the roster editor is the only caller.
 *
 * @param {object[]} list
 * @param {object|null} [war]
 * @returns {Promise<void>}
 */
export async function setFactions(list, war = currentWar()) {
  const roster = normalizeFactions(list);
  if (war) await war.update({ "system.factions": roster });
  else await game.settings.set("fgt", FACTIONS_SETTING, roster);
  // Re-render anything showing a faction, as the setting's `onChange` does for
  // the world roster: the sheets' selects and the roster editor itself.
  if (war) for (const app of foundry.applications.instances.values()) app.render?.({ force: false });
  Hooks.callAll("fgtFactionsChanged", factions(war), war);
}

/**
 * @param {string} id
 * @param {object|null} [war]
 * @returns {import("../rules/factions.mjs").Faction|null}
 */
export function faction(id, war = currentWar()) {
  return factions(war).find((f) => f.id === id) ?? null;
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
 * A Moment, when the caller names one: a boundary reads the Unit at the Moment
 * that ended, Turn and Round Records alike, rather than at the clock, which has
 * moved on by then (`domain/moment.mjs`). Absent, it is the live Moment.
 *
 * @param {object} actor an `FGTActor`
 * @param {object} [token] the placed token, when the caller already has one
 * @param {{moment?: import("../domain/moment.mjs").Moment}} [at]
 * @returns {object} a `UnitSnapshot`
 */
export function unitSnapshot(actor, token = null, { moment: at = undefined } = {}) {
  if (!actor) return null;
  const doc = token ?? activeToken(actor);
  const { round, tick } = at ?? currentMoment();
  return snapshotUnit(actor, {
    token: doc, panel: panelOf(doc), tick, round,
    // The world's Round length, for a lock or a sustainability counted in ◈.
    // Omitted, the projection assumed three Turns a Round in every world.
    turnsPerRound: warRule("turnsPerRound"),
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
    // The War's own Region (`engine/war.mjs`), `null` included: a War fought
    // in no Region never falls through to anything else, which is what once
    // played a neutral war on Greece ground (`engine/war-setup.mjs`). The same
    // War `currentBoard` reads its type, ruleset and Grail off, so every fact
    // in one snapshot comes from one War. A Region decides every Servant's
    // Ranks and Base Attack (Ch. 46 §46.4-AO).
    //
    // No `started` gate: a war's Region is decided at setup and `commitWar`
    // writes it before the clock exists.
    return warRule("region") || null;
  } catch {
    return null;
  }
}

/**
 * The player who owns this actor, or `null` for a GM-run one.
 *
 * Resolved here rather than in the projection because it needs the user list,
 * and `rules/` may not touch `game` (Ch. 02). Charm is what makes it matter:
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
 * The Moment the active match is at: its Round and the Tick of the match.
 *
 * The one reader of the live clock in this file. {@link NO_MOMENT} out of a
 * started match: with no clock there is nothing for a record to be stale
 * against, and a GM arranging the board should not have it silently forgotten.
 * The current War (`engine/war.mjs#currentWar`), never `game.combat`, which is whichever tracker is on screen.
 *
 * @returns {import("../domain/moment.mjs").Moment}
 */
export function currentMoment() {
  const combat = currentWar();
  if (!combat?.started) return NO_MOMENT;
  return moment(combat.round ?? null, combat.system?.globalTurn ?? 0);
}

/**
 * The Round a round state must carry to still be in force: the live Moment's.
 *
 * @returns {number|null}
 */
export function currentRound() {
  return currentMoment().round;
}

/**
 * Whether a started match is keeping time.
 *
 * The question `currentTick` and `currentRound` both answer with `null`, asked
 * on its own — because the callers that need it are asking whether a *clock
 * exists*, not what it reads, and `tick === null` is an inference rather than
 * an answer.
 *
 * Every duration and cooldown in the game is counted down by the scheduler,
 * and the scheduler only runs inside a started match
 * (`engine/scheduler-hooks.mjs`). Anything that WRITES such a clock has to ask
 * this first, or it writes one that can never run out.
 *
 * @returns {boolean}
 */
export function clockRunning() {
  return Boolean(currentWar()?.started);
}

/**
 * The Tick a turn state must carry to still be in force: the live Moment's.
 *
 * @returns {number|null}
 */
export function currentTick() {
  return currentMoment().tick;
}

/**
 * This actor's Turn Record as it reads right now.
 *
 * The one place that takes the stored record off a document, so the
 * document-to-projection step happens once instead of at each caller. Two
 * callers spelled the staleness comparison out themselves before this existed,
 * and a third -- `io.recordUse` -- spelled it differently, which was the
 * surviving half of #32. That one is absorbed too now: it was also the only
 * hand-roller that WROTE the tick it read, so its copy stamped a use against
 * whichever tracker happened to be on screen.
 *
 * Prefer a board snapshot where one is already in hand; this is for the paths
 * that hold only the actor.
 *
 * @param {object} actor
 * @returns {object} the projected Turn Record
 */
export function turnRecordOf(actor) {
  // `currentTick()`, NOT `game.combat` -- the same hazard `gateContext` and
  // `apps/actor-sheet/sheet.mjs` both record. `game.combat` is the combat being
  // VIEWED, so with any other tracker on screen this projected the stored record
  // against a tick from a different match while `unitSnapshot` and
  // `snapshotBoard` projected it against the right one: one record, two answers,
  // decided by what the GM happened to have open.
  //
  // It also settles the pre-match case in the same direction. `?? 0` blanked a
  // record stamped against any other tick before the clock existed; `null` is
  // `currentTick`'s deliberate "apply no staleness", because a GM arranging the
  // board should not have it silently forgotten.
  return turnStateAt(actor?.system?.turnState, currentTick());
}

/**
 * This actor's Round Record as it reads right now. Beside `turnRecordOf`.
 *
 * @param {object} actor
 * @returns {object} the projected Round Record
 */
export function roundRecordOf(actor) {
  // `currentRound()` rather than the round off the document, for the reason
  // above and for its `started` check: an unstarted Combat reports Round 0, and
  // measuring a stored record against that is measuring it against a clock that
  // is not running.
  return roundStateAt(actor?.system?.roundState, currentRound());
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
 *     the ones it is standing in, which is the defect Ch. 46 A5 repaired.
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
  return unitOf(actor, board);
}

/**
 * THE way engine code looks at a Unit: as the board sees it.
 *
 * A bare `unitSnapshot` carries no auras, no terrain, no ZON and no
 * suppressions -- every one of them a property of who stands where -- and a
 * reader handed one answers silently wrong: Item Construction never reached
 * Medea's own Spells, an entry gate lost its position, a Master's ZON read a
 * Servant's own (Ch. 46 §46.4-JA; Surprises of the `assumed-shape` pattern).
 *
 * `board` is required. Pass the board the resolution already holds -- building
 * one costs ~75 ms against ~4 ms for a lone projection, so this never builds
 * one itself. Pass `null` deliberately, for an actor read with no board at all
 * (a sheet opened outside a scene); the result then says `projectedAlone`.
 * An actor with no token on the board gets a lone projection too, marked the
 * same way.
 *
 * @param {object|string|null} actor an `FGTActor`, or its id
 * @param {object|null} board a board snapshot, or `null` on purpose
 * @returns {object|null} the board's unit, or a lone projection marked `projectedAlone`
 */
export function unitOf(actor, board) {
  if (board === undefined) throw new TypeError("FGT | unitOf needs a board, or null on purpose");
  if (!actor) return null;
  const id = typeof actor === "string" ? actor : actor.id;
  const found = board?.units?.find((u) => u.id === id);
  if (found) return found;
  const doc = typeof actor === "string" ? game.actors?.get(actor) : actor;
  const alone = doc ? unitSnapshot(doc) : null;
  if (alone) alone.projectedAlone = true;
  return alone;
}

/**
 * A Unit's Luck as the board holds it: the number a Luck Check will spend from.
 *
 * A platform whose sheet says *"Luck: Shared with <owner>"* has one pool with its
 * owner (#162), and its own actor's stored `system.luck` is a dead 0 that nothing
 * keeps. The projection carries the shared value on the platform's snapshot
 * (`rules/snapshot.mjs#annotatePlatforms`), so every interface reader asks here
 * and not at `actor.system.luck` (#169). The maximum is the pool's own, which for
 * a sharing platform is its owner's.
 *
 * @param {object|null} board
 * @param {object|null} actor
 * @returns {{value: number, max: number|null}}
 */
export function luckOf(board, actor) {
  const unit = unitFrom(board, actor);
  const pool = unit?.luckFromSummoner ? (game.actors?.get(unit.ownerId) ?? actor) : actor;
  return { value: unit?.luck ?? 0, max: pool?.system?.luck?.max ?? null };
}

/**
 * Snapshot the board as it currently stands.
 *
 * @param {object} [overrides] extra `settings` for the snapshot
 * @returns {object}
 */
/**
 * The Round-gate context every `canUseAbility` call site needs.
 *
 * Ch. 04's gate is arithmetic in Layer 2 (`rules/np-gate.mjs`) and its numbers are
 * world settings, which Layer 2 may not read — so they are fetched here and
 * handed down. Factored into one helper rather than repeated at seven call
 * sites: seven copies of a settings read are seven chances for one of them to
 * drift, and a call site that quietly disagrees with the others is precisely
 * the failure this gate was built to end.
 *
 * `canUseAbility` defaults every one of these to the published constants, so a
 * caller that omits the whole object still gets the rule.
 *
 * @returns {{gates: {round: number, assassinRound: number}, turnsPerRound: number,
 *            turn: number|null, clockRunning: boolean, round: number,
 *            actingFactionId: string|null}}
 */
export function gateContext() {
  return {
    gates: {
      round: warRule("npGateRound"),
      assassinRound: warRule("npGateRoundAssassin"),
    },
    turnsPerRound: warRule("turnsPerRound"),
    // `currentTick`, NOT `game.combat` -- `game.combat` is the combat being
    // VIEWED, so this read the tick of whatever tracker happened to be on
    // screen and disagreed with every other clock reader in the system.
    turn: currentTick(),
    // Whether there is a clock at all. `canUseAbility` refuses outright
    // without one: a use out of a match writes a cooldown nothing will ever
    // count down.
    clockRunning: clockRunning(),
    // The ROUND, for Ch. 04's Noble Phantasm gate. `canUseAbility` defaults it to
    // 1, and the action bar was the one caller that never passed it -- so every
    // Noble Phantasm in the game was measured against Round 1 for the whole
    // match. Its tooltip read "Ready from Round 6 (5 away)" in Round 6: the
    // right gate, the wrong distance, and a button greyed out for ever while
    // the SHEET showed the same ability as available, because `context.mjs`
    // does pass it.
    //
    // Carried here rather than fixed at that one call site, so the omission
    // cannot recur. Every other caller passes the same value explicitly.
    round: currentWar()?.round ?? 1,
    // WHOSE Turn it is, for an ability whose only window is `ownTurn` (#160).
    // `null` before the match has started, or on the GM's own slot, which asks
    // nothing of an ability -- the same answer `canToggleMode` gives. Read off
    // the current War for the reason `round` is.
    actingFactionId: currentWar()?.started ? (currentWar().actingFactionId ?? null) : null,
  };
}

/**
 * The document a Unit's id names: its token's actor first, the world actor
 * only when no token holds it.
 *
 * A summon's token is unlinked (`documents/index.mjs#LINKED_TYPES`), so its
 * actor is a synthetic one with the SAME id as the world statblock it came
 * from, and `game.actors.get(id)` answers the statblock. The Jabberwock healed
 * 1000 -> 745 -> 936 and its card said "Health 1500 (no change)" (#247, live).
 * For a linked token the two are one document.
 *
 * @param {string} unitId
 * @returns {object|null}
 */
export function unitActor(unitId) {
  // Off `globalThis`: a caller with no canvas (a test, a headless check)
  // asks the world actor, and a bare `canvas` there is a ReferenceError.
  const tokens = globalThis.canvas?.tokens;
  const fromToken = tokens?.get?.(unitId)?.actor
    ?? tokens?.placeables?.find?.((t) => t.actor?.id === unitId)?.actor;
  return fromToken ?? globalThis.game?.actors?.get(unitId) ?? null;
}

/**
 * The board as it stands, every Unit projected at one Moment.
 *
 * `overrides.moment` names it: a boundary passes the Moment that ENDED, because
 * by the time a Round's end runs `combat.round` has moved on, and a Unit read at
 * the live Round found its own Round's record stale -- `combatInBaseThisRound`
 * read false and Home Base healed a Master Serenity had just cut down in it
 * (#199). Absent, it is the live Moment. Every other override is a board setting.
 *
 * @param {{moment?: import("../domain/moment.mjs").Moment} & object} [overrides]
 * @returns {object} a `BoardSnapshot`
 */
export function currentBoard(overrides = {}) {
  const { moment: named, ...settingOverrides } = overrides;
  const combat = currentWar();
  const scene = canvas?.scene ?? null;
  const at = named ?? currentMoment();
  return snapshotBoard({
    scene: canvas?.scene,
    // Pre-resolved, so the board's units carry real panels rather than the
    // origin. `snapshotBoard` cannot do this itself for the same reason
    // `snapshotUnit` cannot.
    actors: (canvas?.tokens?.placeables ?? [])
      .filter((t) => t.actor)
      .map((t) => ({ actor: t.actor, token: t.document, snapshot: unitSnapshot(t.actor, t.document, { moment: at }) })),
    settings: {
      boardSize: warRule("boardSize"),
      turnsPerRound: warRule("turnsPerRound"),
      alliances: alliancesOf(factions()),
      tickForTurnState: at.tick,
      // The match's own count where the Moment has none: a match not yet
      // started still has a Round 0 or 1 for Day and Night to read.
      round: at.round ?? combat?.round ?? 1,
      tick: at.tick ?? combat?.system?.globalTurn ?? 0,
      phase: combat?.system?.phase ?? "day",
      // Whose Turn it is (#28). `null` out of combat, which reads as "no Turn
      // gate applies" -- the same answer the GM arranging a scene needs.
      actingFactionId: combat?.actingFactionId ?? null,
      grandOrder: warRule("grandOrder"),
      // Seeded on the turn index so a replayed resolution picks the same
      // random targets as the original.
      seed: at.tick ?? combat?.system?.globalTurn ?? 0,
      // Terrain areas and home bases, read off the scene's Regions. Until this
      // existed the rules read `board.terrain.areas` and nothing ever filled
      // it, so terrain was correct and permanently empty.
      terrain: { areas: terrainAreasOf(scene) },
      // The Scene Levels that are pocket dimensions (#177). Read off the
      // platform ACTORS, because a dimension has no ground footprint and so no
      // token: its passengers are never stamped with its `platformId`.
      dimensionLevels: game.actors
        .filter((a) => a.type === "platform" && a.system?.dimension && a.system?.levelId)
        .map((a) => a.system.levelId),
      // ...and where each one's 5x5 lies (#191 reading 3): the panels a Unit
      // inside may stand on, what a Skill reaching "all Units within the Storm
      // Border" covers, and who is inside, by Level.
      dimensions: game.actors
        .filter((a) => a.type === "platform" && a.system?.dimension && a.system?.levelId && a.system?.submergedFrom)
        .map((a) => ({
          id: a.id,
          contentId: a.system.contentId ?? null,
          ownerId: a.system.ownerId ?? null,
          levelId: a.system.levelId,
          spec: a.system.dimension,
          centre: { i: a.system.submergedFrom.i, j: a.system.submergedFrom.j },
          plan: a.system.resurfacePlan ?? null,
          activatedAt: a.system.activatedAt ?? null,
          factionId: a.system.factionId ?? null,
        })),
      // Optional rules the table has switched off (Ch. 05 clause 4 today).
      rules: {
        masterProtection: warRule("masterProtection", combat) !== false,
        // Ch. 46 §46.4-AN. Read here rather than in `rules/identity.mjs`, which
        // is Layer 2 and has no settings -- the same route `masterProtection`
        // above takes.
        discoverAttemptsPerFaction: warRule("discoverAttemptsPerFaction"),
        // #65 ruling 18: the eight lines, or rows and columns only.
        ridingAttackLines: warRule("ridingAttackLines"),
        // #187 reading 4: what Range makes an Attack "ranged".
        rangedMinimumRange: warRule("rangedMinimumRange"),
        // #260 reading 3: Classic, Revised or As printed, by Skill slug, for
        // `domain/revisions.mjs#revisionOf`.
        revisions: revisionRules(combat),
      },
      // The War's Region, type and ruleset: chosen once at setup and read by
      // every Servant thereafter (`engine/war.mjs`).
      warRegion: currentWarRegion(),
      warType: warRule("warType", combat),
      ruleset: warRule("ruleset", combat),
      drawPolicy: warRule("drawPolicy", combat),
      homeBaseDepth: combat?.system?.homeBaseDepth ?? 3,
      difficulty: warRule("difficulty", combat),
      grail: {
        threshold: combat?.system?.grailThreshold ?? 9,
        defeatedCount: combat?.system?.grailCounter ?? 0,
        materialized: Boolean(combat?.system?.grailMaterialized),
        destroyed: Boolean(combat?.system?.grailDestroyed),
        position: combat?.system?.grailPosition ?? null,
        contest: combat?.system?.grailContest ?? {},
      },
      zones: homeBaseZonesOf(scene),
      // Bounded fields (Ch. 28). Regions again, for the same reasons terrain
      // uses them: native membership, native enter/exit, and an area that may
      // be any shape at all.
      fields: boundedFieldsOf(scene),
      // Every legion pool in the world, by key (`engine/legion.mjs`). Off the
      // actors rather than the tokens: the Master holding the count need not
      // stand on the board, and nor need the reserve it counts.
      legions: legionPoolsOf(game.actors),
      ...settingOverrides,
    },
  });
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
export function terrainAreasOf(scene) {
  /** @type {Array<{id: string, type: string, panels: object[]}>} */
  const areas = [];
  for (const region of scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== "terrain" || behavior.disabled) continue;
      const panels = panelsOfRegion(region);
      for (const type of behavior.system?.types ?? []) {
        areas.push({
          id: `${region.id}:${type}`, type, panels, regionId: region.id,
          // A label: it names the ground and runs none of its clauses (#146).
          labelOnly: Boolean(behavior.system?.labelOnly),
          // The Level it is painted on; `null` (a hand-drawn area) is every Level (#151).
          level: behavior.system?.level ?? null,
        });
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
export function boundedFieldsOf(scene) {
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
        // Written by `openField` and read by `deactivateField` off the BOARD
        // projection, and never projected -- so every field's on-end actions
        // were silently empty. The terrain-clearing path escaped it by reading
        // the Region behaviour directly (`fields.mjs:481`), which is why the
        // gap looked like it could not exist.
        onEnd: sys.onEnd ?? [],
        // *"The Complex functions as a second Home Base for Ozymandias and his
        // Master only."* Read by `ownBaseOf` (rules/environment.mjs), which is
        // the third branch of a question that already had two answers.
        countsAsHomeBase: sys.countsAsHomeBase ?? null,
        duration: sys.duration ?? null,
        upkeep: sys.upkeep ?? null,
        deactivation: sys.deactivation ?? null,
        passive: Boolean(sys.passive),
        createdAt: sys.createdAt ?? null,
        lastUpkeepAt: sys.state?.lastUpkeepAt ?? null,
        state: sys.state ?? { escapeHistory: {} },
        panels: panelsOfRegion(region),
        regionId: region.id,
        // Its name for a player: the Region's, which `openField` names after
        // the ability. A refusal printed the content id (#208, live).
        name: region.name ?? null,
      });
    }
  }
  return out;
}

/**
 * Every legion pool the world's actors hold, by legion key.
 *
 * @param {Iterable<object>} actors
 * @returns {Record<string, object>}
 */
export function legionPoolsOf(actors) {
  /** @type {Record<string, object>} */
  const out = {};
  for (const actor of actors ?? []) {
    for (const [key, pool] of Object.entries(actor.system?.legions ?? {})) {
      if (pool && typeof pool === "object") out[key] = { ...pool, holderId: actor.id };
    }
  }
  return out;
}
