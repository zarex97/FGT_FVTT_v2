/**
 * @file An Item taken off the ground, or refused, said on a card.
 * @see docs/37-chat-and-log.md
 *
 * Layer 3. Walking onto a ground Item (`rules/items.mjs#itemPickupIntents`)
 * wrote the grant and a log entry and nothing else: Heracles took the Vorpal
 * Blade, a Trump Soldier and Nursery's Master were refused it, and no player
 * read a word of any of the three (#247, live).
 */

/**
 * The card's words for one pickup log entry, or `null` for any other entry.
 *
 * @param {{event: string, by: string, itemName?: string|null, itemId?: string, reason?: string}} entry
 * @param {(id: string) => string} nameOfUnit
 * @param {(key: string, data?: object) => string} t
 * @returns {string|null}
 */
export function itemLine(entry, nameOfUnit, t) {
  const data = { name: nameOfUnit(entry.by), item: entry.itemName ?? entry.itemId ?? "" };
  if (entry.event === "itemPickedUp") return `<div class="fgt-card fgt-card--item"><p>${t("FGT.Item.PickedUp", data)}</p></div>`;
  if (entry.event === "itemRefused") {
    return `<div class="fgt-card fgt-card--item"><p>${t(`FGT.Item.Refused.${entry.reason}`, data)}</p></div>`;
  }
  return null;
}

/**
 * Post it, naming the Unit as the table knows it (#234).
 *
 * @param {object} entry an `itemPickedUp` or `itemRefused` log entry
 * @returns {Promise<void>}
 */
export async function postItemLine(entry) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  const { shownName } = await import("./public-identity.mjs");
  const { currentBoard, unitActor } = await import("./board.mjs");
  const board = currentBoard();
  const nameOfUnit = (id) => {
    const actor = unitActor(id);
    return escape(actor ? shownName(actor, board) : id);
  };
  const t = (key, data) => game.i18n.format(key, { ...data, item: escape(String(data.item)) });
  const content = itemLine(entry, nameOfUnit, t);
  if (content) await ChatMessage.create({ content, flags: { fgt: { item: entry.event } } });
}
