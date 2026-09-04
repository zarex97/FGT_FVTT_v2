/**
 * @file Dispatching a unit action to the engine that performs it.
 * @see module/rules/actions.mjs, docs/29-user-interface.md §29.5
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

  facing: async ({ actor, context }) => {
    await actor.update({ "system.facing": context.facing });
    return { ok: true };
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
