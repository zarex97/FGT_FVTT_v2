/**
 * @file A Disguise ended by a blow: the Health lost to one Attack, summed.
 * @see docs/30-concealment-and-identity.md, module/rules/disguise.mjs
 *
 * Layer 3.
 *
 * Doppelganger *"is automatically deactivated when Yan Qing takes damage equal
 * to 10% of his Max Health or more in one Attack"* (#253 reading 13): the
 * Health he actually loses from one Attack, summed over its hits -- one
 * declaration, so EMIYA's two Overedge swings count together -- at 10% of his
 * Max Health or more. The disguise ends the moment that damage lands, with no
 * rewards; the mode's own deactivation clock starts as any end's does.
 */

import { unitActor, unitOf, currentBoard } from "./board.mjs";
import { disguiseOf } from "../rules/disguise.mjs";
import * as I from "./intents.mjs";

/** Health lost so far, by declaration and disguised Unit. */
const lostSoFar = new Map();

/** The fraction of Max Health one Attack must take to end it. */
const BREAKS_AT = 0.10;

/**
 * Count one hit on a disguised defender, and end the disguise when the
 * Attack's total reaches its threshold.
 *
 * @param {object} state the Combat Process
 * @param {{total?: number}} result the Damage Step's result
 * @param {(intents: object[], cause: string) => Promise<unknown>} write the attack path's batch writer
 * @returns {Promise<boolean>} whether the disguise ended
 */
export async function noteHitOnDisguised(state, result, write) {
  const doc = state?.defenderId ? unitActor(state.defenderId) : null;
  if (!doc) return false;
  const unit = unitOf(doc, currentBoard());
  if (!disguiseOf(unit)) return false;
  const lost = Math.max(0, Number(result?.total ?? 0));
  if (lost <= 0) return false;

  const key = `${state.groupId ?? state.attackerId ?? ""}:${doc.id}`;
  const total = (lostSoFar.get(key) ?? 0) + lost;
  lostSoFar.set(key, total);
  const max = unit.maxHealth ?? doc.system?.health?.max ?? 0;
  if (!(max > 0) || total < BREAKS_AT * max) return false;

  lostSoFar.delete(key);
  const mode = disguisingMode(doc);
  if (!mode) return false;
  await write([I.setMode(doc.id, mode.id, false, "disguise", "hit")], "disguise:broken");
  return true;
}

/**
 * The mode that put the disguise on: an active mode with a `disguise` phase.
 *
 * @param {object} actor
 * @returns {object|null}
 */
export function disguisingMode(actor) {
  return [...(actor?.items ?? [])].find((i) => i.system?.isMode && i.system?.active
    && (i.system?.phases ?? []).some((p) => p.kind === "disguise")) ?? null;
}
