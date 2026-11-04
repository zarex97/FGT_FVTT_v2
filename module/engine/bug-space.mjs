/**
 * @file Bug Space: holding a Unit off the board, and bringing it back.
 * @see module/rules/bug-space.mjs, CONTEXT.md, docs/superpowers/specs/2026-11-04-kazuradrop-clauses.md
 *
 * Layer 3. Every way in and out is here, and one line says each.
 *
 * A held Unit's token is hidden where it stood, as `io.banish` hides a Kagome
 * Spirit's, because an unlinked summon lives on its token. `system.heldIn` is the
 * one fact; `snapshotBoard` reads it, so nothing that walks the board meets the
 * Unit. An expiry is an absolute Tick, so the release pushes each one on by the
 * Ticks held: that is what *"durations are paused"* comes to (reading 31).
 */

import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { currentBoard, currentMoment, unitActor, unitOf } from "./board.mjs";
import { publicSpeakerFor, shownName } from "./public-identity.mjs";
import { pressGate } from "./press-gate.mjs";
import { forcedLandings } from "../rules/bug-space.mjs";

/**
 * A held Unit's token, on the canvas this client shows.
 *
 * @param {object} actor
 * @returns {object|null}
 */
function tokenOf(actor) {
  return actor?.getActiveTokens?.(false, true)?.[0]
    ?? (globalThis.canvas?.tokens?.placeables ?? []).find((t) => t.actor?.id === actor?.id)?.document ?? null;
}

/**
 * Everyone a holder holds, the unlinked too.
 *
 * @param {string} holderId
 * @returns {object[]} actors
 */
export function heldBy(holderId) {
  const out = new Map();
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) {
    if (t.actor?.system?.heldIn === holderId) out.set(t.actor.id, t.actor);
  }
  for (const a of globalThis.game?.actors ?? []) {
    if (a.system?.heldIn === holderId) out.set(a.id, a);
  }
  return [...out.values()];
}

/**
 * Post one line, spoken as the holder's public name.
 *
 * @param {object} holder
 * @param {string} key
 * @param {object} data
 * @returns {Promise<void>}
 */
async function say(holder, key, data) {
  await ChatMessage.create({
    content: `<div class="fgt-card"><p>${game.i18n.format(key, data)}</p></div>`,
    speaker: publicSpeakerFor(holder),
  });
}

/**
 * Take a Unit into a holder's Bug Space. A mount's riders are set down first, as
 * when a platform falls (reading 33), through the platform's own teardown.
 *
 * @param {object} holder the holder's document
 * @param {object} target the Unit's document
 * @returns {Promise<void>}
 */
export async function captureUnit(holder, target) {
  const board = currentBoard();
  const name = shownName(target, board);
  const { passengersOf } = await import("../rules/platforms.mjs");
  const riders = unitOf(target, board)?.kind === "platform" ? passengersOf(unitOf(target, board), board) : [];
  if (riders.length > 0) {
    const { scatterPanels } = await import("../rules/platforms.mjs");
    const landing = scatterPanels(riders, unitOf(target, board), board, () => CONFIG.Dice.randomUniform());
    await applyWorldIntents(Object.entries(landing).map(([unitId, to]) => I.move(unitId, [to], true)), "bugSpace:riders");
  }
  await target.update({
    "system.heldIn": holder.id,
    "system.heldSince": currentMoment().tick ?? 0,
    "system.heldStruck": false,
  });
  const token = tokenOf(target);
  if (token) await token.update({ hidden: true });
  await say(holder, "FGT.BugSpace.Captured", {
    holder: shownName(holder, board), name,
  });
}

/**
 * Bring Units back: its clocks pushed on, its token shown, placed, and said.
 *
 * @param {object} holder
 * @param {Array<{actor: object, panel: {i: number, j: number}|null}>} landings
 * @param {string} key the line
 * @returns {Promise<void>}
 */
