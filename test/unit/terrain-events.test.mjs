/**
 * @file Terrain's periodic and on-entry clauses.
 * @see docs/42-terrain.md §42.2, docs/45-implementation-status.md C1
 *
 * C1 shipped the *standing* modifiers — what terrain does to a unit while it
 * stands there. This is the other half: what terrain does to it at a boundary,
 * or the moment it steps on.
 */

import { describe, it, expect } from "vitest";
import { terrainPeriodics, terrainOnEntry, terrainConversions } from "../../module/rules/terrain.mjs";

const at = (i, j) => ({ i, j });
const boardWith = (type, panels = [at(0, 0)]) => ({
  bounds: { rows: 13, columns: 13 }, units: [],
  terrain: { areas: [{ id: "t1", type, panels }] },
});
const unit = (over = {}) => ({
  id: "u", panel: at(0, 0), attributes: [], effects: [], effectInstances: [], ...over,
});

describe("terrainPeriodics", () => {
  it("inflicts Burn on everyone in a Burning area at turn end", () => {
    const out = terrainPeriodics([unit()], boardWith("burning"), "turnEnd");

    expect(out).toContainEqual(expect.objectContaining({
      kind: "applyEffect", unitId: "u", effectId: "burn",
    }));
  });

  it("makes that Burn unremovable while the unit is inside", () => {
    // "While inside, this Burn does not expire and cannot be removed."
    const out = terrainPeriodics([unit()], boardWith("burning"), "turnEnd");

    expect(out[0]).toMatchObject({ unremovable: true, duration: null });
  });

  it("spares a unit that resists Burn or Fire", () => {
    // "Units with ANY resistance to Burn or Fire damage are not inflicted."
    const resistant = unit({ effects: ["flamHeal"] });

    expect(terrainPeriodics([resistant], boardWith("burning"), "turnEnd")).toEqual([]);
  });

  it("deals fixed Fire damage in a Burning area", () => {
    const out = terrainPeriodics([unit({ acted: true })], boardWith("burning"), "turnEnd");

    expect(out).toContainEqual(expect.objectContaining({
      kind: "damage", unitId: "u", amount: 25, element: "fire",
    }));
  });

  it("poisons an unpoisoned unit in a Poison Swamp at turn end", () => {
    const out = terrainPeriodics([unit()], boardWith("poisonSwamp"), "turnEnd");

    expect(out).toContainEqual(expect.objectContaining({ kind: "applyEffect", effectId: "poison" }));
  });

  it("does not re-poison a unit that is already Poisoned", () => {
    // "every unit inside that is NOT already Poisoned is inflicted."
    const poisoned = unit({ effects: ["poison"] });
    const out = terrainPeriodics([poisoned], boardWith("poisonSwamp"), "turnEnd");

    expect(out.some((e) => e.kind === "applyEffect" && e.effectId === "poison")).toBe(false);
  });

  it("offers an extra Poison stage to a unit already Poisoned", () => {
    const poisoned = unit({ effects: ["poison"] });
    const out = terrainPeriodics([poisoned], boardWith("poisonSwamp"), "turnEnd");

    expect(out).toContainEqual(expect.objectContaining({ kind: "chance", percent: 50, then: "poisonStage" }));
  });

  it("stuns on a coin flip at the start of a turn in an Eldritch area", () => {
    const out = terrainPeriodics([unit()], boardWith("eldritch"), "turnStart");

    expect(out).toContainEqual(expect.objectContaining({ kind: "chance", percent: 50, then: "stun" }));
  });

  it("gives a unit standing on nothing no periodics at all", () => {
    expect(terrainPeriodics([unit({ panel: at(9, 9) })], boardWith("burning"), "turnEnd")).toEqual([]);
  });

  it("fires only at the boundary each clause names", () => {
    // Eldritch's stun is a turn-START effect; asking at turn end must not fire it.
    expect(terrainPeriodics([unit()], boardWith("eldritch"), "turnEnd")).toEqual([]);
  });
});

