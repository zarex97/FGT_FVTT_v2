/**
 * @file Coming back from zero Health.
 * @see docs/31-case-heracles.md §31.2, §31.3, docs/04-units.md §4.13
 *
 * Layer 2 (rules). Pure — the caller rolls and passes the totals in.
 *
 * Heracles has **four** revival mechanisms and his sheet states the order they
 * resolve in:
 *
 * > *"The priority of revival effects in Herc are as follows: Undying > normal
 * > Guts > Battle Continuation > God Hand."*
 *
 * which specialises the general rule: *"Special Guts/Other revival buffs > Guts
 * > Passive revival effects."*
 *
 * So this is a **priority-ordered query**, not a chain of `if`s. Content
 * declares the priority and the engine never names a Servant — which is what
 * lets a fifth mechanism be added by authoring it.
 *
 * Until now the defeat handler took *any* handler that healed, in collection
 * order. With one source that is indistinguishable from correct; with four it
 * spends whichever happened to be listed first, which for Heracles means
 * burning a God Hand charge while `Undying` sits unused.
 */

/**
 * @typedef {object} RevivalSource
 * @property {string} id
 * @property {number} priority         higher wins
 * @property {number|null} charges     remaining, or null for unlimited
 * @property {boolean} cascading       may spend several charges on one hit
 * @property {string|null} formula     what one charge restores
 * @property {number|null} percentOfMax
 * @property {boolean} consumesOnUse
 * @property {string|null} defId       the effect instance to spend, if any
 * @property {string|null} abilityId
 * @property {string} source
 */

/** The published priorities (§31.2). Content may state its own. */
export const REVIVAL_PRIORITY = Object.freeze({
  specialGuts: 300,
  guts: 200,
  skill: 100,
  passive: 50,
});

/**
 * Which revival sources this unit can actually use, best first.
 *
 * Availability is checked here rather than by the caller because every gate is
 * a property of the unit: charges left, the source's own cooldown, and the
 * *"Health must have been restored back to above half its maximum value at
 * least once since the last activation"* clause that Battle Continuation and
 * Rho Aias share.
 *
 * @param {object} unit a unit snapshot carrying `revivals`
 * @returns {RevivalSource[]}
 */
