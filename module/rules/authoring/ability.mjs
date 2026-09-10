/**
 * @file The ability's own fields, grouped into the sections the editor shows.
 * @see docs/29-user-interface.md §29.6, docs/22-data-models.md §22.6
 *
 * Layer 2 (rules). Pure data.
 *
 * `AbilityData` has **90 fields and the old editor exposed 12**. This is the
 * list that closes the gap — every field appearing in two or more shipped
 * abilities, grouped by the question it answers rather than by where it sits
 * in the schema.
 *
 * **`RUNTIME_FIELDS` is the other half of that decision.** `timesUsed`,
 * `toggledAt`, `lastUsedTick`, `expended`, `active` and the rest are written by
 * the engine during a match. A GM typing one is a GM corrupting the match
 * record, so they appear in no group and get no input. They remain visible in
 * the raw pane, which is the difference between "not offered" and "hidden".
 *
 * `EDITABLE_FIELDS` is **derived** from `SECTIONS` rather than listed beside
 * it. Two hand-maintained lists of the same thing is how they come to disagree.
 */

import { describeTable } from "./contract.mjs";

/**
 * @param {string} key
 * @param {string} type
 * @param {string} english
 * @param {object} [extra]
 * @returns {object}
 */
const f = (key, type, english, extra = {}) => ({
  key,
  type,
  label: `FGT.Authoring.Field.${key}`,
  hint: `FGT.Authoring.Field.${key}Hint`,
  english,
  ...extra,
});

/**
 * Written by the engine, never by a GM.
 *
 * @type {readonly string[]}
 */
export const RUNTIME_FIELDS = Object.freeze([
  "timesUsed", "toggledAt", "lastUsedTick", "expended", "active",
  "recordedAttacks", "uses", "contentVersion", "copiedFrom", "grantedBy",
]);

/**
 * The sections, in rail order — the order a first author needs them, which is
 * also the order the sheet text tends to read in: what it is, what limits it,
 * when it fires, what it needs, what it passively does, where it lands, what
 * it does on use.
 */
