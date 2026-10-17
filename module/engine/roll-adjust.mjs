/**
 * @file A player moving a roll their Unit has just made, by a granted amount.
 * @see docs/13-checks-and-randomness.md
 *
 * Layer 3. The grant is a `RollAdjustment` rule element (`rules/elements.mjs`),
 * which `rules/checks.mjs#checkPlan` has returned as `adjustable` since it was
 * written, with nothing reading it. Hundred-Faced Hassan's Expert of Many
 * Specializations is its first content:
 *
 * > *"Whenever Hassan performs a dice roll outside of Combat, you can reduce or
 * > increase the value of that dice roll by up to 3."*
 *
 * A prompt after the roll is seen, -3 to +3, for any roll he makes outside a
 * Combat Process (#226 readings 10, 25). `scope: outsideCombat` is the grant's
 * own word for that, and the callers here are the roll sites that stand
 * outside one: a field's Evade at a Turn's boundary, a Skill's drag, the
 * escape from a forest. His setup rolls are moved in the war's setup
 * (`engine/summon.mjs#adjustSummonLine`).
 */

import { askOwner } from "./ask.mjs";

/**
 * How far this Unit may move a roll of this check outside combat, or 0.
 *
 * @param {object|null} unit a board snapshot
 * @param {string} check `"evade"`, `"luck"`, `"agility"`, ...
 * @returns {number}
 */
export function adjustmentFor(unit, check) {
  return (unit?.checkModifiers ?? [])
    .filter((m) => m.playerAdjustable && (m.scope ?? "self") === "outsideCombat"
      && (m.check === "any" || m.check === check))
    .reduce((n, m) => Math.max(n, m.max ?? 3), 0);
}

/**
 * Offer the Unit's owner to move a roll just made, and return the moved roll.
 *
 * A closed window is no change.
 *
 * @param {object|null} unit a board snapshot
 * @param {number} roll the die as rolled
 * @param {{check: string, label?: string}} spec
 * @returns {Promise<{roll: number, delta: number}>}
 */
export async function offerRollAdjustment(unit, roll, { check, label = "" }) {
  const max = adjustmentFor(unit, check);
  const actor = unit?.id ? game.actors.get(unit.id) : null;
  if (max <= 0 || !actor) return { roll, delta: 0 };
  const answer = await askOwner(actor, {
    kind: "adjustRoll", roll, max,
    // fgt-name-ok: the Unit's own player's prompt or notice; its owner knows the name
    title: label || actor.name,
    hint: game.i18n.format("FGT.Roll.AdjustHint", { roll, max }),
  });
  const delta = Math.max(-max, Math.min(max, Math.trunc(Number(answer?.delta) || 0)));
  return { roll: roll + delta, delta };
}
