/**
 * Def Dwn (A) and (C) drain once per successful Attack (#239 reading 3, ruled
 * 2026-10-17 for every Def Dwn (A) and (C)), pressed in the arena: what only a
 * whole Combat Process shows.
 * @see docs/46-roster-re-audit.md §46.4-OZ
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const E = "emiyaAttacker000";
const H = "heraclesDefender";
const opts = { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } };
const itemOf = (w, id, contentId) => [...w.actor(id).items].find((i) => i.system?.contentId === contentId);

/** Heracles three panels from EMIYA, holding Def Dwn (C) and (A) or not (the control). */
const board = (debuffed = true) => [
  { from: "emiya", id: E, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
  { from: "heracles", id: H, state: { factionId: "B", agility: { value: 15, max: 15 }, luck: { value: 10, max: 10 } },
    panel: { i: 5, j: 8 },
    effects: debuffed ? [{ defId: "defDwnC", expiry: 20, magnitude: 20 }, { defId: "defDwnA", expiry: 20, magnitude: 20 }] : [] },
];

/** Agility and Luck after `play`, with and without the two debuffs: an Injury takes Agility too, so the difference is theirs. */
const drained = async (play) => {
  const out = [];
  for (const debuffed of [false, true]) {
    await withSubjects(board(debuffed), async ({ world: w }) => {
      w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
      w.dice.every(50);
      await play(w);
      out.push({ agility: w.actor(H).system.agility.value, luck: w.actor(H).system.luck.value });
    }, opts);
  }
  return { agility: out[0].agility - out[1].agility, luck: out[0].luck - out[1].luck };
};

describe("Def Dwn (A) and (C): once per successful Attack (#239 readings 3a to 3c)", () => {
  it("Overedge's two swings drain one Agility and one Luck, not two", async () => {
    let processes = 0;
    const d = await drained(async (w) => {
      const { declared } = await playAttack(w, {
        attacker: E, ability: itemOf(w, E, "emiya-overedge").id, target: H,
        react: { [H]: ["nothing", "nothing", "declined", "declined"] },
      });
      processes = (declared.processes ?? []).length;
    });
    expect(processes).toBe(2);
    // Per hit, as `damageTaken` drained before the ruling, this read 2 and 2.
    expect(d).toEqual({ agility: 1, luck: 1 });
  }, 120_000);

  it("a Blocked Normal Attack is a successful Attack and drains", async () => {
    const d = await drained((w) => playAttack(w, { attacker: E, target: H, react: { [H]: ["block", "declined"] } }));
    expect(d).toEqual({ agility: 1, luck: 1 });
  }, 120_000);
});
