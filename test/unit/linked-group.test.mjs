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
