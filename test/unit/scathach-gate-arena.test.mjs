/**
 * @file Gate of Skye, played in the test world (#204 readings 15 and 18).
 * @see packs/_source/abilities/scathach-gate-of-skye.yml, module/engine/attack.mjs#evadePermit, module/engine/attack.mjs#resolveCover
 *
 * > "The only way to avoid it is through succeeding at the Luck Check it
 * > imposes." (reading 15)
 *
 * No Evade, Dodge or Substitution saves its target. And a Master can always be
 * chosen: the Servant's shove is still offered, and a failed one is no Cover —
 * the Master takes the Luck Check and the Servant no +100% (reading 18).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";
import { deserialize } from "../../module/engine/combat-process.mjs";
import { parseTick, resolveTicks } from "../../module/domain/tick.mjs";

beforeAll(prepareSubjects, 120_000);

const S = "scathachCaster00", D = "drakeDefender000";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };
/** How an effect's row on the attack card came out, or `undefined` with no row. */
const landed = (w, id) => [...w.messages.values()].flatMap((m) => m.getFlag?.("fgt", "effects") ?? []).find((e) => e.id === id)?.outcome;

/** Scáthach's Gate north over Drake, who holds `effects`; `play` scripts the dice and runs it. */
async function gate(effects, play) {
  await withSubjects([
    { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 7, j: 5 } },
    { from: "drake", id: D, state: { factionId: "B" }, panel: { i: 4, j: 5 }, effects },
  ], async ({ world: w }) => {
    const ability = [...w.actor(S).items].find((i) => i.system.contentId === "scathach-gate-of-skye");
    await w.actor(D).update({ "system.luck.max": 10, "system.luck.value": 10 });
    const attack = (react) => playAttack(w, {
      attacker: S, ability: ability.id, placement: { direction: "n", chosenIds: [D] }, react: { [D]: react },
    });
    await play(w, attack);
  }, at);
}

describe("Gate of Skye cannot be Evaded (reading 15)", () => {
  it("refuses Drake's Evade though she holds Dodge", async () => {
    await gate([{ defId: "dodge" }], async (w, attack) => {
      await expect(attack(["evade"])).rejects.toThrow(/"evade" is not available/);
    });
  }, 60_000);

  it("offers no Lucky Evasion or escape rung: her failed check is Death", async () => {
    await gate([{ defId: "dodge" }], async (w, attack) => {
      w.dice.set("d20", 20);
      const { processes: [done] } = await attack(["nothing", "declined"]);
      expect(done.forbiddenReactions).toContain("evade");
      expect(done.history.map((h) => h.state)).not.toContain("s24_luckyEvasion");
      expect(done.state).toBe("done");
      // Death is terminal: it defeats rather than staying on her.
      expect(w.actor(D).system.defeated).toBe(true);
      expect(landed(w, "death")).toBe("applied");
    });
  }, 60_000);

  it("deals its damage through Substitution when the check is passed", async () => {
    await gate([{ defId: "substitution" }], async (w, attack) => {
      const before = w.actor(D).system.health.value;
      w.dice.set("d20", 1);
      await attack(["nothing", "declined"]);
      expect(landed(w, "death")).toBeUndefined();
      expect(w.actor(D).system.defeated).toBeFalsy();
      expect(w.actor(D).system.health.value).toBeLessThan(before);
    });
  }, 60_000);
});

const M = "drakesMaster0000";

/** The Gate over Drake and her Master beside her, both chosen; `play` scripts the dice. */
async function overMaster(play) {
  await withSubjects([
    { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 7, j: 5 } },
    { from: "drake", id: D, state: { factionId: "B", masterId: M }, panel: { i: 4, j: 6 } },
    { from: "master-advanced", id: M, state: { factionId: "B" }, panel: { i: 4, j: 5 } },
  ], async ({ world: w }) => {
    const ability = [...w.actor(S).items].find((i) => i.system.contentId === "scathach-gate-of-skye");
    for (const id of [D, M]) await w.actor(id).update({ "system.luck.max": 10, "system.luck.value": 10 });
    // Agility to shove with. Like Luck, it is rolled at war setup, which a
    // subject never went through.
    await w.actor(D).update({ "system.agility.max": 12, "system.agility.value": 12 });
    const attack = () => playAttack(w, {
      attacker: S, ability: ability.id, placement: { direction: "n", chosenIds: [D, M] },
      react: { [D]: ["nothing", "declined"], [M]: ["nothing", "declined"] },
    });
    await play(w, attack);
  }, at);
}

/** The effect rows on the attack card of the Process whose defender is `id`. */
const rowsFor = (w, id) => [...w.messages.values()]
  .filter((m) => m.getFlag?.("fgt", "process") && deserialize(m.getFlag("fgt", "process")).defenderId === id)
  .flatMap((m) => m.getFlag("fgt", "effects") ?? []);

/** Every line posted under the Cover speaker. */
const coverLines = (w) => [...w.messages.values()].filter((m) => m.speaker?.alias === "FGT.Cover.Title").map((m) => m.content);

