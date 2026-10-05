/**
 * @file Two per-ability targeting prerequisites: where the caster is looking,
 * and what is standing in the way.
 * @see docs/45-case-studies.md (D44.8), docs/20-targeting.md
 *
 * Layer 2 (rules). Pure.
 *
 * **There is no general line of sight in F/GT and D44.8 decided there will not
 * be.** Medusa's Mystic Eyes is the only ability in the corpus that asks either
 * question, so both of these are opt-in flags on one ability rather than a
 * board-wide rule — which is the whole point of the decision. A future ability
 * that wants them says so; nothing else changes.
 */

import { coneOf, panelsBetween } from "../../domain/geometry.mjs";

/**
 * Is the target in the caster's front quadrant?
 *
 * > *"can only be used if Medusa is facing the targeted Unit."*
 *
 * `coneOf` has answered this since it was written and **nothing had ever called
 * it** — Ch. 13's directional Evade modifiers (*"attacked from left or
 * right +1"*, *"from behind +2"*) are its intended consumer and are still
 * unbuilt, so `rollEvade` assembles its modifiers without them. This is the
 * function's first reader.
 *
 * A unit is always "facing" itself: the quadrant of a zero offset is not a
 * meaningful question, and an ability that targets its own caster should not be
 * refused by a rule about looking at somebody else.
 *
 * @param {object} caster
 * @param {object} target
 * @returns {boolean}
 */
export function facingAllows(caster, target) {
  if (!caster?.panel || !target?.panel) return false;
  if (caster.id && caster.id === target.id) return true;
  return coneOf(caster.facing ?? "n", caster.panel, target.panel) === "front";
}

/**
 * Which of the defender's cones an attack comes from, read at its declaration.
 *
 * Ruled 2026-10-04 (#184 reading 10): read when the attack is DECLARED, before
 * the defender turns to face it, and stamped on the Combat Process so every
 * rung that asks -- the Evade, Achilles' Heel -- gets the same answer. An
 * attack with no direction at all (no attacker on the board, or one standing
 * on the defender's own panel) comes from the front.
 *
 * @param {object|null} defender
 * @param {object|null} attacker
 * @returns {"front"|"left"|"right"|"back"}
 */
export function attackCone(defender, attacker) {
  if (!defender?.panel || !attacker?.panel) return "front";
  if (defender.panel.i === attacker.panel.i && defender.panel.j === attacker.panel.j) return "front";
  return coneOf(defender.facing ?? "n", defender.panel, attacker.panel);
}

/**
 * The directional Evade modifier: Appendix C.1's *"Attacked from the left or
 * right +1"* and *"Attacked from behind +2"*.
 *
 * In the table since it was transcribed, and never applied. Ruled 2026-10-04
 * (#184): **single-target attacks only** -- an area attack already carries its
 * own +2 and has no aimed direction to come from.
 *
 * @param {string|null|undefined} cone from {@link attackCone}
 * @param {boolean} isAoE
 * @returns {{source: string, value: number}|null}
 */
export function directionalEvade(cone, isAoE) {
  if (isAoE) return null;
  if (cone === "back") return { source: "attacked from behind", value: 2 };
  if (cone === "left" || cone === "right") return { source: `attacked from the ${cone}`, value: 1 };
  return null;
}

/**
 * Is there nothing standing between caster and target?
 *
 * > *"Cannot be used on a Unit if there is an obstacle/obstruction between
 * > Medusa and the target Unit. (Example: Unit [Cannot be targeted] — Unit
 * > [Can be targeted] — Medusa)"*
 *
 * The example is the specification: the nearer of two units in a line is
 * targetable and the one behind it is not.
 *
 * A **Civilian does not obstruct** — they are bystanders, not cover, and a rule
 * that let one shield a Servant would make them a tactical resource the game
 * never describes. Neither does a defeated unit, whose token stays on the board
 * (a defeat never removes it, which is the same distinction `rules/cover.mjs`
 * had to draw).
 *
 * @param {object} caster
 * @param {object} target
 * @param {object} board
 * @returns {boolean}
 */
export function pathClear(caster, target, board) {
  if (!caster?.panel || !target?.panel) return false;

  const between = panelsBetween(caster.panel, target.panel);
  if (between.length === 0) return true;

  const blocked = new Set(
    (board?.units ?? [])
      .filter((u) => u.panel && !u.defeated && u.kind !== "civilian")
      .map((u) => `${u.panel.i},${u.panel.j}`),
  );
  return !between.some((p) => blocked.has(`${p.i},${p.j}`));
}
