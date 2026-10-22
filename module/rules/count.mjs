/**
 * @file The Count module: every "how many" a sheet asks, from one closed list of sources.
 * @see docs/10-rule-elements.md, docs/39-authoring-vocabulary.md, CONTEXT.md (Count)
 *
 * Layer 2 (rules). Pure: it reads the context it is handed, never a document
 * lookup and never a Foundry global.
 *
 * Six readers answered "how many" before this existed, each with its own
 * arithmetic: an element's `perStack`, an entry's `times`, a handler's `times`,
 * a cooldown change's `perStack` and `countMatching`, a phase's `countTargets`,
 * and a cooldown's `perUnit`. Two of them counted the same stacks two ways --
 * the handler's ignored a staged effect's stage and counted a suppressed
 * instance -- so a Stage 7 Curse was seven in a magnitude and one in a `times`
 * (#319, Q3). Every one of them now asks `countOf`, and the old spellings are
 * read by the adapters at the foot of this file, so content keeps them.
 *
 * The kinds are a CLOSED list (Q19). A kind this module does not know throws
 * `UnknownCountKind` naming it: the build refuses such content first
 * (`tools/lib/content.mjs`), and the use gate refuses it at use
 * (`rules/costs.mjs`), so a sheet's number is never silently zero.
 */

import { test as testPredicate } from "./predicate.mjs";
import { rollOptionsFor } from "./options.mjs";
import { relationOf } from "./relations.mjs";
import { Rank } from "../domain/rank.mjs";

/** The sources a Count may read (Q19). */
export const COUNT_KINDS = Object.freeze([
  "stacks", "targets", "board", "resource", "parameters", "criteria", "use", "tally",
]);

/** A Count whose kind is not in {@link COUNT_KINDS}. */
export class UnknownCountKind extends Error {
  /** @param {unknown} kind */
  constructor(kind) {
    super(`FGT | Unknown count kind "${kind}": a Count reads one of ${COUNT_KINDS.join(", ")}.`);
    this.name = "UnknownCountKind";
    this.kind = kind;
  }
}

/**
 * @typedef {object} CountContext
 * @property {Record<string, number>} [stacks] what the bearer holds, by effect id ({@link stacksHeld})
 * @property {object[]} [targets] the phase's resolved recipients
 * @property {string|null} [casterId] who is casting, for `excludeSelf`
 * @property {object} [board] the War's board
 * @property {object} [self] the Unit asking, as the board sees it
 * @property {object} [refs] what an `@` expression resolves against (`refs.self.resources`)
 * @property {object} [target] the DU a per-target Count compares with `self`
 * @property {object} [use] the Use record's facts, `criteriaMet` among them
 * @property {object} [ability] the ability asking, for a Mode's `tally`
 */

/**
 * How many, by a Count spec.
 *
 * @param {{of: string} & Record<string, unknown>} spec
 * @param {CountContext} ctx
 * @returns {number} a non-negative integer
 * @throws {UnknownCountKind}
 */
export function countOf(spec, ctx = {}) {
  // Each kind's own key is read BEFORE the context it indexes: `ctx.refs?.self
  // ?.resources?.[spec.key]` never evaluates `spec.key` when there are no
  // refs, so a collection pass with no Unit (the rule-survival test's) saw the
  // key authored and never read.
  switch (spec?.of) {
    case "stacks": {
      const effect = /** @type {string} */ (spec.effect);
      return whole(ctx.stacks?.[effect]);
    }
    case "targets":
      // *"the number of affected allied Units with the 'Existence Outside the
      // Domain' Skill excluding herself"* (De Sterrennacht). AFFECTED: the set
      // the phase resolved, so a Unit three panels out of the area does not
      // raise it -- which is why this takes the list rather than the board.
      // "excluding herself" is load-bearing: Van Gogh always carries the Skill
      // she counts, so without it her floor would be one step higher than her
      // sheet's worked figure.
      return (ctx.targets ?? []).filter((unit) => {
        if (spec.excludeSelf && unit?.id === ctx.casterId) return false;
        return passes(spec.requires, unit);
      }).length;
    case "board":
      // *"X = number of enemy Units on the board with the 'Dove' effect"*
      // (Familiar: Doves): a per-Unit membership test summed over the board,
      // in the ordinary predicate grammar rather than an aggregate syntax.
      return (ctx.board?.units ?? []).filter((unit) => {
        if (spec.relation && relationOf(ctx.self, unit, ctx.board) !== spec.relation) return false;
        return passes(spec.requires, unit);
      }).length;
    case "parameters":
      return parametersCounted(spec, ctx.self, ctx.target);
    case "resource": {
      const key = /** @type {string} */ (spec.key);
      return whole(ctx.refs?.self?.resources?.[key]?.value);
    }
    case "criteria":
      return whole(ctx.use?.criteriaMet);
    case "use": {
      const name = /** @type {string} */ (spec.fact);
      const fact = ctx.use?.[name];
      return typeof fact === "boolean" ? Number(fact) : whole(fact);
    }
    case "tally":
      return whole(ctx.ability?.tally);
    default:
      throw new UnknownCountKind(spec?.of);
  }
}

