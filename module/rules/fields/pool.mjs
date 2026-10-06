/**
 * @file A field that drains its victims and pays the total to somebody else.
 * @see docs/28-bounded-fields.md
 *
 * Layer 2 (rules). Pure.
 *
 * Every other interior event in the corpus writes to the unit it lands on.
 * Blood Fort Andromeda is the first that takes from one set of units and gives
 * to another, with a cap that couples the two:
 *
 * > *"The total Health lost from all affected victims is used to heal either or
 * > both Medusa and her Master (total amount healed between the two cannot
 * > exceed the amount of Health drained from victims)."*
 *
 * The cap is the rule, so it is enforced here rather than trusted to the
 * content: two beneficiaries and one pool means an uncapped split would pay the
 * drain out twice.
 */

/**
 * Split a drained pool between beneficiaries, capped at the pool.
 *
 * *"either or both"* is the owner's player's choice (#188 reading 2), made by
 * {@link splitPool}. This is the answer when nobody chooses: an even split, the
 * remainder to the first named, who is the field's owner.
 *
 * @param {number} pool total Health drained this tick
 * @param {Array<{unitId: string}>} beneficiaries in priority order
 * @returns {Array<{unitId: string, amount: number}>} entries with 0 omitted
 */
export function distributePool(pool, beneficiaries) {
  const total = Math.max(0, Math.floor(pool ?? 0));
  const who = (beneficiaries ?? []).filter((b) => b?.unitId);
  if (total === 0 || who.length === 0) return [];

  const share = Math.floor(total / who.length);
  const remainder = total - share * who.length;

  return who
    .map((b, n) => ({ unitId: b.unitId, amount: share + (n === 0 ? remainder : 0) }))
    .filter((h) => h.amount > 0);
}

/**
 * The pool divided as the owner's player chose.
 *
 * > *"The total Health lost from all affected victims is used to heal either or
 * > both Medusa and her Master (total amount healed between the two cannot
 * > exceed the amount of Health drained from victims)."*
 *
 * Ruled (#188 reading 2): her player divides it, each time a drain falls due.
 * The first beneficiary gets the amount chosen, clamped to the pool; the
 * second gets the rest. No answer, or anything but two beneficiaries, is
 * {@link distributePool}'s even split.
 *
 * @param {number} pool
 * @param {Array<{unitId: string}>} beneficiaries
 * @param {number|null} first the Health chosen for the first beneficiary
 * @returns {Array<{unitId: string, amount: number}>} entries with 0 omitted
 */
export function splitPool(pool, beneficiaries, first) {
  const total = Math.max(0, Math.floor(pool ?? 0));
  const who = (beneficiaries ?? []).filter((b) => b?.unitId);
  if (who.length !== 2 || !Number.isFinite(first)) return distributePool(pool, beneficiaries);
  const mine = Math.min(total, Math.max(0, Math.floor(first)));
  return [
    { unitId: who[0].unitId, amount: mine },
    { unitId: who[1].unitId, amount: total - mine },
  ].filter((h) => h.amount > 0);
}
