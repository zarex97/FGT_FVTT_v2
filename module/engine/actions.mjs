/**
 * @file Dispatching a unit action to the engine that performs it.
 * @see module/rules/actions.mjs, docs/34-action-bar.md
 *
 * Layer 3. One table, no rules. It exists so the bar never imports
 * `marks.mjs`, `gather.mjs` and `riding.mjs` directly, and so adding Servant
 * #47's new action touches a registry entry and a table row rather than a
 * component.
 *
 * Every handler returns the `{ok, reason}` its engine already returns. The bar
 * surfaces a refusal; nothing here swallows one.
 */

import { placeMark } from "./marks.mjs";
import { gather } from "./gather.mjs";
import { performRidingAttack } from "./riding.mjs";
import { attemptEscape } from "./escape.mjs";
import { boardPlatform, jumpOff } from "./platforms.mjs";
import { attemptForestEscape } from "./nameless-forest.mjs";
import { useItem as consumeHeldItem, giveItem } from "./items.mjs";

/**
 * id → handler. Held against `rules/actions.mjs`'s registry by
 * `test/unit/actions.test.mjs`: an entry with no handler is a button that
 * throws, and a handler with no entry is dead code.
 *
 * @type {Record<string, (args: object) => Promise<{ok: boolean, reason?: string}>>}
 */
