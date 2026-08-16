/**
 * @file Platforms and levels.
 * @see docs/20-platforms-and-levels.md, docs/45-implementation-status.md C3
 *
 * `resolveTargets` has had a `crossLevelAllows` step since it was written, and
 * it is gated on `board.crossLevel` — which **nothing ever supplied**. So the
 * cross-level rule was implemented, called, and permanently inert.
 */

import { describe, it, expect } from "vitest";
import {
  platformsOn, passengersOf, movePlatform, crossLevelRulesFor, crossLevelLegal,
  boardingTarget, fallOff, destructionSequence, aoePassengerFactor,
} from "../../module/rules/platforms.mjs";

const at = (i, j) => ({ i, j });

const platform = (over = {}) => ({
  id: "hgob", kind: "platform", faction: "a", level: 1,
  panel: at(5, 5), footprint: { w: 3, h: 3 },
  capacity: null,
  crossLevel: {
    occupantTargeting: "forbidden", requiresBoarding: true,
    aoePassengerFactor: 0.5, aoeMastersImmune: false,
    outboundTargeting: "rangedOnly", forbidDirectlyBelow: true,
  },
  ...over,
});

const rider = (over = {}) => ({
  id: "r", kind: "servant", faction: "a", level: 1, panel: at(5, 6),
  parameters: {}, ...over,
});

const grounded = (over = {}) => ({
  id: "g", kind: "servant", faction: "b", level: 0, panel: at(8, 8), ...over,
});

const boardOf = (units) => ({ units, alliances: {} });

/* ── Membership ───────────────────────────────────────────────────────────── */

describe("platform membership", () => {
  it("finds the platforms on a board", () => {
    expect(platformsOn(boardOf([platform(), rider(), grounded()])).map((p) => p.id)).toEqual(["hgob"]);
  });

  it("counts everyone standing on the platform's level as a passenger", () => {
    // Separate level means separate occupancy — the passenger manifest is a
    // consequence of the level, not a list to keep in sync by hand.
    const board = boardOf([platform(), rider(), grounded()]);

    expect(passengersOf(platform(), board).map((u) => u.id)).toEqual(["r"]);
  });

  it("does not count the platform as its own passenger", () => {
    expect(passengersOf(platform(), boardOf([platform()]))).toEqual([]);
  });
});

/* ── 20.8 Movement linkage — the C3 gate ──────────────────────────────────── */

describe("movePlatform", () => {
  const board = boardOf([platform(), rider(), grounded()]);

  it("moves the platform itself", () => {
    expect(movePlatform(platform(), { i: 1, j: 0 }, board)).toContainEqual(
      expect.objectContaining({ kind: "move", unitId: "hgob", to: at(6, 5) }));
  });

  it("carries its passengers, preserving relative position", () => {
    // The rider was one panel east of the anchor and must stay there.
    expect(movePlatform(platform(), { i: 1, j: 0 }, board)).toContainEqual(
      expect.objectContaining({ kind: "move", unitId: "r", to: at(6, 6) }));
  });

  it("moves passengers as FORCED movement", () => {
    // `forced` is what keeps it off their own budget and away from movement
    // triggers — a passenger has not moved, it has been carried.
    const carried = movePlatform(platform(), { i: 1, j: 0 }, board).find((m) => m.unitId === "r");

    expect(carried.forced).toBe(true);
  });

  it("does not force the platform's own movement", () => {
    const self = movePlatform(platform(), { i: 1, j: 0 }, board).find((m) => m.unitId === "hgob");

    expect(self.forced).toBe(false);
  });

  it("leaves units on the ground where they are", () => {
    expect(movePlatform(platform(), { i: 1, j: 0 }, board).some((m) => m.unitId === "g")).toBe(false);
  });
});

/* ── 20.7 Cross-level targeting ───────────────────────────────────────────── */

describe("crossLevelLegal", () => {
  const board = boardOf([platform(), rider(), grounded()]);

  it("allows an attack within one level", () => {
    expect(crossLevelLegal(rider(), { ...rider(), id: "r2" }, board)).toMatchObject({ ok: true });
  });

  it("refuses melee across levels", () => {
    // The C3 gate: "cross-level melee is refused and cross-level ranged is not."
    expect(crossLevelLegal({ ...grounded(), range: 1 }, rider(), board))
      .toMatchObject({ ok: false });
  });

  it("still refuses ranged when occupants cannot be targeted at all", () => {
    // The Hanging Gardens forbid it outright — "ranged only" is a weaker rule
    // than "forbidden", and the platform picks which it uses.
    expect(crossLevelLegal({ ...grounded(), range: 4 }, rider(), board))
      .toMatchObject({ ok: false, reason: "occupantsForbidden" });
  });

  it("allows ranged when the platform only requires range", () => {
    const open = platform({ crossLevel: { ...platform().crossLevel, occupantTargeting: "rangedOnly" } });
    const b = boardOf([open, rider(), grounded()]);

    expect(crossLevelLegal({ ...grounded(), range: 4 }, rider(), b)).toMatchObject({ ok: true });
    expect(crossLevelLegal({ ...grounded(), range: 1 }, rider(), b))
      .toMatchObject({ ok: false, reason: "requiresRanged" });
  });

  it("always allows the platform itself to be targeted", () => {
    // Protection is for the occupants. The vehicle is always a legal target.
    expect(crossLevelLegal({ ...grounded(), range: 1 }, platform(), board)).toMatchObject({ ok: true });
  });

  it("refuses an occupant shooting out when outbound is forbidden", () => {
    const sealed = platform({ crossLevel: { ...platform().crossLevel, outboundTargeting: "forbidden" } });
    const b = boardOf([sealed, rider(), grounded()]);

    expect(crossLevelLegal({ ...rider(), range: 4 }, grounded(), b))
      .toMatchObject({ ok: false, reason: "outboundForbidden" });
  });

  it("lets an occupant shoot out at range when outbound is rangedOnly", () => {
    expect(crossLevelLegal({ ...rider(), range: 4 }, grounded(), board)).toMatchObject({ ok: true });
    expect(crossLevelLegal({ ...rider(), range: 1 }, grounded(), board))
      .toMatchObject({ ok: false, reason: "requiresRanged" });
  });

  it("refuses a target directly below the platform when it says so", () => {
    const below = { ...grounded(), panel: at(5, 5), range: 4 };

    expect(crossLevelLegal({ ...rider(), range: 4 }, below, board))
      .toMatchObject({ ok: false, reason: "directlyBelow" });
  });
});

