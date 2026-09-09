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

import { ridingAttackPath, effectiveMov } from "../rules/movement.mjs";
import { displaceToken } from "./io.mjs";
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
export async function performRidingAttack({ unitId, destination, abilityId = null }) {
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

  // A Noble Phantasm may BE a Riding Attack rather than merely benefit from
  // one: *"This NP is used in the form of a Riding Attack, with a distance of
  // 13 panels."* The ability then decides the reach and the fan-out is the
  // ability rather than a Normal Attack.
  const ability = abilityId ? actor.items.get(abilityId) : null;
  const ride = ability?.system?.ridingAttack ?? null;
  const plan = ridingAttackPath(unit, destination, board, {
    distanceOverride: typeof ride?.distance === "number" ? ride.distance : null,
  });
  if (!plan.ok) return { ok: false, reason: plan.reason };

  // *"X = the amount of remaining MOV Achilles has divided by 2."* Captured
  // BEFORE the ride writes its own movement, and deliberately: the NP's
  // distance is 13 and his MOV is 8 at best, so measuring afterwards would make
  // X zero every time and the clause dead. What the sheet is asking is how much
  // of his Turn's movement he had left when he used it.
  const remainingMov = Math.max(0, effectiveMov(unit) - (unit.turnState?.movedPanels ?? 0));

  // The MOVE, first and completely. `{fgtForced: true}` because the legality
  // was decided by `ridingAttackPath` rather than by the ordinary movement
  // validator — this is one action, not a Move followed by an Attack.
  const token = actor.getActiveTokens?.()[0]?.document;
  if (!token) return { ok: false, reason: "unplaced" };
  const size = canvas.scene.grid.size;
  // `ridingAttackPath` has already judged the legality, so this is the engine
  // placing the Unit rather than the Unit walking -- and it must be submitted
  // as a displacement or Foundry constrains it away without a word (`io.mjs`).
  await displaceToken(token, { x: destination.j * size, y: destination.i * size });

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
    // ...and a Noble Phantasm used as one still does what it does to its user.
    // Troias Tragōidia *"first restores X Agility and applies Atk Up ... Deals
    // 4x damage"* -- the restore and the buff are not conditional on reaching
    // anybody, and only the Crit DmUp is (Y = the number hit, so zero).
    // Without this the whole NP was spent for nothing on an empty line.
    if (ability) {
      const x = Math.floor(remainingMov / 2);
      const ride = { panels: plan.distance, hitCount: 0, remainingMov, x, xLessOne: Math.max(0, x - 1) };
      const { runCasterPhases, applySelfRiders } = await import("./skill-use.mjs");
      await runCasterPhases(ability, actor, board, { ride });
      // ...and the self-targeted riders it would have applied at the damage
      // step. They are `applyEffects` phases, which the Combat Process resolves
      // per DEFENDER -- so with nobody on the line they would never run, and a
      // Noble Phantasm spent on an empty ride would grant its user nothing at
      // all. Only the `beforeDamage` ones: the Crit DmUp is "Y = number of
      // Units successfully hit", which is zero, and a 0% buff is not a buff.
      await applySelfRiders(ability, actor, { ride, when: "beforeDamage" });
    }
    return { ok: true, hit: [] };
  }

  const { resolveAttack } = await import("./attack.mjs");
  const result = await resolveAttack({
    attackerId: unitId,
    abilityId,
    placement: {
      pathTargets: plan.hits.map((u) => u.id),
      // How far he actually rode and how many he actually reached. Troias
      // Tragōidia's two magnitudes are read off these, and neither exists
      // until the ride has happened.
      ridePanels: plan.distance,
      hitCount: plan.hits.length,
      remainingMov,
    },
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
