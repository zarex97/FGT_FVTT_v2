/**
 * Sieg (Caster), audit #345: his sheet built through the real projection, and
 * the pieces he brought: a form that comes back (Siegfried's whole sheet), an
 * Activation NP that makes him 3x3 about his centre (Fafnir), a Def Dwn that
 * falls at its Turn's end, a cut on one random Spell, growth every 3 Rounds, a
 * die that doubles a check, and a cost under a condition.
 * @see docs/superpowers/specs/2026-10-27-sieg-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const SIEG = "sieg000000000001";
const ALLY = "siegAlly00000001";
const FOE = "siegFoe000000001";
const MAS = "siegMaster000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);
const effectOf = (w, id, defId) => [...w.actor(id).effects].find((e) => e.system?.defId === defId);
const sieg = (extra = {}) => ({ from: "sieg", id: SIEG, panel: { i: 6, j: 6 }, state: { factionId: "A" }, ...extra });
/** The Unit as the board sees it NOW: `unit()` is the board the subjects started on. */
const live = async (id) => {
  const { currentBoard } = await import("../../module/engine/board.mjs");
  return currentBoard().units.find((u) => u.id === id) ?? null;
};
const withMaster = (extra = {}) => [
  sieg({ state: { factionId: "A", masterId: MAS, contract: "contracted" }, ...extra }),
  { from: "master-advanced", id: MAS, panel: { i: 9, j: 1 }, state: { factionId: "A" } },
];

/* ========================================================================== */

describe("the sheet, projected (ST.*, IA.*)", () => {
  it("Caster, Neutral Good, Europe; E E E D B; 500, MOV 3, Range 3; BA 50/125; no Sustainability; DRCS 3/3", async () => {
    await withSubjects([sieg()], ({ unit, world: w }) => {
      const s = unit(SIEG);
      expect(s.servantClasses).toEqual(["caster"]);
      expect(s.alignment).toMatchObject({ order: "neutral", morality: "good" });
      expect(s.region).toEqual(["europe"]);
      expect(s.attributes).toEqual(expect.arrayContaining(["male", "servant", "man", "dragon", "humanoid"]));
      expect(Object.fromEntries(Object.entries(s.parameters).map(([k, v]) => [k, String(v)])))
        .toMatchObject({ str: "E", end: "E", agi: "E", mag: "D", luc: "B" });
      expect(s.maxHealth ?? s.health?.max).toBe(500);
      expect(s.mov).toBe(3);
      expect(s.range).toBe(3);
      expect(s.baseAttack).toEqual(expect.objectContaining({ str: 50, mag: 125 }));
      expect(w.actor(SIEG).system.sustainability).toBeNull();
      expect(w.actor(SIEG).system.resources.drcs).toMatchObject({ value: 3, max: 3 });
      expect(w.actor(SIEG).system.footprint).toMatchObject({ w: 1, h: 1, grows: "centre" });
    });
  });

  it("holds Independent Action at EX, his twelve, and Siegfried's seven only for the form", async () => {
    await withSubjects([sieg()], ({ unit, world: w }) => {
      const items = w.actor(SIEG).items;
      expect(abilityOf(w, SIEG, "class-independent-action").system.rank).toBe("EX");
      const own = items.filter((i) => !i.system.formOnly).map((i) => i.system.contentId).sort();
      expect(own).toEqual([
        "class-independent-action", "sieg-akafiloga-argrise", "sieg-akafiloga-fafnir", "sieg-blasted-tree",
        "sieg-bridal-chest", "sieg-dead-count-shapeshifter", "sieg-dragon-revelation", "sieg-galvanism",
        "sieg-heilen", "sieg-homunculus", "sieg-knacken", "sieg-magecraft", "sieg-man-made-hero", "sieg-schwert",
      ]);
      const kit = items.filter((i) => i.system.formOnly === "siegfried").map((i) => i.system.contentId).sort();
      expect(kit).toEqual([
        "class-riding-unlocks", "disengage", "golden-rule", "siegfried-armor-of-fafnir", "siegfried-avaricious-gold",
        "siegfried-balmung", "siegfried-dragon-slayer",
      ]);
      // Inert until the form is taken: none is on the board's list.
      expect((unit(SIEG).abilities ?? []).some((a) => kit.includes(a.contentId))).toBe(false);
    });
  });
});

