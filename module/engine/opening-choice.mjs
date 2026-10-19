/**
 * @file A mode whose starting state its player chooses when the war starts.
 * @see docs/24-modes-and-control.md, docs/31-war-setup-and-summoning.md
 *
 * Layer 3. Karna's Uncrowned Arms Mastership: *"At the start of the game,
 * choose either Effect 1 or 2, this Skill starts with that effect Active."*
 * Ruled 2026-10-14 (#206 reading 3): his player is asked at the war's start, or
 * right after his summon into a war under way; the pick is free, and the Turn
 * cannot end until it is made (`rules/budget.mjs#openingChoicesOwed`). It had
 * started on Effect 1 with no choice, and changing it spent the Round's one
 * switch.
 *
 * Shaped like Wisdom of Dún Scáith's pick (`engine/copy.mjs`): the actor
 * records what it owes, the GM's client asks, a reload asks again.
 */

import { currentBoard, unitActor } from "./board.mjs";
import { chooseFor } from "./ask.mjs";
import { currentWar } from "./war.mjs";

/**
 * The modes on this actor whose starting state is a choice.
 *
 * @param {object|null} actor
 * @returns {object[]} ability items
 */
export function openingChoicesOf(actor) {
  return [...(actor?.items ?? [])].filter((i) => i.system?.isMode && i.system?.openingChoice);
}

/**
 * Mark every Unit on the board that owes an opening choice, and ask.
 *
 * Called once when the war is built, and for a Servant whose token enters a
 * war already under way. A Unit that already owes one is left alone.
 *
 * @param {{actorIds?: string[]|null, ask?: boolean}} [options]
 * @returns {Promise<string[]>} the actors marked
 */
export async function markOpeningChoicesDue({ actorIds = null, ask = true } = {}) {
  if (!game.user?.isGM) return [];
  /** @type {string[]} */
  const marked = [];
  for (const unit of currentBoard().units ?? []) {
    if (actorIds && !actorIds.includes(unit.id)) continue;
    const actor = unitActor(unit.id);
    const ids = openingChoicesOf(actor).map((i) => i.id);
    if (ids.length === 0 || (actor.system?.openingChoices?.due ?? []).length > 0) continue;
    await actor.update({ "system.openingChoices.due": ids });
    marked.push(actor.id);
  }
  // Not awaited: the war's build, or the summon, goes on while the player
  // thinks. The Turn is what waits.
  if (ask) {
    for (const id of marked) {
      askOpeningChoices(id).catch((err) => console.error("FGT | Opening choice:", err));
    }
  }
  return marked;
}

/**
 * Ask this actor's player every opening choice it still owes, and apply each.
 *
 * A dismissed question stays owed: the End Turn warning names it, a press of
 * the mode asks again, and so does the GM's next load.
 *
 * @param {string} actorId
 * @returns {Promise<boolean>} whether nothing is owed any more
 */
export async function askOpeningChoices(actorId) {
  const actor = unitActor(actorId);
  if (!actor) return true;
  for (const itemId of [...(actor.system?.openingChoices?.due ?? [])]) {
    const item = actor.items.get(itemId);
    if (!item?.system?.openingChoice) {
      await settle(actor, itemId);
      continue;
    }
    const labels = {
      off: game.i18n.localize(item.system.openingChoice.off ?? "FGT.OpeningChoice.Off"),
      on: game.i18n.localize(item.system.openingChoice.on ?? "FGT.OpeningChoice.On"),
    };
    const picked = await chooseFor(actor, {
      title: item.name,
      // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
      hint: game.i18n.format("FGT.OpeningChoice.Hint", { name: actor.name, ability: item.name }),
      count: 1,
      min: 1,
      options: [{ id: "off", name: labels.off }, { id: "on", name: labels.on }],
    });
    const pick = picked?.[0];
    if (pick !== "off" && pick !== "on") return false;
    await applyChoice(actor, item, pick === "on", labels[pick]);
  }
  return true;
}

/**
 * Put the mode in its chosen state, free: no use recorded, no lock stamped.
 *
 * @param {object} actor
 * @param {object} item
 * @param {boolean} active
 * @param {string} label what the player picked, for the line they see
 * @returns {Promise<void>}
 */
async function applyChoice(actor, item, active, label) {
  const [{ applyWorldIntents }, I] = await Promise.all([
    import("./applier.mjs"),
    import("./intents.mjs"),
  ]);
  await applyWorldIntents([
    I.setMode(actor.id, item.id, active, "openingChoice"),
    I.log({
      kind: "ability", event: "openingChoice",
      unitId: actor.id, abilityId: item.id, name: item.name, active,
    }),
  ], "openingChoice");
  await settle(actor, item.id);
  // Whispered to the player and the GM: a public line would name the Skill,
  // and with it a Servant whose True Name may still be hidden.
  const whisper = game.users
    .filter((u) => u.isGM || actor.testUserPermission(u, "OWNER"))
    .map((u) => u.id);
  await ChatMessage.create({
    // fgt-name-ok: whispered to the GM and the Unit's owners
    content: `<p>${game.i18n.format("FGT.OpeningChoice.Chosen", { name: actor.name, ability: item.name, choice: label })}</p>`,
    whisper,
  });
}

/**
 * @param {object} actor
 * @param {string} itemId
 * @returns {Promise<void>}
 */
async function settle(actor, itemId) {
  const due = (actor.system?.openingChoices?.due ?? []).filter((id) => id !== itemId);
  await actor.update({ "system.openingChoices.due": due });
}

/**
 * Ask again on the GM's load, and mark a Servant summoned into a war under way.
 *
 * @returns {void}
 */
export function attachOpeningChoice() {
  if (game.user?.isGM) {
    const owed = [...(game.actors ?? [])].filter((a) => (a.system?.openingChoices?.due ?? []).length > 0);
    for (const a of owed) askOpeningChoices(a.id).catch((err) => console.error("FGT | Opening choice:", err));
  }
  Hooks.on("createToken", (token) => {
    if (!game.user?.isGM || !currentWar()?.started) return;
    const actorId = token.actorId ?? token.actor?.id ?? null;
    if (openingChoicesOf(unitActor(actorId)).length === 0) return;
    markOpeningChoicesDue({ actorIds: [actorId] }).catch((err) => console.error("FGT | Opening choice:", err));
  });
}
