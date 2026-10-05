/**
 * @file One chat card per field per Turn end (#182).
 * @see docs/28-bounded-fields.md, module/engine/fields.mjs#runFieldEvent
 *
 * Layer 3. An interior event's Health loss, damage, defeat and chance rolls
 * left nothing a table could check: Contagion took 150 from four enemies at a
 * Turn end and the only trace was their Health. Ruled 2026-10-04: one public
 * card per field per Turn end, listing each Unit's loss and each roll, beside
 * the `fieldEvent` log entries `runFieldEvent` files.
 */

/**
 * The `fieldEvent` log entries among a batch of intents.
 *
 * @param {object[]} intents
 * @returns {object[]}
 */
export function fieldEventsIn(intents) {
  return (intents ?? [])
    .filter((i) => i?.t === "log" && i.entry?.kind === "fieldEvent")
    .map((i) => i.entry);
}

/**
 * One line per entry, in the order they happened.
 *
 * @param {object} e a `fieldEvent` entry
 * @param {(key: string, data?: object) => string} t a formatter
 * @returns {string}
 */
export function lineFor(e, t) {
  const who = e.unitName ?? e.unitId;
  if (typeof e.healthLoss === "number") return t("FGT.FieldReport.HealthLoss", { who, amount: e.healthLoss });
  if (typeof e.damage === "number") return t("FGT.FieldReport.Damage", { who, amount: e.damage });
  if (e.defeat) return t("FGT.FieldReport.Defeat", { who });
  if (e.roll?.check === "evade") {
    return t("FGT.FieldReport.Evade", { who, total: e.roll.total, outcome: t(`FGT.FieldReport.Outcome.${e.roll.outcome}`) });
  }
  if (e.roll) {
    return t("FGT.FieldReport.Chance", {
      who, effect: e.roll.effect ?? "?", total: e.roll.total, chance: e.roll.chance,
      outcome: t(`FGT.FieldReport.Outcome.${e.roll.outcome}`),
    });
  }
  if (e.effect) return t("FGT.FieldReport.Effect", { who, effect: e.effect });
  return t("FGT.FieldReport.Other", { who });
}

/**
 * The cards for one Turn end: one per field, its lines in order.
 *
 * @param {object[]} entries `fieldEvent` entries
 * @param {(fieldId: string) => string} nameOf the field's display name
 * @param {(key: string, data?: object) => string} t a formatter
 * @returns {Array<{fieldId: string, content: string}>}
 */
export function fieldReportCards(entries, nameOf, t) {
  /** @type {Map<string, object[]>} */
  const byField = new Map();
  for (const e of entries ?? []) {
    if (!byField.has(e.fieldId)) byField.set(e.fieldId, []);
    byField.get(e.fieldId).push(e);
  }
  return [...byField.entries()].map(([fieldId, list]) => ({
    fieldId,
    content: `<div class="fgt-card fgt-card--field-report">`
      + `<h3>${t("FGT.FieldReport.Title", { field: nameOf(fieldId) })}</h3>`
      + `<ul>${list.map((e) => `<li>${lineFor(e, t)}</li>`).join("")}</ul></div>`,
  }));
}

/**
 * Post the cards. Public: a field's effects are on the board for everyone.
 *
 * @param {object[]} entries
 * @returns {Promise<void>}
 */
export async function postFieldReports(entries) {
  if (!entries?.length || !game.users?.activeGM?.isSelf) return;
  const nameOf = (fieldId) => canvas?.scene?.regions?.find((r) =>
    r.behaviors?.some((b) => b.type === "npField" && b.system?.fieldId === fieldId))?.name ?? fieldId;
  const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  for (const card of fieldReportCards(entries, nameOf, t)) {
    await ChatMessage.create({ content: card.content, flags: { fgt: { fieldReport: card.fieldId } } });
  }
}

/**
 * The `periodicTick` log entries for a batch of intents (#182): one per
 * periodic damage tick, which effect on whom and for how much. Never who
 * inflicted it, so a Secret Poison stays secret. Read off the damage intents
 * themselves, which `scheduler.tickPeriodics` marks `periodic` with the
 * ticking `defId`, rather than added to that pure function's output.
 *
 * @param {object[]} intents
 * @param {(id: string) => string|null} nameOf
 * @param {number} tick
 * @returns {object[]}
 */
export function periodicTicksIn(intents, nameOf = () => null, tick = 0) {
  return (intents ?? [])
    .filter((i) => i?.t === "damage" && i.periodic)
    .map((i) => ({ kind: "periodicTick", unitId: i.unitId, unitName: nameOf(i.unitId), defId: i.defId ?? null, amount: i.amount, tick }));
}

/**
 * The Round-end card: one line per tick. Poison's Round-end damage took 160
 * from Asterios and Achilles and left nothing behind.
 *
 * @param {object[]} ticks `periodicTick` entries
 * @param {(key: string, data?: object) => string} t a formatter
 * @returns {string|null} the card's content, or `null` when nothing ticked
 */
export function periodicCard(ticks, t) {
  if (!ticks?.length) return null;
  const lines = ticks.map((e) => t("FGT.FieldReport.Periodic", {
    who: e.unitName ?? e.unitId, amount: e.amount, effect: e.defId,
  }));
  return `<div class="fgt-card fgt-card--field-report"><h3>${t("FGT.FieldReport.RoundTitle")}</h3>`
    + `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul></div>`;
}

/**
 * Log the Round end's ticks and post its card, when anything ticked.
 *
 * @param {object[]} intents what `scheduler.endRound` returned
 * @param {{log: (entries: object[]) => Promise<void>}} io
 * @returns {Promise<void>}
 */
export async function postPeriodicReport(intents, io) {
  if (!game.users?.activeGM?.isSelf) return;
  const ticks = periodicTicksIn(intents, (id) => game.actors.get(id)?.name ?? null, game.combat?.system?.globalTurn ?? 0);
  if (ticks.length === 0) return;
  await io.log(ticks);
  const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  await ChatMessage.create({ content: periodicCard(ticks, t), flags: { fgt: { periodicReport: true } } });
}

/**
 * The card a closing field posts (#185).
 *
 * @param {string} name the field's name, as its Region carries it
 * @param {string} reason why it closed: `owner`, `upkeep`, `ownerDefeat` ...
 * @param {(key: string, data?: object) => string} t the localiser
 * @returns {string}
 */
export function fieldClosedCard(name, reason, t) {
  const key = `FGT.Field.Closed.${reason}`;
  const why = t(key);
  const text = why === key ? t("FGT.Field.Closed.ended") : why;
  return `<div class="fgt-card fgt-card--field-closed"><p>${t("FGT.Field.ClosedTitle", { name })}</p>`
    + `<p class="fgt-card__meta">${text}</p></div>`;
}

/**
 * Post the card a closing field owes the table (#185).
 *
 * @param {string} name
 * @param {string} fieldId
 * @param {string} reason
 * @returns {Promise<void>}
 */
export async function postFieldClosed(name, fieldId, reason) {
  const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
  await ChatMessage.create({ content: fieldClosedCard(name, reason, t), flags: { fgt: { fieldClosed: fieldId, reason } } });
}
