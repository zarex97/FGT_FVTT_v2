/**
 * @file Items, and the requirement kinds §15.4 lists.
 * @see docs/15-abilities.md §15.4, §15.8
 *
 * Layer 2 (rules). Pure.
 *
 * The item system is deliberately thin — *"items are an ability with a
 * quantity"* — and the default is that they **cannot** be passed: *"Items
 * cannot be traded/given/passed to other Units unless stated."* Only
 * `[Semiramis' Poison]` says otherwise in the reference set, so `transferable`
 * defaults to false and a permissive default would have been wrong for
 * everything except the one exception.
 */

import { chebyshev } from "../domain/geometry.mjs";
import { currentHealth, maxHealth } from "../domain/health.mjs";
import { withinPlatformCentre } from "./platforms.mjs";

/**
 * May this item move from one unit to another?
 *
 * Four gates, in the order a player meets them: does the item allow it at all,
 * is there any left, is the recipient close enough, and has this unit already
 * passed its allowance this turn.
 *
 * @param {object} item
 * @param {object} from
 * @param {object} to
 * @param {object} [ctx]
 * @param {number} [ctx.transfersThisTurn]
 * @returns {{ok: boolean, reason?: string}}
 */
export function canTransferItem(item, from, to, ctx = {}) {
  if (!item?.transferable) return { ok: false, reason: "notTransferable" };
  if ((item.quantity ?? 0) <= 0) return { ok: false, reason: "noneLeft" };

  const range = item.transferRange ?? 1;
  if (!from?.panel || !to?.panel) return { ok: false, reason: "unpositioned" };
  if (chebyshev(from.panel, to.panel) > range) return { ok: false, reason: "outOfRange" };

  const limit = item.transfersPerTurn ?? Infinity;
  if ((ctx.transfersThisTurn ?? 0) >= limit) return { ok: false, reason: "alreadyPassedThisTurn" };

  return { ok: true };
}

/**
 * Move one of an item between units.
 *
 * Quantity moves as data rather than as two independent writes, so a transfer
 * cannot duplicate or lose one if half of it fails.
 *
 * @param {object} item
 * @param {object} from
 * @param {object} to
 * @param {number} [count]
 * @returns {object[]} descriptors
 */
export function transferItem(item, from, to, count = 1) {
  return [
    { kind: "itemQuantity", unitId: from.id, itemId: item.id, delta: -count },
    { kind: "itemGrant", unitId: to.id, itemId: item.id, contentId: item.contentId ?? item.id, delta: count },
    { kind: "log", event: "itemTransferred", itemId: item.id, from: from.id, to: to.id, count },
  ];
}

/**
 * Consuming an item.
 *
 * The quantity drops **before** the effect runs, so an item whose effect kills
 * its bearer is still spent — the alternative loses the item's cost when the
 * consumer dies to its own consumption.
 *
 * @param {object} item
 * @param {object} unit
 * @returns {object[]} descriptors
 */
export function consumeItem(item, unit) {
  if ((item?.quantity ?? 0) <= 0) return [];

  return [
    { kind: "itemQuantity", unitId: unit.id, itemId: item.id, delta: -1 },
    ...(item.consumeEffect ?? []).map((phase) => ({ ...phase, unitId: unit.id, source: item.id })),
    { kind: "log", event: "itemConsumed", itemId: item.id, unitId: unit.id },
  ];
}

/* -------------------------------------------------------------------------- */
/*  §15.4 — the remaining requirement kinds                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every requirement kind `meetsRequirement` understands.
 *
 * Exported so a test can hold the shipped content against it — the same guard
 * that caught two unimplemented Command Spell requirements, for the same
 * reason: an unrecognised kind refuses, which makes the ability compile, load
 * and never work.
 */
export const REQUIREMENT_KINDS = Object.freeze([
  "inZon", "roundAtLeast", "inZone", "notInZone", "hasSkill",
  "resourceAtLeast", "healthBelow", "modeActive", "counterpartAdjacent",
  "masterHealthAbove", "targetHasEffect", "notHasEffect", "abilityOffCooldown",
  "modeInactive", "predicate", "healthAbove", "healthRestoredSince", "itemAtLeast",
  "noAliveSummon", "withinPlatformCentre", "roundPhase",
]);

/**
 * Is one requirement met?
 *
 * @param {object} req
 * @param {object} ctx
 * @param {object} ctx.unit
 * @param {object} [ctx.master]
 * @param {object} [ctx.target]
 * @param {object} [ctx.board]
 * @param {number} [ctx.round]
 * @param {(p: unknown) => boolean} [ctx.testPredicate]
 * @returns {boolean}
 */
