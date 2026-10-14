/**
 * @file Landing's proofs: bugs only a live press had found, replayed through whole attacks.
 * @see module/engine/landing.mjs, docs/15-effect-application.md, docs/44-testing.md
 *
 * Each of these was a path disagreeing with another about how to land an
 * authored Effect. Each test plays the attack in the test world, so it holds
 * whichever code lands the effect -- the rider loop that had the bug, and the
 * one door (`landing.mjs`) that replaced it -- to the same outcome. Each fails
 * with its original fix reverted.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const effectIds = (actor) => [...actor.effects].map((e) => e.system.defId);
const round4 = (faction) => ({ tokens: true, combat: { round: 4, started: true, system: { globalTurn: 10 }, actingFactionId: faction } });

describe("P1 — a phase's resistance exemption reaches its riders (#199 reading 11, fix 50a76fe)", () => {
  // Zabaniya's riders ignore Magic Resistance: *"cannot be resisted by Magic
  // Resistance"*. Scáthach's only resistance is her Magic Resistance (25).
  // Every die lands on 38: Skill Seal's 50% lands when the exemption holds,
  // and its 25% would not.
  it("lands Skill Seal on Scáthach through her Magic Resistance", async () => {
    const SERENITY = "serenityAttacker";
    const SCATHACH = "scathachDefender";
    await withSubjects([
      { from: "serenity", id: SERENITY, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "scathach", id: SCATHACH, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      w.dice.every(38);
      const np = [...w.actor(SERENITY).items].find((i) => i.system.slug === "zabaniya");
      const { declared } = await playAttack(w, {
        attacker: SERENITY, ability: np.id, target: SCATHACH, react: { [SCATHACH]: ["nothing", "declined"] },
      });
      const rows = w.messages.get(declared.messageId).getFlag("fgt", "effects");
      expect(rows.find((r) => r.id === "skillSeal")).toMatchObject({ outcome: "applied", chance: "rolled 38 vs 50%" });
    }, round4("A"));
  });
});

describe("P2 — a ring's chance is read wherever a rider lands (fix d162f50)", () => {
  // Triton's Conch: Deafen at 100% on the inner ring, 50% on the outer.
  // Every die lands on 70: the inner target is Deafened and the outer is not.
  it("Deafens the inner ring and resists on the outer one at 70", async () => {
    const NEMO = "nemoCaptainNemo0";
    const NEAR = "heraclesNearRing";
    const FAR = "heraclesFarRing0";
    await withSubjects([
      { from: "nemo", id: NEMO, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: NEAR, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
      { from: "heracles", id: FAR, state: { factionId: "B" }, panel: { i: 5, j: 7 } },
    ], async ({ world: w }) => {
      w.dice.every(70);
      const conch = [...w.actor(NEMO).items].find((i) => i.system.slug === "tritonsConch");
      const { declared } = await playAttack(w, {
        attacker: NEMO, ability: conch.id, placement: {},
        react: { [NEAR]: ["nothing", "declined"], [FAR]: ["nothing", "declined"] },
      });
      const rowsFor = (id) => declared.processes
        .map((p) => w.messages.get(p.messageId))
        .find((m) => JSON.parse(m.getFlag("fgt", "process")).defenderId === id)
        .getFlag("fgt", "effects");
      expect(rowsFor(NEAR).find((r) => r.id === "deafen")).toMatchObject({ outcome: "applied" });
      expect(rowsFor(FAR).find((r) => r.id === "deafen")).toMatchObject({ outcome: "resisted", chance: "rolled 70 vs 50%" });
    }, round4("A"));
  });
});

describe("P3 — Normal-Attack riders stay off a Noble Phantasm (#199, fix 62aa8fc)", () => {
  // Serenity's Projectile poisons on a successful NORMAL Attack. Pressed live,
  // her Zabaniya fired them too: the hearer's options carried an invented
  // `attack:kind:normal`. Every die lands on 1, so every rider that may fire does.
  const play = (np) => withSubjects([
    { from: "serenity", id: "serenityAttacker", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    { from: "heracles", id: "heraclesDefender", state: { factionId: "B" }, panel: { i: 5, j: 6 } },
  ], async ({ world: w }) => {
    w.dice.every(1);
    const ability = np ? [...w.actor("serenityAttacker").items].find((i) => i.system.slug === "zabaniya").id : null;
    await playAttack(w, { attacker: "serenityAttacker", ability, target: "heraclesDefender", react: { heraclesDefender: ["nothing", "declined"] } });
    return (w.combat.getFlag("fgt", "log") ?? [])
      .filter((e) => e.kind === "event" && e.source === "Projectile (Poisoned Daggers)")
      .map((e) => e.event);
  }, round4("A"));

  it("fires both Projectile riders on a Normal Attack", async () => {
    expect(await play(false)).toEqual(["damageDealt", "damageDealt"]);
  });

  it("fires neither on Zabaniya", async () => {
    expect(await play(true)).toEqual([]);
  });
});
