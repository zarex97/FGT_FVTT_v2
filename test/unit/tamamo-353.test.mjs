/**
 * Tamamo (Caster), audit #353: her sheet through the real projection, and the
 * pieces she brought: Witchcraft's Magic Resistance bypass on her MAG Attacks,
 * a capped NP push, Break, an automatic Block, Aphotic's falling cut, Fox
 * Spouse, Yata Strike's die and Crit count, a flat Stun, stages by the DU's
 * Rank, the Amaterasu Area and Dainisshō's random hits.
 * @see docs/superpowers/specs/2026-10-29-tamamo-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const TAMA = "tamamo0000000001";
const FOE = "tamamoFoe0000001";
const FOE2 = "tamamoFoe0000002";
const ALLY = "tamamoAlly000001";
const MASTER = "tamamoMaster0001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
const tamamo = (extra = {}) => ({
  from: "tamamo", id: TAMA, panel: { i: 6, j: 6 }, ...extra,
  state: { factionId: "A", ...(extra.state ?? {}) },
});
const foe = (from = "cu-chulainn", panel = { i: 6, j: 8 }, id = FOE, extra = {}) => ({ from, id, panel, ...extra, state: { factionId: "B", ...(extra.state ?? {}) } });
const NOTHING = (...ids) => Object.fromEntries(ids.map((id) => [id, ["nothing", "declined", "declined", "declined", "declined"]]));
const live = async (id) => {
  const { currentBoard } = await import("../../module/engine/board.mjs");
  return currentBoard().units.find((u) => u.id === id) ?? null;
};
const resultsOf = (w) => w.messages.contents.map((m) => m.flags?.fgt?.result).filter(Boolean);

/** The Amaterasu Area as `openField` stores it, 5×5 around `c`. */
const amaterasuArea = (c, ownerId = TAMA) => {
  const doc = parse(readFileSync("packs/_source/abilities/tamamo-yata-no-kagami.yml", "utf8"));
  const panels = [];
  for (let di = -2; di <= 2; di += 1) for (let dj = -2; dj <= 2; dj += 1) panels.push({ i: c.i + di, j: c.j + dj });
  return {
    id: "amaterasuRegion",
    panels,
    behaviors: [{
      type: "npField",
      system: {
        fieldId: "tamamo-yata-no-kagami", ownerUnitId: ownerId, ownerFaction: "A",
        geometry: { ...doc.field.geometry, anchor: c }, membership: doc.field.membership,
        interior: doc.field.interior, onEnd: doc.field.onEnd, vulnerabilities: doc.field.vulnerabilities,
        panels, duration: "2◈", expiry: 24,
      },
      // A stand-in behaviour, answering the one write the engine makes to it.
      async update(patch) { Object.assign(this, { patched: { ...(this.patched ?? {}), ...patch } }); },
    }],
  };
};

