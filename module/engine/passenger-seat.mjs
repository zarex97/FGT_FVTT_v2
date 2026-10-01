/**
 * @file Riding's Passenger Seat — the Master moves with the Servant.
 * @see module/engine/movement-hooks.mjs, module/engine/riding.mjs, docs/05-board-geometry.md
 *
 * Layer 3.
 *
 * > *"Passenger Seat: The Servant's Master can Move together with its Servant;
 * > after Moving, both Servant and Master must be in the same orientation/
 * > position prior to the Move. Counts as only Moving one Unit."*
 *
 * One carry, two callers. A voluntary drag reaches it from `movement-hooks.mjs`
 * (the `moveToken` hook), and a Riding Attack from `engine/riding.mjs`. Every
 * Riding sheet says the ride *"Can be combined with Passenger Seat"*, and it
 * could not be: the hook returns for any forced move before it reaches the
 * carry, and a ride is a forced displacement, so a Master who was meant to ride
 * along was left behind with nothing logged (#115). The function takes two
 * PANELS rather than a movement operation, which is what let the second caller
 * exist.
 */

import { currentBoard } from "./board.mjs";
import { displaceToken, worldIO } from "./io.mjs";
import { applyIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { hasGranted, GRANTS } from "../rules/granted.mjs";
import { passengerDestination, occupantAt } from "../rules/movement.mjs";

/**
 * Carry a Servant's Master by the delta the Servant just travelled.
 *
 * Asks the grant (`GRANTS.passengerSeat`) and the Servant's own switch
 * (`carriesMaster`, on the action bar), and does nothing when either says no. A
 * carry that cannot happen -- off the board, onto an occupied panel -- is
 * REPORTED, not dropped.
 *
 * @param {object} args
 * @param {string} args.servantId
 * @param {{i: number, j: number}} args.from where the Servant was
 * @param {{i: number, j: number}} args.to where the Servant is now
 * @returns {Promise<void>}
 */
export async function carryMasterAlong({ servantId, from, to }) {
  const board = currentBoard();
  const servant = board.units.find((u) => u.id === servantId);
  if (!servant || !hasGranted(servant, GRANTS.passengerSeat)) return;

  // *"The Servant's Master CAN Move together with its Servant."* "Can", so it
  // is the player's choice, and `rules/actions.mjs` puts the switch on the
  // action bar. Default ON: carrying is the point of the clause.
  if (servant.carriesMaster === false) return;

  const master = board.units.find((u) => u.id === servant.masterId);
  if (!master?.panel || master.defeated) return;
  if (!from || !to) return;

  const landing = passengerDestination(
    { i: from.i, j: from.j }, { i: to.i, j: to.j },
    master.panel, board.bounds ?? null,
  );
  // A carry that cannot happen is REPORTED, not dropped. Both refusals leave
  // the Master standing where the Servant left him -- which is the correct
  // outcome and a dangerous surprise, because the whole reason to carry a
  // Master is to keep him inside the ZON and out of reach. Told once, in the
  // words of the rule that refused.
  const say = (reason) => ui.notifications?.warn(game.i18n.format("FGT.Movement.MasterNotCarried", {
    master: game.actors.get(master.id)?.name ?? "The Master",
    reason: game.i18n.localize(reason),
  }));
  if (!landing) return say("FGT.Movement.OffBoard");
  if (landing.i === master.panel.i && landing.j === master.panel.j) return;
  if (occupantAt(landing, board, master.level ?? 0)) return say("FGT.Movement.PanelOccupied");

  const token = game.actors.get(master.id)?.getActiveTokens?.()[0]?.document;
  if (!token) return;
  const size = canvas.scene.grid.size;
  // Displacement, not a Move of its own -- *"counts as only Moving one Unit"*,
  // so it spends nothing and is not re-validated as a voluntary step. Said to
  // Foundry as well as to us, or the carry is silently dropped (`io.mjs`).
  await displaceToken(token, { x: landing.j * size, y: landing.i * size });

  // Said out loud, because a token that moves without being dragged reads as a
  // bug. The audit gets it too: "counts as only Moving one Unit" means the
  // Master's pool was NOT spent, and a reader checking the budget needs to know
  // why he is somewhere else.
  await applyIntents([I.log({
    kind: "passengerSeat",
    unitId: master.id,
    carriedBy: servant.id,
    from: { ...master.panel },
    to: { ...landing },
    text: game.i18n.format("FGT.Movement.MasterCarried", {
      master: game.actors.get(master.id)?.name ?? "The Master",
      servant: game.actors.get(servant.id)?.name ?? servant.id,
    }),
  })], { io: worldIO(), canWrite: () => true, isGM: game.user.isGM, source: "passengerSeat" });
}
