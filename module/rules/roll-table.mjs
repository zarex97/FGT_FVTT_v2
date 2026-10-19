/**
 * @file Abilities whose effect is decided by a die, from a table.
 * @see docs/13-checks-and-randomness.md, docs/17-abilities.md
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
 *
 * Yan Qing's Noble Phantasm (#253 reading 9) adds three more, each a key any
 * table may carry:
 *
 *   4. **Duplicates rerolled** (`duplicates: reroll`). *"If the second die is a
 *      duplicate number, reroll it until the number is not a duplicate."*
 *      Scáthach's apply-twice is `duplicates: twice`, the default.
 *   5. **A row that applies every row** (`all: true`). *"If a 4 is rolled on
 *      any of the dice, apply all three effects instead"*: instead, so the other
 *      die's row is not applied a second time.
 *   6. **A row aimed at the user** (`target: self`). *"Applies Crit DmUp for 1◈
 *      Turns to himself"* sits in a table whose other rows land on the DU.
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

/** What a table may do with a repeated face. An unknown word refuses, never defaults. */
export const DUPLICATE_RULES = Object.freeze(["twice", "reroll"]);

/**
 * Roll a table's dice, one face at a time.
 *
 * The dice are separate, never one summed formula: both the apply-twice and
 * the reroll rule read individual faces. The roller is the caller's (Foundry's
 * `Roll` in the engine, a script in a test), so this stays pure.
 *
 * `reroll` rolls a later die again until it differs from every earlier one. A
 * table with fewer faces than dice cannot be all-distinct, so the reroll then
 * stops at the faces it can fill rather than looping for ever.
 *
 * @param {{count?: number, faces?: number, duplicates?: string}} phase
 * @param {(faces: number) => Promise<number>} rollOne
 * @param {{count: number, faces: number}} defaults the path's own defaults
 * @returns {Promise<number[]>}
 */
export async function rollFaces(phase, rollOne, defaults) {
  const faces = phase?.faces ?? defaults.faces;
  const count = phase?.count ?? defaults.count;
  const rule = phase?.duplicates ?? "twice";
  if (!DUPLICATE_RULES.includes(rule)) {
    throw new RangeError(`FGT | A rollTable's \`duplicates\` is "${rule}"; it must be one of ${DUPLICATE_RULES.join(", ")}.`);
  }
  /** @type {number[]} */
  const results = [];
  for (let k = 0; k < count; k += 1) {
    let face = await rollOne(faces);
    if (rule === "reroll" && results.length < faces) {
      for (let tries = 0; results.includes(face) && tries < 1000; tries += 1) face = await rollOne(faces);
    }
    results.push(face);
  }
  return results;
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

  // A face on an `all` row applies every ordinary row once, INSTEAD of what
  // the other dice rolled: Yan Qing's *"if a 4 is rolled on any of the dice,
  // apply all three effects instead"* (#253 reading 9).
  const allAt = (results ?? []).find((roll) => table[String(roll)]?.all);
  if (allAt !== undefined) {
    return choicesIn(table).filter(({ entry }) => !entry?.all).map(({ entry }) => ({ roll: allAt, entry }));
  }

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
    .filter(([, entry]) => !entry?.choose && !entry?.all)
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
