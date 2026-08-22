/**
 * @file Agility Checks, Luck Checks, and the generic chance roll.
 * @see docs/14-checks-and-randomness.md
 *
 * Layer 2 (rules). Pure — every check takes its die result as an argument and
 * returns a verdict. The caller rolls; this decides.
 *
 * The favourable/unfavourable split is **symmetric between Evade and Luck**:
 *
 * | | Favourable | Unfavourable |
 * |---|---|---|
 * | Evade      | `1d20` | `1d20+4` |
 * | Luck Check | `1d20` | `1d20+4` |
 *
 * `0.2.0` printed `luckCheck−` as `1d20`, identical to `luckCheck`, and reasoned
 * at length about the consequences. That was a typo in the source, corrected
 * under Q40. `Luck Boost` and `Luck Loss` are live effects.
 */

import { test as testPredicate } from "./predicate.mjs";

/** The unfavourable-table penalty, for both Evade and Luck Checks. */
export const UNFAVOURABLE_PENALTY = 4;

/**
 * @typedef {object} CheckResult
 * @property {boolean} success
 * @property {number} roll the raw die result
 * @property {number} total after the table penalty and all modifiers
 * @property {number} target the stat rolled under
 * @property {string} table `"favourable"` or `"unfavourable"`
 * @property {Array<{source: string, value: number}>} modifiers
 * @property {boolean} automatic set when a buff decided it without a roll
 */

/**
 * Which table applies, honouring the forcing buffs.
 *
 * `Agility Boost` / `Luck Boost` force the favourable table; `Agility Loss` /
 * `Luck Loss` force the unfavourable one. A unit carrying both takes the
 * unfavourable table — debuffs win ties, matching the effect engine's general
 * precedence (Ch. 11 §11.6).
 *
 * @param {number} own the checking unit's current stat
 * @param {number} opposing the opponent's, or `null` for an uncontested check
 * @param {{boost?: boolean, loss?: boolean}} [forcing]
 * @returns {"favourable"|"unfavourable"}
 */
export function tableFor(own, opposing, forcing = {}) {
  if (forcing.loss) return "unfavourable";
  if (forcing.boost) return "favourable";
  if (opposing === null || opposing === undefined) return "favourable";
  return own >= opposing ? "favourable" : "unfavourable";
}

/**
 * @typedef {object} CheckPlan
 * @property {Array<{source: string, value: number}>} modifiers
 * @property {"favourable"|"unfavourable"|null} forceTable
 * @property {object|null} autoSucceed the winning `AutoSucceed` entry, if any
 * @property {object[]} adjustable `RollAdjustment` grants the player may spend
 */

/**
 * Fold a unit's collected `checkModifiers` and `autoSucceeds` into the
 * arguments a check takes.
 *
 * This is the bridge that makes a `TableOverride` on a compendium document
 * actually change a die roll. Without it the contributions are collected into
 * the snapshot and read by nobody, which is the failure mode this codebase is
 * most exposed to.
 *
 * `check: "any"` entries apply to every check — `RollAdjustment` from a Master
 * Essence is written that way.
 *
 * @param {object} unit a `UnitSnapshot`
 * @param {string} check `"evade"`, `"luck"`, `"injury"`, …
 * @param {object} [opts]
 * @param {"outgoing"|"incoming"} [opts.direction] whose check this is
 * @returns {CheckPlan}
 */
