/**
 * @file Skill Seal ending a Skill at once, under the Revised text that says so.
 * @see module/domain/revisions.mjs, docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md reading 3
 *
 * Layer 3 (engine). Two Revised clauses are one sentence:
 *
 *   Presence Concealment 8  *"if this Unit is inflicted with Skill Seal while PC is
 *                           Active, it is immediately deactivated"* (Hundred-Faced
 *                           Hassan, Sasaki; #226 reading 16)
 *   Mad Enhancement 7       *"if this Unit is inflicted with Skill Seal while ME is
 *                           Active, it is immediately deactivated"* (Darius III)
 *
 * Both templates carry `endsOnSkillSeal`; the War's Classic/Revised pick decides
 * whether it holds (`engine/war.mjs#itemRevision`). A bearer whose own sheet says
 * the Skill *"cannot be negated once Activated"* (`unsealable`, Gilles de Rais
 * (Saber), #260 reading 3j) keeps it, and so does a mode locked by its Master's
 * death: the Revised clause 5 says it *"cannot be deactivated"*. Either way the
 * outcome is a line on a card.
 */

import { CONCEALMENT, DEACTIVATION_REASONS } from "../rules/concealment.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { deactivateConcealment } from "./concealment.mjs";
import { currentBoard } from "./board.mjs";
import * as I from "./intents.mjs";
import { publicIdentityOf, publicSpeakerFor } from "./public-identity.mjs";
import { itemRevision } from "./war.mjs";

/**
 * The Skills a Skill Seal on this actor would end now, and the ones it may not.
 *
 * @param {object} actor
 * @returns {{ends: object[], holds: Array<{item: object, why: "unsealable"|"locked"|"cannotDeactivate"}>}}
 */
export function sealVerdicts(actor) {
  const ends = [];
  /** @type {Array<{item: object, why: "unsealable"|"locked"|"cannotDeactivate"}>} */
  const holds = [];
  for (const item of actor?.items ?? []) {
    const sys = item.system ?? {};
    if (!sys.endsOnSkillSeal || !isActive(actor, item)) continue;
    if (itemRevision(item, actor) !== "revised") continue;
    if (sys.unsealable) holds.push({ item, why: "unsealable" });
    else if (sys.isMode && actor.system?.modesLocked) holds.push({ item, why: "locked" });
    // A mode its sheet says NEVER switches off (Heracles: *"Constantly Active.
    // Cannot be deactivated."*). `io.setMode` refuses every forced switch on it,
    // a forcible deactivation included (Ch. 17), so the seal says it held rather
    // than claiming an end that never happens.
    else if (sys.isMode && sys.cannotDeactivate) holds.push({ item, why: "cannotDeactivate" });
    else ends.push(item);
  }
  return { ends, holds };
}

/**
 * Is this Skill Active now? Presence Concealment is an effect it applies;
 * a mode is its own `active`.
 *
 * @param {object} actor @param {object} item
 * @returns {boolean}
 */
function isActive(actor, item) {
  if (item.system?.slug === "presenceConcealment") {
    return [...(actor.effects ?? [])].some((e) => e.system?.defId === CONCEALMENT && !e.disabled);
  }
  return Boolean(item.system?.isMode && item.system?.active);
}

/**
 * Apply a Skill Seal's verdicts: end what it ends, and say what it ended and
 * what held.
 *
 * @param {object} actor
 * @returns {Promise<void>}
 */
export async function onSkillSealed(actor) {
  const { ends, holds } = sealVerdicts(actor);
  if (ends.length === 0 && holds.length === 0) return;
  const name = publicIdentityOf(actor, currentBoard()).name;
  const lines = [];
  for (const item of ends) {
    if (item.system?.slug === "presenceConcealment") {
      await deactivateConcealment(actor.id, DEACTIVATION_REASONS.sealed);
    } else {
      await applyWorldIntents([I.setMode(actor.id, item.system?.slug ?? item.id, false, "sealed")], "skillSeal:mode");
    }
    lines.push(game.i18n.format("FGT.SealEnds.Ended", { name, skill: item.name }));
  }
  for (const { item, why } of holds) {
    const key = { unsealable: "FGT.SealEnds.Unsealable", locked: "FGT.SealEnds.Locked", cannotDeactivate: "FGT.SealEnds.CannotDeactivate" }[why];
    lines.push(game.i18n.format(key, { name, skill: item.name }));
  }
  await ChatMessage.create({
    content: `<div class="fgt-card"><h3>${game.i18n.localize("FGT.SealEnds.Title")}</h3>`
      + lines.map((l) => `<p>${l}</p>`).join("") + "</div>",
    speaker: publicSpeakerFor(actor),
  });
}

/**
 * Watch for Skill Seal landing. GM only: the end writes the cooldown and a card,
 * and every connected client would otherwise race to do it.
 *
 * @returns {void}
 */
export function attachSealEnds() {
  Hooks.on("createActiveEffect", (effect) => {
    if (effect.system?.defId !== "skillSeal" || !game.user?.isGM) return;
    const actor = effect.parent;
    if (!actor) return;
    onSkillSealed(actor).catch((err) => console.error("FGT | Skill Seal ends:", err));
  });
}
