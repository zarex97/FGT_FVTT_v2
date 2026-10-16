/**
 * @file The Turn and Round boundaries are bound before the world migrates, and wait for the engine (#230).
 * @see module/engine/engine-ready.mjs, module/engine/scheduler-hooks.mjs
 *
 * Found live in Arturia's war: a Turn changed in the seconds after a reload,
 * while `ready` was still migrating, fired `combatTurnChange` with no listener.
 * `globalTurn` stayed put and Faction 1 inherited Faction 2's spent Attacks
 * (Ch. 46 §46.4-JY, open since #195).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  delete globalThis.Hooks;
});

describe("engine-ready", () => {
  it("holds a waiter until the listeners are bound, then lets every later one through", async () => {
    const { whenEngineReady, markEngineReady } = await import("../../module/engine/engine-ready.mjs");
    let heard = false;
    const waiting = whenEngineReady().then(() => { heard = true; });
    await Promise.resolve();
    expect(heard).toBe(false);
    markEngineReady();
    await waiting;
    expect(heard).toBe(true);
    await expect(whenEngineReady()).resolves.toBeUndefined();
  });
});

describe("Scheduler.attachBoundaries", () => {
  it("binds the boundaries once per Hooks, so the early bind and the list's bind do not double them", async () => {
    globalThis.Hooks = { on: vi.fn() };
    const { Scheduler } = await import("../../module/engine/scheduler-hooks.mjs");
    Scheduler.attachBoundaries();
    Scheduler.attach();
    const events = globalThis.Hooks.on.mock.calls.map(([event]) => event);
    expect(events.filter((e) => e === "combatTurnChange")).toHaveLength(1);
    expect(events.filter((e) => e === "combatRound")).toHaveLength(1);
    expect(events).toContain("updateItem");
    // A fresh test world's Hooks binds its own.
    globalThis.Hooks = { on: vi.fn() };
    Scheduler.attachBoundaries();
    expect(globalThis.Hooks.on.mock.calls.map(([event]) => event)).toContain("combatTurnChange");
  });
});
