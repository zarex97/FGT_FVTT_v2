/**
 * EMIYA's audit, #208: the readings ruled on 2026-10-14 that differ from what
 * was built. Each test names its reading; Ch. 46 §46.30 holds the record.
 * The Process-driven ones are in `emiya-208-arena.test.mjs`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { castSkill } from "../helpers/process.mjs";
import { canUseAbility } from "../../module/rules/costs.mjs";
import { usageSpecFor } from "../../module/rules/ability-use.mjs";

beforeAll(prepareSubjects, 120_000);

const E = "emiyaCaster00000";
const OWN_TURN = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } };

/** One of a Subject's abilities, by content id. */
const abilityOf = (world, actorId, key) =>
  world.actor(actorId).items.find((i) => i.system?.slug === key || i.system?.contentId === key);

/** The effect instances of one definition an actor holds. */
const held = (world, actorId, defId) =>
  [...world.actor(actorId).effects].filter((e) => e.system?.defId === defId);

/* ========================================================================== */
/*  Readings 2 and 3 -- Trace, On is a plain Skill (#210)                       */
/* ========================================================================== */

describe("Trace, On is a plain Skill, not a Thaumaturgy Spell (#208 reading 2, ruled 2026-10-14)", () => {
  it("is usable while he is Silenced", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, effects: [{ defId: "silence" }] },
    ], ({ world, unit }) => {
      const item = abilityOf(world, E, "emiya-trace-on");
      const verdict = canUseAbility({
        ability: usageSpecFor(item), unit: unit(E), round: 3, turnsPerRound: 3, actingFactionId: "A",
      });
      // HEAD refused with reason "prevented" (`negatedBy: [silence]`): the reason is asserted, not only the failure.
      expect(verdict.reason).toBeUndefined();
      expect(verdict.ok).toBe(true);
    });
  });

  it("is not a Spell: no category for Magecraft or the Atk Up (Trace) extension to hear", async () => {
    await withSubjects([{ from: "emiya", id: E, state: { factionId: "A" } }], ({ world }) => {
      const item = abilityOf(world, E, "emiya-trace-on");
      expect(item.system.isSpell).toBe(false);
      expect(item.system.category ?? null).toBeNull();
      expect(item.system.negatedBy ?? []).toEqual([]);
    });
  });

  it("gives no Range Up (Hawkeye): Magecraft does not hear it", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      const out = await castSkill(w, { caster: E, ability: abilityOf(w, E, "emiya-trace-on").id, placement: { unitId: E } });
      expect(out.ok).toBe(true);
      // The Skill did its work ...
      expect(held(w, E, "atkUpTrace")).toHaveLength(1);
      // ... and Magecraft stayed silent.
      expect(held(w, E, "rangeUp")).toHaveLength(0);
    }, OWN_TURN);
  }, 60_000);
});

describe("Trace, On adds one third of a Round to Atk Up (Trace), once (#208 reading 3, ruled 2026-10-14)", () => {
  // Turn 7 of a 3-Turn Round. Atk Up (Trace) lasts ⅓◈ = 1 Turn.
  const NOW = 7;

  it("the first use applies it for exactly ⅓◈", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      await castSkill(w, { caster: E, ability: abilityOf(w, E, "emiya-trace-on").id, placement: { unitId: E } });
      const [buff] = held(w, E, "atkUpTrace");
      // HEAD: NOW + 2 -- the Skill's own `abilityUsed` extended the buff it had just applied.
      expect(buff.system.expiry).toBe(NOW + 1);
    }, OWN_TURN);
  }, 60_000);

  it("a second use while he holds it adds exactly ⅓◈, not twice", async () => {
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "Trace, On", pick: ["activatedCircuits"] });
      const trace = abilityOf(w, E, "emiya-trace-on");
      await castSkill(w, { caster: E, ability: trace.id, placement: { unitId: E } });
      const before = held(w, E, "atkUpTrace")[0].system.expiry;
      // The 5◈ Cooldown is the sheet's, not what this test is about: clear it.
      await trace.update({ "system.cooldown.remaining": 0 });
      w.answer({ title: "Trace, On", pick: ["blazingCircuits"] });
      const out = await castSkill(w, { caster: E, ability: trace.id, placement: { unitId: E } });
      expect(out.ok).toBe(true);
      const buffs = held(w, E, "atkUpTrace");
      expect(buffs).toHaveLength(1);
      // HEAD: before + 2 -- once for the Skill itself, once more through `abilityUsed`.
      expect(buffs[0].system.expiry).toBe(before + 1);
    }, OWN_TURN);
  }, 60_000);
});
