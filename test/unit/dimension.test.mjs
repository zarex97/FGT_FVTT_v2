/**
 * @file The Storm Border — a pocket dimension, entered and left.
 * @see docs/20-platforms-and-levels.md §20.6, char_orig_sheets/Copia de Nemo.md
 *
 * The pure halves: who may enter, how far it travels, where it may surface,
 * and what happens if Nemo dies inside it. The placement itself is
 * `engine/platforms.mjs`'s and is live-tested.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  manifestFor, travelDistance, placementIsLegal, onOwnerDefeat,
} from "../../module/engine/dimension.mjs";

/** The real spec, so the tests and the content cannot drift. */
const SPEC = parse(readFileSync("packs/_source/platforms/storm-border.yml", "utf8")).dimension;

const at = (i, j) => ({ i, j });

const OWNER = { id: "nemo", panel: at(5, 5), factionId: "red" };
const BOARD = {
  units: [
    OWNER,
    { id: "nearAlly", panel: at(6, 5), factionId: "red" },
    { id: "farAlly", panel: at(9, 5), factionId: "red" },
    { id: "nearEnemy", panel: at(7, 5), factionId: "blue" },
    { id: "farEnemy", panel: at(9, 9), factionId: "blue" },
  ],
};

/* ========================================================================== */
/*  Entry                                                                     */
/* ========================================================================== */

describe("who can enter the Storm Border", () => {
  const run = (over = {}) => manifestFor(SPEC, {
    owner: OWNER, board: BOARD, chosenAllyIds: [], rolls: {}, ...over,
  });

  it("offers allies within 2 and no further", () => {
    expect(run().eligibleAllies.sort()).toEqual(["nearAlly"]);
  });

  it("always carries Nemo himself", () => {
    expect(run().entering).toContain("nemo");
  });

  it("takes ANY number of the eligible allies — the chooser is uncapped", () => {
    expect(run({ chosenAllyIds: ["nearAlly"] }).entering.sort()).toEqual(["nearAlly", "nemo"]);
  });

  it("refuses an ally the player named who was never eligible", () => {
    // A chooser that trusts its input lets a player walk a Servant across the
    // board into a submarine.
    expect(run({ chosenAllyIds: ["farAlly"] }).entering).not.toContain("farAlly");
  });

  it("offers the roll to enemies within 3 and no further", () => {
    expect(run().eligibleEnemies.sort()).toEqual(["nearEnemy"]);
  });

  it("lets an enemy in on 18, 19 and 20 and turns it away below", () => {
    for (const roll of [18, 19, 20]) {
      expect(run({ rolls: { nearEnemy: roll } }).entering, `rolled ${roll}`).toContain("nearEnemy");
    }
    for (const roll of [1, 17]) {
      expect(run({ rolls: { nearEnemy: roll } }).entering, `rolled ${roll}`).not.toContain("nearEnemy");
    }
  });

  it("reports every roll it made, passed or failed, for the log", () => {
    // A 15% gate that reports only its successes is unauditable.
    expect(run({ rolls: { nearEnemy: 4 } }).enemyAttempts).toEqual([
      { unitId: "nearEnemy", roll: 4, successOn: 18, entered: false },
    ]);
  });

  it("does not roll for an enemy out of range at all", () => {
    expect(run({ rolls: { farEnemy: 20 } }).entering).not.toContain("farEnemy");
  });
});

/* ========================================================================== */
/*  How far it travels                                                        */
/* ========================================================================== */

describe("how far the Storm Border travels", () => {
  it("matches the sheet's own worked example at 3 Turns per Round", () => {
    // "1◈ Turns spent in Imaginary Numbers Space, Nemo can travel 2+3=5".
    expect(travelDistance(SPEC, { turnsInside: 3, turnsPerRound: 3 })).toBe(5);
  });

  it("travels 2 when he surfaces immediately", () => {
    expect(travelDistance(SPEC, { turnsInside: 0, turnsPerRound: 3 })).toBe(2);
  });

  it("reaches 8 at the 2◈ ceiling", () => {
    expect(travelDistance(SPEC, { turnsInside: 6, turnsPerRound: 3 })).toBe(8);
  });

  it("resolves ⅓◈ per war variant rather than assuming one Turn", () => {
    // At 8 Turns per Round, ⅓◈ is 2 Turns (TICK_OVERRIDES), so a full 1◈
    // inside is 8 Turns and X=4 -- a distance of 6, not the sheet's 5. The
    // sheet's example is a three-Turn example; hard-coding it would silently
    // shorten every Holy Grail War.
    expect(travelDistance(SPEC, { turnsInside: 8, turnsPerRound: 8 })).toBe(6);
    expect(travelDistance(SPEC, { turnsInside: 15, turnsPerRound: 15 })).toBe(5);
  });
});

