/**
 * @file Writing the game log, flushing it, and exporting it.
 * @see docs/30-chat-and-audit.md §30.8, §30.9, §30.10
 *
 * Layer 3. `rules/game-log.mjs` shapes and filters; this stores.
 *
 * The storage split is §30.8's, and it exists to bound one document: the last
 * 200 entries live on `Combat.system.log` for quick access, and older ones
 * flush in batches of 100 to a JournalEntry named after the match. Ch. 22
 * §22.8 records the RISK this answers — a match document that grows all game
 * is a document that eventually fails to save, silently, at the worst moment.
 */

import {
  appendEntry, overrideEntry, splitForFlush, exportPayload, filterLog,
} from "../rules/game-log.mjs";

/**
 * Record an entry on the active Combat.
 *
 * GM-only by construction: the log is authoritative, and a player client
 * writing to it would race the GM's own writes. Everyone else's entries arrive
 * through the intent applier, which already proxies.
 *
 * @param {object} fields see `rules/game-log.mjs` `entry`
 * @param {object} [combat]
 * @returns {Promise<object|null>} the entry written, or null
 */
export async function record(fields, combat = game.combat) {
  if (!combat) return null;

  const current = combat.system?.log ?? [];
  const next = appendEntry(current, {
    globalTurn: combat.system?.globalTurn ?? 0,
    round: combat.round ?? 0,
    ...fields,
  });

  await store(combat, next);
  return next.at(-1);
}

/**
 * Record a GM override of an earlier entry (§30.10).
 *
 * The reason is required by the rules layer, which throws without one. That
 * throw is deliberate and is not caught here: an override with no reason is a
 * hole in the audit trail, and failing loudly at the call site is the only way
 * the caller learns to supply one.
 *
 * @param {number} seq
 * @param {object} args
 * @returns {Promise<boolean>}
 */
export async function override(seq, { original, changed, reason, combat = game.combat }) {
  if (!combat) return false;

  const next = overrideEntry(combat.system?.log ?? [], seq, {
    original, changed, reason,
    byUserId: game.user.id,
    round: combat.round ?? 0,
    globalTurn: combat.system?.globalTurn ?? 0,
  });

  await store(combat, next);
  return true;
}

/**
 * Everything logged this match, flushed entries included.
 *
 * The journal is read back and prepended, so a viewer or an export sees one
 * continuous history rather than the tail that happens to still be resident.
 *
 * @param {object} [combat]
 * @returns {Promise<object[]>}
 */
export async function fullLog(combat = game.combat) {
  if (!combat) return [];

  const journal = combat.system?.logJournalId ? game.journal.get(combat.system.logJournalId) : null;
  const flushed = journal
    ? (journal.pages.contents ?? []).flatMap((page) => parseEntries(page))
    : [];

  return [...flushed, ...(combat.system?.log ?? [])].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

/**
 * The §30.9 export, as a JSON string.
 *
 * Self-contained: the ruleset settings and the roster's setup rolls travel
 * with the entries, so a maintainer replays it without the world. The recorded
 * rolls travel too — with them replay is exact, and without them it is
 * re-simulation, which proves nothing about the bug being reported.
 *
 * @param {object} [combat]
 * @returns {Promise<string>}
 */
export async function exportLog(combat = game.combat) {
  const payload = exportPayload({
    log: await fullLog(combat),
    systemVersion: game.system?.version ?? null,
    settings: settingsSnapshot(),
    roster: rosterSnapshot(combat),
  });
  payload.exportedAt = new Date().toISOString();
  return JSON.stringify(payload, null, 2);
}

/**
 * The entries a viewer asked for.
 * @param {object} filter see `rules/game-log.mjs` `filterLog`
 * @param {object} [combat]
 * @returns {Promise<object[]>}
 */
export async function query(filter, combat = game.combat) {
  return filterLog(await fullLog(combat), filter);
}

/* -------------------------------------------------------------------------- */

/**
 * Write the log back, flushing the overflow to a journal first.
 *
 * The journal write happens **before** the Combat write, so a failure between
 * the two loses nothing: the entries are already durable and the next store
 * will flush them again into the same page rather than dropping them.
 *
 * @param {object} combat
 * @param {object[]} log
 */
async function store(combat, log) {
  const { keep, flush } = splitForFlush(log);

  if (flush.length > 0) await flushToJournal(combat, flush);
  await combat.update({ "system.log": keep });
}

/**
 * @param {object} combat
 * @param {object[]} entries
 */
async function flushToJournal(combat, entries) {
  let journal = combat.system?.logJournalId ? game.journal.get(combat.system.logJournalId) : null;

  if (!journal) {
    journal = await JournalEntry.create({
      name: game.i18n.format("FGT.Log.JournalName", { id: combat.id }),
      // GM-only: the log carries hidden rolls, and a journal every player can
      // read would leak what the cards were careful not to.
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    });
    await combat.update({ "system.logJournalId": journal.id });
  }

  await journal.createEmbeddedDocuments("JournalEntryPage", [{
    name: `${entries[0].seq}–${entries.at(-1).seq}`,
    type: "text",
    // Stored as JSON in a text page rather than as prose: this is a record to
    // be read back and exported, not one to be read.
    text: { content: `<pre>${escapeHtml(JSON.stringify(entries))}</pre>`, format: 1 },
  }]);
}

/** @param {object} page @returns {object[]} */
function parseEntries(page) {
  const raw = String(page.text?.content ?? "").replace(/<[^>]*>/g, "");
  try {
    const parsed = JSON.parse(unescapeHtml(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A page somebody edited by hand. Skipped with a warning rather than
    // throwing, because one unreadable page must not make the whole log
    // unreadable.
    console.warn(`FGT | Log page "${page.name}" is not readable JSON; skipping it.`);
    return [];
  }
}

/** @returns {object} */
function settingsSnapshot() {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of ["difficulty", "region", "grailThreshold", "masterMode", "turnsPerRound", "grandOrder"]) {
    try {
      out[key] = game.settings.get("fgt", key);
    } catch {
      // A setting this world never registered. Absent rather than null, so a
      // reader can tell "not set" from "set to nothing".
    }
  }
  return out;
}

/**
 * The roster, with the setup rolls a replay needs to reproduce the units.
 * @param {object} combat
 * @returns {object[]}
 */
function rosterSnapshot(combat) {
  return (combat?.combatants?.contents ?? []).map((c) => ({
    id: c.actor?.id ?? null,
    name: c.actor?.name ?? c.name,
    type: c.actor?.type ?? null,
    factionId: c.actor?.system?.factionId ?? null,
    parameters: c.actor?.system?.parameters ?? null,
    grantedSteps: c.actor?.system?.grantedSteps ?? null,
    setup: {
      maxHealth: c.actor?.system?.health?.max ?? null,
      maxAgility: c.actor?.system?.agility?.max ?? null,
      maxLuck: c.actor?.system?.luck?.max ?? null,
      baseAttack: c.actor?.system?.baseAttack ?? null,
    },
  }));
}

/** @param {string} s @returns {string} */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** @param {string} s @returns {string} */
function unescapeHtml(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
