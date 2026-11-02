/**
 * Sessyoin Kiara (Summer) (Moon Cancer), audit #372: her sheet through the real
 * projection, and the pieces she brought: the MoonCancer Class template (a count
 * of distinct enemy Classes sized on the board, doubled in her own Region),
 * Mermaid Tokens (buffs on a ⅓◈ cadence, spent for a Skill's bracketed tier),
 * Bewitchment, and a count of Mental Debuffs her NP multiplies and kills by.
 * @see docs/superpowers/specs/2026-11-02-kiara-summer-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";
import { tierSpend, tierIndex, tierView, resolveTierRefs } from "../../module/rules/tiers.mjs";
import { countOf } from "../../module/rules/count.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const KIARA = "kiaraSummer00001";
const FOE = "kiaraFoe00000001";
const FOE2 = "kiaraFoe00000002";
const FOE3 = "kiaraFoe00000003";
const ALLY = "kiaraAlly0000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
const NOTHING = (...ids) => Object.fromEntries(ids.map((id) => [id, ["nothing", "declined", "declined", "declined", "declined"]]));
const kiara = (extra = {}) => ({
  from: "kiara-summer", id: KIARA, panel: { i: 6, j: 6 }, ...extra,
  state: { factionId: "A", ...(extra.state ?? {}) },
});
const foe = (from, panel, id = FOE, extra = {}) => ({ from, id, panel, ...extra, state: { factionId: "B", ...(extra.state ?? {}) } });
const tokens = (n, expiry = 30) => Array.from({ length: n }, (_, k) => ({ defId: "mermaidToken", expiry: expiry + k }));
const live = async (id) => {
  const { currentBoard } = await import("../../module/engine/board.mjs");
  return currentBoard().units.find((u) => u.id === id) ?? null;
};

describe("the sheet, projected (ST.*, NA.*)", () => {
  it("Moon Cancer, Lawful Evil, Japan; C A+ C A+ B; Health 1600 by the table; MOV 5; Range 3; BA 100/210; 4◈", async () => {
    await withSubjects([kiara()], ({ unit, world: w }) => {
      const k = unit(KIARA);
      const s = w.actor(KIARA).system;
      expect(k.servantClasses).toEqual(["moonCancer"]);
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "evil" });
      expect([...s.region]).toEqual(["japan"]);
      expect(k.attributes).toEqual(expect.arrayContaining(["female", "servant", "earth", "humanoid", "antiHero", "spirit"]));
      expect(s.health.max).toBe(1600);
      expect(k.mov).toBe(5);
      expect(k.range).toBe(3);
      expect(k.baseAttack).toEqual(expect.objectContaining({ str: 100, mag: 210 }));
      expect(s.sustainability).toBe("4◈");
      // STR at Range 1, MAG and Water from 2: Summer Habetrot's bands.
      expect(s.normalAttack.mode).toBe("rangeBanded");
      expect(s.normalAttack.component).toBe("str");
      expect(s.normalAttack.bands[0]).toMatchObject({ from: 2, component: "mag", element: "water" });
    });
  });
});

describe("MoonCancer (MC.*)", () => {
  it("counts the distinct enemy Servant Classes on the board, Moon Cancer left out, two of one Class once (readings 2, 3)", async () => {
    await withSubjects([
      kiara(),
      foe("cu-chulainn", { i: 2, j: 2 }, FOE),
      foe("medea", { i: 2, j: 4 }, FOE2),
      foe("cu-chulainn", { i: 2, j: 6 }, FOE3),
      { from: "gray", id: ALLY, panel: { i: 9, j: 9 }, state: { factionId: "A" } },
    ], async () => {
      const self = await live(KIARA);
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      expect(countOf({ of: "classes", relations: ["enemy"], requires: ["self:type:servant"], standing: true, except: ["moonCancer"] }, { self, board })).toBe(2);
      // Sized on the board: 5% a Class, dealt and taken, both NP too.
      const counted = self.modifiers.filter((m) => m.boardCount);
      expect(counted).toHaveLength(4);
      const dealt = counted.filter((m) => m.direction === "dealt").map((m) => [m.value, m.npValue]);
      expect(dealt).toEqual(expect.arrayContaining([[10, 10], [20, 20]]));
    }, WAR);
  });

  it("doubles in her own Region, and only there (MC.region, reading 1)", async () => {
    const { rollOptionsFor } = await import("../../module/rules/options.mjs");
    await withSubjects([kiara(), foe("cu-chulainn", { i: 2, j: 2 })], async () => {
      const self = await live(KIARA);
      expect(self.inOwnRegion).toBe(true);
      expect(rollOptionsFor({ attacker: self }).has("self:inOwnRegion")).toBe(true);
    }, { ...WAR, settings: { region: "japan" }, combat: { ...WAR.combat, system: { ...WAR.combat.system, region: "japan" } } });
    await withSubjects([kiara(), foe("cu-chulainn", { i: 2, j: 2 })], async () => {
      const self = await live(KIARA);
      expect(Boolean(self.inOwnRegion)).toBe(false);
    }, WAR);
  });
});

describe("Logos Eater, Spiritual World Creation, Swimsuit! (LE.*, SP.*, SW.*)", () => {
  it("carries the three passives as their elements", async () => {
    await withSubjects([kiara()], ({ unit }) => {
      const mods = unit(KIARA).modifiers;
      expect(mods.some((m) => m.key === "defUp" && m.direction === "taken" && m.value === 10 && JSON.stringify(m.predicate).includes("self:attribute:humanoid"))).toBe(true);
      expect(mods.some((m) => m.key === "npDmUp" && m.value === 10)).toBe(true);
      expect(mods.some((m) => m.key === "elementTotalDefUp" && m.element === "water" && m.value === 50 && m.npValue === 50)).toBe(true);
    });
  });
});

describe("Mermaid's Flesh (MF.*)", () => {
  it("Guts 25, the debuffs off, Regen 15, NP DmUp 20, Nourishment; spends no Token", async () => {
    await withSubjects([kiara({ effects: [{ defId: "defDwn", expiry: 30, magnitude: 20 }, ...tokens(2)] })], async ({ world: w }) => {
      const out = await castSkill(w, { caster: KIARA, ability: abilityOf(w, KIARA, "kiara-summer-mermaids-flesh").id });
      expect(out.ok, out.reason).toBe(true);
      expect(effectsOf(w, KIARA, "guts")[0]?.system.magnitude).toBe(25);
      expect(effectsOf(w, KIARA, "defDwn")).toHaveLength(0);
      expect(effectsOf(w, KIARA, "regen")[0]?.system.magnitude).toBe(15);
      expect(effectsOf(w, KIARA, "npDmUp")[0]?.system.magnitude).toBe(20);
      expect(effectsOf(w, KIARA, "mermaidsNourishment")).toHaveLength(1);
      expect(effectsOf(w, KIARA, "mermaidToken")).toHaveLength(2);
    }, WAR);
  });
});

describe("Mermaid's Nourishment (MN.gain.*, reading 5)", () => {
  it("gains a Token at the end of the Turn it landed, then every ⅓◈: every Turn at 3, every second at 8", async () => {
    const { endTurn } = await import("../../module/engine/scheduler.mjs");
    await withSubjects([kiara({ effects: [{ defId: "mermaidsNourishment", expiry: 21, appliedTick: 18 }] })], async () => {
      const unit = await live(KIARA);
      const gains = (tick, turnsPerRound) => endTurn({ units: [unit] }, { tick, turnsPerRound, activeFactionId: "A", options: new Set() })
        .filter((i) => i.t === "applyEffect" && (i.effect?.id ?? i.effect?.defId) === "mermaidToken").length;
      expect([18, 19, 20, 21].map((t) => gains(t, 3))).toEqual([1, 1, 1, 0]);
      expect([18, 19, 20].map((t) => gains(t, 8))).toEqual([1, 0, 1]);
    }, WAR);
  });
});

describe("tiers (MN.spend, MN.max, readings 6-11)", () => {
  it("spends the two Tokens nearest their end, keeps the third, and buys the second bracket", () => {
    const ability = { system: { kind: "skill", contentId: "kiara-summer-clam-palace", tiers: [{}, {}, {}] } };
    const def = { spentForTier: { max: 2, kinds: ["skill"], except: ["kiara-summer-mermaids-flesh"] } };
    const instances = [
      { id: "t3", defId: "mermaidToken", expiry: 40 },
      { id: "t1", defId: "mermaidToken", expiry: 30 },
      { id: "t2", defId: "mermaidToken", expiry: 35 },
    ];
    const spend = tierSpend({ ability, instances, defOf: () => def });
    expect(spend).toEqual({ defId: "mermaidToken", spentIds: ["t1", "t2"], tier: 2 });
    expect(tierIndex(ability, spend.tier)).toBe(2);
    // Mermaid's Flesh spends none; a passive spends none.
    expect(tierSpend({ ability: { system: { kind: "skill", contentId: "kiara-summer-mermaids-flesh" } }, instances, defOf: () => def })).toBeNull();
    expect(tierSpend({ ability: { system: { kind: "skill", passive: true } }, instances, defOf: () => def })).toBeNull();
  });

  it("refuses a ref no tier gives, out loud", () => {
    expect(() => resolveTierRefs({ magnitude: "@tier.nope" }, {})).toThrow(/nope/);
  });

  it("reads the tier's Rank, Cooldown and refs through a view of the document", () => {
    const ability = { id: "x", name: "Clam Palace", system: { rank: "A", cooldown: { max: "4◈" }, phases: [{ m: "@tier.d" }], tiers: [{ refs: { d: 20 } }, { rank: "A+", cooldown: "4◈-⅓◈", refs: { d: 25 } }] } };
    const view = tierView(ability, 1);
    expect(view.system.rank).toBe("A+");
    expect(view.system.cooldown.max).toBe("4◈-⅓◈");
    expect(view.system.phases).toEqual([{ m: 25 }]);
    expect(view.name).toBe("Clam Palace");
    expect(tierView(ability, 0).system.phases).toEqual([{ m: 20 }]);
  });
});

describe("Clam Palace (CP.*)", () => {
  it("two Tokens: Dodge for her and her ally, Aim off, Bewitchment three times, Def Dwn and Def Dwn (A) at 30, 4◈-⅔◈", async () => {
    await withSubjects([
      kiara({ effects: tokens(3) }),
      foe("cu-chulainn", { i: 6, j: 7 }, FOE, { effects: [{ defId: "aim", expiry: 30 }] }),
      { from: "gray", id: ALLY, panel: { i: 7, j: 5 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      w.dice.set("d100", 1);
      const clam = abilityOf(w, KIARA, "kiara-summer-clam-palace");
      const out = await castSkill(w, { caster: KIARA, ability: clam.id, placement: { direction: "e" } });
      expect(out.ok, out.reason).toBe(true);
      expect(effectsOf(w, KIARA, "mermaidToken")).toHaveLength(1);
      expect(effectsOf(w, KIARA, "dodge")).toHaveLength(1);
      expect(effectsOf(w, ALLY, "dodge")).toHaveLength(1);
      expect(effectsOf(w, FOE, "aim")).toHaveLength(0);
      expect(effectsOf(w, FOE, "bewitchment")).toHaveLength(3);
      expect(effectsOf(w, FOE, "defDwn")[0]?.system.magnitude).toBe(30);
      expect(effectsOf(w, FOE, "defDwnA")[0]?.system.magnitude).toBe(30);
      // 4◈-⅔◈ at 3 Turns a Round is 10.
      expect(w.actor(KIARA).items.get(clam.id).system.cooldown.remaining).toBe(10);
      const card = w.messages.contents.find((m) => m.flags?.fgt?.kind === "skill");
      expect(JSON.stringify(card?.flags?.fgt?.rows)).toContain("FGT.Tier.Spent");
    }, WAR);
  });

  it("no Token: the base figures and 4◈", async () => {
    await withSubjects([kiara(), foe("cu-chulainn", { i: 6, j: 7 })], async ({ world: w }) => {
      w.dice.set("d100", 1);
      const clam = abilityOf(w, KIARA, "kiara-summer-clam-palace");
      expect((await castSkill(w, { caster: KIARA, ability: clam.id, placement: { direction: "e" } })).ok).toBe(true);
      expect(effectsOf(w, FOE, "bewitchment")).toHaveLength(1);
      expect(effectsOf(w, FOE, "defDwn")[0]?.system.magnitude).toBe(20);
      expect(w.actor(KIARA).items.get(clam.id).system.cooldown.remaining).toBe(12);
    }, WAR);
  });
});

describe("Jintsūriki (JS.*)", () => {
  it("one Token: NP Cooldown cut by 1◈+⅓◈, S.Crit Up 25, 4◈-⅓◈", async () => {
    await withSubjects([kiara({ effects: tokens(1) })], async ({ world: w }) => {
      const np = abilityOf(w, KIARA, "kiara-summer-nirmannarati");
      await np.update({ "system.cooldown.remaining": 10 });
      const jin = abilityOf(w, KIARA, "kiara-summer-jintsuriki");
      const out = await castSkill(w, { caster: KIARA, ability: jin.id });
      expect(out.ok, out.reason).toBe(true);
      expect(effectsOf(w, KIARA, "mermaidToken")).toHaveLength(0);
      expect(w.actor(KIARA).items.get(np.id).system.cooldown.remaining).toBe(6);
      expect(effectsOf(w, KIARA, "sCritUp")[0]?.system.magnitude).toBe(25);
      expect(w.actor(KIARA).items.get(jin.id).system.cooldown.remaining).toBe(11);
    }, WAR);
  });
});

describe("Nirmānnarati (NM.*)", () => {
  it("counts the DU's Mental Debuffs: ×2.4 with two Bewitchments, and a 40% Instakill (readings 18, 19)", async () => {
    await withSubjects([
      kiara(),
      foe("cu-chulainn", { i: 6, j: 7 }, FOE, { effects: [{ defId: "bewitchment", expiry: 30, magnitude: 10 }, { defId: "bewitchment", expiry: 31, magnitude: 10 }] }),
    ], async ({ world: w }) => {
      const self = await live(KIARA);
      const target = await live(FOE);
      expect(countOf({ of: "effects", side: "target", polarity: "debuff", volatility: "mental" }, { self, target })).toBe(2);
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 99);
      const np = abilityOf(w, KIARA, "kiara-summer-nirmannarati");
      await playAttack(w, { attacker: KIARA, ability: np.id, placement: { direction: "e" }, react: NOTHING(FOE, KIARA) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      expect(JSON.stringify(result.breakdown)).toContain("Mental Debuffs ×2.4");
    }, WAR);
  });

  it("no Mental Debuff: no multiplier", async () => {
    await withSubjects([kiara(), foe("cu-chulainn", { i: 6, j: 7 })], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d100", 99);
      const np = abilityOf(w, KIARA, "kiara-summer-nirmannarati");
      await playAttack(w, { attacker: KIARA, ability: np.id, placement: { direction: "e" }, react: NOTHING(FOE, KIARA) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      expect(JSON.stringify(result.breakdown)).not.toContain("Mental Debuffs");
      // ...and no Instakill die is thrown (reading 19, found live: it rolled "vs 0%").
      const said = JSON.stringify(w.messages.contents.map((m) => [m.content, m.flags]));
      expect(said).toContain("nothing to count");
      expect(said).not.toMatch(/Instakill[^"]*rolled/);
    }, WAR);
  });
});

describe("Terror is a Mental Debuff (reading 20)", () => {
  it("is volatility mental", async () => {
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    await withSubjects([kiara()], () => {
      expect(EffectRegistry.get("terror")?.volatility).toBe("mental");
      expect(EffectRegistry.get("bewitchment")?.volatility).toBe("mental");
    });
  });
});
