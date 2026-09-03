/**
 * @file Riding Attack — a Move that is also an Attack.
 * @see docs/08-board-and-geometry.md, module/rules/movement.mjs
 *
 * Layer 3. `rules/movement.mjs#ridingAttackPath` decides whether the line is
 * legal and who is on it; this moves the token and opens the Combat Phase.
 *
 * > *"Riding Attack: Can Attack all Units in its path while Moving in a
 * > straight line as its Normal Attack during its Turn. Cannot Attack or Move
 * > after it has stopped. Can be combined with Passenger Seat."*
 *
 * `GRANTS.ridingAttack` has been declared since grants were written and **no
 * engine ever read it**. The move resolves first and completely, and the units
 * it ran through are then the target list of ONE ordinary fan-out — which is
 * what keeps a Move-that-is-an-Attack from needing a Combat Process of its own.
 */

import { ridingAttackPath } from "../rules/movement.mjs";
import { hasGranted, GRANTS } from "../rules/granted.mjs";
import { currentBoard } from "./board.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";

/**
 * Ride through a line of enemies, attacking each.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {{i: number, j: number}} args.destination
 * @returns {Promise<{ok: boolean, reason?: string, hit?: string[], messageId?: string}>}
 */
export async function performRidingAttack({ unitId, destination }) {
  const actor = game.actors.get(unitId);
  if (!actor) return { ok: false, reason: "notFound" };

  const board = currentBoard();
  const unit = board.units.find((u) => u.id === unitId);
  if (!unit) return { ok: false, reason: "unplaced" };
  // Unlocked by Riding's Active for Medusa, permanent for Achilles — either
  // way the grant is what says it is available.
  if (!hasGranted(unit, GRANTS.ridingAttack)) return { ok: false, reason: "notGranted" };

  const verdict = affordableRide(unit);
  if (!verdict.ok) return verdict;

  const plan = ridingAttackPath(unit, destination, board);
  if (!plan.ok) return { ok: false, reason: plan.reason };

  // The MOVE, first and completely. `{fgtForced: true}` because the legality
  // was decided by `ridingAttackPath` rather than by the ordinary movement
  // validator — this is one action, not a Move followed by an Attack.
  const token = actor.getActiveTokens?.()[0]?.document;
  if (!token) return { ok: false, reason: "unplaced" };
  const size = canvas.scene.grid.size;
  await token.update(
    { x: destination.j * size, y: destination.i * size },
    { fgtForced: true },
  );

  // The MOVEMENT half of the bookkeeping, now. NOT `attacked` -- the attack
  // has not happened yet, and stamping it here makes `resolveAttack` refuse
  // the very call this function is about to make.
  await applyWorldIntents([I.markTurn(unitId, {
    moved: true, acted: true, usedRidingAttack: true,
    movedPanels: (unit.turnState?.movedPanels ?? 0) + plan.distance,
    moveSegments: (unit.turnState?.moveSegments ?? 0) + 1,
    // *"Cannot Attack or Move after it has stopped."* Riding's Double Move
    // does not reopen after a Riding Attack, which is the one place the two
    // passives would otherwise disagree.
    mayMoveAgain: false,
  })], "ridingAttack:move");

  // ONE fan-out, as a Normal Attack. Every unit on the line is a defender of
  // the same Combat Phase, which is what "Attack all Units in its path" is --
  // and `resolveAttack` stamps `attacked` and bills the pool itself.
  if (plan.hits.length === 0) {
    // A ride that reached nobody still spends the action.
    await budget.spend({ combat: game.combats.active, unit, action: "ridingAttack" });
    await applyWorldIntents([I.markTurn(unitId, { attacked: true })], "ridingAttack:spent");
    return { ok: true, hit: [] };
  }

  const { resolveAttack } = await import("./attack.mjs");
  const result = await resolveAttack({
    attackerId: unitId,
    abilityId: null,
    placement: { pathTargets: plan.hits.map((u) => u.id) },
  });
  return { ok: true, hit: plan.hits.map((u) => u.id), messageId: result?.messageId ?? null };
}

/**
 * Can this unit pay for a Riding Attack at all?
 * @param {object} unit
 * @returns {{ok: boolean, reason?: string}}
 */
function affordableRide(unit) {
  if (unit.turnState?.attacked) return { ok: false, reason: "alreadyAttacked" };
  const verdict = budget.affordable(game.combats.active, unit, "ridingAttack");
  return verdict.ok ? { ok: true } : { ok: false, reason: verdict.reason ?? "cannotAct" };
}
