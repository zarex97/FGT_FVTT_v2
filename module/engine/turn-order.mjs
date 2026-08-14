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
 * The order actually played, after Delay.
 *
 * `Delay+X` moves a faction **X positions later among the factions that have not
 * yet acted**, which is not the same as X positions later in the round: a
 * faction that delays behind two players who then take their turns has already
 * had its delay honoured, and shifting it again would let one declaration push
 * it to the back of the round. So the split is the point — `taken` is frozen,
 * `pending` is what Delay may reorder, and the GM is appended last afterwards.
 *
 * A faction that has already acted keeps its Delay for the *next* round rather
 * than having it discarded, which is what "applies next round instead" means:
 * this function simply ignores it, and the round-end scheduler decides whether
 * it survives.
 *
 * Guarantees, all of them tested:
 * - every id in `baseOrder` appears exactly once;
 * - the GM is always last;
 * - a faction that has acted never moves;
 * - `Delay+X` moves a faction at most X positions later, and never past the GM.
 *
 * @param {string[]} baseOrder the rolled order, GM excluded
 * @param {Record<string, number>} [delays] faction id → positions to delay by
 * @param {Iterable<string>} [takenThisRound] factions that have already acted
 * @param {string|null} [gmId] appended last when set
 * @returns {string[]}
 * @see docs/25-turn-system.md §25.3
 */
export function computeTurnOrder(baseOrder, delays = {}, takenThisRound = [], gmId = null) {
  const taken = new Set(takenThisRound);
  const base = baseOrder.filter((id) => id !== gmId);

  const acted = base.filter((id) => taken.has(id));
  const pending = base.filter((id) => !taken.has(id));

  // Applied in **declaration** order — the insertion order of `delays` — not in
  // turn order, because a Delay is relative to the order as it stood when it was
  // declared. Two factions each delaying by 1 past each other end up back where
  // they started, which is what happens at the table and is not what applying
  // them in turn order produces.
  for (const [id, by] of Object.entries(delays)) {
    if (by <= 0 || taken.has(id)) continue;
    const from = pending.indexOf(id);
    if (from < 0) continue;
    pending.splice(from, 1);
    pending.splice(Math.min(from + by, pending.length), 0, id);
  }

  return gmId ? [...acted, ...pending, gmId] : [...acted, ...pending];
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
