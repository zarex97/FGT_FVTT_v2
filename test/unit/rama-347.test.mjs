/**
 * Rama (Saber), audit #347: his sheet built through the real projection, and
 * the pieces he brought: abilities a summon's coin and dice grant, a Normal
 * Attack made in a method a passive grants, an attack's own damage-dealt figure,
 * Guts that revives with a flat figure, a die that breaks an NP for the game, and
 * a lethal Attack cancelled on a chance per counter.
 * @see docs/superpowers/specs/2026-10-28-rama-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const RAMA = "rama000000000001";
const FOE = "ramaFoe000000001";
const DEMON = "ramaDemon0000001";
const ALLY = "ramaAlly00000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const FOES_TURN = { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);
const effectOf = (w, id, defId) => [...w.actor(id).effects].find((e) => e.system?.defId === defId);
const ALL_FIVE = ["sudarshana", "shuuravara", "modhakiShikhari", "trishula", "pinaka"];
const granted = (keys = ALL_FIVE) => ({ vishnuBhuja: { coin: 1, dice: [1, 2], rerolled: [], keys, picks: 0 } });
const rama = (extra = {}) => ({
  from: "rama", id: RAMA, panel: { i: 6, j: 6 },
  ...extra,
  state: { factionId: "A", summonGranted: granted(), ...(extra.state ?? {}) },
});
const said = (w) => w.messages.contents.map((m) => JSON.stringify(m.flags?.fgt?.effects ?? [])).join(" ");
const live = async (id) => {
  const { currentBoard } = await import("../../module/engine/board.mjs");
  return currentBoard().units.find((u) => u.id === id) ?? null;
};
const NOTHING = (...ids) => Object.fromEntries(ids.map((id) => [id, ["nothing", "declined", "declined", "declined"]]));

/* ========================================================================== */

