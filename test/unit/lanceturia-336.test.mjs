/**
 * Arturia (Lancer), audit #336: her sheet built through the real projection,
 * and the three pieces she brought: an NP cast with the Attack it rides, a
 * figure divided among the Units hit, and an NP DmUp spent by one NP.
 * @see docs/superpowers/specs/2026-10-24-lanceturia-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const AR = "lanceturia000001";
const FOE = "lanceFoe00000001";
const FOE2 = "lanceFoe00000002";
const ALLY = "lanceAlly0000001";
const MAS = "lanceMaster00001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1 }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);

/* ========================================================================== */

describe("the sheet, projected (ST.*)", () => {
  it("Lancer, Lawful Good, England; B A A A C; 1500, MOV 8, Range 2; BA 125/200; Melee; 2◈", async () => {
    await withSubjects([{ from: "lanceturia", id: AR }], ({ unit, world: w }) => {
      const a = unit(AR);
      expect(a.servantClasses).toEqual(["lancer"]);
      expect(a.alignment).toMatchObject({ order: "lawful", morality: "good" });
      expect(a.region).toEqual(["england"]);
      expect(a.attributes).toEqual(expect.arrayContaining(["female", "servant", "sky", "saberface", "dragon", "king", "humanoid", "roundTable"]));
      expect(Object.fromEntries(Object.entries(a.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "B", end: "A", agi: "A", mag: "A", luc: "C" });
      expect(a.maxHealth ?? a.health?.max).toBe(1500);
      expect(a.mov).toBe(8);
      expect(a.range).toBe(2);
      expect(a.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 200 }));
      expect(a.normalAttack).toMatchObject({ component: "str", delivery: "melee" });
      expect(w.actor(AR).system.sustainability).toBe("2◈");
    });
  });

  it("holds the Class templates at her ranks and Arturia (Saber)'s shared files", async () => {
    await withSubjects([{ from: "lanceturia", id: AR }], ({ world: w }) => {
      const ids = w.actor(AR).items.map((i) => i.system.contentId);
      expect(ids).toEqual(expect.arrayContaining([
        "class-magic-resistance", "class-riding", "arturia-vivians-blessing", "arturia-charisma",
        "lanceturia-mana-burst", "lanceturia-torrent-of-light", "lanceturia-wild-hunt", "lanceturia-blessings",
        "lanceturia-invisible-air", "lanceturia-strike-air", "lanceturia-rhongomyniad",
      ]));
      expect(abilityOf(w, AR, "class-magic-resistance").system.rank).toBe("B");
      expect(abilityOf(w, AR, "class-riding").system.rank).toBe("A");
      expect(abilityOf(w, AR, "class-riding").system.cooldown.max).toBe("3◈");
    });
  });
});

/* ========================================================================== */

