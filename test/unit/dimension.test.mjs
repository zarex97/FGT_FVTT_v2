/**
 * @file The Storm Border — a pocket dimension, entered and left.
 * @see docs/27-platforms-and-levels.md, char_orig_sheets/Copia de Nemo.md
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
  interiorOf, withinInterior, orient, ORIENTATIONS, entryPlacement, landingPlan, fallbackLanding,
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

describe("who counts as an ally or an enemy at the door (#191 reading 2)", () => {
  const board = {
    units: [
      OWNER,
      { id: "civilian", kind: "civilian", panel: at(6, 6), factionId: null },
      { id: "hind", kind: "platform", panel: at(5, 6), factionId: "red" },
      { id: "body", panel: at(4, 5), factionId: "red", defeated: true },
      { id: "master", kind: "master", panel: at(4, 4), factionId: "red" },
      { id: "enemyMaster", kind: "master", panel: at(8, 5), factionId: "blue" },
    ],
  };
  const out = manifestFor(SPEC, { owner: OWNER, board, chosenAllyIds: [], rolls: {} });

  it("offers his Master, and no platform or body", () => {
    expect(out.eligibleAllies).toEqual(["master"]);
  });

  it("lets an enemy Master attempt, and never a Civilian", () => {
    expect(out.eligibleEnemies).toEqual(["enemyMaster"]);
  });
});

/* ========================================================================== */
/*  The inside                                                                */
/* ========================================================================== */

describe("the inside is a 5x5 (#191 reading 3)", () => {
  const inside = interiorOf(SPEC, at(5, 5));

  it("is 25 panels around where it went under", () => {
    expect(inside.panels).toHaveLength(25);
    expect(withinInterior(inside, at(3, 3))).toBe(true);
    expect(withinInterior(inside, at(7, 7))).toBe(true);
    expect(withinInterior(inside, at(8, 5))).toBe(false);
  });
});

describe("where entrants stand (#191 reading 4)", () => {
  const board = {
    units: [
      OWNER,
      { id: "ally", panel: at(6, 5), factionId: "red" },
      { id: "enemy", panel: at(8, 5), factionId: "blue" },
      { id: "enemy2", panel: at(8, 8), factionId: "blue" },
    ],
  };
  const seats = entryPlacement(SPEC, { owner: OWNER, entering: ["nemo", "ally", "enemy", "enemy2"], board });

  it("puts Nemo at the centre and keeps an ally's offset", () => {
    expect(seats.nemo).toEqual(at(5, 5));
    expect(seats.ally).toEqual(at(6, 5));
  });

  it("slides an enemy from 3 panels out to the nearest panel of the edge", () => {
    expect(seats.enemy).toEqual(at(7, 5));
    expect(seats.enemy2).toEqual(at(7, 7));
  });

  it("never seats two Units on one panel", () => {
    const crowd = {
      units: [OWNER, { id: "a", panel: at(8, 5), factionId: "blue" }, { id: "b", panel: at(8, 5), factionId: "blue" }],
    };
    const s = entryPlacement(SPEC, { owner: OWNER, entering: ["nemo", "a", "b"], board: crowd });
    expect(s.a).not.toEqual(s.b);
  });
});

/* ========================================================================== */
/*  The way back out                                                          */
/* ========================================================================== */

describe("any orientation (#191 reading 6)", () => {
  it("has eight, and r0 changes nothing", () => {
    expect(ORIENTATIONS).toHaveLength(8);
    expect(orient(at(1, 2), "r0")).toEqual(at(1, 2));
  });

  it("turns clockwise as the board is drawn", () => {
    // Right of the centre goes below it.
    expect(orient(at(0, 1), "r90")).toEqual(at(1, 0));
    expect(orient(at(0, 1), "r180")).toEqual(at(0, -1));
    expect(orient(at(0, 1), "r270")).toEqual(at(-1, 0));
  });

  it("mirrors left for right before it turns", () => {
    expect(orient(at(1, 2), "m0")).toEqual(at(1, -2));
    expect(orient(at(0, 1), "m90")).toEqual(at(-1, 0));
  });

  it("gives eight different squares for an asymmetric formation", () => {
    const seen = new Set(ORIENTATIONS.map((o) => JSON.stringify([orient(at(1, 2), o), orient(at(0, 1), o)])));
    expect(seen.size).toBe(8);
  });
});

