/**
 * @file Which fields belong to the pack, and which belong to the world.
 * @see docs/41-migration.md, docs/40-content-pipeline.md
 *
 * Layer 1 (content). Pure data.
 *
 * The content pipeline used to decide what a YAML document may state with two
 * allowlists, `actorSystem()`/`itemSystem()`, that silently dropped anything
 * they did not name -- the mechanism that cost this project `npGateRound`,
 * `onEnd`, `countsTowardBudget` and, measured when they went, Serenity's two
 * concealment escapes. The compile now passes authored keys through
 * and the DataModel decides (Ch. 40). The content sync still needs to know
 * which keys the PACK owns, so the vocabulary lives here, and
 * `test/unit/authored-fields.test.mjs` holds it to what the corpus actually
 * compiles and to what the DataModels actually declare.
 */

/** Actor fields a pack document may state. */
export const AUTHORED_ACTOR_KEYS = Object.freeze([
  "npChoice", "rank", "commandSpells", "zon", "footprint", "upkeep",
  "countsTowardBudget", "actsOncePerTurn", "boundToPlatformId",
  "movesOntoOccupiedPanels", "sharesPanel", "replacesRiderAction",
  "countsAsHomeBase", "deactivation", "undamageable", "cannotHoldItems",
  // The Hanging Gardens' boarding relief after Dragon Wing Warriors (#68).
  "boardingReliefAfter",
  // The Hanging Gardens is destroyed when Semiramis is defeated (#68).
  "destroyedWithOwner",
  // The Golden Hind's three: a boarding roll of its own, riders it will not
  // let off, and effects on its OWNER that switch it off.
  "boarding", "lockAboard", "deactivateOn", "knockOff",
  "itemHandling", "destroyableBy", "visibleWithin", "agility", "luck",
  "inherit", "rules", "passiveRules", "activeRules", "summonerId", "capacity",
  "ownerId", "level", "crossLevel", "dimension", "contentId", "contentVersion", "trueName",
  "servantClasses",
  "classContainer", "concealedIdentity", "identityRevealed", "detect",
  "defaultImage", "alignment", "region", "attributes", "parameters",
  "baseHealth", "mov", "range", "baseAttack", "normalAttack", "sustainability",
  // The linked-group binding (Ch. 32). Settings only: `memberIds` is
  // resolved at summon and is never authored.
  "linkedGroup",
  "summonVariant", "stanceSpec", "stance", "resources", "notes",
  // A Platform's sheet text, which the allowlist never carried.
  "description",
]);

