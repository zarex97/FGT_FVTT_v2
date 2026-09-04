/**
 * @file What may answer a Counter, and who may Counter a Counter.
 * @see docs/12-combat-process.md §12.8
 *
 * Layer 2 (rules). Pure.
 *
 * The rulebook says the DU *"may use the 'Counter' Action and declare an
 * Attack on the AU"* — an Attack, not *the* Normal Attack. `beginCounter` has
 * taken the attack as a parameter since it was written and no caller ever
 * passed one, so the default was the entire feature: every Counter in the game
 * was a Normal Attack at exactly one target.
 */

import { classifyAbility } from "./ability-use.mjs";

/**
 * How far a chain of Counters may run before the engine stops it.
 *
 * A constant rather than a setting. The chain already terminates on cost —
 * reaching a bystander needs an AREA ability and an ability pays its own price,
 * while a Normal Attack cannot catch a bystander at all — so this is a backstop
 * against a content bug that authors a free area attack, not a rule. A table
 * that legitimately reaches depth 8 has found something worth reading about
 * rather than configuring.
 */
export const MAX_COUNTER_DEPTH = 8;

/** The two answers to "may a Counter be Countered?" (`fgt.counterChain`). */
export const COUNTER_CHAIN_MODES = Object.freeze(["collateral", "strict"]);

/**
 * Everything this unit could answer a Counter with.
 *
 * The Normal Attack is always first and always free. Everything else is
 * whatever `classifyAbility` already calls an Attack — reused rather than
 * re-derived so that "what is an Attack" has exactly one definition in the
 * system. That predicate already drops passives, modes and dialog abilities,
 * and already keeps the non-damaging Noble Phantasms, which still cost a
 * Servant its attack.
 *
 * Whether the unit can PAY for one of these is a separate question, answered by
 * `rules/costs.mjs#canUseAbility`. Kept separate so an ability the counterer
 * cannot afford is still offered, disabled, with its reason: a player deciding
 * whether to counter needs to know the Noble Phantasm exists.
 *
 * @param {object[]} items ability documents, or anything with `type` and `system`
 * @returns {Array<{id: string|null, name: string, img: string|null, isNP: boolean, isNormalAttack: boolean}>}
 */
export function counterOffer(items) {
  const normal = {
    id: null, name: "FGT.Chat.NormalAttack", img: null, isNP: false, isNormalAttack: true,
  };
  const abilities = (items ?? [])
    .filter((item) => classifyAbility(item).isAttack)
    .map((item) => ({
      id: item.id,
      name: item.name,
      img: item.img ?? null,
      isNP: item.type === "noblePhantasm" || item.system?.isNP === true,
      isNormalAttack: false,
    }));
  return [normal, ...abilities];
}

/**
 * May the defender of this Process counter it?
 *
 * The safety property of the whole feature, in one place.
 *
 * **Rule 1**, true in both modes: the unit a Counter was aimed at never answers
 * it. Without that, two Servants in range of each other counter one another
 * until one of them dies.
 *
 * **The setting** governs only the other case — a bystander an area Counter
 * caught on its way to somebody else. In `collateral` they keep their own right
 * to counter, because they were not the ones being countered; their answer is
 * itself a Counter aimed at its own target, so Rule 1 closes it one step later.
 *
 * A Counter with no `requiredTargetId` is a bug upstream, and refusing is the
 * safe reading: the alternative is the open chain this function exists to close.
 *
 * @param {object} process a `ProcessState`
 * @param {string} defenderId the unit asking to counter
 * @param {string} mode one of `COUNTER_CHAIN_MODES`
 * @returns {boolean}
 */
export function mayCounterAgain(process, defenderId, mode) {
  if (!process?.isCounter) return true;
  if (!process.requiredTargetId) return false;
  if (defenderId === process.requiredTargetId) return false;
  return mode === "collateral";
}
