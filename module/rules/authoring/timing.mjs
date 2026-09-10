/**
 * @file The timing windows, as the editor offers them.
 * @see docs/15-abilities.md §15.3, module/rules/windows.mjs
 *
 * Layer 2 (rules). Pure data.
 *
 * The window list itself is `rules/windows.mjs` — this adds the label, the doc
 * anchor and the `against*` modifiers that live on `timing` beside the window.
 * **Derived from that table rather than restating it**, so the picker and the
 * authority cannot disagree; the whole reason `windows.mjs` exists is that four
 * partial lists once did.
 *
 * `windows.mjs` already wrote each window's sentence, so `english` is read from
 * it rather than typed again here.
 */

import { ABILITY_WINDOWS, ABILITY_WINDOW_IDS } from "../windows.mjs";
import { describeTable } from "./contract.mjs";

export const TIMING_DESCRIPTORS = describeTable(
  ABILITY_WINDOW_IDS.map((id) => ({
    id,
    label: `FGT.Authoring.Window.${id}`,
    hint: `FGT.Authoring.Window.${id}Hint`,
    english: ABILITY_WINDOWS[id].hint,
    doc: "15-abilities.md",
    // Carried through so the picker can say which window is documentary. A GM
    // choosing `ownTurn` should know nothing will offer the ability at a
    // moment -- it is the sheet button.
    dispatched: ABILITY_WINDOWS[id].dispatched,
    fields: [],
  })),
);

/** @type {readonly string[]} */
export const TIMING_IDS = Object.freeze(Object.keys(TIMING_DESCRIPTORS));

/**
 * The modifiers that narrow a window.
 *
 * Achilles is the reference: *"when Achilles or any allied Unit within a 2
 * panel area is targeted by an AoE Noble Phantasm of Rank A and above"* is one
 * window plus all four of these. EMIYA's Rho Aias opens in the same window and
 * gates only on the incoming attack being a Noble Phantasm at all — the
 * difference between the two sheets is entirely in these fields, and none of
 * them has ever been editable.
 *
 * @type {readonly object[]}
 */
export const AGAINST_FIELDS = Object.freeze([
  {
    key: "againstKind",
    type: "select",
    choices: ["np", "normal", "skill"],
    label: "FGT.Authoring.Timing.againstKind",
    hint: "FGT.Authoring.Timing.againstKindHint",
    english: "Only against an attack of this kind — a Noble Phantasm, a Normal Attack, a Skill.",
  },
  {
    key: "againstRank",
    // A rank picker, not free text: "A and above" is a comparison against a
    // rank ladder, and a typo here silently never matches.
    type: "rank",
    label: "FGT.Authoring.Timing.againstRank",
    hint: "FGT.Authoring.Timing.againstRankHint",
    english: "Only against an attack of this Rank or higher.",
  },
  {
    key: "requiresAoE",
    type: "checkbox",
    label: "FGT.Authoring.Timing.requiresAoE",
    hint: "FGT.Authoring.Timing.requiresAoEHint",
    english: "Only against an attack that covers an area, rather than one target.",
  },
  {
    key: "radius",
    type: "number",
    label: "FGT.Authoring.Timing.radius",
    hint: "FGT.Authoring.Timing.radiusHint",
    english: "How far from this Unit the triggering attack may land and still open the window.",
  },
]);
