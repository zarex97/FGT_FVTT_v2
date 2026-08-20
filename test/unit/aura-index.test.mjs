/**
 * @file The spatial aura index, and the cache-invalidation table.
 * @see docs/23-documents-and-derived-data.md §23.9
 */

import { describe, it, expect } from "vitest";
import { buildAuraIndex, candidatesAt, BUCKET_SIZE } from "../../module/rules/aura-index.mjs";
import { collectAuras } from "../../module/rules/auras.mjs";
import {
  invalidationsFor, CAN_ACT_INVALIDATORS, INVALIDATION_TARGETS, affectsCanAct,
} from "../../module/rules/invalidation.mjs";

const bearer = (over = {}) => ({
  id: "penthesilea", factionId: "red", panel: { i: 10, j: 10 },
  auras: [{ id: "charisma", radius: 3, relations: ["ally", "self"] }],
  ...over,
});

const board = (units) => ({ units, width: 40, height: 40 });

/* ── The index ────────────────────────────────────────────────── */

describe("buildAuraIndex", () => {
  it("indexes only the units that have auras", () => {
    // "hasAuras is a cached boolean, so units with no auras -- most of them --
    // cost one property read."
    const index = buildAuraIndex(board([bearer(), { id: "plain", panel: { i: 1, j: 1 } }]));

    expect(index.count).toBe(1);
  });

  it("stamps a version, so a rebuild is detectable", () => {
    expect(buildAuraIndex(board([bearer()])).version).toBe(1);
    expect(buildAuraIndex(board([bearer()]), 7).version).toBe(8);
  });

  it("puts an aura in every bucket it could reach", () => {
    // A radius-3 aura at (10,10) spans panels 7..13, which crosses a 4-panel
    // bucket boundary. Indexing only the bearer's own bucket is the bug this
    // test exists for: the aura would stop applying three panels away, which is
    // exactly where it starts mattering.
    expect(buildAuraIndex(board([bearer()])).buckets.size).toBeGreaterThan(1);
  });

  it("handles a unit with no panel", () => {
    // An actor with no token on this scene. It has auras and no position, so it
    // projects nothing rather than projecting from (0,0).
    expect(buildAuraIndex(board([bearer({ panel: null })])).count).toBe(0);
  });
});

describe("candidatesAt", () => {
  const index = buildAuraIndex(board([bearer()]));

  it("finds an aura the panel is inside", () => {
    expect(candidatesAt(index, { i: 12, j: 10 }).map((c) => c.aura.id)).toEqual(["charisma"]);
  });

  it("finds one the panel is exactly on the edge of", () => {
    // Radius 3 means 3 is inside. An off-by-one here silently shrinks every
    // aura in the game by one panel.
    expect(candidatesAt(index, { i: 13, j: 10 })).toHaveLength(1);
  });

  it("does not find one the panel is outside", () => {
    expect(candidatesAt(index, { i: 14, j: 10 })).toHaveLength(0);
  });

  it("includes the BEARER's own panel", () => {
    // "every allied unit includes itself unless stated otherwise" -- the aura
    // that stopped at its bearer was a real bug, and this is its regression.
    expect(candidatesAt(index, { i: 10, j: 10 })).toHaveLength(1);
  });

  it("carries the source unit, because relations are not its job", () => {
    // The index narrows candidates; `collectAuras` judges them. Two relation
    // implementations would be two answers to one question.
    expect(candidatesAt(index, { i: 11, j: 10 })[0].unit.id).toBe("penthesilea");
  });

  it("returns nothing for a query on an empty index", () => {
    expect(candidatesAt(buildAuraIndex(board([])), { i: 1, j: 1 })).toEqual([]);
  });

  it("returns nothing for a unit with no panel", () => {
    expect(candidatesAt(index, null)).toEqual([]);
  });

  it("buckets in the documented 4-panel size", () => {
    expect(BUCKET_SIZE).toBe(4);
  });
});

