/**
 * @file Gilles (Caster)'s build, played in the test world (#323).
 * @see docs/superpowers/specs/2026-10-22-gilles-caster-clauses.md
 *
 * The Caster form of Gilles de Rais. His Class Skills, Mental Pollution, his two
 * area Skills and Prelati's Spellbook's Active.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const GI = "gillesCaster0001", FOE = "gillesCFoe000001", FOE2 = "gillesCFoe000002", ALLY = "gillesCAlly00001";
const HORROR = "gillesCHorror001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1 }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id) => [...w.actor(id).effects].map((e) => [e.system?.defId, e.system?.magnitude]);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);

describe("the sheet (SB*)", () => {
  it("is Gilles, a Chaotic Evil Caster from France, every figure the table's", async () => {
    await withSubjects([{ from: "gilles", id: GI }], ({ world: w, unit }) => {
      const g = unit(GI);
      const s = w.actor(GI).system;
      expect(w.actor(GI).name).toBe("Gilles");
      expect(s.trueName).toBe("Gilles de Rais");
      expect([...s.servantClasses]).toEqual(["caster"]);
      expect(s.alignment).toMatchObject({ order: "chaotic", morality: "evil" });
      expect(g.baseAttack).toEqual(expect.objectContaining({ str: 75, mag: 150 }));
      expect(g.maxHealth ?? g.health?.max).toBe(500);
      expect(g.mov).toBe(4);
      expect(g.range).toBe(3);
      expect(s.normalAttack.component).toBe("mag");
      expect(g.attributes).toEqual(expect.arrayContaining(["male", "servant", "man", "humanoid"]));
    });
  });

  it("holds Territory Creation at B and an Item Construction with no rules of its own", async () => {
    await withSubjects([{ from: "gilles", id: GI }], ({ world: w }) => {
      expect(abilityOf(w, GI, "class-territory-creation").system.rank).toBe("B");
      expect(abilityOf(w, GI, "gilles-item-construction").system.passiveRules ?? []).toEqual([]);
    });
  });
});

describe("Mental Pollution, one shared skill at each sheet's figures (MP*)", () => {
  it("is +25 outgoing and 100 against Mental debuffs on Gilles, 15 and 60 on Jack", async () => {
    await withSubjects([
      { from: "gilles", id: GI },
      { from: "jack-the-ripper", id: FOE },
    ], ({ unit }) => {
      const chances = (id) => (unit(id).applicationChances ?? [])
        .filter((c) => String(c.source?.abilityId ?? c.source ?? "").length >= 0)
        .map((c) => [c.direction, c.volatility ?? null, c.value]);
      expect(chances(GI)).toEqual(expect.arrayContaining([["outgoing", null, 25], ["incoming", "mental", 100]]));
      expect(chances(FOE)).toEqual(expect.arrayContaining([["outgoing", null, 15], ["incoming", "mental", 60]]));
    });
  });
});

/** Gilles facing east, two enemies and an ally in the 3x3 next to him, one enemy beyond it. */
const area = () => [
  { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
  { from: "medea", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  { from: "medea", id: FOE2, panel: { i: 4, j: 8 }, state: { factionId: "B" } },
  { from: "medea", id: ALLY, panel: { i: 6, j: 7 }, state: { factionId: "A" } },
];

describe("Blasphemy Aesthetic (BL*)", () => {
  it("lands NP DmDwn 20, Def Dwn (A) 10 and Def Dwn (B) 10/20 on every enemy in the 3x3, and spares the ally", async () => {
    await withSubjects(area(), async ({ world: w }) => {
      w.dice.every(1);
      const out = await castSkill(w, { caster: GI, ability: abilityOf(w, GI, "gilles-blasphemy-aesthetic").id, placement: { direction: "e" } });
      expect(out.ok, out.reason).toBe(true);
      for (const id of [FOE, FOE2]) {
        expect(effectsOf(w, id)).toEqual(expect.arrayContaining([["npDmDwn", 20], ["defDwnA", 10], ["defDwnB", 10]]));
      }
      expect(held(w, ALLY)).not.toContain("defDwnA");
      expect(abilityOf(w, GI, "gilles-blasphemy-aesthetic").system.cooldown.remaining).toBeGreaterThan(0);
    }, WAR);
  });
});

describe("Evil Gaze of the Abyss (EG*)", () => {
  it("lands Terror 40, Curse and Def Dwn 20 on the enemies, Dmg Up (Curse) 30 and Gazing on himself", async () => {
    await withSubjects(area(), async ({ world: w }) => {
      w.dice.every(1);
      const out = await castSkill(w, { caster: GI, ability: abilityOf(w, GI, "gilles-evil-gaze-of-the-abyss").id, placement: { direction: "e" } });
      expect(out.ok, out.reason).toBe(true);
      expect(effectsOf(w, FOE)).toEqual(expect.arrayContaining([["terror", 40], ["defDwn", 20]]));
      expect(held(w, FOE)).toContain("curse");
      expect(held(w, ALLY)).not.toContain("curse");
      expect(effectsOf(w, GI)).toEqual(expect.arrayContaining([["dmgUpCurse", 30]]));
      expect(held(w, GI)).toContain("gazing");
    }, WAR);
  });

  it("Gazing: his Normal Attack inflicts Curse", async () => {
    await withSubjects([
      { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "gazing" }] },
      { from: "medea", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.dice.every(1);
      await playAttack(w, { attacker: GI, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(held(w, FOE)).toContain("curse");
    }, WAR);
  });

  const horrorScene = (horrorPanel) => [
    { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "gazing" }] },
    { from: "horror", id: HORROR, owner: "p1", panel: horrorPanel, state: { factionId: "A", summonerId: GI } },
    // No resistance of its own to subtract from the 50: Medea's Item Construction takes 50 off.
    { from: "test-use-bench", id: FOE, panel: { i: horrorPanel.i, j: horrorPanel.j + 1 }, state: { factionId: "B" } },
  ];

  it("Gazing: a Horror within 2 of him inflicts Curse on a 50", async () => {
    await withSubjects(horrorScene({ i: 5, j: 7 }), async ({ world: w }) => {
      w.dice.every(50);
      await playAttack(w, { attacker: HORROR, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(held(w, FOE)).toContain("curse");
    }, WAR);
  });

  it("Gazing: not on a 51", async () => {
    await withSubjects(horrorScene({ i: 5, j: 7 }), async ({ world: w }) => {
      w.dice.every(51);
      await playAttack(w, { attacker: HORROR, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(held(w, FOE)).not.toContain("curse");
    }, WAR);
  });

  it("Gazing: a Horror 3 away from him has no chance", async () => {
    await withSubjects(horrorScene({ i: 5, j: 8 }), async ({ world: w }) => {
      w.dice.every(1);
      await playAttack(w, { attacker: HORROR, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(held(w, FOE)).not.toContain("curse");
    }, WAR);
  });
});

describe("Prelati's Spellbook's Active (PS.a.*)", () => {
  const FOREIGNER = "gillesCForeign01", OUTSIDER = "gillesCOutside01";
  const npScene = () => [
    { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "medea", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    // The roster's one Foreigner as she is authored: a hand-built Foreigner
    // passed while the real Van Gogh, no `servantClasses`, got the ½◈ (live).
    { from: "van-gogh", id: FOREIGNER, panel: { i: 3, j: 3 }, state: { factionId: "A" } },
    { from: "medea", id: OUTSIDER, panel: { i: 7, j: 3 }, state: { factionId: "A" }, with: { attributes: ["female", "servant", "outsider"] } },
    { from: "van-gogh", id: ALLY, panel: { i: 5, j: 1 }, state: { factionId: "A" } },
  ];
  const np = (w, id) => abilityOf(w, id, id === OUTSIDER ? "medea-rule-breaker" : "gogh-de-sterrennacht");

  it("cuts an allied Foreigner's NP clock by 1◈, an Outsider's by ½◈, not one 4 away; Atk Dwn 40/20 and Def Dwn 30 on the DU", async () => {
    await withSubjects(npScene(), async ({ world: w }) => {
      for (const id of [FOREIGNER, OUTSIDER, ALLY]) await np(w, id).update({ "system.cooldown.remaining": 9 });
      w.dice.every(1);
      await playAttack(w, {
        attacker: GI, ability: abilityOf(w, GI, "gilles-prelatis-spellbook").id, placement: { direction: "e" },
        react: { [FOE]: ["nothing", "declined", "declined"] },
      });
      // 1◈ is 3 Turns at three a Round; ½◈ rounds to 1 or 2 by the War's ◈.
      expect(np(w, FOREIGNER).system.cooldown.remaining).toBe(6);
      expect(np(w, OUTSIDER).system.cooldown.remaining).toBeLessThan(9);
      expect(np(w, OUTSIDER).system.cooldown.remaining).toBeGreaterThan(6);
      expect(np(w, ALLY).system.cooldown.remaining, "4 panels away").toBe(9);
      expect(w.actor(FOE).effects.find((e) => e.system.defId === "atkDwn")?.system).toMatchObject({ magnitude: 40, npMagnitude: 20 });
      expect(effectsOf(w, FOE)).toEqual(expect.arrayContaining([["defDwn", 30]]));
      expect(abilityOf(w, GI, "gilles-prelatis-spellbook").system.cooldown.remaining).toBeGreaterThan(0);
    }, WAR);
  });

  it("on its Cooldown, both Spells are refused (HO.book, EH.book)", async () => {
    await withSubjects([{ from: "gilles", id: GI, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async ({ world: w }) => {
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const verdict = (cid) => canUseAbility({
        ability: usageSpecFor(abilityOf(w, GI, cid)), unit: currentBoard().units.find((u) => u.id === GI), round: 6,
      });
      expect(verdict("summoning-horrors").reason).not.toBe("abilityOffCooldown");
      await abilityOf(w, GI, "gilles-prelatis-spellbook").update({ "system.cooldown.remaining": 24 });
      expect(verdict("summoning-horrors")).toMatchObject({ ok: false, reason: "abilityOffCooldown" });
      expect(verdict("summoning-elder-horror")).toMatchObject({ ok: false, reason: "abilityOffCooldown" });
    }, WAR);
  });
});

describe("Appreciation of the Arts (AA*, readings 14, 15)", () => {
  const GOGH = "gillesCGogh00001";

  it("the seven Artistic NPs of the built roster carry the tag", async () => {
    await withSubjects([{ from: "nursery-rhyme", id: FOE }, { from: "van-gogh", id: GOGH }], ({ world: w }) => {
      const tagged = (id) => w.actor(id).items.filter((i) => i.system.isNP && (i.system.npTags ?? []).includes("artistic")).length;
      expect(tagged(FOE)).toBe(5);
      expect(tagged(GOGH)).toBe(2);
    });
  });

  it("cuts damage from an Artistic NP by 5%, and from no other", async () => {
    const { computeDamage } = await import("../../module/rules/damage/pipeline.mjs");
    const { rollOptionsFor } = await import("../../module/rules/options.mjs");
    await withSubjects([
      { from: "gilles", id: GI, state: { factionId: "A" } },
      { from: "heracles", id: FOE, state: { factionId: "B" } },
    ], ({ unit }) => {
      const hit = (npTags) => {
        const attack = { kind: "np", component: "str", npTags };
        return JSON.stringify(computeDamage({
          attacker: unit(FOE), defender: unit(GI), attack,
          base: { sources: [{ unit: "self", component: "str", factor: 1 }] }, rolls: { attackMinus: 0 },
          options: rollOptionsFor({ attacker: unit(FOE), defender: unit(GI), attack }),
        }).breakdown);
      };
      expect(hit(["antiUnit", "artistic"])).toContain("Appreciation of the Arts");
      expect(hit(["antiUnit"])).not.toContain("Appreciation of the Arts");
    });
  });

  /** Van Gogh casts De Sterrennacht east, Gilles `gap` panels from her on the west. */
  const scene = (gap) => [
    // Her Turn: an enemy's NP, which he watches from the side.
    { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 - gap }, state: { factionId: "B" } },
    { from: "van-gogh", id: GOGH, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "test-use-bench", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
  ];
  const sterrennacht = (w) => playAttack(w, {
    attacker: GOGH, ability: abilityOf(w, GOGH, "gogh-de-sterrennacht").id, placement: { direction: "e" },
    react: { [FOE]: ["nothing", "declined", "declined"] },
  });
  const whispers = (w) => [...w.messages.values()].filter((m) => (m.whisper ?? m.doc?.whisper ?? []).length > 0)
    .map((m) => m.content ?? m.doc?.content ?? "");

  it("an Artistic NP used 3 away: on a 15 he learns it, whispered, and it is in his player's Notebook", async () => {
    await withSubjects(scene(3), async ({ world: w }) => {
      w.dice.every(15);
      await sterrennacht(w);
      expect(whispers(w).some((c) => c.includes("FGT.TrueName.Learned"))).toBe(true);
      const book = w.journal.find((j) => j.getFlag("fgt", "notebook") === "p1");
      expect(book, "Player1's Notebook").toBeTruthy();
      expect(book.ownership.p1).toBe(3);
      expect([...book.pages.values()].map((p) => p.flags.fgt.key)).toEqual(["np:gogh-de-sterrennacht"]);
    }, WAR);
  });

  it("on a 16 he does not, and the miss is whispered too", async () => {
    await withSubjects(scene(3), async ({ world: w }) => {
      w.dice.every(16);
      await sterrennacht(w);
      expect(whispers(w).some((c) => c.includes("FGT.TrueName.Missed"))).toBe(true);
      expect(w.journal.size).toBe(0);
    }, WAR);
  });

  // Live, 2026-10-22: learned on a 9, then a later use rolled 64 and whispered
  // "does not learn" an NP his Notebook already held.
  it("an NP already in his player's Notebook: no die, no line", async () => {
    await withSubjects(scene(3), async ({ world: w }) => {
      const { recordInNotebook } = await import("../../module/engine/notebook.mjs");
      await recordInNotebook(game.users.get("p1"), { key: "np:gogh-de-sterrennacht", title: "De Sterrennacht", content: "" });
      w.dice.every(16);
      await sterrennacht(w);
      expect(whispers(w).some((c) => c.includes("FGT.TrueName"))).toBe(false);
    }, WAR);
  });

  it("4 away, no die", async () => {
    await withSubjects(scene(4), async ({ world: w }) => {
      w.dice.every(1);
      await sterrennacht(w);
      expect(whispers(w).some((c) => c.includes("FGT.TrueName"))).toBe(false);
    }, WAR);
  });
});

describe("Prelati's Spellbook as a target (PS.aim to PS.lc.after, SB.attr, readings 1 to 5, 16)", () => {
  const AU = "gillesCAttacker1";
  /** An enemy test bench (AGI B), 1 panel from Gilles, on its own Turn. */
  const duel = (agi = "B") => [
    { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "B", luck: { value: 3, max: 3 }, agility: { value: 12, max: 12 } } },
    { from: "test-use-bench", id: AU, panel: { i: 5, j: 6 }, state: { factionId: "A" },
      with: { parameters: { str: "B", end: "B", agi, mag: "B", luc: "B" } } },
  ];
  const aim = (w) => w.answer({ title: "FGT.WeakPoint.ObjectTitle", pick: ["object"] });
  const destroyed = (w) => held(w, GI).includes("spellbookDestroyed");
  const hp = (w) => w.actor(GI).system.health.value;

  it("carries Vital Spot while the Spellbook stands", async () => {
    await withSubjects([{ from: "gilles", id: GI }], ({ unit }) => {
      expect(unit(GI).attributes).toContain("vitalSpot");
    });
    await withSubjects([{ from: "gilles", id: GI, effects: [{ defId: "spellbookDestroyed", unremovable: true }] }], ({ unit }) => {
      expect(unit(GI).attributes).not.toContain("vitalSpot");
    });
  });

  it("an AU of AGI D is never offered it", async () => {
    await withSubjects(duel("D"), async ({ world: w }) => {
      w.dice.every(10);
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["nothing", "declined", "declined"] } });
      expect(w.asked.some((a) => a.title === "FGT.WeakPoint.ObjectTitle")).toBe(false);
      expect(destroyed(w)).toBe(false);
    }, WAR);
  });

  it("taking nothing: the hit destroys it, Gilles takes no damage, and the Spells and the Active close", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      // Over the 10% that would transform him.
      w.dice.every(50);
      aim(w);
      const before = hp(w);
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["nothing", "declined"] } });
      expect(destroyed(w)).toBe(true);
      expect(hp(w)).toBe(before);
      expect([...w.messages.values()].some((m) => String(m.content ?? "").includes("FGT.WeakPoint.ObjectGone"))).toBe(true);
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const verdict = (cid) => canUseAbility({
        ability: usageSpecFor(abilityOf(w, GI, cid)), unit: currentBoard().units.find((u) => u.id === GI), round: 6,
      });
      expect(verdict("summoning-horrors")).toMatchObject({ ok: false, reason: "abilityAllows" });
      expect(verdict("summoning-elder-horror")).toMatchObject({ ok: false, reason: "abilityAllows" });
      expect(verdict("gilles-prelatis-spellbook")).toMatchObject({ ok: false, reason: "notHasEffect" });
    }, WAR);
  });

  it("destroyed, it can no longer be aimed at", async () => {
    await withSubjects(duel().map((s) => (s.id === GI ? { ...s, effects: [{ defId: "spellbookDestroyed", unremovable: true }] } : s)), async ({ world: w }) => {
      w.dice.every(10);
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["nothing", "declined", "declined"] } });
      expect(w.asked.some((a) => a.title === "FGT.WeakPoint.ObjectTitle")).toBe(false);
    }, WAR);
  });

  it("Block: Gilles takes the damage, and the Spellbook stands", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      aim(w);
      const before = hp(w);
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["block", "declined", "declined"] } });
      expect(destroyed(w)).toBe(false);
      expect(hp(w)).toBeLessThan(before);
    }, WAR);
  });

  it("a failed Evade, then 20 on the die: Gilles takes the damage instead", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      w.dice.set("d20", 20);
      w.dice.set("d100", 20);
      aim(w);
      const before = hp(w);
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["evade", "accept", "declined"] } });
      expect(destroyed(w)).toBe(false);
      expect(hp(w)).toBeLessThan(before);
    }, WAR);
  });

  it("a failed Evade, 21 on the die, then a Luck Check that succeeds: kept, nobody hurt, 1 Luck spent", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      w.dice.set("d20", 20, 1);
      w.dice.set("d100", 21);
      aim(w);
      w.answer({ title: "FGT.WeakPoint.ObjectLuckTitle", by: "p1", pick: ["luck"] });
      const before = hp(w);
      const luck = w.actor(GI).system.luck.value;
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["evade", "accept", "declined"] } });
      expect(destroyed(w)).toBe(false);
      expect(hp(w)).toBe(before);
      expect(w.actor(GI).system.luck.value).toBe(luck - 1);
    }, WAR);
  });

  it("a failed Evade, 21 on the die, and no Luck Check: destroyed", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      w.dice.set("d20", 20);
      w.dice.set("d100", 21);
      aim(w);
      w.answer({ title: "FGT.WeakPoint.ObjectLuckTitle", by: "p1", decline: true });
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["evade", "accept", "declined"] } });
      expect(destroyed(w)).toBe(true);
    }, WAR);
  });

  it("the Luck Check at the rung: a failure destroys it", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      w.dice.set("d20", 20);
      aim(w);
      const { processes } = await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["luck", "declined"] } });
      expect(processes[0].history.map((h) => `${h.state}:${h.event}`)).toContain("objectResolve:destroyed");
      expect(destroyed(w)).toBe(true);
    }, WAR);
  });

  it("an Evade that succeeds hits nothing", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      w.dice.set("d20", 1);
      aim(w);
      const before = hp(w);
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["evade", "declined"], [AU]: ["declined"] } });
      expect(destroyed(w)).toBe(false);
      expect(hp(w)).toBe(before);
    }, WAR);
  });

  it("a holder with no Luck is not offered the Luck Check", async () => {
    const { rungOptions } = await import("../../module/engine/combat-process.mjs");
    expect(rungOptions({ state: "react", defenderId: GI, aimedAt: { specId: "x", luckable: false } })).not.toContain("luck");
    expect(rungOptions({ state: "react", defenderId: GI, aimedAt: { specId: "x", luckable: true } })).toContain("luck");
    expect(rungOptions({ state: "react", defenderId: GI })).not.toContain("luck");
  });

  it("declining to aim is an ordinary Attack on him", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      w.answer({ title: "FGT.WeakPoint.ObjectTitle", decline: true });
      const before = hp(w);
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["nothing", "declined", "declined"] } });
      expect(destroyed(w)).toBe(false);
      expect(hp(w)).toBeLessThan(before);
    }, WAR);
  });
});

