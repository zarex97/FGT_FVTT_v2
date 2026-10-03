/**
 * @file The Overpower flip is on the attack card, Heads or Tails (#174, #65 ruling 21).
 * @see module/rules/explain.mjs#overpowerText, module/engine/attack.mjs, templates/chat/attack.hbs
 *
 * > *"When a Servant successfully Attacks a Master, the player controlling the
 * > Servant flips a coin. If Heads, the Master is instantly defeated."*
 *
 * Live (#174): Xiuhcoatl's splash defeated Quetzalcoatl's own Master on a flip
 * nobody saw -- the card read "400, Injury Roll required" and nothing else.
 * Ruled 2026-10-02: the flip applies to any Servant's Attack on a Master, her
 * own included, and the card must show it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { overpowerText, summarize } from "../../module/rules/explain.mjs";

describe("overpowerText", () => {
  it("Heads: the roll under the chance, and the Master defeated", () => {
    expect(overpowerText({ roll: 23, chance: 50, heads: true, saved: false }))
      .toBe("Overpower: Heads (23 ≤ 50) — Master defeated");
  });

  it("Tails: the roll over the chance", () => {
    expect(overpowerText({ roll: 71, chance: 40, heads: false, saved: false }))
      .toBe("Overpower: Tails (71 > 40)");
  });

  it("a passed Luck Check: no flip, and the Master survives", () => {
    expect(overpowerText({ roll: null, chance: 50, heads: false, saved: true }))
      .toBe("Overpower: Luck Check passed — no flip, survives");
  });

  it("nothing when no flip was made: a Servant on a Servant, or an Invuln Master", () => {
    expect(overpowerText(null)).toBeNull();
    expect(overpowerText(undefined)).toBeNull();
  });
});

describe("the card", () => {
  it("summarize carries the line from the result's flags", () => {
    const flip = { roll: 12, chance: 50, heads: true, saved: false };
    expect(summarize({ total: 400, flags: { overpower: flip } }).overpower)
      .toBe("Overpower: Heads (12 ≤ 50) — Master defeated");
    expect(summarize({ total: 400, flags: {} }).overpower).toBeNull();
  });

  it("the resolution stamps the flip on the result's flags whenever it applies", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8").replaceAll("\r\n", "\n");
    const at = src.slice(src.indexOf("const overpower = resolveOverpower({"));
    const block = at.slice(0, at.indexOf("const underpower"));
    expect(block).toMatch(/if \(overpower\.applies\)/);
    expect(block).toMatch(/overpower: \{\s*roll:/);
    // ...before the flags are written to the message the card renders from.
    expect(src.indexOf("overpower: {\n        roll:")).toBeLessThan(src.indexOf('await message.setFlag("fgt", "result"'));
  });

  it("the template prints the line beside the Injury line", () => {
    expect(readFileSync("templates/chat/attack.hbs", "utf8")).toMatch(/\{\{result\.summary\.overpower\}\}/);
  });
});
