/**
 * @file Every rule element the engine executes, in the words a GM uses.
 * @see docs/29-user-interface.md §29.6, docs/11-effect-engine.md
 *
 * Layer 2 (rules). Pure data.
 *
 * One entry per key in `rules/elements.mjs#EXECUTORS`, held against it in both
 * directions by `test/unit/authoring-elements.test.mjs`. An element the engine
 * executes that nobody can author is a feature with no door; an element
 * offered that nothing executes authors cleanly and does nothing.
 *
 * **On `buckets`.** The design for this file assumed the three buckets took
 * different elements — that `OnEvent` belonged on a passive and `OptionalCost`
 * only on an active use. Reading `collectContributions` says otherwise: lines
 * 102-104 splat `rules`, `passiveRules` and `activeRules` into one list, and
 * the only difference is that `activeRules` is gated on `ability.active`. The
 * buckets differ in **when** they apply, not in which elements are legal, so a
 * picker that filtered by bucket would be inventing a restriction the engine
 * does not have and refusing authoring that would work.
 *
 * The field is kept because it is the right place to record such a restriction
 * if one is ever found, and `elementsForBucket` is the one function that would
 * change. Today it is `ALL_BUCKETS` for all 54.
 *
 * **Every element may carry `predicate`** — `collectContributions` tests it at
 * line 129, before any executor runs — and `defer`, which holds the test until
 * the attack it depends on exists. Both are on every descriptor rather than
 * mentioned once in prose, because a field a GM cannot see is a field they
 * cannot use.
 *
 * Each `hint` condenses that executor's own JSDoc into one sentence. Read the
 * executor before changing a hint: the blocks in `elements.mjs` carry the
 * Servant whose sheet forced the element into existence, and that is usually
 * the clearest thing to say about it.
 */

import { describeTable } from "./contract.mjs";

/** Every bucket. See the note above on why nothing is narrower. */
const ALL_BUCKETS = Object.freeze(["rules", "passiveRules", "activeRules"]);

/** On every element: the gate, and the deferral that waits for an attack. */
const GATE = Object.freeze([
  { key: "predicate", type: "predicateList" },
  { key: "defer", type: "text" },
]);

/** On every element whose magnitude is a number that may scale. */
const SCALED = Object.freeze([
  { key: "value", type: "text" },
  { key: "table", type: "text" },
  { key: "perStack", type: "raw" },
  { key: "max", type: "number" },
]);

/**
 * One descriptor.
 *
 * `label` and `hint` are **localization keys**, following
 * `rules/targeting/vocabulary.mjs` — §29.9 makes Spanish a first-class target,
 * and an English sentence baked into the table cannot be translated. The
 * second argument is the English, and it stays in the source because the
 * instruction "read the executor before changing a hint" is useless if the
 * hint lives in a JSON file three directories away. `test/unit/authoring-i18n`
 * holds the two together: every key here must resolve in `lang/en.json`, and
 * must resolve to exactly this sentence.
 *
 * @param {string} id
 * @param {string} english the hint text, mirrored into lang/en.json
 * @param {object[]} [fields]
 * @returns {object}
 */
const entry = (id, english, fields = []) => ({
  id,
  label: `FGT.Authoring.Element.${id}`,
  hint: `FGT.Authoring.Element.${id}Hint`,
  english,
  doc: "11-effect-engine.md",
  buckets: ALL_BUCKETS,
  fields: [...fields, ...GATE],
});