export function meetsRequirement(req, ctx) {
  // Scoped to ONE of an ability's several behaviours -- Summoning: Bašmu's
  // own `noAliveSummon` only makes sense for its summon branch, and must not
  // block the unrelated damage-spell branch just because a Bašmu happens to
  // be alive. Vacuously satisfied when the gate does not apply, mirroring a
  // phase's own `predicate:` (`engine/skill-use.mjs#runPhases`) and
  // `cooldown.branches`/`targeting.branches`'s (`engine/cooldown.mjs`,
  // `rules/ability-use.mjs#targetSpecFor`) first-match-wins shape -- this is
  // the same "which behaviour is actually firing" question asked a fourth
  // way, on the one thing among them that gates rather than selects.
  //
  // NOT for `kind: "predicate"` itself -- there, `req.predicate` IS the whole
  // requirement, tested once below; reading it here too would make every
  // `predicate` requirement whose condition is false vacuously PASS instead
  // of refusing, which is the opposite of what it authors.
  if (req.kind !== "predicate" && req.predicate
    && typeof ctx.testPredicate === "function" && !ctx.testPredicate(req.predicate)) {
    return true;
  }

  const { unit, master, target, board, round } = ctx;

  switch (req.kind) {
    case "inZon":
      return !unit?.outsideZon;

    case "roundAtLeast":
      return (round ?? 1) >= (req.round ?? 1);

    // "If the Round is a Night Round (automatically fulfilled if playing
    // without Day-Night cycle)." Jack's Maria the Ripper is the first ability
    // gated on the phase rather than merely modified by it -- `board.phase` is
    // a pure function of the round number and the opening coin flip
    // (`rules/environment.mjs#phase`), computed onto the board projection
    // since it was written, with nothing until now asking.
    //
    // The parenthesis is honoured by `board.dayNightCycle === false`: with the
    // cycle switched off there is no Night to wait for, so the condition is
    // satisfied rather than permanently unsatisfiable.
    case "roundPhase":
      if (board?.dayNightCycle === false) return true;
      return (board?.phase ?? "day") === (req.is ?? "night");

    case "inZone":
      return (unit?.zones ?? []).includes(req.zoneId);

    case "notInZone":
      return !(unit?.zones ?? []).includes(req.zoneId);

    case "hasSkill":
      // Bašmu requires Double Summon: Caster. Matched on slug, because a
      // display name can be renamed and a slug cannot.
      return (unit?.abilities ?? []).some((a) => a.slug === req.abilityId || a.id === req.abilityId);

    case "modeActive":
      // Holder Mode. "Has the mode" and "has it switched on" are different
      // questions and this is the second.
      return (unit?.abilities ?? []).some(
        (a) => (a.slug === req.mode || a.id === req.mode) && a.active,
      );

    case "modeInactive":
      // The mirror, and not the same as "does not have it". Penthesilea's
      // Charisma *"cannot be used when Mad Enhancement is activated"* -- and
      // she always has Mad Enhancement, so a `hasSkill` test would refuse it
      // for ever and its absence refused it never.
      return !(unit?.abilities ?? []).some(
        (a) => (a.slug === req.mode || a.id === req.mode) && a.active,
      );

    case "resourceAtLeast":
      // §6.10's pools live under `resources`; Agility and Luck are top-level
      // stats with the same `{value, max}` shape. This looked only at the top
      // level, so a gate on a real Resource pool -- the mechanism §6.10 exists
      // for -- was always reading `undefined` and refusing. EMIYA's Unlimited
      // Blade Works is the first content to gate on one, and it could never be
      // used however much Aria he held.
      return resourceHeld(unit, req.key) >= (req.amount ?? 0);

    case "healthBelow": {
      // God's Holder: Possession, at under 30%.
      const max = maxHealth(unit);
      if (max <= 0) return false;
      return currentHealth(unit) < max * (req.fraction ?? 1);
    }

    case "healthAbove": {
      // The mirror of `healthBelow`, and not the same as "not below": EMIYA's
      // Eye of the Mind (True) exists at two Ranks and exactly one of them is
      // offered at a time, so both halves have to be a gate rather than one
      // being the absence of the other.
      const max = maxHealth(unit);
      if (max <= 0) return false;
      return currentHealth(unit) >= max * (req.fraction ?? 0);
    }

    case "healthRestoredSince": {
      // "Health must have been restored back to above half its maximum value
      // at least once SINCE THE LAST USAGE." A question about history, not
      // about the current bar: a Servant who never dropped would satisfy
      // `healthAbove` and has not recovered from anything.
      //
      // EMIYA's Rho Aias states it, and so does Battle Continuation's revival
      // -- whose gate has always been the cooldown alone, so the second half of
      // that clause has never been enforced either.
      const last = ctx.ability?.lastUsedTick ?? null;
      // Never used: vacuously satisfied. The clause is "since the last usage",
      // and there has not been one.
      if (last === null) return true;
      const at = unit?.healthWatermarks?.[String(req.fraction ?? 0.5)] ?? null;
      return at !== null && at >= last;
    }

    case "masterHealthAbove":
      return currentHealth(master) > (req.amount ?? 0);

    case "counterpartAdjacent": {
      // The Dioscuri's Noble Phantasm needs the other twin beside it.
      const partners = unit?.zonPartnerIds ?? [];
      return (board?.units ?? []).some(
        (u) => partners.includes(u.id) && chebyshev(u.panel ?? {}, unit.panel ?? {}) <= 1,
      );
    }

    case "targetHasEffect":
      return (target?.effects ?? []).includes(req.effectId);

    case "notHasEffect":
      // The USER's own state, not the target's. Medea's High-Speed Divine
      // Words "cannot be used while inflicted with Silence" -- authored since
      // she was written, and refused every time it was pressed because the
      // vocabulary had no such kind and an unknown kind refuses.
      return !(unit?.effects ?? []).includes(req.effectId);

    case "abilityOffCooldown": {
      // A gate on OTHER abilities. Scathach's sheet groups them three
      // different ways and all three appear in one Servant: Gate of Skye names
      // three abilities outright, her Primordial Rune Spells gate on their
      // shared `category`, and the three Wisdom of Dun Scaith slots gate on the
      // `exclusionSet` every copy from one grant shares.
      const matched = gatedAbilities(unit, req, ctx.ability);
      // Vacuously true when nothing matched. A Scathach who has not yet copied
      // anything has no Wisdom slots to be blocked BY, and a gate that refused
      // on an empty set would make Clairvoyance unusable until she copied.
      return matched.every((a) => (a.cooldownRemaining ?? 0) <= 0);
    }

    case "itemAtLeast":
      // "Requires 3 [Semiramis' Poison] to use" -- a gate on the CASTER's own
      // held quantity, keyed by the stable content id the same way
      // `platformContentId` is (a Foundry item id is random per world and
      // content cannot name one).
      return ((unit?.items ?? []).find((i) => i.contentId === req.contentId)?.quantity ?? 0) >= (req.amount ?? 1);

    case "predicate":
      // The escape hatch. Without an evaluator it refuses rather than passing:
      // a gate nobody can answer is not an open gate.
      return typeof ctx.testPredicate === "function"
        ? Boolean(ctx.testPredicate(req.predicate))
        : false;

    case "noAliveSummon":
      // "Only one Bašmu summoned by this Spell can exist on the field."
      // Keyed on `summonerId` (not just `contentId`) because a summon whose
      // `summonerId` names someone else is a different Servant's copy of the
      // same creature, which this clause has nothing to say about.
      return !(board?.units ?? []).some(
        (u) => u.contentId === req.contentId && u.summonerId === unit?.id && !u.defeated,
      );

    case "withinPlatformCentre": {
      // Sikera Ušum clause 2: "Can only be used within the 'Throne Room' of
      // 'Hanging Gardens of Babylon'" -- the middle 5x5 (radius 2) of
      // whichever platform the caster is currently aboard.
      const platform = (board?.units ?? []).find((u) => u.id === unit?.platformId);
      return platform ? withinPlatformCentre(unit, platform, req.radius ?? 2) : false;
    }

    default:
      // Unknown kinds refuse, which is the safe direction — and the reason
      // `REQUIREMENT_KINDS` is exported for content to be held against.
      return false;
  }
}

