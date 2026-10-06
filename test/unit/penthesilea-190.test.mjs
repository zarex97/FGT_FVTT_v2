/**
 * @file Penthesilea — the rulings of her audit (#190).
 * @see char_orig_sheets/Copia de Penthesilea.md, docs/46-roster-re-audit.md
 *
 * Hatred of Achilles, ruled 2026-10-06: a Greek Male SERVANT (reading 1); the
 * nearest one, the player picking between two at the same distance (2); no
 * Skill, only the Move and the Attack (3); every Move closes on him, and she
 * may not end her Turn short (Q10); no effect against allies in a Grand Order
 * war (her sheet's note). Every subject is real content through the real
 * projection.
 */

import { describe, it, expect } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { hatredVerdict } from "../../module/rules/movement.mjs";
import { unmetCompulsions } from "../../module/rules/budget.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { test as predicate } from "../../module/rules/predicate.mjs";
import { effectDef } from "../helpers/effect-defs.mjs";

const PEN = "penthesilea00000";
const side = (id, from, i, j, factionId = "b") => ({ from, id, panel: { i, j }, state: { factionId } });
const pen = (i = 5, j = 5) => side(PEN, "penthesilea", i, j, "a");
const hatred = (board) => (board.units.find((u) => u.id === PEN).compulsions ?? []).find((c) => c.id === "hatred");

describe("Hatred of Achilles: whom she goes for (#190)", () => {
  it("goes for the nearest Greek Male Servant", async () => {
    await prepareSubjects();
    await withSubjects([pen(), side("achilles", "achilles", 5, 8), side("heracles", "heracles", 5, 7)], ({ board }) => {
      expect(hatred(board).targetIds).toEqual(["heracles"]);
    });
  }, 120_000);

  it("offers both at the same distance", async () => {
    await prepareSubjects();
    await withSubjects([pen(), side("achilles", "achilles", 5, 7), side("heracles", "heracles", 5, 3)], ({ board }) => {
      expect(hatred(board).targetIds.sort()).toEqual(["achilles", "heracles"]);
    });
  }, 120_000);

  it("ignores a Greek Male who is not a Servant", async () => {
    await prepareSubjects();
    const master = {
      type: "master", id: "greekMaster", name: "Greek Master",
      attributes: ["male", "human"], region: ["greece"], baseHealth: 200,
    };
    await withSubjects([pen(), { from: master, id: "greekMaster", panel: { i: 5, j: 6 }, state: { factionId: "b" } }], ({ board }) => {
      expect(hatred(board)).toBeUndefined();
    });
  }, 120_000);

  it("spares an allied Greek Male in a Grand Order war, and only then", async () => {
    await prepareSubjects();
    const specs = [pen(), side("achilles", "achilles", 5, 7, "a")];
    await withSubjects(specs, ({ board }) => expect(hatred(board)).toBeDefined());
    await withSubjects(specs, ({ board }) => expect(hatred(board)).toBeUndefined(), { settings: { grandOrder: true } });
    // ...an enemy one never.
    await withSubjects([pen(), side("achilles", "achilles", 5, 7)],
      ({ board }) => expect(hatred(board)).toBeDefined(), { settings: { grandOrder: true } });
  }, 120_000);
});

describe("Hatred of Achilles: what she may do (#190)", () => {
  it("refuses her Skills, and not Outrage Amazon", async () => {
    await prepareSubjects();
    await withSubjects([pen(), side("achilles", "achilles", 5, 7)], ({ board }) => {
      const me = board.units.find((u) => u.id === PEN);
      const verdict = (isNP) => canUseAbility({ ability: { id: "x", isNP }, unit: me, clockRunning: true });
      expect(verdict(false)).toMatchObject({ ok: false, reason: "compelled" });
      expect(verdict(true).reason).not.toBe("compelled");
    });
  }, 120_000);

  it("closes on him out of Range, and never backs away within it", async () => {
    await prepareSubjects();
    await withSubjects([pen(), side("achilles", "achilles", 5, 9)], ({ board }) => {
      const me = board.units.find((u) => u.id === PEN);
      expect(hatredVerdict(me, [{ i: 5, j: 5 }, { i: 5, j: 6 }], board).ok).toBe(true);
      expect(hatredVerdict(me, [{ i: 5, j: 5 }, { i: 6, j: 5 }], board).ok).toBe(false);
      expect(hatredVerdict(me, [{ i: 5, j: 5 }, { i: 5, j: 4 }], board).ok).toBe(false);
    });
  }, 120_000);

  it("may not end her Turn short of him", async () => {
    await prepareSubjects();
    await withSubjects([pen(), side("achilles", "achilles", 5, 9)], ({ board }) => {
      const me = board.units.find((u) => u.id === PEN);
      const [unmet] = unmetCompulsions([me], board);
      expect(unmet.message).toMatch(/must Move towards/);
      const near = { ...me, panel: { i: 5, j: 8 } };
      expect(unmetCompulsions([near], board)[0].message).toMatch(/must Attack/);
      const spent = { ...me, turnState: { ...(me.turnState ?? {}), movedPanels: me.mov } };
      expect(unmetCompulsions([spent], board)).toEqual([]);
      const done = { ...me, turnState: { ...(me.turnState ?? {}), attacked: true } };
      expect(unmetCompulsions([done], board)).toEqual([]);
      // In a Round that forbids every Attack, closing on him is enough.
      expect(unmetCompulsions([near], { ...board, attacksForbidden: true })).toEqual([]);
      expect(unmetCompulsions([me], { ...board, attacksForbidden: true })[0].message).toMatch(/must Move towards/);
    });
  }, 120_000);
});

