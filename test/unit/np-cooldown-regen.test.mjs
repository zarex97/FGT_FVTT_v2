/**
 * @file The effects that SPEED UP a Noble Phantasm's cooldown.
 * @see module/engine/scheduler.mjs, docs/46-roster-re-audit.md §46.4-W
 *
 * `cooldownRate` knows three effects that slow an NP down — `npLock`,
 * `npDegen`, `npLag` — and knew neither of the two that speed it up:
 *
 *   - **`npRegen`** — *"Noble Phantasm Cooldown is reduced by an extra X per
 *     Turn"* — carries its X as a `StatDelta` on `stat: "npRegen"`, which lands
 *     in `unit.statDeltas` and was read by nobody.
 *   - **`npCooldownRegen`** — *"reduced by 1 Turn at the end of every Turn"* —
 *     declares `periodic: { when: turnEnd, kind: npCooldown, amount: 1 }`, and
 *     `PERIODICS` has no entry for it; `kind: npCooldown` appears nowhere in the
 *     engine at all.
 *
 * Six ability files across five Servants apply one or the other: Drake's *Beyond
 * the Uncharted* and *Blazing Golden Rule*, Medusa's *Blood Temple*,
 * Penthesilea's *Golden Rule (Beauty)*, Semiramis's *Double Summon*, and Medea's
 * *Teachings of Circe*.
 *
 * Measured live on Semiramis across four Turn boundaries: her NP cooldown fell
 * by exactly **1** each Turn whether `npRegen` was held or not.
 */

import { describe, it, expect } from "vitest";
import { cooldownRate } from "../../module/engine/scheduler.mjs";

const np = { id: "np", slug: "sikeraUsum", isNP: true, cooldownRemaining: 10, regen: 0 };
const skill = { id: "sk", slug: "someSkill", isNP: false, cooldownRemaining: 10, regen: 0 };
const ctx = { tick: 2 };

const unit = (over = {}) => ({ id: "u", effects: [], statDeltas: [], ...over });

describe("the ordinary rate", () => {
  it("is one turn", () => {
    expect(cooldownRate(unit(), np, ctx)).toBe(1);
  });

  it("still honours an ability's own regen", () => {
    expect(cooldownRate(unit(), { ...np, regen: 2 }, ctx)).toBe(3);
  });
});

describe("npRegen", () => {
  it("adds its magnitude to a Noble Phantasm's rate", () => {
    const u = unit({ effects: ["npRegen"], statDeltas: [{ stat: "npRegen", value: 1, source: "npRegen" }] });
    expect(cooldownRate(u, np, ctx)).toBe(2);
  });

  it("scales with the magnitude, which is what the X in the text is", () => {
    const u = unit({ effects: ["npRegen"], statDeltas: [{ stat: "npRegen", value: 3, source: "npRegen" }] });
    expect(cooldownRate(u, np, ctx)).toBe(4);
  });

  it("stacks when two sources grant it — the effect says `magnitudeStacks`", () => {
    const u = unit({
      effects: ["npRegen"],
      statDeltas: [{ stat: "npRegen", value: 1 }, { stat: "npRegen", value: 2 }],
    });
    expect(cooldownRate(u, np, ctx)).toBe(4);
  });

  it("does NOT speed up an ordinary Skill — the text says Noble Phantasm", () => {
    const u = unit({ effects: ["npRegen"], statDeltas: [{ stat: "npRegen", value: 1 }] });
    expect(cooldownRate(u, skill, ctx)).toBe(1);
  });

  it("ignores statDeltas aimed at anything else", () => {
    const u = unit({ statDeltas: [{ stat: "mov", value: 5 }] });
    expect(cooldownRate(u, np, ctx)).toBe(1);
  });
});

describe("npCooldownRegen", () => {
  it("is worth one extra turn, as its own text states", () => {
    expect(cooldownRate(unit({ effects: ["npCooldownRegen"] }), np, ctx)).toBe(2);
  });

  it("does not touch an ordinary Skill either", () => {
    expect(cooldownRate(unit({ effects: ["npCooldownRegen"] }), skill, ctx)).toBe(1);
  });

  it("adds to npRegen rather than replacing it", () => {
    const u = unit({
      effects: ["npRegen", "npCooldownRegen"],
      statDeltas: [{ stat: "npRegen", value: 1 }],
    });
    expect(cooldownRate(u, np, ctx)).toBe(3);
  });
});

describe("the effects that SLOW it still win", () => {
  it("npLock stops the clock even against a regen", () => {
    const u = unit({ effects: ["npLock", "npCooldownRegen"], statDeltas: [{ stat: "npRegen", value: 2 }] });
    expect(cooldownRate(u, np, ctx)).toBe(0);
  });

  it("npDegen still runs the clock backwards", () => {
    const u = unit({ effects: ["npDegen", "npRegen"], statDeltas: [{ stat: "npRegen", value: 2 }] });
    expect(cooldownRate(u, np, ctx)).toBe(-1);
  });
});
