/**
 * @file Who may attempt a Discover, and how often.
 * @see module/rules/identity.mjs, docs/46-roster-re-audit.md §46.4-AN
 *
 * Two rulings from the game's author, both narrowing what the engine did.
 *
 * **Only Servants watch.** Presence Concealment clause 6 says *"an enemy
 * **Servant's** Range (or Detect)"*; `discoverAttempts` filtered on enemy-ness
 * and distance and nothing else, so a **Master** standing near a concealed Unit
 * rolled too. Measured live: two watchers at 35% each — Heracles and his Master
 * — which is 58% per move against a Servant whose sheet offers 35%. Ch. 8 §8.7
 * quotes the source's general rule as *"an enemy Unit's"*, and the author has
 * settled it: the Skill's own wording governs.
 *
 * **And a faction gets three attempts per Turn against one concealed Unit.**
 * Not three per Servant — three for the whole faction, spent in the order the
 * watchers acquired the target, with no Servant attempting twice against the
 * same target in one Turn. The budgets are **per faction**: a second faction
 * that has never looked still has all three, however many the first spent.
 *
 * Without the cap a concealed Unit walking past six enemies rolled six times,
 * and at Semiramis's 35% that is a 92% chance of being found for one step.
 */

import { describe, it, expect } from "vitest";
import { discoverAttempts, DISCOVER_ATTEMPTS_PER_FACTION } from "../../module/rules/identity.mjs";

const concealed = {
  id: "target", kind: "servant", faction: "f1", concealed: true,
  panel: { i: 5, j: 5 },
  abilities: [{ slug: "presenceConcealment", rank: "C" }],
};

/** A watcher with Detect 2 by default, adjacent to the target. */
const watcher = (id, over = {}) => ({
  id, kind: "servant", faction: "f2", panel: { i: 5, j: 6 },
  range: { panels: 2 }, ...over,
});

const boardOf = (units, rules) => ({
  units: [concealed, ...units], alliances: {}, ...(rules ? { rules } : {}),
});

const ids = (out) => out.map((a) => a.watcherId);

describe("only Servants may Discover", () => {
  it("offers an attempt to an enemy Servant in range", () => {
    expect(ids(discoverAttempts(concealed, boardOf([watcher("s1")])))).toEqual(["s1"]);
  });

  it("offers none to an enemy MASTER, however close", () => {
    const master = watcher("m1", { kind: "master" });
    expect(discoverAttempts(concealed, boardOf([master]))).toEqual([]);
  });

  it("offers none to a summon, a platform or a structure", () => {
    for (const kind of ["summon", "platform", "structure", "civilian"]) {
      expect(discoverAttempts(concealed, boardOf([watcher("x", { kind })]))).toEqual([]);
    }
  });

  it("still offers none to an ALLIED Servant", () => {
    expect(discoverAttempts(concealed, boardOf([watcher("a1", { faction: "f1" })]))).toEqual([]);
  });
});

describe("three attempts per faction per Turn, against one concealed Unit", () => {
  const five = ["s1", "s2", "s3", "s4", "s5"].map((id) => watcher(id));

  it("caps a faction at three however many Servants can see it", () => {
    expect(ids(discoverAttempts(concealed, boardOf(five)))).toHaveLength(DISCOVER_ATTEMPTS_PER_FACTION);
    expect(DISCOVER_ATTEMPTS_PER_FACTION).toBe(3);
  });

  it("spends them in the order the watchers acquired the target", () => {
    // `acquiredAt` is the tick each watcher first had this Unit in Detect.
    const acquired = { s5: 1, s3: 2, s1: 3, s2: 4, s4: 5 };
    expect(ids(discoverAttempts(concealed, boardOf(five), { acquiredAt: acquired })))
      .toEqual(["s5", "s3", "s1"]);
  });

  it("does not let one Servant attempt twice in the same Turn", () => {
    const spent = { f2: ["s1"] };
    const out = ids(discoverAttempts(concealed, boardOf(five), { spent }));
    expect(out).not.toContain("s1");
    expect(out).toHaveLength(2); // three minus the one already spent
  });

  it("gives a faction nothing once its three are gone", () => {
    const spent = { f2: ["s1", "s2", "s3"] };
    expect(discoverAttempts(concealed, boardOf(five), { spent })).toEqual([]);
  });

  it("keeps each faction's budget entirely its own", () => {
    // f2 has spent all three; f3 has never looked and still has all three.
    const units = [...five, watcher("t1", { faction: "f3" }), watcher("t2", { faction: "f3" })];
    const spent = { f2: ["s1", "s2", "s3"] };
    expect(ids(discoverAttempts(concealed, boardOf(units), { spent })).sort())
      .toEqual(["t1", "t2"]);
  });
});

describe("what has not changed", () => {
  it("still refuses a watcher out of Detect range", () => {
    const far = watcher("s1", { panel: { i: 5, j: 12 } });
    expect(discoverAttempts(concealed, boardOf([far]))).toEqual([]);
  });

  it("still marks every attempt GM-only and silent", () => {
    const [attempt] = discoverAttempts(concealed, boardOf([watcher("s1")]));
    expect(attempt.gmOnly).toBe(true);
    expect(attempt.silentUnlessSucceeded).toBe(true);
    expect(attempt.chance).toBe(40); // rank C
  });

  it("offers nothing at all for a unit that is not concealed", () => {
    expect(discoverAttempts({ ...concealed, concealed: false }, boardOf([watcher("s1")]))).toEqual([]);
  });
});

describe("the cap is a table setting", () => {
  // Asked for by the game's author, and it follows `masterProtection`'s pattern
  // exactly: an optional rule reaches Layer 2 through `board.rules`, never by
  // this layer reading `game.settings` -- which it cannot do.
  const five = ["s1", "s2", "s3", "s4", "s5"].map((id) => watcher(id));

  it("honours a board that raises it", () => {
    const out = discoverAttempts(concealed, boardOf(five, { discoverAttemptsPerFaction: 5 }));
    expect(out).toHaveLength(5);
  });

  it("honours a board that lowers it", () => {
    expect(discoverAttempts(concealed, boardOf(five, { discoverAttemptsPerFaction: 1 }))).toHaveLength(1);
  });

  it("switches Discover off entirely at zero", () => {
    expect(discoverAttempts(concealed, boardOf(five, { discoverAttemptsPerFaction: 0 }))).toEqual([]);
  });

  it("falls back to the default when the board says nothing", () => {
    // Absence must never change a rule: every board built before the setting
    // existed carries no value for it.
    expect(discoverAttempts(concealed, boardOf(five))).toHaveLength(DISCOVER_ATTEMPTS_PER_FACTION);
    expect(discoverAttempts(concealed, boardOf(five, {}))).toHaveLength(DISCOVER_ATTEMPTS_PER_FACTION);
  });

  it("still spends in arrival order when the cap is raised", () => {
    const acquired = { s5: 1, s3: 2, s1: 3, s2: 4, s4: 5 };
    const out = discoverAttempts(concealed, boardOf(five, { discoverAttemptsPerFaction: 2 }), { acquiredAt: acquired });
    expect(ids(out)).toEqual(["s5", "s3"]);
  });
});

