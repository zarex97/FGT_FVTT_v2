/**
 * @file Kiritsugu's pre-shot Thaumaturgy Spell is offered to his player, and cast.
 * @see module/engine/attack.mjs#offerPreAttackSpell, packs/_source/abilities/kiritsugu-suppression-shot.yml
 *
 * *"Kiritsugu can use a Thaumaturgy Spell once before performing this Normal
 * Attack."* The offer asked `askOwner(owner, {title, options})` with no `kind`,
 * so the receiving client logged "No renderer for prompt kind undefined" and
 * answered `null`: no window, and the spell was never cast. Found by the arena
 * the first time it played this reaction (Wave A); no test could run it before.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const HERACLES = "heraclesAttacker";
const MEDEA = "medeaDefender000";
const KIRITSUGU = "kiritsuguShooter";

describe("Return Fire's spell before the shot", () => {
  it("asks Player1 which spell, and casts the one picked", async () => {
    await withSubjects([
      { from: "heracles", id: HERACLES, state: { factionId: "B" }, panel: { i: 5, j: 4 } },
      // Carrying his Decoy, so Return Fire answers the attack on her.
      { from: "medea", id: MEDEA, state: { factionId: "A" }, panel: { i: 5, j: 5 }, effects: [{ defId: "decoyScapegoat" }] },
      { from: "kiritsugu", id: KIRITSUGU, owner: "p1", state: { factionId: "A" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      const kiritsugu = w.actor(KIRITSUGU);
      const slug = (s) => [...kiritsugu.items].find((i) => i.system.slug === s);
      const shot = slug("suppressionShot");
      const reinforcement = slug("reinforcement");

      // Reinforcement is also his only attacker-side window spell; cast here, it
      // is on Cooldown by the time the shot is declared, so no window follows.
      w.answer({ title: "FGT.Kiritsugu.PreShotSpell", by: "p1", pick: [reinforcement.id] });

      const { resolveAttack, advanceAttack } = await import("../../module/engine/attack.mjs");
      const declared = await resolveAttack({ attackerId: HERACLES, abilityId: null, placement: { unitId: MEDEA, chosenIds: [MEDEA] } });
      await advanceAttack({ messageId: declared.messageId, event: `ability:${shot.id}` });

      const spell = w.asked.find((q) => q.title === "FGT.Kiritsugu.PreShotSpell");
      expect(spell).toMatchObject({ kind: "choose", by: "p1" });
      expect(spell.options).toContain(reinforcement.id);
      expect(kiritsugu.items.get(reinforcement.id).system.cooldown.remaining).toBeGreaterThan(0);
    }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "B" } });
  });
});
