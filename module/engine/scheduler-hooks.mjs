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
import * as fields from "./fields.mjs";

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
  const activeFactionId = factionOf(combat, prior);
  const activeUnits = board.units.filter((u) => u.factionId === activeFactionId);
  const actedUnits = board.units.filter((u) => u.acted);

  const ctx = {
    tick,
    round: combat.round ?? 1,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    activeFactionId,
    // Injected rather than imported by the scheduler, so the scheduler stays
    // testable without a compendium. It is what lets an expiring effect run
    // its own "on removal" clause -- Shock's Agility restoration.
    effectDef: (id) => EffectRegistry.get(id),
    // The other half of `scheduler.pendingRolls`'s "caller rolls" contract
    // (module/engine/scheduler.mjs), which `attack.mjs` already honours for
    // `unitDefeated` -- this hook never did, for the boundary events it
    // fires here. A `turnEnd`/`actedTurnEnd` handler with its own `roll:`
    // (Semiramis's `Construction` effect: "HGoB Construction is increased by
    // 1d6 at the end of every Turn") wrote nothing, silently, forever.
    rolls: await gatherRolls([[activeUnits, "turnEnd"], [actedUnits, "actedTurnEnd"]]),
  };

  await run(scheduler.endTurn(board, ctx), "scheduler:endTurn");

  // A field's OWN "acted then ended its Turn" rule -- Sikera Ušum clause b.
  // Belongs to the AREA rather than to Semiramis, the same reason
  // Unlimited Blade Works' turnStart toll below is authored on the field:
  // whoever is dragged in is subject to it, not just units she targets.
  await run(await fields.runFieldEvents("actedTurnEnd"), "field:actedTurnEnd");

  // …and the plain end of a Turn. Jack's Mist charges Poison BOTH ways --
  // "at the end of its Turn OR at the end of a Turn they Act while still
  // within the Mist" -- and only the acted half had a dispatcher, so a field
  // could author a `turnEnd` interior event and never be asked.
  await run(await fields.runFieldEvents("turnEnd"), "field:turnEnd");

  // A field's OWNER's Turn ending. Contagion trigger 1 is *"at the end of Pale
  // Rider's Turn: affects all enemy Units within the Contagion area"* -- every
  // enemy inside, not just one who acted, and only on HIS Turn.
  //
  // `fgt.unitTurnEnd` has been in §E since that reference was written and
  // nothing ever dispatched it. Scoped to the fields whose owner belongs to
  // the faction whose Turn just ended, which is what "its own Turn" means for
  // an area: firing it unscoped would charge Contagion on every faction's Turn
  // and triple the toll.
  const ownedFields = (board.fields ?? [])
    .filter((f) => activeUnits.some((u) => u.id === f.ownerId))
    .map((f) => f.id);
  if (ownedFields.length > 0) {
    await run(
      await fields.runFieldEvents("unitTurnEnd", { fieldIds: ownedFields }),
      "field:unitTurnEnd",
    );
  }

  // Jack's Mist: "During Jack's Turn OR at the end of any Turn Jack Acts,
  // she can Move the Mist and/or change the shape once." The second window,
  // offered before the upkeep so a repaint cannot be pre-empted by the field
  // closing for non-payment on the same boundary.
  await fields.offerReshape(board);

  // A field that charges to stay open, charged. Applies its own intents and
  // may close the field, so it is not folded into the `run` above.
  await fields.runUpkeep(tick);

  // A channelling unit's own Turn ending, uninterrupted -- the Hanging
  // Gardens' "cannot Act for 3◈ Turns." Scoped to the active faction's units
  // for the same reason `turnEnd` handlers are: this counts THIS unit's own
  // Turn, not the global tick.
  const { advanceChannels } = await import("./channel.mjs");
  await advanceChannels(activeUnits);

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

  const startingBoard = boardFor(combat);
  await run(
    scheduler.beginTurn(startingBoard, {
      ...ctx, tick: nextTick, activeFactionId: incoming,
      // `beginTurn` fires `turnStart` for EVERY unit (Shock's action-loss
      // roll can land on anyone's turn start), not just the incoming
      // faction's -- so this is its own gather, not `ctx.rolls` carried over.
      rolls: await gatherRolls([[startingBoard.units, "turnStart"]]),
    }),
    "scheduler:beginTurn",
  );

  // Bounded fields: close the expired ones, then run what the survivors do at
  // a Turn boundary. Ch. 43's whole read side shipped with nothing creating a
  // field and nothing ending one, so a `duration` was decoration -- which for a
  // total-isolation Reality Marble means the match never ends.
  await fields.expireFields(nextTick);
  // A passive field has no cast to open it and no expiry to close it, so the
  // Turn boundary is where it is reconciled with the board: a Servant summoned
  // mid-match gets his area, one who left the board loses it. Idempotent, and
  // after `expireFields` so a field that just closed is not reopened by its
  // own passive twin on the same tick.
  await fields.ensurePassiveFields();
  await run(await fields.runFieldEvents("turnStart"), "field:turnStart");
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

  const board = boardFor(combat);
  const ctx = {
    tick: combat.system?.globalTurn ?? 0,
    round: combat.round ?? 1,
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
    activeFactionId: null,
    effectDef: (id) => EffectRegistry.get(id),
    // Switches off the multi-Servant tax (§16.7). Read here rather than in the
    // rules layer, which has no settings.
    grandOrder: setting("grandOrder", false),
    rolls: await gatherRolls([[board.units, "roundEnd"]]),
  };

  await run(scheduler.endRound(board, ctx), "scheduler:endRound");

  // The Grail's contest and the victory check, both evaluated at round end
  // (§19.4). Written back to the match, which is the runtime owner the Grail
  // never had -- `grailCounter` sat on `MatchData` from the start with nothing
  // incrementing or reading it.
  await advanceGrail(combat, board);

  // Turn order is re-rolled every Round (Ch. 41 Q32), before the new Round's
  // start-of-round effects fire.
  if (typeof combat.rollTurnOrder === "function") await combat.rollTurnOrder();

  const startingBoard = boardFor(combat);
  await run(
    scheduler.beginRound(startingBoard, {
      ...ctx, round: (combat.round ?? 1) + 1,
      rolls: await gatherRolls([[startingBoard.units, "roundStart"]]),
    }),
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
 * The rolls a batch of (units, event) pairs will need, evaluated.
 *
 * The caller-rolls half of `scheduler.pendingRolls`'s contract: a pure
 * scheduler sequence reads totals out of `ctx.rolls` and never rolls dice
 * itself (`module/engine/scheduler.mjs`), so whoever calls it has to gather
 * and evaluate first. `attack.mjs` already does this for `unitDefeated`; nothing
 * did it for a Turn or Round boundary event's own `roll:`, which produced a
 * silent no-op indistinguishable from a working, zero-magnitude effect.
 *
 * @param {Array<[object[], string]>} pairs
 * @returns {Promise<Record<string, number>>}
 */
async function gatherRolls(pairs) {
  /** @type {Record<string, number>} */
  const rolls = {};
  for (const [units, event] of pairs) {
    for (const u of units) {
      for (const spec of scheduler.pendingRolls(u, event)) {
        if (!spec.formula || spec.key in rolls) continue;
        rolls[spec.key] = (await new Roll(spec.formula).evaluate()).total;
      }
    }
  }
  return rolls;
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