describe("Bridal Chest Passive 1 and Homunculus (BC.p1.*, HM.*)", () => {
  it("bands his Normal Attack: STR at 1, MAG and Lightning from 2", async () => {
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    await withSubjects([sieg()], ({ unit }) => {
      const s = unit(SIEG);
      const near = normalAttackAt(s, 1);
      const far = normalAttackAt(s, 3);
      expect(near.component).toBe("str");
      expect(far).toMatchObject({ component: "mag", element: "lightning" });
    });
  });

  it("STR +5%, MAG +10%, NP included; debuffs −5%", async () => {
    await withSubjects([sieg()], ({ unit }) => {
      const s = unit(SIEG);
      const rows = (s.modifiers ?? []).filter((m) => /Homunculus/.test(m.source ?? ""));
      expect(rows.map((m) => [m.value, m.npValue, m.predicate?.[0]])).toEqual(expect.arrayContaining([
        [5, 5, "attack:component:str"], [10, 10, "attack:component:mag"],
      ]));
      expect((s.applicationChances ?? []).some((c) => c.direction === "incoming" && c.value === 5)).toBe(true);
    });
  });

  it("under NP Seal his Range is 1", async () => {
    await withSubjects([sieg({ effects: [{ defId: "npSeal" }] })], ({ unit }) => {
      expect(unit(SIEG).range).toBe(1);
    });
  });
});

describe("Man-made Hero (False) (MH.*)", () => {
  it("at full Health too: the restore lands under the raised maximum (found live)", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-man-made-hero").id })).ok).toBe(true);
      expect(w.actor(SIEG).system.health).toMatchObject({ max: 600, value: 600 });
    }, WAR);
  });

  it("NP Regen 1 and Max HpUp: Max Health +100, current with it", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.health.value": 300 });
      const out = await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-man-made-hero").id });
      expect(out.ok).toBe(true);
      expect(held(w, SIEG)).toEqual(expect.arrayContaining(["npRegen", "maxHpUp"]));
      expect(effectOf(w, SIEG, "maxHpUp").system.magnitude).toBe(100);
      expect(w.actor(SIEG).system.health).toMatchObject({ max: 600, value: 400 });
    }, WAR);
  });
});

