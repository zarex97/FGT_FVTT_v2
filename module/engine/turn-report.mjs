/**
 * @file What a Turn's end did to Health, said on a card.
 * @see docs/37-chat-and-log.md
 *
 * Layer 3. A handler fired at a Turn boundary -- Mad Enhancement's *"this
 * Servant's Master loses 30 Health at the end of every Turn it Acts"* -- wrote
 * its Health change and nothing else: the Master's bar dropped by 30 and no
 * card said why (#190).
 */

/**
 * The card's words for the Turn end's Health changes and the modes it ended,
 * or `null` when none.
 *
 * A mode a Turn-end handler switches off is said too: Tenmōkaikai ended on its
 * own upkeep, its four copies left, and no card said why (#195).
 *
 * @param {object[]} intents what `scheduler.endTurn` returned
 * @param {(id: string) => string} nameOfUnit
 * @param {(key: string, data?: object) => string} t
 * @param {(unitId: string, abilityId: string) => string} [nameOfAbility]
 * @returns {string|null}
 */
export function turnEndCard(intents, nameOfUnit, t, nameOfAbility = (_u, a) => a) {
  const changes = (intents ?? []).filter((i) => i?.t === "statDelta" && i.stat === "health.value" && i.delta);
  const ended = (intents ?? []).filter((i) => i?.t === "setMode" && i.active === false && i.source);
  if (changes.length === 0 && ended.length === 0) return null;
  const lines = [
    ...changes.map((i) => t(i.delta < 0 ? "FGT.TurnReport.Loses" : "FGT.TurnReport.Gains", {
      who: nameOfUnit(i.unitId),
      amount: Math.abs(i.delta),
      source: i.source ?? t("FGT.Revival.UnknownSource"),
    })),
    ...ended.map((i) => t("FGT.TurnReport.ModeEnded", {
      ability: nameOfAbility(i.unitId, i.abilityId), who: nameOfUnit(i.unitId), source: i.source,
    })),
  ];
  return `<div class="fgt-card fgt-card--turn-report"><h3>${t("FGT.TurnReport.Title")}</h3>`
    + `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></div>`;
}

/**
 * Post it, from the one active GM.
 *
 * @param {object[]} intents
 * @returns {Promise<void>}
 */
export async function postTurnEndReport(intents) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  const nameOfUnit = (id) => escape(game.actors.get(id)?.name ?? id);
  const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const nameOfAbility = (unitId, abilityId) => escape(game.actors.get(unitId)?.items?.find((i) =>
    i.system?.slug === abilityId || i.system?.contentId === abilityId || i.id === abilityId)?.name ?? abilityId);
  const content = turnEndCard(intents, nameOfUnit, t, nameOfAbility);
  if (content) await ChatMessage.create({ content, flags: { fgt: { turnReport: true } } });
}
