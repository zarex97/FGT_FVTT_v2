/**
 * @file An object a Unit holds, destroyed.
 * @see module/engine/weak-point.mjs, docs/45-case-studies.md
 *
 * Layer 3. Prelati's Spellbook (#323): an attacker may aim at it, and a hit
 * destroys it for the War. What follows is the object's own, read off its weak
 * point's `onDestroyed`: the mark that closes what it allowed, the summons it
 * took with it, a chance of something else. Every outcome is a card line.
 */

import { currentBoard, unitActor } from "./board.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { publicSpeakerFor, shownName } from "./public-identity.mjs";

/**
 * Destroy the object a weak point names, and run what its destruction does.
 *
 * @param {string} holderId
 * @param {string} specId the weak point's id
 * @param {{attackerId?: string|null}} [ctx]
 * @returns {Promise<void>}
 */
export async function destroyHeldObject(holderId, specId, { attackerId = null } = {}) {
  const board = currentBoard();
  const holder = (board.units ?? []).find((u) => u.id === holderId);
  const spec = (holder?.weakPoints ?? []).find((w) => w.id === specId) ?? null;
  const doc = unitActor(holderId);
  if (!spec || !doc) return;
  if (spec.destroyedMark && (holder.effects ?? []).includes(spec.destroyedMark)) return;

  const intents = [];
  if (spec.destroyedMark) {
    intents.push(I.applyEffect(holderId, {
      defId: spec.destroyedMark, magnitude: 0, stage: 0, uses: 0, expiry: null,
      unremovable: true, sourceUnitId: attackerId ?? holderId, visibility: "public",
    }, attackerId ?? holderId));
  }
  // *"All Horrors on the board are immediately destroyed"*: his own, Horrors and
  // Elder Horrors alike, removed without splitting (#323 reading 8). A
  // dismissal is no defeat, so no split die rolls.
  const goes = new Set(spec.onDestroyed?.dismissSummons ?? []);
  const summons = (board.units ?? []).filter((u) => u.kind === "summon" && u.summonerId === holderId
    && !u.defeated && goes.has(u.contentId));
  for (const s of summons) intents.push(I.dismissSummon(s.id, "objectDestroyed"));
  if (intents.length > 0) await applyWorldIntents(intents, "objectDestroyed");
  const escape = foundry.utils.escapeHTML;
  const lines = [game.i18n.format("FGT.WeakPoint.ObjectGone", {
    object: escape(spec.name ?? specId), name: escape(shownName(doc, board)),
  })];
  if (summons.length > 0) {
    lines.push(game.i18n.format("FGT.WeakPoint.ObjectSummonsGone", { count: summons.length, name: escape(shownName(doc, board)) }));
  }

  // *"However, when Prelati's Spellbook is destroyed, Gilles has a 10% chance
  // of transforming into the Gigantic Horror."* The die is on the card, a miss
  // included.
  const transform = spec.onDestroyed?.transform ?? null;
  let transforms = false;
  // Not where it could not happen: in his form already, or inside a Storm Border (#323 reading 11h).
  const { canTransform } = await import("./transform.mjs");
  const definer = doc.items.find((i) => i.system?.contentId === transform?.ability) ?? null;
  if (transform && canTransform(doc, definer, currentBoard())) {
    const roll = (await new Roll("1d100").evaluate()).total;
    transforms = roll <= (transform.chance ?? 0);
    lines.push(game.i18n.format(transforms ? "FGT.Transform.Rolled" : "FGT.Transform.Missed", {
      name: escape(shownName(doc, board)), roll, chance: transform.chance ?? 0,
    }));
  }
  await ChatMessage.create({
    content: `<div class="fgt-card">${lines.map((l) => `<p>${l}</p>`).join("")}</div>`,
    speaker: publicSpeakerFor(doc),
  });
  if (transforms) {
    const { transformUnit } = await import("./transform.mjs");
    await transformUnit(holderId, transform.ability, { cause: "objectDestroyed" });
  }
}
