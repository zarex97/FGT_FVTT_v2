/**
 * @file Gilles de Rais (Saber)'s audit rulings, played in the test world (#260).
 * @see docs/superpowers/specs/2026-10-20-gilles-saber-clauses.md
 *
 * The Saber form of the Caster on `Copia de Gilles.md` (reading 1). Mad
 * Enhancement EX starts off and only Prelati's Encouragement's growing die
 * turns it on, for good (2); while on he is Neutral Evil (4), unsealable (3j),
 * his Saint War Order closed and Prelati's Spellbook's Spells open (11).
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { phaseChance } from "../../module/rules/phase-chance.mjs";
import { canToggleMode } from "../../module/rules/modes.mjs";
import { trueNameSlug } from "../../module/rules/named-units.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { answersACounter } from "../../module/rules/counter.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const GI = "gillesSaber00001", ALLY = "gillesAlly000001", FOE = "gillesFoe0000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1 }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id) => [...w.actor(id).effects].map((e) => [e.system?.defId, e.system?.magnitude]);
const rowsOf = (out) => (out.applied ?? []).map((r) => r.summary ?? r);

/** Mad Enhancement switched on, as Prelati's die would. */
async function madden(w) {
  await abilityOf(w, GI, "class-mad-enhancement").update({ "system.active": true });
}

describe("the sheet (SB*, readings 1, 15, 16)", () => {
  it("is Gilles de Rais (Saber), a Lawful Good Saber from France, BA 125 by the table", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI }], ({ world: w, unit }) => {
      const g = unit(GI);
      const s = w.actor(GI).system;
      expect(w.actor(GI).name).toBe("Gilles de Rais (Saber)");
      expect([...s.servantClasses]).toEqual(["saber"]);
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "good" });
      expect(g.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 125 }));
      expect(g.maxHealth ?? g.health?.max).toBe(1000);
      expect(g.mov).toBe(4);
      expect(g.attributes).toEqual(expect.arrayContaining(["male", "servant", "man", "humanoid"]));
      expect(g.attributes).not.toContain("vitalSpot");
    });
  });
});

describe("Mad Enhancement: only Prelati's die switches it, and for good (reading 2)", () => {
  it("starts off; no hand turns it on, and none turns it off", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI }], ({ world: w, unit }) => {
      const me = abilityOf(w, GI, "class-mad-enhancement");
      expect(me.system.active).toBe(false);
      expect(canToggleMode(me, unit(GI), { active: true, ownTurn: true })).toMatchObject({ ok: false, reason: "cannotActivate" });
      expect(canToggleMode({ system: { ...me.system, active: true } }, unit(GI), { active: false, ownTurn: true }))
        .toMatchObject({ ok: false, reason: "cannotDeactivate" });
    });
  });

  it("the chance grows 15 a use from 15, to 90 at most", () => {
    const c = { value: 15, perPriorUse: 15, max: 90 };
    expect([0, 1, 2, 5, 6, 9].map((n) => phaseChance(c, n))).toEqual([15, 30, 45, 90, 90, 90]);
  });

  it("Prelati's Encouragement on a 15: Atk Up 50, and Mad Enhancement is Activated, both on the card", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI, state: { factionId: "A" } }], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      w.dice.every(15);
      const out = await useSkill({ actorId: GI, abilityId: abilityOf(w, GI, "gilles-saber-prelatis-encouragement").id });
      expect(effectsOf(w, GI)).toContainEqual(["atkUp", 50]);
      expect(abilityOf(w, GI, "class-mad-enhancement").system.active).toBe(true);
      const rows = rowsOf(out);
      expect(rows.find((r) => r.id === "chance")).toMatchObject({ outcome: "applied" });
      expect(rows.some((r) => r.id === "setMode")).toBe(true);
    }, WAR);
  });

  it("on a 16 at the first use: Atk Up only, and the missed die is on the card", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI, state: { factionId: "A" } }], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      w.dice.every(16);
      const out = await useSkill({ actorId: GI, abilityId: abilityOf(w, GI, "gilles-saber-prelatis-encouragement").id });
      expect(abilityOf(w, GI, "class-mad-enhancement").system.active).toBe(false);
      expect(rowsOf(out).find((r) => r.id === "chance")).toMatchObject({ outcome: "failed" });
    }, WAR);
  });
});

