/**
 * @file The rest of Ch. 19 — Region, Civilians, victory and the setup gates.
 * @see docs/19-environment.md, docs/45-implementation-status.md C2
 */

import { describe, it, expect } from "vitest";
import {
  regionBonusFor, regionsAdjacent, REGION_ADJACENCY,
  civilianKill, civiliansNeeded, mayAttackCivilian, checkVictory,
  attacksPermitted, territoryCreationAmplified,
} from "../../module/rules/environment.mjs";

const at = (i, j) => ({ i, j });

/* ── 19.3 Region ──────────────────────────────────────────────────────────── */

describe("the war's Region", () => {
  it("grants a parameter step to a Servant from that region", () => {
    expect(regionBonusFor({ kind: "servant", region: ["greece"] }, "greece")).toBe(1);
  });

  it("grants nothing to a Servant from elsewhere", () => {
    expect(regionBonusFor({ kind: "servant", region: ["japan"] }, "greece")).toBe(0);
  });

  it("matches on ANY of a Servant's regions", () => {
    // Van Gogh is "Netherlands, Europe, Greece" — she benefits from a Greek,
    // Dutch or European war.
    const vanGogh = { kind: "servant", region: ["netherlands", "europe", "greece"] };

    expect(regionBonusFor(vanGogh, "greece")).toBe(1);
    expect(regionBonusFor(vanGogh, "netherlands")).toBe(1);
  });

  it("grants nothing when no region was chosen", () => {
    expect(regionBonusFor({ kind: "servant", region: ["greece"] }, null)).toBe(0);
  });

  it("grants nothing to a Master", () => {
    // "all Servants from the corresponding Region" — Servants only.
    expect(regionBonusFor({ kind: "master", region: ["greece"] }, "greece")).toBe(0);
  });

  it("knows which regions are geographically adjacent", () => {
    // Curated data, because the source does not tabulate it. Semiramis is the
    // only consumer today, but the mechanism is general.
    expect(regionsAdjacent("middleEast", "greece")).toBe(true);
    expect(regionsAdjacent("greece", "middleEast")).toBe(true);
  });

  it("does not claim distant regions are adjacent", () => {
    expect(regionsAdjacent("japan", "netherlands")).toBe(false);
  });

  it("does not call a region adjacent to itself", () => {
    expect(regionsAdjacent("greece", "greece")).toBe(false);
  });

  it("keeps the adjacency graph symmetric", () => {
    // A one-way edge would make Semiramis's Construction counter depend on the
    // order the two regions happened to be compared in.
    for (const [from, entry] of Object.entries(REGION_ADJACENCY)) {
      for (const to of entry.adjacent) {
        expect(REGION_ADJACENCY[to], `${to} is named by ${from} but has no entry`).toBeDefined();
        expect(REGION_ADJACENCY[to].adjacent, `${to} does not name ${from} back`).toContain(from);
      }
    }
  });
});

/* ── 19.5 Civilians ───────────────────────────────────────────────────────── */

