/**
 * @file What a Turn's end did to Health, said on a card.
 * @see docs/37-chat-and-log.md
 *
 * Layer 3. A handler fired at a Turn boundary -- Mad Enhancement's *"this
 * Servant's Master loses 30 Health at the end of every Turn it Acts"* -- wrote
 * its Health change and nothing else: the Master's bar dropped by 30 and no
 * card said why (#190).
 */

import { effectLine } from "../rules/card-visibility.mjs";
import { unitActor } from "./board.mjs";

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
 * Each healed Unit's Health BEFORE the batch, so the card can say what a heal
 * gave rather than what it was authored to give.
 *
 * Arjuna's Regen is 15% of 1250, 187, and at 1089 of 1250 it gave 161 (#234).
 *
 * @param {object[]} intents
 * @param {(unitId: string) => {value: number, max: number}|null} healthOf
 * @returns {Map<string, {value: number, max: number}>}
 */
export function healthBefore(intents, healthOf) {
  const out = new Map();
  for (const i of intents ?? []) {
    if (i?.t !== "heal" || out.has(i.unitId)) continue;
    const h = healthOf(i.unitId);
    if (h && Number.isFinite(h.value) && Number.isFinite(h.max)) out.set(i.unitId, { ...h });
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
 * @param {string[]} [fell] the Units this boundary's losses defeated: the
 *   multi-Servant tax empties a Master and kills it (ruled 2026-10-17, #241), and
 *   the card said only what it took
 * @returns {string|null}
 */
export function turnEndCard(intents, nameOfUnit, t, nameOfAbility = (_u, a) => a, before = null, health = null, titleKey = "FGT.TurnReport.Title", landed = [], fell = []) {
  const changes = (intents ?? []).filter((i) => i?.t === "statDelta" && i.stat === "health.value" && i.delta);
  // A heal is said too, as what it gave (#234): Regen healed at every boundary
  // and no card said so, because the card read Health deltas alone and a heal
  // is its own intent. Clamped at the maximum when the Health before is known,
  // and not said at all when it gave nothing; a revival is the revival's line.
  const left = new Map([...(health ?? new Map())].map(([id, h]) => [id, { ...h }]));
  const heals = (intents ?? []).filter((i) => i?.t === "heal" && i.amount > 0 && !i.revival).map((i) => {
    const h = left.get(i.unitId);
    if (!h) return { ...i, gave: i.amount };
    const gave = Math.max(0, Math.min(i.amount, h.max - h.value));
    h.value += gave;
    return { ...i, gave };
  }).filter((i) => i.gave > 0);
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
  // What a boundary's handlers landed (#202): Terror's Stun at the end of a
  // Turn, by the Unit's public name. Each row is the landing's own line.
  const effects = (landed ?? []).filter((l) => l?.summary);
  if (changes.length === 0 && ended.length === 0 && clocks.length === 0 && heals.length === 0 && effects.length === 0
    && (fell ?? []).length === 0) return null;
  const lines = [
    ...changes.map((i) => t(i.delta < 0 ? "FGT.TurnReport.Loses" : "FGT.TurnReport.Gains", {
      who: nameOfUnit(i.unitId),
      amount: Math.abs(i.delta),
      source: i.source ?? t("FGT.Revival.UnknownSource"),
    })),
    ...(fell ?? []).map((id) => t("FGT.TurnReport.Defeated", { who: nameOfUnit(id) })),
    ...heals.map((i) => t("FGT.TurnReport.Gains", {
      who: nameOfUnit(i.unitId), amount: i.gave, source: i.source ?? t("FGT.Revival.UnknownSource"),
    })),
    ...ended.map((i) => t("FGT.TurnReport.ModeEnded", {
      ability: nameOfAbility(i.unitId, i.abilityId), who: nameOfUnit(i.unitId), source: i.source,
    })),
    ...clocks.map((i) => t(COOLDOWN_KEYS[i.mode] ?? COOLDOWN_KEYS.reduce, {
      who: nameOfUnit(i.unitId), ability: nameOfAbility(i.unitId, i.abilityId), ticks: taken(i), source: i.source,
    })),
    ...effects.map((l) => `${nameOfUnit(l.unitId)}: ${effectLine(l.summary)}`),
  ];
  return `<div class="fgt-card fgt-card--turn-report"><h3>${t(titleKey)}</h3>`
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
  const n = unitActor(unitId)?.items?.get(abilityId)?.system?.cooldown?.remaining;
  return Number.isFinite(n) ? n : null;
}

/**
 * A Unit's Health off the world's actor, for {@link healthBefore}.
 *
 * @param {string} unitId
 * @returns {{value: number, max: number}|null}
 */
export function healthOnActor(unitId) {
  const h = unitActor(unitId)?.system?.health;
  return h ? { value: Number(h.value), max: Number(h.max) } : null;
}

export async function postTurnEndReport(intents, before = null, health = null, titleKey = "FGT.TurnReport.Title", landed = []) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  // The name the table knows: "Archer regains 161 Health (Regen)", never his
  // True Name (#234, as every engine line since #230 §46.4-NV).
  const { shownName } = await import("./public-identity.mjs");
  const { currentBoard } = await import("./board.mjs");
  const board = currentBoard();
  const nameOfUnit = (id) => {
    const actor = unitActor(id);
    return escape(actor ? shownName(actor, board) : id);
  };
  const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  const nameOfAbility = (unitId, abilityId) => escape(unitActor(unitId)?.items?.find((i) =>
    i.system?.slug === abilityId || i.system?.contentId === abilityId || i.id === abilityId)?.name ?? abilityId);
  // A handler names its source by the effect's id ("regen"); the card says the
  // effect's name, as the rest of the game does ("Regen", #234).
  const { EffectRegistry } = await import("../rules/registry.mjs");
  const named = (intents ?? []).map((i) => (i?.source && EffectRegistry.get(i.source)?.name
    ? { ...i, source: escape(EffectRegistry.get(i.source).name) } : i));
  const escaped = (landed ?? []).map((l) => ({ ...l, summary: { ...l.summary, name: escape(String(l.summary?.name ?? "")), reason: l.summary?.reason ? escape(String(l.summary.reason)) : null } }));
  // Who a loss here emptied and the defeat chain took: alive before the batch,
  // by the Health read before it, and defeated now.
  const fell = [...new Set((intents ?? [])
    .filter((i) => i?.t === "statDelta" && i.stat === "health.value" && i.delta < 0 && i.defeatsAtZero)
    .map((i) => i.unitId))]
    .filter((id) => unitActor(id)?.system?.defeated);
  const content = turnEndCard(named, nameOfUnit, t, nameOfAbility, before, health, titleKey, escaped, fell);
  if (content) await ChatMessage.create({ content, flags: { fgt: { turnReport: true } } });
}