/**
 * How much of a named pool a unit holds, wherever that pool lives.
 *
 * @param {object} unit
 * @param {string} key
 * @returns {number}
 */
function resourceHeld(unit, key) {
  const pool = unit?.resources?.[key];
  if (pool !== undefined) return pool?.value ?? pool ?? 0;
  return unit?.[key]?.value ?? unit?.[key] ?? 0;
}

/**
 * The abilities an `abilityOffCooldown` requirement is asking about.
 *
 * `excludeSelf` is what makes the Primordial Rune Spells work: *"when one of
 * Scathach's Primordial Rune Spells are used, **the other two** cannot be used
 * until Cooldown has ended for the used Spell."* Without it a Spell would gate
 * on its own cooldown, which `canUseAbility` already checks -- and would
 * therefore never say anything the first gate had not already said.
 *
 * @param {object} unit
 * @param {object} req
 * @param {object|null} self the ability declaring the requirement
 * @returns {object[]}
 */
function gatedAbilities(unit, req, self = null) {
  const named = new Set(req.abilityIds ?? []);
  const selfIds = new Set([self?.id, self?.contentId].filter(Boolean));

  return (unit?.abilities ?? []).filter((a) => {
    if (req.excludeSelf && (selfIds.has(a.id) || selfIds.has(a.contentId))) return false;
    if (named.size > 0) return named.has(a.contentId) || named.has(a.id);
    if (req.category) return a.category === req.category;
    if (req.exclusionSet) return a.exclusionSet === req.exclusionSet;
    return false;
  });
}

/**
 * The first requirement this ability fails, if any.
 *
 * Reports **one**, by kind, so a refusal names a single thing to fix.
 *
 * @param {object[]} requirements
 * @param {object} ctx
 * @returns {{ok: boolean, reason?: string}}
 */
export function meetsRequirements(requirements, ctx) {
  for (const req of requirements ?? []) {
    if (!meetsRequirement(req, ctx)) return { ok: false, reason: req.kind };
  }
  return { ok: true };
}
