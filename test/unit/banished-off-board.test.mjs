/**
 * @file A banished Kagome Spirit is not on the board (#180).
 * @see module/rules/snapshot.mjs#snapshotBoard, module/engine/io.mjs#banish
 *
 * Live: Castor's Mana Burst banished a Beast for 1◈. Its token was hidden and
 * the board went on reading it: it held its panel, could guard Pale Rider's
 * Master and could be targeted. *"That Kagome Spirit disappears."*
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const ID = { pr: "paleRiderBanish1", prm: "paleRiderMasterB", beast: "beastBanished001" };
const DC = "pale-rider-doomsday-come";

async function board(state) {
  const saved = game.settings;
  game.settings = { get: () => 3 };
  let fields;
  try {
    fields = await fieldsOf([{
      ability: DC, owner: ID.pr, ownerMaster: ID.prm, faction: "A", state,
      panels: squareAround({ i: 4, j: 4 }, 7), shape: { kind: "square", size: 7, radius: 3 },
    }]);
  } finally {
    game.settings = saved;
  }
  return withSubjects([
    { from: "pale-rider", id: ID.pr, state: { factionId: "A", masterId: ID.prm }, panel: { i: 4, j: 5 } },
    { from: "master-advanced", id: ID.prm, state: { factionId: "A" }, panel: { i: 4, j: 4 } },
    { from: "kagome-beast", id: ID.beast, state: { factionId: "A", boundToFieldId: DC }, panel: { i: 5, j: 4 } },
  ], ({ board: b }) => b.units.map((u) => u.id), { settings: { fields } });
}

describe("a banished Spirit", () => {
  it("is on the board before it is banished", async () => {
    expect(await board({})).toContain(ID.beast);
  });

  it("is off the board while the field holds it away", async () => {
    expect(await board({ banished: { [ID.beast]: 23 } })).not.toContain(ID.beast);
  });
});
