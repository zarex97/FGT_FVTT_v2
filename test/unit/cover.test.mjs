/**
 * @file Cover — a Servant taking a Noble Phantasm for its Master.
 * @see docs/16-relationships.md §16.4 rule 4, module/rules/cover.mjs
 *
 * The last of the four Master-protection rules to be built, and the only one
 * that spans two Combat Processes: an AoE Noble Phantasm fans out into one
 * Process per defender, so the Master's decides and the Servant's is changed.
 */

import { describe, it, expect } from "vitest";
import {
  coveringServantsFor, coverFactor, shoveDestination, isCovering, COVER_RANGE,
} from "../../module/rules/cover.mjs";

const at = (i, j) => ({ i, j });

/** A 3×3 area centred on (5, 5). */
const area = () => {
  const out = [];
  for (let i = 4; i <= 6; i++) for (let j = 4; j <= 6; j++) out.push(at(i, j));
  return out;
};

const master = (over = {}) => ({
  id: "m", kind: "master", factionId: "a", panel: at(5, 5), ...over,
});
const servant = (over = {}) => ({
  id: "s", kind: "servant", factionId: "a", panel: at(5, 6), canAct: true, ...over,
});
const board = (units, over = {}) => ({ units, alliances: {}, ...over });

/* -------------------------------------------------------------------------- */

describe("coveringServantsFor", () => {
  it("takes a Servant standing with its Master inside the area", () => {
    const m = master();
    const s = servant();
    expect(coveringServantsFor(m, board([m, s]), area()).map((u) => u.id)).toEqual(["s"]);
  });

  it("refuses one further than 2 panels away", () => {
    // "within a 2 panel Range of itself".
    const m = master();
    const near = servant({ id: "near", panel: at(5, 6) });
    const far = servant({ id: "far", panel: at(5, 5 + COVER_RANGE + 1) });
    const b = board([m, near, far], {});
    expect(coveringServantsFor(m, b, [...area(), far.panel]).map((u) => u.id)).toEqual(["near"]);
  });

  it("refuses one standing OUTSIDE the area, however close", () => {
    // "If a Servant fails to Shove their Master out of an AoE NP, but that
    // Servant is not within the NP area, that Servant cannot Cover for their
    // Master." A Servant cannot absorb a blast it is not standing in.
    const m = master();
    const outside = servant({ panel: at(5, 7) });   // 2 away, but the area stops at 6
    expect(coveringServantsFor(m, board([m, outside]), area())).toEqual([]);
  });

  it("refuses one that cannot Act", () => {
    // "While a Servant is affected by Charm, Confuse, Berserk, Stun, Stop,
    // Petrify, Freeze, Sleep, or any other effect that prevents a Servant from
    // Acting, the effects in the above paragraphs are negated."
    const m = master();
    expect(coveringServantsFor(m, board([m, servant({ canAct: false })]), area())).toEqual([]);
  });

  it("refuses a defeated one, which `canAct` does not cover", () => {
    // A defeat never removes the token, so "still on the board" is not "still
    // able to throw itself in front of something".
    const m = master();
    expect(coveringServantsFor(m, board([m, servant({ defeated: true })]), area())).toEqual([]);
  });

  it("refuses another faction's Servant", () => {
    const m = master();
    expect(coveringServantsFor(m, board([m, servant({ factionId: "b" })]), area())).toEqual([]);
  });

  it("takes every eligible Servant, not just the first", () => {
    const m = master();
    const one = servant({ id: "one", panel: at(4, 4) });
    const two = servant({ id: "two", panel: at(6, 6) });
    expect(coveringServantsFor(m, board([m, one, two]), area()).map((u) => u.id))
      .toEqual(["one", "two"]);
  });

  it("hands the duty to a proxying Servant's summons", () => {
    // Pale Rider: "the following Servant-Master Relationship Rules have no
    // effect between Pale Rider and its Master; but apply between Kagome
    // Spirits and Pale Rider's Master." Through `guardsOf`, so Cover inherits
    // the substitution the other three rules already made.
    const m = master();
    const pale = servant({
      id: "pale", panel: at(4, 4),
      suppressions: [{ scope: "relationship", proxy: "summons" }],
    });
    const spirit = {
      id: "k", kind: "summon", factionId: "a", panel: at(6, 6),
      summonerId: "pale", boundToFieldId: "doomsday", canAct: true,
    };
    expect(coveringServantsFor(m, board([m, pale, spirit]), area()).map((u) => u.id))
      .toEqual(["k"]);
  });
});

