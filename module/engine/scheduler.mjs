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
import { endOfRoundHomeBase, regionsAdjacent } from "../rules/environment.mjs";
import { terrainPeriodics } from "../rules/terrain.mjs";
import { multiServantTax } from "../rules/relationships.mjs";
import { transferEffect, transferableFrom } from "../rules/effect-flow.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { currentHealth, maxHealth } from "../domain/health.mjs";
import { test as testPredicate } from "../rules/predicate.mjs";
import * as I from "./intents.mjs";
import { resolveRevival, pendingRevivalRolls } from "../rules/revival.mjs";
import { resourcePathFor } from "../domain/resources.mjs";

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
  // `ctx.board` -- `subjectOf`'s "master" subject resolution and
  // `regionScale`'s Region lookup both read it, and nothing set it: the
  // scheduler-hooks.mjs callers build `ctx` without a `board` field and pass
  // this function's own `board` parameter separately, so every handler fired
  // from a Turn/Round boundary saw `ctx.board` as `undefined`.
  ctx = { ...ctx, board };
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
  // Same boundary, the ACTED half: only a `PeriodicOverride`-widened instance
  // (Sikera Ušum clause c) answers "turnEnd" to this, ever -- no periodic in
  // `PERIODICS` has `when: "actedTurnEnd"` as its own default, so this call
  // is a no-op everywhere the widening does not apply.
  intents.push(...tickPeriodics(units.filter((u) => u.acted), "actedTurnEnd", ctx));

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
  ctx = { ...ctx, board };
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
  ctx = { ...ctx, board };
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
  ctx = { ...ctx, board };
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

      // Ch. 11 §11.9: an effect does not act on the Turn it ends. Enforced for
      // `periodic:` effects since the periodic pass was written, and nowhere
      // for the handlers an effect contributes -- Regen's three intervals are
      // handlers, not a periodic, so it would have healed once more on its way
      // out. `null` for an ability's own handler, which has no clock.
      if (handler.expiry !== null && handler.expiry !== undefined
        && handler.expiry <= (ctx.tick ?? 0)) continue;

      // Charm: "removed at the end of the Combat Phase if the unit takes
      // damage from an attack." The caller reports who the phase actually
      // damaged; an untracked phase damages nobody, so the clause cannot fire
      // on an event that never measured it.
      if (handler.requiresDamagedThisPhase && !(ctx.damagedIds ?? []).includes(u.id)) continue;

      // A condition on somebody OTHER than the owner, evaluated now because
      // the event carries them. Scáthach's Alpi pays double against an Undead
      // or Divine Defending Unit, and the Defending Unit does not exist when
      // the contribution is collected.
      if (handler.targetPredicate
        && !testPredicate(handler.targetPredicate, { options: ctx.options ?? new Set() })) continue;

      // The event's SUBJECT, for events that have one. `abilityUsed` fires for
      // every ability; a handler that names a category only wants to hear
      // about that family.
      if (handler.ofCategory && !handler.ofCategory.includes(ctx.subject?.category ?? null)) continue;

      // The mirror: HGoB Construction source 5 (Ch. 32) is "a non-Spell
      // Skill used, EXCLUDING Item Construction" -- two exclusions
      // (category AND a specific ability), neither of which `ofCategory`'s
      // include-list can express.
      if (handler.excludeCategory?.includes(ctx.subject?.category ?? null)) continue;
      if (handler.excludeContentId?.includes(ctx.subject?.contentId ?? null)) continue;
      // "A non-Spell SKILL" is this game's own vocabulary for a category
      // distinct from both Spells and Noble Phantasms (every other clause in
      // the corpus keeps the three apart, e.g. Presence Concealment's "Active
      // Skills ... does not include Attack Skills and Spells"), so a Noble
      // Phantasm use is excluded the same way a Spell is, by its own flag
      // rather than a `category` neither NPs nor ordinary Skills carry.
      if (handler.excludeNP && ctx.subject?.isNP) continue;

      // A standing charge the bearer has ALREADY PAID a bigger version of this
      // Turn. Karna's Note 2: *"when Karna uses a NP that deals damage, his
      // Master's Health loss from him using the NP **overwrites** the 20 Health
      // loss from when Karna would normally Act/Attack."*
      //
      // §15.4's `supersedes` is the right idea in the wrong scope -- it resolves
      // a set of costs against each other at the moment an ability is used, and
      // this charge is not a cost of any ability. It is a standing upkeep that
      // falls due at the end of a Turn, and what suppresses it happened earlier
      // in that same Turn. So the question is asked where the Turn record is:
      // `turnState.abilitiesUsed`, matched against the bearer's own abilities to
      // recover the category, because the record holds ids.
      if (handler.unlessUsedThisTurn && usedThisTurn(u, handler.unlessUsedThisTurn)) continue;

      // Actions in one `then:` list see each other's effects. Mad Enhancement
      // drains its Master and then asks whether that Master is now at or below
      // the floor -- and computing both against the same starting value made
      // the forced deactivation lag a full Turn behind the drain that caused
      // it.
      //
      // A local overlay rather than a re-read, because this pass is pure: the
      // intents have not been applied and will not be until the caller applies
      // them.
      /** @type {Map<string, number>} */
      const pending = new Map();
      for (const action of handler.actions ?? []) {
        const produced = dispatch(action, u, handler, { ...ctx, pending });
        for (const i of produced) {
          if (i.t === "statDelta" && i.stat === "health.value") {
            pending.set(i.unitId, (pending.get(i.unitId) ?? 0) + i.delta);
          }
        }
        out.push(...produced);
      }
      // A handler that pays SUSTAINABILITY rather than running actions.
      // `SustainabilityGain` has put this on the handler since the element
      // was written and nothing ever read it back, so the only clause in the
      // corpus whose Sustainability GROWS instead of draining -- Jack the
      // Ripper's "every time Jack kills a Human when she is a Free Servant,
      // increase her Sustainability by 1◈ Turns" -- had no payer.
      if (handler.sustainabilityGain) {
        const gain = resolveTicks(parseTick(`${handler.sustainabilityGain}◈`), ctx);
        out.push(I.statDelta(u.id, "sustainabilityRemaining", gain, false));
      }
      // A count-limited handler spends a charge each time it pays out.
      if (handler.consumesUse && handler.defId) out.push(I.consumeUse(u.id, handler.defId));
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
 * Has this Unit used a matching ability this Turn?
 *
 * A `{category}` or a `{contentId}` -- a category for the same reason every
 * other grouping in this system prefers one: Karna's three damaging Noble
 * Phantasms share `karnaNP`, and naming them one by one goes stale the moment a
 * fourth is written.
 *
 * The turn record holds ability **ids**, so the categories are recovered from
 * the Unit's own ability list. Read stale-by-tick like the rest of turn state
 * (`turnStateAt` blanks a list stamped with an earlier tick), so a missed reset
 * cannot suppress an upkeep for ever.
 *
 * @param {object} unit a snapshot
 * @param {{category?: string|string[], contentId?: string|string[]}} spec
 * @returns {boolean}
 */
