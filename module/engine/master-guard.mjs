/**
 * @file Cases 2 and 3 of attacking a guarded Master, at the start of the Combat Phase (#181).
 * @see module/rules/master-guard.mjs, docs/32-relationships.md
 *
 * Layer 3. Case 1 is refused at targeting (`rules/targeting/resolve.mjs`), so
 * an Attack that reaches here was legally aimed at the Master. Case 2 changes
 * the target to the adjacent guard; case 3 has each guard within 2 make an
 * Agility Check against the attacker, nearest the Master first, until one
 * succeeds, moves next to its Master and takes the Attack.
 */

import { currentBoard } from "./board.mjs";
import { displaceToken } from "./io.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { guardCase, guardLanding } from "../rules/master-guard.mjs";
import { canStopOn } from "../rules/movement.mjs";
import { checkPlan, resolveCheck, tableFor } from "../rules/checks.mjs";

/**
 * Who the Attack lands on: the Master, or the guard that took it.
 *
 * @param {object} args
 * @param {string} args.attackerId
 * @param {string} args.targetId the Master the Attack was aimed at
 * @returns {Promise<string|null>} the guard's id when the target changed, else `null`
 */
export async function guardMasterTarget({ attackerId, targetId }) {
  const board = currentBoard();
  const master = (board.units ?? []).find((u) => u.id === targetId);
  const attacker = (board.units ?? []).find((u) => u.id === attackerId);
  if (!master || master.kind !== "master" || !attacker) return null;

  const decision = guardCase(master, attacker, board);
  if (decision.kind === "redirect") {
    await report(master, decision.guardId, board, { case: 2 });
    return decision.guardId;
  }
  if (decision.kind !== "check") return null;

  /** @type {object[]} */
  const rolls = [];
  for (const guardId of decision.order) {
    const guard = (board.units ?? []).find((u) => u.id === guardId);
    if (!guard) continue;
    const landing = guardLanding(guard, master, attacker, board, (p) => canStopOn(p, guard, board));
    // "The nearest panel which is directly next to their Master": with none
    // free, nobody can make the move, so no check is made (ruled 2026-10-04).
    if (!landing) break;

    // An Agility Check AGAINST the attacker: the table is the contest's, and
    // the plan is the Agility Check's own -- never an Evade's, so Innocent
    // World's Evade +4 does not help a guard step in.
    const roll = await new Roll("1d20").evaluate();
    const plan = checkPlan(guard, "agility");
    const outcome = resolveCheck({
      roll: roll.total,
      target: guard.agility,
      table: plan.forceTable ?? tableFor(guard.agility, attacker.agility),
      modifiers: plan.modifiers,
    });
    rolls.push({ unitId: guard.id, name: guard.name, roll: roll.total, total: outcome.total, target: guard.agility, success: outcome.success });
    if (!outcome.success) continue;

    const token = game.actors.get(guard.id)?.getActiveTokens?.()[0]?.document
      ?? canvas?.scene?.tokens?.find((t) => t.actorId === guard.id) ?? null;
    if (token) {
      await displaceToken(token, { x: landing.j * canvas.scene.grid.size, y: landing.i * canvas.scene.grid.size });
    }
    await report(master, guard.id, board, { case: 3, panel: landing, rolls });
    return guard.id;
  }
  if (rolls.length > 0) await report(master, null, board, { case: 3, rolls });
  return null;
}

/**
 * The log entry and the public line: who the Attack now lands on, and why.
 *
 * @param {object} master
 * @param {string|null} guardId
 * @param {object} board
 * @param {object} detail
 * @returns {Promise<void>}
 */
async function report(master, guardId, board, detail) {
  const guard = guardId ? (board.units ?? []).find((u) => u.id === guardId) : null;
  await applyWorldIntents([I.log({
    kind: "masterGuard", event: guard ? "redirected" : "held", masterId: master.id, guardId, ...detail,
    tick: game.combat?.system?.globalTurn ?? 0,
  })], "masterGuard");
  const rolls = (detail.rolls ?? [])
    .map((r) => game.i18n.format("FGT.MasterGuard.Roll", { name: r.name, roll: r.roll, total: r.total, target: r.target, outcome: game.i18n.localize(r.success ? "FGT.MasterGuard.Success" : "FGT.MasterGuard.Fail") }))
    .map((line) => `<li>${line}</li>`).join("");
  const headline = guard
    ? game.i18n.format(detail.case === 2 ? "FGT.MasterGuard.Redirected" : "FGT.MasterGuard.SteppedIn", { guard: guard.name, master: master.name })
    : game.i18n.format("FGT.MasterGuard.Held", { master: master.name });
  await ChatMessage.create({ content: `<p>${headline}</p>${rolls ? `<ul>${rolls}</ul>` : ""}` });
}
