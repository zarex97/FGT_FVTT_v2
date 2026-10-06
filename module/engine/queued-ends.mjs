/**
 * @file Ends pressed outside their owner's Turn, held for the Turn's end.
 * @see docs/28-bounded-fields.md, docs/27-platforms-and-levels.md, docs/24-modes-and-control.md
 *
 * Layer 3. *"This NP can be deactivated during Quetz's Turn or at the start or
 * end of any Round or Turn."* Ruled 2026-10-02 (#65, ruling 19): an End pressed
 * during somebody else's Turn does not end the Noble Phantasm there and then,
 * it waits for the next boundary -- the end of the Turn it was pressed in --
 * and the bar says so. Every `deactivation: { window: any }` block: the bounded
 * fields, the platforms and the one Mode that carries it, Tenmōkaikai.
 *
 * Kept on the Combat as `flags.fgt.queuedEnds`, the place `deferred` keeps what
 * a handler owes a later boundary, and paid by `scheduler-hooks.mjs` after the
 * end-of-Turn sequence. Every writer runs on the GM: the field and platform
 * operations already do, and a Mode's queue is asked for through
 * `queueModeEnd`.
 */

import * as I from "./intents.mjs";
import { applyWorldIntents } from "./applier.mjs";

const FLAG = "queuedEnds";

/**
 * @typedef {object} QueuedEnd
 * @property {"field"|"platform"|"mode"} kind
 * @property {string} id the field id, the platform's actor id, or the Mode's item id
 * @property {string} ownerId the Unit that pressed End
 * @property {number} tick when it was pressed
 */

/**
 * @param {object} [combat]
 * @returns {QueuedEnd[]}
 */
export function queuedEnds(combat = game.combats?.active) {
  return combat?.getFlag?.("fgt", FLAG) ?? [];
}

/**
 * Is this field, platform or Mode waiting for the Turn's end?
 * @param {string} id
 * @param {object} [combat]
 * @returns {boolean}
 */
export function isQueued(id, combat = game.combats?.active) {
  return queuedEnds(combat).some((e) => e.id === id);
}

/**
 * Hold an End for the Turn's end. Pressing it twice queues it once.
 * @param {Omit<QueuedEnd, "tick">} entry
 * @param {object} [combat]
 * @returns {Promise<boolean>}
 */
export async function queueEnd(entry, combat = game.combats?.active) {
  if (!combat) return false;
  if (isQueued(entry.id, combat)) return true;
  const tick = combat.system?.globalTurn ?? 0;
  await combat.setFlag("fgt", FLAG, [...queuedEnds(combat), { ...entry, tick }]);
  await applyWorldIntents(
    [I.log({ kind: "field", event: "endQueued", unitId: entry.ownerId, field: entry.id, tick })],
    "queuedEnd",
  );
  return true;
}

/**
 * End everything that was waiting for this boundary.
 *
 * The queue is emptied before anything ends, so an end that throws cannot be
 * paid twice. A field or platform already gone by other means is skipped.
 *
 * @param {object} combat
 * @returns {Promise<QueuedEnd[]>} what was paid
 */
export async function payQueuedEnds(combat) {
  const due = queuedEnds(combat);
  if (due.length === 0) return [];
  await combat.setFlag("fgt", FLAG, []);

  for (const entry of due) {
    if (entry.kind === "field") {
      const { deactivateField } = await import("./fields.mjs");
      await deactivateField(entry.id, "owner");
    } else if (entry.kind === "platform") {
      const { destroyPlatform } = await import("./platforms.mjs");
      await destroyPlatform({ platformId: entry.id, reason: "owner" });
    } else if (entry.kind === "mode") {
      // What the sheet's toggle writes for a Mode switched off: `setMode`
      // flips it and restamps `toggledAt`.
      await applyWorldIntents([I.setMode(entry.ownerId, entry.id, false, "queuedEnd")], "queuedEnd");
    }
  }
  return due;
}
