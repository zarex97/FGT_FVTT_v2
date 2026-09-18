/**
 * @file The rolled order reaches the order that is played, on every client.
 * @see docs/46-roster-re-audit.md §46.4-BB
 *
 * `FGTCombat#_sortCombatants` reads `system.turnOrder` and is correct. It has
 * unit tests, and so do `resolveTurnOrder` and `computeTurnOrder` underneath
 * it. **Nothing re-ran the sort.** Foundry derives `combat.turns` in
 * `setupTurns`, which `_onUpdate` calls for `round`, `turn` and `combatants`
 * changes only, so an order written into `system` reached the sort no earlier
 * than the next round boundary — which sorts with the order current *before*
 * the re-roll.
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
 * ## Why the re-sort lives in `_onUpdate`, and only at `turn === 0`
 *
 * The first shape of this fix called `setupTurns` from each of the three
 * methods that write `system.turnOrder`, and both halves of that were wrong:
 *
 * - `setupTurns` mutates the instance it is called on, and `rollTurnOrder` runs
 *   on the **active GM alone**. A player's client took the `system` change and
 *   still never re-derived, so the order was fixed on one screen.
 * - `this.turn` is an **index**. Re-sorting mid-Round moves whoever sits at it,
 *   handing the turn to a different faction with no `combatTurnChange`, no
 *   budget reset and no turn-start effects — while the faction that really held
 *   it never gets a turn-end. `markTurnTaken` recomputes at every boundary and
 *   `delayFaction` at every declaration, so applying either mid-Round is that
 *   bug.
 *
 * This reads the source. A test of the sort cannot catch the original defect —
 * the sort answered correctly every time it was asked, and the defect was that
 * nothing asked — and the documents layer is the one layer the suite's world
 * model does not stand in for.
 */

import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

// Line endings normalised: the repo checks out CRLF on Windows, and a `\n}\n`
// boundary that silently fails to match turns a slice of one method into a
// slice of the whole file.
const SRC = readFileSync("module/documents/combat.mjs", "utf8").replace(/\r\n/g, "\n");

/**
 * One method's body, from its declaration to the closing brace at its own
 * indentation. Crude, and sufficient: the file indents every method by two.
 *
 * @param {string} name
 * @returns {string}
 */
function bodyOf(name) {
  const from = SRC.search(new RegExp(`\\n  (?:async )?${name}\\(`));
  if (from < 0) throw new Error(`${name} not found in module/documents/combat.mjs`);
  const to = SRC.indexOf("\n  }\n", from);
  return SRC.slice(from, to < 0 ? undefined : to);
}

describe("the rolled order reaching the played order", () => {
  it("is re-derived from _onUpdate, so it happens on every client", () => {
    // `setupTurns` mutates one instance, and `rollTurnOrder` runs on the active
    // GM alone: a re-sort beside the write fixes the GM's screen and no other.
    const body = bodyOf("_onUpdate");
    expect(body, "combat.mjs should override _onUpdate").toMatch(/super\._onUpdate\(/);
    expect(body, "the re-sort must be driven by the change reaching this client")
      .toMatch(/changed\?\.system\?\.turnOrder/);
    expect(body).toMatch(/this\.setupTurns\(\)/);
  });

  it("applies it only at the top of a Round, where the turn index is 0", () => {
    // `this.turn` is an index, not an identity. Re-sorting mid-Round moves
    // whoever sits at it — no turn-change event, no budget reset, and the
    // faction that held the turn never gets a turn-end.
    expect(bodyOf("_onUpdate"), "a mid-Round re-sort silently reassigns the turn")
      .toMatch(/\(this\.turn \?\? 0\) !== 0/);
  });

  for (const [name, why] of [
    ["delayFaction", "Delay+X recomputes the order at every declaration"],
    ["markTurnTaken", "marking recomputes the order at every turn boundary"],
  ]) {
    it(`${name} does not re-sort the played order itself — ${why}`, () => {
      expect(bodyOf(name), `${name} must not apply its recomputed order mid-Round`)
        .not.toMatch(/setupTurns\(\)/);
    });
  }

  it("keeps fgtTurnOrderChanged as an extension point, not the mechanism", () => {
    // The hook beside `delayFaction`'s write was the only signal the order had
    // moved, and it has never had a listener anywhere in the system.
    expect(SRC).toMatch(/Hooks\.callAll\("fgtTurnOrderChanged"/);
    expect(bodyOf("_onUpdate"), "the re-sort must not depend on a hook nobody listens to")
      .not.toMatch(/fgtTurnOrderChanged/);
  });
});