describe("Prelati's Spellbook destroyed (PS.d.*, reading 8)", () => {
  it("on a 10 he transforms into the Gigantic Horror (PS.d.gh)", async () => {
    await withSubjects([
      { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "B" } },
      { from: "test-use-bench", id: "gillesCAttacker1", panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      w.dice.every(10);
      w.answer({ title: "FGT.WeakPoint.ObjectTitle", pick: ["object"] });
      await playAttack(w, { attacker: "gillesCAttacker1", target: GI, react: { [GI]: ["nothing", "declined"] } });
      expect(w.actor(GI).system.formTaken).toBe("giganticHorror");
      expect(w.actor(GI).system.health.value).toBe(2000);
    }, WAR);
  });

  const AU = "gillesCAttacker1", H2 = "gillesCHorror002", OTHER = "gillesCHorror003";
  it("takes his Horrors and Elder Horrors with it, unsplit, and rolls the 10% on the card", async () => {
    await withSubjects([
      { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "B" } },
      { from: "test-use-bench", id: AU, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
      { from: "horror", id: HORROR, panel: { i: 8, j: 8 }, state: { factionId: "B", summonerId: GI } },
      { from: "elder-horror", id: H2, panel: { i: 9, j: 9 }, state: { factionId: "B", summonerId: GI } },
      // Another summoner's Horror is not his.
      { from: "horror", id: OTHER, panel: { i: 2, j: 2 }, state: { factionId: "B", summonerId: AU } },
    ], async ({ world: w }) => {
      w.dice.every(50);
      w.answer({ title: "FGT.WeakPoint.ObjectTitle", pick: ["object"] });
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["nothing", "declined"] } });
      expect(w.actor(HORROR), "dismissed").toBeFalsy();
      expect(w.actor(H2), "dismissed").toBeFalsy();
      expect(w.actor(OTHER), "another summoner's").toBeTruthy();
      const card = [...w.messages.values()].map((m) => String(m.content ?? "")).find((c) => c.includes("FGT.WeakPoint.ObjectGone"));
      expect(card).toContain("FGT.WeakPoint.ObjectSummonsGone");
      expect(card).toContain("FGT.Transform.Missed");
      expect(w.messages.size).toBeGreaterThan(0);
      expect([...w.messages.values()].some((m) => String(m.content ?? "").includes("FGT.Summon.Split"))).toBe(false);
    }, WAR);
  });
});

