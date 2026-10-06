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