describe("the Spells (KN.*, SW.*, HE.*, MC.*)", () => {
  it("Def Dwn (Knacken): 50 on its Turn, 25 from that Turn's end", async () => {
    const { magnitudeOf } = await import("../../module/rules/effect-instance.mjs");
    const def = { decay: { on: "turn", per: "turn", steps: [50, 25] } };
    expect(magnitudeOf({ magnitude: 50, appliedTick: 18 }, def, { tick: 18 })).toBe(50);
    expect(magnitudeOf({ magnitude: 50, appliedTick: 18 }, def, { tick: 19 })).toBe(25);
    expect(magnitudeOf({ magnitude: 50, appliedTick: 18 }, def, { tick: 22 })).toBe(25);
  });

  it("Knacken lands Def Dwn (Knacken) on an enemy within 3; a cast at the Phase is aimed at its DU", async () => {
    await withSubjects([sieg(), { from: "cu-chulainn", id: FOE, panel: { i: 6, j: 9 }, state: { factionId: "B" } }], async ({ world: w }) => {
      const out = await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-knacken").id, placement: { unitId: FOE } });
      expect(out.ok).toBe(true);
      expect(effectOf(w, FOE, "defDwnKnacken").system.magnitude).toBe(50);
    }, WAR);
    const src = (await import("node:fs")).readFileSync(new URL("../../module/engine/attack.mjs", import.meta.url), "utf8");
    expect(src).toMatch(/windowTarget === "defender" && state\.defenderId \? \{ unitId: state\.defenderId \}/);
    // ...and the Phase's window, opened before any Process, is handed its one DU (found live).
    expect(src).toMatch(/offerAttackerWindow\(\{ attackerId, defenderId: phaseDefenders\.length === 1 \? phaseDefenders\[0\] : null \}/);
  });

  it("Heilen: 15% and 1 Agility on an ally", async () => {
    await withSubjects([sieg(), { from: "cu-chulainn", id: ALLY, panel: { i: 6, j: 8 }, state: { factionId: "A" } }], async ({ world: w }) => {
      await w.actor(ALLY).update({ "system.health.value": 100, "system.agility.max": 10, "system.agility.value": 5 });
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-heilen").id, placement: { unitId: ALLY } })).ok).toBe(true);
      const ally = w.actor(ALLY).system;
      expect(ally.health.value).toBe(100 + Math.floor(ally.health.max * 0.15));
      expect(ally.agility.value).toBe(6);
    }, WAR);
  });

  it("Heilen: 30% and 2 Agility on himself, instead", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.health.value": 100, "system.agility.max": 10, "system.agility.value": 5 });
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-heilen").id, placement: { unitId: SIEG } })).ok).toBe(true);
      expect(w.actor(SIEG).system.health.value).toBe(250);
      expect(w.actor(SIEG).system.agility.value).toBe(7);
    }, WAR);
  });

  it("Schwert: Atk Up 35/25 on himself, at any Combat Phase he is in", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      const schwert = abilityOf(w, SIEG, "sieg-schwert");
      expect(schwert.system.timing.window).toEqual(["ownTurn", "combatPhaseStart", "defendingPhaseStart"]);
      expect((await castSkill(w, { caster: SIEG, ability: schwert.id })).ok).toBe(true);
      expect(effectOf(w, SIEG, "atkUp").system).toMatchObject({ magnitude: 35, npMagnitude: 25 });
    }, WAR);
  });

  it("Magecraft: one Straße/gehen Spell a Turn", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-schwert").id })).ok).toBe(true);
      const second = await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-heilen").id, placement: { unitId: SIEG } });
      expect(second.ok).toBe(false);
    }, WAR);
  });
});

describe("Dead Count Shapeshifter, usage 1 (DC.1.*; ruling 5)", () => {
  it("with DRCS: NP Cooldown −1◈, Dmg Up (Dragon) 100/50, and the 25% die on the card", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      const tree = abilityOf(w, SIEG, "sieg-blasted-tree");
      await tree.update({ "system.cooldown.remaining": 9 });
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-dragon-revelation").id })).ok).toBe(true);
      expect(tree.system.cooldown.remaining).toBe(6);
      expect(effectOf(w, SIEG, "dmgUpDragon").system).toMatchObject({ magnitude: 100, npMagnitude: 50 });
      // Hit or missed, the die is on the card: a row, or a line in its refusals.
      const card = w.cards.at(-1).data;
      const die = [...(card.refused ?? []).map((r) => r.name), ...(w.messages.contents.at(-1)?.flags?.fgt?.rows ?? []).map((r) => r.name)];
      expect(die.some((n) => /FGT\.Phase\.Chance|consumes a DRCS/.test(n))).toBe(true);
    }, WAR);
  });

  it("with none: ½◈ and 50/25, and the die consumes nothing", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.resources.drcs.value": 0 });
      const tree = abilityOf(w, SIEG, "sieg-blasted-tree");
      await tree.update({ "system.cooldown.remaining": 9 });
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-dragon-revelation").id })).ok).toBe(true);
      expect(tree.system.cooldown.remaining).toBe(7);
      expect(effectOf(w, SIEG, "dmgUpDragon").system).toMatchObject({ magnitude: 50, npMagnitude: 25 });
      expect(w.actor(SIEG).system.resources.drcs.value).toBe(0);
    }, WAR);
  });

  it("Dmg Up (Dragon) reaches an NP at its stated figure, and at the full one when none is stated", async () => {
    const { resolveRuleValues } = await import("../../module/rules/snapshot.mjs");
    const rule = { key: "DamageModifier", value: "@magnitude", npValue: "@npMagnitude" };
    expect(resolveRuleValues(rule, 100, 50)).toMatchObject({ value: 100, npValue: 50 });
    expect(resolveRuleValues(rule, 60, null).npValue).toBeUndefined();
  });
});

