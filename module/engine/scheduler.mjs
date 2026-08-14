/**
 * @file Turn and round boundary sequences.
 * @see docs/25-turn-system.md §25.4, docs/07-time-model.md §7.7
 *
 * Layer 3. The **sequences** here are pure — they take a board snapshot and a
 * tick and return intents. Only `Scheduler.attach` in the Foundry layer binds
 * them to hooks, and only the active GM client runs them, so exactly one client
 * fires each effect.
 *
 * The ordering inside `endTurn` is load-bearing and asserted directly by tests:
 *
 *   - expiry (step 5) runs **after** the final periodic tick (step 4), so an
 *     effect that ends this turn still deals its last tick of damage;
 *   - the acted-unit pass (step 2) covers units of **every** faction, not just
 *     the active player's, because `Sap` fires "at the end of any turn it Acts".
 */

import { INFINITE } from "../domain/enums.mjs";
import * as I from "./intents.mjs";

/**
 * @typedef {object} SchedulerContext
 * @property {number} tick the global turn index, monotonic across the match
 * @property {number} round
 * @property {number} turnsPerRound
 * @property {string|null} activeFactionId
 * @property {Record<string, number>} [rolls] pre-rolled values keyed by purpose
 */

/* -------------------------------------------------------------------------- */
/*  Turn boundaries                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The end-of-turn sequence.
 *
 * @param {object} board
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function endTurn(board, ctx) {
  const units = board.units ?? [];
  /** @type {Intent[]} */
  const intents = [];

  // 1. Turn-end handlers for the active faction's units.
  intents.push(...fireEvent("turnEnd", units.filter((u) => u.factionId === ctx.activeFactionId), ctx));

  // 2. Turn-end handlers for EVERY unit that acted, of any faction. Sap and
  //    Bleed fire "at the end of the unit's turn AND at the end of any turn it
  //    Acts", which is why this pass is not scoped to the active player.
  intents.push(...fireEvent("actedTurnEnd", units.filter((u) => u.acted), ctx));

  // 3. Cooldowns advance at each ability's own rate.
  intents.push(...advanceCooldowns(units, ctx));

  // 4. Periodic effects due at turn end.
  intents.push(...tickPeriodics(units, "turnEnd", ctx));

  // 5. Expiry — after the final tick, so an effect ending now still ticks.
  intents.push(...expireEffects(units, ctx));

  // 6. Sustainability and removal checks.
  intents.push(...checkRemovals(units, ctx));

  return intents;
}

/**
 * The start-of-turn sequence.
 * @param {object} board
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function beginTurn(board, ctx) {
  const units = board.units ?? [];
  const mine = units.filter((u) => u.factionId === ctx.activeFactionId);
  /** @type {Intent[]} */
  const intents = [I.log({ kind: "turnStart", faction: ctx.activeFactionId, tick: ctx.tick })];

  // Per-unit turn state resets for the incoming player only.
  for (const u of mine) intents.push(resetTurnState(u));

  // Turn-start effects: Disorder's Skill Seal roll, Shock's action-loss roll.
  // These fire for EVERY unit, because a unit under Shock rolls at the start of
  // its own turn regardless of whose turn it is in the global order.
  intents.push(...fireEvent("turnStart", units, ctx));

  return intents;
}

/* -------------------------------------------------------------------------- */
/*  Round boundaries                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The end-of-round sequence.
 * @param {object} board
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function endRound(board, ctx) {
  const units = board.units ?? [];
  /** @type {Intent[]} */
  const intents = [];

  // Round-end periodics: Burn (50), Poison (20 × 2^(N−1)), Freeze's 100 Ice.
  intents.push(...tickPeriodics(units, "roundEnd", ctx));
  intents.push(...fireEvent("roundEnd", units, ctx));
  intents.push(...expireEffects(units, ctx, "roundEnd"));
  intents.push(I.log({ kind: "roundEnd", round: ctx.round }));
  return intents;
}

/**
 * The start-of-round sequence.
 *
 * Poison's stage increments here, not on application: *"the stage increases at
 * the start of the Round if the unit is still poisoned"*. Applying it at tick
 * time instead would double-count on the round the poison lands.
 *
 * @param {object} board
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function beginRound(board, ctx) {
  const units = board.units ?? [];
  /** @type {Intent[]} */
  const intents = [I.log({ kind: "roundStart", round: ctx.round })];

  for (const u of units) {
    for (const e of u.effectInstances ?? []) {
      if (e.defId !== "poison") continue;
      intents.push(I.applyEffect(u.id, { ...e, stage: (e.stage ?? 0) + 1 }, e.sourceUnitId));
    }
  }
  intents.push(...fireEvent("roundStart", units, ctx));
  return intents;
}

/* -------------------------------------------------------------------------- */
/*  Steps                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fire every rule element listening for `event` on the given units.
 * @param {string} event
 * @param {object[]} units
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function fireEvent(event, units, ctx) {
  /** @type {Intent[]} */
  const out = [];
  for (const u of units) {
    for (const handler of u.eventHandlers ?? []) {
      if (handler.event !== event) continue;
      out.push(...(handler.intents ?? []));
      out.push(I.log({ kind: "event", event, unitId: u.id, source: handler.source, tick: ctx.tick }));
    }
  }
  return out;
}

