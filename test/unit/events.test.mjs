/**
 * @file Event handlers — `OnEvent` collection and `fireEvent` dispatch.
 * @see docs/24-rules-engine.md §24.5 Group 5, docs/45-implementation-status.md A1
 *
 * The defect these pin down: `OnEvent` stored the element's own shape and
 * `fireEvent` read a `handler.intents` array that nothing ever wrote, so every
 * event handler in the game contributed a log line and nothing else.
 */

import { describe, it, expect } from "vitest";
import { collectContributions } from "../../module/rules/elements.mjs";
import { fireEvent, resolveDefeat, pendingRolls } from "../../module/engine/scheduler.mjs";

/** Collect the event handlers a single ability contributes. */
function handlersFor(rules, { rank = "B", id = "skill", name = "Skill" } = {}) {
  return collectContributions([{ id, name, rank, passiveRules: rules }]).eventHandlers;
}

/* ========================================================================== */
/*  Dispatch                                                                  */
/* ========================================================================== */

describe("fireEvent dispatch", () => {
  it("turns a `then` action into an intent when its event fires", () => {
    const handlers = handlersFor([
      { key: "OnEvent", event: "turnEnd", then: [{ key: "Damage", amount: 50 }] },
    ]);
    const intents = fireEvent("turnEnd", [{ id: "u1", eventHandlers: handlers }], { tick: 3 });

    expect(intents.filter((i) => i.t === "damage")).toEqual([
      expect.objectContaining({ t: "damage", unitId: "u1", amount: 50 }),
    ]);
  });

  it("ignores a handler whose event does not match", () => {
    const handlers = handlersFor([
      { key: "OnEvent", event: "turnEnd", then: [{ key: "Damage", amount: 50 }] },
    ]);
    const intents = fireEvent("roundEnd", [{ id: "u1", eventHandlers: handlers }], { tick: 3 });

    expect(intents.filter((i) => i.t !== "log")).toEqual([]);
  });

  it("fires a handler that lists several events, on any one of them", () => {
    // Mannanán's Fragarach subscribes to two events at once (Ch. 24 §24.8).
    const handlers = handlersFor([
      { key: "OnEvent", event: ["combatProcessEnd", "effectApplied"], then: [{ key: "Heal", amount: 10 }] },
    ]);
    const unit = { id: "u1", eventHandlers: handlers };

    expect(fireEvent("combatProcessEnd", [unit], { tick: 1 }).some((i) => i.t === "heal")).toBe(true);
    expect(fireEvent("effectApplied", [unit], { tick: 1 }).some((i) => i.t === "heal")).toBe(true);
    expect(fireEvent("turnEnd", [unit], { tick: 1 }).some((i) => i.t === "heal")).toBe(false);
  });

  it("still logs the event, so an audited handler with no readable action is visible", () => {
    const handlers = handlersFor([{ key: "OnEvent", event: "turnEnd", then: [] }]);
    const intents = fireEvent("turnEnd", [{ id: "u1", eventHandlers: handlers }], { tick: 7 });

    expect(intents).toEqual([
      expect.objectContaining({ t: "log", entry: expect.objectContaining({ kind: "event", event: "turnEnd" }) }),
    ]);
  });
});

/* ========================================================================== */
/*  Battle Continuation — the A1 test gate                                    */
/* ========================================================================== */

describe("Battle Continuation revive", () => {
  /** The skill as authored in `packs/_source/class-skills/battle-continuation.yml`. */
  const skill = (rank) => ({
    id: "battleContinuation", name: "Battle Continuation", rank,
    passiveRules: [{
      key: "OnEvent",
      event: "unitDefeated",
      revive: { table: "battleContinuationRevive", cooldownTable: "battleContinuationCooldown" },
    }],
  });

  const unitAt = (health, { rank = "B", cooldownRemaining = 0 } = {}) => ({
    id: "u1",
    health: { value: health, max: 1000 },
    abilities: [{ id: "battleContinuation", cooldownRemaining }],
    eventHandlers: collectContributions([skill(rank)]).eventHandlers,
  });

  // `turnsPerRound` matters: a cooldown of "3◈" is three *Rounds*, and
  // `cooldownRemaining` counts turns, so the two are not the same number.
  const ctx = { tick: 4, turnsPerRound: 3, rolls: { battleContinuationRevive: 42 } };

  it("revives a unit at 0 Health for the rolled amount, instead of defeating it", () => {
    const intents = resolveDefeat(unitAt(0), ctx);

    expect(intents).toContainEqual(expect.objectContaining({ t: "heal", unitId: "u1", amount: 42 }));
    expect(intents.some((i) => i.t === "defeat")).toBe(false);
  });

  it("sets the skill's own cooldown from battleContinuationCooldown", () => {
    // Rank B falls in the EX/A/B band: 3◈ — three Rounds, which at three turns
    // to the Round is nine turns of `cooldownRemaining`.
    expect(resolveDefeat(unitAt(0), ctx)).toContainEqual(expect.objectContaining({
      t: "cooldown", unitId: "u1", abilityId: "battleContinuation", ticks: 9, mode: "set",
    }));
  });

  it("does not revive a second time inside the cooldown window, and defeats instead", () => {
    const intents = resolveDefeat(unitAt(0, { cooldownRemaining: 2 }), ctx);

    expect(intents.some((i) => i.t === "heal")).toBe(false);
    expect(intents).toContainEqual(expect.objectContaining({ t: "defeat", unitId: "u1" }));
  });

  it("adds the per-step bonus above the base grade", () => {
    // 4d20 at B, +5 per step: a B+ rolling 42 revives for 47.
    expect(resolveDefeat(unitAt(0, { rank: "B+" }), ctx))
      .toContainEqual(expect.objectContaining({ t: "heal", amount: 47 }));
  });

  it("defeats a unit whose skill cannot revive it", () => {
    const plain = { id: "u2", health: { value: 0, max: 1000 }, abilities: [], eventHandlers: [] };

    expect(resolveDefeat(plain, ctx)).toContainEqual(expect.objectContaining({
      t: "defeat", unitId: "u2",
    }));
  });

  it("leaves a living unit alone", () => {
    expect(resolveDefeat(unitAt(500), ctx)).toEqual([]);
  });
});