/**
 * A value sized by a Count: `base + per × floor(count / each)`, clamped to `max`.
 *
 * `zeroPaysNothing` is `perStack`'s rule: *"for every stock"* pays nothing at
 * zero, its `base` included (Kingprotea). A `countTargets` floor is paid at zero
 * (Van Gogh's 3), so the rule is the clause's to state, not this function's.
 *
 * @param {number|{count: object, per?: number, each?: number, base?: number, max?: number,
 *   zeroPaysNothing?: boolean}} value
 * @param {CountContext} ctx
 * @returns {number}
 */
export function countedValue(value, ctx = {}) {
  if (typeof value === "number") return value;
  const count = countOf(value?.count, ctx);
  if (value.zeroPaysNothing && count === 0) return 0;
  const steps = Math.floor(count / (value.each ?? 1));
  const sized = (value.base ?? 0) + (value.per ?? 1) * steps;
  return typeof value.max === "number" ? Math.min(sized, value.max) : sized;
}

/**
 * How many of each effect this Unit holds, by definition id: the ONE rule (Q3).
 *
 * Two shapes count the same way, and both are on Kingprotea:
 *
 *   - `magnitudeStacks` puts each application in its **own document**, so ten
 *     Proliferation stocks are ten instances. That is what *"each Proliferation
 *     stock counts as a separate buff"* means, and what makes a dispel able to
 *     take one.
 *   - `count` keeps **one** document and accumulates `uses`, which is what
 *     *"remove one NP DmUp (GAO) buff from herself"* needs -- `consumeUse`
 *     already spends exactly one.
 *
 * A STAGED instance counts its stage, a charge-based one its uses, and anything
 * else one. Stages were not counted at all until Van Gogh: `uses` is 0 on a
 * staged instance, so `Math.max(1, 0)` reported a Stage 7 Curse as ONE. Her
 * Imaginary Numbers Arts reduces her NP Cooldown by *"⅓◈ * the stage of the
 * Curse debuff on Gogh"* -- the sheet's own worked example is Stage 7 giving
 * 2◈+⅓◈. A disabled or suppressed instance has no effect, so it counts none.
 *
 * Reads an actor's ActiveEffects (`effects`, `system.defId`) or a board
 * snapshot's projection (`effectInstances`, which keeps suppressed instances
 * flagged): the scheduler is handed snapshots, the engine documents, and the
 * handler's `times` counted the projection its own way until #319.
 *
 * @param {object} holder an Actor, or a Unit snapshot
 * @returns {Record<string, number>}
 */
export function stacksHeld(holder) {
  /** @type {Record<string, number>} */
  const out = {};
  const projected = Array.isArray(holder?.effectInstances);
  const list = projected ? holder.effectInstances : (holder?.effects ?? []);
  for (const effect of list) {
    if (projected ? (effect.disabled || effect.suppressed) : (effect.disabled || effect.isSuppressed)) continue;
    const data = projected ? effect : effect.system;
    const id = data?.defId;
    if (!id) continue;
    const stage = data.stage ?? 0;
    const uses = data.uses ?? 0;
    out[id] = (out[id] ?? 0) + Math.max(1, stage > 0 ? stage : uses);
  }
  return out;
}

/**
 * The count scale a holder states, in either spelling, or `null` when it states none.
 *
 * A holder is whatever carries the amount per step: an element (its `value`),
 * an entry (its `magnitude`), a `times`, a cooldown change (its `ticks`). It
 * states the scale as `count: {of, …}` beside its own `each`, `base` and
 * `zeroPaysNothing` (#319), or as the old `perStack: {effect, each, base}`.
 *
 * @param {object|null|undefined} spec the holder
 * @returns {object|null} a {@link countedValue} spec without its `per`
 */
export function countScaleOf(spec) {
  if (spec?.count && typeof spec.count === "object") {
    return {
      count: spec.count,
      ...(spec.each !== undefined ? { each: spec.each } : {}),
      ...(spec.base !== undefined ? { base: spec.base } : {}),
      ...(spec.zeroPaysNothing !== undefined ? { zeroPaysNothing: spec.zeroPaysNothing } : {}),
    };
  }
  return spec?.perStack?.effect ? fromPerStack(spec.perStack) : null;
}