export const ELEMENT_DESCRIPTORS = describeTable([
  /* ── Damage contributors ─────────────────────────────────────────────── */
  entry("DamageModifier", "A percentage change to damage, on the way out or the way in.", [
    ...SCALED,
    { key: "direction", type: "select", choices: ["dealt", "taken"] },
    { key: "modifierKey", type: "text" },
    { key: "npValue", type: "text" },
    { key: "magnitudeFactor", type: "number" },
    { key: "magnitudeRoundTo", type: "number" },
    { key: "component", type: "select", choices: ["str", "mag"] },
    { key: "roll", type: "text" },
  ]),
  entry("FlatDamage", "A flat addition to damage — Divinity, Dmg Boost, Avenger's counter bonus.", [
    ...SCALED,
    { key: "modifierKey", type: "text" },
    { key: "component", type: "select", choices: ["str", "mag"] },
  ]),
  entry("Resistance", "Magic Resistance. The rank mode can negate outright; the dice mode never can.", [
    ...SCALED,
    { key: "mode", type: "select", choices: ["rank", "dice"] },
    { key: "formula", type: "text" },
    { key: "negatesUpToRank", type: "rank" },
    { key: "npDiceDoubled", type: "checkbox" },
    { key: "includesNP", type: "checkbox" },
    { key: "component", type: "select", choices: ["str", "mag"] },
  ]),
  entry("DamageNegation", "Reduces the damage dice themselves — Battle Continuation's clause.", [
    ...SCALED,
    { key: "mode", type: "select", choices: ["dice", "flat"] },
    { key: "npValue", type: "text" },
    { key: "npDiceDoubled", type: "checkbox" },
    { key: "includesNP", type: "checkbox" },
    { key: "consumesUse", type: "checkbox" },
    { key: "uses", type: "number" },
  ]),
  entry("Ward", "A reduction that only applies against a named category of attack.", [
    ...SCALED,
    { key: "npValue", type: "text" },
    { key: "component", type: "select", choices: ["str", "mag"] },
  ]),
  entry("VulnerabilityAmplifier", "Multiplies the damage one named effect deals to this Unit.", [
    { key: "effectId", type: "effectId" },
    { key: "polarity", type: "select", choices: ["buff", "debuff"] },
    { key: "factor", type: "number" },
  ]),
  entry("PeriodicOverride", "Changes when a periodic effect ticks — extra triggers, not extra damage.", [
    { key: "effectId", type: "effectId" },
    { key: "triggers", type: "tokenList" },
  ]),
  entry("CritModifier", "Crit chance, or crit damage. Crit damage acts on the roll only.", [
    ...SCALED,
    { key: "modifierKey", type: "text" },
    { key: "aspect", type: "select", choices: ["chance", "damage"] },
  ]),
  entry("BlockModifier", "Percentage points onto the flat 25% a Block removes.", [...SCALED]),

  /* ── Stats and shape ─────────────────────────────────────────────────── */
  entry("StatDelta", "Adds to or multiplies a stat, with an optional floor.", [
    ...SCALED,
    { key: "stat", type: "text" },
    { key: "add", type: "number" },
    { key: "factor", type: "number" },
    { key: "floor", type: "number" },
    { key: "alsoCurrent", type: "checkbox" },
    { key: "duration", type: "tickExpr" },
    { key: "isBuff", type: "checkbox" },
  ]),
  entry("MaxDelta", "Changes a pool's MAXIMUM — Health, Sustainability — not its current value.", [
    ...SCALED,
    { key: "stat", type: "text" },
    { key: "alsoCurrent", type: "checkbox" },
  ]),
  entry("MovDelta", "Changes MOV. Slow halves it; a floor stops it reaching zero.", [
    ...SCALED,
    { key: "factor", type: "number" },
    { key: "floor", type: "number" },
    { key: "duration", type: "tickExpr" },
    { key: "isBuff", type: "checkbox" },
  ]),
  entry("RangeDelta", "Changes how far the Unit can reach.", [...SCALED]),
  entry("SizeStep", "Changes how many panels the Unit stands on, as a footprint delta.", [
    ...SCALED,
  ]),
  entry("ZonBonus", "Widens this Servant's Master's ZON. `stacks` decides whether two sources add.", [
    ...SCALED,
    { key: "fromStat", type: "text" },
    { key: "stacks", type: "checkbox" },
  ]),
  entry("RankShift", "Moves a rank up or down — a parameter, an ability's rank, or a whole grade.", [
    { key: "ability", type: "text" },
    { key: "parameter", type: "text" },
    { key: "steps", type: "number" },
    { key: "grades", type: "number" },
    { key: "to", type: "rank" },
    { key: "target", type: "text" },
  ]),

  /* ── Checks and dice ─────────────────────────────────────────────────── */
  entry("CheckModifier", "Makes a named check easier or harder.", [
    ...SCALED,
    { key: "check", type: "text" },
    { key: "direction", type: "select", choices: ["easier", "harder"] },
  ]),
  entry("AutoSucceed", "A named check succeeds without rolling, optionally only sometimes.", [
    { key: "check", type: "text" },
    { key: "beatenBy", type: "text" },
    { key: "uses", type: "number" },
    { key: "chance", type: "number" },
    { key: "chanceWhen", type: "predicateList" },
  ]),
  entry("TableOverride", "Rolls a different table for a check, or forces one outright.", [
    { key: "table", type: "text" },
    { key: "check", type: "text" },
    { key: "forceTable", type: "text" },
    { key: "direction", type: "select", choices: ["best", "worst"] },
    { key: "chance", type: "number" },
  ]),
  entry("RollAdjustment", "Caps or shifts the result of a roll.", [
    ...SCALED,
    { key: "check", type: "text" },
    { key: "scope", type: "text" },
  ]),
  entry("BlockLuckChecks", "Removes the Luck Check option entirely — not a penalty, a removal.", []),
  entry("AttackerPropertyTier", "A bonus keyed on a property of whoever is attacking.", [
    { key: "table", type: "text" },
    { key: "property", type: "text" },
  ]),

  /* ── Order, targeting and reactions ──────────────────────────────────── */
  entry("AttackFirst", "Attack before the Unit that just declared an attack on you.", [
    { key: "withinOwnRange", type: "checkbox" },
    { key: "requiresLuckCheckIn", type: "text" },
  ]),
  entry("TargetingModifier", "Changes what this Unit may legally target.", [
    { key: "spec", type: "raw" },
  ]),
  entry("TargetabilityModifier", "Changes who may legally target the Units around this one.", [
    { key: "radius", type: "number" },
    { key: "relations", type: "tokenList" },
    { key: "recipientRoles", type: "tokenList" },
  ]),
  entry("ForceTarget", "Forces an attack onto a particular Unit.", [
    { key: "target", type: "text" },
  ]),
  entry("Decoy", "Pulls attacks meant for others onto this Unit, within a radius.", [
    { key: "radius", type: "number" },
  ]),
  entry("ForbidReaction", "Takes rungs of the reaction ladder away — Evade, Block, Counter.", [
    { key: "reactions", type: "tokenList" },
    { key: "reaction", type: "text" },
  ]),
  entry("AutoCounter", "Counters automatically when a named event happens.", [
    { key: "on", type: "text" },
    { key: "ability", type: "text" },
    { key: "source", type: "text" },
  ]),
  entry("WeakPoint", "Declares a weak point on this Unit — where it can be hit harder.", [
    { key: "spec", type: "raw" },
  ]),
  entry("Knockback", "Forces a Unit out of the way when this one moves into it.", [
    // Achilles pushes along his TRAVEL; Kingprotea's cascade goes outward from
    // a centre. Same element, one field apart.
    { key: "direction", type: "select", choices: ["travel", "outward"] },
    // "...that Unit is forcefully Moved to one of the panels to its sides, and
    // receives damage equivalent to a Normal Attack." Running out of room is a
    // different OUTCOME, not a failure.
    { key: "sidestep", type: "raw" },
  ]),

  /* ── Effects, immunity and application ───────────────────────────────── */
  entry("ApplicationChance", "Shifts how likely an effect is to LAND, not what it does once it has.", [
    ...SCALED,
    { key: "direction", type: "select", choices: ["inflicting", "receiving"] },
    { key: "polarity", type: "select", choices: ["buff", "debuff"] },
    { key: "valence", type: "text" },
    { key: "volatility", type: "text" },
    { key: "effect", type: "effectId" },
    { key: "severity", type: "text" },
    { key: "attackPredicate", type: "predicateList" },
  ]),
  entry("Immunity", "Cannot be affected by the named effects at all.", [
    { key: "effects", type: "tokenList" },
    { key: "effect", type: "effectId" },
  ]),
  entry("ImmunityDowngrade", "Turns an immunity into a resistance, or one effect into a milder one.", [
    { key: "effectId", type: "effectId" },
    { key: "to", type: "effectId" },
    { key: "resistPercent", type: "number" },
  ]),
  entry("BuffRemovalResist", "Resists having buffs stripped off.", [...SCALED]),
  entry("DurationExtension", "Lengthens or shortens the effects applied to or by this Unit.", [
    { key: "amount", type: "tickExpr" },
    { key: "value", type: "text" },
    { key: "appliesTo", type: "select", choices: ["buff", "debuff", "all"] },
    { key: "direction", type: "select", choices: ["applied", "received"] },
  ]),
  entry("SuppressForeignEffects", "Negates effects caused by Units outside this fight — negated, not removed.", []),
  entry("Suppress", "Switches off a named scope of effect while this applies.", [
    { key: "scope", type: "text" },
  ]),
  entry("EffectVisibility", "Decides who can see an effect this Unit carries.", [
    { key: "visibility", type: "select", choices: ["all", "owner", "gm"] },
    { key: "deferredUntil", type: "text" },
  ]),

  /* ── Events, grants and identity ─────────────────────────────────────── */
  entry("OnEvent", "Runs something when a named event happens — the general-purpose trigger.", [
    { key: "event", type: "text" },
    { key: "automatic", type: "checkbox" },
    { key: "ofCategory", type: "text" },
    { key: "targetPredicate", type: "predicateList" },
    { key: "then", type: "raw" },
  ]),
  entry("Aura", "A radius around this Unit that changes the Units inside it.", [
    ...SCALED,
    { key: "radius", type: "number" },
    { key: "relations", type: "tokenList" },
    { key: "modifierKey", type: "text" },
    { key: "component", type: "select", choices: ["str", "mag"] },
    { key: "stacking", type: "text" },
    { key: "elements", type: "tokenList" },
    { key: "group", type: "text" },
    { key: "rank", type: "rank" },
    { key: "scope", type: "text" },
    { key: "requiresRecipient", type: "predicateList" },
  ]),
  entry("Compulsion", "Forces a Unit to act against a particular target — Berserk, Decoy's pull.", [
    { key: "id", type: "text" },
    { key: "within", type: "number" },
    { key: "relations", type: "tokenList" },
    { key: "targetPredicate", type: "predicateList" },
    { key: "forcesTarget", type: "checkbox" },
    { key: "forcesSkill", type: "text" },
  ]),
  entry("GrantedAbility", "Hands the bearer an ability it does not otherwise have.", [
    { key: "abilities", type: "tokenList" },
    { key: "ability", type: "text" },
  ]),
  entry("OfferAbilityUse", "Offers an ability at a named event, rather than granting it outright.", [
    { key: "event", type: "text" },
    { key: "ability", type: "text" },
  ]),
  entry("ReplaceAbility", "Swaps one ability for another while this applies.", [
    { key: "from", type: "text" },
    { key: "to", type: "text" },
  ]),
  entry("OptionalCost", "Offers a spend at a timing window — the Unit may pay, it is never charged.", [
    { key: "timing", type: "text" },
    { key: "cost", type: "raw" },
    { key: "effects", type: "raw" },
    { key: "label", type: "text" },
  ]),
  entry("RevivalSource", "A way back from zero Health, with a stated order when a Unit has several.", [
    { key: "id", type: "text" },
    { key: "revivalPriority", type: "number" },
    { key: "charges", type: "number" },
    { key: "cascading", type: "checkbox" },
    { key: "consumesOnUse", type: "checkbox" },
    { key: "requiresHealthRestoredSince", type: "checkbox" },
    { key: "optional", type: "checkbox" },
    { key: "ignoresOverkill", type: "checkbox" },
    { key: "requires", type: "raw" },
    { key: "enterMode", type: "text" },
    { key: "then", type: "raw" },
  ]),
  entry("SustainabilityGain", "Gains Sustainability when a named event happens.", [
    ...SCALED,
    { key: "event", type: "text" },
  ]),
  entry("VariantOverride", "Grants the Unit its own alternate summon-variant shape.", [
    { key: "branch", type: "text" },
  ]),
  entry("Disguise", "Makes this Unit read as something it is not.", []),
  entry("RevealPosition", "Shows where Units carrying a named effect are, through Fog of War.", [
    { key: "effect", type: "effectId" },
  ]),
  entry("DetectOverride", "A ceiling on how far this Unit can Discover a concealed one.", [
    { key: "maximum", type: "number" },
  ]),
  entry("RelationshipProxy", "Treats this Unit as somebody else for relationship questions.", [
    { key: "proxy", type: "text" },
  ]),
  entry("Script", "A named entry in a closed registry. Never `eval` — compendia are shared.", [
    { key: "script", type: "text" },
    { key: "event", type: "text" },
    { key: "restore", type: "text" },
    { key: "formula", type: "text" },
    { key: "table", type: "text" },
    { key: "percentOfMax", type: "number" },
    { key: "cooldown", type: "tickExpr" },
    { key: "cooldownTable", type: "text" },
  ]),
]);

/** @type {readonly string[]} */
export const ELEMENT_IDS = Object.freeze(Object.keys(ELEMENT_DESCRIPTORS));

/**
 * The elements one bucket accepts.
 *
 * Every element, today — see the note at the top of this file. The function
 * exists so that the day a real restriction is found there is one place to put
 * it, rather than a filter written inline at the picker.
 *
 * @param {string} bucket
 * @returns {object[]}
 */
export function elementsForBucket(bucket) {
  return ELEMENT_IDS
    .map((id) => ELEMENT_DESCRIPTORS[id])
    .filter((e) => e.buckets.includes(bucket));
}
