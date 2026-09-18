/**
 * @file Every writer of `system.turnOrder` re-derives the turns it just wrote.
 * @see docs/46-roster-re-audit.md §46.4-BB
 *
 * `FGTCombat#_sortCombatants` reads `system.turnOrder` and is correct. It has
 * unit tests, and so do `resolveTurnOrder` and `computeTurnOrder` underneath
 * it. **Nothing re-ran the sort.** Foundry calls `setupTurns` from `_onUpdate`
 * for `round`, `turn` and `combatants` changes only, so an order written into
 * `system` reached the sort no earlier than the next round boundary — which
 * sorts with the order current *before* the re-roll.
 *
 * The consequence is the whole point of Ch. 41 Q32: turn order is re-rolled
 * every Round so a faction cannot be locked into last place, and every Round
 * was played in the order rolled for the Round before it.
 *
 * Measured live on the Semiramis audit board: `system.turnOrder` read
 * `[faction-1, faction-2, GM]` while `combat.turns` read
 * `[Faction 2, Faction 1, GM]`, and Faction 2 was taking the turn. Calling
 * `setupTurns()` by hand on that same combat re-sorted it and moved the acting
 * faction to Faction 1.
 *
 * This reads the source. A test of the sort cannot catch it — the sort answered
 * correctly every time it was asked, and the defect is that nothing asked. The
 * documents layer has no other seam: it is the one layer the suite's world
 * model does not stand in for.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

const SRC = readFileSync("module/documents/combat.mjs", "utf8");

/** The methods that write `system.turnOrder`, and why each one owes a re-sort. */
const WRITERS = [
  ["rollTurnOrder", "the Round's order is rolled fresh and must be the order it is played in"],
  ["delayFaction", "Delay+X moves a faction's position for the turns still to come"],
  ["markTurnTaken", "marking freezes a position, and the order is recomputed from it"],
];

/**
 * One method's body, from its declaration to the closing brace at its own
 * indentation. Crude, and sufficient: the file indents every method by two.
 *
 * @param {string} name
 * @returns {string}
 */
function bodyOf(name) {
  const from = SRC.indexOf(`  async ${name}(`);
  if (from < 0) throw new Error(`${name} not found in module/documents/combat.mjs`);
  const to = SRC.indexOf("\n  }\n", from);
  return SRC.slice(from, to < 0 ? undefined : to);
}

describe("system.turnOrder writers", () => {
  it("re-derive the turns in one place rather than each their own way", () => {
    // Two readers of one rule always drift. The helper is the single place the
    // sort is re-run, and the place the reasoning is written down.
    expect(SRC, "combat.mjs should carry a single #applyTurnOrder helper")
      .toMatch(/#applyTurnOrder\(\)\s*\{[\s\S]*?this\.setupTurns\(\)/);
  });

  for (const [name, why] of WRITERS) {
    it(`${name} applies the order it writes — ${why}`, () => {
      const body = bodyOf(name);
      expect(body, `${name} writes system.turnOrder`).toMatch(/system\.turnOrder/);
      expect(body, `${name} writes system.turnOrder and never re-derives the turns`)
        .toMatch(/this\.#applyTurnOrder\(\)/);
    });
  }

  it("does not rely on fgtTurnOrderChanged to carry the change", () => {
    // The hook beside `delayFaction`'s write was the only signal the order had
    // moved, and it has never had a listener anywhere in the system. It stays
    // as an extension point; it is not the mechanism.
    const listeners = readFileSync("module/documents/combat.mjs", "utf8");
    expect(listeners).toMatch(/Hooks\.callAll\("fgtTurnOrderChanged"/);
    expect(bodyOf("delayFaction"), "the re-sort must not be left to a hook nobody listens to")
      .toMatch(/this\.#applyTurnOrder\(\)[\s\S]*Hooks\.callAll/);
  });
});
