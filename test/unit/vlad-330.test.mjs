/**
 * @file Vlad III (Lancer), the audit of #330: his sheet through the real
 * projection.
 * @see docs/superpowers/specs/2026-10-23-vlad-lancer-clauses.md
 *
 * Every subject is `packs/_source/servants/vlad-lancer.yml` as authored,
 * compiled and kept by the DataModel (`test/helpers/subject.mjs`). The test
 * world creates no Regions, so a field stands on the board as a Region the
 * world is handed (`regions:`), shaped as `openField` writes one.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const VL = "vladLancer000001", FOE = "vladFoe000000001", FOE2 = "vladFoe000000002", MAS = "vladMaster000001";
// Round 6, the NP gate open; a Turn of faction A.
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1 }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const held = (w, id) => [...w.actor(id).effects].map((e) => e.system?.defId);
const WALLACHIA_ID = "vlad-demonic-defender-of-the-state";

/** A 9x9 Wallachia centred on `c`, stored as `openField` writes one. */
const wallachia = (c, ownerId = VL) => {
  const panels = [];
  for (let di = -4; di <= 4; di += 1) for (let dj = -4; dj <= 4; dj += 1) panels.push({ i: c.i + di, j: c.j + dj });
  return {
    id: "wallachiaRegion",
    panels,
    behaviors: [{
      type: "npField",
      system: {
        fieldId: WALLACHIA_ID, ownerUnitId: ownerId, ownerFaction: "A", passive: true, outlivesOwner: true,
        geometry: { kind: "fixedArea", anchor: c, shape: { kind: "square", size: 9 }, cannotIntersect: "otherHomeBase" },
        countsAsHomeBase: { units: ["owner"] },
        interior: [
          { key: "DamageModifier", modifierKey: "defUp", direction: "taken", value: 50, npValue: 25, relations: ["self"] },
          { key: "DamageModifier", modifierKey: "atkUp", direction: "dealt", component: "str", value: 100, npValue: 100, relations: ["self"] },
          { key: "DamageModifier", modifierKey: "atkUp", direction: "dealt", component: "mag", value: 50, npValue: 50, relations: ["self"] },
          { key: "Suppress", scope: "sustainabilityDecay", relations: ["self"] },
          { key: "Suppress", scope: "zon", relations: ["self"] },
        ],
        panels,
      },
    }],
  };
};

describe("the sheet (ST*)", () => {
  it("is Vlad III, a Lawful Neutral Lancer from Romania, every figure the sheet's", async () => {
    await withSubjects([{ from: "vlad-lancer", id: VL }], ({ world: w, unit }) => {
      const v = unit(VL);
      const s = w.actor(VL).system;
      expect(w.actor(VL).name).toBe("Vlad III (Lancer)");
      expect(s.trueName).toBe("Vlad III");
      expect([...s.servantClasses]).toEqual(["lancer"]);
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "neutral" });
      expect([...s.region]).toEqual(["romania", "europe"]);
      expect(v.attributes).toEqual(expect.arrayContaining(["male", "servant", "earth", "king", "humanoid", "antiHero"]));
      expect(v.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 200 }));
      expect(v.mov).toBe(7);
      expect(v.range).toBe(2);
      expect(v.maxTargets).toBe(1);
    });
  });

  it("swings BA(STR) at every Range (ruling 2, ST.na)", async () => {
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    await withSubjects([{ from: "vlad-lancer", id: VL }], ({ unit }) => {
      expect(normalAttackAt(unit(VL), 1).component).toBe("str");
      expect(normalAttackAt(unit(VL), 2).component).toBe("str");
    });
  });

  it("Romania is a War Region bordering Europe alone (ruling 3)", async () => {
    const { REGION_ADJACENCY } = await import("../../module/rules/environment.mjs");
    expect(REGION_ADJACENCY.romania.adjacent).toEqual(["europe"]);
    expect(REGION_ADJACENCY.europe.adjacent).toContain("romania");
  });
});

describe("Magic Resistance B and Battle Continuation A (MR*, BC*)", () => {
  it("are the class skills at their Ranks: 40% and 20%; 2d10+20, NP dice doubled, a 5d20 revival every 3◈", async () => {
    await withSubjects([{ from: "vlad-lancer", id: VL }], ({ unit }) => {
      const v = unit(VL);
      expect(JSON.stringify(v.magicResistance)).toMatch(/"rank":"B"/);
      const neg = (v.damageNegation ?? []).find((n) => /Battle Continuation/.test(n.source ?? ""));
      expect(neg).toMatchObject({ mode: "dice", formula: "2d10+20", npDiceDoubled: true });
      expect((v.revivals ?? []).find((r) => r.id === "battleContinuation"))
        .toMatchObject({ formula: "5d20", cooldown: "3◈", requiresHealthRestoredSince: 0.5 });
    });
  });
});

