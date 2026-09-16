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
  "setFacing", "defeat", "dismissSummon", "durationDelta", "suppressRule", "resource", "cooldown", "spendCS", "markTurn", "prompt", "log",
  "itemQuantity", "itemGrant", "markContract", "grantCommandSpells", "consumeUse",
  "setMode", "setStance", "recordUse", "extendEffect", "shieldDelta", "recordAttack",
  // `setStage` decrements a staged effect without deleting it, and `event`
  // raises a write-time event so a listener can react to what just happened.
  // Both are Van Gogh's -- her Curse is the first effect anything reads the
  // STAGE of rather than merely the presence of.
  //
  // A type here, a constructor below, an ORDER rank, and an applier case: all
  // four, or `applyIntents` throws the whole batch out. These two had three.
  "suspendSkill", "setStage", "event",
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
  // An event raised from inside a write is a CONSEQUENCE of it, so it sorts
  // after everything: a listener that reduces a cooldown must see the stage
  // that was actually written, not the one being written.
  setStage: 5,
  event: 99,
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
  // Beside `setMode`, and for exactly its reason: a suspension switches a mode
  // off AND bars it from returning, so it has to land before the next pass
  // collects the ability's rules or asks whether it may be toggled.
  suspendSkill: 2,
  // Beside `setMode`, and bookkeeping for the same reason: a stance decides
  // which of a Unit's clauses are collected at all, so it must land before
  // anything reads them back.
  setStance: 2,
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
  // Beside `defeat`, and for the same reason: a summon leaving the board is the
  // last thing that happens to it, after every write aimed at it has landed.
  //
  // It is NOT a defeat. *"It disappears"* -- so no revival chain, no
  // `unitDefeated`, and nothing that counts a kill.
  dismissSummon: 9,
  // Bookkeeping on the summon's own clock, alongside the other stat writes --
  // and well before the dismissal that reads it, so a stay extended and expired
  // in one batch extends first.
  durationDelta: 2,
  // Bookkeeping, like the other writes -- and before the damage it changes the
  // shape of, so an attack that both suppresses and wounds suppresses first.
  suppressRule: 2,
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
 * applied **after** the damage that emptied it — see {@link order}. `meta` is
 * how a caller passes `afterEffects`, the other departure from the ordinary
 * rank: a heal whose maximum is raised by an effect in the same batch.
 */
export const heal = (unitId, amount, source, revival = false, meta = {}) =>
  ({ t: "heal", unitId, amount, source, ...(revival ? { revival: true } : {}), ...meta });

/**
 * A change to a stat's current value.
 *
 * `clamp` decides whether the value is held inside `[0, max]`. Health loss that
 * is **not damage** — Pale Rider's Contagion, Mad Enhancement's Master drain —
 * uses this rather than `damage`, because it must not trigger damage-keyed
 * effects like `Dmged NP Regen` or an Injury Roll.
 */
export const statDelta = (unitId, stat, delta, clamp = true, alsoCurrent = false) =>
  ({ t: "statDelta", unitId, stat, delta, clamp, alsoCurrent });

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

/**
 * Take a summon off the board because its stay has run out.
 *
 * > *"When the Jabberwock is summoned, it disappears after 3◈ Turns."*
 *
 * Distinct from `defeat`, which runs the revival chain, fires `unitDefeated`
 * and counts as a kill. Disappearing is none of those: the applier writes the
 * summon's stats home to its summoner (so *"its Stats will be the same as when
 * it disappeared"* inherits the path Ozymandias's Sphinxes already use), starts
 * a `countFrom: "destroyed"` cooldown on whatever summoned it, and deletes it.
 *
 * @param {string} unitId
 * @param {string} [reason]
 * @returns {object}
 */
export const dismissSummon = (unitId, reason = "expired") =>
  ({ t: "dismissSummon", unitId, reason });

/**
 * Move a summon's departure tick.
 *
 * > *"…extends its period of existing on the board for 3◈ **more** Turns."*
 *
 * A DELTA, not a new expiry: the sheet says *more*, and a summon with four
 * Turns left must end with seven rather than three.
 *
 * @param {string} unitId
 * @param {number} delta turns, signed
 * @returns {object}
 */
export const durationDelta = (unitId, delta) =>
  ({ t: "durationDelta", unitId, delta });

/**
 * Switch a named rule off on a Unit, permanently.
 *
 * > *"…is **permanently removed** from the Jabberwock."*
 *
 * The slug of a rule element rather than an effect id: what the Vorpal Blade
 * takes away is a clause on the monster's own statblock, which no removal
 * effect can reach.
 *
 * @param {string} unitId
 * @param {string} scope the rule element's `slug`
 * @returns {object}
 */
export const suppressRule = (unitId, scope) =>
  ({ t: "suppressRule", unitId, scope });

export const resource = (unitId, key, delta) =>
  ({ t: "resource", unitId, key, delta });

