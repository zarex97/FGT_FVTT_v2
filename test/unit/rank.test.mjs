import { describe, it, expect } from "vitest";
import { Rank, STEP_WEIGHT } from "../../module/domain/rank.mjs";

describe("Rank.parse", () => {
  it("parses every form in the grammar", () => {
    expect(Rank.parse("E").toString()).toBe("E");
    expect(Rank.parse("D+").toString()).toBe("D+");
    expect(Rank.parse("C++").toString()).toBe("C++");
    expect(Rank.parse("B-").toString()).toBe("B-");
    expect(Rank.parse("A").toString()).toBe("A");
    expect(Rank.parse("EX").toString()).toBe("EX");
  });

  it("round-trips every reference-sheet rank exactly", () => {
    // Every distinct rank string appearing on the 29 sheets.
    const all = ["E", "E-", "D", "D+", "D++", "C", "C+", "C++", "C-",
      "B", "B+", "B++", "B-", "A", "A+", "A++", "EX"];
    for (const s of all) expect(Rank.parse(s).toString()).toBe(s);
  });

  it("is case-insensitive on the grade", () => {
    expect(Rank.parse("ex")).toBe(Rank.parse("EX"));
    expect(Rank.parse("a+")).toBe(Rank.parse("A+"));
  });

  it("interns, so identity comparison is safe", () => {
    expect(Rank.parse("A")).toBe(Rank.parse("A"));
    expect(Rank.parse("A+")).toBe(Rank.of("A", 1));
  });

  it("rejects malformed input", () => {
    for (const bad of ["A+-", "F", "S", "A3", "", "  ", "EX-+"]) {
      expect(() => Rank.parse(bad), bad).toThrow(RangeError);
    }
  });

  it("treats the unranked marker as null, not as a rank", () => {
    for (const s of ["-", "—", "", null, undefined]) {
      expect(Rank.parseOrNull(s), String(s)).toBeNull();
    }
    expect(Rank.parseOrNull("A+")).toBe(Rank.parse("A+"));
  });
});

describe("Rank ordinal", () => {
  it("is grade-major, step-minor", () => {
    expect(Rank.parse("E").ordinal).toBe(0);
    expect(Rank.parse("B").ordinal).toBe(3 * STEP_WEIGHT);
    expect(Rank.parse("A").ordinal).toBe(4 * STEP_WEIGHT);
    expect(Rank.parse("A+").ordinal).toBe(4 * STEP_WEIGHT + 1);
    expect(Rank.parse("A-").ordinal).toBe(4 * STEP_WEIGHT - 1);
  });

  it("reproduces the Magic Resistance comparison from the damage worked example", () => {
    // Ch. 13 §13.6: "compare(B, A+) = B(300) vs A+(401) → -1, NOT negated"
    expect(Rank.parse("B").ordinal).toBe(300);
    expect(Rank.parse("A+").ordinal).toBe(401);
    expect(Rank.compare(Rank.parse("B"), Rank.parse("A+"))).toBe(-1);
  });

  it("makes Magic Resistance A+ negate up to A+, per the source's + clause", () => {
    const mr = Rank.parse("A+");
    expect(Rank.gte(mr, Rank.parse("A"))).toBe(true);
    expect(Rank.gte(mr, Rank.parse("A+"))).toBe(true);
    expect(Rank.gte(mr, Rank.parse("A++"))).toBe(false);
  });

  it("orders the full ladder without gaps or inversions", () => {
    const ladder = ["E-", "E", "E+", "D-", "D", "D+", "C-", "C", "C+",
      "B-", "B", "B+", "A-", "A", "A+", "EX"];
    const ords = ladder.map((s) => Rank.parse(s).ordinal);
    for (let k = 1; k < ords.length; k++) expect(ords[k]).toBeGreaterThan(ords[k - 1]);
  });
});

describe("Rank.compare with unranked", () => {
  it("returns null rather than ordering null below E", () => {
    expect(Rank.compare(null, Rank.parse("E"))).toBeNull();
    expect(Rank.compare(Rank.parse("EX"), null)).toBeNull();
    expect(Rank.compare(null, null)).toBeNull();
  });

  it("gte takes an explicit answer for the incomparable case", () => {
    expect(Rank.gte(null, Rank.parse("A"))).toBe(false);
    expect(Rank.gte(null, Rank.parse("A"), true)).toBe(true);
  });
});

describe("Rank.equals", () => {
  it("is exact, so Gate of Skye gives EX nothing", () => {
    // gateOfSkyeSaveModifier keys on MAG being *exactly* B or *exactly* A.
    expect(Rank.equals(Rank.parse("A"), Rank.parse("A"))).toBe(true);
    expect(Rank.equals(Rank.parse("EX"), Rank.parse("A"))).toBe(false);
    expect(Rank.equals(Rank.parse("A+"), Rank.parse("A"))).toBe(false);
    expect(Rank.equals(null, null)).toBe(false);
  });
});

describe("Rank.step", () => {
  it("implements the Region bonus examples from the source", () => {
    // "a + to all Parameters (D to D+, B- to B, C+ to C++, etc)"
    expect(Rank.parse("D").step(1).toString()).toBe("D+");
    expect(Rank.parse("B-").step(1).toString()).toBe("B");
    expect(Rank.parse("C+").step(1).toString()).toBe("C++");
  });

  it("crosses grade boundaries — the ladder is dense, not clamped per grade", () => {
    expect(Rank.parse("C++").step(1).toString()).toBe("B--");
    expect(Rank.parse("B--").step(-1).toString()).toBe("C++");
  });

  it("clamps at the ends of the scale", () => {
    expect(Rank.parse("EX").step(10).toString()).toBe("EX++");
    expect(Rank.parse("E").step(-10).toString()).toBe("E--");
  });

  it("is an identity at zero and inverts cleanly", () => {
    const r = Rank.parse("B");
    expect(r.step(0)).toBe(r);
    expect(r.step(2).step(-2)).toBe(r);
  });
});
