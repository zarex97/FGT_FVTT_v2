/**
 * @file Every requirement kind, in the words a GM uses.
 * @see docs/15-abilities.md §15.4, tools/lib/content.mjs
 *
 * Layer 2 (rules). Pure data.
 *
 * **Both dispatchers refuse an unknown kind.** `meetsRequirement`'s default
 * case returns `false`, and so does the command spell's `meets`. So an
 * undescribed kind is not a gate that gets skipped — it is a gate that always
 * LOSES, and the ability or command can never be used by anybody, silently.
 * `rules/command-spells.mjs` says as much beside its own list: *"that is this
 * project's most common defect shape, and comparing the two lists is the
 * cheapest place to catch it."* Hence the drift test in both directions.
 *
 * **Two lists, deliberately.** They must never merge: `servantInZon` asks
 * about somebody else's Servant and `attackIsNotNP` about an attack that is
 * already being resolved, so an ability authoring either would be asking a
 * question with no answer.
 *
 * The command spell authority is `rules/command-spells.mjs#REQUIREMENT_KINDS`,
 * **not** `tools/lib/content.mjs#CS_REQUIREMENT_KINDS`. The latter is a
 * validation allowlist covering both requirement kinds and `blockedWhen`
 * conditions in one set — `damageWouldDefeatServant` is in it and is a
 * condition, handled by a different switch. Reading it as the requirement
 * vocabulary would offer a kind `meets` has no case for.
 */

import { describeTable } from "./contract.mjs";

/**
 * @param {string} prefix the localization namespace
 * @returns {(id: string, english: string, fields?: object[]) => object}
 */
const maker = (prefix) => (id, english, fields = []) => ({
  id,
  label: `${prefix}.${id}`,
  hint: `${prefix}.${id}Hint`,
  english,
  doc: "15-abilities.md",
  fields,
});

/** An ability requirement. */
const req = maker("FGT.Authoring.Req");

/**
 * A command spell requirement, in its **own** localization namespace.
 *
 * Not decoration: `inZone` and `notInZone` exist in both vocabularies, with
 * different fields (`zoneId` here, `zone` there) and different sentences. One
 * shared key meant one sentence silently won and the other was never seen —
 * caught by `authoring-i18n`, which is why it now checks both tables.
 */
const csReq = maker("FGT.Authoring.CsReq");

/** The 24 kinds `rules/items.mjs#meetsRequirement` answers. */
export const REQUIREMENT_DESCRIPTORS = describeTable([
  req("inZon", "Only while this Servant is inside its Master's ZON."),
  req("roundAtLeast", "Only from a given Round onwards.", [
    { key: "round", type: "number" },
  ]),
  req("roundPhase", "Only during day, or only during night.", [
    { key: "is", type: "select", choices: ["day", "night"] },
  ]),
  req("inZone", "Only while standing inside a named zone.", [
    { key: "zoneId", type: "text" },
  ]),
  req("notInZone", "Only while standing outside a named zone.", [
    { key: "zoneId", type: "text" },
  ]),
  req("hasSkill", "Only while the Unit has a named ability.", [
    { key: "abilityId", type: "text" },
  ]),
  req("modeActive", "Only while a named mode is switched on.", [
    { key: "mode", type: "text" },
  ]),
  req("modeInactive", "Only while a named mode is switched off.", [
    { key: "mode", type: "text" },
  ]),
  req("stance", "Only while mounted, or only while dismounted.", [
    { key: "stance", type: "select", choices: ["mounted", "dismounted"] },
  ]),
  req("resourceAtLeast", "Only while the Unit holds enough of a pool — tokens, counters.", [
    { key: "key", type: "text" },
    { key: "amount", type: "number" },
  ]),
  req("healthBelow", "Only while Health is below a fraction of its maximum.", [
    { key: "fraction", type: "number" },
  ]),
  req("healthAbove", "Only while Health is above a fraction of its maximum.", [
    { key: "fraction", type: "number" },
  ]),
  req("healthRestoredSince", "Only if enough Health has been restored since this last fired.", [
    { key: "fraction", type: "number" },
  ]),
  req("masterHealthAbove", "Only while the Master has more than a flat amount of Health.", [
    { key: "amount", type: "number" },
  ]),
  req("masterHealthFraction", "Only while the Master's Health is at least a fraction of its maximum.", [
    { key: "atLeast", type: "number" },
  ]),
  req("counterpartAdjacent", "Only while this Unit's counterpart is standing next to it."),
  req("targetHasEffect", "Only while the target carries a named effect.", [
    { key: "effectId", type: "effectId" },
  ]),
  req("notHasEffect", "Only while the Unit does NOT carry a named effect.", [
    { key: "effectId", type: "effectId" },
  ]),
  req("abilityOffCooldown", "Only while the named abilities — or a whole group of them — are off cooldown.", [
    { key: "abilityIds", type: "tokenList" },
    { key: "category", type: "text" },
    { key: "exclusionSet", type: "text" },
    { key: "excludeSelf", type: "checkbox" },
  ]),
  req("itemAtLeast", "Only while the Unit holds enough of a named item.", [
    { key: "contentId", type: "text" },
    { key: "amount", type: "number" },
  ]),
  req("predicate", "Only when a predicate holds — the general-purpose gate.", [
    { key: "predicate", type: "predicateList" },
  ]),
  req("fieldOpen", "Only while a named bounded field is open.", [
    { key: "field", type: "text" },
  ]),
  req("noAliveSummon", "Only while a named summon of this Unit is not already on the board.", [
    { key: "contentId", type: "text" },
    { key: "predicate", type: "predicateList" },
  ]),
  req("withinPlatformCentre", "Only while standing in the middle of the platform this Unit is aboard.", [
    { key: "radius", type: "number" },
    { key: "predicate", type: "predicateList" },
  ]),
]);

