/**
 * @file Typed socket operations.
 * @see docs/26-authority-and-sockets.md §26.3
 *
 * Every operation is a **declared, validated, authorized** unit of work rather
 * than a switch over free-form payloads. The authorizer is the load-bearing
 * half: a client can ask the GM to do anything, so the GM must check that the
 * asker is entitled to it before doing it.
 */

import { validate as validateIntents } from "../engine/intents.mjs";

/**
 * Which intents a user may ask the GM to apply.
 *
 * A user may write to units they own. They may **not** hand the GM a batch that
 * damages someone else's Servant and have it applied unchecked — that is the
 * entire attack surface of a socket proxy, and the reason Model B (the GM
 * computes contested outcomes) exists in §26.4.
 *
 * Intents produced by a GM-computed resolution carry `trusted: true` and skip
 * this, because the GM produced them.
 *
 * `world` is injectable so this can be tested without a live game — the check
 * that decides whether one player may damage another's Servant deserves tests
 * more than anything else in the socket layer.
 *
 * @param {object[]} intents
 * @param {string} userId
 * @param {{users: {get: Function}, actors: {get: Function}}} [world]
 * @returns {{allowed: boolean, reason: string|null}}
 */
export function authorizeIntents(intents, userId, world = undefined) {
  const w = world ?? { users: game.users, actors: game.actors };

  const user = w.users.get(userId);
  if (!user) return { allowed: false, reason: "Unknown user." };
  if (user.isGM) return { allowed: true, reason: null };

  const problems = validateIntents(intents);
  if (problems.length > 0) return { allowed: false, reason: problems[0] };

  for (const intent of intents) {
    // Log entries carry no authority; prompts only ask a question.
    if (intent.t === "log" || intent.t === "prompt") continue;
    const unitId = intent.unitId ?? intent.masterId;
    const actor = w.actors.get(unitId);
    if (!actor) return { allowed: false, reason: `Unknown unit ${unitId}.` };
    if (!actor.testUserPermission(user, "OWNER")) {
      return { allowed: false, reason: `${user.name} does not own ${actor.name}.` };
    }
  }
  return { allowed: true, reason: null };
}

/**
 * The operation registry. Adding an operation means declaring it here; there is
 * no path from a socket message to arbitrary code.
 * @type {Readonly<Record<string, {authorize: Function, execute: Function}>>}
 */
export const OPERATIONS = Object.freeze({
  /** Apply a batch of intents that the caller could not write itself. */
  applyIntents: {
    authorize: (payload, userId) =>
      payload.trusted && game.users.get(userId)?.isGM
        ? { allowed: true, reason: null }
        : authorizeIntents(payload.intents ?? [], userId),
    execute: async (payload) => {
      const { applyIntents } = await import("../engine/applier.mjs");
      const { worldIO } = await import("../engine/io.mjs");
      return applyIntents(payload.intents, {
        io: worldIO(),
        canWrite: () => true, // we are the GM
        isGM: true,
        source: payload.source ?? "socket",
      });
    },
  },

  /**
   * Resolve a contested attack. Computed on the GM client because the GM's
   * snapshot is authoritative and the extra round trip is invisible next to
   * human decision time in the reaction ladder (§26.4, Model B).
   */
  resolveAttack: {
    authorize: (payload, userId) => {
      const attacker = game.actors.get(payload.attackerId);
      const user = game.users.get(userId);
      if (!attacker || !user) return { allowed: false, reason: "Unknown attacker." };
      if (!user.isGM && !attacker.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: `${user.name} does not control ${attacker.name}.` };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { resolveAttack } = await import("../engine/attack.mjs");
      return resolveAttack(payload);
    },
  },

  /** Advance a Combat Process that is waiting on a human. */
  advanceProcess: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      if (user?.isGM) return { allowed: true, reason: null };
      // Only the side the machine is waiting on may answer.
      const unit = game.actors.get(payload.respondingUnitId);
      if (!unit?.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: "Not your decision to make." };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { advanceAttack } = await import("../engine/attack.mjs");
      return advanceAttack(payload);
    },
  },

  /**
   * The Discover roll, which must happen on the GM client because the mere
   * *existence* of the roll leaks that a concealed unit is nearby (§26.5).
   */
  discoverRoll: {
    authorize: () => ({ allowed: true, reason: null }),
    execute: async (payload) => {
      const roll = await new Roll("1d100").evaluate();
      const found = roll.total <= (payload.chance ?? 0);
      // Nothing is broadcast on failure. Not a quiet message — nothing at all.
      return { found, total: found ? roll.total : null };
    },
  },
});
