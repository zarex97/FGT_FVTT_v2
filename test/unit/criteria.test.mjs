/**
 * @file Criteria: tests over the declaration's targets, counted once, read by damage, cost and cooldown (#283).
 * @see module/rules/count.mjs (`criteriaMet`), docs/17-abilities.md
 *
 * Arthur's Excalibur Proto: *"Damage dealt depends on whether how many of the
 * following criteria are met by DUs within the NP area"*, six of them; *"For
 * every criteria that is met, damage dealt is increased by 0.5x"*, *"his Master
 * loses an additional 5 Health"*, and *"Cooldown: 5◈ Turns if no criteria are
 * met, increases by ½◈ Turns for every criteria that is met."* And the note:
 * *"Criteria 1, 3, 4, and 5 are also accounted for when Criteria 2 is fulfilled,
 * in this case the single DU needs to meet the conditions."*
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadSource } from "../../tools/lib/load.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playProcess } from "../helpers/process.mjs";
import { criteriaMet, countedValue } from "../../module/rules/count.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { additionalCostsFor } from "../../module/rules/costs.mjs";
import { cooldownFor } from "../../module/engine/cooldown.mjs";

beforeAll(prepareSubjects, 120_000);

/** Excalibur Proto's six, in the sheet's order. */
const ARTHUR = [
  { targets: ["target:paramsVsSelf:gte:3"], atLeast: 2 },
  { targets: [], exactly: 1 },
  { targets: ["target:morality:evil"], atLeast: 2 },
  { targets: ["target:healthVsSelf:gt"], atLeast: 2 },
  { targets: ["target:paramsVsSelf:belowBy2:3"], none: true },
  { targets: ["target:attribute:elemental"], none: true },
];