/**
 * Advance every ability cooldown by its own rate.
 *
 * The rate is per-ability rather than a global 1-per-turn because `NP Regen`
 * adds to it, `NP Lag` halves it, and `NP Lock` stops it without being NP Seal.
 * A unit under `Stop` has all its clocks frozen in both directions.
 *
 * @param {object[]} units
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function advanceCooldowns(units, ctx) {
  /** @type {Intent[]} */
  const out = [];
  for (const u of units) {
    if ((u.effects ?? []).includes("stop")) continue;
    for (const a of u.abilities ?? []) {
      if (a.cooldownRemaining <= 0) continue;
      const rate = cooldownRate(u, a, ctx);
      if (rate > 0) out.push(I.cooldown(u.id, a.id, rate, "reduce"));
    }
  }
  return out;
}

/**
 * @param {object} unit
 * @param {object} ability
 * @param {SchedulerContext} ctx
 * @returns {number} turns of cooldown removed this turn
 */
export function cooldownRate(unit, ability, ctx) {
  const held = unit.effects ?? [];
  if (held.includes("npLock") && ability.isNP) return 0;
  if (held.includes("npDegen") && ability.isNP) return -1;
  // NP Lag halves the rate — every other turn, keyed on the global tick so it
  // stays consistent across a reconnect.
  if (held.includes("npLag") && ability.isNP && ctx.tick % 2 === 1) return 0;
  return 1 + (ability.regen ?? 0);
}

/**
 * Emit the damage or healing due from periodic effects at this boundary.
 *
 * Volatile-debuff damage *"ignores all effects that modify the amount of damage
 * dealt and/or received"*, so it is emitted as a bare intent and never runs the
 * pipeline — but it is still damage for trigger purposes.
 *
 * @param {object[]} units
 * @param {"turnEnd"|"roundEnd"} when
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function tickPeriodics(units, when, ctx) {
  /** @type {Intent[]} */
  const out = [];
  for (const u of units) {
    if ((u.effects ?? []).includes("stop")) continue;
    for (const e of u.effectInstances ?? []) {
      const spec = PERIODICS[e.defId];
      if (!spec || spec.when !== when) continue;
      if (spec.actedOnly && !u.acted) continue;

      // An effect does not tick on the turn it expires (Ch. 11 §11.9).
      if (e.expiry !== null && e.expiry !== undefined && e.expiry <= ctx.tick) continue;

      const amount = spec.amount(e);
      const converted = (u.effects ?? []).includes(spec.healConversion);
      out.push(
        converted
          ? I.heal(u.id, amount, e.defId)
          : I.damage(u.id, amount, null, { periodic: true, defId: e.defId, bypassModifiers: true }),
      );
    }
  }
  return out;
}

/**
 * The periodic-damage catalogue. Amounts are from Appendix A §A.12.
 * @type {Readonly<Record<string, {when: string, amount: (e: object) => number,
 *   actedOnly?: boolean, healConversion?: string}>>}
 */
export const PERIODICS = Object.freeze({
  curse: { when: "turnEnd", amount: (e) => 25 * (e.stage || 1), healConversion: "cursHeal" },
  poison: { when: "roundEnd", amount: (e) => 20 * 2 ** ((e.stage || 1) - 1), healConversion: "poisHeal" },
  burn: { when: "roundEnd", amount: () => 50, healConversion: "flamHeal" },
  scald: { when: "roundEnd", amount: () => 50 },
  sap: { when: "turnEnd", amount: () => 50, actedOnly: true },
  bleed: { when: "turnEnd", amount: () => 50, actedOnly: true },
  freeze: { when: "roundEnd", amount: () => 100 },
  crystalfreeze: { when: "roundEnd", amount: () => 100 },
  crystallize: { when: "turnEnd", amount: () => 50, actedOnly: true },
});

/**
 * Remove effects whose absolute expiry tick has arrived.
 *
 * Durations are stored as **absolute expiry ticks**, not countdowns. That is
 * what makes `Stop`'s clock freeze expressible (it shifts expiries rather than
 * skipping decrements) and what keeps a mid-match ◈ change from corrupting
 * every duration on the board.
 *
 * @param {object[]} units
 * @param {SchedulerContext} ctx
 * @param {string} [reason]
 * @returns {Intent[]}
 */
export function expireEffects(units, ctx, reason = "expired") {
  /** @type {Intent[]} */
  const out = [];
  for (const u of units) {
    for (const e of u.effectInstances ?? []) {
      if (e.expiry === null || e.expiry === undefined || e.expiry === INFINITE) continue;
      if (e.expiry > ctx.tick) continue;
      // Expiry is never blocked by Unremovable or by removal resistance —
      // those govern Cure and Dispel, not the clock.
      out.push(I.removeEffect(u.id, e.id ?? e.defId, reason));
    }
  }
  return out;
}

/**
 * Sustainability decay and the disappearance check.
 *
 * A Servant with `sustainability: null` has no clock at all — Independent
 * Action at A+ or EX. That is not "a very large number"; the field is absent
 * and the check must not run.
 *
 * @param {object[]} units
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function checkRemovals(units, ctx) {
  /** @type {Intent[]} */
  const out = [];
  for (const u of units) {
    if (u.kind !== "servant") continue;
    if (u.contract !== "free" && u.contract !== "unbound") continue;
    if (u.sustainability === null || u.sustainability === undefined) continue;

    out.push(I.resource(u.id, "sustainability", -1));
    if (u.sustainability - 1 <= 0) {
      out.push(I.defeat(u.id, "sustainabilityExhausted"));
      out.push(I.log({ kind: "disappear", unitId: u.id, tick: ctx.tick }));
    }
  }
  return out;
}

/**
 * @param {object} unit
 * @returns {Intent}
 */
function resetTurnState(unit) {
  return I.log({ kind: "resetTurnState", unitId: unit.id });
}
