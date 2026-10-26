/**
 * @file Vlad III (Berserker), the audit of #333: his sheet through the real
 * projection.
 * @see docs/superpowers/specs/2026-10-24-vlad-berserker-clauses.md
 *
 * Every subject is `packs/_source/servants/vlad-berserker.yml` as authored,
 * compiled and kept by the DataModel (`test/helpers/subject.mjs`).
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill } from "../helpers/process.mjs";
import { phaseChance } from "../../module/rules/phase-chance.mjs";
import { durationChanges } from "../../module/rules/effect-duration.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const VB = "vladBerserker001", FOE = "vladBFoe00000001";
// Round 6, the NP gate open, a Turn of faction A. The opening flip was Day, so
// an even Round is Night.
const war = (round = 6) => ({
  tokens: true,
  combat: { round, started: true, system: { globalTurn: round * 3, npGateRound: 1, phase: "day" }, actingFactionId: "A" },
});
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectOf = (w, id, defId) => [...w.actor(id).effects].find((e) => e.system?.defId === defId);
const vlad = (extra = {}) => ({ from: "vlad-berserker", id: VB, panel: { i: 5, j: 5 }, state: { factionId: "A" }, ...extra });
const foeAt = (panel) => ({ from: "vlad-lancer", id: FOE, panel, state: { factionId: "B" } });
/**
 * The sum of a Unit's projected modifiers of one key, from his own Skills and
 * effects: a Dark Unit's Day or Night Round rows are the environment's (Ch. 29).
 */
const sumOf = (u, key, np = false) => (u.modifiers ?? [])
  .filter((m) => m.key === key && !/^(Day|Night) Round$/.test(m.source ?? ""))
  .reduce((s, m) => s + Number((np ? (m.npValue ?? m.value) : m.value) ?? 0), 0);

describe("the sheet (ST*)", () => {
  it("is Vlad III, a Chaotic Evil Berserker from Romania, every figure the sheet's", async () => {
    await withSubjects([vlad()], ({ world: w, unit }) => {
      const v = unit(VB);
      const s = w.actor(VB).system;
      expect(w.actor(VB).name).toBe("Vlad III (Berserker)");
      expect(s.trueName).toBe("Vlad III");
      expect([...s.servantClasses]).toEqual(["berserker"]);
      expect(s.alignment).toMatchObject({ order: "chaotic", morality: "evil" });
      expect([...s.region]).toEqual(["romania", "europe"]);
      // LD.dark: Dark (Vampire) is his, as the statblock prints it.
      expect(v.attributes).toEqual(expect.arrayContaining(["male", "servant", "earth", "king", "dark", "vampire", "humanoid", "antiHero"]));
      expect(s.parameters).toMatchObject({ str: "A", end: "A", agi: "C", mag: "B", luc: "E" });
      expect(v.baseAttack).toEqual(expect.objectContaining({ str: 150, mag: 175 }));
      expect(v.mov).toBe(4);
      expect(v.range).toBe(2);
      expect(v.maxTargets).toBe(1);
      expect(s.sustainability).toBe("2◈");
    });
  });

  it("swings BA(STR) at every Range (ST.na, #330 ruling 2)", async () => {
    const { normalAttackAt } = await import("../../module/rules/normal-attack.mjs");
    await withSubjects([vlad()], ({ unit }) => {
      expect(normalAttackAt(unit(VB), 1).component).toBe("str");
      expect(normalAttackAt(unit(VB), 2).component).toBe("str");
    });
  });
});

describe("Mad Enhancement EX (ME*)", () => {
  it("is the Revised text at EX: the forced deactivation at 30, no floor", async () => {
    await withSubjects([vlad()], ({ world: w }) => {
      const me = abilityOf(w, VB, "class-mad-enhancement").system;
      expect(me.rank).toBe("EX");
      expect(me.printedRevision).toBe("revised");
      const drain = JSON.stringify(me.activeRules);
      expect(drain).toMatch(/"key":"SetMode"/);
      expect(drain).not.toMatch(/"floorTable":"madEnhancementDrain"/);
    });
  });

  it("while Active: damage taken -75% (NP 30%), dealt +100%, MOV +2, Range +1", async () => {
    await withSubjects([vlad()], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      await abilityOf(w, VB, "class-mad-enhancement").update({ "system.active": true });
      const v = currentBoard().units.find((u) => u.id === VB);
      expect(v.mov).toBe(6);
      expect(v.range).toBe(3);
      // Shapeshift's Passive 1 is a Ward, not a Def Up: the 75 is Mad Enhancement's own.
      expect(sumOf(v, "defUp")).toBe(75);
      expect(sumOf(v, "defUp", true)).toBe(30);
      // +100%, halved for an Attack whose base is BA(MAG) (ME.atkmag).
      expect((v.modifiers ?? []).filter((m) => m.key === "atkUp" && m.source === "Mad Enhancement").map((m) => [m.value, m.predicate]))
        .toEqual([[100, ["not:attack:usesBase:mag"]], [50, ["attack:usesBase:mag"]]]);
    }, war());
  });
});

