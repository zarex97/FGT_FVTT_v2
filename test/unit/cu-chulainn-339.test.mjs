/**
 * Cú Chulainn (Lancer), audit #339: his sheet built through the real
 * projection, and the pieces he brought: a magnitude from missing Health, a
 * second pick after a die, an automatic Evade asked of the attack, a Luck Check
 * the War may remove, an effect that ends with its inflicter, and Disengage.
 * Ath nGabla is not built (2026-10-26).
 * @see docs/superpowers/specs/2026-10-25-cu-chulainn-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";
import { countOf, countedValue } from "../../module/rules/count.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const CU = "cuChulainn000001";
const FOE = "cuFoe00000000001";
const FOE2 = "cuFoe00000000002";
// Expert: the War Rule's default, Intermediate, removes Luck Checks (Ch. 29),
// and Barbed Spear's would never roll. Named where a test relies on it.
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const ON_B = { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } };
const INTERMEDIATE = { ...WAR, combat: { ...WAR.combat, system: { ...WAR.combat.system, difficulty: "intermediate" } } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);
const effectOf = (w, id, defId) => [...w.actor(id).effects].find((e) => e.system?.defId === defId);

/* ========================================================================== */

describe("the sheet, projected (ST.*)", () => {
  it("Lancer, Lawful Neutral, Ireland; B C A C E; 1000, MOV 7, Range 2; BA 125/150; Melee; 2◈", async () => {
    await withSubjects([{ from: "cu-chulainn", id: CU }], ({ unit, world: w }) => {
      const c = unit(CU);
      expect(c.servantClasses).toEqual(["lancer"]);
      expect(c.alignment).toMatchObject({ order: "lawful", morality: "neutral" });
      expect(c.region).toEqual(["ireland"]);
      expect(c.attributes).toEqual(expect.arrayContaining(["male", "servant", "sky", "humanoid"]));
      expect(Object.fromEntries(Object.entries(c.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "B", end: "C", agi: "A", mag: "C", luc: "E" });
      expect(c.maxHealth ?? c.health?.max).toBe(1000);
      expect(c.mov).toBe(7);
      expect(c.range).toBe(2);
      expect(c.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 150 }));
      expect(c.normalAttack).toMatchObject({ component: "str", delivery: "melee" });
      expect(w.actor(CU).system.sustainability).toBe("2◈");
    });
  });

  it("holds the templates at his Ranks, Disengage at C, and no Ath nGabla", async () => {
    await withSubjects([{ from: "cu-chulainn", id: CU }], ({ world: w }) => {
      const ids = w.actor(CU).items.map((i) => i.system.contentId);
      expect(ids.sort()).toEqual([
        "class-battle-continuation", "class-magic-resistance", "cu-ansuz", "cu-gae-bolg-barbed-spear",
        "cu-gae-bolg-soaring-spear", "cu-protection-from-arrows", "cu-rune-magic", "cu-shoal-of-four-branches",
        "disengage", "divinity",
      ]);
      expect(abilityOf(w, CU, "class-magic-resistance").system.rank).toBe("C");
      expect(abilityOf(w, CU, "divinity").system.rank).toBe("B");
      expect(abilityOf(w, CU, "class-battle-continuation").system.rank).toBe("A");
      const de = abilityOf(w, CU, "disengage").system;
      expect(de.rank).toBe("C");
      expect(de.cooldown.max).toBe("2◈");
      expect(de.withdrawsWhenDefending).toBe(true);
      expect(de.phases.map((p) => [p.kind, p.panels ?? p.percentOfMax ?? p.pick])).toEqual([["move", 3], ["heal", 15], ["removeEffect", 1]]);
      expect(de.description).toMatch(/Move 3 panels/);
    });
  });
});

/* ========================================================================== */

