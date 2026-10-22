/**
 * @file Both use paths fill the Use record, and an attack's is saved with its Processes (#320, Q18).
 * @see module/rules/use-record.mjs, module/engine/landing.mjs, module/engine/skill-use.mjs, module/engine/attack.mjs
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadSource } from "../../tools/lib/load.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { mergeRecords, useFacts } from "../../module/rules/use-record.mjs";

beforeAll(prepareSubjects, 120_000);

const CASTER = "useRecordCaster1";
const D1 = "useRecordDefend1";
const D2 = "useRecordDefend2";
const ON_A = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } };

async function jeanneWith(ability) {
  const { files } = await loadSource("packs/_source");
  const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
  return { abilities: [...(jeanne.abilities ?? []), ability] };
}

const scene = (ability) => jeanneWith(ability).then((withA) => [
  { from: "test-jeanne-d-arc", id: CASTER, state: { factionId: "A" }, panel: { i: 5, j: 5 }, with: withA },
  { from: "test-jeanne-d-arc-alter", id: D1, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  { from: "heracles", id: D2, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
]);

describe("a Skill's record", () => {
  it("counts the debuffs it inflicted, through the landing door", async () => {
    const skill = {
      id: "test-use-skill", slug: "testUseSkill", name: "Test Use Skill", kind: "skill", cooldown: "3◈",
      timing: { window: "ownTurn" },
      targeting: { anchor: { kind: "self" }, shape: { kind: "square", size: 7 },
        selection: { relations: ["enemy"], includeSelf: false, chooser: "all" } },
      phases: [{ kind: "applyEffects", effects: [
        { id: "atkDwn", duration: "1◈", magnitude: 10, chance: 100, bypassChanceModifiers: true },
      ] }],
    };
    await withSubjects(await scene(skill), async ({ world: w }) => {
      w.dice.every(1);
      const item = w.actor(CASTER).items.find((i) => i.system?.contentId === "test-use-skill");
      const { castSkill } = await import("../helpers/process.mjs");
      const out = await castSkill(w, { caster: CASTER, ability: item.id });
      expect(out.ok, out.reason).toBe(true);
      const facts = useFacts(out.use);
      expect(facts.debuffsInflicted).toBe(2);
      expect(facts.effectsApplied).toBe(2);
      expect([...facts.applied]).toEqual(["atkDwn"]);
    }, ON_A);
  });
});

describe("an attack's record, one per Process, saved with it", () => {
  it("each Process's saved state carries its own landings and the declaration's commit facts", async () => {
    const { files } = await loadSource("packs/_source");
    const strike = files.find((f) => f.doc?.id === "danzo-funshindan").doc;
    const { usableWhileConcealed: _u, concealmentBreakChance: _c, ...rest } = strike;
    const area = { ...rest, id: "test-use-strike", slug: "testUseStrike", name: "Test Use Strike" };
    await withSubjects(await scene(area), async ({ world: w }) => {
      w.dice.every(1);
      const item = w.actor(CASTER).items.find((i) => i.system?.contentId === "test-use-strike");
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: CASTER, abilityId: item.id, placement: { panel: { i: 5, j: 7 } } });
      const ids = declared.processes.map((p) => p.messageId);
      expect(ids).toHaveLength(2);
      const { playProcess } = await import("../helpers/process.mjs");
      for (const id of ids) await playProcess(w, id, { [D1]: ["nothing", "declined"], [D2]: ["nothing", "declined"] });

      // Read back as a reload would: from the saved flags alone.
      const saved = ids.map((id) => JSON.parse(w.messages.get(id).getFlag("fgt", "process")).use);
      for (const use of saved) {
        expect(use).toMatchObject({ abilityId: item.id, unitId: CASTER });
        expect(use.facts).toHaveProperty("overCooldown", false);
      }
      // Funshindan's Burn is a 50% chance; with every die at 1 both land.
      const merged = useFacts(mergeRecords(saved));
      expect(merged.debuffsInflicted).toBe(saved.reduce((n, u) => n + u.landings.filter((l) => l.outcome === "applied").length, 0));
      expect(saved.every((u) => u.landings.length >= 1)).toBe(true);
    }, ON_A);
  });

  it("notes an Evade on the Process that was Evaded, and only there", async () => {
    const { files } = await loadSource("packs/_source");
    const strike = files.find((f) => f.doc?.id === "danzo-funshindan").doc;
    const { usableWhileConcealed: _u, concealmentBreakChance: _c, ...rest } = strike;
    const area = { ...rest, id: "test-use-strike", slug: "testUseStrike", name: "Test Use Strike" };
    await withSubjects(await scene(area), async ({ world: w }) => {
      w.dice.every(50);
      // Dodge makes Heracles's Evade automatic, as the EMIYA arena stages it.
      await w.actor(D2).createEmbeddedDocuments("ActiveEffect", [{ name: "Dodge", type: "fgtEffect", system: { defId: "dodge", uses: 2 } }]);
      const item = w.actor(CASTER).items.find((i) => i.system?.contentId === "test-use-strike");
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: CASTER, abilityId: item.id, placement: { panel: { i: 5, j: 7 } } });
      const byDefender = Object.fromEntries(declared.processes.map((p) => [p.state.defenderId, p.messageId]));
      const { playProcess } = await import("../helpers/process.mjs");
            await playProcess(w, byDefender[D1], { [D1]: ["nothing", "declined"] });
      // Heracles Evades, and the attacker declines its Lucky Hit.
      await playProcess(w, byDefender[D2], { [D2]: ["evade"], [CASTER]: ["declined"] });
      const stateOf = (id) => JSON.parse(w.messages.get(id).getFlag("fgt", "process"));
      // The Evade held: no damage, and the record says so.
      expect(stateOf(byDefender[D2]).history.map((h) => `${h.state}:${h.event}`)).toContain("react:evade");
      expect(w.messages.get(byDefender[D2]).getFlag("fgt", "result")?.total ?? 0).toBe(0);
      expect(stateOf(byDefender[D2]).use.facts.evaded).toBe(true);
      expect(Boolean(stateOf(byDefender[D1]).use.facts.evaded)).toBe(false);
    }, ON_A);
  });
});
