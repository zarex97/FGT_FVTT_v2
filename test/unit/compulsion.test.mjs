/**
 * @file Compulsions — being forced to attack a particular unit.
 * @see docs/18-action-economy.md §18.5, docs/24-rules-engine.md Group 4
 * @see docs/45-implementation-status.md D1
 *
 * Two halves that had never met. `budget.unmetCompulsions` has read a `hatred`
 * effect since it was written and **nothing applied one**; and §45.4 records
 * that the four targeting executors "write keys that nothing in the targeting
 * resolver reads". So a compulsion could neither be acquired nor obeyed.
 *
 * Penthesilea's *Hatred of Achilles* is the reference case: within 4 panels of
 * any Greek Male Unit — ally or enemy — she ignores orders and must move toward
 * and attack it.
 */

import { describe, it, expect } from "vitest";
import { collectContributions } from "../../module/rules/elements.mjs";
import { annotateCompulsions, compelledTargetsOf } from "../../module/rules/compulsion.mjs";
import { unmetCompulsions } from "../../module/rules/budget.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { squareBounds } from "../../module/domain/geometry.mjs";

const at = (i, j) => ({ i, j });

/** Hatred of Achilles, as authored. */
const hatred = {
  id: "penthesilea-hatred", name: "Hatred of Achilles", rank: null,
  passiveRules: [{
    key: "Compulsion",
    id: "hatred",
    within: 4,
    // "regardless of enemy or ally" — the relation filter is deliberately open.
    relations: ["ally", "enemy"],
    targetPredicate: ["target:attribute:male", "target:region:greece"],
    forcesTarget: true,
  }],
};

const penth = (over = {}) => ({
  id: "p", faction: "a", panel: at(5, 5), kind: "servant",
  compulsionRules: collectContributions([hatred]).compulsions,
  effects: [], attributes: [], region: ["greece"], turnState: {}, ...over,
});

const greekMale = (over = {}) => ({
  id: "achilles", faction: "b", panel: at(5, 8), kind: "servant",
  attributes: ["male"], region: ["greece"], effects: [], ...over,
});

const boardOf = (units) => ({ units, alliances: {} });

describe("the Compulsion element", () => {
  it("is collected into its own bucket", () => {
    expect(collectContributions([hatred]).compulsions).toEqual([
      expect.objectContaining({ id: "hatred", within: 4, forcesTarget: true }),
    ]);
  });
});

describe("annotateCompulsions", () => {
  it("compels a unit standing within range of a matching unit", () => {
    const p = penth();
    const board = boardOf([p, greekMale()]);

    annotateCompulsions(board.units, board);

    expect(p.compulsions).toEqual([
      expect.objectContaining({ id: "hatred", targetIds: ["achilles"] }),
    ]);
  });

  it("does not compel when the matching unit is out of range", () => {
    const p = penth();
    const board = boardOf([p, greekMale({ panel: at(5, 99) })]);

    annotateCompulsions(board.units, board);

    expect(p.compulsions).toEqual([]);
  });

  it("does not compel on a unit that fails the predicate", () => {
    // A Greek woman, or a male from anywhere else, is not Achilles.
    const p = penth();
    const board = boardOf([p, greekMale({ attributes: [] })]);

    annotateCompulsions(board.units, board);

    expect(p.compulsions).toEqual([]);
  });

  it("compels regardless of whether the unit is an ally or an enemy", () => {
    // "regardless of enemy or ally" — the clause that makes this a liability
    // rather than a targeting aid.
    const p = penth();
    const ally = greekMale({ id: "ally", faction: "a" });
    const board = boardOf([p, ally]);

    annotateCompulsions(board.units, board);

    expect(p.compulsions[0].targetIds).toEqual(["ally"]);
  });

  it("names every matching unit, not just the first", () => {
    const p = penth();
    const board = boardOf([p, greekMale(), greekMale({ id: "patroclus", panel: at(4, 4) })]);

    annotateCompulsions(board.units, board);

    expect(p.compulsions[0].targetIds.sort()).toEqual(["achilles", "patroclus"]);
  });

  it("leaves a unit with no compulsion rules alone", () => {
    const plain = { id: "x", faction: "a", panel: at(1, 1), compulsionRules: [] };
    const board = boardOf([plain, greekMale()]);

    annotateCompulsions(board.units, board);

    expect(plain.compulsions).toEqual([]);
  });

  it("never compels a unit toward itself", () => {
    // Penthesilea is Greek. She is not male, but a compulsion whose predicate
    // she satisfied would otherwise trap her in a loop.
    const p = penth({ attributes: ["male"] });
    const board = boardOf([p]);

    annotateCompulsions(board.units, board);

    expect(p.compulsions).toEqual([]);
  });
});

