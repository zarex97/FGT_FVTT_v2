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
import { ENTRY_KEYS } from "../effect-flow.mjs";

/** The editor control for each kind of Effect Entry key. */
const ENTRY_CONTROL = Object.freeze({
  effect: "effectId",
  // A number or an `@` expression, so free text: a number input refuses
  // Mannanán's `@self...` and saves nothing.
  expression: "text",
  number: "number",
  duration: "tickExpr",
  boolean: "checkbox",
  select: "select",
  json: "raw",
});

/**
 * One editor field per key an Effect Entry may author, from the same list
 * Landing reads (`rules/effect-flow.mjs#ENTRY_KEYS`). The form offered six
 * keys and the door reads twenty-two; drawn from one list, the two cannot
 * drift (`test/unit/landing-one-door.test.mjs`).
 *
 * `ignoresResistanceFrom` is a list of source slugs, so a `tokenList`: as
 * `text` it saved a string, which Landing spread a character at a time.
 */
export const ENTRY_FIELDS = Object.freeze(Object.entries(ENTRY_KEYS).map(([key, spec]) => Object.freeze({
  key,
  type: key === "ignoresResistanceFrom" ? "tokenList" : ENTRY_CONTROL[spec.type],
  ...(spec.choices ? { choices: spec.choices } : {}),
  hint: spec.means,
})));

