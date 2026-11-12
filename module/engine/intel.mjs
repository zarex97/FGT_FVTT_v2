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

import { currentBoard, currentMoment, unitActor, unitSnapshot } from "./board.mjs";
import { currentWar, isWarGM, warRule } from "./war.mjs";
import { witnessesOf, payAct, entriesOf, SECTIONS, sectionOf } from "../rules/intel.mjs";
import { isSpellAbility } from "../rules/costs.mjs";
import { sees } from "../rules/identity.mjs";
import { abilityTag } from "./public-ability.mjs";
import { shownName } from "./public-identity.mjs";
import { changeNotebook, emptyDossier, factionOfUser, intelOn, notebookOf, playersOf, stateOf } from "./intel-store.mjs";

/**
 * What a Faction keeps of an ability it learned: its Public Tag, and its name
 * once it learned the full text. Kept so a row still names it after its bearer
 * loses it (SE.change.lose): the Item, and the tag drawn from it, are gone then.
 *
 * @param {object} item
 * @param {object|undefined} before what the Faction already kept
 * @param {boolean} full
 * @returns {{tag: string, full?: boolean, name?: string}}
 */
function keptOf(item, before, full) {
  const kept = { ...(before ?? {}), tag: abilityTag(item) };
  // fgt-name-ok: kept only where its Faction learned the full text
  if (full || kept.full) Object.assign(kept, { full: true, name: item.name });
  return kept;
}

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
  const tick = currentMoment().tick ?? 0;
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
 * What a Faction may not buy of a Unit: the Entries and Sections a
 * `HidesInformation` rule leaves out, and the Stats it sells the Rank of alone
 * (Secret of Pedigree, MO.*). Read off the Unit's projection, so a Mode switched
 * off hides nothing.
 *
 * @param {object} actor
 * @returns {{entries: string[], sections: string[], ranksOnly: string[]}}
 */
export function hiddenFrom(actor) {
  const none = { entries: [], sections: [], ranksOnly: [] };
  if (!actor) return none;
  const rules = unitSnapshot(actor)?.hidesInformation ?? [];
  if (rules.length === 0) return none;
  const buyable = new Set(rules.flatMap((r) => r.buyable ?? []));
  return {
    entries: entriesOf(actor).filter((k) => !buyable.has(k)),
    sections: SECTIONS.map((x) => x.key).filter((k) => !buyable.has(k)),
    ranksOnly: [...new Set(rules.flatMap((r) => r.ranksOnly ?? []))],
  };
}

/**
 * The false Class and Parameters a Faction reads of a Unit that shows them
 * (Camouflage, HE.*): null when it shows none, or when the Faction knows the
 * truth (its NP witnessed, HE.np).
 *
 * @param {object|null} actor
 * @param {string|null} factionId
 * @returns {{className: string, parameters: Record<string, string>}|null}
 */
export function falseViewOf(actor, factionId) {
  if (!actor || !(unitSnapshot(actor)?.falseInformation ?? []).length) return null;
  const view = actor.system?.falseInformation ?? null;
  if (!view?.parameters) return null;
  if (factionId && stateOf(notebookOf(factionId)).dossiers[actor.id]?.identity) return null;
  return view;
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
  const { ENTRY_PRICES, entriesOf, sectionPrice, sectionOf, drawFrom, isSectionComplete } = await import("../rules/intel.mjs");
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
    if (section && isSectionComplete(dossier.sections?.[section], pool)) return { ok: false, reason: "complete" };
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
    else {
      dossier.sections = { ...dossier.sections, [section]: { known: [...known, drawn], complete: false } };
      const item = [...(actor.items ?? [])].find((i) => (i.system?.contentId ?? i.id) === drawn);
      if (item) dossier.abilities = { ...dossier.abilities, [drawn]: keptOf(item, dossier.abilities?.[drawn], false) };
    }
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
      const held = items.filter((i) => sectionOf(i, isSpellAbility) === key);
      const known = held.map((i) => i.system?.contentId ?? i.id);
      sections[key] = { known, complete: true };
      for (const i of held) {
        const id = i.system?.contentId ?? i.id;
        dossier.abilities = { ...dossier.abilities, [id]: keptOf(i, dossier.abilities?.[id], true) };
      }
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
  // Camouflage's picks, asked when a War begins (HE.setup).
  Hooks.on("combatStart", () => { void askCamouflage().catch((err) => console.error("FGT | Camouflage:", err)); });
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
      // A face known now is redrawn; a bar bought now is shown.
      if (token.actor?.type === "servant") token.renderFlags?.set?.({ redraw: true });
      else if (token.actor?.type === "master") token.renderFlags?.set?.({ refreshState: true });
    }
  };
  Hooks.on("updateJournalEntry", (j) => void refresh(j));
  Hooks.on("createJournalEntry", (j) => void refresh(j));
}

