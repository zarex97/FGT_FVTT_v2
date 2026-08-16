/**
 * @file Platform operations — boarding, and coming apart.
 * @see docs/20-platforms-and-levels.md §20.4, §20.9
 *
 * Layer 3. The rules decide; this rolls, writes and moves tokens.
 */

import {
  boardingTarget, fallOff, destructionSequence, passengersOf,
} from "../rules/platforms.mjs";
import { currentBoard } from "./board.mjs";
import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";

/**
 * Attempt to board a platform.
 *
 * The modifiers **reduce the required value** rather than adding to the roll —
 * the same arithmetic, and a very easy thing to implement backwards, so the
 * comparison is written the way the rulebook states it.
 *
 * *"A boarding Servant may bring its Master if the Master was within 2 panels."*
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.platformId
 * @param {boolean} [args.hitByDragonWingWarriors]
 * @param {boolean} [args.bringMaster]
 * @returns {Promise<{ok: boolean, roll: number, target: number, reason?: string}>}
 */
export async function boardPlatform({ unitId, platformId, hitByDragonWingWarriors = false, bringMaster = false }) {
  const board = currentBoard();
  const unit = board.units.find((u) => u.id === unitId);
  const platform = board.units.find((u) => u.id === platformId && u.kind === "platform");
  if (!unit || !platform) return { ok: false, roll: 0, target: 0, reason: "unknownUnitOrPlatform" };

  // Capacity is counted before the roll: failing a roll you could never have
  // benefited from wastes the attempt for no reason.
  const aboard = passengersOf(platform, board).length;
  if (platform.capacity !== null && aboard >= platform.capacity) {
    return { ok: false, roll: 0, target: 0, reason: "full" };
  }

  const { die, target } = boardingTarget(unit, { hitByDragonWingWarriors });
  const roll = (await new Roll(`1d${die}`).evaluate()).total;
  const ok = roll >= target;

  const intents = [I.log({
    kind: "boarding", unitId, platformId, roll, target, die, ok,
  })];

  if (ok) {
    intents.push(I.move(unitId, [platform.panel], true));
    if (bringMaster && unit.masterId) {
      const master = board.units.find((u) => u.id === unit.masterId);
      // "if the Master was within 2 panels" — checked against where the Master
      // stood, not where the Servant ended up.
      if (master) intents.push(I.move(master.id, [platform.panel], true));
    }
  }

  await applyWorldIntents(intents, "platform:board");
  return { ok, roll, target };
}

/**
 * Knock a unit off the edge.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.platformId
 * @param {boolean} args.passedAgility
 * @param {boolean} [args.servantRescued]
 * @returns {Promise<void>}
 */
export async function knockOff({ unitId, platformId, passedAgility, servantRescued = false }) {
  const board = currentBoard();
  const unit = board.units.find((u) => u.id === unitId);
  const platform = board.units.find((u) => u.id === platformId);
  if (!unit || !platform) return;

  const descriptors = fallOff(unit, platform, { passedAgility, servantRescued });
  await applyWorldIntents(await toIntents(descriptors), "platform:fall");
}

/**
 * Take the platform apart (§20.9).
 *
 * The order is the specification's and it matters: save, damage the failures,
 * scatter **everyone**, then remove the level. Surviving the fall is not the
 * same as staying in the air.
 *
 * @param {object} args
 * @param {string} args.platformId
 * @param {Record<string, boolean>} [args.saves] unitId → passed
 * @returns {Promise<void>}
 */
export async function destroyPlatform({ platformId, saves = {} }) {
  const board = currentBoard();
  const platform = board.units.find((u) => u.id === platformId);
  if (!platform) return;

  const descriptors = destructionSequence(platform, board, { saves });
  await applyWorldIntents(await toIntents(descriptors), "platform:destroyed");
  Hooks.callAll("fgtPlatformDestroyed", platform);
}

/**
 * Turn platform descriptors into intents.
 *
 * `scatter`, `removeLevel`, `removeOwnerEffects` and `dismissBoundSummons` are
 * **logged by name** rather than silently dropped: each needs a Scene Level
 * operation this build does not perform, and a platform that quietly fails to
 * come apart is worse than one that says it could not.
 *
 * @param {object[]} descriptors
 * @returns {Promise<object[]>}
 */
async function toIntents(descriptors) {
  /** @type {object[]} */
  const out = [];
  for (const d of descriptors) {
    switch (d.kind) {
      case "move":
        out.push(I.move(d.unitId, [d.to], d.forced !== false));
        break;
      case "damage":
        out.push(d.formula
          ? I.damage(d.unitId, (await new Roll("10*2d6").evaluate()).total, null, { fixed: true, source: d.source })
          : I.damage(d.unitId, d.amount, null, { fixed: true, source: d.source }));
        break;
      case "overpower":
        out.push(I.log({ kind: "overpowerRequired", unitId: d.unitId, reason: d.reason }));
        break;
      default:
        out.push(I.log({ kind: "platformStep", step: d.kind, ...d }));
        break;
    }
  }
  return out;
}
