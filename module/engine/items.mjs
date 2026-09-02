/**
 * @file Passing and consuming items.
 * @see docs/15-abilities.md §15.8
 *
 * Layer 3. `rules/items.mjs` decides whether and produces descriptors; this
 * turns them into intents and writes.
 *
 * The once-per-turn allowance is counted on the **giver's** turn state rather
 * than on the item, because the limit is on the unit's action and an item that
 * changed hands would otherwise carry a spent allowance to its new owner.
 */

import { canTransferItem, transferItem, consumeItem } from "../rules/items.mjs";
import { currentBoard, unitFrom } from "./board.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { INFINITE } from "../domain/enums.mjs";

/**
 * Hand an item to another unit.
 *
 * @param {object} args
 * @param {string} args.fromId
 * @param {string} args.toId
 * @param {string} args.itemId the embedded item on the giver
 * @param {number} [args.count]
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function giveItem({ fromId, toId, itemId, count = 1 }) {
  const fromDoc = game.actors.get(fromId);
  const toDoc = game.actors.get(toId);
  const item = fromDoc?.items?.get(itemId);
  if (!fromDoc || !toDoc || !item) return { ok: false, reason: "notFound" };

  // *"Pale Rider cannot hold Items."* The redirect that follows it -- "all
  // Items that would be obtained by Pale Rider are instead obtained by his
  // Master if he/she is within a 2 panel area" -- presupposes an item
  // ACQUISITION flow, and there is none: nothing drops an item on a panel or
  // awards one on a kill. So the refusal is enforced and the redirect is
  // recorded as unmodelled (Ch. D §D.26), rather than half-built.
  if (toDoc.system?.cannotHoldItems) {
    return { ok: false, reason: "cannotHoldItems" };
  }

  const board = currentBoard();
  const from = unitFrom(board, fromDoc);
  const to = unitFrom(board, toDoc);

  const spec = itemSpec(item);
  const verdict = canTransferItem(spec, from, to, {
    transfersThisTurn: transfersThisTurn(fromDoc),
  });
  if (!verdict.ok) return verdict;

  const intents = toIntents(transferItem(spec, from, to, count));
  // The allowance is spent whether or not the recipient's write is ours to
  // make, so it rides in the same batch.
  intents.push(I.markTurn(fromId, { itemTransfers: transfersThisTurn(fromDoc) + 1 }));

  await applyWorldIntents(intents, `item:give:${spec.id}`);
  return { ok: true };
}

/**
 * Spend one of an item and run whatever it does.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.itemId
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function useItem({ unitId, itemId }) {
  const actor = game.actors.get(unitId);
  const item = actor?.items?.get(itemId);
  if (!actor || !item) return { ok: false, reason: "notFound" };

  const board = currentBoard();
  const unit = unitFrom(board, actor);
  const descriptors = consumeItem(itemSpec(item), unit);
  if (descriptors.length === 0) return { ok: false, reason: "noneLeft" };

  await applyWorldIntents(
    toIntents(descriptors, { tick: board.tick, turnsPerRound: board.turnsPerRound }),
    `item:use:${item.id}`,
  );
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

/**
 * The pure shape the rules layer wants, off an embedded Item document.
 * @param {object} item
 * @returns {object}
 */
function itemSpec(item) {
  const sys = item.system ?? {};
  return {
    id: item.id,
    contentId: sys.contentId || item.id,
    quantity: sys.quantity ?? 0,
    transferable: Boolean(sys.transferable),
    transferRange: sys.transferRange ?? 1,
    transfersPerTurn: sys.transfersPerTurn ?? null,
    consumeEffect: sys.consumeEffect ?? [],
  };
}

/**
 * How many times this unit has already passed something this turn.
 * @param {object} actor
 * @returns {number}
 */
function transfersThisTurn(actor) {
  // `markTurn` writes to `system.turnState` and stamps the tick, so a count
  // from a previous turn is stale rather than binding.
  const state = actor.system?.turnState ?? {};
  const now = game.combat?.system?.globalTurn ?? 0;
  return state.tick === now ? (state.itemTransfers ?? 0) : 0;
}

/**
 * Descriptors from `rules/items.mjs` into intents.
 *
 * `applyEffect` descriptors come from the item's own `consumeEffect`, authored
 * in the SAME short-form vocabulary `OnEvent`'s `then:` actions use --
 * `{id, duration}`, not the resolved `{defId, expiry}` shape `applyEffect`
 * intents actually carry. `scheduler.mjs`'s `ApplyEffect` action does that
 * resolution for the ability-rule path; this claimed to be "the same
 * vocabulary" and skipped it, so `[Semiramis' Poison]`'s `consumeEffect` —
 * the first and only content to use this field — passed `d.effect` straight
 * through with no `defId` and no resolved `expiry`. `resolveEffects`
 * (`applier.mjs`) reads `intent.effect.defId`, found nothing, and the intent
 * fell through to the raw document writer with a shape it cannot use: the
 * item was consumed and nothing was ever applied.
 *
 * An unknown descriptor kind is dropped with a warning rather than silently,
 * which is how two Command Spell requirements managed to do nothing for a
 * week.
 *
 * @param {object[]} descriptors
 * @param {object} [ctx]
 * @param {number} [ctx.tick]
 * @param {number} [ctx.turnsPerRound]
 * @returns {object[]}
 */
export function toIntents(descriptors, ctx = {}) {
  /** @type {object[]} */
  const out = [];
  for (const d of descriptors) {
    switch (d.kind) {
      case "itemQuantity":
        out.push(I.itemQuantity(d.unitId, d.itemId, d.delta));
        break;
      case "itemGrant":
        out.push(I.itemGrant(d.unitId, d.contentId, d.delta));
        break;
      case "applyEffect": {
        const ticks = d.effect?.duration ? resolveTicks(parseTick(d.effect.duration), ctx) : null;
        out.push(I.applyEffect(d.unitId, {
          ...d.effect,
          defId: d.effect?.defId ?? d.effect?.id,
          magnitude: d.effect?.magnitude ?? 0,
          expiry: ticks === null || ticks === INFINITE ? (d.effect?.expiry ?? null) : (ctx.tick ?? 0) + ticks,
        }, d.source));
        break;
      }
      case "removeEffect":
        out.push(I.removeEffect(d.unitId, d.effect ?? d.effectId, "item"));
        break;
      case "damage":
        out.push(I.damage(d.unitId, d.amount ?? 0, null, { source: d.source }));
        break;
      case "heal":
        out.push(I.heal(d.unitId, d.amount ?? 0, d.source));
        break;
      case "log":
        out.push(I.log(d));
        break;
      default:
        console.warn(`FGT | Item descriptor "${d.kind}" has no intent; it did nothing.`);
    }
  }
  return out;
}