function usedThisTurn(unit, spec) {
  const used = new Set(unit?.turnState?.abilitiesUsed ?? []);
  if (used.size === 0) return false;

  const categories = new Set([spec.category ?? []].flat());
  const contentIds = new Set([spec.contentId ?? []].flat());

  return (unit.abilities ?? []).some((a) => {
    if (!used.has(a.id) && !used.has(a.contentId)) return false;
    if (contentIds.has(a.contentId) || contentIds.has(a.id)) return true;
    return categories.has(a.category);
  });
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

  // WHOSE the action is. Mad Enhancement's first clause is *"this Servant's
  // MASTER loses Health at the end of every Turn it Acts"* -- an effect on the
  // bearer whose consequence lands on somebody else, and every action here
  // acted on `u.id`. A Master who cannot be named cannot be charged, so the
  // clause could not be written at all.
  const subject = subjectOf(action, unit, ctx);
  if (!subject) return [];
  // A gate on the action's OWN roll, so an action can fire on some faces and
  // not others. Shock is the case: *"at the start of every turn, roll d6; on 3
  // or 4 the unit cannot act."* That is not a chance-to-apply -- the effect it
  // applies has its own -- it is a face test on a die the handler rolled.
  if (!rollGatePasses(action, ctx)) return [];
  if (!valueGatePasses(action, unit, ctx)) return [];
  return run(action, subject, handler, ctx);
}