describe("his Alignment while Mad Enhancement is Active (reading 4)", () => {
  it("is Neutral Evil on the sheet and on the board", async () => {
    await withSubjects([
      { from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "heracles", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      await madden(w);
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const me = board.units.find((u) => u.id === GI);
      expect(w.actor(GI).system.alignment).toMatchObject({ order: "neutral", morality: "evil" });
      const opts = rollOptionsFor({ attacker: board.units.find((u) => u.id === FOE), defender: me });
      expect(opts.has("target:order:neutral")).toBe(true);
      expect(opts.has("target:morality:evil")).toBe(true);
      expect(opts.has("target:order:lawful")).toBe(false);
    }, WAR);
  });
});

describe("Saint War Order and Prelati's Spellbook (SW.gate, PS.*, reading 11)", () => {
  it("Saint War Order lands its Def Dwn on him unrolled, before Mad Enhancement", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI, state: { factionId: "A" } }], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      w.dice.every(100);
      await useSkill({ actorId: GI, abilityId: abilityOf(w, GI, "gilles-saber-saint-war-order").id });
      expect(effectsOf(w, GI)).toEqual(expect.arrayContaining([["atkUp", 100], ["sCritUp", 15], ["defDwn", 50]]));
    }, WAR);
  });

  it("is refused once Mad Enhancement is Active; the Spells are refused before it and open after", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async ({ world: w }) => {
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const verdict = (cid) => canUseAbility({
        ability: usageSpecFor(abilityOf(w, GI, cid)), unit: currentBoard().units.find((u) => u.id === GI), round: 6,
      });
      // The reasons, not `ok`: no Master stands here to pay an NP's Health.
      expect(verdict("summoning-horrors")).toMatchObject({ ok: false, reason: "abilityAllows" });
      expect(verdict("gilles-saber-saint-war-order").reason).not.toBe("modeInactive");
      await madden(w);
      expect(verdict("summoning-horrors").reason).not.toBe("abilityAllows");
      expect(verdict("summoning-elder-horror").reason).not.toBe("abilityAllows");
      expect(verdict("gilles-saber-saint-war-order")).toMatchObject({ ok: false, reason: "modeInactive" });
    }, WAR);
  });

  it("both Spells answer a Counter: each counts as his Attack", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI }], ({ world: w }) => {
      expect(answersACounter(abilityOf(w, GI, "summoning-horrors"))).toBe(true);
      expect(answersACounter(abilityOf(w, GI, "summoning-elder-horror"))).toBe(true);
    });
  });
});

