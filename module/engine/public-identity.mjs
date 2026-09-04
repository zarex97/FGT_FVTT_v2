/**
 * @file What everyone sees: the face and the name a concealed unit shows.
 * @see docs/04-units.md §4.2, docs/26-authority-and-sockets.md §26.6
 *
 * Layer 3. One home for the question "what is this unit publicly", because
 * three surfaces need the same answer and each had been deciding it alone: a
 * placed token's texture, an attack card and a skill card.
 *
 * The rule those three share is that **none of them can render per viewer.** A
 * token's texture is one field on one document; a chat message is one document
 * every client reads identically. Foundry has no per-viewer rendering for
 * either, and building it is the shadow-actor pattern Ch. 26 §26.6 assesses
 * and defers. So all three show the PUBLIC identity — including to the unit's
 * own owner, whose card is the same card the opponent is reading.
 *
 * That is the one place this differs from `apps/actor-sheet/context.mjs`,
 * which DOES exempt the owner: a sheet is rendered per viewer and can afford
 * to.
 */

import { publicNameOf } from "../rules/identity.mjs";
import { snapshotUnit } from "../rules/snapshot.mjs";

/**
 * The image every viewer's screen should show for this unit.
 *
 * Concealment applies to an unrevealed SERVANT and to nothing else, so a
 * Master or a Platform shows its own portrait and `defaultImage` is inert on
 * it. Reading it unconditionally would pin a Master's token to a field its own
 * sheet never displays.
 *
 * @param {object} actor
 * @returns {string}
 */
export function publicImageOf(actor) {
  const concealed = actor.type === "servant" && !actor.system?.identityRevealed;
  if (!concealed) return actor.img;
  return actor.system?.defaultImage || actor.img;
}

/**
 * The name and face a chat card may print.
 *
 * `publicNameOf` takes a snapshot rather than a document, so one is projected
 * here — reusing the board's projection when the unit is on it, and a
 * standalone one otherwise, because a card can be posted before anything is
 * placed.
 *
 * The board is a PARAMETER rather than resolved here, so this module never
 * imports `engine/board.mjs` and stays testable: that import reaches the
 * canvas, and a unit test has no canvas.
 *
 * The viewer is deliberately empty. `publicNameOf` exempts a unit's own owner,
 * which is right on a sheet and wrong here: this string goes into a message
 * every client reads.
 *
 * @param {object} actor
 * @param {object} board
 * @returns {{name: string, img: string}}
 */
export function publicIdentityOf(actor, board) {
  if (!actor) return { name: "", img: "" };
  const unit = (board?.units ?? []).find((u) => u.id === actor.id) ?? snapshotUnit(actor);
  return {
    name: publicNameOf(unit, board, {}),
    img: publicImageOf(actor),
  };
}

/**
 * A chat speaker whose ALIAS is the public name.
 *
 * Foundry builds a speaker's alias from the actor's own name, and that alias is
 * the line the chat log prints above the card. So a card whose body correctly
 * said "Rider" still had "Medusa" written across the top of it — the fix to the
 * body was invisible until somebody looked at the message rather than at the
 * content string.
 *
 * `ChatMessage` is referenced inside the function rather than imported, so this
 * module still loads without Foundry and the rest of it stays unit-testable.
 *
 * @param {object|null} actor
 * @param {object} [board]
 * @returns {object}
 */
export function publicSpeakerFor(actor, board = null) {
  const speaker = ChatMessage.getSpeaker(actor ? { actor } : {});
  if (!actor) return speaker;
  return { ...speaker, alias: publicIdentityOf(actor, board).name };
}
