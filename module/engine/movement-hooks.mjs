/**
 * @file Enforcing movement legality and spending the move budget.
 * @see docs/08-board-and-geometry.md §8.3, docs/18-action-economy.md
 *
 * Layer 3. Foundry's own drag-and-drop is the movement interface; this makes it
 * obey the rules.
 *
 * `preMoveToken` is the veto point — returning `false` rejects the movement
 * before anything is written, and the ruler the player is dragging snaps back.
 * `moveToken` then records what it cost, because the distance is only known
 * once the move is real.
 *
 * The cost function on `TokenDocument.move` would be the more elegant hook, but
 * it can be bypassed by a direct `update()`; `preMoveToken` cannot, so the
 * authoritative check lives here (Ch. 08 §8.3).
 */

import { validatePath, remainingMovement, segmentCheck } from "../rules/movement.mjs";
import { unitSnapshot, currentBoard } from "./board.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";

export const Movement = {
  /** Register the hooks. */
  attach() {
    Hooks.on("preMoveToken", onPreMove);
    Hooks.on("moveToken", onMove);
    console.log("FGT | Movement rules attached");
  },
};

/**
 * Reject an illegal movement before it is written.
 *
 * Out of combat nothing is enforced: a GM arranging a scene is not spending a
 * turn budget, and a system that fights them while they set up is a system they
 * turn off.
 *
 * @param {object} document the `TokenDocument`
 * @param {object} movement the movement operation
 * @returns {boolean} `false` rejects it
 */
function onPreMove(document, movement) {
  const combat = game.combats.active;
  if (!combat?.started) return true;
  if (movement?.method === "undo" || movement?.method === "reset") return true;
  // Forced movement -- knockback, Gather -- is displacement, not movement, and
  // is not subject to the mover's own legality or budget (Ch. 08 §8.3).
  if (movement?.forced || movement?.options?.fgtForced) return true;

  const actor = document.actor;
  if (!actor) return true;

  const unit = unitSnapshot(actor, document);

  // A unit may only move on its own faction's turn. The GM is exempt: placing
  // and correcting the board is not taking a turn, and a system that fights the
  // GM during setup is a system they switch off.
  //
  // Said out loud, with the current faction named. "Nothing happens when I drag
  // the token" is the least debuggable failure this hook can produce, and it is
  // the one it produced most.
  if (!game.user.isGM) {
    const acting = combat.actingFactionId ?? null;
    if (unit.factionId && acting && unit.factionId !== acting) {
      ui.notifications.warn(game.i18n.format("FGT.Movement.NotYourTurn", {
        name: actor.name,
        faction: combat.combatant?.name ?? acting,
      }));
      return false;
    }
  }

  const board = boardSnapshot(combat);

  const path = pathOf(movement);
  const verdict = validatePath(path, unit, board, { hasRiding: unit.hasRiding });
  if (!verdict.ok) {
    ui.notifications.warn(`FGT | ${verdict.reasons[0]}`);
    return false;
  }

  const affordable = budget.affordable(combat, unit, "move");
  // A unit that has already been counted this turn moves again for free; only a
  // *new* unit consumes a pool slot, which is what the budget's unit-counting
  // rule means in practice.
  if (!affordable.ok && !unit.turnState?.moved) {
    ui.notifications.warn(`FGT | ${affordable.reason}`);
    return false;
  }
  return true;
}

/**
 * Record what the movement cost, once it has happened.
 *
 * @param {object} document
 * @param {object} movement
 * @returns {Promise<void>}
 */
async function onMove(document, movement) {
  const combat = game.combats.active;
  if (!combat?.started) return;
  if (movement?.forced || movement?.options?.fgtForced) return;
  if (!game.users.activeGM?.isSelf && !document.actor?.isOwner) return;

  const actor = document.actor;
  if (!actor) return;

  const unit = unitSnapshot(actor, document);
  const spent = panelsMoved(movement);
  if (spent === 0) return;

  const state = unit.turnState ?? {};
  await applyIntents(
    [I.markTurn(actor.id, {
      moved: true,
      acted: true,
      movedPanels: (state.movedPanels ?? 0) + spent,
      moveSegments: (state.moveSegments ?? 0) + 1,
      // Riding's second segment opens once the unit has attacked; recomputing
      // it here keeps the flag honest whichever order the turn happened in.
      mayMoveAgain: unit.hasRiding && Boolean(state.attacked),
    })],
    { io: worldIO(), canWrite: () => true, isGM: game.user.isGM, source: "movement" },
  );

  if (!state.moved) await budget.spend({ combat, unit, action: "move" });

  Hooks.callAll("fgtUnitMoved", actor, { panels: spent, forced: false });
}

/* -------------------------------------------------------------------------- */

/**
 * The panels a movement operation traverses, as grid offsets.
 *
 * @param {object} movement
 * @returns {Array<{i: number, j: number}>}
 */
function pathOf(movement) {
  const waypoints = movement?.pending?.waypoints?.length
    ? movement.pending.waypoints
    : (movement?.passed?.waypoints ?? []);
  return waypoints.map((w) => canvas.grid.getOffset(w));
}

/**
 * @param {object} movement
 * @returns {number}
 */
function panelsMoved(movement) {
  return movement?.passed?.spaces ?? movement?.passed?.cost ?? 0;
}

/**
 * @param {object} combat
 * @returns {object}
 */
function boardSnapshot(combat) {
  return currentBoard({ round: combat?.round ?? 1, tick: combat?.system?.globalTurn ?? 0 });
}

/**
 * How far this unit may still move — exported for the HUD and any macro that
 * wants to ask without reimplementing the arithmetic.
 *
 * @param {object} actor
 * @returns {{panels: number, blocked: string|null}}
 */
export function movementAllowance(actor) {
  const unit = unitSnapshot(actor);
  return { panels: remainingMovement(unit), blocked: segmentCheck(unit) };
}
