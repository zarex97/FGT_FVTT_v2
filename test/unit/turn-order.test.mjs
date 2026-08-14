import { describe, it, expect } from "vitest";
import {
  resolveTurnOrder, breakTie, computeTurnOrder, factionOfCombatant,
} from "../../module/engine/turn-order.mjs";

describe("factionOfCombatant", () => {
  it("is the combatant's faction", () => {
    expect(factionOfCombatant({ id: "c1", system: { factionId: "red" } })).toBe("red");
  });

  it("is null for a match with no combatant at all", () => {
    // The case behind "No Faction" in the HUD, the skipped turn-state reset and
    // the budget filed under `null`: an empty combat has no `combatant`, and
    // `undefined` is not the same answer as "nobody".
    expect(factionOfCombatant(undefined)).toBe(null);
    expect(factionOfCombatant(null)).toBe(null);
  });

  it("is null for the GM's slot, which owns no units", () => {
    expect(factionOfCombatant({ id: "gm", system: { isGM: true, factionId: null } })).toBe(null);
  });

  it("ignores a factionId on the GM's slot rather than acting on it", () => {
    expect(factionOfCombatant({ id: "gm", system: { isGM: true, factionId: "red" } })).toBe(null);
  });

  it("falls back to the combatant id when no faction is set", () => {
    // A token-shaped combatant made by Foundry's own "toggle combat state".
    // It still gets a turn; it just is not a faction.
    expect(factionOfCombatant({ id: "c1", system: {} })).toBe("c1");
  });
});

describe("resolveTurnOrder", () => {
  it("orders factions by roll, highest first", () => {
    const { order } = resolveTurnOrder([
      { id: "a", roll: 40 }, { id: "b", roll: 91 }, { id: "c", roll: 12 },
    ]);
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("puts the GM last regardless of roll", () => {
    const { order } = resolveTurnOrder(
      [{ id: "a", roll: 10 }, { id: "gm", roll: 99 }, { id: "b", roll: 50 }],
      { gmId: "gm" },
    );
    expect(order).toEqual(["b", "a", "gm"]);
  });

  it("reports ties instead of silently picking a winner", () => {
    const { contested } = resolveTurnOrder([
      { id: "a", roll: 50 }, { id: "b", roll: 50 }, { id: "c", roll: 20 },
    ]);
    expect(contested).toEqual([["a", "b"]]);
  });

  it("reports several independent ties separately", () => {
    const { contested } = resolveTurnOrder([
      { id: "a", roll: 50 }, { id: "b", roll: 50 },
      { id: "c", roll: 20 }, { id: "d", roll: 20 },
    ]);
    expect(contested.length).toBe(2);
  });

  it("has nothing contested when every roll differs", () => {
    expect(resolveTurnOrder([{ id: "a", roll: 1 }, { id: "b", roll: 2 }]).contested).toEqual([]);
  });
});

describe("breakTie", () => {
  it("re-rolls only the contested positions, leaving everyone else in place", () => {
    // b and c tied for slots 1 and 2; a and d keep slots 0 and 3.
    const order = ["a", "b", "c", "d"];
    const { order: next } = breakTie(order, [{ id: "b", roll: 10 }, { id: "c", roll: 90 }]);
    expect(next[0]).toBe("a");
    expect(next[3]).toBe("d");
    expect(next.slice(1, 3)).toEqual(["c", "b"]);
  });

  it("reports a tie that survived the re-roll", () => {
    const { stillContested } = breakTie(["a", "b", "c"], [{ id: "b", roll: 7 }, { id: "c", roll: 7 }]);
    expect(stillContested).toEqual([["b", "c"]]);
  });

  it("keeps every faction present", () => {
    const order = ["a", "b", "c", "d"];
    const { order: next } = breakTie(order, [{ id: "b", roll: 1 }, { id: "d", roll: 2 }]);
    expect([...next].sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("computeTurnOrder — Delay (§25.3)", () => {
  const base = ["a", "b", "c", "d"];

  it("is the rolled order when nobody has delayed", () => {
    expect(computeTurnOrder(base)).toEqual(base);
  });

  it("moves a faction X places later", () => {
    expect(computeTurnOrder(base, { a: 2 })).toEqual(["b", "c", "a", "d"]);
  });

  it("never moves it past the end", () => {
    expect(computeTurnOrder(base, { a: 99 })).toEqual(["b", "c", "d", "a"]);
  });

  it("keeps the GM last however far a faction delays", () => {
    expect(computeTurnOrder([...base, "gm"], { a: 99 }, [], "gm"))
      .toEqual(["b", "c", "d", "a", "gm"]);
  });

  it("delays only among the factions that have not acted yet", () => {
    // a and b have taken their turns. c delaying by 1 goes behind d, not behind
    // the whole round -- it cannot be pushed past a boundary that has passed.
    expect(computeTurnOrder(base, { c: 1 }, ["a", "b"])).toEqual(["a", "b", "d", "c"]);
  });

  it("ignores a Delay declared by a faction that has already acted", () => {
    expect(computeTurnOrder(base, { a: 2 }, ["a"])).toEqual(base);
  });

  it("applies delays in declaration order, not in turn order", () => {
    // b declares first and goes behind c; a then declares and goes behind c
    // too, landing in front of b. Applying these in turn order instead would
    // put a behind b and leave c untouched, which is a different round.
    expect(computeTurnOrder(base, { b: 1, a: 1 })).toEqual(["c", "a", "b", "d"]);
  });

  it("leaves two factions who each delay past each other where they began", () => {
    // a goes behind b, then b goes behind a. Both moved; the order is the same.
    expect(computeTurnOrder(base, { a: 1, b: 1 })).toEqual(["a", "b", "c", "d"]);
  });

  it("treats a zero or negative delay as no delay", () => {
    expect(computeTurnOrder(base, { a: 0, b: -3 })).toEqual(base);
  });

  it("keeps every faction exactly once, whatever the delays", () => {
    const out = computeTurnOrder([...base, "gm"], { a: 3, c: 1, d: 2 }, ["b"], "gm");
    expect([...out].sort()).toEqual(["a", "b", "c", "d", "gm"]);
    expect(out.at(-1)).toBe("gm");
  });

  it("never moves a faction that has already acted", () => {
    const out = computeTurnOrder(base, { c: 2, d: 1 }, ["a", "b"]);
    expect(out.slice(0, 2)).toEqual(["a", "b"]);
  });
});