describe("coverFactor", () => {
  it("doubles the Total Damage for a lone Servant", () => {
    // "The Total Damage the Servant takes from the AoE NP is increased by 100%."
    expect(coverFactor(1)).toBe(2);
  });

  it("divides the INCREASE among several, not the damage", () => {
    // "The increase in Total Damage taken by the Servants are divided by the
    // number of Servants Covering." Two take +50% each, not +100% apiece —
    // so covering in a group is strictly better per Servant.
    expect(coverFactor(2)).toBe(1.5);
    expect(coverFactor(4)).toBe(1.25);
  });

  it("is inert when nobody covers", () => {
    expect(coverFactor(0)).toBe(1);
    expect(coverFactor(NaN)).toBe(1);
  });
});

describe("shoveDestination", () => {
  it("puts the Master on the nearest panel outside the area", () => {
    // "The Master is Moved to one panel outside of the NP area" -- the
    // shortest shove that works, not anywhere outside.
    const m = master();
    const panel = shoveDestination(m, area(), board([m]));
    expect(area().some((p) => p.i === panel.i && p.j === panel.j)).toBe(false);
    // A 3x3 centred on the Master: the nearest outside panel is two away.
    expect(Math.max(Math.abs(panel.i - 5), Math.abs(panel.j - 5))).toBe(2);
  });

  it("skips a panel somebody is standing on", () => {
    const m = master();
    const crowd = [];
    for (let i = 3; i <= 7; i++) {
      for (let j = 3; j <= 7; j++) {
        if (Math.max(Math.abs(i - 5), Math.abs(j - 5)) !== 2) continue;
        if (i === 3 && j === 3) continue;             // leave exactly one free
        crowd.push({ id: `x${i}${j}`, panel: at(i, j), kind: "servant", factionId: "b" });
      }
    }
    expect(shoveDestination(m, area(), board([m, ...crowd]))).toEqual(at(3, 3));
  });

  it("stays on the board", () => {
    const m = master({ panel: at(0, 0) });
    const small = [at(0, 0), at(0, 1), at(1, 0), at(1, 1)];
    const panel = shoveDestination(m, small, board([m], { bounds: { iMin: 0, jMin: 0, iMax: 8, jMax: 8 } }));
    expect(panel.i).toBeGreaterThanOrEqual(0);
    expect(panel.j).toBeGreaterThanOrEqual(0);
  });

  it("returns null when there is nowhere to shove to", () => {
    const m = master();
    const everywhere = [];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) everywhere.push(at(i, j));
    const b = board([m], { bounds: { iMin: 0, jMin: 0, iMax: 8, jMax: 8 } });
    expect(shoveDestination(m, everywhere, b)).toBe(null);
  });
});

describe("isCovering", () => {
  it("names the Servants that may not Evade", () => {
    // "In this situation, Servants cannot Evade the enemy Unit's AoE NP if
    // their Master is within a 2 panel range of them."
    const cover = { masterId: "m", coveringIds: ["s", "t"], factor: 1.5 };
    expect(isCovering({ id: "s" }, cover)).toBe(true);
    expect(isCovering({ id: "t" }, cover)).toBe(true);
    expect(isCovering({ id: "other" }, cover)).toBe(false);
  });

  it("is false when nothing is covering", () => {
    expect(isCovering({ id: "s" }, null)).toBe(false);
    expect(isCovering(null, { coveringIds: ["s"] })).toBe(false);
  });

  it("frees every Servant once the shove succeeded", () => {
    // A successful shove records the Master as out of the area with nobody
    // covering, so the Evade refusal -- which is the price of the shelter --
    // lifts along with the shelter itself.
    const shoved = { masterId: "m", coveringIds: [], factor: 1, shoved: true };
    expect(isCovering({ id: "s" }, shoved)).toBe(false);
  });
});
