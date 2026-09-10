/**
 * @file Which fields belong to the pack, and which belong to the world.
 * @see docs/39-migration-and-versioning.md, docs/37-content-pipeline.md
 *
 * Layer 1 (content). Pure data.
 *
 * The content pipeline's `actorSystem()`/`itemSystem()` decide what a YAML
 * document may state, and silently drop anything they do not name -- the
 * mechanism that has already cost this project `npGateRound`, `onEnd` and
 * `countsTowardBudget`. The content sync needs exactly the same answer, so the
 * vocabulary lives here and both read it. `test/unit/authored-fields.test.mjs`
 * holds the two together in both directions.
 */

/** Actor fields a pack document may state. */
export const AUTHORED_ACTOR_KEYS = Object.freeze([
  "npChoice", "rank", "commandSpells", "zon", "footprint", "upkeep",
  "countsTowardBudget", "actsOncePerTurn", "boundToPlatformId",
  "movesOntoOccupiedPanels", "sharesPanel", "replacesRiderAction",
  "countsAsHomeBase", "deactivation", "undamageable", "cannotHoldItems",
  "itemHandling", "destroyableBy", "visibleWithin", "agility", "luck",
  "inherit", "rules", "passiveRules", "activeRules", "summonerId", "capacity",
  "ownerId", "level", "crossLevel", "contentId", "trueName", "servantClasses",
  "classContainer", "concealedIdentity", "identityRevealed", "detect",
  "defaultImage", "alignment", "region", "attributes", "parameters",
  "baseHealth", "mov", "range", "baseAttack", "normalAttack", "sustainability",
  "summonVariant", "stanceSpec", "stance", "resources", "notes",
]);

/** Item fields a pack document may state. */
export const AUTHORED_ITEM_KEYS = Object.freeze([
  "contentId", "description", "source", "rank", "slug", "isNP", "isMode",
  "isAttackSkill", "replacesNormalAttack", "isSpell", "isPassive", "active",
  "cannotDeactivate", "toggleLock", "categorizedAsNP", "categorizedAs",
  "weakPoint", "ridingAttack", "expendsPermanently", "categorizedWhile",
  "npTags", "cooldown", "cooldownWaiver", "targeting", "field", "quantity",
  "transferable", "transferRange", "transfersPerTurn", "consumeEffect",
  "phases", "copyable", "copiedFrom", "opensDialog", "additionalCosts",
  "npGateRound", "itemCost", "category", "kind", "passive", "countsAsAttack",
  "countsAsAct", "oncePerTurn", "oncePerRound", "alsoTriggers",
  "exclusionSet", "grantedBy", "sameTurnExclusive", "sameRoundExclusive",
  "timesUsed", "maxUses", "lastUsedTick", "recordedAttacks",
  "recordsAttacks", "shield", "shieldHealth", "negatedBy", "negatedWhile",
  "cancelsNP", "allySelfBypassesResistance", "nonStacking", "damage",
  "aftermath", "element", "rules", "passiveRules", "activeRules", "cost",
  "costByMasterRank", "requirements", "timing", "blockedWhen", "effect",
  "permanentConsequence", "overridesValidation", "parameterized", "polarity",
  "severity", "preventsAction", "terminal", "onRemove", "volatility",
  "families", "suppressesOtherEffects", "valence", "stacking", "baseChance",
  "defaultMagnitude", "uses", "maxStacks", "absorbs", "defaultDuration",
  "unremovable", "blocks", "blockedBy", "replaces"
]);

/**
 * Authored keys the pack only **seeds**, and which play then owns.
 *
 * Three of the item entries -- `timesUsed`, `lastUsedTick`, `recordedAttacks` --
 * are in the allowlist and authored by NO content at all; they are runtime the
 * list happens to name. The rest carry a starting value that a match then
 * changes: Resources are spent, a mode is toggled, an Item's quantity is used
 * up, a stance is taken.
 *
 * `copiedFrom` and `grantedBy` are provenance. An ability copied by Wisdom of
 * Dún Scáith records where it came from, and a content update has no business
 * rewriting that.
 *
 * Overwriting any of these on a sync would reset a live match -- the corruption
 * Ch. 39 opens by promising to prevent.
 */
export const SEEDED_THEN_OWNED = Object.freeze({
  actor: Object.freeze(["agility", "luck", "resources", "stance"]),
  item: Object.freeze([
    "active", "timesUsed", "lastUsedTick", "recordedAttacks", "quantity",
    "copiedFrom", "grantedBy",
  ]),
});

/**
 * The halves of `cooldown` a match owns.
 *
 * The one key that is half the pack's and half the world's: `max`, `perUnit`,
 * `countFrom` and `branches` are authored; the clock is what the match has
 * spent. Refilling a cooldown mid-match is not a content update.
 */
export const COOLDOWN_OWNED_BY_WORLD = Object.freeze([
  "remaining", "regen", "gatedDelay",
]);

/**
 * Is this field the world's to keep?
 *
 * True for anything outside the authored list -- Health, `turnState`,
 * contracts, positions -- and for the authored keys the pack only seeds.
 *
 * @param {"actor"|"item"} kind
 * @param {string} key
 * @returns {boolean}
 */
export function ownedByWorld(kind, key) {
  const authored = kind === "actor" ? AUTHORED_ACTOR_KEYS : AUTHORED_ITEM_KEYS;
  if (!authored.includes(key)) return true;
  return (SEEDED_THEN_OWNED[kind] ?? []).includes(key);
}