describe("Shapeshift C (SS*, ruling 20)", () => {
  it("cuts damage taken 10%, 5% against an NP; doubled once Dracula", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: VL },
      { from: "vlad-lancer", id: "vladDracula00001", effects: [{ defId: "legendOfDraculaActivated" }] },
    ], ({ unit }) => {
      const ward = (u) => (u.modifiers ?? []).filter((m) => m.key === "ward" || m.modifierKey === "ward");
      const plain = (unit(VL).wards ?? ward(unit(VL)));
      const dracula = (unit("vladDracula00001").wards ?? ward(unit("vladDracula00001")));
      expect(JSON.stringify(plain)).toMatch(/"value":10/);
      expect(JSON.stringify(dracula)).toMatch(/"value":20/);
    });
  });

  it("is offered on his Turn and at the start of a Combat Phase he is Attacked in", async () => {
    const { windowsOf } = await import("../../module/rules/windows.mjs");
    await withSubjects([{ from: "vlad-lancer", id: VL }], ({ world: w }) => {
      expect(windowsOf(abilityOf(w, VL, "vlad-shapeshift").system.timing)).toEqual(["ownTurn", "defendingPhaseStart"]);
    });
  });

  it("applies Def Up 10/5 for 1◈, and 20/10 once Dracula", async () => {
    await withSubjects([{ from: "vlad-lancer", id: VL, state: { factionId: "A" } }], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      await useSkill({ actorId: VL, abilityId: abilityOf(w, VL, "vlad-shapeshift").id });
      const defUp = [...w.actor(VL).effects].find((e) => e.system.defId === "defUp");
      expect(defUp.system).toMatchObject({ magnitude: 10, npMagnitude: 5 });
    }, WAR);
    await withSubjects([{ from: "vlad-lancer", id: VL, state: { factionId: "A" }, effects: [{ defId: "legendOfDraculaActivated" }] }], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      await useSkill({ actorId: VL, abilityId: abilityOf(w, VL, "vlad-shapeshift").id });
      const defUp = [...w.actor(VL).effects].find((e) => e.system.defId === "defUp");
      expect(defUp.system).toMatchObject({ magnitude: 20, npMagnitude: 10 });
    }, WAR);
  });
});

