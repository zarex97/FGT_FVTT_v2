/**
 * @file A revival, said on a card.
 * @see docs/37-chat-and-log.md
 *
 * Layer 3. A Unit defeated and brought back by a revival source -- Battle
 * Continuation, Nine Lives, Divine Protection -- had its revival logged and
 * shown nowhere: the attack card read the hit that killed it, and the Unit
 * stood on with new Health and no word of why (#189).
 */

/**
 * The card's words for one `revive` log entry.
 *
 * @param {{unitId: string, source: string|null, amount: number}} entry
 * @param {(id: string) => string} nameOfUnit
 * @param {(source: string) => string} nameOfSource
 * @param {(key: string, data?: object) => string} t
 * @returns {string}
 */
export function revivalCard(entry, nameOfUnit, nameOfSource, t) {
  return `<div class="fgt-card fgt-card--revival"><p>${t("FGT.Revival.Card", {
    name: nameOfUnit(entry.unitId),
    source: entry.source ? nameOfSource(entry.source) : t("FGT.Revival.UnknownSource"),
    amount: entry.amount ?? 0,
  })}</p></div>`;
}

/**
 * Post it. The source is named by the field's Region, or by the ability whose
 * content id it is, or as it stands.
 *
 * @param {object} entry a `revive` log entry
 * @returns {Promise<void>}
 */
export async function postRevival(entry) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  const nameOfUnit = (id) => escape(game.actors.get(id)?.name ?? id);
  const nameOfSource = (source) => {
    const region = canvas?.scene?.regions?.find((r) =>
      r.behaviors?.some((b) => b.type === "npField" && b.system?.fieldId === source));
    if (region) return escape(region.name);
    for (const actor of game.actors ?? []) {
      const item = actor.items?.find((i) => i.system?.contentId === source || i.id === source);
      if (item) return escape(item.name);
    }
    return escape(String(source));
  };
  const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  await ChatMessage.create({ content: revivalCard(entry, nameOfUnit, nameOfSource, t), flags: { fgt: { revival: entry.unitId } } });
}
