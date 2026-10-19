/**
 * @file A Feigned Defeat: offered on a fatal hit, staged for the table, ended by a reveal.
 * @see CONTEXT.md (Feigned Defeat), docs/30-concealment-and-identity.md, rules/untouchable.mjs
 *
 * Katō Danzō's Kirihanasu (#249 readings 15-19, 25-35, 39). An Attack's hit that
 * would bring her to 0 after every floor is offered to her owner, privately,
 * before it lands. Taken, she receives neither its damage nor its riders, the
 * Attack ends for her, and her own phases make her a ghost: Presence Concealment
 * with no expiry, and a free escape Move under the ghost's rules.
 *
 * What the table sees is the part this file owns. Every player but hers is shown
 * the defeat card a real defeat posts (`engine/defeat-card.mjs`) and a skulled
 * body where she fell, cleared at the Turn's end as a body is; her token is
 * hidden from them (`rules/concealment.mjs#hiddenFromViewer`). Her owner and the
 * GM are told the truth. No defeat rule fires: no `io.defeat`, no Grail count,
 * no kill credit, and her Contract stands.
 *
 * Her next Attack, or a tick that brings her to 0, reveals her
 * (`revealFeignedDefeat`).
 */

import * as I from "./intents.mjs";
import { unitActor, currentBoard, currentMoment, unitFrom } from "./board.mjs";
import { askOwner, chooseFor } from "./ask.mjs";
import { windowsOf, FATAL_HIT_WINDOW } from "../rules/windows.mjs";
import { currentHealth } from "../domain/health.mjs";
import { FEIGNED_DEFEAT } from "../rules/untouchable.mjs";
import { postDefeatCard } from "./defeat-card.mjs";
import { warRule } from "./war.mjs";

/** The flag a body's stand-in carries, on the Tiles that draw it. */
const DECOY_FLAG = "decoyOf";

/**
 * Users who see the truth: the GM and the Unit's OWNERS (#249 reading 34).
 *
 * @param {object} actor
 * @returns {string[]}
 */
function truthAudience(actor) {
  return game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id);
}

/**
 * Users who are shown the defeat: everyone else.
 *
 * @param {object} actor
 * @returns {string[]}
 */
function deceivedAudience(actor) {
  const truth = new Set(truthAudience(actor));
  return game.users.filter((u) => !truth.has(u.id)).map((u) => u.id);
}

/**
 * The fatal hit's offer, before the damage is written.
 *
 * Only an Attack's hit (`plainDamage` is a shove measured as one), only one
 * that empties the bar after every floor, and only an ability the use gate
 * passes at the window. Asked of her owner alone; silence is no.
 *
 * @param {object} args
 * @param {object} args.state the Combat Process
 * @param {object} args.defender the defender's snapshot
 * @param {number} args.total the damage about to land
 * @returns {Promise<{abilityId: string, fellAt: object|null}|null>} what was used, or nothing
 */
export async function offerFeignedDefeat({ state, defender, total }) {
  if (state.attack?.plainDamage || !defender?.id) return null;
  if (!(total > 0) || total < currentHealth(defender)) return null;
  const actor = unitActor(defender.id);
  if (!actor || actor.system?.defeated) return null;

  const { offerable } = await import("./press-gate.mjs");
  const offers = offerable(actor, [...(actor.items ?? [])].filter((i) => i.system?.insteadOfDamage
    && windowsOf(i.system?.timing ?? {}).includes(FATAL_HIT_WINDOW)), { atWindow: true, target: null, asAttack: false });
  if (offers.length === 0) return null;

  const picked = await askOwner(actor, {
    kind: "choose",
    title: game.i18n.localize("FGT.Feigned.OfferTitle"),
    // fgt-name-ok: her own player's prompt; her owner knows the name
    hint: game.i18n.format("FGT.Feigned.OfferHint", { name: actor.name, damage: total }),
    min: 0,
    count: 1,
    options: offers.map((i) => ({ id: i.id, name: i.name })),
  });
  const chosen = offers.find((i) => (picked ?? []).includes(i.id));
  if (!chosen) return null;

  const fellAt = defender.panel ? { ...defender.panel } : null;
  const { useSkill } = await import("./skill-use.mjs");
  const out = await useSkill({ actorId: actor.id, abilityId: chosen.id, atWindow: true, placement: { unitId: actor.id } });
  if (!out?.ok) return null;
  return { abilityId: chosen.id, fellAt };
}

