/**
 * @file Rho Aias against an NP's riders, and "categorized as NP" for every NP rule (#208, ruled 2026-10-16).
 * @see module/engine/shield.mjs#ridersHeldBy, module/engine/attack.mjs#applyAbilityEffects, module/rules/options.mjs
 *
 * > "EMIYA projects Rho Aias to protect the allied Unit(s) from the Noble Phantasm."
 *
 * The whole NP, not only its damage. While the barrier holds, the NP's riders on a covered Unit are dropped; when the
 * hit breaks it, they land after the damage. Kept back, they shape nothing: a Def Down "first" does not raise the hit
 * the barrier takes, and a held Instakill is not inflicted, so Gáe Bolg Alternative's damage runs into the barrier.
 * A rider from a check the Unit fails is not held: Gate of Skye's Death is avoided by the Luck Check alone.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const E = "emiyaProjector00", D2 = "heraclesProtected", N = "medeaNeighbour00", M = "emiyasMaster0000";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

const itemOf = (w, id, contentId) => [...w.actor(id).items].find((i) => i.system?.contentId === contentId);
const held = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system?.defId === defId);
/** Every rider row the attack cards filed. */
const rows = (w) => [...w.messages.values()].flatMap((m) => m.getFlag?.("fgt", "effects") ?? []);
const row = (w, id) => rows(w).find((e) => e.id === id);
/** The test world hands back the lang key; the game prints "Rho Aias holds" (`lang/en.json`). */
const HOLDS = expect.stringMatching(/Holds|holds/);

/** `attacker` hits Heracles while EMIYA, beside him, may project Rho Aias. */
const board = (attacker, atkUp) => [
  { from: attacker.from, id: attacker.id, state: { factionId: "A" }, panel: { i: 5, j: 5 },
    effects: atkUp ? [{ defId: "atkUp", magnitude: atkUp, npMagnitude: atkUp }] : [] },
  { from: "heracles", id: D2, state: { factionId: "B" }, panel: { i: 5, j: 9 } },
  { from: "emiya", id: E, state: { factionId: "B", masterId: M }, panel: { i: 5, j: 10 } },
  { from: "medea", id: N, state: { factionId: "B" }, panel: { i: 4, j: 9 } },
  { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 5, j: 12 } },
];

/**
 * Play `abilityContentId` on Heracles, with Rho Aias taken (or not), and hand back the board.
 * @param {{from: string, id: string}} attacker
 * @param {string} abilityContentId
 * @param {{rho?: boolean, atkUp?: number, die?: number}} how
 * @param {Function} check
 */
const play = async (attacker, abilityContentId, { rho = true, atkUp = 900, die = 99 }, check) =>
  withSubjects(board(attacker, atkUp), async ({ world: w }) => {
    w.dice.every(die);
    // Anastasia is offered Watermelon at the start of her Combat Phase; Scáthach has nothing there.
    if (attacker.from === "anastasia-summer") w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
    const np = itemOf(w, attacker.id, abilityContentId);
    const hp = w.actor(D2).system.health.value;
    const emiyaHp = w.actor(E).system.health.value;
    const rhoId = itemOf(w, E, "emiya-rho-aias").id;
    const { declared } = await playAttack(w, {
      attacker: attacker.id, ability: np.id, target: D2,
      react: { [D2]: rho ? [`ability:${rhoId}`, "declined"] : ["nothing", "declined"] },
    });
    const result = w.messages.get(declared.messageId).getFlag("fgt", "result");
    await check({ w, result, hp, emiyaHp });
  }, at);

const SC = { from: "scathach", id: "scathachThrower0" };
const AN = { from: "anastasia-summer", id: "anastasiaThrower" };