async function bringBack(holder, landings, key) {
  const tick = currentMoment().tick ?? 0;
  const board = currentBoard();
  for (const { actor, panel } of landings) {
    const held = Math.max(0, tick - (actor.system?.heldSince ?? tick));
    await actor.update({ "system.heldIn": null, "system.heldSince": null, "system.heldStruck": false });
    const paused = [...(actor.effects ?? [])].filter((e) => e.system?.expiry !== null && e.system?.expiry !== undefined);
    const intents = held > 0 ? paused.map((e) => I.extendEffect(actor.id, e.id, held, "paused")) : [];
    if (panel) intents.push(I.move(actor.id, [panel], true));
    if (intents.length > 0) await applyWorldIntents(intents, "bugSpace:release");
    const token = tokenOf(actor);
    if (token) await token.update({ hidden: false });
    await say(holder, key, {
      holder: shownName(holder, board), name: shownName(actor, board),
      i: panel?.i ?? "?", j: panel?.j ?? "?",
    });
  }
}

/**
 * Force Units out onto random panels around a point (readings 38, 40, 45).
 *
 * @param {object} holder
 * @param {object[]} actors the Units coming out
 * @param {{i: number, j: number}|null} [around] where; the holder's panel by default
 * @returns {Promise<void>}
 */
export async function forceOut(holder, actors, around = null) {
  if ((actors ?? []).length === 0) return;
  const board = currentBoard();
  const at = around ?? unitOf(holder, board)?.panel ?? tokenPanel(holder);
  const units = actors.map((a) => ({ id: a.id, footprint: a.system?.footprint ?? { w: 1, h: 1 } }));
  const landed = forcedLandings(units, at, board, () => CONFIG.Dice.randomUniform());
  await bringBack(holder, actors.map((actor) => ({ actor, panel: landed[actor.id] ?? null })), "FGT.BugSpace.ForcedOut");
}

/**
 * A panel for a holder the board no longer lists: one that fell stands where it did.
 *
 * @param {object} holder
 * @returns {{i: number, j: number}}
 */
function tokenPanel(holder) {
  const token = tokenOf(holder);
  const size = globalThis.canvas?.grid?.size ?? 100;
  return token ? { i: Math.round((token.y ?? 0) / size), j: Math.round((token.x ?? 0) / size) } : { i: 0, j: 0 };
}

/**
 * Everyone comes out when their holder falls for good (reading 38). Guts keeps
 * them in, because a defeat a revival answers never reaches this.
 *
 * @param {object} holder
 * @returns {Promise<void>}
 */
export async function onHolderDefeated(holder) {
  await forceOut(holder, heldBy(holder.id));
}

/**
 * Put every Unit a sweeping NP strikes back on the board for that Attack, Effects
 * still paused (reading 40), and say who.
 *
 * @param {object} holder
 * @returns {Promise<string[]>} their ids
 */
export async function openForStrike(holder) {
  const held = heldBy(holder.id);
  for (const a of held) await a.update({ "system.heldStruck": true });
  return held.map((a) => a.id);
}

/**
 * The free release, on the holder's Turn: any number, each to a free panel within
 * a 2 panel area she picks (reading 37). No Cooldown, no NP.
 *
 * @param {object} holder
 * @returns {Promise<Array<{unitId?: string, summary: object}>>} rows for the card
 */
export async function pressRelease(holder) {
  const held = heldBy(holder.id);
  if (held.length === 0) {
    return [{ summary: { id: "bugSpaceEmpty", name: game.i18n.localize("FGT.BugSpace.Empty"), outcome: "applied", reason: null } }];
  }
  const { askOwner, chooseFor } = await import("./ask.mjs");
  const board = currentBoard();
  const picked = await chooseFor(holder, {
    title: game.i18n.localize("FGT.BugSpace.ReleaseTitle"),
    hint: game.i18n.localize("FGT.BugSpace.ReleaseHint"),
    min: 0,
    count: held.length,
    options: held.map((a) => ({ id: a.id, name: shownName(a, board) })),
  });
  const landings = [];
  for (const id of picked ?? []) {
    const actor = held.find((a) => a.id === id);
    if (!actor) continue;
    const self = unitOf(holder, currentBoard());
    const units = currentBoard().units ?? [];
    const taken = new Set(units.filter((u) => !u.defeated && (u.level ?? 0) === 0)
      .flatMap((u) => u.panels ?? (u.panel ? [u.panel] : [])).map((p) => `${p.i},${p.j}`));
    for (const l of landings) if (l.panel) taken.add(`${l.panel.i},${l.panel.j}`);
    const bounds = board.bounds ?? null;
    const offered = [];
    for (let i = self.panel.i - 2; i <= self.panel.i + 2; i += 1) {
      for (let j = self.panel.j - 2; j <= self.panel.j + 2; j += 1) {
        if (taken.has(`${i},${j}`) || i < (bounds?.iMin ?? 0) || j < (bounds?.jMin ?? 0)) continue;
        if (i > (bounds?.iMax ?? Infinity) || j > (bounds?.jMax ?? Infinity)) continue;
        offered.push({ i, j });
      }
    }
    const answer = await askOwner(holder, {
      kind: "pickPanels", panels: offered, labels: [shownName(actor, board)],
      hint: game.i18n.localize("FGT.BugSpace.PanelHint"),
    });
    const at = answer?.panels?.[0] ?? null;
    if (at && offered.some((p) => p.i === at.i && p.j === at.j)) landings.push({ actor, panel: { i: at.i, j: at.j } });
  }
  await bringBack(holder, landings, "FGT.BugSpace.Released");
  // The card's own row: it read "No effects were applied" over a Unit just released.
  return [{ summary: {
    id: "bugSpaceReleased",
    name: game.i18n.format("FGT.BugSpace.ReleasedCount", { count: landings.length }),
    outcome: "applied",
    reason: null,
  } }];
}

