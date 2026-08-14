import { describe, it, expect } from "vitest";
import { parseTick, resolveTicks, ticks, fractionTicks, formatTick } from "../../module/domain/tick.mjs";
import { INFINITE } from "../../module/domain/enums.mjs";

describe("fractionTicks", () => {
  it("reproduces the source's published table exactly", () => {
    // docs/07-time-model.md §7.2
    const table = {
      3: { "1/3": 1, "2/3": 2, "1/2": 2 },
      8: { "1/3": 2, "2/3": 5, "1/2": 4 },
      15: { "1/3": 5, "2/3": 10, "1/2": 7 },
    };
    for (const [tpr, row] of Object.entries(table)) {
      for (const [frac, expected] of Object.entries(row)) {
        const [n, d] = frac.split("/").map(Number);
        expect(fractionTicks(n, d, Number(tpr)), `${frac} at ${tpr}`).toBe(expected);
      }
    }
  });

  it("floors for fractions and turn counts not in the override table", () => {
    expect(fractionTicks(1, 3, 6)).toBe(2);   // floor(2.0)
    expect(fractionTicks(2, 3, 7)).toBe(4);   // floor(4.67) — down, not up
    expect(fractionTicks(1, 4, 10)).toBe(2);  // floor(2.5)
  });

  it("keeps the one deliberate anomaly visible: 1/2 at 3 turns is 2, not floor(1.5)=1", () => {
    expect(Math.floor(0.5 * 3)).toBe(1);
    expect(fractionTicks(1, 2, 3)).toBe(2);
  });
});

describe("parseTick / resolveTicks at 3 turns per round", () => {
  const ctx = { turnsPerRound: 3 };

  it("matches the worked example table", () => {
    // docs/07-time-model.md §7.3
    expect(ticks("1◈", ctx)).toBe(3);
    expect(ticks("⅓◈", ctx)).toBe(1);
    expect(ticks("1◈+⅔◈", ctx)).toBe(5);
    expect(ticks("4◈-⅓◈", ctx)).toBe(11);
    expect(ticks("6◈+⅓◈", ctx)).toBe(19);
    expect(ticks("7◈+⅓◈", ctx)).toBe(22);
    expect(ticks("1◈+½◈", ctx)).toBe(5);
  });

  it("accepts ASCII fractions interchangeably with Unicode", () => {
    expect(ticks("1/3◈", ctx)).toBe(ticks("⅓◈", ctx));
    expect(ticks("1◈+2/3◈", ctx)).toBe(ticks("1◈+⅔◈", ctx));
  });
});

describe("the same content at 8 and 15 turns per round", () => {
  it("resolves correctly without re-authoring — SC-3", () => {
    const ctx8 = { turnsPerRound: 8 };
    expect(ticks("1◈", ctx8)).toBe(8);
    expect(ticks("⅓◈", ctx8)).toBe(2);
    expect(ticks("1◈+⅔◈", ctx8)).toBe(13);
    expect(ticks("4◈-⅓◈", ctx8)).toBe(30);
    expect(ticks("7◈+⅓◈", ctx8)).toBe(58);

    const ctx15 = { turnsPerRound: 15 };
    expect(ticks("1◈", ctx15)).toBe(15);
    expect(ticks("⅓◈", ctx15)).toBe(5);
    expect(ticks("½◈", ctx15)).toBe(7);
  });
});

describe("non-◈ duration forms", () => {
  const ctx = { turnsPerRound: 3 };

  it("parses literal turn counts — Castor reduces cooldown by 2 Turns, not 2◈", () => {
    expect(ticks("2 turns", ctx)).toBe(2);
    expect(ticks("1 turn", ctx)).toBe(1);
    expect(ticks(2, ctx)).toBe(2);
  });

  it("parses this turn as zero remaining", () => {
    expect(ticks("this turn", ctx)).toBe(0);
  });

  it("treats permanent, until-event and use-counts as not counting down", () => {
    expect(ticks("permanent", ctx)).toBe(INFINITE);
    expect(ticks("until zeroSailEnds", ctx)).toBe(INFINITE);
    expect(ticks("3 times", ctx)).toBe(INFINITE);
    expect(parseTick("3 times")).toEqual({ kind: "uses", n: 3 });
    expect(parseTick("until zeroSailEnds")).toEqual({ kind: "untilEvent", event: "zerosailends" });
  });

  it("returns null for empty input rather than guessing", () => {
    expect(parseTick(null)).toBeNull();
    expect(parseTick("")).toBeNull();
    expect(resolveTicks(null, ctx)).toBe(0);
  });

  it("throws on anything else, so the content build fails loudly", () => {
    for (const bad of ["soon", "3 rounds", "1◈+", "◈◈", "1/0◈"]) {
      expect(() => parseTick(bad), bad).toThrow(RangeError);
    }
  });
});

describe("formatTick", () => {
  it("round-trips every ◈ form", () => {
    for (const s of ["1◈", "3◈", "1/3◈", "2/3◈", "1◈+2/3◈", "4◈-1/3◈"]) {
      expect(formatTick(parseTick(s))).toBe(s);
    }
  });

  it("round-trips the non-◈ forms", () => {
    expect(formatTick(parseTick("this turn"))).toBe("this turn");
    expect(formatTick(parseTick("permanent"))).toBe("permanent");
    expect(formatTick(parseTick("2 turns"))).toBe("2 turns");
    expect(formatTick(parseTick("1 turn"))).toBe("1 turn");
  });
});

describe("negative fractional adjustments never go below zero", () => {
  it("clamps rather than producing a negative cooldown", () => {
    // Pathological content: a fraction larger than the whole part.
    expect(ticks("0◈-2/3◈", { turnsPerRound: 3 })).toBe(0);
  });
});
