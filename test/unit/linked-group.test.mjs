/**
 * @file LinkedUnitGroup — the binding that makes two tokens one Servant.
 * @see docs/16-relationships.md §16.8, docs/34-case-dioscuri.md
 *
 * Ch. 16 D16.7 has specified this as a general mechanism since it was written,
 * and nothing implemented any of it. These tests pin the schema, the board
 * pass, and — the point of the whole exercise — that the readers which were
 * already waiting for it actually fire.
 */

import { describe, it, expect } from "vitest";
import { snapshotUnit } from "../../module/rules/snapshot.mjs";
import {
  partnersOf, partnerDistance, leashBroken, unitWeight, annotateLinkedGroups,
} from "../../module/rules/linked-group.mjs";
import { annotateZon } from "../../module/rules/zon.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });

/** A Servant document's `system` data, as `snapshotUnit` expects it. */
function servantSystem(over = {}) {
  return {
    parameters: { str: "A", end: "A", agi: "B", mag: "C", luc: "C" },
    health: { value: 1500, max: 1500 },
    mov: 6,
    range: { panels: 3, targets: 1 },
    servantClasses: ["avenger"],
    contract: "contracted",
    ...over,
  };
}

const doc = (id, system) => ({ id, name: id, type: "servant", system });

describe("snapshotUnit projects linkedGroup", () => {
  it("projects an authored group verbatim, with memberIds as an array", () => {
    const castor = doc("castor", servantSystem({
      linkedGroup: {
        id: "dioscuri",
        memberIds: new Set(["pollux"]),
        leash: 2,
        linkedDeath: "ignoresRevival",
        sharedCooldowns: "byName",
        unitWeight: 0.5,
        zonSatisfaction: "any",
        modifierCombination: "union",
        summonTogether: true,
      },
    }));

    const unit = snapshotUnit(castor, { panel: at(3, 3) });

    expect(unit.linkedGroup).toMatchObject({
      id: "dioscuri",
      memberIds: ["pollux"],
      leash: 2,
      linkedDeath: "ignoresRevival",
      sharedCooldowns: "byName",
      unitWeight: 0.5,
      zonSatisfaction: "any",
      modifierCombination: "union",
    });
  });

  it("projects null for a Servant with no group, so readers can branch on it", () => {
    const karna = doc("karna", servantSystem());
    expect(snapshotUnit(karna, { panel: at(0, 0) }).linkedGroup).toBeNull();
  });

  it("treats a group with no id as no group at all", () => {
    // An empty SchemaField is what a Servant document that never authored one
    // comes back as, and `{id: ""}` must not read as membership.
    const karna = doc("karna", servantSystem({
      linkedGroup: { id: "", memberIds: new Set(), unitWeight: 1 },
    }));
    expect(snapshotUnit(karna, { panel: at(0, 0) }).linkedGroup).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

/** A snapshot-shaped unit, which is what the annotate pass consumes. */
function linked(id, panel, partnerIds, over = {}) {
  return {
    id, name: id, kind: "servant", panel, faction: "red",
    contract: "contracted", servantClasses: ["avenger"], zonPartnerIds: [],
    zonBonuses: [],
    linkedGroup: {
      id: "dioscuri", memberIds: partnerIds, leash: 2,
      linkedDeath: "ignoresRevival", sharedCooldowns: "byName", unitWeight: 0.5,
      zonSatisfaction: "any", modifierCombination: "union", summonTogether: true,
    },
    ...over,
  };
}

const boardOf = (units) => ({ bounds: squareBounds(13), units, alliances: {} });

describe("the group's geometry", () => {
  it("finds the partner and measures Chebyshev to it", () => {
    const c = linked("castor", at(3, 3), ["pollux"]);
    const p = linked("pollux", at(5, 4), ["castor"]);
    const board = boardOf([c, p]);

    expect(partnersOf(c, board).map((u) => u.id)).toEqual(["pollux"]);
    expect(partnerDistance(c, board)).toBe(2);
    expect(leashBroken(c, board)).toBe(false);
  });

  it("reports the leash broken past the stated distance", () => {
    const c = linked("castor", at(3, 3), ["pollux"]);
    const p = linked("pollux", at(6, 3), ["castor"]);
    expect(leashBroken(c, boardOf([c, p]))).toBe(true);
  });

  it("is not broken by a partner who is not on the board", () => {
    // A twin that has not been placed cannot constrain one that has, and a
    // leash that refused every panel would freeze the survivor solid.
    const c = linked("castor", at(3, 3), ["pollux"]);
    expect(leashBroken(c, boardOf([c]))).toBe(false);
    expect(partnerDistance(c, boardOf([c]))).toBeNull();
  });

  it("reads the weight, defaulting an ungrouped unit to a whole unit", () => {
    expect(unitWeight(linked("castor", at(0, 0), ["pollux"]))).toBe(0.5);
    expect(unitWeight({ id: "karna", kind: "servant" })).toBe(1);
  });
});

describe("annotateLinkedGroups", () => {
  it("stamps partner facts and unions zonPartnerIds when satisfaction is `any`", () => {
    const c = linked("castor", at(3, 3), ["pollux"]);
    const p = linked("pollux", at(4, 3), ["castor"]);
    const board = boardOf([c, p]);

    annotateLinkedGroups([c, p], board);

    expect(c.partnerIds).toEqual(["pollux"]);
    expect(c.partnerDistance).toBe(1);
    expect(c.leashBroken).toBe(false);
    // `rules/zon.mjs` already reads this field and its comment quotes the
    // Dioscuri clause. Deriving it here is what keeps that reader untouched.
    expect(c.zonPartnerIds).toEqual(["pollux"]);
  });

  it("leaves zonPartnerIds alone when satisfaction is `all`", () => {
    const a = linked("a", at(3, 3), ["b"], {
      linkedGroup: { id: "g", memberIds: ["b"], leash: 2, unitWeight: 0.5, zonSatisfaction: "all" },
    });
    const b = linked("b", at(4, 3), ["a"], {
      linkedGroup: { id: "g", memberIds: ["a"], leash: 2, unitWeight: 0.5, zonSatisfaction: "all" },
    });
    annotateLinkedGroups([a, b], boardOf([a, b]));
    expect(a.zonPartnerIds).toEqual([]);
  });

  it("leaves an ungrouped unit untouched", () => {
    const k = { id: "karna", kind: "servant", panel: at(0, 0), zonPartnerIds: [] };
    annotateLinkedGroups([k], boardOf([k]));
    expect(k.partnerIds).toBeUndefined();
    expect(k.zonPartnerIds).toEqual([]);
  });
});

describe("D7 — either twin inside the Master's ZON satisfies it", () => {
  it("does not mark the far twin outside when the near one is inside", () => {
    // Saber-class ZON is 2. Castor stands 5 from the Master; Pollux stands 1.
    const master = { id: "m", name: "M", kind: "master", panel: at(6, 6), faction: "red", zon: 0 };
    const c = linked("castor", at(11, 6), ["pollux"], { masterId: "m", servantClasses: ["saber"] });
    const p = linked("pollux", at(7, 6), ["castor"], { masterId: "m", servantClasses: ["saber"] });
    const board = boardOf([master, c, p]);

    annotateLinkedGroups([master, c, p], board);
    annotateZon([master, c, p], board, {});

    expect(c.zonDistance).toBe(5);
    expect(c.outsideZon).toBe(false);
  });

  it("DOES mark it outside when the partner is out too", () => {
    // The clause is a genuine exception, not a blanket exemption.
    const master = { id: "m", name: "M", kind: "master", panel: at(6, 6), faction: "red", zon: 0 };
    const c = linked("castor", at(11, 6), ["pollux"], { masterId: "m", servantClasses: ["saber"] });
    const p = linked("pollux", at(10, 6), ["castor"], { masterId: "m", servantClasses: ["saber"] });
    const board = boardOf([master, c, p]);

    annotateLinkedGroups([master, c, p], board);
    annotateZon([master, c, p], board, {});

    expect(c.outsideZon).toBe(true);
  });
});