describe("terrainOnEntry", () => {
  it("burns a unit that steps onto Lava", () => {
    const out = terrainOnEntry(unit(), at(0, 0), boardWith("lava"));

    expect(out).toContainEqual(expect.objectContaining({ kind: "damage", amount: 20, element: "fire" }));
    expect(out).toContainEqual(expect.objectContaining({ kind: "chance", percent: 50, then: "burn" }));
  });

  it("demands an Agility Check from a unit stepping onto Frozen ground", () => {
    const out = terrainOnEntry(unit(), at(0, 0), boardWith("frozen"));

    expect(out).toContainEqual(expect.objectContaining({ kind: "check", check: "agility", onFail: "cannotAct" }));
  });

  it("immobilizes a Mechanical unit on Magnetic ground without fail", () => {
    // "25% chance ... 100% for units with the Mechanical attribute."
    const mech = unit({ attributes: ["mechanical"] });

    expect(terrainOnEntry(mech, at(0, 0), boardWith("magnetic")))
      .toContainEqual(expect.objectContaining({ percent: 100, then: "immobilize" }));
  });

  it("gives a non-Mechanical unit the ordinary chance", () => {
    expect(terrainOnEntry(unit(), at(0, 0), boardWith("magnetic")))
      .toContainEqual(expect.objectContaining({ percent: 25, then: "immobilize" }));
  });

  it("marks Magnetic immobilization as ignoring debuff resistance", () => {
    // "NOT affected by Debuff Immune or any debuff-resist modifier, except
    // Style Change" — so it must bypass the application gate.
    expect(terrainOnEntry(unit(), at(0, 0), boardWith("magnetic"))[0])
      .toMatchObject({ bypassesResistance: true });
  });

  it("does nothing when the panel entered has no terrain", () => {
    expect(terrainOnEntry(unit(), at(9, 9), boardWith("lava"))).toEqual([]);
  });
});

describe("terrainConversions", () => {
  it("turns Forest to Burning when Fire damage lands there, on Tails", () => {
    // "flip a coin. On Tails the 3x3 around the DU becomes Burning for 2 turns
    // — and does not revert to Forest afterwards."
    const out = terrainConversions({
      defender: unit(), board: boardWith("forest"), element: "fire", coin: "tails",
    });

    expect(out).toEqual([expect.objectContaining({
      kind: "convertTerrain", to: "burning", reverts: false,
    })]);
  });

  it("leaves the Forest alone on Heads", () => {
    expect(terrainConversions({
      defender: unit(), board: boardWith("forest"), element: "fire", coin: "heads",
    })).toEqual([]);
  });

  it("converts the whole attack area when it is larger than 3x3", () => {
    // "Larger than 3x3" means larger than NINE panels, so a 5-panel line does
    // not qualify however long it looks — a 5x5 does.
    const fiveByFive = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) fiveByFive.push(at(i, j));

    const out = terrainConversions({
      defender: unit(), board: boardWith("forest"), element: "fire", coin: "tails",
      areaPanels: fiveByFive,
    });

    expect(out[0].panels).toHaveLength(25);
  });

  it("keeps the 3x3 when the attack area is smaller than it", () => {
    const out = terrainConversions({
      defender: unit(), board: boardWith("forest"), element: "fire", coin: "tails",
      areaPanels: [at(0, 0), at(0, 1)],
    });

    expect(out[0].panels).toHaveLength(9);
  });

  it("ignores a non-Fire attack", () => {
    expect(terrainConversions({
      defender: unit(), board: boardWith("forest"), element: "ice", coin: "tails",
    })).toEqual([]);
  });

  it("reverts a Meadow panel after Fire damage there", () => {
    // "the panel reverts to normal at the end of the Damage Step."
    const out = terrainConversions({
      defender: unit(), board: boardWith("meadow"), element: "fire", coin: "heads",
    });

    expect(out).toContainEqual(expect.objectContaining({ kind: "removeTerrain", type: "meadow" }));
  });
});
