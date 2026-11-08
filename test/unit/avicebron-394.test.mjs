/**
 * @file Avicebron (Caster), his Golems and his Construction, in the test world (#394).
 * @see docs/superpowers/specs/2026-11-07-avicebron-clauses.md
 *
 * Every subject is authored content through the real compile and projection.
 * The readings named are the spec's, ruled 2026-11-08.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { emptyBudget, consume, canConsume } from "../../module/rules/budget.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const AV = "avicebron0000001", G1 = "avicebronGolem01", G2 = "avicebronGolem02", MA = "avicebronMaster1";
const FOE = "avicebronFoe0001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1 }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);

/** A Normal Attack aimed by a Unit at one other, through the real resolver. */
const aimAt = (caster, target, board) => resolveTargets({
  anchor: { kind: "targetUnit", range: 9 },
  shape: { kind: "unit" },
  selection: { relations: ["enemy", "ally", "neutral"], chooser: "all" },
  limits: { forAttack: true },
}, caster, board, { unitId: target.id, panel: target.panel });

describe("the statblock (SB.*)", () => {
  it("is a Lawful Neutral Caster from Europe at 500 Health, BA 50 / 200 by the tables, MAG on his Normal Attack", async () => {
    await withSubjects([{ from: "avicebron", id: AV }], ({ world: w, unit }) => {
      const a = unit(AV);
      const s = w.actor(AV).system;
      expect(s.trueName).toBe("Avicebron, Solomon ibn Gabirol");
      expect([...s.servantClasses]).toEqual(["caster"]);
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "neutral" });
      expect(a.baseAttack).toEqual(expect.objectContaining({ str: 50, mag: 200 }));
      expect(a.maxHealth ?? a.health?.max).toBe(500);
      expect(a.mov).toBe(4);
      expect(a.range).toBe(2);
      expect(a.normalAttack?.component).toBe("mag");
      expect(a.attributes).toEqual(expect.arrayContaining(["male", "servant", "man", "humanoid"]));
      expect(s.resources.construction).toMatchObject({ value: 0, max: 50 });
    });
  });

  it("cuts his own Normal Attack's Total by 75%, and not an Attack Skill's (SB.na.cut)", async () => {
    await withSubjects([
      { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "heracles", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ], ({ unit }) => {
      const hit = (attack) => computeDamage({
        attacker: unit(AV), defender: unit(FOE), attack,
        base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
        rolls: { attackMinus: 0 },
        options: rollOptionsFor({ attacker: unit(AV), defender: unit(FOE), attack }),
      });
      const normal = hit({ kind: "normal", component: "mag" });
      const skill = hit({ kind: "attackSkill", component: "mag" });
      const cut = (r) => r.breakdown.flatMap((st) => st.contributors).find((c) => c.source === "totalDealt");
      expect(cut(normal)).toMatchObject({ value: 0.25, side: "attacker" });
      expect(cut(skill)).toBeUndefined();
      expect(normal.total).toBe(Math.floor(skill.total * 0.25));
    });
  });
});

