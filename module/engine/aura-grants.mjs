/**
 * @file Keep the effects an aura grants on the Units it reaches, and off the rest.
 * @see module/rules/aura-grants.mjs, docs/12-invalidation-and-auras.md
 *
 * Layer 3. Karl de Große's Ceremonial Reformation: every allied Unit holds
 * `ceremonialReformation` while he is alive on the board (#351 readings 6, 7).
 * Who should hold it changes when a Unit arrives, leaves, falls or changes side,
 * and when a Turn turns; each of those runs one sync on the War's GM, which
 * writes the plan's difference and says it on one card.
 */

import { auraGrantPlan } from "../rules/aura-grants.mjs";
import { EffectRegistry } from "../rules/registry.mjs";
import { applyEffect } from "./effect-applier.mjs";
import { currentBoard, currentMoment, unitActor } from "./board.mjs";
import { currentWar, isWarGM, warRule } from "./war.mjs";
import * as I from "./intents.mjs";

let pending = null;

/**
 * Grant and take back what the board's auras say, once.
 *
 * @returns {Promise<{added: number, removed: number}>}
 */
export async function syncAuraGrants() {
  if (!currentWar() || !isWarGM()) return { added: 0, removed: 0 };
  const board = currentBoard();
  const plan = auraGrantPlan(board);
  if (plan.add.length === 0 && plan.remove.length === 0) return { added: 0, removed: 0 };

  const tick = currentMoment().tick ?? 0;
  const intents = [];
  for (const r of plan.remove) intents.push({ ...I.removeEffect(r.unitId, r.instanceId, "auraEnded"), byRule: true });
  for (const a of plan.add) {
    const def = EffectRegistry.get(a.effectId);
    const target = (board.units ?? []).find((u) => u.id === a.unitId);
    if (!def || !target) continue;
    const result = applyEffect({
      def, target, source: { unitId: a.sourceId, abilityId: null },
      ctx: { turnsPerRound: warRule("turnsPerRound"), currentTick: tick, roll: 1 },
      permanent: true, unremovable: true, params: { auraGrant: a.sourceId },
    });
    intents.push(...result.intents);
  }
  const { applyWorldIntents } = await import("./applier.mjs");
  await applyWorldIntents(intents, "auraGrants");
  await sayGrants(plan, board);
  return { added: plan.add.length, removed: plan.remove.length };
}

/**
 * Run a sync soon, once for a burst of writes.
 *
 * @returns {void}
 */
export function scheduleAuraGrants() {
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    syncAuraGrants().catch((err) => console.error("FGT | Aura grants:", err));
  }, 250);
}

/**
 * The card: which Units an aura now reaches and which it left.
 *
 * @param {ReturnType<typeof auraGrantPlan>} plan
 * @param {object} board
 * @returns {Promise<void>}
 */
async function sayGrants(plan, board) {
  const { publicIdentityOf } = await import("./public-identity.mjs");
  const escape = foundry.utils.escapeHTML;
  const name = (id) => {
    const doc = unitActor(id);
    return escape(doc ? publicIdentityOf(doc, board).name : id);
  };
  const lines = [
    ...plan.add.map((a) => game.i18n.format("FGT.AuraGrant.Reaches", {
      source: name(a.sourceId), effect: escape(EffectRegistry.get(a.effectId)?.name ?? a.effectId), unit: name(a.unitId),
    })),
    ...plan.remove.map((r) => game.i18n.format("FGT.AuraGrant.Leaves", {
      effect: escape(EffectRegistry.get(r.effectId)?.name ?? r.effectId), unit: name(r.unitId),
    })),
  ];
  await ChatMessage.create({ content: `<div class="fgt-card">${lines.map((l) => `<p>${l}</p>`).join("")}</div>` });
}

export const AuraGrants = {
  /** Register the hooks. Idempotent per `Hooks`. */
  attach() {
    Hooks.on("combatStart", () => scheduleAuraGrants());
    Hooks.on("updateCombat", (_combat, changes) => {
      if (changes?.turn !== undefined || changes?.round !== undefined) scheduleAuraGrants();
    });
    Hooks.on("createToken", () => scheduleAuraGrants());
    Hooks.on("deleteToken", () => scheduleAuraGrants());
    Hooks.on("updateActor", (_actor, changes) => {
      if (changes?.system?.defeated !== undefined || changes?.system?.factionId !== undefined) scheduleAuraGrants();
    });
    Hooks.on("createItem", () => scheduleAuraGrants());
    Hooks.on("deleteItem", () => scheduleAuraGrants());
  },
};
