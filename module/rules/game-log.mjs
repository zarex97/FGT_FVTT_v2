/**
 * @file The game log — the structured record, and GM overrides within it.
 * @see docs/30-chat-and-audit.md §30.8, §30.9, §30.10
 *
 * Layer 2 (rules). Pure: shapes entries, filters them, decides what to flush,
 * and builds the export payload. The engine does the writing.
 *
 * Chat is ephemeral in practice — it scrolls, it gets cleared, and it
 * interleaves with out-of-character talk. This is the record that survives all
 * three, and the one an export and a replay are built from.
 *
 * The two properties worth stating up front, because both are easy to lose:
 *
 * 1. **Sequence numbers are stable.** An override references the entry it
 *    modified by `seq`, so renumbering on append would silently repoint every
 *    override at a different entry.
 * 2. **An override never replaces.** P6 lets the GM change anything; "report
 *    outcomes faithfully" says the record must show that they did. Keeping only
 *    the new value satisfies the first and destroys the second.
 */

/**
 * Every kind of entry, from §30.8.
 *
 * Closed, and validated on construction. A typo'd kind is worse than a missing
 * entry: it is *in* the log, and no filter in the viewer will ever match it, so
 * it is invisible in exactly the place someone is looking for it.
 */
export const LOG_KINDS = Object.freeze([
  "attack", "ability", "effect", "movement", "contract",
  "commandSpell", "defeat", "scheduler", "grail", "gmOverride",
]);

const KINDS = new Set(LOG_KINDS);

/** §30.8: the last 200 live on the Combat; older ones flush in batches of 100. */
export const LOG_CAP = 200;
export const FLUSH_BATCH = 100;

/**
 * One log entry.
 *
 * `rolls` and `detail` are defaulted rather than left undefined, because an
 * undefined value serializes to a *missing key* — and the exporter would then
 * produce a file whose entries the replayer cannot read uniformly.
 *
 * @param {object} args
 * @returns {object}
 */
export function entry({
  seq = 0, globalTurn = 0, round = 0, kind,
  actorIds = [], summary = "", detail = null, rolls = [],
  messageId = null, ...rest
}) {
  if (!KINDS.has(kind)) {
    throw new RangeError(
      `FGT | Unknown log kind "${kind}". Expected one of: ${LOG_KINDS.join(", ")}.`,
    );
  }
  return {
    seq, globalTurn, round, kind,
    actorIds: [...actorIds],
    summary, detail,
    rolls: [...rolls],
    messageId,
    ...rest,
  };
}

/**
 * Append an entry, numbering it one past the last.
 *
 * The existing entries are **not** renumbered — see the file comment.
 *
 * @param {object[]} log
 * @param {object} fields
 * @returns {object[]}
 */
export function appendEntry(log, fields) {
  const existing = log ?? [];
  const seq = existing.length === 0 ? 1 : Math.max(...existing.map((e) => e.seq ?? 0)) + 1;
  return [...existing, entry({ ...fields, seq })];
}

/**
 * Record a GM override of an earlier entry.
 *
 * The reason is **required**, and this throws without one. §30.10 says the
 * field is required, and the argument is practical rather than procedural: an
 * unexplained override is indistinguishable from a bug in the record, so a log
 * that permits one is a log nobody can trust the rest of.
 *
 * @param {object[]} log
 * @param {number} seq the entry being overridden
 * @param {object} args
 * @param {unknown} args.original
 * @param {unknown} args.changed
 * @param {string} args.reason
 * @param {string} args.byUserId
 * @param {number} [args.round]
 * @param {number} [args.globalTurn]
 * @returns {object[]}
 */
export function overrideEntry(log, seq, { original, changed, reason, byUserId, round = 0, globalTurn = 0 }) {
  const existing = log ?? [];
  const target = existing.find((e) => e.seq === seq);
  if (!target) throw new RangeError(`FGT | No entry with seq ${seq} to override.`);
  if (!reason || String(reason).trim() === "") {
    throw new Error("FGT | A GM override must carry a reason (§30.10).");
  }

  const record = entry({
    seq: Math.max(...existing.map((e) => e.seq ?? 0)) + 1,
    globalTurn, round,
    kind: "gmOverride",
    actorIds: [...(target.actorIds ?? [])],
    summary: `Override: ${original} → ${changed}`,
    detail: { original, changed },
    overrides: seq,
    reason,
    byUserId,
  });

  // The original is kept and *marked*, so the viewer can strike it through
  // rather than quietly showing the replacement as though it were the roll.
  return [
    ...existing.map((e) => (e.seq === seq ? { ...e, overriddenBy: record.seq } : e)),
    record,
  ];
}