describe("aoePassengerFactor", () => {
  it("soaks half an area attack for a passenger", () => {
    expect(aoePassengerFactor(rider(), platform())).toBe(0.5);
  });

  it("shields Masters entirely when the platform says so", () => {
    // The Golden Hind: "0.5 (Masters 0)".
    const hind = platform({ crossLevel: { ...platform().crossLevel, aoeMastersImmune: true } });

    expect(aoePassengerFactor({ ...rider(), kind: "master" }, hind)).toBe(0);
  });

  it("does not soak anything for the platform itself", () => {
    expect(aoePassengerFactor(platform(), platform())).toBe(1);
  });
});

/* ── Board projection ─────────────────────────────────────────────────────── */

describe("crossLevelRulesFor", () => {
  it("keys each platform's rules by its id, which is what the resolver reads", () => {
    // `resolveTargets` has read `board.crossLevel[unit.platformId]` since it was
    // written, and nothing ever built that map.
    const rules = crossLevelRulesFor(boardOf([platform(), rider()]));

    expect(rules.hgob).toMatchObject({ requiresRanged: true, untargetable: true });
  });

  it("is empty for a board with no platforms", () => {
    expect(crossLevelRulesFor(boardOf([rider()]))).toEqual({});
  });
});

/* ── 20.4 Boarding, falling, destruction ──────────────────────────────────── */

describe("boardingTarget", () => {
  it("needs a 12 on a d12 with no help", () => {
    expect(boardingTarget({ parameters: {} })).toMatchObject({ die: 12, target: 12 });
  });

  it("takes one off for middling Agility and one for middling Luck", () => {
    expect(boardingTarget({ parameters: { agi: "C", luc: "B" } })).toMatchObject({ target: 10 });
  });

  it("takes two off each at A or better", () => {
    // "AGI A and LUC A needs 8+ on a d12" — the worked example in §20.4.
    expect(boardingTarget({ parameters: { agi: "A", luc: "A" } })).toMatchObject({ target: 8 });
  });

  it("drops another two after Dragon Wing Warriors", () => {
    expect(boardingTarget({ parameters: { agi: "A", luc: "A" } }, { hitByDragonWingWarriors: true }))
      .toMatchObject({ target: 6 });
  });

  it("uses a d8 for a Levitating unit", () => {
    expect(boardingTarget({ parameters: {}, attributes: ["levitating"] }))
      .toMatchObject({ die: 8, target: 8 });
  });
});

describe("fallOff", () => {
  it("lands the unit below and hurts it when the check fails", () => {
    const out = fallOff(rider(), platform(), { passedAgility: false });

    expect(out).toContainEqual(expect.objectContaining({ kind: "move", forced: true }));
    expect(out).toContainEqual(expect.objectContaining({ kind: "damage", formula: "10x2d6" }));
  });

  it("lets a successful check keep the unit aboard", () => {
    const out = fallOff(rider(), platform(), { passedAgility: true });

    expect(out.some((d) => d.kind === "damage")).toBe(false);
  });

  it("spares a Master whose adjacent Servant passed the rescue check", () => {
    // "If a Master directly next to its Servant fails its Agility Check, its
    // Servant can perform an Agility Check too; if successful, its Master is
    // not knocked off."
    const master = { ...rider(), id: "m", kind: "master" };
    const out = fallOff(master, platform(), { passedAgility: false, servantRescued: true });

    expect(out.some((d) => d.kind === "damage")).toBe(false);
  });

  it("makes a fallen Master roll Overpower again", () => {
    const master = { ...rider(), id: "m", kind: "master" };
    const out = fallOff(master, platform(), { passedAgility: false });

    expect(out).toContainEqual(expect.objectContaining({ kind: "overpower", unitId: "m" }));
  });
});

describe("destructionSequence", () => {
  const board = boardOf([platform(), rider(), grounded()]);

  it("saves each passenger, scatters them, and removes the level", () => {
    const out = destructionSequence(platform(), board, { saves: { r: false } });
    const kinds = out.map((d) => d.kind);

    expect(kinds).toContain("damage");
    expect(kinds).toContain("scatter");
    expect(kinds).toContain("removeLevel");
  });

  it("spares a passenger who made its save", () => {
    const out = destructionSequence(platform(), board, { saves: { r: true } });

    expect(out.some((d) => d.kind === "damage")).toBe(false);
  });

  it("still scatters a passenger who made its save", () => {
    // Surviving the fall is not the same as staying in the air.
    const out = destructionSequence(platform(), board, { saves: { r: true } });

    expect(out).toContainEqual(expect.objectContaining({ kind: "scatter", unitId: "r" }));
  });

  it("removes the level last, after everyone is off it", () => {
    const out = destructionSequence(platform(), board, { saves: { r: false } });

    expect(out.at(-1)).toMatchObject({ kind: "removeLevel" });
  });
});
