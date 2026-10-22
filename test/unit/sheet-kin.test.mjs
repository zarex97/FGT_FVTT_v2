import { describe, expect, it } from "vitest";

import { groupKin, normalize, wordPairs } from "../../tools/lib/kin.mjs";

const clause = (sheet, claim) => {
  const norm = normalize(claim, sheet);
  return { cls: "Saber", sheet, built: false, ability: "A", abilityKind: "skill", marker: null, claim, norm, pairs: wordPairs(norm) };
};

describe("Sheet Kin", () => {
  it("masks numbers, Ranks, ◈ fractions and the bearer's first name", () => {
    expect(normalize("Gawain's damage is reduced by 40% for 1◈ Turns. Rank: B+", "Gawain"))
      .toBe("self's damage is reduced by #% for #◈ turns. rank");
  });

  it("groups one phrasing with different numbers, and keeps an unlike rule apart", () => {
    const groups = groupKin([
      clause("Arturia", "Chance of being inflicted by debuffs is reduced by 20%."),
      clause("Gawain", "Chance of being inflicted by debuffs is reduced by 25%."),
      clause("Mordred", "Can Move twice during its Turn, once before and once after Attacking."),
    ]);
    expect(groups.map((g) => g.members.map((m) => m.sheet))).toEqual([["Arturia", "Gawain"], ["Mordred"]]);
    expect(groups[0].exact).toBe(2);
  });

  it("counts a similar phrasing as Kin but not as exact", () => {
    const [g] = groupKin([
      clause("Arturia", "Applies Atk Up for 1◈ Turns, all damage dealt is increased by 30%; if NP, 15%."),
      clause("Nero", "Applies Atk Up for 1◈ Turns to all allied Units, all damage dealt is increased by 30%; if NP, 15%."),
    ]);
    expect(g.members).toHaveLength(2);
    expect(g.exact).toBe(1);
  });
});
