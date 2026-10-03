/**
 * @file Typed socket operations.
 * @see docs/38-authority.md
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
 * computes contested outcomes) exists in Ch. 38.
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
/**
 * A Process off a message flag, or `null` if it cannot be read.
 *
 * @param {unknown} raw
 * @returns {object|null}
 */
function readProcess(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

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
   * human decision time in the reaction ladder (Ch. 38, Model B).
   */
  /**
   * Spend a Command Spell. Executed on the GM client for the same reason
   * `resolveAttack` is: a Command Spell can interrupt somebody else's
   * resolution, so it must be applied where the authoritative state lives.
   */
  spendCommandSpell: {
    authorize: (payload, userId) => {
      const master = game.actors.get(payload.masterId);
      const user = game.users.get(userId);
      if (!master || !user) return { allowed: false, reason: "Unknown Master." };
      // Only the Master's owner may spend its Command Spells -- they are that
      // player's most consequential resource, and "any time at all, even if it
      // were to interrupt an ongoing process" makes misuse expensive.
      if (!user.isGM && !master.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: `${user.name} does not control ${master.name}.` };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { spendCommandSpell } = await import("../engine/command-spells.mjs");
      return spendCommandSpell(payload);
    },
  },

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

  /**
   * Perform a Riding Attack: the Move and the attack it is, as one action.
   *
   * Computed on the GM client for the reason `resolveAttack` is -- it fans out
   * into a Combat Process against Units the rider's player does not own -- and
   * authorized the same way: the rider's owner, or the GM (#113).
   */
  ridingAttack: {
    authorize: (payload, userId) => {
      const rider = game.actors.get(payload.unitId);
      const user = game.users.get(userId);
      if (!rider || !user) return { allowed: false, reason: "Unknown rider." };
      if (!user.isGM && !rider.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: `${user.name} does not control ${rider.name}.` };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { performRidingAttack } = await import("../engine/riding.mjs");
      return performRidingAttack(payload);
    },
  },

  /**
   * Use a non-attacking Skill, or a Noble Phantasm that deals no damage.
   *
   * Run on the GM, like an attack. On a player's client it could not write what
   * most of these write: a `zone` phase's Region and Behaviour, a field's
   * Region, the Actor, Token and Level a platform or a summon creates, or a buff
   * on a Unit another player owns (`authorizeIntents`). So the Skill's player
   * asks, and the GM -- who can write all of it -- resolves it (Ch. 38, Model B;
   * #130, #144). `canUseAbility` stays inside `useSkill`, so the GM re-checks
   * every gate; the placement the player picked travels in the payload.
   *
   * Authorized by the actor, not by the Skill: its owner, and only an ability
   * the actor holds. What the use may do to OTHER players' Units is the GM's
   * resolution to decide, as an attack's is, and is not loosened here.
   */
  useSkill: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      const actor = game.actors.get(payload.actorId);
      if (!user || !actor) return { allowed: false, reason: "Unknown actor." };
      if (user.isGM) return { allowed: true, reason: null };
      if (!actor.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: `${user.name} does not control ${actor.name}.` };
      }
      if (!actor.items?.get(payload.abilityId)) {
        return { allowed: false, reason: `${actor.name} holds no such ability.` };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { useSkill } = await import("../engine/skill-use.mjs");
      // Only what a player may choose. The flag that exempts a use from its
      // category's per-Turn cap rides a use the ENGINE decides is free of one, and
      // is never a thing to claim in a payload.
      return useSkill({
        actorId: payload.actorId, abilityId: payload.abilityId, placement: payload.placement ?? {},
      });
    },
  },

  /**
   * End a bounded field its owner may end (the action bar's End control).
   *
   * Ending a field deletes its Region, its stone and its summons and starts the
   * owning ability's cooldown: all GM writes, so a player asks and the GM does
   * it. Authorized by the actor, as `useSkill` is; the GM then checks that the
   * field is that actor's and that its `deactivation` block lets the owner end
   * it NOW (`mayDeactivate`: `byOwner`, the lockout and the window), so a player
   * cannot end somebody else's field or one still inside its lockout (#130).
   */
  deactivateField: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      const actor = game.actors.get(payload.actorId);
      if (!user || !actor) return { allowed: false, reason: "Unknown actor." };
      if (user.isGM) return { allowed: true, reason: null };
      if (!actor.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: `${user.name} does not control ${actor.name}.` };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const [{ currentBoard }, { deactivateField, deactivationReason }, { queueEnd }] = await Promise.all([
        import("../engine/board.mjs"),
        import("../engine/fields.mjs"),
        import("../engine/queued-ends.mjs"),
      ]);
      const field = (currentBoard().fields ?? []).find((f) => f.id === payload.fieldId);
      if (!field || field.ownerId !== payload.actorId) return { ok: false, reason: "notYourField" };
      const verdict = deactivationReason(field, payload.actorId);
      if (!verdict.ok) return { ok: false, reason: "mayNotDeactivate" };
      // Outside the owner's Turn it waits for the Turn's end (#65, ruling 19).
      if (verdict.queued) {
        return { ok: await queueEnd({ kind: "field", id: payload.fieldId, ownerId: payload.actorId }), queued: true };
      }
      return { ok: await deactivateField(payload.fieldId, "owner") };
    },
  },

  /**
   * Hold a Mode's switch-off for the Turn's end (#65, ruling 19).
   *
   * Raikou's Tenmōkaikai, *"can deactivate this NP during her Turn and at the
   * start or end of any Turn or Round"*: switched off during somebody else's
   * Turn, it ends when that Turn does. The queue lives on the Combat, which a
   * player cannot write, so the sheet asks the GM. Authorized by the actor;
   * the GM checks the Mode is that actor's, is on, and states `window: any`.
   */
  queueModeEnd: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      const actor = game.actors.get(payload.actorId);
      if (!user || !actor) return { allowed: false, reason: "Unknown actor." };
      if (user.isGM || actor.testUserPermission(user, "OWNER")) return { allowed: true, reason: null };
      return { allowed: false, reason: `${user.name} does not control ${actor.name}.` };
    },
    execute: async (payload) => {
      const item = game.actors.get(payload.actorId)?.items.get(payload.itemId);
      if (!item?.system?.active || item.system?.deactivation?.window !== "any") return { ok: false, reason: "mayNotDeactivate" };
      const { queueEnd } = await import("../engine/queued-ends.mjs");
      return { ok: await queueEnd({ kind: "mode", id: item.id, ownerId: payload.actorId }), queued: true };
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
   * Declare a Ch. 21 Counter with a chosen ability.
   *
   * Separate from `advanceProcess` because it carries a placement, and because
   * its authorizer needs a second clause: the parent Process must actually be
   * ON its counter rung. Without that, any owner could post this at any moment
   * and receive a free attack that costs no turn budget — which is what a
   * Counter is, minus the part where somebody attacked them first.
   */
  declareCounter: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      if (user?.isGM) return { allowed: true, reason: null };

      const unit = game.actors.get(payload.respondingUnitId);
      if (!unit?.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: "Not your decision to make." };
      }

      const message = game.messages.get(payload.messageId);
      const raw = message?.getFlag("fgt", "process");
      // A malformed flag reads as "not on the counter rung", which is the safe
      // answer: this operation grants a free attack and an unparseable Process
      // is not evidence that one was earned.
      const state = readProcess(raw);
      if (state?.state !== "counter") {
        return { allowed: false, reason: "That Process is not offering a Counter." };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { advanceAttack } = await import("../engine/attack.mjs");
      return advanceAttack({
        messageId: payload.messageId,
        event: "counter",
        abilityId: payload.abilityId ?? null,
        placement: payload.placement ?? null,
      });
    },
  },

  /**
   * Write a faction's turn budget onto the Combat document.
   *
   * A player owns their Servants; nobody but the GM owns Combat. So spending
   * budget is a proxied write like any other — but the authorizer is narrow:
   * a player may only write the budget for **their own faction**, and only for
   * the faction whose turn it currently is. Without the second half, a player
   * could quietly refill their pools on somebody else's turn.
   */
  setBudget: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      if (!user) return { allowed: false, reason: "Unknown user." };
      if (user.isGM) return { allowed: true, reason: null };

      const combat = game.combats.get(payload.combatId);
      if (!combat) return { allowed: false, reason: "Unknown combat." };

      const existing = combat.getFlag("fgt", "budgets") ?? {};
      const changed = Object.keys(payload.budgets ?? {})
        .filter((id) => JSON.stringify(existing[id]) !== JSON.stringify(payload.budgets[id]));

      const acting = combat.combatant?.system?.factionId ?? combat.combatant?.id ?? null;
      for (const factionId of changed) {
        if (factionId !== acting) {
          return { allowed: false, reason: "That is not the faction whose turn it is." };
        }
        const owns = game.actors.some(
          (a) => a.system?.factionId === factionId && a.testUserPermission(user, "OWNER"),
        );
        if (!owns) return { allowed: false, reason: `${user.name} does not control that faction.` };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const combat = game.combats.get(payload.combatId);
      await combat.setFlag("fgt", "budgets", payload.budgets);
      return { ok: true };
    },
  },

  /**
   * Declare `Delay+X` for a faction.
   *
   * Proxied for the same reason the budget is: turn order lives on the Combat
   * document, which no player owns. The authorizer is the same shape — a player
   * may delay **their own** faction, and only while it has not yet acted this
   * Round, because a delay from a faction that has already taken its turn is a
   * declaration about the next Round and the document decides that, not the
   * caller.
   */
  delayTurn: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      if (!user) return { allowed: false, reason: "Unknown user." };
      if (user.isGM) return { allowed: true, reason: null };

      const combat = game.combats.get(payload.combatId);
      if (!combat) return { allowed: false, reason: "Unknown combat." };

      const owns = game.actors.some(
        (a) => a.system?.factionId === payload.factionId && a.testUserPermission(user, "OWNER"),
      );
      if (!owns) return { allowed: false, reason: `${user.name} does not control that faction.` };
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const combat = game.combats.get(payload.combatId);
      const order = await combat.delayFaction(payload.factionId, payload.positions ?? 0);
      return { ok: true, order };
    },
  },

  /**
   * End a platform at its owner's word (#141).
   *
   * Proxied because ending one deletes its Scene Level, its Token and its Actor,
   * none of which a player may do. The authorizer is narrow in WHO: the player
   * who owns the Servant that owns the platform, and the GM. The lockout is not
   * checked here but in `engine/platforms.mjs#deactivatePlatform`, which the GM
   * runs, so it is a rule and not a hidden button.
   */
  deactivatePlatform: {
    authorize: (payload, userId) => {
      const user = game.users.get(userId);
      if (!user) return { allowed: false, reason: "Unknown user." };
      const platform = game.actors.get(payload.platformId);
      if (!platform) return { allowed: false, reason: "Unknown platform." };
      if (user.isGM) return { allowed: true, reason: null };

      const owner = game.actors.get(platform.system?.ownerId);
      if (!owner?.testUserPermission(user, "OWNER")) {
        return { allowed: false, reason: `${user.name} does not own ${platform.name}.` };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const { deactivatePlatform } = await import("../engine/platforms.mjs");
      return deactivatePlatform({ platformId: payload.platformId });
    },
  },

  /**
   * Draw the targeted area on the scene as a grid-shape Region.
   *
   * Proxied because players cannot create scene documents. The authorizer is
   * deliberately narrow in *what* rather than in *who*: any player may draw an
   * area — targeting is not a privileged act — but only a region that is
   * transient and grid-shaped, so this operation cannot be used to author
   * permanent scenery or a polygon that outlives the decision it illustrates.
   */
  createTargetRegion: {
    authorize: (payload, userId) => {
      if (!game.users.get(userId)) return { allowed: false, reason: "Unknown user." };
      const data = payload.data ?? {};
      if (!data.flags?.fgt?.transientTarget) {
        return { allowed: false, reason: "Only transient targeting regions may be created this way." };
      }
      const shapes = data.shapes ?? [];
      if (shapes.length === 0 || shapes.some((s) => s.type !== "grid")) {
        return { allowed: false, reason: "A targeting region must be grid-shaped." };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const scene = game.scenes.get(payload.sceneId);
      if (!scene) return { regionId: null };
      const [region] = await scene.createEmbeddedDocuments("Region", [payload.data]);
      return { regionId: region?.id ?? null };
    },
  },

  /**
   * Remove a targeting area.
   *
   * Refuses anything that is not one of ours, so a stray id cannot be used to
   * delete a real Region — a home base, a bounded field — through the proxy.
   */
  deleteTargetRegion: {
    authorize: (payload, userId) => {
      if (!game.users.get(userId)) return { allowed: false, reason: "Unknown user." };
      const region = game.scenes.get(payload.sceneId)?.regions?.get(payload.regionId);
      if (!region) return { allowed: true, reason: null }; // already gone
      if (!region.getFlag("fgt", "transientTarget")) {
        return { allowed: false, reason: "That is not a targeting region." };
      }
      return { allowed: true, reason: null };
    },
    execute: async (payload) => {
      const scene = game.scenes.get(payload.sceneId);
      if (scene?.regions?.get(payload.regionId)) {
        await scene.deleteEmbeddedDocuments("Region", [payload.regionId]);
      }
      return { ok: true };
    },
  },

  /**
   * The Discover roll, which must happen on the GM client because the mere
   * *existence* of the roll leaks that a concealed unit is nearby (Ch. 38).
   */
  /**
   * Ask a player a question, from wherever the resolution happens to be.
   *
   * The operation runs on the GM and *forwards* to the named user, because the
   * asker is usually a rule resolving on the GM client and the answerer is a
   * player. Without this, `io.prompt` emitted an operation that did not exist.
   */
  prompt: {
    authorize: (_payload, userId) =>
      (game.users.get(userId)?.isGM
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "Only a GM may prompt another user." }),
    execute: async (payload) => {
      const { FGTSocket } = await import("./socket.mjs");
      return FGTSocket.ask(payload.userId, payload.spec);
    },
  },

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
