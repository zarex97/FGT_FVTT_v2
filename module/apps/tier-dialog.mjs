/**
 * @file Asking which Rank an ability is used at.
 * @see docs/17-abilities.md, module/rules/tiers.mjs
 *
 * Layer 4. Gate of Babylon: *"Gilgamesh can choose the Rank of this NP"*, fifteen
 * choices (#374 reading 2). Asked before the targeting, in the one door every
 * attack is declared through. An offer is a reader of the use gate, so a Rank the
 * press would refuse is shown and cannot be picked.
 */

import { tierView } from "../rules/tiers.mjs";
import { pressGate } from "../engine/press-gate.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * One tier as the player reads it.
 *
 * @param {object} actor
 * @param {object} ability
 * @param {number} index
 * @returns {{index: number, label: string, ok: boolean}}
 */
function choiceOf(actor, ability, index) {
  const view = tierView(ability, index);
  const gate = pressGate(actor, view, { asAttack: true });
  const damage = view.system.damage ?? {};
  const cost = gate.usage?.cost?.amount ?? null;
  return {
    index,
    ok: gate.ok,
    label: game.i18n.format("FGT.Tier.Choice", {
      rank: view.system.rank ?? "",
      multiplier: damage.multiplier ?? 1,
      flat: damage.flatBonus ?? 0,
      cooldown: view.system.cooldown?.max ?? "",
      cost: cost ?? 0,
    }),
  };
}

/**
 * Ask which tier this use is at.
 *
 * @param {object} actor
 * @param {object} ability an ability with `tierChoice`
 * @returns {Promise<number|null>} the tier's index, or `null` on a dismissal
 */
export async function pickTier(actor, ability) {
  const choices = (ability.system.tiers ?? []).map((_, i) => choiceOf(actor, ability, i));
  const first = choices.find((c) => c.ok);
  if (!first) return null;
  const options = choices.map((c) => {
    const state = c.ok ? "" : " disabled";
    const picked = c.index === first.index ? " selected" : "";
    return `<option value="${c.index}"${state}${picked}>${foundry.utils.escapeHTML(c.label)}</option>`;
  }).join("");
  const answer = await DialogV2.prompt({
    window: { title: ability.name },
    content: `<label class="fgt-tier-dialog">${game.i18n.localize("FGT.Tier.Prompt")}<select name="tier">${options}</select></label>`,
    ok: {
      label: game.i18n.localize("FGT.Tier.Confirm"),
      callback: (_event, button) => Number(button.form.elements.tier.value),
    },
    rejectClose: false,
  });
  return Number.isInteger(answer) ? answer : null;
}