describe("Galvanism (BC.p3.*; rulings 7, 21)", () => {
  const fireTaken = async (w, { options, rolls = {} }) => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const { currentBoard } = await import("../../module/engine/board.mjs");
    const board = currentBoard();
    const u = board.units.find((x) => x.id === SIEG);
    return fireEvent("damageTaken", [u], { tick: 18, turnsPerRound: 3, board, options: new Set(options), rolls });
  };

  it("a MAG hit cuts his NP ⅓◈ and one Spell on its Cooldown, drawn by its die", async () => {
    const { pickKey } = await import("../../module/engine/scheduler.mjs");
    await withSubjects([sieg()], async ({ world: w }) => {
      await abilityOf(w, SIEG, "sieg-blasted-tree").update({ "system.cooldown.remaining": 9 });
      const knacken = abilityOf(w, SIEG, "sieg-knacken");
      await knacken.update({ "system.cooldown.remaining": 9 });
      const intents = await fireTaken(w, {
        options: ["attack:component:mag", "attack:dealtDamage"],
        rolls: { [pickKey({ kind: "CooldownDelta", category: "strasseGehen" }, { id: SIEG })]: 1 },
      });
      const cuts = intents.filter((i) => i.t === "cooldown");
      expect(cuts.some((c) => c.abilityId === abilityOf(w, SIEG, "sieg-blasted-tree").id && c.ticks === 1)).toBe(true);
      expect(cuts.find((c) => c.abilityId === knacken.id)).toMatchObject({ ticks: 1, picked: { roll: 1, of: 1 } });
    }, WAR);
  });

  it("with no Spell on its Cooldown, a line says so; a STR hit cuts nothing", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      const intents = await fireTaken(w, { options: ["attack:component:mag", "attack:dealtDamage"] });
      expect(intents.some((i) => i.t === "log" && i.entry?.line?.key === "FGT.Cooldown.NothingToCut")).toBe(true);
      expect(await fireTaken(w, { options: ["attack:component:str", "attack:dealtDamage"] })).toEqual([]);
    }, WAR);
  });

  it("is negated by NP Seal", async () => {
    await withSubjects([sieg({ effects: [{ defId: "npSeal" }] })], ({ unit }) => {
      expect((unit(SIEG).eventHandlers ?? []).some((h) => /Galvanism/.test(h.source ?? ""))).toBe(false);
    });
  });
});

