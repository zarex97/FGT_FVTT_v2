/**
 * @file A Unit taking another form, for good.
 * @see docs/24-modes-and-control.md, module/rules/form.mjs
 *
 * Layer 3. Gilles (Caster)'s Gigantic Horror (#323): *"Transforms himself into
 * a Gigantic Horror. Replace Gilles with the Gigantic Horror ... When Gilles
 * turns into the Gigantic Horror, its Stats are fully restored to its new
 * values."* Three doors reach it -- his own use under 25% Health, the 10% die
 * when Prelati's Spellbook is destroyed, the 10% die when he falls -- and all
 * three come here.
 *
 * Ruled: the same Unit and contract (11a); his effects and cooldowns stay (11d);
 * Health and Agility the form's own, his own Luck maximum refilled (11e). A
 * Command Spell effect he holds ends (12f). Inside a Storm Border he cannot
 * become it at all (11h).
 */

import { currentBoard, unitActor } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { publicSpeakerFor, shownName } from "./public-identity.mjs";
import { formOf } from "../rules/form.mjs";

/**
 * May this Unit take the form this ability defines, here and now? Not twice,
 * and not where its surroundings refuse what it would create.
 *
 * @param {object} actor
 * @param {object} item the ability defining the form
 * @param {object} [board]
 * @returns {boolean}
 */
export function canTransform(actor, item, board = currentBoard()) {
  if (!item?.system?.form?.id || formOf(actor)) return false;
  const unit = (board?.units ?? []).find((u) => u.id === actor.id);
  const creates = [...(item.system?.creates ?? [])];
  return !(unit?.suppressions ?? []).some((s) => {
    if (s.scope !== "creating") return false;
    const banned = new Set(s.attributes ?? []);
    return creates.some((a) => banned.has(a));
  });
}

/**
 * Take the form.
 *
 * @param {string} unitId
 * @param {string} abilityContentId the ability whose `form` it takes
 * @param {{cause?: string|null}} [ctx] `used`, `objectDestroyed`, `defeat`
 * @returns {Promise<boolean>} whether it took it
 */
export async function transformUnit(unitId, abilityContentId, { cause = null } = {}) {
  const doc = unitActor(unitId);
  const item = doc?.items?.find((i) => i.system?.contentId === abilityContentId || i.id === abilityContentId) ?? null;
  const board = currentBoard();
  if (!doc || !item || !canTransform(doc, item, board)) return false;
  const form = item.system.form;
  await applyWorldIntents([I.takeForm(unitId, {
    formId: form.id, pools: form.pools ?? {}, handOver: form.controller === "gm", stands: cause === "defeat",
  })], "transform");
  const sys = doc.system;

  // *"Command Spells have no effect"*: one he holds ends with the change (12f).
  // A Command Spell's effect is his Master's: `engine/command-spells.mjs`
  // applies it with the Master as its source.
  const masterId = sys.masterId ?? null;
  const held = masterId ? [...(doc.effects ?? [])].filter((e) => e.system?.sourceUnitId === masterId) : [];
  if (held.length > 0) await applyWorldIntents(held.map((e) => I.removeEffect(unitId, e.id, "transform")), "transform");

  const escape = foundry.utils.escapeHTML;
  await ChatMessage.create({
    content: `<div class="fgt-card"><p>${game.i18n.format("FGT.Transform.Took", {
      name: escape(shownName(doc, board)), form: escape(item.name),
    })}</p></div>`,
    speaker: publicSpeakerFor(doc),
  });
  return true;
}
