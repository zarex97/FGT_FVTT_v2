/**
 * @file What a Turn's end did to Health, said on a card.
 * @see docs/37-chat-and-log.md
 *
 * Layer 3. A handler fired at a Turn boundary -- Mad Enhancement's *"this
 * Servant's Master loses 30 Health at the end of every Turn it Acts"* -- wrote
 * its Health change and nothing else: the Master's bar dropped by 30 and no
 * card said why (#190).
 */

/** The line for each way a clock can turn. */
const COOLDOWN_KEYS = Object.freeze({
  reduce: "FGT.TurnReport.CooldownCut",
  increase: "FGT.TurnReport.CooldownAdded",
  set: "FGT.TurnReport.CooldownSet",
});

/**
 * The key a clock is read under, for {@link clocksBefore} and the card.
 *
 * @param {{unitId: string, abilityId: string}} i
 * @returns {string}
 */
const clockKey = (i) => `${i.unitId}:${i.abilityId}`;

/**
 * What each clock a sourced cut names reads BEFORE the batch is applied.
 *
 * Read by the caller ahead of the writes, so the card can say what a cut did
 * rather than what it was authored to do: Self-Replenishment fires at every one
 * of Castor's Turn ends, and on a clock at 0 it cuts nothing (#209 review).
 *
 * @param {object[]} intents
 * @param {(unitId: string, abilityId: string) => number|null} remainingOf
 * @returns {Map<string, number>}
 */
export function clocksBefore(intents, remainingOf) {
  const out = new Map();
  for (const i of intents ?? []) {
    if (i?.t !== "cooldown" || !i.source) continue;
    const n = remainingOf(i.unitId, i.abilityId);
    if (Number.isFinite(n)) out.set(clockKey(i), n);
  }
  return out;
}

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
 * @param {Map<string, number>|null} [before] {@link clocksBefore}; a cut on a clock
 *   it knows is said as what it took, and not at all when it took nothing
 * @returns {string|null}
 */
export function turnEndCard(intents, nameOfUnit, t, nameOfAbility = (_u, a) => a, before = null) {
  const changes = (intents ?? []).filter((i) => i?.t === "statDelta" && i.stat === "health.value" && i.delta);
  const ended = (intents ?? []).filter((i) => i?.t === "setMode" && i.active === false && i.source);
  // A clock a handler turned, named by its handler: Self-Replenishment's 2 Turns
  // off both twins' Noble Phantasm (#209, live). The Turn's own tick names no
  // source and is not news.
  // What a cut TOOK, when the clock was read before it: a reduction stops at 0.
  const taken = (i) => {
    const was = before?.get?.(clockKey(i));
    return i.mode === "reduce" && Number.isFinite(was) ? Math.min(i.ticks, was) : i.ticks;
  };
  const clocks = (intents ?? []).filter((i) => i?.t === "cooldown" && i.source && taken(i) > 0);
  if (changes.length === 0 && ended.length === 0 && clocks.length === 0) return null;
  const lines = [
    ...changes.map((i) => t(i.delta < 0 ? "FGT.TurnReport.Loses" : "FGT.TurnReport.Gains", {
      who: nameOfUnit(i.unitId),
      amount: Math.abs(i.delta),
      source: i.source ?? t("FGT.Revival.UnknownSource"),
    })),
    ...ended.map((i) => t("FGT.TurnReport.ModeEnded", {
      ability: nameOfAbility(i.unitId, i.abilityId), who: nameOfUnit(i.unitId), source: i.source,
    })),
    ...clocks.map((i) => t(COOLDOWN_KEYS[i.mode] ?? COOLDOWN_KEYS.reduce, {
      who: nameOfUnit(i.unitId), ability: nameOfAbility(i.unitId, i.abilityId), ticks: taken(i), source: i.source,
    })),
  ];
  return `<div class="fgt-card fgt-card--turn-report"><h3>${t("FGT.TurnReport.Title")}</h3>`
    + `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></div>`;
}

/**
 * Post it, from the one active GM.
 *
 * @param {object[]} intents
 * @param {Map<string, number>|null} [before] the clocks as read before the batch ({@link clocksBefore})
 * @returns {Promise<void>}
 */
/**
 * A clock's Turns left, off the world's actor.
 *
 * @param {string} unitId
 * @param {string} abilityId
 * @returns {number|null}
 */
export function remainingOnActor(unitId, abilityId) {
  const n = game.actors?.get(unitId)?.items?.get(abilityId)?.system?.cooldown?.remaining;
  return Number.isFinite(n) ? n : null;
}

export async function postTurnEndReport(intents, before = null) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  const nameOfUnit = (id) => escape(game.actors.get(id)?.name ?? id);
  const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const nameOfAbility = (unitId, abilityId) => escape(game.actors.get(unitId)?.items?.find((i) =>
    i.system?.slug === abilityId || i.system?.contentId === abilityId || i.id === abilityId)?.name ?? abilityId);
  const content = turnEndCard(intents, nameOfUnit, t, nameOfAbility, before);
  if (content) await ChatMessage.create({ content, flags: { fgt: { turnReport: true } } });
}
