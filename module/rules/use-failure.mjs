/**
 * @file A use that may fail outright (#300).
 * @see docs/17-abilities.md, module/engine/skill-use.mjs#rollUseFailure
 *
 * Layer 2 (rules). Pure: which `UseFailure` a use rolls against, and at what
 * chance. Charlotte Corday's Skill carries its own (`of: [self]`), and is then
 * locked for the Turn. Merlin's Spells and Noble Phantasm fail more often under
 * a condition (`chanceWhen`), and a failure ends his actions for the Turn.
 * Rolled once per use, at the one gate both use paths pass, before any phase
 * runs or any Process opens.
 */

import { test as testPredicate } from "./predicate.mjs";
import { useClassesOf } from "./costs.mjs";

/** What a failure does after it (closed: `tools/lib/content.mjs` refuses any other). */
export const FAILURE_THEN = Object.freeze(["lockThisTurn", "endActions"]);

/** The use classes an `of` may name; any other entry is `self` or a content id. */
export const FAILURE_CLASSES = Object.freeze(["np", "skill", "spell"]);

/**
 * The failure this use rolls against: the highest chance among the bearer's
 * `UseFailure`s that name it, where the first `chanceWhen` that passes replaces
 * the plain chance.
 *
 * @param {object} ability the ability, as `rules/ability-use.mjs#usageSpecFor` projects it
 * @param {object} unit the user, as the board sees it (`useFailures` from its contributions)
 * @param {Iterable<string>} options the user's own options
 * @returns {{chance: number, then: string|null, source: string}|null}
 */
export function failureFor(ability, unit, options) {
  if (!ability) return null;
  const classes = useClassesOf(ability);
  const ctx = { options: options instanceof Set ? options : new Set(options ?? []) };
  let best = null;
  for (const f of unit?.useFailures ?? []) {
    const named = (f.of ?? []).some((o) => (o === "self" ? f.ownerAbilityId === ability.id
      : FAILURE_CLASSES.includes(o) ? classes.includes(o)
        : o === ability.contentId));
    if (!named) continue;
    const when = (f.chanceWhen ?? []).find((w) => testPredicate(w.predicate ?? [], ctx));
    const chance = Number(when ? when.chance : f.chance) || 0;
    if (chance > 0 && (!best || chance > best.chance)) best = { chance, then: f.then ?? null, source: f.source };
  }
  return best;
}