/* ========================================================================== */
/*  Where it may surface                                                      */
/* ========================================================================== */

describe("where it may surface", () => {
  const BASES = {
    homeBases: [{ factionId: "blue", panels: [at(2, 2), at(2, 3), at(3, 2), at(3, 3)] }],
  };
  const legal = (over) => placementIsLegal(SPEC, {
    from: at(5, 5), distance: 8, board: BASES, factionId: "red", ...over,
  });

  it("refuses a 5x5 that OVERLAPS an enemy Home Base, not merely one centred on it", () => {
    // Ruling R3. A centre-only test would let a five-panel square land
    // four-fifths inside an enemy base.
    //
    // The base occupies rows 2-3 and columns 2-3. A 5x5 centred on (5,5)
    // spans 3-7 in both axes and therefore clips the base's (3,3) corner --
    // so it is ILLEGAL even though its centre is three panels clear. That is
    // the whole distinction this ruling draws.
    expect(legal({ at: at(5, 5) }), "clips the base corner at (3,3)").toBe(false);
    expect(legal({ at: at(6, 6) }), "spans 4-8, clear of the base").toBe(true);
    // And a centre sitting directly on it, which a centre-only test would also
    // have caught.
    expect(legal({ at: at(3, 3) })).toBe(false);
  });

  it("refuses a destination beyond the travel distance", () => {
    expect(legal({ at: at(12, 12), distance: 2 })).toBe(false);
    expect(legal({ at: at(7, 7), distance: 2 })).toBe(true);
  });

  it("allows a 5x5 clear of every enemy base and within reach", () => {
    expect(legal({ at: at(10, 10) })).toBe(true);
  });

  it("ignores the caster's OWN faction's base", () => {
    // "excluding enemy Home Bases" -- his own is not one.
    const own = { homeBases: [{ factionId: "red", panels: [at(5, 5)] }] };
    expect(placementIsLegal(SPEC, {
      at: at(5, 5), from: at(5, 5), distance: 8, board: own, factionId: "red",
    })).toBe(true);
  });
});

/* ========================================================================== */
/*  Nemo's defeat while submerged                                             */
/* ========================================================================== */

describe("Nemo's defeat while submerged", () => {
  const OCCUPANTS = ["nemo", "ally"];

  it("resurfaces on a successful Luck Check, and never revives him", () => {
    // "he performs a Luck Check BEFORE dying ... (but he is STILL DEFEATED)".
    // This is not a revival and must not be registered as one, or it competes
    // with his own Guts in the revival chain.
    expect(onOwnerDefeat(SPEC, { owner: OWNER, succeeded: true, occupants: OCCUPANTS })).toEqual({
      resurfaces: true, ownerStillDefeated: true, erased: [],
    });
  });

  it("Erases everyone inside when the check fails — Nemo included", () => {
    const out = onOwnerDefeat(SPEC, { owner: OWNER, succeeded: false, occupants: OCCUPANTS });
    expect(out.resurfaces).toBe(false);
    expect(out.ownerStillDefeated).toBe(true);
    expect(out.erased.sort()).toEqual(["ally", "nemo"]);
  });

  it("does not fire at all when Zero Sail is not up", () => {
    expect(onOwnerDefeat(null, { owner: OWNER, succeeded: true, occupants: [] })).toBeNull();
  });
});

/* ========================================================================== */
/*  What the platform declares                                                */
/* ========================================================================== */

describe("the Storm Border's own document", () => {
  const P = parse(readFileSync("packs/_source/platforms/storm-border.yml", "utf8"));

  it("has no combat statistics, because the sheet grants it none (R2)", () => {
    // It was authored from Ch. 20 §20.5's general platform model and given
    // 3000 Health, MOV 8, Range 6 and Base Attack 220. Nemo's sheet has no
    // Health line for it, no attack and no movement: units inside "still take
    // their Turn normally", and where it surfaces is his decision, not a move.
    expect(P.baseHealth ?? null).toBeNull();
    expect(P.mov ?? null).toBeNull();
    expect(P.baseAttack ?? null).toBeNull();
    expect(P.range ?? null).toBeNull();
  });

  it("has no ground footprint at all", () => {
    expect(P.footprint).toBeNull();
  });

  it("bars only Large/Giant creation, and not Skills or NPs (R1)", () => {
    expect(P.dimension.restrictions).toEqual([
      { key: "ForbidCreating", attributes: ["large", "giant"] },
    ]);
  });

  it("forces a resurface after 2◈", () => {
    expect(P.dimension.maxDuration).toBe("2◈");
    expect(P.dimension.forceExitAt).toBe("maxDuration");
  });

  it("states the travel distance as an expression, not the sheet's worked 5", () => {
    expect(P.dimension.relocateOnExit.maxDistance).toBe("2 + floor(turnsInside / ⅓◈)");
  });
});
