/**
 * @file A field that drains its victims and pays the total to somebody else.
 * @see docs/43-bounded-fields.md §43.7
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
 * *"either or both"* leaves the division to the table and states no procedure,
 * so an even split is the neutral reading — and the remainder goes to the first
 * named, who is the field's owner. Nothing is wasted and nothing is invented.
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