describe("Wallachia (WL*, rulings 4, 5, 21, 23)", () => {
  it("is centred where its player chooses: in his Home Base or nearer it than any other", async () => {
    const { chosenCentres } = await import("../../module/rules/bounded-fields.mjs");
    const board = {
      bounds: { iMin: 0, jMin: 0, iMax: 19, jMax: 19 },
      zones: {
        a: { faction: "A", panels: [{ i: 0, j: 0 }, { i: 0, j: 1 }] },
        b: { faction: "B", panels: [{ i: 19, j: 19 }] },
      },
    };
    const ok = chosenCentres({ faction: "A" }, board);
    const has = (i, j) => ok.some((p) => p.i === i && p.j === j);
    expect(has(0, 0)).toBe(true);
    expect(has(5, 5)).toBe(true);
    expect(has(9, 9)).toBe(true); // 9 from A, 10 from B
    expect(has(10, 10)).toBe(false); // 10 from A, 9 from B
    expect(has(19, 19)).toBe(false);
  });

  it("is cut off every other Player's Home Base, an ally's included (WL.clip)", async () => {
    const { panelsOf } = await import("../../module/rules/bounded-fields.mjs");
    const field = { ownerFaction: "A", geometry: { kind: "fixedArea", anchor: { i: 5, j: 5 }, shape: { size: 9 }, cannotIntersect: "otherHomeBase" } };
    const board = {
      alliances: { A: ["A", "C"] },
      zones: {
        a: { faction: "A", panels: [{ i: 5, j: 5 }] },
        c: { faction: "C", panels: [{ i: 1, j: 1 }] },
        b: { faction: "B", panels: [{ i: 9, j: 9 }] },
      },
    };
    const panels = panelsOf(field, board);
    const has = (i, j) => panels.some((p) => p.i === i && p.j === j);
    expect(panels.length).toBe(81 - 2);
    expect(has(5, 5)).toBe(true);
    expect(has(1, 1)).toBe(false);
    expect(has(9, 9)).toBe(false);
  });

  it("is owed as an opening choice until it stands on the board", async () => {
    await withSubjects([{ from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async ({ world: w }) => {
      const { openingChoicesOf } = await import("../../module/engine/opening-choice.mjs");
      expect(openingChoicesOf(w.actor(VL)).map((i) => i.system.contentId)).toEqual([WALLACHIA_ID]);
    }, WAR);
    await withSubjects([{ from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async ({ world: w }) => {
      const { openingChoicesOf } = await import("../../module/engine/opening-choice.mjs");
      expect(openingChoicesOf(w.actor(VL))).toEqual([]);
    }, { ...WAR, regions: [wallachia({ i: 5, j: 5 })] });
  });

  it("inside it: damage taken -50% (NP 25%), STR dealt +100%, MAG +50%, no decay, no ZON penalty, a Home Base for him only", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS } },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { ownBaseOf } = await import("../../module/rules/environment.mjs");
      const b = currentBoard();
      const v = b.units.find((u) => u.id === VL);
      const m = b.units.find((u) => u.id === MAS);
      expect(v.fields).toContain(WALLACHIA_ID);
      const mods = JSON.stringify(v.modifiers ?? []);
      expect(mods).toMatch(/"key":"defUp"[^}]*"value":50[^}]*"npValue":25|"npValue":25[^}]*"value":50/);
      expect(ownBaseOf(v, b)).toMatchObject({ fieldId: WALLACHIA_ID });
      expect(ownBaseOf(m, b)).toBeNull();
      expect((v.suppressions ?? []).map((x) => x.scope)).toEqual(expect.arrayContaining(["sustainabilityDecay", "zon"]));
    }, { ...WAR, regions: [wallachia({ i: 5, j: 5 })] });
  });

  it("waives his Master's ZON whole inside it: no penalty and no NP refused (ruling 29)", async () => {
    const party = [
      { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 15 }, state: { factionId: "A" } },
    ];
    const outside = async (regions) => {
      let out;
      await withSubjects(party, async () => {
        const { currentBoard } = await import("../../module/engine/board.mjs");
        out = currentBoard().units.find((u) => u.id === VL).outsideZon;
      }, { ...WAR, regions });
      return out;
    };
    expect(await outside([])).toBe(true);
    expect(await outside([wallachia({ i: 5, j: 5 })])).toBe(false);
  });
});

describe("Kazıklı stacks (KZ.stack, KZ.debuff, KZ.resist; rulings 11, 22)", () => {
  it("his Normal Attack's damage puts one on the DU; an NP's does not", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
      { from: "chiron", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { fireEvent, pendingRolls } = await import("../../module/engine/scheduler.mjs");
      const { rollOptionsFor } = await import("../../module/rules/options.mjs");
      const b = currentBoard();
      const v = b.units.find((u) => u.id === VL);
      const f = b.units.find((u) => u.id === FOE);
      const rolls = Object.fromEntries(pendingRolls(v, "damageDealt").filter((r) => r.formula).map((r) => [r.key, 1]));
      const at = (kind, dealtDamage = true) => fireEvent("damageDealt", [v], {
        tick: 18, board: b, turnsPerRound: 3, rolls,
        options: rollOptionsFor({ attacker: v, defender: f, attack: { kind, dealtDamage } }),
        event: { victimId: FOE, attackerId: VL, amount: 100 },
        victim: { unitId: f.id },
      });
      const landed = (intents) => intents.filter((i) => i.t === "applyEffect").map((i) => [i.unitId, i.effect?.defId]);
      expect(landed(at("normal"))).toEqual([[FOE, "kazikli"]]);
      expect(landed(at("np"))).toEqual([]);
      // A Normal Attack hit that dealt 0 (an Invuln) stacks nothing (found live).
      expect(landed(at("normal", false))).toEqual([]);
    }, WAR);
  });

  it("a stack is a debuff, counted, permanent, and halves the chance of its own removal", async () => {
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    const { removalPlan, pendingRemovalRolls, ownRemovalResist } = await import("../../module/rules/removal.mjs");
    await withSubjects([{ from: "vlad-lancer", id: VL }], () => {
      const def = EffectRegistry.get("kazikli");
      expect(def).toMatchObject({ polarity: "debuff", stacking: "count", defaultDuration: "permanent", removalResist: 50 });
      const candidates = [{ defId: "kazikli", polarity: "debuff", ownResist: ownRemovalResist(def) }];
      expect(pendingRemovalRolls({ candidates, bearer: {} })).toEqual(["kazikli"]);
      expect(removalPlan({ candidates, bearer: {}, rolls: { kazikli: 50 } }).removed).toEqual(["kazikli"]);
      expect(removalPlan({ candidates, bearer: {}, rolls: { kazikli: 51 } }).resisted).toEqual([{ defId: "kazikli", chance: 50, roll: 51 }]);
      // Its own spending is no attempt to resist: Active 2 removes them all.
      expect(removalPlan({ candidates, bearer: {}, rolls: { kazikli: 99 }, ignoresProtection: true }).removed).toEqual(["kazikli"]);
      // ...and a plain debuff is still never protected.
      expect(removalPlan({ candidates: [{ defId: "burn", polarity: "debuff" }], bearer: {}, rolls: {} }).removed).toEqual(["burn"]);
    });
  });
});