describe("Bridal Chest Passive 2: growth every 3 full Rounds (BC.p2.*; rulings 9, 22)", () => {
  it("at the third Round's end, Agility +1 max and current, both Base Attacks +10", async () => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.agility.max": 10, "system.agility.value": 10 });
      for (let round = 0; round < 3; round += 1) {
        const { currentBoard } = await import("../../module/engine/board.mjs");
        const board = currentBoard();
        const u = board.units.find((x) => x.id === SIEG);
        await applyWorldIntents(fireEvent("roundEnd", [u], { tick: 18 + round, turnsPerRound: 3, board, options: new Set() }), "test");
      }
      const r = w.actor(SIEG).system.resources;
      expect([r.bridalRounds.value, r.bridalGrowth.value, r.bridalAgility.value]).toEqual([0, 1, 1]);
      const s = await live(SIEG);
      expect(s.baseAttack).toEqual(expect.objectContaining({ str: 60, mag: 135 }));
      expect(w.actor(SIEG).system.agility).toMatchObject({ max: 11, value: 11 });
    }, WAR);
  });

  it("Agility stops at +4; Base Attack has no limit", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.agility.max": 10, "system.resources.bridalGrowth.value": 6, "system.resources.bridalAgility.value": 4 });
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      await applyWorldIntents([{ t: "resource", unitId: SIEG, key: "resources.bridalAgility.value", delta: 1 }], "test");
      expect(w.actor(SIEG).system.resources.bridalAgility.value).toBe(4);
      expect(w.actor(SIEG).system.agility.max).toBe(14);
      const s = await live(SIEG);
      expect(s.baseAttack).toEqual(expect.objectContaining({ str: 110, mag: 185 }));
    }, WAR);
  });
});

describe("Blasted Tree (BT.*; ruling 11)", () => {
  it("2.5x on the DU; the splash spares Sieg and the DU, hits allies, and cannot be Countered", async () => {
    await withSubjects([sieg()], ({ world: w }) => {
      const tree = abilityOf(w, SIEG, "sieg-blasted-tree").system;
      expect(tree.damage).toMatchObject({ multiplier: 2.5, component: "mag", element: "lightning" });
      expect(tree.aftermath.targeting.selection).toMatchObject({ includeSelf: false, excludePrimaryTarget: true, relations: ["enemy", "ally", "neutral"] });
      expect(tree.aftermath.damage).toMatchObject({ multiplier: 1.5, uncounterable: true });
      expect(tree.aftermath.effects).toEqual([{ id: "shock", duration: "2◈", chance: 25 }]);
    });
    const src = (await import("node:fs")).readFileSync(new URL("../../module/engine/attack.mjs", import.meta.url), "utf8");
    expect(src).toMatch(/\.\.\.\(attack\?\.uncounterable \? \["counter"\] : \[\]\)/);
  });
});