/** @type {readonly string[]} */
export const REQUIREMENT_IDS = Object.freeze(Object.keys(REQUIREMENT_DESCRIPTORS));

/** The 9 kinds `rules/command-spells.mjs#meets` answers. */
export const CS_REQUIREMENT_DESCRIPTORS = describeTable([
  csReq("servantInZon", "Only while the Servant is inside its Master's ZON."),
  csReq("attackIsNotNP", "Only when the attack being resolved is not a Noble Phantasm."),
  csReq("targetNotImmune", "Only while the Servant is not immune to what this command does.", [
    { key: "attribute", type: "text" },
  ]),
  csReq("servantWithin", "Only while the Servant is within a number of panels of its Master.", [
    { key: "panels", type: "number" },
  ]),
  csReq("servantNotWithin", "Only while the Servant is further than a number of panels from its Master.", [
    { key: "panels", type: "number" },
  ]),
  csReq("highRankMaster", "Only for a Master who pays the High Rank column."),
  // `zone`, NOT `zoneId`. The ability vocabulary spells the same question
  // `zoneId` (`rules/items.mjs`) and the command spell one spells it `zone`
  // (`rules/command-spells.mjs#inZone`). One kind name, two field names, and
  // nothing but this table to warn an author which one they are writing.
  csReq("inZone", "Only while the Master, the Servant or the pair stands in a named zone.", [
    { key: "zone", type: "text" },
    { key: "who", type: "select", choices: ["master", "servant", "pair"] },
  ]),
  csReq("notInZone", "Only while not standing in a named zone — there is nothing to escape from at home.", [
    { key: "zone", type: "text" },
    { key: "who", type: "select", choices: ["master", "servant", "pair"] },
  ]),
  csReq("noOtherRevival", "Only if the Servant would not have come back anyway."),
]);

/** @type {readonly string[]} */
export const CS_REQUIREMENT_IDS = Object.freeze(Object.keys(CS_REQUIREMENT_DESCRIPTORS));

/**
 * The requirement vocabulary one item type may author.
 *
 * Falls back to the ability list rather than to nothing: a picker that empties
 * on an unexpected type is worse than one offering the common vocabulary.
 *
 * @param {string} itemType
 * @returns {object[]}
 */
export function requirementsFor(itemType) {
  const table = itemType === "commandSpell" ? CS_REQUIREMENT_DESCRIPTORS : REQUIREMENT_DESCRIPTORS;
  return Object.keys(table).map((id) => table[id]);
}
