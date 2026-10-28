/**
 * Sita (Archer), audit #348: her sheet built through the real projection, and
 * the pieces she brought: a counted Debuff Immune that spends a charge only on
 * a debuff it nullified, Janaka's share of BA(MAG) on her Normal Attack and the
 * Magic Resistance it meets, a buff whose new instance resets its siblings'
 * clocks, and Burn Immune.
 * @see docs/superpowers/specs/2026-10-28-sita-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill, playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const SITA = "sita000000000001";
const FOE = "sitaFoe000000001";
const ALLY = "sitaAlly00000001";
const FAR = "sitaFar000000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);
const effectsOf = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
const sita = (extra = {}) => ({
  from: "sita", id: SITA, panel: { i: 6, j: 6 },
  ...extra,
  state: { factionId: "A", ...(extra.state ?? {}) },
});
const NOTHING = (...ids) => Object.fromEntries(ids.map((id) => [id, ["nothing", "declined", "declined", "declined"]]));
const live = async (id) => {
  const { currentBoard } = await import("../../module/engine/board.mjs");
  return currentBoard().units.find((u) => u.id === id) ?? null;
};
const cast = async (w, contentId) => (await castSkill(w, { caster: SITA, ability: abilityOf(w, SITA, contentId).id })).ok;

/* ========================================================================== */

describe("the sheet, projected (ST.*)", () => {
  it("Archer, Lawful Good, India; D C A A EX; 1000, MOV 7, Range 4; BA 75/200; STR; 5◈", async () => {
    await withSubjects([sita()], ({ unit, world: w }) => {
      const s = unit(SITA);
      expect(s.servantClasses).toEqual(["archer"]);
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "good" });
      expect(s.region).toEqual(["india"]);
      expect(s.attributes).toEqual(expect.arrayContaining(["female", "servant", "sky", "humanoid"]));
      expect(Object.fromEntries(Object.entries(s.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "D", end: "C", agi: "A", mag: "A", luc: "EX" });
      expect(s.maxHealth ?? s.health?.max).toBe(1000);
      expect(s.mov).toBe(7);
      expect(s.range).toBe(4);
      expect(s.baseAttack).toEqual(expect.objectContaining({ str: 75, mag: 200 }));
      expect(w.actor(SITA).system.normalAttack).toMatchObject({ component: "str" });
      expect(w.actor(SITA).system.sustainability).toBe("5◈");
    });
  });

  it("holds Magic Resistance A and Independent Action D", async () => {
    await withSubjects([sita()], ({ world: w }) => {
      expect(abilityOf(w, SITA, "class-magic-resistance").system.rank).toBe("A");
      expect(abilityOf(w, SITA, "class-independent-action").system.rank).toBe("D");
    });
  });
});

describe("Goddess's Divine Core (DC.*)", () => {
  it("+60 dealt, NP included; −20% debuff chance beside Magic Resistance's 25; Divine, Divinity's category", async () => {
    await withSubjects([sita()], ({ unit, world: w }) => {
      const s = unit(SITA);
      const flat = (s.modifiers ?? []).filter((m) => /Divine Core/.test(String(m.source ?? "")));
      expect(flat.map((m) => m.value), JSON.stringify(s.modifiers)).toContain(60);
      const incoming = (s.applicationChances ?? []).filter((c) => c.direction === "incoming").map((c) => c.value);
      expect(incoming).toEqual(expect.arrayContaining([20, 25]));
      expect(s.attributes).toContain("divine");
      expect(abilityOf(w, SITA, "sita-goddesses-divine-core").system.categorizedAs).toContain("divinity");
    });
  });
});

