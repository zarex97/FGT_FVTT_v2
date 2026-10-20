/**
 * Arjuna, audit #234: the readings ruled 2026-10-16, built through the real
 * projection. The Combat Process halves are in `arjuna-234-arena.test.mjs`.
 * @see docs/superpowers/specs/2026-10-16-arjuna-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { importAttack } from "../helpers/engine.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { critChance } from "../../module/rules/checks.mjs";
import { fireEvent } from "../../module/engine/scheduler.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { inAttackRangeFromAny } from "../../module/domain/geometry.mjs";
import { Rank } from "../../module/domain/rank.mjs";

beforeAll(prepareSubjects, 120_000);
// The engine reads Foundry at load: imported once the world exists.
let attackFacts;
beforeAll(async () => { ({ attackFacts } = await importAttack()); }, 60_000);
vi.setConfig({ testTimeout: 30_000 });

const ARJ = "arjunaPandava001";
const KAR = "karnaRival000001";
const ALLY = "arjunaAlly000001";
const FOE = "arjunaFoe0000001";

const abilityOf = (w, actorId, contentId) => w.actor(actorId).items.find((i) => i.system?.contentId === contentId);

/* ========================================================================== */

describe("the sheet, projected (SB, SB.attr, IA.1)", () => {
  it("Base Attack and Health by the tables, Range 4, MOV 5, Divine from Divinity", async () => {
    await withSubjects([{ from: "arjuna", id: ARJ }], ({ unit, world: w }) => {
      const a = unit(ARJ);
      expect(a.baseAttack).toEqual(expect.objectContaining({ str: 150, mag: 175 }));
      expect(a.maxHealth ?? a.health?.max).toBe(1250);
      expect(a.mov).toBe(5);
      expect(a.range).toBe(4);
      expect(a.attributes).toEqual(expect.arrayContaining(["male", "servant", "sky", "humanoid", "divine"]));
      expect(w.actor(ARJ).system.sustainability).toBe("8◈");
      expect(w.actor(ARJ).system.classContainer).toBe("archer");
    });
  });
});

/* ========================================================================== */

describe("Fated Rivals, both halves at last (FR.1, FR.lift; readings 2, 3)", () => {
  const scene = (arjunaAt) => [
    { from: "arjuna", id: ARJ, panel: arjunaAt, state: { factionId: "A" } },
    { from: "karna", id: KAR, panel: { i: 5, j: 5 }, state: { factionId: "B" } },
    { from: "medusa", id: FOE, panel: { i: 5, j: 4 }, state: { factionId: "B" } },
  ];

  it("binds Arjuna while Karna stands within his Range 4, and not beyond", async () => {
    await withSubjects(scene({ i: 5, j: 9 }), ({ unit }) => {
      expect(unit(ARJ).compulsions.map((c) => c.id)).toEqual(["fatedRivals"]);
      // Four panels: beyond Karna's own Range 2, so only Arjuna is bound.
      expect(unit(KAR).compulsions).toEqual([]);
    });
    await withSubjects(scene({ i: 5, j: 10 }), ({ unit }) => {
      expect(unit(ARJ).compulsions).toEqual([]);
    });
  });

  it("binds both when they stand within each other's Range", async () => {
    await withSubjects(scene({ i: 5, j: 7 }), ({ unit }) => {
      expect(unit(ARJ).compulsions.map((c) => c.id)).toEqual(["fatedRivals"]);
      expect(unit(KAR).compulsions.map((c) => c.id)).toEqual(["fatedRivals"]);
    });
  });

  it("his Normal Attack may name only Karna while it binds him", async () => {
    await withSubjects(scene({ i: 5, j: 8 }), ({ unit, board }) => {
      const spec = { anchor: { kind: "targetUnit" }, shape: { kind: "unit" }, selection: { relations: ["enemy"], chooser: "chosen", count: 1 } };
      const onFoe = resolveTargets(spec, unit(ARJ), board, { unitId: FOE, chosenIds: [FOE] });
      expect(onFoe.units.map((t) => t.unitId)).not.toContain(FOE);
      const onKarna = resolveTargets(spec, unit(ARJ), board, { unitId: KAR, chosenIds: [KAR] });
      expect(onKarna.units.map((t) => t.unitId)).toEqual([KAR]);
    });
  });

  it("a Karna on his own side binds nobody", async () => {
    const same = scene({ i: 5, j: 7 }).map((s) => (s.id === KAR ? { ...s, state: { factionId: "A" } } : s));
    await withSubjects(same, ({ unit }) => {
      expect(unit(ARJ).compulsions).toEqual([]);
    });
  });
});

