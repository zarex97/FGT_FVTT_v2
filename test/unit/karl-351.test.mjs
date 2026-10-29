/**
 * Karl de Große (Ruler), audit #351: his sheet through the real projection, and
 * the pieces he brought: a Notebook page learned on first sight, a chance
 * raised per NP the DU holds, a Stun-only bypass, an aura that grants an effect,
 * Holy King's Christian exception and Joyeuse's flat damage.
 * @see docs/superpowers/specs/2026-10-28-karl-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const KARL = "karl000000000001";
const FOE = "karlFoe000000001";
const ALLY = "karlAlly00000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
const karl = (extra = {}) => ({
  from: "karl-de-grosse", id: KARL, panel: { i: 6, j: 6 }, ...extra,
  state: { factionId: "A", ...(extra.state ?? {}) },
});
const NOTHING = (...ids) => Object.fromEntries(ids.map((id) => [id, ["nothing", "declined", "declined", "declined"]]));
const live = async (id) => {
  const { currentBoard } = await import("../../module/engine/board.mjs");
  return currentBoard().units.find((u) => u.id === id) ?? null;
};

describe("the sheet, projected (ST.*)", () => {
  it("Ruler, no Alignment, four Regions; B A+ C A+ A+; 1600 by the table, MOV 5, Range 1; BA 125/210; 2◈", async () => {
    await withSubjects([karl()], ({ unit, world: w }) => {
      const k = unit(KARL);
      expect(k.servantClasses).toEqual(["ruler"]);
      expect(k.region).toEqual(["france", "italy", "germany", "austria"]);
      expect(k.attributes).toEqual(expect.arrayContaining(["male", "servant", "man", "humanoid"]));
      expect(Object.fromEntries(Object.entries(k.parameters).map(([key, v]) => [key, String(v)])))
        .toMatchObject({ str: "B", end: "A+", agi: "C", mag: "A+", luc: "A+" });
      expect(k.maxHealth ?? k.health?.max).toBe(1600);
      expect(k.mov).toBe(5);
      expect(k.range).toBe(1);
      expect(k.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 210 }));
      expect(w.actor(KARL).system.sustainability).toBe("2◈");
    });
  });

  it("Magic Resistance EX negates all MAG and cuts debuffs by 30", async () => {
    await withSubjects([karl()], ({ unit }) => {
      expect(String(unit(KARL).magicResistance.rank)).toBe("EX");
      expect(unit(KARL).magicResistance.percent).toBe(100);
      expect((unit(KARL).applicationChances ?? []).map((c) => c.value)).toContain(30);
    });
  });
});

describe("True Name Discernment (TD.*)", () => {
  it("cuts NP damage taken by 15", async () => {
    await withSubjects([karl()], ({ unit }) => {
      const cut = (unit(KARL).modifiers ?? []).find((m) => m.key === "defUp" && /True Name/.test(String(m.source)));
      expect(cut).toMatchObject({ value: 15, npValue: 15 });
    });
  });

  it("NP DmDwn's chance gains 20 for every NP the DU has (reading 4)", async () => {
    await withSubjects([karl(), { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 8 }, state: { factionId: "B" } }], async ({ world: w }) => {
      const cu = await live(FOE);
      const nps = (cu.abilities ?? []).filter((a) => a.isNP).length;
      expect(nps).toBeGreaterThan(0);
      const { landEffect } = await import("../../module/engine/landing.mjs");
      const { entryOf } = await import("../../module/rules/effect-flow.mjs");
      w.dice.set("d100", 100);
      const out = await landEffect(entryOf({ id: "npDmDwn", magnitude: 20, chance: 10, chanceBonus: { count: { of: "npsHeld" }, per: 20 } }), {
        target: cu, source: { unitId: KARL, abilityId: null }, caster: w.actor(KARL), process: {},
      });
      // 10 + 20 × NPs, less Cú's Magic Resistance C (15).
      expect(out.chance).toContain(`vs ${10 + 20 * nps - 15}%`);
    }, WAR);
  });

  it("first sight of a Unit asks for its page (the engine keeps enemy Servants)", async () => {
    await withSubjects([
      karl(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 8 }, state: { factionId: "B" } },
      { from: "medea", id: ALLY, panel: { i: 6, j: 4 }, state: { factionId: "A" } },
    ], async () => {
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const k = await live(KARL);
      const seenFoe = fireEvent("unitFirstSeen", [k], { tick: 18, turnsPerRound: 3, victim: { unitId: FOE } });
      expect(seenFoe.filter((i) => i.entry?.kind === "learnPage").map((i) => i.entry))
        .toEqual([expect.objectContaining({ unitId: KARL, targetId: FOE })]);
    }, WAR);
  });

  it("a Servant that hides its information is the Luck Check's (reading 3)", async () => {
    const { hidesInformation } = await import("../../module/engine/true-name.mjs");
    expect(hidesInformation({ effects: ["disguise"] })).toBe(true);
    expect(hidesInformation({ abilities: [{ slug: "presenceConcealment" }] })).toBe(true);
    expect(hidesInformation({ effects: ["atkUp"], abilities: [{ slug: "charisma" }] })).toBe(false);
  });
});

describe("God's Resolution (GR.*, reading 5)", () => {
  const stun = { id: "stun", name: "Stun", polarity: "debuff", volatility: "volatile", stacking: "noneRefresh", baseChance: 100 };
  const target = {
    id: "t", effects: [], effectInstances: [], immunities: ["stun"],
    applicationChances: [
      { direction: "incoming", effectId: "stun", value: 50, source: "Stun Resist" },
      { direction: "incoming", value: 25, source: "Magic Resistance" },
    ],
  };
  it("passes what names Stun and keeps the general resistance", async () => {
    const { applyEffect } = await import("../../module/engine/effect-applier.mjs");
    const ctx = { turnsPerRound: 3, currentTick: 18, roll: 50 };
    const passed = applyEffect({ def: stun, target, source: {}, ctx, chance: 80, ignoresNamedDefences: true });
    expect(passed.outcome).toBe("applied");
    expect(passed.chance).toBe("rolled 50 vs 55%");
    const plain = applyEffect({ def: stun, target, source: {}, ctx, chance: 80 });
    expect(plain.outcome).toBe("blocked");
  });

  it("Debuff Immune still refuses it", async () => {
    const { applyEffect } = await import("../../module/engine/effect-applier.mjs");
    const immune = { ...target, immunities: [{ scope: "debuff", except: ["instakill", "death", "erase"] }] };
    const out = applyEffect({ def: stun, target: immune, source: {}, ctx: { turnsPerRound: 3, currentTick: 18, roll: 1 }, chance: 80, ignoresNamedDefences: true });
    expect(out.outcome).toBe("blocked");
  });
});

describe("Ceremonial Reformation (CR.*)", () => {
  it("is granted to every ally, never Karl or an enemy (readings 6)", async () => {
    await withSubjects([
      karl(),
      { from: "medea", id: ALLY, panel: { i: 6, j: 20 }, state: { factionId: "A" } },
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 8 }, state: { factionId: "B" } },
    ], async ({ board }) => {
      const { auraGrantPlan } = await import("../../module/rules/aura-grants.mjs");
      const plan = auraGrantPlan(board);
      expect(plan.add).toEqual([{ unitId: ALLY, effectId: "ceremonialReformation", sourceId: KARL }]);
      expect(plan.remove).toEqual([]);
    }, WAR);
  });

  it("taken back when Karl falls", async () => {
    await withSubjects([
      karl({ state: { defeated: true } }),
      { from: "medea", id: ALLY, panel: { i: 6, j: 9 }, state: { factionId: "A" }, effects: [{ defId: "ceremonialReformation", params: { auraGrant: KARL } }] },
    ], async ({ board }) => {
      const { auraGrantPlan } = await import("../../module/rules/aura-grants.mjs");
      const plan = auraGrantPlan(board);
      expect(plan.add).toEqual([]);
      expect(plan.remove).toEqual([expect.objectContaining({ unitId: ALLY, effectId: "ceremonialReformation" })]);
    }, WAR);
  });

  it("held, it raises the maximums and the damage both ways (CR.1 to CR.5)", async () => {
    await withSubjects([{ from: "medea", id: ALLY, panel: { i: 6, j: 9 }, state: { factionId: "A" }, effects: [{ defId: "ceremonialReformation" }] }],
      async ({ world: w }) => {
        const bare = await withSubjects([{ from: "medea", id: "plain00000000001", panel: { i: 6, j: 9 }, state: { factionId: "A" } }],
          ({ world: w2 }) => ({ hp: w2.actor("plain00000000001").system.health.max, agi: w2.actor("plain00000000001").system.agility.max, luc: w2.actor("plain00000000001").system.luck.max }));
        const sys = w.actor(ALLY).system;
        expect(sys.health.max).toBe(bare.hp + 100);
        expect(sys.agility.max).toBe(bare.agi + 1);
        expect(sys.luck.max).toBe(bare.luc + 1);
        const u = await live(ALLY);
        expect((u.modifiers ?? []).filter((m) => /eremonial/i.test(String(m.source))).map((m) => [m.key, m.value]), JSON.stringify((u.modifiers ?? []).map((m) => [m.key, m.value, m.source])))
          .toEqual(expect.arrayContaining([["atkUp", 10], ["atkUp", 20], ["defUp", 10], ["defUp", 20]]));
      }, WAR);
  });
});

describe("Great Emperor Privilege (GE.*)", () => {
  it("heals 30%, two 60% dice for Atk Up and Def Up, NP Cooldown −⅔◈", async () => {
    await withSubjects([karl({ state: { health: { value: 600, max: 1600 } } })], async ({ world: w }) => {
      await abilityOf(w, KARL, "karl-joyeuse").update({ "system.cooldown.remaining": 0 });
      w.dice.set("d100", 10, 90);
      expect((await castSkill(w, { caster: KARL, ability: abilityOf(w, KARL, "karl-great-emperor-privilege").id })).ok).toBe(true);
      expect(w.actor(KARL).system.health.value).toBe(600 + 480);
      expect(effectsOf(w, KARL, "atkUp")[0]?.system).toMatchObject({ magnitude: 40, npMagnitude: 20 });
      expect(effectsOf(w, KARL, "defUp")).toHaveLength(0);
    }, WAR);
  });
});

describe("Holy King (HK.*)", () => {
  it("+25% against a Divine Unit without Christian, nothing against a Christian one", async () => {
    const { test } = await import("../../module/rules/predicate.mjs");
    await withSubjects([karl()], ({ unit }) => {
      const dealt = (unit(KARL).modifiers ?? []).find((m) => m.key === "dmgUp" && /Holy King/.test(String(m.source)));
      expect(dealt).toMatchObject({ value: 25 });
      const opts = (attrs) => ({ options: new Set(attrs.map((a) => `target:attribute:${a}`)) });
      expect(test(dealt.predicate, opts(["divine"]))).toBe(true);
      expect(test(dealt.predicate, opts(["divine", "christian"]))).toBe(false);
      expect(test(dealt.predicate, opts(["demonicBeast"]))).toBe(true);
      expect(test(dealt.predicate, opts(["humanoid"]))).toBe(false);
    });
  });

  it("the Christian Attribute is the roster's (reading 34)", async () => {
    await withSubjects([{ from: "test-jeanne-d-arc", id: ALLY, panel: { i: 1, j: 1 }, state: { factionId: "A" } }], ({ unit }) => {
      expect(unit(ALLY).attributes).toContain("christian");
    });
  });
});

describe("Joyeuse (JO.*)", () => {
  it("+100 on his Normal Attack against a Demonic Beast", async () => {
    await withSubjects([karl(), { from: "asterios", id: FOE, panel: { i: 6, j: 7 }, state: { factionId: "B" } }], async ({ world: w }) => {
      await playAttack(w, { attacker: KARL, target: FOE, react: NOTHING(FOE, KARL) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      expect(JSON.stringify(result.breakdown)).toContain("Joyeuse");
    }, WAR);
  });
});
