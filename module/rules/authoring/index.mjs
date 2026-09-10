/**
 * @file The authoring vocabulary's public surface.
 * @see docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure.
 *
 * Five tables, each held against the engine's own dispatcher in both
 * directions by its own test. Together they are what lets the editor render a
 * form for any keyword without a line of markup per keyword — the difference
 * between an editor that covers 12 of 90 fields and one that covers what the
 * content actually uses.
 */

export { FIELD_TYPES, isFieldType, validateFieldValue } from "./fields.mjs";
export { describeTable, descriptorProblems, casesIn } from "./contract.mjs";
export { ELEMENT_DESCRIPTORS, ELEMENT_IDS, elementsForBucket } from "./elements.mjs";
export { PHASE_DESCRIPTORS, PHASE_IDS, phasesByUsage } from "./phases.mjs";
export {
  REQUIREMENT_DESCRIPTORS, REQUIREMENT_IDS,
  CS_REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_IDS, requirementsFor,
} from "./requirements.mjs";
export { TIMING_DESCRIPTORS, TIMING_IDS, AGAINST_FIELDS } from "./timing.mjs";
export {
  SECTIONS, FIELD_DESCRIPTORS, EDITABLE_FIELDS, RUNTIME_FIELDS, fieldGroupsFor,
} from "./ability.mjs";

import { ELEMENT_DESCRIPTORS } from "./elements.mjs";
import { PHASE_DESCRIPTORS } from "./phases.mjs";
import { REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_DESCRIPTORS } from "./requirements.mjs";
import { TIMING_DESCRIPTORS } from "./timing.mjs";
import { FIELD_DESCRIPTORS } from "./ability.mjs";

/** @type {Readonly<Record<string, Readonly<Record<string, object>>>>} */
const FAMILIES = Object.freeze({
  element: ELEMENT_DESCRIPTORS,
  phase: PHASE_DESCRIPTORS,
  requirement: REQUIREMENT_DESCRIPTORS,
  csRequirement: CS_REQUIREMENT_DESCRIPTORS,
  timing: TIMING_DESCRIPTORS,
  field: FIELD_DESCRIPTORS,
});

/**
 * One descriptor, by family and id.
 *
 * `null` for anything unknown rather than a throw: a module may add a rule
 * element (§21.4) and an ability carrying one must still open in the editor —
 * it renders in the raw pane instead of taking the window down.
 *
 * @param {"element"|"phase"|"requirement"|"csRequirement"|"timing"|"field"} family
 * @param {string} id
 * @returns {object|null}
 */
export function describe(family, id) {
  return FAMILIES[family]?.[id] ?? null;
}

/** The families `describe` knows. @type {readonly string[]} */
export const FAMILY_NAMES = Object.freeze(Object.keys(FAMILIES));
