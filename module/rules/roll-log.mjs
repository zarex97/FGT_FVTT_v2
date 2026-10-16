/**
 * @file The roll log — every roll, what moved it, and what replaced it.
 * @see docs/13-checks-and-randomness.md, docs/37-chat-and-log.md
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
      // A probable contribution's own die, held or not (#208, live).
      ...(outcome.chances ?? []).map((c) => ({
        source: `${c.source}: 1d100 → ${c.roll ?? "—"} against ${c.chance}%, ${c.passed ? "in force" : "no effect"}`,
        delta: 0, stage: "chance",
      })),
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
 * Principle P6 permits a GM re-roll; Ch. 13 requires the log to show **both**.
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
 * gives away the Assassin's panel without anyone rolling anything (Ch. 38) — so
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
 * A roll as the lines Ch. 13 shows.
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

/**
 * Roll records for the rolled modifiers a damage computation used.
 *
 * Goddess of War's d4 lifted and cut Penthesilea's damage by a number nobody
 * could see (#190). Filed only where the modifier reached the breakdown, so a
 * die whose clause did not apply is not reported as if it had.
 *
 * @param {object} ctx the damage context, carrying `attacker`, `defender` and `rolls`
 * @param {object} result the pipeline's result
 * @param {{attackerId: string, defenderId: string}} state the Process state
 * @param {number} tick
 * @returns {object[]}
 */
export function modifierDiceRecords(ctx, result, state, tick) {
  // A contributor names its modifier KEY as `source` and the ability as `note`;
  // both are matched, so the defender's Goddess of War cut does not file her
  // own, unused, Attack die beside it.
  const contributors = (result?.breakdown ?? []).flatMap((b) => b.contributors ?? []);
  const used = new Set(contributors.map((c) => `${c.source}|${c.note ?? c.source}`));
  // A flat bonus of another element notes itself "Name (light)": landed, under
  // its name with the element beside it. A lost chance contributes 0 and is
  // said in the breakdown already.
  const landed = (m) => used.has(`${m.key}|${m.source}`) || contributors.some((c) => c.source === m.key
    && c.value !== 0 && String(c.note ?? "").startsWith(`${m.source} (`));
  const seen = new Set();
  const out = [];
  for (const m of [...(ctx?.attacker?.modifiers ?? []), ...(ctx?.defender?.modifiers ?? [])]) {
    // A rolled magnitude, or a CHANCE to land at all: Excalibur's passive won
    // its 50% and the die was nowhere, though a lost one says "rolled 51 vs
    // 50%" in the breakdown (#230, live). Filed only when it landed, as above.
    const key = m.roll?.key ?? m.chance?.key;
    if (!key || seen.has(key) || typeof ctx.rolls?.[key] !== "number" || !landed(m)) continue;
    seen.add(key);
    out.push(record({
      id: `${state.attackerId}:${state.defenderId}:modifier:${key}:${tick}`,
      globalTurn: tick, entryId: "modifier", formula: m.roll?.formula ?? "1d100",
      raw: ctx.rolls[key], total: ctx.rolls[key],
      modifiers: m.chance ? [{ source: `against ${m.chance.percent}%`, delta: 0, stage: "chance" }] : [],
      purpose: m.source,
      actorId: state.attackerId,
    }));
  }
  return out;
}
