/**
 * @file The card a defeat posts, and the one a Feigned Defeat shows in its place.
 * @see docs/37-chat-and-log.md, CONTEXT.md (Feigned Defeat), engine/io.mjs#defeat
 *
 * A defeat is the most consequential thing that happens to a Unit, and it posted
 * no card: a skull on the token and a raw log entry were all the table had (#249
 * reading 33). Every real defeat posts this one now, naming the Unit and its
 * killer by their public names (Ch. 30). Kirihanasu's Feigned Defeat shows every
 * player but hers the SAME card, so the two cannot be told apart.
 */

import { unitActor, currentBoard } from "./board.mjs";

/**
 * The card's HTML.
 *
 * @param {{name: string, killer?: string|null}} names public names
 * @returns {string}
 */
export function defeatCardContent({ name, killer = null }) {
  const escape = foundry.utils.escapeHTML;
  const text = killer
    ? game.i18n.format("FGT.Defeat.ByKiller", { name: escape(name), killer: escape(killer) })
    : game.i18n.format("FGT.Defeat.Alone", { name: escape(name) });
  return `<div class="fgt-card fgt-card--defeat"><p><strong>${text}</strong></p></div>`;
}

/**
 * Post the card for one defeat.
 *
 * @param {string} unitId
 * @param {string|null} [killerId]
 * @param {{whisper?: string[]|null, feigned?: boolean}} [opts] `whisper`: only
 *   these users see it (a Feigned Defeat's audience); `feigned` is flagged so the
 *   truth can be found by the GM, never by the card's look
 * @returns {Promise<void>}
 */
export async function postDefeatCard(unitId, killerId = null, { whisper = null, feigned = false } = {}) {
  const { shownName } = await import("./public-identity.mjs");
  const board = currentBoard();
  const unit = unitActor(unitId);
  if (!unit) return;
  const killer = killerId ? unitActor(killerId) : null;
  await ChatMessage.create({
    content: defeatCardContent({ name: shownName(unit, board), killer: killer ? shownName(killer, board) : null }),
    ...(whisper ? { whisper } : {}),
    flags: { fgt: { defeat: { unitId, ...(feigned ? { feigned: true } : {}) } } },
  });
}
