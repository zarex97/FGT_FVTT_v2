/**
 * @file Scheduler actions that write to a pool.
 * @see module/engine/scheduler.mjs, module/domain/resources.mjs
 *
 * `ResourceDelta` has been in the action table since it was written and no
 * shipped content had ever used it — Scáthach's PRS Tokens are spent by the
 * cooldown waiver and granted by a `resource` phase, both of which pass a full
 * path. The action passed the **bare pool name** straight through to
 * `io.adjustResource`, which expects a dot path under `system`, so
 * `system.aria` resolved to nothing and the write was dropped silently.
 *
 * Found live: EMIYA finished a Combat Phase and gained no Aria.
 */

import { describe, it, expect } from "vitest";
import { dispatch } from "../../module/engine/scheduler.mjs";
import { resourcePathFor } from "../../module/domain/resources.mjs";

const handler = { source: "Unlimited Blade Works", abilityId: "ubw" };
const ctx = { tick: 4, turnsPerRound: 3, board: { units: [] }, rolls: {} };

const emiya = (over = {}) => ({
  id: "emiya",
  resources: { aria: { value: 0, max: 6 } },
  luck: { value: 1, max: 3 },
  ...over,
});

describe("ResourceDelta", () => {
  it("writes a §6.10 pool under `resources`", () => {
    const out = dispatch({ kind: "ResourceDelta", resource: "aria", delta: 1 }, emiya(), handler, ctx);

    expect(out).toEqual([{ t: "resource", unitId: "emiya", key: "resources.aria.value", delta: 1 }]);
  });

  it("writes a top-level stat pool at the top level", () => {
    // EMIYA's Activated Circuits restores Luck, from the same action key that
    // grants Aria — and Luck is not a `resources` entry.
    const out = dispatch({ kind: "ResourceDelta", resource: "luck", delta: 1 }, emiya(), handler, ctx);

    expect(out[0].key).toBe("luck.value");
  });

  it("leaves an authored path alone", () => {
    const out = dispatch(
      { kind: "ResourceDelta", resource: "resources.prs.value", delta: 2 }, emiya(), handler, ctx,
    );

    expect(out[0].key).toBe("resources.prs.value");
  });
});

describe("resourcePathFor", () => {
  it("decides from the unit, because only the unit knows what pools it has", () => {
    // The same bare name resolves two different ways on two Servants, which is
    // why this cannot be a constant.
    expect(resourcePathFor("aria", { resources: { aria: { value: 0 } } })).toBe("resources.aria.value");
    expect(resourcePathFor("aria", { resources: {} })).toBe("aria.value");
    expect(resourcePathFor("agility", null)).toBe("agility.value");
  });
});