describe("Invisible Air, Usage 1, rides a Mana Burst (IA.u1.*; rulings 2, 3)", () => {
  const scene = [
    { from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  ];

  it("offered on her Mana Burst: AGL Up 3 and MOV Up 3 for 1◈ land on her, its clock starts, no Attack of its own", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      w.answer({ title: "FGT.AttackRider.Title", pick: ["use"] });
      const mb = abilityOf(w, AR, "lanceturia-mana-burst");
      const { processes } = await playAttack(w, { attacker: AR, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(processes).toHaveLength(1);
      expect(held(w, AR)).toEqual(expect.arrayContaining(["aglUp", "movUp"]));
      const agl = [...w.actor(AR).effects].find((e) => e.system?.defId === "aglUp");
      expect(agl.system.magnitude).toBe(3);
      expect(abilityOf(w, AR, "lanceturia-invisible-air").system.cooldown.remaining).toBe(15);
      // Her Normal Attack's delivery, Melee (ruling 14).
      expect(processes[0].attack.delivery ?? null).toBe(null);
    }, WAR);
  });

  it("is not offered on a bare Normal Attack, and is no button of its own", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      await playAttack(w, { attacker: AR, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(w.asked.map((a) => a.title)).not.toContain("FGT.AttackRider.Title");
      const pressed = await castSkill(w, { caster: AR, ability: abilityOf(w, AR, "lanceturia-invisible-air").id });
      expect(pressed).toMatchObject({ ok: false, reason: "windowOnly" });
      expect(held(w, AR)).not.toContain("aglUp");
    }, WAR);
  });

  it("bars Strike Air for the Round, and Strike Air bars it (IA.excl)", async () => {
    await withSubjects(scene, async ({ world: w }) => {
      w.answer({ title: "FGT.AttackRider.Title", pick: ["use"] });
      const mb = abilityOf(w, AR, "lanceturia-mana-burst");
      await playAttack(w, { attacker: AR, ability: mb.id, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      const { pressGate } = await import("../../module/engine/press-gate.mjs");
      const gate = pressGate(w.actor(AR), abilityOf(w, AR, "lanceturia-strike-air"), { selfOnly: true, billsBudget: false });
      expect(gate.ok).toBe(false);
      expect(gate.reason).toMatch(/exclusive|sameRound/i);
    }, WAR);
  });
});

/* ========================================================================== */

describe("Strike Air divides its 300 among the Units it hits (IA.u2.split; ruling 4)", () => {
  it("three Units in the 3x3 east of her, an ally among them: 100 to each", async () => {
    await withSubjects([
      { from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
      { from: "medusa", id: FOE2, panel: { i: 4, j: 7 }, state: { factionId: "B" } },
      { from: "medusa", id: ALLY, panel: { i: 6, j: 8 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const sa = abilityOf(w, AR, "lanceturia-strike-air");
      const declared = await resolveAttack({ attackerId: AR, abilityId: sa.id, placement: { direction: "e" } });
      const states = declared.processes.map((p) => JSON.parse(w.messages.get(p.messageId).getFlag("fgt", "process")));
      expect(states.map((s) => s.defenderId).sort()).toEqual([ALLY, FOE, FOE2].sort());
      expect(states.every((s) => s.attack.targetCount === 3)).toBe(true);
      expect(states[0].attack.delivery).toBe("ranged");

      const { previewContext } = await import("../../module/engine/attack.mjs");
      const { computeDamage } = await import("../../module/rules/damage/pipeline.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const units = [FOE, FOE2, ALLY].map((id) => board.units.find((u) => u.id === id));
      const caster = board.units.find((u) => u.id === AR);
      const three = computeDamage({ ...previewContext({ caster, defender: units[0], ability: sa, board, isNP: true, targets: units }), rolls: {} });
      expect(three.breakdown.find((r) => r.stage === 1)?.rows?.[0]?.note ?? JSON.stringify(three.breakdown)).toMatch(/300 ÷ 3 Units/);
      const one = computeDamage({ ...previewContext({ caster, defender: units[0], ability: sa, board, isNP: true, targets: [units[0]] }), rolls: {} });
      expect(JSON.stringify(one.breakdown)).not.toMatch(/÷/);
    }, WAR);
  });
});

/* ========================================================================== */

describe("Wild Hunt: Atk Up (Charisma), NP DmUp, NP DmUp (Round) on the Round Table (WH.*; ruling 5)", () => {
  it("she and an ally within 2 take the Atk Up and NP DmUp; only she, Round Table, takes the one charge", async () => {
    await withSubjects([
      { from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medusa", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      const out = await castSkill(w, { caster: AR, ability: abilityOf(w, AR, "lanceturia-wild-hunt").id });
      expect(out.ok).toBe(true);
      expect(held(w, AR)).toEqual(expect.arrayContaining(["atkUpCharismaUnit", "npDmUp", "npDmUpRound"]));
      expect(held(w, ALLY)).toEqual(expect.arrayContaining(["atkUpCharismaUnit", "npDmUp"]));
      expect(held(w, ALLY)).not.toContain("npDmUpRound");
      const round = [...w.actor(AR).effects].find((e) => e.system?.defId === "npDmUpRound");
      expect(round.system.magnitude).toBe(30);
    }, WAR);
  });
});

/* ========================================================================== */

describe("Blessings: every NP's clock −2◈, her debuffs gone (BL.*)", () => {
  it("Rhongomyniad and both Invisible Air usages fall by 6 Turns", async () => {
    await withSubjects([
      { from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "atkDwn", magnitude: 10, expiry: 99 }] },
    ], async ({ world: w }) => {
      for (const id of ["lanceturia-rhongomyniad", "lanceturia-invisible-air", "lanceturia-strike-air"]) {
        await abilityOf(w, AR, id).update({ "system.cooldown.remaining": 9 });
      }
      const out = await castSkill(w, { caster: AR, ability: abilityOf(w, AR, "lanceturia-blessings").id });
      expect(out.ok).toBe(true);
      for (const id of ["lanceturia-rhongomyniad", "lanceturia-invisible-air", "lanceturia-strike-air"]) {
        expect(abilityOf(w, AR, id).system.cooldown.remaining, id).toBe(3);
      }
      expect(held(w, AR)).not.toContain("atkDwn");
    }, WAR);
  });
});

/* ========================================================================== */

describe("Rhongomyniad: criteria, a cost and a clock that fall with them (RH.*)", () => {
  it("on one Evil DU: its Cooldown is 23 Turns less one per criterion met, and her NP DmUp (Round) is spent", async () => {
    await withSubjects([
      { from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" }, effects: [{ defId: "npDmUpRound", magnitude: 30 }] },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 4 }, state: { factionId: "A" } },
      { from: "vlad-lancer", id: FOE, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.answer({ title: "FGT.Window.processEnd", decline: true });
      const rh = abilityOf(w, AR, "lanceturia-rhongomyniad");
      const { processes } = await playAttack(w, {
        attacker: AR, ability: rh.id, placement: { panel: { i: 5, j: 8 } },
        react: { [FOE]: ["nothing", "declined", "declined"] },
      });
      const met = processes[0].attack.criteriaMet;
      expect(met.total).toBe(6);
      expect(met.which).toContain(2);
      expect(processes[0].attack.delivery).toBe("special");
      // 7◈+⅔◈ is 23 Turns at 3 a Round; ⅓◈ (1 Turn) off per criterion met.
      expect(abilityOf(w, AR, "lanceturia-rhongomyniad").system.cooldown.remaining).toBe(23 - met.met);
      expect(held(w, AR)).not.toContain("npDmUpRound");
    }, WAR);
  });
});

/* ========================================================================== */

describe("an exclusion refused on the attack path names its partner (found live, #336)", () => {
  it("Torrent of Light first: Mana Burst is refused \"on the same Round as Torrent of Light\", by name", async () => {
    await withSubjects([
      { from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      expect((await castSkill(w, { caster: AR, ability: abilityOf(w, AR, "lanceturia-torrent-of-light").id })).ok).toBe(true);
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const mb = abilityOf(w, AR, "lanceturia-mana-burst");
      // The test world prints lang keys; a key with its `{partner}` filled is what a table reads.
      const i18n = globalThis.game.i18n;
      globalThis.game.i18n = { ...i18n, has: () => true, format: (k, d = {}) => `${k}{${d.partner ?? ""}}` };
      try {
        await expect(resolveAttack({ attackerId: AR, abilityId: mb.id, placement: { unitId: FOE, chosenIds: [FOE] } }))
          .rejects.toThrow(/sameRoundExclusive\{Torrent of Light\}/);
      } finally {
        globalThis.game.i18n = i18n;
      }
    }, WAR);
  });
});

/* ========================================================================== */

describe("a charge is spent only by an NP declared holding it (found live, #336)", () => {
  it("Strike Air declared, Wild Hunt's charge gained while it is open: Strike Air's close leaves the charge", async () => {
    await withSubjects([
      { from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const { playProcess } = await import("../helpers/process.mjs");
      const declared = await resolveAttack({
        attackerId: AR, abilityId: abilityOf(w, AR, "lanceturia-strike-air").id, placement: { direction: "e" },
      });
      const saved = JSON.parse(w.messages.get(declared.processes[0].messageId).getFlag("fgt", "process"));
      expect(saved.attack.heldAtDeclaration).not.toContain("npDmUpRound");
      expect((await castSkill(w, { caster: AR, ability: abilityOf(w, AR, "lanceturia-wild-hunt").id })).ok).toBe(true);
      expect(held(w, AR)).toContain("npDmUpRound");
      for (const p of declared.processes) await playProcess(w, p.messageId, { [FOE]: ["nothing", "declined", "declined"] });
      expect(held(w, AR)).toContain("npDmUpRound");
    }, WAR);
  });
});

describe("a toggle used through useSkill switches (found live, #336)", () => {
  it("Riding's Active by request: on, its clock started, MOV 8 → 13, no MOV Up effect", async () => {
    await withSubjects([{ from: "lanceturia", id: AR, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async ({ unit, world: w }) => {
      const riding = abilityOf(w, AR, "class-riding");
      const out = await castSkill(w, { caster: AR, ability: riding.id });
      expect(out.ok).toBe(true);
      expect(abilityOf(w, AR, "class-riding").system.active).toBe(true);
      expect(abilityOf(w, AR, "class-riding").system.cooldown.remaining).toBe(9);
      const { currentBoard } = await import("../../module/engine/board.mjs");
      expect(currentBoard().units.find((u) => u.id === AR).mov).toBe(13);
      expect(held(w, AR)).not.toContain("movUp");
      void unit;
    }, WAR);
  });
});