/** @param {object} e @returns {boolean} */
export function isOverride(e) {
  return e?.kind === "gmOverride";
}

/**
 * Split a log into what stays on the Combat and what flushes to the journal.
 *
 * A **partial batch never flushes**. Flushing the moment the cap is passed
 * would make every subsequent write a journal write, which is the cost this
 * bound exists to avoid (Ch. 22 §22.8's RISK).
 *
 * @param {object[]} log
 * @param {object} [options]
 * @param {number} [options.cap]
 * @param {number} [options.batch]
 * @returns {{keep: object[], flush: object[]}}
 */
export function splitForFlush(log, { cap = LOG_CAP, batch = FLUSH_BATCH } = {}) {
  const all = log ?? [];
  // Over the cap, and a whole batch available to come off it.
  if (all.length > cap && batch <= all.length) {
    return { keep: all.slice(batch), flush: all.slice(0, batch) };
  }
  return { keep: [...all], flush: [] };
}

/**
 * The entries matching a filter.
 *
 * `actorId` matches **any** participant, not just the first. A Servant is as
 * often the target of an entry as its subject, and "everything that happened to
 * my Servant" is the viewer's most-used question.
 *
 * @param {object[]} log
 * @param {object} filter
 * @param {number} [filter.round]
 * @param {number} [filter.globalTurn]
 * @param {string} [filter.kind]
 * @param {string} [filter.actorId]
 * @param {string} [filter.search]
 * @returns {object[]}
 */
export function filterLog(log, { round, globalTurn, kind, actorId, search } = {}) {
  const needle = search ? String(search).toLowerCase() : null;

  return (log ?? []).filter((e) => {
    if (round !== undefined && e.round !== round) return false;
    if (globalTurn !== undefined && e.globalTurn !== globalTurn) return false;
    if (kind && e.kind !== kind) return false;
    if (actorId && !(e.actorIds ?? []).includes(actorId)) return false;
    if (needle && !String(e.summary ?? "").toLowerCase().includes(needle)) return false;
    return true;
  });
}

/**
 * Aggregate statistics, for the balance analysis §30.9 describes.
 *
 * @param {object[]} log
 * @returns {object}
 */
export function summarizeLog(log) {
  const all = log ?? [];
  /** @type {Record<string, number>} */
  const byKind = {};
  for (const e of all) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  const rounds = all.map((e) => e.round ?? 0);
  return {
    total: all.length,
    byKind,
    rounds: all.length === 0
      ? { first: 0, last: 0 }
      : { first: Math.min(...rounds), last: Math.max(...rounds) },
    overrides: all.filter(isOverride).length,
  };
}

/**
 * The self-contained export (§30.9).
 *
 * Self-contained is the requirement: a maintainer replays this **without the
 * world**, so the ruleset settings and the roster's setup rolls travel with the
 * entries. The recorded rolls travel too — the rules layer is pure and consumes
 * a roll map, so with them replay is exact and without them it is only
 * re-simulation, which proves nothing about the bug being reported.
 *
 * @param {object} args
 * @param {object[]} args.log
 * @param {string} [args.systemVersion]
 * @param {object} [args.settings]
 * @param {object[]} [args.roster]
 * @returns {object}
 */
export function exportPayload({ log, systemVersion = null, settings = {}, roster = [] }) {
  return {
    // Stamped so a later reader knows what shape it is holding, rather than
    // guessing from the keys present.
    format: 1,
    exportedAt: null,
    systemVersion,
    settings: { ...settings },
    roster: roster.map((r) => ({ ...r })),
    entries: (log ?? []).map((e) => ({ ...e, rolls: [...(e.rolls ?? [])] })),
    summary: summarizeLog(log ?? []),
  };
}
