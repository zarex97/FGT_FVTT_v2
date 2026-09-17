/**
 * @file Every phase kind the engine dispatches, in the words a GM uses.
 * @see docs/17-abilities.md, docs/35-sheets-and-editor.md
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
 * **Twenty, not nineteen.** `runPhases` has 20 cases of which `applyEffect` is
 * an alias for `applyEffects` — and `cutContract` (Medea's Rule Breaker) is
 * dispatched only by the attack pipeline, because it happens relative to the
 * damage rather than instead of it. Reading one runner and calling it the
 * authority is how a picker ends up missing a kind that works.
 *
 * `order` is a presentation weight, not a rule: `applyEffects` is 95 of the
 * phases in the corpus, and a picker that buries it under `channel` makes the
 * common case the slowest one.
 */

import { describeTable } from "./contract.mjs";

/** On every phase: who it lands on, and the gate that decides whether it runs. */
const COMMON = Object.freeze([
  // TWO, not five. `engine/skill-use.mjs` implements `self` and `reuse`; the
  // picker offered `each`, `chosen` and `caster` as well, and no executor has
  // ever read one -- so choosing any of the three authored cleanly and landed
  // on whatever `reuse` would have caught, silently. `test/unit/phase-targets`
  // holds the content against the executor from the other side; this is the
  // door, and it was open onto nothing.
  { key: "target", type: "select", choices: ["reuse", "self"] },
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
  doc: "17-abilities.md",
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
        // A chance stated PER PANEL of separation rather than as a flat figure.
        // Anastasia's Ice Block Launcher is the only clause of the shape:
        // *"a 5% chance ... for each panel between Anastasia and the DU."*
        { key: "chancePerPanel", type: "number" },
      ],
    },
    { key: "rules", type: "raw" },
    { key: "targeting", type: "raw" },
  ]),
  entry("damage", 90, "Deals damage to whoever this ability caught.", []),
  entry("cooldown", 80, "Changes a cooldown clock — its own, or somebody else's.", [
    { key: "changes", type: "raw" },
    { key: "choose", type: "raw" },
    // A cooldown phase whose reach differs from the ability's own.
    //
    // > *"Reduce the NP Cooldown of all allied Units within a 2 panel area of
    // > herself **with the 'Child' Attribute**"* — Nursery Rhyme's Tommy
    // > Thumb, whose next clause reaches a DIFFERENT set on the same use.
    //
    // `phaseTargets` has honoured a phase's own targeting since EMIYA needed
    // it, and this is the first cooldown phase to use one.
    { key: "targeting", type: "raw" },
  ]),
  entry("resource", 70, "Spends or grants a pool — tokens, counters, Sustainability.", [
    { key: "changes", type: "raw" },
  ]),
  entry("transfer", 65, "Moves a named effect from a radius onto the caster, stages intact.", [
    { key: "defId", type: "effectId" },
    { key: "radius", type: "number" },
    { key: "relations", type: "tokenList" },
  ]),
  entry("createField", 60, "Opens the bounded field this ability declares, once, from the caster.", []),
  entry("statChange", 50, "Changes a stat directly, rather than through an effect.", [
    { key: "changes", type: "raw" },
    { key: "afterFirstUse", type: "checkbox" },
  ]),
  entry("setMode", 50, "Switches a mode on or off - one ability ending another.", [
    { key: "ability", type: "text" },
    { key: "active", type: "checkbox" },
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
    // `caster` (every structure authored until now) or `randomPanel` -- the
    // Vorpal Blade *"appears on a random panel on the game board"*, which is
    // the point of it: she cannot choose who finds her monster's counter.
    { key: "at", type: "text" },
    // An ITEM the object is holding for whoever walks onto its panel.
    { key: "carriesItemId", type: "text" },
    // Once per match rather than once per use -- "when the Jabberwock is
    // summoned FOR THE FIRST TIME".
    { key: "once", type: "checkbox" },
  ]),
  entry("enterDimension", 20, "Opens a pocket dimension and moves a manifest of Units into it.", [
    { key: "platformId", type: "text" },
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
