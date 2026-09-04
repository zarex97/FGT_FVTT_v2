/**
 * @file Putting a unit's Detect radius onto its token as Foundry vision.
 * @see docs/08-board-and-geometry.md §8.7, docs/04-units.md §4.2
 *
 * Layer 3. Ch. 8.7 settled this a long time ago — *"Fog of war is Foundry's,
 * driven by `TokenDocument.sight` … we map it to Foundry-native vision so the
 * canvas does the work"* — and `data/actor/_shared.mjs` says the number in as
 * many words: **"Vision range and Detect are the same number (Ch. 08 §8.7)."**
 *
 * The number existed. `rules/identity.mjs#detectRangeOf` computed it, the class
 * table behind it was authored and tested, and **nothing ever wrote it to a
 * token.** Every unit therefore sat on the board at Foundry's default of
 * `sight.enabled: false, range: 0`, which on a scene with `tokenVision` on is
 * not "no fog" — it is a player staring at an entirely black canvas with their
 * own token invisible in the middle of it. Found in play, by a player who owned
 * a Servant and could see nothing.
 *
 * F/GT has no line of sight and no walls (D8.6), so this is vision as a plain
 * radius: what fog it lifts is a question of distance and nothing else.
 *
 * Three write points, for the reasons `engine/token-footprint.mjs` gives:
 *
 *  1. `preCreateToken` — a token gets its vision on the way in, before it is
 *     ever drawn dark.
 *  2. `updateActor` — an edit to the sheet's Detect, class container or
 *     effects reaches every token that actor has placed.
 *  3. `fgtUnitMoved` — a Caster's Detect is 5 in its own Home Base and 3
 *     outside it, the one range in the game that changes as its owner walks.
 */

import { placedTokensOf } from "./token-sync.mjs";
import { detectRangeOf } from "../rules/identity.mjs";
import { snapshotUnit } from "../rules/snapshot.mjs";

/**
 * The Actor types that are units on the board. A journal or a stock Foundry
 * actor sharing the world has no Detect and gets no vision.
 */
const UNIT_TYPES = new Set(["servant", "master", "civilian", "summon", "platform", "structure"]);

export const TokenVision = {
  /** Register the hooks. Idempotent. */
  attach() {
    // Not GM-gated: `preCreateToken` mutates the pending document in the
    // creating client's own memory before it is sent, so whoever is placing the
    // token has to be the one to do it.
    Hooks.on("preCreateToken", onPreCreateToken);

    Hooks.on("updateActor", (actor, changes) => {
      if (!UNIT_TYPES.has(actor.type)) return;
      if (!touchesDetect(changes)) return;
      syncVision(actor).catch((err) => console.error("FGT | Token vision sync:", err));
    });

    // A Caster's radius depends on where it is standing (`DETECT_BY_CLASS`).
    Hooks.on("fgtUnitMoved", (unit) => {
      const actor = game.actors.get(unit?.id ?? unit?.unitId);
      if (!actor || !UNIT_TYPES.has(actor.type)) return;
      syncVision(actor).catch((err) => console.error("FGT | Token vision sync:", err));
    });

    console.log("FGT | Token vision sync attached");
  },
};

/**
 * The sight block this actor's Detect radius calls for.
 *
 * `sight.range` is in the scene's DISTANCE units, not panels, so the radius is
 * multiplied by the grid's distance — a 4-panel Archer on a 5-foot grid sees
 * 20, and the same Archer on a 1-unit grid sees 4. Reading the panel count
 * straight into the field is the mistake this comment exists to prevent: it
 * silently works on any scene whose `grid.distance` happens to be 1.
 *
 * The board is optional and passed in rather than resolved here, so this stays
 * callable from `preCreateToken`, where the token being placed is not on the
 * board yet and asking for one would recurse.
 *
 * @param {object} actor
 * @param {object|null} [board]
 * @returns {{sight: object}|null}
 */
export function sightFor(actor, board = null) {
  if (!actor || !UNIT_TYPES.has(actor.type)) return null;

  const panels = detectRangeOf(snapshotUnit(actor), board);
  if (!(panels > 0)) return null;

  const perPanel = canvas?.scene?.grid?.distance ?? canvas?.grid?.distance ?? 1;
  // `enabled` and `range` and nothing else. Foundry derives the rest itself --
  // `TokenDocument#_prepareDetectionModes` fills in `basicSight` at exactly
  // this range and `lightPerception` at infinity whenever sight is enabled --
  // so writing detection modes by hand would duplicate a default that is
  // already correct. `visionMode`, `angle`, `color` and the tint fields are
  // left alone for the opposite reason: they are a GM's to set on a token, and
  // this function runs again every time a Caster takes a step.
  return { sight: { enabled: true, range: panels * perPanel } };
}

/**
 * Does this change touch anything `detectRangeOf` reads?
 *
 * `effects` is in the list because Deafen reduces Detect by one, and
 * `classContainer` because the whole table is keyed on it.
 *
 * @param {object} changes
 * @returns {boolean}
 */
function touchesDetect(changes) {
  const sys = changes?.system;
  if (!sys) return false;
  return sys.detect !== undefined
    || sys.classContainer !== undefined
    || sys.effects !== undefined
    || sys.suppressions !== undefined;
}

/**
 * @param {object} document the pending `TokenDocument`
 */
function onPreCreateToken(document) {
  const next = sightFor(document.actor);
  if (!next) return;
  // `updateSource` rather than `document.update`: the document does not exist
  // yet, and this is the one window in which changing it is free.
  document.updateSource(next);
}

/**
 * Push a changed Detect radius onto the prototype and every placed token.
 *
 * GM-only, the convention `engine/token-image.mjs` and
 * `engine/token-footprint.mjs` share: `updateActor` fires on every connected
 * client and only the GM may write another user's token.
 *
 * @param {object} actor
 * @returns {Promise<void>}
 */
export async function syncVision(actor) {
  if (!game.user?.isGM) return;

  const { currentBoard } = await import("./board.mjs");
  const next = sightFor(actor, currentBoard());
  if (!next) return;

  if (!actor.isToken && !sameSight(actor.prototypeToken?.sight, next.sight)) {
    await actor.update({ prototypeToken: next });
  }

  for (const token of placedTokensOf(actor)) {
    if (sameSight(token.sight, next.sight)) continue;
    // `sight` is not one of Foundry v14's MOVEMENT_FIELDS, so unlike a resize
    // this needs no `fgtForced` escape past `engine/movement-hooks.mjs`.
    await token.update(next);
  }
}

/**
 * @param {object|null} current
 * @param {object} next
 * @returns {boolean}
 */
function sameSight(current, next) {
  return Boolean(current)
    && current.enabled === next.enabled
    && current.range === next.range;
}

/**
 * Give every unit already on a board its vision, once at load.
 *
 * The hooks above catch a token being PLACED and an actor being EDITED. Neither
 * fires for the tokens that are already standing there, and in a world that
 * predates this file that is all of them -- so without this the fix only
 * reaches units summoned from now on, and an existing match stays dark.
 *
 * Idempotent: `syncVision` compares before it writes, so a second load is free.
 *
 * @returns {Promise<void>}
 */
export async function backfillVision() {
  if (!game.user?.isGM) return;

  const seen = new Set();
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      const actor = token.actor;
      if (!actor || seen.has(actor.id)) continue;
      seen.add(actor.id);
      await syncVision(actor);
    }
  }
}