describe("Janaka (JA.*)", () => {
  it("each Active Skill she uses gives one; a new one resets the others' clocks (rulings 1, 4)", async () => {
    await withSubjects([sita()], async ({ world: w }) => {
      expect(await cast(w, "sita-curse-of-separation")).toBe(true);
      expect(effectsOf(w, SITA, "janaka")).toHaveLength(1);
      const first = effectsOf(w, SITA, "janaka")[0].system.expiry;
      await w.combat.update({ "system.globalTurn": 19 });
      w.dice.set("d100", 1);
      expect(await cast(w, "sita-pilgrimage-in-agni-pariksha")).toBe(true);
      const all = effectsOf(w, SITA, "janaka");
      expect(all).toHaveLength(2);
      expect(new Set(all.map((e) => e.system.expiry))).toEqual(new Set([first + 1]));
    }, WAR);
  });

  it("her NP grants none (ruling 1)", async () => {
    await withSubjects([
      sita(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: SITA, ability: abilityOf(w, SITA, "sita-haradhanu-janaka").id, target: FOE, react: NOTHING(FOE, SITA) });
      expect(held(w, SITA)).not.toContain("janaka");
    }, WAR);
  });

  it("no Janaka: her Normal Attack is BA(STR) alone (JA.na.none)", async () => {
    await withSubjects([sita()], async () => {
      const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
      const spec = normalAttackAt(await live(SITA), 3);
      expect(spec.sources).toEqual([{ unit: "self", component: "str", factor: 1 }]);
      expect(spec.magicResistanceFactor).toBeUndefined();
    }, WAR);
  });

  it("one Janaka is 40% of BA(MAG), two 60%, five 120% with Magic Resistance whole (rulings 2, 13)", async () => {
    const janakas = (n) => Array.from({ length: n }, () => ({ defId: "janaka" }));
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    for (const [n, share] of [[1, 0.4], [2, 0.6], [5, 1.2]]) {
      await withSubjects([sita({ effects: janakas(n) })], async () => {
        const spec = normalAttackAt(await live(SITA), 3);
        expect(spec.component).toBe("str");
        expect(spec.sources).toHaveLength(2);
        expect(spec.sources[1]).toMatchObject({ component: "mag" });
        expect(spec.sources[1].factor).toBeCloseTo(share, 5);
        expect(spec.magicResistanceFactor).toBeCloseTo(Math.min(1, share), 5);
      }, WAR);
    }
  });

  it("the DU's Magic Resistance meets the swing at that share (ruling 3)", async () => {
    await withSubjects([
      sita({ effects: [{ defId: "janaka" }, { defId: "janaka" }] }),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: SITA, target: FOE, react: NOTHING(FOE, SITA) });
      const result = w.messages.contents.map((m) => m.flags?.fgt?.result).find(Boolean);
      const text = JSON.stringify(result.breakdown);
      expect(text).toContain("× 0.6");
      expect(w.actor(FOE).system.health.value).toBeLessThan(w.actor(FOE).system.health.max);
    }, WAR);
  });
});