export function checkPlan(unit, check, { direction = "outgoing", options = null, rolls = {} } = {}) {
  const relevant = (unit?.checkModifiers ?? [])
    .filter((m) => m.check === check || m.check === "any")
    // A contribution whose clause is about the attack rather than about the
    // bearer travelled here unanswered, and answering it needs the option set.
    // Without one, an unconditional contribution still applies and a
    // conditional one does not -- the safe direction, and the same one
    // `collectContributions` takes.
    .filter((m) => !m.predicate || (options ? testPredicate(m.predicate, { options }) : false))
    // A forced table that is only PROBABLE. The caller rolls, keyed by source,
    // exactly like every other roll in the system.
    .filter((m) => passesChance(m, rolls));

  const modifiers = relevant
    .filter((m) => typeof m.value === "number" && m.value !== 0)
    .filter((m) => (m.direction ?? "outgoing") === direction)
    .map((m) => ({ source: m.source, value: m.value }));

  // Debuffs win ties, as everywhere else in the effect engine: one source
  // forcing the unfavourable table beats any number forcing the favourable one.
  //
  // Filtered by direction like the numeric modifiers above, so an `imposed`
  // override does not also apply to its own bearer's checks -- Clairvoyance
  // would otherwise put EMIYA himself on the unfavourable Evade table.
  const forcing = relevant
    .filter((m) => (m.direction ?? "outgoing") === direction)
    .map((m) => m.forceTable)
    .filter(Boolean);
  const forceTable = forcing.includes("unfavourable")
    ? "unfavourable"
    : (forcing[0] ?? null);

  const autoSucceed = (unit?.autoSucceeds ?? []).find((a) => a.check === check) ?? null;
  const adjustable = relevant.filter((m) => m.playerAdjustable);

  return { modifiers, forceTable, autoSucceed, adjustable };
}

/**
 * Fold an opponent's *imposed* plan into the checking unit's own.
 *
 * Almost every check contribution belongs to the unit making the check. EMIYA's
 * *Clairvoyance* is the exception in the reference set: *"When EMIYA performs a
 * Normal Attack at a Range of 3 or higher, **the DU** has an 80% chance of
 * using Evade- when Evading"* — a table forced on somebody else's roll, by an
 * ability they do not have.
 *
 * Modelled as a `direction: "imposed"` contribution on the attacker rather than
 * as an effect applied to the defender, because it is not a debuff: it is not
 * removable, it is not resisted, and it lasts exactly one roll.
 *
 * `unfavourable` wins, as it does everywhere else in the effect engine.
 *
 * @param {CheckPlan} own
 * @param {CheckPlan} imposed
 * @returns {CheckPlan}
 */
export function mergePlans(own, imposed) {
  const forcing = [own.forceTable, imposed.forceTable].filter(Boolean);
  return {
    modifiers: [...own.modifiers, ...imposed.modifiers],
    forceTable: forcing.includes("unfavourable") ? "unfavourable" : (forcing[0] ?? null),
    // An automatic success is the checking unit's own; an opponent cannot
    // grant one, and reading `imposed` here would let an attacker hand its
    // target a free Evade.
    autoSucceed: own.autoSucceed,
    adjustable: own.adjustable,
  };
}

/**
 * The rolls a plan needs before it can be resolved.
 *
 * The other half of the "caller rolls" contract, and the reason a probabilistic
 * forced table can live in a pure function at all: this says which
 * contributions want a `1d100` and under what key, and the caller supplies the
 * totals through `rolls`.
 *
 * @param {object} unit
 * @param {string} check
 * @param {object} [opts]
 * @returns {Array<{key: string, formula: string}>}
 */
export function pendingCheckRolls(unit, check, { direction = "outgoing" } = {}) {
  return (unit?.checkModifiers ?? [])
    .filter((m) => (m.check === check || m.check === "any") && (m.direction ?? "outgoing") === direction)
    .filter((m) => (m.chance ?? 100) < 100)
    .map((m) => ({ key: m.source, formula: "1d100" }));
}

/**
 * Resolve a check: success is rolling **at or under** the target stat.
 *
 * Positive modifiers make the check *harder*, matching the source's phrasing
 * throughout ("the Evade roll is increased by 3").
 *
 * @param {object} args
 * @param {number} args.roll the raw `1d20`
 * @param {number} args.target the stat being rolled under
 * @param {"favourable"|"unfavourable"} args.table
 * @param {Array<{source: string, value: number}>} [args.modifiers]
 * @returns {CheckResult}
 */
export function resolveCheck({ roll, target, table, modifiers = [] }) {
  const penalty = table === "unfavourable" ? UNFAVOURABLE_PENALTY : 0;
  const mods = penalty
    ? [{ source: "unfavourable table", value: penalty }, ...modifiers]
    : [...modifiers];
  const total = roll + mods.reduce((a, m) => a + m.value, 0);
  return { success: total <= target, roll, total, target, table, modifiers: mods, automatic: false };
}