describe("his Master falls while Mad Enhancement is Active (ME.master, found pressing)", () => {
  it("holds every mode as it was until a new Contract, and the Contract frees them", async () => {
    const { canToggleMode } = await import("../../module/rules/modes.mjs");
    await withSubjects([vlad({ state: { factionId: "A", modesLocked: true } })], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const { worldIO } = await import("../../module/engine/io.mjs");
      const me = abilityOf(w, VB, "class-mad-enhancement");
      const v = () => currentBoard().units.find((u) => u.id === VB);
      expect(v().modesLocked).toBe(true);
      expect(canToggleMode({ system: { ...me.system, active: true } }, v(), { active: false, ownTurn: true, tick: 30 }))
        .toMatchObject({ ok: false, reason: "modesLocked" });
      expect(canToggleMode(me, v(), { active: true, ownTurn: true, tick: 30 })).toMatchObject({ ok: false, reason: "modesLocked" });
      await worldIO().setContract(VB, "contracted", "vladBMaster00001");
      expect(w.actor(VB).system.modesLocked).toBe(false);
      expect(canToggleMode(me, v(), { active: true, ownTurn: true, tick: 30 })).toMatchObject({ ok: true });
    }, war());
  });
});

describe("Bloodsucking A (BS*)", () => {
  const spec = (w) => abilityOf(w, VB, "vlad-berserker-bloodsucking").system.targeting;

  it("reaches 1, and 2 under Mad Enhancement, not 3 (rulings 4)", async () => {
    const { resolveTargets } = await import("../../module/rules/targeting/resolve.mjs");
    await withSubjects([vlad(), foeAt({ i: 5, j: 7 })], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const at = () => {
        const b = currentBoard();
        const caster = b.units.find((u) => u.id === VB);
        return resolveTargets(spec(w), caster, b, { unitId: FOE, chosenIds: [FOE] });
      };
      expect(at().errors.join(" ")).toMatch(/out of Range \(1\)/);
      await abilityOf(w, VB, "class-mad-enhancement").update({ "system.active": true });
      expect(at().errors).toEqual([]);
      expect(at().units.map((u) => u.unitId)).toEqual([FOE]);
    }, war());
  });

  it("is 100%, 80% under Mad Enhancement (BS.mechance)", () => {
    const chance = { value: 100, label: "Bloodsucking", modifiers: [{ add: -20, predicate: ["self:skillActive:madEnhancement"] }] };
    expect(phaseChance(chance, 0, new Set())).toBe(100);
    expect(phaseChance(chance, 0, new Set(["self:skillActive:madEnhancement"]))).toBe(80);
  });

  it("puts 1◈ on the DU's NP clock, even from 0, and takes 1◈ off his, the die on the card", async () => {
    await withSubjects([vlad(), foeAt({ i: 5, j: 6 })], async ({ world: w }) => {
      const kb = abilityOf(w, FOE, "vlad-kazikli-bey");
      const own = abilityOf(w, VB, "vlad-berserker-kazikli-bey");
      await own.update({ "system.cooldown.remaining": 9 });
      const out = await castSkill(w, { caster: VB, ability: abilityOf(w, VB, "vlad-berserker-bloodsucking").id, placement: { unitId: FOE, chosenIds: [FOE] } });
      expect(out.ok, out.reason).toBe(true);
      expect(kb.system.cooldown.remaining).toBe(3);
      expect(own.system.cooldown.remaining).toBe(6);
      const chance = (out.applied ?? out.results ?? []).map((r) => r.summary ?? r).find((s) => s.id === "chance");
      // The d100 against 100 is on the card, whichever way it fell.
      expect(chance).toMatchObject({ id: "chance", outcome: "applied" });
    }, war());
  });
});

