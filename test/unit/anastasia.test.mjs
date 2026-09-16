/**
 * @file Anastasia & Viy, against her sheet.
 * @see char_orig_sheets/Copia de Anastasia & Viy.md
 *
 * Pinned to the SHEET and to the documentation rather than to the
 * implementation. Every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { chanceFromDistance } from "../../module/rules/miss.mjs";

describe("a distance-scaled chance (R3)", () => {
  // *"a 5% chance of inflicting Instakill for each panel between Anastasia and
  // the DU."* The corpus's only other use of "panels between" is the Dioscuri
  // sheet's *"the maximum distance between the two is 2 panels between them"*,
  // which means Chebyshev 2 and is implemented as such -- so this is the
  // DISTANCE, not the gap.
  it("scales with the distance", () => {
    expect(chanceFromDistance(5, 1)).toBe(5);
    expect(chanceFromDistance(5, 3)).toBe(15);
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("reaches 30% at her maximum reach -- Range 3 plus the NP's +3", () => {
    // Not a clamp in the function; a fact about her, recorded so a later reach
    // change shows up as a test failure rather than as a silent buff.
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("is zero at no distance at all", () => {
    expect(chanceFromDistance(5, 0)).toBe(0);
  });

  it("never exceeds 100", () => {
    expect(chanceFromDistance(5, 40)).toBe(100);
  });

  it("answers zero when the distance is unknown", () => {
    // A snapshot taken off the board has no panel. Guessing would be worse than
    // declining -- the same reading `normalAttackAt` takes of an unknown range.
    expect(chanceFromDistance(5, null)).toBe(0);
  });
});