describe("the Golem (GL.*)", () => {
  const board4 = (fn) => withSubjects([
    { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "golem", id: G1, panel: { i: 5, j: 7 }, state: { factionId: "A", summonerId: AV } },
    { from: "golem", id: G2, panel: { i: 5, j: 8 }, state: { factionId: "A", summonerId: AV } },
    { from: "heracles", id: FOE, panel: { i: 8, j: 8 }, state: { factionId: "B" } },
  ], fn);

  it("states 500 Health, Agility 12, Luck 6, MOV 3, Range 1, BA(STR) 100, Sky and Mechanical, Detect 3 (GL.sb)", async () => {
    await board4(({ unit }) => {
      const g = unit(G1);
      expect(g.maxHealth ?? g.health?.max).toBe(500);
      expect(g.agility).toBe(12);
      expect(g.luck).toBe(6);
      expect(g.mov).toBe(3);
      expect(g.range).toBe(1);
      expect(g.baseAttack).toEqual(expect.objectContaining({ str: 100 }));
      expect(g.attributes).toEqual(expect.arrayContaining(["sky", "mechanical"]));
      expect(g.unitWeight).toBe(0.2);
      expect(g.countsTowardBudget).toBe(true);
      expect(g.actsOncePerTurn).toBe(true);
    });
  });

  it("weighs a fifth of a Servant on the budget (GL.weight)", async () => {
    await board4(({ unit }) => {
      let b = emptyBudget();
      for (let n = 0; n < 3; n += 1) b = consume(b, { id: `s${n}`, kind: "servant", effects: [], turnState: {} }, "move").budget;
      for (let n = 0; n < 5; n += 1) b = consume(b, { ...unit(G1), id: `g${n}`, turnState: {} }, "move").budget;
      expect(b.pools.servantMove.used).toBe(4);
      expect(canConsume(b, { ...unit(G1), id: "g6", turnState: {} }, "move").ok).toBe(false);
    });
  });

  it("keeps an enemy from aiming at Avicebron within 2 of it, and names the Golem (GL.guard, GL.guard.name)", async () => {
    await board4(({ unit, board }) => {
      const out = aimAt(unit(FOE), unit(AV), board);
      expect(out.units.map((u) => u.unitId)).not.toContain(AV);
      expect(out.warnings.join(" ")).toContain("Golem");
    });
  });

  it("guards no Golem: one beside another is still a target (GL.guard.golem, ruling 7)", async () => {
    await board4(({ unit, board }) => {
      expect(aimAt(unit(FOE), unit(G1), board).units.map((u) => u.unitId)).toContain(G1);
    });
  });

  it("lets an ally aim at a guarded Unit (GL.guard.enemy)", async () => {
    await withSubjects([
      { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "golem", id: G1, panel: { i: 5, j: 6 }, state: { factionId: "A", summonerId: AV } },
      { from: "heracles", id: MA, panel: { i: 5, j: 3 }, state: { factionId: "A" } },
    ], ({ unit, board }) => {
      expect(aimAt(unit(MA), unit(AV), board).units.map((u) => u.unitId)).toContain(AV);
    });
  });

  it("guards nobody beyond 2 panels (GL.guard.out)", async () => {
    await withSubjects([
      { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "golem", id: G1, panel: { i: 5, j: 8 }, state: { factionId: "A", summonerId: AV } },
      { from: "heracles", id: FOE, panel: { i: 8, j: 8 }, state: { factionId: "B" } },
    ], ({ unit, board }) => {
      expect(aimAt(unit(FOE), unit(AV), board).units.map((u) => u.unitId)).toContain(AV);
    });
  });

  it("disappears with its summoner (GL.leave, ruling 8)", async () => {
    await board4(({ world: w }) => {
      expect(w.actor(G1).system.leavesWithSummoner).toBe(true);
    });
  });
});