describe("Fearsome Immortal A+ (FI*, RV.order)", () => {
  it("Guts (Fearsome) ⅓◈ and Guts 1◈+⅔◈ at 20%, NP Regen 1 for 1◈; Fearsome consumed first", async () => {
    await withSubjects([vlad()], async ({ world: w }) => {
      const { currentBoard, currentMoment } = await import("../../module/engine/board.mjs");
      const out = await castSkill(w, { caster: VB, ability: abilityOf(w, VB, "vlad-berserker-fearsome-immortal").id });
      expect(out.ok, out.reason).toBe(true);
      const now = currentMoment().tick;
      expect(effectOf(w, VB, "gutsFearsome").system).toMatchObject({ magnitude: 20, expiry: now + 1 });
      expect(effectOf(w, VB, "guts").system).toMatchObject({ magnitude: 20, expiry: now + 5 });
      expect(effectOf(w, VB, "npRegen").system).toMatchObject({ magnitude: 1, expiry: now + 3 });
      const v = currentBoard().units.find((u) => u.id === VB);
      const order = [...(v.revivals ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map((r) => r.id);
      expect(order).toEqual(["gutsFearsome", "guts", "battleContinuation"]);
    }, war());
  });
});

describe("a revival held back says why (BC.cd, BC.half; ruled 2026-10-24)", () => {
  it("names its Cooldown, then its Health rule, of the source otherwise there", async () => {
    const { heldRevivals, availableRevivals } = await import("../../module/rules/revival.mjs");
    const { revivalCard } = await import("../../module/engine/revival-report.mjs");
    await withSubjects([vlad({ state: { factionId: "A", health: { value: 200, max: 1500 } } })], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const bc = abilityOf(w, VB, "class-battle-continuation");
      const v = () => currentBoard().units.find((u) => u.id === VB);
      expect(heldRevivals(v())).toEqual([]);
      await bc.update({ "system.cooldown.remaining": 4, "system.lastUsedTick": 15 });
      expect(heldRevivals(v()).map(({ source, why, remaining }) => [source.id, why, remaining])).toEqual([["battleContinuation", "cooldown", 4]]);
      expect(availableRevivals(v()).map((r) => r.id)).not.toContain("battleContinuation");
      await bc.update({ "system.cooldown.remaining": 0 });
      expect(heldRevivals(v()).map(({ why, fraction }) => [why, fraction])).toEqual([["healthNotRestored", 0.5]]);
      const t = (k, d) => `${k} ${JSON.stringify(d)}`;
      expect(revivalCard({ kind: "revivalHeld", unitId: VB, source: "Battle Continuation", why: "healthNotRestored", percent: 50 }, () => "Berserker", (x) => x, t))
        .toMatch(/FGT\.Revival\.HeldHealth .*"percent":50/);
    }, war());
  });

  it("is logged at the defeat that took no revival, and posted as a revival card is", async () => {
    const { readFileSync } = await import("node:fs");
    const io = readFileSync("module/engine/io.mjs", "utf8");
    // A named marker, not the line (`source-scan-pins-text`).
    expect(io).toMatch(/fgt-scan: revival-cards[\s\S]{0,400}"revivalHeld"/);
    const sched = readFileSync("module/engine/scheduler.mjs", "utf8");
    expect(sched).toMatch(/kind: "revivalHeld", unitId: unit\.id, source: source\.source, why/);
  });
});

describe("a mode its player switches is said to the table (ruled 2026-10-24)", () => {
  it("posts after the switch is written, unless a priced entry's own card says it", async () => {
    const { readFileSync } = await import("node:fs");
    const { functionBody } = await import("../helpers/source.mjs");
    const sheet = readFileSync("module/apps/actor-sheet/sheet.mjs", "utf8");
    const toggle = functionBody(sheet, "static async toggleMode(") || sheet.slice(sheet.indexOf("static async toggleMode("), sheet.indexOf("static async sayModeSwitch("));
    const write = toggle.indexOf("item.update(modeSwitchPatch(active");
    const say = toggle.indexOf("FGTActorSheet.sayModeSwitch(actor, item, active)");
    expect(write).toBeGreaterThan(-1);
    expect(say).toBeGreaterThan(write);
    expect(toggle).toMatch(/if \(!\(active && pricedOnEntry\(item\)\)\) await FGTActorSheet\.sayModeSwitch/);
    expect(sheet).toMatch(/FGT\.Mode\.SwitchedOn" : "FGT\.Mode\.SwitchedOff"/);
    // By the Unit's public name, never the player's own character (found pressing).
    expect(sheet).toMatch(/speaker: publicSpeakerFor\(actor, board\) \}\);/);
  });
});

