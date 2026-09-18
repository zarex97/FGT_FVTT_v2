/**
 * @file The three record writers, executed.
 * @see module/engine/io.mjs, test/helpers/world.mjs, docs/18-items.md
 *
 * These assertions were made by hand in a browser, against a live world, one
 * commit at a time — because there was no other way to make them. `io.mjs` was
 * executed by none of the suite, so a defect in a writer could only be found by
 * somebody looking. #32 is what that costs: a fix landed in `markTurn`, and
 * `recordUse` and `markRoundState` went on doing the thing the issue was about,
 * one of them on every ability use in the game, for as long as nobody looked
 * again.
 *
 * The rule under test is **stale-by-reading**: a record stamped with an earlier
 * cycle reads as blank, so nothing has to reset it — and therefore a writer must
 * rebuild the whole record rather than re-stamp it, because the stamp is what
 * marked the other fields dead (`module/domain/stamped-record.mjs`).
 */

import { describe, it, expect } from "vitest";
import { withWorld } from "../helpers/world.mjs";

/** A Servant with a spent Turn Record stamped three ticks ago. */
const staleAt = (tick) => ({
  tick,
  acted: true,
  moved: true,
  attacked: true,
  movedPanels: 5,
  moveSegments: 1,
  itemTransfers: 1,
  namelessForestAttempts: 1,
  reshapedField: true,
  abilitiesUsed: [],
  inCombatPhase: false,
  usedActiveSkill: false,
  usedRidingAttack: false,
});

const servant = (over = {}) => ({
  id: "semiramis",
  name: "Semiramis",
  type: "servant",
  system: {
    parameters: { str: "C", end: "C", agi: "C", mag: "A", luc: "B" },
    mov: 5,
    ...(over.system ?? {}),
  },
  items: over.items ?? [],
});

const ability = (id, contentId) => ({
  id, name: contentId, type: "ability", system: { contentId, timesUsed: 0 },
});

/** The adapter, built against whatever world is installed. */
async function io() {
  const { worldIO } = await import("../../module/engine/io.mjs");
  return worldIO();
}

describe("markTurn", () => {
  it("blanks the rest of a record stamped in an earlier Turn", async () => {
    await withWorld({
      actors: [servant({ system: { turnState: staleAt(3) } })],
      combat: { round: 2, system: { globalTurn: 6 } },
    }, async (w) => {
      await (await io()).markTurn("semiramis", { acted: true });

      const turn = w.actor("Semiramis").system.turnState;
      expect(turn.tick).toBe(6);
      expect(turn.acted).toBe(true);
      // The five that #32 was about.
      expect(turn.itemTransfers).toBe(0);
      expect(turn.movedPanels).toBe(0);
      expect(turn.namelessForestAttempts).toBe(0);
      expect(turn.reshapedField).toBe(false);
      expect(turn.moved).toBe(false);
    });
  });

  it("keeps a record that belongs to THIS Turn", async () => {
    await withWorld({
      actors: [servant({ system: { turnState: { ...staleAt(6) } } })],
      combat: { round: 2, system: { globalTurn: 6 } },
    }, async (w) => {
      await (await io()).markTurn("semiramis", { attacked: true });

      const turn = w.actor("Semiramis").system.turnState;
      expect(turn.itemTransfers).toBe(1);
      expect(turn.movedPanels).toBe(5);
      expect(turn.attacked).toBe(true);
    });
  });
});