describe("landing on the board (#191 reading 6)", () => {
  const OCC = [
    { id: "nemo", panel: at(5, 5) },
    { id: "ally", panel: at(5, 6) },
    { id: "body", panel: at(7, 7), defeated: true },
  ];
  const bounds = { iMin: 0, iMax: 20, jMin: 0, jMax: 20 };
  const plan = (over = {}) => landingPlan(SPEC, {
    from: at(5, 5), at: at(10, 10), occupants: OCC, board: { bounds, units: [] },
    factionId: "red", distance: 8, ...over,
  });

  it("keeps everyone's panel in the 5x5, bodies too", () => {
    expect(plan().panels).toEqual({ nemo: at(10, 10), ally: at(10, 11), body: at(12, 12) });
  });

  it("turns the whole formation with the square", () => {
    expect(plan({ orientation: "r90" }).panels).toEqual({ nemo: at(10, 10), ally: at(11, 10), body: at(12, 8) });
  });

  it("sends a Unit whose panel is held to the nearest free one", () => {
    const board = { bounds, units: [{ id: "x", panel: at(10, 11), level: 0 }] };
    const out = plan({ board });
    expect(out.ok).toBe(true);
    expect(out.panels.ally).not.toEqual(at(10, 11));
    expect(chebyshevOf(out.panels.ally, at(10, 11))).toBe(1);
  });

  it("does not count a platform or a structure as in the way", () => {
    const board = { bounds, units: [{ id: "s", kind: "structure", panel: at(10, 11), level: 0 }] };
    expect(plan({ board }).panels.ally).toEqual(at(10, 11));
  });

  it("refuses a 5x5 with too few free panels", () => {
    const units = interiorOf(SPEC, at(10, 10)).panels.slice(0, 23).map((p, n) => ({ id: `u${n}`, panel: p, level: 0 }));
    expect(plan({ board: { bounds, units } })).toEqual({ ok: false, reason: "noRoom" });
  });

  it("refuses a 5x5 hanging off the board", () => {
    expect(plan({ at: at(1, 10) }).reason).toBe("offBoard");
  });

  it("refuses beyond the travel distance", () => {
    expect(plan({ distance: 2 }).reason).toBe("illegalPlacement");
  });
});

describe("surfacing with no plan (#191 reading 8)", () => {
  const bounds = { iMin: 0, iMax: 20, jMin: 0, jMax: 20 };
  const OCC = [{ id: "nemo", panel: at(6, 5) }];

  it("surfaces centred on Nemo's own panel", () => {
    const out = fallbackLanding(SPEC, {
      ownerPanel: at(6, 5), from: at(5, 5), occupants: OCC, board: { bounds, units: [] }, factionId: "red", distance: 2,
    });
    // The square is centred on him; he keeps his own panel in it, one below
    // where it went under.
    expect(out.at).toEqual(at(6, 5));
    expect(out.panels.nemo).toEqual(at(7, 5));
  });

  it("moves to the nearest legal spot when his own is not", () => {
    // An enemy Home Base clips the square centred on him.
    const board = { bounds, units: [], homeBases: [{ factionId: "blue", panels: [at(8, 5)] }] };
    const out = fallbackLanding(SPEC, {
      ownerPanel: at(6, 5), from: at(5, 5), occupants: OCC, board, factionId: "red", distance: 2,
    });
    expect(out.at).toEqual(at(5, 4));
  });
});

const chebyshevOf = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j));

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
    // It was authored from Ch. 27's general platform model and given
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

describe("a live board's Home Bases are its zones (#191)", () => {
  it("refuses a 5x5 overlapping an enemy zone", () => {
    const board = { zones: { z2: { faction: "blue", panels: [at(18, 10)] }, z1: { faction: "red", panels: [at(15, 10)] } } };
    expect(placementIsLegal(SPEC, { at: at(16, 10), from: at(14, 10), distance: 8, board, factionId: "red" })).toBe(false);
    expect(placementIsLegal(SPEC, { at: at(15, 10), from: at(14, 10), distance: 8, board, factionId: "red" })).toBe(true);
  });
});
