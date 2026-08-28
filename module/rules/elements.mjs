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
import { test as testPredicate, referencedOptions } from "./predicate.mjs";
import { orderElements } from "./ordering.mjs";

/**
 * @typedef {object} Contributions
 * @property {object[]} modifiers        damage-pipeline modifiers
 * @property {object[]} statDeltas       derived-stat changes
 * @property {object[]} abilityRankShifts  shifts to another ability's own rank
 * @property {object[]} checkModifiers   Agility/Luck/application check modifiers
 * @property {string[]} immunities       effect ids this unit cannot receive
 * @property {object[]} suppressions     what is switched off
 * @property {string[]} grantedAbilities
 * @property {object[]} autoSucceeds     checks that succeed without rolling
 * @property {object[]} auras            aura contributions, expanded by rules/auras.mjs
 * @property {object[]} revivals         ways back from zero Health, priority-ordered
 * @property {object[]} applicationChances  shifts to how likely an effect is to land
 * @property {object[]} compulsions       forced targets, expanded by rules/compulsion.mjs
 * @property {object[]} eventHandlers
 * @property {string[]} attributes       attributes granted by an ability
 * @property {object|null} magicResistance
 * @property {string|null} variantOverride
 * @property {object[]} damageNegation   dice-based flat reductions
 * @property {object[]} unhandled        elements with no executor — a bug, surfaced
 */

