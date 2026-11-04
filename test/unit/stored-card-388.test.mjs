/**
 * @file A Stored Card is a stranger's view (#388).
 *
 * Every write runs on the active GM, so the copy a message kept was the GM's: his
 * label, the whole breakdown, the preview and every button. A client shows that copy
 * until it draws its own, and keeps it if the drawing fails.
 *
 * War Rules: `closedInfo`, named in each case, for it decides what a stranger reads.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { prepareSubjects, withSubjects } from "../helpers/subject.mjs";
import { playAttack } from "../helpers/process.mjs";

beforeAll(prepareSubjects, 120_000);

const AT = "karnaAttacker000", DE = "heraclesDefender";
const war = (closedInfo) => ({
  tokens: true,
  combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1, closedInfo }, actingFactionId: "A" },
});
const facing = (closedInfo, check) => withSubjects([
  { from: "karna", id: AT, panel: { i: 5, j: 5 }, state: { factionId: "A" } },
  { from: "heracles", id: DE, panel: { i: 5, j: 6 }, state: { factionId: "B" } },
], async ({ world: w }) => {
  w.answer({ title: "FGT.Window.combatPhaseStart", decline: true });
  return check(w);
}, war(closedInfo));

/** The test world draws a card as the data its template was given (`world.mjs`). */
const stored = (w) => w.cards.filter((c) => c.path.endsWith("templates/chat/attack.hbs")).at(-1).data;

describe("the card a message keeps", () => {
  it("offers a stranger nothing while the Process waits", async () => {
    await facing(true, async (w) => {
      const { resolveAttack } = await import("../../module/engine/attack.mjs");
      await resolveAttack({ attackerId: AT, abilityId: null, placement: { unitId: DE, chosenIds: [DE] } });
      const card = stored(w);
      expect(card.viewer.role).toBe("observer");
      expect(card.prompt.isMine).toBe(false);
      expect(card.commandSpells).toEqual([]);
      expect(card.csPass).toBeNull();
      expect(card.countdown).toBeNull();
      expect(card.damagePreview).toBeNull();
    });
  });

  it("holds no damage and no breakdown once it lands, at a closed table", async () => {
    await facing(true, async (w) => {
      await playAttack(w, { attacker: AT, target: DE, react: { [DE]: ["nothing", "declined"] } });
      const card = stored(w);
      expect(card.viewer.role).toBe("observer");
      expect(card.result).not.toBeNull();
      expect(card.visibility.involved).toBe(false);
      expect(card.visibility.damage).toBeNull();
      expect(card.visibility.isGM).toBe(false);
    });
  });

  it("holds the damage at an open table, where a stranger reads it, and still no GM's label", async () => {
    await facing(false, async (w) => {
      await playAttack(w, { attacker: AT, target: DE, react: { [DE]: ["nothing", "declined"] } });
      const card = stored(w);
      expect(card.viewer.role).toBe("observer");
      expect(card.visibility.involved).toBe(true);
      expect(card.visibility.damage).toBeGreaterThan(0);
      expect(card.visibility.isGM).toBe(false);
    });
  });
});
