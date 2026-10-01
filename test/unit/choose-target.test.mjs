/**
 * @file A choice still owed when a Skill is used is a refusal.
 * @see module/engine/skill-use.mjs, module/rules/targeting/resolve.mjs, docs/20-targeting.md, #129
 *
 * `resolveTargets` answers a `chooser: chosen` selection with `needsChoice` and
 * no units until the placement carries `chosenIds`. The interface settles that
 * before it sends anything; a Skill called from a macro never asks, and
 * `resolveSkillTargets` returned `units: []` and `errors: []` -- the phases ran
 * against nobody and the cost and cooldown were still paid.
 *
 * Built with `test/helpers/subject.mjs`: Quetzalcoatl from the real corpus,
 * her real Good God's Wisdom, an ally standing in her square.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { resolveSkillTargets } from "../../module/engine/skill-use.mjs";

beforeAll(prepareSubjects, 60_000);

const ally = {
  from: {
    type: "servant", id: "ally", name: "ally", servantClasses: ["saber"],
    parameters: { str: "C", end: "C", agi: "C", mag: "C", luc: "C" },
  },
  state: { factionId: "red" },
  panel: { i: 6, j: 7 },
};

/** Quetzalcoatl at (6, 6), with or without an ally beside her. */
const withQuetzalcoatl = (others, fn) => withSubjects([
  { from: "quetzalcoatl", state: { factionId: "red" }, panel: { i: 6, j: 6 } },
  ...others,
], ({ unit, board, world }) => {
  const ggw = world.actor("quetzalcoatl").items.find((i) => i.system.slug === "good-gods-wisdom"
    || /Good God/.test(i.name));
  return fn({ ggw, self: unit("quetzalcoatl"), board });
});

describe("Good God's Wisdom used with no choice made (#129)", () => {
  it("refuses when two Units could be chosen", async () => {
    const out = await withQuetzalcoatl([ally], ({ ggw, self, board }) => resolveSkillTargets(ggw, self, board, {}));
    expect(out.units).toEqual([]);
    expect(out.errors).toEqual(["Choose a target."]);
  });

  it("goes ahead once the choice is made", async () => {
    const out = await withQuetzalcoatl([ally], ({ ggw, self, board }) => resolveSkillTargets(
      ggw, self, board, { chosenIds: ["ally"] },
    ));
    expect(out.errors).toEqual([]);
    expect(out.units.map((u) => u.unitId)).toEqual(["ally"]);
  });
});
