/**
 * @file The ability editor's view-model, computed without a world.
 * @see docs/29-user-interface.md §29.6, D29.12
 *
 * Layer 4, but **pure**: no `game`, no `canvas`, no `ui`. D29.12 says
 * presentation arithmetic lives in a module that can be unit-tested without a
 * world, the way `actor-sheet/present.mjs` already is — and this is the module
 * that turns 54 rule elements into a data problem instead of 54 pieces of
 * markup.
 *
 * `formRows` is the whole trick: any descriptor plus its current value becomes
 * rows the template renders with **one** partial. Adding a keyword to the
 * engine means adding a table entry, never touching a `.hbs`.
 */

import { validateFieldValue } from "../../rules/authoring/fields.mjs";
import { elementsForBucket } from "../../rules/authoring/elements.mjs";
import { PHASE_DESCRIPTORS, phasesByUsage } from "../../rules/authoring/phases.mjs";
import { requirementsFor, REQUIREMENT_DESCRIPTORS, CS_REQUIREMENT_DESCRIPTORS } from "../../rules/authoring/requirements.mjs";
import { TIMING_DESCRIPTORS, TIMING_IDS, AGAINST_FIELDS } from "../../rules/authoring/timing.mjs";
import { fieldGroupsFor } from "../../rules/authoring/ability.mjs";
import { windowsOf } from "../../rules/windows.mjs";

/** The three buckets a rule element may be authored into. */
const BUCKETS = Object.freeze(["passiveRules", "activeRules", "rules"]);

/**
 * One row per descriptor field, carrying the current value and any problem.
 *
 * **An empty field keeps its row.** A field with no value is precisely the one
 * a GM still has to fill; dropping it would hide the thing they came to do.
 *
 * @param {object} descriptor
 * @param {object} value the authored object this descriptor describes
 * @param {string} [prefix] the form-name prefix, so the editor can route input
 * @returns {object[]}
 */
export function formRows(descriptor, value, prefix = "") {
  return (descriptor?.fields ?? []).map((field) => {
    const held = value?.[field.key];
    const verdict = validateFieldValue(field.type, held);
    return {
      key: field.key,
      type: field.type,
      label: field.label ?? field.key,
      hint: field.hint ?? "",
      choices: field.choices ?? null,
      of: field.of ?? null,
      value: held,
      name: prefix ? `${prefix}.${field.key}` : field.key,
      problem: verdict.ok ? null : verdict.reason,
    };
  });
}

/**
 * How complete one section is.
 *
 * @param {object} section
 * @param {object} draft
 * @returns {"done"|"partial"|"empty"}
 */
export function sectionState(section, draft) {
  const fields = section?.fields ?? [];
  if (fields.length === 0) return listState(section?.id, draft);

  const filled = fields.filter((f) => {
    const v = valueAt(draft, f.key);
    return v !== undefined && v !== null && v !== "" && v !== false;
  }).length;

  if (filled === 0) return "empty";
  return filled === fields.length ? "done" : "partial";
}

/**
 * The rail: every section, its state, and how much it holds.
 *
 * @param {object} draft
 * @param {string} itemType
 * @param {object} [opts]
 * @param {string|null} [opts.current] the section being edited
 * @returns {object[]}
 */
export function railRows(draft, itemType, { current = null } = {}) {
  return fieldGroupsFor(itemType).map((section) => ({
    id: section.id,
    label: section.label,
    hint: section.hint,
    state: sectionState(section, draft),
    count: listCount(section.id, draft),
    current: section.id === current,
  }));
}

/**
 * Every rule element authored into one bucket, plus what may be added.
 *
 * An element whose key no descriptor knows keeps its row and renders raw:
 * §21.4 lets a module add one, and an editor that dropped it on save would be
 * silently deleting another package's content.
 *
 * @param {object} draft
 * @param {string} bucket
 * @returns {object[] & {choices?: object[]}}
 */
export function elementRows(draft, bucket) {
  const held = draft?.[bucket] ?? [];
  const rows = held.map((el, index) => {
    const descriptor = elementsForBucket(bucket).find((d) => d.id === el?.key) ?? null;
    return descriptor
      ? {
        index, key: el.key, unknown: false,
        label: descriptor.label, hint: descriptor.hint, doc: descriptor.doc,
        fields: formRows(descriptor, el, `${bucket}.${index}`),
        raw: JSON.stringify(el, null, 2),
      }
      : {
        index, key: el?.key ?? "", unknown: true,
        label: el?.key ?? "", hint: "", doc: null, fields: [],
        raw: JSON.stringify(el, null, 2),
      };
  });
  rows.choices = elementsForBucket(bucket);
  return rows;
}

