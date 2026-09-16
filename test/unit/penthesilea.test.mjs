/**
 * @file Penthesilea, held against her sheet.
 * @see char_orig_sheets/Copia de Penthesilea.md, docs/46-roster-re-audit.md §46.10
 *
 * She is the bearer whose Mad Enhancement clause 1 is printed in full — the
 * forced deactivation AND a floor, with the floor conditional on the skill being
 * held on. That conditional is the last of the three shapes §46.4-C found in one
 * shared template.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

import { resolveRef } from "../../tools/lib/content.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { heldOn } from "../../module/rules/modes.mjs";
import { dispatch } from "../../module/engine/scheduler.mjs";
import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const servant = (id) => parse(readFileSync(`packs/_source/servants/${id}.yml`, "utf8"));
const ability = (id) => parse(readFileSync(`packs/_source/abilities/${id}.yml`, "utf8"));
const classSkill = (id) => parse(readFileSync(`packs/_source/class-skills/${id}.yml`, "utf8"));

/** Mad Enhancement as one Servant's own sheet instantiates it. */
function madEnhancementFor(id) {
  const ref = servant(id).abilities.find((a) => a.ref === "class-mad-enhancement");
  const problems = [];
  const built = resolveRef(ref, new Map([["class-mad-enhancement", classSkill("mad-enhancement")]]),
    problems, id);
  expect(problems).toEqual([]);
  return built;
}

/**
 * What this Servant's Mad Enhancement actually takes off a Master at `masterHp`,
 * with the mode held on or free to be switched off.
 *
 * Dispatched rather than inspected: the floor's VALUE is resolved at collection
 * (it needs the ability's rank) and its CONDITION at dispatch (it needs the
 * compulsion, which is a board annotation that does not exist yet when
 * contributions are collected). Reading `action.floor` would see the value and
 * miss the gate entirely — which is the bug this pair of tests exists for.
 */
function drainFrom(id, { held, masterHp }) {
  const built = madEnhancementFor(id);
  const bearer = {
    id, name: id, panel: { i: 0, j: 0 }, masterId: "master",
    abilities: [{ id: "me", slug: "madEnhancement", active: true, rank: built.rank }],
    compulsions: held ? [{ forcesSkill: "madEnhancement", targetIds: ["someone"] }] : [],
    forcedModeRules: [],
  };
  const master = { id: "master", name: "Master", health: masterHp };
  const [handler] = collectContributions([{
    id: "me", slug: "madEnhancement", rank: built.rank, active: true,
    rules: [], passiveRules: [], activeRules: built.activeRules,
  }], { options: rollOptionsFor({ attacker: bearer }) }).eventHandlers;

  const action = handler.actions.find((a) => a.kind === "StatDelta");
  const [intent] = dispatch(action, bearer, handler, { tick: 0, board: { units: [bearer, master] } });
  return intent ? -intent.delta : 0;
}

describe("`modeHeld` — switched on, and unable to be switched off", () => {
  const unit = (over) => ({
    id: "u", name: "U", panel: { i: 0, j: 0 },
    abilities: [{ id: "me", slug: "madEnhancement", active: true }],
    compulsions: [], forcedModeRules: [], ...over,
  });

  it("is true when a compulsion holds the mode", () => {
    expect(heldOn("madEnhancement",
      unit({ compulsions: [{ forcesSkill: "madEnhancement", targetIds: ["x"] }] }))).toBe(true);
  });

  it("is true when a ForceMode rule holds it", () => {
    expect(heldOn("madEnhancement", unit({
      forcedModeRules: [{ mode: "madEnhancement", when: ["self:skillActive:madEnhancement"] }],
    }))).toBe(true);
  });

  it("is false for a mode that is merely on", () => {
    expect(heldOn("madEnhancement", unit({}))).toBe(false);
  });

  it("does not recurse through the option set it is asked from", () => {
    // `heldOn` asks `forcedOn`, which tests a `ForceMode`'s `when` against a
    // fresh option set, which arrives back at `heldOn`. Measured before the
    // `withoutModeHeld` break: RangeError, for any unit carrying a ForceMode
    // rule on a mode that is on — which is Raikou, every Turn her Master stands
    // beside her.
    const raikouShaped = unit({
      forcedModeRules: [{ mode: "madEnhancement", when: ["self:skillActive:madEnhancement"] }],
    });
    expect(() => rollOptionsFor({ attacker: raikouShaped })).not.toThrow();
    expect([...rollOptionsFor({ attacker: raikouShaped })]).toContain("self:modeHeld:madEnhancement");
  });
});

