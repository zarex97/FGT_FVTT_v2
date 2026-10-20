/**
 * @file The Master's Luck Check against Overpower (Ch. 32, #111).
 * @see module/rules/relationships.mjs#resolveOverpower, docs/32-relationships.md
 *
 * Layer 3: it asks a person, rolls and writes.
 *
 * > A Master about to be Overpowered may make a Luck Check: a success prevents
 * > the flip, and leaves it at 1 Health against damage that would kill it.
 *
 * `resolveOverpower` modelled the save from the start, and the attack path read
 * `state.luckChecks.overpower`, which nothing ever wrote: no Master was ever
 * offered it. Ruled 2026-10-19: the Master's player is asked before the flip,
 * on a Servant's Attack and on a fall *"as though Attacked by a Servant"*; it
 * costs 1 Luck whatever the die says; it is not offered where the difficulty
 * removes Luck Checks, where a rule forbids them, or with no Luck to spend.
 */

import { checkPlan, luckCheck } from "../rules/checks.mjs";
import { luckChecksApply } from "../rules/difficulty.mjs";
import { luckChecksBlocked } from "../rules/bounded-fields.mjs";
import { askOwner } from "./ask.mjs";
import { unitActor } from "./board.mjs";
import * as I from "./intents.mjs";

/**
 * Offer the Master its save, and roll it if taken.
 *
 * @param {object} master the Master, as the board has it
 * @param {object} board
 * @returns {Promise<{success: boolean, roll: number, total: number, target: number, before: number, after: number, spend: object[]}|null>}
 *   null when it is not offered or the player declines
 */
export async function offerOverpowerSave(master, board) {
  if (!master || !luckChecksApply(board?.difficulty)) return null;
  if (luckChecksBlocked(master)) return null;
  const luck = master.luck ?? 0;
  if (luck <= 0) return null;
  const doc = unitActor(master.id);
  if (!doc || doc.system?.defeated) return null;

  const answer = await askOwner(doc, { kind: "luckCheck", check: "overpower", unitId: master.id });
  if (!answer?.accepted) return null;

  const roll = (await new Roll("1d20").evaluate()).total;
  const plan = checkPlan(master, "luck");
  const check = luckCheck({
    roll,
    luck,
    hasBoost: (master.effects ?? []).includes("luckBoost") || plan.forceTable === "favourable",
    hasLoss: (master.effects ?? []).includes("luckLoss") || plan.forceTable === "unfavourable",
    modifiers: plan.modifiers,
  });
  return {
    success: check.success, roll, total: check.total, target: check.target, before: luck, after: luck - 1,
    // A Luck Check costs 1 Luck whether or not it succeeds.
    spend: [
      I.statDelta(master.id, "luck.value", -1),
      I.log({
        kind: "check", check: "overpower", unitId: master.id,
        roll, total: check.total, target: check.target, success: check.success,
      }),
    ],
  };
}

/**
 * The save as the card carries it, beside the flip.
 *
 * @param {Awaited<ReturnType<typeof offerOverpowerSave>>} save
 * @returns {{total: number, target: number, success: boolean, before: number, after: number}|null}
 */
export function saveOnCard(save) {
  return save ? { total: save.total, target: save.target, success: save.success, before: save.before, after: save.after } : null;
}
