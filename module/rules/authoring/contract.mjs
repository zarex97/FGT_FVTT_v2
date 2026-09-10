/**
 * @file The shape every authoring descriptor must have, and the drift helper.
 * @see docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure.
 *
 * `describeTable` throws at import time rather than dropping a malformed row.
 * A table that silently loses an entry produces a picker missing a keyword,
 * which is precisely the failure this vocabulary exists to prevent — and it
 * would be invisible, because nothing ever looks for a keyword that was never
 * offered.
 *
 * `casesIn` is the shared half of every drift test. `test/unit/targeting.test.mjs`
 * inlines this regex four times; extracting it once is what stops the phase,
 * requirement and window tests from disagreeing about how to read an
 * authority.
 */

import { isFieldType } from "./fields.mjs";

/**
 * Every way one descriptor is malformed. All of them, not the first — a table
 * author fixing 54 entries one message at a time is a slow loop.
 *
 * @param {object} entry
 * @returns {string[]}
 */
export function descriptorProblems(entry) {
  /** @type {string[]} */
  const problems = [];
  const id = entry?.id || "(no id)";

  if (!entry?.id) problems.push("a descriptor needs an id");
  if (!entry?.label) problems.push(`${id}: needs a label`);
  // D5. The hints are the point of the vocabulary; optional hints rot into
  // decoration on the half of the table nobody got to.
  if (!entry?.hint) problems.push(`${id}: needs a hint — §29.6 D5`);

  for (const [i, field] of (entry?.fields ?? []).entries()) {
    const at = `${id}.fields[${i}]`;
    if (!field?.key) problems.push(`${at}: needs a key`);
    if (!isFieldType(field?.type)) {
      problems.push(`${at}: "${field?.type}" is not a field type the editor can render`);
    }
    if (field?.type === "select" && !(field.choices?.length || field.choicesFrom)) {
      problems.push(`${at}: a select needs choices, or it renders an empty dropdown`);
    }
  }
  return problems;
}

/**
 * Freeze a table and index it by id, refusing anything malformed.
 *
 * @param {object[]} entries
 * @returns {Readonly<Record<string, object>>}
 */
export function describeTable(entries) {
  /** @type {Record<string, object>} */
  const table = {};
  for (const entry of entries) {
    const problems = descriptorProblems(entry);
    if (problems.length > 0) throw new Error(`Bad authoring descriptor: ${problems.join("; ")}`);
    if (table[entry.id]) throw new Error(`Duplicate authoring descriptor id "${entry.id}"`);
    table[entry.id] = Object.freeze({ ...entry, fields: Object.freeze(entry.fields ?? []) });
  }
  return Object.freeze(table);
}

/**
 * The `case "x":` labels in a source file, optionally inside one function.
 *
 * Scoping matters: `targeting/resolve.mjs` switches on anchors, selection
 * modes and shapes in the same file, so an unscoped read calls all three
 * anchors and the drift test fails on things that are not anchors.
 *
 * @param {string} source
 * @param {string} [fnName] read only from `function <fnName>` onwards
 * @returns {Set<string>}
 */
export function casesIn(source, fnName = null) {
  let text = source;
  if (fnName) {
    const parts = source.split(new RegExp(`function\\s+${fnName}\\b`));
    if (parts.length < 2) return new Set();
    // Up to the next top-level `function` declaration.
    text = parts[1].split(/\n(?:export\s+)?(?:async\s+)?function\s/)[0];
  }
  return new Set((text.match(/case\s+"(\w+)":/g) ?? []).map((m) => m.match(/"(\w+)"/)[1]));
}