describe("the healthMissing Count (SF.atk.x; ruling 1)", () => {
  const at = (value, max = 1000) => ({ refs: { self: { health: { value, max } } } });
  it("is the whole percent missing: 457/1000 is 54, full is 0, empty is 100", () => {
    expect(countOf({ of: "healthMissing" }, at(457))).toBe(54);
    expect(countOf({ of: "healthMissing" }, at(1000))).toBe(0);
    expect(countOf({ of: "healthMissing" }, at(0))).toBe(100);
    expect(countOf({ of: "healthMissing" }, {})).toBe(0);
  });
  it("sized in whole steps of 10 over a base of 20: the sheet's 457/1000 gives 20+50", () => {
    const spec = { count: { of: "healthMissing" }, each: 10, base: 20, per: 10 };
    expect(countedValue(spec, at(457))).toBe(70);
    expect(countedValue(spec, at(1000))).toBe(20);
    expect(countedValue(spec, at(901))).toBe(20);
    expect(countedValue(spec, at(900))).toBe(30);
  });
});

describe("Shoal of Four Branches (SF.*; rulings 1, 31)", () => {
  it("Guts 25 for 1◈+⅔◈; Atk Up (Redbranch) 70, 35 on an NP, at 457/1000, kept when he heals", async () => {
    await withSubjects([{ from: "cu-chulainn", id: CU, state: { factionId: "A" } }], async ({ world: w }) => {
      await w.actor(CU).update({ "system.health.value": 457 });
      const out = await castSkill(w, { caster: CU, ability: abilityOf(w, CU, "cu-shoal-of-four-branches").id });
      expect(out.ok).toBe(true);
      expect(effectOf(w, CU, "guts").system.magnitude).toBe(25);
      const red = effectOf(w, CU, "atkUpRedbranch");
      expect(red.system.magnitude).toBe(70);
      expect(red.system.npMagnitude).toBe(35);
      // Read once at use: healing does not lower it.
      await w.actor(CU).update({ "system.health.value": 1000 });
      expect(effectOf(w, CU, "atkUpRedbranch").system.magnitude).toBe(70);
    }, WAR);
  });
});

/* ========================================================================== */

describe("Rune Magic (RM.*; rulings 4, 5)", () => {
  it("rolls a d4, lands the row on him, then lands one more row of his pick", async () => {
    await withSubjects([{ from: "cu-chulainn", id: CU, state: { factionId: "A" } }], async ({ world: w }) => {
      w.dice.set("d4", 2);
      w.answer({ title: "Rune Magic", pick: ["4"] });
      const out = await castSkill(w, { caster: CU, ability: abilityOf(w, CU, "cu-rune-magic").id });
      expect(out.ok).toBe(true);
      const offered = w.asked.find((a) => a.title === "Rune Magic");
      // The die's own row is not offered again.
      expect(offered.options.sort()).toEqual(["1", "3", "4"]);
      expect(effectOf(w, CU, "defUp").system.magnitude).toBe(25);
      expect(effectOf(w, CU, "critUp").system.magnitude).toBe(20);
    }, WAR);
  });

  it("the second pick may be declined", async () => {
    await withSubjects([{ from: "cu-chulainn", id: CU, state: { factionId: "A" } }], async ({ world: w }) => {
      w.dice.set("d4", 3);
      w.answer({ title: "Rune Magic", decline: true });
      await castSkill(w, { caster: CU, ability: abilityOf(w, CU, "cu-rune-magic").id });
      expect(held(w, CU).filter((d) => ["tiwaz", "defUp", "atkUp", "critUp"].includes(d))).toEqual(["atkUp"]);
    }, WAR);
  });

  it("Tiwaz is a whole grade: Magic Resistance C reads as B while it holds", async () => {
    await withSubjects([{ from: "cu-chulainn", id: CU, state: { factionId: "A" }, panel: { i: 6, j: 6 } }], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const mr = () => {
        const { rank, percent } = currentBoard().units.find((u) => u.id === CU).magicResistance;
        return { rank: String(rank), percent };
      };
      expect(mr()).toMatchObject({ rank: "C", percent: 30 });
      w.dice.set("d4", 1);
      w.answer({ title: "Rune Magic", decline: true });
      await castSkill(w, { caster: CU, ability: abilityOf(w, CU, "cu-rune-magic").id });
      expect(held(w, CU)).toContain("tiwaz");
      // The Magic Resistance B block under the Skill: B negated, otherwise 40%.
      expect(mr()).toMatchObject({ rank: "B", percent: 40 });
    }, WAR);
  });
});

