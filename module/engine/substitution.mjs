/**
 * @file Substitution: summons in the user's place at the reaction rung.
 * @see docs/23-reactions.md, module/engine/attack.mjs#rebindDefender
 *
 * Layer 3. Prelati's Spellbook (#323 readings 6, 7): *"If Summoning: Horrors,
 * Summoning: Elder Horrors, or Prelati's Spellbook's Active effect is not on
 * Cooldown, choose one of them, it enters Cooldown. If Gilles does this, instead
 * of receiving the Attack, he can Move up to 4 panels; then roll a four-sided
 * die, he summons that number of Horrors around the panel he was previously
 * standing on, with at least one Horror standing on the panel he previously
 * occupied, which is also the Horror that receives the AU's Attack."*
 *
 * Ruled: the chosen ability starts its full clock, the Horrors' at ⅔◈ for each
 * Horror this Substitution summons, and it is no use of that ability. The Move
 * is free and spends no MOV, and he must leave his panel. He leaves this
 * Process, even if he lands in the same area. His owner places the Horrors
 * within 1 of the panel he left, one on it, and that one takes the hit with no
 * reaction. They are ordinary Horrors.
 */

import { currentBoard, unitActor, unitOf } from "./board.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { cooldownFor } from "./cooldown.mjs";
import { publicSpeakerFor, shownName } from "./public-identity.mjs";

/** Every reaction the Horror in his place could answer with but taking it. */
const NO_REACTION = Object.freeze(["block", "evade", "counter", "luck"]);

/**
 * Pay, move, summon, and rebind this Process to the summon on the panel he left.
 *
 * @param {object} args
 * @param {object} args.state the Process at its reaction rung
 * @param {string} args.ownerId the Substitution's user
 * @param {object} args.used the Substitution Item
 * @param {(state: object, newId: string, board: object) => object} args.rebind
 *   `engine/attack.mjs#rebindDefender`, the one door a Process changes defender by
 * @returns {Promise<object>} the Process, rebound, or unchanged when nothing could be summoned
 */
export async function substituteIntoAttack({ state, ownerId, used, rebind }) {
  const spec = used.system?.substitutes ?? {};
  const doc = unitActor(ownerId);
  const board = currentBoard();
  const me = unitOf(doc, board);
  const from = me?.panel ? { ...me.panel } : null;
  if (!doc || !from) return state;
  const escape = foundry.utils.escapeHTML;
  const lines = [];

  // The price: one of the named abilities that is off Cooldown, his pick.
  const { chooseFor } = await import("./ask.mjs");
  const payable = (spec.pays ?? [])
    .map((cid) => doc.items.find((i) => i.system?.contentId === cid))
    .filter((i) => i && (i.system?.cooldown?.remaining ?? 0) <= 0);
  if (payable.length === 0) return state;
  const pickedId = payable.length === 1 ? payable[0].id : ((await chooseFor(doc, {
    title: game.i18n.localize("FGT.Substitution.PayTitle"),
    hint: game.i18n.localize("FGT.Substitution.PayHint"),
    count: 1,
    // fgt-offer-ok: picks which clock to start, which is no use of it
    options: payable.map((i) => ({ id: i.id, name: i.name })),
  })) ?? [])[0] ?? payable[0].id;
  const paid = doc.items.get(pickedId);

  // The Move: up to N, by an ordinary path, and away from where he stood.
  const { pickMoveDestination } = await import("./skill-use.mjs");
  let to = await pickMoveDestination(doc, me, board, spec.move ?? 4);
  if (!to) to = await nearestFree(me, board);
  if (to) {
    await applyWorldIntents([I.move(ownerId, [to])], "substitution:move");
    lines.push(game.i18n.format("FGT.Substitution.Moved", { name: escape(shownName(doc, board)), i: to.i, j: to.j }));
  }

  // The die and the summons: one on the panel he left, the rest within 1 of it.
  const roll = (await new Roll(spec.summon?.countRoll ?? "1d4").evaluate()).total;
  const contentIds = Array.from({ length: Math.max(0, roll) }, () => spec.summon?.contentId ?? "horror");
  const { placeSummonsAround } = await import("./summoning.mjs");
  const created = contentIds.length > 0 ? await placeSummonsAround(doc, from, contentIds) : [];
  lines.push(game.i18n.format("FGT.Substitution.Summoned", { name: escape(shownName(doc, board)), roll, count: created.length }));

  // Its clock, at the full length: the Horrors' counts what this summoned.
  if (paid) {
    const before = paid.system?.cooldown?.remaining ?? 0;
    const { cooldowns } = cooldownFor(paid, ownerId, { count: created.length, unit: unitOf(doc, currentBoard()) });
    if (cooldowns.length > 0) {
      await applyWorldIntents(cooldowns.map((c) => I.cooldown(c.actorId, c.abilityId, c.ticks, "set")), "substitution:pay");
    }
    lines.push(game.i18n.format("FGT.Substitution.Paid", {
      ability: escape(paid.name), before, after: doc.items.get(paid.id)?.system?.cooldown?.remaining ?? before,
    }));
  }

  await ChatMessage.create({
    content: `<div class="fgt-card">${lines.map((l) => `<p>${l}</p>`).join("")}</div>`,
    speaker: publicSpeakerFor(doc),
  });

  const after = currentBoard();
  const inPlace = (after.units ?? []).find((u) => created.some((c) => c.id === u.id)
    && u.panel?.i === from.i && u.panel?.j === from.j);
  if (!inPlace) return state;
  const rebound = rebind(state, inPlace.id, after);
  return {
    ...rebound,
    substituted: true,
    // He is out of this Process, and what was aimed at is not on the Horror.
    aimedAt: null,
    attack: { ...rebound.attack, aimedAtObject: null },
    // *"...which is also the Horror that receives the AU's Attack"*: no reaction.
    forbiddenReactions: [...NO_REACTION],
    reactionAbilities: { [inPlace.id]: [] },
    // ...and answers its own rungs: it takes the hit, as a Unit that takes no
    // action does (`combat-process.mjs#inertAnswer`).
    defenderInert: true,
  };
}

/**
 * The nearest panel he may stop on, for an owner who picked none: he must
 * leave, or nothing can stand where he stood.
 *
 * @param {object} unit
 * @param {object} board
 * @returns {Promise<{i: number, j: number}|null>}
 */
async function nearestFree(unit, board) {
  const { canStopOn } = await import("../rules/movement.mjs");
  for (let r = 1; r <= 4; r += 1) {
    for (let di = -r; di <= r; di += 1) {
      for (let dj = -r; dj <= r; dj += 1) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const p = { i: unit.panel.i + di, j: unit.panel.j + dj };
        if (canStopOn(p, unit, board)) return p;
      }
    }
  }
  return null;
}
