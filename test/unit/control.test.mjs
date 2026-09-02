/**
 * @file Charm and control transfer.
 * @see docs/25-turn-system.md §25.7, docs/18-action-economy.md §18.5
 */

import { describe, it, expect } from "vitest";
import {
  controllerOf, unitsControlledBy, isCharmed, charmSource, actingFactionOf, annotateControl,
} from "../../module/rules/control.mjs";

/**
 * A unit as `rules/snapshot.mjs` actually projects one.
 *
 * `effects` is a list of bare defIds and the SOURCE lives on
 * `effectInstances` — which is the whole reason Charm transferred nothing for
 * as long as it existed: this file searched `effects` for an object carrying
 * `source.unitId`, a shape the projection has never produced, and these tests
 * agreed with it because they were written against the same invention. Charmed
 * fixtures now carry what a real board carries.
 */
const unit = (over = {}) => ({
  id: "u", factionId: "red", ownerUserId: "u-red", effects: [], effectInstances: [], ...over,
});

/** As `effectInstances` projects one. */
const charm = ({ isActive = true, source = { unitId: "enemy" }, ...over } = {}) => ({
  id: "charm-inst", defId: "charm", sourceUnitId: source?.unitId ?? null,
  suppressed: false, isActive, ...over,
});

/** A charmed unit, with the instance in the array the projection fills. */
const charmed = (over = {}, charmOver = {}) =>
  unit({ effects: ["charm"], effectInstances: [charm(charmOver)], ...over });

const board = (units) => ({ units });

describe("controllerOf", () => {
  it("returns the owner when nothing has taken control", () => {
    expect(controllerOf(unit(), board([unit()]))).toBe("u-red");
  });

  it("returns the CHARMER's controller while charmed", () => {
    // "a charmed unit appears in the charmer's currentUnits during their turn
    // and is absent from its owner's".
    const charmer = unit({ id: "enemy", ownerUserId: "u-blue" });
    const victim = charmed({ id: "u" }, { source: { unitId: "enemy" } });

    expect(controllerOf(victim, board([victim, charmer]))).toBe("u-blue");
  });

  it("ignores an expired charm", () => {
    const victim = charmed({}, { isActive: false });

    expect(controllerOf(victim, board([victim]))).toBe("u-red");
  });

  it("falls back to the GM when the charmer has no owner", () => {
    // A GM-run enemy charming a player's Servant. Returning the victim's own
    // owner would hand control back to the player the charm just took it from.
    const charmer = unit({ id: "enemy", ownerUserId: null });
    const victim = charmed();

    expect(controllerOf(victim, board([victim, charmer]))).toBe(null);
  });

  it("falls back to the GM when the charmer is no longer on the board", () => {
    // The charmer was defeated but the charm has not expired yet.
    expect(controllerOf(charmed(), board([]))).toBe(null);
  });

  it("follows a chain of charms to whoever actually holds the charmer", () => {
    // A charms B, B charms C. C answers to whoever holds B, and that is A's
    // controller -- not B's owner, who at this moment controls nothing.
    const a = unit({ id: "a", ownerUserId: "u-a" });
    const b = charmed({ id: "b", ownerUserId: "u-b" }, { source: { unitId: "a" } });
    const c = charmed({ id: "c", ownerUserId: "u-c" }, { source: { unitId: "b" } });

    expect(controllerOf(c, board([a, b, c]))).toBe("u-a");
  });

  it("survives a charm that points at itself", () => {
    // Nonsense content, but an unguarded cycle here hangs the turn HUD.
    const self = charmed({ id: "u" }, { source: { unitId: "u" } });

    expect(controllerOf(self, board([self]))).toBe("u-red");
  });
});

describe("a cycle of charms", () => {
  it("terminates rather than hanging the turn HUD", () => {
    // A charms B and B charms A. Content should never produce it; the guard is
    // there because the failure mode is a hang, not a wrong answer.
    const a = charmed({ id: "a", ownerUserId: "u-a" }, { source: { unitId: "b" } });
    const b = charmed({ id: "b", ownerUserId: "u-b" }, { source: { unitId: "a" } });

    expect(() => controllerOf(a, board([a, b]))).not.toThrow();
    expect(controllerOf(a, board([a, b]))).toBe("u-a");
  });
});

describe("isCharmed / charmSource", () => {
  it("recognises an active charm and names its source", () => {
    const victim = charmed({}, { source: { unitId: "enemy" } });

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
  const victim = charmed({ id: "victim", factionId: "red", ownerUserId: "u-red" });
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

/* -------------------------------------------------------------------------- */
/*  Whose Turn a charmed unit acts on                                          */
/* -------------------------------------------------------------------------- */

describe("actingFactionOf", () => {
  const charmer = unit({ id: "enemy", factionId: "blue", ownerUserId: "u-blue" });

  it("is the unit's own faction when nothing has taken control", () => {
    expect(actingFactionOf(unit(), board([unit()]))).toBe("red");
  });

  it("is the CHARMER's faction while charmed", () => {
    // §25.7: "a charmed unit appears in the charmer's currentUnits during
    // their turn and is absent from its owner's" -- so the Turn it may act on
    // and the budget it spends both move, while its own faction does not.
    const victim = charmed({ id: "victim" });
    expect(actingFactionOf(victim, board([victim, charmer]))).toBe("blue");
  });

  it("follows a chain, like control itself", () => {
    const a = unit({ id: "a", factionId: "green", ownerUserId: "u-a" });
    const b = charmed({ id: "b", factionId: "blue" }, { source: { unitId: "a" } });
    const c = charmed({ id: "c", factionId: "red" }, { source: { unitId: "b" } });
    expect(actingFactionOf(c, board([a, b, c]))).toBe("green");
  });

  it("keeps its own faction when the charmer has left the board", () => {
    // A charm whose source is gone cannot hand the unit to a faction that is
    // not there. Control falls back to the GM; the TURN falls back to its own.
    expect(actingFactionOf(charmed(), board([]))).toBe("red");
  });
});

describe("annotateControl", () => {
  it("writes the acting faction and the controller onto every unit", () => {
    const charmer = unit({ id: "enemy", factionId: "blue", ownerUserId: "u-blue" });
    const victim = charmed({ id: "victim", factionId: "red", ownerUserId: "u-red" });
    const units = [charmer, victim];
    annotateControl(units, board(units));

    expect(victim.actingFactionId).toBe("blue");
    expect(victim.controllerUserId).toBe("u-blue");
    // Its OWN faction is untouched: the token keeps its colour, and every
    // relation still reads it as the enemy it was.
    expect(victim.factionId).toBe("red");
    expect(charmer.actingFactionId).toBe("blue");
  });
});
