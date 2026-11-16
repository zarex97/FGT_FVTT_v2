/**
 * @file The Injury Roll — Combat Process step 4.
 * @see docs/21-combat-process.md
 *
 * Layer 2. Pure: it decides *whether* the roll happens and says why. The `1d4`
 * itself is rolled by the caller, like every other roll in the system.
 *
 * > *"If the DU survives but takes damage from the Attack and the damage
 * > received is greater than 100, perform an Injury Roll. Decrease the DU's
 * > Agility by that value."*
 */

/**
 * The stat an Injury Roll depletes. Agility is drained by exactly three things
 * — this, `Def Dwn (C)`, and Luck Checks — and never by an Agility Check
 * (Ch. 13), so naming it here keeps the one write site honest.
 */
export const INJURY_STAT = "agility.value";

/**
 * Decide whether a defender performs an Injury Roll.
 *
 * @param {object} args
 * @param {boolean} args.exceededThreshold `flags.exceededInjuryThreshold` from the pipeline
 * @param {number} args.damage total damage actually taken
 * @param {number} args.healthAfter the defender's Health once the damage is applied
 * @param {object} args.defender the defender's snapshot
 * @param {boolean} [args.isNP] the damage came from a Noble Phantasm
 * @param {boolean} [args.lightWound] a `Light Wound` Luck Check succeeded
 * @returns {{roll: boolean, reason: string}}
 */
export function injuryCheck({
  exceededThreshold, damage, healthAfter, defender, isNP = false, lightWound = false,
}) {
  // Survival first: the rule is written for a unit that *survives* the attack,
  // and a defeated one has no Agility left to lose.
  // ...and a Unit defeated whatever its Health reads: the Glass Game's effect 2
  // writes hers back and *"she stays defeated"* (#247, live).
  if ((healthAfter ?? 0) <= 0 || defender?.defeated) return { roll: false, reason: "defeated" };
  if ((damage ?? 0) <= 0) return { roll: false, reason: "noDamage" };

  // The threshold is the pipeline's, not a fresh comparison against 100. Def
  // Crk's bonus damage "does not count towards the amount required for an
  // Injury Roll", and stage 16 adds it *after* the snapshot — so `damage > 100`
  // here would fire on hits the rules say do not qualify.
  if (!exceededThreshold) return { roll: false, reason: "belowThreshold" };

  // Golden Hind: "Only performs Injury Roll when damaged by NP". A per-unit
  // override, carried as a granted attribute so content can express it without
  // a schema field — the `attributes` bucket is already read by targeting and
  // the pipeline, so this adds a reader rather than a new inert input.
  if ((defender?.attributes ?? []).includes("injuryOnlyFromNP") && !isNP) {
    return { roll: false, reason: "npOnly" };
  }

  // Light Wound cancels the roll outright rather than reducing it (Ch. 13).
  if (lightWound) return { roll: false, reason: "lightWound" };

  return { roll: true, reason: "ok" };
}

/**
 * The Process states that come before a Process's Damage Step: a hit standing at one of them may still deal damage.
 * Every other state is past the Damage Step, or never reached it (`noDamage`, `missed`, `withdrawn`).
 */
export const BEFORE_DAMAGE_STATES = Object.freeze([
  "declare", "missCheck", "react", "evadeRoll",
  "s21_luckyHit", "s22_duContest", "s23_acceptOrEscape", "s24_luckyEvasion", "s25_auContest",
  "heelResolve", "objectResolve", "damage",
]);

/**
 * The damage every hit of one attack dealt one defender, for an attack that rolls ONE Injury Roll on the total
 * (`damage.singleInjuryRoll`, Dragon Wing Warriors), and how many hits are still to be decided.
 *
 * A hit with a `result` counts its total; a FIXED bonus (`flags.fixedExtra`) is damage taken but not counted toward the
 * roll. A hit with no `result` is pending only while it stands before its Damage Step: one that was Evaded, missed or
 * withdrawn ended without damage and counts as 0. Counted as pending, it held the roll for ever, and three hits that
 * dealt 100 between them rolled nothing (#415).
 *
 * @param {Array<{state: object, result: object|null}>} siblings every Process of the attack on this defender
 * @returns {{total: number, counted: number, pending: number}}
 */
export function injuryTotalsOf(siblings) {
  let total = 0;
  let counted = 0;
  let pending = 0;
  for (const { state, result } of siblings ?? []) {
    if (!result) {
      if (BEFORE_DAMAGE_STATES.includes(state?.state)) pending += 1;
      continue;
    }
    total += result.total ?? 0;
    counted += (result.total ?? 0) - (result.flags?.fixedExtra ?? 0);
  }
  return { total, counted, pending };
}
