/**
 * @file The resolved summon variant, from the field that actually holds it.
 * @see module/rules/snapshot.mjs, docs/46-roster-re-audit.md §46.4-Y
 *
 * A Servant authored with a `summonVariant` block has its branch decided by a
 * coin flip at summon. Three places agree on where that answer lives:
 *
 * - the schema — `system.variant`, *"the RESOLVED result of `summonVariant`,
 *   once and for ever from summon"*, documented as *"read as a roll option
 *   (`self:variant:<id>`)"*;
 * - the writer — `engine/summon.mjs` sets `patch.variant = variantId`;
 * - `rules/options.mjs` — `if (unit.variant) options.add(\`self:variant:…\`)`.
 *
 * The snapshot read `sys.summonVariant?.variant` instead, which is the
 * **authored** block — `{ heads, tails }` — and has no `variant` key. So
 * `unit.variant` projected `null` for everyone and `self:variant:` was never
 * true for anybody.
 *
 * Semiramis is the only Servant with the block, and her sheet forks on it six
 * times: the Hanging Gardens' own requirement, both Sikera Ušum branches,
 * Summoning: Bašmu, Territory Creation's EX-versus-C rank, and Double Summon's
 * clause 3.
 *
 * Measured live: a Semiramis summoned onto the `dsc` branch — `system.variant`
 * reading `"dsc"`, her Range correctly overridden to 3 — whose board projection
 * carried `variant: null`, emitted no `self:variant:` option at all, and was
 * refused *Summoning: Bašmu* with `reason: "predicate"`.
 */

import { describe, it, expect } from "vitest";
import { snapshotUnit } from "../../module/rules/snapshot.mjs";

/** Her authored block, plus the resolved answer where the writer puts it. */
const semiramis = (over = {}) => ({
  id: "semiramis", name: "Semiramis", type: "servant",
  items: [], effects: [],
  system: {
    parameters: { str: "E", end: "D", agi: "D", mag: "A", luc: "A" },
    health: { value: 750, max: 750 },
    summonVariant: { heads: { id: "dsc" }, tails: { id: "noDsc" } },
    ...over,
  },
});

describe("the resolved variant reaches the projection", () => {
  it("reads the branch the writer recorded", () => {
    expect(snapshotUnit(semiramis({ variant: "dsc" })).variant).toBe("dsc");
  });

  it("reads the other branch just as well", () => {
    expect(snapshotUnit(semiramis({ variant: "noDsc" })).variant).toBe("noDsc");
  });

  it("is null for a Servant who has no variant block at all", () => {
    expect(snapshotUnit({ id: "h", type: "servant", items: [], effects: [], system: {
      parameters: { str: "A", end: "A", agi: "A", mag: "A", luc: "A" },
      health: { value: 1, max: 1 },
    } }).variant).toBe(null);
  });

  it("is null for one whose coin was never flipped", () => {
    expect(snapshotUnit(semiramis()).variant).toBe(null);
  });

  it("does not mistake the AUTHORED block for the resolved answer", () => {
    // `{ heads, tails }` is the question, not the answer; it has no `variant`.
    const authoredOnly = semiramis();
    expect(authoredOnly.system.summonVariant.variant).toBeUndefined();
    expect(snapshotUnit(authoredOnly).variant).toBe(null);
  });
});
