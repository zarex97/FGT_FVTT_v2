/**
 * @file A magnitude computed from the set a phase is about to affect.
 * @see docs/45-case-studies.md, docs/15-effect-application.md
 *
 * Layer 2 (rules). Pure: it takes the resolved target list and returns a
 * number.
 *
 * **Why this is not one of the three counting mechanisms that already exist.**
 *
 *   - `perStack` counts EFFECTS ON THE CASTER — Mannanán's Fragarach Counters,
 *     Van Gogh's own Curse stages.
 *   - `countMatching` counts THE BOARD — Semiramis's *Familiar Doves*, *"X =
 *     number of enemy Units with the 'Dove' effect"*.
 *   - `@count(...)` was proposed for exactly this job and **rejected by name**
 *     in `semiramis-familiar-doves.yml`, in favour of the ordinary predicate
 *     grammar.
 *
 * None of them answers *"how many of the Units I am about to buff"*. De
 * Sterrennacht is the first clause that asks:
 *
 * > *"Applies Atk Up … all damage dealt is increased by X0%; if NP, the value
 * > is halved. X = (3 + the number of affected allied Units with the
 * > 'Existence Outside the Domain' Skill excluding herself)."*
 *
 * *Affected* is the word that matters: the count is over the phase's own
 * resolved targets, so a Unit standing three panels away and out of the area
 * does not raise it. That is a property of the SET, and only the phase knows
 * it — which is why this takes the list rather than the board.
 *
 * It reuses the ordinary predicate grammar against each candidate's own roll
 * options, which is the same argument `countMatching` makes for itself.
 */

import { test as testPredicate } from "../predicate.mjs";
import { rollOptionsFor } from "../options.mjs";

/**
 * Resolve a `countTargets` magnitude against a phase's target set.
 *
 * @param {object} spec `{base, each, requires, excludeSelf}`
 * @param {object[]} targets the units this phase resolved to
 * @param {string} casterId who is casting, for `excludeSelf`
 * @returns {number}
 */
export function countTargetsMagnitude(spec, targets, casterId) {
  const base = spec?.base ?? 0;
  const each = spec?.each ?? 0;
  if (each === 0) return base;

  const matched = (targets ?? []).filter((unit) => {
    // "excluding herself", and it is load-bearing rather than tidy: Van Gogh
    // always carries the Skill she is counting, so without this her floor
    // would be one step higher than her sheet's worked figure.
    if (spec?.excludeSelf && unit?.id === casterId) return false;
    if (!spec?.requires?.length) return true;
    return testPredicate(spec.requires, { options: rollOptionsFor({ attacker: unit }) });
  });

  return base + each * matched.length;
}
