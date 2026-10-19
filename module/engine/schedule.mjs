/**
 * @file Scheduled strikes: a Noble Phantasm activated now that lands later.
 * @see docs/21-combat-process.md, docs/25-turn-order-and-scheduler.md
 *
 * Layer 3. Proto Gil's *Enki: Sword of the End* is the first (#232): *"When
 * used, the panel which Proto Gil was standing on gains the 'Utnapishtim'
 * mark. 7◈ Turns after Enki was Activated, it hits a 13x13 panel area centered
 * on the 'Utnapishtim' panel ... If Proto Gil is defeated during those 7◈
 * Turns after Enki's Activation (and before it hits the board), the NP is
 * cancelled."* Appendix D has called this `kind: schedule` since the roster
 * was mapped; nothing built it.
 *
 * Four moments, as a channel has:
 *
 * - **activation** (`scheduleStrike`, from `resolveAttack` once the use is
 *   paid): the mark is placed where the caster stands and the strike recorded
 *   with an ABSOLUTE fire tick, as every duration in this game is (Ch. 04).
 *   Its `when: activation` riders land on the caster (Enki's "cannot Act").
 * - **shift** (`shiftStrikes`): Golden Rule's fallback, *"reduce the Turn
 *   count of Enki by 1 Turn"* (#232 reading 14), moves the fire tick.
 * - **fire** (`runScheduledStrikes`, at the Turn boundary): when the fire tick
 *   is reached the ability resolves as its caster's Attack from the mark, with
 *   his modifiers at that moment (reading 11), through `resolveAttack` itself.
 * - **cancel**: a caster who is defeated before it fires cancels it; the use
 *   stays spent and the Master's Health stays lost (reading 22). A Guts revival
 *   is not a defeat (reading 12): `defeated` is the final state.
 *
 * The record lives on the active Combat (`fgt.scheduledStrikes`), where the
 * match's other pending work (`fgt.deferred`) lives: it belongs to the match,
 * not to the caster's sheet, and a caster whose token has left the board must
 * still be found to be cancelled.
 */

import { currentBoard, currentMoment, unitOf, unitActor } from "./board.mjs";
import { parseTick, resolveTicks, expiryReached } from "../domain/tick.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { shownName, publicSpeakerFor } from "./public-identity.mjs";
import { warRule, currentWar } from "./war.mjs";

/** The name the table knows a Unit by (#232: a concealed caster is its class). */

const FLAG = "scheduledStrikes";

/**
 * The strikes the active match is waiting on.
 *
 * @param {object|null} [combat]
 * @returns {object[]}
 */
export function pendingStrikes(combat = currentWar() ?? null) {
  return [...(combat?.getFlag?.("fgt", FLAG) ?? [])];
}

/**
 * Record a strike and place its mark.
 *
 * @param {object} args
 * @param {object} args.ability the Item used
 * @param {object} args.attacker the caster's Actor
 * @param {object} args.self the caster's unit, from the board
 * @returns {Promise<object|null>} the strike recorded
 */
export async function scheduleStrike({ ability, attacker, self }) {
  const combat = currentWar() ?? null;
  const spec = ability?.system?.schedule ?? null;
  if (!combat || !spec || !self?.panel) return null;

  const tick = currentMoment().tick ?? 0;
  const ticks = resolveTicks(parseTick(spec.after ?? "1◈"), {
    turnsPerRound: warRule("turnsPerRound"),
  });
  const panel = { i: self.panel.i, j: self.panel.j };

  // The mark, through the one door a structure is placed by.
  let markId = null;
  if (spec.mark) {
    const { createStructure } = await import("./skill-use.mjs");
    const mark = await createStructure({ structureId: spec.mark }, ability, attacker, currentBoard());
    markId = mark?.id ?? null;
  }

  const strike = {
    id: foundry.utils.randomID(),
    ownerId: attacker.id,
    abilityId: ability.id,
    contentId: ability.system?.contentId ?? ability.id,
    name: ability.name,
    panel,
    activatedTick: tick,
    fireAt: tick + ticks,
    markId,
  };
  await combat.setFlag("fgt", FLAG, [...pendingStrikes(combat), strike]);

  // What the activation does to its user, now: Enki's *"Proto Gil cannot Act
  // for 1◈ Turns after this NP is Activated"* (`when: activation`).
  const { applySelfRiders, fireAbilityUsed } = await import("./skill-use.mjs");
  await applySelfRiders(ability, attacker, { when: "activation" });
  // The use is the activation. The hit later is not a second use.
  await fireAbilityUsed(attacker, ability);

  await applyWorldIntents([I.log({
    kind: "ability", event: "strikeScheduled", unitId: attacker.id, abilityId: ability.id,
    name: ability.name, panel, fireAt: strike.fireAt,
  })], `schedule:${ability.id}`);
  await ChatMessage.create({
    content: `<p>${game.i18n.format("FGT.Schedule.Activated", {
      name: ability.name, unit: shownName(attacker), after: spec.after ?? "", row: panel.i + 1, col: panel.j + 1,
    })}</p>`,
    speaker: publicSpeakerFor(attacker),
  });
  return strike;
}

