/**
 * @file Presence Concealment — the clauses that are decisions.
 * @see module/rules/concealment.mjs, docs/A-effect-catalogue.md §A.19
 *
 * The widest single ability in the reference set, and the one whose readers all
 * existed before anything made a Unit concealed. `system.concealed` was
 * projected by the snapshot, consulted by targeting, by the counter gate, by
 * movement legality and by the Evade ladder — and written by no code and
 * declared by no schema, so all four asked a question whose answer was always
 * `false`.
 */

import { describe, it, expect } from "vitest";
import {
  CONCEALMENT, isConcealed, reactionsRefused, aoeOutcome,
  canUseWhileConcealed, concealmentBreakChance, DEACTIVATION_REASONS,
} from "../../module/rules/concealment.mjs";

/** @param {object} over */
const unit = (over = {}) => ({
  id: "u", kind: "servant", effects: [], parameters: { agi: "A" }, ...over,
});

const concealed = (over = {}) => unit({ effects: [CONCEALMENT], ...over });

describe("the state", () => {
  it("rides the effect, not a boolean nobody writes", () => {
    expect(isConcealed(concealed())).toBe(true);
    expect(isConcealed(unit())).toBe(false);
  });
});

describe("clause 2 — Block and Counter", () => {
  // "This Unit's Attacks cannot be Blocked or Countered unless the DU's current
  // AGI Rank is equal to or higher than it."
  it("refuses both against a slower AGI Rank", () => {
    expect(reactionsRefused(concealed({ parameters: { agi: "A+" } }), unit({ parameters: { agi: "A" } })))
      .toEqual(["block", "counter"]);
  });

  it("allows both at an EQUAL rank, which is what 'or higher' means", () => {
    expect(reactionsRefused(concealed({ parameters: { agi: "A" } }), unit({ parameters: { agi: "A" } })))
      .toEqual([]);
  });

  it("allows both against a faster one", () => {
    expect(reactionsRefused(concealed({ parameters: { agi: "B" } }), unit({ parameters: { agi: "A" } })))
      .toEqual([]);
  });

  it("compares the RANK, not the Agility pool", () => {
    // The engine compared `attacker.agility > defender.agility`, which are the
    // spendable resources -- so a Servant who had paid for a few Evades became
    // blockable mid-match for no stated reason. Identical ranks, wildly
    // different pools, and the answer must not move.
    const attacker = concealed({ parameters: { agi: "A" }, agility: 9 });
    const defender = unit({ parameters: { agi: "A" }, agility: 1 });
    expect(reactionsRefused(attacker, defender)).toEqual([]);
  });

  it("refuses nothing when the attacker is not concealed", () => {
    expect(reactionsRefused(unit({ parameters: { agi: "EX" } }), unit({ parameters: { agi: "E" } })))
      .toEqual([]);
  });

  it("refuses nothing when the attacker has no AGI Rank to compare", () => {
    // No answer is not the same as "the defender loses". A Unit with no
    // parameters at all -- a structure, a platform -- keeps its reactions.
    expect(reactionsRefused(concealed({ parameters: {} }), unit({ parameters: { agi: "E" } })))
      .toEqual([]);
  });
});

describe("clause 1 — the AoE coin", () => {
  it("Heads negates the attack outright, and concealment survives", () => {
    expect(aoeOutcome(1)).toEqual({ heads: true, factor: 0, deactivates: false, effects: false });
  });

  it("Tails halves Total Damage and ends the concealment", () => {
    expect(aoeOutcome(2)).toEqual({ heads: false, factor: 0.5, deactivates: true, effects: true });
  });

  it("refuses the riders on Heads, because the clause says 'no damage AND effects'", () => {
    expect(aoeOutcome(1).effects).toBe(false);
  });
});

describe("clause 7 — Active Skills aimed at an enemy", () => {
  const skill = (over = {}) => ({
    system: {
      targeting: { selection: { relations: ["enemy"] } },
      ...over,
    },
  });

  it("refuses one that targets an enemy", () => {
    expect(canUseWhileConcealed(skill())).toEqual({ ok: false, reason: "presenceConcealment" });
  });

  it("reads `selection.relations`, which is where §9 puts them", () => {
    // Reading `relations` off the top level of the targeting spec found nothing
    // on any authored ability in the corpus, so the clause answered "aims at
    // nobody" and refused nothing at all. Found live.
    const topLevelOnly = { system: { targeting: { relations: ["enemy"] } } };
    expect(canUseWhileConcealed(topLevelOnly).ok).toBe(false);
  });

  it("allows a self-targeting Skill", () => {
    expect(canUseWhileConcealed(skill({ targeting: { selection: { relations: ["self"] } } })).ok).toBe(true);
  });

  it("allows an Attack Skill and a damaging Spell — the clause's own note", () => {
    expect(canUseWhileConcealed(skill({ isAttackSkill: true })).ok).toBe(true);
    expect(canUseWhileConcealed(skill({ damage: { multiplier: 2 } })).ok).toBe(true);
  });

  it("allows a Noble Phantasm", () => {
    expect(canUseWhileConcealed(skill({ isNP: true })).ok).toBe(true);
  });

  it("allows one that states otherwise", () => {
    // "Unless stated" -- Serenity's own Shapeshift is the single instance.
    expect(canUseWhileConcealed(skill({ usableWhileConcealed: true })).ok).toBe(true);
  });
});

describe("the price of the exemption", () => {
  it("is zero for everything that does not name one", () => {
    expect(concealmentBreakChance({ system: {} })).toBe(0);
  });

  it("is Shapeshift's 20%", () => {
    expect(concealmentBreakChance({ system: { concealmentBreakChance: 20 } })).toBe(20);
  });
});

describe("the deactivation vocabulary", () => {
  it("names all six ways it can end", () => {
    // Named rather than free text because the reason reaches the chat card, the
    // game log and the Secret Poison disclosure -- three readers that must
    // agree about what happened.
    expect(Object.keys(DEACTIVATION_REASONS).sort())
      .toEqual(["aoe", "attacked", "discovered", "expired", "manual", "skillUse"]);
  });
});
