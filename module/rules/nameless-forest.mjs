/**
 * @file The Nameless Forest's death roll.
 * @see char_orig_sheets/Copia de Nursery Rhyme.md
 * @see docs/45-case-studies.md
 *
 * Layer 2 (rules). Pure.
 *
 * > *"At the end of the Unit's Turn, a Unit with at least 3 Nameless Forest
 * > Tokens rolls a twelve-sided die. If the number rolled is equal to or lower
 * > than the number of Nameless Forest Tokens on the Unit, the Unit disappears
 * > (i.e. is defeated). However, a Unit cannot disappear due to the effects of
 * > this NP if it is within its Home Base."*
 *
 * The only thing in either roster that can remove a Unit with no attack, no
 * roll to hit and no counter-play beyond a Luck Check. Its gates — the 2-panel
 * ring, the 3-token threshold, the Home Base exemption and the NP Seal clause —
 * are the whole of its balance, and every one is a separate clause that has to
 * actually fire.
 */

import { HOME_BASE_ESCAPE_MODIFIER } from "../domain/tables.mjs";

/** *"a Unit with at least 3 Nameless Forest Tokens"*. */
export const DEATH_ROLL_THRESHOLD = 3;

/** *"rolls a twelve-sided die"*. */
export const DEATH_ROLL_FORMULA = "1d12";

/**
 * Does this Unit roll, and does the roll take it?
 *
 * The Home Base exemption refuses the OUTCOME and not the die. *"A Unit cannot
 * **disappear** due to the effects of this NP if it is within its Home Base"* —
 * skipping the roll and refusing its consequence are indistinguishable today,
 * and will not be once anything reads the roll log. A player who watches a 1
 * come up and survives it has been told something true about how close that
 * was; a player who never sees a die has not.
 *
 * @param {object} args
 * @param {number} args.tokens
 * @param {number} args.roll a d12
 * @param {boolean} args.inHomeBase
 * @returns {{rolls: boolean, deleted: boolean, reason: string|null}}
 */
export function deathRollOutcome({ tokens, roll, inHomeBase }) {
  if ((tokens ?? 0) < DEATH_ROLL_THRESHOLD) {
    return { rolls: false, deleted: false, reason: "belowThreshold" };
  }
  // *"equal to or lower than"* — the boundary is the clause.
  if (roll > tokens) return { rolls: true, deleted: false, reason: "survived" };
  if (inHomeBase) return { rolls: true, deleted: false, reason: "inHomeBase" };
  return { rolls: true, deleted: true, reason: null };
}

/**
 * May this Unit attempt its escape right now?
 *
 * > *"During an affected Unit's Turn, it can attempt a Luck Check **once per
 * > Turn** to remove the effects of this NP from itself."*
 *
 * **Can**, not must — and nothing else in the corpus offers a Unit an optional
 * roll on its own Turn. Every check today is either compulsory (an Evade in the
 * ladder) or attached to using something.
 *
 * Three gates, in the order the sentence gives them: the Unit is affected at
 * all, it is that Unit's own Turn, and it has not already tried this Turn.
 *
 * @param {object} unit a board projection
 * @param {object} board
 * @returns {{ok: boolean, reason: string|null}}
 */
export function mayAttemptEscape(unit, board) {
  if (!(unit?.effects ?? []).includes("namelessForest")) {
    return { ok: false, reason: "notAffected" };
  }
  // *"During an affected Unit's Turn"* -- not on somebody else's, or every
  // caught Unit would be offered an escape at the top of every Turn in the
  // Round.
  if (board?.activeFactionId && unit.factionId !== board.activeFactionId) {
    return { ok: false, reason: "notItsTurn" };
  }
  if ((unit.turnState?.namelessForestAttempts ?? 0) >= 1) {
    return { ok: false, reason: "alreadyTriedThisTurn" };
  }
  return { ok: true, reason: null };
}

/**
 * The modifiers an escaping Unit's Luck Check carries.
 *
 * > *"If the Unit is within its Home Base: −3 (stacks with the MAG Rank
 * > modifiers as seen below) / MAG Rank EX: −3, A: −2, B: −1, C: No change,
 * > D: +1, E: +2"*
 *
 * Both terms, summed (R4), and both NEGATIVE for the strong and the safe: a
 * negative modifier makes `resolveCheck` succeed more often, and the sheet
 * separately refuses to delete a Unit at home. Safety and magical power each
 * make the forest easier to walk out of.
 *
 * Returned rather than applied, so the caller can show them on the card.
 *
 * @param {object} unit
 * @param {(id: string, rank: object) => unknown} lookupTable
 * @param {(grade: string) => object|null} parseRank
 * @returns {Array<{source: string, value: number}>}
 */
export function escapeModifiers(unit, lookupTable, parseRank) {
  /** @type {Array<{source: string, value: number}>} */
  const out = [];

  const grade = parseRank(unit?.parameters?.mag ?? "");
  if (grade) {
    const value = lookupTable("namelessForestEscape", grade);
    if (typeof value === "number" && value !== 0) {
      out.push({ source: `MAG ${unit.parameters.mag}`, value });
    }
  }
  if (unit?.inHomeBase) out.push({ source: "Home Base", value: HOME_BASE_ESCAPE_MODIFIER });
  return out;
}

