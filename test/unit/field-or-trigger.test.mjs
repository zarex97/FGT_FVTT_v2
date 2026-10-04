/**
 * @file A field's "ended its Turn inside, OR Acted in a Turn and ended it inside" is one trigger (#180).
 * @see module/engine/fields.mjs#runFieldEvents
 *
 * Contagion trigger 2: *"If an enemy Unit ended its Turn within the Contagion
 * area, or at the end of a Turn an enemy Unit Acted and ended that Turn within
 * the Contagion area: Only affects that enemy Unit."* Authored as a `turnEnd`
 * and an `actedTurnEnd` event. Live, Medea cast Atlas on her own Turn inside the
 * area, both halves fired, and she lost 200 where the sheet says 100. Jack's
 * Mist states the same "or" for its Poison.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { runFieldEvents } from "../../module/engine/fields.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);
// The Poison and Charm chances roll; the Health loss is what is counted.
beforeEach(() => { globalThis.Roll = class { async evaluate() { return { total: 1 }; } }; });
afterEach(() => { delete globalThis.Roll; });

const PR = "paleRiderAct0001";
const FOE = "foeMedeaActor001";
const TICK = 10;

/** Contagion around Pale Rider, an enemy who Acted this Turn inside it. */
async function charges(activeFactionId) {
  const fields = await fieldsOf([{ ability: "pale-rider-contagion", owner: PR, faction: "A", panels: squareAround({ i: 6, j: 6 }, 5) }]);
  return withSubjects([
    { from: "pale-rider", id: PR, state: { factionId: "A" }, panel: { i: 6, j: 6 } },
    { from: "medea", id: FOE, state: { factionId: "B", turnState: { tick: TICK, acted: true } }, panel: { i: 6, j: 7 } },
  ], async ({ board }) => {
    const count = (intents) => intents.filter((i) => i.t === "statDelta" && i.unitId === FOE && i.delta < 0).length;
    return {
      turnEnd: count(await runFieldEvents("turnEnd", { board, activeFactionId })),
      actedTurnEnd: count(await runFieldEvents("actedTurnEnd", { board, activeFactionId })),
    };
  }, { tick: TICK, settings: { fields } });
}

describe("Contagion trigger 2 is one trigger", () => {
  it("on the enemy's own Turn: the own-Turn half fires and the acted half does not", async () => {
    expect(await charges("B")).toEqual({ turnEnd: 1, actedTurnEnd: 0 });
  });

  it("on somebody else's Turn the enemy Acted in: the acted half fires", async () => {
    expect(await charges("A")).toEqual({ turnEnd: 0, actedTurnEnd: 1 });
  });
});