/**
 * What the table is shown: the defeat, to everyone deceived; the truth, to hers.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string|null} args.killerId the attacker the table believes killed her
 * @param {{i: number, j: number}|null} args.fellAt where she fell, for the body
 * @returns {Promise<void>}
 */
export async function stageFeignedDefeat({ unitId, killerId, fellAt }) {
  const actor = unitActor(unitId);
  if (!actor) return;
  const deceived = deceivedAudience(actor);
  // The same card a real defeat posts, to the same eyes but hers (reading 33).
  if (deceived.length > 0) await postDefeatCard(unitId, killerId, { whisper: deceived, feigned: true });
  await ChatMessage.create({
    content: `<div class="fgt-card fgt-card--defeat"><p>${game.i18n.format("FGT.Feigned.Truth", {
      // fgt-name-ok: whispered to the GM and her owners, who know her
      name: foundry.utils.escapeHTML(actor.name),
    })}</p></div>`,
    whisper: truthAudience(actor),
    flags: { fgt: { feignedDefeat: { unitId } } },
  });
  if (fellAt) await placeDecoy(actor, fellAt);
}

/**
 * A skulled body where she fell, drawn for every player but her owners.
 *
 * Two Tiles, her portrait and the skull a defeated token wears, flagged so the
 * canvas shows them only to the deceived (`apps/canvas/decoy.mjs`) and so the
 * Turn's end clears them as it clears a body (`clearDecoys`).
 *
 * @param {object} actor
 * @param {{i: number, j: number}} panel
 * @returns {Promise<void>}
 */
async function placeDecoy(actor, panel) {
  const scene = canvas?.scene;
  const token = actor.getActiveTokens?.()[0]?.document ?? null;
  if (!scene || !token) return;
  const point = canvas.grid.getTopLeftPoint(panel);
  const size = { width: token.width * canvas.grid.size, height: token.height * canvas.grid.size };
  const fellAt = currentMoment().tick;
  const flags = { fgt: { [DECOY_FLAG]: actor.id, fellAt } };
  await scene.createEmbeddedDocuments("Tile", [
    { x: point.x, y: point.y, ...size, texture: { src: token.texture.src }, flags },
    { x: point.x, y: point.y, ...size, texture: { src: "icons/svg/skull.svg" }, alpha: 0.85, flags },
  ]);
}

/**
 * Remove a ghost's stand-in body: at its reveal, or once its Turn has passed.
 *
 * @param {{unitId?: string|null, before?: number|null}} [which] one ghost's, or every body that fell before a tick
 * @returns {Promise<void>}
 */
export async function clearDecoys({ unitId = null, before = null } = {}) {
  const scene = canvas?.scene;
  if (!scene) return;
  const ids = [...(scene.tiles ?? [])].filter((t) => {
    const of = t.getFlag?.("fgt", DECOY_FLAG);
    if (!of) return false;
    if (unitId) return of === unitId;
    const at = t.getFlag?.("fgt", "fellAt");
    return before !== null && at !== null && at < before;
  }).map((t) => t.id);
  if (ids.length > 0) await scene.deleteEmbeddedDocuments("Tile", ids);
}

/**
 * Whether a Tile is a ghost's stand-in body, and whose.
 *
 * @param {object} tileDocument
 * @returns {string|null} the ghost's id
 */
export function decoyOf(tileDocument) {
  return tileDocument?.getFlag?.("fgt", DECOY_FLAG) ?? null;
}

/**
 * End a Feigned Defeat: her Attack, or a tick that empties her bar.
 *
 * *"The Presence Concealment activated by Kirihanasu is Active until Danzō
 * Attacks, and her survived existence is revealed to all other players at this
 * point"* (readings 18, 27, 29-31). On a panel another Unit holds, her player
 * picks one of the nearest free panels first, and she is moved there -- not a
 * Knockback: she is the one who arrived. The marker goes, the body goes, and
 * one public card says she lives. Presence Concealment itself is left to the
 * Attack: PC.5 ends it after the Process, or a held Funshindan roll keeps it,
 * then as an ordinary Rank A with its 2◈ from now.
 *
 * @param {string} unitId
 * @param {{relocate?: boolean}} [opts] `relocate: false` for a reveal that is not an Attack (a tick)
 * @returns {Promise<boolean>} whether anything was revealed
 */