describe("Military Tactics (MT.*, readings 9, 9a)", () => {
  const np = (npTags) => ({ kind: "np", component: "str", npTags });
  const hit = (attacker, defender, attack) => computeDamage({
    attacker, defender, attack,
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    rolls: { attackMinus: 0 },
    options: rollOptionsFor({ attacker, defender, attack }),
  });

  it("an ally within 2 takes 25% less from an Anti-Army or higher NP, and deals 25% more with one", async () => {
    await withSubjects([
      { from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "heracles", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
      { from: "heracles", id: FOE, panel: { i: 9, j: 9 }, state: { factionId: "B" } },
    ], ({ unit }) => {
      const sources = (r) => JSON.stringify(r.breakdown ?? r);
      expect(sources(hit(unit(FOE), unit(ALLY), np(["antiArmy"])))).toContain("Military Tactics");
      expect(sources(hit(unit(FOE), unit(ALLY), np(["antiFortress"])))).toContain("Military Tactics");
      expect(sources(hit(unit(FOE), unit(ALLY), np(["antiUnit"])))).not.toContain("Military Tactics");
      expect(sources(hit(unit(ALLY), unit(FOE), np(["antiArmy"])))).toContain("Military Tactics");
    }, WAR);
  });

  it("NP DmUp (nonAA) reaches an Anti-Unit NP and an untagged one, never Anti-Army or higher", async () => {
    await withSubjects([
      { from: "heracles", id: ALLY, state: { factionId: "A" }, effects: [{ defId: "npDmUpNonAA", magnitude: 15 }] },
      { from: "heracles", id: FOE, state: { factionId: "B" } },
    ], ({ unit }) => {
      const has = (tags) => JSON.stringify(hit(unit(ALLY), unit(FOE), np(tags)).breakdown).includes("npDmUp");
      expect(has(["antiUnit"])).toBe(true);
      expect(has([])).toBe(true);
      expect(has(["antiArmy"])).toBe(false);
      expect(has(["antiFortress"])).toBe(false);
    });
  });
});

describe("Jeanne d'Arc, by True Name (reading 6)", () => {
  it("spells a True Name as one word, the Alter apart", () => {
    expect(trueNameSlug("Jeanne d'Arc")).toBe("jeanne-d-arc");
    expect(trueNameSlug("Jeanne d'Arc (Alter)")).toBe("jeanne-d-arc-alter");
  });

  it("an allied Servant of that name is on the field, and within N as a ladder", async () => {
    await withSubjects([
      { from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "heracles", id: ALLY, panel: { i: 5, j: 8 }, state: { factionId: "A", trueName: "Jeanne d'Arc" } },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const g = currentBoard().units.find((u) => u.id === GI);
      const opts = rollOptionsFor({ attacker: g });
      expect(opts.has("self:allyNamed:jeanne-d-arc")).toBe(true);
      expect(opts.has("self:allyNamedWithin:jeanne-d-arc:3")).toBe(true);
      expect(opts.has("self:allyNamedWithin:jeanne-d-arc:2")).toBe(false);
      expect(opts.has("self:allyNamed:jeanne-d-arc-alter")).toBe(false);
    }, WAR);
  });
});

describe("Triumphal Return of the Holy Maiden (TR.*, readings 6, 7, 8)", () => {
  const use = (allies, check) => withSubjects([
    { from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    ...allies,
  ], async ({ world: w }) => {
    const { useSkill } = await import("../../module/engine/skill-use.mjs");
    w.dice.every(100);
    await useSkill({ actorId: GI, abilityId: abilityOf(w, GI, "gilles-saber-triumphal-return").id });
    return check(w);
  }, WAR);

  it("Lawful allies take Crit DmUp, Good ones Overcharge, all NP DmUp; himself too", async () => {
    await use([
      // Heracles is Chaotic and Mad; Arjuna Lawful Neutral.
      { from: "heracles", id: "gillesHeracles01", panel: { i: 5, j: 7 }, state: { factionId: "A" } },
      { from: "arjuna", id: "gillesArjuna0001", panel: { i: 6, j: 6 }, state: { factionId: "A" } },
    ], (w) => {
      const ids = (id) => effectsOf(w, id).map(([d]) => d);
      expect(ids(GI)).toEqual(expect.arrayContaining(["npDmUp", "critDmUp", "overcharge", "areaCritUp"]));
      expect(ids("gillesArjuna0001")).toEqual(expect.arrayContaining(["npDmUp", "critDmUp"]));
      expect(ids("gillesArjuna0001")).not.toContain("overcharge");
      expect(ids("gillesHeracles01")).toContain("npDmUp");
      expect(ids("gillesHeracles01")).not.toContain("critDmUp");
      expect(ids(GI)).not.toContain("sCritUp");
    });
  });

  it("beside an allied Jeanne d'Arc, an ally 3 away is reached and a [Star] 3 away gives S.Crit Up at 3", async () => {
    await use([
      { from: "heracles", id: ALLY, panel: { i: 5, j: 8 }, state: { factionId: "A", trueName: "Jeanne d'Arc" } },
      { from: "drake", id: "gillesDrake00001", panel: { i: 8, j: 5 }, state: { factionId: "A" } },
    ], (w) => {
      expect(effectsOf(w, ALLY).map(([d]) => d)).toContain("npDmUp");
      const s = [...w.actor(GI).effects].find((e) => e.system.defId === "sCritUp");
      expect(s?.system?.params).toMatchObject({ radius: 3 });
    });
  });
});

describe("By the Holy Maiden's Side (HM.*, reading 5)", () => {
  it("reaches a Lawful enemy and himself: two NP Regens on him", async () => {
    await withSubjects([
      { from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "arjuna", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      w.dice.every(100);
      await useSkill({ actorId: GI, abilityId: abilityOf(w, GI, "gilles-saber-holy-maidens-side").id });
      const regen = (id) => effectsOf(w, id).filter(([d]) => d === "npRegen").reduce((s, [, m]) => s + (m ?? 0), 0);
      expect(regen(GI)).toBe(2);
      expect(regen(FOE)).toBe(1);
    }, WAR);
  });
});

describe("Overcharge (reading 8)", () => {
  it("raises an NP's effect magnitude by 20%, rounded down, and is spent by it", async () => {
    await withSubjects([
      { from: "gilles-saber", id: GI, state: { factionId: "A" }, effects: [{ defId: "overcharge", magnitude: 20 }] },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      w.dice.every(100);
      await useSkill({ actorId: GI, abilityId: abilityOf(w, GI, "gilles-saber-saint-war-order").id });
      expect(effectsOf(w, GI)).toEqual(expect.arrayContaining([["atkUp", 120], ["sCritUp", 18], ["defDwn", 60]]));
      expect(effectsOf(w, GI).map(([d]) => d)).not.toContain("overcharge");
    }, WAR);
  });

  it("leaves a Skill's effects alone", async () => {
    await withSubjects([
      { from: "gilles-saber", id: GI, state: { factionId: "A" }, effects: [{ defId: "overcharge", magnitude: 20 }] },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      w.dice.every(100);
      await useSkill({ actorId: GI, abilityId: abilityOf(w, GI, "gilles-saber-prelatis-encouragement").id });
      expect(effectsOf(w, GI)).toContainEqual(["atkUp", 50]);
      expect(effectsOf(w, GI).map(([d]) => d)).toContain("overcharge");
    }, WAR);
  });
});

describe("the Horror's split (HO.split*, reading 12)", () => {
  it("splits on Heads, and not when Light or anti-Dark damage defeated it", async () => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    await withSubjects([
      { from: "gilles-saber", id: GI, state: { factionId: "A" } },
      { from: "horror", id: "gillesHorror0001", state: { factionId: "A", summonerId: GI } },
    ], ({ unit }) => {
      const h = unit("gillesHorror0001");
      const fire = (options, coin) => fireEvent("unitDefeated", [h], {
        tick: 1, turnsPerRound: 3, options: new Set(options), rolls: { splitCoin: coin },
      }).filter((i) => i.entry?.kind === "split").map((i) => i.entry);
      expect(fire([], 1)[0]).toMatchObject({ splits: true, into: { count: 2, contentId: "horror" } });
      expect(fire([], 2)[0]).toMatchObject({ splits: false });
      // The exemption is a line too, and no coin decides it.
      expect(fire(["attack:element:light"], 1)[0]).toMatchObject({ splits: false, exempt: "attack:element:light" });
      expect(fire(["attack:vsAttribute:outsider"], 1)[0]).toMatchObject({ splits: false, exempt: "attack:vsAttribute:outsider" });
    });
  });
});

describe("Dmg Boost (Gilles) reaches his Horrors (reading 13)", () => {
  it("adds its flat bonus to his summon's damage, and to his own", async () => {
    await withSubjects([
      { from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "dmgBoostGilles", magnitude: 30 }] },
      { from: "horror", id: "gillesHorror0001", panel: { i: 9, j: 9 }, state: { factionId: "A", summonerId: GI } },
    ], ({ unit }) => {
      const flat = (id) => (unit(id).modifiers ?? []).filter((m) => m.key === "dmgBoost").reduce((s, m) => s + (m.value ?? 0), 0);
      expect(flat(GI)).toBe(30);
      expect(flat("gillesHorror0001")).toBe(30);
    }, WAR);
  });
});

