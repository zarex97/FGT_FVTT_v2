/**
 * @file A dimension's clock runs on its own War's Turns only.
 * @see module/engine/dimension.mjs#runDimensionClock, docs/27-platforms-and-levels.md
 *
 * Found live 2026-10-19, reviewing #178: two Wars ran at once. War 178's Storm
 * Border, submerged at its tick 4, was warned and then surfaced *"with 0
 * Unit(s)"* while War 178 stood at tick 5, because War 134's Turns ran every
 * open dimension in the world against War 134's tick. Nemo was left on the
 * dimension's Level.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../module/engine/war.mjs", () => ({
  currentWar: () => null,
  isWarGM: () => true,
  warRule: () => 3,
  sceneIdOfWar: (war) => war?.scene ?? null,
}));

const { runDimensionClock } = await import("../../module/engine/dimension.mjs");

/** A Storm Border open since `activatedAt`, its Level on `sceneId`'s scene. */
const platform = (id, levelId, activatedAt) => ({
  id, type: "platform",
  system: { dimension: { forceExitAt: "maxDuration" }, activatedAt, levelId, resurfacePlan: null },
});
const scene = (id, levelIds) => ({ id, levels: new Map(levelIds.map((l) => [l, { id: l }])) });

let cards;
beforeEach(() => {
  cards = [];
  globalThis.foundry = { utils: { escapeHTML: (s) => s } };
  globalThis.ChatMessage = { create: async (data) => { cards.push(data); return data; } };
  globalThis.game = {
    actors: { contents: [platform("sb134", "lvl134", 4), platform("sb178", "lvl178", 4)] },
    scenes: new Map([["s134", scene("s134", ["lvl134"])], ["s178", scene("s178", ["lvl178"])]]),
    i18n: { localize: (k) => k, format: (k) => k },
  };
});

describe("the dimension clock (2◈ = 6 Turns at 3 a Round)", () => {
  it("warns of the forced exit for its own War's dimension, and leaves another War's alone", async () => {
    // Tick 9 is 5 Turns inside: one Turn before the ceiling.
    await runDimensionClock(9, { id: "war134", scene: "s134" });
    expect(cards.map((c) => c.content)).toEqual([expect.stringContaining("FGT.Dimension.ForcedNext")]);
  });

  it("reads none of them for a War whose scene holds neither Level", async () => {
    await runDimensionClock(9, { id: "warX", scene: "sNone" });
    // `game.scenes.get` finds no such scene: the War predates the move and reads them all.
    expect(cards).toHaveLength(2);
    game.scenes.set("sEmpty", scene("sEmpty", []));
    cards.length = 0;
    await runDimensionClock(9, { id: "warY", scene: "sEmpty" });
    expect(cards).toEqual([]);
  });
});
