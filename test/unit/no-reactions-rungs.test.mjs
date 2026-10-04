/**
 * @file "Cannot Evade, Block, or Counter" closes the rungs (#180).
 * @see module/rules/elements.mjs#GrantedAbility, module/engine/attack.mjs#defenderRefusals
 *
 * Live: Achilles attacked Pale Rider, the react rung offered Block and Evade,
 * and Pale Rider Evaded. `noReactions` was read only where reaction ABILITIES
 * are offered.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import * as process from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 60_000);

const PR = "paleRiderNoReact1";
const SPIRIT = "kagomeNoReact001";

describe("noReactions", () => {
  it("forbids Pale Rider and a Kagome Spirit every rung", async () => {
    const out = await withSubjects([
      { from: "pale-rider", id: PR, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "kagome-sword", id: SPIRIT, state: { factionId: "A" }, panel: { i: 5, j: 6 } },
    ], ({ unit }) => [unit(PR).forbiddenReactions, unit(SPIRIT).forbiddenReactions]);
    for (const rungs of out) expect(rungs).toEqual(expect.arrayContaining(["evade", "block", "counter"]));
  });

  it("leaves an ordinary Servant its rungs", async () => {
    const out = await withSubjects([
      { from: "achilles", id: "achillesNoReact1", state: { factionId: "B" }, panel: { i: 5, j: 5 } },
    ], ({ unit }) => unit("achillesNoReact1").forbiddenReactions);
    expect(out).not.toContain("evade");
  });

  it("the ladder refuses an Evade the rung forbids", () => {
    const s = { state: "react", history: [], forbiddenReactions: ["evade", "block", "counter"] };
    expect(() => process.advance(s, "evade")).toThrow();
  });
});