describe("an Attack that deals extra damage to Dark Units (found pressing #260)", () => {
  // A flat bonus against an Attribute is damage dealt: Excalibur's passive is
  // +50 Light damage against a Dark Unit, and `attack:vsAttribute:` never saw
  // it because a FlatDamage contribution named no direction.
  it("counts a flat bonus whose predicate names the Attribute", async () => {
    await withSubjects([
      { from: "arturia", id: "arturiaDark00001", state: { factionId: "A" } },
      { from: "horror", id: "gillesHorror0001", state: { factionId: "B" } },
    ], ({ unit }) => {
      const ar = unit("arturiaDark00001");
      const opts = rollOptionsFor({ attacker: ar, defender: unit("gillesHorror0001"), attack: { kind: "normal", component: "str" } });
      expect(opts.has("attack:vsAttribute:dark")).toBe(true);
    });
  });
});

describe("Summoning: Horrors made as a Counter keeps its clock (HO.counter, found pressing #260)", () => {
  // `runCounter` pays the price before the phases run, so a clock the use
  // itself decides was priced at a count of 0: none. Pressed live, two Horrors
  // came and the Spell stood off Cooldown.
  it("prices no clock before the count exists, and ⅔◈ a Horror once it does", async () => {
    const { cooldownFor } = await import("../../module/engine/cooldown.mjs");
    await withSubjects([{ from: "gilles-saber", id: GI }], ({ world: w }) => {
      const horrors = abilityOf(w, GI, "summoning-horrors");
      expect(cooldownFor(horrors, GI, { count: 0 }).cooldowns).toEqual([]);
      expect(cooldownFor(horrors, GI, { count: 2 }).cooldowns).toEqual([
        expect.objectContaining({ abilityId: horrors.id, ticks: 4 }),
      ]);
    });
  });

  // A source check: the wiring lives in the engine and needs a live War.
  it("sets the clock after a Counter's phases, from what they summoned", async () => {
    const { readFileSync } = await import("node:fs");
    const skill = readFileSync("module/engine/skill-use.mjs", "utf8");
    const body = skill.slice(skill.indexOf("export async function resolveWithoutProcess"));
    expect(body.indexOf("cooldownIntents(ability, actor, applied.summoned")).toBeGreaterThan(body.indexOf("runPhases("));
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    expect(attack).toMatch(/resolveWithoutProcess\(\{[^}]*overCooldown: Boolean\(usage\.overCooldown\)/);
  });
});

describe("his summons leave with him, and the table reads it (HO.leave, EH.leave, found pressing #260)", () => {
  it("counts each kind once", async () => {
    const { countedNames } = await import("../../module/engine/defeat-card.mjs");
    expect(countedNames(["Horror", "Horror", "Elder Horror", "Horror"])).toBe("3 × Horror, Elder Horror");
    expect(countedNames(["Elder Horror"])).toBe("Elder Horror");
  });

  // A source check: the defeat lives in `io.defeat` and needs a live War. The
  // card is posted from the living summons, before they are dismissed.
  it("posts the line before the summons go, naming only the ones still standing", async () => {
    const { readFileSync } = await import("node:fs");
    const io = readFileSync("module/engine/io.mjs", "utf8");
    const at = io.indexOf("postLeftWithSummonerCard(unitId, leaving)");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(io.indexOf("this.dismissSummon(summon.id, \"summonerDefeated\")"));
    expect(io).toMatch(/leaving = goWithIt\.filter\(\(summon\) => !summon\.system\?\.defeated\)/);
  });
});

describe("his sheet says the Alignment Mad Enhancement sets (reading 4, found pressing #260)", () => {
  // A word set outright has no `value`: the derivation list read
  // `alignment.order 0` under a header that said "Neutral Evil".
  it("reads the word, not a zero", async () => {
    const { rankAmount } = await import("../../module/apps/actor-sheet/context.mjs");
    expect(rankAmount({ stat: "alignment.order", set: "neutral", source: "Gilles de Rais (Saber)" })).toBe("→ neutral");
    expect(rankAmount({ stat: "mov", value: 2 })).toBe("+2");
  });
});

describe("an effect's row on the damage card reads its name (HM.m4.horrors, found pressing #260)", () => {
  // His Horror's card read "Dmg Boost dmgBoostGilles +30". The pipeline keeps
  // the id, which rolls and stacking key on; the card prints the name.
  it("prints the definition's name for an effect id, and leaves other notes alone", async () => {
    const { explainDamage } = await import("../../module/rules/explain.mjs");
    const row = (note) => explainDamage({ breakdown: [{
      index: 7, before: { phys: 100, mag: 0 }, after: { phys: 130, mag: 0 },
      contributors: [{ source: "dmgBoost", value: 30, note }], notes: [],
    }] }).rows[0].contributors[0].note;
    expect(row("dmgBoostGilles")).toBe("Dmg Boost (Gilles)");
    expect(row("self BA(STR) × 1")).toBe("self BA(STR) × 1");
  });
});

describe("the Spells wait on his Spellbook, by name (HO.book, EH.book, found pressing #260)", () => {
  it("refuses both while Prelati's Spellbook is on Cooldown, and names it", async () => {
    await withSubjects([{ from: "gilles-saber", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async ({ world: w }) => {
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { abilityState } = await import("../../module/apps/actor-sheet/present.mjs");
      await madden(w);
      await abilityOf(w, GI, "gilles-saber-prelatis-spellbook").update({ "system.cooldown.remaining": 3 });
      const verdict = (cid) => canUseAbility({
        ability: usageSpecFor(abilityOf(w, GI, cid)), unit: currentBoard().units.find((u) => u.id === GI), round: 6,
      });
      for (const cid of ["summoning-horrors", "summoning-elder-horror"]) {
        const v = verdict(cid);
        expect(v).toMatchObject({ ok: false, reason: "abilityOffCooldown", detail: { names: expect.stringContaining("Prelati's Spellbook") } });
        expect(abilityState(v).label).toBe("FGT.Ability.CoolingNamed");
      }
    }, WAR);
  });
});
