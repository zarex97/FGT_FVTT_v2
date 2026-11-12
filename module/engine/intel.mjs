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
import { changeNotebook, emptyDossier, factionOfUser, intelOn, notebookOf, playersOf, stateOf } from "./intel-store.mjs";

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
    let revealed = false;
    const got = await changeNotebook(factionId, (state) => {
      const { ledger, paid: due } = payAct(state.ledger, { tick, unitId, kind, value });
      state.ledger = ledger;
      const dossier = state.dossiers[unitId] ?? emptyDossier();
      dossier.intel = (dossier.intel ?? 0) + due;
      // An NP witnessed reveals its user to this Faction: its True Name, and
      // its seven Stats, Region and Attributes, free (reading 6).
      if (kind === "np") {
        revealed = !dossier.identity;
        dossier.identity = true;
        dossier.open = { ...dossier.open, ...Object.fromEntries(NP_REVEALS.map((k) => [k, true])) };
      }
      state.dossiers[unitId] = dossier;
      return due;
    }, war);
    if (got) paid.set(factionId, got);
    if (revealed) await sayReveal(factionId, unitId, war);
  }
  return paid;
}

/** What an NP witnessed opens for free (reading 6). */
const NP_REVEALS = Object.freeze(["str", "end", "agi", "mag", "luc", "mov", "range", "region", "attributes"]);

/**
 * The reveal, said to the Faction that witnessed it alone (`NP.card`).
 *
 * @param {string} factionId
 * @param {string} unitId
 * @param {object} war
 * @returns {Promise<void>}
 */
async function sayReveal(factionId, unitId, war) {
  const actor = unitActor(unitId);
  if (!actor) return;
  const { publicIdentityOf } = await import("./public-identity.mjs");
  const escape = foundry.utils.escapeHTML;
  const line = game.i18n.format("FGT.Intel.Revealed", {
    name: escape(publicIdentityOf(actor, currentBoard()).name),
    // fgt-name-ok: whispered to the Faction that witnessed the NP, which now knows it
    trueName: escape(actor.system?.trueName || actor.name),
  });
  const whisper = [...playersOf(factionId, war), ...game.users.filter((u) => u.isGM).map((u) => u.id)];
  await ChatMessage.create({ content: `<div class="fgt-card fgt-card--intel"><p>${line}</p></div>`, whisper, flags: { fgt: { intelReveal: factionId } } });
}

/**
 * Does this viewer know this Unit's identity? Its owner and the GM do; with the
 * Information System off, the public flag decides (WR.off.id); else the
 * viewer's Faction's Notebook does (ID.store). The one reader for cards, tokens
 * and the window.
 *
 * @param {object|null} actor
 * @param {object} [user]
 * @returns {boolean}
 */
export function viewerKnowsIdentity(actor, user = game.user) {
  if (!actor) return false;
  if (user?.isGM || actor.testUserPermission?.(user, "OWNER")) return true;
  if (actor.system?.identityRevealed) return true;
  const war = currentWar();
  if (!war || !intelOn(war)) return false;
  const factionId = factionOfUser(user, war);
  if (!factionId) return false;
  return Boolean(stateOf(notebookOf(factionId, war)).dossiers[actor.id]?.identity);
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

/* -------------------------------------------------------------------------- */
/*  Listeners (#403)                                                           */
/* -------------------------------------------------------------------------- */

/** A Unit's Faction before an update moved it, by actor id, on the GM. */
const leaving = new Map();

/**
 * The Faction a Unit leaves keeps full knowledge of it (FC.left): every Entry
 * open, every Section Complete with all it holds, and its identity.
 *
 * @param {string} factionId the Faction it left
 * @param {object} actor
 * @returns {Promise<void>}
 */
export async function keepKnowledgeOf(factionId, actor) {
  const { entriesOf, sectionOf, SECTIONS } = await import("../rules/intel.mjs");
  const { isSpellAbility } = await import("../rules/costs.mjs");
  const items = [...(actor.items ?? [])];
  await changeNotebook(factionId, (state) => {
    const dossier = state.dossiers[actor.id] ?? emptyDossier();
    dossier.identity = true;
    dossier.open = { ...dossier.open, ...Object.fromEntries(entriesOf(actor).map((k) => [k, true])) };
    const sections = {};
    for (const { key } of SECTIONS) {
      const known = items.filter((i) => sectionOf(i, isSpellAbility) === key).map((i) => i.system?.contentId ?? i.id);
      sections[key] = { known, complete: true };
      for (const id of known) dossier.abilities = { ...dossier.abilities, [id]: { full: true } };
    }
    dossier.sections = sections;
    state.dossiers[actor.id] = dossier;
  });
}

/**
 * Bind the Information System's listeners.
 *
 * @returns {void}
 */
export function attachIntel() {
  // FC.left: the GM notes the Faction a Unit leaves, then keeps its knowledge.
  Hooks.on("preUpdateActor", (actor, changes) => {
    if (!game.user?.isGM || changes?.system?.factionId === undefined) return;
    const was = actor.system?.factionId ?? null;
    if (was && was !== changes.system.factionId) leaving.set(actor.id, was);
  });
  Hooks.on("updateActor", (actor) => {
    const was = leaving.get(actor.id);
    if (!was) return;
    leaving.delete(actor.id);
    if (!["servant", "master"].includes(actor.type) || !isWarGM()) return;
    keepKnowledgeOf(was, actor).catch((err) => console.error("FGT | Knowledge not kept:", err));
  });
  // A Notebook changed: what this client's viewer knows may have changed with
  // it, so names, tags and faces are asked again (ID.card, ID.token).
  const refresh = async (journal) => {
    if (!journal?.getFlag?.("fgt", "intelNotebook")) return;
    const { forgetAbilityTruths } = await import("./public-ability.mjs");
    forgetAbilityTruths();
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
      if (token.actor?.type === "servant") token.renderFlags?.set?.({ redraw: true });
    }
  };
  Hooks.on("updateJournalEntry", (j) => void refresh(j));
  Hooks.on("createJournalEntry", (j) => void refresh(j));
}