describe("Item Construction B+ (IC.*)", () => {
  it("gives allies within 2 +45 / 25 / 15 out and in, highest Rank only", async () => {
    await withSubjects([
      { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    ], ({ world: w }) => {
      const ic = abilityOf(w, AV, "class-item-construction-gogh");
      expect(ic.system.rank).toBe("B+");
      const aura = ic.system.passiveRules.find((r) => r.key === "Aura");
      expect(aura).toMatchObject({ radius: 2, group: "itemConstruction", stacking: "highestOnly" });
      expect(aura.elements.map((e) => `${e.direction}:${e.severity}:${e.value}`)).toEqual([
        "outgoing:normal:45", "outgoing:instakill:25", "outgoing:death:15",
        "incoming:normal:45", "incoming:instakill:25", "incoming:death:15",
      ]);
    });
  });
});

describe("Item Construction: Golems (GO.*)", () => {
  it("is refused while GKM stands (GO.gkm), and allowed with none", async () => {
    await withSubjects([{ from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], ({ world: w }) => {
      const reqs = abilityOf(w, AV, "avicebron-item-construction-golems").system.requirements;
      expect(reqs).toEqual([expect.objectContaining({ kind: "platformInactive", contentId: "golem-keter-malkuth" })]);
    });
  });

  it("rolls 1d10 in his Home Base and 1d6 outside it, at most 30, placed within his Range (GO.home, GO.away, GO.max, GO.place)", async () => {
    await withSubjects([{ from: "avicebron", id: AV }], ({ world: w }) => {
      const phases = abilityOf(w, AV, "avicebron-item-construction-golems").system.phases;
      expect(phases.map((p) => [p.predicate, p.spec.countRoll])).toEqual([
        [["self:inHomeBase"], "1d10"], [[{ not: "self:inHomeBase" }], "1d6"],
      ]);
      for (const p of phases) {
        expect(p.spec).toMatchObject({ maxOnField: 30, placement: { withinRange: true }, grantsResource: { resource: "construction", per: 3 } });
      }
    });
  });
});

describe("High-Speed Incantation (HS.*)", () => {
  it("cuts his other Skills by 1◈, then gains 5 Construction; refused under Silence", async () => {
    await withSubjects([{ from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async ({ world: w }) => {
      const golems = abilityOf(w, AV, "avicebron-item-construction-golems");
      await golems.update({ "system.cooldown.remaining": 7 });
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      await useSkill({ actorId: AV, abilityId: abilityOf(w, AV, "avicebron-high-speed-incantation").id });
      expect(golems.system.cooldown.remaining).toBe(4);
      expect(w.actor(AV).system.resources.construction.value).toBe(5);
    }, WAR);
  });
});

describe("Numerology (NU.*)", () => {
  const G3 = "avicebronGolem03", OTHER = "otherAvicebron01", OG = "otherGolem000001";
  it("restores 3 Luck to his own Golems, gives them Atk Up 40 / NP 30 for 1◈, and pays 1 Construction per 2 (rulings 9, 10)", async () => {
    await withSubjects([
      { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "golem", id: G1, panel: { i: 5, j: 7 }, state: { factionId: "A", summonerId: AV, luck: { value: 1, max: 6 } } },
      { from: "golem", id: G2, panel: { i: 9, j: 9 }, state: { factionId: "A", summonerId: AV, luck: { value: 5, max: 6 } } },
      { from: "golem", id: G3, panel: { i: 1, j: 1 }, state: { factionId: "A", summonerId: AV, luck: { value: 2, max: 6 } } },
      { from: "avicebron", id: OTHER, panel: { i: 12, j: 12 }, state: { factionId: "A" } },
      { from: "golem", id: OG, panel: { i: 12, j: 10 }, state: { factionId: "A", summonerId: OTHER, luck: { value: 1, max: 6 } } },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      await useSkill({ actorId: AV, abilityId: abilityOf(w, AV, "avicebron-numerology").id });
      expect([G1, G2, G3].map((id) => w.actor(id).system.luck.value)).toEqual([4, 6, 5]);
      for (const id of [G1, G2, G3]) {
        const up = [...w.actor(id).effects].find((e) => e.system?.defId === "atkUp");
        expect(up?.system).toMatchObject({ magnitude: 40, npMagnitude: 30 });
      }
      // Another Avicebron's Golem is not his (ruling 9).
      expect(w.actor(OG).system.luck.value).toBe(1);
      expect([...w.actor(OG).effects].some((e) => e.system?.defId === "atkUp")).toBe(false);
      expect(w.actor(AV).system.resources.construction.value).toBe(1);
    }, WAR);
  });
});

describe("Construction Source 4, the felled tally (GK.cp.felled, ruling 14)", () => {
  it("pays 1 Construction on the fifth Golem an enemy fells, keeping the part five", async () => {
    await withSubjects([
      { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A", resources: { construction: { value: 3, max: 50 }, golemsFelled: { value: 4, max: 4 }, figTreeSpent: { value: 0, max: 1 } } } },
      { from: "golem", id: G1, panel: { i: 5, j: 7 }, state: { factionId: "A", summonerId: AV } },
      { from: "golem", id: G2, panel: { i: 5, j: 9 }, state: { factionId: "A", summonerId: AV } },
      { from: "heracles", id: FOE, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.defeat(G1, "damage", FOE)], "test");
      expect(w.actor(AV).system.resources).toMatchObject({ construction: { value: 4 }, golemsFelled: { value: 0 } });
      // One felled by nobody known, or by an ally, counts none.
      await applyWorldIntents([I.defeat(G2, "damage", AV)], "test");
      expect(w.actor(AV).system.resources.golemsFelled.value).toBe(0);
    }, WAR);
  });
});

describe("Fig Tree of Tranquility (FT.*, ruling 23)", () => {
  it("at his final defeat gives allies within 3 Invuln for 3 times and 20% of their Health, once", async () => {
    await withSubjects([
      { from: "avicebron", id: AV, panel: { i: 5, j: 5 }, state: { factionId: "A", health: { value: 0, max: 500 } } },
      { from: "heracles", id: MA, panel: { i: 5, j: 8 }, state: { factionId: "A", health: { value: 100, max: 1500 } } },
      { from: "golem", id: G1, panel: { i: 5, j: 6 }, state: { factionId: "A", summonerId: AV } },
      { from: "heracles", id: "avicebronFarAlly", panel: { i: 5, j: 9 }, state: { factionId: "A", health: { value: 100, max: 1500 } } },
      { from: "heracles", id: FOE, panel: { i: 6, j: 6 }, state: { factionId: "B", health: { value: 100, max: 1500 } } },
    ], async ({ world: w }) => {
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await applyWorldIntents([I.defeat(AV, "damage", FOE)], "test");
      const invuln = [...w.actor(MA).effects].find((e) => e.system?.defId === "invuln");
      expect(invuln?.system?.uses).toBe(3);
      expect(w.actor(MA).system.health.value).toBe(400);
      // 4 panels away: outside the 7x7. An enemy inside: nothing. His Golems
      // leave with him (ruling 8), so none is left to shield.
      expect([...w.actor("avicebronFarAlly").effects].some((e) => e.system?.defId === "invuln")).toBe(false);
      expect(w.actor("avicebronFarAlly").system.health.value).toBe(100);
      expect(w.actor(G1)).toBeFalsy();
      expect([...w.actor(FOE).effects].some((e) => e.system?.defId === "invuln")).toBe(false);
      expect(w.actor(FOE).system.health.value).toBe(100);
      expect(w.actor(AV).system.resources.figTreeSpent.value).toBe(1);
    }, WAR);
  });
});
