/**
 * Karl de Große (Ruler), audit #351: his sheet through the real projection, and
 * the pieces he brought: a Notebook page learned on first sight, a chance
 * raised per NP the DU holds, a Stun-only bypass, an aura that grants an effect,
 * Holy King's Christian exception and Joyeuse's flat damage.
 * @see docs/superpowers/specs/2026-10-28-karl-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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
  // Cu Chulainn's own Magic Resistance C, and a Stun Resist held: the one is
  // general and kept, the other names Stun and is passed.
  const resisting = (effects) => [karl(), { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 8 }, state: { factionId: "B" }, effects }];
  const stunResist = { defId: "testStunResist" };
  const land = async (w, extra) => {
    const { landEffect } = await import("../../module/engine/landing.mjs");
    const { entryOf } = await import("../../module/rules/effect-flow.mjs");
    return landEffect(entryOf({ id: "stun", duration: "1◈", chance: 80, ...extra }), {
      target: await live(FOE), source: { unitId: KARL, abilityId: null }, caster: w.actor(KARL), process: {},
    });
  };

  it("passes what names Stun and keeps the general resistance", async () => {
    await withSubjects(resisting([stunResist]), async ({ world: w }) => {
      w.dice.set("d100", 60);
      const passed = await land(w, { ignoresNamedDefences: true });
      // 80 less Magic Resistance C's 15: the named 50 is not counted.
      expect(passed.chance).toContain("vs 65%");
      expect(passed.outcome).toBe("applied");
      const plain = await land(w, {});
      expect(plain.chance).toContain("vs 15%");
      expect(plain.outcome).not.toBe("applied");
    }, WAR);
  });

  it("Debuff Immune still refuses it", async () => {
    await withSubjects(resisting([{ defId: "debuffImmune" }]), async ({ world: w }) => {
      // Refused before any die: an immunity is no chance.
      const out = await land(w, { ignoresNamedDefences: true });
      expect(out.outcome).toBe("blocked");
      expect(out.roll).toBeNull();
    }, WAR);
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

describe("Carolus Patricius (CP.*)", () => {
  const CAROLUS = "karlCarolus00001";
  const MASTER = "karlMaster000001";
  // Its 9×9 footprint, as a sized token reports it, cornered at (2,2).
  const NINE = Array.from({ length: 81 }, (_, n) => ({ i: 2 + Math.floor(n / 9), j: 2 + (n % 9), k: 1 }));
  const deck = (extra = {}) => ({
    from: "carolus-patricius", id: CAROLUS, footprint: NINE,
    ...extra, state: { ownerId: KARL, factionId: "A", activatedAt: 18, ...(extra.state ?? {}) },
  });
  const aboard = (from, id, factionId, panel, extra = {}) =>
    ({ from, id, panel: { ...panel, k: 1 }, ...extra, state: { factionId, ...(extra.state ?? {}) } });

  it("his ZON waived, −15% taken and +15% dealt but not NP for his side aboard; an enemy aboard gets nothing (CP.zon, CP.def, CP.atk)", async () => {
    await withSubjects([
      karl({ panel: { i: 6, j: 6, k: 1 } }), deck(),
      aboard("medea", ALLY, "A", { i: 5, j: 5 }),
      aboard("cu-chulainn", FOE, "B", { i: 4, j: 4 }),
    ], ({ unit }) => {
      const from = (id) => (unit(id).modifiers ?? []).filter((m) => m.source === "Carolus Patricius");
      expect((unit(KARL).suppressions ?? []).map((s) => s.scope)).toContain("zonPenalty");
      expect(from(KARL)).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "defUp", value: 15, npValue: 15 }),
        expect.objectContaining({ key: "atkUp", value: 15, npValue: 0 }),
      ]));
      expect(from(ALLY)).toHaveLength(2);
      expect((unit(ALLY).suppressions ?? []).map((s) => s.scope)).not.toContain("zonPenalty");
      expect(from(FOE)).toEqual([]);
    });
  });

  it("nothing crosses by Attack either way; an AoE NP reaches in at half, a Master not at all (CP.iso, readings 17)", async () => {
    await withSubjects([
      karl({ panel: { i: 6, j: 6, k: 1 }, state: { masterId: MASTER } }), deck(),
      aboard("master-advanced", MASTER, "A", { i: 5, j: 6 }),
      { from: "cu-chulainn", id: FOE, panel: { i: 12, j: 6 }, state: { factionId: "B" } },
    ], async ({ unit, board }) => {
      const { crossLevelLegal } = await import("../../module/rules/platforms.mjs");
      const foe = unit(FOE);
      expect(crossLevelLegal(foe, unit(KARL), board).ok).toBe(false);
      expect(crossLevelLegal(unit(KARL), foe, board).ok).toBe(false);
      expect(crossLevelLegal(foe, unit(KARL), board, { area: true }).ok).toBe(false);
      expect(crossLevelLegal(foe, unit(KARL), board, { area: true, isNP: true })).toMatchObject({ ok: true, factor: 0.5 });
      expect(crossLevelLegal(foe, unit(MASTER), board, { area: true, isNP: true }))
        .toMatchObject({ ok: false, reason: "aoeMastersImmune" });
    });
  });

  it("an AoE NP that touches the deck catches every Servant aboard, not only those it covers (reading 17)", async () => {
    await withSubjects([
      karl({ panel: { i: 6, j: 6, k: 1 } }), deck(),
      aboard("medea", ALLY, "A", { i: 9, j: 9 }),
      { from: "cu-chulainn", id: FOE, panel: { i: 2, j: 14 }, state: { factionId: "B" } },
    ], async ({ unit, board }) => {
      const { resolveTargets } = await import("../../module/rules/targeting/resolve.mjs");
      const spec = {
        anchor: { kind: "withinRange", range: 20 }, shape: { kind: "square", size: 3 },
        selection: { relations: ["enemy"], chooser: "all" },
      };
      const hit = (isNP) => resolveTargets(spec, unit(FOE), board, { panel: { i: 2, j: 11 }, reach: "attack", isNP })
        .units?.map((t) => t.unitId) ?? [];
      expect(hit(true)).toEqual(expect.arrayContaining([KARL, ALLY]));
      expect(hit(false)).toEqual([]);
    });
  });

  it("enemies are held aboard; an enemy Servant may try the escape, a Master or an ally may not (CP.escape, readings 14, 15)", async () => {
    await withSubjects([
      karl({ panel: { i: 6, j: 6, k: 1 } }), deck(),
      aboard("cu-chulainn", FOE, "B", { i: 3, j: 3 }),
      aboard("master-advanced", MASTER, "B", { i: 4, j: 4 }),
      aboard("medea", ALLY, "A", { i: 5, j: 5 }),
    ], async ({ unit, board }) => {
      const { canUnboard, escapeVerdict, escapeLanding } = await import("../../module/rules/platforms.mjs");
      const carolus = unit(CAROLUS);
      expect(canUnboard(unit(FOE), carolus)).toMatchObject({ ok: false, reason: "lockedAboardEnemy" });
      expect(canUnboard(unit(ALLY), carolus).ok).toBe(true);
      expect(escapeVerdict(unit(FOE), carolus, board).ok).toBe(true);
      expect(escapeVerdict(unit(MASTER), carolus, board).ok).toBe(false);
      expect(escapeVerdict(unit(ALLY), carolus, board).ok).toBe(false);
      expect(escapeVerdict({ ...unit(FOE), turnState: { moved: true } }, carolus, board))
        .toMatchObject({ ok: false, reason: "alreadyMoved" });
      // From (3,3) on a deck whose corner is (2,2): two panels out, straight, not the corner.
      expect([{ i: 1, j: 3 }, { i: 3, j: 1 }]).toContainEqual(escapeLanding(unit(FOE), carolus, board));
    });
  });

  it("an enemy enters on STR or AGI at A, paying 2 MOV (CP.enter, reading 16)", async () => {
    const { entryVerdict } = await import("../../module/rules/platforms.mjs");
    await withSubjects([karl(), { from: "heracles", id: FOE, panel: { i: 12, j: 6 }, state: { factionId: "B" } },
      { from: "medea", id: ALLY, panel: { i: 12, j: 8 }, state: { factionId: "B" } }], ({ unit }) => {
      const boarding = unit(CAROLUS)?.boarding ?? { requires: { anyParameter: ["str", "agi"], atLeast: "A" }, movCost: 2 };
      expect(entryVerdict(unit(FOE), boarding, 2).ok).toBe(true);
      expect(entryVerdict(unit(FOE), boarding, 1)).toMatchObject({ ok: false, reason: "entryMov" });
      expect(entryVerdict(unit(ALLY), boarding, 5)).toMatchObject({ ok: false, reason: "entryParameter" });
    });
  });

  it("its authored boarding rule is the one the engine reads", async () => {
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 } }), deck()], ({ unit }) => {
      expect(unit(CAROLUS).boarding).toMatchObject({ byRelation: "enemy", movCost: 2, requires: { anyParameter: ["str", "agi"], atLeast: "A" } });
      expect(unit(CAROLUS).countsAsHomeBase).toBe(true);
      expect(unit(CAROLUS).lifespan).toMatchObject({ duration: "2◈" });
      expect(unit(CAROLUS).endsWhenDefeated).toEqual(["owner", "ownerMaster"]);
    });
  });

  it("at the end of its life Karl may pay 200 Health for 1◈ more (CP.life, reading 20)", async () => {
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 }, owner: "p1" }), deck({ footprint: undefined, panel: { i: 2, j: 2, k: 1 }, state: { activatedAt: 12 } })], async ({ world: w }) => {
      const { FGTSocket } = await import("../../module/net/socket.mjs");
      const ask = vi.spyOn(FGTSocket, "ask").mockResolvedValue(["extend"]);
      const before = w.actor(KARL).system.health.value;
      const { runLifespans } = await import("../../module/engine/platforms.mjs");
      const ended = await runLifespans(18);
      expect(ended).toEqual([]);
      expect(ask).toHaveBeenCalledTimes(1);
      expect(w.actor(KARL).system.health.value).toBe(before - 200);
      expect(w.actor(CAROLUS).system.extendedBy).toBe(3);
      ask.mockRestore();
    }, { ...WAR, tokens: true });
  });

  it("the payment that fells Karl ends the Carolus that same Turn (CP.ext.floor, CP.end, found live)", async () => {
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 }, owner: "p1" }), deck({ footprint: undefined, panel: { i: 2, j: 2, k: 1 }, state: { activatedAt: 12 } })], async ({ world: w }) => {
      await w.actor(KARL).update({ "system.health.value": 200 });
      const { FGTSocket } = await import("../../module/net/socket.mjs");
      const ask = vi.spyOn(FGTSocket, "ask").mockResolvedValue(["extend"]);
      const { runLifespans } = await import("../../module/engine/platforms.mjs");
      const ended = await runLifespans(18);
      ask.mockRestore();
      expect(w.actor(KARL).system.defeated).toBe(true);
      expect(ended).toEqual([CAROLUS]);
    }, { ...WAR, tokens: true });
  });

  it("his Master's fall ends it though it freed Karl: the Master it was raised with is asked (CP.end, found live)", async () => {
    const MASTER = "karlMaster000001";
    await withSubjects([
      karl({ panel: { i: 6, j: 6, k: 1 } }),
      deck({ footprint: undefined, panel: { i: 2, j: 2, k: 1 }, state: { activatedAt: 17, ownerMasterId: MASTER } }),
      { from: "master-advanced", id: MASTER, panel: { i: 7, j: 6 }, state: { factionId: "A", defeated: true } },
    ], async () => {
      const { runLifespans } = await import("../../module/engine/platforms.mjs");
      expect(await runLifespans(18)).toEqual([CAROLUS]);
    }, { ...WAR, tokens: true });
    // ...and the summon writes it, since `masterId` is gone once he falls.
    expect(readFileSync("module/engine/skill-use.mjs", "utf8")).toMatch(/data\.system\.ownerMasterId = actor\.system\?\.masterId \?\? null;/);
  });

  it("a Unit that cannot Move cannot try the escape (CP.escape, found live)", async () => {
    await withSubjects([
      karl({ panel: { i: 6, j: 6, k: 1 } }), deck(),
      { ...aboard("cu-chulainn", FOE, "B", { i: 3, j: 3 }), effects: [{ defId: "stun" }] },
    ], async ({ unit, board }) => {
      const { escapeVerdict } = await import("../../module/rules/platforms.mjs");
      expect(escapeVerdict(unit(FOE), unit(CAROLUS), board)).toMatchObject({ ok: false, reason: "cannotAct" });
    });
  });
});

describe("Karl Cannons (KC.*)", () => {
  const CAROLUS = "karlCarolus00001";
  const NINE = Array.from({ length: 81 }, (_, n) => ({ i: 2 + Math.floor(n / 9), j: 2 + (n % 9), k: 1 }));
  const deck = { from: "carolus-patricius", id: CAROLUS, footprint: NINE, state: { ownerId: KARL, factionId: "A", activatedAt: 18 } };
  const cannons = async () => {
    const { loadSource } = await import("../../tools/lib/load.mjs");
    const { files } = await loadSource("packs/_source");
    return files.find((f) => f.doc?.id === "karl-cannons").doc;
  };

  it("Range 5 from the deck's edge and under it, ground only, through the isolation (KC.range, KC.under, KC.iso, reading 22)", async () => {
    const spec = (await cannons()).targeting;
    await withSubjects([
      karl({ panel: { i: 6, j: 6, k: 1 } }), deck,
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 15 }, state: { factionId: "B" } },
      { from: "heracles", id: "karlUnder0000001", panel: { i: 9, j: 9 }, state: { factionId: "B" } },
      { from: "medea", id: ALLY, panel: { i: 9, j: 10, k: 1 }, state: { factionId: "A" } },
    ], async ({ unit, board }) => {
      const { resolveTargets } = await import("../../module/rules/targeting/resolve.mjs");
      const at = (panel) => resolveTargets(spec, unit(KARL), board, { panel, reach: "attack" });
      // Column 15 is 5 past the deck's edge at column 10; from Karl at 6 it is 9.
      const far = at({ i: 6, j: 15 });
      expect(far.errors).toEqual([]);
      expect(far.units.map((t) => t.unitId)).toEqual([FOE]);
      // Under the deck: the Unit on the ground is hit, Medea aboard above it is not.
      expect(at({ i: 9, j: 9 }).units.map((t) => t.unitId)).toEqual(["karlUnder0000001"]);
      expect(at({ i: 6, j: 16 }).errors.join(" ")).toMatch(/Range is 5/);
    }, { settings: { boardSize: 20 } });
  });

  it("only while his Carolus stands (KC.only)", async () => {
    const { meetsRequirement } = await import("../../module/rules/items.mjs");
    const req = (await cannons()).requirements[0];
    const k = { id: KARL };
    const up = { units: [{ id: CAROLUS, kind: "platform", contentId: "carolus-patricius", ownerId: KARL }] };
    expect(meetsRequirement(req, { unit: k, board: up })).toBe(true);
    expect(meetsRequirement(req, { unit: k, board: { units: [] } })).toBe(false);
    expect(meetsRequirement(req, { unit: { id: "someoneElse" }, board: up })).toBe(false);
  });
});

describe("Carolus Patricius Auctoritas (U.*, U1.*, U2.*)", () => {
  const CPA = "karlCpa000000001";
  const MASTER = "karlMaster000001";
  const FOUR = (i, j) => [0, 1, 2, 3].map((n) => ({ i: i + Math.floor(n / 2), j: j + (n % 2), k: 1 }));
  const cpa = (extra = {}) => ({
    from: "carolus-patricius-auctoritas", id: CPA, footprint: FOUR(6, 6),
    ...extra, state: { ownerId: KARL, factionId: "A", activatedAt: 18, ...(extra.state ?? {}) },
  });
  const withMaster = (extra = {}) => karl({ ...extra, state: { masterId: MASTER, ...(extra.state ?? {}) } });
  const master = (panel = { i: 6, j: 7, k: 1 }) => ({ from: "master-advanced", id: MASTER, panel, state: { factionId: "A" } });

  it("one NP, a clock per usage: each locks the other and Carolus Patricius, and the reverse (U.lock, U.cp, CP.lock)", async () => {
    await withSubjects([karl()], ({ world: w }) => {
      const reqs = (id) => abilityOf(w, KARL, id).system.requirements;
      expect(reqs("karl-cpa-sanctus")).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "abilityOffCooldown", abilityIds: ["karl-carolus-patricius", "karl-cpa-auctoritas"] }),
        expect.objectContaining({ kind: "platformInactive", contentId: "carolus-patricius" }),
      ]));
      expect(reqs("karl-cpa-auctoritas")).toEqual([
        expect.objectContaining({ kind: "abilityOffCooldown", abilityIds: ["karl-carolus-patricius", "karl-cpa-sanctus"] }),
      ]);
      expect(reqs("karl-carolus-patricius")).toEqual([
        expect.objectContaining({ kind: "abilityOffCooldown", abilityIds: ["karl-cpa-sanctus", "karl-cpa-auctoritas"] }),
      ]);
    });
  });

  it("the CPA: 3000, Agility 8, his Luck, MOV 3, Range 4, BA 200/200, Giant and Mechanical, 2x2 (U2.hp to U2.attr, reading 24)", async () => {
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 } }), cpa()], ({ unit }) => {
      const c = unit(CPA);
      expect(c.maxHealth ?? c.health?.max).toBe(3000);
      expect(c.agility).toBe(8);
      expect(c.luck).toBe(unit(KARL).luck);
      expect(c.mov).toBe(3);
      expect(c.range).toBe(4);
      expect(c.baseAttack).toEqual(expect.objectContaining({ str: 200, mag: 200 }));
      expect(c.attributes).toEqual(expect.arrayContaining(["giant", "mechanical", "large"]));
      expect(c.panels).toHaveLength(4);
      expect(c.ignoresOccupancy).toBe(true);
    });
  });

  it("its Normal Attack is STR at 1 to 2 and MAG at 3 or more (U2.na)", async () => {
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 } }), cpa()], ({ unit }) => {
      expect(normalAttackAt(unit(KARL), 2, { platform: unit(CPA) }).sources).toEqual([{ unit: "mount", component: "str", factor: 1 }]);
      expect(normalAttackAt(unit(KARL), 3, { platform: unit(CPA) }).sources).toEqual([{ unit: "mount", component: "mag", factor: 1 }]);
    });
  });

  it("a Normal Attack at 1 to 2 asks to push the DU back one panel (U2.kb)", async () => {
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 } }), cpa(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B" } }], async ({ unit }) => {
      const handler = (unit(CPA).eventHandlers ?? []).find((h) => h.events?.includes("damageStepEnd"));
      expect(handler?.targetPredicate).toEqual(["attack:kind:normal", "attack:range:lte:2"]);
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const out = fireEvent("damageStepEnd", [unit(CPA)], {
        tick: 18, turnsPerRound: 3, victim: { unitId: FOE },
        options: new Set(["attack:kind:normal", "attack:range:lte:2"]),
      });
      expect(out.filter((i) => i.entry?.kind === "knockback").map((i) => i.entry))
        .toEqual([expect.objectContaining({ unitId: FOE, fromId: CPA, panels: 1 })]);
    }, WAR);
  });

  it("walking onto Units on the ground beneath it pushes them clear (U2.move)", async () => {
    const { knockbackPlan } = await import("../../module/rules/movement.mjs");
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 } }), cpa(),
      { from: "cu-chulainn", id: FOE, panel: { i: 9, j: 9 }, state: { factionId: "B" } }], ({ unit, board }) => {
      const plan = knockbackPlan(unit(CPA), [{ i: 8, j: 8 }, { i: 8, j: 9 }, { i: 9, j: 8 }, { i: 9, j: 9 }], board);
      expect(plan.map((p) => p.unitId)).toEqual([FOE]);
    });
  });

  it("no Attack reaches Karl or his Master aboard it, an area included (U2.safe, reading 31)", async () => {
    await withSubjects([withMaster({ panel: { i: 6, j: 6, k: 1 } }), cpa(), master(),
      { from: "cu-chulainn", id: FOE, panel: { i: 10, j: 6 }, state: { factionId: "B" } }], async ({ unit, board }) => {
      const { crossLevelLegal } = await import("../../module/rules/platforms.mjs");
      for (const id of [KARL, MASTER]) {
        expect(crossLevelLegal(unit(FOE), unit(id), board).ok).toBe(false);
        expect(crossLevelLegal(unit(FOE), unit(id), board, { area: true, isNP: true }).ok).toBe(false);
      }
      // ...the CPA itself may be struck.
      expect(crossLevelLegal(unit(FOE), unit(CPA), board).ok).toBe(true);
    });
  });

  it("its toll is every Turn's end: 30 if it Acted, 10 if not, and it ends instead when that cannot be paid (U2.upkeep, readings 27, 29)", async () => {
    const { upkeepDue, upkeepPlan } = await import("../../module/rules/platforms.mjs");
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 } }), cpa()], ({ unit }) => {
      const upkeep = unit(CPA).upkeep;
      expect(upkeepDue(upkeep, { tick: 18, createdAt: 18 }).due).toBe(true);
      expect(upkeepDue(upkeep, { tick: 18, lastUpkeepAt: 18 }).due).toBe(false);
      expect(upkeepDue(upkeep, { tick: 18, atRoundBoundary: true, round: 6 }).due).toBe(false);
      expect(upkeep.cost).toMatchObject({ amount: 10, amountIfActed: 30, payer: "ownerMaster" });
      expect(upkeepPlan({ ...upkeep, cost: { ...upkeep.cost, amount: 30 } }, { due: true, payerHealth: 30 })).toEqual({ close: "upkeep" });
      expect(upkeepPlan(upkeep, { due: true, payerHealth: 11 })).toMatchObject({ charge: 10 });
    });
    const fields = readFileSync("module/engine/fields.mjs", "utf8");
    expect(fields).toMatch(/acted \? upkeep\.cost\?\.amountIfActed : null/);
    expect(readFileSync("module/engine/scheduler-hooks.mjs", "utf8")).toMatch(/runUpkeep\(tick, \{ ended: board \}\)/);
  });

  it("raising it costs his Master nothing; Usage 1 from it costs the NP's price x 1.5 + 30 (U2.upkeep.instead, U2.u1.cost, reading 28)", async () => {
    const { additionalCostsFor, npCostAt } = await import("../../module/rules/costs.mjs");
    await withSubjects([withMaster({ panel: { i: 6, j: 6, k: 1 } }), cpa(), master()], ({ unit, world: w }) => {
      const sanctus = abilityOf(w, KARL, "karl-cpa-sanctus");
      const price = npCostAt({ rank: "A++", unit: unit(KARL), master: unit(MASTER) }).amount;
      expect(price).toBeGreaterThan(0);
      const extra = additionalCostsFor({ ability: sanctus, self: unit(KARL), master: unit(MASTER) });
      expect(extra).toEqual([expect.objectContaining({ kind: "masterHealth", amount: Math.floor(price * 0.5) + 30 })]);
      const raise = additionalCostsFor({ ability: abilityOf(w, KARL, "karl-cpa-auctoritas"), self: unit(KARL), master: unit(MASTER) });
      expect(raise).toEqual([expect.objectContaining({ amount: 0, supersedes: ["npCost"] })]);
    });
    await withSubjects([withMaster(), master({ i: 6, j: 7 })], ({ unit, world: w }) => {
      expect(additionalCostsFor({ ability: abilityOf(w, KARL, "karl-cpa-sanctus"), self: unit(KARL), master: unit(MASTER) })).toEqual([]);
    });
  });

  it("Usage 1 while it stands: Range 7 from its edge, the CPA's Base Attack (U2.u1.range, U2.u1.ba)", async () => {
    const { loadSource } = await import("../../tools/lib/load.mjs");
    const { files } = await loadSource("packs/_source");
    const sanctus = files.find((f) => f.doc?.id === "karl-cpa-sanctus").doc;
    expect(sanctus.damage.instances.map((x) => x.base.sources[0])).toEqual([
      { unit: "platform:carolus-patricius-auctoritas", component: "str", factor: 1 },
      { unit: "platform:carolus-patricius-auctoritas", component: "mag", factor: 1 },
    ]);
    await withSubjects([karl({ panel: { i: 1, j: 1 } }), cpa(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 14 }, state: { factionId: "B" } }], async ({ unit, board }) => {
      const { resolveTargets } = await import("../../module/rules/targeting/resolve.mjs");
      // Column 14 is 7 past the CPA's edge at 7; from Karl at (1,1) it is 13.
      const r = resolveTargets(sanctus.targeting, unit(KARL), board, { panel: { i: 6, j: 14 }, reach: "attack", isNP: true });
      expect(r.errors).toEqual([]);
      expect(r.units.map((t) => t.unitId)).toEqual([FOE]);
    }, { settings: { boardSize: 20 } });
  });

  it("Usage 1 from it ends it at the end of that Turn (U2.u1.end)", async () => {
    await withSubjects([karl({ panel: { i: 6, j: 6, k: 1 } }), cpa()], ({ unit }) => {
      expect(unit(CPA).endsWhenOwnerUses).toEqual(["karl-cpa-sanctus"]);
    });
    const body = readFileSync("module/engine/platforms.mjs", "utf8");
    expect(body).toMatch(/endsWhenOwnerUses \?\? \[\]\)\.some\(\(id\) => usedThisTurn\.includes\(id\)\)/);
  });
});

describe("found live (#351)", () => {
  it("two sighting sweeps at once fire one first sight", async () => {
    await withSubjects([
      karl({ panel: { i: 6, j: 6 } }),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 7 }, state: { factionId: "B" } },
    ], async () => {
      const scheduler = await import("../../module/engine/scheduler.mjs");
      const { checkSightings } = await import("../../module/engine/vision.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const fired = [];
      const spy = vi.spyOn(scheduler, "fireEvent").mockImplementation((event, units, ctx) => {
        if (event === "unitFirstSeen") fired.push(`${units[0].id}:${ctx.victim.unitId}`);
        return [];
      });
      await Promise.all([checkSightings({ board }), checkSightings({ board })]);
      spy.mockRestore();
      expect(fired.filter((f) => f === `${KARL}:${FOE}`)).toHaveLength(1);
    }, WAR);
  });

  it("a refusal names the ability it waits on, in the Skill path and the Attack path", async () => {
    await withSubjects([karl()], async () => {
      const { refusalWords } = await import("../../module/apps/actor-sheet/sheet.mjs");
      const format = vi.spyOn(game.i18n, "format");
      refusalWords("abilityOffCooldown", { names: "Carolus Patricius" });
      expect(format).toHaveBeenCalledWith("FGT.Ability.CoolingNamed", { names: "Carolus Patricius" });
      format.mockRestore();
    }, WAR);
    const preflight = readFileSync("module/engine/attack-preflight.mjs", "utf8");
    expect(preflight).toMatch(/case "abilityOffCooldown":\s*\n\s*if \(d\.names\) return game\.i18n\.format\("FGT\.Ability\.CoolingNamed"/);
  });

  it("a mount's handlers hear its rider's Normal Attack, at both steps (U2.kb)", () => {
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    expect(attack.match(/const hearers = swingHearers\(attacker, state, board\);/g)).toHaveLength(2);
    expect(attack).toMatch(/fireEvent\("damageStepEnd", hearers,/);
    expect(attack).toMatch(/fireEvent\("damageDealt", hearers,/);
  });

  it("the deck it replaces lands its owner and his Master where the new one stands (U2.ontop, U2.master)", () => {
    const skill = readFileSync("module/engine/skill-use.mjs", "utf8");
    expect(skill).toMatch(/await destroyPlatform\(\{ platformId: p\.id, reason: "replaced", landings \}\);/);
    const platforms = readFileSync("module/engine/platforms.mjs", "utf8");
    expect(platforms).toMatch(/\.\.\.landings \};/);
  });

  it("a platform that falls says so, not that its owner did", () => {
    expect(readFileSync("module/engine/io.mjs", "utf8")).toMatch(/reason: id === unitId \? "destroyed" : "ownerDefeat"/);
  });

  it("every toll, entry and extension is said by name", () => {
    const fields = readFileSync("module/engine/fields.mjs", "utf8");
    expect(fields).toMatch(/acted \? "FGT\.Field\.UpkeepActed" : "FGT\.Field\.Upkeep"/);
    const platforms = readFileSync("module/engine/platforms.mjs", "utf8");
    expect(platforms).toMatch(/game\.i18n\.format\("FGT\.Platform\.Entered"/);
    expect(platforms).toMatch(/game\.i18n\.format\("FGT\.Platform\.ExtendTitle", \{ platform: platform\.name/);
  });
});
