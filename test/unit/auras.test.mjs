/**
 * @file Auras — the radius/relation expansion that never happened.
 * @see docs/11-effect-engine.md §11.6, docs/23-documents-and-derived-data.md §23.3
 * @see docs/45-implementation-status.md A5
 *
 * The defect: `Aura` wrote its modifier straight into its **owner's** modifier
 * bag carrying `radius` and `relations`, and the damage pipeline read the
 * modifier while ignoring both fields. So the contribution reached the owner
 * and nobody else, at any distance, regardless of relation.
 *
 * Note that reaching the owner is *correct* — "every allied unit" includes
 * itself unless the text says otherwise, which is why `relations` defaults to
 * `["ally", "self"]`. The bug was never self-inclusion; it was that the aura
 * stopped there.
 */

import { describe, it, expect } from "vitest";
import { collectAuras, annotateAuras } from "../../module/rules/auras.mjs";

/** A unit carrying zero or more auras. */
const unit = (id, i, j, { faction = "a", auras = [] } = {}) =>
  ({ id, faction, panel: { i, j }, auras, modifiers: [] });

/** One `Aura` contribution, as the executor emits it. */
const aura = (over = {}) => ({
  key: "atkUp", value: 20, radius: 2, relations: ["ally", "self"],
  stacking: "highestOnly", source: "Charisma", ...over,
});

const boardOf = (units) => ({ units, alliances: {} });

/** The keys a recipient ends up carrying, for terse assertions. */
const keysFor = (u, board) => collectAuras(u, board).map((m) => m.key);

describe("collectAuras", () => {
  it("reaches an ally inside the radius", () => {
    const source = unit("src", 0, 0, { auras: [aura()] });
    const ally = unit("ally", 0, 2);

    expect(keysFor(ally, boardOf([source, ally]))).toEqual(["atkUp"]);
  });

  it("does not reach an ally outside the radius", () => {
    const source = unit("src", 0, 0, { auras: [aura({ radius: 2 })] });
    const far = unit("far", 0, 3);

    expect(keysFor(far, boardOf([source, far]))).toEqual([]);
  });

  it("reaches its own owner, because an ally aura includes itself", () => {
    const source = unit("src", 0, 0, { auras: [aura()] });

    expect(keysFor(source, boardOf([source]))).toEqual(["atkUp"]);
  });

  it("skips the owner when the aura is for other allies only", () => {
    // Penthesilea's Charisma: "+20 flat damage for **other** allies".
    // Kiritsugu's Affection of the Holy Grail: "for everyone **except himself**".
    const source = unit("src", 0, 0, { auras: [aura({ relations: ["ally"] })] });
    const ally = unit("ally", 0, 1);
    const board = boardOf([source, ally]);

    expect(keysFor(source, board)).toEqual([]);
    expect(keysFor(ally, board)).toEqual(["atkUp"]);
  });

  it("does not reach an enemy when the aura is for allies", () => {
    const source = unit("src", 0, 0, { auras: [aura()] });
    const enemy = unit("enemy", 0, 1, { faction: "b" });

    expect(keysFor(enemy, boardOf([source, enemy]))).toEqual([]);
  });

  it("reaches enemies when the aura says so", () => {
    // Decoy and Bašmu's protection are enemy-facing auras.
    const source = unit("src", 0, 0, { auras: [aura({ relations: ["enemy"] })] });
    const enemy = unit("enemy", 0, 1, { faction: "b" });
    const ally = unit("ally", 0, 1);
    const board = boardOf([source, enemy, ally]);

    expect(keysFor(enemy, board)).toEqual(["atkUp"]);
    expect(keysFor(ally, board)).toEqual([]);
  });

  it("measures from the nearest panel of a multi-panel source", () => {
    const big = { ...unit("big", 0, 0, { auras: [aura({ radius: 1 })] }),
      panels: [{ i: 0, j: 0 }, { i: 0, j: 1 }, { i: 0, j: 2 }] };
    const ally = unit("ally", 0, 3);

    expect(keysFor(ally, boardOf([big, ally]))).toEqual(["atkUp"]);
  });

  describe("stacking", () => {
    it("keeps only the strongest of two overlapping highestOnly auras", () => {
      const weak = unit("weak", 0, 0, { auras: [aura({ value: 10, source: "Weak" })] });
      const strong = unit("strong", 0, 1, { auras: [aura({ value: 30, source: "Strong" })] });
      const ally = unit("ally", 0, 2);

      expect(collectAuras(ally, boardOf([weak, strong, ally])))
        .toEqual([expect.objectContaining({ key: "atkUp", value: 30, source: "Strong" })]);
    });

    it("keeps both when the aura stacks", () => {
      const one = unit("one", 0, 0, { auras: [aura({ value: 10, stacking: "stacks" })] });
      const two = unit("two", 0, 1, { auras: [aura({ value: 30, stacking: "stacks" })] });
      const ally = unit("ally", 0, 2);

      expect(collectAuras(ally, boardOf([one, two, ally])).map((m) => m.value)).toEqual([10, 30]);
    });
  });

  it("records where the contribution came from, for the explainer", () => {
    const source = unit("src", 0, 0, { auras: [aura()] });
    const ally = unit("ally", 0, 1);

    expect(collectAuras(ally, boardOf([source, ally]))[0])
      .toMatchObject({ aura: { sourceUnitId: "src", radius: 2 } });
  });

  it("hands the pipeline a plain modifier, with no radius left on it", () => {
    // The original defect was the pipeline reading a modifier that still
    // carried `radius` and `relations` and ignoring them. Nothing downstream
    // should ever see those fields again.
    const source = unit("src", 0, 0, { auras: [aura()] });
    const got = collectAuras(source, boardOf([source]))[0];

    expect(got.radius).toBeUndefined();
    expect(got.relations).toBeUndefined();
  });
});

describe("annotateAuras", () => {
  it("appends each unit's received auras to its own modifiers", () => {
    const source = unit("src", 0, 0, { auras: [aura()] });
    const ally = unit("ally", 0, 1);
    ally.modifiers = [{ key: "defUp", value: 5, source: "own" }];
    const board = boardOf([source, ally]);

    annotateAuras(board.units, board);

    expect(ally.modifiers.map((m) => m.key)).toEqual(["defUp", "atkUp"]);
  });

  it("is not affected by the order units are annotated in", () => {
    // The two-pass structure exists so an aura cannot feed on an aura. Both
    // sources must see the same board, whichever is processed first.
    const a = unit("a", 0, 0, { auras: [aura({ value: 10 })] });
    const b = unit("b", 0, 1, { auras: [aura({ value: 10 })] });
    const board = boardOf([a, b]);

    annotateAuras(board.units, board);

    expect(a.modifiers).toHaveLength(1);
    expect(b.modifiers).toHaveLength(1);
  });
});
