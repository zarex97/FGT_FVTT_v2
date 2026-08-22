/**
 * @file The `Rank` value object: parsing, comparison, and step arithmetic.
 * @see docs/05-ranks-and-parameters.md
 *
 * Layer 1 (domain). Pure.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * 1. `+` and `-` participate in comparison as sub-steps between grades, because
 *    Magic Resistance `A+` negates up to `A+`, not up to `A` (§5.3).
 * 2. "Unranked" is `null`, never a sentinel `Rank`. Rank-dependent effects take
 *    an explicit branch for it (§5.1).
 */

import { GRADES, GRADE_SET } from "./enums.mjs";

/**
 * Grade spacing on the ordinal scale. Generous: the observed maximum step count
 * is 2, so no realistic rank can cross a grade boundary by stepping.
 * @see docs/05-ranks-and-parameters.md §5.3
 */
export const STEP_WEIGHT = 100;

/** @type {Map<string, Rank>} interning table, keyed by canonical string */
const INTERNED = new Map();

/**
 * An immutable, interned rank.
 *
 * Instances are interned, so `Rank.parse("A") === Rank.parse("A")` and identity
 * comparison is safe. Never construct directly — use {@link Rank.parse} or
 * {@link Rank.of}.
 */
export class Rank {
  /** @type {string} one of {@link GRADES} */
  grade;
  /** @type {number} +n for n plusses, -n for n minuses, 0 for a bare grade */
  steps;

  /**
   * @param {string} grade
   * @param {number} steps
   * @private
   */
  constructor(grade, steps) {
    this.grade = grade;
    this.steps = steps;
    Object.freeze(this);
  }

  /**
   * Intern and return the rank for a grade/steps pair.
   * @param {string} grade
   * @param {number} [steps=0]
   * @returns {Rank}
   */
  static of(grade, steps = 0) {
    if (!GRADE_SET.has(grade)) {
      throw new RangeError(`FGT | Unknown rank grade "${grade}". Expected one of ${GRADES.join(", ")}.`);
    }
    if (!Number.isInteger(steps)) {
      throw new RangeError(`FGT | Rank steps must be an integer, got ${steps}.`);
    }
    const key = canonical(grade, steps);
    let r = INTERNED.get(key);
    if (!r) {
      r = new Rank(grade, steps);
      INTERNED.set(key, r);
    }
    return r;
  }

  /**
   * Parse a rank string. Strict — throws on anything the grammar rejects.
   *
   * Accepts: `E`, `D+`, `C++`, `B-`, `A`, `EX`. Case-insensitive on the grade.
   * Rejects mixed modifiers (`A+-`), unknown grades (`S`, `F`), and empty input.
   *
   * @param {string} s
   * @returns {Rank}
   * @throws {RangeError} on malformed input
   */
  static parse(s) {
    if (typeof s !== "string") {
      throw new RangeError(`FGT | Rank.parse expected a string, got ${typeof s}.`);
    }
    const t = s.trim();
    const m = /^(EX|[EDCBA])(\++|-+)?$/i.exec(t);
    if (!m) {
      throw new RangeError(
        `FGT | Cannot parse rank "${s}". Expected a grade (E D C B A EX) with optional + or - modifiers.`,
      );
    }
    const grade = m[1].toUpperCase();
    const mods = m[2] ?? "";
    const steps = mods.startsWith("+") ? mods.length : -mods.length;
    return Rank.of(grade, steps);
  }

