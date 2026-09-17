/**
 * @file The placement a reaction is resolved with.
 * @see module/rules/ability-use.mjs, docs/46-roster-re-audit.md §46.4-S
 *
 * When a defender takes a reaction, `engine/attack.mjs` resolves it through
 * `useSkill` with a placement built from the attack in flight. It omitted
 * `unitId` whenever the reaction's owner WAS the unit in peril:
 *
 *     ...(owner.id === aimedAt ? {} : { unitId: aimedAt }),
 *
 * EMIYA's *Rho Aias* is anchored `{ kind: targetUnit, range: 3 }` — it is
 * projected in front of the ally about to be hit — and the ordinary case is
 * EMIYA projecting it in front of himself. With no `unitId` the anchor has
 * nothing to resolve, so the use was refused with *"Choose a target."*, the
 * attack carried on, and the only second Health pool in the reference set never
 * engaged.
 *
 * Measured live: Heracles's Nine Lives for 1406 against a full-Health EMIYA.
 * Rho Aias was offered, chosen, and recorded in the Process history as taken —
 * and its `shieldHealth` was still 1400, its `timesUsed` still 0, and EMIYA was
 * dead at 0 despite a clause reading *"EMIYA's Health cannot drop below 1"*.
 *
 * A `self` anchor ignores `unitId` — it resolves to the caster whatever is
 * passed — so naming the unit in peril is safe for every reaction and necessary
 * for the ones that aim.
 */

import { describe, it, expect } from "vitest";
import { reactionPlacement } from "../../module/rules/ability-use.mjs";

describe("a reaction always knows what it is aimed at", () => {
  it("names the unit in peril even when the projector IS that unit", () => {
    // Rho Aias, the case that found this.
    expect(reactionPlacement({ attackerId: "heracles", aimedAt: "emiya", ownerId: "emiya" }))
      .toEqual({ sourceUnitId: "heracles", unitId: "emiya" });
  });

  it("names the ally when a third party projects it", () => {
    expect(reactionPlacement({ attackerId: "heracles", aimedAt: "ally", ownerId: "emiya" }))
      .toEqual({ sourceUnitId: "heracles", unitId: "ally" });
  });

  it("carries the attacker as `sourceUnitId`, which a `sourceOfAttack` anchor needs", () => {
    // Kiritsugu's shot points the other way and resolves against this field.
    expect(reactionPlacement({ attackerId: "heracles", aimedAt: "heracles", ownerId: "kiritsugu" }))
      .toMatchObject({ sourceUnitId: "heracles", unitId: "heracles" });
  });

  it("omits nothing — a self-anchored reaction ignores `unitId` anyway", () => {
    const p = reactionPlacement({ attackerId: "a", aimedAt: "b", ownerId: "b" });
    expect("unitId" in p).toBe(true);
    expect("sourceUnitId" in p).toBe(true);
  });
});
