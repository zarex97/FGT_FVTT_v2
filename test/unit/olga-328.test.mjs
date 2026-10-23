/**
 * @file U-Olga Marie (President), the Beast, the audit of #328: her sheet
 * through the real projection.
 * @see docs/superpowers/specs/2026-10-23-u-olga-marie-clauses.md
 *
 * Every subject is `packs/_source/servants/u-olga-marie.yml` as authored,
 * compiled and kept by the DataModel (`test/helpers/subject.mjs`).
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const OM = "olgaMarieBeast01", FOE = "olgaFoe000000001", ALLY = "olgaAlly00000001", MAS = "olgaMaster000001";
// Round 6, NP gate open; a Turn of faction A.
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1 }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);

describe("the sheet (ST*)", () => {
  it("is U-Olga Marie, a Lawful Evil Beast from Earth, every figure the sheet's", async () => {
    await withSubjects([{ from: "u-olga-marie", id: OM }], ({ world: w, unit }) => {
      const o = unit(OM);
      const s = w.actor(OM).system;
      expect(w.actor(OM).name).toBe("U-Olga Marie");
      expect(s.trueName).toBe("Olga Marie Animusphere");
      expect([...s.servantClasses]).toEqual(["beast"]);
      expect(s.classContainer).toBe("beast");
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "evil" });
      expect([...s.region]).toEqual(["earth"]);
      expect(o.baseAttack).toEqual(expect.objectContaining({ str: 200, mag: 250 }));
      // The sheet prints 2500; END EX's table gives 2000, and the table beats
      // the sheet (`domain/health.mjs#maxHealthFor`, #328 ruling 18).
      expect(o.maxHealth ?? o.health?.max).toBe(2000);
      // MOV 3, +1 from Gravity Manipulation.
      expect(o.mov).toBe(4);
      expect(o.range).toBe(3);
    });
  });

  it("is neither Hominidae nor Non-Hominidae, and Levitating (ruling 4, GM.lev)", async () => {
    await withSubjects([{ from: "u-olga-marie", id: OM }], ({ unit }) => {
      const attrs = unit(OM).attributes;
      expect(attrs).toEqual(expect.arrayContaining(["female", "servant", "star", "giant", "spaceflight", "humanoid", "spirit", "large", "levitating"]));
      expect(attrs).not.toContain("hominidae");
      expect(attrs).not.toContain("nonHominidae");
    });
  });

  it("swings BA(STR) at Range 1 and BA(MAG) from Range 2 (ST.na)", async () => {
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    await withSubjects([{ from: "u-olga-marie", id: OM }], ({ unit }) => {
      expect(normalAttackAt(unit(OM), 1).component).toBe("str");
      expect(normalAttackAt(unit(OM), 2).component).toBe("mag");
      expect(normalAttackAt(unit(OM), 3).component).toBe("mag");
    });
  });
});

describe("the Beast Class (BC*, ruling 1)", () => {
  it("a Grand Order War draws no Beast, and refuses one picked by hand", async () => {
    const { candidatesFor, validateRoster, EXTRA } = await import("../../module/rules/war-setup.mjs");
    const catalogue = [
      { contentId: "u-olga-marie", servantClasses: ["beast"] },
      { contentId: "van-gogh", servantClasses: ["foreigner"] },
    ];
    const slot = { id: "c1", factionId: "A", classContainer: EXTRA, fill: "random" };
    expect(candidatesFor(slot, catalogue)).toEqual(["u-olga-marie", "van-gogh"]);
    expect(candidatesFor(slot, catalogue, { grandOrder: true })).toEqual(["van-gogh"]);
    const fixed = { ...slot, fill: "fixed", contentId: "u-olga-marie" };
    const codes = (o) => validateRoster([fixed], [{ id: "A" }], catalogue, o).map((r) => r.code);
    expect(codes({ grandOrder: true })).toContain("barredInGrandOrder");
    expect(codes({})).not.toContain("barredInGrandOrder");
  });

  it("a Beast seated in an Extra slot keeps her Class, its icon and name", async () => {
    const { seatedContainer, EXTRA } = await import("../../module/rules/war-setup.mjs");
    const { existsSync } = await import("node:fs");
    expect(seatedContainer(EXTRA, "beast")).toBe("beast");
    expect(seatedContainer("saber", "beast")).toBe("saber");
    expect(seatedContainer(EXTRA, null)).toBe(EXTRA);
    expect(existsSync("assets/classes/beast.webp")).toBe(true);
  });
});

describe("Item Construction B and Independent Manifestation (IC*, IM*)", () => {
  it("gives her and her allies within 2 her figures: +40/20/10 out, −30/20/10 in (ruling 5)", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "emiya", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
    ], ({ unit }) => {
      const tiers = (u, direction) => (u.applicationChances ?? [])
        .filter((c) => c.direction === direction && /Item Construction/.test(String(c.source)))
        .map((c) => [c.severity, c.value]);
      expect(tiers(unit(ALLY), "outgoing")).toEqual(expect.arrayContaining([["normal", 40], ["instakill", 20], ["death", 10]]));
      expect(tiers(unit(ALLY), "incoming")).toEqual(expect.arrayContaining([["normal", 30], ["instakill", 20], ["death", 10]]));
    }, WAR);
  });

  it("is Independent Action A under her own name, and shuts Mental, Instakill, Death and Erase out", async () => {
    await withSubjects([{ from: "u-olga-marie", id: OM }], ({ world: w, unit }) => {
      const im = abilityOf(w, OM, "class-independent-action");
      expect(im.name).toBe("Independent Manifestation");
      expect(im.system.slug).toBe("independentAction");
      expect(im.system.rank).toBe("A");
      const mine = (unit(OM).applicationChances ?? []).filter((c) => c.direction === "incoming" && c.value === 100);
      expect(mine.map((c) => c.volatility ?? c.severity)).toEqual(expect.arrayContaining(["mental", "instakill", "death", "erase"]));
    });
  });
});

describe("Defender of Humanity (DH*, rulings 6 and 7)", () => {
  // Her pools are filled at war setup; a subject is given them by hand.
  const party = (killer) => [
    { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 },
      state: { factionId: "A", agility: { value: 1, max: 20 }, luck: { value: 0, max: 10 } } },
    { from: killer, id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
  ];
  const fall = async (w, killerId) => {
    const { resolveDefeat } = await import("../../module/engine/scheduler.mjs");
    const { currentBoard } = await import("../../module/engine/board.mjs");
    await w.actor(OM).update({ "system.health.value": 0 });
    const board = currentBoard();
    const unit = board.units.find((u) => u.id === OM);
    return resolveDefeat(unit, { board, killerId, tick: 18, turnsPerRound: 3, rolls: {} });
  };

  it("revives at 50% Health, Agility and Luck when a Threat to Humanity defeats her", async () => {
    await withSubjects(party("van-gogh"), async ({ world: w, unit }) => {
      const intents = await fall(w, FOE);
      expect(intents.some((i) => i.t === "defeat")).toBe(false);
      expect(intents).toContainEqual(expect.objectContaining({ t: "heal", unitId: OM, amount: 1000 }));
      expect(intents).toContainEqual(expect.objectContaining({ t: "statDelta", stat: "agility.value", delta: 9 }));
      expect(intents).toContainEqual(expect.objectContaining({ t: "statDelta", stat: "luck.value", delta: 5 }));
      const log = intents.find((i) => i.t === "log" && i.entry?.kind === "revive")?.entry;
      expect(log.pools).toEqual({ agility: 10, luck: 5 });
      void unit;
    }, WAR);
  });

  it("does not revive when her killer is no Threat to Humanity, nor with no killer", async () => {
    await withSubjects(party("karna"), async ({ world: w }) => {
      expect((await fall(w, FOE)).some((i) => i.t === "heal")).toBe(false);
      expect((await fall(w, null)).some((i) => i.t === "heal")).toBe(false);
    }, WAR);
  });

  it("the method on two Units caught: BA(MAG), Total damage −20%, and it counts as a Normal Attack", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "karna", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
      { from: "emiya", id: ALLY, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { playAttack } = await import("../helpers/process.mjs");
      const method = abilityOf(w, OM, "olga-defender-normal-attack");
      // Four Elements rides it (Range 2): declined here.
      w.answer({ title: "FGT.AttackRider.Title", pick: ["skip"] });
      // Each defender's own window: Karna's and EMIYA's.
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      const { processes } = await playAttack(w, {
        attacker: OM, ability: method.id, placement: { panel: { i: 5, j: 7 } },
        react: { [FOE]: ["nothing", "declined", "declined"], [ALLY]: ["nothing", "declined", "declined"] },
      });
      expect(processes).toHaveLength(2);
      expect(processes.every((p) => p.areaCount === 2)).toBe(true);
      expect(processes[0].attack.asNormalAttack).toBe(true);
      expect(processes[0].attack.component).toBe("mag");
      const results = [...w.messages].map((m) => m.getFlag("fgt", "result")).filter(Boolean);
      expect(JSON.stringify(results)).toMatch(/Defender of Humanity: per Unit in the area/);
    }, WAR);
  });

  it("the Normal Attack method: BA(MAG), a 3x3 within Range, −10% per Unit, her Crit Damage ignored, once a Turn", async () => {
    const { readFileSync } = await import("node:fs");
    const yaml = (await import("js-yaml")).default;
    const doc = yaml.load(readFileSync("packs/_source/abilities/olga-defender-normal-attack.yml", "utf8"));
    expect(doc).toMatchObject({ isAttackSkill: true, countsAsNormalAttack: true, oncePerTurn: true });
    expect(doc.damage).toMatchObject({ component: "mag", ignoresCritDamageDealt: true });
    expect(doc.damage.totalModifiers[0]).toMatchObject({ value: -10, perUnitInArea: true });
    expect(doc.targeting).toMatchObject({ anchor: { kind: "withinRange" }, shape: { kind: "square", size: 3 } });
  });
});

describe("Gravity Manipulation (GM*, rulings 8 and 9)", () => {
  const ring = (j) => [
    { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "karna", id: FOE, panel: { i: 5, j }, state: { factionId: "B" } },
  ];

  it("cuts an enemy's MOV by 3, 4 or 5 at exactly 3, 2 or 1 panels, and its Agility Checks by as much", async () => {
    // Karna's MOV is 7.
    const cases = [[8, 3], [7, 4], [6, 5], [9, 0]];
    for (const [j, cut] of cases) {
      await withSubjects(ring(j), ({ unit }) => {
        const k = unit(FOE);
        expect(k.mov, `at ${j - 5}`).toBe(7 - cut);
        const checks = (k.checkModifiers ?? []).filter((m) => /Gravity/.test(String(m.source)));
        expect(checks.map((m) => [m.check, m.value]).sort()).toEqual(cut ? [["agility", cut], ["evade", cut]] : []);
      }, WAR);
    }
  });

  it("never takes a MOV below 1 this way, and never raises one already below it (GM.floor)", async () => {
    const { auraMov } = await import("../../module/rules/auras.mjs");
    expect(auraMov(4, { value: -5, floor: 1 })).toBe(1);
    expect(auraMov(7, { value: -5, floor: 1 })).toBe(2);
    expect(auraMov(0, { value: -5, floor: 1 })).toBe(0);
  });

  it("is negated whole by Skill Seal: her MOV and Levitating go, and the tiers", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "skillSeal", expiry: 99 }] },
      { from: "karna", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], ({ unit }) => {
      expect(unit(OM).mov).toBe(3);
      expect(unit(OM).attributes).not.toContain("levitating");
      expect(unit(FOE).mov).toBe(7);
    }, WAR);
  });

  it("a STR Attack from 4 or more panels has no effect on her: no damage, no riders, and the card says why", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "emiya", id: FOE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { playAttack } = await import("../helpers/process.mjs");
      const before = w.actor(OM).system.health.value;
      // EMIYA's own window at his Combat Phase.
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      const { processes } = await playAttack(w, { attacker: FOE, target: OM, react: { [OM]: ["nothing"] } });
      expect(processes[0].history.map((h) => `${h.state}:${h.event}`)).toContain("missCheck:miss");
      expect(w.actor(OM).system.health.value).toBe(before);
      const rolls = processes[0].rolls ?? [];
      expect(rolls).toContainEqual(expect.objectContaining({ check: "noEffect", outcome: "noEffect" }));
      // The card says why, not "Missed" (found live, 2026-10-23): the template is handed the reason.
      const drawn = w.cards.map((c) => c.data ?? {});
      expect(drawn.some((d) => d.missed && d.noEffect === "FGT.Card.NoEffect")).toBe(true);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "B" } });
  });

  it("...but the same Attack from 3 panels lands", async () => {
    const { nullifiedBy } = await import("../../module/rules/miss.mjs");
    const her = { panel: { i: 5, j: 5 }, attackNullifiers: [{ component: "str", minDistance: 4, source: "g" }] };
    expect(nullifiedBy(her, { panel: { i: 5, j: 8 } }, { component: "str" })).toBeNull();
    expect(nullifiedBy(her, { panel: { i: 5, j: 9 } }, { component: "str" })).not.toBeNull();
    expect(nullifiedBy(her, { panel: { i: 5, j: 9 } }, { component: "mag" })).toBeNull();
  });
});

describe("Gyakkou (GY*, ruling 10)", () => {
  it("on a revival: Atk Up, Invuln (Gyakkou) once, NP −⅓◈, Max Health −10% of its maximum, and its clock starts", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "guts", magnitude: 20, expiry: 99 }] },
      { from: "karna", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { resolveDefeat } = await import("../../module/engine/scheduler.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const planet = abilityOf(w, OM, "olga-planet-olga-marie");
      await planet.update({ "system.cooldown.remaining": 6 });
      await w.actor(OM).update({ "system.health.value": 0 });
      const board = currentBoard();
      const intents = resolveDefeat(board.units.find((u) => u.id === OM), { board, killerId: FOE, tick: 18, turnsPerRound: 3, rolls: {} });
      await applyWorldIntents(intents, "test:defeat");
      expect(held(w, OM)).toEqual(expect.arrayContaining(["atkUp", "invulnGyakkou"]));
      // "1 time": a counted Invuln, which a hit spends (found live, 2026-10-23).
      expect([...w.actor(OM).effects].find((e) => e.system?.defId === "invulnGyakkou").system.uses).toBe(1);
      expect(planet.system.cooldown.remaining).toBe(5);
      // 10% of her maximum, 2000 by her END (see the sheet test).
      expect(w.actor(OM).system.health.max).toBe(1800);
      expect(abilityOf(w, OM, "olga-gyakkou").system.cooldown.remaining).toBe(12);
      // ...and the revival's card says what Gyakkou did (found live, 2026-10-23).
      const log = intents.find((i) => i.t === "log" && i.entry?.kind === "revive")?.entry;
      const gy = log.then.find((g) => g.source === "Gyakkou");
      expect(gy.said).toEqual(expect.arrayContaining(["Atk Up", "Invuln (Gyakkou)", "Max Health −200"]));
    }, WAR);
  });

  it("Invuln (Gyakkou) is an Invuln, and is spent before a plain one", async () => {
    const { spentFirstOf, holdsFamily } = await import("../../module/rules/effects/families.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    await withSubjects([{ from: "u-olga-marie", id: OM }], () => {
      expect(holdsFamily({ effects: ["invulnGyakkou"], effectFamilies: ["invuln"] }, "invuln")).toBe(true);
      const spent = spentFirstOf([
        { id: "a", defId: "invuln", uses: 1 },
        { id: "b", defId: "invulnGyakkou", uses: 1 },
      ], "invuln", EffectRegistry);
      expect(spent.id).toBe("b");
    });
  });
});

describe("Unparalleled (UP*, ruling 11)", () => {
  const party = () => [
    { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "emiya", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
    { from: "karna", id: FOE, panel: { i: 5, j: 8 }, state: { factionId: "B" } },
  ];

  it("cuts her other Skills by 2◈, NP DmUp 30%, and the Unparalleled effect: three Attacks, her allied Servants barred", async () => {
    await withSubjects(party(), async ({ world: w, unit }) => {
      const flaw = abilityOf(w, OM, "olga-flawlessness");
      await flaw.update({ "system.cooldown.remaining": 8 });
      const { castSkill } = await import("../helpers/process.mjs");
      const out = await castSkill(w, { caster: OM, ability: abilityOf(w, OM, "olga-unparalleled").id });
      expect(out.ok, out.reason).toBe(true);
      expect(flaw.system.cooldown.remaining).toBe(2);
      expect(held(w, OM)).toEqual(expect.arrayContaining(["npDmUp", "unparalleled", "sCritUp"]));
      expect(held(w, ALLY)).toContain("sCritUp");
      expect(held(w, FOE)).toEqual(expect.arrayContaining(["npSeal", "healDwn"]));
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const now = (id) => currentBoard().units.find((u) => u.id === id);
      void unit;
      expect(now(OM).attacksPerTurn).toBe(3);
      expect(now(ALLY).attackBarredBy).toBeTruthy();
      const { canConsume, emptyBudget, DEFAULT_MAXIMA } = await import("../../module/rules/budget.mjs");
      expect(canConsume(emptyBudget(DEFAULT_MAXIMA), now(ALLY), "attack")).toMatchObject({ ok: false });
    }, WAR);
  });

  it("is not applied when another allied Servant has already Attacked; the rest still is", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      await w.actor(ALLY).update({ "system.turnState": { tick: 18, attacked: true } });
      const { castSkill } = await import("../helpers/process.mjs");
      expect((await castSkill(w, { caster: OM, ability: abilityOf(w, OM, "olga-unparalleled").id })).ok).toBe(true);
      expect(held(w, OM)).not.toContain("unparalleled");
      expect(held(w, OM)).toContain("npDmUp");
      // ...and the card says why (found live, 2026-10-23).
      const refused = w.cards.flatMap((c) => c.data?.refused ?? []).map((r) => r.name);
      expect(refused).toContain("FGT.Unparalleled.NotApplied");
    }, WAR);
  });

  it("the budget lets a Unit allowed three Attack three times, the later two free, and refuses a fourth", async () => {
    const { consume, emptyBudget, DEFAULT_MAXIMA } = await import("../../module/rules/budget.mjs");
    const her = { id: OM, kind: "servant", attacksPerTurn: 3, turnState: { attacked: false } };
    let b = emptyBudget(DEFAULT_MAXIMA);
    let r = consume(b, her, "attack");
    expect(r.ok).toBe(true);
    b = r.budget;
    const after = { ...her, turnState: { attacked: true } };
    for (let n = 0; n < 2; n++) {
      r = consume(b, after, "attack");
      expect(r.ok, `attack ${n + 2}`).toBe(true);
      b = r.budget;
    }
    expect(b.pools.servantAttack.used).toBe(1);
    expect(consume(b, after, "attack").ok).toBe(false);
  });
});

describe("Earth-Shattering and Flawlessness (ES*, FL*, rulings 12 to 15)", () => {
  const party = () => [
    { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "emiya", id: ALLY, panel: { i: 5, j: 8 }, state: { factionId: "A" } },
  ];

  it("Earth-Shattering: NP Cooldown to 0, Overcharge 20%", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const planet = abilityOf(w, OM, "olga-planet-olga-marie");
      await planet.update({ "system.cooldown.remaining": 20 });
      const { castSkill } = await import("../helpers/process.mjs");
      expect((await castSkill(w, { caster: OM, ability: abilityOf(w, OM, "olga-earth-shattering").id })).ok).toBe(true);
      expect(planet.system.cooldown.remaining).toBe(0);
      expect([...w.actor(OM).effects].map((e) => [e.system?.defId, e.system?.magnitude])).toContainEqual(["overcharge", 20]);
    }, WAR);
  });

  it("Flawlessness is refused while her NP cools, and Resets it to its full 8◈ when it is ready", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const planet = abilityOf(w, OM, "olga-planet-olga-marie");
      const flaw = abilityOf(w, OM, "olga-flawlessness");
      const { castSkill } = await import("../helpers/process.mjs");
      await planet.update({ "system.cooldown.remaining": 3 });
      expect((await castSkill(w, { caster: OM, ability: flaw.id })).ok).toBe(false);
      await planet.update({ "system.cooldown.remaining": 0 });
      expect((await castSkill(w, { caster: OM, ability: flaw.id })).ok).toBe(true);
      expect(planet.system.cooldown.remaining).toBe(24);
      const has = (id) => [...w.actor(id).effects].map((e) => [e.system?.defId, e.system?.magnitude]);
      expect(has(OM)).toEqual(expect.arrayContaining([["dmgUpStandard", 50], ["atkUp", 30], ["atkUp", 40], ["eAtkUp", 100], ["critDmUp", 30], ["npRegen", 1]]));
      expect(held(w, OM)).toContain("pierce");
      expect(has(ALLY)).toEqual(expect.arrayContaining([["atkUp", 40], ["eAtkUp", 100], ["critDmUp", 30], ["npRegen", 1]]));
      expect(has(ALLY).map(([d]) => d)).not.toContain("dmgUpStandard");
    }, WAR);
  });
});

describe("Four Elements (FE*, ruling 16)", () => {
  it("a spent face reads as nothing; a choice names only the unspent faces", async () => {
    const m = await import("../../module/engine/attack-riders.mjs");
    const rider = { abilityKey: "olga-four-elements", oncePerTurnFaces: [2, 3, 4, 5], chooseOn: [6], blankFace: 1, faces: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} } };
    const used = [m.faceKey("olga-four-elements", 3)];
    expect(m.landedFace(rider, 3, used)).toEqual({ face: 1, spent: true });
    expect(m.landedFace(rider, 2, used)).toEqual({ face: 2, spent: false });
    expect(m.choosableFaces(rider, used)).toEqual([1, 2, 4, 5]);
    expect(m.choosableFaces(rider, used, { excludeFaces: [5] })).toEqual([1, 2, 4]);
  });

  it("face 5's follow-up: a Block binds a Block; a failed Evade takes every reaction", async () => {
    const { riderLockedReactions } = await import("../../module/engine/attack-riders.mjs");
    expect(riderLockedReactions({ reaction: "block" })).toEqual(["evade", "nothing"]);
    expect(riderLockedReactions({ reaction: "evade", evaded: false })).toEqual(["evade", "block", "counter", "abilities"]);
    expect(riderLockedReactions({ reaction: "evade", evaded: true })).toEqual([]);
    expect(riderLockedReactions({ reaction: "nothing" })).toEqual([]);
  });

  it("a 2 at Range 2: the Normal Attack deals Fire damage and tries Burn for 2◈, and the die is on a card", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "karna", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { playAttack } = await import("../helpers/process.mjs");
      w.answer({ title: "FGT.AttackRider.Title", pick: ["use"] });
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      // The d6 shows a 2: Fire.
      w.dice.set("d6", 2);
      const { processes } = await playAttack(w, { attacker: OM, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
      expect(processes[0].attack.rider).toMatchObject({ face: 2, element: "fire" });
      expect(processes[0].attack.element).toBe("fire");
      const card = [...w.messages].find((m) => /FGT\.AttackRider\.Rolled/.test(m.content ?? ""));
      expect(card).toBeTruthy();
    }, WAR);
  });

  it("a 5: a BA(STR) hit, then a BA(MAG) follow-up on the same DU, whose Block binds a Block", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "karna", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const { playAttack, playProcess } = await import("../helpers/process.mjs");
      w.answer({ title: "FGT.AttackRider.Title", pick: ["use"] });
      w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
      w.dice.set("d6", 5);
      const { processes } = await playAttack(w, { attacker: OM, target: FOE, react: { [FOE]: ["block", "declined", "declined"] } });
      expect(processes[0].attack.rider).toMatchObject({ face: 5, component: "str" });
      expect(processes[0].attack.component).toBe("str");
      const follow = [...w.messages].map((m) => m.getFlag("fgt", "process")).filter(Boolean)
        .map((raw) => JSON.parse(raw)).find((s) => s.attack?.followUp);
      expect(follow, "the follow-up was declared").toBeTruthy();
      expect(follow.attack.component).toBe("mag");
      expect(follow.forbiddenReactions).toEqual(expect.arrayContaining(["evade", "nothing"]));
      void playProcess;
    }, WAR);
  });

  it("is not offered under NP Seal, nor at Range 1", async () => {
    for (const [j, effects] of [[7, [{ defId: "npSeal", expiry: 99 }]], [6, []]]) {
      await withSubjects([
        { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects },
        { from: "karna", id: FOE, panel: { i: 5, j }, state: { factionId: "B" } },
      ], async ({ world: w }) => {
        const { playAttack } = await import("../helpers/process.mjs");
        w.answer({ title: "FGT.Window.defendingPhaseStart", decline: true });
        await playAttack(w, { attacker: OM, target: FOE, react: { [FOE]: ["nothing", "declined", "declined"] } });
        expect(w.asked.map((a) => a.title)).not.toContain("FGT.AttackRider.Title");
      }, WAR);
    }
  });
});

describe("Planet Olga Marie (PO*, ruling 17)", () => {
  it("a 9x9 beside her; Agility Loss, Luck Loss and Def Dwn (B) first; ×5, ×3 against Man, Star or Living Human; allies' riders after", async () => {
    const { readFileSync } = await import("node:fs");
    const yaml = (await import("js-yaml")).default;
    const doc = yaml.load(readFileSync("packs/_source/abilities/olga-planet-olga-marie.yml", "utf8"));
    expect(doc.targeting).toMatchObject({ anchor: { kind: "selfEdgeAdjacent" }, shape: { kind: "orientedRect", short: 9, long: 9 } });
    expect(doc.damage).toMatchObject({ component: "mag", multiplier: 5 });
    expect(doc.damage.conditionalMultipliers[0].factor).toBe(3);
    const first = doc.phases[0];
    expect(first).toMatchObject({ kind: "applyEffects", when: "beforeDamage" });
    expect(first.effects[0]).toMatchObject({ id: "agilityLoss", otherwiseOn: "failed", otherwise: { stats: [{ stat: "agility", delta: -2 }] } });
  });

  it("a debuff that fails to land costs the DU its price, on the card", async () => {
    await withSubjects([
      { from: "u-olga-marie", id: OM, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 9, j: 9 }, state: { factionId: "A" } },
      { from: "karna", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" },
        effects: [{ defId: "debuffImmune", expiry: 99 }] },
    ], async ({ world: w }) => {
      const { landEntry } = await import("../../module/engine/landing.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const { currentBoard, unitFrom } = await import("../../module/engine/board.mjs");
      const before = w.actor(FOE).system.agility.value;
      const board = currentBoard();
      const out = await landEntry(
        { id: "agilityLoss", duration: "1◈", otherwiseOn: "failed", otherwise: { stats: [{ stat: "agility", delta: -2 }] } },
        { target: unitFrom(board, w.actor(FOE)), source: { unitId: OM, abilityId: null }, caster: w.actor(OM), board },
        { write: (intents) => applyWorldIntents(intents, "test") },
      );
      expect(w.actor(FOE).system.agility.value).toBe(Math.max(0, before - 2));
      expect(out.map((o) => o.summary.name)).toContainEqual(expect.stringMatching(/FailurePrice|loses 2/));
    }, WAR);
  });
});
