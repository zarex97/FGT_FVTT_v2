/**
 * @file Exactly one CONNECTION runs a boundary, not merely one user.
 * @see module/engine/scheduler-hooks.mjs, docs/46-roster-re-audit.md §46.4-D
 *
 * `game.users.activeGM` elects one Gamemaster *user*, and `isSelf` is true for
 * every connection that user holds — so two browser tabs on one Gamemaster each
 * ran the whole turn-end sequence and every scheduled effect ticked twice.
 * `game.users.filter(u => u.active)` shows **one** either way, because Foundry
 * tracks activity per user and not per connection, which is what kept it hidden:
 * it was found only because it turned Mad Enhancement's stated 20-per-Turn
 * Master drain into a measured 40, and that was briefly reported as a rules
 * defect against Heracles.
 *
 * `scheduler-hooks.mjs` is the client boundary — it reads `game`, writes a
 * document and awaits a broadcast — so this guards the condition in the source,
 * the discipline `actor-fields.test.mjs` and `applier-callsites.test.mjs` already
 * apply. The behaviour itself is verified on a live board with two tabs open.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");

describe("the boundary claim", () => {
  it("is taken by both sequence entry points, not just one", () => {
    // A boundary that runs its sequence without claiming is a boundary two
    // connections both run. Both hooks, or the fix is half applied.
    const claims = source.match(/claimBoundary\(combat, "(turn|round)"/g) ?? [];
    expect(claims.sort()).toEqual([
      'claimBoundary(combat, "round"',
      'claimBoundary(combat, "turn"',
    ]);
  });

  it("is checked BEFORE the board is built, so a loser does no work", () => {
    const turnHook = source.slice(source.indexOf("async function onTurnChange"));
    expect(turnHook.indexOf("claimBoundary")).toBeLessThan(turnHook.indexOf("boardFor(combat)"));
  });

  it("refuses to proceed on a lost claim rather than merely logging one", () => {
    expect(source).toMatch(/if \(!await claimBoundary\(combat, "turn"\)\) return;/);
    expect(source).toMatch(/if \(!await claimBoundary\(combat, "round"\)\) return;/);
  });

  it("is keyed on the boundary, NOT on the counter its own sequence advances", () => {
    // Ch. 46 §46.4-AB. `globalTurn` is written at the bottom of the very
    // sequence the claim guards, so a claim keyed on it and a throw in between
    // froze the scheduler permanently. Measured live: `globalTurn` 0 and
    // `scheduleClaim {turn: 0, token: "PP9RrW7AXI5R3qoc", round: 8}` after
    // fourteen Turn changes, with a channel stuck at `elapsedTicks: 0`.
    const fn = source.slice(source.indexOf("async function claimBoundary"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toMatch(/boundaryKey\(kind, combat\)/);
    expect(body).not.toMatch(/globalTurn/);
  });

  it("decides on a token rather than on a flag", () => {
    // Foundry gives a system no server-side compare-and-set, and both
    // connections wake from the SAME broadcast — so a plain "has this been
    // run?" check is read by both before either writes. Both write a token, the
    // server serialises them, and exactly one still sees its own.
    expect(source).toMatch(/const token = foundry\.utils\.randomID\(\)/);
    // Its OWN scale's token. A round change is always also a turn change, so
    // both hooks claim at once -- and a single shared `token` field meant the
    // turn's write landed last and the round's comparison found a stranger's,
    // so the round sequence concluded it had lost and never ran
    // (Ch. 46 §46.4-AM).
    expect(source).toMatch(/scheduleClaim\?\.\[field\] \?\? null\) === token/);
    expect(source).toMatch(/const field = tokenField\(kind\)/);
  });

  it("still elects a single user first, which is the cheap half", () => {
    expect(source).toMatch(/game\.users\.activeGM\?\.isSelf/);
  });

  it("carries the claim on the match, where both connections can see it", () => {
    expect(readFileSync("module/data/misc.mjs", "utf8")).toMatch(/scheduleClaim: new fields\.ObjectField/);
  });
});
