/**
 * @file Earning Intel: an act witnessed pays the Factions that saw it.
 * @see module/rules/intel.mjs, module/engine/intel-store.mjs, docs/superpowers/specs/2026-11-12-information-system.md (EA.*)
 *
 * Layer 3. Each act the engine resolves calls {@link noteAct} once: a Move from
 * `movement-hooks.mjs`, an Attack per Process from `attack.mjs`, an Evade, a
 * Block or a Counter from the reaction rung, an ability from `fireAbilityUsed`,
 * a Command Spell from `command-spells.mjs`. Who witnessed it and what each
 * Faction earns is `rules/intel.mjs#witnessesOf`; the once-per-Turn ledger is
 * `payAct`. Everything is written on the War's GM, never on a player's client.
 */

import { currentBoard, currentMoment, unitActor } from "./board.mjs";
import { currentWar, isWarGM } from "./war.mjs";
import { witnessesOf, payAct } from "../rules/intel.mjs";
import { changeNotebook, emptyDossier, intelOn, notebookOf, playersOf, stateOf } from "./intel-store.mjs";

/**
 * A Unit's name as one Faction knows it: its True Name once the Faction knows
 * its identity (its Notebook's Dossier, or the public flag), its public name else.
 *
 * @param {object|null} actor
 * @param {string} factionId
 * @param {object} [board]
 * @returns {Promise<string>}
 */
export async function knownNameOf(actor, factionId, board = currentBoard()) {
  if (!actor) return "";
  const { publicIdentityOf } = await import("./public-identity.mjs");
  // What the Faction knows is in its own Notebook (ID.store): a list on the
  // actor would tell every client which Factions know.
  const known = Boolean(actor.system?.identityRevealed)
    || Boolean(stateOf(notebookOf(factionId)).dossiers[actor.id]?.identity);
  // fgt-name-ok: the True Name goes only to a Faction that knows it
  return known ? (actor.system?.trueName || actor.name) : publicIdentityOf(actor, board).name;
}

/**
 * One act, witnessed: pay every Faction that saw it or was involved.
 *
 * @param {object} act
 * @param {string} act.unitId the acting Unit
 * @param {string} act.kind a key of `INTEL_VALUES`
 * @param {string[]} [act.involvedIds]
 * @param {Array<{i: number, j: number, k?: number}>|null} [act.panels] where sight is read (a Move's start and end)
 * @returns {Promise<Map<string, number>>} factionId → Intel paid
 */
export async function noteAct({ unitId, kind, involvedIds = [], panels = null }) {
  const paid = new Map();
  const war = currentWar();
  if (!war || !intelOn(war)) return paid;
  // Written on the War's GM: a play resolved anywhere else is relayed.
  if (!isWarGM(war)) {
    const { FGTSocket } = await import("../net/socket.mjs");
    await FGTSocket.request("intelAct", { unitId, kind, involvedIds, panels }).catch((err) =>
      console.warn("FGT | Intel not relayed:", err));
    return paid;
  }
  const board = currentBoard();
  const actor = (board.units ?? []).find((u) => u.id === unitId);
  if (!actor) return paid;
  const tick = currentMoment().tick ?? war.system?.globalTurn ?? 0;
  const earned = witnessesOf({ actor, board, kind, involvedIds, panels });
  for (const [factionId, value] of earned) {
    const got = await changeNotebook(factionId, (state) => {
      const { ledger, paid: due } = payAct(state.ledger, { tick, unitId, kind, value });
      state.ledger = ledger;
      const dossier = state.dossiers[unitId] ?? emptyDossier();
      dossier.intel = (dossier.intel ?? 0) + due;
      state.dossiers[unitId] = dossier;
      return due;
    }, war);
    if (got) paid.set(factionId, got);
  }
  return paid;
}

/**
 * Fire-and-forget form for a resolution path: an act's Intel never blocks or
 * breaks the play that made it.
 *
 * @param {Parameters<typeof noteAct>[0]} act
 * @returns {Promise<void>}
 */
