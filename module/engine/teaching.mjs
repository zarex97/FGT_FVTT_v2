/**
 * @file Teaching a copied Skill: Wisdom of Divine Gift's second Active (#326).
 * @see docs/17-abilities.md, docs/superpowers/specs/2026-10-23-chiron-clauses.md
 *
 * Layer 3. > *"Chiron is able to teach one of the copied Skills to another
 * Servant. Both Masters must agree to this teaching, and both Chiron and the
 * learning Servant must be directly next to each other. The teaching process
 * lasts for 1◈ Turns; Chiron and the learning Servant cannot Act until the
 * teaching process is complete, and the teaching process is cancelled if
 * interrupted (e.g. enemy Servant Attack)."*
 *
 * Four moments, as a scheduled strike has:
 *
 * - **start** (`startTeaching`, the `teach` phase): the teacher picks one of his
 *   copies the learner does not hold; the learner's controller agrees, unless one
 *   player holds both (ruling 10c); both carry `cannotAct` for the span (11a) and
 *   the same record, `system.teaching`.
 * - **complete** (`runTeachings`, at the Turn boundary its span ends at): the
 *   learner gains a copy of the copy, at its Rank and clock, and the teacher keeps
 *   his (ruling 9). A learner holds one Skill learned from him (10g).
 * - **cancel** (`cancelTeaching`): an enemy Unit's Attack that reaches its Damage
 *   Step on either, a Blocked one included (11b, 11d); a defeat; a parting (11b).
 *   Nothing else: a tick or a Burn does not (11c).
 * - **said**: every one of them is a line.
 *
 * The record is on both Units, so either one's interruption finds the pair.
 */

import { currentBoard, currentMoment, unitOf, unitActor } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { shownName } from "./public-identity.mjs";
import { warRule } from "./war.mjs";
import { parseTick, resolveTicks, expiryReached } from "../domain/tick.mjs";
import { chebyshev } from "../domain/geometry.mjs";
import { relationOf } from "../rules/relations.mjs";

/** Every reason a teaching is refused or ends, each with a line. */
export const TEACH_REASONS = Object.freeze(["alreadyLearned", "nothingToTeach", "teaching", "notAServant", "notAdjacent"]);
export const TEACH_CANCEL_CAUSES = Object.freeze(["hit", "defeated", "apart"]);

/**
 * The copies this teacher may teach this learner, or why none.
 *
 * His copies are those his copy grant made; one the learner already holds, by
 * its source or as a copy of it, is left out (ruling 10h). A learner who has
 * learned from him already is refused (10g).
 *
 * @param {object} teacher an Actor
 * @param {object} learner an Actor
 * @returns {{ok: true, copies: object[]}|{ok: false, reason: string}}
 */
export function teachableCopies(teacher, learner) {
  if (!teacher || !learner || learner.type !== "servant" || learner.id === teacher.id) return { ok: false, reason: "notAServant" };
  if ([...learner.items].some((i) => i.system?.taughtBy === teacher.id)) return { ok: false, reason: "alreadyLearned" };
  if (teacher.system?.teaching || learner.system?.teaching) return { ok: false, reason: "teaching" };
  const holds = new Set([...learner.items].flatMap((i) => [i.system?.contentId, i.system?.copiedFrom]).filter(Boolean));
  const copies = [...teacher.items].filter((i) => i.system?.copiedFrom && !i.system?.taughtBy && !holds.has(i.system.copiedFrom));
  return copies.length ? { ok: true, copies } : { ok: false, reason: "nothingToTeach" };
}

/**
 * Who answers for this actor: its player, or the GM when none is connected.
 * @param {object} actor
 * @returns {object|null} a User
 */
function controllerOf(actor) {
  return game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"))
    ?? game.users.find((u) => u.active && u.isGM) ?? game.user;
}

/**
 * The `teach` phase: pick, agree, and begin.
 *
 * @param {object} args
 * @param {object} args.teacher an Actor
 * @param {string} args.learnerId
 * @param {object} args.phase `{duration}`
 * @returns {Promise<Array<{unitId: string, summary: object}>>} the press card's rows
 */