/* ========================================================================== */

describe("Regen reads its own percent (AH.2; reading 6)", () => {
  const heal = (effects) => withSubjects([{ from: "arjuna", id: ARJ, state: { factionId: "A" }, effects }], ({ unit, board }) => {
    const u = unit(ARJ);
    return fireEvent("turnEnd", [u], { board, tick: 10, turnsPerRound: 3, options: [], rolls: {} })
      .filter((i) => i.t === "heal").map((i) => i.amount);
  });

  it("15% of 1250 for The Awarded Hero's, 5% for Van Gogh's, 10% when none is stated", async () => {
    expect(await heal([{ defId: "regen", magnitude: 15 }])).toEqual([187]);
    expect(await heal([{ defId: "regen", magnitude: 5 }])).toEqual([62]);
    expect(await heal([{ defId: "regen" }])).toEqual([125]);
  });
});

/* ========================================================================== */

describe("Crit and Range from his Skills (AH.3.*, CV.a.3*; readings 5, 7)", () => {
  const field = (arjunaEffects) => [
    { from: "arjuna", id: ARJ, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: arjunaEffects },
    { from: "medusa", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
    { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
  ];
  const pct = (u) => critChance(u).percent;

  it("Area CritUp (Awarded): +10 on him, +5 on an ally within 2, nothing on an enemy", async () => {
    let base;
    await withSubjects(field([]), ({ unit }) => { base = { a: pct(unit(ARJ)), ally: pct(unit(ALLY)), foe: pct(unit(FOE)) }; }, { tokens: true });
    await withSubjects(field([{ defId: "areaCritUpAwarded" }]), ({ unit }) => {
      expect(pct(unit(ARJ)) - base.a).toBe(10);
      expect(pct(unit(ALLY)) - base.ally).toBe(5);
      expect(pct(unit(FOE)) - base.foe).toBe(0);
    }, { tokens: true });
  });

  it("Range Up (Clairvoyance) adds to a plain Range Up", async () => {
    await withSubjects(field([{ defId: "rangeUpClairvoyance", magnitude: 1 }, { defId: "rangeUp", magnitude: 1 }]), ({ unit }) => {
      expect(unit(ARJ).range).toBe(6);
    });
  });
});

/* ========================================================================== */

describe("Agni Gandiva meets Magic Resistance halved (AG.mr; reading 10)", () => {
  const np = (attacker, defender, factor) => {
    const attack = { kind: "np", component: "mag", rank: "A", magicResistanceFactor: factor };
    return computeDamage({
      attacker, defender, attack,
      base: { sources: [{ unit: "self", component: "str", factor: 1 }, { unit: "self", component: "mag", factor: 1 }] },
      multiplier: 4,
      rolls: { attackMinus: 0 },
      options: rollOptionsFor({ attacker, defender, attack }),
    });
  };
  const mrRow = (r) => r.breakdown?.find?.((b) => b.key === "magicResistance") ?? null;

  it("Karna's Magic Resistance C cuts 15% of the MAG share, not 30%", async () => {
    await withSubjects([{ from: "arjuna", id: ARJ }, { from: "karna", id: KAR }], ({ unit }) => {
      const halved = np(unit(ARJ), unit(KAR), 0.5);
      const whole = np(unit(ARJ), unit(KAR), undefined);
      const notes = (r) => JSON.stringify(r);
      expect(notes(halved)).toMatch(/−15% MAG/);
      expect(notes(whole)).toMatch(/−30% MAG/);
      expect(halved.total).toBeGreaterThan(whole.total);
      void mrRow;
    });
  });
});

/* ========================================================================== */

describe("a granted property holds only where its condition does (RF.4.fire; reading 15)", () => {
  const scene = (effects) => [
    { from: "arjuna", id: ARJ, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects },
    { from: "medusa", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
  ];

  it("Agni makes his Normal Attack Fire, and not Pashupata, which has no element", async () => {
    await withSubjects(scene([{ defId: "agni", uses: 3 }]), ({ unit }) => {
      expect(attackFacts(unit(ARJ), unit(FOE), { attack: { kind: "normal" } }).element).toBe("fire");
      expect(attackFacts(unit(ARJ), unit(FOE), { attack: { kind: "np", sourceContentId: "arjuna-pashupata" } }).element ?? null).toBe(null);
    });
  });

  it("not a Mana Burst swing: it grants nothing to it (the swing is Fire of its own)", async () => {
    await withSubjects(scene([{ defId: "agni", uses: 3 }]), ({ unit }) => {
      const mb = attackFacts(unit(ARJ), unit(FOE), { attack: { kind: "skill", asNormalAttack: true, sourceContentId: "arjuna-mana-burst-flames" } });
      expect(mb.grantedElement ?? false).toBe(false);
    });
  });

  it("Watermelon's Pierce needs Blind and Range 1 to 2 (found building Agni)", async () => {
    await withSubjects([
      { from: "anastasia-summer", id: ARJ, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "blind" }] },
      { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
      { from: "medusa", id: ALLY, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
    ], ({ unit }) => {
      const near = attackFacts(unit(ARJ), unit(FOE), { attack: { kind: "normal" } });
      expect(near.pierce).toBe(true);
      expect(near.ignoresDefUp).toBe(true);
      const far = attackFacts(unit(ARJ), unit(ALLY), { attack: { kind: "normal" } });
      expect(far.pierce).toBe(false);
      expect(far.ignoresDefUp).toBe(false);
    });
    await withSubjects([
      { from: "anastasia-summer", id: ARJ, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], ({ unit }) => {
      expect(attackFacts(unit(ARJ), unit(FOE), { attack: { kind: "normal" } }).pierce).toBe(false);
    });
  });
});

/* ========================================================================== */

describe("the Range wall (PA.area; readings 13, 16-18)", () => {
  it("Pashupata's 5x5 keeps only the panels within his Range, and spares him", async () => {
    await withSubjects([
      { from: "arjuna", id: ARJ, panel: { i: 6, j: 2 }, state: { factionId: "A" } },
      { from: "medusa", id: ALLY, panel: { i: 6, j: 5 }, state: { factionId: "A" } },
      { from: "medusa", id: FOE, panel: { i: 6, j: 8 }, state: { factionId: "B" } },
    ], ({ unit, board, world: w }) => {
      const pa = abilityOf(w, ARJ, "arjuna-pashupata");
      const a = unit(ARJ);
      // Centred 4 panels away: the far columns of the 5x5 lie beyond Range.
      const out = resolveTargets(pa.system.targeting, a, board, { panel: { i: 6, j: 6 }, reach: "attack" });
      expect(out.errors).toEqual([]);
      expect(out.panels.length).toBeLessThan(25);
      expect(out.panels.length).toBeGreaterThan(0);
      for (const p of out.panels) expect(inAttackRangeFromAny([a.panel], p, 4)).toBe(true);
      const caught = out.units.map((t) => t.unitId);
      expect(caught).toContain(ALLY);
      // At 6 panels, behind the wall.
      expect(caught).not.toContain(FOE);
    }, { settings: { boardSize: 13 } });
  });

  it("an area that fits inside Range is untouched", async () => {
    await withSubjects([{ from: "arjuna", id: ARJ, panel: { i: 6, j: 6 }, state: { factionId: "A" } }], ({ unit, board, world: w }) => {
      const pa = abilityOf(w, ARJ, "arjuna-pashupata");
      // Centred one panel off: every panel within two of him and three of the
      // centre line, inside Range 4 by the Range rule's clipped corners too.
      const out = resolveTargets(pa.system.targeting, unit(ARJ), board, { panel: { i: 6, j: 7 }, reach: "attack" });
      expect(out.panels.length).toBe(25);
    }, { settings: { boardSize: 13 } });
  });
});

/* ========================================================================== */

describe("his abilities, as authored (MB.*, RF.*, AG.*, PA.death.div)", () => {
  it("Agni Gandiva needs Mana Burst ready, locks it the same Turn, and cools it", async () => {
    await withSubjects([{ from: "arjuna", id: ARJ }], ({ world: w }) => {
      const ag = abilityOf(w, ARJ, "arjuna-agni-gandiva").system;
      expect(ag.requirements).toEqual([{ kind: "abilityOffCooldown", abilityIds: ["arjuna-mana-burst-flames"] }]);
      expect(ag.sameTurnExclusive).toEqual(["arjuna-mana-burst-flames"]);
      expect(ag.alsoTriggers).toEqual([{ ability: "arjuna-mana-burst-flames" }]);
      expect(ag.damage).toMatchObject({ aim: true, multiplier: 4, element: "fire", magicResistanceFactor: 0.5 });
    });
  });

  it("Pashupata's Death ladder counts Karna's grades: Divinity C adds 30", async () => {
    await withSubjects([{ from: "arjuna", id: ARJ }], ({ world: w }) => {
      const death = abilityOf(w, ARJ, "arjuna-pashupata").system.phases
        .find((p) => p.kind === "applyEffects").effects.find((e) => e.id === "death");
      const options = new Set(["target:skill:divinity", "target:skillRank:divinity:gte:E", "target:skillRank:divinity:gte:D", "target:skillRank:divinity:gte:C"]);
      const met = death.chanceModifiers.filter((m) => m.predicate.every((p) => options.has(p)));
      expect(death.chance + met.reduce((s, m) => s + m.value, 0)).toBe(60);
    });
  });
});

/* ========================================================================== */

describe("a Turn's end says what a heal gave (AH.2.when; found live)", () => {
  it("Regen at 1089 of 1250 is said as 161, not 187; a heal at full says nothing", async () => {
    const { turnEndCard, healthBefore } = await import("../../module/engine/turn-report.mjs");
    const t = (key, data) => (data ? `${key}:${JSON.stringify(data)}` : key);
    const intents = [{ t: "heal", unitId: "a", amount: 187, source: "Regen" }, { t: "heal", unitId: "b", amount: 50, source: "Regen" }];
    const health = healthBefore(intents, (id) => ({ a: { value: 1089, max: 1250 }, b: { value: 750, max: 750 } })[id]);
    const card = turnEndCard(intents, (id) => ({ a: "Archer", b: "Rider" })[id], t, undefined, null, health);
    expect(card).toContain('"who":"Archer","amount":161,"source":"Regen"');
    expect(card).not.toContain("Rider");
    expect(turnEndCard([intents[1]], () => "Rider", t, undefined, null, health)).toBeNull();
  });
});

/* ========================================================================== */

describe("his Magic Resistance C, as the class skill reads it (MR.*)", () => {
  const mag = (attacker, defender, attack) => computeDamage({
    attacker, defender, attack,
    base: { sources: [{ unit: "self", component: "mag", factor: 1 }] },
    rolls: { attackMinus: 0 },
    options: rollOptionsFor({ attacker, defender, attack }),
  });

  it("negates MAG damage from a MAG Rank of C or lower, cuts 30% above it, NP included (MR.1, MR.1.over, MR.1.np)", async () => {
    await withSubjects([{ from: "arjuna", id: ARJ }, { from: "medea", id: FOE }], ({ unit }) => {
      const a = unit(ARJ);
      const f = unit(FOE);
      // The projection holds Ranks, not strings: a MAG C attacker, as one is built.
      expect(mag({ ...f, parameters: { ...f.parameters, mag: Rank.parse("C") } }, a, { kind: "normal", component: "mag" }).total).toBe(0);
      expect(JSON.stringify(mag(f, a, { kind: "normal", component: "mag" }))).toMatch(/−30% MAG/);
      expect(JSON.stringify(mag(f, a, { kind: "np", component: "mag", rank: Rank.parse("A") }))).toMatch(/−30% MAG \(MR C < attack A\)/);
      expect(mag(f, a, { kind: "np", component: "mag", rank: Rank.parse("C") }).total).toBe(0);
    });
  });

  it("cuts a debuff's chance by 15 whatever the attack; Instakill and Death only from MAG; Erase never (MR.2.*)", async () => {
    const { applyEffect } = await import("../../module/engine/effect-applier.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    await withSubjects([{ from: "arjuna", id: ARJ }], ({ unit }) => {
      const a = unit(ARJ);
      const chance = (id, options) => applyEffect({
        def: EffectRegistry.get(id), target: a, duration: "1◈", source: {}, chance: 50,
        ctx: { turnsPerRound: 3, currentTick: 10, roll: 99, options: new Set(options) },
      }).trace.find((t) => t.step === "chance").detail;
      expect(chance("burn", ["attack:component:str"])).toBe("rolled 99 vs 35%");
      expect(chance("death", ["attack:component:mag"])).toBe("rolled 99 vs 35%");
      expect(chance("death", ["attack:component:str"])).toBe("rolled 99 vs 50%");
      expect(chance("death", ["attack:component:mag", "attack:ignoresMagicResistance"])).toBe("rolled 99 vs 50%");
      expect(chance("erase", ["attack:component:mag"])).toBe("rolled 99 vs 50%");
    });
  });
});
