/**
 * @file The Mark Action, and the field four Marks build.
 * @see docs/28-bounded-fields.md (`markDefined`), Ch. 28
 *
 * Layer 3. `rules/bloodmarks.mjs` decides whether four panels make a square;
 * this places the objects and opens the area.
 *
 * > *"To use this Noble Phantasm, Medusa has to first Mark the four corner
 * > panels of a 5x5, 7x7, or 9x9 panel area... Using the 'Mark' Action places a
 * > Bloodmark on the panel Medusa is standing on, and counts as her Attack for
 * > the Turn. Bloodmarks can be placed on any panel, even within enemy Home
 * > Bases. If all four Bloodmarks are complete, Bloodfort Andromeda is
 * > activated."*
 *
 * The half-built state lives on the board as Structure actors rather than in a
 * dialog, which is the safer half of the design: three marks are three things
 * a player can see, move around and destroy.
 */

import { completedSquare } from "../rules/bloodmarks.mjs";
import { currentBoard } from "./board.mjs";
import { affordable, spend } from "./budget.mjs";
import { openFieldFromMarks } from "./fields.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { attackForbiddenThisRound } from "../rules/environment.mjs";

/** The Structure content every Bloodmark is made from. */
const MARK_CONTENT_ID = "bloodmark";

/**
 * Every Bloodmark this unit has placed and not lost.
 *
 * @param {string} ownerId
 * @returns {object[]} Structure actors
 */
export function marksOf(ownerId) {
  return game.actors.filter((a) =>
    a.type === "structure"
    && a.system?.contentId === MARK_CONTENT_ID
    && a.system?.placedById === ownerId
    && !a.system?.defeated);
}

/**
 * Place a Bloodmark on the panel this unit is standing on.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.abilityId the Noble Phantasm the marks belong to
 * @returns {Promise<{ok: boolean, reason?: string, opened?: string, marks?: number}>}
 */
export async function placeMark({ unitId, abilityId }) {
  const actor = game.actors.get(unitId);
  const ability = actor?.items?.get(abilityId);
  if (!actor || !ability) return { ok: false, reason: "notFound" };

  const board = currentBoard();
  const self = board.units.find((u) => u.id === unitId);
  if (!self) return { ok: false, reason: "unplaced" };

  // The panel comes from the TOKEN DOCUMENT, not from the board snapshot.
  // `currentBoard()` reads canvas placeables, which lag the document -- the
  // same lag `runFieldEvent`'s `assumeInside` exists for. A Mark placed right
  // after a Move landed one panel behind Medusa, and the fourth corner then
  // completed no square.
  const panel = panelOfActor(actor);
  if (!panel) return { ok: false, reason: "unplaced" };

  // *"Medusa cannot place new Bloodmarks while Bloodfort Andromeda is Active."*
  const fieldId = ability.system?.contentId ?? ability.id;
  if ((board.fields ?? []).some((f) => f.id === fieldId)) {
    return { ok: false, reason: "fieldAlreadyActive" };
  }

  // *"counts as her Attack for the Turn"* — the `mark` action kind bills the
  // attack pool, so this is the same refusal attacking twice would get. NOT a
  // Home Base check: *"Bloodmarks can be placed on any panel, even within enemy
  // Home Bases"* is an explicit exemption from Ch. 05's restriction.
  // ...and so the first Round forbids it as it forbids an Attack (#188).
  const combat = game.combats.active;
  if (combat?.started
    && attackForbiddenThisRound("mark", combat.round ?? 1, game.settings.get("fgt", "noAttackRound"))) {
    return { ok: false, reason: "firstRound" };
  }
  const verdict = affordable(game.combats.active, self, "mark");
  if (!verdict.ok) return { ok: false, reason: verdict.reason ?? "cannotAct" };

  const existing = marksOf(unitId);
  if (existing.some((m) => samePanel(panelOf(m), panel))) {
    return { ok: false, reason: "alreadyMarked" };
  }

  await createMark(actor, panel, fieldId);
  await spend({ combat: game.combats.active, unit: self, action: "mark" });
  // *"and counts as her Attack for the Turn."* `spend` bills the faction's
  // pool; the unit's own turn record is a separate write, and without it she
  // could Mark and then still Attack -- the pool is per faction and she is not
  // the only Servant drawing on it.
  await applyWorldIntents([I.markTurn(actor.id, { attacked: true, acted: true })], "mark");
  await syncMarkVisibility();

  const placed = marksOf(unitId);
  const square = completedSquare(placed.map(panelOf).filter(Boolean));
  if (!square) return { ok: true, marks: placed.length };

  // *"If all four Bloodmarks are complete, Bloodfort Andromeda is activated"*,
  // and *"whenever Bloodfort Andromeda is complete (Activated), all other
  // Bloodmarks will vanish"* — the strays go. The corners stay, untargetable,
  // to show where the area is (#188 reading 14).
  const corners = new Set(square.corners.map((c) => `${c.i},${c.j}`));
  for (const mark of placed) {
    const p = panelOf(mark);
    if (p && !corners.has(`${p.i},${p.j}`)) await destroyMark(mark);
  }

  await openFieldFromMarks(ability, actor, square);
  await syncMarkVisibility();
  return { ok: true, opened: fieldId, marks: 4, size: square.size };
}

