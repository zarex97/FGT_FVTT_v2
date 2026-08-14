/**
 * @file Intents — the boundary between deciding and writing.
 * @see docs/03-domain-overview.md §3.4
 *
 * Layer 3 (orchestration). This module is itself **pure**: it constructs,
 * validates, orders and batches intents. Only `applyIntents` in
 * `engine/applier.mjs` touches documents.
 *
 * The rules layer never writes. It returns `Intent[]`, and that buys six
 * things: tests assert on intents rather than document state; the same
 * computation with `apply: false` is a free preview; the orchestration layer
 * can inspect each intent's target and route it through the GM proxy when the
 * client lacks ownership; a batch applies atomically; ordering is explicit; and
 * the intent list *is* the audit entry.
 */

/**
 * @typedef {object} Intent
 * @property {string} t the discriminant
 */

/** Every legal intent type. Anything else is a bug, not an extension point. */
export const INTENT_TYPES = Object.freeze([
  "damage", "heal", "statDelta", "applyEffect", "removeEffect", "move",
  "setFacing", "defeat", "resource", "cooldown", "spendCS", "markTurn", "prompt", "log",
]);

/**
 * Application order within a batch.
 *
 * Intents from one resolution are applied together, but not in construction
 * order: removals must precede applications so a `replace` does not delete what
 * it just created, damage must precede defeat so the defeat handler sees the
 * final health, and prompts must come last so nothing is awaiting a human while
 * writes are still pending.
 *
 * Intents with the same rank keep their relative construction order.
 */
const ORDER = Object.freeze({
  log: 0,
  removeEffect: 1,
  statDelta: 2,
  resource: 2,
  cooldown: 2,
  // After the action it records, before anything reads it back.
  markTurn: 2,
  heal: 3,
  damage: 4,
  applyEffect: 5,
  move: 6,
  setFacing: 7,
  spendCS: 8,
  defeat: 9,
  prompt: 10,
});

/* -------------------------------------------------------------------------- */
/*  Constructors                                                              */
/* -------------------------------------------------------------------------- */

export const damage = (unitId, amount, breakdown = null, meta = {}) =>
  ({ t: "damage", unitId, amount, breakdown, ...meta });

export const heal = (unitId, amount, source) =>
  ({ t: "heal", unitId, amount, source });

/**
 * A change to a stat's current value.
 *
 * `clamp` decides whether the value is held inside `[0, max]`. Health loss that
 * is **not damage** — Pale Rider's Contagion, Mad Enhancement's Master drain —
 * uses this rather than `damage`, because it must not trigger damage-keyed
 * effects like `Dmged NP Regen` or an Injury Roll.
 */
export const statDelta = (unitId, stat, delta, clamp = true) =>
  ({ t: "statDelta", unitId, stat, delta, clamp });

export const applyEffect = (unitId, effect, sourceId) =>
  ({ t: "applyEffect", unitId, effect, sourceId });

export const removeEffect = (unitId, effectId, reason) =>
  ({ t: "removeEffect", unitId, effectId, reason });

export const move = (unitId, path, forced = false) =>
  ({ t: "move", unitId, path, forced });

export const setFacing = (unitId, facing) =>
  ({ t: "setFacing", unitId, facing });

export const defeat = (unitId, cause) =>
  ({ t: "defeat", unitId, cause });

export const resource = (unitId, key, delta) =>
  ({ t: "resource", unitId, key, delta });

export const cooldown = (unitId, abilityId, ticks, mode = "reduce") =>
  ({ t: "cooldown", unitId, abilityId, ticks, mode });

export const spendCS = (masterId, count, command) =>
  ({ t: "spendCS", masterId, count, command });

export const prompt = (userId, spec) =>
  ({ t: "prompt", userId, prompt: spec });

/**
 * Record what a unit has done this turn. `patch` is a partial `turnState`.
 * @see docs/18-action-economy.md §18.4
 */
export const markTurn = (unitId, patch) =>
  ({ t: "markTurn", unitId, patch });

export const log = (entry) =>
  ({ t: "log", entry });

/* -------------------------------------------------------------------------- */
/*  Batch handling                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Sort a batch into application order, stably.
 * @param {Intent[]} intents
 * @returns {Intent[]}
 */
