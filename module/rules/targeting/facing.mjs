/**
 * @file Two per-ability targeting prerequisites: where the caster is looking,
 * and what is standing in the way.
 * @see docs/44-case-expanded-roster.md §44.3 (D44.8), docs/09-targeting.md
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
 * it** — Ch. 14 §14.5's directional Evade modifiers (*"attacked from left or
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
