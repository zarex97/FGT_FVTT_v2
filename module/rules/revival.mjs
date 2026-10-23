/**
 * @file Coming back from zero Health.
 * @see docs/45-case-studies.md, Ch. 45, docs/06-units-and-stats.md
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

import { meetsRequirement } from "./items.mjs";
import { watermarkKey } from "../domain/health.mjs";
import { test } from "./predicate.mjs";
import { rollOptionsFor } from "./options.mjs";

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

/** The published priorities (Ch. 45). Content may state its own. */
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
export function availableRevivals(unit, rolls = null, { killer = null } = {}) {
  return [...(unit?.revivals ?? [])]
    .filter((source) => isAvailable(source, unit, rolls, { killer }))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * The sources whose own chance missed: available in every other respect, and
 * the die came in over it. Gilles (Caster): *"When Gilles is defeated and
 * Prelati's Spellbook is not destroyed, he has a 10% chance of transforming
 * into the Gigantic Horror. Otherwise, X number of Elder Horrors appear"*
 * (#323): the miss is a card line, and what follows a miss is the source's.
 *
 * @param {object} unit
 * @param {Record<string, number>} rolls
 * @returns {Array<{source: RevivalSource, roll: number}>}
 */
export function missedRevivalChances(unit, rolls = {}) {
  const missed = availableRevivals(unit)
    .filter((s) => s.chance !== null && s.chance !== undefined)
    .map((source) => ({ source, roll: rolls[`revival:${source.id}:chance`], barred: false }))
    .filter(({ source, roll }) => typeof roll === "number" && roll > source.chance);
  // ...and the sources whose die is barred where he stands: no roll, and the
  // miss's actions all the same (#323 reading 11h, ruled 2026-10-23).
  const barred = [...(unit?.revivals ?? [])]
    .filter((s) => s.chance !== null && s.chance !== undefined && chanceBarred(s, unit))
    .filter((s) => isAvailable(s, unit, null, { ignoreBar: true }))
    .map((source) => ({ source, roll: null, barred: true }));
  return [...missed, ...barred];
}

/**
 * Is this source's die barred where the Unit stands?
 *
 * @param {object} source
 * @param {object} unit
 * @returns {boolean}
 */
function chanceBarred(source, unit) {
  return (source.chanceBarredWhen ?? []).length > 0
    && test(source.chanceBarredWhen, { options: rollOptionsFor({ attacker: unit }) });
}

/**
 * @param {object} source
 * @param {object} unit
 * @returns {boolean}
 */
function isAvailable(source, unit, rolls = null, { ignoreBar = false, killer = null } = {}) {
  if (source.charges !== null && source.charges !== undefined && source.charges <= 0) return false;
  // WHO defeated it, asked of the killer's own options (#328 ruling 6): no
  // killer on the record, no revival.
  if ((source.killer ?? []).length > 0) {
    if (!killer || !test(source.killer, { options: rollOptionsFor({ attacker: killer }) })) return false;
  }
  // A die barred where he stands is no source at all: never rolled, never taken.
  if (!ignoreBar && chanceBarred(source, unit)) return false;

  // A source that comes on a die (Gilles's 10%, #323): available once the die
  // is in and under its chance. Asked with no rolls -- `pendingRevivalRolls`,
  // before anything is rolled -- the die is still to come.
  if (rolls !== null && source.chance !== null && source.chance !== undefined) {
    const roll = rolls[`revival:${source.id}:chance`];
    if (!(typeof roll === "number" && roll <= source.chance)) return false;
  }

  // A source that has been declined. `resolveDefeat` is pure and cannot ask a
  // question, so the orchestrator asks first and stamps the answer on the unit
  // it hands in (`engine/attack.mjs#resolveDefeatOf`). An optional source that
  // nobody was asked about is NOT available: a transformation that spends every
  // token the Servant holds must not happen because a prompt timed out.
  if (source.optional && !(unit.acceptedRevivals ?? []).includes(source.id)) return false;

  // A clause about where the bearer is STANDING, answered against its own roll
  // options at the moment of defeat. Divine Protection revives him only inside
  // the Complex, and where he died is not knowable when the rule element is
  // collected.
  if (source.predicate && !test(source.predicate, { options: rollOptionsFor({ attacker: unit }) })) {
    return false;
  }

  // Gates the source states in the ordinary requirement vocabulary. *"...and
  // while she has at least 1 Fragarach Token."*
  for (const req of source.requires ?? []) {
    if (!meetsRequirement(req, { unit })) return false;
  }

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
    const at = unit.healthWatermarks?.[watermarkKey(fraction)] ?? null;
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
 * @returns {{revived: boolean, source: RevivalSource|null, restored: number, chargesUsed: number, rolled?: number[], overkill?: number}}
 */
export function resolveRevival({ unit, overkill = 0, rolls = {}, killer = null }) {
  const source = availableRevivals(unit, rolls, { killer })[0] ?? null;
  if (!source) return { revived: false, source: null, restored: 0, chargesUsed: 0 };

  const max = maxHealthOf(unit);
  const perCharge = (n) => (source.percentOfMax !== null && source.percentOfMax !== undefined
    ? Math.floor(max * (source.percentOfMax / 100))
    : (rolls[`revival:${source.id}:${n}`] ?? 0));

  // Overkill reaches what a source restores ONLY when the source says so, and
  // the only source that says so is God Hand: *"if the damage of the Attack
  // that defeated Heracles exceeds his current Health, the excess damage is
  // reduced from his newly restored Health, and so on"*. `cascading` is that
  // clause -- spending charges against the excess is all it means -- so a
  // cascading source carries the overkill and every other source ignores it.
  //
  // It used to be the other way round: every source subtracted the overkill
  // and Mannanan's "restoring her Health TO 50%" opted out. Guts 10 on a
  // 1,250-Health Servant therefore restored 125 less whatever killed her, and
  // an overkill of 167 left her dead (#172). Guts, Undying, Battle
  // Continuation, Divine Protection and Holder Mode state an amount or a
  // destination and nothing about the blow that preceded it.
  let remaining = source.cascading ? Math.max(0, overkill) : 0;
  let restored = 0;
  let used = 0;
  const limit = source.charges ?? 1;
  // What each charge rolled, for the card: a die nobody sees is a die nobody
  // can check (#256: God Hand's last use failed against 70 and no line said so).
  /** @type {number[]} */
  const rolledEach = [];

  do {
    const rolled = perCharge(used);
    if (source.percentOfMax === null || source.percentOfMax === undefined) rolledEach.push(rolled);
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
  if (restored <= 0) return { revived: false, source, restored: 0, chargesUsed: used, rolled: rolledEach, overkill };

  return { revived: true, source, restored, chargesUsed: used, rolled: rolledEach, overkill };
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
    if (source.chance !== null && source.chance !== undefined) out.push({ key: `revival:${source.id}:chance`, formula: "1d100" });
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
 * Three readings were possible (Ch. 45): the specific ability, the attacking
 * unit, or the specific instance. The instance is vacuous — it never recurs —
 * and the attacker is extraordinarily strong: Karna could never kill him again
 * by any means. So it is **the ability**, with a per-attacker pseudo-id for
 * Normal Attacks. Karna's normal attacks stop being lethal after one kill; each
 * of his three Noble Phantasms still gets its own chance.
 *
 * @param {object} attack `{abilityId, kind, ride}`
 * @param {string} attackerId
 * @param {object} [opts]
 * @param {boolean} [opts.counter] the Attack is a Counter
 * @returns {string}
 */
export function attackIdentity(attack, attackerId, { counter = false } = {}) {
  // Ruled 2026-10-19 (#256 reading 5): wherever the board can tell two Attacks
  // apart, each is its own record. An Attack with an ability (a Mana Burst, an
  // NP) is that ability's; a Riding Attack, though it counts as a Normal Attack,
  // is the ride's; a Counter is the Counter's, whatever it swung with. Only a
  // plain Normal Attack is the attacker's one Normal Attack.
  const base = attack?.abilityId ? `ability:${attack.abilityId}`
    : attack?.ride ? `riding:${attackerId}`
    : `normal:${attackerId}`;
  return counter ? `counter:${base}` : base;
}

/**
 * "That Attack" for a Combat Process: its declaration, its attacker, and
 * whether it is a Counter. The ONE reader the damage floor, the ledger and an
 * Instakill's floor ask, so the three cannot name one Attack two ways.
 *
 * @param {object|null} process a Combat Process state `{attack, attackerId, isCounter}`
 * @param {object} [attack] the declaration's facts, when the caller has richer ones
 * @returns {string|null} null outside an Attack
 */
export function identityOfProcess(process, attack = process?.attack) {
  if (!process?.attackerId) return null;
  return attackIdentity(attack ?? {}, process.attackerId, { counter: Boolean(process.isCounter) });
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

/**
 * The pools a revival restores beside Health, as the deltas that take each to
 * its share of the maximum. A pool already above it keeps what it has.
 *
 * *"...she revives with her Health, Agility, and Luck restored to 50% of their
 * maximum values"* (U-Olga Marie, #328 ruling 6).
 *
 * @param {object} unit a unit snapshot: `agility`, `maxAgility`, `luck`, `maxLuck`
 * @param {Record<string, number>|null} pools percent of maximum, by pool
 * @returns {Array<{stat: string, delta: number, value: number}>}
 */
export function poolRestores(unit, pools) {
  const MAX = { agility: "maxAgility", luck: "maxLuck" };
  return Object.entries(pools ?? {}).flatMap(([stat, percent]) => {
    const max = unit?.[MAX[stat]] ?? 0;
    const value = Math.floor(max * (Number(percent) / 100));
    const delta = value - (unit?.[stat] ?? 0);
    return delta > 0 ? [{ stat, delta, value }] : [];
  });
}