describe("the sheet, projected (ST.*)", () => {
  it("Saber, Lawful Good, India; A B A+ B B; 1250, MOV 6, Range 1; BA 150/175 by the table; STR Melee; 2◈", async () => {
    await withSubjects([rama()], ({ unit, world: w }) => {
      const r = unit(RAMA);
      expect(r.servantClasses).toEqual(["saber"]);
      expect(r.alignment).toMatchObject({ order: "lawful", morality: "good" });
      expect(r.region).toEqual(["india"]);
      expect(r.attributes).toEqual(expect.arrayContaining(["male", "servant", "sky", "humanoid", "king"]));
      expect(Object.fromEntries(Object.entries(r.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "A", end: "B", agi: "A+", mag: "B", luc: "B" });
      expect(r.maxHealth ?? r.health?.max).toBe(1250);
      expect(r.mov).toBe(6);
      expect(r.range).toBe(1);
      expect(r.baseAttack).toEqual(expect.objectContaining({ str: 150, mag: 175 }));
      expect(w.actor(RAMA).system.normalAttack).toMatchObject({ component: "str", delivery: "melee" });
      expect(w.actor(RAMA).system.sustainability).toBe("2◈");
      expect(w.actor(RAMA).system.resources.reunion).toMatchObject({ value: 0 });
    });
  });

  it("holds Magic Resistance A, Riding A+ (MOV +5, 3◈−⅓◈) and Divinity A Revised", async () => {
    await withSubjects([rama()], ({ world: w }) => {
      expect(abilityOf(w, RAMA, "class-magic-resistance").system.rank).toBe("A");
      const riding = abilityOf(w, RAMA, "class-riding-unlocks");
      expect(riding.system.rank).toBe("A+");
      expect(riding.system.cooldown?.max ?? riding.system.cooldown).toBeTruthy();
      expect(abilityOf(w, RAMA, "divinity").system.rank).toBe("A");
    });
  });
});

describe("Vishnu Bhuja's summon roll (VB.*)", () => {
  it("no die gave them: none of the five, nor their Normal Attacks, is his", async () => {
    await withSubjects([rama({ state: { summonGranted: {} } })], ({ unit }) => {
      const ids = (unit(RAMA).abilities ?? []).map((a) => a.contentId);
      expect(ids).toEqual(expect.arrayContaining(["rama-vishnu-bhuja", "rama-brahmastra", "rama-martial-blessing"]));
      for (const id of ["rama-sudarshana", "rama-pinaka", "rama-pinaka-normal-attack", "rama-trishula-normal-attack"]) {
        expect(ids).not.toContain(id);
      }
      expect((unit(RAMA).formDropped ?? []).map((a) => a.contentId)).not.toContain("rama-pinaka");
    });
  });

  it("what the dice gave is his, both halves", async () => {
    await withSubjects([rama({ state: { summonGranted: granted(["sudarshana", "pinaka"]) } })], ({ unit }) => {
      const ids = (unit(RAMA).abilities ?? []).map((a) => a.contentId);
      expect(ids).toEqual(expect.arrayContaining([
        "rama-sudarshana", "rama-sudarshana-normal-attack", "rama-pinaka", "rama-pinaka-normal-attack",
      ]));
      expect(ids).not.toContain("rama-trishula");
    });
  });

  it("the outcome: faces held, a 6 a pick owed; a double other than 6 rolls again", async () => {
    const { grantOutcome, rollsAgain, picksOwed, describeOutcome, diceOf } = await import("../../module/rules/summon-grants.mjs");
    const spec = {
      id: "vishnuBhuja", label: "Vishnu Bhuja", coin: { heads: 2, tails: 1 }, die: 6, choose: 6, rerollDoubles: true,
      faces: ALL_FIVE.map((key, i) => ({ face: i + 1, key, label: key })),
    };
    expect(diceOf(spec, 1)).toBe(2);
    expect(diceOf(spec, 2)).toBe(1);
    expect(rollsAgain(spec, [3], 3)).toBe(true);
    expect(rollsAgain(spec, [6], 6)).toBe(false);
    expect(rollsAgain(spec, [3], 5)).toBe(false);
    expect(grantOutcome(spec, { coin: 1, dice: [3, 5] })).toMatchObject({ keys: ["modhakiShikhari", "pinaka"], picks: 0 });
    expect(grantOutcome(spec, { coin: 1, dice: [6, 2] })).toMatchObject({ keys: ["shuuravara"], picks: 1 });
    expect(grantOutcome(spec, { coin: 1, dice: [6, 6] })).toMatchObject({ keys: [], picks: 2 });
    const owed = picksOwed({ system: { summonGrants: [spec], summonGranted: { vishnuBhuja: grantOutcome(spec, { coin: 1, dice: [6, 2] }) } } });
    expect(owed[0].count).toBe(1);
    expect(owed[0].options.map((o) => o.key)).not.toContain("shuuravara");
    expect(describeOutcome(spec, { coin: 1, dice: [3, 5], rerolled: [3], keys: ["modhakiShikhari", "pinaka"], picks: 0 }))
      .toBe("Heads: 3, 5 (rolled again: 3) → modhakiShikhari, pinaka");
  });

  it("rolled: heads, 3 and 3 rolls the second again; its 5 stands", async () => {
    await withSubjects([rama()], async ({ world: w }) => {
      const { rollLine } = await import("../../module/engine/summon.mjs");
      const { grantLine } = await import("../../module/rules/summon-grants.mjs");
      const spec = w.actor(RAMA).system.summonGrants[0];
      w.dice.set("d2", 1);
      w.dice.set("d6", 3, 3, 5);
      const out = await rollLine(grantLine(spec));
      expect(out.total).toEqual({ coin: 1, dice: [3, 5], rerolled: [3] });
    });
  });

  it("rolled: heads, 6 and 6 stand: two picks", async () => {
    await withSubjects([rama()], async ({ world: w }) => {
      const { rollLine } = await import("../../module/engine/summon.mjs");
      const { grantLine, grantOutcome } = await import("../../module/rules/summon-grants.mjs");
      const spec = w.actor(RAMA).system.summonGrants[0];
      w.dice.set("d2", 1);
      w.dice.set("d6", 6, 6);
      const out = await rollLine(grantLine(spec));
      expect(out.total).toEqual({ coin: 1, dice: [6, 6], rerolled: [] });
      expect(grantOutcome(spec, out.total)).toMatchObject({ keys: [], picks: 2 });
    });
  });

  it("rolled: tails, one die", async () => {
    await withSubjects([rama()], async ({ world: w }) => {
      const { rollLine } = await import("../../module/engine/summon.mjs");
      const { grantLine } = await import("../../module/rules/summon-grants.mjs");
      w.dice.set("d2", 2);
      w.dice.set("d6", 4);
      const out = await rollLine(grantLine(w.actor(RAMA).system.summonGrants[0]));
      expect(out.total).toEqual({ coin: 2, dice: [4], rerolled: [] });
    });
  });

  it("the summon plan carries the line, resolved into what it gave", async () => {
    const { servantSetupPlan, resolveSetupPlan, summonItemsGranted } = await import("../../module/rules/setup-rolls.mjs");
    const { summonGrantsResolved } = await import("../../module/rules/summon-grants.mjs");
    await withSubjects([rama()], ({ world: w }) => {
      const sheet = w.actor(RAMA).system;
      const plan = servantSetupPlan({ ...sheet, summonGrants: sheet.summonGrants });
      const line = plan.lines.find((l) => l.id === "summonGrant:vishnuBhuja");
      expect(line).toBeTruthy();
      const lines = resolveSetupPlan(plan, { maxAgility: 1, maxLuck: 1, "summonGrant:vishnuBhuja": { coin: 1, dice: [1, 5], rerolled: [] } });
      expect(summonItemsGranted(lines)).toEqual([]);
      expect(summonGrantsResolved(lines).vishnuBhuja).toMatchObject({ keys: ["sudarshana", "pinaka"], picks: 0 });
      expect(lines.find((l) => l.id === "summonGrant:vishnuBhuja").value).toMatch(/^Heads: 1, 5/);
    });
  });
});

describe("found pressing live (#347)", () => {
  it("a War's start marks the pick a 6 owes, for tokens placed by hand before it", async () => {
    await withSubjects([rama({ state: { summonGranted: { vishnuBhuja: { coin: 1, dice: [6, 2], rerolled: [], keys: ["shuuravara"], picks: 1 } } } })], async ({ world: w }) => {
      const { attachOpeningChoice } = await import("../../module/engine/opening-choice.mjs");
      attachOpeningChoice();
      w.answer({ title: "FGT.SummonGrant.Title", by: undefined, pick: ["pinaka"] });
      Hooks.callAll("combatStart", game.combat, {});
      for (let n = 0; n < 40 && (w.actor(RAMA).system.summonGranted.vishnuBhuja.picks ?? 0) > 0; n++) await new Promise((r) => setTimeout(r, 50));
      expect(w.actor(RAMA).system.summonGranted.vishnuBhuja).toMatchObject({ keys: ["shuuravara", "pinaka"], picks: 0 });
    }, WAR);
  });

  it("a card note is its own words, never \"not applied\"", async () => {
    const { effectLine } = await import("../../module/rules/card-visibility.mjs");
    expect(effectLine({ id: "note", name: "Shiva Dhanush: 1d12 → 10. It holds (breaks on 5).", outcome: "note" }))
      .toBe("Shiva Dhanush: 1d12 → 10. It holds (breaks on 5).");
  });
});

describe("the Normal Attacks Vishnu Bhuja grants (SU.p, SH.p, MS.p, TR.p, PI.p, VB.p.*)", () => {
  it("are the Normal Attack to the gate: Seal stops them, Skill Seal and NP Seal do not", async () => {
    const { useClassesOf } = await import("../../module/rules/costs.mjs");
    const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
    await withSubjects([rama()], ({ world: w }) => {
      const na = abilityOf(w, RAMA, "rama-sudarshana-normal-attack");
      expect(useClassesOf(usageSpecFor(na))).toEqual(["attack"]);
      expect(useClassesOf(usageSpecFor(abilityOf(w, RAMA, "rama-sudarshana")))).toContain("np");
    });
  });

  it("may answer a Counter rung, and spends its once per Round there (reading 18)", async () => {
    const { answersACounter } = await import("../../module/rules/counter.mjs");
    await withSubjects([rama()], ({ world: w }) => {
      for (const id of ["rama-sudarshana-normal-attack", "rama-pinaka-normal-attack"]) {
        expect(answersACounter(abilityOf(w, RAMA, id))).toBe(true);
      }
    });
  });

  it("need Martial Blessing", async () => {
    const { canUseAbility } = await import("../../module/rules/costs.mjs");
    const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
    await withSubjects([rama()], ({ unit, world: w }) => {
      expect(canUseAbility({ unit: unit(RAMA), ability: usageSpecFor(abilityOf(w, RAMA, "rama-trishula-normal-attack")), round: 6 }).ok).toBe(true);
    });
    await withSubjects([rama({ with: { abilities: [{ ref: "rama-trishula-normal-attack" }] } })], ({ unit, world: w }) => {
      const out = canUseAbility({ unit: unit(RAMA), ability: usageSpecFor(abilityOf(w, RAMA, "rama-trishula-normal-attack")), round: 6 });
      expect(out).toMatchObject({ ok: false, reason: "hasSkill", detail: { names: "Martial Blessing" } });
    });
  });

  it("once a Round each: a second Trishula swing the same Round is refused", async () => {
    await withSubjects([
      rama(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 8 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-trishula-normal-attack").id, target: FOE, react: NOTHING(FOE, RAMA) });
      const now = await live(RAMA);
      expect(canUseAbility({ unit: now, ability: usageSpecFor(abilityOf(w, RAMA, "rama-trishula-normal-attack")), round: 6 }))
        .toMatchObject({ ok: false, reason: "oncePerRound" });
    }, WAR);
  });

  it("Sudarshana's swing: BA(STR) at Range 4, Ranged, −30% in the bucket beside Atk Up", async () => {
    await withSubjects([
      rama(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 10 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-sudarshana-normal-attack").id, target: FOE, react: NOTHING(FOE, RAMA) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      expect(JSON.stringify(result.breakdown)).toContain("Sudarshana (−30%)");
      expect(w.actor(FOE).system.health.value).toBeLessThan(w.actor(FOE).system.health.max);
    }, WAR);
  });

  it("Modhaki's swing: +20% at his own Range", async () => {
    await withSubjects([
      rama(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-modhaki-and-shikhari-normal-attack").id, target: FOE, react: NOTHING(FOE, RAMA) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      expect(JSON.stringify(result.breakdown)).toContain("Modhaki and Shikhari (+20%)");
    }, WAR);
  });
});

describe("Sudarshana (SU.*)", () => {
  it("strikes two enemies within 3, each its own Process and Bleed die; one will do", async () => {
    await withSubjects([
      rama(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 8 }, state: { factionId: "B" } },
      { from: "medea", id: DEMON, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      const { declared } = await playAttack(w, {
        attacker: RAMA, ability: abilityOf(w, RAMA, "rama-sudarshana").id,
        placement: { chosenIds: [FOE, DEMON] }, react: NOTHING(FOE, DEMON, RAMA),
      });
      expect((declared.processes ?? []).length).toBe(2);
      expect(w.actor(FOE).system.health.value).toBeLessThan(w.actor(FOE).system.health.max);
      expect(w.actor(DEMON).system.health.value).toBeLessThan(w.actor(DEMON).system.health.max);
    }, WAR);
  });
});

describe("Pinaka's bow (PI.die, PI.p.die, PI.broken)", () => {
  const scene = () => [
    rama(),
    { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 10 }, state: { factionId: "B" } },
  ];
  const decline = (w) => w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
  it("the NP's d6 on a 5 breaks both halves for the game, said on the card", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d6", 5);
      decline(w);
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-pinaka").id, target: FOE, react: NOTHING(FOE, RAMA) });
      expect(abilityOf(w, RAMA, "rama-pinaka").system.expended).toBe(true);
      expect(abilityOf(w, RAMA, "rama-pinaka-normal-attack").system.expended).toBe(true);
      expect(said(w)).toContain("FGT.Expend.Breaks");
    }, WAR);
  });

  it("another face holds, and says so", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d6", 2);
      decline(w);
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-pinaka").id, target: FOE, react: NOTHING(FOE, RAMA) });
      expect(abilityOf(w, RAMA, "rama-pinaka").system.expended).toBe(false);
      expect(said(w)).toContain("FGT.Expend.Holds");
      expect(said(w)).not.toContain("FGT.Expend.Breaks");
    }, WAR);
  });

  it("the Normal Attack's d12, on an Evaded swing too", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d12", 5);
      decline(w);
      await playAttack(w, {
        attacker: RAMA, ability: abilityOf(w, RAMA, "rama-pinaka-normal-attack").id, target: FOE,
        react: { [FOE]: ["evade", "declined", "declined", "declined"], [RAMA]: ["declined", "declined", "declined"] },
      });
      expect(abilityOf(w, RAMA, "rama-pinaka").system.expended).toBe(true);
      expect(said(w)).toContain("FGT.Expend.Breaks");
    }, WAR);
  });
});

