/**
 * @file A flat bonus's `supersedes` survives the projection (#126, #103).
 * @see module/rules/snapshot.mjs#abilityRecordOf, module/rules/elements.mjs#FlatDamage, module/rules/damage/pipeline.mjs stage 7
 *
 * > Piedra Del Sol: *"Goddess' Divine Core: All damage dealt is increased by 180."*
 *
 * The ruling is that the stone's +180 REPLACES the Skill's +120. `FlatDamage`
 * stamps `sourceContentId: ability?.contentId`, and stage 7 drops a bonus whose
 * `sourceContentId` another bonus supersedes. But `contributionsOf` built the
 * record it hands the executors without the Skill's `contentId`, so the bonus
 * always carried `sourceContentId: null` and `supersedes` had nothing to match:
 * Core plus the stone added +300. #103's own test passed `contentId` into the
 * ability by hand, so it agreed with itself and not with the projection.
 *
 * This starts from Quetzalcoatl as the projection builds her, and the stone's
 * interior is run through the real executor the way `annotateFields` runs it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { interiorContributions } from "../../module/rules/bounded-fields.mjs";

beforeAll(prepareSubjects, 60_000);

const CORE = "quetz-goddesses-divine-core";
const STONE = "quetz-piedra-del-sol";

/** Quetzalcoatl as the projection builds her, with the stone's field open over her, and what the stone adds. */
const withStone = (fn) => withSubjects(
  [{ from: "quetzalcoatl", id: "quetzalcoatl", panel: { i: 6, j: 6 } }],
  ({ unit, board, world }) => {
    const quetz = unit("quetzalcoatl");
    const spec = world.actor("quetzalcoatl").items.find((i) => i.system.contentId === STONE).system.field;
    // The runtime shape `engine/fields.mjs#createField` stores: the ability's id as the field's id.
    const field = {
      ...spec, id: STONE, ownerId: "quetzalcoatl", ownerFaction: quetz.faction,
      geometry: { ...spec.geometry, anchor: { i: 6, j: 6, k: 0 } },
    };
    const stone = interiorContributions(field, quetz, board).modifiers;
    return fn({ quetz, stone });
  },
);

/** A plain hit by `attacker` on a 200 base, and what stage 7 did to it. */
const stage7 = (attacker) => {
  const defender = { id: "d", health: 99999, modifiers: [], effects: [] };
  const result = computeDamage({
    attacker, defender,
    attack: { kind: "normal", component: "str" },
    base: { fixedValue: 200 },
    rolls: { attackMinus: 0 },
    crit: { isCrit: false },
    options: rollOptionsFor({ attacker, defender, attack: { kind: "normal" } }),
  });
  const stage = result.breakdown.find((s) => s.index === 7);
  const total = (side) => side.mag + side.phys;
  return { added: total(stage.after) - total(stage.before), rows: stage.contributors };
};

describe("Goddess's Divine Core as the projection holds it", () => {
  it("carries the Skill's content id on its flat bonus, so another bonus can name it", async () => {
    const core = await withStone(({ quetz }) => quetz.modifiers.find((m) => m.key === "divinity" && m.source === "Goddess's Divine Core"));
    expect(core).toMatchObject({ value: 120, sourceContentId: CORE });
  });
});

describe("Piedra Del Sol over Goddess's Divine Core", () => {
  /** Her own modifiers, narrowed to her flat bonuses: nothing else is under test. */
  const flatOnly = (quetz, extra = []) => ({
    ...quetz, modifiers: [...quetz.modifiers.filter((m) => m.key === "divinity"), ...extra],
  });

  it("adds Core's +120 alone, outside the stone", async () => {
    const { added } = await withStone(({ quetz }) => stage7(flatOnly(quetz)));
    expect(added).toBe(120);
  });

  it("replaces it with the stone's +180, where the two stacked to +300", async () => {
    const { added, rows } = await withStone(({ quetz, stone }) => stage7(flatOnly(quetz, stone)));
    expect(added).toBe(180);
    expect(rows.find((r) => r.note === `Goddess's Divine Core (superseded by ${STONE})`)).toMatchObject({ value: 0 });
    expect(rows.find((r) => r.note === STONE)).toMatchObject({ value: 180 });
  });
});