/**
 * Move the fire tick of every strike this caster has pending.
 *
 * @param {string} ownerId
 * @param {number} delta ticks; negative brings it closer
 * @returns {Promise<number>} how many strikes moved
 */
export async function shiftStrikes(ownerId, delta, source = null) {
  const combat = currentWar() ?? null;
  const strikes = pendingStrikes(combat);
  if (!combat || delta === 0) return 0;
  let moved = 0;
  const next = strikes.map((s) => {
    if (s.ownerId !== ownerId) return s;
    moved += 1;
    return { ...s, fireAt: s.fireAt + delta };
  });
  if (moved === 0) return 0;
  await combat.setFlag("fgt", FLAG, next);
  // Said where the table reads it: a strike a Turn closer is a change every
  // player must plan around, and the clock is on no sheet (#232, found live).
  const tick = currentMoment().tick ?? 0;
  const owner = unitActor(ownerId);
  for (const s of next.filter((x) => x.ownerId === ownerId)) {
    await ChatMessage.create({
      content: `<p>${game.i18n.format("FGT.Schedule.Shifted", {
        name: s.name, unit: shownName(owner), source: source ?? "", left: Math.max(0, s.fireAt - tick),
      })}</p>`,
      speaker: publicSpeakerFor(owner),
    });
  }
  return moved;
}

/**
 * Fire, or cancel, every strike the boundary has reached.
 *
 * Claimed before anything awaits: the strike leaves the record first, so a
 * second boundary run cannot fire it twice (the check-then-act lesson).
 *
 * @param {number} tick the tick of the Turn that just ended
 * @returns {Promise<{fired: string[], cancelled: string[]}>}
 */
export async function runScheduledStrikes(tick) {
  const combat = currentWar() ?? null;
  const strikes = pendingStrikes(combat);
  const out = { fired: [], cancelled: [] };
  if (!combat || strikes.length === 0) return out;

  const due = [];
  const keep = [];
  for (const s of strikes) {
    const owner = unitActor(s.ownerId);
    if (!owner || owner.system?.defeated) due.push({ s, cancel: true });
    else if (expiryReached(s.fireAt, tick)) due.push({ s, cancel: false });
    else keep.push(s);
  }
  if (due.length === 0) return out;
  await combat.setFlag("fgt", FLAG, keep);

  for (const { s, cancel } of due) {
    await removeMark(s);
    if (cancel) {
      out.cancelled.push(s.id);
      await ChatMessage.create({
        content: `<p>${game.i18n.format("FGT.Schedule.Cancelled", {
          name: s.name, unit: shownName(unitActor(s.ownerId)),
        })}</p>`,
      });
      continue;
    }
    out.fired.push(s.id);
    await fireStrike(s);
  }
  return out;
}

/**
 * Resolve a strike as its caster's Attack, from the mark.
 *
 * Through `resolveAttack`, the one door every Attack passes, as a resumed
 * declaration: the budget, the price and the windows were all paid at the
 * activation. Its caster is read from the board NOW, standing on the mark's
 * panel for the targeting only, so the area is centred where the sheet says
 * and every modifier is the one he holds when it lands (reading 11).
 *
 * @param {object} strike
 * @returns {Promise<object|null>}
 */
async function fireStrike(strike) {
  const attacker = unitActor(strike.ownerId);
  const ability = attacker?.items?.get(strike.abilityId) ?? null;
  if (!attacker || !ability) return null;
  const board = currentBoard();
  const self = unitOf(attacker, board);
  const { resolveAttack } = await import("./attack.mjs");
  await ChatMessage.create({
    content: `<p>${game.i18n.format("FGT.Schedule.Fires", { name: strike.name, unit: shownName(attacker) })}</p>`,
    speaker: publicSpeakerFor(attacker),
  });
  try {
    return await resolveAttack({
      attackerId: attacker.id,
      abilityId: ability.id,
      placement: { scheduled: true, origin: strike.panel },
      resume: true,
      preflighted: {
        ok: true,
        self: { ...self, panel: strike.panel },
        ability,
        actionKind: "np",
        free: true,
        master: null,
        usage: null,
      },
    });
  } catch (err) {
    // Loud: a strike that does nothing is the costliest defect this project has.
    console.error(`FGT | ${strike.name} could not land:`, err);
    return null;
  }
}

/**
 * Take a strike's mark off the board.
 *
 * @param {object} strike
 * @returns {Promise<void>}
 */
async function removeMark(strike) {
  if (!strike.markId) return;
  const mark = unitActor(strike.markId);
  if (!mark) return;
  const scene = canvas?.scene ?? null;
  const tokens = scene ? scene.tokens.filter((t) => t.actorId === mark.id).map((t) => t.id) : [];
  if (tokens.length > 0) await scene.deleteEmbeddedDocuments("Token", tokens);
  await mark.delete();
}