/**
 * An Evade attempt.
 *
 * `Dodge` succeeds without rolling, and `Aim` beats `Dodge`. `Substitution`
 * beats `Aim`, but that is resolved earlier — at damage-pipeline stage 0 —
 * because it negates the attack outright rather than evading it.
 *
 * @param {object} args
 * @param {number} args.roll
 * @param {number} args.agility current, not maximum
 * @param {boolean} [args.hasDodge]
 * @param {boolean} [args.attackHasAim]
 * @param {boolean} [args.forceUnfavourable] Mad Enhancement clause 6
 * @param {Array<{source: string, value: number}>} [args.modifiers]
 * @returns {CheckResult}
 * @see docs/14-checks-and-randomness.md §14.5
 */
export function evade({ roll, agility, hasDodge = false, attackHasAim = false,
  forceUnfavourable = false, modifiers = [], autoSucceed = null, attackProperties = [] }) {
  if (hasDodge && !attackHasAim) {
    return {
      success: true, roll, total: 0, target: agility,
      table: "favourable", modifiers: [{ source: "Dodge", value: 0 }], automatic: true,
    };
  }
  // A granted `AutoSucceed` behaves like Dodge, with its own list of attack
  // properties that beat it — `beatenBy: [aim]` reproduces Dodge exactly, which
  // is why Dodge above is the same rule written twice, once for the effect and
  // once for the rule element.
  if (autoSucceed && !(autoSucceed.beatenBy ?? []).some((p) => attackProperties.includes(p))) {
    return {
      success: true, roll, total: 0, target: agility, table: "favourable",
      modifiers: [{ source: autoSucceed.source ?? "auto-succeed", value: 0 }], automatic: true,
    };
  }
  return resolveCheck({
    roll,
    target: agility,
    table: forceUnfavourable ? "unfavourable" : "favourable",
    modifiers,
  });
}

/**
 * A Luck Check.
 *
 * Costs 1 Luck whether or not it succeeds, which the caller applies; this
 * function only decides the outcome. The `opposing` argument is what makes
 * Luck a **matchup** and not only a budget — contesting a luckier opponent
 * moves you onto the `+4` table.
 *
 * @param {object} args
 * @param {number} args.roll
 * @param {number} args.luck current
 * @param {number|null} [args.opposingLuck] `null` for an uncontested check
 * @param {boolean} [args.hasBoost] `Luck Boost`
 * @param {boolean} [args.hasLoss] `Luck Loss`
 * @param {Array<{source: string, value: number}>} [args.modifiers]
 * @returns {CheckResult}
 */
export function luckCheck({ roll, luck, opposingLuck = null, hasBoost = false,
  hasLoss = false, modifiers = [] }) {
  return resolveCheck({
    roll,
    target: luck,
    table: tableFor(luck, opposingLuck, { boost: hasBoost, loss: hasLoss }),
    modifiers,
  });
}

/**
 * The generic percentage roll.
 *
 * Success is **strictly under** the percentage, so 0% never succeeds and 100%
 * always does with no boundary off-by-one. Chances are stored uncapped and
 * clamped only here, which is why Proto Gil's `500%` Drowning clause needs no
 * special case: it means "certain, and it stays certain after every reduction
 * in the game has been applied".
 *
 * @param {number} roll a `1d100` in 1..100
 * @param {number} percent
 * @returns {boolean}
 * @see docs/14-checks-and-randomness.md §14.6
 */
export function chance(roll, percent) {
  return roll <= Math.max(0, Math.min(100, percent));
}

/**
 * Effect application chance after resistances.
 *
 * Resistance reduces the chance; it does **not** confer immunity. That
 * distinction is load-bearing for Proto Gil's Enkidu, which bypasses
 * `Debuff Immune` against `Divine` units while still being reduced by
 * `Debuff Resist`.
 *
 * @param {object} args
 * @param {number} args.base the stated percentage
 * @param {number} [args.inflictBonus] `Debuff ChUp` minus `Debuff ChDwn`
 * @param {number} [args.resist] `Debuff ResUp` minus `Debuff ResDwn`
 * @param {boolean} [args.immune]
 * @param {boolean} [args.bypassesImmunity]
 * @returns {{percent: number, blocked: boolean, reason: string|null}}
 */