/** On every phase: who it lands on, and the gate that decides whether it runs. */
const COMMON = Object.freeze([
  // TWO, not five. `engine/skill-use.mjs` implements `self` and `reuse`; the
  // picker offered `each`, `chosen` and `caster` as well, and no executor has
  // ever read one -- so choosing any of the three authored cleanly and landed
  // on whatever `reuse` would have caught, silently. `test/unit/phase-targets`
  // holds the content against the executor from the other side; this is the
  // door, and it was open onto nothing.
  { key: "target", type: "select", choices: ["reuse", "self", "linkedGroup", "master"] },
  { key: "predicate", type: "predicateList" },
  // Asked of each Unit the phase reaches, the caster in scope: Legend of
  // Dracula's Master inside Wallachia (#330), Sieg's Heilen on himself (#345).
  { key: "targetPredicate", type: "predicateList" },
  { key: "when", type: "text" },
  // A die for the whole phase: a percent, or `{value, perPriorUse, max, label}`
  // growing with each use (`rules/phase-chance.mjs`; Prelati's Encouragement, #260).
  { key: "chance", type: "raw" },
  // Run once the use's costs are paid: Legend of Dracula's kill comes *"after
  // this NP is activated"* (#330).
  { key: "afterCosts", type: "checkbox" },
  // A caster's own after-damage phase that comes whether or not the Attack
  // lands: Haradhanu Janaka's Heal Up (#348 ruling 8, `engine/attack.mjs#selfPhasesOnMiss`).
  { key: "alsoOnMiss", type: "checkbox" },
  // The card's line when `predicate` holds the phase back, a lang key: Unparalleled's
  // *"This effect is not applied if any other allied Servant has already Attacked"* (#328).
  { key: "unmetLine", type: "text" },
  // Asked of the Unit the use was aimed at (Fox's Wedding, #353).
  { key: "chosenPredicate", type: "predicateList" },
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
    // Each entry gets a row of its own in the editor, one field per key.
    { key: "effects", type: "objectList", of: ENTRY_FIELDS },
    { key: "rules", type: "raw" },
    { key: "targeting", type: "raw" },
    // A resistance every effect of the phase ignores, by its source's slug.
    // Zabaniya: *"not affected by Magic Resistance"* (#199 reading 11).
    { key: "ignoresResistanceFrom", type: "tokenList" },
    // Riders land on a hit, not a hurt (§46.4-LI), unless the sheet says
    // otherwise: Mystery Bisection's Instakill comes *"if damage was dealt"*
    // (#243 reading 15).
    { key: "requiresDamage", type: "checkbox" },
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
  entry("transferItem", 50, "Hands an Item, whole, from one Unit to another, with who placed it.", [
    { key: "item", type: "text" },
    { key: "from", type: "select", choices: ["self", "master", "target"] },
    { key: "to", type: "select", choices: ["self", "master", "target"] },
    { key: "bind", type: "checkbox" },
    { key: "lock", type: "tokenList" },
  ]),
  // The user takes the form its ability defines, one-way (#323).
  entry("transform", 50, "The user takes the form this ability defines: its stats, Attributes and abilities, for good.", []),
  entry("setMode", 50, "Switches a mode on or off - one ability ending another.", [
    { key: "ability", type: "text" },
    { key: "active", type: "checkbox" },
    // Off for a span: the mode cannot be switched back on until it passes
    // (Arturia's Strike Air and Excalibur on Invisible Air, #230).
    { key: "suspendFor", type: "text" },
    // Off at this Turn's end rather than now: Fafnir's usage 1 (#345).
    { key: "atTurnEnd", type: "checkbox" },
  ]),
  entry("removeEffect", 50, "Strips effects off whoever this ability caught.", [
    { key: "effects", type: "tokenList" },
    { key: "selector", type: "raw" },
    { key: "ignoresRemovalProtection", type: "checkbox" },
    // Only this many, its user's pick (Disengage, #339 ruling 3). Skill path.
    { key: "pick", type: "number" },
  ]),
  // Vlad III (Berserker) (#333): Shapeshift resets its buffs to 1◈, Legend of
  // Dracula extends them by 1◈, each by name (`rules/effect-duration.mjs`).
  entry("effectDuration", 45, "Sets or extends the duration of named effects the Unit already holds.", [
    { key: "effects", type: "tokenList" },
    { key: "set", type: "tickExpr" },
    { key: "extend", type: "tickExpr" },
  ]),
  // Tamamo's Dainisshō ends Yata no Kagami at the Turn's end and lengthens the
  // Cooldown it starts then (#353).
  entry("endField", 45, "Ends the user's own named field at the end of this Turn, lengthening the Cooldown it starts then.", [
    { key: "field", type: "text" },
    { key: "atTurnEnd", type: "checkbox" },
    { key: "cooldownBonus", type: "tickExpr" },
  ]),
  entry("move", 45,"Lets the Unit Move up to a number of panels, by an ordinary path, to a panel its owner picks.", [
    { key: "panels", type: "number" },
  ]),
  entry("heal", 50, "Restores Health, as a flat amount or a fraction of MAXIMUM.", [
    { key: "percentOfMax", type: "number" },
    { key: "toPercentOfMax", type: "number" },
    { key: "amount", type: "number" },
  ]),
  // Damage that is no Attack (#330): Kazıklı Bey's Active 2, *"Those Units
  // receive Y damage ... This damage has the Pierce and Ignore Def effects"*,
  // through the defender's half of the pipeline only (`attack.mjs#standaloneDamage`).
  entry("strike", 45, "Deals damage that is no Attack: no Combat Process, no reaction, the user's modifiers skipped.", [
    { key: "amount", type: "raw" },
    { key: "branches", type: "raw" },
    { key: "component", type: "select", choices: ["str", "mag"] },
    { key: "isNP", type: "checkbox" },
    { key: "pierce", type: "checkbox" },
    { key: "ignoresDefUp", type: "checkbox" },
  ]),
  // Legend of Dracula (#330 ruling 12): *"if the Master is within Wallachia
  // when it is activated, Vlad will immediately kill his Master"*.
  entry("defeat", 40, "Defeats the Unit outright, its user the killer: no damage, no revival.", [
    { key: "cause", type: "text" },
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
  // Doppelganger (#253 readings 10-12): the target's look, put on the caster.
  entry("disguise", 25, "Puts the chosen Unit's appearance on the caster, for everyone but its own side's owner and the GM.", []),
  entry("rollTable", 20, "Rolls dice against a table and applies what comes up.", [
    { key: "tables", type: "raw" },
    // ONE table whoever is hit, where `tables` splits it by relation: Bab-ilu's
    // twenty debuffs land on every DU alike (#232). `rules/roll-table.mjs#tableFor`
    // has read it since the tables were written; nothing declared it.
    { key: "entries", type: "raw" },
    { key: "count", type: "number" },
    { key: "faces", type: "number" },
    // What a repeated face does: Scáthach's "apply the effect twice" (the
    // default) or Yan Qing's "reroll it until the number is not a duplicate"
    // (#253 reading 9). Rows may carry `all: true` and `target: self`
    // (`rules/roll-table.mjs`).
    { key: "duplicates", type: "select", choices: ["twice", "reroll"] },
    // After the dice, one more row of its user's choice that no die chose,
    // or none: Rune Magic's *"then, you can apply one more effect of your
    // choice other than the one selected by the die"* (#339 ruling 4). Skill path.
    { key: "thenChoose", type: "checkbox" },
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
    // Carolus Patricius (#351): its middle panel the caster's, and every Unit on
    // the ground within it carried aboard.
    { key: "placement", type: "select", choices: ["", "centred"] },
    { key: "carriesAllWithin", type: "checkbox" },
    // Auctoritas (#351): the owner's platforms of these content ids end first.
    { key: "replaces", type: "tokenList" },
  ]),
  entry("setRoundPhase", 2, "Turns the Round in progress to Day or Night; later Rounds keep the War's alternation.", [
    { key: "to", type: "select", choices: ["day", "night"] },
  ]),
  entry("teach", 2, "Teaches one of the caster's copied Skills to the target Servant, both Cannot Act until it ends.", [
    { key: "duration", type: "tickExpr" },
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
