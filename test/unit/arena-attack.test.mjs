/**
 * @file A whole Normal Attack, played in the test world from declaration to damage.
 * @see test/helpers/process.mjs, module/engine/attack.mjs, docs/21-combat-process.md, docs/44-testing.md
 *
 * No test ran `resolveAttack` or `advanceAttack` before the arena: a Process
 * keeps its state in a chat message and rolls Foundry's dice, and the test
 * world had neither. This is the smallest whole one — Heracles strikes Medea,
 * she takes it and declines to Counter — held to what the table would see: the
 * card, the dice, and her Health.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const HERACLES = "heraclesAttacker";
const MEDEA = "medeaDefender000";

describe("a Normal Attack in the arena", () => {
  it("resolves to damage on the defender, through the card and the dice", async () => {
    await withSubjects([
      { from: "heracles", id: HERACLES, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "medea", id: MEDEA, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      const before = w.actor(MEDEA).system.health.value;
      const { declared, processes: [done] } = await playAttack(w, {
        attacker: HERACLES, target: MEDEA, react: { [MEDEA]: ["nothing", "declined"] },
      });

      expect(done.state).toBe("done");
      const { total } = w.messages.get(declared.messageId).getFlag("fgt", "result");
      expect(total).toBeGreaterThan(0);
      expect(w.actor(MEDEA).system.health.value).toBe(before - total);
      expect(w.cards.map((c) => c.path)).toContain("systems/fgt/templates/chat/attack.hbs");
      // His Normal Attack rolls the crit d100 and 5d10 for its damage.
      expect(w.rolls.map((r) => r.formula)).toEqual(expect.arrayContaining(["1d100", "5d10"]));
      expect(w.actor(HERACLES).system.turnState).toMatchObject({ attacked: true, acted: true });
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});