/* ========================================================================== */
/*  The "caller rolls" contract                                               */
/* ========================================================================== */

describe("pendingRolls", () => {
  const bc = (rank) => collectContributions([{
    id: "battleContinuation", name: "Battle Continuation", rank,
    passiveRules: [{
      key: "OnEvent", event: "unitDefeated",
      revive: { table: "battleContinuationRevive", cooldownTable: "battleContinuationCooldown" },
    }],
  }]).eventHandlers;

  it("names the roll a handler needs, so the impure caller can make it", () => {
    // These sequences are pure; whoever calls them owns the dice. Without this
    // the caller cannot know that `unitDefeated` on this unit needs 4d20.
    expect(pendingRolls({ eventHandlers: bc("B") }, "unitDefeated"))
      .toEqual([{ key: "battleContinuationRevive", formula: "4d20", bonus: 0 }]);
  });

  it("carries the per-step bonus, which is not part of the formula", () => {
    expect(pendingRolls({ eventHandlers: bc("B+") }, "unitDefeated"))
      .toEqual([{ key: "battleContinuationRevive", formula: "4d20", bonus: 5 }]);
  });

  it("asks for nothing when no handler listens for the event", () => {
    expect(pendingRolls({ eventHandlers: bc("B") }, "turnEnd")).toEqual([]);
  });
});

describe("actions in one handler see each other", () => {
  const master = { id: "m", kind: "master", health: 45 };
  const servant = {
    id: "s", kind: "servant", masterId: "m",
    eventHandlers: [{
      events: ["actedTurnEnd"],
      source: "Mad Enhancement",
      actions: [
        { kind: "StatDelta", subject: "master", stat: "health.value", amount: 30, direction: "down", floor: 30 },
        {
          kind: "SetMode", ability: "madEnhancement", active: false,
          whenValue: { subject: "master", stat: "health.value", lte: 30 },
        },
      ],
    }],
  };
  const ctx = { tick: 0, turnsPerRound: 3, board: { units: [master, servant] }, rolls: {} };

  it("deactivates in the same Turn the drain reaches the floor", () => {
    // "Its Master loses 30 Health at the end of every Turn it Acts; when its
    // Master's Health is 30 or less, ME is forcibly deactivated." Computing
    // both against the same starting value made the deactivation lag a full
    // Turn behind the drain that caused it.
    const out = fireEvent("actedTurnEnd", [servant], ctx);

    expect(out.find((i) => i.t === "statDelta")).toMatchObject({ unitId: "m", delta: -15 });
    expect(out.find((i) => i.t === "setMode")).toMatchObject({ unitId: "s", active: false });
  });

  it("leaves the mode alone while the Master is still clear of the floor", () => {
    const healthy = { ...ctx, board: { units: [{ ...master, health: 250 }, servant] } };
    const out = fireEvent("actedTurnEnd", [servant], healthy);

    expect(out.find((i) => i.t === "statDelta")).toMatchObject({ delta: -30 });
    expect(out.some((i) => i.t === "setMode")).toBe(false);
  });

  it("takes nothing at all from a Master already at the floor", () => {
    const spent = { ...ctx, board: { units: [{ ...master, health: 30 }, servant] } };
    const out = fireEvent("actedTurnEnd", [servant], spent);

    expect(out.some((i) => i.t === "statDelta")).toBe(false);
    expect(out.some((i) => i.t === "setMode")).toBe(true);
  });

  it("does nothing for a Free Servant, which has no Master to charge", () => {
    const free = { ...servant, masterId: null };
    const out = fireEvent("actedTurnEnd", [free], { ...ctx, board: { units: [free] } });
    expect(out.filter((i) => i.t !== "log")).toEqual([]);
  });
});
