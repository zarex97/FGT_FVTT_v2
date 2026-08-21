/**
 * @file Reconciling modes a compulsion forces on.
 * @see module/rules/modes.mjs, docs/15-abilities.md §15.3, docs/44-case-expanded-roster.md
 *
 * Layer 3. `rules/modes.mjs` decides *which* modes should be on; this is the
 * half that writes.
 *
 * Penthesilea's *Hatred of Achilles* is the only clause in the reference set
 * that needs it, and it is worth quoting in full because both halves are
 * unusual:
 *
 * > *"At any time, if there is a Greek Male Unit (regardless of enemy or ally)
 * > within a 4 panel area around Penthesilea, her Mad Enhancement is
 * > **immediately activated regardless of Cooldown or any other factors**. Mad
 * > Enhancement cannot be deactivated until there are no Greek Male Units
 * > within a 4 panel area of Penthesilea."*
 *
 * The refusal half is a question `canToggleMode` answers when a player presses
 * the button. The activation half is not a question at all: nobody presses
 * anything, and *"at any time"* means the moment the condition becomes true —
 * so something has to be watching.
 *
 * **Positional, so it re-runs on movement.** The compulsion itself is computed
 * from the board every time it is asked (`rules/compulsion.mjs`), exactly like
 * an aura, and for the same reason: it must lift the instant the Greek Male
 * leaves, with no cleanup step to forget. This module rides the same
 * invalidation the aura index does.
 *
 * **The reverse is deliberately absent.** Nothing here switches a mode *off*
 * when the compulsion lifts — the sheet says it "cannot be deactivated until"
 * they are gone, which frees the player's hand rather than moving it for them.
 * A Berserker who has been driven mad does not simply calm down.
 */

import { forcedModes } from "../rules/modes.mjs";
import { currentBoard } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";

/**
 * Guards against re-entry.
 *
 * Switching a mode on writes to an Item, which fires `updateItem`, which
 * invalidates, which would call this again. `io.setMode` already returns early
 * when the mode is in the state asked for, so a second pass is a no-op — but a
 * no-op that rebuilds the whole board on every toggle is still worth not doing.
 *
 * @type {boolean}
 */
let running = false;

/**
 * Switch on every mode a compulsion is currently forcing.
 *
 * @param {object} [board] an existing snapshot, if the caller already has one
 * @returns {Promise<Array<{unitId: string, ability: string}>>} what was switched
 */
export async function reconcileForcedModes(board = null) {
  // GM only. This writes, and every client watching the same token move would
  // otherwise race to make the same write.
  if (!game.user?.isGM || running) return [];

  running = true;
  try {
    const snapshot = board ?? currentBoard();
    /** @type {object[]} */
    const intents = [];
    /** @type {Array<{unitId: string, ability: string}>} */
    const switched = [];

    for (const unit of snapshot.units ?? []) {
      if (!(unit.compulsions ?? []).length) continue;

      const actor = game.actors.get(unit.id);
      if (!actor) continue;

      for (const item of forcedModes(unit, [...actor.items])) {
        const slug = item.system?.slug ?? item.id;
        // `regardless of Cooldown or any other factors` -- no gate is
        // consulted, which is the whole point of the clause and the reason
        // this does not go through `canToggleMode`.
        intents.push(I.setMode(unit.id, slug, true, compulsionSource(unit, slug)));
        switched.push({ unitId: unit.id, ability: item.name });
      }
    }

    if (intents.length > 0) {
      await applyWorldIntents(intents, "compulsion:forcedMode");
      await announce(switched, snapshot);
    }
    return switched;
  } finally {
    running = false;
  }
}

/**
 * Which compulsion is forcing this mode, for the log and the card.
 *
 * @param {object} unit
 * @param {string} slug
 * @returns {string|null}
 */
function compulsionSource(unit, slug) {
  return (unit.compulsions ?? []).find((c) => c.forcesSkill === slug)?.source ?? null;
}

/**
 * Say what happened, and why.
 *
 * A mode that switches itself on with no explanation is indistinguishable from
 * a bug, and this one takes control of the Servant away from its player for as
 * long as it lasts — §29's own standard is that the current state **and its
 * cause** must be visible.
 *
 * @param {Array<{unitId: string, ability: string}>} switched
 * @param {object} board
 * @returns {Promise<void>}
 */
async function announce(switched, board) {
  for (const { unitId, ability } of switched) {
    const actor = game.actors.get(unitId);
    const unit = (board.units ?? []).find((u) => u.id === unitId);
    const cause = (unit?.compulsions ?? [])[0];
    const culprits = (cause?.targetIds ?? [])
      .map((id) => game.actors.get(id)?.name)
      .filter(Boolean);

    await ChatMessage.create({
      content: `<p><strong>${ability}</strong> activated on ${actor?.name ?? unitId} — `
        + `${cause?.source ?? "a compulsion"}`
        + `${culprits.length ? `: ${culprits.join(", ")} within range` : ""}.</p>`,
      speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined,
    });
  }
}

/**
 * Watch for the moments a compulsion's answer can change.
 *
 * Rides `fgt.invalidate` rather than subscribing to the Foundry hooks
 * directly, so the list of "what can change a positional answer" is maintained
 * in one place (`rules/invalidation.mjs`) instead of two.
 *
 * Called from `ready`.
 */
export function attachForcedModes() {
  Hooks.on("fgt.invalidate", (targets) => {
    if (!targets?.includes("compulsions") && !targets?.includes("all")) return;
    // Not awaited: this is a reaction to a document change, not part of any
    // resolution, and blocking the hook would block the write that fired it.
    reconcileForcedModes().catch((err) => console.error("FGT | Forced modes:", err));
  });
}