describe("a Master under Gate of Skye (reading 18)", () => {
  it("can be chosen beside its Servant, and a failed shove leaves it no Cover", async () => {
    await overMaster(async (w, attack) => {
      // Every die high: Drake's shove fails, and both Luck Checks fail.
      w.dice.every(20);
      const { processes } = await attack();
      expect(processes.map((p) => p.defenderId).sort()).toEqual([D, M].sort());
      // The Master took the Noble Phantasm: its own Luck Check, and Death --
      // on its own card, so the defeat is the check's and not the Overpower
      // coin's.
      expect(rowsFor(w, M).map((r) => [r.id, r.outcome])).toEqual([["check", "applied"], ["death", "applied"]]);
      expect(rowsFor(w, M)[0].name).toMatch(/failure/);
      expect(w.actor(M).system.defeated).toBe(true);
      // Nobody covered: no Servant was named, so no +100% on Drake.
      const cover = [...w.messages.values()].map((m) => m.getFlag?.("fgt", "cover")).find(Boolean);
      expect(cover).toMatchObject({ masterId: null, uncoveredMasterId: M, coveringIds: [] });
      expect(coverLines(w)).toHaveLength(1);
      expect(coverLines(w)[0]).toMatch(/FGT\.Cover\.Uncovered/);
    });
  }, 60_000);

  it("is shoved clear by a passed shove, and then takes nothing", async () => {
    await overMaster(async (w, attack) => {
      // Every die a 1: Drake shoves her Master out and passes her own check.
      w.dice.every(1);
      await attack();
      // Out of the area: no Luck Check, no damage, and no Overpower coin.
      expect(w.actor(M).system.defeated).toBeFalsy();
      expect(w.actor(M).system.health.value).toBe(w.actor(M).system.health.max);
      const cover = [...w.messages.values()].map((m) => m.getFlag?.("fgt", "cover")).find(Boolean);
      expect(cover).toMatchObject({ masterId: M, shoved: true });
    });
  }, 60_000);
});

const H = "heraclesDefender", ME = "medeaDefender000";

/**
 * Gate of Skye over two Units, every die a 1 so each check passes and each hit
 * lands; what Alpi left and the Gate's own cooldown after.
 */
async function alpiGate(second, withAlpi) {
  return withSubjects([
    { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 7, j: 5 }, effects: withAlpi ? [{ defId: "alpi", uses: 3 }] : [] },
    { from: "drake", id: D, state: { factionId: "B" }, panel: { i: 4, j: 5 } },
    { from: second === H ? "heracles" : "medea", id: second, state: { factionId: "B" }, panel: { i: 4, j: 7 } },
  ], async ({ world: w }) => {
    const gateItem = [...w.actor(S).items].find((i) => i.system.contentId === "scathach-gate-of-skye");
    for (const id of [D, second]) await w.actor(id).update({ "system.luck.max": 10, "system.luck.value": 10 });
    w.dice.every(1);
    await playAttack(w, {
      attacker: S, ability: gateItem.id, placement: { direction: "n", chosenIds: [D, second] },
      react: { [D]: ["nothing", "declined"], [second]: ["nothing", "declined"] },
    });
    const alpi = [...w.actor(S).effects].find((e) => e.system.defId === "alpi");
    return { uses: alpi?.system.uses ?? null, cooldown: w.actor(S).items.get(gateItem.id).system.cooldown.remaining };
  }, at);
}

describe("Alpi pays once per Attack (reading 12)", () => {
  it("spends one charge for a Gate over two Units, ½◈ off every NP", async () => {
    const [bare, paid] = [await alpiGate(ME, false), await alpiGate(ME, true)];
    const ticks = (t) => resolveTicks(parseTick(t), { turnsPerRound: 3 });
    expect(paid.uses).toBe(2);
    // The Gate it was paid by is an NP too: its own fresh cooldown loses ½◈.
    expect(bare.cooldown - paid.cooldown).toBe(ticks("½◈"));
    // ...and 1◈ when one of the two is Divine, still for one charge.
    const divine = await alpiGate(H, true);
    expect(divine.uses).toBe(2);
    expect(bare.cooldown - divine.cooldown).toBe(ticks("1◈"));
  }, 120_000);
});

/** Gáe Bolg on `from`, the Instakill's d100 set to `die`. */
async function gaeBolg(from, die, play) {
  const T = "gaeBolgTarget001";
  await withSubjects([
    { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 7, j: 5 } },
    { from, id: T, state: { factionId: "B" }, panel: { i: 5, j: 5 } },
  ], async ({ world: w }) => {
    const gb = [...w.actor(S).items].find((i) => i.system.contentId === "scathach-gae-bolg-alternative");
    w.dice.set("d100", die);
    const before = w.actor(T).system.health.value;
    const { declared } = await playAttack(w, { attacker: S, ability: gb.id, target: T, react: { [T]: ["nothing", "declined"] } });
    await play(w, { T, before, result: w.messages.get(declared.messageId).getFlag("fgt", "result") ?? null });
  }, at);
}

describe("Gáe Bolg Alternative's two branches (reading 13)", () => {
  it("deals 3.5x damage plus 100 when the Instakill misses", async () => {
    await gaeBolg("drake", 90, async (w, { T, before, result }) => {
      expect(landed(w, "instakill")).toBe("resisted");
      expect(result.total).toBeGreaterThan(0);
      expect(w.actor(T).system.health.value).toBe(before - result.total);
      const mult = result.breakdown.find((s) => s.name === "abilityMultiplier").contributors.map((c) => c.note);
      expect(mult).toEqual(["3.5× damage", "plus 100"]);
    });
  }, 60_000);

  it("deals no damage when the Instakill lands, though a revival brings Heracles back", async () => {
    await gaeBolg("heracles", 1, async (w, { T, result }) => {
      expect(landed(w, "instakill")).toBe("applied");
      // God Hand answers the Instakill: back on his feet, and the spear's
      // damage does not follow it (Guts after an Instakill means no damage).
      expect(w.actor(T).system.defeated).toBeFalsy();
      expect(result?.total ?? 0).toBe(0);
    });
  }, 60_000);
});
