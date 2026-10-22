/**
 * @file The Cooldown clock settles from what the use did (#285, #320).
 * @see module/engine/cooldown.mjs, module/rules/use-record.mjs
 *
 * Each shape is a sheet's, with the case it excludes:
 * - Trung Sisters' Punji Trap: *"Cooldown: 1◈ Turns plus ½◈ more Turns for every debuff inflicted"*.
 * - Kurohime's NP: 3◈ instead of 6◈ when its Normal Attack misses.
 * - Tamamo Goth's NP: longer when it was Evaded.
 * - Sétanta: *"3◈-⅓◈ Turns + ⅓◈ Turns for each effect activated/applied by this Skill"*.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { cooldownFor, settleDelta } from "../../module/engine/cooldown.mjs";
import { emptyUseRecord, noteFact, noteLanding, useFacts, declarationRecord } from "../../module/rules/use-record.mjs";
import { loadSource } from "../../tools/lib/load.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(async () => {
  globalThis.game ??= { settings: { get: () => 3 } };
  await prepareSubjects();
}, 120_000);

const ability = (cooldown) => ({ id: "a", name: "A", system: { cooldown } });
const facts = (fill) => {
  const r = emptyUseRecord({});
  fill(r);
  return useFacts(r);
};
const ticksOf = (cd, f) => cooldownFor(ability(cd), "u", { facts: f }).cooldowns[0]?.ticks ?? 0;

describe("a clock sized by what the use did", () => {
  it("Trung-shape: ½◈ per debuff inflicted, none for a buff or a resisted one", () => {
    const cd = { max: "1◈", countBonus: [{ ticks: "½◈", count: { of: "use", fact: "debuffsInflicted" } }] };
    const debuffs = (n) => facts((r) => {
      for (let i = 0; i < n; i += 1) noteLanding(r, { defId: "bleed", polarity: "debuff", outcome: "applied" });
      noteLanding(r, { defId: "poison", polarity: "debuff", outcome: "resisted" });
      noteLanding(r, { defId: "atkUp", polarity: "buff", outcome: "applied" });
    });
    // 1◈ = 3 Turns; ½◈ × n rounded up once over the whole: 2, 3.
    expect([0, 1, 2].map((n) => ticksOf(cd, debuffs(n)))).toEqual([3, 5, 6]);
  });

  it("Kurohime-shape: 3◈ on use:missed, 6◈ otherwise", () => {
    const cd = { branches: [{ predicate: ["use:missed"], max: "3◈" }, { max: "6◈" }] };
    expect(ticksOf(cd, facts(() => {}))).toBe(18);
    expect(ticksOf(cd, facts((r) => noteFact(r, "missed", true)))).toBe(9);
  });

  it("Tamamo Goth-shape: 1◈ more on use:evaded", () => {
    const cd = { max: "4◈", conditionalBonus: [{ predicate: ["use:evaded"], ticks: "1◈" }] };
    expect(ticksOf(cd, facts(() => {}))).toBe(12);
    expect(ticksOf(cd, facts((r) => noteFact(r, "evaded", true)))).toBe(15);
  });

  it("Sétanta-shape: ⅓◈ per effect applied, a resisted one not counted", () => {
    const cd = { max: "3◈-⅓◈", countBonus: [{ ticks: "⅓◈", count: { of: "use", fact: "effectsApplied" } }] };
    const f = facts((r) => {
      noteLanding(r, { defId: "atkUp", polarity: "buff", outcome: "applied" });
      noteLanding(r, { defId: "defUp", polarity: "buff", outcome: "applied" });
      noteLanding(r, { defId: "critUp", polarity: "buff", outcome: "resisted" });
    });
    expect(ticksOf(cd, f)).toBe(8 + 2);
  });

  it("Nursery-shape: perUnit reads the use's summoned, as it did from its count", () => {
    const cd = { perUnit: "⅓◈", countFrom: "summonCount" };
    expect(ticksOf(cd, facts((r) => noteFact(r, "summoned", 4)))).toBe(4);
  });
});

describe("what a settle writes", () => {
  it("is the difference from the clock started at commit, so a cut made meanwhile stands", () => {
    const cd = { branches: [{ predicate: ["use:missed"], max: "3◈" }, { max: "6◈" }] };
    expect(settleDelta(ability(cd), "u", { facts: facts((r) => noteFact(r, "missed", true)) })).toBe(-9);
    expect(settleDelta(ability(cd), "u", { facts: facts(() => {}) })).toBe(0);
  });

  it("is nothing for a use on its Cooldown or a channel, which start no clock (Review Focus 4)", () => {
    const cd = { branches: [{ predicate: ["use:missed"], max: "3◈" }, { max: "6◈" }] };
    expect(settleDelta(ability(cd), "u", { facts: facts((r) => { noteFact(r, "missed", true); noteFact(r, "overCooldown", true); }) })).toBe(0);
    expect(settleDelta(ability(cd), "u", { facts: facts((r) => { noteFact(r, "missed", true); noteFact(r, "channelStarted", true); }) })).toBe(0);
  });

  it("merges only the declaration's Processes, never a Counter's, and counts the Units hit (Review Focus 2)", () => {
    const own = (defenderId, hit) => {
      const use = emptyUseRecord({ abilityId: "np" });
      noteLanding(use, { defId: "defDwn", polarity: "debuff", outcome: "applied", targetId: defenderId });
      return { state: { defenderId, isCounter: false, use }, result: hit ? { total: 100, flags: {} } : null };
    };
    const counterUse = emptyUseRecord({ abilityId: "np" });
    noteLanding(counterUse, { defId: "bleed", polarity: "debuff", outcome: "applied" });
    const counter = { state: { defenderId: "me", isCounter: true, use: counterUse }, result: { total: 50, flags: {} } };
    const f = useFacts(declarationRecord([own("d1", true), own("d2", false), counter]));
    expect(f.debuffsInflicted).toBe(2);
    expect(f.unitsHit).toBe(1);
    expect(f.missed).toBe(false);
    expect(useFacts(declarationRecord([own("d1", false)])).missed).toBe(true);
    // A negated hit is no hit (#230 reading 7).
    const negated = { ...own("d1", true), result: { total: 0, flags: { negatedBy: "Invulnerable" } } };
    expect(useFacts(declarationRecord([negated])).unitsHit).toBe(0);
  });
});

describe("a Skill's clock reads what it did", () => {
  it("Trung-shape on the Skill path: ½◈ per debuff it inflicted", async () => {
    const { files } = await loadSource("packs/_source");
    const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
    const skill = {
      id: "test-use-trung-skill", slug: "testUseTrungSkill", name: "Test Use Trung Skill", kind: "skill",
      timing: { window: "ownTurn" },
      cooldown: { max: "1◈", countBonus: [{ ticks: "½◈", count: { of: "use", fact: "debuffsInflicted" } }] },
      targeting: { anchor: { kind: "self" }, shape: { kind: "square", size: 7 },
        selection: { relations: ["enemy"], includeSelf: false, chooser: "all" } },
      phases: [{ kind: "applyEffects", effects: [
        { id: "atkDwn", duration: "1◈", magnitude: 10, chance: 100, bypassChanceModifiers: true },
      ] }],
    };
    await withSubjects([
      { from: "test-jeanne-d-arc", id: "settleSkiller001", state: { factionId: "A" }, panel: { i: 5, j: 5 },
        with: { abilities: [...(jeanne.abilities ?? []), skill] } },
      { from: "test-jeanne-d-arc-alter", id: "settleSkillDu001", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
      { from: "heracles", id: "settleSkillDu002", state: { factionId: "B" }, panel: { i: 5, j: 8 } },
    ], async ({ world: w }) => {
      w.dice.every(1);
      const item = () => w.actor("settleSkiller001").items.find((i) => i.system?.contentId === "test-use-trung-skill");
      const { castSkill } = await import("../helpers/process.mjs");
      const out = await castSkill(w, { caster: "settleSkiller001", ability: item().id });
      expect(out.ok, out.reason).toBe(true);
      // Two debuffs inflicted: 1◈ + 2 × ½◈ = 2◈.
      expect(item().system.cooldown.remaining).toBe(6);
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});

describe("an attack settles once its Combat Phase is over", () => {
  it("Kurohime-shape: an Attack every DU Evaded settles from 6◈ to 3◈, with the clock's line on its card", async () => {
    const { files } = await loadSource("packs/_source");
    const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
    const strike = files.find((f) => f.doc?.id === "danzo-funshindan").doc;
    const { usableWhileConcealed: _u, concealmentBreakChance: _c, ...rest } = strike;
    const np = {
      ...rest, id: "test-use-kurohime", slug: "testUseKurohime", name: "Test Use Kurohime",
      cooldown: { branches: [{ predicate: ["use:missed"], max: "3◈" }, { max: "6◈" }] },
    };
    await withSubjects([
      { from: "test-jeanne-d-arc", id: "settleCaster0001", state: { factionId: "A" }, panel: { i: 5, j: 5 },
        with: { abilities: [...(jeanne.abilities ?? []), np] } },
      { from: "heracles", id: "settleDefender01", state: { factionId: "B" }, panel: { i: 5, j: 7 },
        effects: [{ defId: "dodge", uses: 2 }] },
    ], async ({ world: w }) => {
      w.dice.every(50);
      const item = () => w.actor("settleCaster0001").items.find((i) => i.system?.contentId === "test-use-kurohime");
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const { playProcess } = await import("../helpers/process.mjs");
      const declared = await resolveAttack({ attackerId: "settleCaster0001", abilityId: item().id, placement: { panel: { i: 5, j: 7 } } });
      // Started at commit, before any Process: the 6◈ branch, no outcome yet.
      expect(item().system.cooldown.remaining).toBe(18);
      for (const p of declared.processes) {
        await playProcess(w, p.messageId, { settleDefender01: ["evade", "declined"], settleCaster0001: ["declined"] });
      }
      // Settled after the Phase: every DU Evaded, so the Attack missed.
      expect(item().system.cooldown.remaining).toBe(9);
      const rows = declared.processes.flatMap((p) => w.messages.get(p.messageId).getFlag("fgt", "effects") ?? []);
      expect(rows.some((r) => r.id === "cooldown")).toBe(true);
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});
