/**
 * @file The Use record: what one use of an ability did (#320, #285).
 * @see docs/04-time-model.md, docs/21-combat-process.md, CONTEXT.md (Use record)
 *
 * Layer 2 (rules). Pure: plain JSON in, plain JSON out, so a record can ride
 * on a Combat Process's saved state (`combat-process.mjs#serialize`) and survive
 * a reload mid-declaration (Q18, the *Write before store* lesson).
 *
 * A cooldown was set from the user's options at the moment of use, never from
 * what the use did (#285): Sétanta's *"⅓◈ for each effect activated/applied by
 * this Skill"*, the Trung Sisters' *"½◈ for every debuff inflicted"*,
 * Kurohime's *"3◈ instead of 6◈ when the NP's Normal Attack misses"*. Both use
 * paths fill one of these, a Process at a time, and the Cooldown clock settles
 * from the merged record once the declaration is over (`engine/cooldown.mjs`).
 *
 * The facts are a closed list (Q7): a fact this module does not hold is refused
 * by name, so a writer cannot note one nothing reads.
 */

/** What a Use record holds (Q7). */
export const USE_FACTS = Object.freeze([
  "failed", "missed", "evaded", "unitsHit", "effectsApplied", "debuffsInflicted",
  "summoned", "criteriaMet", "die", "overCooldown", "channelStarted", "concealmentBroken",
]);

/** The facts that are flags: true if any Process of the declaration raised them. */
const FLAGS = new Set(["failed", "missed", "evaded", "overCooldown", "channelStarted", "concealmentBroken"]);

/**
 * @typedef {object} UseRecord
 * @property {string|null} abilityId
 * @property {string|null} unitId the user
 * @property {Array<{defId: string, polarity: string|null, outcome: string, targetId: string|null}>} landings
 * @property {Record<string, unknown>} facts noted facts, by name in {@link USE_FACTS}
 */

/**
 * A record with nothing in it yet.
 *
 * @param {{abilityId?: string|null, unitId?: string|null}} who
 * @returns {UseRecord}
 */
export function emptyUseRecord({ abilityId = null, unitId = null } = {}) {
  return { abilityId, unitId, landings: [], facts: {} };
}

/**
 * Note one landing the use made: an Effect it tried to put on a Unit.
 *
 * The polarity is the LANDED one (`rules/effect-instance.mjs#landedPolarity`,
 * #315): Roma Stacks are a buff on an ally and a debuff on an enemy, and only
 * the debuff is inflicted.
 *
 * @param {UseRecord} record
 * @param {{defId: string, polarity?: string|null, outcome: string, targetId?: string|null}} landing
 * @returns {UseRecord}
 */
export function noteLanding(record, { defId, polarity = null, outcome, targetId = null }) {
  record.landings.push({ defId, polarity, outcome, targetId });
  return record;
}

/**
 * Note one fact of the use.
 *
 * @param {UseRecord} record
 * @param {string} fact one of {@link USE_FACTS}
 * @param {unknown} value
 * @returns {UseRecord}
 * @throws {RangeError} for a fact the record does not hold
 */
export function noteFact(record, fact, value) {
  if (!USE_FACTS.includes(fact)) {
    throw new RangeError(`FGT | A Use record holds no fact "${fact}": it holds ${USE_FACTS.join(", ")}.`);
  }
  record.facts[fact] = value;
  return record;
}

/**
 * One declaration's Processes, as one record.
 *
 * Landings are every Process's together. A flag is true when any Process raised
 * it: one DU's Evade is *"was Evaded"*. A number noted at commit
 * (`criteriaMet`, `summoned`, `die`) is the declaration's, the same on every
 * Process, and is taken from the first that holds it; `unitsHit` sums.
 *
 * @param {UseRecord[]} records
 * @returns {UseRecord}
 */
export function mergeRecords(records) {
  const list = (records ?? []).filter(Boolean);
  const merged = emptyUseRecord({ abilityId: list[0]?.abilityId ?? null, unitId: list[0]?.unitId ?? null });
  for (const r of list) {
    merged.landings.push(...(r.landings ?? []));
    for (const [fact, value] of Object.entries(r.facts ?? {})) {
      if (FLAGS.has(fact)) merged.facts[fact] = Boolean(merged.facts[fact]) || Boolean(value);
      else if (fact === "unitsHit") merged.facts[fact] = Number(merged.facts[fact] ?? 0) + Number(value ?? 0);
      else if (merged.facts[fact] === undefined) merged.facts[fact] = value;
    }
  }
  return merged;
}

/**
 * The facts a record stands for, each with its default.
 *
 * @param {UseRecord} record
 * @returns {{failed: boolean, missed: boolean, evaded: boolean, unitsHit: number, effectsApplied: number,
 *   debuffsInflicted: number, summoned: number, criteriaMet: number, die: number|null, overCooldown: boolean,
 *   channelStarted: boolean, concealmentBroken: boolean, applied: Set<string>}}
 */
export function useFacts(record) {
  const f = record?.facts ?? {};
  const landed = (record?.landings ?? []).filter((l) => l.outcome === "applied");
  return {
    failed: Boolean(f.failed),
    missed: Boolean(f.missed),
    evaded: Boolean(f.evaded),
    unitsHit: Number(f.unitsHit ?? 0),
    effectsApplied: landed.length,
    debuffsInflicted: landed.filter((l) => l.polarity === "debuff").length,
    summoned: Number(f.summoned ?? 0),
    criteriaMet: Number(f.criteriaMet ?? 0),
    die: typeof f.die === "number" ? f.die : null,
    overCooldown: Boolean(f.overCooldown),
    channelStarted: Boolean(f.channelStarted),
    concealmentBroken: Boolean(f.concealmentBroken),
    applied: new Set(landed.map((l) => l.defId)),
  };
}

/**
 * The `use:` options a settled cooldown's predicate reads (Q9).
 *
 * Kurohime's *"3◈ instead of 6◈ when the NP's Normal Attack misses"* is a
 * `branches` entry on `use:missed`.
 *
 * @param {ReturnType<typeof useFacts>} facts
 * @returns {Set<string>}
 */
export function useOptions(facts) {
  const out = new Set();
  for (const flag of FLAGS) if (facts?.[flag]) out.add(`use:${flag}`);
  for (const id of facts?.applied ?? []) out.add(`use:applied:${id}`);
  if (typeof facts?.die === "number") out.add(`use:die:${facts.die}`);
  return out;
}
