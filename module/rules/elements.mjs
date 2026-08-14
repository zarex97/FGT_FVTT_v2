/**
 * @file Rule-element execution — turning authored data into contributions.
 * @see docs/24-rules-engine.md §24.3
 *
 * Layer 2 (rules). **Pure.**
 *
 * A rule element is data: `{key: "FlatDamage", table: "divinity"}`. Something
 * has to turn that into a number the damage pipeline can add, and this is it.
 * Without this module the content pipeline loads Divinity into a compendium
 * where it sits doing nothing — which is exactly the failure mode the content
 * validator exists to prevent, one layer up.
 *
 * The executor is a **dispatch table keyed by `key`**, not a class hierarchy.
 * Thirty subclasses that each implement one method is ceremony; a table of
 * thirty small functions is the same thing without the indirection, and it
 * makes the whole catalogue visible in one file.
 *
 * Values may be literals, `@`-expressions, or a `table:` reference resolved
 * against the owning ability's rank. Tables stay **symbolic** until here,
 * because a rank can change at runtime (Ch. 37 §37.3).
 */

import { lookup } from "../domain/tables.mjs";
import { Rank } from "../domain/rank.mjs";
import { test as testPredicate } from "./predicate.mjs";

/**
 * @typedef {object} Contributions
 * @property {object[]} modifiers        damage-pipeline modifiers
 * @property {object[]} statDeltas       derived-stat changes
 * @property {object[]} checkModifiers   Agility/Luck/application check modifiers
 * @property {string[]} immunities       effect ids this unit cannot receive
 * @property {object[]} suppressions     what is switched off
 * @property {string[]} grantedAbilities
 * @property {object[]} autoSucceeds     checks that succeed without rolling
 * @property {object[]} eventHandlers
 * @property {string[]} attributes       attributes granted by an ability
 * @property {object|null} magicResistance
 * @property {object[]} damageNegation   dice-based flat reductions
 * @property {object[]} unhandled        elements with no executor — a bug, surfaced
 */

/** An empty contribution set. */
function empty() {
  return {
    modifiers: [], statDeltas: [], checkModifiers: [], immunities: [],
    suppressions: [], grantedAbilities: [], autoSucceeds: [], eventHandlers: [],
    attributes: [], magicResistance: null, damageNegation: [], zonBonuses: [],
    unhandled: [],
  };
}

/**
 * Collect every contribution from a unit's abilities.
 *
 * @param {Array<{id: string, name: string, rank: string|Rank|null, active?: boolean,
 *                rules?: object[], passiveRules?: object[], activeRules?: object[]}>} abilities
 * @param {object} [ctx]
 * @param {ReadonlySet<string>} [ctx.options] roll options, for predicates
 * @param {object} [ctx.refs] resolution root for `@` expressions
 * @returns {Contributions}
 */
