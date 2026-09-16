/**
 * @file A per-unit ring buffer of past states, and the rewind that reads it.
 * @see docs/43-bounded-fields.md §43.11
 *
 * Layer 3. The shape and the diffing are `rules/history.mjs` and pure; this
 * owns the storage and the writes.
 *
 * > *"This is a time rewind over an arbitrary set of units, and it is by a wide
 * > margin the most demanding mechanic in either roster. Nothing else requires
 * > the engine to remember the past."*
 *
 * The buffer lives on the **Combat** document: it is per-match state, it must
 * survive a reload, and it must go when the match does.
 */

import { historyWanted, snapshotUnit, diffSnapshots, applyPatch } from "../rules/history.mjs";

const FLAG = "stateHistory";

/**
 * How many turns of history to keep.
 *
 * §43.11: *"retained for `max(6◈) + 2` turns."* Six because that is how far
 * back effect 2 reaches, and the `+ 2` is the chapter's own margin — a rewind
 * resolved at the very end of a turn is asking about a tick that has just
 * rolled over, and a buffer exactly six Rounds deep would be one entry short of
 * answering it.
 *
 * @param {number} turnsPerRound
 * @returns {number}
 */
export function RETENTION_TURNS(turnsPerRound) {
  return 6 * turnsPerRound + 2;
}

/**
 * Pools a rewind must leave alone.
 *
 * > *"Does not affect Nameless Forest Tokens."* — stated twice on her sheet,
 * > once per effect.
 *
 * A **named carve-out** rather than an emergent property. The tokens live in
 * `resources` and the buffer stores `resources`, so nothing about the shape of
 * the data keeps them out: without this list the rewind silently undoes Part 3,
 * handing an enemy back the tokens that were killing it.
 *
 * One named pool, not "resources are excluded" — every other pool comes back.
 */
export const REWIND_EXCLUDED_RESOURCES = Object.freeze(["namelessForestTokens"]);

/**
 * Record every unit's state for this turn, if anything asked for one.
 *
 * Returns the new history rather than writing it, so the caller owns the single
 * `Combat` update and a test can drive it without Foundry.
 *
 * @param {object} board
 * @param {number} globalTurn
 * @param {object} history the current buffer
 * @param {number} turnsPerRound
 * @returns {object|null} the new buffer, or `null` when nothing is recorded
 */
export function recordTurn(board, globalTurn, history = {}, turnsPerRound = 3) {
  // THE GATE. A match with nobody who reads history writes nothing at all --
  // no snapshots, no diffing, no storage. §43.11: *"a match without Nursery
  // Rhyme pays nothing."*
  if (!historyWanted(board)) return null;

  const retention = RETENTION_TURNS(turnsPerRound);
  /** @type {Record<string, object>} */
  const out = {};

  for (const unit of board.units ?? []) {
    const prior = history?.[unit.id] ?? null;
    const next = snapshotUnit(unit, globalTurn);

    // The oldest retained entry is a FULL snapshot and every later one a patch
    // against its predecessor, so `stateAt` replays forward from the base.
    const entries = prior
      ? [...prior.entries, { globalTurn, patch: diffSnapshots(lastOf(prior), next) }]
      : [{ globalTurn, full: next }];

    out[unit.id] = trim({ entries }, globalTurn - retention);
  }
  return out;
}

/**
 * What a unit was like at a given tick, or `null`.
 *
 * `null` for a turn that has fallen off the end, and **never** the oldest entry
 * still held: a rewind that silently restored the wrong turn would be worse
 * than one that did nothing, because it would look like it worked.
 *
 * @param {object} history
 * @param {string} unitId
 * @param {number} globalTurn
 * @returns {object|null}
 */
export function stateAt(history, unitId, globalTurn) {
  const record = history?.[unitId];
  if (!record?.entries?.length) return null;
  if (globalTurn < record.entries[0].globalTurn) return null;

  let state = null;
  for (const entry of record.entries) {
    if (entry.globalTurn > globalTurn) break;
    state = entry.full ? entry.full : applyPatch(state ?? {}, entry.patch);
  }
  return state;
}

/**
 * One `rewind` descriptor per unit that has a state to go back to.
 *
 * @param {object} board
 * @param {object} history
 * @param {string[]} unitIds
 * @param {number} toTurn
 * @returns {object[]} descriptors
 */
export function rewindIntents(board, history, unitIds, toTurn) {
  /** @type {object[]} */
  const out = [];

  for (const unitId of unitIds) {
    const state = stateAt(history, unitId, toTurn);
    if (!state) continue;

    // *"Does not affect Nameless Forest Tokens."*
    const resources = Object.fromEntries(Object.entries(state.resources ?? {})
      .filter(([key]) => !REWIND_EXCLUDED_RESOURCES.includes(key)));

    // §43.11's RISK: *"What must not happen is the rewind restoring an effect
    // whose source has since been removed, producing an orphaned instance.
    // Effect snapshots therefore record the source unit id and the applier
    // drops instances whose source no longer exists, logging each drop."*
    const present = new Set((board?.units ?? []).map((u) => u.id));
    /** @type {object[]} */
    const effects = [];
    for (const e of state.effects ?? []) {
      if (e.sourceUnitId && !present.has(e.sourceUnitId)) {
        out.push({
          kind: "log", event: "rewindDroppedOrphan",
          unitId, defId: e.defId, sourceUnitId: e.sourceUnitId,
        });
        continue;
      }
      effects.push(e);
    }

    out.push({
      kind: "rewind", unitId, toTurn,
      state: { ...state, resources, effects },
      // *"…though not a defeat — a unit already removed is not within 3 panels
      // to be restored."* Her own Stats come back and she stays defeated: the
      // rewind is a parting shot, not a resurrection.
      clearsDefeat: false,
    });
  }
  return out;
}

/**
 * @param {object} record
 * @returns {object}
 */
function lastOf(record) {
  let state = null;
  for (const entry of record.entries) {
    state = entry.full ? entry.full : applyPatch(state ?? {}, entry.patch);
  }
  return state ?? {};
}

/**
 * Drop entries older than the cutoff, re-basing whatever survives.
 *
 * The new oldest entry becomes a FULL snapshot, because a patch whose base has
 * been discarded reconstructs nothing.
 *
 * @param {object} record
 * @param {number} cutoff
 * @returns {object}
 */
function trim(record, cutoff) {
  const keep = record.entries.filter((e) => e.globalTurn >= cutoff);
  if (keep.length === record.entries.length) return record;
  if (keep.length === 0) return { entries: [] };

  let state = null;
  const rebased = [];
  for (const entry of record.entries) {
    state = entry.full ? entry.full : applyPatch(state ?? {}, entry.patch);
    if (entry.globalTurn < cutoff) continue;
    rebased.push(rebased.length === 0
      ? { globalTurn: entry.globalTurn, full: state }
      : { globalTurn: entry.globalTurn, patch: entry.patch });
  }
  return { entries: rebased };
}

/**
 * Read the match's buffer.
 * @param {object} combat
 * @returns {object}
 */
export function historyOf(combat) {
  return combat?.getFlag?.("fgt", FLAG) ?? {};
}

/**
 * Write the match's buffer.
 * @param {object} combat
 * @param {object} history
 * @returns {Promise<void>}
 */
export async function setHistory(combat, history) {
  await combat?.setFlag?.("fgt", FLAG, history);
}
