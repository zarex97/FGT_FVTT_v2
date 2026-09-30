/**
 * @file An AoE Noble Phantasm over the Holy Grail may destroy it (#104).
 * @see module/rules/environment.mjs#grailStrike, module/engine/attack.mjs
 *
 * > *"If the Holy Grail is hit by an AoE NP that deals damage, it has a chance
 * > of being destroyed. The chance is X%, where X = the amount of damage dealt
 * > by the NP divided by 20. If the Holy Grail is destroyed, there are no
 * > winners."* — char_orig_sheets/extra docs/Normal Great Holy Grail War.md
 *
 * `grailDestroyed` was declared and read (`board.grail.destroyed`, and the
 * victory check answers `noWinner` on it) and nothing ever wrote it, so a
 * destroyed Grail always read as intact. `grailDestructionChance` existed with
 * no caller.
 */

import { describe, it, expect } from "vitest";
import { grailStrike, checkVictory } from "../../module/rules/environment.mjs";

const grail = (over = {}) => ({ materialized: true, destroyed: false, position: { i: 5, j: 5 }, contest: {}, ...over });
const area = [{ i: 4, j: 4 }, { i: 5, j: 5 }, { i: 6, j: 6 }];

describe("an AoE NP over the Grail", () => {
  it("rolls damage / 20 as a percentage: 900 damage is 45%", () => {
    expect(grailStrike({ grail: grail(), areaPanels: area, dealt: 900, roll: 45 })).toEqual({ struck: true, chance: 45, destroyed: true });
    expect(grailStrike({ grail: grail(), areaPanels: area, dealt: 900, roll: 46 })).toEqual({ struck: true, chance: 45, destroyed: false });
  });

  it("does nothing to a Grail outside the area, or one not yet on the field", () => {
    expect(grailStrike({ grail: grail({ position: { i: 0, j: 0 } }), areaPanels: area, dealt: 900, roll: 1 }).struck).toBe(false);
    expect(grailStrike({ grail: grail({ materialized: false }), areaPanels: area, dealt: 900, roll: 1 }).struck).toBe(false);
  });

  it("needs the NP to have dealt damage", () => {
    expect(grailStrike({ grail: grail(), areaPanels: area, dealt: 0, roll: 1 }).struck).toBe(false);
  });

  it("leaves no winner once it is destroyed", () => {
    expect(checkVictory({ grail: grail({ destroyed: true }), units: [] })).toMatchObject({ outcome: "noWinner" });
  });
});