describe("the sheet, projected (ST.*)", () => {
  it("Caster, Neutral Evil, Japan; E E B A D; 500, MOV 5, Range 3; BA 50/200; 4◈; Mantra 0/3", async () => {
    await withSubjects([tamamo()], ({ unit, world: w }) => {
      const t = unit(TAMA);
      const s = w.actor(TAMA).system;
      expect(s.trueName).toBe("Tamamo no Mae");
      expect(t.servantClasses).toEqual(["caster"]);
      expect(s.alignment).toMatchObject({ order: "neutral", morality: "evil" });
      expect([...s.region]).toEqual(["japan"]);
      expect(Object.fromEntries(Object.entries(t.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "E", end: "E", agi: "B", mag: "A", luc: "D" });
      expect(t.attributes).toEqual(expect.arrayContaining(["female", "servant", "sky", "humanoid", "demonicBeast", "animalistic", "antiHero"]));
      expect(t.maxHealth ?? t.health?.max).toBe(500);
      expect(t.mov).toBe(5);
      expect(t.range).toBe(3);
      expect(t.baseAttack).toEqual(expect.objectContaining({ str: 50, mag: 200 }));
      expect(s.sustainability).toBe("4◈");
      expect(s.resources.mantra).toMatchObject({ value: 0, max: 3 });
    });
  });

  it("a Normal Attack uses BA(STR) at 1 and BA(MAG) at 2 or more (ST.na)", async () => {
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    await withSubjects([tamamo()], ({ world: w }) => {
      const sys = w.actor(TAMA).system;
      expect(normalAttackAt(sys, 1).component).toBe("str");
      expect(normalAttackAt(sys, 2).component).toBe("mag");
      expect(normalAttackAt(sys, 3).component).toBe("mag");
    });
  });
});

describe("Territory Creation, Shapeshift (TC.*, SS.*)", () => {
  it("Territory Creation at C, Shapeshift's 30% and 15% against an NP", async () => {
    await withSubjects([tamamo()], ({ unit, world: w }) => {
      expect(String(abilityOf(w, TAMA, "class-territory-creation").system.rank)).toBe("C");
      const ward = (unit(TAMA).modifiers ?? []).find((m) => m.key === "ward" && /Shapeshift/.test(String(m.source)));
      expect(ward).toMatchObject({ value: 30, npValue: 15 });
    });
  });
});

describe("Divinity (DV.*, reading 1)", () => {
  it("is negated and gives no Divine Attribute while Yata no Kagami is not Active", async () => {
    await withSubjects([tamamo()], ({ unit }) => {
      const t = unit(TAMA);
      expect(t.attributes).not.toContain("divine");
      expect((t.modifiers ?? []).some((m) => /Divinity/.test(String(m.source)))).toBe(false);
    });
  });

  it("is in effect, +50 and Divine, while she holds the Area's `amaterasu`", async () => {
    await withSubjects([tamamo({ effects: [{ defId: "amaterasu", magnitude: 1 }] })], ({ unit }) => {
      const t = unit(TAMA);
      expect(t.attributes).toContain("divine");
      const flat = (t.modifiers ?? []).find((m) => /Divinity/.test(String(m.source)));
      expect(flat?.value).toBe(50);
      expect(t.range).toBe(4);
    });
  });
});

describe("Witchcraft (WC.*)", () => {
  const facts = async (range, extra = {}) => {
    const { attackFacts } = await import("../../module/engine/attack.mjs");
    let out = null;
    await withSubjects([tamamo(extra), foe("arturia", { i: 6, j: 6 + range })], async () => {
      // As the declaration stamps it, before the distance is known: `str`.
      out = attackFacts(await live(TAMA), await live(FOE), { attack: { kind: "normal", component: "str" } });
    }, WAR);
    return out;
  };

  it("her MAG Normal Attack ignores Magic Resistance; her STR one does not (WC.p1)", async () => {
    expect((await facts(2)).ignoresMagicResistance).toBe(true);
    expect((await facts(1)).ignoresMagicResistance).toBe(false);
  });

  it("a declared MAG swing on Cú meets no Magic Resistance (found live)", async () => {
    await withSubjects([tamamo(), foe("cu-chulainn", { i: 6, j: 9 })], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: TAMA, target: FOE, react: { ...NOTHING(FOE), [TAMA]: ["declined", "declined"] } });
      const text = JSON.stringify(resultsOf(w)[0]?.breakdown ?? []);
      expect(text).toContain("BA(MAG)");
      expect(text).not.toContain("magicResistance");
    }, WAR);
  });

  it("not under Skill Seal, nor Silence (WC.p1.seal, WC.p1.silence)", async () => {
    expect((await facts(2, { effects: [{ defId: "skillSeal", expiry: 99 }] })).ignoresMagicResistance).toBe(false);
    expect((await facts(2, { effects: [{ defId: "silence", expiry: 99 }] })).ignoresMagicResistance).toBe(false);
  });

  const enten = async (mantra) => {
    let out = null;
    await withSubjects([tamamo({ state: { resources: { mantra: { value: mantra, max: 3 } } } }), foe()], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 99);
      const spell = abilityOf(w, TAMA, "tamamo-enten");
      await playAttack(w, { attacker: TAMA, ability: spell.id, target: FOE, react: NOTHING(FOE) });
      out = { tokens: w.actor(TAMA).system.resources.mantra.value, cooldown: spell.system.cooldown.remaining };
    }, WAR);
    return out;
  };

  it("a Mantra Token waives Enten's Cooldown; with none it cools 1◈ (WC.p2, WC.p2.cd)", async () => {
    expect(await enten(1)).toEqual({ tokens: 0, cooldown: 0 });
    expect(await enten(0)).toEqual({ tokens: 0, cooldown: 3 });
  });

  it("the four lock each other while one cools (EN.lock)", async () => {
    const { meetsRequirement } = await import("../../module/rules/items.mjs");
    await withSubjects([tamamo()], async ({ world: w }) => {
      await abilityOf(w, TAMA, "tamamo-hyoten").update({ "system.cooldown.remaining": 3 });
      const t = await live(TAMA);
      const enten = abilityOf(w, TAMA, "tamamo-enten");
      const req = enten.system.requirements[0];
      expect(meetsRequirement(req, { unit: t, ability: { ...enten.system, id: enten.id } })).toBe(false);
    }, WAR);
  });
});

