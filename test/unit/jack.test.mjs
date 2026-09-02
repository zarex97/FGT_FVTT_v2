/**
 * Jack the Ripper — the clauses that needed engine.
 *
 * @see packs/_source/servants/jack-the-ripper.yml, docs/D-servant-data-sheets.md §D.18
 */
import { describe, it, expect } from "vitest";
import { interiorModifiers, isExempt, hasCategory } from "../../module/rules/bounded-fields.mjs";
import { collectContributions, empty } from "../../module/rules/elements.mjs";
import { detectRangeOf } from "../../module/rules/identity.mjs";
import { meetsRequirement } from "../../module/rules/items.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const mist = (interior) => ({
  id: "jack-the-mist",
  ownerId: "jack",
  ownerFaction: "f1",
  geometry: { kind: "freeform" },
  panels: [{ i: 0, j: 0 }, { i: 0, j: 1 }],
  interior,
});

const unit = (over = {}) => ({
  id: "victim", kind: "servant", faction: "f2", panel: { i: 0, j: 0 },
  mov: 7, abilities: [], effects: [], ...over,
});

const board = (units) => ({ units, alliances: {} });

describe("The Mist — interior rules (Ch. 43)", () => {
  it("halves an enemy's MOV rather than subtracting a fixed number", () => {
    // The whole reason `factor` had to exist: half of 7 and half of 4 are
    // different numbers, so a delta cannot say "halved".
    const rules = interiorModifiers(
      mist([{ key: "MovDelta", factor: 0.5, minimum: 1, relations: ["enemy"] }]),
      unit(), board([unit()]),
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].factor).toBe(0.5);
  });

  it("scopes the Evade clause to Servants, as the sheet does", () => {
    // "Whenever an enemy SERVANT within the Mist Rolls for Evade" -- the
    // sentence beside it says "all enemy Units", so the kind is a real filter.
    const field = mist([{
      key: "CheckModifier", check: "evade", direction: "outgoing",
      value: 3, relations: ["enemy"], kinds: ["servant"],
    }]);
    const master = unit({ id: "m", kind: "master" });
    expect(interiorModifiers(field, unit(), board([unit()]))).toHaveLength(1);
    expect(interiorModifiers(field, master, board([master]))).toHaveLength(0);
  });

  it("caps Detect instead of subtracting from it", () => {
    // `detect` on a snapshot is the authored OVERRIDE, null on almost
    // everybody, so a subtraction would work for the Golden Hind and silently
    // do nothing for every Servant in the game.
    const capped = {
      classContainer: "saber", kind: "servant", effects: [],
      suppressions: [{ scope: "detect", maximum: 1 }],
    };
    const plain = { classContainer: "saber", kind: "servant", effects: [] };
    expect(detectRangeOf(capped)).toBe(1);
    expect(detectRangeOf(plain)).toBeGreaterThan(1);
  });
});

describe("The Instinct exemption — a rule keyed on a CATEGORY", () => {
  const instinct = (over = {}) => ({
    id: "eom", name: "Eye of the Mind (True)", rank: Rank.parseOrNull("B"),
    categorizedAs: ["instinct"], categorizedWhile: [], ...over,
  });

  it("exempts a Servant holding an Instinct-categorised skill at B or better", () => {
    const holder = unit({ abilities: [instinct()] });
    expect(hasCategory(holder, "instinct", "B")).toBe(true);
    expect(isExempt({ categorizedAs: "instinct", minRank: "B" }, holder, board([holder]))).toBe(true);
  });

  it("refuses one below the stated Rank", () => {
    const holder = unit({ abilities: [instinct({ rank: Rank.parseOrNull("C") })] });
    expect(hasCategory(holder, "instinct", "B")).toBe(false);
  });

  it("honours `categorizedWhile` — Eye of the Mind counts only while its buffs stand", () => {
    const gated = instinct({ categorizedWhile: ["dodge", "atkUp"] });
    expect(hasCategory(unit({ abilities: [gated], effects: [] }), "instinct", "B")).toBe(false);
    expect(hasCategory(unit({ abilities: [gated], effects: ["atkUp"] }), "instinct", "B")).toBe(true);
  });

  it("lends the exemption one panel to an adjacent ally, for effect 4 only", () => {
    const holder = unit({ id: "holder", faction: "f2", panel: { i: 0, j: 1 }, abilities: [instinct()] });
    const bare = unit({ id: "bare", faction: "f2", panel: { i: 0, j: 0 } });
    const b = board([holder, bare]);

    // Effect 4 lends it…
    expect(isExempt({ categorizedAs: "instinct", minRank: "B", orAdjacentToAlly: true }, bare, b)).toBe(true);
    // …3 and 5 do not.
    expect(isExempt({ categorizedAs: "instinct", minRank: "B" }, bare, b)).toBe(false);
  });

  it("does not lend it to an enemy standing next door", () => {
    const holder = unit({ id: "holder", faction: "f1", panel: { i: 0, j: 1 }, abilities: [instinct()] });
    const bare = unit({ id: "bare", faction: "f2", panel: { i: 0, j: 0 } });
    const spec = { categorizedAs: "instinct", minRank: "B", orAdjacentToAlly: true };
    expect(isExempt(spec, bare, board([holder, bare]))).toBe(false);
  });

  it("drops an exempt unit's rule out of the interior list entirely", () => {
    const field = mist([{
      key: "MovDelta", factor: 0.5, relations: ["enemy"],
      exemptIf: { categorizedAs: "instinct", minRank: "B" },
    }]);
    const exempt = unit({ abilities: [instinct()] });
    expect(interiorModifiers(field, unit(), board([unit()]))).toHaveLength(1);
    expect(interiorModifiers(field, exempt, board([exempt]))).toHaveLength(0);
  });
});

describe("Murderer of the Misty Night — pre-emption", () => {
  it("collects an AttackFirst declaration with the phases that charge a Luck Check", () => {
    const out = collectContributions([{
      id: "murderer", name: "Murderer of the Misty Night",
      passiveRules: [{ key: "AttackFirst", withinOwnRange: true, requiresLuckCheckIn: ["day"] }],
    }]);
    expect(out.preemptions).toHaveLength(1);
    expect(out.preemptions[0].withinOwnRange).toBe(true);
    // Phases, not a boolean: free at night and paid by day is the whole clause.
    expect(out.preemptions[0].requiresLuckCheckIn).toEqual(["day"]);
  });

  it("has an empty bucket on a unit with no such clause", () => {
    expect(empty().preemptions).toEqual([]);
  });
});

describe("Maria the Ripper — the Night gate", () => {
  const ctx = (phase, cycle = true) => ({
    unit: unit(), board: { phase, dayNightCycle: cycle, units: [] },
  });

  it("opens at night and refuses by day", () => {
    expect(meetsRequirement({ kind: "roundPhase", is: "night" }, ctx("night"))).toBe(true);
    expect(meetsRequirement({ kind: "roundPhase", is: "night" }, ctx("day"))).toBe(false);
  });

  it("is satisfied outright with no Day-Night cycle in play", () => {
    // "(automatically fulfilled if playing without Day-Night cycle)" -- a gate
    // that can never open would be worse than one that is always open.
    expect(meetsRequirement({ kind: "roundPhase", is: "night" }, ctx("none", false))).toBe(true);
  });
});