describe("Shapeshift C (SS*)", () => {
  it("cuts damage taken 10%, 5% against an NP; 20/10 while Dracula", async () => {
    await withSubjects([vlad(), { ...vlad({ id: "vladBDracula0001" }), effects: [{ defId: "dracula", expiry: 99 }] }], ({ unit }) => {
      const wards = (u) => JSON.stringify((u.modifiers ?? []).filter((m) => m.key === "ward" || m.modifierKey === "ward"));
      expect(wards(unit(VB))).toMatch(/"value":10/);
      expect(wards(unit("vladBDracula0001"))).toMatch(/"value":20/);
    });
  });

  it("is offered on his Turn and at the start of a Combat Process he is Attacked in", async () => {
    const { windowsOf } = await import("../../module/rules/windows.mjs");
    await withSubjects([vlad()], ({ world: w }) => {
      expect(windowsOf(abilityOf(w, VB, "vlad-berserker-shapeshift").system.timing)).toEqual(["ownTurn", "defendingPhaseStart"]);
    });
  });

  it("applies Def Up (Shapeshift) 10/5 for 1◈, and never a second (SS.nostack)", async () => {
    await withSubjects([vlad()], async ({ world: w }) => {
      const { currentMoment } = await import("../../module/engine/board.mjs");
      await castSkill(w, { caster: VB, ability: abilityOf(w, VB, "vlad-berserker-shapeshift").id });
      expect(effectOf(w, VB, "defUpShapeshift").system).toMatchObject({ magnitude: 10, npMagnitude: 5, expiry: currentMoment().tick + 3 });
    }, war());
  });

  it("resets a held Def Up (Shapeshift) and Atk Up (Shapeshift) to exactly 1◈, more left or less (ruling 5)", async () => {
    const tick = 18;
    await withSubjects([vlad({ effects: [
      { defId: "defUpShapeshift", magnitude: 10, npMagnitude: 5, expiry: tick + 1 },
      { defId: "atkUpShapeshift", magnitude: 10, npMagnitude: 5, expiry: tick + 6 },
    ] })], async ({ world: w }) => {
      const { currentMoment } = await import("../../module/engine/board.mjs");
      const now = currentMoment().tick;
      const out = await castSkill(w, { caster: VB, ability: abilityOf(w, VB, "vlad-berserker-shapeshift").id });
      expect(out.ok, out.reason).toBe(true);
      expect(effectOf(w, VB, "defUpShapeshift").system.expiry).toBe(now + 3);
      expect(effectOf(w, VB, "atkUpShapeshift").system.expiry).toBe(now + 3);
      expect([...w.actor(VB).effects].filter((e) => e.system.defId === "defUpShapeshift")).toHaveLength(1);
    }, war());
  });
});

describe("the duration phase (SS.reset, LD.extend)", () => {
  const held = [{ id: "a", defId: "defUpShapeshift", expiry: 20 }, { id: "b", defId: "atkUpShapeshift", expiry: 25 }, { id: "c", defId: "curse", expiry: null }];
  it("sets each named instance to now + the span, and says the Turns left before and after", () => {
    const changes = durationChanges({ effects: ["defUpShapeshift", "atkUpShapeshift"], set: "1◈" }, held, { tick: 18, turnsPerRound: 3 });
    expect(changes).toEqual([
      { defId: "defUpShapeshift", instanceId: "a", delta: 1, before: 2, after: 3 },
      { defId: "atkUpShapeshift", instanceId: "b", delta: -4, before: 7, after: 3 },
    ]);
  });
  it("extends by the span, and moves nothing it does not hold or that has no clock", () => {
    expect(durationChanges({ effects: ["atkUpShapeshift", "curse", "guts"], extend: "1◈" }, held, { tick: 18, turnsPerRound: 3 }))
      .toEqual([{ defId: "atkUpShapeshift", instanceId: "b", delta: 3, before: 7, after: 10 }]);
  });
});

