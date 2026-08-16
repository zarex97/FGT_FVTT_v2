/**
 * @file The concrete write adapter — the `io` the applier calls.
 * @see docs/03-domain-overview.md §3.4, docs/26-authority-and-sockets.md
 *
 * Layer 3. This is the *only* file that calls `document.update()`. Everything
 * above it emits intents; everything below it is pure.
 *
 * Keeping it behind an interface is not ceremony: `applyIntents` takes `io` by
 * injection, which is what lets the applier's routing and batching be tested
 * against a recording fake with no world at all.
 */

import { FGTSocket } from "../net/socket.mjs";
import { registerDefeat } from "../rules/environment.mjs";

/**
 * Build a write adapter bound to the current world.
 * @returns {object}
 */
export function worldIO() {
  return {
    /**
     * Health is a `{value, max}` pair, clamped at both ends. Damage and
     * healing both arrive here as a signed delta so the clamp is written once.
     * @param {string} unitId
     * @param {number} delta negative for damage
     */
    async adjustHealth(unitId, delta) {
      const actor = resolve(unitId);
      if (!actor) return;
      const health = actor.system.health;
      // `null` max means the unit has no health resource at all — Pale Rider
      // and the Kagome Spirits. Writing to it would create one.
      if (health?.max === null || health?.value === null) return;
      const next = Math.clamp(health.value + delta, 0, health.max);
      await actor.update({ "system.health.value": next });
    },

    /**
     * @param {string} unitId
     * @param {string} stat dot path under `system`
     * @param {number} delta
     * @param {boolean} clamp
     */
    async adjustStat(unitId, stat, delta, clamp = true) {
      const actor = resolve(unitId);
      if (!actor) return;
      const path = `system.${stat}`;
      const current = foundry.utils.getProperty(actor, path) ?? 0;
      const max = foundry.utils.getProperty(actor, `${path.replace(/\.value$/, "")}.max`);
      const next = clamp && typeof max === "number"
        ? Math.clamp(current + delta, 0, max)
        : current + delta;
      await actor.update({ [path]: next });
    },

    /**
     * @param {string} unitId
     * @param {string} key
     * @param {number} delta
     */
    async adjustResource(unitId, key, delta) {
      const actor = resolve(unitId);
      if (!actor) return;
      const path = `system.${key}`;
      const current = foundry.utils.getProperty(actor, path) ?? 0;
      if (current === null) return;
      await actor.update({ [path]: Math.max(0, current + delta) });
    },

    /**
     * One `createEmbeddedDocuments` call for the whole group, which is the
     * difference between a Noble Phantasm resolving in one frame and in twenty.
     * @param {string} unitId
     * @param {object[]} effects
     */
    async createEffects(unitId, effects) {
      const actor = resolve(unitId);
      if (!actor || effects.length === 0) return;
      const data = effects.map((e) => ({
        name: e.name ?? e.defId,
        type: "fgtEffect",
        img: e.img ?? "icons/svg/aura.svg",
        origin: e.sourceUnitId ? `Actor.${e.sourceUnitId}` : undefined,
        system: {
          defId: e.defId, magnitude: e.magnitude ?? 0, stage: e.stage ?? 0,
          uses: e.uses ?? 0, expiry: e.expiry ?? null,
          sourceUnitId: e.sourceUnitId ?? null, sourceAbilityId: e.sourceAbilityId ?? null,
          unremovable: Boolean(e.unremovable),
        },
      }));
      await actor.createEmbeddedDocuments("ActiveEffect", data);
    },

    /**
     * @param {string} unitId
     * @param {string[]} effectIds may be document ids or definition ids
     */
    async deleteEffects(unitId, effectIds) {
      const actor = resolve(unitId);
      if (!actor) return;
      const ids = new Set(effectIds);
      const targets = actor.effects
        .filter((e) => ids.has(e.id) || ids.has(e.system?.defId))
        .map((e) => e.id);
      if (targets.length === 0) return;
      await actor.deleteEmbeddedDocuments("ActiveEffect", targets);
    },

    /**
     * @param {string} unitId
     * @param {string} abilityId
     * @param {number} ticks
     * @param {"set"|"reduce"} mode
     */
    async setCooldown(unitId, abilityId, ticks, mode) {
      const actor = resolve(unitId);
      const item = actor?.items?.get(abilityId);
      if (!item) return;
      const current = item.system.cooldown?.remaining ?? 0;
      const next = mode === "set" ? ticks : Math.max(0, current - ticks);
      await item.update({ "system.cooldown.remaining": next });
    },

    /**
     * @param {string} unitId
     * @param {Array<{i: number, j: number}>} path
     */
    async move(unitId, path) {
      const token = resolveToken(unitId);
      const destination = path.at(-1);
      if (!token || !destination) return;
      await token.update({ x: destination.j, y: destination.i });
    },

    /**
     * @param {string} unitId
     * @param {string} facing
     */
    async setFacing(unitId, facing) {
      const actor = resolve(unitId);
      if (!actor) return;
      await actor.update({ "system.facing": facing });
    },

    /**
     * @param {string} unitId a Master
     * @param {number} count
     */
    async spendCommandSpells(unitId, count) {
      const actor = resolve(unitId);
      if (!actor) return;
      const current = actor.system.commandSpells ?? 0;
      await actor.update({ "system.commandSpells": Math.max(0, current - count) });
    },

    /**
     * Record what a unit has done this turn.
     *
     * The budget reads this back, so it has to be written before anything
     * consults it — hence its rank alongside the other stat writes rather than
     * after the damage it accompanies.
     *
     * @param {string} unitId
     * @param {object} patch a partial `turnState`
     */
    async markTurn(unitId, patch) {
      const actor = resolve(unitId);
      if (!actor) return;
      // Stamped here rather than by each caller, so no writer can forget it and
      // leave a turn state that never expires.
      const stamped = { tick: game.combat?.system?.globalTurn ?? 0, ...patch };
      const update = {};
      for (const [key, value] of Object.entries(stamped)) update[`system.turnState.${key}`] = value;
      await actor.update(update);
    },

    /**
     * Defeat is a status marker plus a log entry, never a deletion. Revival
     * effects, Battle Continuation and the Grail counter all need the unit to
     * still exist.
     * @param {string} unitId
     * @param {string} cause
     */
    async defeat(unitId, cause) {
      await countTowardsGrail(unitId, cause);
      const actor = resolve(unitId);
      if (!actor) return;
      await actor.update({ "system.defeated": true, "system.defeatCause": cause });
      const token = resolveToken(unitId);
      if (token) await token.update({ overlayEffect: "icons/svg/skull.svg" });
    },

    /**
     * @param {object[]} entries
     */
    async log(entries) {
      const combat = game.combat;
      if (!combat) return;
      const existing = combat.getFlag("fgt", "log") ?? [];
      await combat.setFlag("fgt", "log", [...existing, ...entries]);
    },

    /**
     * Route what this client may not write through the GM.
     * @param {object[]} intents
     * @param {{source: string}} context
     */
    async proxy(intents, context) {
      return FGTSocket.request("applyIntents", { intents, source: context.source });
    },

    /**
     * @param {string} userId
     * @param {object} spec
     */
    async prompt(userId, spec) {
      return FGTSocket.request("prompt", { userId, spec });
    },
  };
}

