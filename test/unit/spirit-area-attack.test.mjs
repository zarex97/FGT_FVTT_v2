/**
 * @file A Kagome Spirit's area attack must contain its enemy and hits every enemy in it (#180).
 * @see module/rules/targeting/resolve.mjs (4b-ii), module/rules/ability-use.mjs#targetSpecFor
 *
 * Live: Famine's 3x3 aimed at Asterios left Ozymandias, inside the 3x3, "forced
 * to attack another unit". Ruled 2026-10-04: the area must contain the
 * Spirit's own enemy, and then hits every enemy in it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { resolveTargets } from "../../module/rules/targeting/resolve.mjs";
import { targetSpecFor } from "../../module/rules/ability-use.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = { famine: "famineArea000001", asterios: "asteriosArea0001", ozy: "ozymandiasArea01", medea: "medeaArea0000001" };

/** Famine at (2,2) chasing Asterios; aimed at `aim`. */
const hits = (asteriosPanel, aim) => withSubjects([
  { from: "kagome-famine", id: ID.famine, state: { factionId: "A", pursuitTargetId: ID.asterios }, panel: { i: 2, j: 2 } },
  { from: "asterios", id: ID.asterios, state: { factionId: "B" }, panel: asteriosPanel },
  { from: "ozymandias", id: ID.ozy, state: { factionId: "B" }, panel: { i: 4, j: 4 } },
  { from: "medea", id: ID.medea, state: { factionId: "B" }, panel: { i: 8, j: 8 } },
], ({ unit, board }) => {
  const famine = unit(ID.famine);
  const spec = targetSpecFor(null, 3, null, famine);
  return resolveTargets(spec, famine, board, { unitId: aim })
    .units.map((u) => u.unitId ?? u.id ?? u.unit?.id).sort();
});

describe("Famine's 3x3", () => {
  it("is an area", async () => {
    const spec = await withSubjects([
      { from: "kagome-famine", id: ID.famine, state: { factionId: "A" }, panel: { i: 2, j: 2 } },
    ], ({ unit }) => targetSpecFor(null, 3, null, unit(ID.famine)));
    expect(spec.shape).toMatchObject({ kind: "square", size: 3 });
  });

  it("hits its enemy and the other enemy beside it", async () => {
    expect(await hits({ i: 4, j: 3 }, ID.asterios)).toEqual([ID.asterios, ID.ozy].sort());
  });

  it("hits nobody when its enemy is not in the area", async () => {
    expect(await hits({ i: 0, j: 0 }, ID.ozy)).toEqual([]);
  });
});