export function order(intents) {
  return intents
    .map((intent, index) => ({ intent, index }))
    .sort((a, b) => (ORDER[a.intent.t] - ORDER[b.intent.t]) || (a.index - b.index))
    .map(({ intent }) => intent);
}

/**
 * Group ordered intents by `(type, unitId)` so the applier can collapse each
 * group into one document write — every `applyEffect` on one actor becomes a
 * single `createEmbeddedDocuments` call rather than N round trips.
 *
 * @param {Intent[]} intents
 * @returns {Array<{t: string, unitId: string|null, intents: Intent[]}>}
 */
export function batch(intents) {
  /** @type {Array<{t: string, unitId: string|null, intents: Intent[]}>} */
  const groups = [];
  for (const intent of order(intents)) {
    const unitId = intent.unitId ?? intent.masterId ?? null;
    const last = groups[groups.length - 1];
    if (last && last.t === intent.t && last.unitId === unitId) last.intents.push(intent);
    else groups.push({ t: intent.t, unitId, intents: [intent] });
  }
  return groups;
}

/**
 * Reject malformed intents before anything is written.
 *
 * This runs on every batch, including in production. A rule element that emits
 * a nonsense intent is a content bug, and the cost of catching it here is one
 * pass over a short array against the cost of a half-applied Noble Phantasm.
 *
 * @param {Intent[]} intents
 * @returns {string[]} problems, empty when the batch is sound
 */
export function validate(intents) {
  /** @type {string[]} */
  const problems = [];
  intents.forEach((intent, k) => {
    const where = `intent[${k}] (${intent?.t ?? "undefined"})`;
    if (!intent || typeof intent.t !== "string") {
      problems.push(`${where}: not an intent`);
      return;
    }
    if (!INTENT_TYPES.includes(intent.t)) {
      problems.push(`${where}: unknown intent type`);
      return;
    }
    if (intent.t !== "log" && intent.t !== "prompt" && !intent.unitId && !intent.masterId) {
      problems.push(`${where}: missing unitId`);
    }
    for (const field of NUMERIC_FIELDS[intent.t] ?? []) {
      const v = intent[field];
      if (!Number.isFinite(v)) problems.push(`${where}: ${field} is not a finite number (${v})`);
    }
    if (intent.t === "damage" && intent.amount < 0) {
      problems.push(`${where}: negative damage — use a heal intent instead`);
    }
    if (intent.t === "heal" && intent.amount < 0) {
      problems.push(`${where}: negative healing — use a damage or statDelta intent instead`);
    }
    if (intent.t === "move" && !Array.isArray(intent.path)) {
      problems.push(`${where}: path must be an array of panels`);
    }
    if (intent.t === "markTurn" && (!intent.patch || typeof intent.patch !== "object")) {
      problems.push(`${where}: patch must be a turnState object`);
    }
    if (intent.t === "cooldown" && !["set", "reduce"].includes(intent.mode)) {
      problems.push(`${where}: mode must be "set" or "reduce"`);
    }
  });
  return problems;
}

/** @type {Readonly<Record<string, string[]>>} */
const NUMERIC_FIELDS = Object.freeze({
  damage: ["amount"],
  heal: ["amount"],
  statDelta: ["delta"],
  resource: ["delta"],
  cooldown: ["ticks"],
  spendCS: ["count"],
});

/**
 * Fold a batch into the net change per unit, without applying anything.
 *
 * This is the preview: the targeting UI runs the real resolution with
 * `apply: false` and renders this summary, so the number in the tooltip is the
 * number the attack will actually produce rather than a parallel estimate that
 * can drift.
 *
 * @param {Intent[]} intents
 * @returns {Map<string, {damage: number, healing: number, effects: string[], defeated: boolean}>}
 */
export function summarize(intents) {
  /** @type {Map<string, {damage: number, healing: number, effects: string[], defeated: boolean}>} */
  const out = new Map();
  const get = (id) => {
    if (!out.has(id)) out.set(id, { damage: 0, healing: 0, effects: [], defeated: false });
    return out.get(id);
  };
  for (const i of intents) {
    switch (i.t) {
      case "damage": get(i.unitId).damage += i.amount; break;
      case "heal": get(i.unitId).healing += i.amount; break;
      case "applyEffect": get(i.unitId).effects.push(i.effect?.defId ?? "effect"); break;
      case "defeat": get(i.unitId).defeated = true; break;
      default: break;
    }
  }
  return out;
}