export async function startTeaching({ teacher, learnerId, phase }) {
  const learner = unitActor(learnerId);
  const row = (outcome, name, reason = null) => [{
    unitId: teacher.id, summary: { id: "teach", name, outcome, reason },
  }];
  const offer = teachableCopies(teacher, learner);
  if (!offer.ok) return row("failed", game.i18n.localize(`FGT.Teach.Refused.${offer.reason}`), offer.reason);
  const board = currentBoard();
  const a = unitOf(teacher, board), b = unitOf(learner, board);
  if (!a?.panel || !b?.panel || chebyshev(a.panel, b.panel) > 1) {
    return row("failed", game.i18n.localize("FGT.Teach.Refused.notAdjacent"), "notAdjacent");
  }

  // Which copy: the teacher's player picks.
  const { chooseFor, askOwner } = await import("./ask.mjs");
  const picked = await chooseFor(teacher, {
    title: game.i18n.localize("FGT.Teach.ChooseTitle"),
    options: offer.copies.map((c) => ({ id: c.id, name: c.name })),
    count: 1,
  });
  const copy = offer.copies.find((c) => (picked ?? []).includes(c.id)) ?? null;
  if (!copy) return row("failed", game.i18n.localize("FGT.Teach.NoPick"), "declined");

  // The learner's side agrees, unless one player holds both (ruling 10c).
  if (controllerOf(learner)?.id !== controllerOf(teacher)?.id) {
    const answer = await askOwner(learner, {
      kind: "confirm",
      title: game.i18n.localize("FGT.Teach.ConsentTitle"),
      hint: game.i18n.format("FGT.Teach.ConsentAsk", { teacher: shownName(teacher, board), skill: copy.name }),
    });
    if (!answer?.accepted) {
      await say("FGT.Teach.Declined", { teacher: shownName(teacher, board), learner: shownName(learner, board), skill: copy.name });
      return row("failed", game.i18n.localize("FGT.Teach.DeclinedRow"), "declined");
    }
  }

  const tick = currentMoment().tick ?? 0;
  const endsAt = tick + resolveTicks(parseTick(String(phase?.duration ?? "1◈")), { turnsPerRound: warRule("turnsPerRound") });
  const record = { teacherId: teacher.id, learnerId: learner.id, copyId: copy.id, skill: copy.name, startedAt: tick, endsAt };
  const lock = (id) => I.applyEffect(id, { defId: "cannotAct", magnitude: 0, expiry: endsAt, sourceUnitId: teacher.id }, teacher.id);
  await applyWorldIntents([
    I.teaching(teacher.id, record), I.teaching(learner.id, record), lock(teacher.id), lock(learner.id),
  ], "teach:start");
  const line = game.i18n.format("FGT.Teach.Begins", {
    teacher: shownName(teacher, board), learner: shownName(learner, board), skill: copy.name, turns: endsAt - tick,
  });
  return row("applied", line);
}

/**
 * Complete every teaching whose span ended with the Turn that ended.
 *
 * @param {number} tick the tick of the Turn that just ended
 * @returns {Promise<string[]>} the learners taught
 */
export async function runTeachings(tick) {
  const taught = [];
  for (const teacher of teachers()) {
    const record = teacher.system.teaching;
    if (!expiryReached(record.endsAt, tick)) continue;
    const learner = unitActor(record.learnerId);
    const copy = teacher.items.get(record.copyId) ?? null;
    if (!learner || !copy) { await cancelTeaching(record, "apart"); continue; }
    if (apart(record)) { await cancelTeaching(record, "apart"); continue; }
    await applyWorldIntents([I.teaching(teacher.id, null), I.teaching(learner.id, null)], "teach:complete");
    const { grantTaughtCopy } = await import("./copy.mjs");
    await grantTaughtCopy({ teacher, learner, copy });
    const board = currentBoard();
    await say("FGT.Teach.Learned", { teacher: shownName(teacher, board), learner: shownName(learner, board), skill: copy.name });
    taught.push(learner.id);
  }
  return taught;
}

