/**
 * @file Poison escalates by one stage at Round start, through the real applier.
 * @see module/engine/scheduler.mjs#beginRound, module/engine/applier.mjs#depthOf, #108
 *
 * > *"Stage N deals 20 × 2^(N−1) Poison damage at the end of every Round. The
 * > stage increases at the start of a Round if the Unit is still Poisoned."*
 *
 * `beginRound` re-applied each Poison with the new TOTAL as `stage`, and since
 * 7a443f2 the applier reads `stage` as the stages ARRIVING (right for a
 * transfer, which carries its depth). Each half had a test, and each test held
 * its own reading: the scheduler's asserted the intent said `stage: 2`, the
 * applier's asserted a transfer's depth arrived whole. So a stage-4 Poison
 * landed at 9 on a live board, and the escalation ran N → 2N + 1 every Round.
 * This runs the one through the other, on a Unit built from the real corpus.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/**
 * Every d100 comes up 100, the worst roll there is. Escalation is not an
 * infliction -- *"the stage increases at the start of a Round if the Unit is
 * still Poisoned"* states no chance -- so it must land on any roll, including
 * inside Sikera Ušum, where every Unit carries Poison Resist.
 */
beforeEach(() => {
  globalThis.Roll = class { async evaluate() { return { total: 100 }; } };
});
afterEach(() => { delete globalThis.Roll; });

/** Heracles carrying Poison at `stage`, after one Round start has run through the applier. */
const afterRoundStart = (stage) => withSubjects(
  [{ from: "heracles", id: "heracles", effects: [{ defId: "poison", stage }] }],
  async ({ board, world }) => {
    const { beginRound } = await import("../../module/engine/scheduler.mjs");
    const { applyIntents } = await import("../../module/engine/applier.mjs");
    const { worldIO } = await import("../../module/engine/io.mjs");
    const intents = beginRound(board, { tick: 1, round: 2, turnsPerRound: 3, activeFactionId: null });
    await applyIntents(intents.filter((i) => i.t === "applyEffect"), {
      io: worldIO(), canWrite: () => true, isGM: true, source: "test",
    });
    return [...world.actor("heracles").effects].filter((e) => e.system.defId === "poison").map((e) => e.system.stage);
  },
);

describe("Poison at Round start", () => {
  it("goes up one stage, not to twice its stage plus one", async () => {
    expect(await afterRoundStart(4)).toEqual([5]);
  });

  it("goes from 1 to 2", async () => {
    expect(await afterRoundStart(1)).toEqual([2]);
  });
});
