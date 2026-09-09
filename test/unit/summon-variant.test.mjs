/**
 * @file Summon-time variants.
 * @see docs/05-ranks-and-parameters.md, module/rules/summon-variant.mjs
 */

import { describe, it, expect } from "vitest";
import { resolveSummonVariant } from "../../module/rules/summon-variant.mjs";

const spec = {
  heads: { id: "dsc", overrides: { sustainability: "4◈" } },
  tails: { id: "noDsc", overrides: { sustainability: "2◈" } },
};

describe("resolveSummonVariant", () => {
  it("is null with no spec — an ordinary Servant has no variant", () => {
    expect(resolveSummonVariant(null, 1)).toBeNull();
  });

  it("picks heads on a roll of 1", () => {
    expect(resolveSummonVariant(spec, 1)).toEqual({ id: "dsc", overrides: { sustainability: "4◈" } });
  });

  it("picks tails on a roll of 2", () => {
    expect(resolveSummonVariant(spec, 2)).toEqual({ id: "noDsc", overrides: { sustainability: "2◈" } });
  });

  it("defaults overrides to an empty object when the branch does not declare any", () => {
    expect(resolveSummonVariant({ heads: { id: "dsc" } }, 1).overrides).toEqual({});
  });
});

/**
 * The coin flip has to reach the predicate vocabulary.
 *
 * `rules/options.mjs` emits `self:variant:<id>` from `unit.variant`, and the
 * snapshot never projected it — so `self:variant:` was false for everybody.
 * Six of Semiramis's abilities fork on it, including the Hanging Gardens'
 * own requirement, so her signature Noble Phantasm refused itself. Found live.
 */
describe("the rolled variant reaches the roll options", () => {
  it("projects `variant` from the actor's resolved summonVariant", async () => {
    const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
    const unit = snapshotUnit({
      id: "sem", name: "Semiramis", type: "servant",
      system: { summonVariant: { variant: "dsc" }, parameters: {}, health: { value: 1, max: 1 } },
    });
    expect(unit.variant).toBe("dsc");
  });

  it("is null when the flip has not been resolved", async () => {
    const { snapshotUnit } = await import("../../module/rules/snapshot.mjs");
    const unit = snapshotUnit({
      id: "sem", name: "Semiramis", type: "servant",
      system: { summonVariant: { heads: {}, tails: {} }, parameters: {}, health: { value: 1, max: 1 } },
    });
    expect(unit.variant).toBe(null);
  });

  it("emits self:variant:<id> once the field is present", async () => {
    const { rollOptionsFor } = await import("../../module/rules/options.mjs");
    const options = rollOptionsFor({ attacker: { id: "sem", variant: "dsc", effects: [] } });
    expect([...options]).toContain("self:variant:dsc");
  });
});
