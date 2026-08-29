/**
 * @file "Gather" -- HGoB Construction source 6.
 * @see docs/32-case-semiramis.md
 *
 * Layer 3. *"Semiramis or any allied Unit can perform 'Gather' during its
 * Turn, which increases Construction by 3. However, if Semiramis uses it,
 * Construction is increased by 5, while it is increased by 4 if her Master
 * uses it. Using 'Gather' counts as a Unit's 'Move' for that Turn. A Unit
 * cannot Attack on the same Turn it uses 'Gather'."*
 *
 * Not an ability on Semiramis's own sheet: any ally may perform it, which is
 * why this is a standalone action rather than a granted or authored rule --
 * granting it to a whole faction on Semiramis's arrival and revoking it on
 * her defeat would be the same feature built the hard way.
 */

import { currentBoard, unitFrom } from "./board.mjs";
import { relationOf } from "../rules/relations.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";
import { resourcePathFor } from "../domain/resources.mjs";
import { regionScale } from "./scheduler.mjs";

/**
 * The Construction gain this unit's own Gather is worth, before the Region
 * multiplier.
 *
 * @param {object} unit the unit performing Gather
 * @param {object} owner the Servant whose HGoB Construction it feeds
 * @returns {number}
 */
function baseAmount(unit, owner) {
  if (unit.id === owner.id) return 5;
  if (unit.id === owner.masterId) return 4;
  return 3;
}

/**
 * Perform Gather.
 *
 * @param {object} args
 * @param {string} args.actorId the unit performing it
 * @returns {Promise<{ok: boolean, reason?: string, amount?: number}>}
 */
export async function gather({ actorId }) {
  const actor = game.actors.get(actorId);
  if (!actor) return { ok: false, reason: "notFound" };

  const board = currentBoard();
  const unit = unitFrom(board, actor);
  const combat = game.combats?.active;

  // "Semiramis OR any ALLIED Unit" -- the Servant whose Construction this
  // feeds must be found on the board, and must not be an enemy of the one
  // performing it. Ties broken by nothing: two allied HGoB owners on the
  // same board is not a case the sheet considers, and the first found wins.
  const owner = (board.units ?? []).find(
    (u) => u.resources?.hgobConstruction && relationOf(u, unit, board) !== "enemy",
  );
  if (!owner) return { ok: false, reason: "noHgobOwner" };

  if (combat?.started) {
    const verdict = budget.affordable(combat, unit, "gather");
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
  }

  const amount = regionScale(baseAmount(unit, owner), "middleEast", board.warRegion);

  await applyWorldIntents(
    [
      I.resource(owner.id, resourcePathFor("hgobConstruction", owner), amount),
      // "Counts as a Unit's Move" and "cannot Attack the same Turn" -- the
      // same two turnState fields an ordinary Move and a spent Attack write,
      // reused rather than a third bespoke flag `budget.canConsume` would
      // also need to learn about.
      I.markTurn(actorId, { moved: true, attacked: true }),
      I.log({ kind: "gather", unitId: actorId, ownerId: owner.id, amount }),
    ],
    `gather:${actorId}`,
  );

  if (combat?.started) await budget.spend({ combat, unit, action: "gather" });

  return { ok: true, amount };
}