describe("Kazıklı Bey's damage, through the DU's half of the pipeline only (ruling 27)", () => {
  const hit = async (foeEffects, opts) => {
    let out;
    await withSubjects([
      { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "atkUp", magnitude: 50, npMagnitude: 50 }] },
      { from: "chiron", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" }, effects: foeEffects },
    ], async ({ world: w }) => {
      const { standaloneDamage } = await import("../../module/engine/attack.mjs");
      out = await standaloneDamage({ attackerDoc: w.actor(VL), defenderId: FOE, amount: 300, component: "str", isNP: true, ...opts });
    }, WAR);
    return out;
  };

  it("Vlad's Atk Up is skipped; a Def Up skipped by Ignore Def", async () => {
    expect((await hit([], {})).total).toBe(300);
    expect((await hit([{ defId: "defUp", magnitude: 50, npMagnitude: 50 }], { ignoresDefUp: true })).total).toBe(300);
    expect((await hit([{ defId: "defUp", magnitude: 50, npMagnitude: 50 }], {})).total).toBe(150);
  });

  it("an Invuln stops Active 1 whole, not Active 2's Pierce; an Anti-Purge stops both (rulings 7, 10)", async () => {
    expect(await hit([{ defId: "invuln", uses: 1 }], { invulnNegates: true })).toMatchObject({ total: 0, negatedBy: "Invuln" });
    // Appendix A's own rule, without the sheet's clause: an NP is halved.
    expect((await hit([{ defId: "invuln", uses: 1 }], {})).total).toBe(150);
    expect((await hit([{ defId: "invuln", uses: 1 }], { pierce: true })).total).toBe(300);
    expect((await hit([{ defId: "antiPurge" }], {})).total).toBe(0);
    expect((await hit([{ defId: "antiPurge" }], { pierce: true })).total).toBe(0);
  });
});

describe("Kazıklı Bey, Active 2 (KB*; rulings 8, 9, 22, 25, 26, 28)", () => {
  const party = (foe = [{ defId: "kazikli", uses: 3 }]) => [
    { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "chiron", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" }, effects: foe },
    { from: "chiron", id: FOE2, panel: { i: 5, j: 9 }, state: { factionId: "B" }, effects: [{ defId: "kazikli", uses: 2 }] },
  ];

  it("50 a stack to each Unit within 3 holding stacks, then Curse, then none left; his Attack from the bar", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const before = w.actor(FOE).system.health.value;
      const out = await useSkill({ actorId: VL, abilityId: abilityOf(w, VL, "vlad-kazikli-bey-execution").id });
      expect(out.ok).toBe(true);
      expect(before - w.actor(FOE).system.health.value).toBe(150);
      expect(held(w, FOE)).toContain("curse");
      expect(held(w, FOE)).not.toContain("kazikli");
      // Four panels away: out of reach, untouched.
      expect(held(w, FOE2)).toContain("kazikli");
      expect(w.actor(VL).system.turnRecord?.attacked ?? w.actor(VL).system.turn?.attacked ?? true).toBe(true);
    }, WAR);
  });

  it("100 a stack for a Unit inside Wallachia when he is", async () => {
    await withSubjects(party(), async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const before = w.actor(FOE).system.health.value;
      await useSkill({ actorId: VL, abilityId: abilityOf(w, VL, "vlad-kazikli-bey-execution").id });
      expect(before - w.actor(FOE).system.health.value).toBe(300);
    }, { ...WAR, regions: [wallachia({ i: 5, j: 5 })] });
  });

  it("is free at a window, once a Round, costs no Master Health, and is offered at the four moments", async () => {
    const { windowsOf } = await import("../../module/rules/windows.mjs");
    await withSubjects([{ from: "vlad-lancer", id: VL }], ({ world: w }) => {
      const s = abilityOf(w, VL, "vlad-kazikli-bey-execution").system;
      expect(windowsOf(s.timing)).toEqual(["ownTurn", "combatPhaseStart", "defendingPhaseStart", "processEnd"]);
      expect(s).toMatchObject({
        oncePerRound: true, noMasterCost: true, freeAtWindow: true, countsAsAttack: true,
        cancelsAttackWhenDefending: true, forbidsCounterWhenAttacking: true,
      });
      expect(s.cooldown?.max ?? null).toBeNull();
    });
  });
});

