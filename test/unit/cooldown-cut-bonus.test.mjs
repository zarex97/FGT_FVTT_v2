/**
 * @file A cut to a Cooldown that cuts one Turn more (#299).
 * @see module/engine/applier.mjs#resolveCooldownCuts, module/rules/elements.mjs (CooldownCutBonus)
 *
 * Merlin, Proto Merlin and Lady Avalon: *"Whenever … NP Cooldown is reduced,
 * whether through natural reduction … or an effect, it is reduced by 1 extra
 * Turn."* Barghest (UDK)'s Thundercloud Eater makes natural NP regen 2 Turns
 * instead of 1: the natural Turn only. Both meet at the one door every cut
 * passes, the applier, and nowhere else.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import * as I from "../../module/engine/intents.mjs";
import { validateAll } from "../../tools/lib/content.mjs";

beforeAll(prepareSubjects, 120_000);

const U = "cutBonusUnit0001";
const np = { id: "test-cut-np", slug: "testCutNp", name: "Test Cut NP", kind: "noblePhantasm", isNP: true, cooldown: "6◈" };
const skill = { id: "test-cut-skill", slug: "testCutSkill", name: "Test Cut Skill", kind: "skill", cooldown: "3◈" };
const passive = (rule) => ({
  id: "test-cut-passive", slug: "testCutPassive", name: "Test Cut Passive", kind: "skill", passive: true,
  passiveRules: [{ key: "CooldownCutBonus", ...rule }],
});
const MERLIN = { kinds: ["np"], extra: 1, on: "any" };
const BARGHEST = { kinds: ["np"], extra: 1, on: "natural" };

/** A Unit holding the bonus, with both clocks set, and a way to cut them. */
async function holding(rule, fn, { npAt = 6, skillAt = 6 } = {}) {
  const abilities = rule ? [np, skill, passive(rule)] : [np, skill];
  await withSubjects([
    { from: "test-jeanne-d-arc", id: U, state: { factionId: "A" }, panel: { i: 5, j: 5 }, with: { abilities } },
  ], async ({ world: w }) => {
    const item = (cid) => w.actor(U).items.find((i) => i.system?.contentId === cid);
    await item("test-cut-np").update({ "system.cooldown.remaining": npAt });
    await item("test-cut-skill").update({ "system.cooldown.remaining": skillAt });
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    const { currentBoard } = await import("../../module/engine/board.mjs");
    const { advanceCooldowns } = await import("../../module/engine/scheduler.mjs");
    const at = (cid) => item(cid).system.cooldown.remaining;
    const cut = (cid, ticks, mode = "reduce", extra = {}) =>
      applyWorldIntents([{ ...I.cooldown(U, item(cid).id, ticks, mode), ...extra }], "test", { lines: true });
    const naturalTurn = () => {
      const board = currentBoard();
      const unit = board.units.filter((u) => u.id === U);
      return applyWorldIntents(advanceCooldowns(unit, { tick: 2, turnsPerRound: 3, board }), "test", { lines: true });
    };
    await fn({ at, cut, naturalTurn });
  }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
}

describe("Merlin-shape: every cut to an NP Cooldown cuts one more", () => {
  it("a natural Turn takes the NP from 6 to 4", async () => {
    await holding(MERLIN, async ({ at, naturalTurn }) => {
      await naturalTurn();
      expect(at("test-cut-np")).toBe(4);
    });
  });

  it("an effect's cut of 2 cuts 3", async () => {
    await holding(MERLIN, async ({ at, cut }) => {
      await cut("test-cut-np", 2);
      expect(at("test-cut-np")).toBe(3);
    });
  });

  it("a Skill's natural Turn is only 1: the kind it does not name", async () => {
    await holding(MERLIN, async ({ at, naturalTurn }) => {
      await naturalTurn();
      expect(at("test-cut-skill")).toBe(5);
    });
  });

  it("without the bonus the same Turn is 1, so the bonus is what moved it", async () => {
    await holding(null, async ({ at, naturalTurn }) => {
      await naturalTurn();
      expect(at("test-cut-np")).toBe(5);
    });
  });
});

describe("Barghest-shape: the natural Turn only", () => {
  it("a natural Turn cuts 2", async () => {
    await holding(BARGHEST, async ({ at, naturalTurn }) => {
      await naturalTurn();
      expect(at("test-cut-np")).toBe(4);
    });
  });

  it("an effect's cut gains nothing", async () => {
    await holding(BARGHEST, async ({ at, cut }) => {
      await cut("test-cut-np", 2);
      expect(at("test-cut-np")).toBe(4);
    });
  });
});

describe("what is not a cut gains nothing (Review Focus 5)", () => {
  it("a cut of 0 is nothing", async () => {
    await holding(MERLIN, async ({ at, cut }) => {
      await cut("test-cut-np", 0);
      expect(at("test-cut-np")).toBe(6);
    });
  });

  it("a clock at 1 cut by 1 stops at 0, never below", async () => {
    await holding(MERLIN, async ({ at, cut }) => {
      await cut("test-cut-np", 1);
      expect(at("test-cut-np")).toBe(0);
    }, { npAt: 1 });
  });

  it("a clock at 0 is not moved", async () => {
    await holding(MERLIN, async ({ at, cut }) => {
      const out = await cut("test-cut-np", 1);
      expect(at("test-cut-np")).toBe(0);
      expect(out.lines ?? []).toEqual([]);
    }, { npAt: 0 });
  });

  it("a set or an increase gains nothing", async () => {
    await holding(MERLIN, async ({ at, cut }) => {
      await cut("test-cut-np", 3, "set");
      expect(at("test-cut-np")).toBe(3);
      await cut("test-cut-np", 2, "increase");
      expect(at("test-cut-np")).toBe(5);
    });
  });

  it("a settle is the clock finding its length, not a cut", async () => {
    await holding(MERLIN, async ({ at, cut }) => {
      await cut("test-cut-np", 2, "reduce", { settle: true });
      expect(at("test-cut-np")).toBe(4);
    });
  });
});

describe("the card", () => {
  it("names the real before and after", async () => {
    await holding(MERLIN, async ({ cut }) => {
      const out = await cut("test-cut-np", 2);
      const text = JSON.stringify(out.lines ?? []);
      expect(text).toContain("Cooldown 6 → 3");
    });
  });
});

describe("the build refuses a word the door does not know", () => {
  const problems = (rule) => validateAll([{ path: "x.yml", dir: "abilities", doc: {
    schema: 1, id: "thing", name: "Thing", kind: "skill", passive: true,
    passiveRules: [{ key: "CooldownCutBonus", ...rule }],
  } }]).problems.filter((p) => p.includes("CooldownCutBonus"));

  it("passes Merlin's and Barghest's", () => {
    expect(problems(MERLIN)).toEqual([]);
    expect(problems(BARGHEST)).toEqual([]);
  });

  it("names an unknown kind and an unknown on", () => {
    expect(problems({ ...MERLIN, kinds: ["noblePhantasm"] })[0]).toContain('kinds ["noblePhantasm"] -- expected some of np, skill, spell');
    expect(problems({ ...MERLIN, on: "effect" })[0]).toContain('on "effect" -- expected any or natural');
    expect(problems({ extra: 1 })[0]).toContain("kinds [] -- expected");
  });
});
