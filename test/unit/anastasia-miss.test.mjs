/**
 * @file Anastasia does not miss at Range 1 to 2 while Blind (Watermelon Splitting Master).
 * @see packs/_source/abilities/anastasia-summer-watermelon.yml, module/rules/miss.mjs#missChance, module/engine/attack.mjs#runMissCheck
 *
 * > When Anastasia performs a Normal Attack at a Range of 1 to 2 while
 * > inflicted with Blind, it does not have a chance of Missing.
 *
 * Its `Suppress` asks `attack:range:lte:2`, and the Miss check asked it with
 * no defender and no attack, so the range was never there to answer: every
 * die under Blind's chance missed.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const A = "anastasiaBlind00", H = "heraclesDefender";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

/** Anastasia, Blind, swings at Heracles `j` panels away with every die on 1. */
const swing = (j) => withSubjects([
  { from: "anastasia-summer", id: A, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "blind" }] },
  { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j } },
], async ({ world: w }) => {
  w.dice.every(1);
  // Her own window at the start of the Combat Phase, declined: she is Blind already.
  w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
  const { processes } = await playAttack(w, { attacker: A, target: H, react: { [H]: ["nothing", "declined"] } });
  return processes[0].history.some((h) => h.event === "miss");
}, at);

describe("Anastasia's Watermelon Splitting Master", () => {
  it("does not miss at Range 1 while Blind", async () => {
    expect(await swing(6)).toBe(false);
  });
});
