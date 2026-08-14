import { describe, it, expect } from "vitest";
import { lookup, lookupNumber } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";

const R = (s) => Rank.parse(s);

describe("baseHealthByEnd", () => {
  it("reproduces every END rank on the 29 reference sheets", () => {
    // docs/B-rank-tables.md §B.1 — no variance roll, so these are exact.
    const sheets = [
      ["A", 1500], ["B", 1250], ["C", 1000], ["D", 750], ["E", 500], ["EX", 2000],
      ["A++", 1700], ["B+", 1350], ["A+", 1600],
    ];
    for (const [rank, hp] of sheets) {
      expect(lookupNumber("baseHealthByEnd", R(rank)), rank).toBe(hp);
    }
  });
});

describe("divinity", () => {
  it("reproduces every Divinity on both rosters, including the sub-E rank", () => {
    // Van Gogh B+ 45, Karna/Nemo/Heracles A 50, Ozymandias/Proto Gil B 40,
    // Achilles/Raikou/Semiramis C 30, Medusa E- 5.
    expect(lookupNumber("divinity", R("B+"))).toBe(45);
    expect(lookupNumber("divinity", R("A"))).toBe(50);
    expect(lookupNumber("divinity", R("B"))).toBe(40);
    expect(lookupNumber("divinity", R("C"))).toBe(30);
    expect(lookupNumber("divinity", R("E-"))).toBe(5);
  });
});

describe("divineCore", () => {
  it("is exactly twice Divinity at every observed rank", () => {
    for (const g of ["EX", "A", "B", "C", "D", "E"]) {
      expect(lookupNumber("divineCore", R(g)), g).toBe(2 * lookupNumber("divinity", R(g)));
    }
    // Quetzalcoatl EX 120, Kingprotea A 100, Dioscuri B 80.
    expect(lookupNumber("divineCore", R("EX"))).toBe(120);
    expect(lookupNumber("divineCore", R("A"))).toBe(100);
    expect(lookupNumber("divineCore", R("B"))).toBe(80);
  });
});

describe("madEnhancement", () => {
  it("reproduces all six sheets across two independently-authored rosters", () => {
    // docs/B-rank-tables.md §B.3 verification block.
    const cases = [
      // rank, [taken, takenNP], dealt, drain
      ["A+", [55, 30], 85, 25],   // Kingprotea
      ["B-", [35, 15], 55, 20],   // Castor
      ["EX", [75, 30], 100, 30],  // Penthesilea, Raikou
      ["B", [40, 20], 60, 20],    // Heracles, Asterios
    ];
    for (const [rank, defence, offence, drain] of cases) {
      expect(lookup("madEnhancementDefence", R(rank)), `${rank} defence`).toEqual(defence);
      expect(lookupNumber("madEnhancementOffence", R(rank)), `${rank} offence`).toBe(offence);
      expect(lookupNumber("madEnhancementDrain", R(rank)), `${rank} drain`).toBe(drain);
    }
  });

  it("keeps the Master drain banded, so a + does not change it", () => {
    expect(lookupNumber("madEnhancementDrain", R("A+"))).toBe(25);
    expect(lookupNumber("madEnhancementDrain", R("A"))).toBe(25);
  });
});

describe("presenceConcealmentDiscover", () => {
  it("reproduces all eight bearers across both rosters", () => {
    expect(lookupNumber("presenceConcealmentDiscover", R("A+"))).toBe(5);  // Kiritsugu, Serenity, Jack, H-F Hassan
    expect(lookupNumber("presenceConcealmentDiscover", R("A"))).toBe(10);  // Danzo, Yan Qing (Espionage)
    expect(lookupNumber("presenceConcealmentDiscover", R("B+"))).toBe(15); // Yan Qing fallback
    expect(lookupNumber("presenceConcealmentDiscover", R("C+"))).toBe(35); // Semiramis, Dongyu grant
    expect(lookupNumber("presenceConcealmentDiscover", R("C"))).toBe(40);  // Yan Qing
  });
});