/**
 * The unit an action acts on.
 *
 * `self` by default. `master` resolves through the bearer's `masterId` against
 * the board, and returns **null** when there is no Master -- a Free Servant
 * running Mad Enhancement has nobody to drain, and charging the Servant
 * instead would be inventing a rule.
 *
 * @param {object} action
 * @param {object} unit
 * @param {SchedulerContext} ctx
 * @returns {object|null}
 */
function subjectOf(action, unit, ctx) {
  if ((action.subject ?? "self") !== "master") return unit;
  if (!unit?.masterId) return null;
  return (ctx.board?.units ?? []).find((u) => u.id === unit.masterId) ?? null;
}

/**
 * A gate on a VALUE rather than on a die.
 *
 * Mad Enhancement again: *"when its Master's Health is 30 or less, ME is
 * forcibly deactivated"*. The subject is resolved the same way the action's is,
 * so one clause can drain the Master and the next can test what is left.
 *
 * @param {object} action
 * @param {object} unit
 * @param {SchedulerContext} ctx
 * @returns {boolean}
 */
function valueGatePasses(action, unit, ctx) {
  const gate = action.whenValue ?? null;
  if (!gate) return true;

  const subject = subjectOf({ subject: gate.subject }, unit, ctx);
  if (!subject) return false;

  const base = gate.stat === "health.value" ? currentHealth(subject) : readStat(subject, gate.stat);
  if (typeof base !== "number") return false;

  // Plus whatever earlier actions in this same handler have already taken.
  const current = gate.stat === "health.value"
    ? base + (ctx.pending?.get(subject.id) ?? 0)
    : base;
  if (gate.lte !== undefined && current > gate.lte) return false;
  if (gate.gte !== undefined && current < gate.gte) return false;
  return true;
}

/**
 * A dotted stat path off a snapshot, which may hold a flat number or a pool.
 * @param {object} unit
 * @param {string} path
 * @returns {number|null}
 */
function readStat(unit, path) {
  const value = String(path).split(".").reduce((o, k) => (o === null || o === undefined ? o : o[k]), unit);
  if (typeof value === "number") return value;
  // `agility` on a snapshot is a pool; `agility.value` is the number.
  return typeof value?.value === "number" ? value.value : null;
}

/**
 * Does the action's `when` gate let it through?
 *
 * `{ in: [3, 4] }` names faces; `{ gte, lte }` names a band. A gate with no
 * roll to test against **refuses**, which is the safe direction: an action
 * whose die never arrived has not rolled a 3.
 *
 * @param {object} action
 * @param {SchedulerContext} ctx
 * @returns {boolean}
 */
