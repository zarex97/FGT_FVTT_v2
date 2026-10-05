/**
 * @file Offering a stance transition at its window.
 * @see module/rules/stance.mjs, docs/45-case-studies.md
 *
 * Layer 3 (orchestration).
 *
 * `rules/stance.mjs` has answered "may he change now" since Achilles was
 * authored, and the sheet's stance control asks it -- but only as the
 * DECLARATION, which closes once he has acted. His one transition,
 * *"If Mounted at the start of a Combat Phase, Achilles can Dismount at the
 * start of the Combat Phase"*, lives at a moment after he has declared his
 * attack, and nothing ever offered it (#184).
 */

import { unitSnapshot } from "./board.mjs";
import { chooseFor } from "./ask.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { transitionsAt } from "../rules/stance.mjs";
import * as I from "./intents.mjs";

/**
 * Ask the Unit's owner whether to take a stance transition open at `at`.
 *
 * A Unit with no stance, or none open at this window, is not asked.
 *
 * @param {string} unitId
 * @param {string} at one of `rules/stance.mjs#STANCE_WINDOWS`
 * @returns {Promise<string|null>} the stance taken, or null
 */
export async function offerStanceTransition(unitId, at) {
  const actor = game.actors.get(unitId);
  if (!actor) return null;
  const open = transitionsAt(unitSnapshot(actor), at);
  if (open.length === 0) return null;

  const picked = await chooseFor(actor, {
    title: game.i18n.format("FGT.Stance.Transition.Title", { name: actor.name }),
    hint: game.i18n.localize(`FGT.Stance.Transition.Hint.${at}`),
    count: 1,
    min: 0,
    options: open.map((to) => ({
      id: to,
      name: game.i18n.format("FGT.Stance.Transition.Option", {
        stance: game.i18n.localize(`FGT.Stance.${to}`),
      }),
    })),
  });
  const to = (picked ?? [])[0] ?? null;
  if (!to || !open.includes(to)) return null;
  await applyWorldIntents([I.setStance(unitId, to, at)], `stance:${at}`);
  return to;
}