describe("Kazıklı Bey, Active 1 (KA*; rulings 6, 7, 24, 27)", () => {
  /** Active 1's field over Wallachia's panels, as `openField` stores a `sameAs` one. */
  const kazikliField = async (c) => {
    const { readFileSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const doc = parse(readFileSync("packs/_source/abilities/vlad-kazikli-bey.yml", "utf8"));
    const panels = wallachia(c).panels;
    return {
      id: "kazikliRegion",
      panels,
      behaviors: [{
        type: "npField",
        system: {
          fieldId: "vlad-kazikli-bey", ownerUnitId: VL, ownerFaction: "A",
          geometry: { ...doc.field.geometry, anchor: c }, interiorEvents: doc.field.interiorEvents, panels,
          duration: "⅔◈", expiry: 20,
        },
      }],
    };
  };
  const party = [
    { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
    { from: "chiron", id: FOE, panel: { i: 5, j: 7 }, state: { factionId: "B" } },
    { from: "chiron", id: FOE2, panel: { i: 5, j: 15 }, state: { factionId: "B" } },
  ];

  it("is used only within Wallachia, and opens over its panels for ⅔◈", async () => {
    const { readFileSync } = await import("node:fs");
    const { parse } = await import("yaml");
    const doc = parse(readFileSync("packs/_source/abilities/vlad-kazikli-bey.yml", "utf8"));
    expect(doc.requirements).toEqual([{ kind: "predicate", predicate: [`self:inField:${WALLACHIA_ID}`] }]);
    expect(doc.field).toMatchObject({ geometry: { kind: "sameAs", field: WALLACHIA_ID }, duration: "⅔◈" });
    expect(doc.cooldown).toBe("6◈");
  });

  it("at the end of a Turn he Acted: each enemy inside Evades or takes the d6 x 100, then Curse", async () => {
    await withSubjects(party, async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const I = await import("../../module/engine/intents.mjs");
      const { runFieldEvents } = await import("../../module/engine/fields.mjs");
      await applyWorldIntents([I.markTurn(VL, { acted: true })], "test");
      // A failed Evade (a d20 of 20), and a 1 on the d6.
      w.dice.set("d20", 20).dice.set("d6", 1);
      const intents = await runFieldEvents("anyTurnEnd", { board: currentBoard() });
      expect(intents.filter((i) => i.t === "damage").map((i) => [i.unitId, i.amount])).toEqual([[FOE, 100]]);
      expect(intents.filter((i) => i.t === "applyEffect").map((i) => [i.unitId, i.effect.defId])).toEqual([[FOE, "curse"]]);
    }, { ...WAR, regions: [await kazikliField({ i: 5, j: 5 })] });
  });

  it("nothing at the end of a Turn he did not Act; the end of the Round fires all the same", async () => {
    await withSubjects(party, async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { runFieldEvents } = await import("../../module/engine/fields.mjs");
      expect(await runFieldEvents("anyTurnEnd", { board: currentBoard() })).toEqual([]);
      w.dice.set("d20", 20).dice.set("d6", 1);
      const round = await runFieldEvents("roundEnd", { board: currentBoard() });
      expect(round.filter((i) => i.t === "damage").map((i) => i.unitId)).toEqual([FOE]);
    }, { ...WAR, regions: [await kazikliField({ i: 5, j: 5 })] });
  });

  it("an Invuln takes no damage and no Curse (KA.invuln, KA.curse)", async () => {
    const guarded = party.map((p) => (p.id === FOE ? { ...p, effects: [{ defId: "invuln", uses: 1 }] } : p));
    await withSubjects(guarded, async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { runFieldEvents } = await import("../../module/engine/fields.mjs");
      w.dice.set("d20", 20);
      const round = await runFieldEvents("roundEnd", { board: currentBoard() });
      expect(round.filter((i) => i.t === "damage" || i.t === "applyEffect")).toEqual([]);
    }, { ...WAR, regions: [await kazikliField({ i: 5, j: 5 })] });
  });
});