/**
 * Set a resource to an ABSOLUTE value, rather than adjusting it by a delta.
 *
 * `resource`'s delta is added to whatever the field currently holds — and a
 * field that is legitimately `null` until its first write has no "current" to
 * add against. Sustainability's remaining-turns clock is exactly this: `null`
 * means "not started yet, defaults to the resolved maximum" (Ch. 06 §6.8), not
 * "zero". A relative `resource` intent against it reads the raw stored `null`,
 * and `io.adjustResource` cannot invent the resolved maximum on its own — it
 * has no ◈ expression to resolve and no `turnsPerRound` to resolve it with.
 * The caller has usually already resolved it (`u.sustainability` on a
 * snapshot); this intent carries that number through rather than a delta the
 * writer would have to reconstruct it from.
 *
 * @param {string} unitId
 * @param {string} key
 * @param {number} value
 * @returns {Intent}
 */
export const setResource = (unitId, key, value) =>
  ({ t: "resource", unitId, key, delta: value, absolute: true });

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
 * Switch a mode off and bar it from returning until a tick.
 *
 * Two sheets carry the clause in the same words -- Raikou's Mad Enhancement
 * *"can be deactivated for 1◈ Turns by spending a Command Spell"*, and
 * Penthesilea's Hatred of Achilles *"can be disabled for 1◈ Turns by spending
 * one Command Spell"* -- and both were prose until this existed.
 *
 * Distinct from `setMode(…, false)`, which a forced mode undoes on the next
 * invalidation: the bar is the point, not the switch.
 *
 * @param {string} unitId
 * @param {string} abilityId a slug or a content id
 * @param {number} untilTick the global turn the suspension lifts at
 * @param {string|null} [source]
 * @returns {object}
 */
export const suspendSkill = (unitId, abilityId, untilTick, source = null) =>
  ({ t: "suspendSkill", unitId, abilityId, untilTick, source });

/**
 * Put a Unit into a stance (Ch. 44 §44.1).
 *
 * Emitted by the Turn boundary for *"always Dismounted when it is not his
 * Turn"*, and by the sheet control for the declaration.
 */
export const setStance = (unitId, stance, source = null) =>
  ({ t: "setStance", unitId, stance, source });

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

/**
 * Raise a named game event from inside a write.
 *
 * `fireEvent` is normally called by whoever is driving the turn, with the
 * event's context in hand. Some events are only knowable at the moment of the
 * write itself: `curseStageChanged` carries the SIZE of a stage jump, and only
 * the stacking resolution knows the before and the after.
 *
 * So the write emits an intent and the applier dispatches it, the same way
 * `noteDebuffs` turns landed debuffs into queued counters -- one new intent
 * kind rather than a second event bus.
 *
 * @param {string} event
 * @param {object} payload
 * @returns {Intent}
 */
/**
 * Write a staged effect's stage directly.
 *
 * Van Gogh's `Gogh` buff eats one stage of her Curse per attack, which is
 * neither a removal nor a fresh application: the instance stays, its clock
 * stays, and only the number moves.
 *
 * @param {string} unitId
 * @param {string} defId
 * @param {number} stage
 * @returns {Intent}
 */
export const setStage = (unitId, defId, stage) =>
  ({ t: "setStage", unitId, defId, stage });

export const event = (event_, payload) =>
  ({ t: "event", event: event_, payload });

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
  // ...and a heal whose CEILING is being raised in the same batch. Kingprotea's
  // Proliferation grants a stock and restores 20% of her Health in one turn-end
  // handler; the stock is what lifts her maximum, so at the ordinary `heal`
  // rank the restore was clamped to the maximum she had a moment ago and the
  // "and current Health" half of her sheet did nothing. Found live.
  if (intent.t === "heal" && intent.afterEffects) return ORDER.applyEffect + 0.5;
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
    // `event` joins `log` and `prompt` as an intent addressed to no one: its
    // subject rides in the payload, because one raised event can concern the
    // unit it happened to, the unit that caused it, and neither of them is
    // "the unit being written to".
    const addressless = intent.t === "log" || intent.t === "prompt" || intent.t === "event";
    if (!addressless && !intent.unitId && !intent.masterId) {
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
  durationDelta: ["delta"],
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

/**
 * Who an `event` intent is about.
 *
 * An `event` is addressless — `batch()` files it under `null` because it is
 * not a write to any one unit — so the dispatcher cannot take the subject from
 * the group the way every other intent type does. It comes from the payload,
 * which is where the write that raised it put the unit it happened to.
 *
 * The group is the fallback rather than the other way round: the unit a stage
 * change HAPPENED to is not always the unit whose write raised it. Shadow of
 * Longing takes stages off an enemy and gives them to Van Gogh, and both ends
 * raise `curseStageChanged` about different Units inside one batch.
 *
 * @param {Intent} intent
 * @param {string|null} groupUnitId
 * @returns {string|null}
 */
export function eventSubject(intent, groupUnitId) {
  return intent?.payload?.unitId ?? groupUnitId ?? null;
}
