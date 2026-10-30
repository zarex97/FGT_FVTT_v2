/**
 * @file A paid extension offered as an effect is about to end at a Turn's end.
 * @see docs/15-effect-application.md, docs/33-command-spells.md
 *
 * Layer 3 (engine). Summer Habetrot's Shisarot Form, Passive 11 (#359):
 *
 * > *"When Shisarot Form is about to end at the end of a Turn, her Master can
 * > spend one Command Spell to extend its duration by 3◈ Turns. If extended in
 * > this way, Habetrot's Skill Cooldown is reduced by 1◈ Turns and Habetrot's
 * > next Attack deals 100% extra damage; if NP, 50%."*
 *
 * An effect definition states it as `extension: {cost, grants, repeatable,
 * then}`. At a Turn's end, BEFORE the scheduler expires anything, each such
 * effect whose clock runs out this Turn is offered to whoever pays: a prompt
 * with a Pass, every time it is about to end (ruling 31). Paid, its expiry moves
 * on by `grants` and `then` runs on its holder, as a handler's actions do;
 * passed, or with nothing to pay with, the scheduler ends it as usual.
 * Karl's Carolus Patricius offers its platform's paid life the same way
 * (`engine/platforms.mjs#offerLifespanExtension`).
 */

import { EffectRegistry } from "../rules/registry.mjs";
import { availableFor } from "../rules/cs-namespacing.mjs";
import { expiryReached, parseTick, resolveTicks } from "../domain/tick.mjs";
import { unitActor } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { dispatch } from "./scheduler.mjs";
import * as I from "./intents.mjs";
import { shownName } from "./public-identity.mjs";

/**
 * Offer every extension due at this Turn's end, and take the ones paid for.
 *
 * @param {object} board the board of the Turn that is ending
 * @param {object} ctx the scheduler context (`tick`, `turnsPerRound`)
 * @returns {Promise<boolean>} whether any effect was extended
 */
export async function offerEffectExtensions(board, ctx) {
  let extended = false;
  for (const unit of (board?.units ?? []).filter((u) => !u.defeated)) {
    for (const inst of unit.effectInstances ?? []) {
      const def = EffectRegistry.get(inst.defId);
      const spec = def?.extension ?? null;
      if (!spec || inst.expiry === null || inst.expiry === undefined) continue;
      if (!expiryReached(inst.expiry, ctx.tick ?? 0)) continue;
      if (await offerOne(unit, inst, def, spec, board, ctx)) extended = true;
    }
  }
  return extended;
}

/**
 * Who pays, whether they can, and their answer.
 *
 * @param {object} unit the holder, as the board sees it
 * @param {object} inst the instance about to end
 * @param {object} def its definition
 * @param {object} spec its `extension`
 * @param {object} board
 * @param {object} ctx
 * @returns {Promise<boolean>} whether it was extended
 */
async function offerOne(unit, inst, def, spec, board, ctx) {
  const cost = spec.cost ?? {};
  // A Command Spell from the holder's Master, the pools `availableFor` sums.
  if (cost.kind !== "commandSpell") return false;
  const master = unit.masterId ? (board.units ?? []).find((u) => u.id === unit.masterId) ?? null : null;
  const amount = Number(cost.amount ?? 1);
  if (!master || master.defeated || availableFor(master, unit.id) < amount) return false;

  const holder = unitActor(unit.id);
  const masterDoc = unitActor(master.id);
  const user = game.users.find((u) => u.active && !u.isGM && masterDoc?.testUserPermission(u, "OWNER"))
    ?? game.users.find((u) => u.active && u.isGM) ?? game.user;
  const { FGTSocket } = await import("../net/socket.mjs");
  const picked = await FGTSocket.ask(user.id, {
    kind: "choose",
    title: game.i18n.format("FGT.EffectExtension.Title", { effect: def.name ?? inst.defId }),
    hint: game.i18n.format("FGT.EffectExtension.Hint", {
      // fgt-name-ok: the Master's own player's prompt, about their own Servant
      name: holder?.name ?? unit.id, effect: def.name ?? inst.defId, amount, grants: String(spec.grants ?? ""),
    }),
    min: 0,
    count: 1,
    options: [{ id: "extend", name: game.i18n.localize("FGT.EffectExtension.Extend") }],
  }).catch(() => null);
  if (!(picked ?? []).includes("extend")) {
    await say("FGT.EffectExtension.Passed", { holder, board, def, master: masterDoc, amount });
    return false;
  }

  const ticks = resolveTicks(parseTick(String(spec.grants ?? "0")), { turnsPerRound: ctx.turnsPerRound ?? 3 });
  const handler = { source: def.name ?? inst.defId, abilityId: null, defId: inst.defId };
  const then = (spec.then ?? []).flatMap((a) => dispatch({ ...a, kind: a.kind ?? a.key }, unit, handler, { ...ctx, board }));
  await applyWorldIntents([
    I.spendCS(master.id, amount, `extension:${inst.defId}`, unit.id),
    I.log({
      kind: "commandSpell", command: `extension:${inst.defId}`, masterId: master.id, servantId: unit.id,
      cost: amount, tick: ctx.tick ?? 0,
    }),
    I.extendEffect(unit.id, inst.defId, ticks, def.name ?? inst.defId),
    ...then,
  ], `extension:${inst.defId}`);
  await say("FGT.EffectExtension.Extended", { holder, board, def, master: masterDoc, amount, grants: spec.grants });
  return true;
}

/**
 * The line every player reads: whose effect, what it cost, what it bought.
 *
 * @param {string} key
 * @param {object} args
 * @returns {Promise<void>}
 */
async function say(key, { holder, board, def, master, amount, grants = "" }) {
  const escape = foundry.utils.escapeHTML;
  const text = game.i18n.format(key, {
    name: escape(holder ? shownName(holder, board) : ""),
    master: escape(master ? shownName(master, board) : ""),
    effect: escape(def.name ?? ""),
    amount,
    grants: escape(String(grants)),
  });
  await ChatMessage.create({ content: `<div class="fgt-card"><p>${text}</p></div>` });
}
