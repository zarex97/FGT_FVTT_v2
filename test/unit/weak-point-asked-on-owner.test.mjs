/**
 * @file The Heel question is put to the attacker's player, on their own screen (#199).
 * @see module/engine/weak-point.mjs, docs/surprises/2026-10-12-weak-point-asked-on-gm.md, docs/44-testing.md
 *
 * Pressed live on 2026-10-12: Player1's Serenity attacked, the Attack landed on
 * Achilles, and "Aim for Achilles's weak point?" opened on the GM's page.
 * `offerWeakPoint` called `ChoiceDialog.pick` on the client running the
 * Process instead of routing through `askOwner`. No test could see it, because
 * no test could run an attack or tell one screen from another. The arena can
 * do both: this plays the whole attack, from declaration to Achilles' Heel,
 * with the question answered by whoever it is shown to.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const SERENITY = "serenityAttacker";
const ACHILLES = "achillesDefender";

describe("a player's attack into Achilles' Heel", () => {
  it("asks Player1, whose Servant attacks, and resolves the Heel Attack", async () => {
    await withSubjects([
      { from: "serenity", id: SERENITY, owner: "p1", state: { factionId: "A" }, panel: { i: 5, j: 4 } },
      // Unmounted and facing away: the attack comes from his back, 10% + 10%.
      { from: "achilles", id: ACHILLES, state: { factionId: "B", stance: "dismounted", facing: "e" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      w.answer({ title: "FGT.WeakPoint.Title", by: "p1", pick: ["heel"] });
      const { processes: [done] } = await playAttack(w, {
        attacker: SERENITY, target: ACHILLES, react: { [ACHILLES]: ["nothing", "declined"] },
      });

      expect(w.asked).toEqual([{ title: "FGT.WeakPoint.Title", kind: "choose", by: "p1", options: ["heel"] }]);
      expect(done.heel).toMatchObject({ declared: true, resolved: true, chance: 20 });
      expect(done.state).toBe("done");
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
  });
});
