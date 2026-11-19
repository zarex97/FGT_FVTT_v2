/**
 * @file A removal writes each removable instance by its document, never every
 * instance of the definition (R-0032).
 *
 * Reproduced in world fgt2026 on 2026-11-19: Faction 2's Saber carried two Atk
 * Ups, one landed Unremovable, and the Attack path's removal (`removalIntents`)
 * wrote `removeEffect(saber, "atkUp")`. `io.mjs#deleteEffects` matches a
 * definition id as well as a document id, so both went. The Skill path
 * (`resolveRemoval`) wrote the same. Both now build their candidates in one
 * place and write the instances `removalTargets` names.
 */

import { describe, it, expect, beforeAll } from "vitest";

import { removalCandidatesOf, removalPlan, removalTargets } from "../../module/rules/removal.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

const bearer = (effects) => ({ from: "medea", id: "medea", panel: { i: 0, j: 0 }, effects });

/** What a removal of `atkUp` would write off Medea, and what each written id is. */
const written = (effects) => withSubjects([bearer(effects)], async ({ board, world }) => {
  const { EffectRegistry } = await import("../../module/rules/registry.mjs");
  const doc = world.actor("medea");
  const candidates = removalCandidatesOf(doc.effects, ["atkUp"], { defOf: (id) => EffectRegistry.get(id) });
  const plan = removalPlan({ candidates, bearer: board.units[0] });
  const targets = removalTargets(candidates, plan.removed);
  return targets.map((id) => {
    const e = doc.effects.get(id);
    return e ? { document: true, magnitude: e.system.magnitude, unremovable: Boolean(e.system.unremovable) } : { document: false, id };
  });
});

describe("a removal of an effect held twice", () => {
  it("writes the removable instance by its document and leaves its Unremovable twin", async () => {
    const out = await written([{ defId: "atkUp", magnitude: 10 }, { defId: "atkUp", magnitude: 20, unremovable: true }]);
    expect(out).toEqual([{ document: true, magnitude: 10, unremovable: false }]);
  });

  it("writes both instances when both may go", async () => {
    const out = await written([{ defId: "atkUp", magnitude: 10 }, { defId: "atkUp", magnitude: 20 }]);
    expect(out.map((o) => o.magnitude).sort()).toEqual([10, 20]);
    expect(out.every((o) => o.document)).toBe(true);
  });

  it("writes nothing when the only instance is Unremovable", async () => {
    expect(await written([{ defId: "atkUp", magnitude: 20, unremovable: true }])).toEqual([]);
  });
});