/* -------------------------------------------------------------------------- */
/*  Cloaked lines (#404)                                                       */
/* -------------------------------------------------------------------------- */

/** What a cloaked figure reads. */
export const CLOAK = "■■■";

/** The Stat a roll reads, by its check (CL.target, CL.luck, CL.evade). */
const CHECK_STAT = Object.freeze({
  evade: "agi", agility: "agi",
  luck: "luc", luckyEvasion: "luc", luckyHit: "luc", prevention: "luc", counterContest: "luc", overpower: "luc",
});

/**
 * Does this viewer read everything of this Unit's lines? Its owner and the GM
 * do, and everyone at an open table or with the Information System off (CL.owner,
 * CL.gm, WR.off.cloak).
 *
 * @param {object|null} actor
 * @param {object} user
 * @returns {boolean}
 */
function readsAllOf(actor, user) {
  if (!actor || user?.isGM) return true;
  if (actor.testUserPermission?.(user, "OWNER")) return true;
  const war = currentWar();
  if (!war || !intelOn(war)) return true;
  return !warRule("closedInfo", war);
}

/**
 * The viewer's Faction's Dossier on a Unit, or null.
 *
 * @param {string} unitId
 * @param {object} user
 * @returns {object|null}
 */
function viewersDossier(unitId, user) {
  const war = currentWar();
  const factionId = factionOfUser(user, war);
  return factionId ? (stateOf(notebookOf(factionId, war)).dossiers[unitId] ?? null) : null;
}

/**
 * Does this viewer read this Stat of this Unit: its owner, or a Faction that
 * bought it, and never a pool a sheet hides (Secret of Pedigree, MO.cloak)?
 *
 * @param {string} unitId
 * @param {string} entry a Stat key
 * @param {object} [user]
 * @returns {boolean}
 */
export function viewerOpens(unitId, entry, user = game.user) {
  const actor = unitActor(unitId);
  if (readsAllOf(actor, user)) return true;
  if (hiddenFrom(actor).ranksOnly.includes(entry)) return false;
  return Boolean(viewersDossier(unitId, user)?.open?.[entry]);
}

/**
 * Does this viewer know this ability of this Unit: drawn from its Section, or
 * learned in full?
 *
 * @param {string} unitId
 * @param {string} contentId
 * @param {object} [user]
 * @returns {boolean}
 */
export function viewerKnowsAbility(unitId, contentId, user = game.user) {
  const actor = unitActor(unitId);
  if (readsAllOf(actor, user)) return true;
  const d = viewersDossier(unitId, user);
  if (!d) return false;
  if (d.abilities?.[contentId]?.full) return true;
  return Object.values(d.sections ?? {}).some((s) => (s?.known ?? []).includes(contentId));
}

/**
 * A figure on a stored line, cloaked until a viewer's client opens it: the
 * text a client shows before it draws its own view is the cloak (CL.stored).
 *
 * @param {string} unitId
 * @param {string} entry a Stat key
 * @param {string} text the figure
 * @returns {string}
 */
export function cloakMark(unitId, entry, text) {
  return `⟦c|${unitId}|${entry}|${text}⟧`;
}

/** A cloak mark in text. */
const MARK = /⟦c\|([^|⟧]*)\|([^|⟧]*)\|([^⟧]*)⟧/g;

/**
 * Open or keep closed every cloak mark in a rendered card, for this viewer.
 *
 * @param {HTMLElement} root
 * @param {object} [user]
 * @returns {void}
 */
export function openCloaks(root, user = game.user) {
  if (!root?.ownerDocument) return;
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.includes("⟦c|")) nodes.push(walker.currentNode);
  for (const node of nodes) {
    node.nodeValue = node.nodeValue.replace(MARK, (_m, unitId, entry, text) => (viewerOpens(unitId, entry, user) ? text : CLOAK));
  }
}