describe("Fafnir (AA.2.*; rulings 6, 14 to 20, 23)", () => {
  const fafnir = async (w) => castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-akafiloga-fafnir").id });

  it("quadruples Health, adds 150/125, is Large and 3x3, cannot Block, and costs no NP price", async () => {
    await withSubjects(withMaster(), async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.health.value": 400 });
      const masterBefore = w.actor(MAS).system.health.value;
      expect((await fafnir(w)).ok).toBe(true);
      expect(abilityOf(w, SIEG, "sieg-akafiloga-fafnir").system.active).toBe(true);
      expect(w.actor(SIEG).system.health).toMatchObject({ max: 2000, value: 1600 });
      const s = await live(SIEG);
      expect(s.baseAttack).toEqual(expect.objectContaining({ str: 200, mag: 250 }));
      expect(s.attributes).toEqual(expect.arrayContaining(["large", "injuryOnlyFromNP"]));
      expect(w.actor(SIEG).system.footprint).toMatchObject({ w: 3, h: 3 });
      expect(s.forbiddenReactions).toContain("block");
      expect(w.actor(MAS).system.health.value).toBe(masterBefore);
    }, WAR);
  });

  it("when it ends, his maximum falls and his current only to fit; he is 1x1 again (ruling 14)", async () => {
    await withSubjects(withMaster(), async ({ world: w }) => {
      expect((await fafnir(w)).ok).toBe(true);
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      await applyWorldIntents([{ t: "setMode", unitId: SIEG, abilityId: "fafnir", active: false, source: "test" }], "test");
      await w.settle();
      expect(abilityOf(w, SIEG, "sieg-akafiloga-fafnir").system.active).toBe(false);
      expect(w.actor(SIEG).system.health).toMatchObject({ max: 500, value: 500 });
      expect(w.actor(SIEG).system.footprint).toMatchObject({ w: 1, h: 1 });
      // Its clock counts from the end: 8◈.
      expect(abilityOf(w, SIEG, "sieg-akafiloga-fafnir").system.cooldown.remaining).toBe(24);
    }, WAR);
  });

  it("refuses every Skill but usage 1", async () => {
    await withSubjects(withMaster(), async ({ world: w }) => {
      expect((await fafnir(w)).ok).toBe(true);
      const schwert = await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-schwert").id });
      expect(schwert).toMatchObject({ ok: false, reason: "abilityLocked" });
      // ...and the refusal names what it holds back (found live: "undefined cannot be used").
      const { canUseAbility } = await import("../../module/rules/costs.mjs");
      const { usageSpecFor } = await import("../../module/rules/ability-use.mjs");
      const verdict = canUseAbility({ ability: usageSpecFor(abilityOf(w, SIEG, "sieg-schwert")), unit: await live(SIEG) });
      expect(verdict).toMatchObject({ reason: "abilityLocked", detail: { name: "Straße/gehen: Schwert" } });
    }, WAR);
  });

  it("its Agility Check doubles the die", async () => {
    const { resolveCheck } = await import("../../module/rules/checks.mjs");
    const out = resolveCheck({ roll: 7, target: 10, table: "favourable", modifiers: [{ source: "Fafnir", value: 0, rollFactor: 2 }] });
    expect(out).toMatchObject({ total: 14, success: false });
  });

  it("upkeep: 40 if he Acted, 20 if not; at or under it the NP ends and the Master pays nothing", async () => {
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    let handlers = [];
    await withSubjects(withMaster(), async ({ world: w }) => {
      expect((await fafnir(w)).ok).toBe(true);
      handlers = (await live(SIEG)).eventHandlers.filter((h) => (h.events ?? []).includes("anyTurnEnd"));
    }, WAR);
    expect(handlers).toHaveLength(2);
    const master = (hp) => ({ id: MAS, kind: "master", health: { value: hp, max: 100 } });
    const fire = (acted, hp) => {
      const u = { id: SIEG, kind: "servant", masterId: MAS, selfOrSummonsActed: acted, eventHandlers: handlers };
      return fireEvent("anyTurnEnd", [u], { tick: 18, turnsPerRound: 3, board: { units: [u, master(hp)] } });
    };
    const drain = (out) => out.filter((i) => i.t === "statDelta").map((i) => i.delta);
    const ends = (out) => out.some((i) => i.t === "setMode" && i.active === false);
    expect(drain(fire(true, 80))).toEqual([-40]);
    expect(drain(fire(false, 80))).toEqual([-20]);
    expect([drain(fire(true, 40)), ends(fire(true, 40))]).toEqual([[], true]);
    expect([drain(fire(false, 20)), ends(fire(false, 20))]).toEqual([[], true]);
  });

  it("grows about his centre and shrinks back to its middle", async () => {
    const { centredOrigin } = await import("../../module/engine/token-footprint.mjs");
    expect(centredOrigin({ i: 6, j: 6, h: 1, w: 1 }, { width: 3, height: 3 }, null)).toEqual({ i: 5, j: 5 });
    expect(centredOrigin({ i: 0, j: 6, h: 1, w: 1 }, { width: 3, height: 3 }, { iMin: 0, iMax: 20, jMin: 0, jMax: 20 })).toBeNull();
  });

  it("usage 1 and usage 2 lock each other's Cooldown", async () => {
    await withSubjects(withMaster(), async ({ world: w }) => {
      await abilityOf(w, SIEG, "sieg-akafiloga-argrise").update({ "system.cooldown.remaining": 5 });
      expect((await fafnir(w)).ok).toBe(false);
    }, WAR);
  });
});

