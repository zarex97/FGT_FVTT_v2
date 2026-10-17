/**
 * Proto Gil, audit #232, played in the arena: what only a Combat Process or a
 * use shows. The projection halves are in `proto-gil-232.test.mjs`.
 * @see docs/superpowers/specs/2026-10-16-proto-gil-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack, playProcess } from "../helpers/process.mjs";
import * as process from "../../module/engine/combat-process.mjs";

// Painting a Region is a Scene write this world does not model; what is
// painted, and WHEN, is what the Waterside clause is about.
const painted = [];
vi.mock("../../module/engine/terrain.mjs", async (original) => ({
  ...(await original()),
  paintTerrain: async (args) => {
    painted.push({ ...args, foeHealth: globalThis.game?.actors?.get?.("protoGilFoe00001")?.system?.health?.value ?? null });
    return { ok: true };
  },
}));

beforeAll(prepareSubjects, 120_000);
// A whole match per test, and the first pays for the warm-up: 5s is not enough on a busy run.
vi.setConfig({ testTimeout: 30_000 });

const GIL = "protoGilgamesh01";
const MAS = "protoGilMaster01";
const ALLY = "protoGilAlly0001";
const FOE = "protoGilFoe00001";

const TICK = 30;
const MATCH = { tokens: true, combat: { round: 10, started: true, system: { globalTurn: TICK }, actingFactionId: "A" } };

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system.defId);
const processes = (w) => [...w.messages].filter((m) => m.getFlag("fgt", "process"))
  .map((m) => ({ id: m.id, state: process.deserialize(m.getFlag("fgt", "process")) }));

/* ========================================================================== */