/**
 * End a teaching early: both records cleared, both locks lifted, and a line.
 *
 * @param {object} record the pair's `system.teaching`
 * @param {"hit"|"defeated"|"apart"} cause
 * @returns {Promise<void>}
 */
export async function cancelTeaching(record, cause) {
  const ids = [record.teacherId, record.learnerId];
  const intents = [];
  for (const id of ids) {
    const doc = unitActor(id);
    if (!doc) continue;
    intents.push(I.teaching(id, null));
    // Only the teaching's own lock: another `cannotAct` (Enki's) stays.
    for (const e of doc.effects ?? []) {
      if (e.system?.defId === "cannotAct" && e.system?.sourceUnitId === record.teacherId) intents.push(I.removeEffect(id, e.id, "teachingCancelled"));
    }
  }
  if (intents.length) await applyWorldIntents(intents, `teach:cancel:${cause}`);
  const board = currentBoard();
  await say(`FGT.Teach.Cancelled.${cause}`, {
    teacher: shownName(unitActor(record.teacherId), board), learner: shownName(unitActor(record.learnerId), board), skill: record.skill,
  });
}

/**
 * A Process that reached its Damage Step on a Unit teaching or learning, from
 * an enemy: the teaching ends (rulings 11b, 11d). A miss, an Evade or a Dodge
 * never reaches it; a Block does.
 *
 * @param {object} state the Combat Process state, complete
 * @returns {Promise<boolean>} whether one ended
 */
export async function cancelTeachingOnHit(state) {
  const defender = unitActor(state?.defenderId);
  const record = defender?.system?.teaching;
  if (!record) return false;
  if (!(state.history ?? []).some((h) => h.state === "damage")) return false;
  const board = currentBoard();
  const attacker = unitOf(unitActor(state.attackerId), board);
  if (!attacker || relationOf(attacker, unitOf(defender, board), board) !== "enemy") return false;
  await cancelTeaching(record, "hit");
  return true;
}

/**
 * A defeated teacher or learner ends the teaching.
 * @param {string} unitId
 * @returns {Promise<boolean>}
 */
export async function cancelTeachingOf(unitId) {
  const record = unitActor(unitId)?.system?.teaching;
  if (!record) return false;
  await cancelTeaching(record, "defeated");
  return true;
}

/**
 * Every pair no longer next to each other: Moved apart ends it (ruling 11b).
 * @returns {Promise<number>} how many ended
 */
export async function cancelTeachingsApart() {
  let ended = 0;
  for (const teacher of teachers()) {
    if (!apart(teacher.system.teaching)) continue;
    await cancelTeaching(teacher.system.teaching, "apart");
    ended += 1;
  }
  return ended;
}

/** The GM ends a parting once a Move has settled. */
export function attachTeaching() {
  Hooks.on("updateToken", (token, changes) => {
    if (!game.user?.isGM || (changes?.x === undefined && changes?.y === undefined)) return;
    if (!teachers().length) return;
    const run = () => cancelTeachingsApart().catch((err) => console.error("FGT | Teaching:", err));
    const settling = token.object?.movementAnimationPromise ?? null;
    if (settling) settling.then(run, run);
    else run();
  });
}

/** Every Unit teaching now, by its own record. @returns {object[]} */
function teachers() {
  return [...(game.actors ?? [])].filter((a) => a.system?.teaching?.teacherId === a.id);
}

/** @param {object} record @returns {boolean} */
function apart(record) {
  const board = currentBoard();
  const a = unitOf(unitActor(record.teacherId), board);
  const b = unitOf(unitActor(record.learnerId), board);
  return !a?.panel || !b?.panel || chebyshev(a.panel, b.panel) > 1;
}

/** @param {string} key @param {object} data */
async function say(key, data) {
  await ChatMessage.create({ content: `<div class="fgt-card"><p>${game.i18n.format(key, data)}</p></div>` });
}