describe("Akafiloga Argrise, usage 1 (AA.1.*, AA.2.i; rulings 12, 13)", () => {
  it("played as Fafnir, he stays Fafnir until the Turn's end, his end queued (found live)", async () => {
    const { playAttack } = await import("../helpers/process.mjs");
    await withSubjects([
      ...withMaster(),
      { from: "cu-chulainn", id: FOE, panel: { i: 3, j: 6 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const fafnir = abilityOf(w, SIEG, "sieg-akafiloga-fafnir");
      await fafnir.update({ "system.active": true });
      await w.actor(MAS).update({ "system.health.max": 500, "system.health.value": 500 });
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      await playAttack(w, {
        attacker: SIEG, ability: abilityOf(w, SIEG, "sieg-akafiloga-argrise").id, placement: { direction: "n" },
        react: { [FOE]: ["nothing", "declined", "declined", "declined"], [SIEG]: ["declined", "declined"] },
      });
      expect(fafnir.system.active).toBe(true);
      const queued = w.combat?.getFlag?.("fgt", "queuedEnds") ?? game.combats.contents[0]?.getFlag("fgt", "queuedEnds");
      expect(queued).toEqual([expect.objectContaining({ kind: "mode", id: fafnir.id })]);
    }, WAR);
  });

  it("Def Dwn 30 before 5x Fire; as Fafnir 50, a second NP price, and his form ends at the Turn's end", async () => {
    await withSubjects(withMaster(), ({ world: w }) => {
      const a = abilityOf(w, SIEG, "sieg-akafiloga-argrise").system;
      expect(a.damage).toMatchObject({ multiplier: 5, component: "mag", element: "fire" });
      expect(a.phases.map((p) => [p.kind, p.when ?? null, p.effects?.[0]?.magnitude ?? null])).toEqual([
        ["applyEffects", "beforeDamage", 30], ["applyEffects", "beforeDamage", 50], ["damage", null, null], ["setMode", null, null],
      ]);
      expect(a.phases[3]).toMatchObject({ ability: "fafnir", active: false, atTurnEnd: true });
    });
    const { additionalCostsFor } = await import("../../module/rules/costs.mjs");
    const ability = { system: { additionalCosts: [{ kind: "masterHealthByNPRank", rank: "EX", id: "x", predicate: ["self:skillActive:fafnir"] }] } };
    const master = { id: "m", kind: "master", health: { value: 100, max: 100 } };
    const as = (active) => ({ id: "s", kind: "servant", masterId: "m", contract: "contracted",
      abilities: [{ id: "f", slug: "fafnir", active, isMode: true }] });
    expect(additionalCostsFor({ ability, self: as(false), master })).toEqual([]);
    expect(additionalCostsFor({ ability, self: as(true), master })).toHaveLength(1);
  });
});

describe("Dead Count Shapeshifter, usage 2: Siegfried (DC.2.*; rulings 1 to 5, 21, 22)", () => {
  it("spends a DRCS and takes Siegfried's whole sheet, Galvanism and Bridal Chest kept, for 1◈ + ½◈ x d4", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.health.value": 420, "system.agility.max": 8, "system.agility.value": 6 });
      const knacken = abilityOf(w, SIEG, "sieg-knacken");
      await knacken.update({ "system.cooldown.remaining": 4 });
      const out = await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-dead-count-shapeshifter").id });
      expect(out.ok).toBe(true);
      const sys = w.actor(SIEG).system;
      expect(sys.formTaken).toBe("siegfried");
      expect(sys.resources.drcs.value).toBe(2);
      expect(sys.health).toMatchObject({ max: 1500, value: 1500 });
      expect(sys.formReturn.pools.health).toMatchObject({ value: 420, max: 500 });
      expect([5, 6, 8, 9]).toContain(sys.formReturn.turns);
      const s = await live(SIEG);
      expect(s.servantClasses).toEqual(["saber"]);
      expect(s.range).toBe(1);
      expect(s.baseAttack).toEqual(expect.objectContaining({ str: 135, mag: 150 }));
      const kept = (s.abilities ?? []).map((a) => a.contentId);
      expect(kept).toEqual(expect.arrayContaining(["siegfried-balmung", "siegfried-armor-of-fafnir", "sieg-galvanism", "sieg-bridal-chest"]));
      expect(kept).not.toContain("sieg-knacken");
      // His Spell's clock waits, among the form's dropped.
      expect((s.formDropped ?? []).find((a) => a.contentId === "sieg-knacken")?.cooldownRemaining).toBe(4);
    }, WAR);
  });

  it("his sheet reads Siegfried's Classes and Region while the form lasts, and offers no contract (found live)", async () => {
    // Player1's Details tab listed "Caster" while the board read Saber, and the
    // contract button a Caster gets stayed on a Saber (ruling 1).
    const { buildContext } = await import("../../module/apps/actor-sheet/context.mjs");
    await withSubjects([sieg()], async ({ world: w }) => {
      const before = buildContext(w.actor(SIEG), { isEditable: true });
      expect(before.details.servantClasses).toEqual(["caster"]);
      expect(before.canContract).toBe(true);
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-dead-count-shapeshifter").id })).ok).toBe(true);
      const as = buildContext(w.actor(SIEG), { isEditable: true });
      expect(as.details.servantClasses).toEqual(["saber"]);
      expect(as.details.region).toEqual((await live(SIEG)).region);
      expect(as.canContract).toBe(false);
      // The header too: the seat stays Caster, the Region is Siegfried's.
      expect(before.header.line).toMatch(/^Caster · .* · Europe$/);
      expect(as.header.line).toMatch(/^Caster · .* · Germany$/);
    }, WAR);
  });

  it("returns with his pools as they were, Health −100 never below 1, and 3◈ plus the Turns gone on its clock", async () => {
    const { leaveForm } = await import("../../module/engine/transform.mjs");
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.health.value": 420 });
      const dc = abilityOf(w, SIEG, "sieg-dead-count-shapeshifter");
      expect((await castSkill(w, { caster: SIEG, ability: dc.id })).ok).toBe(true);
      expect(await leaveForm(SIEG, { tick: 23 })).toBe(true);
      const sys = w.actor(SIEG).system;
      expect(sys.formTaken).toBeNull();
      expect(sys.health).toMatchObject({ max: 500, value: 320 });
      // Used at 18, back at the end of 23: six Turns, plus 3◈.
      expect(dc.system.cooldown.remaining).toBe(9 + 6);
      expect((await live(SIEG)).servantClasses).toEqual(["caster"]);
    }, WAR);
  });

  it("the toll never takes him below 1", async () => {
    const { leaveForm } = await import("../../module/engine/transform.mjs");
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.health.value": 60 });
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-dead-count-shapeshifter").id })).ok).toBe(true);
      await leaveForm(SIEG, { tick: 20 });
      expect(w.actor(SIEG).system.health.value).toBe(1);
    }, WAR);
  });

  it("X is 1◈ + ½◈ x d4 summed in ◈, then turned into Turns: 5, 6, 8, 9 (found live)", async () => {
    const { lastingTurns } = await import("../../module/engine/transform.mjs");
    const lasts = { base: "1◈", per: "½◈" };
    expect([1, 2, 3, 4].map((roll) => lastingTurns(lasts, roll, 3))).toEqual([5, 6, 8, 9]);
  });

  it("needs a DRCS", async () => {
    await withSubjects([sieg()], async ({ world: w }) => {
      await w.actor(SIEG).update({ "system.resources.drcs.value": 0 });
      expect((await castSkill(w, { caster: SIEG, ability: abilityOf(w, SIEG, "sieg-dead-count-shapeshifter").id })).ok).toBe(false);
    }, WAR);
  });
});
