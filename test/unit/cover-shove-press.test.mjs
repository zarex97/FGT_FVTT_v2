/**
 * @file Cover and the shove, through the engine: a Master caught by an area
 * Noble Phantasm beside its Servant (Ch. 32 rule 4).
 * @see module/engine/attack.mjs#resolveCover, module/rules/cover.mjs
 *
 * > *"When a Master that has its Servant within a 2 panel area of itself gets
 * > caught in an AoE Noble Phantasm and fails to Evade, the Servant performs an
 * > Agility Check/Agility Check-. If Successful, the Servant shoves (Moves) its
 * > Master out of the NP area (the Master is Moved to one panel outside of the
 * > NP area) ... If Failed, the Master receives no damage and effects, while
 * > the Total Damage the Servant takes from the AoE NP is increased by 100%"*
 *
 * Asked 2026-10-25 to check Cover and the shove in a War of their own, not the
 * match being played: this world is the test's.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import * as cp from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 120_000);

const E = "emiyaCaladbolg00", EM = "emiyasMaster0000", D = "drakeCovers00000", M = "drakesMaster0000";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

/** Caladbolg's 3x3 around Drake at (5,5) holds rows 4-6, columns 4-6; her Master stands at (5,6). */
const subjects = [
  { from: "emiya", id: E, state: { factionId: "A", masterId: EM }, panel: { i: 5, j: 0 } },
  { from: "master-advanced", id: EM, state: { factionId: "A" }, panel: { i: 6, j: 0 } },
  { from: "drake", id: D, state: { factionId: "B", masterId: M }, panel: { i: 5, j: 5 } },
  { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
];
const inArea = (p) => p.i >= 4 && p.i <= 6 && p.j >= 4 && p.j <= 6;

async function declare(w) {
  // The subjects' Agility as a sheet states it: Drake's check is against hers.
  await w.actor(D).update({ "system.agility.value": 15, "system.agility.max": 15 });
  w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
  const { resolveAttack } = await import("../../module/engine/attack.mjs");
  const out = await resolveAttack({ attackerId: E, abilityId: w.actor(E).items.find((i) => i.system?.contentId === "emiya-caladbolg").id, placement: { unitId: D } });
  const byDefender = Object.fromEntries(out.processes.map((p) => [cp.deserialize(w.messages.get(p.messageId).getFlag("fgt", "process")).defenderId, p.messageId]));
  expect(Object.keys(byDefender).sort()).toEqual([D, M].sort());
  return byDefender;
}

async function finish(w, id, reaction = "nothing") {
  const { advanceAttack } = await import("../../module/engine/attack.mjs");
  for (let n = 0; n < 14; n += 1) {
    const st = cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
    const prompt = cp.pendingPrompt(st);
    if (cp.isComplete(st) || !prompt) return st;
    const legal = cp.legalEvents(st.state);
    await advanceAttack({ messageId: id, event: prompt.kind === "reaction" ? reaction : (legal.includes("declined") ? "declined" : legal[0]) });
  }
  return cp.deserialize(w.messages.get(id).getFlag("fgt", "process"));
}

const panelOf = (w, id) => {
  const t = w.actor(id).getActiveTokens()[0].document;
  return { i: Math.round(t.y / 100), j: Math.round(t.x / 100) };
};

describe("Cover against an area Noble Phantasm", () => {
  it("a passed Agility Check shoves the Master to a panel outside the whole area", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      const ids = await declare(w);
      const before = w.actor(M).system.health.value;
      // The Master's Evade fails (20), Drake's Agility Check passes (1).
      w.dice.set("d20", 20, 1);
      await finish(w, ids[M], "evade");
      const landed = panelOf(w, M);
      expect(landed).not.toEqual({ i: 5, j: 6 });
      expect(inArea(landed)).toBe(false);
      expect(w.actor(M).system.health.value).toBe(before);
    }, at);
  }, 60_000);

  it("a failed one leaves the Master unhurt and doubles Drake's damage, who may not Evade", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      const ids = await declare(w);
      const before = w.actor(M).system.health.value;
      w.dice.set("d20", 20, 20);
      await finish(w, ids[M], "evade");
      expect(panelOf(w, M)).toEqual({ i: 5, j: 6 });
      expect(w.actor(M).system.health.value).toBe(before);

      const drakeOpen = cp.deserialize(w.messages.get(ids[D]).getFlag("fgt", "process"));
      const { coverStateFor, advanceAttack } = await import("../../module/engine/attack.mjs");
      const { isCovering } = await import("../../module/rules/cover.mjs");
      const { promptOptions, refuseCoveredEvade } = await import("../../module/apps/chat/cards.mjs");
      const covering = isCovering({ id: D }, coverStateFor(drakeOpen));
      expect(covering).toBe(true);
      // The card draws Evade refused, as the press refuses it.
      const drawn = refuseCoveredEvade(promptOptions(cp.pendingPrompt(drakeOpen), drakeOpen), covering);
      expect(drawn.find((o) => o.event === "evade")).toMatchObject({ disabled: true });
      await advanceAttack({ messageId: ids[D], event: "evade" });
      expect(cp.deserialize(w.messages.get(ids[D]).getFlag("fgt", "process")).state).toBe("react");
      const drakeBefore = w.actor(D).system.health.value;
      await finish(w, ids[D]);
      expect(w.actor(D).system.health.value).toBeLessThan(drakeBefore);
      const result = w.messages.get(ids[D]).getFlag("fgt", "result");
      expect(JSON.stringify(result)).toMatch(/[Cc]over/);
    }, at);
  }, 60_000);

  it("a Master who does not Evade is covered too (ruled 2026-10-25)", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      const ids = await declare(w);
      const before = w.actor(M).system.health.value;
      // Only Drake's Agility Check rolls a d20: the Master answers Do nothing.
      w.dice.set("d20", 20);
      await finish(w, ids[M], "nothing");
      const { coverStateFor } = await import("../../module/engine/attack.mjs");
      expect(coverStateFor(cp.deserialize(w.messages.get(ids[D]).getFlag("fgt", "process")))).toMatchObject({ masterId: M, coveringIds: [D] });
      expect(w.actor(M).system.health.value).toBe(before);
    }, at);
  }, 60_000);

  it("the shove is read against the attacker's Agility (ruled 2026-10-25)", async () => {
    await withSubjects(subjects, async ({ world: w }) => {
      const ids = await declare(w);
      // EMIYA quicker than Drake: the unfavourable table, +4. An 8 against her
      // 10 passes on the favourable table and fails here.
      await w.actor(D).update({ "system.agility.value": 10, "system.agility.max": 10 });
      await w.actor(E).update({ "system.agility.value": 15, "system.agility.max": 15 });
      w.dice.set("d20", 20, 8);
      await finish(w, ids[M], "evade");
      expect(panelOf(w, M)).toEqual({ i: 5, j: 6 });
      const { coverStateFor } = await import("../../module/engine/attack.mjs");
      expect(coverStateFor(cp.deserialize(w.messages.get(ids[D]).getFlag("fgt", "process")))).toMatchObject({ coveringIds: [D] });
    }, at);
  }, 60_000);
});