/**
 * How many of an ability's criteria the declaration's DUs meet, and which.
 *
 * Excalibur Proto (#283): *"Damage dealt depends on whether how many of the
 * following criteria are met by DUs within the NP area"*. A criterion tests the
 * DUs (`targets`, each against the caster: `target:` options are the DU's) and
 * says how many must pass -- `atLeast`, `exactly`, or `none` -- or tests the
 * caster alone (`self`). Counted ONCE per declaration over its whole set, and
 * the damage, the cost and the cooldown read that one number (`criteria` Count).
 *
 * Two readings, settled 2026-10-22:
 *   - *"Criteria 1, 3, 4, and 5 are also accounted for when Criteria 2 is
 *     fulfilled, in this case the single DU needs to meet the conditions"*: with
 *     ONE DU, an `atLeast` criterion holds when that DU passes.
 *   - A criterion about DUs is not met over an empty area: *"none of the DUs"*
 *     needs DUs.
 *
 * @param {object[]|undefined} criteria
 * @param {{targets?: object[], self?: object|null, board?: object|null}} ctx
 * @returns {{met: number, which: number[], total: number}} `which` is 1-based, the sheet's numbering
 */
export function criteriaMet(criteria, { targets = [], self = null } = {}) {
  const list = Array.isArray(criteria) ? criteria : [];
  const which = list.flatMap((c, i) => (criterionHolds(c, targets, self) ? [i + 1] : []));
  return { met: which.length, which, total: list.length };
}

/**
 * Criteria counted over a declaration's resolved targets: the DUs, the user excepted, as the board sees them.
 *
 * Both use paths ask this, so a Skill and an Attack read their criteria over
 * the same set (#283).
 *
 * @param {object[]|undefined} criteria
 * @param {{units?: Array<{unitId: string}>}} targets what the targeting resolved
 * @param {object} self the user, as the board sees it
 * @param {object} board
 * @returns {{met: number, which: number[], total: number}}
 */
export function declarationCriteria(criteria, targets, self, board) {
  if (!criteria?.length) return { met: 0, which: [], total: 0 };
  const dus = (targets?.units ?? [])
    .filter((t) => t.unitId !== self?.id)
    .map((t) => (board?.units ?? []).find((u) => u.id === t.unitId))
    .filter(Boolean);
  return criteriaMet(criteria, { targets: dus, self, board });
}

/** @returns {boolean} */
function criterionHolds(criterion, targets, self) {
  if (criterion?.self) return testPredicate(criterion.self, { options: rollOptionsFor({ attacker: self }) });
  if (targets.length === 0) return false;
  const passing = targets.filter((du) => testPredicate(criterion?.targets ?? [], {
    options: rollOptionsFor({ attacker: self, defender: du }),
  })).length;
  if (criterion?.none) return passing === 0;
  if (criterion?.exactly !== undefined) return passing === criterion.exactly;
  if (criterion?.atLeast !== undefined) return passing >= (targets.length === 1 ? 1 : criterion.atLeast);
  return false;
}

/**
 * A damage block's multiplier: a number, or one sized by a Count (Excalibur Proto's 3x + 0.5x per criterion).
 *
 * @param {object|null|undefined} block
 * @param {CountContext} [ctx] `use.criteriaMet` for a criteria-sized one
 * @returns {number}
 */
export function multiplierOf(block, ctx = {}) {
  return countedValue(block?.multiplier ?? 1, ctx);
}

/** The keys each kind reads and cannot do without. */
const REQUIRED_KEYS = Object.freeze({
  stacks: ["effect"], resource: ["key"], use: ["fact"], parameters: ["vs", "compare"],
});

/**
 * Every Count spec authored anywhere in a document: each object under a `count` key, with its path.
 *
 * One walker for both readers that must find them: the build's validator
 * (`tools/lib/content.mjs`) and the use gate (`rules/costs.mjs`). A number under
 * `count` (a summon's head count) is not a Count spec and is skipped.
 *
 * @param {unknown} node
 * @param {string} [path]
 * @returns {Array<{path: string, spec: object}>}
 */
export function countSpecsIn(node, path = "") {
  if (Array.isArray(node)) return node.flatMap((n, i) => countSpecsIn(n, `${path}[${i}]`));
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) => {
    const here = path ? `${path}.${key}` : key;
    const own = key === "count" && value && typeof value === "object" && !Array.isArray(value)
      ? [{ path: here, spec: value }] : [];
    return [...own, ...countSpecsIn(value, here)];
  });
}