/**
 * @param {string} unitId
 * @returns {object|null}
 */
function resolve(unitId) {
  // The **token's** actor first, and the world actor only as a fallback.
  //
  // Every rule in the system reads its units from `canvas.tokens.placeables`
  // via `t.actor`. For an *unlinked* token that is a synthetic actor backed by
  // the token's own ActorDelta, and it is not the same document as
  // `game.actors.get(id)` — so preferring the world actor here meant the engine
  // read one actor and wrote to another. Damage was computed, applied, and
  // landed somewhere the board never looks at, which is indistinguishable on
  // screen from damage that was never applied at all.
  //
  // For a linked token the two are the same document, so this changes nothing
  // in the common case and fixes the unlinked one.
  const fromToken = canvas?.tokens?.get(unitId)?.actor
    ?? canvas?.tokens?.placeables?.find((t) => t.actor?.id === unitId)?.actor;
  return fromToken ?? game.actors?.get(unitId) ?? null;
}

/**
 * @param {string} unitId
 * @returns {object|null}
 */
function resolveToken(unitId) {
  const direct = canvas?.tokens?.get(unitId)?.document;
  if (direct) return direct;
  return canvas?.tokens?.placeables?.find((t) => t.actor?.id === unitId)?.document ?? null;
}

/**
 * Count a removal towards the Grail's materialization.
 *
 * *"A disappeared Servant counts towards the number of Servants needed for the
 * Grail to materialize (but not if inflicted with Erase)."* So the cause
 * matters and only Servants count — and `grailCounter` had sat on `MatchData`
 * since it was written with nothing ever incrementing it, which meant the
 * Grail could never appear.
 *
 * @param {string} unitId
 * @param {string} cause
 * @returns {Promise<void>}
 */
async function countTowardsGrail(unitId, cause) {
  const combat = game.combats?.active;
  if (!combat || !game.user.isGM) return;

  const actor = game.actors.get(unitId) ?? canvas?.tokens?.get(unitId)?.actor;
  const next = registerDefeat(
    {
      threshold: combat.system?.grailThreshold ?? 9,
      defeatedCount: combat.system?.grailCounter ?? 0,
      materialized: Boolean(combat.system?.grailMaterialized),
    },
    { kind: actor?.type },
    cause,
  );
  if (next.defeatedCount === (combat.system?.grailCounter ?? 0)) return;

  await combat.update({
    "system.grailCounter": next.defeatedCount,
    "system.grailMaterialized": next.materialized,
  });
  if (next.materialized && !combat.system?.grailMaterialized) {
    Hooks.callAll("fgtGrailMaterialized", next);
  }
}
