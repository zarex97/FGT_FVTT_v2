/**
 * @file The ghost a Feigned Defeat leaves: who may still reach it.
 * @see CONTEXT.md (Feigned Defeat), docs/30-concealment-and-identity.md, engine/feigned-defeat.mjs
 *
 * Kirihanasu (#249 readings 19, 26): *"She can't be targeted or even caught by
 * abilities other than her own ... Think of it like she was a ghost."* Allies
 * too: no buff and no heal reaches her. One predicate, asked by every door that
 * picks who an ability, an aura, a field or a handler reaches, so the answer
 * cannot differ between two of them. A gate DROPS her silently: an excluded
 * reason, or a card row, would tell the table she is alive.
 *
 * Pure.
 */

import { GRANTS, hasGranted } from "./granted.mjs";

/** The effect a Feigned Defeat leaves on its Unit. */
export const FEIGNED_DEFEAT = "feignedDefeat";

/**
 * Is this Unit out of reach of anything but its own abilities?
 *
 * @param {object|null} unit a unit snapshot
 * @returns {boolean}
 */
export function isUntouchable(unit) {
  return hasGranted(unit, GRANTS.untouchable);
}

/**
 * May this source NOT reach this Unit?
 *
 * @param {object|null} unit the Unit being reached
 * @param {string|null|undefined} sourceUnitId whose ability, aura or handler it is
 * @returns {boolean}
 */
export function untouchableBy(unit, sourceUnitId) {
  return isUntouchable(unit) && unit?.id !== sourceUnitId;
}

/**
 * Is a Feigned Defeat on this Unit, read off its effect ids?
 *
 * For a reader holding the document rather than a projection: the canvas, a
 * chat card's audience.
 *
 * @param {string[]} effectIds
 * @returns {boolean}
 */
export function feignsDefeat(effectIds) {
  return (effectIds ?? []).includes(FEIGNED_DEFEAT);
}

/**
 * Does this ability's use touch its user alone?
 *
 * A ghost may use Skills that touch only herself (#249 reading 27): its own
 * targeting and every phase's must name `self` and nothing else. Read off the
 * usage spec the use gate is handed (`rules/ability-use.mjs#usageSpecFor`).
 *
 * @param {object|null} spec
 * @returns {boolean}
 */
export function touchesOnlyItself(spec) {
  const only = (t) => {
    if (!t) return true;
    const relations = t.selection?.relations ?? t.relations ?? (t.target ? [t.target] : []);
    return relations.length > 0 && relations.every((r) => r === "self");
  };
  return only(spec?.targeting) && (spec?.phaseTargeting ?? []).every(only);
}

/**
 * May a ghost use this ability now?
 *
 * Its Attacks yes -- a Normal Attack, an Attack Skill, a damaging Noble
 * Phantasm -- each of which reveals it (`engine/feigned-defeat.mjs#revealFeignedDefeat`);
 * otherwise only what touches it alone (#249 reading 27).
 *
 * @param {object|null} unit
 * @param {object|null} spec the usage spec, `null` for a Normal Attack
 * @returns {boolean}
 */
export function ghostMayUse(unit, spec) {
  if (!hasGranted(unit, GRANTS.selfOnlySkills)) return true;
  if (!spec || spec.damage || spec.isAttackSkill) return true;
  return touchesOnlyItself(spec);
}
