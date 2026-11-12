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
 * its identity (`identityKnownBy`, or the public flag), its public name else.
 *
 * @param {object|null} actor
 * @param {string} factionId
 * @param {object} [board]
 * @returns {Promise<string>}
 */
export async function knownNameOf(actor, factionId, board = currentBoard()) {
  if (!actor) return "";
  const { publicIdentityOf } = await import("./public-identity.mjs");
  const known = Boolean(actor.system?.identityRevealed)
    || [...(actor.system?.identityKnownBy ?? [])].includes(factionId);
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
