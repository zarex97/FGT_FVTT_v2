/**
 * @file Abilities whose effect is decided by a die, from a table.
 * @see docs/14-checks-and-randomness.md, docs/15-abilities.md §15.2
 *
 * Layer 2 (rules). Pure — takes the phase and the die results, returns which
 * entries fire.
 *
 * Scáthach's *Primordial Rune* is the reference case and it has all three of
 * the wrinkles this file exists for:
 *
 *   1. **Two tables, chosen by relation.** *"On an allied Unit ... on an enemy
 *      Unit"* — the same Skill, two eight-row tables, and which one applies is
 *      a property of the target rather than of the use.
 *   2. **Duplicates apply twice.** *"If a duplicate number is rolled, apply the
 *      effect twice."* So the dice are resolved **per die**, not as a set: two
 *      6s are two applications of NP DmUp, not one.
 *   3. **A wildcard row.** *"Your choice of any of the above effect(s)"* — a
 *      row that resolves to a question rather than to an effect.
 */

import { isFriendly } from "./relations.mjs";

/**
 * Which of the phase's tables applies to a target.
 *
 * A phase may declare one table (`entries`) or a pair keyed by relation
 * (`tables: {ally, enemy}`). One table is the common case and should not have
 * to be written as a pair.
 *
 * @param {object} phase
 * @param {string} relation from `rules/relations.mjs`
 * @returns {object|null} entry index (as a string) → entry
 */
export function tableFor(phase, relation) {
  if (phase?.entries) return phase.entries;

  const tables = phase?.tables ?? null;
  if (!tables) return null;
  return (isFriendly(relation) ? tables.ally : tables.enemy) ?? null;
}

/**
 * The entries a set of die results selects, in the order rolled.
 *
 * Per die, deliberately: *"if a duplicate number is rolled, apply the effect
 * twice"*, so two 6s produce two entries and not one. Collapsing them into a
 * set — the obvious implementation — is exactly the bug that clause warns
 * against.
 *
 * @param {object|null} table
 * @param {number[]} results the individual die faces
 * @returns {Array<{roll: number, entry: object}>}
 */
export function entriesFor(table, results) {
  if (!table) return [];

  /** @type {Array<{roll: number, entry: object}>} */
  const out = [];
  for (const roll of results ?? []) {
    const entry = table[String(roll)] ?? null;
    // A face with no row is a content error, not a miss. Reported by the
    // caller rather than swallowed here, because a Skill that silently does
    // nothing on a 7 is indistinguishable from a Skill that worked.
    out.push({ roll, entry });
  }
  return out;
}

/**
 * The rows a wildcard entry may choose from.
 *
 * *"Your choice of any of the above effect(s)"* — **above**, so the wildcard row
 * itself is never among its own options. Nor is any other wildcard: a table with
 * two of them would otherwise offer a choice that resolves to another choice.
 *
 * @param {object|null} table
 * @returns {Array<{roll: number, entry: object}>}
 */
export function choicesIn(table) {
  if (!table) return [];

  return Object.entries(table)
    .filter(([, entry]) => !entry?.choose)
    .map(([key, entry]) => ({ roll: Number(key), entry }))
    .sort((a, b) => a.roll - b.roll);
}

/**
 * The effects one entry applies.
 * @param {object|null} entry
 * @returns {object[]}
 */
export function effectsOf(entry) {
  return entry?.effects ?? [];
}