describe("Enki is activated now and lands 7◈ later (EK.*; readings 10, 11, 12, 21, 22, 23)", () => {
  const party = () => [
    { from: "proto-gil", id: GIL, panel: { i: 6, j: 6 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
    { from: "master-advanced", id: MAS, panel: { i: 6, j: 5 }, state: { factionId: "A" } },
    { from: "medusa", id: ALLY, panel: { i: 6, j: 8 }, state: { factionId: "A" } },
    { from: "karna", id: FOE, panel: { i: 3, j: 3 }, state: { factionId: "B" } },
  ];

  it("activation: half the Master's maximum, the mark, Cannot Act, and no hit yet", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const enki = abilityOf(w, GIL, "proto-gil-enki");
      const master = w.actor(MAS);
      const before = master.system.health.value;
      const max = master.system.health.max;
      const out = await playAttack(w, { attacker: GIL, ability: enki.id, placement: {} });
      expect(out.declared.scheduled).toBe(true);
      expect(before - w.actor(MAS).system.health.value).toBe(Math.floor(max / 2));
      expect(held(w, GIL)).toContain("cannotAct");
      const [strike] = w.combat.getFlag("fgt", "scheduledStrikes");
      expect(strike).toEqual(expect.objectContaining({ ownerId: GIL, fireAt: TICK + 21, panel: { i: 6, j: 6 } }));
      // The mark itself is a Structure from the actor packs, which this world
      // does not carry: pressed live (#232).
      expect(processes(w)).toEqual([]);
    }, MATCH);
  });

  it("lands on the boundary its 7◈ ends at, hits his ally and the enemy, spares him and his Master, then paints Waterside", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const enki = abilityOf(w, GIL, "proto-gil-enki");
      await playAttack(w, { attacker: GIL, ability: enki.id, placement: {} });
      const { runScheduledStrikes } = await import("../../module/engine/schedule.mjs");

      expect((await runScheduledStrikes(TICK + 20)).fired).toEqual([]);
      const foeBefore = w.actor(FOE).system.health.value;
      const allyBefore = w.actor(ALLY).system.health.value;
      const fired = await runScheduledStrikes(TICK + 21);
      expect(fired.fired).toHaveLength(1);

      const hit = processes(w);
      expect(hit.map((p) => p.state.defenderId).sort()).toEqual([ALLY, FOE].sort());
      for (const p of hit) {
        await playProcess(w, p.id, { [FOE]: ["nothing", "declined", "declined"], [ALLY]: ["nothing", "declined", "declined"] });
      }
      expect(w.actor(FOE).system.health.value).toBeLessThan(foeBefore);
      expect(w.actor(ALLY).system.health.value).toBeLessThan(allyBefore);
      expect(held(w, FOE)).toContain("drowning");
      expect(w.combat.getFlag("fgt", "scheduledStrikes")).toEqual([]);
      // Once, over the strike's 13x13, for 7◈, and only after the damage landed.
      const waterside = painted.filter((p) => JSON.stringify(p).includes("waterside"));
      expect(waterside).toHaveLength(1);
      expect(waterside[0].foeHealth).toBeLessThan(foeBefore);
      expect(waterside[0].panels).toHaveLength(169);
      expect(waterside[0].duration).toBe("7◈");
    }, MATCH);
  });

  it("is cancelled if he falls first, and stays spent (EK.cancel, EK.once)", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const enki = abilityOf(w, GIL, "proto-gil-enki");
      await playAttack(w, { attacker: GIL, ability: enki.id, placement: {} });
      const markId = w.combat.getFlag("fgt", "scheduledStrikes")[0].markId;
      await w.actor(GIL).update({ "system.defeated": true });
      const { runScheduledStrikes } = await import("../../module/engine/schedule.mjs");
      const out = await runScheduledStrikes(TICK + 1);
      expect(out.cancelled).toHaveLength(1);
      expect(w.combat.getFlag("fgt", "scheduledStrikes")).toEqual([]);
      expect(w.actor(markId)).toBeFalsy();
      expect(abilityOf(w, GIL, "proto-gil-enki").system.expended || abilityOf(w, GIL, "proto-gil-enki").system.timesUsed > 0).toBe(true);
    }, MATCH);
  });

  it("Golden Rule's fallback brings it a Turn closer (GR.p.enki)", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const enki = abilityOf(w, GIL, "proto-gil-enki");
      await playAttack(w, { attacker: GIL, ability: enki.id, placement: {} });
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.scheduleDelta(GIL, -1)], "test");
      expect(w.combat.getFlag("fgt", "scheduledStrikes")[0].fireAt).toBe(TICK + 20);
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Bab-ilu's additional Normal Attack (BI.p.*; readings 1, 2, 3, 24)", () => {
  const party = () => [
    { from: "proto-gil", id: GIL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
    { from: "master-advanced", id: MAS, panel: { i: 9, j: 1 }, state: { factionId: "A" } },
    { from: "medusa", id: FOE, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
  ];

  it("after a Block from 3 panels, he may land beside the DU and swing again; the DU must Block", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      w.answer({ title: "FGT.FollowUp.Title", pick: ["5,7"] });
      await playAttack(w, { attacker: GIL, target: FOE, react: { [FOE]: ["block", "declined", "declined"] } });
      const all = processes(w);
      expect(all).toHaveLength(2);
      const second = all.find((p) => p.state.attack?.followUp);
      expect(second.state.forbiddenReactions).toEqual(expect.arrayContaining(["evade", "nothing"]));
      const { currentBoard } = await import("../../module/engine/board.mjs");
      expect(currentBoard().units.find((u) => u.id === GIL).panel).toEqual({ i: 5, j: 7 });
      // The second swing earns no third.
      await playProcess(w, second.id, { [FOE]: ["block", "declined", "declined"] });
      expect(processes(w)).toHaveLength(2);
    }, MATCH);
  });

  it("an adjacent Attack earns nothing", async () => {
    const near = party().map((s) => (s.id === FOE ? { ...s, panel: { i: 5, j: 6 } } : s));
    await withSubjects(near, async ({ world: w }) => {
      await playAttack(w, { attacker: GIL, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(processes(w)).toHaveLength(1);
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Bab-ilu's dice, rolled by every DU it hits (BI.roll, BI.same; reading 5)", () => {
  it("two 2s land Def Dwn twice, a 10 lands NP Seal", async () => {
    await withSubjects([
      { from: "proto-gil", id: GIL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 9, j: 1 }, state: { factionId: "A" } },
      // No Magic Resistance, whose debuff resistance would make the chance a die.
      { from: "asterios", id: FOE, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const ba = abilityOf(w, GIL, "proto-gil-bab-ilu");
      w.dice.set("d20", 2, 2, 10);
      await playAttack(w, {
        attacker: GIL, ability: ba.id, placement: { panel: { i: 5, j: 8 } },
        react: { [FOE]: ["nothing", "declined", "declined", "declined", "declined"] },
      });
      const defDwn = [...w.actor(FOE).effects].filter((e) => e.system.defId === "defDwn");
      expect(defDwn).toHaveLength(2);
      expect(held(w, FOE)).toContain("npSeal");
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Drowning's miss ends the swing and spends no Cooldown (EK.drown; reading 19)", () => {
  it("a missed Enkidu closes its Process at the declaration and leaves its clock at 0", async () => {
    // Found live: Karna under Drowning missed, and the declaration sent the
    // missed Process `nothing` -- an illegal transition -- so it threw.
    await withSubjects([
      { from: "proto-gil", id: GIL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" }, effects: [{ defId: "drowning" }] },
      { from: "master-advanced", id: MAS, panel: { i: 9, j: 1 }, state: { factionId: "A" } },
      { from: "medea", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.dice.every(1);
      // A missed Attack is still an Attack at Range 2: the offer comes, declined.
      w.answer({ title: "FGT.FollowUp.Title", decline: true });
      const ek = abilityOf(w, GIL, "proto-gil-enkidu");
      const before = w.actor(FOE).system.health.value;
      const { processes } = await playAttack(w, { attacker: GIL, ability: ek.id, target: FOE });
      expect(processes[0].history.some((h) => h.event === "miss")).toBe(true);
      expect(process.isComplete(processes[0])).toBe(true);
      expect(w.actor(FOE).system.health.value).toBe(before);
      expect(abilityOf(w, GIL, "proto-gil-enkidu").system.cooldown.remaining).toBe(0);
    }, MATCH);
  });
});