function rollGatePasses(action, ctx) {
  const gate = action.when ?? null;
  if (!gate) return true;

  const total = ctx.rolls?.[action.roll?.key];
  if (typeof total !== "number") return false;

  if (gate.in) return gate.in.includes(total);
  if (gate.gte !== undefined && total < gate.gte) return false;
  if (gate.lte !== undefined && total > gate.lte) return false;
  return true;
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
    // Regen: *"Health is restored by 10% of its MAXIMUM value."* Of maximum,
    // not of current -- the same reading `skill-use.mjs`'s `heal` phase makes,
    // and for the same reason: 10% of a nearly-dead unit's current Health is a
    // rounding error, which is not what a regeneration buff is for.
    if (typeof a.percentOfMax === "number") {
      const amount = Math.floor(maxHealth(u) * (a.percentOfMax / 100));
      return amount > 0 ? [I.heal(u.id, amount, h.source)] : [];
    }
    const amount = rolled(a, c);
    return amount === null ? [] : [I.heal(u.id, amount, h.source)];
  },

  /**
   * Move a stat, optionally by a rank table and optionally down to a floor.
   *
   * `floor` is Mad Enhancement's *"its Master's Health cannot drop below 30 in
   * this way"* -- a limit on THIS deduction rather than on the pool, so other
   * damage may still take the Master below it.
   */
  StatDelta: (a, u) => {
    // `amount` arrives from a rank table resolved at collection time and is
    // always POSITIVE there, so `direction` says which way it moves. `delta`
    // stays for a literal signed value.
    const raw = a.amount !== undefined
      ? (a.direction === "down" ? -Math.abs(a.amount) : Math.abs(a.amount))
      : (a.delta ?? 0);
    if (raw === 0) return [];

    if (typeof a.floor !== "number") return [I.statDelta(u.id, a.stat, raw)];

    const current = a.stat === "health.value" ? currentHealth(u) : readStat(u, a.stat);
    if (typeof current !== "number") return [];
    // Already at or below the floor: this deduction takes nothing at all.
    const allowed = Math.max(0, current - a.floor);
    const applied = raw < 0 ? -Math.min(allowed, Math.abs(raw)) : raw;
    return applied === 0 ? [] : [I.statDelta(u.id, a.stat, applied)];
  },

  /**
   * Switch a mode off (or on) from an event.
   *
   * *"When its Master's Health is 30 or less, Mad Enhancement is forcibly
   * deactivated"* -- the one clause in the reference set where an effect turns
   * an ability off rather than modifying it.
   */
  SetMode: (a, u, h) => [I.setMode(u.id, a.ability, a.active === true, h.source)],

  ResourceDelta: (a, u, h, c) => {
    // `rolled()` falls back to `a.amount`, not `a.delta` — the bare-number
    // shape every ResourceDelta shipped with before Semiramis's HGoB
    // Construction needed a rolled gain (Ch. 32 "1d4+2 per Turn"). A roll
    // that has not arrived yet writes nothing, same as `Heal`.
    const raw = a.roll ? rolled(a, c) : (a.delta ?? 0);
    if (raw === null) return [];
    const amount = a.regionScaled ? regionScale(raw, a.regionScaled, c.board?.warRegion) : raw;
    if (amount === 0) return [];
    return [I.resource(u.id, resourcePathFor(a.resource, u), amount)];
  },

  /**
   * Turn a cooldown clock, by ability or across a whole scope.
   *
   * `scope: "np"` is what Scáthach's Alpi needs: *"NP Cooldown is reduced by
   * ½◈ Turns"* names no ability, and she has two Noble Phantasms. Naming one
   * would pick a winner the sheet does not pick; naming the owning ability
   * would name the **effect**, because that is what carries the rule element.
   *
   * `ticks` is a ◈ expression resolved against the world's turns per Round;
   * `delta` stays for a raw turn count.
   */
  CooldownDelta: (a, u, h, c) => {
    const amount = a.ticks !== undefined
      ? -resolveTicks(parseTick(a.ticks), c)
      : (a.delta ?? 0);

    const ids = a.scope === "np"
      ? (u.abilities ?? []).filter((x) => x.isNP || x.categorizedAsNP).map((x) => x.id)
      : [a.ability ?? h.abilityId].filter(Boolean);

    return ids.map((id) => I.cooldown(u.id, id, Math.abs(amount), amount < 0 ? "reduce" : "set"));
  },

  /**
   * Apply an effect instance.
   *
   * The expiry is computed HERE rather than authored, because durations are
   * stored as absolute ticks (Ch. 07 §7.5) and only the scheduler knows what
   * tick it is. An authored `expiry` would be a turn count masquerading as an
   * absolute one, and would expire immediately or never.
   */
  ApplyEffect: (a, u, h, c) => {
    const ticks = a.duration ? resolveTicks(parseTick(a.duration), c) : null;
    const effect = {
      ...(a.effect ?? {}),
      defId: a.effect?.defId ?? a.effect?.id ?? a.defId,
      magnitude: a.effect?.magnitude ?? a.magnitude ?? 0,
      expiry: ticks === null || ticks === INFINITE ? (a.effect?.expiry ?? null) : (c.tick ?? 0) + ticks,
      sourceUnitId: u.id,
      // Riders state their own chance -- "25% chance of inflicting Deadly
      // Poison" -- and the flow that applies them reads it off the instance,
      // because an intent has nowhere else to put it.
      ...(a.chance !== undefined || a.effect?.chance !== undefined
        ? { chance: a.chance ?? a.effect?.chance } : {}),
      // Queen's Poison's third clause: "a 50% chance of inflicting an
      // additional Stage of Poison ... this 50% extra chance is not affected
      // by debuff chance increasing/reducing effects, it is a flat 50%
      // chance." A rider that names its own probability outright, immune to
      // both the inflicter's outgoing bonus and the target's incoming resist.
      ...(a.bypassChanceModifiers || a.effect?.bypassChanceModifiers
        ? { bypassChanceModifiers: true } : {}),
      // "Inflicts Stage 3 Poison": one application worth three stages, not
      // three applications each rolling their own chance.
      ...(a.stages !== undefined ? { stages: a.stages } : {}),
      // Secret Poison. Hidden only while there is something to hide behind:
      // the disclosure trigger is the inflicter's concealment ending, so an
      // unconcealed inflicter poisons openly and the clause is self-limiting.
      ...(a.secret && concealedNow(u) ? { visibility: "gmOnly", attributionHidden: true } : {}),
    };

    // WHO it lands on. The action used to apply to the handler's owner and
    // nothing else, so every on-hit rider in the catalogue -- `Bleed Atk`,
    // `Queen's Poison`, Serenity's poisoned daggers -- would have inflicted its
    // debuff on the ATTACKER. `target: victim` is the vocabulary Ch. 32 already
    // writes; it just had no reader.
    return targetsOf(a, u, c).map((id) => I.applyEffect(id, { ...effect }, h.abilityId));
  },

  RemoveEffect: (a, u) => [I.removeEffect(u.id, a.effect ?? a.defId, "event")],

  /**
   * Push an effect's expiry further out without reapplying it.
   *
   * *"If EMIYA uses a Thaumaturgy or Projection Skill/NP while he has the Atk
   * Up (Trace) buff, its duration is extended by ⅓◈ Turns."* Distinct from
   * reapplying: reapplication would re-roll the chance, re-run the stacking
   * rule and reset the duration to its authored length rather than adding to
   * whatever is left.
   */
  ExtendEffect: (a, u, h, c) => {
    const held = (u.effectInstances ?? []).find((e) => e.defId === (a.effect ?? a.defId));
    if (!held) return [];
    const ticks = a.ticks !== undefined ? resolveTicks(parseTick(a.ticks), c) : (a.turns ?? 0);
    if (ticks <= 0) return [];
    return [I.extendEffect(u.id, held.defId, ticks, h.source)];
  },

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
 * Which Units an action lands on.
 *
 * Three shapes, and the reference set uses all three: the handler's owner
 * (`self`, the default), the Unit on the other end of the event that fired it
 * (`victim`), and everybody inside a radius (`nearby`) — which is Serenity's
 * Zabaniya, *"any Unit within a 2 panel area of Serenity will be inflicted with
 * Poison at the end of her Turn"*.
 *
 * @param {object} a the action
 * @param {object} u the handler's owner
 * @param {object} c the scheduler context
 * @returns {string[]} unit ids
 */
