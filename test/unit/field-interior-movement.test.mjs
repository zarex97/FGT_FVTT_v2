/**
 * @file A bounded field's interior MOV rules have to reach the movement gate.
 * @see docs/28-bounded-fields.md, docs/05-board-geometry.md, Ch. 46 §46.4
 *
 * The defect these guard was not in either half on its own. `annotateFields`
 * has applied a field's `interior` MovDelta correctly since it was written, and
 * `validatePath` has rationed a path against `remainingMovement` correctly
 * since it was written — but `engine/movement-hooks.mjs#onPreMove` validated
 * against `unitSnapshot(actor, document)`, which is the unit's OWN projection
 * and runs no board pass. So the two correct halves were never introduced.
 *
 * Measured live in Asterios's Chaos Labyrinthos, in both directions:
 *
 *   - his own *"MOV is increased by 4 while within the Labyrinth"* read 8 on
 *     the board and on his actor sheet, and a five-panel path was refused with
 *     *"This path is 5 panels; 4 remain of MOV 4."*
 *   - *"The MOV of all enemy Units within the Labyrinth is reduced by 2
 *     (minimum MOV=2)"* left EMIYA at a board MOV of 2, and he walked **3**.
 *
 * The second is the one that matters: a trap that does not slow anybody is the
 * whole of what the clause is for.
 */

import { describe, it, expect } from "vitest";
import { annotateFields } from "../../module/rules/bounded-fields.mjs";
import { validatePath, remainingMovement } from "../../module/rules/movement.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });

/** Chaos Labyrinthos as authored: a 9x9 square anchored on its caster. */
const labyrinth = (over = {}) => ({
  id: "asterios-chaos-labyrinthos", ownerId: "owner", ownerFaction: "a",
  geometry: { kind: "fixedArea", shape: { kind: "square", size: 9 }, anchor: at(7, 7) },
  interior: [
    { key: "MovDelta", value: 4, relations: ["self"] },
    { key: "MovDelta", value: -2, minimum: 2, relations: ["enemy"] },
  ],
  state: { escapeHistory: {} },
  ...over,
});

function unit(over = {}) {
  return {
    id: "owner", kind: "servant", faction: "a", factionId: "a",
    panel: at(7, 7), mov: 4, effects: [], items: [], abilities: [], turnState: {}, ...over,
  };
}

/** The board as `snapshotBoard` hands it on: units already annotated. */
function annotated(units, fields) {
  const board = {
    bounds: squareBounds(15), fields,
    alliances: { a: ["a"], b: ["b"] },
    units,
  };
  annotateFields(units, board);
  return board;
}

/** An orthogonal run of `n` panels east from `panel`. */
const run = (panel, n) => Array.from({ length: n }, (_, k) => at(panel.i, panel.j + k + 1));

describe("a field's interior MovDelta reaches the movement gate", () => {
  it("lets the owner spend the MOV the field granted", () => {
    const owner = unit();
    const enemy = unit({ id: "enemy", faction: "b", factionId: "b", panel: at(5, 5) });
    const board = annotated([owner, enemy], [labyrinth()]);

    // 4 base + 4 interior. The clause is *"MOV is increased by 4 while within
    // the Labyrinth"*, and five panels is what it buys that base MOV does not.
    expect(owner.mov).toBe(8);
    expect(remainingMovement(owner)).toBe(8);
    expect(validatePath(run(owner.panel, 5), owner, board).ok).toBe(true);
  });

  it("holds an enemy to the MOV the field left it", () => {
    const owner = unit();
    const enemy = unit({ id: "enemy", faction: "b", factionId: "b", panel: at(5, 5) });
    const board = annotated([owner, enemy], [labyrinth()]);

    expect(enemy.mov).toBe(2);
    expect(validatePath(run(enemy.panel, 2), enemy, board).ok).toBe(true);

    const overreach = validatePath(run(enemy.panel, 3), enemy, board);
    expect(overreach.ok).toBe(false);
    expect(overreach.reasons.join(" ")).toContain("3 panels");
  });

  it("floors the enemy reduction at 2 rather than at zero", () => {
    // *"reduced by 2 (minimum MOV=2)"*. A Unit at MOV 3 would be left at 1 by
    // the delta alone, and one at MOV 2 at nothing at all.
    for (const mov of [4, 3, 2]) {
      const owner = unit();
      const enemy = unit({ id: "enemy", faction: "b", factionId: "b", panel: at(5, 5), mov });
      annotated([owner, enemy], [labyrinth()]);
      expect(enemy.mov).toBe(2);
    }
  });

  it("excuses a veteran the penalty, and the ally it leads", () => {
    // Clause 9: *"…and its MOV is also no longer halved within the Labyrinth"*,
    // for the escapee and for *"all allied Units directly next to"* it.
    // `noMovPenalty` was authored and read by nobody, so a Unit that had beaten
    // the Labyrinth once walked it at a first-timer's speed. Measured live:
    // Achilles, `escapeHistory {escaped: true}`, standing inside, read MOV 5
    // against his own 7.
    const owner = unit();
    const veteran = unit({ id: "vet", faction: "b", factionId: "b", panel: at(5, 5), mov: 7 });
    const beside = unit({ id: "led", faction: "b", factionId: "b", panel: at(5, 6), mov: 7 });
    const alone = unit({ id: "alone", faction: "b", factionId: "b", panel: at(9, 9), mov: 7 });

    annotated([owner, veteran, beside, alone], [labyrinth({
      membership: {
        enemyEntry: "free", enemyExit: "rollRequired",
        escape: {
          baseChance: 20, formula: "1d20", requiresBorderContact: true, requiresRemainingMove: true,
          veteranBonus: { baseChance: 100, noMovPenalty: true, leadsAdjacentAllies: true },
        },
      },
      state: { escapeHistory: { vet: { escaped: true, failures: 0 } } },
    })]);

    expect(veteran.mov).toBe(7);
    expect(beside.mov).toBe(7);
    // The control: an ally of the veteran standing four panels away is still
    // a prisoner, so the fix is not "switch the clause off for everybody".
    expect(alone.mov).toBe(5);
    // ...and the owner's own bonus is untouched by any of it.
    expect(owner.mov).toBe(8);
  });

  it("gives the MOV back the moment the unit is outside", () => {
    // Measured live: Achilles escaped to a panel beyond the border and his MOV
    // read 7 again on the step that took him out.
    const owner = unit();
    const away = unit({ id: "enemy", faction: "b", factionId: "b", panel: at(8, 14), mov: 7 });
    annotated([owner, away], [labyrinth()]);
    expect(away.mov).toBe(7);
  });
});