export const SECTIONS = Object.freeze([
  {
    id: "whatItIs",
    label: "FGT.Authoring.Section.whatItIs",
    hint: "FGT.Authoring.Section.whatItIsHint",
    english: "The ability's identity: its name, what kind of thing it is, and how it reads.",
    fields: [
      f("name", "text", "The name as it appears on the sheet and in chat."),
      f("kind", "select", "Class Skill, Personal Skill or Noble Phantasm.", {
        choices: ["classSkill", "skill", "noblePhantasm"],
      }),
      f("rank", "rank", "The Rank this ability is stated at — it drives every ranked table."),
      f("slug", "text", "The short internal name other content refers to this by."),
      f("npTags", "tokenList", "What kind of Noble Phantasm this is — barrier, anti-army, and so on."),
      f("description", "text", "The sheet text, verbatim. Mark linkable names with @effect[] and @ability[]."),
    ],
  },
  {
    id: "limits",
    label: "FGT.Authoring.Section.limits",
    hint: "FGT.Authoring.Section.limitsHint",
    english: "Everything that stops this being used again immediately, or at all.",
    fields: [
      // No worked example in the prose: `tick-literals.test.mjs` scans every
      // quoted string in `module/` that contains a rounds symbol and parses
      // it, because a U+2212 MINUS instead of a hyphen once made every copied
      // ability reusable for ever. The field is a `tickExpr`, so the editor
      // shows a live "= 22 turns" readout, which teaches the syntax better
      // than an example a machine has to be told to ignore.
      f("cooldown.max", "tickExpr", "How long before it can be used again."),
      f("duration", "tickExpr", "How long what it does lasts, when the ability itself carries the clock."),
      f("cost", "number", "What using it spends from the action budget."),
      f("maxUses", "number", "How many times it may be used in the whole match. Blank means unlimited."),
      f("requiresRound", "number", "The earliest Round it may be used in."),
      f("category", "text", "The group it belongs to, for clauses that name a whole category."),
      f("expendsPermanently", "checkbox",
        "Spent for the rest of the game once used — not a cooldown, there is no number of Turns."),
      f("oncePerTurn", "checkbox", "Only once in a Turn."),
      f("oncePerRound", "checkbox", "Only once in a Round."),
      f("sameTurnExclusive", "tokenList", "Abilities that cannot be used in the same Turn as this."),
      f("sameRoundExclusive", "tokenList", "Abilities that cannot be used in the same Round as this."),
      f("exclusionSet", "text", "A named group whose members block one another."),
      f("alsoTriggers", "raw", "Other abilities this use also puts on cooldown."),
      f("cooldownWaiver", "raw", "A resource that can be spent to skip the cooldown entirely."),
      f("isPassive", "checkbox", "Always in effect — there is no active form to press."),
      f("isMode", "checkbox", "Switched on and left on, rather than used."),
      f("toggleLock", "tickExpr", "How long after switching before it may be switched back."),
      f("cannotDeactivate", "checkbox", "Once on, it never comes off."),
      f("isAttackSkill", "checkbox", "Counts as an Attack as well as a Skill."),
      f("countsAsAttack", "checkbox", "Spends the Unit's Attack."),
      f("countsAsAct", "checkbox", "Counts as the Unit having Acted."),
      f("copyable", "checkbox", "Whether another Servant's copy effect may take this."),
    ],
  },
  {
    id: "npScoping",
    label: "FGT.Authoring.Section.npScoping",
    hint: "FGT.Authoring.Section.npScopingHint",
    english: "The three questions that decide whether the rules treat this as a Noble Phantasm.",
    fields: [
      f("isNP", "checkbox", "It IS a Noble Phantasm — it costs its Master Health and answers the NP gate."),
      f("categorizedAsNP", "checkbox", "Counted as one for clauses that ask, without being one."),
      f("countsForNPSeal", "checkbox", "Blocked by NP Seal."),
      f("npGateRound", "number", "Its own Round gate, overriding the global one."),
      f("isSpell", "checkbox", "A spell, for the clauses that care."),
      f("element", "text", "Its element, where it has one."),
    ],
  },
  {
    id: "whenItFires",
    label: "FGT.Authoring.Section.whenItFires",
    hint: "FGT.Authoring.Section.whenItFiresHint",
    english: "The moment this may be used — its own Turn, or a window inside somebody else's.",
    fields: [],
  },
  {
    id: "requirements",
    label: "FGT.Authoring.Section.requirements",
    hint: "FGT.Authoring.Section.requirementsHint",
    english: "Everything that must be true before it may be used. An unmet requirement refuses.",
    fields: [],
  },
  {
    id: "ruleElements",
    label: "FGT.Authoring.Section.ruleElements",
    hint: "FGT.Authoring.Section.ruleElementsHint",
    english: "What it does simply by existing — the passive half, and a mode's while-on half.",
    fields: [],
  },
  {
    id: "whereItLands",
    label: "FGT.Authoring.Section.whereItLands",
    hint: "FGT.Authoring.Section.whereItLandsHint",
    english: "Where the area is placed, what shape it is, and who inside it is caught.",
    fields: [],
  },
  {
    id: "whatItDoes",
    label: "FGT.Authoring.Section.whatItDoes",
    hint: "FGT.Authoring.Section.whatItDoesHint",
    english: "The phases that run when it is used, in order.",
    fields: [],
  },
]);

/** Every field a GM may edit — derived, never listed twice. @type {readonly string[]} */
export const EDITABLE_FIELDS = Object.freeze(
  SECTIONS.flatMap((s) => (s.fields ?? []).map((x) => x.key.split(".")[0])),
);

/** Every top-level field, indexed, for the renderer. */
export const FIELD_DESCRIPTORS = describeTable(
  SECTIONS.flatMap((s) => (s.fields ?? []).map((x) => ({
    id: x.key, label: x.label, hint: x.hint, english: x.english, fields: [x],
  }))),
);

/**
 * The sections one item type shows.
 *
 * A Class Skill is never a Noble Phantasm, so offering the three scoping
 * questions would be offering three checkboxes that mean nothing.
 *
 * @param {string} itemType
 * @returns {object[]}
 */
export function fieldGroupsFor(itemType) {
  if (itemType === "classSkill") return SECTIONS.filter((s) => s.id !== "npScoping");
  return [...SECTIONS];
}