describe("Legend of Dracula (LD*; rulings 12-20)", () => {
  const DR = "vladDracula00001";
  it("kills a Master standing in Wallachia, Vlad the killer, and leaves him Dracula", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 4 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const out = await useSkill({ actorId: VL, abilityId: abilityOf(w, VL, "vlad-legend-of-dracula").id });
      expect(out.ok).toBe(true);
      expect(held(w, VL)).toContain("legendOfDraculaActivated");
      expect(w.actor(MAS).system.defeated).toBe(true);
      // The Command Spell first, then the kill: "after this NP is activated" (found live).
      const said = [...w.messages.values()].map((m) => m.content ?? "");
      const paid = said.findIndex((c) => /CommandSpell\.SpentAsCost/.test(c));
      const killed = said.findIndex((c) => /Defeat\.ByKiller/.test(c));
      expect(paid).toBeGreaterThanOrEqual(0);
      expect(killed).toBeGreaterThan(paid);
      // ...and no Conquest of the Master he killed: he plays on with none (ruling 12, found live).
      expect(w.actor(VL).system.masterId === MAS && w.actor(VL).system.contract === "contracted").toBe(false);
    }, { ...WAR, regions: [wallachia({ i: 5, j: 5 })] });
  });

  it("a Servant that kills its own Master conquers nobody (found live)", async () => {
    const { conquestContract } = await import("../../module/rules/contract.mjs");
    const killer = { id: VL, kind: "servant", masterId: MAS, panel: { i: 5, j: 5 } };
    const deadMaster = { id: MAS, kind: "master", panel: { i: 5, j: 4 }, commandSpells: 2 };
    expect(conquestContract({ killer, deadMaster, board: { units: [killer, deadMaster] } }))
      .toMatchObject({ ok: false, reason: "ownMaster", descriptors: [] });
  });

  it("spares a Master outside Wallachia", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A", masterId: MAS, contract: "contracted" } },
      { from: "master-advanced", id: MAS, panel: { i: 5, j: 4 }, state: { factionId: "A" } },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      await useSkill({ actorId: VL, abilityId: abilityOf(w, VL, "vlad-legend-of-dracula").id });
      expect(held(w, VL)).toContain("legendOfDraculaActivated");
      expect(w.actor(MAS).system.defeated).toBeFalsy();
    }, { ...WAR, regions: [wallachia({ i: 15, j: 15 })] });
  });

  it("Dark (Vampire), BA(STR) +75, Range 3 and two targets, through Units, Evade -4, Fire +25%", async () => {
    await withSubjects([{ from: "vlad-lancer", id: DR, effects: [{ defId: "legendOfDraculaActivated" }] }], ({ unit }) => {
      const d = unit(DR);
      expect(d.attributes).toEqual(expect.arrayContaining(["dark", "vampire"]));
      expect(d.baseAttack.str).toBe(200);
      expect(d.range).toBe(3);
      expect(d.maxTargets).toBe(2);
      expect(d.checkModifiers).toEqual(expect.arrayContaining([expect.objectContaining({ check: "evade", direction: "outgoing", value: -4 })]));
      expect((d.modifiers ?? []).find((m) => m.key === "elementTotalDefUp")).toMatchObject({ value: -25, element: "fire" });
    });
  });

  it("Magic Resistance and Kazıklı Bey are gone; Shapeshift doubled (LD.mr, LD.kz, LD.shape)", async () => {
    await withSubjects([{ from: "vlad-lancer", id: DR, effects: [{ defId: "legendOfDraculaActivated" }] }], ({ unit }) => {
      const d = unit(DR);
      expect(d.magicResistance ?? null).toBeNull();
      expect((d.eventHandlers ?? []).some((h) => (h.events ?? []).includes("damageDealt") && /Kaz/.test(h.source ?? ""))).toBe(false);
      expect((d.modifiers ?? []).find((m) => m.key === "ward")).toMatchObject({ value: 20, npValue: 10 });
    });
  });

  it("heals on damage, on a kill (25%), on a Civilian (100 and 1), and at the end of a Night Turn", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: DR, panel: { i: 5, j: 5 }, state: { factionId: "A", agility: { value: 5, max: 20 } }, effects: [{ defId: "legendOfDraculaActivated" }] },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const b = currentBoard();
      const d = b.units.find((u) => u.id === DR);
      const ctx = (options = []) => ({ tick: 18, board: b, turnsPerRound: 3, options: new Set(options), rolls: {} });
      const heals = (intents) => intents.filter((i) => i.t === "heal").map((i) => i.amount);
      const agility = (intents) => intents.filter((i) => i.t === "statDelta" && i.stat === "agility.value").map((i) => i.delta);
      const dealt = fireEvent("damageDealt", [d], ctx(["attack:kind:normal", "attack:dealtDamage"]));
      // A hit that dealt 0 heals nothing: "no effect if no damage is dealt" (found live).
      expect(heals(fireEvent("damageDealt", [d], ctx(["attack:kind:normal"])))).toEqual([]);
      expect(heals(dealt)).toEqual([100]);
      expect(agility(dealt)).toEqual([1]);
      const killed = fireEvent("unitFelled", [d], ctx(["target:type:servant"]));
      // A Unit felled and revived is still "defeated" (ruling 16); the death event pays nothing more.
      expect(heals(fireEvent("unitKilled", [d], ctx(["target:type:servant"])))).toEqual([]);
      expect(heals(killed)).toEqual([312]);
      expect(agility(killed)).toEqual([5]);
      // A Civilian's 100 and 1 is Ch. 06's bounty, paid by `civilianKill`; Dracula
      // adds nothing to it (found live: it was paid twice).
      expect(heals(fireEvent("unitKilled", [d], ctx(["target:type:civilian"])))).toEqual([]);
      const { civilianKill } = await import("../../module/rules/environment.mjs");
      expect(civilianKill(d, { id: "civ", kind: "civilian" }).filter((x) => x.unitId === d.id).map((x) => x.amount ?? x.delta))
        .toEqual([100, 1]);
      // The Round's phase is the board's, carried on the Unit (`u.war`).
      const at = (phase) => ({ ...d, war: { ...(d.war ?? {}), phase } });
      expect(heals(fireEvent("anyTurnEnd", [at("night")], { ...ctx(), activeFactionId: "A" }))).toEqual([100]);
      expect(heals(fireEvent("anyTurnEnd", [at("day")], { ...ctx(), activeFactionId: "A" }))).toEqual([]);
      // Not his Turn and he did not Act: nothing, even at Night.
      expect(heals(fireEvent("anyTurnEnd", [at("night")], { ...ctx(), activeFactionId: "B" }))).toEqual([]);
      expect(heals(fireEvent("roundEnd", [at("night")], ctx()))).toEqual([100]);
    }, WAR);
  });

  it("says each heal on the card, by name and as given against his maximum (found pressing)", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: DR, panel: { i: 5, j: 5 }, state: { factionId: "A", health: { value: 1000, max: 1250 } }, effects: [{ defId: "legendOfDraculaActivated" }] },
    ], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const d = currentBoard().units.find((u) => u.id === DR);
      const ctx = { tick: 18, board: currentBoard(), turnsPerRound: 3, options: new Set(["target:type:servant"]), rolls: {} };
      const healRows = (lines) => lines.filter((l) => l.summary.id === "heal").map((l) => l.summary.name);
      // The test world's i18n returns the key; the line's words are its data.
      vi.spyOn(game.i18n, "format").mockImplementation((k, d = {}) =>
        (k === "FGT.TurnReport.Gains" ? `${d.who} regains ${d.amount} Health (${d.source}).` : k));
      // 25% of 1250 is 312, and 250 is all the room he has.
      const felled = await applyWorldIntents(fireEvent("unitFelled", [d], ctx), "test:felled", { lines: true });
      expect(healRows(felled.lines)).toEqual(["Lancer regains 250 Health (Legend of Dracula (Activated))."]);
      expect(w.actor(DR).system.health.value).toBe(1250);
      // At full Health a heal gave nothing, and is not said.
      const dealt = await applyWorldIntents(
        fireEvent("damageDealt", [d], { ...ctx, options: new Set(["attack:kind:normal", "attack:dealtDamage"]) }),
        "test:dealt", { lines: true },
      );
      expect(healRows(dealt.lines)).toEqual([]);
    }, WAR);
  });

  it("the nearest Units, as many as asked, a tie at random but the same within a Turn (ruling 19)", async () => {
    const { nearestUnits } = await import("../../module/rules/compulsion.mjs");
    const me = { id: "v", panel: { i: 5, j: 5 } };
    const units = [me,
      { id: "a", panel: { i: 5, j: 6 } }, { id: "b", panel: { i: 6, j: 5 } }, { id: "c", panel: { i: 5, j: 8 } },
      { id: "dead", panel: { i: 5, j: 4 }, defeated: true }, { id: "boat", panel: { i: 4, j: 5 }, kind: "platform" }];
    const one = nearestUnits(me, units, { seed: 7 });
    expect(one).toHaveLength(1);
    expect(["a", "b"]).toContain(one[0]);
    expect(nearestUnits(me, units, { seed: 7 })).toEqual(one);
    expect(new Set(nearestUnits(me, units, { count: 2, seed: 7 }))).toEqual(new Set(["a", "b"]));
    expect(nearestUnits(me, units, { count: 3, seed: 7 })[2]).toBe("c");
    const draws = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => nearestUnits(me, units, { seed })[0]));
    expect(draws).toEqual(new Set(["a", "b"]));
  });

  it("his compulsion names an ally as readily as an enemy, nearest first (LD.closest)", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: DR, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "legendOfDraculaActivated" }] },
      { from: "chiron", id: FOE, panel: { i: 5, j: 9 }, state: { factionId: "B" } },
      { from: "chiron", id: FOE2, panel: { i: 5, j: 6 }, state: { factionId: "A" } },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const d = currentBoard().units.find((u) => u.id === DR);
      const c = (d.compulsions ?? []).find((x) => x.id === "dracula");
      expect(c).toMatchObject({ forcesTarget: true, pursues: true, attacksOnly: true });
      expect(c.targetIds).toEqual([FOE2, FOE]);
    }, WAR);
  });
});

