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
