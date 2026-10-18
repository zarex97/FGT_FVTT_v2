/**
 * The turn panel's order strip names each slot by its own faction. It used to
 * name every slot after the faction acting now: a two-faction match read
 * "Faction 2 · Faction 2 · Faction 2" on Faction 2's Turn (found live while
 * shooting the beginner's guide, 2026-10-18).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { turnOrderRows } from "../../module/apps/hud/turn-panel.mjs";

const ROSTER = [
  { id: "faction-1", name: "Faction 1", color: "#c0392b", userIds: [], allies: [] },
  { id: "faction-2", name: "Faction 2", color: "#2980b9", userIds: [], allies: [] },
];

function combat() {
  const gm = { id: "gm-slot", name: "GM" };
  return {
    actingFactionId: "faction-2",
    combatant: { id: "c2", name: "Faction 2" },
    combatants: new Map([["gm-slot", gm]]),
    system: { turnOrder: ["faction-2", "faction-1", "gm-slot"], takenThisRound: ["faction-2"], delays: {} },
  };
}

describe("the turn order strip", () => {
  let saved;
  beforeEach(() => {
    saved = globalThis.game;
    globalThis.game = {
      settings: { get: (ns, key) => (key === "factions" ? ROSTER : undefined) },
      i18n: { localize: (k) => k },
    };
  });
  afterEach(() => { globalThis.game = saved; });

  it("names each slot by its own faction, and the GM's slot by its combatant", () => {
    const rows = turnOrderRows(combat());
    expect(rows.map((r) => r.name)).toEqual(["Faction 2", "Faction 1", "GM"]);
    expect(rows.map((r) => r.active)).toEqual([true, false, false]);
    expect(rows.map((r) => r.acted)).toEqual([true, false, false]);
  });
});