export function applicationChance({ base, inflictBonus = 0, resist = 0,
  immune = false, bypassesImmunity = false }) {
  if (immune && !bypassesImmunity) {
    return { percent: 0, blocked: true, reason: "immune" };
  }
  return { percent: base + inflictBonus - resist, blocked: false, reason: null };
}

/**
 * The chance that an attack crits, as a percentage.
 *
 * §14.6: *"Since Flip a Coin is used when determining whether Attack+ or
 * Attack− is used, the normal chance of getting a Crit would be 50%. Some
 * effects increase and decrease the chance"* — so a **base of 50 adjusted by
 * modifiers**, not a `1d2`.
 *
 * The `1d2` is what shipped, which meant `Crit Up` had no reader at all: the
 * effect applied, showed on the sheet, and every attack was still a coin.
 * Scáthach grants it twice — 25% from *Primordial Rune*, 50% from
 * *Clairvoyance* — and neither would have changed anything.
 *
 * Both sides contribute. `Crit Up` and `Crit Dwn` are the attacker's; `Crit
 * Guard` and `Bal Dwn` are the defender's, and they are authored as *incoming*
 * crit modifiers so a defender cannot accidentally raise its own crit rate.
 *
 * @param {object} attacker
 * @param {object} [defender]
 * @param {object} [options]
 * @param {number} [options.base]
 * @returns {{percent: number, automatic: boolean, blocked: boolean, modifiers: object[]}}
 */
export function critChance(attacker, defender = null, { base = BASE_CRIT_CHANCE, options = null } = {}) {
  const held = attacker?.effects ?? [];

  const modifiers = [
    ...critModifiers(attacker, "outgoing", options),
    ...critModifiers(defender, "incoming", options),
  ];
  const percent = base + modifiers.reduce((a, m) => a + m.value, 0);

  // `No Crit` beats `G.Crit`, as debuffs beat buffs everywhere else in the
  // effect engine.
  if (held.includes("noCrit")) return { percent: 0, automatic: false, blocked: true, modifiers };
  if (held.includes("gCrit")) return { percent: 100, automatic: true, blocked: false, modifiers };

  return { percent, automatic: percent >= 100, blocked: percent <= 0, modifiers };
}

/** The published base, which the coin flip encoded as a `1d2`. */
export const BASE_CRIT_CHANCE = 50;

/**
 * @param {object|null} unit
 * @param {"outgoing"|"incoming"} direction
 * @returns {Array<{source: string, value: number}>}
 */
function critModifiers(unit, direction, options = null) {
  return (unit?.checkModifiers ?? [])
    .filter((m) => m.check === "crit" && (m.direction ?? "outgoing") === direction)
    .filter((m) => typeof m.value === "number" && m.value !== 0)
    .filter((m) => !m.predicate || (options ? testPredicate(m.predicate, { options }) : false))
    .map((m) => ({ source: m.source, value: m.value }));
}

/**
 * A forced table that only applies some of the time.
 *
 * EMIYA's *Clairvoyance* is the one clause in the set that needs it: *"the DU
 * has an **80% chance** of using Evade- when Evading. Otherwise, the Combat
 * Process proceeds as normal."* The roll arrives from the caller keyed by the
 * contribution's source, so this stays pure and a replay reproduces it.
 *
 * @param {object} modifier
 * @param {Record<string, number>} rolls
 * @returns {boolean}
 */
function passesChance(modifier, rolls) {
  const percent = modifier.chance ?? 100;
  if (percent >= 100) return true;
  const roll = rolls?.[modifier.source];
  // No die means nobody rolled for it. Refusing is the safe direction: an
  // unrolled 80% chance must not become a certainty.
  return typeof roll === "number" ? chance(roll, percent) : false;
}
