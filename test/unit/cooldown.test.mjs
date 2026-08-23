/**
 * @file What using an ability puts on cooldown, and what buys its way out.
 * @see module/engine/cooldown.mjs, docs/07-time-model.md §7.5, §7.6
 */

import { describe, it, expect, beforeAll } from "vitest";
import { cooldownFor, alsoTriggered } from "../../module/engine/cooldown.mjs";

const ability = (system = {}) => ({ id: "abil", name: "Ability", system });

beforeAll(() => {
  // `turnsPerRound` is a world setting; the Great Holy Grail War runs at 3.
  globalThis.game = { settings: { get: () => 3 } };
});

describe("a plain tick cooldown", () => {
  it("resolves ◈ against the world's turns per round", () => {
    const plan = cooldownFor(ability({ cooldown: { max: "3◈" } }), "u1");
    expect(plan.cooldowns).toEqual([{ actorId: "u1", abilityId: "abil", ticks: 9 }]);
    expect(plan.spends).toEqual([]);
  });

  it("resolves a subtracting expression", () => {
    // Wisdom of Dún Scáith's `4◈-⅓◈`, which at 3 turns/round is 12 − 1.
    expect(cooldownFor(ability({ cooldown: { max: "4◈-⅓◈" } }), "u1").cooldowns[0].ticks).toBe(11);
  });

  it("produces nothing for an ability with no cooldown", () => {
    expect(cooldownFor(ability({}), "u1")).toEqual({ cooldowns: [], spends: [] });
  });

  it("does not start a clock that counts from DEACTIVATION", () => {
    // Presence Concealment is "Cooldown: 2◈ Turns AFTER PC is deactivated" --
    // the Skill lasts 2◈ and then sits for 2◈ more. Starting the clock at the
    // use collapses the two into one window running under the Skill's own
    // duration, which is half the cost the sheet charges. `countFrom` had been
    // a declared field with no reader since the ability schema was written.
    const plan = cooldownFor(ability({ cooldown: { max: "2◈", countFrom: "deactivation" } }), "u1");
    expect(plan).toEqual({ cooldowns: [], spends: [] });
  });
});

describe("a resource waiver", () => {
  const runeSpell = ability({
    cooldown: { max: "3◈" },
    cooldownWaiver: { resource: "prs", amount: 1 },
  });

  it("skips the clock and spends the token", () => {
    // "If Scáthach uses a Primordial Rune Spell while she has any PRS Tokens,
    // remove one PRS Token from herself, while the Primordial Rune Spell that
    // she used does not enter Cooldown." One decision, so one answer — a
    // caller that had to re-derive whether a token was spent could disagree
    // with the clock it was handed.
    const plan = cooldownFor(runeSpell, "scathach", { unit: { resources: { prs: { value: 2, max: 2 } } } });

    expect(plan.cooldowns).toEqual([]);
    expect(plan.spends).toEqual([{ unitId: "scathach", key: "resources.prs.value", delta: -1 }]);
  });

  it("falls back to the full cooldown with no tokens", () => {
    const plan = cooldownFor(runeSpell, "scathach", { unit: { resources: { prs: { value: 0, max: 2 } } } });

    expect(plan.cooldowns).toEqual([{ actorId: "scathach", abilityId: "abil", ticks: 9 }]);
    expect(plan.spends).toEqual([]);
  });

  it("falls back when no unit is in scope at all", () => {
    // `alsoTriggered` passes no unit deliberately: a token pays for the Spell
    // Scáthach chose, not for whatever that use drags onto cooldown with it.
    expect(cooldownFor(runeSpell, "scathach").cooldowns).toHaveLength(1);
  });
});

describe("a per-unit cooldown", () => {
  it("scales with what the use produced", () => {
    // Medea's Dragon Tooth Warriors: "(Number of Warriors × ⅔◈)".
    const plan = cooldownFor(ability({ cooldown: { perUnit: "⅔◈" } }), "medea", { count: 5 });
    expect(plan.cooldowns[0].ticks).toBe(10);
  });

  it("produces nothing when the use produced nothing", () => {
    expect(cooldownFor(ability({ cooldown: { perUnit: "⅔◈" } }), "medea", { count: 0 }).cooldowns).toEqual([]);
  });
});

describe("alsoTriggers", () => {
  const actor = (items) => ({ id: "scathach", name: "Scáthach", items });

  it("puts a named ability on its own cooldown", () => {
    const rune = { id: "r1", name: "Primordial Rune", system: { contentId: "scathach-primordial-rune", cooldown: { max: "4◈" } } };
    const gate = ability({ alsoTriggers: [{ ability: "scathach-primordial-rune" }] });

    expect(alsoTriggered(gate, actor([rune]))).toEqual([{ actorId: "scathach", abilityId: "r1", ticks: 12 }]);
  });

  it("puts a whole exclusion set on cooldown", () => {
    // "When this NP is used, Primordial Rune and Wisdom of Dún Scáith enter
    // Cooldown." The GRANT has no clock -- it is the button that opens the
    // curation dialog -- so naming it put nothing on cooldown at all. The
    // clause means her three Wisdom slots.
    const slots = [
      { id: "c1", name: "Golden Fleece (copied)", system: { exclusionSet: "wisdomOfDunScaith", cooldown: { max: "4◈-⅓◈" } } },
      { id: "c2", name: "Atlas (copied)", system: { exclusionSet: "wisdomOfDunScaith", cooldown: { max: "4◈-⅓◈" } } },
      { id: "c3", name: "Clairvoyance", system: { exclusionSet: "wisdomOfDunScaith", cooldown: { max: "4◈-⅓◈" } } },
      { id: "x", name: "Ár", system: { category: "primordialRuneSpell", cooldown: { max: "3◈" } } },
    ];
    const gate = ability({ alsoTriggers: [{ exclusionSet: "wisdomOfDunScaith" }] });

    expect(alsoTriggered(gate, actor(slots))).toEqual([
      { actorId: "scathach", abilityId: "c1", ticks: 11 },
      { actorId: "scathach", abilityId: "c2", ticks: 11 },
      { actorId: "scathach", abilityId: "c3", ticks: 11 },
    ]);
  });

  it("never waives a triggered cooldown with a resource", () => {
    // A PRS Token pays for the Spell Scáthach CHOSE to use, not for whatever
    // that use drags onto cooldown with it.
    const spell = {
      id: "s1", name: "Ár",
      system: { contentId: "scathach-ar", cooldown: { max: "3◈" }, cooldownWaiver: { resource: "prs", amount: 1 } },
    };
    const trigger = ability({ alsoTriggers: [{ ability: "scathach-ar" }] });

    expect(alsoTriggered(trigger, actor([spell]))[0].ticks).toBe(9);
  });

  it("produces nothing when the ability triggers none", () => {
    expect(alsoTriggered(ability({}), actor([]))).toEqual([]);
  });
});
