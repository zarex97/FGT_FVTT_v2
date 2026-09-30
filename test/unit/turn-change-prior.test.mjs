/**
 * @file The turn that ENDED is read before anything writes to the Combat (#68).
 * @see module/engine/scheduler-hooks.mjs#onTurnChange, docs/46 §46.4-BV
 *
 * Foundry passes `combatTurnChange` its own `combat.previous` object, and
 * `Combat#_onUpdate` refills that same object on every later update:
 * `Object.assign(this.previous, priorState)` (foundryVTT_copy,
 * `app/client/documents/combat.mjs#recordPreviousState`), with `priorState`
 * the state as it now stands. `onTurnChange` awaited `claimBoundary` -- which
 * writes `system.scheduleClaim` -- and only then read `prior.combatantId`. By
 * then `prior` named the INCOMING combatant, so every turn-end step ran for the
 * faction about to act: its units' `turnEnd` handlers, its channels, and
 * `markTurnTaken`, which froze the wrong faction and re-sorted the order under
 * the current turn index.
 *
 * Found on the Semiramis audit: after a reload, Faction 1's Turn became Faction
 * 2's, because `takenThisRound` read `[faction-1]` while Faction 2 had acted.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const hooks = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");
const body = hooks.slice(hooks.indexOf("async function onTurnChange"), hooks.indexOf("async function onRoundChange"));

describe("onTurnChange reads the turn it ended", () => {
  it("copies the prior combatant before its first await", () => {
    const firstAwait = body.indexOf("await ");
    const captured = body.search(/const \w+ = prior\?\.combatantId/);
    expect(captured).toBeGreaterThan(-1);
    expect(captured).toBeLessThan(firstAwait);
  });

  it("never reads the live `prior` object after that", () => {
    const afterAwait = body.slice(body.indexOf("await "));
    expect(afterAwait).not.toMatch(/\bprior\b/);
  });
});