/**
 * Every requirement authored, plus the vocabulary this item type may add from.
 *
 * @param {object} draft
 * @param {string} itemType
 * @returns {object[] & {choices?: object[]}}
 */
export function requirementRows(draft, itemType) {
  const table = itemType === "commandSpell" ? CS_REQUIREMENT_DESCRIPTORS : REQUIREMENT_DESCRIPTORS;
  const rows = (draft?.requirements ?? []).map((r, index) => {
    const descriptor = table[r?.kind] ?? null;
    return descriptor
      ? {
        index, kind: r.kind, unknown: false,
        label: descriptor.label, hint: descriptor.hint,
        fields: formRows(descriptor, r, `requirements.${index}`),
        raw: JSON.stringify(r, null, 2),
      }
      : {
        index, kind: r?.kind ?? "", unknown: true,
        label: r?.kind ?? "", hint: "", fields: [], raw: JSON.stringify(r, null, 2),
      };
  });
  rows.choices = requirementsFor(itemType);
  return rows;
}

/**
 * The timing window, its modifiers, and every window that may be chosen.
 *
 * `windows` is a LIST because an ability may name two — Karna's Uncrowned Arms
 * Mastership is *"during your Turn or at the start of a Combat Phase"*.
 *
 * @param {object} draft
 * @returns {object}
 */
export function timingRow(draft) {
  const timing = draft?.timing ?? null;
  return {
    windows: windowsOf(timing),
    choices: TIMING_IDS.map((id) => TIMING_DESCRIPTORS[id]),
    fields: formRows({ fields: AGAINST_FIELDS }, timing ?? {}, "timing"),
  };
}

/**
 * Who inside the targeted area is actually caught.
 *
 * Never editable before this: the anchor and the shape had a picker and
 * `selection` had nothing, so Akhilleus Kosmos's *"allied Units, including
 * himself"* could not be said.
 *
 * @param {object} draft
 * @returns {object}
 */
export function selectionRow(draft) {
  const selection = draft?.targeting?.selection ?? {};
  return {
    fields: formRows({
      fields: [
        {
          key: "relations",
          type: "tokenList",
          label: "FGT.Authoring.Selection.relations",
          hint: "FGT.Authoring.Selection.relationsHint",
        },
        {
          key: "includeSelf",
          type: "checkbox",
          label: "FGT.Authoring.Selection.includeSelf",
          hint: "FGT.Authoring.Selection.includeSelfHint",
        },
        {
          key: "chooser",
          type: "select",
          choices: ["all", "caster", "target"],
          label: "FGT.Authoring.Selection.chooser",
          hint: "FGT.Authoring.Selection.chooserHint",
        },
      ],
    }, selection, "targeting.selection"),
  };
}

/**
 * Every phase authored, plus the kinds that may be added, commonest first.
 *
 * @param {object} draft
 * @returns {object[] & {choices?: object[]}}
 */
export function phaseRows(draft) {
  const rows = (draft?.phases ?? []).map((phase, index) => {
    const descriptor = PHASE_DESCRIPTORS[phase?.kind] ?? null;
    return descriptor
      ? {
        index, kind: phase.kind, unknown: false,
        label: descriptor.label, hint: descriptor.hint,
        fields: formRows(descriptor, phase, `phases.${index}`),
        raw: JSON.stringify(phase, null, 2),
      }
      : {
        index, kind: phase?.kind ?? "", unknown: true,
        label: phase?.kind ?? "", hint: "", fields: [],
        raw: JSON.stringify(phase, null, 2),
      };
  });
  rows.choices = phasesByUsage();
  return rows;
}

/* -------------------------------------------------------------------------- */

/**
 * Read a possibly-dotted key off the draft — `cooldown.max`.
 * @param {object} draft
 * @param {string} key
 * @returns {unknown}
 */
function valueAt(draft, key) {
  return key.split(".").reduce((held, part) => held?.[part], draft);
}

/**
 * How many entries a list-shaped section holds.
 * @param {string} id
 * @param {object} draft
 * @returns {number}
 */
function listCount(id, draft) {
  switch (id) {
    case "ruleElements":
      return BUCKETS.reduce((n, b) => n + (draft?.[b]?.length ?? 0), 0);
    case "requirements":
      return draft?.requirements?.length ?? 0;
    case "whatItDoes":
      return draft?.phases?.length ?? 0;
    case "whenItFires":
      return windowsOf(draft?.timing).length;
    case "whereItLands":
      return draft?.targeting ? 1 : 0;
    default:
      return 0;
  }
}

/**
 * A list-shaped section is done when it holds anything.
 * @param {string} id
 * @param {object} draft
 * @returns {"done"|"empty"}
 */
function listState(id, draft) {
  return listCount(id, draft) > 0 ? "done" : "empty";
}