describe("a counted Debuff Immune (JE.di.two, rulings 6, 14, 15)", () => {
  const land = async (w, entry) => {
    const { landEffect } = await import("../../module/engine/landing.mjs");
    const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
    const { entryOf } = await import("../../module/rules/effect-flow.mjs");
    return landEffect(entryOf(entry), {
      target: unitOf(w.actor(SITA), currentBoard()), source: { unitId: FOE, abilityId: null }, caster: w.actor(FOE), process: {},
    });
  };
  const scene = (immune) => [
    sita({ effects: [immune] }),
    { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B" } },
  ];
  const counted = { defId: "debuffImmune", uses: 2 };
  const spent = (out) => out.intents.filter((i) => i.t === "consumeUse");

  it("a debuff whose die missed spends nothing", async () => {
    await withSubjects(scene(counted), async ({ world: w }) => {
      w.dice.set("d100", 90);
      const out = await land(w, { id: "shock" });
      expect(out.outcome).toBe("resisted");
      expect(spent(out)).toHaveLength(0);
    }, WAR);
  });

  it("a debuff whose die landed is nullified and spends one, the die on the card", async () => {
    await withSubjects(scene(counted), async ({ world: w }) => {
      w.dice.set("d100", 10);
      const out = await land(w, { id: "shock" });
      expect(out.outcome).toBe("blocked");
      expect(out.reason).toBe("Debuff Immune (1 left)");
      expect(out.chance).toContain("rolled 10 vs 55%");
      expect(spent(out)).toHaveLength(1);
    }, WAR);
  });

  it("a debuff that lands for sure is nullified and spends one", async () => {
    await withSubjects(scene(counted), async ({ world: w }) => {
      const out = await land(w, { id: "shock", chance: 500 });
      expect(out.outcome).toBe("blocked");
      expect(spent(out)).toHaveLength(1);
    }, WAR);
  });

  it("an uncounted Debuff Immune refuses before any die, spending nothing", async () => {
    await withSubjects(scene({ defId: "debuffImmune" }), async ({ world: w }) => {
      const out = await land(w, { id: "shock" });
      expect(out.outcome).toBe("blocked");
      expect(out.reason).toBe("Debuff Immune");
      expect(spent(out)).toHaveLength(0);
    }, WAR);
  });
});

describe("Jewel of the Earth (JE.*)", () => {
  it("Def Up 20/10 and two charges of Debuff Immune on every ally within 2, herself included, no enemy", async () => {
    await withSubjects([
      sita(),
      { from: "emiya", id: ALLY, panel: { i: 6, j: 8 }, state: { factionId: "A" } },
      { from: "medea", id: FAR, panel: { i: 6, j: 10 }, state: { factionId: "A" } },
      { from: "cu-chulainn", id: FOE, panel: { i: 7, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      expect(await cast(w, "sita-jewel-of-the-earth")).toBe(true);
      for (const id of [SITA, ALLY]) {
        const defUp = effectsOf(w, id, "defUp")[0];
        expect(defUp?.system).toMatchObject({ magnitude: 20, npMagnitude: 10 });
        expect(effectsOf(w, id, "debuffImmune")[0]?.system?.uses).toBe(2);
      }
      expect(held(w, FAR)).not.toContain("defUp");
      expect(held(w, FOE)).not.toContain("defUp");
    }, WAR);
  });
});

describe("Pilgrimage in Agni Pariksha (PA.*)", () => {
  it("Invuln three times and Burn Immune; her own Decoy meets her 45% resistance (ruling 5)", async () => {
    await withSubjects([sita()], async ({ world: w }) => {
      w.dice.set("d100", 70);
      expect(await cast(w, "sita-pilgrimage-in-agni-pariksha")).toBe(true);
      expect(effectsOf(w, SITA, "invuln")[0]?.system?.uses).toBe(3);
      expect(held(w, SITA)).toContain("burnImmune");
      expect(held(w, SITA)).not.toContain("decoy");
    }, WAR);
  });

  it("Burn Immune refuses Burn", async () => {
    await withSubjects([
      sita({ effects: [{ defId: "burnImmune" }] }),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { landEffect } = await import("../../module/engine/landing.mjs");
      const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
      const { entryOf } = await import("../../module/rules/effect-flow.mjs");
      const out = await landEffect(entryOf({ id: "burn" }), {
        target: unitOf(w.actor(SITA), currentBoard()), source: { unitId: FOE, abilityId: null }, caster: w.actor(FOE), process: {},
      });
      expect(out.outcome).toBe("blocked");
    }, WAR);
  });
});

describe("Curse of Separation (CO.*)", () => {
  it("Guts 100, +25% Health, Regen 5%", async () => {
    await withSubjects([sita({ state: { health: { value: 400, max: 1000 } } })], async ({ world: w }) => {
      expect(await cast(w, "sita-curse-of-separation")).toBe(true);
      expect(effectsOf(w, SITA, "gutsHealth")[0]?.system?.magnitude).toBe(100);
      expect(w.actor(SITA).system.health.value).toBe(650);
      expect(effectsOf(w, SITA, "regen")[0]?.system?.magnitude).toBe(5);
    }, WAR);
  });

  it("under Heal Up the heal is half again, and the Guts revival stays 100 (ruling 7)", async () => {
    await withSubjects([sita({ state: { health: { value: 400, max: 1000 } }, effects: [{ defId: "healUp", magnitude: 50 }] })], async ({ world: w }) => {
      expect(await cast(w, "sita-curse-of-separation")).toBe(true);
      expect(w.actor(SITA).system.health.value).toBe(400 + 375);
    }, WAR);
  });
});

describe("Heal Up after an Evade (NP.healup, ruling 8)", () => {
  it("an Evaded NP still gives her Heal Up, on its card", async () => {
    await withSubjects([
      sita(),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B", agility: { value: 40, max: 40 } } },
    ], async ({ world: w }) => {
      w.dice.set("d20", 1);
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, {
        attacker: SITA, ability: abilityOf(w, SITA, "sita-haradhanu-janaka").id, target: FOE,
        react: { [FOE]: ["evade", "declined", "declined"], [SITA]: ["declined", "declined"] },
      });
      expect(w.actor(FOE).system.health.value).toBe(w.actor(FOE).system.health.max);
      expect(held(w, SITA)).toContain("healUp");
      const rows = [...w.messages].flatMap((m) => m.getFlag("fgt", "effects") ?? []);
      expect(rows.map((r) => r.id)).toContain("healUp");
    }, WAR);
  });
});

describe("Heal Up on a boundary's heal (NP.healup.reach)", () => {
  it("a Regen tick is scaled once, before the card counts it (#348, live)", async () => {
    await withSubjects([sita({ effects: [{ defId: "healUp", magnitude: 50 }] })], async () => {
      const { resolveHealing } = await import("../../module/engine/applier.mjs");
      const once = await resolveHealing([{ t: "heal", unitId: SITA, amount: 50, source: "regen" }]);
      expect(once[0].amount).toBe(75);
      const twice = await resolveHealing(once);
      expect(twice[0].amount).toBe(75);
    }, WAR);
  });
});

describe("Haradhanu Janaka (NP.*)", () => {
  it("strips her debuffs first, hits with BA(MAG) ×3.5, then Heal Up 50 on her (ruling 8)", async () => {
    await withSubjects([
      sita({ effects: [{ defId: "burn" }, { defId: "atkDwn", magnitude: 10 }, { defId: "curse", unremovable: true }] }),
      { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 12 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, { attacker: SITA, ability: abilityOf(w, SITA, "sita-haradhanu-janaka").id, target: FOE, react: NOTHING(FOE, SITA) });
      expect(held(w, SITA)).not.toContain("burn");
      expect(held(w, SITA)).not.toContain("atkDwn");
      // An Unremovable one stays, and the card says so (#348, live).
      expect(held(w, SITA)).toContain("curse");
      const refused = w.cards.flatMap((c) => c.data?.refused ?? []).map((r) => r.name);
      expect(refused).toContain("FGT.Removal.Unremovable");
      expect(effectsOf(w, SITA, "healUp")[0]?.system?.magnitude).toBe(50);
      expect(w.actor(FOE).system.health.value).toBeLessThan(w.actor(FOE).system.health.max);
    }, WAR);
  });
});

describe("summoned by Rama's Curse of Separation (Rama CS.sita, CS.contract; rulings 9 to 12)", () => {
  const RAMA = "rama000000000001";
  const MAS = "ramaMaster000001";
  const FOES_TURN = { ...WAR, combat: { ...WAR.combat, actingFactionId: "B" } };
  const granted = { vishnuBhuja: { coin: 1, dice: [1], rerolled: [], keys: ["sudarshana"], picks: 0 } };
  const scene = () => [
    { from: "rama", id: RAMA, panel: { i: 6, j: 6 }, state: {
      factionId: "A", masterId: MAS, contract: "contracted", summonGranted: granted,
      health: { value: 10, max: 1250 }, resources: { reunion: { value: 10 } },
    } },
    { from: "master-advanced", id: MAS, panel: { i: 9, j: 1 }, state: { factionId: "A" } },
    { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 7 }, state: { factionId: "B" } },
  ];

  // The summon itself runs on the board (`engine/summoning.mjs#summonServantBeside`)
  // and reads the Servant from the Actor compendium, which the test world does
  // not hold: it is pressed live. Here, the line that asks for it.
  it("a success asks for Sita beside him, contracted to his Master (ruling 12)", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d100", 99, 99, 99, 30);
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      const asked = (w.combat.getFlag("fgt", "log") ?? []).filter((e) => e.kind === "summonServantBeside");
      expect(asked).toEqual([expect.objectContaining({ unitId: RAMA, contentId: "sita", masterId: MAS })]);
    }, FOES_TURN);
  });

  it("a failure asks for nobody", async () => {
    await withSubjects(scene(), async ({ world: w }) => {
      w.dice.set("d100", 99, 99, 99, 31);
      await playAttack(w, { attacker: FOE, target: RAMA, react: NOTHING(RAMA, FOE) });
      expect((w.combat.getFlag("fgt", "log") ?? []).some((e) => e.kind === "summonServantBeside")).toBe(false);
    }, FOES_TURN);
  });

  it("arrived this Turn, she may not act; from the next Turn she may (ruling 11)", async () => {
    const { canConsume } = await import("../../module/rules/budget.mjs");
    const { emptyBudget } = await import("../../module/rules/budget.mjs");
    await withSubjects([sita({ state: { arrivedTick: 18 } })], async () => {
      const u = await live(SITA);
      expect(u.arrivedThisTurn).toBe(true);
      expect(canConsume(emptyBudget(), u, "move").reason)
        .toContain("arrived this Turn");
    }, WAR);
    await withSubjects([sita({ state: { arrivedTick: 17 } })], async () => {
      expect((await live(SITA)).arrivedThisTurn).toBe(false);
    }, WAR);
  });
});
