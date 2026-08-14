import { describe, it, expect } from "vitest";
import { resolveTurnOrder, breakTie } from "../../module/engine/turn-order.mjs";

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