function targetsOf(a, u, c) {
  switch (a.target ?? "self") {
    case "victim":
      // Absent when the event carries no second party. Emitting nothing is
      // right: a rider with no victim has nobody to ride.
      return c.victim?.unitId ? [c.victim.unitId] : [];

    case "nearby": {
      const radius = a.radius ?? 0;
      const relations = a.relations ?? ["enemy"];
      return (c.board?.units ?? [])
        .filter((other) => other.id !== u.id)
        .filter((other) => chebyshevish(other.panel, u.panel) <= radius)
        .filter((other) => matchesRelation(other, u, relations))
        .map((other) => other.id);
    }

    default:
      return [u.id];
  }
}

/**
 * Does this Unit stand in one of the named relations to the handler's owner?
 *
 * `any` is deliberately its own entry rather than "omit the list": Serenity's
 * Zabaniya says *"any Unit"* and means it — the poison cloud does not check
 * badges — while every other radius clause in the corpus names a side.
 *
 * @param {object} other
 * @param {object} owner
 * @param {string[]} relations
 * @returns {boolean}
 */
function matchesRelation(other, owner, relations) {
  if (relations.includes("any")) return true;
  const allied = other.factionId != null && other.factionId === owner.factionId;
  return relations.includes(allied ? "ally" : "enemy");
}

/**
 * Is this Unit concealed, from the snapshot alone?
 *
 * @param {object} unit
 * @returns {boolean}
 */
