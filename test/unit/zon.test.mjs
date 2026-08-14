/**
 * @file ZON — the Effective Servant Zone.
 * @see docs/06-stats-and-resources.md §6.9, docs/16-relationships.md §16.3
 *
 * The two consumers of `outsideZon` — pipeline stage 9 and the Noble Phantasm
 * legality check — both existed before anything computed it, so both rules had
 * always been inert. These tests pin the derivation and then check that both
 * consumers actually fire.
 */

import { describe, it, expect } from "vitest";
import { zonRadius, zonStatus, masterOf, annotateZon, ZON_BASE } from "../../module/rules/zon.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });

function servant(id, panel, over = {}) {
  return {
    id, name: id, kind: "servant", panel, faction: "red",
    contract: "contracted", servantClasses: ["saber"], zonBonuses: [], ...over,
  };
}

function master(id, panel, over = {}) {
  return { id, name: id, kind: "master", panel, faction: "red", zon: 0, ...over };
}

function boardWith(units) {
  return { bounds: squareBounds(13), units, alliances: {} };
}

/* -------------------------------------------------------------------------- */

describe("zonRadius — the class table and the max-not-sum channel", () => {
  const m = master("m", at(6, 6));

  it("reproduces the stated defaults", () => {
    // Saber/Lancer/Rider/Berserker 2, Archer 4, Assassin 4, Caster 5 (§6.9).
    expect(zonRadius(servant("s", at(0, 0), { servantClasses: ["saber"] }), m)).toBe(2);
    expect(zonRadius(servant("s", at(0, 0), { servantClasses: ["berserker"] }), m)).toBe(2);
    expect(zonRadius(servant("s", at(0, 0), { servantClasses: ["assassin"] }), m)).toBe(4);
    expect(zonRadius(servant("s", at(0, 0), { servantClasses: ["caster"] }), m)).toBe(5);
  });

  it("does not stack the class bonus with Independent Action — it takes the higher", () => {
    // An Assassin with Independent Action B (+2) is still 4, not 6: the class
    // bonus and Independent Action are "the same effect".
    const assassin = servant("s", at(0, 0), {
      servantClasses: ["assassin"],
      zonBonuses: [{ value: 2, stacks: false, source: "Independent Action" }],
    });
    expect(zonRadius(assassin, m)).toBe(4);
  });

  it("takes the highest of several non-stacking bonuses", () => {
    const s = servant("s", at(0, 0), {
      zonBonuses: [{ value: 1, stacks: false }, { value: 3, stacks: false }],
    });
    expect(zonRadius(s, m)).toBe(2 + 3);
  });

  it("stacks a bonus that declares itself as stacking", () => {
    // Kingprotea: base 2 + Independent Action B (+2, exclusive) + Mad
    // Enhancement (+2, stacking) = 6 (§6.9).
    const kingprotea = servant("s", at(0, 0), {
      zonBonuses: [
        { value: 2, stacks: false, source: "Independent Action" },
        { value: 2, stacks: true, source: "Mad Enhancement" },
      ],
    });
    expect(zonRadius(kingprotea, m)).toBe(6);
  });

  it("takes the widest zone when a Servant holds several classes", () => {
    const both = servant("s", at(0, 0), { servantClasses: ["saber", "caster"] });
    expect(zonRadius(both, m)).toBe(5);
  });

  it("falls back to the default base for a class the table does not name", () => {
    expect(zonRadius(servant("s", at(0, 0), { servantClasses: ["ruler"] }), m)).toBe(2);
    expect(ZON_BASE.ruler).toBeUndefined();
  });

  it("never returns less than the Master's own stated ZON", () => {
    expect(zonRadius(servant("s", at(0, 0)), master("m", at(6, 6), { zon: 7 }))).toBe(7);
  });
});

