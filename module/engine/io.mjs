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
import { onMasterDefeated } from "../rules/relationships.mjs";
import { record } from "./game-log.mjs";
import { spendPlan } from "../rules/cs-namespacing.mjs";

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
    async spendCommandSpells(unitId, count, _command, servantId = null) {
      const actor = resolve(unitId);
      if (!actor) return;

      // §16.9: draw from the per-Servant pool first. They are the restricted
      // ones, so keeping the flexible pool back is strictly better for the
      // player -- and spending own spells while a namespaced pool sits full is
      // a loss nobody would notice until the pool expired with the contract.
      const plan = spendPlan(actor.system, servantId, count);
      if (!plan.ok) return;

      const update = { "system.commandSpells": Math.max(0, (actor.system.commandSpells ?? 0) - plan.fromOwn) };
      if (plan.fromPerServant > 0 && servantId) {
        const pools = { ...(actor.system.commandSpellsPerServant ?? {}) };
        pools[servantId] = Math.max(0, (pools[servantId] ?? 0) - plan.fromPerServant);
        update["system.commandSpellsPerServant"] = pools;
      }
      await actor.update(update);
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
      await freeContractedServants(unitId);
      const actor = resolve(unitId);
      if (!actor) return;
      await actor.update({ "system.defeated": true, "system.defeatCause": cause });
      const token = resolveToken(unitId);
      if (token) await token.update({ overlayEffect: "icons/svg/skull.svg" });
    },

    /**
     * Spend or restock an item a unit already carries.
     *
     * An item that hits zero is **deleted**, not left at zero. A spent
     * consumable that stays on the sheet reads as still usable, and the
     * quantity gate then refuses it with no visible reason — exactly the
     * "right and inert" failure this system keeps producing.
     *
     * @param {string} unitId
     * @param {string} itemId
     * @param {number} delta
     */
    async adjustItemQuantity(unitId, itemId, delta) {
      const actor = resolve(unitId);
      const item = actor?.items?.get(itemId)
        ?? actor?.items?.find((i) => i.system?.contentId === itemId);
      if (!item) return;

      const next = (item.system?.quantity ?? 0) + delta;
      if (next <= 0) await item.delete();
      else await item.update({ "system.quantity": next });
    },

    /**
     * Put an item on a unit that may not carry one yet.
     *
     * Stacks onto an existing pile where there is one, because two documents
     * for the same item would each carry their own `transfersThisTurn` and let
     * a unit pass twice per turn.
     *
     * @param {string} unitId
     * @param {string} contentId
     * @param {number} delta
     */
    async grantItem(unitId, contentId, delta = 1) {
      const actor = resolve(unitId);
      if (!actor) return;

      const held = actor.items.find((i) => i.system?.contentId === contentId);
      if (held) {
        await held.update({ "system.quantity": (held.system?.quantity ?? 0) + delta });
        return;
      }

      const source = await fromContent(contentId);
      if (!source) {
        console.warn(`FGT | Cannot grant unknown item "${contentId}".`);
        return;
      }
      const data = source.toObject();
      data.system.quantity = delta;
      await actor.createEmbeddedDocuments("Item", [data]);
    },

    /**
     * @param {object[]} entries
     */
    async log(entries) {
      const combat = game.combat;
      if (!combat) return;

      // Two records, deliberately. The flag is the raw intent trail, keyed by
      // whatever `kind` the producer used, and it is what the damage explainer
      // and the process cards read back. `system.log` is §30.8's structured
      // record: a closed vocabulary, sequence-numbered, bounded and exportable.
      // Collapsing them would mean either constraining every producer to ten
      // kinds or letting the exportable log accept anything.
      const existing = combat.getFlag("fgt", "log") ?? [];
      await combat.setFlag("fgt", "log", [...existing, ...entries]);

      for (const e of entries) {
        const classified = classifyLogEntry(e);
        if (!classified) continue;
        await record(classified, combat);
      }
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
 * Find a content document by its `contentId`, across the item packs.
 *
 * Searched by index rather than by loading every pack: the index already
 * carries `system.contentId`, and granting one item should not pull several
 * hundred documents into memory.
 *
 * @param {string} contentId
 * @returns {Promise<object|null>}
 */
async function fromContent(contentId) {
  for (const pack of game.packs.filter((p) => p.metadata.type === "Item")) {
    const index = await pack.getIndex({ fields: ["system.contentId"] });
    const entry = index.find((e) => e.system?.contentId === contentId) ?? index.get(contentId);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
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

/**
 * A Master's death frees its Servants (§16.6).
 *
 * `null` Sustainability is not zero: one has no clock and stays indefinitely,
 * the other disappears immediately. And an active Mad Enhancement locks in
 * whatever state it was in, which locks in its own penalty.
 *
 * @param {string} unitId
 * @returns {Promise<void>}
 */
async function freeContractedServants(unitId) {
  const master = game.actors.get(unitId);
  if (master?.type !== "master" || !game.user.isGM) return;

  for (const actor of game.actors.filter((a) => a.system?.masterId === unitId)) {
    const snapshot = {
      id: actor.id, kind: actor.type,
      sustainability: actor.system?.sustainability ?? null,
      modes: [...(actor.items ?? [])].filter((i) => i.system?.active).map((i) => i.system?.slug),
    };
    for (const d of onMasterDefeated(snapshot)) {
      if (d.kind === "setContract") await actor.update({ "system.contract": d.contract, "system.masterId": null });
      else if (d.kind === "defeat") await actor.update({ "system.defeated": true, "system.defeatCause": d.cause });
      else if (d.kind === "resource") {
        const current = actor.system?.[d.key] ?? 0;
        if (current !== null) await actor.update({ [`system.${d.key}`]: Math.max(0, current + d.delta) });
      } else if (d.kind === "lockModes") await actor.update({ "system.modesLocked": true });
    }
  }
}

/**
 * Which raw intent-log entries earn a place in the structured record.
 *
 * A deliberate narrowing. The intent trail carries two dozen kinds, most of
 * them mechanism -- "terrainRollMissing", "commandSpellWindowClosed" -- and a
 * record that kept all of them would be a transcript rather than a history.
 * §30.8's ten kinds are the events a player or a maintainer goes looking for.
 *
 * An unmapped kind returns `null` and stays in the intent trail only. That is
 * the safe direction: it is still recorded, just not promoted.
 *
 * @param {object} e
 * @returns {object|null}
 */
function classifyLogEntry(e) {
  const map = {
    damage: "attack", counter: "attack", normal: "attack", injury: "attack",
    cost: "ability", revive: "ability", event: "effect", poisonStage: "effect",
    commandSpell: "commandSpell", multiServantTax: "commandSpell",
    surviveKill: "defeat", disappear: "defeat",
    boarding: "movement", platformStep: "movement",
    roundStart: "scheduler", roundEnd: "scheduler", resetTurnState: "scheduler",
  };
  const kind = map[e?.kind];
  if (!kind) return null;

  return {
    kind,
    actorIds: [e.unitId, e.attackerId, e.defenderId, e.masterId, e.servantId].filter(Boolean),
    summary: e.text ?? summaryOf(e),
    detail: e,
    rolls: e.rolls ?? [],
    messageId: e.messageId ?? null,
  };
}

/**
 * A one-line summary for an entry that did not carry one.
 * @param {object} e
 * @returns {string}
 */
function summaryOf(e) {
  const who = e.unitId ? game.actors.get(e.unitId)?.name ?? e.unitId : null;
  const amount = e.amount !== undefined ? ` (${e.amount})` : "";
  return who ? `${e.kind}: ${who}${amount}` : `${e.kind}${amount}`;
}
