/**
 * @file The Prevention Luck Check, played in the test world.
 * @see module/engine/landing.mjs#offerPrevention, CONTEXT.md (Prevention Luck Check), docs/13-checks-and-randomness.md
 *
 * > A Unit about to receive a debuff during a Combat Process may spend 1 Luck
 * > on a Luck Check to stop it, once per Combat Process. Never against a
 * > terminal Effect.
 *
 * `applyEffect` had a step for it from the start, and nothing ever offered it.
 * Ruled 2026-10-14 (Wave B): the target's player is asked on their own screen;
 * it costs the Luck whatever the die says; it is the standard d20 Luck Check;
 * it is not offered on Beginner or Intermediate, with no Luck, or where Luck
 * Checks are blocked.
 *
 * Scáthach's Þurs is the attack: one Normal-Attack-shaped Skill attack whose
 * only rider is Shock, a debuff at 100%, so no d100 is rolled and the only
 * die that matters is the d20.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const S = "scathachCaster00", H = "heraclesDefender";
// The difficulty is the Combat's own, which the board reads before the setting.
const at = (round, faction, difficulty) => ({ tokens: true, combat: { round, started: true, system: { globalTurn: round * 3, difficulty }, actingFactionId: faction } });
const shocks = (w) => [...w.actor(H).effects].filter((e) => e.system.defId === "shock");
const ASK = "FGT.Prompt.luckCheck";

/** Þurs on Heracles, whose Unit Player1 owns, at a difficulty. */
async function thurs(difficulty, play) {
  await withSubjects([
    { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from: "heracles", id: H, owner: "p1", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
  ], async ({ world: w }) => {
    const ability = [...w.actor(S).items].find((i) => /Þurs/.test(i.name));
    // Luck to spend. The pool is rolled at war setup (`engine/war-setup.mjs`),
    // which a subject never went through.
    await w.actor(H).update({ "system.luck.max": 3, "system.luck.value": 3 });
    const attack = () => playAttack(w, { attacker: S, ability: ability.id, target: H, react: { [H]: ["nothing", "declined"] } });
    await play(w, attack);
  }, at(6, "A", difficulty));
}

describe("the Prevention Luck Check", () => {
  it("asks the target's player, and a success stops the debuff for 1 Luck", async () => {
    await thurs("expert", async (w, attack) => {
      const luck = w.actor(H).system.luck.value;
      w.answer({ title: ASK, by: "p1", value: true });
      w.dice.set("d20", 1);
      await attack();
      expect(shocks(w)).toHaveLength(0);
      expect(w.actor(H).system.luck.value).toBe(luck - 1);
      const card = [...w.messages.values()].flatMap((m) => m.getFlag?.("fgt", "effects") ?? []);
      // One "prevented", from the outcome; the reason says how.
      expect(card.find((e) => e.id === "shock")).toMatchObject({ outcome: "prevented", reason: "Luck Check 1 vs 3" });
    });
  });

  it("costs the Luck when it fails, and the debuff lands", async () => {
    await thurs("expert", async (w, attack) => {
      const luck = w.actor(H).system.luck.value;
      w.answer({ title: ASK, by: "p1", value: true });
      w.dice.set("d20", 20);
      await attack();
      expect(shocks(w)).toHaveLength(1);
      expect(w.actor(H).system.luck.value).toBe(luck - 1);
      // The spent Luck has a line too, beside the effect that landed.
      const card = [...w.messages.values()].flatMap((m) => m.getFlag?.("fgt", "effects") ?? []);
      expect(card.find((e) => e.id === "shock").chance).toMatch(/^Luck Check 20 vs 3: failed$/);
    });
  });

  it("costs nothing when the player declines", async () => {
    await thurs("expert", async (w, attack) => {
      const luck = w.actor(H).system.luck.value;
      w.answer({ title: ASK, by: "p1", decline: true });
      await attack();
      expect(shocks(w)).toHaveLength(1);
      expect(w.actor(H).system.luck.value).toBe(luck);
    });
  });

  it("is not offered on Intermediate", async () => {
    // An unscripted question fails the test: none is asked.
    await thurs("intermediate", async (w, attack) => {
      await attack();
      expect(shocks(w)).toHaveLength(1);
    });
  });

  it("is not offered on Beginner", async () => {
    await thurs("beginner", async (w, attack) => {
      await attack();
      expect(shocks(w)).toHaveLength(1);
    });
  });

  it("is not offered with no Luck to spend", async () => {
    await thurs("expert", async (w, attack) => {
      await w.actor(H).update({ "system.luck.value": 0 });
      await attack();
      expect(shocks(w)).toHaveLength(1);
    });
  });
});

describe("once per Combat Process", () => {
  it("offers it for the first debuff and not the second", async () => {
    // Two debuffs on one Unit inside one Process, through the door itself.
    // The check spent on the first is the Process's one: the second is not
    // offered (an unscripted question fails the test) and lands.
    await withSubjects([
      { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, owner: "p1", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      const { landEffect } = await import("../../module/engine/landing.mjs");
      const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
      const { entryOf } = await import("../../module/rules/effect-flow.mjs");
      await w.actor(H).update({ "system.luck.max": 3, "system.luck.value": 3 });
      const process = { attackerId: S, defenderId: H };
      const land = (id) => landEffect(entryOf({ id }), {
        target: unitOf(w.actor(H), currentBoard()), source: { unitId: S, abilityId: null }, caster: w.actor(S), process,
      });
      w.answer({ title: ASK, by: "p1", value: true });
      w.dice.set("d20", 1);
      expect((await land("shock")).outcome).toBe("prevented");
      expect((await land("burn")).outcome).toBe("applied");
      expect(process.prevented).toEqual({ [H]: true });
    }, at(6, "A", "expert"));
  });

  it("is never offered against a terminal effect", async () => {
    await withSubjects([
      { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, owner: "p1", state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      const { landEffect } = await import("../../module/engine/landing.mjs");
      const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
      const { entryOf } = await import("../../module/rules/effect-flow.mjs");
      await w.actor(H).update({ "system.luck.max": 3, "system.luck.value": 3 });
      w.dice.every(1);
      const out = await landEffect(entryOf({ id: "instakill", chance: 100 }), {
        target: unitOf(w.actor(H), currentBoard()), source: { unitId: S, abilityId: null }, caster: w.actor(S), process: {},
      });
      // Applied, so the check had its chance to be offered and was not.
      expect(out.outcome).toBe("applied");
    }, at(6, "A", "expert"));
  });
});