describe("Mad Enhancement clause 1, as each of the six sheets prints it", () => {
  // Three shapes in one shared template. Authoring all of it for everybody gave
  // three Servants a floor their sheets do not grant and gave Heracles a forced
  // deactivation his sheet replaces with the floor (Ch. 46 §46.4-C).
  it("floors Heracles's drain at 20 whatever the mode is doing", () => {
    // A Master on 30 loses 10 and stops; his sheet states the floor with no
    // condition attached, and he is the only bearer of that shape.
    expect(drainFrom("heracles", { held: true, masterHp: 30 })).toBe(10);
    expect(drainFrom("heracles", { held: false, masterHp: 30 })).toBe(10);
  });

  it("does not floor the three whose sheets print only the deactivation", () => {
    // Asterios's Master on 30 loses the full 20 and lands on 10; the forced
    // deactivation is what stops the bleeding, not a minimum.
    for (const id of ["asterios", "castor", "kingprotea"]) {
      const full = id === "kingprotea" ? 25 : 20;
      expect(drainFrom(id, { held: true, masterHp: 30 }), id).toBe(full);
      expect(drainFrom(id, { held: false, masterHp: 30 }), id).toBe(full);
    }
  });

  it("floors Penthesilea and Raikou only while the mode is HELD", () => {
    // *"...while the Skill does not meet the condition to be deactivated, its
    // Master's Health cannot drop below 30 in this way."* Held on: a Master on
    // 40 loses 10 and stops at 30. Free: the drain runs unclamped at its full
    // 30, and the forced deactivation is what ends it.
    for (const id of ["penthesilea", "raikou"]) {
      expect(drainFrom(id, { held: true, masterHp: 40 }), id).toBe(10);
      expect(drainFrom(id, { held: false, masterHp: 40 }), id).toBe(30);
    }
  });

  it("floors at the same table the drain reads, not a literal", () => {
    // One number said twice for her: the drain and the floor are both
    // `madEnhancementDrain` at EX.
    expect(lookup("madEnhancementDrain", Rank.parse("EX"))).toBe(30);
  });
});

describe("her sheet", () => {
  const p = servant("penthesilea");

  it("matches the stat block", () => {
    expect(p.parameters).toEqual({ str: "A+", end: "B+", agi: "C", mag: "A", luc: "D" });
    expect(p.baseAttack).toEqual({ str: 160, mag: 200 });
    expect(p.mov).toBe(4);
    expect(p.range).toEqual({ panels: 2, targets: 1 });
    expect(p.alignment).toEqual({ order: "lawful", morality: "good" });
  });

  it("does not author `divine`, which her Divinity grants", () => {
    expect([...p.attributes]).toEqual(["female", "servant", "earth", "king", "humanoid"]);
  });

  it("raises her own Divinity Rank from Goddess of War, while the mode is off", () => {
    // *"Penthesilea's Divinity Rank is increased from B to A."* An ABILITY's
    // rank, not a Parameter — a different operation, and hers is the only sheet
    // in the reference set that needs it.
    const shift = ability("penthesilea-goddess-of-war").passiveRules
      .find((r) => r.key === "RankShift");

    expect(shift).toMatchObject({ ability: "divinity", to: "A" });
    expect(shift.predicate).toContain("not:self:skillActive:madEnhancement");
  });
});
