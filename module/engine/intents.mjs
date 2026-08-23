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
  "itemQuantity", "itemGrant", "markContract", "grantCommandSpells", "consumeUse",
  "setMode", "recordUse", "extendEffect", "shieldDelta", "recordAttack",
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
  // Beside `removeEffect`, because spending the last use IS a removal: an
  // effect that fires and then hangs around with `uses: 0` is an effect that
  // never expires.
  consumeUse: 1,
  statDelta: 2,
  resource: 2,
  cooldown: 2,
  // An item is spent before whatever it does, so a consumable that kills its
  // bearer is still gone. Same rank as the other bookkeeping writes.
  itemQuantity: 2,
  itemGrant: 2,
  // A contract and its spells are bookkeeping, and they must land together:
  // §16.2 requires no intermediate state between freeing and contracting.
  markContract: 2,
  grantCommandSpells: 2,
  // After the action it records, before anything reads it back.
  markTurn: 2,
  recordUse: 2,
  // Before the damage it is deducting from: the pool has to be spent in the
  // same batch that applies what got through it.
  shieldDelta: 2,
  recordAttack: 2,
  // Bookkeeping, and BEFORE anything that reads the mode back: Mad
  // Enhancement's forced deactivation has to land before the next pass
  // collects its active rules.
  setMode: 2,
  heal: 3,
  damage: 4,
  applyEffect: 5,
  // Beside application: extending an effect is a write to an instance that
  // already exists, and it must not run before one applied in the same batch.
  extendEffect: 5,
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

/**
 * Restore Health.
 *
 * `revival` marks the heal that brings a Unit back from zero, which has to be
 * applied **after** the damage that emptied it — see {@link order}.
 */
export const heal = (unitId, amount, source, revival = false) =>
  ({ t: "heal", unitId, amount, source, ...(revival ? { revival: true } : {}) });

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

/**
 * Push a held effect's expiry further out, in turns.
 *
 * Not the same as reapplying it: reapplication re-rolls the application
 * chance, re-runs the stacking rule and resets the duration to the authored
 * length. EMIYA's Atk Up (Trace) is *"extended by ⅓◈ Turns"* on top of
 * whatever is left, which is an addition to an absolute expiry tick.
 *
 * @param {string} unitId @param {string} defId @param {number} turns
 * @param {string|null} [source]
 * @returns {Intent}
 */
export const extendEffect = (unitId, defId, turns, source = null) =>
  ({ t: "extendEffect", unitId, defId, turns, source });

export const move = (unitId, path, forced = false) =>
  ({ t: "move", unitId, path, forced });

export const setFacing = (unitId, facing) =>
  ({ t: "setFacing", unitId, facing });

export const defeat = (unitId, cause) =>
  ({ t: "defeat", unitId, cause });

export const resource = (unitId, key, delta) =>
  ({ t: "resource", unitId, key, delta });

/**
 * Spend one charge of a count-limited effect.
 *
 * `uses` has been stored on every count-stacked effect since the applier was
 * written and **nothing ever decremented it**, so Medea's Trofa — `1 times` —
 * evaded every attack for the rest of the match, and Scáthach's Alpi would
 * have paid out for ever rather than three times.
 *
 * @param {string} unitId
 * @param {string} defId
 * @param {number} [count]
 * @returns {object}
 */
export const consumeUse = (unitId, defId, count = 1) =>
  ({ t: "consumeUse", unitId, defId, count });

/**
 * Switch a mode on or off.
 *
 * The one clause in the reference set where an effect turns an *ability* off
 * rather than modifying it: *"when its Master's Health is 30 or less, Mad
 * Enhancement is forcibly deactivated."* Also how a compulsion forces one on.
 *
 * @param {string} unitId
 * @param {string} abilityId a slug or a content id
 * @param {boolean} active
 * @param {string|null} [source]
 * @returns {object}
 */
export const setMode = (unitId, abilityId, active, source = null) =>
  ({ t: "setMode", unitId, abilityId, active, source });

/**
 * Record that an ability was used: this Turn, this Round, and ever.
 *
 * One intent rather than three writes, because the two use paths had drifted.
 * `useSkill` appended to `turnState.abilitiesUsed` and `resolveAttack` did not,
 * so every gate that reads the record -- `oncePerTurn`, `sameTurnExclusive`,
 * the reaction offer -- was enforced against Skills and silently ignored by
 * Noble Phantasms and Attack Skills, which are the abilities most likely to
 * carry one.
 *
 * @param {string} unitId
 * @param {string} abilityId the Item id
 * @param {string|null} [contentId] what an exclusion list names
 * @returns {Intent}
 */