function concealedNow(unit) {
  return Boolean(unit?.concealed) || (unit?.effects ?? []).includes("presenceConcealment");
}

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

  // A cascading revival needs one roll per charge it MIGHT spend, because how
  // many it will actually use is not known until the earlier ones have been
  // subtracted from the overkill.
  if (event === "unitDefeated") {
    for (const spec of pendingRevivalRolls(unit)) out.push({ ...spec, bonus: 0 });
  }
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
  // Through `currentHealth`, because this is handed a SNAPSHOT and a snapshot
  // flattens `health` to a number. `unit.health?.value` was `undefined`, the
  // `?? 0` turned that into "no Health left", and every unit this was asked
  // about was declared defeated -- on full Health, from any successful attack.
  //
  // It stayed invisible for as long as `system.defeated` was a field no schema
  // declared, so the write was silently dropped. Two silent defects cancelling
  // to look like working code.
  if (currentHealth(unit) > 0) return [];

  // Handlers first: `unitDefeated` is where content that is not a revival
  // hangs -- Mad Enhancement's Sustainability penalty, a log entry, a counter.
  const intents = fireEvent("unitDefeated", [unit], ctx);

  // Then the revival QUERY, priority-ordered (§31.2). Heracles has four ways
  // back and his sheet states the order: Undying > Guts > Battle Continuation
  // > God Hand. This used to take any handler that healed, in collection order
  // -- indistinguishable from correct with one source, and with four it spends
  // whichever happened to be listed first, burning a God Hand charge while
  // `Undying` sits unused.
  const revival = resolveRevival({ unit, overkill: ctx.overkill ?? 0, rolls: ctx.rolls ?? {} });
  if (revival.revived) {
    return [
      ...intents,
      I.heal(unit.id, revival.restored, revival.source.id, true),
      // §E.5's `unitRevived`, fired here rather than by a second pass, because
      // this is the only place that knows a revival happened AND which source
      // paid for it. Heracles's *Indomitable* is the one clause that listens:
      // "whenever Heracles is defeated and revived through ANY effect" -- so it
      // cannot hang off one of the four, and firing it from each would fire it
      // four times.
      ...fireEvent("unitRevived", [unit], {
        ...ctx,
        options: new Set([`revival:source:${revival.source.id}`]),
      }),
      // Charges are spent whether or not they were enough: "and so on"
      // describes an attempt, not a refund.
      ...spendRevival(unit, revival, ctx),
      I.log({
        kind: "revive", unitId: unit.id, source: revival.source.source,
        amount: revival.restored, charges: revival.chargesUsed, tick: ctx.tick,
      }),
    ];
  }

  // A handler that heals is still a revival -- Battle Continuation is authored
  // as one, and content written before `RevivalSource` existed uses that shape.
  if (intents.some((i) => i.t === "heal" && i.amount > 0)) return intents;

  return [
    ...intents,
    ...(revival.source ? spendRevival(unit, revival, ctx) : []),
    I.defeat(unit.id, cause),
  ];
}

/**
 * Spend what a revival attempt used.
 *
 * A charge on an ABILITY is the same `timesUsed` counter every other
 * whole-match limit spends; a charge on an EFFECT instance is a `consumeUse`,
 * because `Undying` and `Guts` are *"consumed on use"* and an effect with no
 * charges left is an effect that is gone.
 *
 * @param {object} unit
 * @param {object} revival
 * @returns {Intent[]}
 */
