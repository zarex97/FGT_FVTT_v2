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
  "masterHealthAbove", "targetHasEffect", "predicate",
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
  const { unit, master, target, board, round } = ctx;

  switch (req.kind) {
    case "inZon":
      return !unit?.outsideZon;

    case "roundAtLeast":
      return (round ?? 1) >= (req.round ?? 1);

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

    case "resourceAtLeast":
      return (unit?.[req.key]?.value ?? unit?.[req.key] ?? 0) >= (req.amount ?? 0);

    case "healthBelow": {
      // God's Holder: Possession, at under 30%.
      const max = unit?.health?.max ?? 0;
      if (max <= 0) return false;
      return (unit?.health?.value ?? 0) < max * (req.fraction ?? 1);
    }

    case "masterHealthAbove":
      return (master?.health?.value ?? 0) > (req.amount ?? 0);

    case "counterpartAdjacent": {
      // The Dioscuri's Noble Phantasm needs the other twin beside it.
      const partners = unit?.zonPartnerIds ?? [];
      return (board?.units ?? []).some(
        (u) => partners.includes(u.id) && chebyshev(u.panel ?? {}, unit.panel ?? {}) <= 1,
      );
    }

    case "targetHasEffect":
      return (target?.effects ?? []).includes(req.effectId);

    case "predicate":
      // The escape hatch. Without an evaluator it refuses rather than passing:
      // a gate nobody can answer is not an open gate.
      return typeof ctx.testPredicate === "function"
        ? Boolean(ctx.testPredicate(req.predicate))
        : false;

    default:
      // Unknown kinds refuse, which is the safe direction — and the reason
      // `REQUIREMENT_KINDS` is exported for content to be held against.
      return false;
  }
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
