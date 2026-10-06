/**
 * @file A moved token invalidates the board once its move has settled (#190).
 * @see module/engine/invalidation-hooks.mjs, docs/12-invalidation-and-auras.md
 *
 * In v14 a TokenDocument's `x` and `y` read the ANIMATED position until the
 * movement finishes. A board projected inside `updateToken` still stood the
 * Unit where it started, so Hatred of Achilles never saw a Greek Male walk in.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("token movement invalidation waits for the move to settle (#190)", () => {
  const handlers = new Map();
  const fired = [];
  let saved;

  beforeAll(async () => {
    saved = globalThis.Hooks;
    globalThis.Hooks = {
      on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]),
      callAll: (name, targets) => { if (name === "fgt.invalidate") fired.push(targets); },
    };
    const { attachInvalidation } = await import("../../module/engine/invalidation-hooks.mjs");
    attachInvalidation();
  });
  afterAll(() => { globalThis.Hooks = saved; });

  const move = (token) => handlers.get("updateToken").forEach((fn) => fn(token, { x: 900 }));

  it("fires only after the movement animation resolves", async () => {
    fired.length = 0;
    let settle;
    const animating = new Promise((r) => { settle = r; });
    move({ actor: { id: "a", system: {} }, object: { movementAnimationPromise: animating } });
    await Promise.resolve();
    expect(fired).toEqual([]);
    settle();
    await animating;
    await Promise.resolve();
    expect(fired).toHaveLength(1);
    expect(fired[0]).toContain("compulsions");
  });

  it("fires at once for a token with no animation", () => {
    fired.length = 0;
    move({ actor: { id: "a", system: {} }, object: null });
    expect(fired).toHaveLength(1);
  });
});
