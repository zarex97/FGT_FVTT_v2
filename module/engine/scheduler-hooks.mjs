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
import { currentBoard } from "./board.mjs";
import { factionOfCombatant } from "./turn-order.mjs";
import * as budget from "./budget.mjs";
import * as I from "./intents.mjs";
import { grailContest, checkVictory } from "../rules/environment.mjs";
import { EffectRegistry } from "../rules/registry.mjs";

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
    // Injected rather than imported by the scheduler, so the scheduler stays
    // testable without a compendium. It is what lets an expiring effect run
    // its own "on removal" clause -- Shock's Agility restoration.
    effectDef: (id) => EffectRegistry.get(id),
  };

  await run(scheduler.endTurn(board, ctx), "scheduler:endTurn");

  // The faction that just finished is frozen in the order: a Delay declared
  // from here on applies to the next Round, not to a turn already taken.
  if (typeof combat.markTurnTaken === "function") {
    await combat.markTurnTaken(ctx.activeFactionId);
  }

  // The global turn advances between the two halves, so an effect expiring
  // "this turn" is gone before the next unit acts.
  const nextTick = tick + 1;
  await combat.update({ "system.globalTurn": nextTick });

  // The incoming faction starts its turn with full pools and every unit's
  // turn state cleared. Both happen before `beginTurn` fires, so a start-of-turn
  // effect that forces an action sees a budget it can actually spend.
  const incoming = factionOf(combat, current);
  await budget.reset(combat, incoming);
  await clearTurnState(combat, incoming);

  await run(
    scheduler.beginTurn(boardFor(combat), {
      ...ctx, tick: nextTick, activeFactionId: incoming,
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
    effectDef: (id) => EffectRegistry.get(id),
    // Switches off the multi-Servant tax (§16.7). Read here rather than in the
    // rules layer, which has no settings.
    grandOrder: setting("grandOrder", false),
  };

  const board = boardFor(combat);
  await run(scheduler.endRound(board, ctx), "scheduler:endRound");

  // The Grail's contest and the victory check, both evaluated at round end
  // (§19.4). Written back to the match, which is the runtime owner the Grail
  // never had -- `grailCounter` sat on `MatchData` from the start with nothing
  // incrementing or reading it.
  await advanceGrail(combat, board);

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
 * Clear every unit of one faction's turn state.
 *
 * Riding's `mayMoveAgain` is cleared too: the second segment is granted by
 * attacking during the turn, so it must not survive into the next one.
 *
 * @param {object} combat
 * @param {string|null} factionId
 * @returns {Promise<void>}
 */
async function clearTurnState(combat, factionId) {
  if (!factionId) return;
  const fresh = {
    acted: false, moved: false, attacked: false, movedPanels: 0, moveSegments: 0,
    usedActiveSkill: false, mayMoveAgain: false, usedRidingAttack: false,
  };
  const intents = game.actors
    .filter((a) => (a.system?.factionId ?? null) === factionId)
    .map((a) => I.markTurn(a.id, fresh));
  await run(intents, "scheduler:clearTurnState");
}

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
  return currentBoard({ round: combat.round ?? 1, tick: combat.system?.globalTurn ?? 0 });
}

/**
 * @param {object} combat
 * @param {object} turnRef
 * @returns {string|null}
 */
function factionOf(combat, turnRef) {
  const id = turnRef?.combatantId ?? turnRef?.id;
  const combatant = id ? combat.combatants.get(id) : combat.combatant;
  return factionOfCombatant(combatant);
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

/**
 * Advance the Grail contest, then ask whether the war is over.
 *
 * Both belong at round end and in that order: a faction that completes its
 * full Round adjacent to the Grail wins on the same boundary that credits it.
 *
 * @param {object} combat
 * @param {object} board
 * @returns {Promise<void>}
 */
async function advanceGrail(combat, board) {
  if (!game.user.isGM) return;

  const result = grailContest(board.grail ?? {}, board.units ?? []);
  if (JSON.stringify(result.contest) !== JSON.stringify(board.grail?.contest ?? {})) {
    await combat.update({ "system.grailContest": result.contest });
  }

  const victory = checkVictory({ ...board, grail: { ...board.grail, contest: result.contest } });
  if (!victory) return;

  await ChatMessage.create({
    content: `<h2>${game.i18n.localize(`FGT.Victory.${victory.outcome}`)}</h2>`
      + (victory.faction ? `<p>${game.i18n.format("FGT.Victory.faction", { faction: victory.faction })}</p>` : ""),
  });
  Hooks.callAll("fgtVictory", victory);
}

/**
 * A world setting, tolerating a world where it was never registered.
 * @param {string} key
 * @param {unknown} fallback
 * @returns {unknown}
 */
function setting(key, fallback) {
  try {
    return game.settings.get("fgt", key) ?? fallback;
  } catch {
    return fallback;
  }
}