describe("Jusō・Kōnisshō (KN.*)", () => {
  it("pushes every NP 3◈, held to its maximum; +2 tokens; NP DmUp 30 on others within 2, not her", async () => {
    await withSubjects([
      tamamo(), foe(),
      { from: "medea", id: ALLY, panel: { i: 6, j: 5 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      const spear = abilityOf(w, FOE, "cu-gae-bolg-barbed-spear");
      await spear.update({ "system.cooldown.remaining": 15 });
      const out = await castSkill(w, { caster: TAMA, ability: abilityOf(w, TAMA, "tamamo-konissho").id, placement: { unitId: FOE, chosenIds: [FOE] } });
      expect(out.ok, out.reason).toBe(true);
      // 6◈ is 18: 15 + 9 held to 18 (KN.cap).
      expect(spear.system.cooldown.remaining).toBe(18);
      expect(w.actor(TAMA).system.resources.mantra.value).toBe(2);
      expect(effectsOf(w, ALLY, "npDmUp")[0]?.system?.magnitude).toBe(30);
      expect(effectsOf(w, TAMA, "npDmUp")).toHaveLength(0);
      expect(abilityOf(w, TAMA, "tamamo-konissho").system.cooldown.remaining).toBe(12);
    }, WAR);
  });
});

describe("Jusō・Mitten (MI.*, reading 7)", () => {
  it("a Blocking DU: the Block ignored and the damage ×1.5 beside the ×1.25", async () => {
    const { breakMultipliers } = await import("../../module/rules/damage/instances.mjs");
    expect(breakMultipliers({ break: { bonus: 50 } })).toEqual([
      expect.objectContaining({ factor: 1.5, predicate: ["target:reaction:block"] }),
    ]);
    expect(() => breakMultipliers({ break: { bonus: 50, chance: 40 } })).toThrow(/not built/);
    await withSubjects([tamamo(), foe()], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: TAMA, ability: abilityOf(w, TAMA, "tamamo-mitten").id, target: FOE, react: { [FOE]: ["block", "declined", "declined"] } });
      const text = JSON.stringify(resultsOf(w)[0]?.breakdown ?? []);
      expect(text).toContain("Break (+50%)");
      expect(text).not.toMatch(/Block −\d+% of Total Damage/);
    }, WAR);
  });
});

