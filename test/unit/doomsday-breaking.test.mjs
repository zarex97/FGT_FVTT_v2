/**
 * @file An [Anti-World] NP that breaks Doomsday Come hits every Unit within (#180, reading 7).
 * @see module/rules/bounded-fields.mjs#breakingCatch, module/engine/attack.mjs#declareProcesses
 *
 * > *"…all Units within it receive the damage from that NP, but its Total
 * > Damage is reduced by 50%."*
 *
 * Ruled 2026-10-04: used on or within (user inside, or a target or area panel
 * inside), every Unit inside at the declaration takes it, whatever its shape,
 * each in its own Combat Process with the NP's riders; never its user; a target
 * inside once; no cover; a Counter across the boundary refused.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { breakingCatch } from "../../module/rules/bounded-fields.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const ID = { pr: "paleRiderBreak01", prm: "paleRiderMastBr1", herc: "testHeraclesBrk1", q: "quetzBreak000001", foe: "medeaBreak000001", out: "castorBreak00001" };

/** Doomsday Come over rows and columns 1-7; Quetzalcoatl and Medea inside, Castor outside. */
async function breaking(hercPanel, targetIds, npTags = ["antiWorld"]) {
  const saved = game.settings;
  game.settings = { get: () => 3 };
  let fields;
  try {
    fields = await fieldsOf([{
      ability: "pale-rider-doomsday-come", owner: ID.pr, ownerMaster: ID.prm, faction: "A",
      panels: squareAround({ i: 4, j: 4 }, 7), shape: { kind: "square", size: 7, radius: 3 },
    }]);
  } finally {
    game.settings = saved;
  }
  return withSubjects([
    { from: "pale-rider", id: ID.pr, state: { factionId: "A", masterId: ID.prm }, panel: { i: 4, j: 5 } },
    { from: "master-advanced", id: ID.prm, state: { factionId: "A" }, panel: { i: 4, j: 4 } },
    { from: "quetzalcoatl", id: ID.q, state: { factionId: "A" }, panel: { i: 6, j: 4 } },
    { from: "medea", id: ID.foe, state: { factionId: "B" }, panel: { i: 2, j: 2 } },
    { from: "castor", id: ID.out, state: { factionId: "B" }, panel: { i: 9, j: 9 } },
    { from: "test-anti-world-heracles", id: ID.herc, state: { factionId: "B" }, panel: hercPanel },
  ], ({ board }) => breakingCatch(board, { attackerId: ID.herc, npTags, targetIds }).sort(), { settings: { fields } });
}

describe("breakingCatch", () => {
  it("from outside, on a target inside: every other Unit inside, allies of the user too", async () => {
    expect(await breaking({ i: 9, j: 4 }, [ID.q])).toEqual([ID.prm, ID.pr, ID.foe].sort());
  });

  it("from inside, on a target outside: everyone inside but the user", async () => {
    expect(await breaking({ i: 3, j: 3 }, [ID.out])).toEqual([ID.prm, ID.pr, ID.q, ID.foe].sort());
  });

  it("nothing when the NP is below [Anti-World]", async () => {
    expect(await breaking({ i: 9, j: 4 }, [ID.q], ["antiUnit"])).toEqual([]);
  });

  it("nothing when neither the user nor a target is inside", async () => {
    expect(await breaking({ i: 9, j: 4 }, [ID.out])).toEqual([]);
  });
});

describe("the declaration", () => {
  const src = readFileSync("module/engine/attack.mjs", "utf8");

  it("adds the caught Units and marks them, never a Counter", () => {
    expect(src).toMatch(/if \(!isCounter && attackSpec\.kind === "np" && \(attackSpec\.npTags \?\? \[\]\)\.length > 0\) \{[\s\S]*?breakingCatch\(/);
    expect(src).toMatch(/caughtByBreaking\.has\(state\.defenderId\) \? \{ caughtByBreaking: true \} : \{\}/);
  });

  it("keeps cover out of it", () => {
    expect(src).toMatch(/if \(state\.caughtByBreaking \|\| \(state\.breaking && !state\.breaking\.ownAoE\)\) return;/);
  });

  it("closes the area after the LAST Process of the declaration", () => {
    expect(src).toMatch(/const group = siblingStates\(state\);\s*if \(group\.some\(\(s2\) => s2 !== state && s2\.defenderId !== state\.defenderId && !process\.isComplete\(s2\)\)\) return;/);
  });
});
