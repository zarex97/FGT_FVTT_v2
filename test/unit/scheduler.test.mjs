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
import { dispatch, checkRemovals, pendingRolls } from "../../module/engine/scheduler.mjs";
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

  it("resolves a rolled amount, for a per-turn gain like Semiramis's HGoB Construction", () => {
    const action = { kind: "ResourceDelta", resource: "hgobConstruction", roll: { key: "constructionGain" } };
    const rolledCtx = { ...ctx, rolls: { constructionGain: 5 } };
    const out = dispatch(action, emiya({ resources: { hgobConstruction: { value: 0, max: 100 } } }), handler, rolledCtx);

    expect(out).toEqual([{ t: "resource", unitId: "emiya", key: "resources.hgobConstruction.value", delta: 5 }]);
  });

  it("writes nothing when the roll has not arrived", () => {
    const action = { kind: "ResourceDelta", resource: "aria", roll: { key: "missing" } };
    const out = dispatch(action, emiya(), handler, ctx);

    expect(out).toEqual([]);
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

describe("Sustainability that does not decrease", () => {
  // > "Ozymandias' Sustainability does not decrease while he is within the
  // > Complex."
  //
  // Paused, not refunded: leaving resumes the clock where it was rather than
  // showing as churn every Turn he stands inside.
  const free = (over = {}) => ({
    id: "s", kind: "servant", contract: "free", sustainability: 4, ...over,
  });

  it("still runs down for an ordinary Free Servant", () => {
    const intents = checkRemovals([free()], { tick: 3 });
    expect(intents.find((i) => i.t === "resource" && i.absolute)?.delta).toBe(3);
  });

  it("stops while the suppression stands", () => {
    const inside = free({ suppressions: [{ scope: "sustainabilityDecay", source: "tentyris" }] });
    expect(checkRemovals([inside], { tick: 3 })).toEqual([]);
  });

  it("does not disappear a Servant whose last tick was suppressed", () => {
    const last = free({ sustainability: 1, suppressions: [{ scope: "sustainabilityDecay" }] });
    expect(checkRemovals([last], { tick: 3 }).some((i) => i.t === "defeat")).toBe(false);
  });
});

/**
 * A chance on the ACTION, as opposed to on the effect an action applies.
 *
 * Effect riders have stated their own `chance` since Serenity's poisoned
 * daggers (`ApplyEffect` reads it off the instance), but the action table never
 * could — and `roll` is not available as a gate, because `ResourceDelta` reads
 * `roll` as *the amount*: `a.roll ? rolled(a, c) : (a.delta ?? 0)`. Drake's
 * *"15% chance of gaining 1 Galleon Token"* would have granted 1d100 of them.
 *
 * Same contract as `rollGatePasses` and the terrain clauses: the sequence is
 * pure, the caller rolls, and a die that never arrived refuses rather than
 * firing.
 */
describe("a chance on an action", () => {
  const drake = (over = {}) => ({
    id: "drake",
    resources: { galleonTokens: { value: 0, max: null } },
    ...over,
  });
  const token = { kind: "ResourceDelta", resource: "galleonTokens", delta: 1, chance: 15 };
  const key = "chance:drake:ResourceDelta:galleonTokens";

  it("fires when the roll is at or under the stated chance", () => {
    const out = dispatch(token, drake(), handler, { ...ctx, rolls: { [key]: 15 } });
    expect(out).toEqual([
      { t: "resource", unitId: "drake", key: "resources.galleonTokens.value", delta: 1 },
    ]);
  });

  it("does not fire when the roll is over it", () => {
    expect(dispatch(token, drake(), handler, { ...ctx, rolls: { [key]: 16 } })).toEqual([]);
  });

  it("refuses when the die never arrived, rather than firing", () => {
    // The safe direction, and the one `rollGatePasses` already takes.
    expect(dispatch(token, drake(), handler, { ...ctx, rolls: {} })).toEqual([]);
  });

  it("grants exactly the delta, never the roll", () => {
    // The reason this is not `roll` + `when`: `ResourceDelta` reads a `roll`
    // as the AMOUNT, so the gate has to be a separate field.
    const out = dispatch(token, drake(), handler, { ...ctx, rolls: { [key]: 3 } });
    expect(out[0].delta).toBe(1);
  });

  it("leaves an action with no chance alone", () => {
    const certain = { kind: "ResourceDelta", resource: "galleonTokens", delta: 3 };
    const out = dispatch(certain, drake(), handler, ctx);
    expect(out[0].delta).toBe(3);
  });
});

describe("pendingRolls — a chance needs a die gathered for it", () => {
  const unit = {
    id: "drake",
    eventHandlers: [{
      source: "Blazing Golden Rule",
      events: ["damageDealt"],
      actions: [
        { kind: "CooldownDelta", scope: "np", delta: -1 },
        { kind: "ResourceDelta", resource: "galleonTokens", delta: 1, chance: 15 },
      ],
    }],
  };

  it("asks for a 1d100 keyed to the unit and the action", () => {
    const specs = pendingRolls(unit, "damageDealt");
    expect(specs).toContainEqual(
      expect.objectContaining({ key: "chance:drake:ResourceDelta:galleonTokens", formula: "1d100" }),
    );
  });

  it("asks for nothing on an event the handler does not listen for", () => {
    expect(pendingRolls(unit, "roundEnd")).toEqual([]);
  });

  it("asks for nothing for the action that has no chance", () => {
    const keys = pendingRolls(unit, "damageDealt").map((s) => s.key);
    expect(keys).toHaveLength(1);
  });
});

/**
 * A handler that asks about the EVENT rather than about a unit.
 *
 * `targetPredicate` asks about a Unit. Van Gogh's Channel Marker Soul needs
 * the other question: *"inflicted with Curse **or has Curse removed from
 * herself to the effects of the 'Gogh' buff**"* is ONE event with two
 * directions, and only one of the directions is gated on a source.
 */
describe("eventFilter", () => {
  const gogh = () => ({ id: "gogh", abilities: [{ id: "np1", isNP: true }] });
  const handler = { source: "Channel Marker Soul", abilityId: "cms" };
  const base = { tick: 4, turnsPerRound: 3, board: { units: [] }, rolls: {} };

  it("passes a handler with no filter at all", () => {
    const out = dispatch(
      { kind: "CooldownDelta", scope: "np", delta: -1 }, gogh(), handler,
      { ...base, event: { stageDelta: 2 } },
    );
    expect(out).toHaveLength(1);
  });

  it("resolves @stageDelta from the event", () => {
    const out = dispatch(
      { kind: "CooldownDelta", scope: "np", delta: "-@stageDelta" }, gogh(), handler,
      { ...base, event: { stageDelta: 3 } },
    );
    expect(out[0]).toMatchObject({ ticks: 3, mode: "reduce" });
  });

  it("pays for a REMOVAL too, which arrives negative", () => {
    // The `gogh` buff eats a stage; stageDelta is -1 and the cooldown still
    // falls by 1. "inflicted with Curse OR has Curse removed" -- both.
    const out = dispatch(
      { kind: "CooldownDelta", scope: "np", delta: "-@stageDelta" }, gogh(), handler,
      { ...base, event: { stageDelta: -1 } },
    );
    expect(out[0]).toMatchObject({ ticks: 1, mode: "reduce" });
  });

  it("drops the action when the event cannot answer the reference", () => {
    // "the event had no stage delta" and "the stage moved by nothing" are
    // different, and only one of them should be silent.
    expect(dispatch(
      { kind: "CooldownDelta", scope: "np", delta: "-@stageDelta" }, gogh(), handler,
      { ...base, event: {} },
    )).toEqual([]);
  });
});