describe("Jusō・Kokutendō (KK.*)", () => {
  it("Aphotic: Decoy, no Evade, an automatic Block, −30%; a second use refused (KK.1-4, KK.lock)", async () => {
    await withSubjects([tamamo(), foe("cu-chulainn", { i: 6, j: 7 })], async ({ world: w, unit }) => {
      const koku = abilityOf(w, TAMA, "tamamo-kokutendo");
      expect((await castSkill(w, { caster: TAMA, ability: koku.id })).ok).toBe(true);
      expect(effectsOf(w, TAMA, "aphotic")).toHaveLength(1);
      const t = await live(TAMA);
      const scopes = (t.suppressions ?? []).map((s) => s.scope);
      expect(scopes).toEqual(expect.arrayContaining(["targeting", "dodge", "substitution", "forcedReaction"]));
      expect(t.forbiddenReactions).toContain("evade");
      await koku.update({ "system.cooldown.remaining": 0 });
      expect((await castSkill(w, { caster: TAMA, ability: koku.id })).ok).toBe(false);
      void unit;
    }, WAR);
  });

  it("an Attack on her is Blocked unasked, and her Spells' clocks fall ⅓◈ (KK.3, KK.5.spell)", async () => {
    await withSubjects([tamamo({ effects: [{ defId: "aphotic", expiry: 99 }] }), foe("cu-chulainn", { i: 6, j: 7 })], async ({ world: w }) => {
      const koku = abilityOf(w, TAMA, "tamamo-kokutendo");
      await koku.update({ "system.cooldown.remaining": 6 });
      await w.actor(FOE).update({ "system.factionId": "B" });
      // Her side's Turn is over: Cú's Turn, her reaction never asked.
      await playAttack(w, { attacker: FOE, target: TAMA, react: { [FOE]: ["declined", "declined", "declined"], [TAMA]: ["declined", "declined"] } });
      const text = JSON.stringify(resultsOf(w)[0]?.breakdown ?? []);
      expect(text).toMatch(/Block −25% of Total Damage/);
      expect(koku.system.cooldown.remaining).toBe(5);
    }, { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } });
  });

  it("cast at the start of the Combat Phase, it Blocks that very Attack (KK.when, found live)", async () => {
    await withSubjects([tamamo(), foe("cu-chulainn", { i: 6, j: 7 })], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", pick: [abilityOf(w, TAMA, "tamamo-kokutendo").id] });
      const out = await playAttack(w, { attacker: FOE, target: TAMA, react: { [FOE]: ["declined", "declined", "declined"], [TAMA]: ["declined", "declined"] } });
      expect(effectsOf(w, TAMA, "aphotic")).toHaveLength(1);
      const s = out.processes[0];
      expect(s.reaction).toBe("block");
      expect(s.forbiddenReactions).toContain("evade");
    }, { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } });
  });

  it("nothing cooling: one Dmg Up (Aphotic) 15, stacking, spent by her next MAG Attack (KK.5.buff)", async () => {
    await withSubjects([tamamo({ effects: [{ defId: "aphotic", expiry: 99 }] }), foe("cu-chulainn", { i: 6, j: 7 })], async ({ world: w }) => {
      for (const i of w.actor(TAMA).items) if ((i.system?.cooldown?.remaining ?? 0) > 0) await i.update({ "system.cooldown.remaining": 0 });
      await playAttack(w, { attacker: FOE, target: TAMA, react: { [FOE]: ["declined", "declined", "declined"], [TAMA]: ["declined", "declined"] } });
      const buff = effectsOf(w, TAMA, "dmgUpAphotic");
      expect(buff).toHaveLength(1);
      expect(buff[0].system.magnitude).toBe(15);
    }, { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } });
  });
});

