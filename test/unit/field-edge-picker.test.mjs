/**
 * @file Doomsday Come's drag can be aimed from the interface (#180).
 * @see module/rules/targeting/resolve.mjs#legalPlacements, module/apps/canvas/targeting-layer.mjs
 *
 * > *"…if there are any enemy Units within a 2 panel area of the Doomsday Come
 * > area, Pale Rider can target an enemy Unit within this Range…"*
 *
 * The drag's anchor is `fieldEdge`, which names a Unit. `candidatePlacements`
 * offered it one empty placement, the resolver refused that with "Choose a
 * target.", and the session closed at once: live, "No legal targets for this
 * ability. Refused: Choose a target.." with Asterios standing one panel outside
 * the area.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields, compiled } from "../helpers/field.mjs";
import { legalPlacements } from "../../module/rules/targeting/resolve.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const PR = "paleRiderAct0001";
const NEAR = "foeAsteriosAct01";
// The test field is not rolled (`fieldsOf` stores no radius), so the area is
// the one panel its Master stands on: 2 panels out is in reach, 3 is not.
const IN = "foeMedeaActor001";
const FAR = "foeCastorActor01";
const PRM = "paleRiderMaster1";

it("offers an enemy within 2 of the area, and refuses one further out", async () => {
  const drag = await compiled("pale-rider-doomsday-drag");
  // Doomsday Come states a duration, and the expiry reads the Turn length off
  // the world's settings, which a bare test world does not register.
  const saved = game.settings;
  game.settings = { get: () => 3 };
  let fields;
  try {
    fields = await fieldsOf([{ ability: "pale-rider-doomsday-come", owner: PR, ownerMaster: PRM, faction: "A", panels: squareAround({ i: 8, j: 12 }, 7) }]);
  } finally {
    game.settings = saved;
  }
  const out = await withSubjects([
    { from: "pale-rider", id: PR, state: { factionId: "A", masterId: PRM }, panel: { i: 8, j: 13 } },
    { from: "master-advanced", id: PRM, state: { factionId: "A" }, panel: { i: 8, j: 12 } },
    { from: "asterios", id: NEAR, state: { factionId: "B" }, panel: { i: 10, j: 12 } },
    { from: "medea", id: IN, state: { factionId: "B" }, panel: { i: 11, j: 12 } },
    { from: "castor", id: FAR, state: { factionId: "B" }, panel: { i: 16, j: 10 } },
  ], ({ unit, board }) => legalPlacements(drag.system.targeting, unit(PR), board)
    .filter((o) => o.placement.unitId)
    .map((o) => [o.placement.unitId, o.legal]), { settings: { fields } });
  expect(Object.fromEntries(out)).toMatchObject({ [NEAR]: true, [IN]: false, [FAR]: false });
});

it("the session picks a Unit for a fieldEdge anchor", () => {
  const layer = readFileSync("module/apps/canvas/targeting-layer.mjs", "utf8");
  expect(layer).toMatch(/case "fieldEdge": return this\.#unitPicker\(/);
});