/**
 * A roll record as this viewer may read it (CL.roll … CL.face): *"Saber's ■■■,
 * rolled ■■■ against ■■■"*. The ability's blank opens as its Public Tag on its
 * Entry; the target opens on that Entry or on the Stat the roll reads; the die
 * face opens with its target, never alone. The breakdown shows only when the
 * target does.
 *
 * @param {object} r a roll record
 * @param {object} [user]
 * @returns {object}
 */
export function cloakRoll(r, user = game.user) {
  const actor = r?.actorId ? unitActor(r.actorId) : null;
  if (!actor || readsAllOf(actor, user)) return r;
  const item = r.abilityRef
    ? (actor.items?.get?.(r.abilityRef) ?? [...(actor.items ?? [])].find((i) => i.system?.contentId === r.abilityRef) ?? null)
    : null;
  const cid = item ? (item.system?.contentId ?? item.id) : null;
  const abilityOpen = cid ? viewerKnowsAbility(actor.id, cid, user) : false;
  const stat = CHECK_STAT[r.check] ?? null;
  const targetOpen = abilityOpen || (stat ? viewerOpens(actor.id, stat, user) : false);
  if (targetOpen && (!item || abilityOpen)) return r;
  const name = item
    ? (abilityOpen ? abilityTag(item) : CLOAK)
    : (stat ? game.i18n.localize(`FGT.Intel.Check.${r.check}`) : CLOAK);
  const who = viewerKnowsIdentity(actor, user) ? (actor.system?.trueName || actor.name) : shownName(actor); // fgt-name-ok: the True Name only to a Faction that knows it
  const purpose = game.i18n.format("FGT.Intel.CloakedRoll", {
    who,
    name,
    roll: targetOpen ? String(r.total ?? r.raw ?? CLOAK) : CLOAK,
    target: targetOpen ? String(r.target ?? CLOAK) : CLOAK,
  });
  return { ...r, purpose, cloaked: true, breakdownHidden: !targetOpen };
}

/**
 * A stored line's cloak marks opened or closed: the text a viewer reads.
 *
 * @param {string} text
 * @param {(unitId: string, entry: string) => boolean} [opens] open for everyone by default: the GM's reading
 * @returns {string}
 */
export function openMarks(text, opens = () => true) {
  return String(text ?? "").replace(MARK, (_m, unitId, entry, figure) => (opens(unitId, entry) ? figure : CLOAK));
}

/* -------------------------------------------------------------------------- */
/*  The sheets that teach and erase (#405)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Open one ability for a Faction, name and full text, out of its Section's draw
 * (Appreciation of the Arts, Coercion: AA.entry, FB.coerce.open).
 *
 * @param {string} factionId
 * @param {object} owner the ability's bearer
 * @param {object} item the ability
 * @returns {Promise<void>}
 */
export async function teachAbility(factionId, owner, item) {
  if (!factionId || !owner || !item) return;
  const cid = item.system?.contentId ?? item.id;
  const section = sectionOf(item, isSpellAbility);
  await changeNotebook(factionId, (state) => {
    const dossier = state.dossiers[owner.id] ?? emptyDossier();
    dossier.abilities = { ...dossier.abilities, [cid]: keptOf(item, dossier.abilities?.[cid], true) };
    if (section) {
      const mark = dossier.sections?.[section] ?? { known: [], complete: false };
      if (!(mark.known ?? []).includes(cid)) mark.known = [...(mark.known ?? []), cid];
      dossier.sections = { ...dossier.sections, [section]: mark };
    }
    state.dossiers[owner.id] = dossier;
  });
}

/**
 * Coercion: *"force the DU to give full information of one of its Skills other
 * than Class Skills"* (FB.coerce). The DU's player picks; the caster's Faction
 * learns it in full.
 *
 * @param {object} caster
 * @param {object} target the DU's actor
 * @returns {Promise<object[]>} card rows
 */
export async function revealSkill(caster, target) {
  const factionId = caster?.system?.factionId ?? null;
  const skills = [...(target?.items ?? [])].filter((i) => i.type === "ability" && i.system?.kind !== "classSkill"); // fgt-offer-ok: a Skill to describe, never to use
  if (!factionId || skills.length === 0) return [];
  const { chooseFor } = await import("./ask.mjs");
  const picked = await chooseFor(target, {
    title: game.i18n.localize("FGT.Intel.CoerceTitle"),
    hint: game.i18n.localize("FGT.Intel.CoerceHint"),
    count: 1, min: 1,
    // fgt-name-ok: the DU's own player chooses among its own Skills
    options: skills.map((i) => ({ id: i.id, name: i.name })),
  });
  const item = skills.find((i) => i.id === (picked ?? [])[0]) ?? skills[0];
  await teachAbility(factionId, target, item);
  const row = game.i18n.format("FGT.Intel.Coerced", { tag: abilityTag(item) });
  return [{ unitId: target.id, summary: { id: "revealSkill", name: row, outcome: "applied", reason: null, chance: null } }];
}

