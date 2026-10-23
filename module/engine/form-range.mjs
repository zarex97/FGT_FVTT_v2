/**
 * @file A form driven by the GM: its growing Range and its owed Attack.
 * @see module/rules/form.mjs, docs/25-turn-order-and-scheduler.md
 *
 * Layer 3. Gilles (Caster)'s Gigantic Horror (#323 readings 12, 19): *"If there
 * are no Units within its Range for 1 full Round, its Range will increase by 1
 * at the start of the next Round until it has Attacked a Unit, then it will
 * reset."* And it Attacks on every GM's Turn a Unit is within its Range (12d):
 * the GM's slot opens with a card saying so, and whom.
 */

import { unitActor } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { nearestUnits } from "../rules/compulsion.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { publicSpeakerFor, shownName } from "./public-identity.mjs";

/** Is a Unit within this form's Range on this board? */
function inReach(u, board) {
  const near = nearestUnits(u, board.units);
  const at = near.length > 0 ? chebyshev(u.panel, board.units.find((x) => x.id === near[0]).panel) : Infinity;
  return at <= (u.range ?? 0);
}

/**
 * At a Turn's end: each such form with a Unit within its Range marks the Round,
 * which then holds no growth. *"For 1 full Round"* is every Turn of it.
 *
 * @param {object} board the board as the Turn ended
 * @param {number} round the Round that Turn belongs to
 * @returns {Promise<void>}
 */
export async function noteFormReach(board, round) {
  for (const u of (board?.units ?? []).filter((x) => x.rangeGrows && !x.defeated && x.panel)) {
    const doc = unitActor(u.id);
    if (!doc || doc.system?.formRangeSeen === round || !inReach(u, board)) continue;
    await applyWorldIntents([I.formRange(u.id, doc.system?.formRangeBonus ?? 0, round)], "form:reach");
  }
}

/**
 * At a Round's end: each such form with no Unit within its Range, at any
 * Turn's end of that Round or now, grows by 1.
 *
 * @param {object} board the board as the Round ended
 * @param {{round?: number|null}} [args] the Round that ended
 * @returns {Promise<string[]>} the Units that grew
 */
export async function growFormRanges(board, { round = null } = {}) {
  const grew = [];
  for (const u of (board?.units ?? []).filter((x) => x.rangeGrows && !x.defeated && x.panel)) {
    if (inReach(u, board)) continue;
    const doc = unitActor(u.id);
    if (!doc) continue;
    if (round !== null && doc.system?.formRangeSeen === round) continue;
    const bonus = (doc.system?.formRangeBonus ?? 0) + 1;
    await applyWorldIntents([I.formRange(u.id, bonus)], "form:rangeGrows");
    grew.push(u.id);
    await ChatMessage.create({
      content: `<div class="fgt-card"><p>${game.i18n.format("FGT.Form.RangeGrows", {
        name: foundry.utils.escapeHTML(shownName(doc, board)), range: (u.range ?? 0) + 1,
      })}</p></div>`,
      speaker: publicSpeakerFor(doc),
    });
  }
  return grew;
}

/**
 * Its Attack resets the Range it grew.
 *
 * @param {string} attackerId
 * @returns {Promise<void>}
 */
export async function resetFormRange(attackerId) {
  const doc = unitActor(attackerId);
  if (!doc?.system?.formTaken || !(doc.system.formRangeBonus > 0)) return;
  await applyWorldIntents([I.formRange(attackerId, 0)], "form:rangeReset");
}

/**
 * The GM's slot opens: each GM-driven form with a Unit in reach owes an Attack
 * on the nearest, and the card names it (ties: the GM picks among them).
 *
 * @param {object} board
 * @returns {Promise<void>}
 */
export async function announceGmTurn(board) {
  for (const u of (board?.units ?? []).filter((x) => x.attacksNearest && !x.defeated && x.panel)) {
    const doc = unitActor(u.id);
    const near = nearestUnits(u, board.units).map((id) => board.units.find((x) => x.id === id));
    if (!doc || near.length === 0) continue;
    const inReach = chebyshev(u.panel, near[0].panel) <= (u.range ?? 0);
    const names = near.map((n) => shownName(unitActor(n.id) ?? n, board)).join(", ");
    await ChatMessage.create({
      content: `<div class="fgt-card"><p>${game.i18n.format(inReach ? "FGT.Form.MustAttack" : "FGT.Form.NoneInReach", {
        name: foundry.utils.escapeHTML(shownName(doc, board)), targets: foundry.utils.escapeHTML(names), range: u.range ?? 0,
      })}</p></div>`,
      speaker: publicSpeakerFor(doc),
    });
  }
}
