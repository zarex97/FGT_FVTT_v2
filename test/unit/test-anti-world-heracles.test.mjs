/**
 * @file The test Servant that carries a damaging [Anti-World] Noble Phantasm (#183).
 * @see packs/_source/servants/test-anti-world-heracles.yml, packs/_source/abilities/test-anti-world-nine-lives.yml
 *
 * No Servant in the corpus had one, so five of Doomsday Come's Clauses could
 * not be built (#180, DC.aw.*). This is Heracles's Nine Lives raised to
 * [Anti-World], on a Servant that carries nothing else.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields, compiled } from "../helpers/field.mjs";
import { isolationBlocks } from "../../module/rules/bounded-fields.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { readFileSync } from "node:fs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

describe("the test Noble Phantasm", () => {
  it("is Nine Lives's numbers at [Anti-World]", async () => {
    const [np, nine] = await Promise.all([compiled("test-anti-world-nine-lives"), compiled("heracles-nine-lives")]);
    expect(np.system.npTags).toEqual(["antiWorld"]);
    expect(np.system.damage).toEqual(nine.system.damage);
  });

  it("is let across Doomsday Come's boundary, where a Normal Attack is not", async () => {
    const ID = { pr: "paleRiderAW00001", prm: "paleRiderMastAW1", herc: "testHeraclesAW01", q: "quetzAW000000001" };
    const saved = game.settings;
    game.settings = { get: () => 3 };
    let fields;
    try {
      fields = await fieldsOf([{
        ability: "pale-rider-doomsday-come", owner: ID.pr, ownerMaster: ID.prm, faction: "A",
        panels: squareAround({ i: 4, j: 4 }, 7), shape: { kind: "square", size: 7, radius: 3 },
      }]);
    } finally {
      game.settings = saved;
    }
    const out = await withSubjects([
      { from: "pale-rider", id: ID.pr, state: { factionId: "A", masterId: ID.prm }, panel: { i: 4, j: 5 } },
      { from: "master-advanced", id: ID.prm, state: { factionId: "A" }, panel: { i: 4, j: 4 } },
      { from: "quetzalcoatl", id: ID.q, state: { factionId: "A" }, panel: { i: 7, j: 4 } },
      { from: "test-anti-world-heracles", id: ID.herc, state: { factionId: "B" }, panel: { i: 9, j: 4 } },
    ], ({ unit, board }) => {
      const field = board.fields[0];
      const spec = { anchor: { kind: "targetUnit" }, shape: { kind: "unit" }, selection: { relations: ["enemy"], chooser: "all", count: 1 } };
      return [
        isolationBlocks(field, unit(ID.herc), unit(ID.q), board, { npTags: [] }).blocked,
        isolationBlocks(field, unit(ID.herc), unit(ID.q), board, { npTags: ["antiWorld"] }).blocked,
        // The aiming session carries the tags on the SPEC, with a bare placement.
        resolveTargets({ ...spec, npTags: ["antiWorld"] }, unit(ID.herc), board, { unitId: ID.q }).errors,
      ];
    }, { settings: { fields } });
    expect(out).toEqual([true, false, []]);
  });

  it("travels on the aiming session's spec", () => {
    expect(readFileSync("module/apps/actor-sheet/sheet.mjs", "utf8")).toMatch(/npTags: \[\.\.\.\(ability\?\.system\?\.npTags \?\? \[\]\)\],/);
  });
});
