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
  actor: Object.freeze([
    "agility", "luck", "resources", "stance",
    // Written by the engine during play, and found by the first dry run of the
    // content sync against a real world -- every one of these would have been
    // reset on the next load. `summonerId` is written by `summoning.mjs` and
    // nulling it orphans every summon on the board; `ownerId` is the same for
    // `hgob.mjs`'s Hanging Gardens. `identityRevealed` is §4.2's whole point --
    // Medusa had been revealed and would have been re-concealed. And
    // `classContainer` is the slot war setup PLACED a Servant in, which is not
    // the class her sheet names: Medusa sat in `saber` and the pack says
    // `rider`.
    "summonerId", "ownerId", "identityRevealed", "classContainer",
  ]),
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
 * The halves of `summonVariant` a match owns.
 *
 * The same shape as `cooldown`. `heads` and `tails` are the two forms the
 * content declares; `variant` is which one the coin actually came up as, and a
 * content update re-flipping a summon already on the board is not an update.
 */
export const SUMMON_VARIANT_OWNED_BY_WORLD = Object.freeze(["variant"]);

/**
 * Authored keys a given actor **type** only seeds, on top of `SEEDED_THEN_OWNED`.
 *
 * A Master's stats are not authored at all: `war-setup.mjs` rolls them through
 * `rollSetupPlan` and writes them onto a blank pack template whose `rank` is
 * `""` and whose `zon` is `2`. Syncing those back would throw away a war's
 * setup rolls. A Servant's `rank` and `baseAttack` come from her sheet and must
 * still follow the pack, which is why this is keyed by type rather than added
 * to the list above.
 */
export const SEEDED_BY_TYPE = Object.freeze({
  master: Object.freeze(["rank", "zon", "baseAttack", "commandSpells"]),
});

/**
 * Is this field the world's to keep?
 *
 * True for anything outside the authored list -- Health, `turnState`,
 * contracts, positions -- and for the authored keys the pack only seeds.
 *
 * @param {"actor"|"item"} kind
 * @param {string} key
 * @param {string|null} [type] the document's type, for `SEEDED_BY_TYPE`
 * @returns {boolean}
 */
export function ownedByWorld(kind, key, type = null) {
  const authored = kind === "actor" ? AUTHORED_ACTOR_KEYS : AUTHORED_ITEM_KEYS;
  if (!authored.includes(key)) return true;
  if ((SEEDED_THEN_OWNED[kind] ?? []).includes(key)) return true;
  return (SEEDED_BY_TYPE[type] ?? []).includes(key);
}
