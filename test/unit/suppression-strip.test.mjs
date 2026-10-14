/**
 * @file Kiritsugu's Suppression, played in the test world.
 * @see packs/_source/effects/suppression.yml, module/engine/scheduler.mjs, docs/E-event-reference.md
 *
 * > Successful Normal Attacks remove 1 buff from the Defending Unit at the
 * > start of the Damage Step; if a buff was successfully removed, apply Atk Up
 * > for 1◈ Turns to Kiritsugu, all damage dealt is increased by 15%; if NP, 5%.
 *
 * Written before Suppression moved from its own runner onto `fireEvent`
 * (Wave B), and kept: the strip must land before the damage reads the
 * defender, the Atk Up only follows a strip, and a use is spent only by a strip.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const K = "kiritsuguShooter", H = "heraclesDefender";
const at = (round, faction) => ({ tokens: true, combat: { round, started: true, system: { globalTurn: round * 3 }, actingFactionId: faction } });
const held = (w, id, defId) => [...w.actor(id).effects].filter((e) => e.system.defId === defId);

/** Kiritsugu, holding Suppression with 5 uses, shoots Heracles. */
const shoot = (heraclesEffects, check) => withSubjects([
  { from: "kiritsugu", id: K, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "suppression", uses: 5 }] },
  { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 6 }, effects: heraclesEffects },
], async ({ world: w }) => {
  w.dice.every(50);
  // His own window at the start of the Combat Phase, declined.
  w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
  await playAttack(w, { attacker: K, target: H, react: { [H]: ["nothing", "declined"] } });
  await check(w);
}, at(6, "A"));

describe("Kiritsugu's Suppression", () => {
  it("strips one buff, grants Atk Up, and spends a use", async () => {
    await shoot([{ defId: "defUp", magnitude: 20 }], async (w) => {
      expect(held(w, H, "defUp")).toHaveLength(0);
      expect(held(w, K, "atkUp").map((e) => e.system.magnitude)).toEqual([15]);
      expect(held(w, K, "suppression")[0].system.uses).toBe(4);
    });
  });

  it("grants nothing and spends nothing when there is no buff to take", async () => {
    await shoot([], async (w) => {
      expect(held(w, K, "atkUp")).toHaveLength(0);
      expect(held(w, K, "suppression")[0].system.uses).toBe(5);
    });
  });
});