describe("Brahmastra (BR.*)", () => {
  it("against a Demonic DU: ×3, no Total cut; Def Dwn (B) after", async () => {
    await withSubjects([
      rama(),
      { from: "jabberwock", id: DEMON, panel: { i: 6, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-brahmastra").id, target: DEMON, react: NOTHING(DEMON, RAMA) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      expect(JSON.stringify(result.breakdown)).toContain("Demonic (+200%)");
      expect(JSON.stringify(result.breakdown)).not.toContain("not Demonic");
      expect(held(w, DEMON)).toContain("defDwnB");
    }, WAR);
  });

  it("a Demonic Beast is Demonic: Asterios's every NP +1◈, a ready one too (rulings 8, 17)", async () => {
    await withSubjects([
      rama(),
      { from: "asterios", id: DEMON, panel: { i: 6, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-brahmastra").id, target: DEMON, react: NOTHING(DEMON, RAMA) });
      const nps = w.actor(DEMON).items.filter((i) => i.type === "noblePhantasm" && !i.system.passive);
      expect(nps.length).toBeGreaterThan(0);
      for (const np of nps) expect(np.system.cooldown.remaining).toBe(3);
    }, WAR);
  });

  it("against any other: −20% Total, no NP Cooldown change", async () => {
    await withSubjects([
      rama(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: RAMA, ability: abilityOf(w, RAMA, "rama-brahmastra").id, target: FOE, react: NOTHING(FOE, RAMA) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      expect(JSON.stringify(result.breakdown)).toContain("not Demonic");
      for (const np of w.actor(FOE).items.filter((i) => i.type === "noblePhantasm")) {
        expect(np.system.cooldown?.remaining ?? 0).toBe(0);
      }
    }, WAR);
  });
});

describe("Dream of Reunion (DR.*)", () => {
  it("Guts 100, +25% Health, NP −1◈, S.Crit Up 15, a Reunion Counter", async () => {
    await withSubjects([rama({ state: { health: { value: 500, max: 1250 } } })], async ({ world: w }) => {
      const brahmastra = abilityOf(w, RAMA, "rama-brahmastra");
      await brahmastra.update({ "system.cooldown.remaining": 10 });
      expect((await castSkill(w, { caster: RAMA, ability: abilityOf(w, RAMA, "rama-dream-of-reunion").id })).ok).toBe(true);
      expect(effectOf(w, RAMA, "gutsHealth")?.system?.magnitude).toBe(100);
      expect(w.actor(RAMA).system.health.value).toBe(500 + 312);
      expect(abilityOf(w, RAMA, "rama-brahmastra").system.cooldown.remaining).toBe(7);
      expect(held(w, RAMA)).toContain("sCritUp");
      expect(w.actor(RAMA).system.resources.reunion.value).toBe(1);
    }, WAR);
  });

  it("his Guts revives him with 100, and the revival gives a Reunion Counter", async () => {
    await withSubjects([
      rama({ state: { health: { value: 10, max: 1250 } }, effects: [{ defId: "gutsHealth", magnitude: 100, uses: 1 }] }),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      expect(w.actor(RAMA).system.health.value).toBe(100);
      expect(w.actor(RAMA).system.resources.reunion.value).toBe(1);
    }, FOES_TURN);
  });
});

describe("Curse of Separation (CS.*)", () => {
  const scene = (reunion, extra = {}) => [
    rama({ state: { health: { value: 10, max: 1250 }, resources: { reunion: { value: reunion } } }, ...extra }),
    { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 7 }, state: { factionId: "B" } },
  ];
  it("a success cancels the Attack for him: no damage, the once spent, the die on the card", async () => {
    await withSubjects(scene(10), async ({ world: w }) => {
      // Three d100s before it are the hit's own (its crit, then two checks); the
      // fourth is the curse's.
      w.dice.set("d100", 99, 99, 99, 30);
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      expect(w.actor(RAMA).system.health.value).toBe(10);
      expect(w.actor(RAMA).system.defeated ?? false).toBe(false);
      expect(abilityOf(w, RAMA, "rama-curse-of-separation").system.timesUsed).toBe(1);
      expect(said(w)).toContain("FGT.LethalCancel.Cancelled");
    }, FOES_TURN);
  });

  it("a failure: he is defeated, and the curse is unspent", async () => {
    await withSubjects(scene(10), async ({ world: w }) => {
      w.dice.set("d100", 99, 99, 99, 31);
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      expect(w.actor(RAMA).system.health.value).toBe(0);
      expect(abilityOf(w, RAMA, "rama-curse-of-separation").system.timesUsed).toBe(0);
      expect(said(w)).toContain("FGT.LethalCancel.Failed");
    }, FOES_TURN);
  });

  it("no Reunion Counter: no die at all", async () => {
    await withSubjects(scene(0), async ({ world: w }) => {
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      expect(w.actor(RAMA).system.health.value).toBe(0);
      expect(said(w)).not.toContain("FGT.LethalCancel");
    }, FOES_TURN);
  });

  it("spent once, it does not roll again", async () => {
    await withSubjects(scene(10), async ({ world: w }) => {
      await abilityOf(w, RAMA, "rama-curse-of-separation").update({ "system.timesUsed": 1 });
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      expect(w.actor(RAMA).system.health.value).toBe(0);
      expect(said(w)).not.toContain("FGT.LethalCancel");
    }, FOES_TURN);
  });

  it("Guts first: a revival saves him and the curse is not asked", async () => {
    await withSubjects(scene(10, { effects: [{ defId: "gutsHealth", magnitude: 100, uses: 1 }] }), async ({ world: w }) => {
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      expect(w.actor(RAMA).system.health.value).toBe(100);
      expect(said(w)).not.toContain("FGT.LethalCancel");
    }, FOES_TURN);
  });
});

describe("Charisma B and Martial Blessing (CH.*, MB.*)", () => {
  it("Charisma: +20 flat to the other allies within 2; the Active's Atk Up (Charisma) 20/10 on him, 4◈", async () => {
    await withSubjects([
      rama(),
      { from: "cu-chulainn", id: ALLY, panel: { i: 6, j: 8 }, state: { factionId: "A" } },
    ], async ({ unit, world: w }) => {
      const flat = (unit(ALLY).modifiers ?? []).filter((m) => m.key === "flatDamage" && /Charisma/.test(m.source ?? ""));
      expect(flat.map((m) => m.value)).toContain(20);
      expect((unit(RAMA).modifiers ?? []).some((m) => m.key === "flatDamage" && /Charisma/.test(m.source ?? ""))).toBe(false);
      expect((await castSkill(w, { caster: RAMA, ability: abilityOf(w, RAMA, "charisma").id })).ok).toBe(true);
      const atk = effectOf(w, RAMA, "atkUpCharisma");
      expect(atk.system.magnitude).toBe(20);
      expect(atk.system.npMagnitude).toBe(10);
      expect(abilityOf(w, RAMA, "charisma").system.cooldown.remaining).toBe(12);
      const after = await live(ALLY);
      expect((after.modifiers ?? []).some((m) => m.key === "flatDamage" && /Charisma/.test(m.source ?? ""))).toBe(false);
    }, WAR);
  });

  it("Martial Blessing: Crit Up 50 and Crit DmUp 100 for 1◈, 4◈", async () => {
    await withSubjects([rama()], async ({ world: w }) => {
      expect((await castSkill(w, { caster: RAMA, ability: abilityOf(w, RAMA, "rama-martial-blessing").id })).ok).toBe(true);
      expect(effectOf(w, RAMA, "critUp").system.magnitude).toBe(50);
      expect(effectOf(w, RAMA, "critDmUp").system.magnitude).toBe(100);
      expect(abilityOf(w, RAMA, "rama-martial-blessing").system.cooldown.remaining).toBe(12);
    }, WAR);
  });
});
