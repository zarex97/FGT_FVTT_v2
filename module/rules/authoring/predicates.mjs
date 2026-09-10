/**
 * @file Every place a predicate can hide in an authored document.
 * @see docs/24-rules-engine.md §24.4
 *
 * Layer 2 (rules). Pure.
 *
 * **Why one collector.** `test/unit/options.test.mjs` has held authored
 * predicates against `isEmittableOption` since `N.Atk Up` and `Bleed Atk` were
 * both written against `self:attack:normal` — an option `rollOptionsFor` has
 * never emitted, so *"the modifier was dropped at every damage event and the
 * effect did nothing at all"*. But it reads **rule elements only**: 147 of the
 * 236 option references in `packs/_source`. The other 89 sit on requirements
 * and phases, where nothing has ever looked.
 *
 * Two collectors would be two opinions about what counts as a predicate, and
 * the difference between them is exactly where the next silent clause hides.
 *
 * **Three fields are named like predicates and are not.** Each is listed in
 * {@link NOT_PREDICATES} with its reason, because an omission with no stated
 * cause is indistinguishable from an oversight — and a test asserts every
 * exclusion carries one.
 */

import { referencedOptions } from "../predicate.mjs";

/**
 * Fields whose value **is** a predicate, wherever they appear.
 *
 * `targeting.selection.attributes` is deliberately absent: it is a predicate,
 * but it is collected by PATH rather than by name, because a unit's own
 * `attributes: [servant, male]` is a plain list and must not be mistaken for
 * one.
 *
 * @type {readonly string[]}
 */
export const PREDICATE_FIELDS = Object.freeze([
  "predicate",
  "attackPredicate",
  "targetPredicate",
  "requiresRecipient",
  "chanceWhen",
]);

/**
 * Fields that look like predicates and are not, with why.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const NOT_PREDICATES = Object.freeze({
  chanceWhen:
    "Not evaluated by the predicate engine. `engine/attack.mjs#chanceFor` matches it with a "
    + "bespoke string compare that strips `attack:kind:`, which is why `auto-evade.yml` correctly "
    + "authors the bare term \"np\" — a string `rollOptionsFor` never emits.",
  blockedWhen:
    "Not a predicate. `{state, condition}`, matched by `rules/command-spells.mjs#conditionHolds` "
    + "— a switch with one case and no roll options at all. A third mini-vocabulary beside "
    + "predicates and requirement kinds.",
});

/**
 * Every predicate in one authored document, with where it came from.
 *
 * @param {object|null|undefined} doc
 * @returns {Array<{where: string, options: string[]}>}
 */
export function predicateSitesIn(doc) {
  /** @type {Array<{where: string, options: string[]}>} */
  const out = [];

  /**
   * @param {unknown} node
   * @param {string} path
   */
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (!node || typeof node !== "object") return;

    for (const [key, value] of Object.entries(node)) {
      const here = path ? `${path}.${key}` : key;

      // A field that is not a predicate, however it is named. Skipped whole:
      // `chanceWhen` contains a nested `predicate` that is not one either.
      if (Object.hasOwn(NOT_PREDICATES, key)) continue;

      if (PREDICATE_FIELDS.includes(key)) {
        collect(value, here);
        continue;
      }

      // The one collected by path. `selection.attributes` holds predicate
      // statements; a unit's own `attributes` is a list of strings.
      if (key === "attributes" && /(^|\.)selection$/.test(path)) {
        collect(value, here);
        continue;
      }

      walk(value, here);
    }
  };

  /**
   * @param {unknown} value
   * @param {string} where
   */
  const collect = (value, where) => {
    if (!Array.isArray(value)) return;
    // `referencedOptions` already strips `not:` and descends or/anyOf/nor.
    // Re-implementing that walk here would be a second opinion about what a
    // predicate contains.
    const options = [...referencedOptions(value)];
    if (options.length > 0) out.push({ where, options });
  };

  walk(doc, "");
  return out;
}