describe("compelledTargetsOf", () => {
  it("returns the units a caster is forced to attack", () => {
    const p = penth();
    const board = boardOf([p, greekMale()]);
    annotateCompulsions(board.units, board);

    expect(compelledTargetsOf(p)).toEqual(["achilles"]);
  });

  it("returns nothing for an uncompelled caster", () => {
    expect(compelledTargetsOf({ compulsions: [] })).toEqual([]);
  });

  it("ignores a compulsion that does not force a target", () => {
    // A compulsion can force an ability on without dictating who to hit.
    expect(compelledTargetsOf({ compulsions: [{ id: "x", targetIds: ["a"], forcesTarget: false }] }))
      .toEqual([]);
  });
});

describe("the budget sees an annotated compulsion", () => {
  it("refuses to end the turn while a compelled unit has not attacked", () => {
    const p = penth({ turnState: { attacked: false } });
    const other = { id: "o", faction: "a", turnState: { attacked: true }, effects: [] };
    const board = boardOf([p, greekMale()]);
    annotateCompulsions(board.units, board);

    const unmet = unmetCompulsions([p, other]);

    expect(unmet).toEqual([expect.objectContaining({ unitId: "p" })]);
  });

  it("is satisfied once the compelled unit has attacked", () => {
    const p = penth({ turnState: { attacked: true } });
    const board = boardOf([p, greekMale()]);
    annotateCompulsions(board.units, board);

    expect(unmetCompulsions([p])).toEqual([]);
  });
});

describe("a compulsion narrows attacks only", () => {
  const board = {
    // The real bounds shape; a hand-rolled `{rows, cols}` normalises every
    // panel out of existence and the resolution comes back empty.
    bounds: squareBounds(13),
    alliances: { red: ["red"], blue: ["blue"] },
    units: [
      { id: "p", name: "Penthesilea", kind: "servant", faction: "red", panel: { i: 5, j: 5 },
        compulsions: [{ id: "hatred", forcesTarget: true, targetIds: ["achilles"], within: 4 }] },
      { id: "ally", name: "Ally", kind: "servant", faction: "red", panel: { i: 5, j: 6 } },
      { id: "achilles", name: "Achilles", kind: "servant", faction: "blue", panel: { i: 6, j: 6 } },
      { id: "other", name: "Other", kind: "servant", faction: "blue", panel: { i: 4, j: 4 } },
    ],
  };
  const caster = board.units[0];

  it("still forces the choice of enemy", () => {
    const spec = {
      anchor: { kind: "self" }, shape: { kind: "chebyshevRadius", r: 2 },
      selection: { relations: ["enemy"], chooser: "all" },
    };
    expect(resolveTargets(spec, caster, board, {}).units.map((u) => u.unitId)).toEqual(["achilles"]);
  });

  it("leaves an ally-targeting ability alone", () => {
    // "She will constantly Move towards and ATTACK said Unit" restricts which
    // enemy she may hit and says nothing about who she may buff. Narrowing
    // every resolution made Penthesilea's Howl of the War God refuse with "no
    // legal targets" for as long as any Greek Male stood near her — which is
    // exactly when a Berserker would want to use it.
    const spec = {
      anchor: { kind: "self" }, shape: { kind: "chebyshevRadius", r: 2 },
      selection: { relations: ["ally", "self"], chooser: "all" },
    };
    const out = resolveTargets(spec, caster, board, {});

    expect(out.units.map((u) => u.unitId).sort()).toEqual(["ally", "p"]);
    expect(out.errors).toEqual([]);
  });
});
