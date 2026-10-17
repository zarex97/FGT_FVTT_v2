/**
 * Arjuna, audit #234, played in the arena: what only a Combat Process or a
 * use shows. The projection halves are in `arjuna-234.test.mjs`.
 * @see docs/superpowers/specs/2026-10-16-arjuna-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack, castSkill } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
// A whole match per test, and the first pays for the warm-up: 5s is not enough on a busy run.
vi.setConfig({ testTimeout: 30_000 });

const ARJ = "arjunaPandava001";
const MAS = "arjunaMaster0001";
const ALLY = "arjunaAlly000001";
const FOE = "arjunaFoe0000001";

const TICK = 30;
const MATCH = { tokens: true, combat: { round: 10, started: true, system: { globalTurn: TICK }, actingFactionId: "A" } };

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system.defId);
const effectOf = (w, id, defId) => [...w.actor(id).effects].find((e) => e.system.defId === defId);

// Asterios: no Magic Resistance, whose debuff resistance would make a chance a die.
const party = (extra = []) => [
  { from: "arjuna", id: ARJ, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
  { from: "master-advanced", id: MAS, panel: { i: 9, j: 1 }, state: { factionId: "A" } },
  { from: "asterios", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
  ...extra,
];

/* ========================================================================== */

describe("Roar of the Flame God and the Agni buff (RF.*; readings 8, 15)", () => {
  it("restores 3 Luck and lands Atk Up 40/30, NP DmUp 20 and Agni with three charges", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      // Luck's maximum is rolled at war setup; a test world rolls none.
      await w.actor(ARJ).update({ "system.luck.max": 20, "system.luck.value": 1 });
      const out = await castSkill(w, { caster: ARJ, ability: abilityOf(w, ARJ, "arjuna-roar-of-the-flame-god").id });
      expect(out.ok).toBe(true);
      expect(w.actor(ARJ).system.luck.value).toBe(4);
      expect(effectOf(w, ARJ, "atkUp").system).toMatchObject({ magnitude: 40, npMagnitude: 30 });
      expect(effectOf(w, ARJ, "npDmUp").system.magnitude).toBe(20);
      expect(effectOf(w, ARJ, "agni").system.uses).toBe(3);
    }, MATCH);
  });

  const agniOn = () => party().map((s) => (s.id === ARJ ? { ...s, effects: [{ defId: "agni", uses: 3, expiry: TICK + 3 }] } : s));

  it("a Normal Attack that hits spends a charge and may Burn", async () => {
    await withSubjects(agniOn(), async ({ world: w }) => {
      w.dice.every(1);
      await playAttack(w, { attacker: ARJ, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(effectOf(w, ARJ, "agni").system.uses).toBe(2);
      expect(held(w, FOE)).toContain("burn");
    }, MATCH);
  });

  it("a Mana Burst swing spends none", async () => {
    await withSubjects(agniOn(), async ({ world: w }) => {
      w.dice.every(100);
      const mb = abilityOf(w, ARJ, "arjuna-mana-burst-flames");
      const before = w.actor(FOE).system.health.value;
      await playAttack(w, { attacker: ARJ, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      // It landed: a swing that dealt nothing would spend nothing either.
      expect(w.actor(FOE).system.health.value).toBeLessThan(before);
      expect(effectOf(w, ARJ, "agni").system.uses).toBe(3);
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Agni Gandiva cools Mana Burst (AG.mb; AG.mbcd)", () => {
  it("after it lands, Mana Burst (Flames) is on its Cooldown", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      w.dice.every(100);
      const ag = abilityOf(w, ARJ, "arjuna-agni-gandiva");
      await playAttack(w, { attacker: ARJ, ability: ag.id, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(abilityOf(w, ARJ, "arjuna-mana-burst-flames").system.cooldown.remaining).toBeGreaterThan(0);
      expect(held(w, FOE)).toContain("burn");
    }, MATCH);
  });
});

/* ========================================================================== */

describe("Pashupata (PA.*; readings 11, 12, 13)", () => {
  const scene = () => party([
    { from: "asterios", id: ALLY, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
  ]);

  it("hits his ally and the enemy in the 5x5, never him; Def Dwn 40 lands on each", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.every(100);
      const pa = abilityOf(w, ARJ, "arjuna-pashupata");
      const { declared } = await playAttack(w, {
        attacker: ARJ, ability: pa.id, placement: { panel: { i: 5, j: 6 } },
        react: { [FOE]: ["nothing", "declined", "declined"], [ALLY]: ["nothing", "declined", "declined"] },
      });
      expect((declared.processes ?? []).length).toBe(2);
      expect(effectOf(w, FOE, "defDwn").system.magnitude).toBe(40);
      expect(effectOf(w, ALLY, "defDwn").system.magnitude).toBe(40);
      expect(held(w, ARJ)).not.toContain("defDwn");
      expect(w.actor(FOE).system.defeated).toBeFalsy();
    }, MATCH);
  });

  it("a low die lands Death", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      w.dice.every(1);
      const pa = abilityOf(w, ARJ, "arjuna-pashupata");
      await playAttack(w, {
        attacker: ARJ, ability: pa.id, placement: { panel: { i: 5, j: 7 } },
        react: { [FOE]: ["nothing", "declined", "declined"] },
      });
      expect(w.actor(FOE).system.defeated).toBe(true);
    }, MATCH);
  });
});

/* ========================================================================== */

describe("The Awarded Hero (AH.*; readings 6, 7)", () => {
  it("cuts both NPs by 1◈+⅓◈ and lands Regen 15, Area CritUp (Awarded) and NP Regen 1", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const pa = abilityOf(w, ARJ, "arjuna-pashupata");
      await pa.update({ "system.cooldown.remaining": 10 });
      const out = await castSkill(w, { caster: ARJ, ability: abilityOf(w, ARJ, "arjuna-awarded-hero").id });
      expect(out.ok).toBe(true);
      expect(abilityOf(w, ARJ, "arjuna-pashupata").system.cooldown.remaining).toBe(6);
      expect(effectOf(w, ARJ, "regen").system.magnitude).toBe(15);
      expect(held(w, ARJ)).toContain("areaCritUpAwarded");
      expect(effectOf(w, ARJ, "npRegen").system.magnitude).toBe(1);
    }, MATCH);
  });
});