function spendRevival(unit, revival, ctx = {}) {
  const source = revival.source;
  if (!source || revival.chargesUsed <= 0 || !source.consumesOnUse) return [];

  if (source.defId) return [I.consumeUse(unit.id, source.defId, revival.chargesUsed)];
  if (!source.abilityId) return [];

  return [
    I.recordUse(unit.id, source.abilityId, null),
    // Its own cooldown, which is how Battle Continuation's 3 Rounds are
    // enforced -- the clock `advanceCooldowns` already turns, visible on the
    // sheet where a player can see why the revive did not happen.
    // A ◈ EXPRESSION on the way in -- "3◈" -- resolved here against the world's
    // turns per Round, because `I.cooldown` takes a turn count. Battle
    // Continuation is 3 Rounds at A, which is nine turns in this world and
    // twenty-four in a Holy Grail War.
    ...(source.cooldown
      ? [I.cooldown(unit.id, source.abilityId, resolveTicks(parseTick(source.cooldown), ctx), "set")]
      : []),
  ];
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
      if (!spec) continue;
      // Sikera Ušum clause c: "Units inflicted with Poison while within this
      // NP area receive Poison damage at the end of its Turn and at the end
      // of any Turn it Acts, IN ADDITION TO at the end of the Round" -- extra
      // triggers a field's `PeriodicOverride` interior rule widens this
      // instance to, on top of its ordinary `spec.when`, not instead of it.
      // "The end of ITS Turn" -- widened only for the unit whose own Turn is
      // actually ending, not for every unit a faction-unscoped `turnEnd` tick
      // happens to reach.
      const overridden = when === "turnEnd"
        ? u.factionId === ctx.activeFactionId
          && (u.periodicOverrides ?? []).some((o) => o.effectId === e.defId && o.triggers.includes(when))
        : (u.periodicOverrides ?? []).some((o) => o.effectId === e.defId && o.triggers.includes(when));
      if (spec.when !== when && !overridden) continue;
      if (spec.actedOnly && !u.acted) continue;

      // An effect does not tick on the turn it expires (Ch. 11 §11.9).
      if (e.expiry !== null && e.expiry !== undefined && e.expiry <= ctx.tick) continue;

      const amount = periodicDamageFor(e, u);
      const converted = (u.effects ?? []).includes(spec.healConversion);
      out.push(
        converted
          ? I.heal(u.id, amount, e.defId)
          : I.damage(u.id, amount, null, {
            periodic: true,
            defId: e.defId,
            bypassModifiers: true,
            // Secret Poison: the Health comes off now, and the log says so
            // without saying whose it was (Q47). The applier keeps the running
            // total so the disclosure can name a number.
            attributionHidden: Boolean(e.attributionHidden),
          }),
      );
    }
  }
  return out;
}

/**
 * What a standing effect does to somebody ELSE'S periodic damage.
 *
 * `Deadly Poison` is *"Poison Damage received is doubled"* — a multiplier on a
 * tick that is not its own, which is the only shape of its kind in Appendix A
 * and the reason it is a table rather than a branch. Serenity applies it three
 * ways (a 25% rider on every Normal Attack, 2◈ from her Noble Phantasm, and by
 * standing still while her Zabaniya field ticks), so it is the difference
 * between Stage 4 dealing 160 and dealing 320.
 *
 * @type {Readonly<Record<string, {defId: string, factor: number}>>}
 */
const AMPLIFIERS = Object.freeze({
  deadlyPoison: { defId: "poison", factor: 2 },
});

/**
 * @param {number} amount
 * @param {string} defId the ticking effect
 * @param {object} unit the unit taking it
 * @returns {number}
 */
function amplify(amount, defId, unit) {
  let out = amount;
  for (const held of unit?.effects ?? []) {
    const amp = AMPLIFIERS[held];
    if (amp && amp.defId === defId) out *= amp.factor;
  }
  // Sikera Ušum clause e: "Units in the NP area who are weak to Poison ...
  // receive double Poison Damage ... has to be an effect the Unit ALREADY
  // has" -- the field's own `VulnerabilityAmplifier` interior rule
  // (`rules/bounded-fields.mjs`'s `annotateFields`, gated on standing in the
  // field's panels already) only widens a weakness the unit independently
  // carries: a standing `weakTo<Effect>`-shaped marker, or an existing
  // incoming `ApplicationChance` contribution that already RAISES this
  // effect's own infliction chance ("has an increased chance of being
  // inflicted with" is the sheet's own second reading of "weak to").
  for (const amp of unit?.vulnerabilityAmplifiers ?? []) {
    if (amp.effectId !== defId) continue;
    if (isWeakTo(unit, defId)) out *= amp.factor;
  }
  return Math.round(out);
}

/**
 * @param {object|null} unit
 * @param {string} defId
 * @returns {boolean}
 */
function isWeakTo(unit, defId) {
  if ((unit?.effects ?? []).includes(`weakTo${capitalize(defId)}`)) return true;
  return (unit?.applicationChances ?? []).some(
    (c) => (c.direction ?? "incoming") === "incoming" && c.effectId === defId && (c.value ?? 0) < 0,
  );
}

