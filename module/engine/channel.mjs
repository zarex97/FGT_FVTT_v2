/**
 * @file A multi-Turn ability activation.
 * @see docs/32-case-semiramis.md
 *
 * Layer 3. Semiramis's Hanging Gardens of Babylon is the only clause in the
 * reference set that needs this: *"Semiramis has to be within her Home Base,
 * and cannot Act for 3◈ Turns. If Semiramis is Attacked during this period,
 * the period of 3◈ Turns is interrupted and she has to restart the
 * activation process. If Semiramis is not interrupted, the Hanging Gardens
 * of Babylon is activated at the end of the last Turn in that period.
 * Semiramis' Master only loses Health as per NP usage rules only when HGoB
 * successfully activates, not at the start of the NP activation process."*
 *
 * Four moments: start (the `channel` phase kind, `engine/skill-use.mjs`),
 * advance (this unit's own Turn ending, uninterrupted), interrupt (Attacked
 * during the window), and complete (the last Turn's advance clears the
 * counter, pays the deferred cost, and activates the platform directly --
 * NOT by re-running the ability's own `phases:`, which would re-open the
 * channel it is this moment closing).
 */

import { currentBoard, unitFrom } from "./board.mjs";
import { parseTick, resolveTicks } from "../domain/tick.mjs";
import { applyWorldIntents } from "./applier.mjs";
import { npCostAt } from "../rules/costs.mjs";
import * as I from "./intents.mjs";

/**
 * Open a channel.
 *
 * @param {object} actor
 * @param {object} ability the Item being used
 * @param {object} phase the `{kind: "channel", ...}` phase, authored on the
 *   ability (`ticks`, and whatever the completion needs -- `platformId` for
 *   the Hanging Gardens)
 * @returns {Promise<boolean>} whether one was actually opened
 */
export async function startChannel(actor, ability, phase) {
  if (actor.system?.channel) return false;

  const required = resolveTicks(parseTick(phase.ticks ?? "1◈"), {
    turnsPerRound: game.settings.get("fgt", "turnsPerRound"),
  });
  await actor.update({
    "system.channel": {
      abilityId: ability.id,
      contentId: ability.system?.contentId ?? ability.id,
      startedTick: game.combat?.system?.globalTurn ?? 0,
      ticksRequired: required,
      elapsedTicks: 0,
      // Carried through unchanged to `completeChannel` -- content-authored,
      // not interpreted here, so a second channelling ability (were one ever
      // written) needs no change to this file.
      onComplete: phase.onComplete ?? null,
    },
    "system.canAct": false,
  });
  return true;
}

/**
 * End a channel, restoring the ability to Act either way.
 *
 * @param {object} actor
 * @returns {Promise<void>}
 */
async function clearChannel(actor) {
  await actor.update({ "system.channel": null, "system.canAct": null });
}

/**
 * Advance every channelling unit of the given faction by one Turn.
 *
 * Called from the unit's OWN Turn ending -- "cannot Act for 3◈ Turns" counts
 * the bearer's own Turns, the same scale Sustainability's clock does, not
 * the global tick.
 *
 * @param {object[]} units unit snapshots of the faction whose Turn just ended
 * @returns {Promise<void>}
 */
export async function advanceChannels(units) {
  for (const unit of units) {
    if (!unit.channel) continue;
    const actor = game.actors.get(unit.id);
    if (!actor) continue;

    const elapsed = (unit.channel.elapsedTicks ?? 0) + 1;
    if (elapsed >= unit.channel.ticksRequired) {
      await completeChannel(actor, unit);
    } else {
      await actor.update({ "system.channel.elapsedTicks": elapsed });
    }
  }
}

/**
 * Interrupt every channelling unit that was just attacked.
 *
 * "If Semiramis is Attacked during this period" -- declared against, not
 * necessarily hit: the channel is lost the moment an attack names her as a
 * defender, which is why this is called from `attack.mjs` at declaration
 * rather than from the damage step.
 *
 * @param {string[]} defenderIds
 * @returns {Promise<void>}
 */
export async function interruptChannels(defenderIds) {
  for (const id of new Set(defenderIds)) {
    const actor = game.actors.get(id);
    if (!actor?.system?.channel) continue;
    await clearChannel(actor);
    await applyWorldIntents(
      [I.log({ kind: "channelInterrupted", unitId: id, reason: "attacked" })],
      "channel:interrupted",
    );
  }
}

/**
 * Finish a channel: pay the deferred NP cost, then hand `onComplete` to
 * whoever declared it (the Hanging Gardens' own `engine/platforms.mjs`).
 *
 * @param {object} actor
 * @param {object} unit the unit's OWN snapshot, from the caller's board pass
 * @returns {Promise<void>}
 */
async function completeChannel(actor, unit) {
  const onComplete = unit.channel?.onComplete ?? null;
  const abilityId = unit.channel?.abilityId ?? null;
  await clearChannel(actor);

  const board = currentBoard();
  const self = unitFrom(board, actor);
  const master = self.masterId ? unitFrom(board, game.actors.get(self.masterId)) : null;
  const ability = abilityId ? actor.items.get(abilityId) : null;

  /** @type {object[]} */
  const intents = [I.log({ kind: "channelCompleted", unitId: actor.id, abilityId })];

  // "Only when HGoB successfully activates" -- the NP cost this ability
  // would ordinarily have paid at use, deferred until now.
  if (ability?.system?.isNP) {
    const cost = npCostAt({ rank: ability.system?.rank, unit: self, master });
    const { costIntents } = await import("./skill-use.mjs");
    intents.push(...costIntents(cost, self));
  }
  await applyWorldIntents(intents, "channel:complete");

  // Deliberately a Hook, not a direct call: this file knows nothing about
  // platforms, and a Hanging-Gardens-specific module (`engine/hgob.mjs`)
  // listens for it and does the actual work (creating the platform actor at
  // Semiramis's panel, moving her aboard, applying her rank-up). Any FUTURE
  // channelling ability reuses this same completion path for free.
  Hooks.callAll("fgt.channelComplete", { actorId: actor.id, onComplete });
}
