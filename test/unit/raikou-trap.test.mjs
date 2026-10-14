/**
 * @file Declaring Dohatsu Tenshou does not end Tenmōkaikai: only its NP instance does.
 * @see packs/_source/abilities/raikou-dohatsu-tenshou.yml, module/engine/skill-use.mjs#runPhases, module/rules/options.mjs#ownerOptionsOf
 *
 * > *"If used while Goō Shōrai・Tenmōkaikai is Active, it is immediately ended
 * > at the end of that Combat Phase."*
 *
 * The `setMode` phase is a caster phase, so it is asked at declaration
 * (`runCasterPhases`) as well as by the attack's own pass. It is gated on
 * `attack:kind:np`, which the declaration must not be able to answer: the
 * declaration has no attack, and the clone Noble Phantasm has to survive the
 * four Normal Attacks before the fifth instance ends it (Wave B: attack
 * options only from an attack).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const R = "raikouMinamoto00";

describe("Dohatsu Tenshou's declaration", () => {
  it("leaves Tenmōkaikai running: no attack is in scope to be an NP", async () => {
    await withSubjects([
      { from: "raikou", id: R, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      const raikou = w.actor(R);
      const item = (slug) => [...raikou.items].find((i) => i.system.contentId === slug);
      await item("raikou-tenmokaikai").update({ "system.active": true });

      const { runCasterPhases } = await import("../../module/engine/skill-use.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      await runCasterPhases(item("raikou-dohatsu-tenshou"), raikou, currentBoard());

      expect(item("raikou-tenmokaikai").system.active).toBe(true);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
  });
});