describe("Rho Aias holds Gáe Bolg Alternative's riders, and its damage runs into the barrier (Q2, Q6)", () => {
  it("Stun and Instakill are stopped, and the card says the barrier held", async () => {
    await play(SC, "scathach-gae-bolg-alternative", { die: 99 }, ({ w, result, hp, emiyaHp }) => {
      // At cf20cfc: Stun "applied" on Heracles through the barrier.
      expect(row(w, "stun")).toMatchObject({ outcome: "blocked", reason: HOLDS });
      expect(row(w, "instakill")).toMatchObject({ outcome: "blocked", reason: HOLDS });
      expect(held(w, D2, "stun")).toHaveLength(0);
      expect(itemOf(w, E, "emiya-rho-aias").system.shieldHealth).toBe(1);
      expect(result.total).toBe(0);
      expect(w.actor(D2).system.health.value).toBe(hp);
      expect(w.actor(E).system.health.value).toBe(emiyaHp - 600);
    });
  }, 90_000);

  it("an Instakill that would have landed is not inflicted, so the 3.5x damage runs and the barrier takes it", async () => {
    await play(SC, "scathach-gae-bolg-alternative", { die: 1 }, ({ w, result, hp, emiyaHp }) => {
      // At cf20cfc: Instakill landed (die 1 under 75%), the damage was skipped and God Hand answered.
      expect(row(w, "instakill")?.outcome).toBe("blocked");
      expect(result.flags.suppressedBy).toBeUndefined();
      expect(result.flags.shieldAbsorbed).toBeGreaterThan(0);
      expect(w.actor(D2).system.defeated).toBeFalsy();
      expect(w.actor(D2).system.health.value).toBe(hp);
      expect(w.actor(E).system.health.value).toBe(emiyaHp - 600);
    });
  }, 90_000);
});

describe("a barrier the NP breaks lets its riders land after the damage, and they do not raise it (Q2, Q5)", () => {
  it("Snegleta breaks it: Def Dwn (A) lands after, and the hit is the size it is without Def Dwn (A)", async () => {
    let unshielded = 0;
    // Def Dwn (A)'s 55% lands on a die of 1, wherever in the order it is rolled; both runs see the same dice.
    await play(AN, "anastasia-summer-snegleta", { rho: false, die: 1 }, ({ w, result }) => {
      expect(row(w, "defDwnA")?.outcome).toBe("applied");
      unshielded = result.total;
    });
    await play(AN, "anastasia-summer-snegleta", { die: 1 }, ({ w, result, emiyaHp }) => {
      expect(itemOf(w, E, "emiya-rho-aias").system.shieldHealth).toBe(0);
      expect(result.flags.barrierBroken).toBe(true);
      expect(row(w, "defDwnA")?.outcome).toBe("applied");
      expect(held(w, D2, "defDwnA")).toHaveLength(1);
      expect(w.actor(E).system.health.value).toBe(emiyaHp - 700);
      // Without the barrier, Def Dwn (A) lands first and is worth +30% of this hit; behind it, it was held.
      const behind = result.total + result.flags.shieldAbsorbed;
      expect(behind).toBeLessThan(unshielded);
      expect(Math.round(behind * 1.3)).toBeGreaterThanOrEqual(Math.floor(unshielded * 0.95));
    });
  }, 180_000);

  it("Snegleta without the Atk Up does not break it: Def Dwn (A) is dropped and Heracles takes nothing", async () => {
    await play(AN, "anastasia-summer-snegleta", { atkUp: 0, die: 1 }, ({ w, result, hp }) => {
      expect(result.flags.barrierBroken).toBeUndefined();
      expect(itemOf(w, E, "emiya-rho-aias").system.shieldHealth).toBeGreaterThan(0);
      expect(row(w, "defDwnA")).toMatchObject({ outcome: "blocked", reason: HOLDS });
      expect(held(w, D2, "defDwnA")).toHaveLength(0);
      expect(w.actor(D2).system.health.value).toBe(hp);
    });
  }, 90_000);
});

