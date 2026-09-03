/**
 * @file Branch selection for a check phase.
 * @see docs/14-checks-and-randomness.md, docs/15-abilities.md §15.2
 *
 * Layer 2 (rules). Pure.
 *
 * A check phase used to be one Luck Check with a flat `onSuccess`/`onFail`.
 * Medusa's Mystic Eyes is three outcomes chosen by what the target **is**, one
 * of which rolls a second time on failure, and one of which changes a stat
 * rather than applying an effect — so a phase needs branches, and a branch
 * needs to be able to hold another check.
 */

import { test as testPredicate } from "../predicate.mjs";

/** How deep a chain of *"if Failed, roll again"* may go. */
export const MAX_CHECK_DEPTH = 3;

/**
 * The branch this phase takes against this target.
 *
 * A phase with no `branches` **is** its own branch. That is the shape every
 * check phase shipped before this one uses — Scáthach's Gate of Skye is the
 * only author — and it has to keep resolving exactly as it did.
 *
 * An empty `when` is the catch-all, and branches are tried in authored order:
 * Medusa's human branch has to be tested before her MAG branches, because a
 * Master is a Human and would otherwise fall through to one of them.
 *
 * @param {object} phase
 * @param {Set<string>} options the TARGET's option set
 * @returns {object|null} `null` when nothing matched and there is no catch-all
 */
export function selectBranch(phase, options) {
  if (!Array.isArray(phase?.branches)) return phase ?? null;

  for (const branch of phase.branches) {
    const when = branch.when ?? [];
    if (when.length === 0) return branch;
    if (testPredicate(when, { options })) return branch;
  }
  return null;
}

/**
 * Is this outcome another check rather than a result?
 *
 * *"If Failed, roll again. On the second time, if Successful..."* — the branch
 * carries a check of its own instead of effects.
 *
 * @param {object|null} branch
 * @returns {boolean}
 */
export function isNestedCheck(branch) {
  return Boolean(branch && (branch.check || Array.isArray(branch.branches)));
}
