/**
 * @file A thrown Noble Phantasm says so, and Rho Aias can hear it.
 * @see module/engine/attack.mjs#buildAttackSpec, module/rules/options.mjs, module/engine/shield.mjs
 *
 * > If the NP is a 'thrown weapon', Rho Aias' Health cannot drop below 1.
 *
 * The shield has asked `attack:thrownWeapon` (`poolFloorWhen`) since it was
 * written, and no attack ever carried it. A damage block now states it
 * (`damage.thrownWeapon`). No content Noble Phantasm is marked yet -- which
 * ones throw is the author's ruling (Wave B) -- so the NP here is the test's own.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const H = "heraclesThrower0", M = "medeaDefender000";

describe("a thrown Noble Phantasm", () => {
  it("carries attack:thrownWeapon from its damage block to the option set", async () => {
    await withSubjects([
      { from: "heracles", id: H, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "medea", id: M, state: { factionId: "B" }, panel: { i: 5, j: 6 } },
    ], async ({ world: w, unit }) => {
      const { buildAttackSpec, describeAttack } = await import("../../module/engine/attack.mjs");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const board = currentBoard();
      const options = (damage) => {
        const np = { id: "testThrown", name: "Test Spear", type: "noblePhantasm", system: { isNP: true, damage } };
        const attack = buildAttackSpec({ attacker: w.actor(H), ability: np, abilityId: np.id, options: new Set(), board });
        return describeAttack({ state: { attack }, attacker: unit(H), defender: unit(M), board, ability: np }).options;
      };
      expect(options({ multiplier: 2, thrownWeapon: true }).has("attack:thrownWeapon")).toBe(true);
      expect(options({ multiplier: 2 }).has("attack:thrownWeapon")).toBe(false);
    }, { tokens: true });
  });

  it("is marked on no content Noble Phantasm yet", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const marked = readdirSync("packs/_source/abilities")
      .filter((f) => /thrownWeapon:\s*true/.test(readFileSync(`packs/_source/abilities/${f}`, "utf8")));
    expect(marked).toEqual([]);
  });
});
