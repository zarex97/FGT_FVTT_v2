/**
 * @file Every phase kind `runPhases` dispatches, in the words a GM uses.
 * @see docs/15-abilities.md §15.2, docs/29-user-interface.md §29.6
 *
 * Layer 2 (rules). Pure data.
 *
 * Replaces the old `PHASE_FIELDS` in the editor, which was aimed at the wrong
 * targets: it typed `cooldownDelta`, `modifyDamage`, `overrideValidation` and
 * `teleport` — **zero uses each** across 195 authored files, and none of them a
 * `runPhases` case at all — and left nine kinds the content does use, including
 * `createField` (8) and `zone` (4), to a raw JSON textarea. Nothing held it
 * against the dispatcher, so the typed set could point anywhere.
 *
 * **The fields come from the corpus, not from the dispatcher.** Several cases
 * destructure through a helper or read nothing off `phase` at all —
 * `createField` takes its whole spec from `ability.system.field` — so what a
 * phase actually *carries* is best evidenced by what 195 authored abilities
 * write. `test/unit/authoring-phases.test.mjs` holds the ids against
 * `runPhases`; the fields are held against the content by the golden test.
 *
 * `order` is a presentation weight, not a rule: `applyEffects` is 95 of the
 * phases in the corpus, and a picker that buries it under `channel` makes the
 * common case the slowest one.
 */

import { describeTable } from "./contract.mjs";

/** On every phase: who it lands on, and the gate that decides whether it runs. */
const COMMON = Object.freeze([
  { key: "target", type: "select", choices: ["reuse", "self", "each", "chosen", "caster"] },
  { key: "predicate", type: "predicateList" },
  { key: "when", type: "text" },
]);

/**
 * @param {string} id
 * @param {number} order commonest first; measured from `packs/_source`
 * @param {string} english the hint text, mirrored into lang/en.json
 * @param {object[]} [fields]
 * @returns {object}
 */
const entry = (id, order, english, fields = []) => ({
  id,
  label: `FGT.Authoring.Phase.${id}`,
  hint: `FGT.Authoring.Phase.${id}Hint`,
  english,
  doc: "15-abilities.md",
  order,
  fields: [...fields, ...COMMON],
});

export const PHASE_DESCRIPTORS = describeTable([
  entry("applyEffects", 100, "Puts effects onto whoever this ability caught — the commonest phase by far.", [
    {
      key: "effects",
      type: "objectList",
      of: [
        { key: "id", type: "effectId" },
        { key: "duration", type: "tickExpr" },
        { key: "magnitude", type: "number" },
        { key: "uses", type: "number" },
      ],
    },
    { key: "rules", type: "raw" },
    { key: "targeting", type: "raw" },
  ]),
  entry("damage", 90, "Deals damage to whoever this ability caught.", []),
  entry("cooldown", 80, "Changes a cooldown clock — its own, or somebody else's.", [
    { key: "changes", type: "raw" },
    { key: "choose", type: "raw" },
  ]),
  entry("resource", 70, "Spends or grants a pool — tokens, counters, Sustainability.", [
    { key: "changes", type: "raw" },
  ]),
  entry("createField", 60, "Opens the bounded field this ability declares, once, from the caster.", []),
  entry("statChange", 50, "Changes a stat directly, rather than through an effect.", [
    { key: "changes", type: "raw" },
    { key: "afterFirstUse", type: "checkbox" },
  ]),
  entry("removeEffect", 50, "Strips effects off whoever this ability caught.", [
    { key: "effects", type: "tokenList" },
    { key: "selector", type: "raw" },
    { key: "ignoresRemovalProtection", type: "checkbox" },
  ]),
  entry("heal", 50, "Restores Health, as a flat amount or a fraction of MAXIMUM.", [
    { key: "percentOfMax", type: "number" },
    { key: "toPercentOfMax", type: "number" },
    { key: "amount", type: "number" },
  ]),
  entry("zone", 40, "Paints terrain over an area.", [
    { key: "spec", type: "raw" },
  ]),
  entry("summon", 30, "Brings a summon onto the board.", [
    { key: "spec", type: "raw" },
  ]),
  entry("check", 30, "Rolls a check and branches on the result.", [
    { key: "check", type: "text" },
    { key: "branches", type: "raw" },
    { key: "onFail", type: "raw" },
    { key: "modifierRank", type: "rank" },
    { key: "modifierTable", type: "text" },
    { key: "ignoresResistanceFrom", type: "text" },
  ]),
  entry("choose", 20, "Asks the player to pick from a list before continuing.", [
    { key: "prompt", type: "text" },
    { key: "options", type: "raw" },
    { key: "count", type: "number" },
  ]),
  entry("rollTable", 20, "Rolls dice against a table and applies what comes up.", [
    { key: "tables", type: "raw" },
    { key: "count", type: "number" },
    { key: "faces", type: "number" },
  ]),
  entry("itemGrant", 20, "Hands over a quantity of an item, possibly rolled.", [
    { key: "contentId", type: "text" },
    { key: "roll", type: "text" },
    { key: "alsoGrantsResource", type: "text" },
  ]),
  entry("expend", 20, "Spends abilities for good — they do not come back off a cooldown.", [
    { key: "abilities", type: "tokenList" },
  ]),
  entry("channel", 20, "Starts a channel: the Unit cannot act until it completes.", [
    { key: "ticks", type: "number" },
    { key: "onComplete", type: "raw" },
  ]),
  entry("dragInto", 20, "Pulls a Unit into a bounded field.", [
    { key: "fieldId", type: "text" },
  ]),
  entry("createStructure", 20, "Places a destructible object on the board.", [
    { key: "structureId", type: "text" },
    { key: "at", type: "text" },
  ]),
  entry("summonPlatform", 20, "Brings a platform out, with its own Scene Level.", [
    { key: "platformId", type: "text" },
    { key: "at", type: "text" },
    { key: "board", type: "checkbox" },
    { key: "boardMasterIfAdjacent", type: "checkbox" },
  ]),
  entry("cutContract", 10, "Severs a Servant's contract with its Master.", [
    { key: "requires", type: "raw" },
    { key: "grantToCaster", type: "checkbox" },
    { key: "stripMasterCommandSpells", type: "checkbox" },
  ]),
]);

/** @type {readonly string[]} */
export const PHASE_IDS = Object.freeze(Object.keys(PHASE_DESCRIPTORS));

/**
 * Every phase kind, commonest first.
 * @returns {object[]}
 */
export function phasesByUsage() {
  return PHASE_IDS
    .map((id) => PHASE_DESCRIPTORS[id])
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0) || a.id.localeCompare(b.id));
}
