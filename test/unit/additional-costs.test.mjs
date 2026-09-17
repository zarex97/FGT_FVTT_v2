/**
 * @file `additionalCosts` belong to the ABILITY, not to one of its two use paths.
 * @see module/rules/costs.mjs, docs/46-roster-re-audit.md §46.4-T
 *
 * An ability may declare standing per-use costs beyond its Noble Phantasm cost.
 * The expansion lived inside `engine/attack.mjs`, so only abilities resolved
 * through the attack flow ever paid them. Four declare costs and resolve
 * through `useSkill` instead, paying none:
 *
 *   - EMIYA's Rho Aias — *"EMIYA's Master loses Health equivalent to if an EX
 *     Rank NP is used"*
 *   - EMIYA's Unlimited Blade Works — charged as Rank B
 *   - Drake's Golden Hind: Wild Hunt
 *   - Ozymandias's Ramesseum Tentyris
 *
 * Measured live: Rho Aias taken as a reaction charged its Master **0**, where
 * `npCostAt({ rank: "EX" })` returns 100 for that Master.
 */

import { describe, it, expect } from "vitest";
import { additionalCostsFor } from "../../module/rules/costs.mjs";

const emiya = { id: "emiya", contract: "contracted", sustainability: 21 };
const master = { id: "master", rank: "C" };

describe("a stated Noble-Phantasm-rank cost", () => {
  it("charges the Master at the STATED rank, not the ability's own", () => {
    // Rho Aias prints "?" for a Rank and charges as EX.
    const ability = { system: { additionalCosts: [{ id: "rhoAiasNP", kind: "masterHealthByNPRank", rank: "EX" }] } };
    expect(additionalCostsFor({ ability, self: emiya, master })).toEqual([
      { kind: "masterHealth", amount: 100, unitId: "master", id: "rhoAiasNP", supersedes: [] },
    ]);
  });

  it("charges a different rank differently", () => {
    // Unlimited Blade Works prints `E~A++` and charges as B.
    const ability = { system: { additionalCosts: [{ id: "ubw", kind: "masterHealthByNPRank", rank: "B" }] } };
    expect(additionalCostsFor({ ability, self: emiya, master })[0].amount).toBe(50);
  });
});

describe("a fraction of the Master's maximum", () => {
  it("is computed from that Master, not from a stated number", () => {
    const ability = { system: { additionalCosts: [{ id: "rt", kind: "masterHealthFractionOfMax", fraction: 0.5 }] } };
    const withMax = { ...master, health: { max: 209 } };
    expect(additionalCostsFor({ ability, self: emiya, master: withMax })[0])
      .toMatchObject({ kind: "masterHealth", amount: 104, unitId: "master" });
  });
});

describe("a plain stated amount", () => {
  it("charges the Master by default", () => {
    const ability = { system: { additionalCosts: [{ id: "wh", kind: "masterHealth", amount: 40 }] } };
    expect(additionalCostsFor({ ability, self: emiya, master })[0])
      .toMatchObject({ amount: 40, unitId: "master" });
  });

  it("charges the SERVANT when the ability says it does not charge its Master", () => {
    const ability = { system: { additionalCosts: [{ id: "x", kind: "selfHealth", amount: 30, chargesMaster: false }] } };
    expect(additionalCostsFor({ ability, self: emiya, master })[0]).toMatchObject({ unitId: "emiya" });
  });
});

describe("edges", () => {
  it("is empty for an ability that declares none", () => {
    expect(additionalCostsFor({ ability: { system: {} }, self: emiya, master })).toEqual([]);
    expect(additionalCostsFor({ ability: null, self: emiya, master })).toEqual([]);
  });

  it("routes a FREE Servant's rank cost onto itself rather than a Master it lacks", () => {
    // The whole reason the rank cost goes through `npCostAt`.
    const free = { id: "free", contract: "free", sustainability: 12 };
    const ability = { system: { additionalCosts: [{ id: "n", kind: "masterHealthByNPRank", rank: "EX" }] } };
    expect(additionalCostsFor({ ability, self: free, master: null })[0].unitId).toBe("free");
  });
});