/**
 * What is wrong with one Count spec, in words: an unknown kind, or a key its kind reads and lacks.
 *
 * @param {object} spec
 * @returns {string[]}
 */
export function countProblems(spec) {
  if (!COUNT_KINDS.includes(spec?.of)) return [`counts "${spec?.of}", which is not one of ${COUNT_KINDS.join(", ")}`];
  return (REQUIRED_KEYS[spec.of] ?? []).filter((k) => spec[k] === undefined || spec[k] === null || spec[k] === "")
    .map((k) => `counts ${spec.of} with no "${k}"`);
}

/**
 * The kinds a document counts that this module does not know, each once.
 *
 * @param {unknown} node an ability's system, or its usage spec
 * @returns {string[]}
 */
export function unknownCountKindsIn(node) {
  return [...new Set(countSpecsIn(node).map(({ spec }) => spec.of).filter((of) => !COUNT_KINDS.includes(of)))];
}

/* -------------------------------------------------------------------------- */
/*  The old spellings                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `perStack: {effect, each, base}`: per `each` stacks the bearer holds, nothing at zero.
 *
 * The amount per step is the caller's (an element's `value`, a change's `ticks`).
 *
 * @param {{effect: string, each?: number, base?: number}} perStack
 * @returns {object} a {@link countedValue} spec without its `per`
 */
export function fromPerStack(perStack) {
  return {
    count: { of: "stacks", effect: perStack.effect },
    ...(perStack.each !== undefined ? { each: perStack.each } : {}),
    ...(perStack.base !== undefined ? { base: perStack.base } : {}),
    zeroPaysNothing: true,
  };
}

/**
 * `countTargets: {base, each, requires, excludeSelf}`: `each` is the amount PER target.
 *
 * @param {{base?: number, each?: number, requires?: unknown[], excludeSelf?: boolean}} spec
 * @returns {object}
 */
export function fromCountTargets(spec) {
  return {
    count: {
      of: "targets",
      ...(spec.requires !== undefined ? { requires: spec.requires } : {}),
      ...(spec.excludeSelf !== undefined ? { excludeSelf: spec.excludeSelf } : {}),
    },
    per: spec.each ?? 0,
    base: spec.base ?? 0,
  };
}

/**
 * `countMatching: {relation, requires}`: the board's Units at a relation that pass.
 *
 * Its `maxTicks` cap is a tick expression, so the caller resolves and applies it.
 *
 * @param {{relation?: string, requires?: unknown[]}} spec
 * @returns {object}
 */
export function fromCountMatching(spec) {
  return {
    count: {
      of: "board",
      ...(spec.relation !== undefined ? { relation: spec.relation } : {}),
      ...(spec.requires !== undefined ? { requires: spec.requires } : {}),
    },
    per: 1,
  };
}

/* -------------------------------------------------------------------------- */

/**
 * How many of a DU's Parameters stand as the spec says against the caster's.
 *
 * Excalibur Proto's criteria (#283): *"at least 3 Parameters respectively that
 * are equal to or higher than Arthur's"* (`compare: gte`), and *"at least 3
 * Parameters respectively that are two Ranks below Arthur's"* (`compare:
 * belowBy, by: 2`). A Rank below is a whole GRADE, the modifier kept
 * (`Rank#stepGrade`): two below A is C, so C counts and C+ does not. A
 * Parameter either side leaves unranked is not compared, and a Unit with no
 * Parameters (a Master) has none to count.
 *
 * @param {{compare: string, by?: number}} spec
 * @param {object|undefined} self
 * @param {object|undefined} target
 * @returns {number}
 */
export function parametersCounted(spec, self, target) {
  const mine = self?.parameters ?? null;
  const theirs = target?.parameters ?? null;
  if (!mine || !theirs) return 0;
  return Object.keys(theirs).filter((parameter) => {
    const t = rankOrNull(theirs[parameter]);
    const s = rankOrNull(mine[parameter]);
    if (!t || !s) return false;
    if (spec.compare === "gte") return Rank.compare(t, s) >= 0;
    if (spec.compare === "belowBy") return Rank.compare(t, s.stepGrade(-(spec.by ?? 1))) <= 0;
    return false;
  }).length;
}

/** A Rank, or null for a value that is not one. */
function rankOrNull(raw) {
  try {
    return Rank.parseOrNull(raw);
  } catch {
    return null;
  }
}

/** A count, whole and never negative. */
function whole(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Does a Unit pass a predicate, against its own options? An empty predicate passes. */
function passes(requires, unit) {
  if (!Array.isArray(requires) || requires.length === 0) return true;
  return testPredicate(requires, { options: rollOptionsFor({ attacker: unit }) });
}
