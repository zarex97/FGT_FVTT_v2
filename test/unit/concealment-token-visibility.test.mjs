/**
 * @file Presence Concealment hides the token, not only the target list.
 * @see module/rules/concealment.mjs, docs/46-roster-re-audit.md §46.4-AK
 *
 * > *"This Unit cannot be targeted for an Attack or an enemy Unit's Skill."*
 *
 * The rule half of that has worked since Presence Concealment was authored: an
 * adjacent, in-range attacker is refused by name. What nothing ever did was
 * hide the **token**. A concealed Servant sat on the canvas in plain sight of
 * every player, who could read its panel, its facing and its Health bar, and
 * simply route around a Skill they could see perfectly well was there.
 *
 * The game's author asked for the D&D 5e / PF2e reading: invisible to
 * non-allies. So the predicate is the one this file exports, and the canvas
 * layer is the only thing that consumes it.
 *
 * Who still sees a concealed Unit:
 *   - the GM, always — a hidden token nobody can restore is a lost token;
 *   - anyone with OBSERVER on the actor, which is how a player sees their own;
 *   - a viewer whose faction is the Unit's, or allied with it — your own side
 *     knows where it put its Assassin.
 */

import { describe, it, expect } from "vitest";
import { hiddenFromViewer } from "../../module/rules/concealment.mjs";

const FACTIONS = [
  { id: "f1", name: "One", allies: ["f3"], userIds: ["u1"] },
  { id: "f2", name: "Two", allies: [], userIds: ["u2"] },
  { id: "f3", name: "Three", allies: ["f1"], userIds: ["u3"] },
];

/** A concealed Servant of faction 1. */
const concealed = { factionId: "f1", effects: ["presenceConcealment"] };
const plain = { factionId: "f1", effects: [] };

const viewer = (userId, over = {}) => ({ userId, isGM: false, isOwner: false, ...over });

describe("hiddenFromViewer", () => {
  it("hides a concealed Unit from an enemy", () => {
    expect(hiddenFromViewer(concealed, viewer("u2"), FACTIONS)).toBe(true);
  });

  it("does not hide one that is not concealed", () => {
    expect(hiddenFromViewer(plain, viewer("u2"), FACTIONS)).toBe(false);
  });

  it("never hides anything from the GM", () => {
    expect(hiddenFromViewer(concealed, viewer("u2", { isGM: true }), FACTIONS)).toBe(false);
  });

  it("never hides a Unit from someone who owns it", () => {
    expect(hiddenFromViewer(concealed, viewer("u2", { isOwner: true }), FACTIONS)).toBe(false);
  });

  it("does not hide it from its own faction", () => {
    expect(hiddenFromViewer(concealed, viewer("u1"), FACTIONS)).toBe(false);
  });

  it("does not hide it from a declared ALLY of its faction", () => {
    expect(hiddenFromViewer(concealed, viewer("u3"), FACTIONS)).toBe(false);
  });

  it("hides it from a viewer who has no faction at all", () => {
    // A spectator is not an ally of anybody.
    expect(hiddenFromViewer(concealed, viewer("nobody"), FACTIONS)).toBe(true);
  });

  it("is safe on a Unit with no faction and on an empty roster", () => {
    expect(hiddenFromViewer({ effects: ["presenceConcealment"] }, viewer("u2"), [])).toBe(true);
    expect(hiddenFromViewer(null, viewer("u2"), FACTIONS)).toBe(false);
  });
});
