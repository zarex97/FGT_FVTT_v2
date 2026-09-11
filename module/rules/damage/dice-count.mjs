/**
 * @file The `diceCount` damage formula — damage as a count of dice over a threshold.
 * @see docs/36-case-remaining.md §36.6, docs/13-damage-pipeline.md
 *
 * Layer 2 (rules). **Pure** — no `Roll`, no documents. The caller evaluates the
 * dice and hands the faces in, which is the same bargain the damage pipeline
 * itself makes and for the same two reasons: the whole shape is testable
 * without a world, and a logged roll replays to the same number.
 *
 * One ability in the corpus, Nemo's *Quickfire*:
 *
 * > *"Roll 6 six-sided die, this Attack Skill deals 25 STR damage for each die
 * > that rolls X or higher, where X=5."*
 *
 * The counting is trivial and is not why this file exists. The THRESHOLD is:
 * four conditional modifiers, one of which fires on a choice the defender makes
 * in the middle of the Combat Process (*"+1 if the enemy Unit Evades"*), so the
 * number a player is asked to accept can be anything from 2 to 6 and moves for
 * reasons spread across the board state, the target's status effects, both
 * Units' Agility and a reaction that had not happened when the attack was
 * declared.
 *
 * That is why {@link thresholdFor} returns every modifier it *considered*
 * rather than only the ones that fired, and why its caller writes all of them
 * to the roll log. A player handed "you dealt 75" cannot check it. A player
 * handed "5, −1 (Range 2), −1 (target Stunned) → 3+, rolled 6 3 2 5 1 4 → three
 * successes → 75" can.
 */

import { test as testPredicate } from "../predicate.mjs";

/**
 * @typedef {object} ThresholdModifier
 * @property {number} delta
 * @property {import("../predicate.mjs").Predicate} predicate
 * @property {boolean} met
 */

/**
 * @typedef {object} ThresholdResult
 * @property {number} threshold the value a die must meet or beat
 * @property {ThresholdModifier[]} applied every modifier, fired or not
 */

/**
 * The threshold this use of the ability rolls against.
 *
 * Every modifier is evaluated and **reported**, not merely the ones that fired
 * — the rule the damage pipeline's own stages follow, and for the reason they
 * each state: a modifier missing from the breakdown is indistinguishable from
 * one that was never collected.
 *
 * @param {object} spec the ability's `damage.formula`
 * @param {{options: ReadonlySet<string>, refs: Record<string, unknown>}} ctx
 * @returns {ThresholdResult}
 */
export function thresholdFor(spec, ctx) {
  const t = spec?.threshold ?? {};
  const applied = (t.modifiers ?? []).map((m) => ({
    delta: m.delta ?? 0,
    predicate: m.predicate ?? [],
    met: testPredicate(m.predicate, ctx),
  }));

  // NO CLAMP, and none is wanted. The sheet states none, and the arithmetic
  // bottoms out on its own: base 5 against all three −1 clauses is 2, which a
  // d6 clears two thirds of the time. That is a full 150 for pinning a slower,
  // stunned target at point-blank range while it declines to evade — the
  // ability working exactly as written, not an overflow, so nothing here
  // pretends otherwise.
  const threshold = applied.reduce((n, m) => n + (m.met ? m.delta : 0), t.base ?? 0);
  return { threshold, applied };
}

/**
 * Damage from a set of rolled faces.
 *
 * @param {object} spec the ability's `damage.formula`
 * @param {number[]} rolls the evaluated faces, one per die
 * @param {number} threshold from {@link thresholdFor}
 * @returns {{successes: number, total: number}}
 */
export function damageFromDice(spec, rolls, threshold) {
  // "for each die that rolls X or HIGHER" — the threshold itself succeeds.
  const successes = (rolls ?? []).filter((r) => r >= threshold).length;
  return { successes, total: successes * (spec?.perSuccess?.amount ?? 0) };
}

/**
 * The threshold's reasons, in the roll log's own `{source, delta}` shape.
 *
 * Kept here rather than at the call site for the reason `fromCheck` gives for
 * doing the same translation for checks: every site that needed it would
 * otherwise invent its own, and they would drift.
 *
 * **Every modifier appears, fired or not** — one that did not fire is recorded
 * at `delta: 0` with its reason rendered as prose, which is precisely the
 * question a player asks of this ability ("why was it 5 and not 4?"). A
 * zero-delta entry is the roll log's established idiom for *"something that
 * changed the outcome without changing the number"*; here it is something that
 * could have and did not, and the prose says which.
 *
 * @param {ThresholdResult} result
 * @param {{options: ReadonlySet<string>, refs: Record<string, unknown>}} ctx
 * @param {(p: object, c: object) => Array<{text: string, passed: boolean}>} explain
 *   `rules/predicate.mjs#explain`, injected so this file keeps its single import
 * @returns {Array<{source: string, delta: number}>}
 */
export function thresholdModifiers(result, ctx, explain) {
  return result.applied.map((m) => ({
    source: explain(m.predicate, ctx).map((e) => e.text).join(" and ") || "unconditional",
    delta: m.met ? m.delta : 0,
  }));
}
