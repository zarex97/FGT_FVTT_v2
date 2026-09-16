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
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { collectAuras } from "../../module/rules/auras.mjs";
import { resolveDefeat } from "../../module/engine/scheduler.mjs";

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

describe("self:withinOfPartner — how close the twins stand", () => {
  it("emits a ladder from the actual distance up to 6", () => {
    const options = rollOptionsFor({ attacker: { id: "castor", partnerDistance: 2 } });
    expect(options.has("self:withinOfPartner:2")).toBe(true);
    expect(options.has("self:withinOfPartner:3")).toBe(true);
    expect(options.has("self:withinOfPartner:6")).toBe(true);
    // A unit 2 away is NOT "within 1".
    expect(options.has("self:withinOfPartner:1")).toBe(false);
  });

  it("emits adjacency as :1, with no special case", () => {
    const options = rollOptionsFor({ attacker: { id: "castor", partnerDistance: 1 } });
    expect(options.has("self:withinOfPartner:1")).toBe(true);
  });

  it("emits nothing when there is no partner to measure to", () => {
    // `null` is the right answer for a twin standing alone, and it makes
    // `self:withinOfPartner:1` false and its negation true -- both correct.
    const options = rollOptionsFor({ attacker: { id: "castor", partnerDistance: null } });
    expect([...options].some((o) => o.includes("withinOfPartner"))).toBe(false);
  });
});

describe("R5 — Mad Enhancement's drain halves beside Pollux, and so do its floor and threshold", () => {
  /** Mad Enhancement clause 1, as `mad-enhancement.yml` authors it plus R5. */
  const clause = {
    key: "OnEvent",
    event: "actedTurnEnd",
    automatic: true,
    then: [
      {
        key: "StatDelta", subject: "master", stat: "health.value",
        table: "madEnhancementDrain", direction: "down",
        floorTable: "madEnhancementDrain",
        tableFactor: { value: 0.5, predicate: ["self:withinOfPartner:1"] },
      },
      {
        key: "SetMode", ability: "madEnhancement", active: false,
        whenValue: { subject: "master", stat: "health.value", lteTable: "madEnhancementDrain" },
        tableFactor: { value: 0.5, predicate: ["self:withinOfPartner:1"] },
      },
    ],
  };

  /** @param {number|null} distance @returns {object[]} */
  const actionsAt = (distance) => {
    const options = rollOptionsFor({ attacker: { id: "castor", partnerDistance: distance } });
    return collectContributions(
      [{ id: "me", name: "Mad Enhancement", rank: "B-", active: true, activeRules: [clause] }],
      { options },
    ).eventHandlers[0].actions;
  };

  it("drains 20 and deactivates at 20 when the twins are apart", () => {
    const [drain, mode] = actionsAt(3);
    expect(drain.amount).toBe(20);
    expect(drain.floor).toBe(20);
    expect(mode.whenValue.lte).toBe(20);
  });

  it("drains 10 and deactivates at 10 when Castor stands beside Pollux", () => {
    const [drain, mode] = actionsAt(1);
    expect(drain.amount).toBe(10);
    // The floor and the threshold move WITH the drain. `madEnhancementDrain`
    // is one number read three times, and halving only the drain would leave
    // Mad Enhancement running until the Master was under 20.
    expect(drain.floor).toBe(10);
    expect(mode.whenValue.lte).toBe(10);
  });

  it("does not halve for a Castor with no partner on the board", () => {
    const [drain] = actionsAt(null);
    expect(drain.amount).toBe(20);
  });
});

describe("R7 — `(and Pollux if she is out of the Skill's Range)`", () => {
  const spec = {
    anchor: { kind: "self" },
    shape: { kind: "chebyshevRadius", r: 2 },
    selection: {
      relations: ["ally", "self"], includeSelf: true, chooser: "all",
      alsoIncludes: "partner",
    },
  };

  const pair = (castorPanel, polluxPanel) => {
    const c = linked("castor", castorPanel, ["pollux"]);
    const p = linked("pollux", polluxPanel, ["castor"]);
    return { c, p, board: boardOf([c, p]) };
  };

  it("includes the partner standing outside the shape", () => {
    const { c, board } = pair(at(3, 3), at(9, 9));
    expect(resolveTargets(spec, c, board).units.map((u) => u.unitId)).toContain("pollux");
  });

  it("does not include the partner twice when already inside the shape", () => {
    const { c, board } = pair(at(3, 3), at(4, 3));
    const ids = resolveTargets(spec, c, board).units.map((u) => u.unitId);
    expect(ids.filter((id) => id === "pollux")).toHaveLength(1);
  });

  it("changes nothing for a spec that does not ask", () => {
    const plain = { ...spec, selection: { ...spec.selection, alsoIncludes: undefined } };
    const { c, board } = pair(at(3, 3), at(9, 9));
    expect(resolveTargets(plain, c, board).units.map((u) => u.unitId)).not.toContain("pollux");
  });
});

