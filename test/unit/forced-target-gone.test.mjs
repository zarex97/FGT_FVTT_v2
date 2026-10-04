/**
 * @file A forced target that is gone, or a Spirit's prey that left its field, forces nothing (#180).
 * @see module/rules/targeting/resolve.mjs (4b-ii), module/rules/movement.mjs#pursuitVerdict
 *
 * Live: Asterios died and his body was cleared at the Turn's end. His Famine
 * kept `forceTarget: Asterios` and refused Medea, standing beside it, as "the
 * attacker is forced to attack another unit": it could attack nobody again.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const ID = { prm: "paleRiderMaster1", pr: "paleRiderForced1", famine: "famineForced0001", medea: "medeaForced00001", asterios: "asteriosForced01" };
const DC = "pale-rider-doomsday-come";
const spec = {
  anchor: { kind: "targetUnit", range: 3 },
  shape: { kind: "unit" },
  selection: { relations: ["enemy"], chooser: "all", count: 1 },
};

/** Famine bound to a 7x7 Doomsday Come (rows and columns 1-7), Medea beside it, Asterios wherever `asterios` says. */
async function famineHits(asterios) {
  // Doomsday Come states a duration, and its expiry reads the Turn length off
  // the world's settings, which a bare test world does not register.
  const saved = game.settings;
  game.settings = { get: () => 3 };
  let fields;
  try {
    fields = await fieldsOf([{ ability: DC, owner: ID.pr, ownerMaster: ID.prm, faction: "A", panels: squareAround({ i: 4, j: 4 }, 7), shape: { kind: "square", size: 7, radius: 3 } }]);
  } finally {
    game.settings = saved;
  }
  return withSubjects([
    { from: "pale-rider", id: ID.pr, state: { factionId: "A", masterId: ID.prm }, panel: { i: 4, j: 5 } },
    { from: "master-advanced", id: ID.prm, state: { factionId: "A" }, panel: { i: 4, j: 4 } },
    { from: "kagome-famine", id: ID.famine, state: { factionId: "A", pursuitTargetId: ID.asterios, boundToFieldId: DC }, panel: { i: 6, j: 4 } },
    { from: "medea", id: ID.medea, state: { factionId: "B" }, panel: { i: 7, j: 5 } },
    ...(asterios ? [{ from: "asterios", id: ID.asterios, state: { factionId: "B" }, panel: asterios }] : []),
  ], ({ unit, board }) => resolveTargets(spec, unit(ID.famine), board, { unitId: ID.medea, chosenIds: [ID.medea] })
    .units.map((u) => u.unitId ?? u.id ?? u.unit?.id)
    , { settings: { fields } });
}

describe("a Spirit's pursuit", () => {
  it("still narrows while its prey stands inside the field", async () => {
    expect(await famineHits({ i: 7, j: 4 })).toEqual([]);
  });

  it("forces nothing once the prey's body is off the board", async () => {
    expect(await famineHits(null)).toEqual([ID.medea]);
  });

  it("forces nothing once the prey has left the field", async () => {
    expect(await famineHits({ i: 9, j: 5 })).toEqual([ID.medea]);
  });
});
