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
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { endOfRoundHomeBase } from "../rules/environment.mjs";
import { terrainPeriodics } from "../rules/terrain.mjs";
import { multiServantTax } from "../rules/relationships.mjs";
import { transferEffect, transferableFrom } from "../rules/effect-flow.mjs";
import { chebyshev } from "../domain/geometry.mjs";
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

  // 6. Terrain's own boundary clauses -- Burning's inescapable Burn, Poison
  //    Swamp's stage roll. After the periodics above, because a terrain that
  //    inflicts Poison should not also tick it in the same breath.
  intents.push(...terrainIntents(terrainPeriodics(units, board, "turnEnd"), ctx));

  // 7. The multi-Servant tax (§16.7). Flat 25 Health per Master whose Servants
  //    acted more than once this Turn, and a LOSS rather than damage, so
  //    nothing reduces it.
  intents.push(...multiServantIntents(units, ctx));

  // 8. Sustainability and removal checks.
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
  // Eldritch's coin flip is a turn-START clause.
  intents.push(...terrainIntents(terrainPeriodics(units, board, "turnStart"), ctx));

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
  // Home Base regeneration and the three-Round debuff cure (Ch. 19 §19.1 E1,
  // E2). The rules layer returns descriptors; turning them into intents is this
  // layer's job, the same division the `OnEvent` action table uses.
  intents.push(...homeBaseIntents(endOfRoundHomeBase(units, board)));
  intents.push(...terrainIntents(terrainPeriodics(units, board, "roundEnd"), ctx));
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
      if (!listensFor(handler, event)) continue;
      for (const action of handler.actions ?? []) {
        out.push(...dispatch(action, u, handler, ctx));
      }
      out.push(I.log({ kind: "event", event, unitId: u.id, source: handler.source, tick: ctx.tick }));
    }
  }
  return out;
}

/**
 * `Script` handlers still carry a bare `event`, and so does any handler built
 * before normalization — accept both rather than silently listening to nothing.
 *
 * @param {object} handler
 * @param {string} event
 * @returns {boolean}
 */
function listensFor(handler, event) {
  return handler.events ? handler.events.includes(event) : handler.event === event;
}

/**
 * Turn one normalized action into intents.
 *
 * The vocabulary is Ch. 24 §24.5's action list, which is deliberately smaller
 * than the rule-element list: an element describes a standing contribution, an
 * action describes a thing that happens once, at a moment, to a unit.
 *
 * An unknown action produces a log entry naming it rather than nothing. That is
 * the whole lesson of this defect — a handler that cannot act must *say so*,
 * because a silent no-op is indistinguishable from a rule that does not exist.
 *
 * @param {object} action
 * @param {object} unit
 * @param {object} handler
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
export function dispatch(action, unit, handler, ctx) {
  const run = ACTIONS[action.kind];
  if (!run) {
    return [I.log({ kind: "unhandledAction", action: action.kind, unitId: unit.id, source: handler.source })];
  }
  return run(action, unit, handler, ctx);
}

/**
 * Resolve a rolled amount for an action.
 *
 * These sequences are pure — the caller rolls and passes the totals in through
 * `ctx.rolls`, keyed by table id. A missing roll yields `null` rather than 0, so
 * "nobody rolled this" is distinguishable from "it rolled nothing".
 *
 * @param {object} action
 * @param {SchedulerContext} ctx
 * @returns {number|null}
 */
function rolled(action, ctx) {
  if (!action.roll) return typeof action.amount === "number" ? action.amount : null;
  const total = ctx.rolls?.[action.roll.key];
  return typeof total === "number" ? total + (action.roll.bonus ?? 0) : null;
}

