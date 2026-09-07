/**
 * @file Whether a buff a Unit is carrying actually comes off.
 * @see docs/11-effect-engine.md §11.7, docs/36-case-remaining.md §36.7
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
 * own** buffs, through the protection they themselves granted. §36.7 calls it a
 * self-targeting bypass and it is the reason the flag is on the *removal* and
 * not on the effect: the same buffs resist one remover and not another.
 *
 * Only **buffs** are protected. Every clause of this shape in the corpus says
 * "buffs", and a cleanse of one's own debuffs — Self-Suggestion's *"removes all
 * debuffs from Kingprotea"* — must not be resisted by a Skill that exists to
 * keep her buffs on.
 */

/**
 * @typedef {object} RemovalCandidate
 * @property {string} defId
 * @property {string} [polarity]
 * @property {boolean} [unremovable]
 */

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

    // Debuffs are not protected. See the file header.
    if (resist <= 0 || candidate.polarity !== "buff") {
      removed.push(candidate.defId);
      continue;
    }

    const chance = Math.max(0, 100 - resist);
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
  if (ignoresProtection || removalResistOf(bearer) <= 0) return [];
  return [...new Set(
    (candidates ?? [])
      .filter((c) => !c.unremovable && c.polarity === "buff")
      .map((c) => c.defId),
  )];
}