describe("Substitution (PS.sub.*, readings 2, 6, 7)", () => {
  const AU = "gillesCAttacker1", H1 = "gillesCSubHorr01", H2 = "gillesCSubHorr02", H3 = "gillesCSubHorr03";
  // The test world makes no Actor from a pack, so the summons are Horrors
  // standing off to the side that `placeSummonsAround` moves into place, as the
  // real one places new ones: the first on the panel he left, the rest by it.
  // What creates them is the summon phase's own code, pressed live (#323).
  const duel = () => [
    { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "B", luck: { value: 3, max: 3 }, agility: { value: 12, max: 12 } } },
    { from: "test-use-bench", id: AU, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ...[H1, H2, H3].map((id, n) => ({ from: "horror", id, owner: "p1", panel: { i: 12, j: 2 + n }, state: { factionId: "B", summonerId: GI } })),
  ];
  async function stagedSummons() {
    const summoning = await import("../../module/engine/summoning.mjs");
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    const I = await import("../../module/engine/intents.mjs");
    return vi.spyOn(summoning, "placeSummonsAround").mockImplementation(async (_s, panel, ids) => {
      const used = [H1, H2, H3].slice(0, ids.length);
      const panels = [panel, { i: panel.i - 1, j: panel.j }, { i: panel.i + 1, j: panel.j }];
      await applyWorldIntents(used.map((id, n) => I.move(id, [panels[n]], true)), "test:summon");
      return used.map((id) => ({ id }));
    });
  }
  const sub = (w) => abilityOf(w, GI, "gilles-substitution");

  it("is offered only against an Attack aimed at the Spellbook", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      w.dice.every(10);
      w.answer({ title: "FGT.WeakPoint.ObjectTitle", decline: true });
      const { processes } = await playAttack(w, { attacker: AU, target: GI, react: { [GI]: ["nothing", "declined", "declined"] } });
      expect((processes[0].reactionAbilities?.[GI] ?? []).map((a) => a.id)).not.toContain(sub(w).id);
    }, WAR);
  });

  it("pays a clock, moves him, puts the Horrors round his panel, and the one on it takes the hit", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      const spy = await stagedSummons();
      w.dice.every(3);
      w.answer({ title: "FGT.WeakPoint.ObjectTitle", pick: ["object"] });
      const elder = abilityOf(w, GI, "summoning-elder-horror");
      w.answer({ title: "FGT.Substitution.PayTitle", by: "p1", pick: [elder.id] });
      const before = w.actor(GI).system.health.value;
      const { processes } = await playAttack(w, { attacker: AU, target: GI, react: { [GI]: [`ability:${sub(w).id}`] } });
      expect(spy).toHaveBeenCalledWith(expect.anything(), { i: 5, j: 5 }, ["horror", "horror", "horror"]);
      spy.mockRestore();
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const me = currentBoard().units.find((u) => u.id === GI);
      expect(me.panel).not.toEqual({ i: 5, j: 5 });
      expect(w.actor(GI).system.health.value, "he takes nothing").toBe(before);
      expect(processes[0].defenderId, "the Horror on his panel").toBe(H1);
      expect(processes[0].history.map((h) => `${h.state}:${h.event}`)).not.toContain("objectResolve:destroyed");
      expect(w.actor(H1)?.system.health.value ?? 0, "the Horror took it").toBeLessThan(100);
      expect(held(w, GI)).not.toContain("spellbookDestroyed");
      expect(elder.system.cooldown.remaining).toBe(9);
    }, WAR);
  });

  it("the Horrors' clock counts the Horrors this Substitution summoned", async () => {
    await withSubjects(duel(), async ({ world: w }) => {
      const spy = await stagedSummons();
      w.dice.every(2);
      w.answer({ title: "FGT.WeakPoint.ObjectTitle", pick: ["object"] });
      const horrorsSpell = abilityOf(w, GI, "summoning-horrors");
      w.answer({ title: "FGT.Substitution.PayTitle", by: "p1", pick: [horrorsSpell.id] });
      await playAttack(w, { attacker: AU, target: GI, react: { [GI]: [`ability:${sub(w).id}`] } });
      spy.mockRestore();
      // Two Horrors at ⅔◈ each, 2 Turns a Horror at three a Round.
      expect(horrorsSpell.system.cooldown.remaining).toBe(4);
    }, WAR);
  });
});

