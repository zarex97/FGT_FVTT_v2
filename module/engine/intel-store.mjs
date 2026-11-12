/**
 * @file A Faction's Notebook: what one Faction knows of every Unit it does not own.
 * @see docs/superpowers/specs/2026-11-12-information-system.md (ST.*), docs/adr/0008-knowledge-belongs-to-the-faction.md
 *
 * Layer 3. One Journal Entry per Faction per War (readings 1, 19), read by the
 * Faction's players and the GM and by nobody else, written by the War's GM only
 * (`ST.write`). Its state, the Dossiers and the Turn's ledger, is ONE JSON flag:
 * an ObjectField merges what it is given and a key taken away stays (Ch. 30's
 * Secret Poison trap), so the state is replaced whole on every write.
 *
 * Writes queue behind one another on this client (the check-then-act lesson):
 * an area Attack declares a Process per defender, and each pays Intel.
 */

import { currentWar, isWarGM, warRule } from "./war.mjs";
import { factions } from "./board.mjs";
import { emptyLedger } from "../rules/intel.mjs";

/** The flag that marks a Faction's Notebook, `{factionId, warId}`. */
const MARK = "intelNotebook";
/** The flag that holds its state, as JSON. */
const STATE = "intelState";
/** A per-player Notebook from before the Information System (#297, #323). */
const LEGACY = "notebook";

/**
 * Is the Information System on for this War (`WR.rule`)?
 *
 * @param {object|null} [war]
 * @returns {boolean}
 */
export function intelOn(war = currentWar()) {
  return warRule("informationSystem", war) !== false;
}

/**
 * A Dossier as a Faction first holds it: nothing open, nothing banked.
 *
 * @returns {object}
 */
export function emptyDossier() {
  return { intel: 0, open: {}, sections: {}, abilities: {}, identity: false, fallen: false };
}

/**
 * @param {object|null} journal
 * @returns {{dossiers: Record<string, object>, ledger: object}}
 */
export function stateOf(journal) {
  const raw = journal?.getFlag?.("fgt", STATE);
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    parsed = null;
  }
  return {
    dossiers: { ...(parsed?.dossiers ?? {}) },
    ledger: parsed?.ledger ?? emptyLedger(),
  };
}

/**
 * The players of a Faction, from the War's roster.
 *
 * @param {string} factionId
 * @param {object|null} [war]
 * @returns {string[]} user ids
 */
export function playersOf(factionId, war = currentWar()) {
  return (factions(war).find((f) => f.id === factionId)?.userIds ?? []).filter((id) => !game.users?.get(id)?.isGM);
}

/**
 * The Faction a user plays, in this War.
 *
 * @param {object} user
 * @param {object|null} [war]
 * @returns {string|null}
 */
export function factionOfUser(user, war = currentWar()) {
  if (!user) return null;
  return factions(war).find((f) => (f.userIds ?? []).includes(user.id))?.id ?? null;
}

/**
 * A Faction's Notebook, if it exists.
 *
 * @param {string} factionId
 * @param {object|null} [war]
 * @returns {object|null}
 */
export function notebookOf(factionId, war = currentWar()) {
  const warId = war?.id ?? null;
  return (game.journal ?? []).find((j) => {
    const mark = j.getFlag?.("fgt", MARK);
    return mark && mark.factionId === factionId && (mark.warId ?? null) === warId;
  }) ?? null;
}

/**
 * Who may open a Faction's Notebook: its players read it, nobody else does
 * (`ST.faction`, `ST.private`). Read, not owned: the state is the GM's to write
 * (`ST.write`), and a player who owned the journal could write it from the console.
 *
 * @param {string} factionId
 * @param {object|null} war
 * @returns {Record<string, number>}
 */
function ownershipFor(factionId, war) {
  const NONE = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0;
  const OBSERVER = CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  const out = { default: NONE };
  for (const id of playersOf(factionId, war)) out[id] = OBSERVER;
  return out;
}

/**
 * A Faction's Notebook, made the first time it is needed. GM only.
 *
 * @param {string} factionId
 * @param {object|null} [war]
 * @returns {Promise<object|null>}
 */
