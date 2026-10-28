/**
 * @file Curse ticks *"at the end of the turn, every ⅓◈"* (Appendix A), counted
 * from the Turn it lands (ruled 2026-10-28, the user).
 * @see module/rules/periodic.mjs#periodicDue, module/engine/scheduler.mjs#tickPeriodics
 *
 * With three Turns a Round, ⅓◈ is one Turn and every Turn's end ticks. With
 * eight, it is two: the tick ran at every Turn's end whatever the Round's
 * length, so a Curse in an eight-Turn War dealt twice its sheet (Van Gogh's
 * §46.36.3, Sita's #348).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { periodicDue } from "../../module/rules/periodic.mjs";

beforeAll(prepareSubjects, 60_000);

/** What a Turn's end deals Heracles carrying `effect`, at `tick`, in a War of `turnsPerRound`. */
const ticks = (effect, tick, turnsPerRound) => withSubjects(
  [{ from: "heracles", id: "heracles", effects: [effect] }],
  async ({ board }) => {
    const { tickPeriodics } = await import("../../module/engine/scheduler.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    return tickPeriodics(board.units, "turnEnd", {
      tick, turnsPerRound, effectDef: (id) => EffectRegistry.get(id), activeFactionId: null,
    }).map((i) => i.amount);
  },
);

describe("every ⅓◈, from the Turn it lands", () => {
  it("three Turns a Round: every Turn's end", async () => {
    for (const tick of [10, 11, 12]) {
      expect(await ticks({ defId: "curse", stage: 1, appliedTick: 10 }, tick, 3)).toEqual([25]);
    }
  });

  it("eight Turns a Round: the Turn it lands, then every second Turn", async () => {
    expect(await ticks({ defId: "curse", stage: 2, appliedTick: 10 }, 10, 8)).toEqual([50]);
    expect(await ticks({ defId: "curse", stage: 2, appliedTick: 10 }, 11, 8)).toEqual([]);
    expect(await ticks({ defId: "curse", stage: 2, appliedTick: 10 }, 12, 8)).toEqual([50]);
  });

  it("Curse (Bolg) keeps Curse's timing", async () => {
    expect(await ticks({ defId: "curseBolg", appliedTick: 10 }, 11, 8)).toEqual([]);
    expect(await ticks({ defId: "curseBolg", appliedTick: 10 }, 12, 8)).toEqual([25]);
  });

  it("a periodic that states no `every` ticks at each of its boundaries", () => {
    expect(periodicDue({ every: null }, { appliedTick: 10 }, 11, 8)).toBe(true);
  });
});