describe("Fox's Wedding (FW.*)", () => {
  const party = () => [
    tamamo({ state: { masterId: MASTER, health: { value: 100, max: 500 } } }),
    { from: "master-advanced", id: MASTER, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
    { from: "medea", id: ALLY, panel: { i: 5, j: 6 }, state: { factionId: "A", masterId: null } },
  ];

  it("on Tamamo, her Master within 2: heal 20%, Atk Up 50/30, Fox Spouse on her Master", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const out = await castSkill(w, { caster: TAMA, ability: abilityOf(w, TAMA, "tamamo-foxs-wedding").id, placement: { unitId: TAMA, chosenIds: [TAMA] } });
      expect(out.ok, out.reason).toBe(true);
      expect(w.actor(TAMA).system.health.value).toBe(200);
      expect(effectsOf(w, TAMA, "atkUp")[0]?.system).toMatchObject({ magnitude: 50, npMagnitude: 30 });
      expect(effectsOf(w, MASTER, "foxSpouse")).toHaveLength(1);
      const m = await live(MASTER);
      expect((m.suppressions ?? []).map((s) => s.scope)).toEqual(expect.arrayContaining(["overpower", "underpower"]));
    }, WAR);
  });

  it("on another ally: Luck +3, no Fox Spouse", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await w.actor(ALLY).update({ "system.luck": { value: 2, max: 15 } });
      const out = await castSkill(w, { caster: TAMA, ability: abilityOf(w, TAMA, "tamamo-foxs-wedding").id, placement: { unitId: ALLY, chosenIds: [ALLY] } });
      expect(out.ok, out.reason).toBe(true);
      expect(w.actor(ALLY).system.luck.value).toBe(5);
      expect(effectsOf(w, MASTER, "foxSpouse")).toHaveLength(0);
    }, WAR);
  });

  it("the card names what refused the coin (found live)", async () => {
    const { overpowerText, underpowerText } = await import("../../module/rules/explain.mjs");
    expect(overpowerText({ refusedBy: "Fox Spouse" })).toBe("Overpower: no coin (Fox Spouse)");
    expect(underpowerText({ refusedBy: "Fox Spouse" })).toBe("Underpower: no coin (Fox Spouse)");
  });

  it("Fox Spouse refuses the Overpower and the Underpower coin (FW.3.op, FW.3.up)", async () => {
    const { overpowerCheck, underpowerCheck } = await import("../../module/rules/relationships.mjs");
    const master = { kind: "master", effects: ["foxSpouse"], suppressions: [{ scope: "overpower" }, { scope: "underpower" }] };
    expect(overpowerCheck({ kind: "servant" }, master).applies).toBe(false);
    expect(underpowerCheck(master, { kind: "servant" }).applies).toBe(false);
  });
});

describe("Yata Strike (YS.*)", () => {
  it("10 × a d8, Fixed; a use that does not Crit counts toward +10% Crit", async () => {
    await withSubjects([tamamo(), foe("cu-chulainn", { i: 6, j: 8 })], async ({ world: w }) => {
      const strike = abilityOf(w, TAMA, "tamamo-yata-strike");
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 100);
      w.dice.set("d8", 6);
      await playAttack(w, { attacker: TAMA, ability: strike.id, target: FOE, react: NOTHING(FOE) });
      const r = resultsOf(w)[0];
      expect(r.total).toBe(60);
      expect(JSON.stringify(r.breakdown)).toContain("×1d8 = 6");
      expect(JSON.stringify(r.breakdown)).toContain("no Crit at 50% (+0)");
      expect(strike.system.critMisses).toBe(1);
    }, WAR);
  });
});

describe("Polygamist Castration Fist (PF.*)", () => {
  it("×9 against a Male, and Stun (Balls) at a flat 90 past Stun Immune", async () => {
    await withSubjects([tamamo(), foe("cu-chulainn", { i: 6, j: 8 }, FOE, { effects: [{ defId: "debuffImmune", expiry: 99 }] })], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 50);
      await playAttack(w, { attacker: TAMA, ability: abilityOf(w, TAMA, "tamamo-polygamist-castration-fist").id, target: FOE, react: NOTHING(FOE) });
      expect(JSON.stringify(resultsOf(w)[0]?.breakdown ?? [])).toMatch(/conditionalMultiplier/);
      expect(effectsOf(w, FOE, "stunBalls")).toHaveLength(1);
    }, WAR);
  });
});