export async function noteActSafely(act) {
  try {
    await noteAct(act);
  } catch (err) {
    console.error(`FGT | Intel for ${act?.kind} by ${act?.unitId} not recorded:`, err);
  }
}

/**
 * The Turn's end: each Faction is told, alone, what it learned this Turn
 * (`EA.card`, reading 30), and its ledger's gains are cleared. A Faction that
 * gained nothing hears nothing; no other Faction learns that Intel was earned
 * (`EA.silent.other`).
 *
 * @param {number} tick the Turn that ended
 * @param {object|null} [war]
 * @returns {Promise<string[]>} the Factions told
 */
export async function sayIntelGains(tick, war = currentWar()) {
  const told = [];
  if (!war || !intelOn(war) || !isWarGM(war)) return told;
  const marked = [...(game.journal ?? [])].filter((j) => j.getFlag?.("fgt", "intelNotebook")?.warId === war.id);
  const escape = foundry.utils.escapeHTML;
  for (const book of marked) {
    const factionId = book.getFlag("fgt", "intelNotebook").factionId;
    const { ledger } = stateOf(book);
    const gains = Object.entries(ledger?.tick === tick ? (ledger.gains ?? {}) : {}).filter(([, n]) => n > 0);
    if (gains.length === 0) continue;
    const rows = [];
    for (const [unitId, n] of gains) {
      const name = await knownNameOf(unitActor(unitId), factionId);
      rows.push(`<p>${game.i18n.format("FGT.Intel.GainLine", { name: escape(name), intel: n })}</p>`);
    }
    const whisper = [...playersOf(factionId, war), ...game.users.filter((u) => u.isGM).map((u) => u.id)];
    await ChatMessage.create({
      content: `<div class="fgt-card fgt-card--intel"><header class="fgt-card__title">${game.i18n.localize("FGT.Intel.GainTitle")}</header>${rows.join("")}</div>`,
      whisper,
      flags: { fgt: { intelGains: factionId } },
    });
    await changeNotebook(factionId, (state) => {
      if (state.ledger?.tick === tick) state.ledger.gains = {};
    }, war);
    told.push(factionId);
  }
  return told;
}

/** For a test or the window: a Faction's Notebook state, read. */
export function notebookState(factionId, war = currentWar()) {
  return stateOf(notebookOf(factionId, war));
}

/* -------------------------------------------------------------------------- */
/*  Buying (#402)                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Has this Unit's body left the board? A final defeat clears it a tick later
 * (`io.clearBody`), and its Dossier is then read-only (reading 26).
 *
 * @param {object|null} actor
 * @returns {boolean}
 */
export function hasFallen(actor) {
  if (!actor?.system?.defeated) return false;
  const scene = canvas?.scene ?? null;
  return !(scene?.tokens?.contents ?? []).some((t) => t.actorId === actor.id);
}

/**
 * What a Faction may not buy of a Unit, and why: filled by the sheets that hide
 * a page (Mordred's Secret of Pedigree, #405). Section and Entry keys.
 *
 * @param {object} _actor
 * @returns {{entries: string[], sections: string[], ranksOnly: string[]}}
 */
export function hiddenFrom(_actor) {
  return { entries: [], sections: [], ranksOnly: [] };
}

/**
 * Buy one Entry or one draw of a Section of a Unit's Dossier, for a Faction,
 * from the Intel banked on that Unit (`BU.*`). Runs on the War's GM; a player's
 * press arrives by socket (`OPERATIONS.intelBuy`).
 *
 * @param {object} args
 * @param {string} args.factionId
 * @param {string} args.unitId
 * @param {string|null} [args.entry] a key of `ENTRY_PRICES`
 * @param {string|null} [args.section] a key of `SECTIONS`
 * @param {string|null} [args.userId] who pressed it, for the card
 * @returns {Promise<{ok: boolean, reason?: string, need?: number, held?: number, drawn?: string|null, complete?: boolean, price?: number}>}
 */
