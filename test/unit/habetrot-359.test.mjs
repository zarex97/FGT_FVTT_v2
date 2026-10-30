/**
 * Summer Habetrot (Pretender), audit #359: her sheet through the real projection,
 * and the pieces she brought: the Pretender class template, the Shisarot Form
 * with its doors and its paid extension, Guardian Faerie's two roles and its
 * negation of keyed damage, Counts of Crit Chance, Max Health and the board
 * around her, an Injury Roll threshold per Unit (#310), Def Dwn (Total) and a
 * held "extra damage" multiplier.
 * @see docs/superpowers/specs/2026-10-30-summer-habetrot-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const HAB = "habetrot00000001";
const FOE = "habetrotFoe00001";
const FOE2 = "habetrotFoe00002";
const ALLY = "habetrotAlly0001";
const ALLY2 = "habetrotAlly0002";
const MASTER = "habetrotMaster01";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
const habetrot = (extra = {}) => ({
  from: "summer-habetrot", id: HAB, panel: { i: 6, j: 6 }, ...extra,
  state: { factionId: "A", ...(extra.state ?? {}) },
});
const foe = (from = "cu-chulainn", panel = { i: 6, j: 8 }, id = FOE, extra = {}) => ({ from, id, panel, ...extra, state: { factionId: "B", ...(extra.state ?? {}) } });
const NOTHING = (...ids) => Object.fromEntries(ids.map((id) => [id, ["nothing", "declined", "declined", "declined", "declined"]]));
const live = async (id) => {
  const { currentBoard } = await import("../../module/engine/board.mjs");
  return currentBoard().units.find((u) => u.id === id) ?? null;
};
const inForm = [{ defId: "shisarotForm", expiry: 40 }];

describe("the sheet, projected (ST.*)", () => {
  it("Pretender, Neutral Good, Fairy Britain and Scotland; B- C++ C C C; 1000, MOV 5, Range 2; BA 115/150; 2◈", async () => {
    await withSubjects([habetrot()], ({ unit, world: w }) => {
      const h = unit(HAB);
      const s = w.actor(HAB).system;
      expect(s.trueName).toBe("Habetrot, Shisa");
      expect(h.servantClasses).toEqual(["pretender"]);
      expect(s.alignment).toMatchObject({ order: "neutral", morality: "good" });
      expect([...s.region]).toEqual(["fairyBritain", "scotland"]);
      expect(Object.fromEntries(Object.entries(h.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "B-", end: "C++", agi: "C", mag: "C", luc: "C" });
      expect(h.attributes).toEqual(expect.arrayContaining(["female", "servant", "earth", "fae", "humanoid", "fairytale", "nonHominidae", "animalistic"]));
      expect(h.attributes).not.toContain("hominidae");
      // The table beats the sheet (§46.6): END C++ derives 1200, the sheet prints 1000.
      expect(s.baseHealth).toBe(1000);
      expect(h.maxHealth ?? h.health?.max).toBe(1200);
      expect(h.mov).toBe(5);
      expect(h.range).toBe(2);
      expect(h.baseAttack).toEqual(expect.objectContaining({ str: 115, mag: 150 }));
      expect(s.sustainability).toBe("2◈");
      expect(s.resources.shiisaa).toMatchObject({ value: 0, max: 3 });
    });
  });

  it("her Regions border as ruled: Scotland beside England, Fairy Britain beside nothing (ruling 3)", async () => {
    const { regionsAdjacent } = await import("../../module/rules/environment.mjs");
    expect(regionsAdjacent("scotland", "england")).toBe(true);
    expect(regionsAdjacent("england", "scotland")).toBe(true);
    expect(regionsAdjacent("fairyBritain", "england")).toBe(false);
  });
});

describe("A Strange Giant Shadow (SH.*) and the Form's Normal Attack (SF.9)", () => {
  it("out of the Form: STR at 1, MAG and Water from 2; in it: no Water, a 2x2 every Unit in it", async () => {
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    await withSubjects([habetrot()], ({ unit }) => {
      const h = unit(HAB);
      expect(normalAttackAt(h, 1).component).toBe("str");
      expect(normalAttackAt(h, 2)).toMatchObject({ component: "mag", element: "water" });
      expect(h.normalAttack.shape ?? null).toBe(null);
    });
    await withSubjects([habetrot({ effects: inForm })], ({ unit }) => {
      const h = unit(HAB);
      expect(normalAttackAt(h, 1).component).toBe("str");
      expect(normalAttackAt(h, 3)).toMatchObject({ component: "mag", element: null });
      expect(h.normalAttack.shape).toEqual({ kind: "square", size: 2 });
      expect(h.normalAttack.relations).toEqual(["enemy", "ally", "neutral"]);
    });
  });

  it("Evade -1d12 out of the Form only; in it, Agility and Evade rolls doubled (SH.2, SF.7)", async () => {
    await withSubjects([habetrot()], ({ unit }) => {
      const evade = unit(HAB).checkModifiers.filter((m) => m.check === "evade");
      expect(evade.some((m) => m.roll?.formula === "1d12" && m.roll?.multiplier === -1)).toBe(true);
      expect(evade.some((m) => m.rollFactor === 2)).toBe(false);
    });
    await withSubjects([habetrot({ effects: inForm })], ({ unit }) => {
      const mods = unit(HAB).checkModifiers;
      expect(mods.some((m) => m.check === "evade" && m.roll?.formula === "1d12")).toBe(false);
      expect(mods.some((m) => m.check === "evade" && m.rollFactor === 2)).toBe(true);
      expect(mods.some((m) => m.check === "agility" && m.rollFactor === 2)).toBe(true);
    });
  });
});

describe("the Shisarot Form, in force (SF.*)", () => {
  it("2x2, Large, Max Health 2000, no Block, Injury threshold 200 (SF.1-3, 6, 7)", async () => {
    const { injuryThresholdOf } = await import("../../module/rules/damage/pipeline.mjs");
    await withSubjects([habetrot()], ({ unit }) => {
      expect(injuryThresholdOf(unit(HAB))).toBe(100);
      expect(unit(HAB).attributes).not.toContain("large");
    });
    await withSubjects([habetrot({ effects: inForm })], ({ unit, world: w }) => {
      const h = unit(HAB);
      expect(h.attributes).toContain("large");
      // +100% of her original 1200 (SF.3).
      expect(w.actor(HAB).system.health.max).toBe(2400);
      expect(injuryThresholdOf(h)).toBe(200);
      expect((h.forbiddenReactions ?? []).some((r) => (r.reaction ?? r) === "block")).toBe(true);
      expect(w.actor(HAB).system.footprint).toMatchObject({ w: 2, h: 2 });
    });
  });
});

describe("Pretender: The One who Wears a Role (PR.*)", () => {
  it("the Active offers seven Classes and lands Pretender (>X) for 2◈; refused while one is held", async () => {
    await withSubjects([habetrot()], async ({ world: w }) => {
      w.answer({ title: "Pretender: The One who Wears a Role", pick: ["rider"] });
      const pretender = abilityOf(w, HAB, "class-pretender");
      const out = await castSkill(w, { caster: HAB, ability: pretender.id });
      expect(out.ok, out.reason).toBe(true);
      const held = effectsOf(w, HAB, "pretenderRider");
      expect(held).toHaveLength(1);
      expect(held[0].system.expiry).toBe(18 + 6);
      await pretender.update({ "system.cooldown.remaining": 0 });
      const again = await castSkill(w, { caster: HAB, ability: pretender.id });
      expect(again.ok).toBe(false);
    }, WAR);
  });

  it("Skill Seal removes every Pretender effect, Unremovable as it is (PR.seal, ruling 8)", async () => {
    const { sealedEffects } = await import("../../module/engine/seal-ends.mjs");
    await withSubjects([habetrot({ effects: [{ defId: "pretenderSaber", expiry: 40 }] })], ({ world: w }) => {
      expect(sealedEffects(w.actor(HAB)).map((e) => e.system.defId)).toEqual(["pretenderSaber"]);
    });
  });
});

describe("Counts she brought (GD.3, GD.4, NP.1, NP.2)", () => {
  it("Crit Chance above 50 in whole percents, Max Health, and the board within a distance", async () => {
    const { countOf } = await import("../../module/rules/count.mjs");
    await withSubjects([
      habetrot({ effects: [{ defId: "critUp", magnitude: 15, expiry: 40 }] }),
      foe("cu-chulainn", { i: 6, j: 9 }),
      foe("medea", { i: 6, j: 10 }, FOE2),
      { from: "medea", id: ALLY, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const self = board.units.find((u) => u.id === HAB);
      expect(countOf({ of: "critChance", above: 50 }, { self, board })).toBe(15);
      expect(countOf({ of: "maxHealth" }, { self, board })).toBe(1200);
      expect(countOf({ of: "board", relations: ["enemy"], within: 3, standing: true }, { self, board })).toBe(1);
      expect(countOf({ of: "board", relations: ["ally", "self"], within: 2, standing: true }, { self, board })).toBe(2);
      void w;
    }, WAR);
  });
});

describe("Chibirā Sanu (NP.*)", () => {
  const NP_NAME = "Chibirā Sanu・Habetrot: The Lion's Gallant Figure that Stirs the Seas";

  it("buffs counted first, then the Form and its Pretender, then the 2x2 hit (NP.1, NP.2, NP.form, SF.10)", async () => {
    await withSubjects([
      habetrot(),
      foe("cu-chulainn", { i: 6, j: 9 }),
      { from: "medea", id: ALLY, panel: { i: 6, j: 5 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      w.answer({ title: NP_NAME, pick: ["lancer"] });
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 99);
      const np = abilityOf(w, HAB, "habetrot-chibira-sanu");
      await playAttack(w, { attacker: HAB, ability: np.id, placement: { panel: { i: 6, j: 9 } }, react: NOTHING(FOE) });
      const form = effectsOf(w, HAB, "shisarotForm");
      expect(form).toHaveLength(1);
      expect(form[0].system.expiry).toBe(18 + 9);
      const pretender = effectsOf(w, HAB, "pretenderLancer");
      expect(pretender).toHaveLength(1);
      expect(pretender[0].system.expiry ?? null).toBe(null);
      // NP DmUp 10 per enemy within 3: Cú at 3. Atk Up (X+1)0, X = herself and Medea: 30, NP 20.
      expect(effectsOf(w, HAB, "npDmUp")[0]?.system?.magnitude).toBe(10);
      const atk = effectsOf(w, HAB, "atkUp")[0]?.system;
      expect(atk?.magnitude).toBe(30);
      expect(atk?.npMagnitude).toBe(20);
      // Her current doubled, her maximum 2400.
      expect(w.actor(HAB).system.health.max).toBe(2400);
      expect(w.actor(HAB).system.health.value).toBe(2400);
      expect(w.actor(FOE).system.health.value).toBeLessThan(w.actor(FOE).system.health.max);
    }, WAR);
  });

  it("used in the Form, 3◈ more of it and no new Pretender (NP.extend, ruling 24)", async () => {
    await withSubjects([
      habetrot({ effects: [{ defId: "shisarotForm", expiry: 20 }, { defId: "pretenderSaber" }] }),
      foe("cu-chulainn", { i: 6, j: 9 }),
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 99);
      const np = abilityOf(w, HAB, "habetrot-chibira-sanu");
      await playAttack(w, { attacker: HAB, ability: np.id, placement: { panel: { i: 6, j: 9 } }, react: NOTHING(FOE) });
      expect(effectsOf(w, HAB, "shisarotForm")[0].system.expiry).toBe(29);
      expect(effectsOf(w, HAB, "pretenderSaber")).toHaveLength(1);
      expect(w.asked.some((a) => a.title === NP_NAME)).toBe(false);
    }, WAR);
  });
});

const loadCommands = async () => {
  const { CommandSpellRegistry } = await import("../../module/rules/cs-registry.mjs");
  CommandSpellRegistry.load(readdirSync("packs/_source/command-spells").filter((f) => f.endsWith(".yml")).map((f) => {
    const y = parse(readFileSync(`packs/_source/command-spells/${f}`, "utf8"));
    return { name: y.name, system: { ...y, contentId: y.id } };
  }));
};
const withMaster = (extra = {}) => [
  habetrot({ ...extra, state: { masterId: MASTER, ...(extra.state ?? {}) } }),
  { from: "master-advanced", id: MASTER, panel: { i: 6, j: 5 }, state: { factionId: "A" } },
];

describe("her Master's Command Spells (SH.3, SF.11)", () => {
  it("offered for her only while she is out of the Form; spent, the Form, its Pretender, her Health doubled", async () => {
    await loadCommands();
    await withSubjects(withMaster(), async ({ world: w }) => {
      await w.actor(MASTER).update({ "system.commandSpells": 3 });
      const { offerCommands, spendCommandSpell } = await import("../../module/engine/command-spells.mjs");
      expect(offerCommands({ masterId: MASTER, window: "ownTurn", context: { servantId: HAB } }).map((c) => c.id)).toContain("cs-shisarot-form");
      w.answer({ title: "A Strange Giant Shadow was Sighted on Majimun Island", pick: ["caster"] });
      const before = w.actor(HAB).system.health.value;
      const out = await spendCommandSpell({ masterId: MASTER, commandId: "cs-shisarot-form", window: "ownTurn", context: { servantId: HAB } });
      expect(out).toMatchObject({ ok: true, cost: 1 });
      expect(effectsOf(w, HAB, "shisarotForm")[0]?.system?.expiry).toBe(18 + 9);
      expect(effectsOf(w, HAB, "pretenderCaster")).toHaveLength(1);
      expect(w.actor(HAB).system.health.value).toBe(before * 2);
      expect(abilityOf(w, HAB, "habetrot-chibira-sanu").system.cooldown.remaining).toBe(0);
      expect(offerCommands({ masterId: MASTER, window: "ownTurn", context: { servantId: HAB } }).map((c) => c.id)).not.toContain("cs-shisarot-form");
    }, WAR);
  });

  it("the extension's price buys 3◈, every Skill -1◈ and a charge on her next Attack", async () => {
    await withSubjects(withMaster({ effects: [{ defId: "shisarotForm", expiry: 18 }] }), async ({ world: w }) => {
      await w.actor(MASTER).update({ "system.commandSpells": 3 });
      await abilityOf(w, HAB, "habetrot-sacred-guardian-beast").update({ "system.cooldown.remaining": 6 });
      w.answer({ title: "FGT.EffectExtension.Title", pick: ["extend"] });
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { offerEffectExtensions } = await import("../../module/engine/effect-extension.mjs");
      expect(await offerEffectExtensions(currentBoard(), { tick: 18, turnsPerRound: 3 })).toBe(true);
      expect(effectsOf(w, HAB, "shisarotForm")[0].system.expiry).toBe(27);
      expect(abilityOf(w, HAB, "habetrot-sacred-guardian-beast").system.cooldown.remaining).toBe(3);
      expect(effectsOf(w, HAB, "shisarotCharge")).toHaveLength(1);
      expect(w.actor(MASTER).system.commandSpells).toBe(2);
    }, WAR);
  });
});

describe("Divine Beast's Rage (DB.*) and Ocean Stirring (OS.*)", () => {
  it("in the Form a non-Attack Skill gains a Counter; the third pays out at once", async () => {
    await withSubjects([habetrot({ effects: inForm, state: { resources: { shiisaa: { value: 2, max: 3 } } } })], async ({ world: w }) => {
      await abilityOf(w, HAB, "habetrot-great-decisive-battle").update({ "system.cooldown.remaining": 9 });
      const out = await castSkill(w, { caster: HAB, ability: abilityOf(w, HAB, "habetrot-sacred-guardian-beast").id });
      expect(out.ok, out.reason).toBe(true);
      expect(w.actor(HAB).system.resources.shiisaa.value).toBe(0);
      expect(effectsOf(w, HAB, "npDmUpOnce")[0]?.system?.magnitude).toBe(15);
      expect(effectsOf(w, HAB, "dmgUpKaiju")[0]?.system?.magnitude).toBe(30);
      expect(effectsOf(w, HAB, "eAtkUp")[0]?.system?.magnitude).toBe(30);
      // Sacred Guardian Beast's own 12 cut 3, Great Decisive Battle's 9 cut 6.
      expect(abilityOf(w, HAB, "habetrot-sacred-guardian-beast").system.cooldown.remaining).toBe(9);
      expect(abilityOf(w, HAB, "habetrot-great-decisive-battle").system.cooldown.remaining).toBe(3);
    }, WAR);
  });

  it("out of the Form no Counter is gained (DB.gate)", async () => {
    await withSubjects([habetrot()], async ({ world: w }) => {
      const out = await castSkill(w, { caster: HAB, ability: abilityOf(w, HAB, "habetrot-sacred-guardian-beast").id });
      expect(out.ok, out.reason).toBe(true);
      expect(w.actor(HAB).system.resources.shiisaa.value).toBe(0);
    }, WAR);
  });

  it("at her own Turn's start in the Form, NP ready: NP restarted, three buffs, Form +1◈", async () => {
    const { beginTurn } = await import("../../module/engine/scheduler.mjs");
    await withSubjects([habetrot({ effects: inForm })], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const intents = beginTurn(currentBoard(), { tick: 19, turnsPerRound: 3, activeFactionId: "A", rolls: {} });
      const kinds = intents.map((i) => i.t);
      expect(intents.some((i) => i.t === "cooldown" && i.ticks === 24 && i.mode === "set")).toBe(true);
      expect(intents.filter((i) => i.t === "applyEffect").map((i) => i.effect?.defId)).toEqual(expect.arrayContaining(["atkUp", "dmgUpLarge", "sCritUpShiisa"]));
      expect(intents.some((i) => i.t === "extendEffect" && i.defId === "shisarotForm")).toBe(true);
      void kinds;
      const theirs = beginTurn(currentBoard(), { tick: 19, turnsPerRound: 3, activeFactionId: "B", rolls: {} });
      expect(theirs.some((i) => i.t === "extendEffect")).toBe(false);
    }, WAR);
  });
});

const resultsOf = (w) => w.messages.contents.map((m) => m.flags?.fgt?.result).filter(Boolean);

describe("damage she brought into the pipeline", () => {
  it("Def Dwn (Total) multiplies the Total taken; Shisarot's Charge multiplies the next Attack (BM.def, SF.11.next)", async () => {
    await withSubjects([
      habetrot({ effects: [{ defId: "shisarotCharge" }] }),
      foe("cu-chulainn", { i: 6, j: 7 }, FOE, { effects: [{ defId: "defDwnTotal", magnitude: 25, expiry: 40 }] }),
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 99);
      await playAttack(w, { attacker: HAB, target: FOE, react: NOTHING(FOE) });
      const text = JSON.stringify(resultsOf(w)[0]?.breakdown ?? []);
      expect(text).toContain("totalDefDwn");
      expect(text).toContain("damageMultiplier");
      // Spent by that Attack.
      expect(effectsOf(w, HAB, "shisarotCharge")).toHaveLength(0);
    }, WAR);
  });

  it("Pretender's Passive: +50% on an Alter Ego, gone while a Pretender effect is held (PR.ae.dealt, PR.negate)", async () => {
    const swing = async (effects) => {
      let text = "";
      await withSubjects([habetrot({ effects }), foe("mannanan", { i: 6, j: 7 })], async ({ world: w }) => {
        w.answer({ title: "God's Holder: Tradition Carrier", decline: true });
        w.dice.set("d100", 99);
        await playAttack(w, { attacker: HAB, target: FOE, react: NOTHING(FOE) });
        text = JSON.stringify(resultsOf(w)[0]?.breakdown ?? []);
      }, WAR);
      return text;
    };
    expect(await swing([])).toMatch(/Pretender: The One who Wears a Role/);
    expect(await swing([{ defId: "pretenderSaber" }])).not.toMatch(/Pretender: The One who Wears a Role/);
  });

  it("Guardian Faerie reaches her Master and the nearest other ally, never herself; negates a keyed increase (GF.*)", async () => {
    await withSubjects([
      ...withMaster(),
      { from: "medea", id: ALLY, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
      { from: "medea", id: ALLY2, panel: { i: 6, j: 9 }, state: { factionId: "A" } },
    ], async () => {
      const marks = async (id) => (await live(id))?.modifiers?.filter((m) => m.key === "negateKeyedDealt").length ?? 0;
      expect(await marks(MASTER)).toBe(1);
      expect(await marks(ALLY)).toBe(1);
      expect(await marks(ALLY2)).toBe(0);
      expect(await marks(HAB)).toBe(0);
    }, WAR);
  });
});

describe("her actives, pink values read at the use (SG, YR, GD)", () => {
  it("Sacred Guardian Beast: ⅓◈ out of the Form, 1◈ in it; S.Crit Up herself only in it", async () => {
    await withSubjects([habetrot()], async ({ world: w }) => {
      await castSkill(w, { caster: HAB, ability: abilityOf(w, HAB, "habetrot-sacred-guardian-beast").id });
      expect(effectsOf(w, HAB, "decoy")[0]?.system?.expiry).toBe(18 + 1);
      expect(effectsOf(w, HAB, "sCritUp")).toHaveLength(1);
      expect(effectsOf(w, HAB, "guts")[0]?.system?.magnitude).toBe(30);
    }, WAR);
    await withSubjects([habetrot({ effects: inForm })], async ({ world: w }) => {
      await castSkill(w, { caster: HAB, ability: abilityOf(w, HAB, "habetrot-sacred-guardian-beast").id });
      expect(effectsOf(w, HAB, "decoy")[0]?.system?.expiry).toBe(18 + 3);
      expect(effectsOf(w, HAB, "dmgedNpRegen")[0]?.system?.expiry).toBe(18 + 3);
      expect(effectsOf(w, HAB, "sCritUp")).toHaveLength(0);
      expect(effectsOf(w, HAB, "sCritUpSelf")).toHaveLength(1);
    }, WAR);
  });

  it("Great Decisive Battle: 3 Agility, Atk Up 40/30, one 5% Atk Up per 5% of Crit above 50, NP DmUp per 300 Max Health", async () => {
    await withSubjects([habetrot({ effects: [{ defId: "critUp", magnitude: 15, expiry: 40 }], state: { agility: { value: 5, max: 15 } } })], async ({ world: w }) => {
      const out = await castSkill(w, { caster: HAB, ability: abilityOf(w, HAB, "habetrot-great-decisive-battle").id });
      expect(out.ok, out.reason).toBe(true);
      expect(w.actor(HAB).system.agility.value).toBe(8);
      const atk = effectsOf(w, HAB, "atkUp").map((e) => e.system.magnitude).sort((a, b) => a - b);
      expect(atk).toEqual([5, 5, 5, 40]);
      expect(effectsOf(w, HAB, "npDmUp")[0]?.system?.magnitude).toBe(40);
    }, WAR);
  });

  it("Yanamun Reversal: allies within 2 get 1-5, Max HpUp 30% of their own original; in the Form herself only, Max HpUp 2◈", async () => {
    await withSubjects([
      habetrot(),
      { from: "medea", id: ALLY, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
      foe("cu-chulainn", { i: 7, j: 6 }),
    ], async ({ world: w }) => {
      const out = await castSkill(w, { caster: HAB, ability: abilityOf(w, HAB, "habetrot-yanamun-reversal").id, placement: { direction: "s" } });
      expect(out.ok, out.reason).toBe(true);
      expect(effectsOf(w, ALLY, "maxHpUp")[0]?.system?.magnitude).toBe(225);
      expect(effectsOf(w, HAB, "maxHpUp")[0]?.system?.magnitude).toBe(360);
      expect(effectsOf(w, FOE, "skillSeal")).toHaveLength(1);
    }, WAR);
  });

  it("the two Attack Skills are refused out of the Form (TF.gate, BM.gate)", async () => {
    const { pressGate } = await import("../../module/engine/press-gate.mjs");
    await withSubjects([habetrot()], async ({ world: w }) => {
      for (const id of ["habetrot-great-tropical-fireball", "habetrot-shiisaa-beam"]) {
        const gate = pressGate(w.actor(HAB), abilityOf(w, HAB, id), {});
        expect(gate.ok).toBe(false);
      }
    }, WAR);
  });
});
