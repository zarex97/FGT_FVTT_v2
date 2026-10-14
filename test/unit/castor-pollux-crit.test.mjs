/**
 * @file Castor's buff pays on a Crit, Pollux's on anything but (Dioscuri, Stars of the Chief God).
 * @see packs/_source/effects/castor-buff.yml, packs/_source/effects/pollux-buff.yml, module/engine/attack.mjs#fireDamageStepEnd
 *
 * > Castor: when the affected Unit performs a Normal Attack that is a Crit,
 * > reduce that Unit's NP Cooldown by 1 Turn.
 * > Pollux: ... a Normal Attack that is not a Crit ... S.Crit Up.
 *
 * Both hang off `damageStepEnd`, whose option set never said whether the
 * attack crit: Castor's could never pay, and Pollux's paid on every Crit too.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const H = "heraclesAttacker", M = "medeaDefender000";
const at = { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } };

/** A Normal Attack by Heracles, carrying both buffs; `face` decides the Crit. */
const swing = (face, check) => withSubjects([
  { from: "heracles", id: H, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "castorBuff" }, { defId: "polluxBuff" }] },
  { from: "medea", id: M, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
], async ({ world: w }) => {
  // Every die on 1 lands the Crit; every die on its highest face does not.
  w.dice.every(face);
  await playAttack(w, { attacker: H, target: M, react: { [M]: ["nothing", "declined"] } });
  const fired = (game.combat.getFlag("fgt", "log") ?? [])
    .filter((e) => e.kind === "event" && e.event === "damageStepEnd").map((e) => e.source);
  await check({ w, fired });
}, at);

describe("the Dioscuri buffs read whether the attack crit", () => {
  it("Castor's pays on a Crit and Pollux's does not", async () => {
    await swing(1, async ({ fired }) => {
      expect(fired).toContain("castorBuff");
      expect(fired).not.toContain("polluxBuff");
    });
  });
});

describe("and without a Crit", () => {
  it("Pollux's pays and Castor's does not", async () => {
    await swing(100, async ({ fired }) => {
      expect(fired).toContain("polluxBuff");
      expect(fired).not.toContain("castorBuff");
    });
  });
});

describe("a hit for 0 is still a hit (#204 LI)", () => {
  it("Pollux's pays though Invuln took every point", async () => {
    // Ruled 2026-10-14: `damageStepEnd` fires at 0 damage, as App. E says. It
    // read `result.total > 0`, so a Blocked or Invuln defender paid nothing.
    await withSubjects([
      { from: "heracles", id: H, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "polluxBuff" }] },
      { from: "medea", id: M, state: { factionId: "B" }, panel: { i: 5, j: 6 }, effects: [{ defId: "invuln" }] },
    ], async ({ world: w }) => {
      w.dice.every(100);
      const { declared } = await playAttack(w, { attacker: H, target: M, react: { [M]: ["nothing", "declined"] } });
      expect(w.messages.get(declared.messageId).getFlag("fgt", "damage")).toBe(0);
      const fired = (game.combat.getFlag("fgt", "log") ?? [])
        .filter((e) => e.kind === "event" && e.event === "damageStepEnd").map((e) => e.source);
      expect(fired).toContain("polluxBuff");
    }, at);
  });
});