describe("zonStatus", () => {
  it("is inside when the Servant is within the radius", () => {
    const m = master("m", at(6, 6));
    const s = servant("s", at(6, 8)); // Chebyshev 2, Saber radius 2
    expect(zonStatus(s, boardWith([m, s])).outside).toBe(false);
  });

  it("is outside one panel further out", () => {
    const m = master("m", at(6, 6));
    const s = servant("s", at(6, 9));
    const status = zonStatus(s, boardWith([m, s]));
    expect(status.outside).toBe(true);
    expect(status.distance).toBe(3);
    expect(status.zon).toBe(2);
  });

  it("measures by Chebyshev, so a diagonal counts as one", () => {
    const m = master("m", at(6, 6));
    const s = servant("s", at(8, 8)); // diagonal 2
    expect(zonStatus(s, boardWith([m, s])).outside).toBe(false);
  });

  it("cannot apply to a Free Servant, which has no Master", () => {
    const s = servant("s", at(0, 0), { contract: "free" });
    expect(zonStatus(s, boardWith([s]))).toMatchObject({ zon: null, outside: false });
  });

  it("cannot apply when the faction has no Master on the board", () => {
    const s = servant("s", at(0, 0));
    expect(zonStatus(s, boardWith([s])).outside).toBe(false);
  });

  it("exempts a Servant flagged as exempt — Semiramis aboard the Gardens", () => {
    const m = master("m", at(0, 0));
    const s = servant("s", at(12, 12), { zonExempt: true });
    expect(zonStatus(s, boardWith([m, s])).outside).toBe(false);
  });

  it("is satisfied if either Dioscuri twin is inside", () => {
    const m = master("m", at(6, 6));
    const castor = servant("castor", at(6, 7), { zonPartnerIds: ["pollux"] });
    const pollux = servant("pollux", at(12, 12), { zonPartnerIds: ["castor"] });
    const board = boardWith([m, castor, pollux]);

    // Pollux is six panels outside, but Castor is inside, so neither is
    // penalised: the test is `any`, not `all` (§6.9).
    expect(zonStatus(pollux, board).outside).toBe(false);
    expect(zonStatus(castor, board).outside).toBe(false);
  });

  it("penalises both twins when neither is inside", () => {
    const m = master("m", at(0, 0));
    const castor = servant("castor", at(11, 11), { zonPartnerIds: ["pollux"] });
    const pollux = servant("pollux", at(12, 12), { zonPartnerIds: ["castor"] });
    const board = boardWith([m, castor, pollux]);
    expect(zonStatus(castor, board).outside).toBe(true);
    expect(zonStatus(pollux, board).outside).toBe(true);
  });
});

describe("masterOf", () => {
  it("prefers an explicit masterId", () => {
    const a = master("a", at(0, 0));
    const b = master("b", at(1, 1), { faction: "blue" });
    const s = servant("s", at(2, 2), { masterId: "b" });
    expect(masterOf(s, boardWith([a, b, s]))?.id).toBe("b");
  });

  it("falls back to the faction's Master when nothing is linked", () => {
    const m = master("m", at(0, 0));
    expect(masterOf(servant("s", at(2, 2)), boardWith([m]))?.id).toBe("m");
  });

  it("has no answer for a Servant with no faction and no link", () => {
    expect(masterOf(servant("s", at(2, 2), { faction: null }), boardWith([]))).toBe(null);
  });
});

describe("annotateZon writes the fields both consumers read", () => {
  it("fills zon, zonDistance and outsideZon on every unit", () => {
    const m = master("m", at(6, 6));
    const s = servant("s", at(6, 10));
    const board = boardWith([m, s]);
    annotateZon(board.units, board);

    expect(s.zon).toBe(2);
    expect(s.zonDistance).toBe(4);
    expect(s.outsideZon).toBe(true);
    expect(s.zonMasterId).toBe("m");
  });

  it("makes a Noble Phantasm illegal from outside the zone", () => {
    // `limits.requiresZon` has been in the resolver since the start and could
    // never fire, because nothing set `outsideZon`.
    const m = master("m", at(6, 6));
    const caster = servant("s", at(6, 10));
    const foe = servant("foe", at(6, 11), { faction: "blue" });
    const board = boardWith([m, caster, foe]);
    annotateZon(board.units, board);

    const spec = {
      anchor: { kind: "targetUnit", range: 3 },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all" },
      limits: { requiresZon: true },
    };
    const resolved = resolveTargets(spec, caster, board, { unitId: "foe" });
    expect(resolved.errors.join(" ")).toMatch(/within its Master's ZON/);
    expect(resolved.errors.join(" ")).toMatch(/4 panels away, ZON is 2/);
  });

  it("permits the same Noble Phantasm from inside it", () => {
    const m = master("m", at(6, 6));
    const caster = servant("s", at(6, 7));
    const foe = servant("foe", at(6, 8), { faction: "blue" });
    const board = boardWith([m, caster, foe]);
    annotateZon(board.units, board);

    const spec = {
      anchor: { kind: "targetUnit", range: 3 },
      shape: { kind: "unit" },
      selection: { relations: ["enemy"], chooser: "all" },
      limits: { requiresZon: true },
    };
    expect(resolveTargets(spec, caster, board, { unitId: "foe" }).errors).toEqual([]);
  });
});