export function availableRevivals(unit) {
  return [...(unit?.revivals ?? [])]
    .filter((source) => isAvailable(source, unit))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * @param {object} source
 * @param {object} unit
 * @returns {boolean}
 */
function isAvailable(source, unit) {
  if (source.charges !== null && source.charges !== undefined && source.charges <= 0) return false;

  // The source's OWN cooldown, read off the ability list. That reuses the clock
  // `advanceCooldowns` already turns rather than inventing a second one, and it
  // means the window is visible on the sheet where a player can see why the
  // revive did not happen.
  const ability = (unit.abilities ?? []).find((a) => a.id === source.abilityId);
  if ((ability?.cooldownRemaining ?? 0) > 0) return false;

  // "...at least once SINCE the last activation." A question about history,
  // which `healthWatermarks` answers: a Servant who has been at full Health all
  // match and never dropped has not been *restored* to anything.
  const fraction = source.requiresHealthRestoredSince ?? null;
  if (fraction !== null) {
    const at = unit.healthWatermarks?.[String(fraction)] ?? null;
    const last = ability?.lastUsedTick ?? null;
    if (last !== null && (at === null || at < last)) return false;
  }

  return true;
}

/**
 * Resolve one defeat against the best available source.
 *
 * **Cascading** is God Hand's *"if the damage of the Attack that defeated
 * Heracles exceeds his current Health, the excess damage is reduced from his
 * newly restored Health, **and so on**"* — so one very large attack can burn
 * several charges in a single resolution. A 4,000-damage hit against a Heracles
 * at 1,500 leaves 2,500 of overkill, which is two or three charges at an
 * average of 105 per `10d20`.
 *
 * The loop is bounded by the charges themselves, and guarded anyway.
 *
 * @param {object} args
 * @param {object} args.unit
 * @param {number} [args.overkill] damage left over after Health reached 0
 * @param {Record<string, number>} [args.rolls] keyed `revival:<id>:<n>`
 * @returns {{revived: boolean, source: RevivalSource|null, restored: number, chargesUsed: number}}
 */
export function resolveRevival({ unit, overkill = 0, rolls = {} }) {
  const source = availableRevivals(unit)[0] ?? null;
  if (!source) return { revived: false, source: null, restored: 0, chargesUsed: 0 };

  const max = maxHealthOf(unit);
  const perCharge = (n) => (source.percentOfMax !== null && source.percentOfMax !== undefined
    ? Math.floor(max * (source.percentOfMax / 100))
    : (rolls[`revival:${source.id}:${n}`] ?? 0));

  let remaining = Math.max(0, overkill);
  let restored = 0;
  let used = 0;
  const limit = source.charges ?? 1;

  do {
    const rolled = perCharge(used);
    used += 1;
    if (rolled <= 0) break;

    if (rolled > remaining) {
      restored = rolled - remaining;
      remaining = 0;
    } else {
      remaining -= rolled;
      restored = 0;
    }
  } while (source.cascading && remaining > 0 && used < limit);

  // Every charge spent and still nothing left: the revival failed, and the
  // charges are spent anyway -- "and so on" describes an attempt, not a refund.
  if (restored <= 0) return { revived: false, source, restored: 0, chargesUsed: used };

  return { revived: true, source, restored, chargesUsed: used };
}

/**
 * The rolls a unit's revival sources need, before the defeat is resolved.
 *
 * The other half of the caller-rolls contract. A cascading source needs one
 * roll per charge it might spend, because the number it will actually use is
 * not known until the earlier ones have been subtracted.
 *
 * @param {object} unit
 * @returns {Array<{key: string, formula: string}>}
 */
export function pendingRevivalRolls(unit) {
  /** @type {Array<{key: string, formula: string}>} */
  const out = [];
  for (const source of availableRevivals(unit)) {
    if (!source.formula) continue;
    const count = source.cascading ? Math.max(1, source.charges ?? 1) : 1;
    for (let n = 0; n < count; n++) out.push({ key: `revival:${source.id}:${n}`, formula: source.formula });
  }
  return out;
}

/**
 * What identifies "that Attack", for God Hand's second passive.
 *
 * *"Whenever an Attack reduces Heracles' Health to 0 for the first time, record
 * that Attack under this Skill. These recorded Attacks can no longer defeat
 * Heracles."*
 *
 * Three readings were possible (§31.3): the specific ability, the attacking
 * unit, or the specific instance. The instance is vacuous — it never recurs —
 * and the attacker is extraordinarily strong: Karna could never kill him again
 * by any means. So it is **the ability**, with a per-attacker pseudo-id for
 * Normal Attacks. Karna's normal attacks stop being lethal after one kill; each
 * of his three Noble Phantasms still gets its own chance.
 *
 * @param {object} attack `{abilityId, kind}`
 * @param {string} attackerId
 * @returns {string}
 */
export function attackIdentity(attack, attackerId) {
  return attack?.abilityId ? `ability:${attack.abilityId}` : `normal:${attackerId}`;
}

/**
 * Is this attack one the unit has already survived?
 *
 * @param {object} unit
 * @param {string} identity
 * @returns {{floored: boolean, source: string|null}}
 */
export function recordedAttack(unit, identity) {
  for (const ability of unit?.abilities ?? []) {
    if ((ability.recordedAttacks ?? []).includes(identity)) {
      return { floored: true, source: ability.name ?? ability.id };
    }
  }
  return { floored: false, source: null };
}

/**
 * @param {object} unit
 * @returns {number}
 */
function maxHealthOf(unit) {
  const health = unit?.health;
  if (typeof health === "number") return unit?.maxHealth ?? unit?.health?.max ?? health;
  return health?.max ?? 0;
}