describe("the Gigantic Horror's form (GH.*, readings 11, 13, 18, 20)", () => {
  const low = { health: { value: 100, max: 500 }, luck: { value: 1, max: 4 }, agility: { value: 12, max: 12 } };
  const scene = (state = {}) => [{ from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A", ...low, ...state } }];
  const verdictOf = async (w, cid) => {
    const { canUseAbility } = await import("../../module/rules/costs.mjs");
    const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
    const { currentBoard } = await import("../../module/engine/board.mjs");
    return canUseAbility({ ability: usageSpecFor(abilityOf(w, GI, cid)), unit: currentBoard().units.find((u) => u.id === GI), round: 6 });
  };

  // Live, 2026-10-22: transformed with the Spellbook whole and its clock at 0,
  // the GM's Summoning: Horrors was refused `abilityAllows`: the form had
  // dropped the Spellbook from the abilities the gate reads.
  it("the Spells keep reading the Spellbook: open while it stands and rests, shut while it cools (11i)", async () => {
    await withSubjects(scene({ formTaken: "giganticHorror" }), async ({ world: w }) => {
      const open = await verdictOf(w, "summoning-horrors");
      expect(["abilityAllows", "abilityOffCooldown"], JSON.stringify(open)).not.toContain(open.reason);
      await abilityOf(w, GI, "gilles-prelatis-spellbook").update({ "system.cooldown.remaining": 24 });
      expect(await verdictOf(w, "summoning-horrors")).toMatchObject({ ok: false, reason: "abilityOffCooldown" });
    }, WAR);
  });

  it("is refused at 25% Health or more", async () => {
    await withSubjects(scene({ health: { value: 125, max: 500 } }), async ({ world: w }) => {
      expect(await verdictOf(w, "gilles-gigantic-horror")).toMatchObject({ ok: false, reason: "healthBelow" });
    }, WAR);
  });

  it("under 25%: he takes the form, his pools the form's own and his Luck refilled", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      const out = await castSkill(w, { caster: GI, ability: abilityOf(w, GI, "gilles-gigantic-horror").id });
      expect(out.ok, out.reason).toBe(true);
      const s = w.actor(GI).system;
      expect(s.formTaken).toBe("giganticHorror");
      expect([s.health.value, s.health.max, s.agility.value, s.agility.max, s.luck.value]).toEqual([2000, 2000, 0, 0, 4]);
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const g = currentBoard().units.find((u) => u.id === GI);
      expect(g.mov).toBe(0);
      expect(g.range).toBe(3);
      expect(g.detect).toBe(3);
      expect(g.sustainability).toBeNull();
      expect(g.baseAttack).toEqual(expect.objectContaining({ str: 200, mag: 200 }));
      expect(g.normalAttack).toMatchObject({ mode: "rangeBanded", shape: { kind: "square", size: 3 } });
      // Exactly these three (11c): live, 2026-10-22, the derived Magus of a
      // Caster rode in beside them.
      expect([...g.attributes].sort()).toEqual(["dark", "large", "outsider"]);
      // ...and the same set where his own passives are gated (one reader).
      const { attributesOf } = await import("../../module/rules/snapshot.mjs");
      expect([...attributesOf(w.actor(GI))].sort()).toEqual(["dark", "large", "outsider"]);
      expect(g.attributes).not.toContain("humanoid");
      expect(g.attributes).not.toContain("vitalSpot");
      expect([...s.servantClasses]).toEqual(["caster"]);
    }, WAR);
  });

  it("keeps what the sheet names; everything else goes (11f)", async () => {
    await withSubjects(scene({ formTaken: "giganticHorror" }), async ({ world: w, unit }) => {
      const g = unit(GI);
      expect(await verdictOf(w, "gilles-blasphemy-aesthetic")).toMatchObject({ ok: false, reason: "goneInForm" });
      expect(await verdictOf(w, "gilles-prelatis-spellbook")).toMatchObject({ ok: false, reason: "goneInForm" });
      expect((await verdictOf(w, "gilles-evil-gaze-of-the-abyss")).reason).not.toBe("goneInForm");
      expect((await verdictOf(w, "summoning-horrors")).reason).not.toBe("goneInForm");
      expect(g.weakPoints).toEqual([]);
      expect((g.applicationChances ?? []).length, "Mental Pollution gone").toBe(0);
      expect((g.abilities ?? []).map((a) => a.name)).not.toContain("Territory Creation");
      expect((g.learnsTrueNames ?? []).length, "Appreciation of the Arts gone").toBe(0);
    }, WAR);
  });

  it("Evil Gaze hits a 5x5 in his form", async () => {
    await withSubjects(scene({ formTaken: "giganticHorror" }), async ({ world: w, unit }) => {
      const { targetSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { rollOptionsFor } = await import("../../module/rules/options.mjs");
      const spec = targetSpecFor(abilityOf(w, GI, "gilles-evil-gaze-of-the-abyss"), 3, rollOptionsFor({ attacker: unit(GI) }), unit(GI));
      // The anchor a player turns, whichever size: a `conditional` anchor
      // offered no direction (found pressing #323).
      expect(spec.anchor.kind).toBe("selfEdgeAdjacent");
      expect(spec.shape).toMatchObject({ short: 5, long: 5 });
    }, WAR);
  });

  it("Evil Gaze is a 3x3 he aims, out of his form", async () => {
    await withSubjects(scene(), async ({ world: w, unit }) => {
      const { targetSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { rollOptionsFor } = await import("../../module/rules/options.mjs");
      const spec = targetSpecFor(abilityOf(w, GI, "gilles-evil-gaze-of-the-abyss"), 3, rollOptionsFor({ attacker: unit(GI) }), unit(GI));
      expect(spec.anchor.kind).toBe("selfEdgeAdjacent");
      expect(spec.shape).toMatchObject({ short: 3, long: 3 });
    }, WAR);
  });

  it("a Storm Border's ban on Large creations refuses the change", async () => {
    const { canTransform } = await import("../../module/engine/transform.mjs");
    await withSubjects(scene(), async ({ world: w }) => {
      const item = abilityOf(w, GI, "gilles-gigantic-horror");
      const board = (s) => ({ units: [{ id: GI, suppressions: s }] });
      expect(canTransform(w.actor(GI), item, board([]))).toBe(true);
      expect(canTransform(w.actor(GI), item, board([{ scope: "creating", attributes: ["large", "giant"] }]))).toBe(false);
    }, WAR);
  });
});

describe("Gilles defeated (PS.f.*, GH.save, readings 9, 10)", () => {
  const FOE3 = "gillesCFoe000003";
  const field = (state = {}) => [
    { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A", ...state } },
    { from: "medea", id: FOE, panel: { i: 2, j: 2 }, state: { factionId: "B" } },
    { from: "medea", id: FOE3, panel: { i: 9, j: 9 }, state: { factionId: "B" } },
  ];
  const defeat = async (unit, chance) => {
    const { resolveDefeat } = await import("../../module/engine/scheduler.mjs");
    const { currentBoard } = await import("../../module/engine/board.mjs");
    const board = currentBoard();
    return resolveDefeat({ ...unit(GI), health: 0 }, { tick: 18, turnsPerRound: 3, board, options: new Set(), rolls: { "revival:giganticHorrorOnDefeat:chance": chance } });
  };
  const logs = (intents) => intents.filter((i) => i.t === "log").map((i) => i.entry);

  it("on a 10 the transformation replaces the defeat", async () => {
    await withSubjects(field(), async ({ unit }) => {
      const out = await defeat(unit, 10);
      expect(out.some((i) => i.t === "defeat")).toBe(false);
      expect(logs(out)).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "transform", ability: "gilles-gigantic-horror", cause: "defeat" }),
        expect.objectContaining({ kind: "revive", chance: 10, chanceRoll: 10 }),
      ]));
    }, WAR);
  });

  // Live, 2026-10-22: "Caster is defeated and revived by Prelati's Spellbook:
  // Gigantic Horror, with 500 Health." over a form that stands at 2000.
  it("the card for the transformation says he becomes it, with no Health of his own", async () => {
    await withSubjects(field(), async ({ unit }) => {
      const { revivalCard } = await import("../../module/engine/revival-report.mjs");
      const entry = logs(await defeat(unit, 10)).find((e) => e.kind === "revive");
      expect(entry.transform).toBe("gilles-gigantic-horror");
      const t = (key, data) => `${key}${data ? JSON.stringify(data) : ""}`;
      const card = revivalCard(entry, () => "Caster", () => "Gigantic Horror", t);
      expect(card).toContain("FGT.Revival.Transformed");
      expect(card).not.toContain("FGT.Revival.Card");
    }, WAR);
  });

  it("on an 11 he falls, the miss is a line, and one Elder Horror per Servant on the board appears around him", async () => {
    await withSubjects(field(), async ({ unit }) => {
      const out = await defeat(unit, 11);
      expect(out.some((i) => i.t === "defeat")).toBe(true);
      expect(logs(out)).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "revivalChanceMissed", chance: 10, roll: 11 }),
        expect.objectContaining({ kind: "summonAround", contentId: "elder-horror", count: 2, outlives: true }),
      ]));
    }, WAR);
  });

  // Live, 2026-10-22: "5 of 5 Elder Horror appear around Caster." was posted
  // above "Caster rolls 56 against 10% ...": the outcome before its die.
  it("the missed die is said before the Elder Horrors it brings", async () => {
    await withSubjects(field(), async ({ world: w, unit }) => {
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      await applyWorldIntents(await defeat(unit, 11), "test");
      const said = [...w.messages.values()].map((m) => m.content ?? m.doc?.content ?? "");
      const die = said.findIndex((c) => c.includes("FGT.Revival.Chance"));
      const around = said.findIndex((c) => c.includes("FGT.Summon.Around"));
      expect(die, said.join("\n")).toBeGreaterThanOrEqual(0);
      expect(around).toBeGreaterThan(die);
    }, WAR);
  });

  // Ruled 2026-10-23: inside a Storm Border the 10% does not roll (11h), and
  // the *"Otherwise"* Elder Horrors still appear; the card says why no die.
  it("inside a Storm Border: no die, the Elder Horrors all the same, and a line for the die", async () => {
    await withSubjects(field(), async ({ unit }) => {
      const { resolveDefeat } = await import("../../module/engine/scheduler.mjs");
      const { pendingRevivalRolls } = await import("../../module/rules/revival.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const aboard = { ...unit(GI), health: 0, platformContentId: "platform-storm-border" };
      expect(pendingRevivalRolls(aboard).map((r) => r.key)).not.toContain("revival:giganticHorrorOnDefeat:chance");
      const out = await resolveDefeat(aboard, { tick: 18, turnsPerRound: 3, board: currentBoard(), options: new Set(), rolls: {} });
      expect(out.some((i) => i.t === "defeat")).toBe(true);
      expect(logs(out)).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: "revivalChanceMissed", barred: true, roll: null }),
        expect.objectContaining({ kind: "summonAround", contentId: "elder-horror", outlives: true }),
      ]));
      expect(logs(out).some((e) => e.kind === "transform")).toBe(false);
    }, WAR);
  });

  // Live, 2026-10-23: he fell inside the Storm Border and his five Elder Horrors
  // appeared on the ground Level, outside it.
  it("summons made inside a pocket dimension appear inside it", async () => {
    const { summonLevelFor } = await import("../../module/engine/summoning.mjs");
    const board = { dimensionLevels: ["stormLevel"], units: [] };
    const token = { level: "stormLevel", elevation: 0 };
    expect(summonLevelFor({ levelId: "stormLevel" }, token, {}, board)).toBe("stormLevel");
    expect(summonLevelFor({ levelId: "defaultLevel0000" }, { level: "defaultLevel0000" }, {}, board), "the ground").toBeNull();
    expect(summonLevelFor({ levelId: "deck" }, { level: "deck" }, { boundToPlatformId: "garden" }, board), "bound to a platform").toBe("deck");
  });

  it("with the Spellbook destroyed: no die, no Elder Horrors", async () => {
    await withSubjects(field().map((s) => (s.id === GI ? { ...s, effects: [{ defId: "spellbookDestroyed", unremovable: true }] } : s)), async ({ unit }) => {
      const out = await defeat(unit, 1);
      expect(logs(out).some((e) => e.kind === "transform" || e.kind === "summonAround" || e.kind === "revivalChanceMissed")).toBe(false);
    }, WAR);
  });

  it("as the Gigantic Horror, final (GH.final)", async () => {
    await withSubjects(field({ formTaken: "giganticHorror" }), async ({ unit }) => {
      const out = await defeat(unit, 1);
      expect(out.some((i) => i.t === "defeat")).toBe(true);
      expect(logs(out).some((e) => e.kind === "summonAround" || e.kind === "transform")).toBe(false);
    }, WAR);
  });
});

