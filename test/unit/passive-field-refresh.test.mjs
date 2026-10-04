/**
 * @file A standing passive field takes its ability's current rules (#180).
 * @see module/engine/fields.mjs#ensurePassiveFields, #staleRuleAxes
 *
 * Live: Contagion's field opened at tick 0. Its content then gained
 * `notOnOwnTurn` on the `actedTurnEnd` event, and the field went on charging an
 * enemy twice at the end of its own Turn: `ensurePassiveFields` skipped any
 * passive field already open, so the stored copy never saw the change.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { compiled, prepareFields } from "../helpers/field.mjs";
import { staleRuleAxes } from "../../module/engine/fields.mjs";

beforeAll(prepareFields, 120_000);

describe("staleRuleAxes", () => {
  it("finds nothing to change in a field opened from the current spec", async () => {
    const spec = (await compiled("pale-rider-contagion")).system.field;
    const stored = JSON.parse(JSON.stringify(spec));
    expect(staleRuleAxes(stored, spec)).toBeNull();
  });

  it("brings an old Contagion's events up to `notOnOwnTurn`", async () => {
    const spec = (await compiled("pale-rider-contagion")).system.field;
    const stored = JSON.parse(JSON.stringify(spec));
    for (const event of stored.interiorEvents) delete event.notOnOwnTurn;

    const patch = staleRuleAxes(stored, spec);
    expect(Object.keys(patch)).toEqual(["system.interiorEvents"]);
    const acted = patch["system.interiorEvents"].find((e) => e.event === "actedTurnEnd");
    expect(acted?.notOnOwnTurn).toBe(true);
  });

  it("reads an axis the spec leaves out as its empty default", () => {
    expect(staleRuleAxes({ interior: [], isolation: null }, {})).toBeNull();
    expect(staleRuleAxes({ interior: [{ x: 1 }] }, {})).toEqual({ "system.interior": [] });
  });
});

describe("ensurePassiveFields", () => {
  it("refreshes an open passive field instead of skipping it", () => {
    const src = readFileSync("module/engine/fields.mjs", "utf8");
    expect(src).toMatch(/if \(open\.has\(fieldId\)\) \{\s*await refreshPassiveField\(fieldId, spec\);/);
  });
});