/**
 * Classified: *"all of its information (from its Notebook page) is immediately
 * shared to all Units within a 2 panel area of itself"* (FB.classified): every
 * Faction with a Unit within `radius` of it, but its own, learns its whole page.
 *
 * @param {object} target the DU's actor
 * @param {number} radius
 * @param {object} board
 * @returns {Promise<string[]>} the Factions told
 */
export async function revealDossier(target, radius, board = currentBoard()) {
  const unit = (board.units ?? []).find((u) => u.id === target?.id);
  if (!unit?.panel) return [];
  const own = target.system?.factionId ?? null;
  const factions = new Set();
  for (const u of board.units ?? []) {
    if (u.id === unit.id || u.defeated || !u.panel) continue;
    const f = u.faction ?? u.factionId ?? null;
    if (!f || f === own) continue;
    const d = Math.max(Math.abs(u.panel.i - unit.panel.i), Math.abs(u.panel.j - unit.panel.j));
    if (d <= radius) factions.add(f);
  }
  for (const f of factions) {
    await keepKnowledgeOf(f, target);
    await sayToFaction(f, game.i18n.format("FGT.Intel.Classified", { name: foundry.utils.escapeHTML(shownName(target)) }), "intelClassified");
  }
  return [...factions];
}

/**
 * A line whispered to one Faction and the GM.
 *
 * @param {string} factionId
 * @param {string} line HTML
 * @param {string} flag
 * @returns {Promise<void>}
 */
async function sayToFaction(factionId, line, flag) {
  const war = currentWar();
  const whisper = [...playersOf(factionId, war), ...game.users.filter((u) => u.isGM).map((u) => u.id)];
  await ChatMessage.create({ content: `<div class="fgt-card fgt-card--intel"><p>${line}</p></div>`, whisper, flags: { fgt: { [flag]: factionId } } });
}

/**
 * Information Erasure: when a Unit that erases leaves an enemy Unit's Detect,
 * that Unit's Faction loses every Entry, its Intel and its knowledge of its
 * identity on it, said to that Faction (JA.*, reading 17). Asked after a
 * voluntary Move, of the mover and of every eraser the mover watched.
 *
 * @param {object} args
 * @param {string} args.moverId
 * @param {{i: number, j: number}} args.from
 * @param {{i: number, j: number}} args.to
 * @returns {Promise<string[]>} the Factions whose record was erased
 */
export async function eraseOnLeaving({ moverId, from, to }) {
  const war = currentWar();
  if (!war || !intelOn(war) || !isWarGM(war)) return [];
  const board = currentBoard();
  const mover = (board.units ?? []).find((u) => u.id === moverId);
  if (!mover) return [];
  const at = (u, p) => ({ ...u, panel: { ...(u.panel ?? {}), i: p.i, j: p.j } });
  const erasers = (board.units ?? []).filter((u) => (u.erasesInformation ?? []).length > 0 && !u.defeated);
  const lost = new Set();
  for (const jack of erasers) {
    const own = jack.faction ?? jack.factionId ?? null;
    const watchers = (board.units ?? []).filter((w) => w.id !== jack.id && !w.defeated && w.panel
      && (w.faction ?? w.factionId) && (w.faction ?? w.factionId) !== own);
    for (const w of watchers) {
      let before;
      let after;
      if (mover.id === jack.id) {
        before = sees(w, at(jack, from), board);
        after = sees(w, at(jack, to), board);
      } else if (mover.id === w.id) {
        before = sees(at(w, from), jack, board);
        after = sees(at(w, to), jack, board);
      } else continue;
      if (before && !after) lost.add(`${w.faction ?? w.factionId}|${jack.id}`);
    }
  }
  const told = [];
  for (const key of lost) {
    const [factionId, jackId] = key.split("|");
    const had = await changeNotebook(factionId, (state) => {
      const held = Boolean(state.dossiers[jackId]);
      delete state.dossiers[jackId];
      return held;
    }, war);
    if (!had) continue;
    await sayToFaction(factionId, game.i18n.format("FGT.Intel.Erased", { name: foundry.utils.escapeHTML(shownName(unitActor(jackId))) }), "intelErased");
    told.push(factionId);
  }
  return told;
}