/** @type {Readonly<Record<string, (a: object, u: object, h: object, c: object) => Intent[]>>} */
const ACTIONS = Object.freeze({
  Damage: (a, u) => [I.damage(u.id, a.amount ?? 0, null, { event: true, defId: a.defId ?? null })],

  Heal: (a, u, h, c) => {
    const amount = rolled(a, c);
    return amount === null ? [] : [I.heal(u.id, amount, h.source)];
  },

  StatDelta: (a, u) => [I.statDelta(u.id, a.stat, a.delta ?? 0)],

  ResourceDelta: (a, u) => [I.resource(u.id, a.resource, a.delta ?? 0)],

  CooldownDelta: (a, u, h) =>
    [I.cooldown(u.id, a.ability ?? h.abilityId, Math.abs(a.delta ?? 0), a.delta < 0 ? "reduce" : "set")],

  ApplyEffect: (a, u, h) => [I.applyEffect(u.id, a.effect, h.abilityId)],

  RemoveEffect: (a, u) => [I.removeEffect(u.id, a.effect ?? a.defId, "event")],

  Message: (a, u, h) => [I.log({ kind: "message", text: a.text, unitId: u.id, source: h.source })],

  /**
   * Move effects from other units onto this one, keeping their durations.
   *
   * Van Gogh's *Shadow of Longing* is the reference case, and it transfers
   * DEBUFFS -- the keyword's own wording is about buffs, which is exactly the
   * trap: the selector is what decides, not the name.
   */
  Transfer: (a, u, h, c) => {
    const from = (c.board?.units ?? []).filter((other) =>
      other.id !== u.id
      && chebyshevish(other.panel, u.panel) <= (a.radius ?? 0));

    return transferableFrom(from, { defId: a.effect ?? null, polarity: a.polarity ?? null })
      .flatMap(({ unit: source, instance }) => transferEffect(instance, source, u))
      .map((d) => (d.kind === "removeEffect"
        ? I.removeEffect(d.unitId, d.effectId, d.reason)
        : I.applyEffect(d.unitId, d.effect, h.abilityId)));
  },

  /**
   * Battle Continuation and God Hand: come back instead of being defeated.
   *
   * The gate is the skill's **own cooldown**, read off the unit's ability list
   * and set by this action. That reuses the clock `advanceCooldowns` already
   * turns rather than inventing a second one — and it means the window is
   * visible on the sheet, where a player can see why the revive did not happen.
   */
  Revive: (a, u, h, c) => {
    if (onCooldown(u, h.abilityId)) return [];
    const amount = rolled(a, c);
    if (amount === null || amount <= 0) return [];

    // "3◈" is three *Rounds*; `cooldownRemaining` counts turns. `resolveTicks`
    // is what knows the difference, and it needs `turnsPerRound` from the ctx.
    const ticks = resolveTicks(parseTick(a.cooldown), c);
    return [
      I.heal(u.id, amount, h.source),
      ...(h.abilityId && ticks > 0 ? [I.cooldown(u.id, h.abilityId, ticks, "set")] : []),
      I.log({ kind: "revive", unitId: u.id, source: h.source, amount, tick: c.tick }),
    ];
  },
});

/**
 * @param {object} unit
 * @param {string|null} abilityId
 * @returns {boolean}
 */
function onCooldown(unit, abilityId) {
  if (!abilityId) return false;
  const ability = (unit.abilities ?? []).find((a) => a.id === abilityId);
  return (ability?.cooldownRemaining ?? 0) > 0;
}

/**
 * The rolls a unit's handlers for `event` will need, before the event fires.
 *
 * The other half of the "caller rolls" contract. `fireEvent` is pure and reads
 * totals out of `ctx.rolls`; without this, a caller has no way to discover that
 * `unitDefeated` on this unit needs a `4d20` — it would have to know the
 * content, which is exactly the coupling the rule elements exist to avoid.
 *
 * @param {object} unit
 * @param {string} event
 * @returns {Array<{key: string, formula: string|null, bonus: number}>}
 */
export function pendingRolls(unit, event) {
  /** @type {Array<{key: string, formula: string|null, bonus: number}>} */
  const out = [];
  for (const handler of unit.eventHandlers ?? []) {
    if (!listensFor(handler, event)) continue;
    for (const action of handler.actions ?? []) {
      if (action.roll?.formula) out.push({ ...action.roll });
    }
  }
  return out;
}

/**
 * Decide what happens to a unit that has run out of Health.
 *
 * This is the reader `unitDefeated` never had. The event was authored on
 * Battle Continuation from the beginning and nothing ever fired it, so the
 * question "is this unit dead" was answered without ever asking the one rule
 * that exists to answer it differently.
 *
 * A revive is any handler that heals: if the unit is going to have Health
 * again, it is not defeated, and the defeat intent is never emitted. Order
 * matters less than it looks — `intents.order` puts the heal before the
 * defeat anyway — but *not emitting* the defeat is what keeps the unit on the
 * board, rather than defeating it and healing the corpse.
 *
 * @param {object} unit a unit snapshot
 * @param {SchedulerContext} ctx
 * @param {string} [cause]
 * @returns {Intent[]}
 */