describe("recordUse", () => {
  it("does not revive a stale record while recording the ability (#32)", async () => {
    // The half of #32 that survived the commit closing #32. `recordUse` wrote
    // `system.turnState.tick` beside `abilitiesUsed` alone — two keys of
    // fourteen — so every ability use in the game made the other twelve current
    // again. Measured live at tick 6 against a record stamped tick 3:
    // itemTransfers 1, movedPanels 5, acted, namelessForestAttempts 1 and
    // reshapedField all came back.
    await withWorld({
      actors: [servant({
        system: { turnState: staleAt(3), roundState: { round: 1, abilitiesUsed: [], combatInBaseThisRound: true } },
        items: [ability("i1", "asterios-monstrous-strength")],
      })],
      combat: { round: 3, system: { globalTurn: 6 } },
    }, async (w) => {
      await (await io()).recordUse("semiramis", "i1", "asterios-monstrous-strength");

      const a = w.actor("Semiramis");
      expect(a.system.turnState.tick).toBe(6);
      expect(a.system.turnState.abilitiesUsed).toEqual(["asterios-monstrous-strength"]);
      expect(a.system.turnState.itemTransfers).toBe(0);
      expect(a.system.turnState.movedPanels).toBe(0);
      expect(a.system.turnState.acted).toBe(false);
      expect(a.system.turnState.namelessForestAttempts).toBe(0);
      expect(a.system.turnState.reshapedField).toBe(false);

      // And the Round scale, the other direction of the same defect: Ch. 29's
      // E1 regeneration was withheld from a Unit that had not fought, because
      // a `true` from an earlier Round was re-stamped current.
      expect(a.system.roundState.round).toBe(3);
      expect(a.system.roundState.combatInBaseThisRound).toBe(false);
    });
  });

  it("stamps against the match being PLAYED, not the tracker on screen", async () => {
    // The third hand-roller `turnRecordOf`'s docstring names, and the only one
    // of the five that WRITES the clock it reads: `recordUse` took its tick from
    // `game.combat`, which is the Combat being VIEWED. With a second tracker
    // open, a use was filed against a foreign tick and then read as stale for
    // ever after — the record it wrote could never match the match it was
    // played in.
    await withWorld({
      actors: [servant({
        system: { turnState: staleAt(3), roundState: { round: 1, abilitiesUsed: [] } },
        items: [ability("i1", "asterios-monstrous-strength")],
      })],
      combat: { started: true, round: 3, system: { globalTurn: 6 } },
      viewedCombat: { started: true, round: 1, system: { globalTurn: 0 } },
    }, async (w) => {
      await (await io()).recordUse("semiramis", "i1", "asterios-monstrous-strength");

      const a = w.actor("Semiramis");
      expect(a.system.turnState.tick).toBe(6);
      expect(a.system.roundState.round).toBe(3);
      expect(a.system.turnState.abilitiesUsed).toEqual(["asterios-monstrous-strength"]);
    });
  });

  it("accumulates within one Turn, at both scales", async () => {
    await withWorld({
      actors: [servant({
        system: {
          turnState: { tick: 6, abilitiesUsed: [], itemTransfers: 2 },
          roundState: { round: 3, abilitiesUsed: [], combatInBaseThisRound: false },
        },
        items: [ability("i1", "one"), ability("i2", "two")],
      })],
      combat: { round: 3, system: { globalTurn: 6 } },
    }, async (w) => {
      const adapter = await io();
      await adapter.recordUse("semiramis", "i1", "one");
      await adapter.recordUse("semiramis", "i2", "two");

      const a = w.actor("Semiramis");
      expect(a.system.turnState.abilitiesUsed).toEqual(["one", "two"]);
      expect(a.system.roundState.abilitiesUsed).toEqual(["one", "two"]);
      // The live record is preserved, not blanked, by a second use.
      expect(a.system.turnState.itemTransfers).toBe(2);
    });
  });

  it("counts charges against the item's whole-match budget", async () => {
    // `+ count`, not `+ 1`: a cascading revival spends several charges in one
    // resolution, and recording one per resolution gave Heracles eleven
    // RESOLUTIONS rather than the eleven his sheet allows.
    await withWorld({
      actors: [servant({ system: { turnState: { tick: 6 } }, items: [ability("i1", "god-hand")] })],
      combat: { round: 1, system: { globalTurn: 6 } },
    }, async (w) => {
      await (await io()).recordUse("semiramis", "i1", "god-hand", 3);
      expect(w.actor("Semiramis").items.get("i1").system.timesUsed).toBe(3);
    });
  });
});

describe("markRoundState", () => {
  it("blanks the rest of a record stamped in an earlier Round", async () => {
    // Ch. 32's Caladbolg II / Hrunting exclusion refused a shot that had never
    // been taken this Round, because fighting in your own base re-stamped the
    // Round and revived the ability list.
    await withWorld({
      actors: [servant({
        system: { roundState: { round: 1, abilitiesUsed: ["emiya-caladbolg"], combatInBaseThisRound: false } },
      })],
      combat: { round: 3, system: { globalTurn: 9 } },
    }, async (w) => {
      await (await io()).markRoundState("semiramis", { combatInBaseThisRound: true });

      const round = w.actor("Semiramis").system.roundState;
      expect(round.round).toBe(3);
      expect(round.combatInBaseThisRound).toBe(true);
      expect(round.abilitiesUsed).toEqual([]);
    });
  });

  it("keeps a record that belongs to THIS Round", async () => {
    await withWorld({
      actors: [servant({
        system: { roundState: { round: 3, abilitiesUsed: ["emiya-caladbolg"], combatInBaseThisRound: false } },
      })],
      combat: { round: 3, system: { globalTurn: 9 } },
    }, async (w) => {
      await (await io()).markRoundState("semiramis", { combatInBaseThisRound: true });

      const round = w.actor("Semiramis").system.roundState;
      expect(round.abilitiesUsed).toEqual(["emiya-caladbolg"]);
      expect(round.combatInBaseThisRound).toBe(true);
    });
  });
});

describe("the reset is a property of reading", () => {
  it("expires a spent record when the clock advances, with no clearing write", async () => {
    // `clearTurnState` used to write a blank record to every actor of the
    // incoming faction once per turn. It bought nothing — the schema said so
    // itself — and it cost a real defect: a board re-derived after the clear
    // saw `acted: false` on every unit and killed every `actedTurnEnd` field
    // dispatch. Advancing the clock IS the reset.
    await withWorld({
      actors: [servant({ system: { turnState: { tick: 6, acted: true, movedPanels: 4 } } })],
      combat: { round: 2, system: { globalTurn: 6 } },
    }, async (w) => {
      const { turnStateAt } = await import("../../module/rules/snapshot.mjs");
      const stored = () => w.actor("Semiramis").system.turnState;

      expect(turnStateAt(stored(), 6).movedPanels).toBe(4);

      await w.combat.update({ "system.globalTurn": 7 });

      expect(turnStateAt(stored(), 7).movedPanels).toBe(0);
      expect(turnStateAt(stored(), 7).acted).toBe(false);
      // Nothing was written to the actor to make that true.
      expect(stored().movedPanels).toBe(4);
      expect(w.writes.filter(([label]) => label.startsWith("Actor"))).toEqual([]);
    });
  });
});