/**
 * True Name Discernment's active on a Unit that shrouds it with a coin (Hassan
 * of the Fathomless Rift, HA.coin, HA.luck): Heads opens its seven Stats to the
 * user's Faction, unless its own Luck Check succeeds.
 *
 * @param {object} userActor the Ruler
 * @param {object} target
 * @returns {Promise<{coin: number|null, check: boolean|null, opened: boolean}>}
 */
export async function shroudedDiscernment(userActor, target) {
  const shrouds = unitSnapshot(target)?.trueNameShrouds ?? [];
  const out = { coin: null, check: null, opened: false };
  if (shrouds.length === 0) return out;
  if (shrouds.some((s) => s.active === "negated")) return out;
  const factionId = userActor?.system?.factionId ?? null;
  out.coin = (await new Roll("1d2").evaluate()).total;
  if (out.coin === 1) {
    const { luckCheck } = await import("../rules/checks.mjs");
    const roll = (await new Roll("1d20").evaluate()).total;
    const result = luckCheck({ roll, luck: Number(target.system?.luck?.value ?? 0) });
    out.check = Boolean(result?.success);
    if (!out.check && factionId) {
      await changeNotebook(factionId, (state) => {
        const dossier = state.dossiers[target.id] ?? emptyDossier();
        dossier.open = { ...dossier.open, str: true, end: true, agi: true, mag: true, luc: true, mov: true, range: true };
        state.dossiers[target.id] = dossier;
      });
      out.opened = true;
    }
  }
  if (factionId) {
    const key = out.coin === null ? null : (out.coin !== 1 ? "FGT.Intel.ShroudTails" : (out.opened ? "FGT.Intel.ShroudOpened" : "FGT.Intel.ShroudHeld"));
    if (key) await sayToFaction(factionId, game.i18n.format(key, { name: foundry.utils.escapeHTML(shownName(target)) }), "intelShroud");
  }
  return out;
}

/** The Ranks a false Parameter may show (HE.setup). */
const FALSE_RANKS = Object.freeze(["E", "D", "C", "B", "A", "A+", "EX"]);

/**
 * Camouflage's setup (HE.setup): her player picks a false Class, then a false
 * Rank for each Parameter. Asked once a War, on its GM, of every Servant that
 * shows false information and has none yet. Her owner answers; nobody else sees
 * the question.
 *
 * @param {object|null} [war]
 * @returns {Promise<string[]>} the Servants set up
 */
export async function askCamouflage(war = currentWar()) {
  const done = [];
  if (!war || !isWarGM(war)) return done;
  const { SERVANT_CLASSES } = await import("../domain/enums.mjs");
  const { chooseFor } = await import("./ask.mjs");
  const board = currentBoard();
  for (const unit of board.units ?? []) {
    if (unit.kind !== "servant" || !(unit.falseInformation ?? []).length) continue;
    const actor = unitActor(unit.id);
    if (!actor || actor.system?.falseInformation?.parameters) continue;
    const pick = async (title, options) => ((await chooseFor(actor, { title, count: 1, min: 1, options })) ?? [])[0] ?? null;
    const cls = await pick(game.i18n.localize("FGT.Intel.FalseClass"),
      SERVANT_CLASSES.map((c) => ({ id: c, name: game.i18n.localize(`FGT.Class.${c}`) })));
    if (!cls) continue;
    const parameters = {};
    for (const key of ["str", "end", "agi", "mag", "luc"]) {
      const rank = await pick(game.i18n.format("FGT.Intel.FalseRank", { stat: game.i18n.localize(`FGT.Intel.Entry.${key}`) }),
        FALSE_RANKS.map((r) => ({ id: r, name: r })));
      parameters[key] = rank ?? actor.system?.parameters?.[key] ?? "E";
    }
    const className = game.i18n.localize(`FGT.Class.${cls}`);
    const { applyWorldIntents } = await import("./applier.mjs");
    const I = await import("./intents.mjs");
    await applyWorldIntents([I.setCamouflage(actor.id, { className, parameters })], "camouflage");
    done.push(actor.id);
  }
  return done;
}
