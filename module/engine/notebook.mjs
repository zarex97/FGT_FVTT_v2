/**
 * @file A player's Notebook: what that player's Faction has learned, page by page.
 * @see docs/30-concealment-and-identity.md, docs/model/identity.md, module/engine/intel-store.mjs
 *
 * Layer 3. *"The information of that NP is copied to your Notebook"* (Gilles
 * (Caster) and Mozart's Appreciation of the Arts, #297). Since the Information
 * System (ADR-0008) what one player learns is their Faction's: a player's
 * Notebook is their Faction's Notebook, one page per thing learned. A player
 * in no Faction keeps a Journal Entry of their own, owned by them alone.
 */

import { factionOfUser, ensureNotebook, notebookOf as factionNotebookOf } from "./intel-store.mjs";

const FLAG = "notebook";

/**
 * The Notebook of the Faction a user plays, if it exists already: read, never
 * made. A Notebook that does not exist holds nothing.
 *
 * @param {object} user
 * @returns {object|null}
 */
function factionBookOf(user) {
  const factionId = factionOfUser(user);
  return factionId ? factionNotebookOf(factionId) : null;
}

/**
 * The player's Notebook, made the first time it is needed.
 *
 * @param {object} user a Foundry User
 * @returns {Promise<object>} the Journal Entry
 */
export async function notebookOf(user) {
  // The player's Faction's Notebook (ADR-0008, reading 1): what one player
  // learns, the Faction knows. A player in no Faction keeps a Notebook of
  // their own, as before.
  const factionId = factionOfUser(user);
  if (factionId) {
    const book = await ensureNotebook(factionId);
    if (book) return book;
  }
  const held = (game.journal ?? []).find((j) => j.getFlag?.("fgt", FLAG) === user.id);
  if (held) return held;
  const OWNER = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  const NONE = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0;
  return JournalEntry.create({
    name: game.i18n.format("FGT.Notebook.Title", { name: user.name }),
    ownership: { default: NONE, [user.id]: OWNER },
    flags: { fgt: { [FLAG]: user.id } },
  });
}

/**
 * Has this player already learned it? Read, never made: a player with no
 * Notebook has learned nothing.
 *
 * @param {object} user
 * @param {string} key
 * @returns {boolean}
 */
export function notebookHolds(user, key) {
  const book = factionBookOf(user) ?? (game.journal ?? []).find((j) => j.getFlag?.("fgt", FLAG) === user?.id);
  return [...(book?.pages ?? [])].some((p) => p.getFlag?.("fgt", "key") === key);
}

/**
 * Copy one thing learned into a player's Notebook. Learned twice, it is one
 * page: `key` names it.
 *
 * @param {object} user
 * @param {{key: string, title: string, content: string}} entry
 * @returns {Promise<{page: object, added: boolean}>}
 */
export async function recordInNotebook(user, { key, title, content }) {
  const book = await notebookOf(user);
  const held = [...(book.pages ?? [])].find((p) => p.getFlag?.("fgt", "key") === key);
  if (held) return { page: held, added: false };
  const [page] = await book.createEmbeddedDocuments("JournalEntryPage", [{
    name: title,
    type: "text",
    text: { content },
    flags: { fgt: { key } },
  }]);
  return { page, added: true };
}