/* ========================================================================== */

describe("Protection from Arrows (PA.*; rulings 9, 10, 25, 26)", () => {
  // Cú faces north (-i): EMIYA three panels north is in his Front, three south is Behind.
  const scene = (foePanel) => [
    { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" } },
    { from: "emiya", id: FOE, panel: foePanel, state: { factionId: "B" } },
  ];
  const attack = async (w, { disengage = true } = {}) => {
    w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
    // Disengage is offered at the start of every Combat Phase he is Attacked in.
    if (disengage) w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
    return playAttack(w, { attacker: FOE, target: CU, react: { [CU]: ["evade", "declined", "accept", "declined", "declined"], [FOE]: ["declined", "declined"] } });
  };

  it("a Ranged Normal Attack from his Front: the Evade he picks succeeds with no roll", async () => {
    await withSubjects(scene({ i: 3, j: 6 }), async ({ world: w }) => {
      const before = w.actor(CU).system.health.value;
      const { processes } = await attack(w);
      expect(w.actor(CU).system.health.value).toBe(before);
      const evade = processes[0].history.find((h) => h.state === "evadeRoll");
      expect(evade?.event).toBe("success");
      expect(evade.detail).toMatchObject({ automatic: true, modifiers: [{ source: "Protection from Arrows" }] });
    }, ON_B);
  });

  it("from Behind: no automatic Evade, the roll takes -2", async () => {
    await withSubjects(scene({ i: 9, j: 6 }), async ({ world: w }) => {
      w.dice.set("d20", 11);
      const { processes } = await attack(w);
      const evade = processes[0].history.find((h) => h.state === "evadeRoll");
      expect(evade.detail.automatic).toBe(false);
      expect(evade.detail.modifiers).toEqual(expect.arrayContaining([
        { source: "attacked from behind", value: 2 }, { source: "Protection from Arrows", value: -2 },
      ]));
    }, ON_B);
  });

  it("not against a Melee Attack: the Evade is rolled", async () => {
    await withSubjects([
      { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" } },
      // Her Normal Attack states Melee.
      { from: "lanceturia", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d20", 20);
      const { processes } = await playAttack(w, { attacker: FOE, target: CU, react: { [CU]: ["evade", "declined", "accept", "declined", "declined"], [FOE]: ["declined", "declined"] } });
      const evade = processes[0].history.find((h) => h.state === "evadeRoll");
      expect(evade.detail.automatic).toBe(false);
      expect(evade.event).toBe("fail");
    }, ON_B);
  });

  it("not against an area Attack, nor with no attack to ask", async () => {
    await withSubjects(scene({ i: 3, j: 6 }), async ({ unit }) => {
      const { checkPlan } = await import("../../module/rules/checks.mjs");
      const ranged = new Set(["attack:delivery:ranged", "attack:cone:front"]);
      expect(checkPlan(unit(CU), "evade", { options: ranged }).autoSucceed?.source).toBe("Protection from Arrows");
      expect(checkPlan(unit(CU), "evade", { options: new Set([...ranged, "attack:isAoE"]) }).autoSucceed).toBeNull();
      expect(checkPlan(unit(CU), "evade", { options: new Set(["attack:delivery:ranged", "attack:cone:left"]) }).autoSucceed).not.toBeNull();
      expect(checkPlan(unit(CU), "evade").autoSucceed).toBeNull();
    }, ON_B);
  });

  it("no effect under Skill Seal", async () => {
    await withSubjects([
      { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" }, effects: [{ defId: "skillSeal" }] },
      { from: "emiya", id: FOE, panel: { i: 3, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.dice.set("d20", 20);
      // Skill Seal holds Disengage too: nothing is offered at the Phase's start.
      const { processes } = await attack(w, { disengage: false });
      expect(processes[0].history.find((h) => h.state === "evadeRoll").detail.automatic).toBe(false);
    }, ON_B);
  });
});

/* ========================================================================== */

describe("Gáe Bolg: Barbed Spear (GB.*; rulings 11, 12, 27-30)", () => {
  const scene = (foeEffects = []) => [
    { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" } },
    { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" }, effects: foeEffects },
  ];
  const spear = async (w, luck = 10, { prevention = luck > 0 } = {}) => {
    await w.actor(FOE).update({ "system.luck.max": 10, "system.luck.value": luck });
    // The Prevention Luck Check is offered against Curse (Bolg) where Luck
    // Checks apply and the DU has Luck (Ch. 13); declined here.
    if (prevention) w.answer({ title: "FGT.Prompt.luckCheck", kind: "confirm", decline: true });
    return playAttack(w, {
      attacker: CU, ability: abilityOf(w, CU, "cu-gae-bolg-barbed-spear").id, target: FOE,
      react: { [FOE]: ["nothing", "declined", "declined"], [CU]: ["declined", "declined"] },
    });
  };

  it("a failed Luck Check lands Instakill and Curse (Bolg), and no damage step", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d20", 20);
      await spear(w, 10, { prevention: false });
      expect(w.actor(FOE).system.health.value).toBe(0);
      const curse = effectOf(w, FOE, "curseBolg");
      expect(curse?.system.sourceUnitId).toBe(CU);
    }, WAR);
  });

  it("a passed one: 3.5x damage and Curse (Bolg); the Luck is spent", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d20", 1);
      const before = w.actor(FOE).system.health.value;
      await spear(w);
      expect(w.actor(FOE).system.health.value).toBeLessThan(before);
      expect(w.actor(FOE).system.health.value).toBeGreaterThan(0);
      expect(held(w, FOE)).toContain("curseBolg");
      expect(w.actor(FOE).system.luck.value).toBe(9);
    }, WAR);
  });

  it("on Intermediate the NP's own Luck Check still rolls; only Prevention is removed (ruling 34)", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d20", 20);
      // No Prevention question is scripted: Intermediate removes it.
      await spear(w, 10, { prevention: false });
      expect(w.actor(FOE).system.health.value).toBe(0);
      expect(w.actor(FOE).system.luck.value).toBe(9);
      expect(held(w, FOE)).toContain("curseBolg");
    }, INTERMEDIATE);
  });

  it("no Prevention is offered to a DU its Instakill emptied, nor one its check left without Luck (ruling 36)", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      // One Luck, spent by the check; then Instakill. Nothing scripted for
      // Prevention: the world fails on a question nobody answered.
      w.dice.set("d20", 20);
      await spear(w, 1, { prevention: false });
      expect(w.actor(FOE).system.health.value).toBe(0);
      expect(w.actor(FOE).system.luck.value).toBe(0);
      expect(w.asked.map((a) => a.title)).not.toContain("FGT.Prompt.luckCheck");
    }, WAR);
  });

  it("a DU with no Luck fails, and its Luck stays at 0", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d20", 1);
      await spear(w, 0);
      expect(w.actor(FOE).system.health.value).toBe(0);
      expect(w.actor(FOE).system.luck.value).toBe(0);
    }, WAR);
  });

  it("Anti-Purge takes the Instakill chance to 0: the failed check deals the damage instead", async () => {
    await withSubjects(scene([{ defId: "antiPurge" }]), async ({ world: w }) => {
      w.dice.set("d20", 20);
      await spear(w);
      expect(w.actor(FOE).system.health.value).toBeGreaterThan(0);
      expect(held(w, FOE)).toContain("curseBolg");
    }, WAR);
  });

  it("cannot be used while Soaring Spear is on Cooldown, and the other way round (GB.excl, GS.excl)", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      const { pressGate } = await import("../../module/engine/press-gate.mjs");
      const barbed = abilityOf(w, CU, "cu-gae-bolg-barbed-spear");
      const soaring = abilityOf(w, CU, "cu-gae-bolg-soaring-spear");
      expect(pressGate(w.actor(CU), barbed, { selfOnly: true, billsBudget: false }).ok).toBe(true);
      await soaring.update({ "system.cooldown.remaining": 5 });
      expect(pressGate(w.actor(CU), barbed, { selfOnly: true, billsBudget: false }).ok).toBe(false);
      await soaring.update({ "system.cooldown.remaining": 0 });
      await barbed.update({ "system.cooldown.remaining": 5 });
      expect(pressGate(w.actor(CU), soaring, { selfOnly: true, billsBudget: false }).ok).toBe(false);
    }, WAR);
  });
});

