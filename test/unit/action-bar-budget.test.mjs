/**
 * @file A refused action is refused where the player can see it.
 * @see docs/46-roster-re-audit.md §46.4-AW, module/engine/budget.mjs
 *
 * `budget.affordable`'s own docstring has said since it was written:
 *
 * > *"Every UI affordance calls this: the attack button is disabled with the
 * > refusal as its tooltip rather than failing after the click, which is the
 * > difference between a rule the player can plan around and one that ambushes
 * > them."*
 *
 * No UI affordance called it. So a Unit that had already attacked was offered
 * Attack, opened a targeting session that reported `✓ Legal` on a real target,
 * confirmed it, and got nothing at all — `engine/attack.mjs` threw, the
 * rejection was logged, and the only trace was a `console.error` the player
 * does not have open.
 *
 * Found auditing Semiramis' `HGB.c6`: Gather spends a Unit's Attack without
 * looking like an attack, so pressing Attack afterwards is the most natural
 * thing in the world, and the refusal it earns is correct and invisible.
 *
 * The rule under test is `canConsume`, which was never wrong. What is asserted
 * here is that the two places a player meets it — the bar and the throw — both
 * carry **its own sentence**, so the gate and the display cannot drift.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import { canConsume, poolFor } from "../../module/rules/budget.mjs";

/** A Servant who has already attacked this Turn, as Gather leaves her. */
const afterGather = {
  id: "semiramis",
  kind: "servant",
  factionId: "faction-1",
  turnState: { tick: 6, moved: true, attacked: true },
};

/** A budget with room in every pool, so only the per-unit rule can refuse. */
const roomyBudget = {
  pools: {
    servantAttack: { used: 0, max: 8 },
    servantMove: { used: 0, max: 8 },
    masterAttack: { used: 0, max: 8 },
    masterMove: { used: 0, max: 8 },
  },
  countedUnits: [],
  attackedUnits: [],
};

describe("the rule Gather leans on", () => {
  it("refuses a second attack, with a sentence a human can read", () => {
    const verdict = canConsume(roomyBudget, afterGather, "attack");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("this unit has already attacked this turn");
  });

  it("bills Gather to the move pool, which is how it costs the Move", () => {
    expect(poolFor(afterGather, "gather")).toBe("servantMove");
    expect(poolFor(afterGather, "attack")).toBe("servantAttack");
  });

  it("still allows a Unit that has not attacked", () => {
    const fresh = { ...afterGather, turnState: { tick: 6, moved: false, attacked: false } };
    expect(canConsume(roomyBudget, fresh, "attack").ok).toBe(true);
  });
});

describe("where that refusal surfaces", () => {
  it("the action bar asks the budget before offering an action", () => {
    const src = readFileSync("module/apps/hud/action-bar.mjs", "utf8");
    expect(src, "the bar must consult budget.affordable").toMatch(/budget\.affordable\s*\(/);
    // Disabled by it, and captioned with the budget's own reason rather than a
    // second spelling of the same rule.
    expect(src).toMatch(/!budgeted\.ok/);
    expect(src).toMatch(/budgeted\.reason/);
  });

  it("the attack entry point tells somebody before it throws", () => {
    // The refusal is made in `attack-preflight.mjs` (so a Riding Attack can ask it
    // before it moves) and carries the budget's own words as `budgetReason`;
    // `resolveAttack` is what tells the player, and throws.
    const preflight = readFileSync("module/engine/attack-preflight.mjs", "utf8");
    expect(preflight, "the refusal site moved").toMatch(/Cannot attack:/);
    expect(preflight).toMatch(/budgetReason: verdict\.reason/);

    const src = readFileSync("module/engine/attack.mjs", "utf8");
    const at = src.indexOf("throw new Error(`FGT | ${pre.message}`)");
    expect(at, "the throw site moved").toBeGreaterThan(0);
    // The notification comes FIRST: a throw alone reaches a log and no human.
    const before = src.slice(Math.max(0, at - 900), at);
    expect(before, "a refused attack must reach the player, not only the console")
      .toMatch(/ui\.notifications\?\.warn/);
    expect(before).toMatch(/pre\.budgetReason/);
  });
});

describe("a greyed slot does not run (#192)", () => {
  const bar = readFileSync(new URL("../../module/apps/hud/action-bar.mjs", import.meta.url), "utf8");
  const handler = bar.slice(bar.indexOf("static async onUseSlot("), bar.indexOf("async declareCounterWith("));

  it("refuses a disabled slot before any handler, with the slot's own sentence", () => {
    const guard = handler.indexOf('classList.contains("fgt-slot--disabled")');
    expect(guard).toBeGreaterThan(-1);
    expect(handler.slice(guard, guard + 300)).toMatch(/ui\.notifications\.warn\(target\.dataset\.tooltip/);
    // Ahead of the Counter branch and every engine call.
    for (const call of ["declareCounterWith(", "performAction(", "declareAttack(", "useSkill(", "toggleMode("]) {
      expect(guard).toBeLessThan(handler.indexOf(call));
    }
  });
});
