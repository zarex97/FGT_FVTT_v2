/**
 * @file A RankShift's steps and an element's value, sized by a Count (#284, #319).
 * @see module/rules/elements.mjs (`RankShift`, `stackScaled`), module/rules/count.mjs
 *
 * Richard I's Godspeed: *"For every Godspeed Token Richard has, his Max & current
 * Agility are increased by 1. For every 3 Godspeed Tokens Richard has, his MOV
 * is increased by 1."* and *"For each Godspeed Token Richard has, his AGI Rank is
 * increased as such: B (0 Godspeed Tokens) > B+ > B++ > A > A+ > A++ > EX"*. No
 * Servant carries Godspeed Tokens yet, so a resource every Servant may hold
 * (Aria) stands in for them: the Count reads any resource by its key.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadSource } from "../../tools/lib/load.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const TOKENS = { of: "resource", key: "aria" };
const GODSPEED = {
  id: "test-godspeed", slug: "testGodspeed", name: "Test Godspeed", kind: "skill", isPassive: true,
  rules: [
    { key: "RankShift", parameter: "agi", to: { ladder: ["B", "B+", "B++", "A", "A+", "A++", "EX"], count: TOKENS } },
    { key: "RankShift", parameter: "luc", steps: { count: TOKENS, max: 2 } },
    { key: "MovDelta", value: 1, count: TOKENS, each: 3 },
    { key: "MaxDelta", stat: "agility", value: 1, count: TOKENS },
  ],
};

/** The Unit as the board projects it, holding `n` tokens. */
async function holding(n) {
  const { files } = await loadSource("packs/_source");
  const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
  return withSubjects([{
    from: "test-jeanne-d-arc", id: "godspeedHolder01",
    with: { resources: { aria: { value: n, max: 9 } }, abilities: [...(jeanne.abilities ?? []), GODSPEED] },
  }], ({ units }) => units[0]);
}

const agi = (unit) => String(unit.parameters.agi);

describe("a Count walks a RankShift up its ladder (#284)", () => {
  it("one rung per token, as the sheet's own ladder runs: B, B+, B++, A, A+, A++, EX", async () => {
    expect(agi(await holding(0))).toBe("B");
    expect(agi(await holding(3))).toBe("A");
    expect(agi(await holding(6))).toBe("EX");
  });

  it("no further than its last rung: EX at 9 tokens as at 6", async () => {
    expect(agi(await holding(9))).toBe("EX");
  });

  it("sizes dense steps too, capped by max", async () => {
    // Test Jeanne's LUC is B: one step is B+, two B++, and the cap holds at two.
    expect(String((await holding(1)).parameters.luc)).toBe("B+");
    expect(String((await holding(5)).parameters.luc)).toBe("B++");
  });
});

describe("a Count sizes an element's value", () => {
  it("MOV rises one per 3 tokens, and Max Agility one per token", async () => {
    const none = await holding(0);
    const seven = await holding(7);
    expect(seven.mov - none.mov).toBe(2);
    expect(seven.maxAgility - none.maxAgility).toBe(7);
  });
});