describe("Civilians", () => {
  const servant = (over = {}) => ({ id: "s", kind: "servant", alignment: { morality: "evil" }, ...over });
  const civilian = { id: "c", kind: "civilian" };

  it("kills a Civilian outright, with no damage calculation", () => {
    // "If a Servant Attacks a Civilian, the Civilian is instantly killed."
    expect(civilianKill(servant(), civilian)).toContainEqual(
      expect.objectContaining({ kind: "defeat", unitId: "c" }));
  });

  it("rewards the killer with 100 Health and 1 Agility", () => {
    const out = civilianKill(servant(), civilian);

    expect(out).toContainEqual(expect.objectContaining({ kind: "heal", unitId: "s", amount: 100 }));
    expect(out).toContainEqual(expect.objectContaining({ kind: "statDelta", unitId: "s", delta: 1 }));
  });

  it("refuses a Good-aligned Servant", () => {
    // "Servants with the Good Alignment will not kill Civilians."
    expect(mayAttackCivilian(servant({ alignment: { morality: "good" } })))
      .toMatchObject({ ok: false, reason: "goodAligned" });
  });

  it("allows a Good-aligned Servant with a Command Spell override", () => {
    // "They will only kill Civilians if a Command Spell is used."
    expect(mayAttackCivilian(servant({ alignment: { morality: "good" } }), { overrides: ["goodAligned"] }))
      .toMatchObject({ ok: true });
  });

  it("allows anyone else", () => {
    expect(mayAttackCivilian(servant())).toMatchObject({ ok: true });
  });

  it("tops the board up to two Civilians on Lunatic", () => {
    expect(civiliansNeeded([{ kind: "civilian" }], "lunatic")).toBe(1);
  });

  it("wants none once the invariant is met", () => {
    expect(civiliansNeeded([{ kind: "civilian" }, { kind: "civilian" }], "lunatic")).toBe(0);
  });

  it("wants none at all below Lunatic", () => {
    expect(civiliansNeeded([], "expert")).toBe(0);
  });
});

/* ── 19.4 Victory ─────────────────────────────────────────────────────────── */

describe("checkVictory", () => {
  const living = (faction, id) => ({ id, faction, kind: "servant", health: { value: 100 } });

  it("declares no winner when the Grail was destroyed", () => {
    expect(checkVictory({ units: [living("a", "1")], grail: { destroyed: true } }))
      .toMatchObject({ outcome: "noWinner" });
  });

  it("awards the war to a faction that held the Grail a full Round", () => {
    const board = {
      units: [living("a", "1"), living("b", "2")],
      grail: { destroyed: false, contest: { 1: { unitId: "1", roundsHeld: 1 } } },
    };

    expect(checkVictory(board)).toMatchObject({ outcome: "grailObtained", faction: "a" });
  });

  it("awards it to the last faction standing", () => {
    const board = {
      units: [living("a", "1"), { id: "2", faction: "b", kind: "servant", health: { value: 0 } }],
      grail: { destroyed: false, contest: {} },
    };

    expect(checkVictory(board)).toMatchObject({ outcome: "elimination", faction: "a" });
  });

  it("declares nothing while two factions are alive", () => {
    const board = {
      units: [living("a", "1"), living("b", "2")],
      grail: { destroyed: false, contest: {} },
    };

    expect(checkVictory(board)).toBeNull();
  });

  it("puts destruction ahead of a claim, so a spite-throw is never a win", () => {
    const board = {
      units: [living("a", "1")],
      grail: { destroyed: true, contest: { 1: { unitId: "1", roundsHeld: 1 } } },
    };

    expect(checkVictory(board).outcome).toBe("noWinner");
  });
});

/* ── 19.7 Setup gates ─────────────────────────────────────────────────────── */

describe("the Round 1 attack gate", () => {
  it("forbids attacks during the first Round", () => {
    // "During the first Round, neither Player/Faction is allowed to Attack."
    expect(attacksPermitted(1)).toBe(false);
  });

  it("permits them from Round 2", () => {
    expect(attacksPermitted(2)).toBe(true);
  });
});

/* ── 19.1 E5 ──────────────────────────────────────────────────────────────── */

describe("Territory Creation amplification", () => {
  const board = { zones: { base: { faction: "a", panels: [at(0, 0)] } } };

  it("amplifies for an owner standing in its own base", () => {
    expect(territoryCreationAmplified({ id: "u", faction: "a", panel: at(0, 0) }, board)).toBe(true);
  });

  it("still amplifies an attack made OUT of the base", () => {
    // "applying even to attacks out of the base" — what matters is where the
    // owner stands, not where its target is.
    expect(territoryCreationAmplified({ id: "u", faction: "a", panel: at(0, 0) }, board, at(9, 9)))
      .toBe(true);
  });

  it("does not amplify for an owner who has left", () => {
    expect(territoryCreationAmplified({ id: "u", faction: "a", panel: at(9, 9) }, board)).toBe(false);
  });
});
