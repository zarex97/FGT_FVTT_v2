/**
 * @file Every rank-indexed table in F/GT, as data.
 * @see docs/B-rank-tables.md
 *
 * Layer 1 (domain). Pure.
 *
 * Four table kinds:
 *   - `scaled`    — a value per grade plus a per-step delta (Ch. 05 §5.4)
 *   - `banded`    — grades grouped; steps ignored (Ch. 05 §5.4)
 *   - `threshold` — ordinal cut points, optionally with overrides (Ch. 05 §5.4)
 *   - `equality`  — **exact** rank match, no ordering at all
 *
 * The fourth exists for one table. Scáthach's *Gate of Skye* keys on the
 * target's MAG being exactly `B` or exactly `A`; a `MAG EX` or `MAG A+` target
 * receives nothing. A banded table would let `A+` fall through to the `A` band
 * and quietly implement `gte`, which is the bug Ch. 05 §5.3's validator warning
 * exists to catch. Making it a distinct kind puts the difference in the data
 * where it is visible.
 *
 * Authored once here and referenced by id from rule elements, so a correction
 * to a table is one edit rather than a search across content.
 */

import { Rank } from "./rank.mjs";

/**
 * @typedef {{kind: "scaled", byGrade: Record<string, number|string>, perStep: number}} ScaledTable
 * @typedef {{kind: "banded", bands: Array<{grades: string[], value: unknown}>, fallback?: unknown}} BandedTable
 * @typedef {{kind: "threshold", thresholds: Array<{minOrdinal: number, value: unknown}>,
 *            overrides?: Array<{predicate: string[], value: unknown}>, default?: unknown}} ThresholdTable
 * @typedef {{kind: "equality", byRank: Record<string, unknown>, default: unknown}} EqualityTable
 * @typedef {ScaledTable|BandedTable|ThresholdTable|EqualityTable} Table
 */

const ord = (s) => Rank.parse(s).ordinal;

