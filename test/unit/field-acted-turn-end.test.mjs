/**
 * @file Which board a boundary's field events are asked about.
 * @see module/engine/fields.mjs, module/engine/scheduler-hooks.mjs, docs/46 §46.4-AC
 *
 * Sikera Ušum clause b: *"When a Unit other than Semiramis or her Master Acts
 * then ends its Turn within the NP area, it is inflicted with Poison."* It is
 * authored as an `interiorEvents` entry on `actedTurnEnd` with
 * `requiresActed: true`, and `runFieldEvent` filters on `u.acted`.
 *
 * `onTurnChange` builds a board at the top, runs `scheduler.endTurn` against
 * it, and only then dispatches the field events — and `runFieldEvents` called
 * `currentBoard()` again for itself. By that point the sequence has cleared the
 * turn state, so the fresh board reports `acted: false` for **every** unit and
 * the filter matches nobody. Measured on a live board with a console probe at
 * the dispatch:
 *
 * ```
 * [FGTDBG] actedTurnEnd semiramis-sikera-usum produced 0
 *          units …:acted=false:f=0, dKYxPs:acted=false:f=1, …
 * ```
 *
 * — `dKYxPs` is Heracles, standing inside the field (`f=1`) with `acted` set
 * true and a matching `turnState.tick` a moment before the boundary.
 *
 * Mad Enhancement's drain on the same event survived only because it is
 * dispatched from INSIDE `scheduler.endTurn`, off the `actedUnits` list the
 * hook captured before the reset. Every field `actedTurnEnd` event was dead:
 * Sikera Ušum clause b and the acted half of Jack's Mist are the corpus's two.
 *
 * The cure is to stop re-deriving the board. The hook already holds the right
 * one — the same board `endTurn` ran against — so it passes it in.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const fields = readFileSync("module/engine/fields.mjs", "utf8");
const hooks = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");

describe("runFieldEvents accepts the caller's board", () => {
  it("takes `board` as an option and only falls back to currentBoard()", () => {
    const sig = /export async function runFieldEvents\(event, \{([^}]*)\}/.exec(fields);
    expect(sig).not.toBeNull();
    expect(sig[1]).toMatch(/board = null/);
    const body = fields.slice(fields.indexOf("export async function runFieldEvents"));
    expect(body.slice(0, body.indexOf("return intents;"))).toMatch(/board \?\? currentBoard\(\)/);
  });
});

describe("the boundary hands its own board to every field dispatch", () => {
  const turnHook = hooks.slice(
    hooks.indexOf("async function onTurnChange"),
    hooks.indexOf("async function onRoundChange"),
  );

  it("passes it to actedTurnEnd — the dispatch that was dead", () => {
    expect(turnHook).toMatch(/runFieldEvents\("actedTurnEnd",[^)]*board/);
  });

  it("passes it to turnEnd too, so both halves of Jack's Mist agree", () => {
    expect(turnHook).toMatch(/runFieldEvents\("turnEnd",[^)]*board/);
  });

  it("dispatches AFTER endTurn, which is what made the stale board possible", () => {
    // Not a thing to fix — the sequence must run first. It is why the board has
    // to be carried rather than re-read.
    expect(turnHook.indexOf("scheduler.endTurn"))
      .toBeLessThan(turnHook.indexOf('runFieldEvents("actedTurnEnd"'));
  });
});
