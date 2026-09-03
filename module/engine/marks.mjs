/**
 * @file The Mark Action, and the field four Marks build.
 * @see docs/43-bounded-fields.md §43.4 (`markDefined`), §43.10
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
import { chebyshev } from "../domain/geometry.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";

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
  // Home Bases"* is an explicit exemption from Ch. 08's restriction.
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
  // Bloodmarks will vanish"* — the strays go, the corners stay, because a
  // Master destroying a corner is how the area is broken.
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
 * Destroy a Bloodmark, and end the field if it was holding one up.
 *
 * > *"Only Masters can destroy a Bloodmark, and it is done by simply Attacking
 * > it."*
 *
 * The refusal for everybody else is a targeting filter (`destroyableBy`), so a
 * Servant is told why rather than swinging and achieving nothing.
 *
 * @param {string} markId
 * @returns {Promise<{ok: boolean, endedField?: string}>}
 */
export async function destroyMark(markId) {
  const mark = typeof markId === "string" ? game.actors.get(markId) : markId;
  if (!mark) return { ok: false };

  const fieldId = mark.system?.fieldId ?? null;
  for (const token of mark.getActiveTokens?.() ?? []) await token.document.delete();
  await mark.delete();

  // A corner is gone, so the square is gone. `endField` is idempotent and
  // returns false when there was nothing open.
  if (fieldId && (currentBoard().fields ?? []).some((f) => f.id === fieldId)) {
    const { endField } = await import("./fields.mjs");
    await endField(fieldId);
    return { ok: true, endedField: fieldId };
  }
  return { ok: true };
}

/**
 * Hide every Bloodmark nobody is near enough to see.
 *
 * > *"Bloodmarks can only be seen from a distance of 3 cells Maximum."*
 *
 * **Approximated, and deliberately so.** The rule is per-viewer, and Foundry
 * has no per-viewer token rendering: a placed token's visibility is one field
 * every client resolves the same way. `engine/token-image.mjs` states the same
 * constraint for a Servant's portrait, and D44.9 assessed the shadow-actor
 * pattern that would fix it and deferred it to Ch. 40.
 *
 * So this uses the one lever that exists — Foundry's `hidden`, which players
 * cannot see through and the GM always can — and drives it from whether ANY
 * enemy of the mark's owner stands within 3 panels. It errs toward concealment,
 * which is the clause's own direction: the counter-play is a Master sortie into
 * fog, and a mark visible to a player whose units are all far away would give
 * that away for free.
 *
 * Never a state write beyond the flag: a hidden mark is still on the board for
 * every rule, so this can no more desynchronize anything than a portrait can.
 *
 * @returns {Promise<void>}
 */
export async function syncMarkVisibility() {
  if (!game.user.isGM || !canvas?.scene) return;

  const board = currentBoard();
  for (const mark of game.actors.filter((a) => a.type === "structure" && a.system?.visibleWithin !== null)) {
    const panel = panelOf(mark);
    if (!panel) continue;

    const reach = mark.system.visibleWithin ?? 3;
    const seen = (board.units ?? []).some((u) =>
      u.panel && !u.defeated
      && u.factionId && u.factionId !== mark.system?.factionId
      && chebyshev(u.panel, panel) <= reach);

    for (const token of mark.getActiveTokens?.() ?? []) {
      if (token.document.hidden === !seen) continue;
      await token.document.update({ hidden: !seen });
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
