/**
 * @file The roll log — every roll, what moved it, and what replaced it.
 * @see docs/14-checks-and-randomness.md §14.8, docs/30-chat-and-audit.md
 *
 * Layer 2 (rules). Pure, and deliberately so: records accumulate on the
 * `CombatProcess` state, which is serialized and passed between clients, so
 * nothing here may mutate or reach for a global.
 *
 * The log is the answer to the question this system gets asked most often —
 * *"why did that miss?"* Damage already has `explainDamage`; checks had
 * nothing, so a failed Evade was a bare number with no way to tell a bad roll
 * from a misapplied modifier.
 */

/**
 * One roll.
 *
 * `raw` and `total` are both stored because the log's whole value is being able
 * to check the arithmetic: with only the total, a wrong modifier and an unlucky
 * die look identical.
 *
 * @param {object} args
 * @returns {object}
 */
export function record({
  id, globalTurn = 0, entryId, formula, raw, total,
  modifiers = [], purpose = "", actorId = null,
  visibility = "public", rerolledFrom = null, reason = null,
}) {
  return Object.freeze({
    id, globalTurn, entryId, formula, raw, total,
    modifiers: Object.freeze([...modifiers]),
    purpose, actorId, visibility, rerolledFrom, reason,
  });
}

/**
 * A record built from a check outcome.
 *
 * Checks report their modifiers as `{source, value}` and the log wants
 * `{source, delta, stage}` — a small translation, kept here so every check site
 * does not invent its own. The `table` is recorded as a zero-delta modifier
 * because that is what it is: something that changed the outcome without
 * changing the number, and the single most common cause of "why did that miss".
 *
 * @param {object} outcome from `rules/checks.mjs`
 * @param {object} meta
 * @returns {object}
 */
export function fromCheck(outcome, meta) {
  return record({
    ...meta,
    raw: outcome.roll,
    total: outcome.total,
    modifiers: [
      ...(outcome.table ? [{ source: `${outcome.table} table`, delta: 0, stage: "table" }] : []),
      ...(outcome.modifiers ?? []).map((m) => ({
        source: m.source, delta: m.value ?? 0, stage: m.stage ?? "modifier",
      })),
      ...(outcome.automatic ? [{ source: "automatic success", delta: 0, stage: "auto" }] : []),
    ],
  });
}

/**
 * Add a record to a log.
 *
 * Returns a new array — process state crosses the socket, and mutating it in
 * place loses records on the round trip. A duplicate id is **dropped** rather
 * than appended: an interrupt that replays part of a resolution would otherwise
 * double every roll it re-ran, and two records under one id make the audit
 * trail unreadable.
 *
 * @param {object[]} log
 * @param {object} entry
 * @returns {object[]}
 */
export function append(log, entry) {
  const existing = log ?? [];
  if (existing.some((r) => r.id === entry.id)) return existing;
  return [...existing, entry];
}

/**
 * Replace a roll, keeping the original.
 *
 * Principle P6 permits a GM re-roll; §14.8 requires the log to show **both**.
 * A replacement that erased its predecessor would let a re-roll pass unnoticed,
 * which is precisely what the record exists to prevent.
 *
 * @param {object[]} log
 * @param {string} originalId
 * @param {object} replacement partial — unchanged fields come from the original
 * @param {string} reason
 * @returns {object[]}
 */
export function reroll(log, originalId, replacement, reason) {
  const original = (log ?? []).find((r) => r.id === originalId);
  if (!original) return log ?? [];

  return append(log, record({
    ...original,
    ...replacement,
    rerolledFrom: originalId,
    reason,
  }));
}

/**
 * A roll and everything it replaced, oldest first.
 *
 * @param {object[]} log
 * @param {string} id
 * @returns {object[]}
 */
export function chainOf(log, id) {
  /** @type {object[]} */
  const chain = [];
  let current = (log ?? []).find((r) => r.id === id);
  while (current) {
    chain.unshift(current);
    current = current.rerolledFrom ? log.find((r) => r.id === current.rerolledFrom) : null;
  }
  return chain;
}

/**
 * The records one viewer may see.
 *
 * Hidden rolls are hidden for a reason — a Discover roll a player can read
 * gives away the Assassin's panel without anyone rolling anything (§26.6) — so
 * this filters rather than dimming.
 *
 * @param {object[]} log
 * @param {object} viewer
 * @param {boolean} [viewer.isGM]
 * @param {string[]} [viewer.ownedActorIds]
 * @returns {object[]}
 */
export function visibleTo(log, { isGM = false, ownedActorIds = [] } = {}) {
  if (isGM) return [...(log ?? [])];
  return (log ?? []).filter((r) => {
    if (r.visibility === "public") return true;
    if (r.visibility === "owner") return ownedActorIds.includes(r.actorId);
    return false;
  });
}

/**
 * A roll as the lines §14.8 shows.
 *
 * A **zero-delta** modifier prints without a sign. Those entries explain rather
 * than add — "Mad Enhancement B: Evade- forced" changed which table was used,
 * not the number — and rendering one as "+0" reads as a bug in the maths.
 *
 * @param {object} r
 * @returns {string[]}
 */
export function renderBreakdown(r) {
  const lines = [`${r.entryId} ${r.formula} → ${r.raw}`];

  for (const m of r.modifiers ?? []) {
    lines.push(m.delta === 0 ? `  ${m.source}` : `  ${m.source} ${signed(m.delta)}`);
  }

  if ((r.modifiers ?? []).length > 0) lines.push("  ───────────────────────────────");
  lines.push(`  total ${r.total}`);
  return lines;
}

/** @param {number} n @returns {string} */
function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}