/**
 * Offer every held Unit its way out at its Player's Turn (Gilgamesh's clause).
 * Not awaited by the boundary: the Turn is open while the player decides.
 *
 * @param {string|null} factionId the side whose Turn starts
 * @returns {void}
 */
export function offerFromInside(factionId) {
  if (!factionId) return;
  const held = (globalThis.game?.actors ?? []).filter((a) => a.system?.heldIn && a.system?.factionId === factionId);
  for (const actor of held) {
    // The offer asks what the press asks: a Master who cannot pay got the offer, and
    // pressing it emptied Bug Space for nothing (found pressing EE.muryan.remove).
    const item = [...(actor.items ?? [])].find((i) => i.system?.fromInsideBugSpace
      && pressGate(actor, i, { asAttack: true, billsBudget: true }).ok);
    if (item) void askFromInside(actor, item);
  }
}

/**
 * @param {object} actor the Unit inside
 * @param {object} item its ability that works from inside
 * @returns {Promise<void>}
 */
async function askFromInside(actor, item) {
  const { chooseFor } = await import("./ask.mjs");
  const picked = await chooseFor(actor, {
    // fgt-name-ok: the Unit's own player's prompt
    title: item.name,
    hint: game.i18n.localize("FGT.BugSpace.FromInsideHint"),
    min: 0,
    count: 1,
    // fgt-offer-ok: `offerFromInside` asked this ability's gate before it asked this
    // fgt-name-ok: the Unit's own player's prompt
    options: [{ id: "use", name: item.name }],
  });
  if ((picked ?? []).includes("use")) await useFromInside(actor, item);
}

/**
 * Use an ability from inside. The sheet's order: everyone is released around the DU,
 * the DU is the holder he is inside, he hits her alone, then the seal lands on the
 * use, even on an Evade, which saves only the damage (reading 43).
 *
 * @param {object} actor
 * @param {object} item
 * @returns {Promise<void>}
 */
export async function useFromInside(actor, item) {
  const holder = unitActor(actor.system?.heldIn);
  if (!holder) return;
  const spec = item.system.fromInsideBugSpace;
  // Everyone coming out cannot be undone, so the gate is asked again first: the Turn
  // goes on while the player decides, and a Master can be hit below the price.
  const gate = pressGate(actor, item, { asAttack: true, billsBudget: true });
  if (!gate.ok) {
    const { usageRefusal } = await import("./attack-preflight.mjs");
    await ChatMessage.create({
      content: `<div class="fgt-card"><p>${game.i18n.format("FGT.BugSpace.FromInsideRefused", {
        name: shownName(actor, currentBoard()),
        reason: gate.usage.ok ? gate.budget.reason : usageRefusal(gate.usage, actor),
      })}</p></div>`,
      speaker: publicSpeakerFor(actor),
      whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
    });
    return;
  }
  await forceOut(holder, heldBy(holder.id));
  const { resolveAttack, sealFromInside } = await import("./attack.mjs");
  await resolveAttack({ attackerId: actor.id, abilityId: item.id, placement: { pathTargets: [holder.id] } });
  await sealFromInside({ attacker: actor, ability: item, holder, spec });
}