export async function ensureNotebook(factionId, war = currentWar()) {
  const held = notebookOf(factionId, war);
  if (held) return held;
  if (!game.user?.isGM || !factionId) return null;
  const name = factions(war).find((f) => f.id === factionId)?.name ?? factionId;
  return JournalEntry.create({
    name: game.i18n.format("FGT.Intel.NotebookTitle", { faction: name }),
    ownership: ownershipFor(factionId, war),
    flags: { fgt: { [MARK]: { factionId, warId: war?.id ?? null }, [STATE]: JSON.stringify({ dossiers: {}, ledger: emptyLedger() }) } },
  });
}

/** The queue every write waits its turn in. */
let queue = Promise.resolve();

/**
 * Change a Faction's Notebook: read its state, hand it to `change`, write what
 * comes back whole. Runs on the War's GM only, one write at a time.
 *
 * @template T
 * @param {string} factionId
 * @param {(state: {dossiers: object, ledger: object}) => T} change mutates the state; its return is handed back
 * @param {object|null} [war]
 * @returns {Promise<T|null>}
 */
export function changeNotebook(factionId, change, war = currentWar()) {
  const run = queue.then(async () => {
    if (!factionId || !(game.user?.isGM && (isWarGM(war) || !war))) return null;
    const book = await ensureNotebook(factionId, war);
    if (!book) return null;
    const state = stateOf(book);
    const result = change(state);
    await book.update({
      [`flags.fgt.${STATE}`]: JSON.stringify(state),
      ownership: ownershipFor(factionId, war),
    });
    return result;
  });
  queue = run.catch((err) => console.error("FGT | Notebook write failed:", err));
  return run;
}

/**
 * One Faction's Dossier on one Unit, as stored (a copy), or null.
 *
 * @param {string} factionId
 * @param {string} unitId
 * @param {object|null} [war]
 * @returns {object|null}
 */
export function dossierOf(factionId, unitId, war = currentWar()) {
  const book = notebookOf(factionId, war);
  return book ? (stateOf(book).dossiers[unitId] ?? null) : null;
}

/**
 * Fold every per-player Notebook from before the Information System into its
 * player's Faction's, page by page, then delete it (`ST.mig.*`, reading 31).
 * A player in no Faction keeps theirs and is named to the GM. Runs once in
 * effect: a second pass finds nothing to fold.
 *
 * @param {object|null} [war]
 * @returns {Promise<{folded: string[], skipped: string[]}>}
 */
export async function foldPlayerNotebooks(war = currentWar()) {
  const out = { folded: [], skipped: [] };
  if (!game.user?.isGM || !war) return out;
  const legacy = [...(game.journal ?? [])].filter((j) => j.getFlag?.("fgt", LEGACY));
  for (const old of legacy) {
    const userId = old.getFlag("fgt", LEGACY);
    const user = game.users?.get(userId) ?? null;
    const factionId = factionOfUser(user, war);
    if (!factionId) {
      out.skipped.push(user?.name ?? userId);
      continue;
    }
    const book = await ensureNotebook(factionId, war);
    if (!book) continue;
    const held = new Set([...(book.pages ?? [])].map((p) => p.getFlag?.("fgt", "key")).filter(Boolean));
    const pages = [...(old.pages ?? [])]
      .filter((p) => !held.has(p.getFlag?.("fgt", "key")))
      .map((p) => ({ name: p.name, type: "text", text: { content: p.text?.content ?? "" }, flags: { fgt: { key: p.getFlag?.("fgt", "key") ?? null } } }));
    if (pages.length > 0) await book.createEmbeddedDocuments("JournalEntryPage", pages);
    await old.delete();
    out.folded.push(user?.name ?? userId);
  }
  if (out.skipped.length > 0) {
    const names = out.skipped.join(", ");
    // fgt-name-ok: a GM-only notice naming players, not Units
    ui.notifications?.warn(game.i18n.format("FGT.Intel.MigrationSkipped", { names }));
    console.warn(`FGT | Notebooks not folded (no Faction): ${names}`);
  }
  return out;
}