/** @type {Readonly<Record<string, Table>>} */
export const TABLES = Object.freeze({
  /* ---------------------------------------------------------------- setup */

  /**
   * Servant Max Health. **No variance roll** — `Health(S)` is unused (Q1), so
   * two Servants of the same END rank and steps have identical Max Health.
   * Verified against all 29 reference sheets.
   */
  baseHealthByEnd: {
    kind: "scaled",
    byGrade: { EX: 2000, A: 1500, B: 1250, C: 1000, D: 750, E: 500 },
    perStep: 100,
  },

  /** Master Base Health is flat — not rank-indexed. */
  masterBaseHealth: { kind: "scaled", byGrade: { EX: 250, A: 250, B: 250, C: 250, D: 250, E: 250 }, perStep: 0 },

  baseAgilityByAgi: {
    kind: "scaled",
    byGrade: { EX: "20 + 1d4", A: "18 + @agilityCoin", B: "16 + @agilityCoin", C: "14 + @agilityCoin", D: "12 + @agilityCoin", E: "10 + @agilityCoin" },
    perStep: 1,
  },

  baseLuckByLuc: {
    kind: "scaled",
    byGrade: { EX: "20 + 1d4", A: "16 + 1d4", B: "12 + 1d4", C: "8 + 1d4", D: "4 + 1d4", E: "0 + 1d4" },
    perStep: 1,
  },

  /**
   * Base Attack, per component, from the parameter that drives it.
   *
   * **The table is authoritative over the sheet.** The author states it
   * outright: *"If you find a value of Base attack that differs from this
   * calculation choose the value of this table instead of what is on the
   * character sheet."* Three of the eleven authored Servants disagree -- Jack
   * the Ripper (85 at STR C, table 100), Semiramis (45 at STR E, table 50) and
   * Hassan of Serenity (65/100 at STR D MAG C, table 75/150) -- so this is a
   * derivation, not a validation, and `rules/setup-rolls.mjs#baseAttackFor` is
   * the one reader.
   *
   * Note the two grades are NOT the same shape: MAG starts at 100 and steps by
   * 25 a grade, STR starts at 50 and steps by 25 too, but EX breaks the pattern
   * on both (200 and 250, not 175 and 225). Hence a `byGrade` map rather than
   * arithmetic on the ordinal.
   */
  baseAttackStrByStr: {
    kind: "scaled",
    byGrade: { EX: 200, A: 150, B: 125, C: 100, D: 75, E: 50 },
    perStep: 10,
  },

  baseAttackMagByMag: {
    kind: "scaled",
    byGrade: { EX: 250, A: 200, B: 175, C: 150, D: 125, E: 100 },
    perStep: 10,
  },

  /* ------------------------------------------------------- noble phantasms */

  /** `[highRankOrRankless, lowRank]` Master Health cost. */
  npCostByRank: {
    kind: "scaled",
    byGrade: { EX: [75, 100], A: [50, 60], B: [40, 50], C: [30, 40], D: [20, 30], E: [10, 20] },
    perStep: 3,
  },

  freeServantNPSustainabilityCost: {
    kind: "banded",
    bands: [
      { grades: ["EX"], value: 6 }, { grades: ["A"], value: 5 }, { grades: ["B"], value: 4 },
      { grades: ["C"], value: 3 }, { grades: ["D"], value: 2 }, { grades: ["E"], value: 1 },
    ],
  },

  /* ---------------------------------------------------------- class skills */

  magicResistancePercent: {
    kind: "scaled",
    byGrade: { EX: 100, A: 50, B: 40, C: 30, D: 20, E: 10 },
    perStep: 0,
  },

  magicResistanceDebuffResist: {
    kind: "scaled",
    byGrade: { EX: 30, A: 25, B: 20, C: 15, D: 10, E: 5 },
    perStep: 0,
  },

  /**
   * Divinity's flat damage bonus.
   * Verified at B+ (45), A (50), B (40), C (30) and **E−** (5) — Medusa's E−
   * is the first sub-E rank in the corpus and reproduces without a special case.
   */
  divinity: {
    kind: "scaled",
    byGrade: { EX: 60, A: 50, B: 40, C: 30, D: 20, E: 10 },
    perStep: 5,
  },

  /**
   * `Goddess's Divine Core` / `Twin God's Divine Core` are **exactly twice**
   * Divinity at every observed rank: EX 120, A 100, B 80. Derived rather than
   * duplicated, so a correction to Divinity propagates.
   */
  divineCore: {
    kind: "scaled",
    byGrade: { EX: 120, A: 100, B: 80, C: 60, D: 40, E: 20 },
    perStep: 10,
  },

  /** `null` = the Sustainability clock does not exist for this unit. */
  independentActionSustainability: {
    kind: "banded",
    bands: [
      { grades: ["EX", "A+"], value: null },
      { grades: ["A"], value: 8 }, { grades: ["B"], value: 7 }, { grades: ["C"], value: 6 },
      { grades: ["D"], value: 5 }, { grades: ["E"], value: 4 },
    ],
  },

  independentActionZon: {
    kind: "banded",
    bands: [
      { grades: ["EX", "A"], value: 3 },
      { grades: ["B", "C"], value: 2 },
      { grades: ["D", "E"], value: 1 },
    ],
  },

  /**
   * Contract rolls required. The top band is **absolute** — not "very many
   * rolls". Rule Breaker's `bypassesContractRoll` does not defeat it (Q48).
   */
  independentActionContract: {
    kind: "banded",
    bands: [
      { grades: ["EX", "A+"], value: "immune" },
      { grades: ["A"], value: 4 }, { grades: ["B"], value: 3 },
      { grades: ["C", "D", "E"], value: 2 },
    ],
  },

  ridingMov: {
    kind: "scaled",
    byGrade: { EX: 6, A: 5, B: 4, C: 3, D: 2, E: 1 },
    perStep: 0,
  },

  ridingCooldown: {
    kind: "banded",
    bands: [
      { grades: ["EX", "A"], value: "3◈" },
      { grades: ["B", "C"], value: "2◈" },
      { grades: ["D", "E"], value: "1◈" },
    ],
  },

  territoryCreationOffence: {
    kind: "scaled",
    byGrade: { EX: "6d20", A: "5d20", B: "5d10", C: "5d8", D: "5d6", E: "5d4" },
    perStep: 5,
  },

  territoryCreationDefence: {
    kind: "scaled",
    byGrade: { EX: "3d10+30", A: "3d10+20", B: "3d10+15", C: "3d10+10", D: "3d10+5", E: "3d10" },
    perStep: 2,
  },

  /** `[general, instakill, death, erase]` percentages. Verified: B− → 35/15/5. */
  itemConstruction: {
    kind: "scaled",
    byGrade: {
      EX: [75, 40, 20, 0], A: [50, 25, 10, 0], B: [40, 20, 10, 0],
      C: [30, 15, 5, 0], D: [20, 10, 5, 0], E: [10, 5, 0, 0],
    },
    perStep: 5,
  },

  presenceConcealmentDiscover: {
    kind: "scaled",
    byGrade: { EX: 0, A: 10, B: 20, C: 40, D: 60, E: 80 },
    perStep: -5,
  },

  presenceConcealmentEvade: {
    kind: "banded",
    bands: [
      { grades: ["EX", "A"], value: 4 },
      { grades: ["B", "C"], value: 3 },
      { grades: ["D", "E"], value: 2 },
    ],
  },

  presenceConcealmentCooldown: {
    kind: "banded",
    bands: [
      { grades: ["EX", "A", "B"], value: "2◈" },
      { grades: ["C", "D", "E"], value: "1◈" },
    ],
  },

  /** Master Health lost per acted turn. Banded — the `+` does not change it. */
  madEnhancementDrain: {
    kind: "banded",
    bands: [
      { grades: ["EX"], value: 30 }, { grades: ["A"], value: 25 }, { grades: ["B"], value: 20 },
      { grades: ["C"], value: 15 }, { grades: ["D"], value: 10 }, { grades: ["E"], value: 5 },
    ],
  },

  /** `[normal, vsNP]` damage-taken reduction. Verified across six sheets. */
  madEnhancementDefence: {
    kind: "scaled",
    byGrade: { EX: [75, 30], A: [50, 25], B: [40, 20], C: [30, 15], D: [20, 10], E: [10, 5] },
    perStep: 5,
  },

  /** Damage dealt increase; halved for the BA(MAG) portion at stage 5. */
  madEnhancementOffence: {
    kind: "scaled",
    byGrade: { EX: 100, A: 80, B: 60, C: 40, D: 20, E: 10 },
    perStep: 5,
  },

  battleContinuationReduction: {
    kind: "scaled",
    byGrade: { EX: "2d10+30", A: "2d10+20", B: "2d10+15", C: "2d10+10", D: "2d10+5", E: "2d10" },
    perStep: 2,
  },

  battleContinuationRevive: {
    kind: "scaled",
    byGrade: { EX: "6d20", A: "5d20", B: "4d20", C: "3d20", D: "2d20", E: "1d20" },
    perStep: 5,
  },

  battleContinuationCooldown: {
    kind: "banded",
    bands: [
      { grades: ["EX", "A", "B"], value: "3◈" },
      { grades: ["C", "D", "E"], value: "2◈" },
    ],
  },

  /* ------------------------------------------------------------ other rules */

  /** STR damage taken when knocked into an occupied panel. */
  knockbackCollisionByEnd: {
    kind: "banded",
    bands: [
      { grades: ["EX"], value: "1d12" }, { grades: ["A"], value: "1d20" },
      { grades: ["B"], value: "2d12" }, { grades: ["C"], value: "3d12" },
      { grades: ["D"], value: "2d20" }, { grades: ["E"], value: "3d20" },
    ],
    fallback: "5d10", // no END rank at all
  },

  /**
   * Achilles's `Andreias Amarantos`, keyed on the **attacker's** Divinity.
   *
   * The only defensive table in the game whose *absent* case is the strongest
   * one — an attacker with no Divinity deals **zero**. Against the expanded
   * roster that is eleven of seventeen Servants.
   */
  andreiasAmarantosByAttackerDivinity: {
    kind: "threshold",
    thresholds: [
      { minOrdinal: ord("C"), value: 100 },
      { minOrdinal: ord("D"), value: 75 },
      { minOrdinal: ord("E"), value: 50 },
    ],
    default: 0, // no Divinity at all
  },

  /** Proto Gil's Enkidu: `[damageBonusPercent, stunChanceBonus]` by the DU's Divinity. */
  enkiduByDivinity: {
    kind: "scaled",
    byGrade: { EX: [150, 100], A: [100, 50], B: [80, 40], C: [60, 30], D: [40, 20], E: [20, 10] },
    perStep: 0,
  },

  /** Karna's Vasavi Shakti. A threshold table *with* a mid-scale override. */
  vasaviShaktiDivinityBonus: {
    kind: "threshold",
    thresholds: [
      { minOrdinal: ord("B"), value: 200 },
      { minOrdinal: ord("E"), value: 100 },
    ],
    overrides: [
      { predicate: ["target:attribute:divine", "not:target:skill:divinity"], value: 150 },
    ],
    default: 0,
  },

  /**
   * Scáthach's Gate of Skye. **Equality**, not threshold — a `MAG EX` or
   * `MAG A+` target receives no bonus at all. Do not "improve" this into a
   * `gte`; the source says "exactly".
   */
  gateOfSkyeSaveModifier: {
    kind: "equality",
    byRank: { B: -2, A: -4 },
    default: 0,
  },
});