const CASTER = "criteriaCaster01";
const ALTER = "criteriaAlter001";
const HERACLES = "criteriaHeracles";
const subjects = (extra = []) => [
  { from: "test-jeanne-d-arc", id: CASTER, state: { factionId: "A" }, panel: { i: 5, j: 5 }, ...extra[0] },
  // Evil, her Parameters all B as the caster's, and her Health the caster's 1250.
  { from: "test-jeanne-d-arc-alter", id: ALTER, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  // Not Evil, every Parameter at or above B, and 1500 Health.
  { from: "heracles", id: HERACLES, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
];

describe("the parameter count reaches the predicate grammar as options", () => {
  it("emits target:paramsVsSelf:<compare>:<n> for every n up to the count", () => {
    const self = { id: "a", kind: "servant", parameters: { str: "B", end: "B", agi: "B", mag: "B", luc: "B" } };
    const du = { id: "d", kind: "servant", parameters: { str: "A", end: "A", agi: "B", mag: "C", luc: "E" } };
    const options = [...rollOptionsFor({ attacker: self, defender: du })].filter((o) => o.startsWith("target:paramsVsSelf:"));
    expect(options.filter((o) => o.includes(":gte:")).sort())
      .toEqual(["target:paramsVsSelf:gte:1", "target:paramsVsSelf:gte:2", "target:paramsVsSelf:gte:3"]);
    // E is two whole grades below B (D, then E); C is one.
    expect(options.filter((o) => o.includes(":belowBy2:"))).toEqual(["target:paramsVsSelf:belowBy2:1"]);
  });
});

describe("criteria met, counted over the declaration's DUs", () => {
  it("two DUs: the ones both meet, and not the ones only one meets", async () => {
    await withSubjects(subjects(), ({ unit, board }) => {
      const out = criteriaMet(ARTHUR, { targets: [unit(ALTER), unit(HERACLES)], self: unit(CASTER), board });
      // 1: both stand at or above her in 3+ Parameters; 2: two DUs, not one;
      // 3: only the Alter is Evil; 4: only Heracles has more Health; 5: neither
      // is two grades below in 3; 6: neither is Elemental.
      expect(out).toEqual({ met: 3, which: [1, 5, 6], total: 6 });
    });
  });

  it("one DU: the single DU meets an 'at least two' criterion alone (the sheet's note)", async () => {
    await withSubjects(subjects(), ({ unit, board }) => {
      // The Alter alone: Evil (3) but not more Health (4).
      expect(criteriaMet(ARTHUR, { targets: [unit(ALTER)], self: unit(CASTER), board }))
        .toEqual({ met: 5, which: [1, 2, 3, 5, 6], total: 6 });
      // Heracles alone: more Health (4) but not Evil (3).
      expect(criteriaMet(ARTHUR, { targets: [unit(HERACLES)], self: unit(CASTER), board }))
        .toEqual({ met: 5, which: [1, 2, 4, 5, 6], total: 6 });
    });
  });

  it("no DU: none met, 'none of the DUs' included", async () => {
    await withSubjects(subjects(), ({ unit, board }) => {
      expect(criteriaMet(ARTHUR, { targets: [], self: unit(CASTER), board })).toEqual({ met: 0, which: [], total: 6 });
    });
  });

  it("no criteria authored: nothing to count", () => {
    expect(criteriaMet(undefined, { targets: [] })).toEqual({ met: 0, which: [], total: 0 });
  });
});

describe("damage, cost and cooldown read the one number", () => {
  const use = { criteriaMet: 4 };

  it("the damage multiplier is 3x plus 0.5x each", () => {
    expect(countedValue({ base: 3, per: 0.5, count: { of: "criteria" } }, { use })).toBe(5);
  });

  it("the Master's cost is 30 plus 5 each, superseding the NP's own", () => {
    const ability = { system: { additionalCosts: [{
      id: "excaliburProto", kind: "masterHealth", amount: { base: 30, per: 5, count: { of: "criteria" } },
      supersedes: ["npCost"],
    }] } };
    const [cost] = additionalCostsFor({ ability, self: { id: "arthur" }, master: { id: "m" }, use });
    expect(cost).toMatchObject({ kind: "masterHealth", amount: 50, unitId: "m", supersedes: ["npCost"] });
  });

  it("the cooldown is 5◈ plus ½◈ each", () => {
    globalThis.game ??= { settings: { get: () => 3 } };
    const ability = { id: "ep", name: "Excalibur Proto", system: { cooldown: {
      max: "5◈", countBonus: [{ ticks: "½◈", count: { of: "criteria" } }],
    } } };
    expect(cooldownFor(ability, "arthur", { use }).cooldowns).toEqual([{ actorId: "arthur", abilityId: "ep", ticks: 21 }]);
    expect(cooldownFor(ability, "arthur", { use: { criteriaMet: 0 } }).cooldowns[0].ticks).toBe(15);
  });
});

describe("a Skill counts its criteria the same way", () => {
  it("over the Units it is aimed at, sizing its clock and saying so", async () => {
    const { files } = await loadSource("packs/_source");
    const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
    const skill = {
      id: "test-criteria-skill", slug: "testCriteriaSkill", name: "Test Criteria Skill", kind: "skill",
      timing: { window: "ownTurn" },
      targeting: {
        anchor: { kind: "self" }, shape: { kind: "square", size: 7 },
        selection: { relations: ["enemy"], includeSelf: false, chooser: "all" },
      },
      phases: [{ kind: "applyEffects", effects: [{ id: "atkDwn", duration: "1◈", magnitude: 10, chance: 100 }] }],
      criteria: ARTHUR,
      cooldown: { max: "5◈", countBonus: [{ ticks: "½◈", count: { of: "criteria" } }] },
    };
    await withSubjects(subjects([{ with: { abilities: [...(jeanne.abilities ?? []), skill] } }]), async ({ world: w }) => {
      w.dice.every(1);
      const item = w.actor(CASTER).items.find((i) => i.system?.contentId === "test-criteria-skill");
      const { castSkill } = await import("../helpers/process.mjs");
      const out = await castSkill(w, { caster: CASTER, ability: item.id });
      expect(out.ok, out.reason).toBe(true);
      expect(w.messages.contents.filter((m) => String(m.content).includes("FGT.Criteria.Line"))).toHaveLength(1);
      // 3 met over the two, as the attack path counts them: 15 + 5.
      expect(w.actor(CASTER).items.get(item.id).system.cooldown.remaining).toBe(20);
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});

describe("the card's words", () => {
  it("name the ability, the count, the total and which", async () => {
    const { criteriaLine } = await import("../../module/engine/attack.mjs");
    const t = (key, data) => `${key}:${JSON.stringify(data)}`;
    expect(criteriaLine(t, { name: "Excalibur Proto" }, { met: 3, which: [1, 5, 6], total: 6 }))
      .toBe('FGT.Criteria.Line:{"ability":"Excalibur Proto","met":3,"total":6,"which":"1, 5, 6"}');
    expect(criteriaLine(t, { name: "X" }, { met: 0, which: [], total: 6 })).toContain('"which":"—"');
  });
});

describe("a declaration counts its criteria once, and every Process carries the count", () => {
  it("over two DUs: each Process's saved state reads the same count, and the card says it", async () => {
    const { files } = await loadSource("packs/_source");
    const strike = files.find((f) => f.doc?.id === "danzo-funshindan").doc;
    const { usableWhileConcealed: _u, concealmentBreakChance: _c, ...rest } = strike;
    const proto = {
      ...rest, id: "test-criteria-strike", slug: "testCriteriaStrike", name: "Test Criteria Strike",
      criteria: ARTHUR,
      damage: { ...rest.damage, multiplier: { base: 3, per: 0.5, count: { of: "criteria" } } },
      cooldown: { max: "5◈", countBonus: [{ ticks: "½◈", count: { of: "criteria" } }] },
    };
    const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
    await withSubjects(subjects([{ with: { abilities: [...(jeanne.abilities ?? []), proto] } }]), async ({ world: w }) => {
      w.dice.every(99);
      const item = w.actor(CASTER).items.find((i) => i.system?.contentId === "test-criteria-strike");
      // What the DataModel kept: the authored criteria and the cooldown's bonus.
      expect(item.system.criteria).toHaveLength(6);
      expect(item.system.cooldown.countBonus).toEqual([{ ticks: "½◈", count: { of: "criteria" } }]);

      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: CASTER, abilityId: item.id, placement: { panel: { i: 5, j: 7 } } });
      const ids = declared.processes.map((p) => p.messageId);
      expect(ids).toHaveLength(2);
      const saved = ids.map((id) => JSON.parse(w.messages.get(id).getFlag("fgt", "process")).attack.criteriaMet);
      expect(saved).toEqual([{ met: 3, which: [1, 5, 6], total: 6 }, { met: 3, which: [1, 5, 6], total: 6 }]);

      // One card names them, before any Process.
      const cards = w.messages.contents.filter((m) => String(m.content).includes("FGT.Criteria.Line"));
      expect(cards).toHaveLength(1);

      // The clock it started: 5◈ + 3 × ½◈ at 3 Turns a Round, rounded up once: 15 + 5.
      expect(w.actor(CASTER).items.get(item.id).system.cooldown.remaining).toBe(20);

      for (const id of ids) await playProcess(w, id, { [ALTER]: ["nothing", "declined"], [HERACLES]: ["nothing", "declined"] });
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});