describe("Atk Up (GreekMale) reads a Greek Male as Hatred does (#190 reading 1)", () => {
  it("lifts her damage against a Greek Male Servant, not a Greek Male Master", async () => {
    await prepareSubjects();
    const master = {
      type: "master", id: "greekMaster", name: "Greek Master",
      attributes: ["male", "human"], region: ["greece"], baseHealth: 200,
    };
    await withSubjects([pen(), side("achilles", "achilles", 5, 7), { from: master, id: "greekMaster", panel: { i: 5, j: 6 } }], ({ board }) => {
      const rule = effectDef("atkUpGreekMale").rules[0];
      const me = board.units.find((u) => u.id === PEN);
      const against = (id) => predicate(rule.predicate, {
        options: rollOptionsFor({ attacker: me, defender: board.units.find((u) => u.id === id) }),
      });
      expect(against("achilles")).toBe(true);
      expect(against("greekMaster")).toBe(false);
    });
  }, 120_000);
});

describe("the End Turn gate reads the board, where a compulsion lives (#190)", () => {
  it("builds its verdict from the board's Units, not bare snapshots", async () => {
    const { readFileSync } = await import("node:fs");
    const s = readFileSync("module/apps/hud/turn-panel.mjs", "utf8");
    expect(s).not.toMatch(/unitSnapshot\(/);
    expect(s).toContain("endTurnVerdict(combat, factionId, board.units ?? [])");
    expect(s).toContain("endTurnVerdict(combat, factionId, currentBoard().units ?? [])");
  });
});

describe("a drag asks Hatred of Achilles (#190)", () => {
  it("is refused in the drag gate, not only on a ride", async () => {
    const { readFileSync } = await import("node:fs");
    const s = readFileSync("module/engine/movement-hooks.mjs", "utf8");
    expect(s).toMatch(/const hated = hatredVerdict\(unit, route, board\);/);
    // ...from where the move BEGINS: Foundry's waypoints carry only where it goes.
    expect(s).toMatch(/const route = origin \? \[origin, \.\.\.path\] : path;/);
    expect(s).toMatch(/const pulled = decoyVerdict\(unit, route, board\);/);
  });
});

describe("the Turn end says what it did to Health (#190)", () => {
  it("names the Unit, the amount and the source", async () => {
    const { turnEndCard } = await import("../../module/engine/turn-report.mjs");
    const t = (key, d) => `${key}|${d?.who}|${d?.amount}|${d?.source}`;
    const card = turnEndCard(
      [{ t: "statDelta", unitId: "m", stat: "health.value", delta: -30, source: "Mad Enhancement" },
        { t: "statDelta", unitId: "x", stat: "agility.value", delta: -1 }],
      (id) => (id === "m" ? "Her Master" : id), t,
    );
    expect(card).toContain("FGT.TurnReport.Loses|Her Master|30|Mad Enhancement");
    expect(card).not.toContain("agility");
    expect(turnEndCard([], (id) => id, t)).toBeNull();
  });

  it("carries the handler's source on a StatDelta from the scheduler", async () => {
    const { collectContributions } = await import("../../module/rules/elements.mjs");
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const [handler] = collectContributions([{ active: true, name: "Mad Enhancement", rules: [{
      key: "OnEvent", event: "actedTurnEnd", automatic: true,
      then: [{ key: "StatDelta", stat: "health.value", delta: -30 }],
    }] }]).eventHandlers;
    const pen = { id: "pen", panel: { i: 0, j: 0 }, health: 100, eventHandlers: [handler], effects: [] };
    const out = fireEvent("actedTurnEnd", [pen], { tick: 1, turnsPerRound: 3, board: { units: [pen] } })
      .filter((i) => i.t === "statDelta");
    expect(out[0]).toMatchObject({ unitId: "pen", stat: "health.value", source: "Mad Enhancement" });
  });
});