describe("Higanbana Sesshoseki (HG.*)", () => {
  it("stages by the DU's own Rank; a Master reads the D/E row (readings 21, 22)", async () => {
    const { stagesFor } = await import("../../module/rules/effect-flow.mjs");
    const spec = { parameter: "mag", rows: { EX: 1, A: 1, B: 2, C: 2, D: 3, E: 3 }, unranked: 3 };
    expect(stagesFor({ id: "curse", stagesByTargetRank: spec }, { parameters: { mag: "A+" } })).toBe(1);
    expect(stagesFor({ id: "curse", stagesByTargetRank: spec }, { parameters: { mag: "C" } })).toBe(2);
    expect(stagesFor({ id: "curse", stagesByTargetRank: spec }, { parameters: { mag: "E" } })).toBe(3);
    expect(stagesFor({ id: "curse", stagesByTargetRank: spec }, {})).toBe(3);
    expect(stagesFor({ id: "curse", stages: 2 }, {})).toBe(2);
  });

  it("lands Curse 2 and Poison 2 on Cú (MAG C, END B), each card line naming its stage (found live)", async () => {
    await withSubjects([tamamo(), foe("cu-chulainn", { i: 6, j: 7 })], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: TAMA, ability: abilityOf(w, TAMA, "tamamo-higanbana-sesshoseki").id, target: FOE, react: { ...NOTHING(FOE), [TAMA]: ["declined", "declined"] } });
      expect(effectsOf(w, FOE, "curse")[0]?.system?.stage).toBe(2);
      expect(effectsOf(w, FOE, "poison")[0]?.system?.stage).toBe(2);
      const rows = w.messages.contents.flatMap((m) => m.flags?.fgt?.effects ?? []).map((e) => e.name);
      // The test world's i18n answers keys: the stage line's key, once per rider.
      expect(rows.filter((n) => n === "FGT.Effect.AtStage")).toHaveLength(2);
    }, WAR);
  });

  it("charges her Master the Rank E row", async () => {
    await withSubjects([tamamo()], ({ world: w }) => {
      const costs = abilityOf(w, TAMA, "tamamo-higanbana-sesshoseki").system.additionalCosts;
      expect(costs).toEqual([expect.objectContaining({ kind: "masterHealthByNPRank", rank: "E" })]);
    });
  });
});

