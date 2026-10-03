/**
 * @file Her Double Move and her Riding Active's +6 carry to the mount she drives (#65, rulings 26 and 27).
 * @see module/rules/movement.mjs#moverFor, packs/_source/class-skills/riding.yml
 *
 * > *"While Quetz is Riding the Quetzalcoatlus, Quetz's Move … is replaced with
 * > Quetzalcoatlus'."*
 *
 * A driving rider is measured as the mount (#143). The mount has no Riding, so
 * her Double Move was lost the moment she drove -- a drive after her Attack was
 * refused -- and her Active's *"MOV +6 for this Turn"* moved only her own feet.
 * Ruled 2026-10-02: both carry. The mount moves 7 + 6 = 13, and its Move may be
 * split around the Attack as hers may.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { moverFor, gateMovement, planMovement, segmentCheck } from "../../module/rules/movement.mjs";

beforeAll(prepareSubjects, 60_000);

const ID = { quetz: "quetzSubject0001", mount: "mountSubject0001" };

/** Her authored abilities, with Riding switched on: the mode her bar's Riding slot toggles. */
const ridingOn = () => yaml.load(readFileSync("packs/_source/servants/quetzalcoatl.yml", "utf8"))
  .abilities.map((a) => (a.ref === "class-riding" ? { ...a, active: true } : a));

/** Quetz on the mount's east column at (1,2), the 2x2 mount at (1,1), aboard (level 1). */
const aboard = ({ riding = false, turnState = null } = {}) => [
  {
    from: "quetzalcoatl", id: ID.quetz, panel: { i: 1, j: 2, k: 1 },
    ...(riding ? { with: { abilities: ridingOn() } } : {}),
    ...(turnState ? { state: { turnState } } : {}),
  },
  { from: "quetzalcoatlus", id: ID.mount, state: { ownerId: ID.quetz }, panel: { i: 1, j: 1, k: 1 } },
];

const east = (from, steps) => Array.from({ length: steps }, (_, n) => ({ i: from.i, j: from.j + 1 + n }));

describe("Riding's Active +6 carries to the mount (ruling 27)", () => {
  it("is authored on the shared Riding as a delta that carries", () => {
    expect(readFileSync("packs/_source/class-skills/riding.yml", "utf8")).toMatch(/carriesToMount: true/);
  });

  it("the mount she drives moves 13 with Riding on, and 7 without", async () => {
    const out = await withSubjects(aboard({ riding: true }), ({ unit, board }) => ({
      hers: unit(ID.quetz).mov,
      mover: moverFor(unit(ID.quetz), board).mov,
      budget: planMovement(unit(ID.quetz), board).budget,
      thirteen: gateMovement(east({ i: 1, j: 2 }, 9), unit(ID.quetz), board).reasons,
    }));
    expect(out).toEqual({ hers: 13, mover: 13, budget: 13, thirteen: [] });

    const off = await withSubjects(aboard(), ({ unit, board }) => moverFor(unit(ID.quetz), board).mov);
    expect(off).toBe(7);
  });

  it("a MOV change that does not carry stays on her feet", async () => {
    // Her own MOV raised by hand to 10: the mount still moves 7.
    const out = await withSubjects([
      { ...aboard()[0], with: { mov: 10 } }, aboard()[1],
    ], ({ unit, board }) => moverFor(unit(ID.quetz), board).mov);
    expect(out).toBe(7);
  });
});

describe("Double Move carries to the mount (ruling 26)", () => {
  it("the mover she drives holds her doubleMove grant", async () => {
    const out = await withSubjects(aboard(), ({ unit, board }) => ({
      mount: unit(ID.mount).grantedAbilities ?? [],
      mover: moverFor(unit(ID.quetz), board).grantedAbilities,
      segments: planMovement(unit(ID.quetz), board).maxSegments,
    }));
    expect(out.mount).not.toContain("doubleMove");
    expect(out.mover).toContain("doubleMove");
    expect(out.segments).toBe(2);
  });

  it("a drive after her Attack is allowed, within the one MOV allowance", async () => {
    const out = await withSubjects(aboard({ turnState: { attacked: true, moved: true, moveSegments: 1, movedPanels: 3 } }),
      ({ unit, board }) => ({
        check: segmentCheck(moverFor(unit(ID.quetz), board)),
        four: gateMovement(east({ i: 1, j: 2 }, 4), unit(ID.quetz), board).ok,
        five: gateMovement(east({ i: 1, j: 2 }, 5), unit(ID.quetz), board).ok,
      }));
    expect(out).toEqual({ check: null, four: true, five: false });
  });
});