/* ========================================================================== */

describe("Curse (Bolg) ends with him (GB.cb.end; rulings 14, 23, 37)", () => {
  it("off every holder once he stays down, one with no body on the board too, with one line", async () => {
    await withSubjects([
      { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE, panel: { i: 1, j: 1 }, state: { factionId: "B" }, effects: [{ defId: "curseBolg", sourceUnitId: CU }] },
      // Defeated earlier, its body gone: no token, so no board Unit.
      { from: "medusa", id: FOE2, state: { factionId: "B" }, effects: [{ defId: "curseBolg", sourceUnitId: CU }] },
    ], async ({ world: w }) => {
      const { resolveDefeat } = await import("../../module/engine/scheduler.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { applyIntents } = await import("../../module/engine/applier.mjs");
      const { worldIO } = await import("../../module/engine/io.mjs");
      expect(currentBoard().units.some((u) => u.id === FOE2)).toBe(false);
      // No revival held: Battle Continuation's clock is running.
      await abilityOf(w, CU, "class-battle-continuation").update({ "system.cooldown.remaining": 9 });
      const cu = { ...currentBoard().units.find((u) => u.id === CU), health: 0 };
      const intents = resolveDefeat(cu, { board: currentBoard(), tick: 18 });
      expect(intents.some((i) => i.t === "defeat" && i.unitId === CU)).toBe(true);
      await applyIntents(intents, { io: worldIO(), canWrite: () => true, isGM: true, source: "test:cuDown" });
      expect(held(w, FOE)).not.toContain("curseBolg");
      expect(held(w, FOE2)).not.toContain("curseBolg");
      const said = w.messages.contents.map((m) => m.content ?? "").join(" ");
      expect(said).toMatch(/EffectsEnded|stays down, and Curse \(Bolg\) comes off/);
    }, WAR);
  });
});

describe("Curse (Bolg) holds through a revival (GB.cb.end; ruling 14)", () => {
  it("a defeat Guts answers removes nothing", async () => {
    await withSubjects([
      { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" }, effects: [{ defId: "guts", magnitude: 25 }] },
      { from: "medusa", id: FOE, panel: { i: 1, j: 1 }, state: { factionId: "B" }, effects: [{ defId: "curseBolg", sourceUnitId: CU }] },
    ], async () => {
      const { resolveDefeat } = await import("../../module/engine/scheduler.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const cu = { ...board.units.find((u) => u.id === CU), health: 0 };
      const intents = resolveDefeat(cu, { board, tick: 18 });
      expect(intents.some((i) => i.t === "heal" && i.unitId === CU)).toBe(true);
      // No defeat is written, so nothing it inflicted ends.
      expect(intents.some((i) => i.t === "defeat")).toBe(false);
    }, WAR);
  });

  it("deals Curse's 25 at every Turn's end, as Curse, never staged (ruling 35)", async () => {
    const { parse } = await import("yaml");
    const { readFileSync } = await import("node:fs");
    const def = parse(readFileSync("packs/_source/effects/curse-bolg.yml", "utf8"));
    expect(def).toMatchObject({ polarity: "debuff", stacking: "noneNoRefresh", unremovable: true, endsWithInflicter: true });
    expect(def.periodic).toMatchObject({ when: "turnEnd", amount: 25 });
    expect(def.periodic.scaling).toBeUndefined();
  });
});

/* ========================================================================== */

describe("Disengage (DE.*; rulings 2, 3)", () => {
  const scene = (extra = []) => [
    { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" }, effects: [{ defId: "burn" }, { defId: "atkDwn", magnitude: 10 }] },
    { from: "emiya", id: FOE, panel: { i: 3, j: 6 }, state: { factionId: "B" } },
    ...extra,
  ];

  it("at the start of the Combat Phase: the targeted Attack is cancelled, he heals 15% and removes the debuff he picks", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      await w.actor(CU).update({ "system.health.value": 500 });
      const de = abilityOf(w, CU, "disengage");
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.answer({ title: "FGT.Window.defendingPhaseStart", pick: [de.id] });
      w.answer({ title: "FGT.Removal.PickTitle", pick: ["burn"] });
      const { declared, processes } = await playAttack(w, { attacker: FOE, target: CU });
      expect(declared.cancelled).toBe(true);
      expect(processes).toHaveLength(0);
      expect(w.actor(CU).system.health.value).toBe(650);
      expect(held(w, CU)).not.toContain("burn");
      expect(held(w, CU)).toContain("atkDwn");
      expect(de.system.cooldown.remaining).toBeGreaterThan(0);
      const said = w.messages.contents.map((m) => m.content ?? "").join(" ");
      expect(said).toMatch(/AttackCancelled|cancelled by Disengage/);
    }, ON_B);
  });

  it("against an area Attack he alone leaves it, and the others are still hit", async () => {
    await withSubjects([
      { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE2, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
      { from: "lanceturia", id: FOE, panel: { i: 2, j: 6 }, state: { factionId: "B", masterId: "cuFoeMaster00001", contract: "contracted" } },
      { from: "master-advanced", id: "cuFoeMaster00001", panel: { i: 1, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const de = abilityOf(w, CU, "disengage");
      w.answer({ title: "FGT.Window.defendingPhaseStart", pick: [de.id] });
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const rhongo = abilityOf(w, FOE, "lanceturia-rhongomyniad");
      const out = await resolveAttack({ attackerId: FOE, abilityId: rhongo.id, placement: { panel: { i: 6, j: 6 } } });
      const defenders = out.processes.map((p) => JSON.parse(w.messages.get(p.messageId).getFlag("fgt", "process")).defenderId);
      expect(defenders).toContain(FOE2);
      expect(defenders).not.toContain(CU);
      const said = w.messages.contents.map((m) => m.content ?? "").join(" ");
      expect(said).toMatch(/LeftTheAttack|leaves the Attack/);
    }, ON_B);
  });
});

/* ========================================================================== */

describe("Gáe Bolg: Soaring Spear (GS.*; rulings 15, 32)", () => {
  it("BA 200 from STR and half of MAG, 3.5x plus 100, Divinity's 40 after; Magic Resistance does not see it", async () => {
    await withSubjects([
      { from: "cu-chulainn", id: CU, panel: { i: 6, j: 6 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE, panel: { i: 3, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { previewContext } = await import("../../module/engine/attack.mjs");
      const { computeDamage } = await import("../../module/rules/damage/pipeline.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const caster = board.units.find((u) => u.id === CU);
      const defender = board.units.find((u) => u.id === FOE);
      const gs = abilityOf(w, CU, "cu-gae-bolg-soaring-spear");
      const out = computeDamage({ ...previewContext({ caster, defender, ability: gs, board, isNP: true, targets: [defender] }), rolls: {} });
      const stage = (name) => out.breakdown.find((s) => s.name === name);
      const sum = (s) => s.after.phys + s.after.mag;
      // 125 STR and 75 of MAG: the e.g. BA=200.
      expect(stage("base").after).toEqual({ phys: 125, mag: 75 });
      // 3.5x plus 100, then Divinity's Fixed 40 after every modifier.
      expect(sum(stage("abilityMultiplier"))).toBe(800);
      expect(out.flags.fixedExtra).toBe(40);
      expect(out.total).toBe(840);
    }, WAR);
  });
});
