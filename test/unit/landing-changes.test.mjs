/**
 * @file What Landing changes in play: authored keys a path used to ignore.
 * @see module/engine/landing.mjs, docs/15-effect-application.md
 *
 * Each of these is an Effect Entry whose author wrote a key that the path it
 * travels did not read. One door reads every key on every path (ruled
 * 2026-10-14, Wave B), so each behaves as written. Each is played in the test
 * world through the path content really uses.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { playAttack, castSkill } from "../helpers/process.mjs";
import { runFieldEvents } from "../../module/engine/fields.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const at = (round, faction) => ({ tokens: true, combat: { round, started: true, system: { globalTurn: round * 3 }, actingFactionId: faction } });
const instances = (actor, defId) => [...actor.effects].filter((e) => e.system.defId === defId);

describe("an entry's own predicate gates it, on a rider aimed at the attacker", () => {
  // An entry predicate the attack path did not read until Landing (Wave B).
  it("gives Nemo no Aim and no extra NP DmUp out of the water (Great Ram Nautilus)", async () => {
    const N = "nemoCaptainNemo0", M = "masterOfNemo0000", H = "heraclesDefender";
    await withSubjects([
      { from: "nemo", id: N, state: { factionId: "A", masterId: M }, panel: { i: 5, j: 5 } },
      { from: "master-advanced", id: M, state: { factionId: "A" }, panel: { i: 5, j: 4 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      w.dice.every(50);
      const np = [...w.actor(N).items].find((i) => i.system.slug === "greatRamNautilus");
      await playAttack(w, { attacker: N, ability: np.id, target: H, react: { [H]: ["nothing", "declined"] } });
      expect(instances(w.actor(N), "aim")).toHaveLength(0);
      expect(instances(w.actor(N), "npDmUp").map((e) => e.system.magnitude)).toEqual([30]);
    }, at(6, "A"));
  });
});

describe("an effect's onApply runs whichever path lands it", () => {
  // Read from the code as a gap -- `def.onApply` is dispatched only by the
  // adapter -- and shown here not to be one: Shock's Agility is paid on the
  // rider path too. Kept, so the door cannot lose it.
  it("takes 3 current Agility when Scáthach's Þurs lands Shock", async () => {
    const S = "scathachCaster00", H = "heraclesDefender";
    await withSubjects([
      { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      w.dice.every(50);
      const before = w.actor(H).system.agility.value;
      const thurs = [...w.actor(S).items].find((i) => i.system.slug === "thurs" || /Þurs/.test(i.name));
      await playAttack(w, { attacker: S, ability: thurs.id, target: H, react: { [H]: ["nothing", "declined"] } });
      expect(instances(w.actor(H), "shock")).toHaveLength(1);
      expect(w.actor(H).system.agility.value).toBe(before - 3);
    }, at(6, "A"));
  });
});

describe("an entry's `uses` is its charges, on a Skill", () => {
  // A key this path did not read until Landing (Wave B).
  it("gives Van Gogh's Evade 2 charges from The Yellow House", async () => {
    const G = "vanGoghPainter00", H = "heraclesDefender";
    await withSubjects([
      { from: "van-gogh", id: G, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      w.dice.every(50);
      const np = [...w.actor(G).items].find((i) => i.system.slug === "theYellowHouse" || /Yellow House/.test(i.name));
      const out = await castSkill(w, { caster: G, ability: np.id, placement: { direction: "e" } });
      expect(out.ok).toBe(true);
      expect(instances(w.actor(G), "evade").map((e) => e.system.uses)).toEqual([2]);
    }, at(6, "A"));
  });
});

describe("a field's chance is one die", () => {
  // A key this path did not read until Landing (Wave B).
  it("rolls one d100 per chance for Contagion's Poison and Charm", async () => {
    const PR = "paleRiderRecord1", FOE = "foeMedeaRecord01";
    const fields = await fieldsOf([{ ability: "pale-rider-contagion", owner: PR, faction: "A", panels: squareAround({ i: 6, j: 6 }, 5) }]);
    await withSubjects([
      { from: "pale-rider", id: PR, state: { factionId: "A" }, panel: { i: 6, j: 6 } },
      { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 6, j: 7 } },
    ], async ({ board, world: w }) => {
      w.dice.every(1);
      // The scheduler writes what the field's events decide (`scheduler-hooks.mjs#run`).
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      await applyWorldIntents(await runFieldEvents("turnEnd", { board, activeFactionId: "B" }), "test:contagion");
      expect(w.rolls.filter((r) => r.formula === "1d100")).toHaveLength(2);
    }, { settings: { fields } });
  });
});

describe("a handler's ApplyEffect carries its NP magnitude", () => {
  // A key this path did not read until Landing (Wave B).
  it("gives Enigma's Def Dwn (MAG) +40% against Noble Phantasms", async () => {
    const H = "heraclesAttacker", M = "medeaDefender000";
    await withSubjects([
      { from: "heracles", id: H, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "enigma" }] },
      { from: "medea", id: M, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      w.dice.every(50);
      await playAttack(w, { attacker: H, target: M, react: { [M]: ["nothing", "declined"] } });
      expect(instances(w.actor(M), "defDwnMag").map((e) => [e.system.magnitude, e.system.npMagnitude])).toEqual([[60, 40]]);
    }, at(6, "A"));
  });
});

describe("a handler's `times` reads the event it answers", () => {
  // Gogh's *"remove 2 stages if a Crit, and one Atk Up per stage removed"*:
  // `times: "@stageDelta"` counted 1 for any string (Wave B).
  it("gives Van Gogh two Atk Up when a Crit takes two stages of Curse", async () => {
    const G = "vanGoghPainter00", H = "heraclesDefender";
    await withSubjects([
      { from: "van-gogh", id: G, state: { factionId: "A" }, panel: { i: 5, j: 5 },
        effects: [{ defId: "gogh" }, { defId: "curse", stage: 3 }] },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      // Every die on 1: the coin comes up for the Crit.
      w.dice.every(1);
      await playAttack(w, { attacker: G, target: H, react: { [H]: ["nothing", "declined"] } });
      expect(instances(w.actor(G), "curse").map((e) => e.system.stage)).toEqual([1]);
      expect(instances(w.actor(G), "atkUp").map((e) => e.system.magnitude)).toEqual([10, 10]);
    }, at(6, "A"));
  });
});
