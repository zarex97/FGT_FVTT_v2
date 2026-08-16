/**
 * @file Servant identity and Detect.
 * @see docs/04-units.md §4.2, docs/08-board-and-geometry.md §8.7
 *
 * A Servant is publicly its **class**, not its name: "Archer", or "Archer of
 * Yellow" once it belongs to a named faction. The true name is hidden until
 * revealed, which is what makes Ch. 26 §26.6's closed-information play mean
 * anything.
 */

import { describe, it, expect } from "vitest";
import {
  publicNameOf, isIdentityRevealed, detectRangeOf, discoverChance, discoverAttempts,
} from "../../module/rules/identity.mjs";

const at = (i, j) => ({ i, j });

const servant = (over = {}) => ({
  id: "s", kind: "servant", trueName: "Heracles", classContainer: "berserker",
  faction: null, identityRevealed: false, range: 1, panel: at(0, 0),
  effects: [], abilities: [], ...over,
});

const board = (units, factions = []) => ({ units, factions, alliances: {} });

/* ── Identity ─────────────────────────────────────────────────────────────── */

describe("publicNameOf", () => {
  it("shows the class container when the Servant has no faction", () => {
    expect(publicNameOf(servant(), board([]))).toBe("Berserker");
  });

  it("qualifies it with the faction's name once it has one", () => {
    const b = board([], [{ id: "f", name: "Yellow" }]);

    expect(publicNameOf(servant({ faction: "f" }), b)).toBe("Berserker of Yellow");
  });

  it("shows the true name once the identity is revealed", () => {
    expect(publicNameOf(servant({ identityRevealed: true }), board([]))).toBe("Heracles");
  });

  it("shows the true name to an owner regardless", () => {
    // The concealment is from opponents, not from the player running the unit.
    expect(publicNameOf(servant(), board([]), { isOwner: true })).toBe("Heracles");
  });

  it("falls back to the class alone when the faction has no name", () => {
    const b = board([], [{ id: "f", name: "" }]);

    expect(publicNameOf(servant({ faction: "f" }), b)).toBe("Berserker");
  });

  it("uses an explicit override when the sheet gives one", () => {
    // Some Servants are publicly known by something other than their class —
    // an alias, or a second class container.
    expect(publicNameOf(servant({ concealedIdentity: "Avenger" }), board([]))).toBe("Avenger");
  });

  it("names a Servant with no class container at all safely", () => {
    expect(publicNameOf(servant({ classContainer: "" }), board([]))).toBe("Servant");
  });
});

describe("isIdentityRevealed", () => {
  it("is false by default", () => {
    expect(isIdentityRevealed(servant())).toBe(false);
  });

  it("is true once the flag is set", () => {
    expect(isIdentityRevealed(servant({ identityRevealed: true }))).toBe(true);
  });

  it("is always true for anything that is not a Servant", () => {
    // Masters, Civilians and platforms have no hidden true name.
    expect(isIdentityRevealed({ kind: "master" })).toBe(true);
  });
});

/* ── §8.7 Detect ──────────────────────────────────────────────────────────── */

describe("detectRangeOf", () => {
  it("is the unit's own attack range", () => {
    expect(detectRangeOf(servant({ range: 5 }))).toBe(5);
  });

  it("never drops below two panels", () => {
    // "(minimum 2 panels)".
    expect(detectRangeOf(servant({ range: 1 }))).toBe(2);
  });

  it("uses an explicit Detect where the sheet states one", () => {
    // The Golden Hind has "Detect: 4 panels" regardless of its range.
    expect(detectRangeOf(servant({ range: 5, detect: 4 }))).toBe(4);
  });

  it("is reduced by Deafen, and still floors at two", () => {
    expect(detectRangeOf(servant({ range: 5, effects: ["deafen"] }))).toBe(4);
    expect(detectRangeOf(servant({ range: 2, effects: ["deafen"] }))).toBe(2);
  });
});

describe("discoverChance", () => {
  const withPC = (rank) => servant({ abilities: [{ slug: "presenceConcealment", rank }] });

  it("is the concealed unit's Presence Concealment rank, inverted", () => {
    // EX 0%, A 10%, B 20%, C 40%, D 60%, E 80%.
    expect(discoverChance(withPC("A"))).toBe(10);
    expect(discoverChance(withPC("C"))).toBe(40);
    expect(discoverChance(withPC("EX"))).toBe(0);
  });

  it("steps by five per rank step", () => {
    // Kiritsugu's A+ gives 5%; Semiramis's C+ gives 35%.
    expect(discoverChance(withPC("A+"))).toBe(5);
    expect(discoverChance(withPC("C+"))).toBe(35);
  });

  it("is certain against a unit with no Presence Concealment", () => {
    // Van Gogh has none: there is nothing to conceal, so nothing to discover.
    expect(discoverChance(servant())).toBe(100);
  });
});

describe("discoverAttempts", () => {
  const concealed = servant({
    id: "c", faction: "a", panel: at(5, 5), concealed: true,
    abilities: [{ slug: "presenceConcealment", rank: "B" }],
  });
  const watcher = (over = {}) => ({ id: "w", kind: "servant", faction: "b", range: 3, panel: at(5, 7), ...over });

  it("offers one attempt per enemy whose Detect the unit entered", () => {
    const out = discoverAttempts(concealed, board([concealed, watcher()]));

    expect(out).toEqual([expect.objectContaining({ watcherId: "w", chance: 20 })]);
  });

  it("ignores an enemy out of Detect range", () => {
    expect(discoverAttempts(concealed, board([concealed, watcher({ panel: at(5, 20) })]))).toEqual([]);
  });

  it("ignores allies, who are not looking for it", () => {
    expect(discoverAttempts(concealed, board([concealed, watcher({ faction: "a" })]))).toEqual([]);
  });

  it("offers nothing for a unit that is not concealed", () => {
    const open = { ...concealed, concealed: false };
    expect(discoverAttempts(open, board([open, watcher()]))).toEqual([]);
  });

  it("marks every attempt GM-only and silent", () => {
    // "The Overseer will perform the Discover rolls, since if either Player
    // performs the roll, that would mean they would already know there is a
    // Unit with Active Presence Concealment in the area." The flag is on the
    // attempt so the socket layer cannot broadcast it by accident.
    const out = discoverAttempts(concealed, board([concealed, watcher()]));

    expect(out[0]).toMatchObject({ gmOnly: true, silentUnlessSucceeded: true });
  });

  it("offers one attempt per watcher, not one per panel entered", () => {
    const two = board([concealed, watcher(), watcher({ id: "w2", panel: at(4, 5) })]);

    expect(discoverAttempts(concealed, two)).toHaveLength(2);
  });
});
