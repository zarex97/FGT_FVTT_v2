/**
 * @file Every closed enumeration in the F/GT domain.
 * @see docs/02-glossary.md, docs/04-units.md, docs/10-effects-taxonomy.md
 *
 * Layer 1 (domain). Pure — must not import from `rules/`, `engine/`, `data/`,
 * `documents/`, `apps/`, or reference any Foundry global.
 *
 * Values that content may extend (attributes, terrain, elements) are NOT here;
 * they are open tag sets by design (Ch. 04 §4.5, Ch. 42 §42.1).
 */

/** Rank grades, ascending. @see docs/05-ranks-and-parameters.md §5.1 */
export const GRADES = Object.freeze(["E", "D", "C", "B", "A", "EX"]);

/** The five Servant parameters. @see docs/05-ranks-and-parameters.md */
export const PARAMETERS = Object.freeze(["str", "end", "agi", "mag", "luc"]);

/** Servant classes. `null` is legal — several sheets state no class. */
export const SERVANT_CLASSES = Object.freeze([
  "saber", "archer", "lancer", "rider", "caster", "assassin", "berserker",
  "ruler", "avenger", "alterEgo", "foreigner", "moonCancer", "pretender", "beast",
]);

/** Unit kinds. Maps 1:1 to Actor subtypes. @see docs/04-units.md §4.1 */
export const UNIT_KINDS = Object.freeze([
  "servant", "master", "civilian", "summon", "platform", "structure",
]);

/**
 * Base-attack components. A damage packet carries both; either may be zero.
 * @see docs/06-stats-and-resources.md §6.7
 */
export const COMPONENTS = Object.freeze(["str", "mag"]);

/**
 * Damage elements. Open in practice (content may add), but these are the seven
 * the corpus uses. @see docs/A-effect-catalogue.md §A.17.4
 */
export const ELEMENTS = Object.freeze([
  "fire", "water", "ice", "wind", "lightning", "light", "nature",
]);

/** Effect polarity. @see docs/10-effects-taxonomy.md §10.2 */
export const POLARITIES = Object.freeze(["buff", "debuff", "status"]);

/** Effect volatility. @see docs/10-effects-taxonomy.md §10.3 */
export const VOLATILITIES = Object.freeze(["nonVolatile", "volatile", "mental", "terminal"]);

/** Effect valence. @see docs/10-effects-taxonomy.md §10.4 */
export const VALENCES = Object.freeze(["offensive", "defensive", "both", "neither"]);

/**
 * Stacking behaviours.
 * @see docs/11-effect-engine.md §11.5, docs/A-effect-catalogue.md column key
 */
export const STACKING = Object.freeze([
  "magnitudeStacks",  // mag — magnitudes sum
  "noneNoRefresh",    // nnr — reapplication does nothing
  "noneRefresh",      // nr  — reapplication resets duration
  "noneExtend",       // ext — reapplication adds to duration
  "stage",            // st  — reapplication adds a stage (Curse, Poison)
  "count",            // cnt — a use counter, not a duration
  "highestOnly",      // hi  — only the strongest instance applies
]);

/**
 * The eight named Luck Checks.
 * @see docs/12-combat-process.md §12.3, docs/14-checks-and-randomness.md
 */
export const LUCK_CHECKS = Object.freeze([
  "luckyEvasion",        // evade an attack that was otherwise going to hit
  "strengthenBlock",     // apply the Block value a second time
  "increasedDamage",     // +Damage Modifier to damage dealt
  "reducedDamage",       // -Damage Modifier to damage taken
  "counterCheck",        // react out of turn
  "resistDebuff",        // shrug off an applied debuff
  "mastersLuck",         // a Master's own contest
  "criticalLuck",        // force a crit
]);

/** Combat Process steps, in rulebook order. @see docs/12-combat-process.md §12.2 */
export const COMBAT_STEPS = Object.freeze([
  "declare",     // 1 — the AU declares
  "reaction",    // 2 — evade / block / nothing, plus the Luck ladder (2.1-2.5)
  "damage",      // 3 — the Damage Step
  "injury",      // 4 — the Injury Roll
  "facing",      // 5 — facing update
  "counter",     // 6 — the Counter
]);

/** Turn-order phases the scheduler fires. @see docs/E-event-reference.md */
export const SCHEDULER_PHASES = Object.freeze([
  "roundStart", "turnStart", "turnEnd", "roundEnd",
]);

/**
 * Board phase. `none` exists because Indoors terrain suppresses the cycle
 * entirely — it is not "day" with the lights off.
 * @see docs/42-terrain.md §42.3
 */
export const PHASES = Object.freeze(["day", "night", "none"]);

/**
 * The eight stored facings. Only four *cones* are derived from them.
 * @see docs/04-units.md §4.3, docs/08-board-and-geometry.md §8.8
 */
export const FACINGS = Object.freeze(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);

/** The four attack cones derived from facing. @see docs/08-board-and-geometry.md §8.8 */
export const CONES = Object.freeze(["front", "right", "back", "left"]);

/**
 * Noble Phantasm tags that form an **ordered** scale, ascending.
 * Everything else (Anti-Divine, Barrier, weaponType, …) is an unordered
 * qualifier and must not be compared.
 * @see docs/43-bounded-fields.md §43.8, decision D43.2
 */
export const NP_TAG_SCALE = Object.freeze([
  "antiUnit", "antiArmy", "antiFortress", "antiCountry", "antiWorld",
]);

/** Frozen lookup: tag → position on the scale, or -1 for unordered qualifiers. */
export const NP_TAG_ORDINAL = Object.freeze(
  Object.fromEntries(NP_TAG_SCALE.map((t, i) => [t, i])),
);

/** Contract states. @see docs/16-relationships.md §16.2 */
export const CONTRACT_STATES = Object.freeze(["contracted", "free", "unbound"]);

/** Sentinel for a duration that never counts down. @see docs/07-time-model.md §7.3 */
export const INFINITE = Number.POSITIVE_INFINITY;

/**
 * Frozen `Set` of every member of an enum array, for O(1) validation.
 * @param {readonly string[]} values
 * @returns {ReadonlySet<string>}
 */
export function asSet(values) {
  return Object.freeze(new Set(values));
}

export const GRADE_SET = asSet(GRADES);
export const PARAMETER_SET = asSet(PARAMETERS);
export const UNIT_KIND_SET = asSet(UNIT_KINDS);
export const COMPONENT_SET = asSet(COMPONENTS);