/* -------------------------------------------------------------------------- */

/**
 * Look a rank up in a table.
 *
 * @param {string} id a key of {@link TABLES}
 * @param {Rank|null} rank
 * @returns {unknown} the table's value, or `undefined` when unranked and the
 *   table has no fallback
 * @throws {RangeError} for an unknown table id
 */
export function lookup(id, rank) {
  const table = TABLES[id];
  if (!table) throw new RangeError(`FGT | Unknown table "${id}".`);
  if (rank === null) return "fallback" in table ? table.fallback : table.default;

  switch (table.kind) {
    case "scaled": {
      const base = table.byGrade[rank.grade];
      if (base === undefined) return undefined;
      return applyStep(base, table.perStep, rank.steps);
    }
    case "banded": {
      // Bands may name an exact rank ("A+") or a bare grade ("A"). Exact first.
      const exact = rank.toString();
      for (const band of table.bands) if (band.grades.includes(exact)) return band.value;
      for (const band of table.bands) if (band.grades.includes(rank.grade)) return band.value;
      return table.fallback;
    }
    case "threshold": {
      for (const t of table.thresholds) if (rank.ordinal >= t.minOrdinal) return t.value;
      return table.default;
    }
    case "equality": {
      const exact = rank.toString();
      return exact in table.byRank ? table.byRank[exact] : table.default;
    }
    default:
      throw new RangeError(`FGT | Unknown table kind for "${id}".`);
  }
}

/**
 * Apply a per-step delta to a table value.
 *
 * Numbers scale. Arrays scale element-wise. Dice-formula strings are returned
 * unchanged with the delta attached as a separate additive term, because
 * "`5d20` plus 5 per step" cannot be expressed by mutating the formula — the
 * caller adds it after rolling.
 *
 * @param {number|number[]|string} base
 * @param {number} perStep
 * @param {number} steps
 * @returns {number|number[]|{formula: string, bonus: number}}
 */
function applyStep(base, perStep, steps) {
  const delta = perStep * steps;
  if (typeof base === "number") return base + delta;
  if (Array.isArray(base)) return base.map((v) => v + delta);
  return delta === 0 ? base : { formula: base, bonus: delta };
}

/**
 * Convenience: look up and require a number.
 * @param {string} id
 * @param {Rank|null} rank
 * @returns {number}
 */
export function lookupNumber(id, rank) {
  const v = lookup(id, rank);
  if (typeof v !== "number") {
    throw new TypeError(`FGT | Table "${id}" at rank ${rank} is not a number (got ${JSON.stringify(v)}).`);
  }
  return v;
}
