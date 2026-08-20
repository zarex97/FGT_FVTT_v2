/**
 * @file Charm and control transfer.
 * @see docs/25-turn-system.md §25.7, docs/18-action-economy.md §18.5
 */

import { describe, it, expect } from "vitest";
import { controllerOf, unitsControlledBy, isCharmed, charmSource } from "../../module/rules/control.mjs";

const unit = (over = {}) => ({
  id: "u", factionId: "red", ownerUserId: "u-red", effects: [], ...over,
});

const charm = (over = {}) => ({ defId: "charm", isActive: true, source: { unitId: "enemy" }, ...over });

const board = (units) => ({ units });

describe("controllerOf", () => {
  it("returns the owner when nothing has taken control", () => {
    expect(controllerOf(unit(), board([unit()]))).toBe("u-red");
  });

  it("returns the CHARMER's controller while charmed", () => {
    // "a charmed unit appears in the charmer's currentUnits during their turn
    // and is absent from its owner's".
    const charmer = unit({ id: "enemy", ownerUserId: "u-blue" });
    const victim = unit({ id: "u", effects: [charm({ source: { unitId: "enemy" } })] });

    expect(controllerOf(victim, board([victim, charmer]))).toBe("u-blue");
  });

  it("ignores an expired charm", () => {
    const victim = unit({ effects: [charm({ isActive: false })] });

    expect(controllerOf(victim, board([victim]))).toBe("u-red");
  });

  it("falls back to the GM when the charmer has no owner", () => {
    // A GM-run enemy charming a player's Servant. Returning the victim's own
    // owner would hand control back to the player the charm just took it from.
    const charmer = unit({ id: "enemy", ownerUserId: null });
    const victim = unit({ effects: [charm()] });

    expect(controllerOf(victim, board([victim, charmer]))).toBe(null);
  });

  it("falls back to the GM when the charmer is no longer on the board", () => {
    // The charmer was defeated but the charm has not expired yet.
    expect(controllerOf(unit({ effects: [charm()] }), board([]))).toBe(null);
  });

  it("follows a chain of charms to whoever actually holds the charmer", () => {
    // A charms B, B charms C. C answers to whoever holds B, and that is A's
    // controller -- not B's owner, who at this moment controls nothing.
    const a = unit({ id: "a", ownerUserId: "u-a" });
    const b = unit({ id: "b", ownerUserId: "u-b", effects: [charm({ source: { unitId: "a" } })] });
    const c = unit({ id: "c", ownerUserId: "u-c", effects: [charm({ source: { unitId: "b" } })] });

    expect(controllerOf(c, board([a, b, c]))).toBe("u-a");
  });

  it("survives a charm that points at itself", () => {
    // Nonsense content, but an unguarded cycle here hangs the turn HUD.
    const self = unit({ id: "u", effects: [charm({ source: { unitId: "u" } })] });

    expect(controllerOf(self, board([self]))).toBe("u-red");
  });
});

describe("a cycle of charms", () => {
  it("terminates rather than hanging the turn HUD", () => {
    // A charms B and B charms A. Content should never produce it; the guard is
    // there because the failure mode is a hang, not a wrong answer.
    const a = unit({ id: "a", ownerUserId: "u-a", effects: [charm({ source: { unitId: "b" } })] });
    const b = unit({ id: "b", ownerUserId: "u-b", effects: [charm({ source: { unitId: "a" } })] });

    expect(() => controllerOf(a, board([a, b]))).not.toThrow();
    expect(controllerOf(a, board([a, b]))).toBe("u-a");
  });
});

describe("isCharmed / charmSource", () => {
  it("recognises an active charm and names its source", () => {
    const victim = unit({ effects: [charm({ source: { unitId: "enemy" } })] });

    expect(isCharmed(victim)).toBe(true);
    expect(charmSource(victim)).toBe("enemy");
  });

  it("is false for an uncharmed unit", () => {
    expect(isCharmed(unit())).toBe(false);
    expect(charmSource(unit())).toBe(null);
  });
});

describe("unitsControlledBy", () => {
  const charmer = unit({ id: "enemy", factionId: "blue", ownerUserId: "u-blue" });
  const victim = unit({ id: "victim", factionId: "red", ownerUserId: "u-red", effects: [charm()] });
  const free = unit({ id: "free", factionId: "red", ownerUserId: "u-red" });

  it("moves a charmed unit into the charmer's list", () => {
    expect(unitsControlledBy("u-blue", board([charmer, victim, free])).map((u) => u.id))
      .toEqual(["enemy", "victim"]);
  });

  it("takes it out of its owner's list", () => {
    // Both halves matter: a unit in two lists acts twice.
    expect(unitsControlledBy("u-red", board([charmer, victim, free])).map((u) => u.id))
      .toEqual(["free"]);
  });

  it("gives the GM the units nobody owns", () => {
    const orphan = unit({ id: "orphan", ownerUserId: null });

    expect(unitsControlledBy(null, board([orphan, free])).map((u) => u.id)).toEqual(["orphan"]);
  });
});