describe("itemConstruction", () => {
  it("reproduces Van Gogh's B- and Medea's A", () => {
    expect(lookup("itemConstruction", R("B-"))).toEqual([35, 15, 5, -5]);
    expect(lookup("itemConstruction", R("A"))).toEqual([50, 25, 10, 0]);
  });
});

describe("independentAction", () => {
  it("gives A+/EX no Sustainability clock at all — null, not a large number", () => {
    expect(lookup("independentActionSustainability", R("A+"))).toBeNull();
    expect(lookup("independentActionSustainability", R("EX"))).toBeNull();
  });

  it("reproduces the ranked Sustainability values", () => {
    expect(lookup("independentActionSustainability", R("A"))).toBe(8); // Kiritsugu, Serenity
    expect(lookup("independentActionSustainability", R("B"))).toBe(7); // Kingprotea, EMIYA
    expect(lookup("independentActionSustainability", R("C"))).toBe(6); // Medusa
  });

  it("makes A+/EX contract immunity absolute, not a roll count", () => {
    expect(lookup("independentActionContract", R("A+"))).toBe("immune");
    expect(lookup("independentActionContract", R("EX"))).toBe("immune");
    expect(lookup("independentActionContract", R("A"))).toBe(4);
    expect(lookup("independentActionContract", R("C"))).toBe(2);
  });

  it("prefers an exact-rank band over the bare-grade band", () => {
    // "A+" must not fall through to the "A" band.
    expect(lookup("independentActionContract", R("A+"))).not.toBe(4);
  });
});

describe("andreiasAmarantosByAttackerDivinity", () => {
  it("defaults to total immunity when the attacker has no Divinity", () => {
    expect(lookup("andreiasAmarantosByAttackerDivinity", null)).toBe(0);
  });

  it("tiers by the attacker's Divinity rank", () => {
    expect(lookup("andreiasAmarantosByAttackerDivinity", R("E"))).toBe(50);
    expect(lookup("andreiasAmarantosByAttackerDivinity", R("D"))).toBe(75);
    expect(lookup("andreiasAmarantosByAttackerDivinity", R("C"))).toBe(100);
    expect(lookup("andreiasAmarantosByAttackerDivinity", R("EX"))).toBe(100);
  });
});

describe("gateOfSkyeSaveModifier", () => {
  it("is equality, not threshold — EX gets nothing", () => {
    expect(lookup("gateOfSkyeSaveModifier", R("B"))).toBe(-2);
    expect(lookup("gateOfSkyeSaveModifier", R("A"))).toBe(-4);
    expect(lookup("gateOfSkyeSaveModifier", R("EX"))).toBe(0);
    expect(lookup("gateOfSkyeSaveModifier", R("A+"))).toBe(0);
  });
});

describe("knockbackCollisionByEnd", () => {
  it("falls back for a unit with no END rank", () => {
    expect(lookup("knockbackCollisionByEnd", null)).toBe("5d10");
    expect(lookup("knockbackCollisionByEnd", R("A"))).toBe("1d20");
  });
});

describe("dice-formula tables with a per-step delta", () => {
  it("returns the formula plus a separate additive bonus, not a mangled formula", () => {
    expect(lookup("territoryCreationOffence", R("A"))).toBe("5d20");
    expect(lookup("territoryCreationOffence", R("A+"))).toEqual({ formula: "5d20", bonus: 5 });
  });
});

describe("lookup error handling", () => {
  it("throws on an unknown table id rather than returning undefined", () => {
    expect(() => lookup("noSuchTable", R("A"))).toThrow(RangeError);
  });

  it("lookupNumber refuses to silently coerce a non-number", () => {
    expect(() => lookupNumber("independentActionContract", R("A+"))).toThrow(TypeError);
  });
});
