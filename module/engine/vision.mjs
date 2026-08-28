/**
 * @file `unitFirstSeen` — the event half of Detect, written.
 * @see module/rules/identity.mjs's `newlySeenBy`, docs/32-case-semiramis.md
 *
 * Layer 3. `rules/identity.mjs` decides who is newly visible; this is the half
 * that records it and fires the event.
 *
 * Symmetric by construction, not by a special case: a move can bring the
 * mover into a STANDING unit's Detect range just as easily as it can bring a
 * standing unit into the mover's, and Familiar: Doves cares about either
 * direction ("whenever SEMIRAMIS sees a Unit for the first time" says nothing
 * about who moved). So this checks every unit on the board as a candidate
 * seer, not only the one that just moved.
 */

import { newlySeenBy } from "../rules/identity.mjs";
import { fireEvent } from "./scheduler.mjs";
import { currentBoard } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";

/**
 * Check every unit's Detect range against the board and fire `unitFirstSeen`
 * for each newly-crossed (seer, seenUnit) pair.
 *
 * GM-only, like `runDiscoverChecks`: exactly one client must record a sighting
 * and fire its event, or a match with three connected clients would apply the
 * Dove effect three times.
 *
 * @param {object} [ctx]
 * @param {object} [ctx.board] pass a board already in hand rather than
 *   re-snapshotting one that a caller (movement-hooks.mjs) just built
 * @returns {Promise<void>}
 */
export async function checkSightings({ board = null } = {}) {
  if (!game.user?.isGM) return;

  const b = board ?? currentBoard();
  const units = b.units ?? [];

  for (const seer of units) {
    const newlySeen = newlySeenBy(seer, b);
    if (newlySeen.length === 0) continue;

    const actor = game.actors.get(seer.id);
    if (!actor) continue;

    const updated = new Set([...(seer.seenUnitIds ?? []), ...newlySeen]);
    await actor.update({ "system.seenUnitIds": [...updated] });

    const fireCtx = {
      tick: game.combat?.system?.globalTurn ?? 0,
      turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
      board: b,
    };
    for (const seenId of newlySeen) {
      // Refreshed after the write above: `seer`'s own `seenUnitIds` is stale
      // for whichever pair fires next in this same loop, but the event
      // handler only reads OTHER fields off it (its abilities, its
      // eventHandlers), none of which this write touches.
      //
      // `ctx.victim` is Queen's Poison's own vocabulary (`target: "victim"` on
      // an `ApplyEffect` action, `scheduler.mjs`'s `targetsOf`) reused rather
      // than reinvented: `unitFirstSeen` is a second event with a "second
      // party" shape identical to `damageStepEnd`'s attacker/victim, just
      // named seer/seen instead.
      const intents = fireEvent("unitFirstSeen", [{ ...seer, seenUnitIds: [...updated] }], {
        ...fireCtx, victim: { unitId: seenId },
      });
      await applyWorldIntents(intents, `vision:unitFirstSeen:${seer.id}:${seenId}`);
    }
  }
}