export async function buy({ factionId, unitId, entry = null, section = null, userId = null }) {
  const war = currentWar();
  if (!war || !intelOn(war)) return { ok: false, reason: "off" };
  if (!isWarGM(war)) {
    const { FGTSocket } = await import("../net/socket.mjs");
    return FGTSocket.request("intelBuy", { factionId, unitId, entry, section });
  }
  const actor = unitActor(unitId);
  if (!actor || !factionId) return { ok: false, reason: "unknown" };
  if (hasFallen(actor)) return { ok: false, reason: "fallen" };
  const { ENTRY_PRICES, entriesOf, sectionPrice, sectionOf, drawFrom } = await import("../rules/intel.mjs");
  const { isSpellAbility } = await import("../rules/costs.mjs");
  const hidden = hiddenFrom(actor);

  let price;
  let pool = [];
  if (entry) {
    if (!entriesOf(actor).includes(entry)) return { ok: false, reason: "unknown" };
    if (hidden.entries.includes(entry)) return { ok: false, reason: "hidden" };
    price = ENTRY_PRICES[entry];
  } else if (section) {
    price = sectionPrice(section);
    if (price === null) return { ok: false, reason: "unknown" };
    if (hidden.sections.includes(section)) return { ok: false, reason: "hidden" };
    pool = [...(actor.items ?? [])].filter((i) => sectionOf(i, isSpellAbility) === section)
      .map((i) => i.system?.contentId ?? i.id);
  } else return { ok: false, reason: "unknown" };

  // The draw's die, cast before the queue: what is left is read again inside.
  const before = stateOf(notebookOf(factionId, war)).dossiers[unitId];
  const knownBefore = before?.sections?.[section]?.known ?? [];
  const leftBefore = pool.filter((id) => !knownBefore.includes(id)).length;
  const face = section && leftBefore > 0 ? (await new Roll(`1d${leftBefore}`).evaluate()).total - 1 : 0;

  const result = await changeNotebook(factionId, (state) => {
    const dossier = state.dossiers[unitId];
    if (!dossier) return { ok: false, reason: "noDossier" };
    if (entry && dossier.open?.[entry]) return { ok: false, reason: "open" };
    if (section && dossier.sections?.[section]?.complete) return { ok: false, reason: "complete" };
    const known = dossier.sections?.[section]?.known ?? [];
    const drawn = section ? drawFrom(pool, known, () => face) : null;
    // A draw that finds nothing left costs nothing, and the Section is Complete.
    if (section && !drawn) {
      dossier.sections = { ...dossier.sections, [section]: { known, complete: true } };
      return { ok: true, complete: true, drawn: null, price: 0 };
    }
    if ((dossier.intel ?? 0) < price) return { ok: false, reason: "short", need: price, held: dossier.intel ?? 0 };
    dossier.intel -= price;
    if (entry) dossier.open = { ...dossier.open, [entry]: true };
    else dossier.sections = { ...dossier.sections, [section]: { known: [...known, drawn], complete: false } };
    return { ok: true, drawn, price };
  }, war) ?? { ok: false, reason: "noDossier" };

  if (result.ok) await sayPurchase({ factionId, actor, entry, section, result, userId, war });
  return result;
}

/**
 * The buy's card, whispered to the Faction and the GM (`BU.card`).
 *
 * @returns {Promise<void>}
 */
async function sayPurchase({ factionId, actor, entry, section, result, userId, war }) {
  const escape = foundry.utils.escapeHTML;
  const name = escape(await knownNameOf(actor, factionId));
  const buyer = escape(game.users.get(userId)?.name ?? game.i18n.localize("FGT.Intel.TheFaction"));
  const what = game.i18n.localize(entry ? `FGT.Intel.Entry.${entry}` : `FGT.Intel.Section.${section}`);
  const line = result.complete
    ? game.i18n.format("FGT.Intel.SectionComplete", { name, section: what })
    : game.i18n.format("FGT.Intel.Bought", { buyer, what, name, price: result.price });
  const whisper = [...playersOf(factionId, war), ...game.users.filter((u) => u.isGM).map((u) => u.id)];
  await ChatMessage.create({ content: `<div class="fgt-card fgt-card--intel"><p>${line}</p></div>`, whisper, flags: { fgt: { intelBuy: factionId } } });
}