/** @param {string} s @returns {string} */
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * HGoB Construction's Region multiplier (Ch. 32 §32.2): *"If the Grail
 * War's Region is in a Middle East region, all Construction increases are
 * doubled excluding effects 1 and 2; if directly next to a Middle East
 * region, all Construction increases are increased by 2 excluding effects 1
 * and 2."* Sources 1 (the starting value) and 2 (the summon-time roll) are
 * excluded by construction — they are applied at `engine/summon.mjs`'s
 * `sheetPatch`, never through a `ResourceDelta` action, so this is never
 * asked about them.
 *
 * @param {number} amount
 * @param {string} scaledRegion the region the scaling is centred on
 * @param {string|null} warRegion
 * @returns {number}
 */
export function regionScale(amount, scaledRegion, warRegion) {
  if (warRegion === scaledRegion) return amount * 2;
  if (warRegion && regionsAdjacent(warRegion, scaledRegion)) return amount + 2;
  return amount;
}

/**
 * What one periodic effect instance deals to its bearer right now.
 *
 * The **only** implementation. `tickPeriodics` emits it and the Effects tab
 * displays it, because a sheet that recomputed *"20 × 2^(stage−1), doubled if
 * Deadly Poison is held"* would be a second reading of Appendix A §A.12 — and
 * the copy is the one nobody updates when a stage curve changes. That is the
 * same argument `engine/cooldown.mjs` was written to settle.
 *
 * Pure, which is what lets layer 4 call it: it reads the instance and the
 * bearer's effect list, and nothing else.
 *
 * @param {object} instance an entry from `unit.effectInstances`
 * @param {object|null} unit the bearer's snapshot, for the amplifier lookup
 * @returns {number|null} `null` when this effect has no periodic tick at all
 */
export function periodicDamageFor(instance, unit) {
  const spec = PERIODICS[instance?.defId];
  if (!spec) return null;
  return amplify(spec.amount(instance), instance.defId, unit);
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

      // Appendix A's "on removal" clauses, run BEFORE the removal so they see
      // the effect that is going away. Shock is the case: *"on removal,
      // current Agility +1 when max is restored"* -- one point back, not the
      // three the maximum regains, and the asymmetry is the whole clause.
      out.push(...onRemoveIntents(u, e, ctx));

      // Expiry is never blocked by Unremovable or by removal resistance —
      // those govern Cure and Dispel, not the clock.
      out.push(I.removeEffect(u.id, e.id ?? e.defId, reason));
    }
  }
  return out;
}

/**
 * What an expiring effect does on its way out.
 *
 * The definition is resolved through the context rather than imported, so this
 * module stays testable without loading a compendium — the same contract the
 * rolls use.
 *
 * @param {object} unit
 * @param {object} instance
 * @param {SchedulerContext} ctx carries `effectDef(id)`
 * @returns {Intent[]}
 */
function onRemoveIntents(unit, instance, ctx) {
  const def = ctx.effectDef?.(instance.defId) ?? null;
  const actions = def?.onRemove ?? [];
  if (actions.length === 0) return [];

  const handler = { source: def.name ?? instance.defId, abilityId: null, defId: instance.defId };
  return actions.flatMap((a) => dispatch({ ...a, kind: a.kind ?? a.key }, unit, handler, ctx));
}

/**
 * Sustainability decay and the disappearance check.
 *
 * A Servant with `sustainability: null` has no clock at all — Independent
 * Action at A+ or EX. That is not "a very large number"; the field is absent
 * and the check must not run.
 *
 * Writes the new remaining value as an ABSOLUTE `I.setResource`, not a
 * relative `-1` `I.resource` delta. `u.sustainability` here is already the
 * correctly-resolved remaining figure — it falls back to the full authored
 * maximum when nothing has decremented it yet (`rules/snapshot.mjs`'s
 * `sustainabilityTurns`) — and a relative delta would instead land against
 * whatever `sustainabilityRemaining` literally holds in storage, which is
 * `null` until the first write. `io.adjustResource` cannot resolve that ◈
 * expression itself, so the first-ever decrement for a newly Free or Unbound
 * Servant collapsed the clock to zero in one Turn: `null` was read as `0`, and
 * `max(0, 0 - 1)` is `0`, regardless of how much Sustainability the Servant
 * actually had. Writing the number already computed here sidesteps the
 * storage's `null` entirely, so it is correct whether or not anything ever
 * initialized the field.
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

    out.push(I.setResource(u.id, "sustainabilityRemaining", u.sustainability - 1));
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