describe("Kazıklı Bey: Bloodstained King Demon B+ (KZ*)", () => {
  it("Range 3, BA(STR), 3.5x + 100; Curse and Def Dwn (A) on the DU; S.Crit Up on himself after a hit", async () => {
    await withSubjects([vlad()], ({ world: w }) => {
      const np = abilityOf(w, VB, "vlad-berserker-kazikli-bey").system;
      expect(np.targeting.anchor).toMatchObject({ kind: "targetUnit", range: 3 });
      expect(np.damage).toMatchObject({ multiplier: 3.5, flatBonus: 100, component: "str" });
      expect(np.phases[0].effects).toEqual([{ id: "curse" }, { id: "defDwnA", magnitude: 20, duration: "1◈" }]);
      expect(np.phases[1]).toMatchObject({ when: "afterDamage", target: "self", effects: [{ id: "sCritUp", magnitude: 10, duration: "⅓◈" }] });
      expect(np.cooldown.max).toBe("6◈+⅓◈");
    });
  });
});

describe("Legend of Dracula A+ (LD*)", () => {
  const use = (w) => castSkill(w, { caster: VB, ability: abilityOf(w, VB, "vlad-berserker-legend-of-dracula").id });

  it("at Night: extends the held Shapeshift buffs by 1◈, gains Dracula for 1◈, Atk Up (Shapeshift) never shortened", async () => {
    const tick = 18;
    await withSubjects([vlad({ effects: [{ defId: "atkUpShapeshift", magnitude: 10, npMagnitude: 5, expiry: tick + 2 }] })], async ({ world: w, }) => {
      const { currentMoment, currentBoard } = await import("../../module/engine/board.mjs");
      expect(currentBoard().phase).toBe("night");
      const now = currentMoment().tick;
      const before = effectOf(w, VB, "atkUpShapeshift").system.expiry;
      const out = await use(w);
      expect(out.ok, out.reason).toBe(true);
      expect(effectOf(w, VB, "atkUpShapeshift").system.expiry).toBe(before + 3);
      expect(effectOf(w, VB, "dracula").system.expiry).toBe(now + 3);
      expect([...w.actor(VB).effects].filter((e) => e.system.defId === "atkUpShapeshift")).toHaveLength(1);
    }, war(6));
  });

  it("by Day: no Dracula, said on the card; Atk Up (Shapeshift) all the same", async () => {
    await withSubjects([vlad()], async ({ world: w }) => {
      const { currentBoard } = await import("../../module/engine/board.mjs");
      expect(currentBoard().phase).toBe("day");
      const out = await use(w);
      expect(out.ok, out.reason).toBe(true);
      expect(effectOf(w, VB, "dracula")).toBeUndefined();
      expect(effectOf(w, VB, "atkUpShapeshift").system).toMatchObject({ magnitude: 10, npMagnitude: 5 });
      expect(out.applied.find((a) => a.summary?.id === "unmet")?.summary)
        .toMatchObject({ name: "FGT.Vlad.NoDraculaByDay", outcome: "blocked" });
    }, war(5));
  });

  it("Dracula doubles a held Def Up (Shapeshift) and Atk Up (Shapeshift) live, and leaves plain Def Up alone", async () => {
    const buffs = [
      { defId: "defUpShapeshift", magnitude: 10, npMagnitude: 5, expiry: 99 },
      { defId: "atkUpShapeshift", magnitude: 10, npMagnitude: 5, expiry: 99 },
      { defId: "defUp", magnitude: 7, npMagnitude: 7, expiry: 99 },
    ];
    await withSubjects([
      vlad({ effects: buffs }),
      vlad({ id: "vladBDracula0001", effects: [...buffs, { defId: "dracula", expiry: 99 }] }),
    ], ({ unit }) => {
      expect(sumOf(unit(VB), "defUp")).toBe(17);
      expect(sumOf(unit(VB), "atkUp")).toBe(10);
      expect(sumOf(unit("vladBDracula0001"), "defUp")).toBe(27);
      expect(sumOf(unit("vladBDracula0001"), "defUp", true)).toBe(17);
      expect(sumOf(unit("vladBDracula0001"), "atkUp")).toBe(20);
    });
  });

  it("Dracula is a status, Unremovable, and is taken off at any Night-to-Day change, never at Day-to-Night", async () => {
    await withSubjects([vlad({ effects: [{ defId: "dracula", expiry: 99 }] })], async ({ unit }) => {
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const { EffectRegistry } = await import("../../module/rules/registry.mjs");
      expect(EffectRegistry.get("dracula")).toMatchObject({ polarity: "status", unremovable: true });
      const ctx = (to) => ({ tick: 18, turnsPerRound: 3, board: { units: [unit(VB)] }, options: new Set([`war:phase:${to}`]), event: { from: to === "day" ? "night" : "day", to, round: 7 } });
      const dawn = fireEvent("phaseChanged", [unit(VB)], ctx("day"));
      expect(dawn.filter((i) => i.t === "removeEffect").map((i) => [i.unitId, i.effectId])).toEqual([[VB, "dracula"]]);
      expect(fireEvent("phaseChanged", [unit(VB)], ctx("night")).filter((i) => i.t === "removeEffect")).toEqual([]);
    }, war(6));
  });

  it("the dawn's removal is said on a card of its own (found pressing)", async () => {
    await withSubjects([vlad({ effects: [{ defId: "dracula", expiry: 99 }] })], async ({ world: w }) => {
      const { announcePhaseChange } = await import("../../module/engine/round-phase.mjs");
      await announcePhaseChange("night", "day", 7);
      expect(effectOf(w, VB, "dracula")).toBeUndefined();
      const card = [...w.messages.values()].map((m) => m.content ?? m.doc?.content ?? "").find((c) => /ChangedTo\.day/.test(c));
      expect(card).toMatch(/Dracula/);
    }, war(6));
  });

  it("Passive: 100 and 1 at the end of a Turn he Acted at Night; per Unit damaged; 25% per non-Civilian kill", async () => {
    await withSubjects([vlad({ state: { factionId: "A", agility: { value: 5, max: 20 }, health: { value: 1000, max: 1500 } } })], async ({ unit }) => {
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const d = unit(VB);
      const ctx = (options = []) => ({ tick: 18, board: { units: [d] }, turnsPerRound: 3, options: new Set(options), rolls: {} });
      const heals = (intents) => intents.filter((i) => i.t === "heal").map((i) => i.amount);
      const at = (phase) => ({ ...d, war: { ...(d.war ?? {}), phase } });
      expect(heals(fireEvent("actedTurnEnd", [at("night")], ctx()))).toEqual([100]);
      expect(heals(fireEvent("actedTurnEnd", [at("day")], ctx()))).toEqual([]);
      expect(heals(fireEvent("damageDealt", [d], ctx(["attack:kind:normal", "attack:dealtDamage"])))).toEqual([100]);
      expect(heals(fireEvent("damageDealt", [d], ctx(["attack:kind:normal"])))).toEqual([]);
      expect(heals(fireEvent("unitFelled", [d], ctx(["target:type:servant"])))).toEqual([375]);
      expect(heals(fireEvent("unitFelled", [d], ctx(["target:type:civilian"])))).toEqual([]);
    }, war(6));
  });

  it("a boundary's Agility and Luck are said, its Health and clocks left to the report (found pressing)", async () => {
    await withSubjects([vlad({ state: { factionId: "A", agility: { value: 10, max: 16 }, health: { value: 1000, max: 1500 } } })], async () => {
      const { poolsBefore, poolLinesAfter, applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const batch = [
        { t: "statDelta", unitId: VB, stat: "agility.value", delta: 1 },
        { t: "statDelta", unitId: VB, stat: "health.value", delta: -50 },
      ];
      const pools = poolsBefore(batch);
      await applyWorldIntents(batch, "test");
      expect(poolLinesAfter(pools).map((l) => [l.unitId, l.summary.name])).toEqual([[VB, "Agility 10 → 11"]]);
      // A pool already at its maximum is not said.
      const full = poolsBefore([{ t: "statDelta", unitId: VB, stat: "agility.value", delta: 9 }]);
      await applyWorldIntents([{ t: "statDelta", unitId: VB, stat: "agility.value", delta: 9 }], "test");
      const after = poolsBefore([{ t: "statDelta", unitId: VB, stat: "agility.value", delta: 1 }]);
      await applyWorldIntents([{ t: "statDelta", unitId: VB, stat: "agility.value", delta: 1 }], "test");
      expect(poolLinesAfter(full).map((l) => l.summary.name)).toEqual(["Agility 11 → 16"]);
      expect(poolLinesAfter(after)).toEqual([]);
    }, war(6));
  });

  it("is used on his Turn, costs no Master Health, and is a 3◈ Cooldown", async () => {
    await withSubjects([vlad()], ({ world: w }) => {
      const ld = abilityOf(w, VB, "vlad-berserker-legend-of-dracula").system;
      expect(ld.noMasterCost).toBe(true);
      expect(ld.cooldown.max).toBe("3◈");
      expect(ld.timing).toMatchObject({ window: "ownTurn" });
    });
  });
});