export const ACTION_HANDLERS = Object.freeze({
  attack: async ({ actor }) => {
    const { FGTActorSheet } = await import("../apps/index.mjs");
    await FGTActorSheet.declareAttack(actor, null);
    return { ok: true };
  },

  move: async ({ token }) => {
    Hooks.callAll("fgtEnterMovement", token);
    return { ok: true };
  },

  ridingAttack: async ({ actor, destination }) => {
    if (!destination) return { ok: false, reason: "noDestination" };
    return performRidingAttack({ unitId: actor.id, destination });
  },

  mark: async ({ actor, context }) => placeMark({ unitId: actor.id, abilityId: context.abilityId }),

  gather: async ({ actor }) => gather({ actorId: actor.id }),

  // Riding's Passenger Seat, as a switch rather than a prompt. Flips whether
  // this Servant takes her Master along on every Move she makes; the carry
  // itself is `engine/movement-hooks.mjs#carryMaster`, on the `moveToken` hook.
  carryMaster: async ({ actor }) => {
    const on = actor.system?.carriesMaster !== false;
    await actor.update({ "system.carriesMaster": !on });
    ui.notifications?.info(game.i18n.format(
      on ? "FGT.Action.CarryMasterOff" : "FGT.Action.CarryMasterOn",
      { name: actor.name },
    ));
    return { ok: true };
  },

  // The roll that buys a way out of a bounded field. `context.fieldId` is the
  // field the registry found this unit standing in; the ladder decides the
  // rest (Ch. 46 §46.4-H).
  escape: async ({ actor, context }) => attemptEscape({ unitId: actor.id, fieldId: context.fieldId }),

  facing: async ({ actor, context }) => {
    await actor.update({ "system.facing": context.facing });
    return { ok: true };
  },

  // `context.platformId` is the platform the registry found this unit
  // standing on the footprint of (`rules/platforms.mjs#boardablePlatform`).
  board: async ({ actor, context }) => boardPlatform({ unitId: actor.id, platformId: context.platformId }),

  // The Luck Check that is the Nameless Forest's only exit (#28). The registry
  // offers the button even while the gate refuses, so a blocked context is
  // surfaced here rather than rolling anyway.
  // Ch. 18's consumption. `context.contentIds` is what the registry found the
  // Unit holding; with more than one it asks, because "use an item" is
  // ambiguous the moment a Unit carries two.
  useItem: async ({ actor, context }) => {
    const ids = context?.contentIds ?? [];
    if (ids.length === 0) return { ok: false, reason: "noneLeft" };
    let contentId = ids[0];
    if (ids.length > 1) {
      const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
      const held = (id) => [...(actor.items ?? [])].find((i) => i.system?.contentId === id);
      // `pick` returns an ARRAY of chosen ids, and `count: 1` is what makes it
      // a single choice rather than a multi-select.
      const picked = await ChoiceDialog.pick({
        title: game.i18n.localize("FGT.Action.UseItem"),
        hint: game.i18n.localize("FGT.Action.UseItemHint"),
        count: 1,
        min: 0,
        options: ids.map((id) => ({
          id,
          name: held(id)?.name ?? id,
          detail: game.i18n.format("FGT.Action.UseItemRemaining", {
            count: held(id)?.system?.quantity ?? 0,
          }),
        })),
      });
      const choice = (picked ?? [])[0];
      if (!choice) return { ok: false, reason: "cancelled" };
      contentId = choice;
    }
    return consumeHeldItem({ unitId: actor.id, itemId: contentId });
  },

  // Ch. 18's transfer. Two choices, asked in the order the sentence gives them:
  // WHAT is passed, then TO WHOM. The recipient list is recomputed per item
  // because the reach is the item's own, not the giver's.
  giveItem: async ({ actor, context }) => {
    const ids = context?.contentIds ?? [];
    if (ids.length === 0) return { ok: false, reason: "notTransferable" };

    const { ChoiceDialog } = await import("../apps/choice-dialog.mjs");
    const { currentBoard } = await import("./board.mjs");
    const { relationOf } = await import("../rules/relations.mjs");
    const { chebyshev } = await import("../domain/geometry.mjs");

    const board = currentBoard();
    const me = board.units.find((u) => u.id === actor.id);
    const held = (id) => [...(actor.items ?? [])].find((i) => i.system?.contentId === id);
    const ask = async (title, options) => {
      if (options.length === 1) return options[0].id;
      const picked = await ChoiceDialog.pick({ title, count: 1, min: 0, options });
      return (picked ?? [])[0] ?? null;
    };

    const contentId = await ask(
      game.i18n.localize("FGT.Action.GiveItem"),
      ids.map((id) => ({
        id,
        name: held(id)?.name ?? id,
        detail: game.i18n.format("FGT.Action.UseItemRemaining", { count: held(id)?.system?.quantity ?? 0 }),
      })),
    );
    if (!contentId) return { ok: false, reason: "cancelled" };

    const reach = held(contentId)?.system?.transferRange ?? 1;
    const candidates = board.units.filter(
      (u) => u.id !== actor.id && u.panel && me?.panel
        && relationOf(u, me, board) !== "enemy"
        && chebyshev(me.panel, u.panel) <= reach,
    );
    if (candidates.length === 0) return { ok: false, reason: "outOfRange" };

    const toId = await ask(
      game.i18n.localize("FGT.Action.GiveItemTo"),
      candidates.map((u) => ({ id: u.id, name: game.actors.get(u.id)?.name ?? u.id })),
    );
    if (!toId) return { ok: false, reason: "cancelled" };

    return giveItem({ fromId: actor.id, toId, itemId: held(contentId).id });
  },

  // Leaving a Platform on purpose (#31). The registry shows the button while
  // the gate refuses for the two reasons a player can act on -- step to the
  // edge, keep some movement back -- so a blocked context is surfaced rather
  // than jumped anyway.
  jump: async ({ actor, context }) => {
    if (context?.blocked) return { ok: false, reason: context.blocked };
    return jumpOff({ unitId: actor.id, platformId: context.platformId });
  },

  forestEscape: async ({ actor, context }) => {
    if (context?.blocked) return { ok: false, reason: context.blocked };
    return attemptForestEscape(actor.id);
  },
});

/**
 * Perform one action.
 *
 * @param {string} id a `UNIT_ACTIONS` id
 * @param {object} args
 * @param {object} args.actor
 * @param {object} [args.token]
 * @param {object} [args.context] whatever the registry predicate produced
 * @param {{i: number, j: number}} [args.destination] for a targeted action
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function performAction(id, { actor, token = null, context = {}, destination = null }) {
  const handler = ACTION_HANDLERS[id];
  if (!handler) return { ok: false, reason: "unknownAction" };
  return handler({ actor, token, context, destination });
}
