/**
 * @file Command Spells, tracked per relationship rather than per Master.
 * @see docs/16-relationships.md §16.9
 *
 * Layer 2 (rules). Pure.
 *
 * Contracts move — a Master dies and their Servant is inherited, a Servant is
 * stolen — so a flat count on the Master cannot say *which* Servant its spells
 * reach. §16.9 splits it in two:
 *
 *   - **own** spells work on any contracted Servant. The original three.
 *   - **perServant** spells work only on the one they were granted for.
 *
 * Two consequences follow, and both are the point rather than side effects.
 * Spending takes from **perServant first**, because they are the more
 * restricted pool and keeping the flexible ones back is strictly better for the
 * player. And **Unbound is derived**, not stored: a Master with zero own spells
 * and three borrowed for Servant B has Servant A Unbound and Servant B
 * contracted, which §16.9 calls a genuinely interesting state and which no
 * single counter can express.
 */

/**
 * How many spells this Master can use on this Servant.
 *
 * @param {object} master
 * @param {string} servantId
 * @returns {number}
 */
export function availableFor(master, servantId) {
  return (master?.commandSpells ?? 0) + (master?.commandSpellsPerServant?.[servantId] ?? 0);
}

/**
 * Is this Servant Unbound?
 *
 * Derived, never stored. A stored flag would need updating from four different
 * places — spending, granting, inheriting, and the Master dying — and the one
 * that got missed would leave a Servant permanently Unbound with a full pool.
 *
 * @param {object} master
 * @param {string} servantId
 * @returns {boolean}
 */
export function isUnbound(master, servantId) {
  return availableFor(master, servantId) === 0;
}

/**
 * Which pools a spend would draw from.
 *
 * Returns the plan rather than performing it, so the caller can show the cost
 * before committing and the engine can turn it into one write.
 *
 * @param {object} master
 * @param {string} servantId
 * @param {number} count
 * @returns {{ok: boolean, reason?: string, fromPerServant: number, fromOwn: number, pools: string[]}}
 */
export function spendPlan(master, servantId, count) {
  const granted = master?.commandSpellsPerServant?.[servantId] ?? 0;
  const own = master?.commandSpells ?? 0;

  if (granted + own < count) {
    return { ok: false, reason: "cost", fromPerServant: 0, fromOwn: 0, pools: [] };
  }

  // The restricted pool first -- see the file comment.
  const fromPerServant = Math.min(granted, count);
  const fromOwn = count - fromPerServant;

  return {
    ok: true,
    fromPerServant,
    fromOwn,
    pools: [
      ...(fromPerServant > 0 ? ["perServant"] : []),
      ...(fromOwn > 0 ? ["own"] : []),
    ],
  };
}

/**
 * Every pool this Master holds, for the Master sheet (§29.3).
 *
 * A Servant with a grant but **no contract** is included: spells granted for a
 * Servant outlive the contract that produced them, which is the whole reason
 * they are namespaced. Hiding it would make an inherited pool invisible until
 * the contract was re-formed.
 *
 * @param {object} master
 * @returns {Array<{servantId: string, own: number, granted: number, total: number, unbound: boolean}>}
 */
export function poolsOf(master) {
  const own = master?.commandSpells ?? 0;
  const perServant = master?.commandSpellsPerServant ?? {};
  const ids = [...new Set([...(master?.servantIds ?? []), ...Object.keys(perServant)])];

  return ids.map((servantId) => {
    const granted = perServant[servantId] ?? 0;
    return {
      servantId,
      own,
      granted,
      total: own + granted,
      unbound: own + granted === 0,
    };
  });
}
