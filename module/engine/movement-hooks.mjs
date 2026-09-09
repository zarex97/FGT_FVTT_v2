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

import {
  validatePath, remainingMovement, segmentCheck, pursuitVerdict, decoyVerdict,
  passengerDestination, occupantAt,
} from "../rules/movement.mjs";
import { unitSnapshot, currentBoard } from "./board.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";
import { movePlatform, actionSourceFor } from "../rules/platforms.mjs";
import { hasGranted, GRANTS } from "../rules/granted.mjs";
import { contains as fieldContains } from "../rules/bounded-fields.mjs";
import { repaintFollowing } from "./terrain.mjs";
import { displaceToken } from "./io.mjs";

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
 * @param {object} [operation] the update operation, which carries our own options
 * @returns {boolean} `false` rejects it
 */
function onPreMove(document, movement, operation) {
  const combat = game.combats.active;
  if (!combat?.started) return true;
  if (movement?.method === "undo" || movement?.method === "reset") return true;
  // Forced movement -- knockback, Gather, a platform carrying its passengers --
  // is displacement, not movement, and is not subject to the mover's own
  // legality or budget (Ch. 08 §8.3).
  //
  // `operation`, not `movement.options`. Foundry calls this hook as
  // `Hooks.call("preMoveToken", document, move, options)` (`TokenDocument`
  // §1993) -- the update options are the THIRD argument, and `move` has no
  // `options` at all. So `fgtForced` resolved to `undefined` every time and
  // **the escape hatch had never once worked**: every forced displacement this
  // system performs was being re-validated as a voluntary move.
  if (movement?.forced || operation?.fgtForced || movement?.options?.fgtForced) return true;

  // A change of LEVEL is not a Move. Foundry counts `elevation` and `level`
  // among its movement fields, so assigning a token to a platform's Scene Level
  // arrives here as a movement whose path has no horizontal step at all --
  // and `validatePath` rejected it with *"Step 1 is not an orthogonal move"*.
  //
  // That is why the Hanging Gardens never reached its own level: `createLevel`
  // made the level, `assignLevel` tried to put the platform on it, and this
  // hook refused. The platform then flew at elevation 0 on the ground, where it
  // collided with every unit on the board and counted all of them as
  // passengers. Boarding was broken the same way, for the same reason.
  //
  // Changing level is `boardPlatform`'s business and is gated by its own roll;
  // it is not a step across the board and has no business being measured as one.
  if (isLevelOnlyChange(document, movement)) return true;

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
    // The faction whose Turn this unit acts on, which is its own unless a
    // Charm has moved it: §25.7's *"a charmed unit appears in the charmer's
    // currentUnits during their turn and is absent from its owner's"*. Its own
    // `factionId` is untouched, so the token keeps its colour and every
    // relation still reads it as the enemy it was.
    const side = unit.actingFactionId ?? unit.factionId;
    if (side && acting && side !== acting) {
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

  // A Kagome Spirit may not walk away from the enemy it was summoned for.
  const pursuit = pursuitVerdict(unit, path, board);
  if (!pursuit.ok) {
    ui.notifications.warn(`FGT | ${pursuit.reason}`);
    return false;
  }

  // ...and nothing may walk away from a Decoy. The same shape, a different
  // rule: the pull is stamped on this Unit by the board pass rather than
  // authored on it (`rules/compulsion.mjs`).
  const pulled = decoyVerdict(unit, path, board);
  if (!pulled.ok) {
    ui.notifications.warn(`FGT | ${pulled.reason}`);
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
async function onMove(document, movement, operation) {
  const combat = game.combats.active;
  if (!combat?.started) return;
  // A level change is not a step, so it costs nothing (see `onPreMove`) and it
  // crosses no boundary in the plane either.
  if (isLevelOnlyChange(document, movement)) return;

  // Bounded-field CONTACT is settled before anything else, and deliberately
  // above the forced-move return below: a Unit knocked back or carried into
  // Jack's Mist has still walked into the fog, and "Normal Humans immediately
  // die if they are CAUGHT IN the Mist" does not ask whose move it was.
  if (document.actor) await runContactEvents([document.actor.id], enteredFields(document, movement));

  // A FOLLOWING terrain area goes where its source goes, and is above the
  // forced-move return for the same reason contact is: *"the 5x5 panel area
  // around Quetz"* is around her wherever she ends up, and a Quetzalcoatl who
  // was knocked back or carried would otherwise leave her daylight behind.
  //
  // `movement.destination` is a canvas POINT, not a panel -- the same trap
  // `platformDelta` below documents.
  if (document.actor) {
    const landed = movement?.destination ? canvas.grid.getOffset(movement.destination) : null;
    await repaintFollowing(document.actor.id, landed ? { i: landed.i, j: landed.j } : null);
  }

  // `operation`, not `movement.options` -- see `onPreMove`. A forced
  // displacement must not spend the mover's budget, and this read never
  // resolved, so `carryPassengers` could recurse into its own carried
  // passengers and every carried unit was billed for a move it did not make.
  if (movement?.forced || operation?.fgtForced || movement?.options?.fgtForced) return;
  if (!game.users.activeGM?.isSelf && !document.actor?.isOwner) return;

  const actor = document.actor;
  if (!actor) return;

  // A platform carries everyone aboard it (§20.8). Done before the mover's own
  // bookkeeping, so a passenger is already where it belongs by the time
  // anything reads the board.
  // Whether the mount was dragged along by its driver, which already carried
  // everyone else aboard it -- so Passenger Seat below must not carry her
  // Master a second time. He is both her passenger and the platform's, and
  // measured live he moved twice the distance she did.
  let drovePlatform = false;

  if (actor.type === "platform") await carryPassengers(actor, document, movement);
  // ...and the inverse: a rider who DRIVES takes the mount with her
  // (`replacesRiderAction`). Same moment and same reason as the line above.
  //
  // Its own snapshot rather than the `unit` declared below: that `const` is in
  // its temporal dead zone here, and reading it threw a ReferenceError that
  // Foundry's hook dispatch swallowed -- so the move committed and the whole
  // tail of this function (the carry, the Passenger Seat, the budget, the turn
  // state, the knockback) was skipped in silence. Measured: Quetzalcoatl walked
  // three panels off her own mount with `movedPanels` still 0.
  else {
    // The BOARD-derived unit, not a bare `unitSnapshot`: `platformId` is
    // stamped by `annotatePlatforms` during the full projection, and a bare
    // snapshot never carries one -- so `actionSourceFor` saw a rider on no
    // platform and returned before moving anything. The same trap
    // `engine/skill-use.mjs` records for `self:onPlatform:`.
    const board = currentBoard();
    const mover = board.units.find((u) => u.id === actor.id);
    if (mover) drovePlatform = await carryDrivenPlatform(mover, board, movement);
  }

  // Riding's Passenger Seat: *"The Servant's Master can Move together with its
  // Servant; after Moving, both Servant and Master must be in the same
  // orientation/position prior to the Move. Counts as only Moving one Unit."*
  //
  // The same shape as the platform carry above and for the same reason -- the
  // delta comes from the MOVEMENT, because at `moveToken` the document still
  // reports the origin. `GRANTS.passengerSeat` has existed with no reader
  // since grants were written; this is it.
  if (!drovePlatform) await carryMaster(actor, movement);

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

  // Bašmu: "when it Moves to any occupied panels, all Units occupying said
  // panels are knocked back by 1 panel until the space is free." Read off a
  // FRESH board, taken after the write above, so `occupantAt` sees whoever
  // is actually standing on Bašmu's new panel rather than where they were
  // before this move.
  if (ignoresOccupancy(unit)) await knockBackOccupants(actor.id, movement);

  // Presence Concealment clause 6: *"When This Unit Moves into an enemy
  // Servant's Range (or Detect, if in use), it has a 5% chance of being
  // discovered."* Asked after the move has been recorded, so the roll is made
  // against where the Unit now stands.
  //
  // `discoverAttempts` has existed since Ch. 04 was implemented with no caller
  // at all -- and could not have found anything if it had one, because nothing
  // ever made a Unit concealed.
  if (unit.concealed) {
    const { runDiscoverChecks } = await import("./concealment.mjs");
    await runDiscoverChecks(actor.id);
  }

  // Familiar: Doves (Ch. 32): "whenever Semiramis sees a Unit for the first
  // time" is not about concealment at all, so it runs unconditionally on
  // every move rather than gated behind `unit.concealed` above.
  const { checkSightings } = await import("./vision.mjs");
  await checkSightings({ board: boardSnapshot(combat) });
}

/**
 * May this Unit walk into occupied panels?
 *
 * Two sources and one question: the summon's own field (Bašmu) and the grant a
 * Skill can hand out (Kingprotea's *Huge Scale*). `rules/movement.mjs` asks the
 * same question the same way when it decides whether the step is legal at all.
 *
 * @param {object} unit
 * @returns {boolean}
 */
function ignoresOccupancy(unit) {
  return Boolean(unit?.ignoresOccupancy)
    || (unit?.grantedAbilities ?? []).includes("ignoresOccupancy");
}

/**
 * Push every OTHER unit standing where the mover now stands one panel further
 * away, repeating until each lands on a free one.
 *
 * > Bašmu: *"when it Moves to any occupied panels, all Units occupying said
 * > panels are knocked back by 1 panel until the space is free."*
 * > Kingprotea: *"if the panel(s) is(are) occupied, all Units occupying said
 * > panels will be knocked back by 1 panel until Kingprotea has space to stand
 * > on."*
 *
 * **Every panel of the mover's footprint**, not just its origin. Bašmu is 1×1
 * and the two readings are the same for it; a grown Kingprotea is 3×3, and
 * clearing one of nine panels leaves her standing on eight Units — which is the
 * cascade Ch. 08 §8.3 describes and the single-panel version silently was not.
 *
 * @param {string} moverId the unit that just arrived (never knocks itself back)
 * @returns {Promise<void>}
 */
async function knockBackOccupants(moverId, movement = null) {
  const { knockbackPanel, occupantsAt } = await import("../rules/movement.mjs");
  const board = boardSnapshot(game.combats.active);

  // On the MOVER's own level: it knocks aside whoever it walks into, and it
  // cannot walk into somebody standing twenty feet above it.
  const mover = board.units.find((u) => u.id === moverId) ?? null;
  if (!mover) return;

  // The whole footprint. `panels` is what the projection derives from the
  // token's occupied grid spaces; `panel` is its anchor, and for a 1×1 the two
  // lists are the same one entry.
  const occupied = (mover.panels ?? []).length > 0 ? mover.panels : [mover.panel].filter(Boolean);
  // Away from the mover's CENTRE, so a Unit under her north-west corner is
  // shoved north-west rather than toward her middle. Passing the panel being
  // cleared instead would name the occupant's own panel, and "away from where
  // you already are" has no direction at all.
  const centre = centreOf(occupied);

  // Two shapes of push, and the mover's own grant says which.
  //
  //   Kingprotea: "all Units occupying said panels will be knocked back by 1
  //   panel until Kingprotea has space to stand on" -- outward, from her
  //   centre, because she is nine panels of Unit and there is no one direction.
  //
  //   Achilles: "the Unit occupying said panel is forced to Move BACKWARD until
  //   Achilles stops Moving in that direction. If the Unit does not or cannot
  //   vacate those panels, that Unit is forcefully Moved to one of the panels
  //   to its sides, and receives damage equivalent to a Normal Attack."
  const push = pushStyle(mover);
  const along = push.direction === "travel" ? travelDirection(movement) : null;

  for (const panel of occupied) {
    // EVERY other Unit on the panel, not the first one found. A mover that
    // walks onto somebody shares their panel, so `occupantAt` may return the
    // mover itself and the Unit it is standing on is never pushed — which is
    // exactly what happened when Achilles walked onto Karna and the board
    // listed Achilles first.
    for (const occupant of occupantsAt(panel, board, mover.level)) {
      if (occupant.id === moverId) continue;

      const landing = knockbackPanel(centre, occupant, board, {
        preferredDirection: along,
        allowSidestep: Boolean(push.sidestepDamages),
      });
      // "Until the space is free" -- when no free panel exists within range, the
      // occupant simply stays: there is nowhere the sheet's own rule can send it.
      if (!landing) continue;

      const token = canvas.tokens?.placeables?.find((t) => t.actor?.id === occupant.id);
      if (!token) continue;

      const point = canvas.grid.getTopLeftPoint(landing.panel);
      // `animate: false`: a knockback is displacement, not a walk -- and it is
      // what makes the write LAND. See `engine/io.mjs#move`.
      await token.document.update({ x: point.x, y: point.y }, { fgtForced: true, animate: false });

      // "...and receives damage equivalent to a Normal Attack from Achilles."
      // Only on the SIDESTEP: a Unit that got out of the way in time is merely
      // displaced, and the damage is the price of not having room.
      if (landing.sidestepped && push.sidestepDamages) {
        const { resolveAttack } = await import("./attack.mjs");
        await resolveAttack({
          attackerId: moverId,
          abilityId: null,
          placement: { pathTargets: [occupant.id] },
        });
      }
    }
  }
}

/**
 * How this mover pushes, from the grant it carries.
 *
 * @param {object} mover a Unit projection
 * @returns {{direction: string, sidestepDamages: boolean}}
 */
function pushStyle(mover) {
  const spec = mover?.knockback ?? null;
  return {
    direction: spec?.direction ?? "fromCentre",
    sidestepDamages: Boolean(spec?.sidestep?.damage),
  };
}

/**
 * The cardinal the mover was travelling in, or `null` when it cannot be told.
 *
 * @param {object|null} movement the v14 movement operation
 * @returns {{i: number, j: number}|null}
 */
function travelDirection(movement) {
  const from = movement?.origin;
  const to = movement?.destination ?? movement?.passed?.waypoints?.at(-1);
  if (!from || !to) return null;
  const a = canvas?.grid?.getOffset?.(from);
  const b = canvas?.grid?.getOffset?.(to);
  if (!a || !b) return null;
  const di = Math.sign(b.i - a.i);
  const dj = Math.sign(b.j - a.j);
  if (di === 0 && dj === 0) return null;
  // One axis, like every other step on this board.
  return Math.abs(b.i - a.i) >= Math.abs(b.j - a.j) ? { i: di, j: 0 } : { i: 0, j: dj };
}

/**
 * The middle of a footprint, rounded to a panel.
 *
 * For a 1×1 it is the panel itself, which leaves `knockbackPanel` to fan out —
 * a mover that stands ON its victim has no direction to push it.
 *
 * @param {Array<{i: number, j: number}>} panels
 * @returns {{i: number, j: number}}
 */
function centreOf(panels) {
  const total = panels.reduce((acc, p) => ({ i: acc.i + p.i, j: acc.j + p.j }), { i: 0, j: 0 });
  return { i: Math.round(total.i / panels.length), j: Math.round(total.j / panels.length) };
}

/* -------------------------------------------------------------------------- */

/**
 * The panels a movement operation traverses, as grid offsets.
 *
 * @param {object} movement
 * @returns {Array<{i: number, j: number}>}
 */
/**
 * Is this "movement" only a change of level or elevation?
 *
 * Foundry counts `elevation` and `level` among `TokenDocument.MOVEMENT_FIELDS`,
 * so assigning a token to a Scene Level arrives at `preMoveToken` as a
 * movement — one whose every waypoint sits on the panel the token is already
 * standing on. Measured against the board's own grid offsets rather than
 * against pixel coordinates, because a level change may nudge `x`/`y` by a
 * sub-panel amount and still not be a step.
 *
 * @param {object} document the `TokenDocument`
 * @param {object} movement
 * @returns {boolean}
 */
function isLevelOnlyChange(document, movement) {
  const path = pathOf(movement);
  if (path.length === 0) return true;

  // The movement's OWN origin, not the document's current position. Whether
  // `document.x` still reports the origin when this is asked depends on
  // whether the move was animated -- an un-animated one has already committed
  // -- and a real step measured against itself looks like no step at all. The
  // whole of `onMove` then returned early: no budget, no turn state, and no
  // knockback for a Unit that walked onto somebody.
  const from = movement?.origin ?? { x: document.x, y: document.y };
  const here = canvas?.grid?.getOffset?.(from);
  if (!here) return false;
  return path.every((p) => p.i === here.i && p.j === here.j);
}

/**
 * @param {object} movement
 * @returns {{i: number, j: number}[]}
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

/**
 * Move a platform's passengers with it.
 *
 * `forced: true`, which is what keeps the carry off their own movement budget
 * and away from movement-triggered effects (Ch. 08 §8.3): a passenger has not
 * moved, it has been carried, and every rule watching movement cares about the
 * difference. The `fgtForced` option is what makes this hook ignore the moves
 * it is itself making, so a platform cannot recurse into its own passengers.
 *
 * @param {object} actor the platform
 * @param {object} document its token
 * @param {object} movement
 * @returns {Promise<void>}
 */
async function carryMaster(actor, movement) {
  const board = currentBoard();
  const servant = board.units.find((u) => u.id === actor.id);
  if (!servant || !hasGranted(servant, GRANTS.passengerSeat)) return;

  const master = board.units.find((u) => u.id === servant.masterId);
  if (!master?.panel || master.defeated) return;

  const from = movement?.origin;
  const to = movement?.destination;
  if (!from || !to || !canvas?.grid) return;
  const origin = canvas.grid.getOffset(from);
  const destination = canvas.grid.getOffset(to);

  const landing = passengerDestination(
    { i: origin.i, j: origin.j }, { i: destination.i, j: destination.j },
    master.panel, board.bounds ?? null,
  );
  if (!landing || (landing.i === master.panel.i && landing.j === master.panel.j)) return;
  // Somebody is standing there: the Master stays rather than being stacked.
  if (occupantAt(landing, board, master.level ?? 0)) return;

  const token = game.actors.get(master.id)?.getActiveTokens?.()[0]?.document;
  if (!token) return;
  const size = canvas.scene.grid.size;
  // Displacement, not a Move of its own -- *"counts as only Moving one Unit"*,
  // so it spends nothing and is not re-validated as a voluntary step.
  await token.update({ x: landing.j * size, y: landing.i * size }, { fgtForced: true });
}

/**
 * @param {object} actor
 * @param {object} document
 * @param {object} movement
 * @returns {Promise<void>}
 */
async function carryPassengers(actor, document, movement) {
  const board = currentBoard();
  const platform = board.units.find((u) => u.id === actor.id);
  if (!platform) return;

  // The delta comes from the MOVEMENT, origin to destination — not from the
  // board's idea of where the platform is now.
  //
  // It used to be `platform.panel − movement.origin`, and `platform.panel` is
  // read from a board snapshot taken inside this hook. At `moveToken` the
  // document has not caught up: it still reports the origin. So the subtraction
  // was origin − origin, the delta was always `{0, 0}`, and this function
  // returned before moving anybody. **§20.8's movement linkage had never once
  // carried a passenger** — measured live, with two passengers aboard the
  // Hanging Gardens and the platform moved two panels: both stayed where they
  // were.
  //
  // `origin` and `destination` are both on the operation, both final, and
  // neither depends on document propagation (`TokenMovementOperation`).
  const from = movement?.origin;
  const to = movement?.destination;
  const delta = from && to && canvas?.grid
    ? offsetDelta(canvas.grid.getOffset(from), canvas.grid.getOffset(to))
    : null;
  if (!delta || (delta.i === 0 && delta.j === 0)) return;

  await shiftPlatform(platform, delta, board, [platform.id]);
  void document;
}

/**
 * Move a platform and everyone aboard it by one delta.
 *
 * `skip` is who has already arrived: the PLATFORM when it was dragged itself
 * and its passengers are following, or the DRIVER when she was dragged and the
 * platform is following her.
 *
 * @param {object} platform the platform's snapshot
 * @param {{i: number, j: number}} delta
 * @param {object} board
 * @param {string[]} skip unit ids already at their destination
 * @returns {Promise<void>}
 */
async function shiftPlatform(platform, delta, board, skip = []) {
  const skipped = new Set(skip);
  for (const descriptor of movePlatform(platform, delta, board)) {
    if (skipped.has(descriptor.unitId)) continue;
    const token = canvas.tokens.placeables.find((t) => t.actor?.id === descriptor.unitId)?.document;
    if (!token) continue;
    const point = canvas.grid.getCenterPoint({ i: descriptor.to.i, j: descriptor.to.j });
    // Through `displaceToken`: being carried is a displacement, and submitting
    // it as a walk let Foundry constrain it away in silence (see `io.mjs`).
    await displaceToken(token, {
      x: point.x - canvas.grid.sizeX / 2,
      y: point.y - canvas.grid.sizeY / 2,
    });
  }
}

/**
 * A rider who DRIVES takes the mount, and everyone else aboard it, with her.
 *
 * > *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move and Normal Attack
 * > is replaced with Quetzalcoatlus'."*
 *
 * The mirror of {@link carryPassengers}, and the half that was missing.
 * §20.8's linkage was written for a platform that moves *itself* and carries
 * its passengers along; `replacesRiderAction` inverts that — the passenger is
 * the one being dragged, and the platform under her has to follow, or she flies
 * off her own mount and leaves it behind with her Master still on it.
 *
 * @param {object} unit the mover's snapshot
 * @param {object} board
 * @param {object} movement the movement operation
 * @returns {Promise<boolean>} whether the mount was carried, so Passenger Seat
 *   does not move her Master a second time
 */
async function carryDrivenPlatform(unit, board, movement) {
  const { platform, movesAsPlatform } = actionSourceFor(unit, board);
  if (!movesAsPlatform || !platform) return false;

  const from = movement?.origin;
  const to = movement?.destination;
  const delta = from && to && canvas?.grid
    ? offsetDelta(canvas.grid.getOffset(from), canvas.grid.getOffset(to))
    : null;
  if (!delta || (delta.i === 0 && delta.j === 0)) return false;

  // The driver has already arrived; the platform and any other passenger have
  // not.
  await shiftPlatform(platform, delta, board, [unit.id]);
  return true;
}

/**
 * @param {{i: number, j: number}} from
 * @param {{i: number, j: number}} to
 * @returns {{i: number, j: number}}
 */
function offsetDelta(from, to) {
  return { i: to.i - from.i, j: to.j - from.j };
}

/**
 * Run every bounded field's `contact` rules for the units named.
 *
 * The entry half of Ch. 43's axis 4. `runFieldEvents` fires from the Turn
 * boundaries the scheduler owns (`turnStart`, `turnEnd`, `actedTurnEnd`), and
 * a clause that happens *on walking in* has no Turn boundary to wait for —
 * Jack's Mist kills a Normal Human "if they are caught in" it and Poisons an
 * enemy Master "upon contact", neither of which is a thing that happens at the
 * end of anything.
 *
 * Scoped to the units that just moved rather than to everyone inside, so a
 * Servant standing still in the fog is not re-poisoned every time an ally
 * crosses the boundary. Field creation fires its own pass over whoever the
 * shape closed around (`engine/fields.mjs#createField`).
 *
 * @param {string[]} unitIds
 * @param {string[]|null} [fieldIds] only these fields, for an entry pass
 * @returns {Promise<void>}
 */
export async function runContactEvents(unitIds, fieldIds = null) {
  if (!game.users.activeGM?.isSelf) return;
  if (fieldIds && fieldIds.length === 0) return;
  const { runFieldEvents } = await import("./fields.mjs");
  const intents = await runFieldEvents("contact", { unitIds, fieldIds, assumeInside: Boolean(fieldIds) });
  if (intents.length === 0) return;
  await applyIntents(intents, {
    io: worldIO(), canWrite: () => true, isGM: game.user.isGM, source: "field:contact",
  });
}

/**
 * The bounded fields this move CROSSED INTO, as opposed to the ones it stayed
 * inside.
 *
 * "Upon contact" is an entry clause. Firing it for whichever fields the mover
 * ends up standing in would re-poison an enemy Master on every step he takes
 * through the fog, and kill a Civilian who was already dead — the difference
 * between the sheet's rule and a per-panel toll.
 *
 * The origin comes off `movement.origin` rather than off the document, which
 * still reports the destination by the time this hook runs (the same trap
 * `carryPassengers` fell into: its delta was always {0,0}).
 *
 * @param {object} document the TokenDocument, now at its destination
 * @param {object} movement
 * @returns {string[]|null} field ids, or `null` for "no origin, so test them all"
 */
function enteredFields(document, movement) {
  const origin = movement?.origin;
  if (!origin || !canvas?.grid) return null;

  // BOTH ends off the movement payload. Neither the document nor the board can
  // supply the destination here: at `moveToken` the TokenDocument still reports
  // its ORIGIN (the same trap `carryPassengers` fell into, whose delta was
  // therefore always {0,0}), and `currentBoard()` reads the canvas placeables,
  // which lag it further. Measured: taking the destination from the document
  // made `from` and `to` the same panel, so nothing was ever "newly entered"
  // and no contact clause fired at all.
  const destination = movement.destination ?? { x: document.x, y: document.y };
  const from = canvas.grid.getOffset({ x: origin.x, y: origin.y });
  const to = canvas.grid.getOffset({ x: destination.x, y: destination.y });
  const board = currentBoard();

  return (board.fields ?? [])
    .filter((f) => fieldContains(f, to, board) && !fieldContains(f, from, board))
    .map((f) => f.id);
}
