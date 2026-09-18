/**
 * @file The budget has one vocabulary, and every caller speaks it.
 * @see docs/46-roster-re-audit.md §46.4-AY
 *
 * An ability's **kind** (`normal`, `attackSkill`, `damageSpell`, …) and the
 * **action** a budget understands (`attack`, `spell`, …) are two different
 * vocabularies. `budgetActionFor` is the only bridge, and for as long as it
 * existed there were two copies of the question and one caller that never asked
 * it: `engine/skill-use.mjs` passed the kind `"normal"` straight through.
 *
 * `poolFor` does not know `"normal"`, so it answered `null` — *"draws from no
 * pool"* — and `canConsume` turns a null pool into `{ok: true, free: true}`.
 * Every attack-shaped ability reaching `useSkill` was therefore checked against
 * nothing and charged nothing, on a full pool as readily as an empty one.
 *
 * It failed **open**, which is why it survived: the symptom is a Servant who
 * can act slightly more than they should, and nobody counts.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import { ACTION_KINDS, budgetActionFor, poolFor, canConsume } from "../../module/rules/budget.mjs";

const servant = { id: "s", kind: "servant", factionId: "f1", turnState: { tick: 1, moved: false, attacked: false } };
/** Every Servant attack slot already spent. */
const exhausted = {
  pools: { servantAttack: { used: 4, max: 4 }, servantMove: { used: 8, max: 8 } },
  countedUnits: [],
  attackedUnits: [],
};

describe("budgetActionFor", () => {
  it("translates every ability kind into an action the budget knows", () => {
    for (const kind of ["normal", "np", "damageSpell", "attackSkill", "skill"]) {
      expect(ACTION_KINDS, `kind "${kind}" translated outside the vocabulary`)
        .toContain(budgetActionFor(kind));
    }
  });

  it("sends an attack-shaped kind to the attack pool", () => {
    expect(budgetActionFor("normal")).toBe("attack");
    expect(budgetActionFor("attackSkill")).toBe("attack");
    expect(budgetActionFor("np")).toBe("np");
    expect(budgetActionFor("damageSpell")).toBe("spell");
  });

  it("keeps a non-attack Skill on the move pool — D18.2 is not repealed", () => {
    expect(budgetActionFor("skill")).toBe("skill");
    expect(poolFor(servant, budgetActionFor("skill"))).toBe("servantMove");
  });

  it("falls back to attack, not to nothing, for a kind it has never seen", () => {
    // The conservative direction: an unrecognised attack-shaped ability should
    // cost a Servant its attack rather than being free.
    expect(budgetActionFor("somethingNobodyHasWrittenYet")).toBe("attack");
    expect(poolFor(servant, budgetActionFor("somethingNobodyHasWrittenYet"))).toBe("servantAttack");
  });
});

describe("the raw kind is not an action", () => {
  it("poolFor does not recognise \"normal\" — which is the whole defect", () => {
    expect(ACTION_KINDS).not.toContain("normal");
    expect(poolFor(servant, "normal")).toBeNull();
  });

  it("an unknown action is free against a pool with nothing left", () => {
    // Left as documentation of the failure mode rather than as desired
    // behaviour: a null pool legitimately means "costs nothing" for a platform
    // or a reaction, so the fix is that callers stop inventing action names,
    // not that `poolFor` starts guessing.
    expect(canConsume(exhausted, servant, "normal")).toMatchObject({ ok: true, free: true });
  });

  it("the translated action is the one that actually consults a pool", () => {
    expect(poolFor(servant, budgetActionFor("normal"))).toBe("servantAttack");
  });
});

describe("both engine callers speak the vocabulary", () => {
  for (const file of ["module/engine/attack.mjs", "module/engine/skill-use.mjs"]) {
    it(`${file} translates before it bills`, () => {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must use the shared translator`).toMatch(/budgetActionFor\s*\(/);
      // No raw kind reaching a budget call. `"normal"` beside `affordable` or
      // `spend` is the exact shape this file exists to prevent coming back.
      const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      for (const m of code.matchAll(/budget\.(affordable|spend)\s*\(([\s\S]{0,220}?)\)/g)) {
        expect(m[2], `${file}: budget.${m[1]} given a raw ability kind`).not.toMatch(/["']normal["']/);
      }
    });
  }

  it("there is only one copy of the translation", () => {
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    const code = attack.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    expect(code, "attack.mjs should import budgetActionFor, not define its own")
      .not.toMatch(/function budgetActionFor/);
  });
});
