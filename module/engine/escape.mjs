/**
 * @file Rolling a unit's way out of a bounded field.
 * @see module/rules/bounded-fields.mjs, docs/28-bounded-fields.md
 *
 * Layer 3. The ladder itself is pure and lives in `rules/bounded-fields.mjs`;
 * this rolls the die, writes what the roll decided, and says so in the log.
 *
 * It exists because the ladder had **no caller at all**. `escapeAttempt`
 * implemented every rung of Ch. 28 — base chance, `+N` per failure, border
 * contact, remaining movement, relocation on failure, and the veteran clause
 * that lets an escapee lead adjacent allies out — and the only things that ever
 * called it were its own twelve unit tests. Meanwhile `rules/movement.mjs`
 * asked `membershipVerdict` for an exit, got `rollRequired`, and treated it as a
 * refusal: the conflation `bounded-fields.mjs`'s own docstring warns about in
 * these words —
 *
 * > *"`rollRequired` is not a refusal — it is a refusal of the FREE move, and
 * > the caller is expected to offer `escapeAttempt`. Conflating the two would
 * > turn the Labyrinth from a puzzle into a wall."*
 *
 * It was a wall. Measured on a live board: an enemy on Chaos Labyrinthos's
 * inner border with three panels of movement left, where `escapeAttempt`
 * returns `{ok: true, chance: 20}`, was refused by the interface with *"Step 1
 * passes through a panel this Unit may not enter."* Clauses 5 and 9 of that
 * Noble Phantasm — about half its printed text — could never happen.
 */

import {
  canAttemptEscape, escapeAttempt, randomFreePanelIn, contains,
} from "../rules/bounded-fields.mjs";
import { remainingMovement } from "../rules/movement.mjs";
import { relationOf } from "../rules/relations.mjs";
import { currentBoard } from "./board.mjs";
import { behaviorFor } from "./fields.mjs";
import { displaceToken } from "./io.mjs";

/**
 * Attempt to escape the field this unit is standing in.
 *
 * @param {object} args
 * @param {string} args.unitId
 * @param {string} args.fieldId
 * @returns {Promise<{ok: boolean, reason?: string, chance?: number, roll?: number}>}
 */
export async function attemptEscape({ unitId, fieldId }) {
  const board = currentBoard();
  const field = (board.fields ?? []).find((f) => f.id === fieldId);
  const unit = (board.units ?? []).find((u) => u.id === unitId);
  if (!field || !unit) return { ok: false, reason: "noField" };

  // Allies who have already escaped this field, for the veteran clause. Passed
  // whole; `canAttemptEscape` applies the adjacency and the history itself,
  // because both are its rule rather than this caller's.
  const adjacentVeterans = (board.units ?? []).filter(
    (u) => u.id !== unitId && u.panel && relationOf(u, unit, board) !== "enemy",
  );
  const movRemaining = remainingMovement(unit);

  const gate = canAttemptEscape(field, unit, { movRemaining, adjacentVeterans });
  if (!gate.ok) return gate;

  // The caller rolls, which is the contract every other check in this system
  // keeps: the ladder stays pure and testable, and the die is visible.
  const roll = gate.automatic ? null : (await new Roll(gate.formula).evaluate()).total;
  const verdict = gate.automatic
    ? { ok: true, reason: gate.reason, chance: gate.chance }
    : escapeAttempt(field, unit, { roll, movRemaining, adjacentVeterans });

  const behavior = behaviorFor(fieldId);

  if (verdict.ok) {
    // TWO writes, and they are different clauses. `mayExit` is the transient
    // pass this attempt just bought — without it the gate that `rollRequired`
    // closed would refuse the very move the roll won. `escaped` is clause 9's
    // PERMANENT veteran mark: *"If a Unit that has Successfully escaped the
    // Labyrinth at least once reenters the Labyrinth, its Base Success Chance
    // of Escaping is increased to 100%"* — a better roll on re-entry, not free
    // passage for ever.
    const mayExit = [...new Set([...(field.state?.mayExit ?? []), unitId])];
    await behavior?.update({
      "system.state.mayExit": mayExit,
      [`system.state.escapeHistory.${unitId}.escaped`]: true,
      [`system.state.escapeHistory.${unitId}.failures`]:
        field.state?.escapeHistory?.[unitId]?.failures ?? 0,
    });
    await announce(unit, field, { ...verdict, roll });
    return { ...verdict, roll };
  }

  // *"If the Unit Fails to Escape, it is Moved to a random panel within the
  // Labyrinth."* The relocation is the cost of failing, and it is what stops a
  // trapped unit simply standing on the border re-rolling every Turn at no
  // risk: it is put back in the middle and has to walk out again.
  const failures = (field.state?.escapeHistory?.[unitId]?.failures ?? 0) + 1;
  await behavior?.update({ [`system.state.escapeHistory.${unitId}.failures`]: failures });

  if (verdict.onFailure === "randomRelocate") {
    const panel = randomFreePanelIn(field, board);
    const token = tokenFor(unitId);
    if (panel && token) {
      await displaceToken(token, { x: panel.j * gridSize(), y: panel.i * gridSize() });
    }
  }

  await announce(unit, field, { ...verdict, roll, failures });
  return { ...verdict, roll };
}

/**
 * Drop a unit's exit pass once it is actually outside.
 *
 * The pass is spent by LEAVING, not by a clock: a unit that rolls its way out
 * and then walks back in is inside again on the ordinary terms, and one that
 * wins the roll and then spends its movement elsewhere has not used what it
 * bought. Called from the same sweep that stamps field entries.
 *
 * @param {string[]} unitIds
 * @returns {Promise<void>}
 */
export async function clearSpentExitPasses(unitIds) {
  const board = currentBoard();

  for (const field of board.fields ?? []) {
    const held = field.state?.mayExit ?? [];
    if (held.length === 0) continue;

    const stillInside = held.filter((id) => {
      if (unitIds && !unitIds.includes(id)) return true;
      const unit = (board.units ?? []).find((u) => u.id === id);
      return unit?.panel ? contains(field, unit.panel, board) : true;
    });
    if (stillInside.length !== held.length) {
      await behaviorFor(field.id)?.update({ "system.state.mayExit": stillInside });
    }
  }
}

/** @returns {number} */
function gridSize() {
  return canvas?.scene?.grid?.size ?? 100;
}

/** @param {string} unitId @returns {object|null} */
function tokenFor(unitId) {
  return canvas?.scene?.tokens?.find((t) => t.actorId === unitId) ?? null;
}

/**
 * Say what the roll decided, in the chat log where a contested roll belongs.
 *
 * @param {object} unit
 * @param {object} field
 * @param {object} verdict
 * @returns {Promise<void>}
 */
async function announce(unit, field, verdict) {
  const key = verdict.ok
    ? (verdict.reason === "veteran" ? "FGT.Field.EscapeVeteran"
      : verdict.reason === "ledOut" ? "FGT.Field.EscapeLed" : "FGT.Field.EscapeSuccess")
    : "FGT.Field.EscapeFailed";

  await ChatMessage.create({
    content: `<div class="fgt escape-card">${game.i18n.format(key, {
      name: unit.name ?? "",
      field: field.name ?? field.id,
      roll: verdict.roll ?? "",
      chance: verdict.chance ?? 0,
      next: (verdict.chance ?? 0) + (field.membership?.escape?.chanceIncreasePerFailure ?? 0),
    })}</div>`,
    speaker: { alias: unit.name },
  });
}
