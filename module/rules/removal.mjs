/**
 * @file Whether a buff a Unit is carrying actually comes off.
 * @see docs/15-effect-application.md, docs/45-case-studies.md
 *
 * Layer 2 (rules). Pure — the caller rolls and passes the totals in, the same
 * contract every other check in this layer uses.
 *
 * Removal used to be unconditional: a phase named a selector, `removals` picked
 * the matching instances, and they went. Two rules had nowhere to live.
 *
 * **`Buff Removal ResUp`.** Appendix A lists it and no content could carry it,
 * because there was no roll for a resistance to modify. Kingprotea's *Huge
 * Scale* is the first: *"If Kingprotea has 1 Proliferation stock, the chance of
 * buffs being removed from herself is reduced by 35%. For every additional
 * stock, the magnitude is increased by 5%."*
 *
 * **The bypass.** Her *Infantile Regression* then removes those very stocks and
 * *"ignores effects that prevent buffs from being removed"* — dispelling **her
 * own** buffs, through the protection they themselves granted. Ch. 45 calls it a
 * self-targeting bypass and it is the reason the flag is on the *removal* and
 * not on the effect: the same buffs resist one remover and not another.
 *
 * Only **buffs** are protected. Every clause of this shape in the corpus says
 * "buffs", and a cleanse of one's own debuffs — Self-Suggestion's *"removes all
 * debuffs from Kingprotea"* — must not be resisted by a Skill that exists to
 * keep her buffs on.
 */

import { polarityOf } from "./effect-instance.mjs";

/**
 * @typedef {object} RemovalCandidate
 * @property {string} defId
 * @property {string} [polarity]
 * @property {boolean} [unremovable]
 * @property {number} [ownResist] the effect's own `removalResist`, any polarity
 */


/**
 * Is this instance beyond any cleanse?
 *
 * The definition may say so (Appendix A's few), and so may the INSTANCE -- an
 * `unremovable` apply, Burning's Burn. The two removal paths each asked
 * `def.unremovable ?? instance` and the registry reports `false`, never `null`,
 * so the instance was never read: Self-Suggestion cleansed an Unremovable Atk
 * Dwn (#198, SS.unrem). One reader for both.
 *
 * @param {object|null|undefined} def the effect definition
 * @param {object|null|undefined} instance the ActiveEffect
 * @returns {boolean}
 */
export function isUnremovable(def, instance) {
  return Boolean(def?.unremovable || instance?.system?.unremovable);
}

/** What a `removeEffect` phase's `selector` may name, all of them read below. */
export const SELECTOR_KEYS = Object.freeze(["polarity", "valence"]);

/**
 * Does a held instance match a `removeEffect` selector, and may it come off?
 *
 * One matcher for the Skill path and the Attack path, which each kept their own
 * and read `polarity` alone. `valence` is Antares Snipe's *"all Defensive
 * Buffs"* (#326 ruling 15). An unremovable instance never matches.
 *
 * @param {{polarity?: string, valence?: string}} selector
 * @param {object} instance the ActiveEffect
 * @param {object|null} def its definition
 * @param {{evenUnremovable?: boolean}} [opts] match an Unremovable one too, to say it stays (#348)
 * @returns {boolean}
 */
export function selectorMatches(selector, instance, def, { evenUnremovable = false } = {}) {
  if (!def) return false;
  if (selector?.polarity && polarityOf(instance.system, def) !== selector.polarity) return false; // fgt-polarity-ok: the phase's selector
  if (selector?.valence && def.valence !== selector.valence) return false;
  return evenUnremovable || !isUnremovable(def, instance);
}

/**
 * How much this Unit resists having a buff taken off it.
 *
 * @param {object} unit a unit snapshot carrying `buffRemovalResist`
 * @returns {number} percentage points, never negative
 */
export function removalResistOf(unit) {
  const total = (unit?.buffRemovalResist ?? []).reduce((sum, c) => sum + (c.value ?? 0), 0);
  return Math.max(0, total);
}

/**
 * The resistance an effect carries against its own removal, for a candidate.
 *
 * @param {object|null|undefined} def the effect definition
 * @returns {number}
 */
export function ownRemovalResist(def) {
  return Math.max(0, Number(def?.removalResist ?? 0) || 0);
}

/**
 * Decide which of a set of candidates actually come off.
 *
 * `rolls` is keyed by `defId`, so two instances of one effect share a roll:
 * the clause is about the buff, and rolling per document would let a
 * ten-stack effect lose four and keep six from one dispel. A candidate with no
 * roll supplied is removed — a caller that did not roll has not resisted.
 *
 * @param {object} args
 * @param {RemovalCandidate[]} args.candidates
 * @param {object} args.bearer the unit snapshot the effects are on
 * @param {Record<string, number>} [args.rolls] `defId` → `1d100`
 * @param {boolean} [args.ignoresProtection] the remover bypasses resistance
 * @returns {{removed: string[], resisted: Array<{defId: string, chance: number, roll: number}>}}
 */
export function removalPlan({ candidates, bearer, rolls = {}, ignoresProtection = false }) {
  const resist = ignoresProtection ? 0 : removalResistOf(bearer);

  /** @type {string[]} */
  const removed = [];
  /** @type {Array<{defId: string, chance: number, roll: number}>} */
  const resisted = [];

  for (const candidate of candidates ?? []) {
    // An Unremovable effect is refused before any roll: Appendix A marks a few
    // that no dispel reaches at all, and a chance would imply one sometimes
    // does.
    if (candidate.unremovable) continue;

    // Debuffs are not protected by the BEARER. See the file header. An effect
    // that resists on its own does, whatever it is: Kazıklı (#330).
    const own = ignoresProtection ? 0 : Math.max(0, candidate.ownResist ?? 0);
    const bearerResist = candidate.polarity === "buff" ? resist : 0; // fgt-polarity-ok: a removal candidate, built with polarityOf
    if (bearerResist + own <= 0) {
      removed.push(candidate.defId);
      continue;
    }

    const chance = Math.max(0, 100 - bearerResist - own);
    const roll = rolls[candidate.defId];
    if (typeof roll !== "number" || roll <= chance) removed.push(candidate.defId);
    else resisted.push({ defId: candidate.defId, chance, roll });
  }

  return { removed, resisted };
}

/**
 * Which candidates need a `1d100` before {@link removalPlan} can decide.
 *
 * The other half of the caller-rolls contract: a caller has no way to know that
 * a removal needs dice without asking, and guessing would mean rolling one per
 * candidate on every dispel in the game.
 *
 * @param {object} args
 * @param {RemovalCandidate[]} args.candidates
 * @param {object} args.bearer
 * @param {boolean} [args.ignoresProtection]
 * @returns {string[]} defIds, deduplicated
 */
export function pendingRemovalRolls({ candidates, bearer, ignoresProtection = false }) {
  if (ignoresProtection) return [];
  const resist = removalResistOf(bearer);
  return [...new Set(
    (candidates ?? [])
      .filter((c) => !c.unremovable
        && ((resist > 0 && c.polarity === "buff") || (c.ownResist ?? 0) > 0)) // fgt-polarity-ok: a removal candidate, built with polarityOf
      .map((c) => c.defId),
  )];
}
