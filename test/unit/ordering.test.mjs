/**
 * @file Element priority bands, and Delay's mutation of the turn order.
 * @see docs/24-rules-engine.md §24.6, docs/07-time-model.md §7.8
 */

import { describe, it, expect } from "vitest";
import { PRIORITY_BANDS, bandOf, orderElements } from "../../module/rules/ordering.mjs";
import { computeTurnOrder, carryDelaysForward } from "../../module/engine/turn-order.mjs";

/* ── §24.6 element ordering ───────────────────────────────────────────────── */

describe("priority bands", () => {
  it("puts base changes before additive ones", () => {
    expect(bandOf({ key: "RankShift" })).toBeLessThan(bandOf({ key: "DamageModifier" }));
  });

  it("gathers auras before anything consumes them", () => {
    // Band 30 collects, band 35 reads. Clarity doubles the Area CritUp it
    // receives, so it must not run before the aura it doubles exists.
    expect(bandOf({ key: "Aura" })).toBeLessThan(35);
    expect(bandOf({ key: "Aura", consumesAuras: true })).toBeGreaterThan(bandOf({ key: "Aura" }));
  });

  it("runs suppression last, so it sees everything", () => {
    expect(bandOf({ key: "Suppress" })).toBe(Math.max(...Object.values(PRIORITY_BANDS)));
  });

  it("puts immunity after the numbers it cancels", () => {
    expect(bandOf({ key: "Immunity" })).toBeGreaterThan(bandOf({ key: "DamageModifier" }));
  });

  it("gives an unknown key the additive band rather than dropping it", () => {
    // A new element must not silently sort to the front or the back.
    expect(bandOf({ key: "SomethingNew" })).toBe(PRIORITY_BANDS.additive);
  });

  it("honours an explicit priority when content sets one", () => {
    expect(bandOf({ key: "DamageModifier", priority: 95 })).toBe(95);
  });
});

describe("orderElements", () => {
  it("sorts by band", () => {
    const out = orderElements([
      { key: "Suppress", source: "a" },
      { key: "RankShift", source: "b" },
      { key: "DamageModifier", source: "c" },
    ]);

    expect(out.map((e) => e.key)).toEqual(["RankShift", "DamageModifier", "Suppress"]);
  });

  it("breaks ties by source id, so every client agrees", () => {
    // Determinism across clients is the whole point: two elements in one band
    // must not depend on the order documents happened to load in.
    const out = orderElements([
      { key: "DamageModifier", sourceId: "zzz" },
      { key: "DamageModifier", sourceId: "aaa" },
    ]);

    expect(out.map((e) => e.sourceId)).toEqual(["aaa", "zzz"]);
  });

  it("does not mutate what it was given", () => {
    const input = [{ key: "Suppress" }, { key: "RankShift" }];
    orderElements(input);

    expect(input[0].key).toBe("Suppress");
  });
});

/* ── §7.8 Delay ───────────────────────────────────────────────────────────── */

describe("Delay carried into the next round", () => {
  it("keeps a delay declared against a faction that has already acted", () => {
    // "If they have already taken it, the shift applies NEXT round."
    // `computeTurnOrder` correctly refuses to move an acted faction, and
    // `system.delays` is cleared at round start -- so without this the delay
    // was not deferred, it was DISCARDED.
    expect(carryDelaysForward({ b: 2 }, ["a", "b"])).toEqual({ b: 2 });
  });

  it("drops a delay that already took effect this round", () => {
    // The faction had not acted, so `computeTurnOrder` moved it; the delay is
    // spent and must not apply again next round.
    expect(carryDelaysForward({ c: 2 }, ["a", "b"])).toEqual({});
  });

  it("carries several, and only the unspent ones", () => {
    expect(carryDelaysForward({ b: 1, c: 2 }, ["a", "b"])).toEqual({ b: 1 });
  });

  it("is empty when nobody was delayed", () => {
    expect(carryDelaysForward({}, ["a"])).toEqual({});
  });
});

describe("computeTurnOrder with delays", () => {
  const order = ["a", "b", "c", "d", "e", "f", "g"];

  it("moves a player down the order by the delay", () => {
    // The §7.8 worked example: Delay+2 on C gives A-B-D-E-C-F-G.
    expect(computeTurnOrder(order, { c: 2 }, ["a"], null))
      .toEqual(["a", "b", "d", "e", "c", "f", "g"]);
  });

  it("does not move a faction that has already acted", () => {
    expect(computeTurnOrder(order, { b: 3 }, ["a", "b"], null)).toEqual(order);
  });

  it("never moves anyone past the GM", () => {
    const out = computeTurnOrder([...order], { f: 10 }, [], "gm");

    expect(out.at(-1)).toBe("gm");
  });

  it("keeps every faction exactly once", () => {
    const out = computeTurnOrder(order, { b: 1, c: 1 }, [], null);

    expect(out).toHaveLength(order.length);
    expect(new Set(out).size).toBe(order.length);
  });
});