describe("Rho Aias cannot stop Gate of Skye's Death: only the Luck Check saves (Q11, #204 reading 15)", () => {
  const S = "scathachCaster00", D = "drakeDefender000", EM = "emiyaBesideDrake", MM = "emiyasMasterSkye";

  /** Scáthach's Gate north over Drake; EMIYA, three panels from her and outside the area, projects Rho Aias. */
  const gate = async (d20, check) => withSubjects([
    { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 7, j: 5 } },
    { from: "drake", id: D, state: { factionId: "B" }, panel: { i: 4, j: 5 } },
    { from: "emiya", id: EM, state: { factionId: "B", masterId: MM }, panel: { i: 4, j: 8 } },
    { from: "master-advanced", id: MM, state: { factionId: "B" }, panel: { i: 1, j: 10 } },
  ], async ({ world: w }) => {
    const ability = itemOf(w, S, "scathach-gate-of-skye");
    await w.actor(D).update({ "system.luck.max": 10, "system.luck.value": 10 });
    w.dice.set("d20", d20);
    const hp = w.actor(D).system.health.value;
    const rhoId = itemOf(w, EM, "emiya-rho-aias").id;
    const { declared } = await playAttack(w, {
      attacker: S, ability: ability.id, placement: { direction: "n", chosenIds: [D] },
      react: { [D]: [`ability:${rhoId}`, "declined"] },
    });
    await check({ w, hp, result: w.messages.get(declared.messageId).getFlag("fgt", "result") });
  }, at);

  it("a failed check is Death through the barrier", async () => {
    await gate(20, ({ w }) => {
      expect(row(w, "death")?.outcome).toBe("applied");
      expect(w.actor(D).system.defeated).toBe(true);
    });
  }, 90_000);

  it("a passed check's 4x damage is the barrier's to take", async () => {
    await gate(1, ({ w, hp, result }) => {
      expect(row(w, "death")).toBeUndefined();
      expect(result.flags.shieldAbsorbed).toBeGreaterThan(0);
      expect(w.actor(D).system.health.value).toBe(hp);
    });
  }, 90_000);
});

describe("an attack categorized as an NP is an NP for every NP rule (Q3, Q8, Q9)", () => {
  const H = "heraclesTarget00";

  it("Rho Aias is offered against Overedge, and not against a bare swing", async () => {
    const { allyReactions } = await import("../../module/rules/reactions.mjs");
    await withSubjects([
      { from: "heracles", id: D2, state: { factionId: "B" }, panel: { i: 5, j: 9 } },
      { from: "emiya", id: E, state: { factionId: "B", masterId: M }, panel: { i: 5, j: 10 } },
      { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 5, j: 12 } },
    ], ({ world: w, unit, board }) => {
      const offered = (attack) => allyReactions({ defender: unit(D2), board, attack, actorFor: (id) => w.actor(id) })
        .map((a) => a.ability.system.contentId);
      // At cf20cfc `againstKind: np` compared `kind` alone, and Overedge's is `attackSkill`.
      expect(offered({ kind: "attackSkill", categorizedAsNP: true })).toContain("emiya-rho-aias");
      expect(offered({ kind: "normal" })).not.toContain("emiya-rho-aias");
      expect(offered({ kind: "np" })).toContain("emiya-rho-aias");
    }, at);
  }, 60_000);

  it("NP DmUp reaches an Overedge swing, which still carries attack:kind:normal (Q8)", async () => {
    const { installClientNamespace } = await import("../helpers/client-namespace.mjs");
    installClientNamespace();
    const { buildAttackSpec } = await import("../../module/engine/attack.mjs");
    const { rollOptionsFor } = await import("../../module/rules/options.mjs");
    const { test: testPredicate } = await import("../../module/rules/predicate.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    await withSubjects([
      { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
    ], ({ world: w, unit, board }) => {
      const item = itemOf(w, E, "emiya-overedge");
      const declared = buildAttackSpec({
        attacker: w.actor(E), ability: item, abilityId: item.id,
        options: rollOptionsFor({ attacker: unit(E), defender: unit(H) }), board,
      });
      const options = rollOptionsFor({ attacker: unit(E), defender: unit(H), attack: { ...declared, range: 3 } });
      const npDmUp = EffectRegistry.get("npDmUp").rules.find((r) => r.predicate);
      expect(testPredicate(npDmUp.predicate, { options })).toBe(true);
      expect(options.has("attack:kind:normal")).toBe(true);
    });
  }, 60_000);

  it("an NP with no damage opens no attack, so Rho Aias is never offered against it (Q4, Q9)", async () => {
    const { classifyAbility } = await import("../../module/rules/ability-use.mjs");
    const { parse } = await import("yaml");
    const { readFileSync } = await import("node:fs");
    const np = parse(readFileSync("packs/_source/abilities/nursery-queens-glass-game.yml", "utf8"));
    expect(np.isNP).toBe(true);
    expect(classifyAbility({ type: "noblePhantasm", system: np }).isAttack).toBe(false);
  });
});
