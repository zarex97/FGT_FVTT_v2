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
  switch (spec?.of) {
    case "stacks":
      return whole(ctx.stacks?.[/** @type {string} */ (spec.effect)]);
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
    case "resource":
      return whole(ctx.refs?.self?.resources?.[/** @type {string} */ (spec.key)]?.value);
    case "criteria":
      return whole(ctx.use?.criteriaMet);
    case "use": {
      const fact = ctx.use?.[/** @type {string} */ (spec.fact)];
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

/** A count, whole and never negative. */
function whole(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Does a Unit pass a predicate, against its own options? An empty predicate passes. */
function passes(requires, unit) {
  if (!Array.isArray(requires) || requires.length === 0) return true;
  return testPredicate(requires, { options: rollOptionsFor({ attacker: unit }) });
}