export function collectContributions(abilities, ctx = {}) {
  const out = empty();
  const predicateCtx = { options: ctx.options ?? new Set(), refs: ctx.refs ?? {} };

  for (const ability of abilities ?? []) {
    const rank = ability.rank instanceof Rank ? ability.rank : Rank.parseOrNull(ability.rank);
    const source = ability.name ?? ability.id ?? "unknown";

    // Passives always contribute; actives only while the ability is active.
    const elements = [
      ...(ability.rules ?? []),
      ...(ability.passiveRules ?? []),
      ...(ability.active ? (ability.activeRules ?? []) : []),
    ];

    for (const el of elements) {
      if (!el?.key) continue;
      if (el.suppressed) continue;
      // A predicate that fails means the element does not contribute at all —
      // not that it contributes zero. The distinction matters for the
      // "Not applied" section of the explainer.
      if (el.predicate && !testPredicate(el.predicate, predicateCtx)) continue;

      const execute = EXECUTORS[el.key];
      if (!execute) {
        out.unhandled.push({ key: el.key, source });
        continue;
      }
      execute(el, { rank, source, ability, out, ctx });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Value resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resolve an element's value: a literal, a `table:` lookup against the owning
 * ability's rank, or an `@`-expression.
 *
 * @param {object} el
 * @param {Rank|null} rank
 * @param {object} ctx
 * @param {string} [field='value']
 * @returns {number|number[]|string|null}
 */
export function resolveValue(el, rank, ctx, field = "value") {
  if (el.table) {
    const v = lookup(el.table, rank);
    // A dice-formula table with a per-step delta returns `{formula, bonus}`;
    // the caller decides what to do with it.
    return v ?? null;
  }
  const raw = el[field];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.startsWith("@")) return resolveExpression(raw, ctx);
  if (raw === undefined || raw === null) return null;
  return raw;
}

/**
 * Resolve an `@a.b.c` path against the context refs.
 * @param {string} expr
 * @param {object} ctx
 * @returns {number|null}
 */
function resolveExpression(expr, ctx) {
  let cur = /** @type {any} */ (ctx?.refs ?? {});
  for (const part of expr.slice(1).split(".")) {
    if (cur === null || cur === undefined) return null;
    cur = cur[part];
  }
  return typeof cur === "number" ? cur : (cur ?? null);
}

/**
 * Pull a scalar out of whatever `resolveValue` returned.
 * @param {unknown} v
 * @param {number} [index=0] which element, for `[normal, vsNP]` pairs
 * @returns {number}
 */
function scalar(v, index = 0) {
  if (typeof v === "number") return v;
  if (Array.isArray(v)) return typeof v[index] === "number" ? v[index] : 0;
  return 0;
}

/* -------------------------------------------------------------------------- */
/*  The catalogue                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One function per rule-element key. Each pushes into `out`.
 * @type {Readonly<Record<string, (el: object, env: object) => void>>}
 */
export const EXECUTORS = Object.freeze({
  /* ── Group 2 — damage contributors ────────────────────────────────────── */

  /** A percentage into the stage-4 bucket. */
  DamageModifier(el, { rank, source, out, ctx }) {
    const v = resolveValue(el, rank, ctx);
    const np = el.npValue !== undefined ? resolveValue(el, rank, ctx, "npValue") : undefined;
    out.modifiers.push({
      key: el.modifierKey ?? (el.direction === "taken" ? "defUp" : "atkUp"),
      value: scalar(v),
      ...(np !== null && np !== undefined ? { npValue: scalar(np) } : {}),
      component: el.component ?? null,
      predicate: null, // already evaluated
      source,
    });
  },

  /** A flat addition at stage 7. Divinity, Dmg Boost, Avenger's counter bonus. */
  FlatDamage(el, { rank, source, out, ctx }) {
    out.modifiers.push({
      key: el.modifierKey ?? "divinity",
      value: scalar(resolveValue(el, rank, ctx)),
      component: el.component ?? null,
      source,
    });
  },

  /**
   * Magic Resistance. Two modes, and they are structurally different: the rank
   * version can negate outright, the dice version never can.
   */
  Resistance(el, { rank, source, out, ctx }) {
    if (el.mode === "dice") {
      out.magicResistance = {
        mode: "dice", formula: el.formula, npDiceDoubled: el.npDiceDoubled ?? true, source,
      };
      return;
    }
    const negates = el.negatesUpToRank ? Rank.parseOrNull(el.negatesUpToRank) : rank;
    out.magicResistance = {
      mode: "rank",
      rank: negates,
      percent: scalar(resolveValue(el, rank, ctx)),
      component: el.component ?? "mag",
      includesNP: el.includesNP ?? true,
      source,
    };
  },

  /** Battle Continuation's dice reduction at stage 12. */
  DamageNegation(el, { rank, source, out, ctx }) {
    const v = resolveValue(el, rank, ctx);
    out.damageNegation.push({
      mode: el.mode ?? "flat",
      formula: typeof v === "object" && v?.formula ? v.formula : v,
      bonus: typeof v === "object" && v?.bonus ? v.bonus : 0,
      npDiceDoubled: el.npDiceDoubled ?? false,
      source,
    });
  },

  /** A category-predicated reduction. Same bucket as Def Up. */
  Ward(el, { rank, source, out, ctx }) {
    out.modifiers.push({
      key: "ward", value: scalar(resolveValue(el, rank, ctx)),
      component: el.component ?? null, source,
    });
  },

  /** Crit chance or crit damage. Crit damage acts at stage 2, on the roll only. */
  CritModifier(el, { rank, source, out, ctx }) {
    out.modifiers.push({
      key: el.modifierKey ?? (el.aspect === "damage" ? "critDmUp" : "critUp"),
      value: scalar(resolveValue(el, rank, ctx)),
      source,
    });
  },

  /** Block Up — percentage points onto the flat 25%. */
  BlockModifier(el, { rank, source, out, ctx }) {
    out.modifiers.push({ key: "blockUp", value: scalar(resolveValue(el, rank, ctx)), source });
  },

  /** Achilles's Andreias Amarantos: a tier keyed on an attacker property. */
  AttackerPropertyTier(el, { source, out }) {
    out.modifiers.push({
      key: "attackerPropertyTier", table: el.table, property: el.property ?? "divinity",
      value: 0, source,
    });
  },

  /* ── Group 1 — stat and derived-value modifiers ───────────────────────── */

  StatDelta(el, { rank, source, out, ctx }) {
    // `attributes` is a set, not a number: Divinity grants the `divine` tag.
    if (el.stat === "attributes" || el.add) {
      for (const attribute of el.add ?? []) out.attributes.push(attribute);
      if (el.stat === "attributes") return;
    }
    out.statDeltas.push({
      stat: el.stat,
      value: scalar(resolveValue(el, rank, ctx)),
      duration: el.duration ?? null,
      isBuff: el.isBuff !== false,
      source,
    });
  },

  MaxDelta(el, { rank, source, out, ctx }) {
    out.statDeltas.push({
      stat: `${el.stat}.max`, value: scalar(resolveValue(el, rank, ctx)),
      // Max HpUp restores current by the same amount; Max HpDwn does NOT.
      alsoCurrent: el.alsoCurrent ?? false, source,
    });
  },

  MovDelta(el, { rank, source, out, ctx }) {
    out.statDeltas.push({
      stat: "mov", value: scalar(resolveValue(el, rank, ctx)),
      duration: el.duration ?? null,
      // Riding's Active MOV Up is explicitly NOT a buff: unremovable, and not
      // prevented by an effect that blocks buffs.
      isBuff: el.isBuff !== false, source,
    });
  },

  RangeDelta(el, { rank, source, out, ctx }) {
    out.statDeltas.push({ stat: "range.panels", value: scalar(resolveValue(el, rank, ctx)), source });
  },

  /**
   * Widen the Servant's Master's ZON.
   *
   * `stacks` is the load-bearing field. Independent Action and the Caster and
   * Assassin class bonus are *"the same effect"* and take the highest rather
   * than the sum (§6.9); Mad Enhancement's +2 and a high-rank Master's +1 are
   * not, and add. Declaring which one an element is belongs on the element,
   * because only the content knows.
   */
  ZonBonus(el, { rank, source, out, ctx }) {
    out.zonBonuses.push({
      value: scalar(resolveValue(el, rank, ctx)),
      stacks: el.stacks === true,
      source,
    });
  },

  RankShift(el, { source, out }) {
    out.statDeltas.push({
      stat: `parameters.${el.parameter}`, rankShift: el.steps ?? 1,
      target: el.target ?? null, source,
    });
  },

  SizeStep(el, { source, out }) {
    out.statDeltas.push({ stat: "size", value: el.steps ?? 1, every: el.every ?? null, source });
  },

  /* ── Group 3 — check contributors ─────────────────────────────────────── */

  CheckModifier(el, { rank, source, out, ctx }) {
    out.checkModifiers.push({
      check: el.check,
      direction: el.direction ?? "outgoing",
      value: scalar(resolveValue(el, rank, ctx)),
      source,
    });
  },

  AutoSucceed(el, { source, out }) {
    out.autoSucceeds.push({ check: el.check, beatenBy: el.beatenBy ?? [], uses: el.uses ?? null, source });
  },

  TableOverride(el, { source, out }) {
    // `forceTable` names a *check* table (favourable/unfavourable), never a
    // rank table -- `table:` on every other element means the latter, so the
    // two must not share a field name. `el.table` is accepted for content
    // written before the split; the validator rejects it.
    out.checkModifiers.push({ check: el.check, forceTable: el.forceTable ?? el.table, source });
  },

  RollAdjustment(el, { source, out }) {
    out.checkModifiers.push({
      check: el.check ?? "any", playerAdjustable: true,
      max: el.max ?? 3, scope: el.scope ?? "self", source,
    });
  },

  /* ── Group 4 — targeting ──────────────────────────────────────────────── */

  TargetingModifier(el, { source, out }) {
    out.modifiers.push({ key: "targeting", spec: el.spec ?? el, value: 0, source });
  },

  ForceTarget(el, { source, out }) {
    out.suppressions.push({ scope: "targeting", forceTarget: el.target, source });
  },

  Decoy(el, { source, out }) {
    out.suppressions.push({ scope: "targeting", decoy: true, radius: el.radius ?? null, source });
  },

  WeakPoint(el, { source, out }) {
    out.suppressions.push({ scope: "weakPoint", spec: el, source });
  },

  /* ── Group 5 — events and grants ──────────────────────────────────────── */

  OnEvent(el, { source, out }) {
    out.eventHandlers.push({
      event: el.event, intents: el.intents ?? [], revive: el.revive ?? null,
      effect: el.effect ?? null, duration: el.duration ?? null, source,
    });
  },

  Aura(el, { rank, source, out, ctx }) {
    out.modifiers.push({
      key: el.modifierKey ?? "aura", radius: el.radius ?? 2,
      relations: el.relations ?? ["ally", "self"],
      value: scalar(resolveValue(el, rank, ctx)),
      stacking: el.stacking ?? "highestOnly", source,
    });
  },

  GrantedAbility(el, { source, out }) {
    for (const id of el.abilities ?? []) out.grantedAbilities.push(id);
    if (el.ability) out.grantedAbilities.push(el.ability);
    void source;
  },

  OfferAbilityUse(el, { source, out }) {
    out.eventHandlers.push({ event: el.event, offer: el.ability, source });
  },

  /* ── Group 6 — suppression and meta ───────────────────────────────────── */

  Suppress(el, { source, out }) {
    out.suppressions.push({ scope: el.scope, predicate: el.predicate ?? null, source });
  },

  Immunity(el, { source, out }) {
    for (const id of el.effects ?? []) out.immunities.push(id);
    if (el.effect) out.immunities.push(el.effect);
    void source;
  },

  ImmunityDowngrade(el, { source, out }) {
    out.suppressions.push({ scope: "immunity", downgradeTo: el.to, source });
  },

  ReplaceAbility(el, { source, out }) {
    out.suppressions.push({ scope: "ability", replace: el.from, with: el.to, source });
  },

  Disguise(el, { source, out }) {
    out.suppressions.push({ scope: "presentation", disguise: el, source });
  },

  EffectVisibility(el, { source, out }) {
    out.suppressions.push({ scope: "visibility", visibility: el.visibility, deferredUntil: el.deferredUntil, source });
  },

  SustainabilityGain(el, { source, out }) {
    out.eventHandlers.push({ event: el.event ?? "unitDefeated", sustainabilityGain: el.value ?? 1, source });
  },

  RelationshipProxy(el, { source, out }) {
    out.suppressions.push({ scope: "relationship", proxy: el.proxy ?? "summons", source });
  },

  /* ── Group 7 — the escape hatch ───────────────────────────────────────── */

  /**
   * Scripts are named entries in a closed registry, never `eval`. Compendia are
   * shared, so content must not be able to execute.
   */
  Script(el, { source, out }) {
    out.eventHandlers.push({ event: el.event ?? "manual", script: el.script, source });
  },
});

/**
 * Every key the executor handles. The content validator checks against this, so
 * a typo'd key fails the build rather than sitting in a compendium doing
 * nothing.
 * @returns {string[]}
 */
export function handledKeys() {
  return Object.keys(EXECUTORS);
}