describe("Yata no Kagami (YK.*)", () => {
  it("inside: MAG +100%, STR +50% on the part, Master costs halved, her exit sealed and an ally's free", async () => {
    await withSubjects([
      tamamo(), { from: "medea", id: ALLY, panel: { i: 6, j: 5 }, state: { factionId: "A" } }, foe("cu-chulainn", { i: 6, j: 7 }),
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { membershipVerdict } = await import("../../module/rules/bounded-fields.mjs");
      const { masterCostFactor, resolveCosts } = await import("../../module/rules/costs.mjs");
      const board = currentBoard();
      const field = board.fields.find((f) => f.id === "tamamo-yata-no-kagami");
      const ally = board.units.find((u) => u.id === ALLY);
      const self = board.units.find((u) => u.id === TAMA);
      const enemy = board.units.find((u) => u.id === FOE);
      const atk = (u) => (u.modifiers ?? []).filter((m) => m.source && m.key === "atkUp" && m.component);
      expect(atk(ally).map((m) => [m.component, m.value])).toEqual(expect.arrayContaining([["mag", 100], ["str", 50]]));
      expect(atk(enemy)).toHaveLength(0);
      expect(masterCostFactor(ally)).toBe(0.5);
      expect(resolveCosts([{ kind: "masterHealth", amount: 25 }], { payer: ally }).charged[0].amount).toBe(12);
      expect(membershipVerdict(field, self, "exit", board)).toMatchObject({ ok: false, reason: "sealed" });
      expect(membershipVerdict(field, ally, "exit", board).ok).toBe(true);
    }, { ...WAR, regions: [amaterasuArea({ i: 6, j: 6 })] });
  });

  it("a shove never lands her outside (reading 24)", async () => {
    await withSubjects([tamamo({ panel: { i: 6, j: 8 } })], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { knockbackPanel } = await import("../../module/rules/movement.mjs");
      const board = currentBoard();
      const self = board.units.find((u) => u.id === TAMA);
      expect(knockbackPanel({ i: 6, j: 7 }, self, board)).toBeNull();
    }, { ...WAR, regions: [amaterasuArea({ i: 6, j: 6 })] });
  });

  it("the Escape Command Spell does not carry her out (reading 24)", async () => {
    const { canSpend } = await import("../../module/rules/command-spells.mjs");
    const escape = parse(readFileSync("packs/_source/command-spells/cs-escape.yml", "utf8"));
    await withSubjects([
      tamamo({ state: { masterId: MASTER } }),
      { from: "master-advanced", id: MASTER, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const servant = board.units.find((u) => u.id === TAMA);
      const master = board.units.find((u) => u.id === MASTER);
      const verdict = canSpend({ ...escape, requirements: [] }, { board, servant, master: { ...master, commandSpells: { [TAMA]: 3 } } });
      expect(verdict).toMatchObject({ ok: false, reason: "heldByField" });
    }, { ...WAR, regions: [amaterasuArea({ i: 6, j: 6 })] });
  });
});

describe("Dainisshō (DN.*)", () => {
  it("hits 1 to 8 each strike one enemy drawn by a die; hit 9 strikes every enemy (reading 31)", async () => {
    const { processRows } = await import("../../module/engine/attack.mjs");
    const doc = parse(readFileSync("packs/_source/abilities/tamamo-dainissho.yml", "utf8"));
    const specs = doc.damage.instances;
    await withSubjects([tamamo()], async ({ world: w }) => {
      w.dice.set("d2", 1, 2, 2, 1, 1, 1, 2, 2);
      const rows = await processRows([{ t: { unitId: FOE }, specs }, { t: { unitId: FOE2 }, specs }]);
      expect(rows.map((r) => r.unitId)).toEqual([FOE, FOE2, FOE2, FOE, FOE, FOE, FOE2, FOE2, FOE, FOE2]);
      expect(rows[1].spec.picked).toEqual({ roll: 2, of: 2 });
      expect(rows.map((r) => r.spec.element)).toEqual(["nature", "ice", "wind", "lightning", "water", "earth", "light", "dark", "fire", "fire"]);
    });
  });

  it("is used only while the Area stands, and ends it at the Turn's end with +1◈ (DN.req, DN.end, DN.cd)", async () => {
    await withSubjects([tamamo()], async ({ world: w }) => {
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const dn = abilityOf(w, TAMA, "tamamo-dainissho");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const verdict = canUseAbility({ ability: { ...dn.system, id: dn.id }, unit: await live(TAMA), master: null, board, round: 6, gates: { mode: "off" } });
      expect(verdict).toMatchObject({ ok: false, reason: "fieldOpen" });
    }, WAR);
    await withSubjects([tamamo()], async ({ world: w }) => {
      const { markFieldEnd } = await import("../../module/engine/fields.mjs");
      const { queuedEnds } = await import("../../module/engine/queued-ends.mjs");
      expect(await markFieldEnd("tamamo-yata-no-kagami", TAMA, { cooldownBonus: 3 })).toBe(true);
      expect(queuedEnds()).toEqual([expect.objectContaining({ kind: "field", id: "tamamo-yata-no-kagami" })]);
      void w;
    }, { ...WAR, regions: [amaterasuArea({ i: 6, j: 6 })] });
  });
});
