/**
 * @file A copy pick owed in one War is offered on that War's board only.
 * @see module/engine/copy.mjs#owedPicksHere, docs/17-abilities.md
 *
 * Found live (2026-11-02): every reload of the GM's client opened Chiron's
 * "Wisdom of Divine Gift" over the Gray Audit, though Chiron stands on Gilles
 * Audit B, another War. The load walked every actor in the world with a pick
 * owed, whatever War it was owed in, and opened the list for each. The list
 * itself could only say "Open the War's scene": the pick is not this board's.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { markCopyPicksDue, owedPicksHere } from "../../module/engine/copy.mjs";

beforeAll(prepareSubjects, 60_000);

const field = [
  { from: "scathach", id: "scathach", state: { factionId: "A" }, panel: { i: 2, j: 2 } },
  { from: "drake", id: "drake", state: { factionId: "B" }, panel: { i: 6, j: 6 } },
];
const opts = { tokens: true, combat: { round: 1, started: true, system: { globalTurn: 1 }, actingFactionId: "B" } };

describe("a copy pick owed in another War", () => {
  it("is offered on the board it was owed on", async () => {
    await withSubjects(field, async () => {
      await markCopyPicksDue({ open: false });
      expect(owedPicksHere()).toEqual([{ copierId: "scathach", grantedBy: "scathach-wisdom-of-dun-scaith" }]);
    }, opts);
  });

  it("is not offered over another War's board, and stays owed", async () => {
    await withSubjects(field, async ({ world: w }) => {
      await markCopyPicksDue({ open: false });
      // The GM now looks at a scene where she does not stand: another War.
      canvas.tokens.placeables = canvas.tokens.placeables.filter((t) => t.actor?.id !== "scathach");
      expect(owedPicksHere()).toEqual([]);
      expect(w.actor("scathach").system.copyPick.due).toBe(true);
    }, opts);
  });

  it("is not offered for a copier that owes nothing", async () => {
    await withSubjects(field, async () => {
      expect(owedPicksHere()).toEqual([]);
    }, opts);
  });
});