export async function revealFeignedDefeat(unitId, { relocate = true } = {}) {
  const actor = unitActor(unitId);
  const marker = [...(actor?.effects ?? [])].find((e) => e.system?.defId === FEIGNED_DEFEAT);
  if (!marker) return false;

  if (relocate) await stepOffSharedPanel(actor);
  // The permanent concealment becomes an ordinary one: 2◈ from now, from which
  // PC.5 or its other ends take it as usual (reading 31).
  const pc = [...actor.effects].find((e) => e.system?.defId === "presenceConcealment" && e.system?.expiry == null);
  const intents = [I.removeEffect(actor.id, marker.id, "revealed")];
  if (pc) {
    const { parseTick, resolveTicks } = await import("../domain/tick.mjs");
    const span = resolveTicks(parseTick("2◈"), { turnsPerRound: warRule("turnsPerRound") });
    intents.push(I.extendEffect(actor.id, "presenceConcealment", span, FEIGNED_DEFEAT, currentMoment().tick ?? 0));
  }
  const { applyWorldIntents } = await import("./applier.mjs");
  await applyWorldIntents(intents, "feigned:reveal");
  await clearDecoys({ unitId });

  const { shownName } = await import("./public-identity.mjs");
  await ChatMessage.create({
    content: `<div class="fgt-card fgt-card--defeat"><p><strong>${game.i18n.format("FGT.Feigned.Revealed", {
      name: foundry.utils.escapeHTML(shownName(actor, currentBoard())),
    })}</strong></p></div>`,
    flags: { fgt: { feignedDefeat: { unitId, revealed: true } } },
  });
  Hooks.callAll("fgt.feignedDefeatRevealed", { unitId });
  return true;
}

/**
 * Off a panel another Unit holds, to the nearest free one her player picks.
 *
 * @param {object} actor
 * @returns {Promise<void>}
 */
async function stepOffSharedPanel(actor) {
  const board = currentBoard();
  const self = unitFrom(board, actor);
  if (!self?.panel) return;
  const shared = (board.units ?? []).some((u) => u.id !== self.id && !u.defeated
    && (u.panels ?? [u.panel]).some((p) => p && p.i === self.panel.i && p.j === self.panel.j));
  if (!shared) return;

  const geo = await import("../domain/geometry.mjs");
  const taken = new Set((board.units ?? []).filter((u) => u.id !== self.id)
    .flatMap((u) => (u.panels ?? [u.panel]).filter(Boolean)).map((p) => `${p.i},${p.j}`));
  /** @type {Array<{i: number, j: number}>} */
  let nearest = [];
  for (let r = 1; r <= 20 && nearest.length === 0; r += 1) {
    nearest = geo.chebyshevDisc(self.panel, r, board.bounds ?? null)
      .filter((p) => geo.chebyshev(p, self.panel) === r && !taken.has(`${p.i},${p.j}`));
  }
  if (nearest.length === 0) return;
  let to = nearest[0];
  if (nearest.length > 1) {
    const [picked] = await chooseFor(actor, {
      // fgt-name-ok: her own player's prompt
      title: game.i18n.localize("FGT.Feigned.StepOffTitle"),
      hint: game.i18n.localize("FGT.Feigned.StepOffHint"),
      count: 1,
      min: 1,
      options: nearest.map((p) => ({ id: `${p.i},${p.j}`, name: `(${p.i}, ${p.j})` })),
    }) ?? [];
    const [i, j] = String(picked ?? `${to.i},${to.j}`).split(",").map(Number);
    to = { i, j };
  }
  const { applyWorldIntents } = await import("./applier.mjs");
  await applyWorldIntents([I.move(actor.id, [to], true)], "feigned:stepOff");
}

/**
 * The Turn's end clears a ghost's stand-in body, as it clears a real one.
 *
 * GM only. Called from `ready`.
 */
export function attachFeignedDefeat() {
  Hooks.on("updateCombat", (_combat, change) => {
    if (!game.user?.isGM || !foundry.utils.hasProperty(change ?? {}, "system")) return;
    const now = currentMoment().tick;
    if (now === null) return;
    clearDecoys({ before: now }).catch((err) => console.error("FGT | Clearing a feigned body:", err));
  });
}