describe("P7 — Magic Resistance reaches Castor when he stands beside Pollux", () => {
  const mr = {
    key: "resistance", component: "mag", radius: 1,
    relations: ["ally"], recipientRoles: ["linkedPartner"],
  };

  const withAura = (id, panel, partners) => linked(id, panel, partners, { auras: [mr] });

  it("reaches the linked partner within the radius", () => {
    const p = withAura("pollux", at(3, 3), ["castor"]);
    const c = linked("castor", at(4, 3), ["pollux"]);
    expect(collectAuras(c, boardOf([p, c]))).toHaveLength(1);
  });

  it("does not reach an ordinary ally standing just as close", () => {
    const p = withAura("pollux", at(3, 3), ["castor"]);
    const karna = { id: "karna", kind: "servant", faction: "red", panel: at(4, 3), auras: [] };
    expect(collectAuras(karna, boardOf([p, karna]))).toHaveLength(0);
  });

  it("does not reach the partner standing two panels away", () => {
    const p = withAura("pollux", at(3, 3), ["castor"]);
    const c = linked("castor", at(5, 3), ["pollux"]);
    expect(collectAuras(c, boardOf([p, c]))).toHaveLength(0);
  });
});

describe("D4 / Q11 — if either twin is truly defeated, so is the other", () => {
  const twin = (id, partnerId, over = {}) => ({
    id, name: id, kind: "servant", health: 0, maxHealth: 1500,
    linkedGroup: {
      id: "dioscuri", memberIds: [partnerId], leash: 2, unitWeight: 0.5,
      linkedDeath: "ignoresRevival", sharedCooldowns: "byName",
    },
    revivals: [], eventHandlers: [], ...over,
  });

  const ctx = { tick: 0, turnsPerRound: 3, overkill: 0, rolls: {} };

  it("defeats the partner when a twin is truly defeated", () => {
    const out = resolveDefeat(twin("castor", "pollux"), ctx);
    const defeats = out.filter((i) => i.t === "defeat");
    expect(defeats.map((d) => d.unitId)).toEqual(["castor", "pollux"]);
  });

  it("names the binding as the partner's cause, not the damage", () => {
    // The partner did not die of the hit; they died of the binding, and the
    // log should be able to say which.
    const out = resolveDefeat(twin("castor", "pollux"), ctx, "damage");
    expect(out.find((i) => i.t === "defeat" && i.unitId === "pollux").cause).toBe("linkedDeath");
  });

  it("does NOT fire while the twin's own revival is bringing her back (Q11)", () => {
    // *"imagine Pollux's HP is reduced to 0, her Guts will revive her, so in
    // the moment she is initially reduced to 0 it shouldn't link-kill Castor,
    // as she is not truly dead."* The whole ruling is WHERE this hangs: the
    // tail of resolveDefeat runs only once the chain resolved TO a defeat.
    const guts = twin("pollux", "castor", {
      // `percentOfMax` is a PERCENTAGE: `resolveRevival` divides it by 100.
      revivals: [{ id: "guts", source: "Guts", priority: 1, percentOfMax: 50, charges: 1 }],
    });
    const out = resolveDefeat(guts, ctx);
    expect(out.some((i) => i.t === "defeat")).toBe(false);
    expect(out.some((i) => i.t === "heal")).toBe(true);
  });

  it("does nothing for a group that does not link death", () => {
    const solo = twin("a", "b", {
      linkedGroup: { id: "g", memberIds: ["b"], leash: 2, unitWeight: 0.5, linkedDeath: "" },
    });
    expect(resolveDefeat(solo, ctx).filter((i) => i.t === "defeat").map((d) => d.unitId))
      .toEqual(["a"]);
  });

  it("does nothing for an ungrouped Servant", () => {
    const karna = { id: "karna", kind: "servant", health: 0, revivals: [], eventHandlers: [] };
    expect(resolveDefeat(karna, ctx).filter((i) => i.t === "defeat").map((d) => d.unitId))
      .toEqual(["karna"]);
  });
});
