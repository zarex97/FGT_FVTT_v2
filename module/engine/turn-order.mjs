/**
 * @file Faction turn order.
 * @see docs/25-turn-system.md §25.3, docs/19-environment.md §19.8
 *
 * Layer 3, but pure: it takes rolls and returns an order. The caller rolls.
 *
 * Re-rolled **every Round**, not once at setup (Ch. 41 Q32). Ties are re-rolled
 * only among the tied factions and only for the contested positions — not the
 * whole order — and the GM always goes last.
 */

/**
 * @param {Array<{id: string, roll: number}>} entries one per faction
 * @param {object} [opts]
 * @param {string|null} [opts.gmId] always placed last
 * @returns {{order: string[], contested: string[][]}}
 */
export function resolveTurnOrder(entries, { gmId = null } = {}) {
  const factions = entries.filter((e) => e.id !== gmId);

  /** @type {Map<number, string[]>} */
  const byRoll = new Map();
  for (const e of factions) {
    if (!byRoll.has(e.roll)) byRoll.set(e.roll, []);
    byRoll.get(e.roll).push(e.id);
  }

  const order = [];
  const contested = [];
  for (const roll of [...byRoll.keys()].sort((a, b) => b - a)) {
    const tied = byRoll.get(roll);
    if (tied.length > 1) contested.push([...tied]);
    order.push(...tied);
  }

  if (gmId) order.push(gmId);
  return { order, contested };
}

/**
 * Apply a tie-break re-roll to one contested group, leaving the rest alone.
 *
 * @param {string[]} order
 * @param {Array<{id: string, roll: number}>} rerolls
 * @returns {{order: string[], stillContested: string[][]}}
 */
export function breakTie(order, rerolls) {
  const ids = new Set(rerolls.map((r) => r.id));
  // The contested positions are exactly the slots the tied factions occupy;
  // everyone else keeps theirs.
  const slots = order.map((id, index) => (ids.has(id) ? index : -1)).filter((i) => i >= 0);

  const { order: resolved, contested } = resolveTurnOrder(rerolls);
  const next = [...order];
  slots.forEach((slot, k) => { next[slot] = resolved[k]; });

  return { order: next, stillContested: contested };
}
