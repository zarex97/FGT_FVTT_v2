/**
 * @file "Gather" -- HGoB Construction source 6.
 * @see docs/45-case-studies.md
 *
 * Layer 3. *"Semiramis or any allied Unit can perform 'Gather' during its
 * Turn, which increases Construction by 3. However, if Semiramis uses it,
 * Construction is increased by 5, while it is increased by 4 if her Master
 * uses it. Using 'Gather' counts as a Unit's 'Move' for that Turn. A Unit
 * cannot Attack on the same Turn it uses 'Gather'."*
 *
 * Not an ability on Semiramis's own sheet: any ally may perform it, which is
 * why this is a standalone action rather than a granted rule -- granting it to a
 * whole faction on Semiramis's arrival and revoking it on her defeat would be
 * the same feature built the hard way. WHAT it gives is authored on the pool's
 * owner (`gather`, `rules/gather.mjs`): Avicebron's is the second (#298, #394).
 */

import { currentBoard, unitFrom, unitActor } from "./board.mjs";
import { gatherOffers } from "../rules/gather.mjs";
import { shownNameOf } from "../rules/identity.mjs";
import { chooseFor } from "./ask.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";
import { resourcePathFor, resourceLabel } from "../domain/resources.mjs";
import { regionScale } from "./scheduler.mjs";
import { currentWar } from "./war.mjs";

/**
 * Perform Gather, for the pool its player picks when there are several (#394
 * ruling 12b), refused for a full one with its count (ruling 12a).
 *
 * @param {object} args
 * @param {string} args.actorId the unit performing it
 * @param {string|null} [args.ownerId] the pool's owner, when already chosen
 * @returns {Promise<{ok: boolean, reason?: string, amount?: number}>}
 */
export async function gather({ actorId, ownerId = null }) {
  const actor = unitActor(actorId);
  if (!actor) return { ok: false, reason: "notFound" };

  const board = currentBoard();
  const unit = unitFrom(board, actor);
  const combat = currentWar();

  // Whose pool, and for how much: the owner's authored `gather`, through the
  // one reader the bar's offer asks too (`rules/gather.mjs`).
  const offers = gatherOffers(unit, board);
  if (offers.length === 0) return { ok: false, reason: "noGatherOwner" };
  let offer = ownerId ? offers.find((o) => o.ownerId === ownerId) : null;
  if (!offer && offers.length > 1) {
    const picked = await chooseFor(actor, {
      // fgt-name-ok: the Unit's own player's prompt; its owner knows the name
      title: actor.name,
      hint: game.i18n.localize("FGT.Gather.ChoosePool"),
      count: 1,
      min: 0,
      options: offers.map((o) => ({
        id: o.ownerId,
        name: game.i18n.format("FGT.Gather.PoolOption", {
          owner: shownNameOf(board.units.find((u) => u.id === o.ownerId) ?? null, board) ?? o.ownerId,
          resource: resourceLabel(o.resource), amount: o.amount,
        }),
      })),
    });
    if (!picked?.length) return { ok: false, reason: "cancelled" };
    offer = offers.find((o) => o.ownerId === picked[0]) ?? null;
  }
  offer ??= offers[0];
  if (!offer) return { ok: false, reason: "noGatherOwner" };
  if (offer.full) {
    return {
      ok: false,
      reason: game.i18n.format("FGT.Gather.Full", { resource: resourceLabel(offer.resource), value: offer.value, max: offer.max }),
    };
  }

  if (combat?.started) {
    const verdict = budget.affordable(combat, unit, "gather");
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
  }

  const owner = board.units.find((u) => u.id === offer.ownerId);
  const amount = offer.regionScaled ? regionScale(offer.amount, offer.regionScaled, board.warRegion) : offer.amount;

  await applyWorldIntents(
    [
      I.resource(owner.id, resourcePathFor(offer.resource, owner), amount),
      // "Counts as a Unit's Move" and "cannot Attack the same Turn" -- the
      // same two turnState fields an ordinary Move and a spent Attack write.
      //
      // `gathered` is the third, and it is not redundant with `moved`: *"a unit
      // can only use Gather once per turn"* is a rule in its own right, and
      // resting it on `moved` would leave it at the mercy of `canConsume`'s
      // free-second-non-attack-action rule, which is what let Gather repeat
      // without limit in the first place (Ch. 46 §46.4-BA).
      I.markTurn(actorId, { moved: true, attacked: true, gathered: true }),
      I.log({ kind: "gather", unitId: actorId, ownerId: owner.id, amount, resource: offer.resource }),
    ],
    `gather:${actorId}`,
  );

  if (combat?.started) await budget.spend({ combat, unit, action: "gather" });

  return { ok: true, amount };
}