/** An empty contribution set. */
function empty() {
  return {
    modifiers: [], statDeltas: [], checkModifiers: [], immunities: [],
    suppressions: [], grantedAbilities: [], autoSucceeds: [], eventHandlers: [], revivals: [],
    attributes: [], magicResistance: null, variantOverride: null, damageNegation: [], zonBonuses: [],
    abilityRankShifts: [],
    auras: [], applicationChances: [], compulsions: [], unhandled: [],
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

  const shifts = abilityRankShifts(abilities, predicateCtx);

  for (const ability of abilities ?? []) {
    const rank = shiftedRank(ability, shifts);
    const source = ability.name ?? ability.id ?? "unknown";

    // Passives always contribute; actives only while the ability is active.
    const elements = [
      ...(ability.rules ?? []),
      ...(ability.passiveRules ?? []),
      ...(ability.active ? (ability.activeRules ?? []) : []),
    ];

    // Ordered before execution (Ch. 24 §24.6). Collection order is document
    // load order, which differs between clients -- so two players could compute
    // two different numbers from the same board. Bands fix the what; the source
    // id fixes the tie.
    for (const el of orderElements(elements)) {
      if (!el?.key) continue;
      if (el.suppressed) continue;
      // A predicate that fails means the element does not contribute at all —
      // not that it contributes zero. The distinction matters for the
      // "Not applied" section of the explainer.
      //
      // But only a predicate this pass can ANSWER. Collection happens with the
      // owner's own options and nobody else's: there is no target and no
      // attack yet. Testing `target:attribute:divine` here answered "false" and
      // dropped the element for ever, which is why Scáthach's God Slayer added
      // nothing against a Divine Unit, Penthesilea's Goddess of War never fired
      // on a Normal Attack, and `NP DmUp` raised no Noble Phantasm's damage.
      //
      // A deferred predicate travels ON the modifier instead. The damage
      // pipeline re-tests it with the full option set, which is what the
      // comment on `contributionsOf` has always claimed happened.
      const deferred = deferredPredicate(el.predicate);
      if (el.predicate && !deferred && !testPredicate(el.predicate, predicateCtx)) continue;

      const execute = EXECUTORS[el.key];
      if (!execute) {
        out.unhandled.push({ key: el.key, source });
        continue;
      }
      execute(el, { rank, source, ability, out, ctx, deferred });
    }
  }
  return out;
}

/**
 * The option prefixes that describe somebody other than the element's owner,
 * plus the `self:` options that name BOARD state rather than the owner's own
 * document fields.
 *
 * Collection runs per unit, with only that unit's own options in scope. A
 * predicate naming any of these cannot be answered yet and must travel to a
 * reader that can answer it.
 *
 * `self:inHomeBase` and `self:onPlatform:` are board annotations —
 * `annotateEnvironment`/`annotatePlatforms` stamp them on a unit only during
 * `snapshotBoard`, well after `contributionsOf` has already collected and
 * tested this predicate with a board-blind, actor-only options set. Left off
 * this list, they read as permanently false: Medea's and Semiramis's own
 * Territory Creation bonus ("all damage dealt by it is increased") never
 * applied to the unit that owns the ability, while the recipient-side aura
 * half (`requiresRecipient`, tested later against the annotated board) always
 * worked — which is why only half of Territory Creation ever looked broken.
 */
const DEFERRED_PREFIXES = Object.freeze(["target:", "attack:", "self:inHomeBase", "self:onPlatform:"]);

/**
 * The predicate to carry through, or `null` if this pass can answer it.
 *
 * All-or-nothing rather than split. A predicate is an implicit AND, so
 * deferring the whole clause is equivalent to splitting it -- the consumer has
 * the owner's options too -- and splitting would need the two halves to stay in
 * step through every executor.
 *
 * @param {unknown} predicate
 * @returns {unknown|null}
 */
export function deferredPredicate(predicate) {
  if (!predicate) return null;
  const options = referencedOptions(predicate);
  const later = [...options].some((o) => DEFERRED_PREFIXES.some((p) => o.startsWith(p)));
  return later ? predicate : null;
}

/**
 * One ability's rank, with any shift aimed at it applied.
 *
 * Matched on `slug` first and `id` second, for the same reason `hasSkill` does:
 * a display name can be renamed and a slug cannot.
 *
 * @param {object} ability
 * @param {Map<string, number>} shifts
 * @returns {Rank|null}
 */
function shiftedRank(ability, shifts) {
  const rank = ability.rank instanceof Rank ? ability.rank : Rank.parseOrNull(ability.rank);
  if (!rank || shifts.size === 0) return rank;

  const shift = shifts.get(ability.slug) ?? shifts.get(ability.id) ?? null;
  if (!shift) return rank;

  // "Increased FROM B TO A" -- and only upward. A shift that would lower the
  // rank is not applied, because every such clause in the source is a grant.
  if (shift.to) {
    const target = Rank.parseOrNull(shift.to);
    return target && Rank.compare(target, rank) > 0 ? target : rank;
  }
  // Grades first, then modifier steps, so a clause that names both composes.
  const graded = shift.grades ? rank.stepGrade(shift.grades) : rank;
  return shift.steps === 0 ? graded : graded.step(shift.steps);
}

/**
 * The rank each ability contributes at, after any shift aimed at it.
 *
 * A **pre-pass**, run before the executors, because an ability's rank is an
 * *input* to collection — `Divinity` looks its flat bonus up against the rank
 * of the ability carrying it — and resolving it afterwards would be a cycle.
 *
 * Only shifts whose own predicate passes count, which is what keeps
 * Penthesilea's clause honest: the shift is a Goddess of War effect, and
 * Goddess of War is *"only active when Mad Enhancement is deactivated"*.
 *
 * Two forms, and the source uses the second. `steps` moves along the dense
 * ladder (`B` → `B+`); `to` names the destination outright, which is what
 * *"increased **from B to A**"* says and the only form that does not require
 * the author to count `+`/`-` positions across a grade boundary.
 *
 * @param {object[]} abilities
 * @param {object} predicateCtx
 * @returns {Map<string, {steps: number, to: string|null}>} slug or id → shift
 */
export function abilityRankShifts(abilities, predicateCtx) {
  /** @type {Map<string, {steps: number, to: string|null}>} */
  const shifts = new Map();

  for (const ability of abilities ?? []) {
    const elements = [
      ...(ability.rules ?? []),
      ...(ability.passiveRules ?? []),
      ...(ability.active ? (ability.activeRules ?? []) : []),
    ];
    for (const el of elements) {
      if (el?.key !== "RankShift" || !el.ability) continue;
      if (el.suppressed) continue;
      if (el.predicate && !testPredicate(el.predicate, predicateCtx)) continue;

      const prior = shifts.get(el.ability) ?? { steps: 0, grades: 0, to: null };
      shifts.set(el.ability, {
        // Only when neither a destination nor a GRADE shift was named, and
        // `steps` defaults to 1 only then -- otherwise "one Rank" would also
        // add a modifier step on top of the grade it moved.
        steps: prior.steps + (el.to || el.grades ? 0 : (el.steps ?? 1)),
        // Whole grades: "increased by one Rank" is D to C, not D to D+.
        grades: prior.grades + (el.to ? 0 : (el.grades ?? 0)),
        // A named destination wins over accumulated steps: "to A" is an
        // instruction about where to end up, not an adjustment.
        to: el.to ?? prior.to,
      });
    }
  }
  return shifts;
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
/*  Event handlers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Normalize an `OnEvent` element into the shape `scheduler.fireEvent` dispatches.
 *
 * This exists because the previous version stored the element *as authored* and
 * `fireEvent` read a field (`handler.intents`) that no content and no executor
 * ever wrote. Every event handler in the game therefore produced a log line and
 * nothing else — Battle Continuation's revive included. A normalized handler is
 * the fix: one shape, built here, with every rank-dependent lookup already
 * resolved, because **rank is only in scope at collection time** and the
 * scheduler has no way to recover it.
 *
 * @param {object} el
 * @param {{rank: Rank|null, source: string, ability?: object, ctx?: object}} env
 * @returns {{events: string[], actions: object[], automatic: boolean,
 *            abilityId: string|null, source: string}}
 */
export function normalizeHandler(el, { rank, source, ability, ctx, deferred = null }) {
  return {
    // Always an array. Mannanán's Fragarach subscribes to two events at once
    // (Ch. 24 §24.8), and a single-event handler is just the one-element case.
    events: Array.isArray(el.event) ? [...el.event] : [el.event],
    actions: normalizeActions(el, rank, ctx),
    // `automatic` marks a handler Addle can suppress (Ch. 11 §11.4).
    automatic: el.automatic ?? false,
    abilityId: ability?.id ?? null,
    // Evaluated when the event FIRES, against the options the event carries --
    // as opposed to `predicate`, which gates the element at collection time
    // where only the owner is in scope. Scáthach's Alpi needs the difference:
    // *"if the DU has the 'Undead' or 'Divine' Attribute, it is reduced by 1◈
    // instead"* is a question about somebody who does not exist yet when the
    // contribution is collected. Same convention as `Compulsion`.
    // Two sources, one field. `targetPredicate` is authored for a condition
    // about somebody else; `deferred` is this element's own `predicate` when it
    // names something collection could not answer.
    //
    // Merging them is what makes an attack-scoped clause on a handler work at
    // all. `collectContributions` classifies such a predicate as deferred and
    // hands it to the executor -- and this executor ignored it, so the clause
    // was dropped and the handler fired unconditionally. EMIYA's Kanshou &
    // Bakuya is *"at a Range of 2 or lower"* and it projected the swords at
    // every distance, twice: once from each of its two range clauses.
    targetPredicate: mergePredicates(el.targetPredicate, deferred),
    // Which abilities the event has to be ABOUT. `abilityUsed` fires for every
    // ability a Unit uses, and both handlers in the reference set care about a
    // family of them: EMIYA's Magecraft is *"whenever EMIYA uses a Thaumaturgy
    // Spell"* and his Atk Up (Trace) extends on a Thaumaturgy **or**
    // Projection. A category, not a list of ids -- a list would go stale the
    // moment an eighth Spell was written.
    ofCategory: el.ofCategory === undefined
      ? null
      : (Array.isArray(el.ofCategory) ? [...el.ofCategory] : [el.ofCategory]),
    // A charge spent each time the handler pays out, for a count-limited
    // effect: Alpi is "for 1◈ Turns, **3 times**".
    consumesUse: el.consumesUse ?? false,
    defId: ability?.id ?? null,
    source,
  };
}

/**
 * Two predicates that must both hold, as one.
 *
 * A predicate is an implicit AND over its clauses, so concatenation is
 * conjunction -- no wrapper node needed, and the result stays a plain array
 * that `test` and `referencedOptions` already understand.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {unknown|null}
 */
function mergePredicates(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  return [...a, ...b];
}

/**
 * The `then` list, plus the shorthands that stand in for a common `then`.
 *
 * `revive:` is authored as its own key rather than as a `then` action because
 * it carries a cooldown table alongside its roll, and reading
 * `revive: {table, cooldownTable}` is plainer than the three-action expansion.
 * It desugars to one action here so the dispatcher only ever sees actions.
 *
 * @param {object} el
 * @param {Rank|null} rank
 * @param {object} [ctx]
 * @returns {object[]}
 */
function normalizeActions(el, rank, ctx) {
  const actions = (el.then ?? []).map((a) => normalizeAction(a, rank, ctx));
  if (el.revive) actions.push(normalizeAction({ key: "Revive", ...el.revive }, rank, ctx));

  // `effect:` beside `event:` is the shorthand Appendix A's riders are written
  // in -- `Bleed Atk` is one line, not a three-key `then` list -- and it
  // desugared to NOTHING. `normalizeActions` read `then` and `revive` and no
  // third thing, so every handler authored this way produced `actions: []` and
  // could not do anything at all when it fired. Two shipped effects were
  // written that way.
  if (el.effect) {
    actions.push(normalizeAction({
      key: "ApplyEffect",
      target: el.target ?? "self",
      effect: el.effect,
      duration: el.duration,
      chance: el.chance ?? el.effect.chance,
      stages: el.stages,
      secret: el.secret,
    }, rank, ctx));
  }
  return actions;
}

/**
 * One action, with its tables resolved against the owning ability's rank.
 *
 * @param {object} a
 * @param {Rank|null} rank
 * @param {object} [ctx]
 * @returns {object}
 */
function normalizeAction(a, rank, ctx) {
  const { key, ...rest } = a;
  /** @type {Record<string, unknown>} */
  const out = { kind: key, ...rest };

  // `table:` is resolved HERE, where the owning ability's rank is known --
  // by the time an action is dispatched the rank is gone.
  //
  // A table yields either a dice formula or a NUMBER, and the two go to
  // different places: a formula becomes a roll the caller must make, a number
  // becomes the amount outright. Sending a numeric table through `rollSpec`
  // produced `{formula: null}` and an action that did nothing, which is what
  // `madEnhancementDrain` would have done -- it has been in `domain/tables.mjs`
  // since the tables were transcribed with nothing reading it.
  if (a.table) {
    const value = lookup(a.table, rank);
    if (typeof value === "number") {
      out.amount = value;
      out.table = undefined;
    } else {
      out.roll = rollSpec(a.table, rank);
    }
  }
  if (a.cooldownTable) out.cooldown = lookup(a.cooldownTable, rank);
  if (a.amount !== undefined) out.amount = resolveValue(a, rank, ctx, "amount");
  return out;
}

/**
 * A dice table resolved to `{key, formula, bonus}`.
 *
 * `key` is the table id, and it is what the caller keys its pre-rolled value
 * on: these functions are pure, so the roll happens outside and arrives through
 * `ctx.rolls` (the same contract `turn-order.mjs` uses).
 *
 * @param {string} table
 * @param {Rank|null} rank
 * @returns {{key: string, formula: string|null, bonus: number}}
 */
function rollSpec(table, rank) {
  const v = lookup(table, rank);
  if (v && typeof v === "object" && "formula" in v) {
    return { key: table, formula: v.formula, bonus: v.bonus ?? 0 };
  }
  return { key: table, formula: typeof v === "string" ? v : null, bonus: 0 };
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
  DamageModifier(el, { rank, source, out, ctx, deferred = null }) {
    const v = resolveValue(el, rank, ctx);
    const np = el.npValue !== undefined ? resolveValue(el, rank, ctx, "npValue") : undefined;
    out.modifiers.push({
      key: el.modifierKey ?? (el.direction === "taken" ? "defUp" : "atkUp"),
      // A magnitude rolled per damage event rather than fixed before the
      // attack -- Penthesilea's Goddess of War. The pipeline reads the total
      // out of `ctx.rolls`, so the dice stay with the caller like every other
      // roll in the system.
      ...(el.roll ? { roll: { ...el.roll } } : {}),
      value: scalar(v),
      ...(np !== null && np !== undefined ? { npValue: scalar(np) } : {}),
      component: el.component ?? null,
      // `null` when the collection pass answered it; the clause itself when it
      // could not, for the pipeline to answer with the attack in scope.
      predicate: deferred,
      source,
    });
  },

  /** A flat addition at stage 7. Divinity, Dmg Boost, Avenger's counter bonus. */
  FlatDamage(el, { rank, source, out, ctx, deferred = null }) {
    out.modifiers.push({
      key: el.modifierKey ?? "divinity",
      value: scalar(resolveValue(el, rank, ctx)),
      component: el.component ?? null,
      predicate: deferred,
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

  /**
   * Temporarily grant a unit its OWN alternate summon-variant shape.
   *
   * Semiramis's `Double Summon` buff: *"gains the DSC buff... this buff
   * grants her the 'Double Summon: Caster' Skill"* — which is Range, Normal
   * Attack and Sustainability, not a rule-element-driven ability at all
   * (`resolveSummonVariant`/`engine/summon.mjs#sheetPatch` bake those onto
   * the DOCUMENT once, permanently, at summon time). Re-authoring the same
   * three numbers again on the buff effect would drift the moment the
   * servant file's `summonVariant.heads.overrides` changed; naming the
   * BRANCH instead and reading the servant's own block at snapshot time
   * keeps the numbers in exactly one place.
   */
  VariantOverride(el, { out }) {
    out.variantOverride = el.branch ?? "heads";
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
  Ward(el, { rank, source, out, ctx, deferred = null }) {
    out.modifiers.push({
      key: "ward", value: scalar(resolveValue(el, rank, ctx)),
      component: el.component ?? null, predicate: deferred, source,
    });
  },

  /** Crit chance or crit damage. Crit damage acts at stage 2, on the roll only. */
  CritModifier(el, { rank, source, out, ctx, deferred = null }) {
    out.modifiers.push({
      key: el.modifierKey ?? (el.aspect === "damage" ? "critDmUp" : "critUp"),
      value: scalar(resolveValue(el, rank, ctx)),
      // Crit damage modifiers land in the same bag the pipeline filters, so a
      // deferred clause reaches the same reader.
      predicate: deferred,
      source,
    });
  },

  /** Block Up — percentage points onto the flat 25%. */
  BlockModifier(el, { rank, source, out, ctx, deferred = null }) {
    out.modifiers.push({
      key: "blockUp", value: scalar(resolveValue(el, rank, ctx)), predicate: deferred, source,
    });
  },

  /** Achilles's Andreias Amarantos: a tier keyed on an attacker property. */
  AttackerPropertyTier(el, { source, out, deferred = null }) {
    out.modifiers.push({
      key: "attackerPropertyTier", table: el.table, property: el.property ?? "divinity",
      value: 0, predicate: deferred, source,
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
      ...(el.factor !== undefined ? { factor: el.factor } : {}),
      ...(el.floor !== undefined ? { floor: el.floor } : {}),
      // `Shock` is "Max **and current** Agility −3", and `Max HpUp` is the
      // same shape in the other direction -- one delta that moves both.
      ...(el.alsoCurrent ? { alsoCurrent: true } : {}),
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
      // Appendix A's multiplicative MOV clauses: Slow halves it, Pigify sets
      // it to 2. `floor` is "MOV Down cannot reduce MOV below 1", which is a
      // property of the stat rather than of any one delta.
      ...(el.factor !== undefined ? { factor: el.factor } : {}),
      ...(el.floor !== undefined ? { floor: el.floor } : {}),
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
    // A shift aimed at an ABILITY's rank rather than at a parameter.
    // Penthesilea's Goddess of War is the only one in the reference set:
    // *"Penthesilea's Divinity Rank is increased from B to A"*, which raises
    // the table lookup her Divinity performs. It is resolved in a pre-pass
    // (`abilityRankShifts`) before any executor runs, because the shifted rank
    // is an INPUT to the collection rather than an output of it.
    if (el.ability) {
      out.abilityRankShifts.push({
        ability: el.ability, steps: el.steps ?? null, grades: el.grades ?? null, to: el.to ?? null, source,
      });
      return;
    }

    out.statDeltas.push({
      stat: `parameters.${el.parameter}`, rankShift: el.steps ?? 1,
      target: el.target ?? null, source,
    });
  },

  SizeStep(el, { source, out }) {
    out.statDeltas.push({ stat: "size", value: el.steps ?? 1, every: el.every ?? null, source });
  },

  /* ── Group 3 — check contributors ─────────────────────────────────────── */

  CheckModifier(el, { rank, source, out, ctx, deferred = null }) {
    out.checkModifiers.push({
      check: el.check,
      direction: el.direction ?? "outgoing",
      value: scalar(resolveValue(el, rank, ctx)),
      // A clause about the ATTACK rather than about the bearer, carried
      // through to `checkPlan`/`critChance` the same way a damage modifier's
      // is carried to the pipeline. EMIYA's Hawkeye is *"Crit Chance is
      // increased by 50% **at a Range of 3 or higher**"*: the distance does
      // not exist when the buff is applied, so answering it at collection time
      // is answering it wrong.
      predicate: deferred,
      source,
    });
  },

  AutoSucceed(el, { source, ability, out }) {
    out.autoSucceeds.push({
      check: el.check, beatenBy: el.beatenBy ?? [], source,
      // Which effect this came from and how many charges it has, so the
      // consumer can spend one. `uses` was recorded on the instance and never
      // read back here, so a "1 times" automatic evasion fired for ever.
      defId: ability?.id ?? null,
      uses: el.uses ?? ability?.uses ?? null,
      // A **chance** to succeed automatically, rather than a certainty. Medea's
      // Troψa evades outright unless the attack is a Noble Phantasm, where the
      // sheet gives her a coin -- and a failed coin lets the Combat Process
      // proceed as normal, which is why this is a roll and not a refusal.
      chance: el.chance ?? 100,
      chanceWhen: el.chanceWhen ?? [],
    });
  },

  TableOverride(el, { source, out, deferred = null }) {
    // `forceTable` names a *check* table (favourable/unfavourable), never a
    // rank table -- `table:` on every other element means the latter, so the
    // two must not share a field name. `el.table` is accepted for content
    // written before the split; the validator rejects it.
    //
    // `chance` is EMIYA's *Clairvoyance*: *"the DU has an 80% chance of using
    // Evade- when Evading"* -- the only forced table in the set that is not
    // certain, and the only one aimed at the opponent rather than the bearer.
    out.checkModifiers.push({
      check: el.check,
      forceTable: el.forceTable ?? el.table,
      direction: el.direction ?? "outgoing",
      chance: el.chance ?? 100,
      predicate: deferred,
      source,
    });
  },

  RollAdjustment(el, { source, out }) {
    out.checkModifiers.push({
      check: el.check ?? "any", playerAdjustable: true,
      max: el.max ?? 3, scope: el.scope ?? "self", source,
    });
  },

  /* ── Group 4 — targeting ──────────────────────────────────────────────── */

  TargetingModifier(el, { source, out, deferred = null }) {
    out.modifiers.push({ key: "targeting", spec: el.spec ?? el, value: 0, predicate: deferred, source });
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

  OnEvent(el, { rank, source, ability, out, ctx, deferred = null }) {
    out.eventHandlers.push(normalizeHandler(el, { rank, source, ability, ctx, deferred }));
  },

  /**
   * An aura goes into its **own** bucket, not into `modifiers`.
   *
   * Writing it into the owner's modifiers is what made the original defect look
   * plausible: the contribution was in a bag the pipeline reads, so it appeared
   * wired, and the `radius`/`relations` fields riding along with it were simply
   * ignored. The aura pass (`rules/auras.mjs`) is what expands this onto the
   * units that should have it — including the owner, when the relation list
   * says so, which by default it does.
   */
  Aura(el, { rank, source, out, ctx }) {
    out.auras.push({
      key: el.modifierKey ?? "aura", radius: el.radius ?? 2,
      relations: el.relations ?? ["ally", "self"],
      value: scalar(resolveValue(el, rank, ctx)),
      component: el.component ?? null,
      stacking: el.stacking ?? "highestOnly", source,
      // An aura may carry SEVERAL modifiers rather than being one. Medea's Item
      // Construction is six -- a severity ladder in both directions -- and the
      // group and rank are what "does not stack" compares across sources.
      elements: el.elements ?? null,
      group: el.group ?? null,
      rank: el.rank ?? (rank ? String(rank) : null),
      scope: el.scope ?? null,
      requiresRecipient: el.requiresRecipient ?? null,
    });
  },

  /**
   * Debuff ChUp/ResUp, Item Construction, Magic Resistance's clause 2.
   *
   * A shift to how likely an effect is to **land**, not to what it does once
   * it has. `direction: "incoming"` resists what is applied to this unit;
   * `"outgoing"` improves what this unit inflicts. `valence` narrows it to
   * offensive or defensive effects, which is what "Off.Debuff ResUp" means.
   */
  /**
   * Being forced to act against a particular unit — Berserk's nearest-enemy
   * rule, Decoy's pull, Penthesilea's *Hatred of Achilles*.
   *
   * Positional, so it goes into its own bucket and `rules/compulsion.mjs`
   * expands it against the board: it holds while somebody is standing nearby
   * and lifts the moment they are not, which no stored effect could track
   * without a write on every move.
   */
  Compulsion(el, { source, out }) {
    out.compulsions.push({
      id: el.id ?? "compulsion",
      within: el.within ?? 1,
      relations: el.relations ?? ["ally", "enemy"],
      // `targetPredicate`, not `predicate`. `predicate` gates whether the
      // ELEMENT applies at all and is evaluated here, against this unit; a
      // compulsion's test is about the OTHER unit and cannot be answered until
      // the board exists. Authoring it as `predicate` made the element vanish
      // at collection time, silently.
      targetPredicate: el.targetPredicate ?? null,
      forcesTarget: el.forcesTarget !== false,
      forcesSkill: el.forcesSkill ?? null,
      source,
    });
  },

  ApplicationChance(el, { rank, source, out, ctx }) {
    out.applicationChances.push({
      direction: el.direction ?? "incoming",
      valence: el.valence ?? null,
      // Appendix A's own classification, so "Mental Debuffs" covers one written
      // after the clause was. Heracles's Bravery is the only content that needs
      // it, and a list of ids would go stale.
      volatility: el.volatility ?? null,
      effectId: el.effect ?? null,
      // Appendix A keeps Instakill/Death/Erase out of ordinary chance modifiers
      // "unless stated". A contribution that names a severity applies only to
      // that tier, which is how Medea's Item Construction says 50 / 25 / 10.
      severity: el.severity ?? null,
      // A condition on the incoming ATTACK rather than on the bearer, so it
      // has to survive collection and be tested when the effect is applied.
      // `predicate` is consumed at collection time by `collectContributions`;
      // this is the deferred one, same convention as `Compulsion`.
      predicate: el.attackPredicate ?? null,
      value: scalar(resolveValue(el, rank, ctx)),
      source,
    });
  },

  /**
   * A way back from zero Health.
   *
   * Declared rather than hardcoded, because Heracles has **four** and his sheet
   * states the order they resolve in. The defeat handler used to take any
   * handler that healed, in collection order -- which with one source is
   * indistinguishable from correct and with four spends whichever happened to
   * be listed first, burning a God Hand charge while `Undying` sits unused.
   */
  RevivalSource(el, { rank, source, ability, out, ctx }) {
    out.revivals.push({
      id: el.id ?? ability?.id ?? source,
      // `revivalPriority`, NOT `priority`. `priority` on a rule element already
      // means "reorder me within my ordering band" (§24.6) and `orderElements`
      // sorts on it -- so §31.2's `priority: 300` for Undying would have moved
      // the element itself into a band it does not belong to, silently, while
      // also failing the validator's "say why you reordered" check. One field,
      // two meanings, in one vocabulary.
      priority: el.revivalPriority ?? 100,
      // `null` is unlimited. God Hand is "can only be used 11 times", which is
      // the ability's own whole-match budget rather than a second counter.
      charges: el.charges ?? null,
      cascading: el.cascading === true,
      // A rank TABLE as well as a literal, because Battle Continuation restores
      // `5d20` at A and `3d20` at C and the same clause has to say both.
      formula: reviveFormula(el, rank, ctx),
      // `null` when unstated, NOT 0. `resolveValue` scalarises an absent value
      // to zero, and `resolveRevival` reads "has a percentOfMax" as "is not
      // null" -- so a zero would beat the dice formula to the branch and every
      // roll-based revival would restore nothing.
      percentOfMax: percentOfMax(el, rank, ctx),
      // Its own clock, resolved from a table the same way. A ◈ EXPRESSION, not
      // a turn count -- `spendRevival` hands it to `I.cooldown`, which the
      // applier resolves against the world's turns per Round.
      cooldown: reviveCooldown(el, rank, ctx),
      consumesOnUse: el.consumesOnUse !== false,
      requiresHealthRestoredSince: el.requiresHealthRestoredSince ?? null,
      // Exactly one of these. An effect-borne source is spent by consuming a
      // charge of the effect; an ability-borne one by turning its own clock.
      defId: ability?.fromEffect ? (ability.defId ?? ability.id) : null,
      abilityId: ability?.fromEffect ? null : (ability?.id ?? null),
      source,
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
 * What one charge of a revival restores, as a dice formula.
 *
 * @param {object} el
 * @param {Rank|null} rank
 * @param {object} ctx
 * @returns {string|null}
 */
function reviveFormula(el, rank, ctx) {
  const literal = el.restore?.formula ?? el.formula ?? null;
  if (literal) return literal;

  const table = el.restore?.table ?? el.table ?? null;
  if (!table) return null;
  const value = resolveValue({ table }, rank, ctx);
  return typeof value === "string" ? value : null;
}

/**
 * The fraction of maximum Health one charge restores, or `null`.
 *
 * @param {object} el
 * @param {Rank|null} rank
 * @param {object} ctx
 * @returns {number|null}
 */
function percentOfMax(el, rank, ctx) {
  const raw = el.restore?.percentOfMax ?? el.percentOfMax ?? null;
  if (raw === null || raw === undefined) return null;
  return scalar(resolveValue({ value: raw }, rank, ctx));
}

/**
 * How long a revival source locks itself out for.
 *
 * @param {object} el
 * @param {Rank|null} rank
 * @param {object} ctx
 * @returns {string|null} a ◈ expression
 */
function reviveCooldown(el, rank, ctx) {
  const literal = el.cooldown ?? el.restore?.cooldown ?? null;
  if (literal) return literal;

  const table = el.restore?.cooldownTable ?? el.cooldownTable ?? null;
  if (!table) return null;
  const value = resolveValue({ table }, rank, ctx);
  return typeof value === "string" ? value : null;
}

/**
 * Every key the executor handles. The content validator checks against this, so
 * a typo'd key fails the build rather than sitting in a compendium doing
 * nothing.
 * @returns {string[]}
 */
export function handledKeys() {
  return Object.keys(EXECUTORS);
}
