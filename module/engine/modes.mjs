/**
 * @file Reconciling modes a compulsion forces on.
 * @see module/rules/modes.mjs, docs/17-abilities.md, docs/45-case-studies.md
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

import { forcedModes, forcedOffNow, modesEndedByTurn } from "../rules/modes.mjs";
import { currentBoard } from "./board.mjs";
import { applyWorldIntents } from "./applier.mjs";
import * as I from "./intents.mjs";
import { publicSpeakerFor } from "./public-identity.mjs";
import { publicIdentityOf } from "./public-identity.mjs";

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
    /** @type {Array<{unitId: string, ability: string}>} */
    const stopped = [];

    const tick = game.combat?.system?.globalTurn ?? 0;

    for (const unit of snapshot.units ?? []) {
      // BOTH sources, not just the first. This read `unit.compulsions` alone,
      // which was complete while Penthesilea was the only clause of this shape
      // -- and silently skipped every Servant held on by a `ForceMode` rule
      // instead, because Raikou carries no compulsions at all. The element
      // would have collected, the refusal in `canToggleMode` would have
      // worked, and the half that WRITES would never have run: her Mad
      // Enhancement would refuse to switch off and refuse to switch itself on.
      const actor = game.actors.get(unit.id);
      if (!actor) continue;

      // A mode switched OFF the moment its own forced deactivation holds
      // (#190 reading 13): an enemy dropping her Master to 30 ends the rage
      // there, before any drain.
      for (const item of [...actor.items].filter((i) => i.system?.isMode && i.system?.active)) {
        if (!forcedOffNow(item, unit, snapshot)) continue;
        intents.push(I.setMode(unit.id, item.system?.slug ?? item.id, false, "forcedDeactivation"));
        stopped.push({ unitId: unit.id, ability: item.name });
      }

      const forceable = (unit.compulsions ?? []).length || (unit.forcedModeRules ?? []).length;
      if (!forceable) continue;

      for (const item of forcedModes(unit, [...actor.items], { tick, board: snapshot })) {
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
      if (switched.length > 0) await announce(switched, snapshot);
      if (stopped.length > 0) await announceStopped(stopped);
    }
    return switched;
  } finally {
    running = false;
  }
}

/**
 * The writes that end a mode whose duration was "this Turn".
 *
 * Riding's Active: *"Increases MOV by 6 panels for this Turn."* The duration
 * lives on the mode's `MovDelta`, and a derived delta's duration is its
 * SOURCE's business (`rules/derived.mjs`) -- here `system.active`. Nothing
 * switched it off, so the +6 outlasted the Turn it was pressed in (#116).
 * The scheduler asks this at every Turn's end, before `globalTurn` advances,
 * and `rules/modes.mjs#modesEndedByTurn` answers which modes are due.
 *
 * Returned rather than written, so the scheduler applies it through the same
 * path as every other boundary step. The item id is what is named: a Servant
 * may hold several documents sharing the `riding` slug.
 *
 * @param {object[]} units the board's Units
 * @param {number} tick the global Turn that is ending
 * @returns {object[]} `setMode` intents, each switching one mode off
 */
export function turnEndModeIntents(units, tick) {
  /** @type {object[]} */
  const intents = [];
  for (const unit of units ?? []) {
    const actor = game.actors?.get(unit.id);
    if (!actor) continue;
    for (const item of modesEndedByTurn([...actor.items], tick)) {
      intents.push(I.setMode(unit.id, item.id, false, "turnEnd"));
    }
  }
  return intents;
}

/**
 * Which compulsion is forcing this mode, for the log and the card.
 *
 * @param {object} unit
 * @param {string} slug
 * @returns {string|null}
 */
function compulsionSource(unit, slug) {
  return (unit.compulsions ?? []).find((c) => c.forcesSkill === slug)?.source
    // ...or the `ForceMode` rule that named it, so the card can still say why.
    // A mode that switches itself on with no explanation is indistinguishable
    // from a bug, and this one takes control of the Servant away from its
    // player -- the reason the announcement exists at all.
    ?? (unit.forcedModeRules ?? []).find((r) => r.mode === slug)?.source
    ?? null;
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
      content: `<p><strong>${ability}</strong> activated on `
        + `${actor ? publicIdentityOf(actor, currentBoard()).name : unitId} — `
        + `${cause?.source ?? "a compulsion"}`
        + `${culprits.length ? `: ${culprits.join(", ")} within range` : ""}.</p>`,
      speaker: actor ? publicSpeakerFor(actor) : undefined,
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
    // `board` as well: a Master's Health changing is an actor update, and it
    // is what decides a forced deactivation (#190).
    if (!targets?.includes("compulsions") && !targets?.includes("all") && !targets?.includes("board")) return;
    // Not awaited: this is a reaction to a document change, not part of any
    // resolution, and blocking the hook would block the write that fired it.
    reconcileForcedModes().catch((err) => console.error("FGT | Forced modes:", err));
  });
}

/**
 * Say which modes were forcibly switched off, and why.
 *
 * @param {Array<{unitId: string, ability: string}>} stopped
 * @returns {Promise<void>}
 */
async function announceStopped(stopped) {
  if (!game.users?.activeGM?.isSelf) return;
  const escape = foundry.utils.escapeHTML;
  const lines = stopped.map((s) => game.i18n.format("FGT.Mode.ForcedOff", {
    ability: escape(s.ability), name: escape(game.actors.get(s.unitId)?.name ?? s.unitId),
  }));
  await ChatMessage.create({ content: `<div class="fgt-card fgt-card--mode"><p>${lines.join("<br>")}</p></div>` });
}
