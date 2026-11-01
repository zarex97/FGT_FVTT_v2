/**
 * Gray (Assassin), audit #362: her sheet through the real projection, and the
 * pieces she brought: Hoodie (a named Presence Concealment that starts its own
 * Skill's clock, untouched by Skill Seal), a natural Cooldown tick replaced on
 * some Turns, the Mythos pool's doors, Logos and its lockout, the Mythos debuff
 * (a MAG seal, whole-ability negation, a Rank EX remover), the Chaldea Faction,
 * and an Evade-only non-damaging Combat Process.
 * @see docs/superpowers/specs/2026-10-31-gray-clauses.md
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);
vi.setConfig({ testTimeout: 60_000 });

const GRAY = "gray000000000001";
const WAR = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18, npGateRound: 1, difficulty: "expert" }, actingFactionId: "A" } };
const abilityOf = (w, id, contentId) => w.actor(id).items.find((i) => i.system.contentId === contentId);
const effectsOf = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
const gray = (extra = {}) => ({
  from: "gray", id: GRAY, panel: { i: 6, j: 6 }, ...extra,
  state: { factionId: "A", ...(extra.state ?? {}) },
});
const withMythos = (n) => ({ resources: { mythos: { value: n, max: 40 } } });

describe("the sheet, projected (ST.*)", () => {
  it("Assassin, Lawful Good, England; B C B C C; 1000, MOV 6, Range 3; BA 125/150 by the table; no Sustainability; Mythos 0/40", async () => {
    await withSubjects([gray()], ({ unit, world: w }) => {
      const g = unit(GRAY);
      const s = w.actor(GRAY).system;
      expect(g.servantClasses).toEqual(["assassin"]);
      expect(s.alignment).toMatchObject({ order: "lawful", morality: "good" });
      expect([...s.region]).toEqual(["england"]);
      // Spirit is implied by Servant, and Living Human is printed (reading 2).
      expect(g.attributes).toEqual(expect.arrayContaining(["spirit", "livingHuman", "saberface", "roundTable", "man"]));
      expect(g.mov).toBe(6);
      expect(g.range).toBe(3);
      expect(g.baseAttack).toEqual(expect.objectContaining({ str: 125, mag: 150 }));
      expect(s.sustainability).toBeNull();
      expect(s.resources.mythos).toMatchObject({ value: 0, max: 40 });
    });
  });
});

describe("Face of the King (FK.*)", () => {
  it("lands Hoodie, Presence Concealment at Rank E, named Hoodie on the card and the document", async () => {
    await withSubjects([gray()], async ({ world: w }) => {
      const out = await castSkill(w, { caster: GRAY, ability: abilityOf(w, GRAY, "gray-face-of-the-king").id });
      expect(out.ok, out.reason).toBe(true);
      const [hood] = effectsOf(w, GRAY, "presenceConcealment");
      expect(hood.name).toBe("Hoodie");
      expect(hood.system.params).toMatchObject({ rank: "E", name: "Hoodie", skill: "faceOfTheKing" });
      expect(hood.system.expiry).toBe(18 + 6);
    }, WAR);
  });

  it("is used while Skill Sealed (FK.seal, reading 9)", async () => {
    await withSubjects([gray({ effects: [{ defId: "skillSeal", expiry: 40 }] })], async ({ world: w }) => {
      const out = await castSkill(w, { caster: GRAY, ability: abilityOf(w, GRAY, "gray-face-of-the-king").id });
      expect(out.ok, out.reason).toBe(true);
      // ...and Skill Seal still seals her other Skills.
      const other = await castSkill(w, { caster: GRAY, ability: abilityOf(w, GRAY, "gray-blessings").id });
      expect(other.ok).toBe(false);
    }, WAR);
  });

  it("Hoodie's removal starts Face of the King's own 1◈ (FK.cd); a grant that names no Skill starts none", async () => {
    const { onConcealmentRemoved } = await import("../../module/engine/concealment.mjs");
    await withSubjects([gray()], async ({ world: w }) => {
      const fk = abilityOf(w, GRAY, "gray-face-of-the-king");
      await onConcealmentRemoved(GRAY, "expired", { granted: true, skill: "faceOfTheKing" });
      expect(fk.system.cooldown.remaining).toBe(3);
      await fk.update({ "system.cooldown.remaining": 0 });
      await onConcealmentRemoved(GRAY, "expired", { granted: true, skill: null });
      expect(fk.system.cooldown.remaining).toBe(0);
    }, WAR);
  });
});

describe("King's Reflection's tick (KR.1, reading 5)", () => {
  it("⅓◈ on her side's Turn or a Turn she Acted, once; 1 on any other; NP Lock still wins", async () => {
    const { cooldownRate } = await import("../../module/engine/scheduler.mjs");
    const np = { id: "np", isNP: true, regen: 0 };
    const skill = { id: "sk", isNP: false, regen: 0 };
    const ticks = [{ scope: "np", ticks: "⅓◈", on: ["ownTurn", "acted"] }];
    const unit = (over = {}) => ({ id: "g", faction: "A", naturalTicks: ticks, effects: [], statDeltas: [], ...over });
    const ctx = (active, turnsPerRound = 8) => ({ activeFactionId: active, turnsPerRound, tick: 2 });
    expect(cooldownRate(unit(), np, ctx("A"))).toBe(2);
    expect(cooldownRate(unit({ acted: true }), np, ctx("B"))).toBe(2);
    expect(cooldownRate(unit({ acted: true }), np, ctx("A"))).toBe(2);
    expect(cooldownRate(unit(), np, ctx("B"))).toBe(1);
    expect(cooldownRate(unit(), skill, ctx("A"))).toBe(1);
    expect(cooldownRate(unit({ effects: ["npLock"] }), np, ctx("A"))).toBe(0);
    expect(cooldownRate(unit(), np, ctx("A", 15))).toBe(5);
  });
});

describe("the Mythos debuff (MY.*)", () => {
  it("negates Spells, every NP but Anti-Unit Mystic Sword and Secret Technique, and Divinity whole", async () => {
    const { negatingEffectOf } = await import("../../module/rules/snapshot.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    expect(EffectRegistry.get("mythos")?.negatesAbilities?.length).toBe(3);
    const actor = { effects: [{ disabled: false, system: { defId: "mythos" } }] };
    const item = (system, type = "ability") => ({ type, system });
    expect(negatingEffectOf(item({ isSpell: true }), actor)).toBe("mythos");
    expect(negatingEffectOf(item({ npTags: ["antiArmy"] }, "noblePhantasm"), actor)).toBe("mythos");
    expect(negatingEffectOf(item({ npTags: ["antiUnit", "mysticSword"] }, "noblePhantasm"), actor)).toBeNull();
    expect(negatingEffectOf(item({ npTags: ["antiArmy", "secretTechnique"] }, "noblePhantasm"), actor)).toBe("mythos");
    expect(negatingEffectOf(item({ slug: "divinity" }), actor)).toBe("mythos");
    // A SetField on the document, as Foundry hands it (#362, live: `.includes` threw).
    expect(negatingEffectOf(item({ slug: "goddessesDivineCore", categorizedAs: new Set(["divinity"]) }), actor)).toBe("mythos");
    expect(negatingEffectOf(item({ slug: "faceOfTheKing" }), actor)).toBeNull();
    expect(negatingEffectOf(item({ isSpell: true }), { effects: [] })).toBeNull();
  });

  it("a MAG seal refuses MAG alone and reads a combined Base Attack as its STR part (MY.1, MY.1.both)", async () => {
    const { usesMagOnly, strPartUnderSeal } = await import("../../module/rules/mag-seal.mjs");
    const sealed = { suppressions: [{ scope: "magAttack", source: "Mythos" }] };
    expect(usesMagOnly({ component: "mag" })).toBe(true);
    expect(usesMagOnly({ component: "str" })).toBe(false);
    expect(usesMagOnly({ base: { sources: [{ component: "str" }, { component: "mag" }] }, component: "str" })).toBe(false);
    const both = { sources: [{ unit: "self", component: "str", factor: 1 }, { unit: "self", component: "mag", factor: 1 }] };
    expect(strPartUnderSeal(both, sealed).sources).toEqual([{ unit: "self", component: "str", factor: 1 }]);
    expect(strPartUnderSeal(both, {})).toBe(both);
  });

  it("only a Rank EX remover takes it (MY.4)", async () => {
    const { isUnremovable } = await import("../../module/rules/removal.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    const def = EffectRegistry.get("mythos");
    expect(isUnremovable(def, {}, { by: { rank: "EX" } })).toBe(false);
    expect(isUnremovable(def, {}, { by: { rank: "A+" } })).toBe(true);
    expect(isUnremovable(def, {})).toBe(true);
  });
});

describe("Logos (SM.4.*)", () => {
  it("timed below 30 Counters, permanent at 30, read before the 1d6 (readings 10, 11)", async () => {
    await withSubjects([gray({ state: withMythos(29) })], async ({ world: w }) => {
      const out = await castSkill(w, { caster: GRAY, ability: abilityOf(w, GRAY, "gray-sealing-mystic-code-release").id });
      expect(out.ok, out.reason).toBe(true);
      const [logos] = effectsOf(w, GRAY, "logos");
      expect(logos.system.expiry).toBe(18 + 6);
      expect(w.actor(GRAY).system.resources.mythos.value).toBeGreaterThan(29);
    }, WAR);
    await withSubjects([gray({ state: withMythos(30) })], async ({ world: w }) => {
      await castSkill(w, { caster: GRAY, ability: abilityOf(w, GRAY, "gray-sealing-mystic-code-release").id });
      const held = effectsOf(w, GRAY, "logos");
      expect(held).toHaveLength(1);
      expect(held[0].system.expiry).toBeNull();
    }, WAR);
  });

  it("its natural expiry places the 2◈ lockout, and the lockout refuses a new Logos (SM.4.lock)", async () => {
    const { expireEffects, onExpireIntents } = await import("../../module/engine/scheduler.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    const unit = { id: GRAY, effectInstances: [{ id: "L", defId: "logos", expiry: 5 }] };
    const ctx = { tick: 5, turnsPerRound: 3, effectDef: (id) => EffectRegistry.get(id) };
    const out = expireEffects([unit], ctx, "expired");
    expect(out.some((i) => i.t === "applyEffect" && (i.effect?.defId ?? i.effect?.id) === "logosLockout")).toBe(true);
    expect(onExpireIntents(unit, unit.effectInstances[0], ctx).length).toBe(1);
    expect(EffectRegistry.get("logos").blockedBy).toEqual(["logosLockout"]);
  });
});

describe("options she reads", () => {
  it("a pool's count ladder, and how the recipient stands to the asker", async () => {
    const { rollOptionsFor } = await import("../../module/rules/options.mjs");
    const options = rollOptionsFor({ attacker: { id: "g", resources: { mythos: { value: 3, max: 40 } } } });
    expect(options.has("self:resource:mythos:gte:3")).toBe(true);
    expect(options.has("self:resource:mythos:gte:4")).toBe(false);
  });

  it("the Chaldea Faction's multiplier starts at its Grand Order base (RH.go)", async () => {
    const { multiplierOf } = await import("../../module/rules/count.mjs");
    const block = { multiplier: { base: 3, per: 0.2, count: { of: "criteria" }, grandOrderBase: 4 } };
    expect(multiplierOf(block, { use: { criteriaMet: 2 } })).toBeCloseTo(3.4);
    expect(multiplierOf(block, { use: { criteriaMet: 2 }, chaldea: true })).toBeCloseTo(4.4);
  });
});