describe("the Gigantic Horror's GM (GH.ctrl to GH.near, reading 12)", () => {
  const MASTER = "gillesCMaster001", ALLY2 = "gillesCAlly00002";
  const scene = () => [
    { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A", formTaken: "giganticHorror", masterId: MASTER } },
    { from: "medea", id: ALLY2, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
    { from: "medea", id: FOE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
    { from: "horror", id: HORROR, panel: { i: 6, j: 5 }, state: { factionId: "A", summonerId: GI } },
  ];

  it("stands on a side of its own, an enemy to his old allies; his Horrors join it", async () => {
    await withSubjects(scene(), async ({ unit, board }) => {
      const { relationOf } = await import("../../module/rules/relations.mjs");
      expect(unit(GI).actingFactionId).toBe("gm");
      expect(unit(HORROR).actingFactionId).toBe("gm");
      expect(relationOf(unit(GI), unit(ALLY2), board)).toBe("enemy");
      expect(relationOf(unit(GI), unit(HORROR), board)).toBe("ally");
    }, WAR);
  });

  it("must Attack the nearest Unit, any side: its own Horror next to it", async () => {
    await withSubjects(scene(), async ({ unit }) => {
      expect(unit(GI).compulsions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "nearest", forcesTarget: true, targetIds: [HORROR] }),
      ]));
    }, WAR);
  });

  // 11g: *"hitting every Unit in it but himself"*. Live, 2026-10-22, the 3x3
  // took enemies only, so the compelled Attack on its own Horror was refused.
  it("its Normal Attack hits every Unit in the 3x3 but himself, its own Horror too", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      await resolveAttack({ attackerId: GI, abilityId: null, placement: { unitId: HORROR, chosenIds: [HORROR] } });
      const hit = [...w.messages.values()].map((m) => m.getFlag?.("fgt", "defenderId") ?? m.flags?.fgt?.defenderId).filter(Boolean);
      expect(hit).toContain(HORROR);
      expect(hit).not.toContain(GI);
    }, WAR);
  });

  // Live, 2026-10-22: "When it Attacks" bound his Skills too, and narrowed the
  // 3x3 to the nearest Unit alone.
  it("the nearest binds his Attacks only, and his 3x3 on it hits the rest of the area", async () => {
    const OTHER = "gillesCFoe000004";
    const near = [...scene(), { from: "medea", id: OTHER, panel: { i: 7, j: 6 }, state: { factionId: "B" } },
      { from: "medea", id: "gillesCFoe000005", panel: { i: 3, j: 5 }, state: { factionId: "B" } }];
    await withSubjects(near, async ({ world: w }) => {
      const { resolveTargets } = await import("../../module/rules/targeting/resolve.mjs");
      const { targetSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { rollOptionsFor } = await import("../../module/rules/options.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const g = board.units.find((u) => u.id === GI);
      const ids = (r) => r.units.map((u) => u.unitId ?? u.id);
      const gaze = targetSpecFor(abilityOf(w, GI, "gilles-evil-gaze-of-the-abyss"), g.range, rollOptionsFor({ attacker: g }), g);
      expect(ids(resolveTargets(gaze, g, board, { unitId: GI, panel: g.panel, direction: "n", reach: "skill" })))
        .toContain("gillesCFoe000005");
      const swing = targetSpecFor(null, g.range, null, g);
      expect(ids(resolveTargets(swing, g, board, { unitId: HORROR })))
        .toEqual(expect.arrayContaining([HORROR, OTHER]));
    }, WAR);
  });

  // Live, 2026-10-22: four Horrors he summoned as the Gigantic Horror came out
  // owned by Player1, the faction roster's owner.
  it("its player only watches it and every summon of it, the roster's sync too (12g)", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      const { syncOne } = await import("../../module/engine/faction-ownership.mjs");
      const rows = [{ id: "A", userIds: ["p1"] }];
      for (const id of [GI, HORROR]) {
        await syncOne(w.actor(id), rows);
        expect(w.actor(id).ownership.p1, id).toBe(CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
      }
      await syncOne(w.actor(ALLY2), rows);
      expect(w.actor(ALLY2).ownership.p1, "an ordinary ally stays his").toBe(CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    }, WAR);
  });

  it("refuses its Master's Command Spells", async () => {
    const { canSpend } = await import("../../module/rules/command-spells.mjs");
    await withSubjects(scene(), async ({ unit }) => {
      expect(canSpend({ id: "x", cost: 1 }, { servant: unit(GI), master: { id: MASTER, commandSpells: { value: 3 } } }))
        .toMatchObject({ ok: false, reason: "uncommandable" });
    }, WAR);
  });

  // Live, 2026-10-22: Player1's Command Spell button read "No Command Spell can
  // be spent now." with the reason never said.
  it("its Master's bar says why no Command Spell is offered", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const { CommandSpellRegistry } = await import("../../module/rules/cs-registry.mjs");
    const dir = new URL("../../packs/_source/command-spells/", import.meta.url);
    CommandSpellRegistry.load(readdirSync(dir).filter((f) => f.endsWith(".yml"))
      .map((f) => parse(readFileSync(new URL(f, dir), "utf8"))).map((y) => ({ name: y.name, system: { ...y, contentId: y.id } })));
    const withMaster = [
      ...scene().map((s) => (s.id === GI ? { ...s, state: { ...s.state, contract: "contracted" } } : s)),
      { from: "master-advanced", id: MASTER, owner: "p1", panel: { i: 2, j: 5 }, state: { factionId: "A" } },
    ];
    await withSubjects(withMaster, async ({ world: w }) => {
      await w.actor(MASTER).update({ "system.commandSpells": 3 });
      const { offerCommands } = await import("../../module/engine/command-spells.mjs");
      expect(offerCommands({ masterId: MASTER, window: "ownTurn", context: { servantId: GI } })).toEqual([]);
      const { performAction } = await import("../../module/engine/actions.mjs");
      expect(await performAction("commandSpell", { actor: w.actor(MASTER) })).toMatchObject({ ok: false, reason: "uncommandable" });
    }, WAR);
  });

  it("acts in the GM's slot, and not on a player's Turn", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const gaze = usageSpecFor(abilityOf(w, GI, "gilles-evil-gaze-of-the-abyss"));
      const me = currentBoard().units.find((u) => u.id === GI);
      expect(canUseAbility({ ability: gaze, unit: me, round: 6, actingFactionId: "A" })).toMatchObject({ ok: false, reason: "notOwnTurn" });
      expect(canUseAbility({ ability: gaze, unit: me, round: 6, actingFactionId: null }).reason).not.toBe("notOwnTurn");
    }, WAR);
  });

  it("transforming hands his player's controls to the GM, who keeps sight of him", async () => {
    await withSubjects([
      { from: "gilles", id: GI, owner: "p1", panel: { i: 5, j: 5 }, state: { factionId: "A", health: { value: 100, max: 500 } } },
    ], async ({ world: w }) => {
      await castSkill(w, { caster: GI, ability: abilityOf(w, GI, "gilles-gigantic-horror").id });
      expect(w.actor(GI).ownership.p1).toBe(2);
    }, WAR);
  });
});