export function resolveDefeat(unit, ctx, cause = "damage") {
  if ((unit.health?.value ?? 0) > 0) return [];

  const intents = fireEvent("unitDefeated", [unit], ctx);
  const revived = intents.some((i) => i.t === "heal" && i.amount > 0);

  return revived ? intents : [...intents, I.defeat(unit.id, cause)];
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

/**
 * Turn Home Base descriptors into intents.
 *
 * @param {object[]} descriptors
 * @returns {Intent[]}
 */
function homeBaseIntents(descriptors) {
  /** @type {Intent[]} */
  const out = [];
  for (const d of descriptors) {
    switch (d.kind) {
      case "heal": out.push(I.heal(d.unitId, d.amount, d.source)); break;
      case "statDelta": out.push(I.statDelta(d.unitId, d.stat, d.delta)); break;
      case "removeEffect": out.push(I.removeEffect(d.unitId, d.effectId, d.reason)); break;
      default: out.push(I.log({ kind: "unappliedHomeBaseEffect", effect: d.kind, unitId: d.unitId })); break;
    }
  }
  return out;
}

/**
 * Turn terrain descriptors into intents.
 *
 * `chance` clauses need a die. The sequences here are pure, so the caller rolls
 * and the total arrives in `ctx.rolls`, keyed by terrain and outcome. A clause
 * whose roll is missing **logs itself by name** rather than firing or silently
 * vanishing — the difference between "the swamp did not add a stage" and "the
 * swamp was never asked" is exactly what this codebase keeps losing.
 *
 * @param {object[]} descriptors
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
function terrainIntents(descriptors, ctx) {
  /** @type {Intent[]} */
  const out = [];

  for (const d of descriptors) {
    switch (d.kind) {
      case "damage":
        out.push(I.damage(d.unitId, d.amount, null, {
          terrain: d.terrain, element: d.element ?? null,
          // "Fixed" damage ignores everything that modifies damage.
          bypassModifiers: Boolean(d.fixed),
        }));
        break;

      case "applyEffect":
        out.push(I.applyEffect(d.unitId, {
          defId: d.effectId,
          magnitude: d.magnitude ?? 0,
          // A terrain-sourced effect with `duration: null` never expires while
          // the unit stays inside; leaving is what ends it, and leaving is not
          // a removal step.
          expiry: null,
          unremovable: Boolean(d.unremovable),
          sourceTerrain: d.terrain,
        }, null));
        break;

      case "chance": {
        const key = `terrain:${d.terrain}:${d.then}`;
        const roll = ctx.rolls?.[key];
        if (typeof roll !== "number") {
          out.push(I.log({ kind: "terrainRollMissing", terrain: d.terrain, outcome: d.then, unitId: d.unitId, needs: key }));
          break;
        }
        if (roll > d.percent) break;
        out.push(d.then === "poisonStage"
          ? I.log({ kind: "poisonStage", unitId: d.unitId, terrain: d.terrain })
          : I.applyEffect(d.unitId, { defId: d.then, expiry: null, sourceTerrain: d.terrain }, null));
        break;
      }

      default:
        out.push(I.log({ kind: "unappliedTerrainClause", clause: d.kind, unitId: d.unitId, terrain: d.terrain }));
        break;
    }
  }

  return out;
}

/**
 * The multi-Servant tax, for every Master on the board.
 *
 * @param {object[]} units
 * @param {SchedulerContext} ctx
 * @returns {Intent[]}
 */
function multiServantIntents(units, ctx) {
  /** @type {Intent[]} */
  const out = [];
  // The tax is charged "at the end of ITS Turn" -- the Master whose faction
  // just acted, not every Master on the board. Charging all of them would bill
  // seven players for one player's turn.
  const acting = units.filter(
    (u) => u.kind === "master" && (ctx.activeFactionId === null || u.factionId === ctx.activeFactionId),
  );
  for (const master of acting) {
    const servants = units.filter((u) => u.masterId === master.id);
    for (const d of multiServantTax(master, servants, { grandOrder: ctx.grandOrder })) {
      // `statDelta`, not `damage`: a loss bypasses every reduction effect.
      out.push(I.statDelta(d.unitId, d.stat, d.delta));
      out.push(I.log({ kind: "multiServantTax", unitId: d.unitId, amount: -d.delta }));
    }
  }
  return out;
}

/**
 * Chebyshev distance that tolerates a missing panel.
 *
 * A transfer radius is measured on the board, and a unit projected without a
 * position must not silently count as adjacent to everything.
 *
 * @param {object|null} a
 * @param {object|null} b
 * @returns {number}
 */
function chebyshevish(a, b) {
  if (!a || !b) return Infinity;
  return chebyshev(a, b);
}
