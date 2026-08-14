/**
 * @file Binding the scheduler sequences to Foundry's combat lifecycle.
 * @see docs/25-turn-system.md §25.4
 *
 * Layer 3. The sequences themselves are pure and live in `scheduler.mjs`; this
 * is the only thing that decides *when* they run.
 *
 * Everything here executes on the **active GM client only**. If every client ran
 * the sequence, every effect would tick once per connected player — the classic
 * multiplayer scheduler bug, and the reason the election is checked before any
 * work rather than before the write.
 */

import * as scheduler from "./scheduler.mjs";
import { applyIntents } from "./applier.mjs";
import { worldIO } from "./io.mjs";
import { snapshotBoard } from "../rules/snapshot.mjs";

export const Scheduler = {
  /** Register the hooks. Idempotent. */
  attach() {
    Hooks.on("combatTurnChange", onTurnChange);
    Hooks.on("combatRound", onRoundChange);
    Hooks.on("deleteCombat", onCombatEnd);
    console.log("FGT | Scheduler attached");
  },
};

/**
 * Foundry fires this after the turn has already advanced, so the sequence runs
 * as "end the turn we just left, then begin the one we just entered".
 *
 * @param {object} combat
 * @param {object} prior
 * @param {object} current
 */
async function onTurnChange(combat, prior, current) {
  if (!isScheduler()) return;
  if (!combat?.started) return;

  const board = boardFor(combat);
  const tick = combat.system?.globalTurn ?? 0;

  const ctx = {
    tick,
    round: combat.round ?? 1,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    activeFactionId: factionOf(combat, prior),
  };

  await run(scheduler.endTurn(board, ctx), "scheduler:endTurn");

  // The global turn advances between the two halves, so an effect expiring
  // "this turn" is gone before the next unit acts.
  const nextTick = tick + 1;
  await combat.update({ "system.globalTurn": nextTick });

  await run(
    scheduler.beginTurn(boardFor(combat), {
      ...ctx, tick: nextTick, activeFactionId: factionOf(combat, current),
    }),
    "scheduler:beginTurn",
  );
}

/**
 * @param {object} combat
 * @param {object} updateData
 * @param {object} options
 */
async function onRoundChange(combat, updateData, options) {
  if (!isScheduler()) return;
  if (!combat?.started) return;
  // Only fire on a forward round change; rewinding is a GM correction.
  if ((options?.direction ?? 1) < 0) return;

  const ctx = {
    tick: combat.system?.globalTurn ?? 0,
    round: combat.round ?? 1,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    activeFactionId: null,
  };

  await run(scheduler.endRound(boardFor(combat), ctx), "scheduler:endRound");

  // Turn order is re-rolled every Round (Ch. 41 Q32), before the new Round's
  // start-of-round effects fire.
  if (typeof combat.rollTurnOrder === "function") await combat.rollTurnOrder();

  await run(
    scheduler.beginRound(boardFor(combat), { ...ctx, round: (combat.round ?? 1) + 1 }),
    "scheduler:beginRound",
  );
}

/**
 * @param {object} combat
 */
function onCombatEnd(combat) {
  if (!isScheduler()) return;
  console.log(`FGT | Match ended after ${combat.system?.globalTurn ?? 0} turns`);
}

/* -------------------------------------------------------------------------- */

/**
 * Exactly one client runs the sequences.
 * @returns {boolean}
 */
function isScheduler() {
  return Boolean(game.users.activeGM?.isSelf);
}

/**
 * @param {object} combat
 * @returns {object}
 */
function boardFor(combat) {
  return snapshotBoard({
    scene: canvas?.scene,
    actors: (canvas?.tokens?.placeables ?? []).map((t) => ({ actor: t.actor, token: t.document })),
    settings: {
      boardSize: game.settings.get("fgt", "boardSize"),
      turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
      round: combat.round ?? 1,
      tick: combat.system?.globalTurn ?? 0,
      phase: combat.system?.phase ?? "day",
      seed: combat.system?.globalTurn ?? 0,
    },
  });
}

/**
 * @param {object} combat
 * @param {object} turnRef
 * @returns {string|null}
 */
function factionOf(combat, turnRef) {
  const id = turnRef?.combatantId ?? turnRef?.id;
  const combatant = id ? combat.combatants.get(id) : combat.combatant;
  return combatant?.system?.factionId ?? combatant?.id ?? null;
}

/**
 * @param {object[]} intents
 * @param {string} source
 */
async function run(intents, source) {
  if (intents.length === 0) return;
  await applyIntents(intents, {
    io: worldIO(),
    canWrite: () => true, // the active GM
    isGM: true,
    source,
  });
}
