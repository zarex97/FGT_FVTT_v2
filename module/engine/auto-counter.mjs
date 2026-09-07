/**
 * @file Counters a Unit performs without being asked, and what provokes them.
 * @see docs/24-rules-engine.md §24.8, docs/33-case-mannanan.md §33.3
 *
 * Layer 3 (orchestration). This half is a **queue**; the declaration itself
 * lives in `engine/attack.mjs`, which is the only module that may open a Combat
 * Process.
 *
 * Mannanán's `Fragarach` is the only holder in the reference set and it is the
 * reason the machinery is shaped this way:
 *
 * > *"When Mannanán is Attacked **or inflicted with a debuff**, at the end of
 * > the Combat Process (if Attacked), she automatically performs a Fragarach
 * > Counter on the DU."*
 *
 * Three properties fall out of that sentence and none of them is optional:
 *
 *   1. **Two provocations, one counter.** Being attacked and being debuffed are
 *      two firings of one trigger. An attack that also lands a Def Dwn owes one
 *      counter, not two, so provocations are collected into a set keyed by the
 *      pair and drained together.
 *   2. **Deferred to the end of the Combat Process.** A debuff inflicted mid-
 *      exchange does not interrupt it; it queues, and the queue drains when the
 *      Process finishes. A debuff from a Skill has no Process to wait for and
 *      drains at the end of the Skill.
 *   3. **A counter is a full declaration** (§12.8), so it cannot be produced
 *      from inside the write path that noticed the debuff. Hence a queue.
 *
 * The queue is **GM-side and in-memory**. It never outlives a resolution: a
 * provocation that has not been drained by the end of the exchange that raised
 * it is a bug, and persisting it would turn that bug into a counter that fires
 * on a later, unrelated turn.
 */

/**
 * @typedef {object} Provocation
 * @property {string} bearerId  the Unit that will counter
 * @property {string} provokerId the Unit it will counter
 * @property {string} abilityId  the ability the counter is declared with
 * @property {string} source     the effect that granted it, for the card
 * @property {string} cause      `attacked` or `debuffed`
 */

/**
 * Pending provocations, keyed `bearerId:provokerId`.
 *
 * A Map rather than a list, because clause 1 above is deduplication: the key is
 * the pair, so a second provocation between the same two Units inside one
 * exchange replaces nothing and adds nothing.
 *
 * @type {Map<string, Provocation>}
 */
const pending = new Map();

/**
 * True while the queue is draining.
 *
 * A Fragarach Counter inflicts `Def Dwn (C)` on the Unit it answers, and that
 * is a debuff — so without this the counter would provoke a counter from
 * anybody standing in the same shoes. §12.8's *"Counters cannot be Countered
 * again"* is the same rule stated for the ordinary ladder.
 *
 * @type {boolean}
 */
let draining = false;

/**
 * Is the queue currently draining?
 * @returns {boolean}
 */
export function isDraining() {
  return draining;
}

/**
 * Record a provocation, if the bearer has an automatic counter that wants it.
 *
 * @param {object} args
 * @param {object} args.bearer the bearer's unit snapshot, carrying `autoCounters`
 * @param {string} args.provokerId
 * @param {string} args.cause `attacked` or `debuffed`
 * @returns {boolean} whether anything was queued
 */
export function provoke({ bearer, provokerId, cause }) {
  if (draining || !bearer?.id || !provokerId || bearer.id === provokerId) return false;

  const rule = (bearer.autoCounters ?? []).find((c) => (c.on ?? []).includes(cause));
  if (!rule?.ability) return false;

  const key = `${bearer.id}:${provokerId}`;
  if (pending.has(key)) return false;

  pending.set(key, {
    bearerId: bearer.id,
    provokerId,
    abilityId: rule.ability,
    source: rule.source ?? "Automatic Counter",
    cause,
  });
  return true;
}

/**
 * Take everything queued, clearing the queue.
 *
 * Drained wholesale rather than one at a time: the caller declares each counter
 * in turn and each of those declarations writes, and a queue that is still
 * accepting entries while it is being read would grow under its own drain.
 *
 * @returns {Provocation[]}
 */
export function takePending() {
  const out = [...pending.values()];
  pending.clear();
  return out;
}

/** How many provocations are waiting. Exposed for tests and the log. */
export function pendingCount() {
  return pending.size;
}

/**
 * Mark the queue as draining for the duration of `fn`.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function whileDraining(fn) {
  draining = true;
  try {
    return await fn();
  } finally {
    draining = false;
  }
}

/**
 * Every unit id an `applyEffect` batch landed a **debuff** on, with who did it.
 *
 * Read off the intents rather than off the documents, because the question is
 * *"what just happened"* and the documents only know the result. An effect that
 * was resisted or blocked never becomes an intent, so a refused debuff does not
 * provoke — which is correct and is the reason this reads the applied batch
 * rather than the attempt.
 *
 * @param {object[]} intents
 * @returns {Array<{unitId: string, sourceId: string}>}
 */
export function debuffsIn(intents) {
  /** @type {Array<{unitId: string, sourceId: string}>} */
  const out = [];
  for (const intent of intents ?? []) {
    if (intent.t !== "applyEffect") continue;
    if (intent.effect?.polarity !== "debuff") continue;
    const sourceId = intent.effect?.sourceUnitId ?? intent.sourceId ?? null;
    if (!sourceId || sourceId === intent.unitId) continue;
    out.push({ unitId: intent.unitId, sourceId });
  }
  return out;
}