/** Item fields a pack document may state. */
export const AUTHORED_ITEM_KEYS = Object.freeze([
  "contentId", "contentVersion", "description", "source", "rank", "slug", "isNP", "isMode",
  "isAttackSkill", "alsoCountsAsAttackFor", "replacesNormalAttack", "isSpell", "isPassive", "active",
  // `deactivation` beside its two neighbours, and they answer three different
  // questions: `cannotDeactivate` says NEVER, `toggleLock` says HOW LONG YOU
  // MUST WAIT, and `deactivation` says AT WHICH MOMENTS the offer exists at
  // all. Raikou's Tenmokaikai is its first ability-level user -- "Raikou can
  // deactivate this NP during her Turn and at the start or end of any Turn or
  // Round" -- where a bounded field has carried the same shape since Ozymandias.
  "cannotDeactivate", "toggleLock", "deactivation", "categorizedAsNP", "categorizedAs",
  "weakPoint", "ridingAttack", "expendsPermanently", "categorizedWhile",
  "npTags", "cooldown", "cooldownWaiver", "targeting", "field", "quantity",
  "transferable", "transferRange", "transfersPerTurn", "consumeEffect",
  // A refusal that belongs to the ITEM, not to any holder: "[Vorpal Blade]
  // cannot be obtained by Nursery or her Master."
  "barredFrom",
  // Ch. 28 s43.11's gate. Declared in the schema, in `itemSystem()` and here in
  // the SAME commit: this is exactly the shape of field this project has
  // silently dropped six times -- present on the schema, absent from an
  // allowlist, compiled to its default -- and a `requiresHistory` that compiles
  // to `false` means the recorder never starts and the Noble Phantasm has no
  // past to read, silently.
  "requiresHistory",
  "phases", "copyable", "copiedFrom", "opensDialog", "additionalCosts",
  "npGateRound", "itemCost", "category", "kind", "passive", "countsAsAttack",
  "countsAsAct", "oncePerTurn", "oncePerRound", "alsoTriggers",
  "exclusionSet", "grantedBy", "sameTurnExclusive", "sameRoundExclusive",
  "bypassesCategoryLimit", "refusesReactionsUnlessFaster", "offersSpellCategory",
  "freeAction",
  "timesUsed", "maxUses", "lastUsedTick", "recordedAttacks",
  "recordsAttacks", "shield", "shieldHealth", "negatedBy", "negatedWhile",
  "cancelsNP", "allySelfBypassesResistance", "damage", "reactionOverride", "creates",
  "aftermath", "element", "rules", "passiveRules", "activeRules", "cost",
  "costByMasterRank", "requirements", "timing", "blockedWhen", "effect",
  "permanentConsequence", "overridesValidation", "parameterized", "polarity",
  "severity", "preventsAction", "terminal", "onRemove", "volatility",
  "families", "suppressesOtherEffects", "valence", "stacking", "baseChance",
  "defaultMagnitude", "uses", "maxStacks", "absorbs", "defaultDuration",
  "unremovable", "blocks", "blockedBy", "replaces",
  // Never compiled while the allowlist stood. Serenity's two concealment
  // escapes are declared and read. `periodic` is the only source of a damage
  // tick, read by `engine/scheduler.mjs#periodicOf` (#105).
  "periodic", "usableWhileConcealed", "concealmentBreakChance",
  // The 'Kiritsugu' debuff's two bypasses, kept by the model since #98.
  "bypassesImmunity", "bypassesResistance",
  // A current value paid once when an effect lands (#106).
  "onApply",
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
 * Ch. 41 opens by promising to prevent.
 */
export const SEEDED_THEN_OWNED = Object.freeze({
  actor: Object.freeze([
    "agility", "luck", "resources", "stance",
    // Written by the engine during play, and found by the first dry run of the
    // content sync against a real world -- every one of these would have been
    // reset on the next load. `summonerId` is written by `summoning.mjs` and
    // nulling it orphans every summon on the board; `ownerId` is the same for
    // `hgob.mjs`'s Hanging Gardens. `identityRevealed` is Ch. 06's whole point --
    // Medusa had been revealed and would have been re-concealed. And
    // `classContainer` is the slot war setup PLACED a Servant in, which is not
    // the class her sheet names: Medusa sat in `saber` and the pack says
    // `rider`.
    "summonerId", "ownerId", "identityRevealed", "classContainer",
    // `summoning.mjs` stamps Bašmu's garden at the summons. Pack-owned, every
    // pack rebuild put null back: the Bašmu on the audit board could Jump off
    // and would have outlived its garden (Ch. 46 §46.4-BN).
    "boundToPlatformId",
  ]),
  item: Object.freeze([
    "active", "timesUsed", "lastUsedTick", "recordedAttacks", "quantity",
    "copiedFrom", "grantedBy",
    // A barrier's pool, which play spends and Rho Aias's own decay shrinks.
    // Pack-owned, every reload refilled it (#109). The declared size is
    // `shield`, and that still follows the pack.
    "shieldHealth",
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
 * The half of `linkedGroup` a match owns.
 *
 * The same shape as `cooldown` and `summonVariant`, and the same reason. The
 * pack states the **settings** — the leash, the weight, whether death is linked
 * — and `partners` names the other members by CONTENT id. `memberIds` holds
 * **actor** ids, resolved by `engine/summon.mjs` at the one moment every actor
 * exists.
 *
 * Without this, a content sync overwrites the resolved ids with the pack's
 * empty set and **silently unlinks a pair already on the board**: no leash, no
 * linked death, no shared cooldown, no combined Noble Phantasm. Found on a live
 * board, after a pack rebuild, with the twins standing next to each other and
 * bound to nothing.
 */
export const LINKED_GROUP_OWNED_BY_WORLD = Object.freeze(["memberIds"]);

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
  // The Hanging Gardens' *"Base Attack (MAG): Uses Semiramis'"*: activation
  // copies her post-buff figure onto the platform (`engine/hgob.mjs`), and the
  // pack holds a placeholder. Pack-owned, a reload put 200 back over her 250
  // (#109). A pack change to a platform's Base Attack now reaches only new
  // copies.
  platform: Object.freeze(["baseAttack"]),
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
