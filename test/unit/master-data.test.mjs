/**
 * @file The fields a Master borrows from the shared combatant schema.
 * @see module/data/actor/_shared.mjs, module/data/actor/master.mjs
 *
 * `_shared.mjs` reads `foundry.data.fields` at module scope, so it needs a stub
 * to load at all. The field SHAPES do not matter here and are not asserted; the
 * KEYS do, because `master.mjs` destructures three of them by name and a rename
 * upstream would silently give every Master a schema missing one.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TURN_RECORD, ROUND_RECORD } from "../../module/domain/stamped-record.mjs";

let combatantCommon;

beforeAll(async () => {
  const Field = class { constructor(options = {}) { this.options = options; } };
  globalThis.foundry ??= {
    data: { fields: new Proxy({}, { get: () => Field }) },
  };
  ({ combatantCommon } = await import("../../module/data/actor/_shared.mjs"));
});

describe("combatantCommon", () => {
  it("defines the three fields a Master borrows, so the two cannot drift", () => {
    // `master.mjs` takes exactly these from here rather than restating them.
    // The Master carried `turnState` and `roundState` and NOT `baseAttack`, so
    // `engine/summon.mjs` wrote a rolled Base Attack to a path the schema did
    // not declare, Foundry dropped it, and every Master attacked for zero.
    const keys = Object.keys(combatantCommon());
    for (const field of ["turnState", "roundState", "baseAttack"]) {
      expect(keys).toContain(field);
    }
  });
});

/**
 * The schema and the projection are two spellings of one field list, and they
 * are kept that way deliberately (ADR 0003): a `SchemaField` carries validation
 * and the prose on why each field exists, and a spec table would lose both.
 * What a drift test buys is that the duplication cannot go wrong silently,
 * which is the only way it ever has.
 *
 * This has drifted twice, both times schema-first, and both times the symptom
 * was a rule that quietly never fired. `reshapedField` was declared and not
 * projected, so `mayReshape` kept saying yes to a Servant who had already
 * redrawn Jack's Mist. `abilitiesUsed` was missing from BOTH branches of the
 * projection, so every reader saw `undefined`: `oncePerTurn` refused nothing,
 * and a Skill whose same-Turn partner was spent was still offered.
 *
 * The stub makes `new fields.SchemaField({...})` an object carrying its
 * argument, so `.options` is the declared field map.
 */
describe("drift: the record schema and the record spec", () => {
  const declared = (field) => Object.keys(combatantCommon()[field].options);

  it("declares exactly the fields the Turn Record projects", () => {
    expect(declared("turnState").sort())
      .toEqual([TURN_RECORD.stamp, ...Object.keys(TURN_RECORD.fields)].sort());
  });

  it("declares exactly the fields the Round Record projects", () => {
    expect(declared("roundState").sort())
      .toEqual([ROUND_RECORD.stamp, ...Object.keys(ROUND_RECORD.fields)].sort());
  });

  it("proves the stub exposes the field map, so the two above cannot pass empty", () => {
    expect(declared("turnState")).toContain("tick");
    expect(declared("turnState").length).toBeGreaterThan(5);
  });
});
