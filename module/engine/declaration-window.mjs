/**
 * @file The declaration window: the moment after targeting is confirmed and
 * before any Combat Process exists (ruled 2026-10-17, #241).
 * @see docs/33-command-spells.md
 *
 * Noble Phantasm Max, Damage Up and the four NP damage Essences (Heaven's Feel,
 * Angel's Song, Dragonkind, Oracle) boost the ATTACK, not one of its targets:
 * *"Servant NP deals 200% extra damage."* They were offered on each defender's
 * card, so a spend on an area NP boosted one target of five, and an Essence,
 * one use, could never cover the rest. Ch. 33's `beforeAttack` window names
 * this moment, and no card ever showed it: a declaration is driven past
 * `declare` before its card exists.
 *
 * So the window is its own card, whispered to the Masters who could boost the
 * attack, held until they press Continue, spend everything they could, or the
 * Command Spell timeout runs out. What was bought is recorded on the card as a
 * Process-shaped state, and every Process of the declaration starts with it
 * (`carryDeclarationBoosts`). No card waits on another, and nothing races.
 */

import * as process from "./combat-process.mjs";
import { reachesDeclaration } from "../rules/command-spells.mjs";
import { processOffers } from "./command-spells.mjs";
import { unitActor } from "./board.mjs";

/** The flag holding the window's state, Process-shaped so the spend reads it as one. */
export const DECLARATION_FLAG = "declaration";

/**
 * The boosts the attacker's Masters could buy now.
 *
 * @param {object} state the window's Process-shaped state
 * @returns {object[]} `processOffers` rows
 */
export function declarationOffers(state) {
  return processOffers(state).filter((o) => reachesDeclaration(o.command));
}

/**
 * The boosts one window bought, onto a Process of its declaration.
 *
 * @param {object} state a fresh Process state
 * @param {object|null} window the window's final state
 * @returns {object}
 */
export function carryDeclarationBoosts(state, window) {
  if (!window) return state;
  const percents = window.damagePercents ?? [];
  const factors = window.damageFactors ?? [];
  if (percents.length === 0 && factors.length === 0) return state;
  return {
    ...state,
    damagePercents: [...(state.damagePercents ?? []), ...percents],
    damageFactors: [...(state.damageFactors ?? []), ...factors],
    interrupts: [...(state.interrupts ?? []), ...(window.interrupts ?? []).map((r) => ({ ...r, declaration: true }))],
  };
}

/**
 * Open the window, wait for its answer, and return what it bought.
 *
 * GM-side, as `resolveAttack` is. Costs nothing when no Master could boost this
 * attack: no card, no wait.
 *
 * @param {object} args
 * @param {string} args.attackerId
 * @param {object} args.attack the declaration's attack spec
 * @param {string} args.abilityName what the card calls the attack
 * @returns {Promise<object|null>} the window's final state, or `null`
 */
export async function openDeclarationWindow({ attackerId, attack, abilityName }) {
  if (!game.user?.isGM) return null;
  const seconds = game.settings.get("fgt", "commandSpellTimeout") ?? 45;
  if (seconds <= 0) return null;
  const state = process.begin({ attackerId, defenderId: null, attack });
  const offers = declarationOffers(state);
  if (offers.length === 0) return null;

  const masterIds = [...new Set(offers.map((o) => o.masterId))];
  const whisper = game.users
    .filter((u) => u.isGM || masterIds.some((id) => unitActor(id)?.testUserPermission(u, "OWNER")))
    .map((u) => u.id);
  const message = await ChatMessage.create({
    content: renderWindow(state, offers, { attackerId, abilityName, open: true }),
    whisper,
    flags: { fgt: { kind: DECLARATION_FLAG, [DECLARATION_FLAG]: process.serialize(state), declarationOpen: true, masterIds, abilityName } },
  });

  const read = () => process.deserialize(message.getFlag("fgt", DECLARATION_FLAG));
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    if (!message.getFlag("fgt", "declarationOpen")) break;
    // Everything that could be bought was: nobody is left to press Continue.
    if (declarationOffers(read()).length === 0) break;
  }

  const final = read();
  await message.update({
    content: renderWindow(final, [], { attackerId, abilityName, open: false }),
    "flags.fgt.declarationOpen": false,
  });
  return final;
}

/**
 * Re-render an open window after a spend: what was bought, and what is left.
 *
 * @param {object} message
 * @returns {Promise<void>}
 */
export async function refreshDeclarationWindow(message) {
  if (!message?.getFlag("fgt", "declarationOpen")) return;
  const state = process.deserialize(message.getFlag("fgt", DECLARATION_FLAG));
  await message.update({
    content: renderWindow(state, declarationOffers(state), {
      attackerId: state.attackerId, abilityName: message.getFlag("fgt", "abilityName"), open: true,
    }),
  });
}

/**
 * The card.
 *
 * @param {object} state
 * @param {object[]} offers
 * @param {{attackerId: string, abilityName: string, open: boolean}} args
 * @returns {string}
 */
function renderWindow(state, offers, { attackerId, abilityName, open }) {
  const escape = foundry.utils.escapeHTML;
  // fgt-name-ok: whispered to the GM and the owners of the attacker's own Masters, who know their Servant
  const servant = unitActor(attackerId)?.name ?? "";
  const bought = (state.interrupts ?? []).filter((r) => r.applied).map((r) => r.name ?? r.command);
  const lead = game.i18n.format("FGT.Declaration.Lead", { servant: escape(servant), name: escape(abilityName ?? "") });
  const boughtLine = bought.length > 0
    ? game.i18n.format("FGT.Declaration.Bought", { names: escape(bought.join(", ")) })
    : (open ? "" : game.i18n.localize("FGT.Declaration.None"));
  const buttons = offers.map((o) => `<button type="button" data-fgt-cs="${escape(o.command.id)}" `
    + `data-fgt-master="${escape(o.masterId)}" data-fgt-servant="${escape(o.servantId ?? "")}">`
    + `${escape(o.several ? `${o.command.name} (${o.servantName})` : o.command.name)}`
    + `<small>${o.command.essence ? escape(game.i18n.localize("FGT.Master.Essence")) : `${o.command.cost} CS`}</small></button>`).join("");
  return `<div class="fgt-card fgt-card--declaration">`
    + `<header class="fgt-card__header"><strong>${escape(game.i18n.localize("FGT.Declaration.Title"))}</strong></header>`
    + `<p>${lead}</p>`
    + (boughtLine ? `<p>${boughtLine}</p>` : "")
    + (open
      ? `<section class="fgt-card__prompt fgt-card__prompt--cs"><div class="fgt-card__buttons">${buttons}`
        + `<button type="button" data-fgt-declaration-close>${escape(game.i18n.localize("FGT.Declaration.Continue"))}</button>`
        + `</div></section>`
      : `<p><em>${escape(game.i18n.localize("FGT.Declaration.Closed"))}</em></p>`)
    + `</div>`;
}