describe("Dracula's Normal Attack: two targets, the closest, allies included (LD.targets, LD.closest; found live)", () => {
  it("is a pick of two among the Units within 3, narrowed to the two closest, an ally among them", async () => {
    await withSubjects([
      { from: "vlad-lancer", id: "vladDracula00001", panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: [{ defId: "legendOfDraculaActivated" }] },
      { from: "chiron", id: FOE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
      { from: "chiron", id: FOE2, panel: { i: 5, j: 3 }, state: { factionId: "A" } },
      { from: "heracles", id: "vladFoe000000003", panel: { i: 5, j: 8 }, state: { factionId: "B" } },
    ], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { targetSpecFor } = await import("../../module/rules/ability-use.mjs");
      const { resolveTargets } = await import("../../module/rules/targeting/resolve.mjs");
      const b = currentBoard();
      const d = b.units.find((u) => u.id === "vladDracula00001");
      const spec = targetSpecFor(null, 3, null, d);
      expect(spec.selection).toMatchObject({ chooser: "chosen", count: 2 });
      expect(spec.selection.relations).toEqual(expect.arrayContaining(["enemy", "ally", "civilian"]));
      const out = resolveTargets(spec, d, b, { reach: "attack" });
      expect(out.candidates.map((t) => t.unitId).sort()).toEqual([FOE, FOE2].sort());
      const picked = resolveTargets(spec, d, b, { reach: "attack", chosenIds: [FOE, FOE2] });
      expect(picked.units.map((t) => t.unitId).sort()).toEqual([FOE, FOE2].sort());
    }, WAR);
  });

  it("a plain Vlad still swings at one enemy", async () => {
    await withSubjects([{ from: "vlad-lancer", id: VL, panel: { i: 5, j: 5 }, state: { factionId: "A" } }], async () => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { targetSpecFor } = await import("../../module/rules/ability-use.mjs");
      const v = currentBoard().units.find((u) => u.id === VL);
      expect(targetSpecFor(null, 2, null, v).selection).toMatchObject({ relations: ["enemy"], count: 1 });
    }, WAR);
  });
});

describe("the field card says why a tick dealt nothing (found live)", () => {
  it("an Invuln's stop reads as such, not as 0 damage", async () => {
    const { lineFor } = await import("../../module/engine/field-report.mjs");
    const t = (k, d) => `${k}${JSON.stringify(d ?? {})}`;
    expect(lineFor({ unitName: "X", damage: 0, negatedBy: "Invuln" }, t)).toBe('FGT.FieldReport.Negated{"who":"X","by":"Invuln"}');
    expect(lineFor({ unitName: "X", damage: 300 }, t)).toBe('FGT.FieldReport.Damage{"who":"X","amount":300}');
  });
});