describe("the Gigantic Horror's Range (GH.grow, GH.reset, reading 19)", () => {
  // Live, 2026-10-22: Nemo stood beside it all Round 25 and was moved off in
  // the GM's slot; the Range grew at the Round's end all the same.
  it("a Unit in reach at any Turn's end holds that Round's growth, though it left before the Round ended", async () => {
    await withSubjects([
      { from: "gilles", id: GI, owner: "p1", panel: { i: 2, j: 2 }, state: { factionId: "A", formTaken: "giganticHorror" } },
      { from: "test-use-bench", id: FOE, panel: { i: 2, j: 4 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { growFormRanges, noteFormReach } = await import("../../module/engine/form-range.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      await noteFormReach(currentBoard(), 6);
      await applyWorldIntents([I.move(FOE, [{ i: 2, j: 9 }], true)], "test");
      await growFormRanges(currentBoard(), { round: 6 });
      expect(w.actor(GI).system.formRangeBonus, "Round 6 had a Unit in reach").toBe(0);
      await growFormRanges(currentBoard(), { round: 7 });
      expect(w.actor(GI).system.formRangeBonus, "Round 7 had none").toBe(1);
    }, WAR);
  });

  it("grows by 1 at a Round's end with no Unit in reach, and an Attack resets it", async () => {
    await withSubjects([
      { from: "gilles", id: GI, owner: "p1", panel: { i: 2, j: 2 }, state: { factionId: "A", formTaken: "giganticHorror" } },
      { from: "test-use-bench", id: FOE, panel: { i: 2, j: 8 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { growFormRanges, resetFormRange } = await import("../../module/engine/form-range.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      await growFormRanges(currentBoard());
      expect(w.actor(GI).system.formRangeBonus).toBe(1);
      expect(currentBoard().units.find((u) => u.id === GI).range).toBe(4);
      await growFormRanges(currentBoard());
      expect(currentBoard().units.find((u) => u.id === GI).range).toBe(5);
      expect(currentBoard().units.find((u) => u.id === GI).detect).toBe(5);
      // Now 6 is in reach of 5? No: 6 away stays out, and one more Round reaches it.
      await growFormRanges(currentBoard());
      expect(currentBoard().units.find((u) => u.id === GI).range).toBe(6);
      await growFormRanges(currentBoard());
      expect(currentBoard().units.find((u) => u.id === GI).range, "a Unit in reach: no growth").toBe(6);
      await resetFormRange(GI);
      expect(currentBoard().units.find((u) => u.id === GI).range).toBe(3);
    }, WAR);
  });
});
