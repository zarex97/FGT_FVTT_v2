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
import { picksOwed } from "../rules/summon-grants.mjs";

/** The prefix of an owed summon-roll pick in `openingChoices.due` (#347). */
const GRANT = "grant:";

/**
 * The modes on this actor whose starting state is a choice.
 *
 * @param {object|null} actor
 * @returns {object[]} ability items
 */
export function openingChoicesOf(actor) {
  return [...(actor?.items ?? [])].filter((i) => (i.system?.isMode && i.system?.openingChoice) || placesField(i));
}

/**
 * Every choice this actor owes, as the ids `openingChoices.due` holds: its
 * items', and each summon roll's pick a 6 left owed (Rama's Vishnu Bhuja, #347).
 *
 * @param {object|null} actor
 * @returns {string[]}
 */
export function owedChoiceIds(actor) {
  return [
    ...openingChoicesOf(actor).map((i) => i.id),
    ...picksOwed(actor).map((p) => `${GRANT}${p.id}`),
  ];
}

/**
 * A passive field its player places, not yet on the board: Wallachia, *"When
 * Vlad III (Lancer) is summoned, the player with Vlad marks out a 9x9 panel
 * area"* (#330 ruling 4). Placed once; a field already open owes nothing.
 *
 * @param {object} item
 * @returns {boolean}
 */
function placesField(item) {
  const spec = item?.system?.field ?? null;
  if (!spec?.passive || spec.placement !== "chosen") return false;
  const fieldId = item.system?.contentId ?? item.id;
  return !(currentBoard().fields ?? []).some((f) => f.id === fieldId);
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
    const ids = owedChoiceIds(actor);
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
    if (itemId.startsWith(GRANT)) {
      if (!(await pickGrant(actor, itemId.slice(GRANT.length)))) return false;
      await settle(actor, itemId);
      continue;
    }
    const item = actor.items.get(itemId);
    if (item && item.system?.field?.placement === "chosen") {
      if (!placesField(item)) {
        await settle(actor, itemId);
        continue;
      }
      if (!(await placeField(actor, item))) return false;
      await settle(actor, itemId);
      continue;
    }
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
 * Ask the field's player where its centre goes, and open it there.
 *
 * @param {object} actor
 * @param {object} item
 * @returns {Promise<boolean>} whether it opened
 */
async function placeField(actor, item) {
  const [{ chosenCentres }, { placeChosenField }, { askOwner }] = await Promise.all([
    import("../rules/bounded-fields.mjs"),
    import("./fields.mjs"),
    import("./ask.mjs"),
  ]);
  const board = currentBoard();
  const self = (board.units ?? []).find((u) => u.id === actor.id);
  if (!self?.panel) return false;
  const panels = chosenCentres(self, board);
  if (panels.length === 0) return false;
  const name = item.system.field.name ?? item.name;
  const answer = await askOwner(actor, {
    kind: "pickPanels", panels, labels: [name],
    // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
    hint: game.i18n.format("FGT.OpeningChoice.PlaceField", { name: actor.name, field: name }),
  });
  const at = answer?.panels?.[0] ?? null;
  if (!at || !panels.some((p) => p.i === at.i && p.j === at.j)) return false;
  const region = await placeChosenField(item, actor, at);
  if (!region) return false;
  const whisper = game.users
    .filter((u) => u.isGM || actor.testUserPermission(u, "OWNER"))
    .map((u) => u.id);
  await ChatMessage.create({
    // fgt-name-ok: whispered to the GM and the Unit's owners
    content: `<p>${game.i18n.format("FGT.OpeningChoice.FieldPlaced", { name: actor.name, field: name })}</p>`,
    whisper,
  });
  return true;
}

/**
 * Ask a summon roll's owed picks, and hold what was picked.
 *
 * *"If a 6 is rolled, the player can choose any of the available Noble
 * Phantasms (that hasn't been chosen yet)"* (Rama's Vishnu Bhuja, #347): one
 * pick per 6, among the faces not yet held, each different.
 *
 * @param {object} actor
 * @param {string} specId
 * @returns {Promise<boolean>} whether nothing of it is owed any more
 */
async function pickGrant(actor, specId) {
  const owed = picksOwed(actor).find((p) => p.id === specId);
  if (!owed) return true;
  const picked = await chooseFor(actor, {
    title: game.i18n.format("FGT.SummonGrant.Title", { label: owed.label }),
    // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
    hint: game.i18n.format("FGT.SummonGrant.Hint", { name: actor.name, label: owed.label, count: owed.count }),
    count: owed.count,
    min: owed.count,
    options: owed.options.map((o) => ({ id: o.key, name: o.label })),
  });
  const keys = [...new Set((picked ?? []).filter((k) => owed.options.some((o) => o.key === k)))];
  if (keys.length !== owed.count) return false;
  const was = actor.system?.summonGranted?.[specId] ?? {};
  await actor.update({
    [`system.summonGranted.${specId}`]: { ...was, keys: [...(was.keys ?? []), ...keys], picks: 0 },
  });
  const whisper = game.users
    .filter((u) => u.isGM || actor.testUserPermission(u, "OWNER"))
    .map((u) => u.id);
  const names = keys.map((k) => owed.options.find((o) => o.key === k)?.label ?? k).join(", ");
  await ChatMessage.create({
    // fgt-name-ok: whispered to the GM and the Unit's owners
    content: `<p>${game.i18n.format("FGT.SummonGrant.Chosen", { name: actor.name, picked: names, label: owed.label })}</p>`,
    whisper,
  });
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
    if (owedChoiceIds(unitActor(actorId)).length === 0) return;
    markOpeningChoicesDue({ actorIds: [actorId] }).catch((err) => console.error("FGT | Opening choice:", err));
  });
}