  /**
   * Parse, returning `null` for the unranked marker.
   *
   * The source writes unranked abilities as `Rank: -`. That is not a rank with a
   * minus; it means the ability has no rank at all (§5.1).
   *
   * @param {string|null|undefined} s
   * @returns {Rank|null}
   */
  static parseOrNull(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).trim();
    if (t === "" || t === "-" || t === "—" || t === "–") return null;
    return Rank.parse(t);
  }

  /**
   * Ordinal position: grade-major, step-minor.
   * `B` → 300, `A` → 400, `A+` → 401, `A-` → 399.
   * @returns {number}
   */
  get ordinal() {
    return GRADES.indexOf(this.grade) * STEP_WEIGHT + this.steps;
  }

  /** @returns {number} signed modifier count */
  get stepCount() {
    return this.steps;
  }

  /**
   * Move `n` steps along the ladder, crossing grade boundaries as needed.
   *
   * The Region bonus (`D` → `D+`, `B-` → `B`, `C+` → `C++`) is one step. A step
   * past `++` rolls into the next grade's bare value, and a step below `--`
   * rolls into the previous grade's `++`; the ladder is dense, not clamped
   * per-grade.
   *
   * Clamps at the ends of the scale: nothing goes above `EX++` or below `E--`.
   *
   * @param {number} n
   * @returns {Rank}
   * @see docs/05-ranks-and-parameters.md §5.4
   */
  step(n) {
    if (n === 0) return this;
    // Flatten to a dense integer ladder with 5 positions per grade (--, -, ., +, ++)
    const POS = 5;
    const OFFSET = 2; // steps -2..+2 → index 0..4
    const flat = GRADES.indexOf(this.grade) * POS + (this.steps + OFFSET) + n;
    const clamped = Math.max(0, Math.min(GRADES.length * POS - 1, flat));
    const gradeIndex = Math.floor(clamped / POS);
    const steps = (clamped % POS) - OFFSET;
    return Rank.of(GRADES[gradeIndex], steps);
  }

  /**
   * Move `n` whole **grades**, keeping the modifier.
   *
   * Not the same as {@link step}, and the difference is a real rule rather than
   * a nicety. `step` walks the dense ladder, where one step from `D` is `D+`;
   * *"EMIYA's Magic Resistance Rank is increased by one Rank"* means `D` to
   * `C`, which is five steps on that ladder and one here.
   *
   * Authored the wrong way round, Kanshou & Bakuya raised him to `D+` — a Rank
   * the resistance table has no row for, so it fell back to `D` and the whole
   * Noble Phantasm did nothing measurable.
   *
   * Clamps at the ends of the scale, like `step`.
   *
   * @param {number} n
   * @returns {Rank}
   * @see docs/05-ranks-and-parameters.md §5.4
   */
  stepGrade(n) {
    if (n === 0) return this;
    const index = Math.max(0, Math.min(GRADES.length - 1, GRADES.indexOf(this.grade) + n));
    return Rank.of(GRADES[index], this.steps);
  }

  /** @returns {string} canonical form; round-trips through {@link Rank.parse} */
  toString() {
    return canonical(this.grade, this.steps);
  }

  /** @returns {string} for `JSON.stringify` */
  toJSON() {
    return this.toString();
  }

  /**
   * Compare two ranks, either of which may be `null` (unranked).
   *
   * Returns `null` when either side is unranked — callers **must** branch on
   * that rather than treating unranked as lowest. Every rank-dependent rule in
   * the game states its own unranked fallback (§5.1), and silently ordering
   * `null` below `E` would quietly implement the wrong one.
   *
   * @param {Rank|null} a
   * @param {Rank|null} b
   * @returns {number|null} `-1`, `0`, `1`, or `null` if incomparable
   */
  static compare(a, b) {
    if (a === null || b === null) return null;
    return Math.sign(a.ordinal - b.ordinal);
  }

  /**
   * `a >= b`, with an explicit answer for the unranked case.
   * @param {Rank|null} a
   * @param {Rank|null} b
   * @param {boolean} [whenIncomparable=false] result if either side is unranked
   * @returns {boolean}
   */
  static gte(a, b, whenIncomparable = false) {
    const c = Rank.compare(a, b);
    return c === null ? whenIncomparable : c >= 0;
  }

  /**
   * Exact rank equality — *not* grade equality.
   *
   * Scáthach's *Gate of Skye* keys on the target's MAG being **exactly** `B` or
   * **exactly** `A`; a `MAG EX` target gets nothing. This is the predicate that
   * exists for it.
   *
   * @param {Rank|null} a
   * @param {Rank|null} b
   * @returns {boolean}
   * @see docs/B-rank-tables.md `gateOfSkyeSaveModifier`
   */
  static equals(a, b) {
    return a !== null && b !== null && a === b;
  }
}

/**
 * @param {string} grade
 * @param {number} steps
 * @returns {string}
 */
function canonical(grade, steps) {
  if (steps === 0) return grade;
  return grade + (steps > 0 ? "+".repeat(steps) : "-".repeat(-steps));
}
