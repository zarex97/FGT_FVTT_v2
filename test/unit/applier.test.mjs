import { describe, it, expect } from "vitest";
import { planApplication, applyIntents } from "../../module/engine/applier.mjs";
import * as I from "../../module/engine/intents.mjs";

const ownsA = (unitId) => unitId === "a";

/** A recording write adapter, so the async shell is testable without a world. */
function fakeIo() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push([name, ...args]); return Promise.resolve(); };
  return {
    calls,
    adjustHealth: rec("adjustHealth"),
    adjustStat: rec("adjustStat"),
    adjustResource: rec("adjustResource"),
    createEffects: rec("createEffects"),
    deleteEffects: rec("deleteEffects"),
    consumeUse: rec("consumeUse"),
    setMode: rec("setMode"),
    setCooldown: rec("setCooldown"),
    move: rec("move"),
    setFacing: rec("setFacing"),
    spendCommandSpells: rec("spendCommandSpells"),
    defeat: rec("defeat"),
    markTurn: rec("markTurn"),
    log: rec("log"),
    proxy: rec("proxy"),
    prompt: rec("prompt"),
  };
}

describe("planApplication", () => {
  it("routes intents this client cannot write to the GM proxy", () => {
    const plan = planApplication([I.damage("a", 10), I.damage("b", 20)], { canWrite: ownsA });
    expect(plan.local.map((i) => i.unitId)).toEqual(["a"]);
    expect(plan.remote.map((i) => i.unitId)).toEqual(["b"]);
  });

  it("keeps everything local for a GM", () => {
    const plan = planApplication([I.damage("a", 10), I.damage("b", 20)], { canWrite: ownsA, isGM: true });
    expect(plan.remote).toEqual([]);
    expect(plan.local.length).toBe(2);
  });

  it("always writes log entries locally — dropping one loses audit history", () => {
    const plan = planApplication([I.log({ kind: "x", unitId: "b" })], { canWrite: ownsA });
    expect(plan.local.length).toBe(1);
    expect(plan.remote).toEqual([]);
  });

  it("separates prompts from writes", () => {
    const plan = planApplication([I.damage("a", 5), I.prompt("u1", { kind: "luckCheck" })], { canWrite: ownsA });
    expect(plan.prompts.length).toBe(1);
    expect(plan.local.length).toBe(1);
  });

  it("aborts the whole batch on a validation failure rather than applying part of it", () => {
    const plan = planApplication([I.damage("a", 10), I.damage("b", -5)], { canWrite: ownsA });
    expect(plan.problems.length).toBe(1);
    expect(plan.local).toEqual([]);
    expect(plan.remote).toEqual([]);
  });

  it("applies the documented ordering before routing", () => {
    const plan = planApplication(
      [I.defeat("a", "x"), I.damage("a", 10), I.removeEffect("a", "e", "r")],
      { canWrite: ownsA },
    );
    expect(plan.local.map((i) => i.t)).toEqual(["removeEffect", "damage", "defeat"]);
  });
});

describe("applyIntents", () => {
  it("collapses several effect applications on one unit into a single write", async () => {
    const io = fakeIo();
    await applyIntents(
      [
        I.applyEffect("a", { defId: "burn" }, "src"),
        I.applyEffect("a", { defId: "sap" }, "src"),
      ],
      { io, canWrite: ownsA },
    );
    const creates = io.calls.filter(([n]) => n === "createEffects");
    expect(creates.length).toBe(1);
    expect(creates[0][2].length).toBe(2);
  });

  it("sums same-unit damage into one health adjustment", async () => {
    const io = fakeIo();
    await applyIntents([I.damage("a", 300), I.damage("a", 100)], { io, canWrite: ownsA });
    const adjust = io.calls.filter(([n]) => n === "adjustHealth");
    expect(adjust.length).toBe(1);
    expect(adjust[0][2]).toBe(-400);
  });

  it("sends healing as a positive adjustment", async () => {
    const io = fakeIo();
    await applyIntents([I.heal("a", 50, "regen")], { io, canWrite: ownsA });
    expect(io.calls.find(([n]) => n === "adjustHealth")[2]).toBe(50);
  });

  it("proxies what it cannot write and reports the split", async () => {
    const io = fakeIo();
    const r = await applyIntents(
      [I.damage("a", 10), I.damage("b", 20), I.prompt("u", {})],
      { io, canWrite: ownsA },
    );
    expect(r).toEqual({ applied: 1, proxied: 1, prompted: 1 });
    expect(io.calls.some(([n]) => n === "proxy")).toBe(true);
    expect(io.calls.some(([n]) => n === "prompt")).toBe(true);
  });

  it("throws before writing anything when the batch is malformed", async () => {
    const io = fakeIo();
    await expect(
      applyIntents([I.damage("a", 10), { t: "teleport", unitId: "a" }], { io, canWrite: ownsA, source: "test" }),
    ).rejects.toThrow(/Refusing to apply a malformed intent batch from test/);
    expect(io.calls).toEqual([]);
  });

  it("throws on an intent type with no writer, rather than silently dropping it", async () => {
    const io = { ...fakeIo(), createEffects: undefined };
    delete io.log;
    await expect(applyIntents([I.log({})], { io, canWrite: ownsA })).rejects.toThrow();
  });

  it("applies the last facing when several are queued", async () => {
    const io = fakeIo();
    await applyIntents([I.setFacing("a", "n"), I.setFacing("a", "e")], { io, canWrite: ownsA });
    expect(io.calls.find(([n]) => n === "setFacing")[2]).toBe("e");
  });
});

describe("markTurn — what the budget reads back", () => {
  it("routes to the io adapter", async () => {
    const io = fakeIo();
    await applyIntents([I.markTurn("a", { attacked: true })], { io, canWrite: ownsA, isGM: true });
    expect(io.calls).toEqual([["markTurn", "a", { attacked: true }]]);
  });

  it("collapses several patches for one unit into a single write", async () => {
    const io = fakeIo();
    await applyIntents(
      [I.markTurn("a", { moved: true }), I.markTurn("a", { movedPanels: 3 })],
      { io, canWrite: ownsA, isGM: true },
    );
    expect(io.calls).toEqual([["markTurn", "a", { moved: true, movedPanels: 3 }]]);
  });

  it("is written before anything that reads it", () => {
    const ordered = I.order([I.damage("a", 10), I.markTurn("a", { attacked: true })]);
    expect(ordered.map((i) => i.t)).toEqual(["markTurn", "damage"]);
  });

  it("rejects a patch that is not an object", () => {
    expect(I.validate([I.markTurn("a", null)])[0]).toMatch(/patch must be a turnState object/);
  });
});

describe("consumeUse", () => {
  it("reaches the writer with the effect and the count", () => {
    // `uses` was stored on every count-stacked effect from the day the applier
    // was written and nothing decremented it, so Medea's Trofa -- "1 times" --
    // evaded every attack for the rest of the match.
    const io = fakeIo();
    return applyIntents([I.consumeUse("a", "autoEvade")], { io, canWrite: ownsA, isGM: true })
      .then(() => {
        expect(io.calls).toContainEqual(["consumeUse", "a", "autoEvade", 1]);
      });
  });

  it("is ordered with removals, not with applications", () => {
    // Spending the last use IS a removal. Applied after a create, it would
    // decrement an effect that had just been replaced.
    const plan = planApplication(
      [I.applyEffect("a", { defId: "x" }), I.consumeUse("a", "autoEvade")],
      { canWrite: ownsA, isGM: true },
    );
    expect(plan.local.map((i) => i.t)).toEqual(["consumeUse", "applyEffect"]);
  });
});