export const recordUse = (unitId, abilityId, contentId = null) =>
  ({ t: "recordUse", unitId, abilityId, contentId });

/**
 * Move a barrier's own Health pool.
 *
 * On the ABILITY rather than on the bearer, because several Units stand behind
 * one barrier: EMIYA's Rho Aias protects a 3x3 block and *"if the AU's NP deals
 * more than 1400 damage, the remaining damage is dealt to the DUs
 * accordingly"*, which only means anything against one shared pool.
 *
 * @param {string} unitId the barrier's OWNER
 * @param {string} abilityId
 * @param {number} delta
 * @returns {Intent}
 */
export const shieldDelta = (unitId, abilityId, delta) =>
  ({ t: "shieldDelta", unitId, abilityId, delta });

/**
 * Record an attack's identity under an ability that watches for it.
 *
 * God Hand's second passive, and the reason §6.10 draws a line between a
 * Resource and a set: this pool stores **identities**, not a number.
 *
 * @param {string} unitId @param {string} abilityId @param {string} identity
 * @returns {Intent}
 */
export const recordAttack = (unitId, abilityId, identity) =>
  ({ t: "recordAttack", unitId, abilityId, identity });

/**
 * Turn an ability's clock.
 *
 * `set` writes the remaining turns outright, `reduce` subtracts with a floor of
 * zero, and `increase` adds — which is the one direction the system could not
 * express until Serenity's *Shapeshift*, *"increase its NP Cooldown by 1◈
 * Turns"*. `set` would have overwritten a longer clock with a shorter one and
 * turned the debuff into a favour.
 */
export const cooldown = (unitId, abilityId, ticks, mode = "reduce") =>
  ({ t: "cooldown", unitId, abilityId, ticks, mode });

export const spendCS = (masterId, count, command, servantId = null) =>
  ({ t: "spendCS", masterId, count, command, servantId });

export const prompt = (userId, spec) =>
  ({ t: "prompt", userId, prompt: spec });

/**
 * Record what a unit has done this turn. `patch` is a partial `turnState`.
 * @see docs/18-action-economy.md §18.4
 */
export const markTurn = (unitId, patch) =>
  ({ t: "markTurn", unitId, patch });

/**
 * Change how many of an item a unit has.
 * @param {string} unitId @param {string} itemId @param {number} delta
 * @returns {Intent}
 */
export const itemQuantity = (unitId, itemId, delta) =>
  ({ t: "itemQuantity", unitId, itemId, delta });

/**
 * Put an item on a unit that may not have one yet — the receiving half of a
 * transfer, which cannot be a `itemQuantity` because there may be nothing to
 * adjust.
 * @param {string} unitId @param {string} contentId @param {number} delta
 * @returns {Intent}
 */
export const itemGrant = (unitId, contentId, delta = 1) =>
  ({ t: "itemGrant", unitId, contentId, delta });

/**
 * Set a unit's contract state and its Master (§16.2).
 * @param {string} unitId @param {string} contract @param {string|null} masterId
 * @returns {Intent}
 */
export const markContract = (unitId, contract, masterId = null) =>
  ({ t: "markContract", unitId, contract, masterId });

/**
 * Grant Command Spells namespaced to one Servant (§16.9).
 * @param {string} masterId @param {string} servantId @param {number} count
 * @returns {Intent}
 */
export const grantCommandSpells = (masterId, servantId, count) =>
  ({ t: "grantCommandSpells", masterId, servantId, count });

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
    .sort((a, b) => (rankOf(a.intent) - rankOf(b.intent)) || (a.index - b.index))
    .map(({ intent }) => intent);
}

/**
 * Where one intent sits in the application order.
 *
 * Almost always its type. The exception is a **revival** heal, which has to
 * land *after* the damage that caused it rather than with the other healing:
 * it is emitted in the same batch as the damage, and at the ordinary `heal`
 * rank it applied first and the damage then took the Unit straight back to
 * zero. Found live — Heracles was revived by God Hand and ended the exchange
 * at 0 Health, alive, having spent a charge for nothing.
 *
 * @param {Intent} intent
 * @returns {number}
 */
function rankOf(intent) {
  if (intent.t === "heal" && intent.revival) return ORDER.damage + 0.5;
  return ORDER[intent.t];
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
    if (intent.t === "cooldown" && !["set", "reduce", "increase"].includes(intent.mode)) {
      problems.push(`${where}: mode must be "set", "reduce" or "increase"`);
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
  itemQuantity: ["delta"],
  itemGrant: ["delta"],
  grantCommandSpells: ["count"],
  consumeUse: ["count"],
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
