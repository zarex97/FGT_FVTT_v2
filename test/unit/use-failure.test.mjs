/**
 * @file A use that may fail outright, rolled at the one gate (#300).
 * @see module/rules/use-failure.mjs, module/engine/skill-use.mjs, module/engine/attack.mjs
 *
 * Two shapes from the survey:
 * - Charlotte Corday: a Skill with its own chance to fail, after which it
 *   cannot be used again that Turn (`of: [self]`, `then: lockThisTurn`).
 * - Merlin: his Spells and Noble Phantasm may fail, more often under a
 *   condition, and a failure ends his actions for the Turn
 *   (`of: [spell, np]`, `chanceWhen`, `then: endActions`).
 *
 * A failed use is paid for: its budget and its costs are spent, and no clock
 * starts. A die that decides an outcome is on the card.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadSource } from "../../tools/lib/load.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { validateAll } from "../../tools/lib/content.mjs";

beforeAll(prepareSubjects, 120_000);

const U = "useFailureUnit01";
const FOE = "useFailureFoe001";
const ON_A = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } };

const aimed = {
  timing: { window: "ownTurn" },
  targeting: { anchor: { kind: "self" }, shape: { kind: "square", size: 7 },
    selection: { relations: ["enemy"], includeSelf: false, chooser: "all" } },
  phases: [{ kind: "applyEffects", effects: [
    { id: "atkDwn", duration: "1◈", magnitude: 10, chance: 100, bypassChanceModifiers: true },
  ] }],
};
const CHARLOTTE = {
  id: "test-fail-charlotte", slug: "testFailCharlotte", name: "Test Fail Charlotte", kind: "skill",
  cooldown: "1◈", ...aimed,
  additionalCosts: [{ id: "price", kind: "selfHealth", amount: 20, chargesMaster: false }],
  rules: [{ key: "UseFailure", of: ["self"], chance: 30, then: "lockThisTurn" }],
};
const SPELL = { id: "test-fail-spell", slug: "testFailSpell", name: "Test Fail Spell", kind: "skill", isSpell: true, cooldown: "1◈", ...aimed };
const PLAIN = { id: "test-fail-plain", slug: "testFailPlain", name: "Test Fail Plain", kind: "skill", cooldown: "1◈", ...aimed };
const MERLIN = {
  id: "test-fail-merlin", slug: "testFailMerlin", name: "Test Fail Merlin", kind: "skill", passive: true,
  passiveRules: [{
    key: "UseFailure", of: ["spell", "np"], chance: 10,
    chanceWhen: [{ predicate: ["self:effect:curse"], chance: 20 }], then: "endActions",
  }],
};

async function scene(abilities, fn, { effects = [] } = {}) {
  await withSubjects([
    { from: "test-jeanne-d-arc", id: U, state: { factionId: "A" }, panel: { i: 5, j: 5 }, with: { abilities }, effects },
    { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  ], async ({ world: w }) => {
    w.dice.every(1);
    const item = (cid) => w.actor(U).items.find((i) => i.system?.contentId === cid);
    const { castSkill } = await import("../helpers/process.mjs");
    const cast = (cid) => castSkill(w, { caster: U, ability: item(cid).id });
    const { currentBoard } = await import("../../module/engine/board.mjs");
    const me = () => currentBoard().units.find((u) => u.id === U);
    const said = () => w.messages.contents.map((m) => m.content ?? "").join("\n");
    await fn({ w, item, cast, me, said });
  }, ON_A);
}

describe("Charlotte-shape: a Skill's own chance to fail, locked for the Turn", () => {
  it("a roll of 30 fails: paid for, no clock, the die on the card", async () => {
    await scene([CHARLOTTE], async ({ w, item, cast, me, said }) => {
      const before = w.actor(U).system.health.value;
      w.dice.set("d100", 30);
      const out = await cast("test-fail-charlotte");
      expect(out.ok, out.reason).toBe(true);
      expect(out.failed).toMatchObject({ roll: 30, chance: 30 });
      expect(w.actor(FOE).effects.some((e) => e.system?.defId === "atkDwn")).toBe(false);
      expect(item("test-fail-charlotte").system.cooldown.remaining).toBe(0);
      expect(w.actor(U).system.health.value).toBe(before - 20);
      expect(me().turnState.usedActiveSkill).toBe(true);
      // The test world prints keys; the words are pressed live.
      expect(said()).toContain("FGT.UseFailure.Failed");
      expect(said()).toContain("FGT.UseFailure.Locked");
    });
  });

  it("pressed again the same Turn is refused failedThisTurn, and usable the next Turn", async () => {
    await scene([CHARLOTTE], async ({ w, cast, item }) => {
      w.dice.set("d100", 30);
      await cast("test-fail-charlotte");
      expect((await cast("test-fail-charlotte")).reason).toBe("failedThisTurn");
      const { currentWar } = await import("../../module/engine/war.mjs");
      await currentWar().update({ "system.globalTurn": 8 });
      w.dice.set("d100", 31);
      const out = await cast("test-fail-charlotte");
      expect(out.ok, out.reason).toBe(true);
      expect(out.failed).toBeFalsy();
      expect(item("test-fail-charlotte").system.cooldown.remaining).toBe(3);
    });
  });

  it("a roll of 31 runs the Skill", async () => {
    await scene([CHARLOTTE], async ({ w, cast }) => {
      w.dice.set("d100", 31);
      const out = await cast("test-fail-charlotte");
      expect(out.ok, out.reason).toBe(true);
      expect(out.failed).toBeFalsy();
      expect(w.actor(FOE).effects.some((e) => e.system?.defId === "atkDwn")).toBe(true);
    });
  });
});

describe("Merlin-shape: a Spell may fail, more often under a condition, and ends his actions", () => {
  it("at the plain chance a roll of 15 succeeds", async () => {
    await scene([MERLIN, SPELL, PLAIN], async ({ w, cast }) => {
      w.dice.set("d100", 15);
      const out = await cast("test-fail-spell");
      expect(out.ok, out.reason).toBe(true);
      expect(out.failed).toBeFalsy();
    });
  });

  it("under the condition a roll of 15 fails, and every action is refused for the Turn", async () => {
    await scene([MERLIN, SPELL, PLAIN], async ({ w, cast, me }) => {
      w.dice.set("d100", 15);
      const out = await cast("test-fail-spell");
      expect(out.failed).toMatchObject({ roll: 15, chance: 20 });
      expect(me().turnState.actionsEnded).toBe(true);
      const { preventedBy } = await import("../../module/rules/budget.mjs");
      expect(preventedBy(me(), "move")).toEqual({ prevented: true, by: "actionsEnded" });
      expect(preventedBy(me(), "attack")).toEqual({ prevented: true, by: "actionsEnded" });
      const refused = await cast("test-fail-plain");
      expect(refused.ok).toBe(false);
      expect(refused.reason).toBe("prevented");
      // Every reader names it in words, never the id: the bar's tooltip read
      // "prevented by actionsEnded" (live, L2-20).
      const { canConsume } = await import("../../module/rules/budget.mjs");
      expect(canConsume({}, me(), "skill").reason).toBe("prevented by FGT.Budget.Prevented.actionsEnded");
      const { UNIT_ACTIONS } = await import("../../module/rules/actions.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      expect(UNIT_ACTIONS.filter((a) => a.available(me(), board))).toEqual([]);
    }, { effects: [{ defId: "curse" }] });
  });

  // Every die lands on 1, under the 20% the condition sets: had it rolled, it failed.
  it("a plain Skill never rolls: the class it does not name", async () => {
    await scene([MERLIN, SPELL, PLAIN], async ({ w, cast }) => {
      const out = await cast("test-fail-plain");
      expect(out.ok, out.reason).toBe(true);
      expect(out.failed).toBeFalsy();
      expect(w.actor(FOE).effects.some((e) => e.system?.defId === "atkDwn")).toBe(true);
    }, { effects: [{ defId: "curse" }] });
  });
});

describe("the build", () => {
  const problems = (rule) => validateAll([{ path: "x.yml", dir: "abilities", doc: {
    schema: 1, id: "thing", name: "Thing", kind: "skill", rules: [{ key: "UseFailure", ...rule }],
  } }]).problems.filter((p) => p.includes("UseFailure"));

  it("passes both shapes", () => {
    expect(problems(CHARLOTTE.rules[0])).toEqual([]);
    expect(problems(MERLIN.passiveRules[0])).toEqual([]);
  });

  it("names a then it does not know, and an of that is no class and no ability", () => {
    expect(problems({ of: ["self"], chance: 30, then: "stun" })[0]).toContain('then "stun" -- expected lockThisTurn or endActions');
    expect(problems({ of: ["noSuchAbility"], chance: 30 })[0]).toContain('of "noSuchAbility"');
  });
});

describe("the attack path", () => {
  // An Attack Skill: the same door a Noble Phantasm passes, without an NP gate or a Master to stage.
  it("a failed Attack opens no Process, pays its price, starts no clock, and shows the die", async () => {
    const { files } = await loadSource("packs/_source");
    const strike = files.find((f) => f.doc?.id === "danzo-funshindan").doc;
    const { usableWhileConcealed: _u, concealmentBreakChance: _c, ...rest } = strike;
    const np = {
      ...rest, id: "test-fail-strike", slug: "testFailStrike", name: "Test Fail Strike", cooldown: "6◈",
      additionalCosts: [{ id: "price", kind: "selfHealth", amount: 20, chargesMaster: false }],
      rules: [{ key: "UseFailure", of: ["self"], chance: 30 }],
    };
    await scene([np], async ({ w, item, said }) => {
      const before = w.actor(U).system.health.value;
      w.dice.set("d100", 12);
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: U, abilityId: item("test-fail-strike").id, placement: { panel: { i: 5, j: 7 } } });
      expect(declared.processes ?? []).toEqual([]);
      expect(declared.failed).toMatchObject({ roll: 12, chance: 30 });
      expect(w.actor(U).system.health.value).toBe(before - 20);
      expect(item("test-fail-strike").system.cooldown.remaining).toBe(0);
      expect(said()).toContain("FGT.UseFailure.Failed");
    });
  });
});
