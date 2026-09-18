/**
 * @file A Noble Phantasm costs its owner's Attack on their own Turn, and not otherwise.
 * @see docs/46-roster-re-audit.md §46.4-AZ, module/engine/budget.mjs
 *
 * The game's author states it in one line:
 *
 * > *"Every Noble Phantasm consumes the attack budget if it is used on its
 * > owner's own Turn, and none does otherwise."*
 *
 * and, on the ability that prompted it:
 *
 * > *"Rho Aias also consumes attack budget — just that, as it can be used on
 * > someone else's turn, when it is used like that, on someone else's turn, it
 * > does not consume budget."*
 *
 * So the exemption is a property of **the moment**, not of the ability. That is
 * the whole of what is asserted here, in both directions — a test that only
 * checked the reaction case would pass just as well against a
 * `countsAsAttack: false` bolted onto the content, which is the fix this rule
 * specifically rules out.
 *
 * Why it bit: a faction's budget is cleared at the START of its own Turn, not
 * the end (`engine/budget.mjs#reset`). So on an enemy's Turn the flag still
 * holds what that faction spent on its own last Turn — and a Servant who
 * attacked a Turn ago met an exhausted pool when trying to raise a *shield*.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import { withWorld } from "../helpers/world.mjs";
import { countsAsAttack } from "../../module/rules/ability-use.mjs";
import { budgetActionFor } from "../../module/rules/budget.mjs";

/** EMIYA, and a Rho Aias-shaped Noble Phantasm: no `countsAsAttack` of its own. */
const RHO_AIAS = { system: { isNP: true, isPassive: false } };

/**
 * A match where `theirs` is taking its Turn, and `f1` spent every Servant
 * attack on its own previous Turn — which `reset` has not yet cleared.
 */
const world = (actingFactionId) => ({
  actors: [
    { id: "emiya", name: "EMIYA", type: "servant", system: { factionId: "f1" } },
  ],
  combat: {
    started: true,
    round: 4,
    system: { globalTurn: 9 },
    actingFactionId,
    // The flat `scope.key` shape `getFlag` reads — and the key is `budgets`,
    // plural, which is `engine/budget.mjs`'s own `FLAG`.
    //
    // `usedHalves`/`maxHalves`, not `used`/`max`: the budget counts in halves so
    // a linked twin can weigh one. A fixture with the wrong field names reads as
    // an EMPTY pool, because `undefined + 2 > undefined` is false — a fixture
    // that proves nothing while passing. This one did, until it was caught.
    flags: {
      "fgt.budgets": {
        f1: {
          pools: {
            servantAttack: { usedHalves: 8, maxHalves: 8 },
            servantMove: { usedHalves: 0, maxHalves: 8 },
          },
          countedUnits: [],
          attackedUnits: [],
        },
      },
    },
  },
});

const emiya = { id: "emiya", kind: "servant", factionId: "f1", turnState: { tick: 9, moved: false, attacked: false } };

describe("a Noble Phantasm and whose Turn it is", () => {
  it("still counts as an Attack — the ability did not change", () => {
    // Guards against the wrong fix: exempting Rho Aias in content would make
    // this false and break the own-Turn case below.
    expect(countsAsAttack(RHO_AIAS)).toBe(true);
    expect(budgetActionFor("np")).toBe("np");
  });

  it("is free on somebody else's Turn, even with the attack pool exhausted", async () => {
    await withWorld(world("theirs"), async () => {
      const budget = await import("../../module/engine/budget.mjs");
      expect(budget.affordable(game.combats.active, emiya, "np"))
        .toMatchObject({ ok: true });
    });
  });

  it("is charged on its owner's own Turn", async () => {
    await withWorld(world("f1"), async () => {
      const budget = await import("../../module/engine/budget.mjs");
      // The pool is spent, so the owner's own Turn must refuse it. If this ever
      // passes, the exemption has leaked from the moment onto the ability.
      expect(budget.affordable(game.combats.active, emiya, "np").ok).toBe(false);
    });
  });

  it("does not exempt a move-pool action, which is free for its own reason", async () => {
    await withWorld(world("theirs"), async () => {
      const budget = await import("../../module/engine/budget.mjs");
      // A reaction Skill draws from the move pool; it is unaffected by this
      // rule and must not start taking a different path through it.
      expect(budget.affordable(game.combats.active, emiya, "skill")).toMatchObject({ ok: true });
    });
  });
});

describe("how the rule is expressed", () => {
  it("is derived from the acting faction, not from a flag on the content", () => {
    const src = readFileSync("module/engine/budget.mjs", "utf8");
    expect(src).toMatch(/actingFactionId/);
    expect(src).toMatch(/attackOutsideOwnTurn/);
  });

  it("the check and the spend ask the same question", () => {
    // Two spellings here is how an ability gets waved through by one and billed
    // by the other.
    const src = readFileSync("module/engine/budget.mjs", "utf8");
    const calls = [...src.matchAll(/attackOutsideOwnTurn\(combat, unit, action\)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("no reaction Noble Phantasm carries a countsAsAttack exemption in content", () => {
    // The author's clarification forbids this fix: it would exempt the ability
    // on its owner's Turn too.
    for (const file of ["packs/_source/abilities/emiya-rho-aias.yml",
                        "packs/_source/abilities/achilles-akhilleus-kosmos.yml"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/countsAsAttack:\s*false/);
    }
  });
});