describe("the index against the linear scan", () => {
  it("narrows to exactly the sources collectAuras would have considered", () => {
    // The index is an optimisation, and an optimisation that disagrees with the
    // thing it replaces is a bug that only shows up on a full board. 24 units,
    // mixed radii, every third panel.
    const units = [];
    for (let k = 0; k < 24; k++) {
      units.push(bearer({
        id: `u${k}`, factionId: k % 2 ? "red" : "blue",
        panel: { i: (k * 5) % 37, j: (k * 7) % 37 },
        auras: [{ id: `a${k}`, radius: (k % 4) + 1, relations: ["ally", "self"] }],
      }));
    }
    const b = board(units);
    const index2 = buildAuraIndex(b);

    for (let i = 0; i < 37; i += 3) {
      for (let j = 0; j < 37; j += 3) {
        const viaIndex = candidatesAt(index2, { i, j }).map((c) => c.aura.id).sort();
        const viaScan = units
          .filter((u) => Math.max(Math.abs(u.panel.i - i), Math.abs(u.panel.j - j)) <= u.auras[0].radius)
          .map((u) => u.auras[0].id).sort();

        expect(viaIndex, `disagreement at ${i},${j}`).toEqual(viaScan);
      }
    }
  });

  it("produces the same modifiers through collectAuras, indexed or not", () => {
    // The property that actually matters: the same board, the same answer.
    const units = [
      bearer({ id: "a", factionId: "red", panel: { i: 5, j: 5 } }),
      bearer({ id: "b", factionId: "red", panel: { i: 7, j: 5 }, auras: [] }),
      bearer({ id: "c", factionId: "blue", panel: { i: 6, j: 6 }, auras: [] }),
    ];
    const b = board(units);
    const index2 = buildAuraIndex(b);

    for (const u of units) {
      expect(collectAuras(u, b), u.id).toEqual(collectAuras(u, b, index2));
    }
  });
});

/* ── The invalidation table ───────────────────────────────────────────────── */

describe("invalidationsFor", () => {
  it("invalidates the actor and the board on a system-field change", () => {
    expect(invalidationsFor("actorField", { actorId: "karna" }))
      .toEqual(expect.arrayContaining(["snapshot:karna", "board"]));
  });

  it("invalidates the aura index for an effect that grants an aura", () => {
    // "aura index IF the effect grants an aura" -- rebuilding on every effect
    // would rebuild on every burn tick.
    expect(invalidationsFor("effectChanged", { actorId: "karna", grantsAura: true }))
      .toContain("auraIndex");
    expect(invalidationsFor("effectChanged", { actorId: "karna", grantsAura: false }))
      .not.toContain("auraIndex");
  });

  it("invalidates everything when a token is deleted", () => {
    expect(invalidationsFor("tokenDeleted", {})).toContain("all");
  });

  it("invalidates ZON and the aura index when a token moves", () => {
    expect(invalidationsFor("tokenMoved", { actorId: "karna" }))
      .toEqual(expect.arrayContaining(["board", "auraIndex", "zon:karna"]));
  });

  it("invalidates MASTER PROTECTION when a mode toggle changes canAct", () => {
    // The row that is easy to miss. Deactivating a mode does not move anyone,
    // but if it changes whether the Servant can act, an adjacent Master's
    // protection turns on or off with it.
    expect(invalidationsFor("modeToggled", { actorId: "karna", affectsCanAct: true }))
      .toContain("masterProtection:karna");
  });

  it("invalidates cooldowns and effect activity on a turn", () => {
    expect(invalidationsFor("turnAdvanced", {}))
      .toEqual(expect.arrayContaining(["board", "cooldowns", "effectActivity"]));
  });

  it("adds the day/night phase on a round", () => {
    expect(invalidationsFor("roundAdvanced", {})).toContain("phase");
  });

  it("returns nothing for an event it does not know", () => {
    // Better than invalidating everything: an unknown event that cleared the
    // world every time would be a permanent full rebuild nobody noticed.
    expect(invalidationsFor("somethingNew", {})).toEqual([]);
  });

  it("only ever names documented targets", () => {
    for (const event of ["actorField", "effectChanged", "itemChanged", "modeToggled",
      "tokenMoved", "tokenDeleted", "turnAdvanced", "roundAdvanced", "settingChanged"]) {
      for (const target of invalidationsFor(event, { actorId: "x", grantsAura: true, affectsCanAct: true })) {
        expect(INVALIDATION_TARGETS, `${event} → ${target}`).toContain(target.split(":")[0]);
      }
    }
  });
});

describe("affectsCanAct", () => {
  it("recognises every effect that stops a unit acting", () => {
    for (const id of ["stun", "stop", "freeze", "petrify", "sleep", "charm", "confuse", "berserk"]) {
      expect(affectsCanAct(id), id).toBe(true);
    }
  });

  it("does not fire for an ordinary debuff", () => {
    expect(affectsCanAct("burn")).toBe(false);
    expect(affectsCanAct("atkDown")).toBe(false);
  });

  it("lists the §23.9 set exactly", () => {
    expect([...CAN_ACT_INVALIDATORS].sort()).toEqual([
      "stun", "stop", "freeze", "petrify", "sleep", "nightmare", "coma",
      "webbed", "crystalfreeze", "charm", "confuse", "berserk",
    ].sort());
  });
});
