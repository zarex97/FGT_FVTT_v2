/**
 * @file A player's Notebook: what that player alone has learned.
 * @see docs/30-concealment-and-identity.md, docs/model/identity.md
 *
 * Layer 3. *"The information of that NP is copied to your Notebook"* (Gilles
 * (Caster) and Mozart's Appreciation of the Arts, #297). One Journal Entry per
 * player, owned by that player and by nobody else, one page per thing learned.
 * Identity today is one public `identityRevealed` flag per Unit; this is the
 * first knowledge one player holds and another does not.
 */

const FLAG = "notebook";

/**
 * The player's Notebook, made the first time it is needed.
 *
 * @param {object} user a Foundry User
 * @returns {Promise<object>} the Journal Entry
 */
export async function notebookOf(user) {
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
  const book = (game.journal ?? []).find((j) => j.getFlag?.("fgt", FLAG) === user?.id);
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