/**
 * Remove a Bloodmark from the board.
 *
 * Used for the strays when a Fort activates: *"all other Bloodmarks will
 * vanish."* It ends nothing. *"When Bloodfort Andromeda is activated, it is
 * continuously Active until Medusa is defeated"* (#188 reading 14): a corner
 * cannot even be targeted while its Fort stands (`rules/targeting/resolve.mjs`,
 * step 8b-ii), and the corners go with the field (`engine/fields.mjs#endField`).
 *
 * @param {string|object} markId
 * @returns {Promise<{ok: boolean}>}
 */
export async function destroyMark(markId) {
  const mark = typeof markId === "string" ? game.actors.get(markId) : markId;
  if (!mark) return { ok: false };
  for (const token of mark.getActiveTokens?.() ?? []) await token.document.delete();
  await mark.delete();
  return { ok: true };
}

/**
 * Redraw every Bloodmark's visibility, on this client.
 *
 * > *"Bloodmarks can only be seen from a distance of 3 cells Maximum."*
 *
 * The decision is per viewer and lives on the canvas
 * (`apps/canvas/token.mjs#isVisible`, `rules/bloodmarks.mjs#markSeenBy`): her
 * side always sees her marks, every other side from 3 panels (#188 reading 6).
 * This only asks each mark's token to answer again, because a Unit moving is
 * not a change to the mark and Foundry would not otherwise re-ask it.
 *
 * The first build drove the token's `hidden` flag from whether ANY enemy stood
 * within 3. `hidden` is one value for every client, so Medusa's own player lost
 * sight of her marks whenever no enemy was near. A mark that build hid is
 * shown again here, once, by the GM, and stamped so a mark the GM hides by hand
 * afterwards stays hidden.
 *
 * @returns {Promise<void>}
 */
export async function syncMarkVisibility() {
  if (!canvas?.scene) return;
  // The canvas caches the board's Units for a quarter second; a move has just
  // changed them.
  Hooks.callAll("fgtMarkSight");

  for (const mark of game.actors.filter((a) => a.type === "structure" && Number.isFinite(a.system?.visibleWithin))) {
    for (const token of mark.getActiveTokens?.() ?? []) {
      if (game.user.isGM && !token.document.getFlag?.("fgt", "perViewerSight")) {
        await token.document.update({ hidden: false, "flags.fgt.perViewerSight": true });
      }
      token.renderFlags?.set?.({ refreshVisibility: true });
    }
  }
}

/* -------------------------------------------------------------------------- */

/**
 * A unit's panel, read off its token DOCUMENT.
 *
 * The document is authoritative and immediate; `currentBoard()` reads canvas
 * placeables, which lag it.
 *
 * @param {object} actor
 * @returns {{i: number, j: number}|null}
 */
function panelOfActor(actor) {
  const token = actor.getActiveTokens?.()[0]?.document
    ?? canvas?.scene?.tokens?.find((t) => t.actor?.id === actor.id)
    ?? null;
  if (!token) return null;
  const size = canvas?.scene?.grid?.size ?? 100;
  return { i: Math.round(token.y / size), j: Math.round(token.x / size) };
}

/**
 * @param {object} mark a Structure actor
 * @returns {{i: number, j: number}|null}
 */
function panelOf(mark) {
  // The STORED panel first. A Bloodmark never moves, and reading it back off
  // the token loses the race with `createEmbeddedDocuments`: the fourth mark
  // was placed, counted, and then failed to complete the square because its
  // own token was not yet indexed when the check ran.
  const stored = mark.system?.panel ?? null;
  if (stored && Number.isInteger(stored.i) && Number.isInteger(stored.j)) return stored;

  const token = mark.getActiveTokens?.()[0]?.document ?? null;
  if (!token) return null;
  const size = canvas?.scene?.grid?.size ?? 100;
  return { i: Math.round(token.y / size), j: Math.round(token.x / size) };
}

/**
 * @param {object|null} a
 * @param {object|null} b
 * @returns {boolean}
 */
function samePanel(a, b) {
  return Boolean(a && b && a.i === b.i && a.j === b.j);
}

/**
 * Put one Bloodmark on the board.
 *
 * @param {object} owner
 * @param {{i: number, j: number}} panel
 * @param {string} fieldId
 * @returns {Promise<object>}
 */
async function createMark(owner, panel, fieldId) {
  const source = await markSource();
  if (!source) throw new Error(`FGT | No "${MARK_CONTENT_ID}" content to place.`);

  const data = source.toObject();
  data.system = {
    ...data.system,
    placedById: owner.id,
    // Where it stands, written rather than derived: a mark never moves, and
    // the token index lags its own creation.
    panel: { i: panel.i, j: panel.j },
    factionId: owner.system?.factionId ?? null,
    fieldId,
  };
  const [mark] = await Actor.createDocuments([data]);

  const size = canvas.scene.grid.size;
  const token = (await mark.getTokenDocument()).toObject();
  token.x = panel.j * size;
  token.y = panel.i * size;
  // Seen per viewer (`markSeenBy`), never hidden for everyone.
  token.hidden = false;
  token.flags = { ...(token.flags ?? {}), fgt: { ...(token.flags?.fgt ?? {}), perViewerSight: true } };
  await canvas.scene.createEmbeddedDocuments("Token", [token]);
  return mark;
}

/**
 * @returns {Promise<object|null>}
 */
async function markSource() {
  for (const pack of game.packs.filter((p) => p.metadata.type === "Actor")) {
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    const entry = index.find((e) => e.system?.contentId === MARK_CONTENT_ID);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}
