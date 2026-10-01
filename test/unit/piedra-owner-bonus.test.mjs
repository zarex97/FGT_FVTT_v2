/**
 * @file Piedra Del Sol's +180 and -50% hold wherever she stands while the stone exists (#65, ruling 5).
 * @see packs/_source/abilities/quetz-piedra-del-sol.yml, module/rules/elements.mjs#DEFERRED_PREFIXES, docs/28-bounded-fields.md
 *
 * > *"While the Piedra Del Sol is above the field, it has the following effects:
 * > 1. Goddess' Divine Core: All damage dealt is increased by 180; and all damage
 * > taken by Quetz is reduced by 50% including NP."*
 *
 * Ruled by the author: **"on the field" means on the board.** The +180 and the
 * -50% hold wherever she stands while the stone exists. Authored as the field's
 * `interior` rules they held only while she stood inside the 7x7, so Quetzalcoatl
 * who Moved out of her own area (*"Quetz can Move out of the Piedra Del Sol
 * area"*) lost both, and one riding the Quetzalcoatlus read as outside it.
 *
 * They are her own passive rules now, gated on `fieldActive` -- *the stone
 * exists* -- which is a question about the field existing and not about where she
 * is (Medusa's Blood Temple asks it of Blood Fort Andromeda). The route is run
 * through the real projection and the real damage pipeline.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, compiled, prepareFields } from "../helpers/field.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const QZ = "quetzalcoatlAct1";
const FOE = "foeHeraclesAct01";
const subjects = (at) => [
  { from: "quetzalcoatl", id: QZ, state: { factionId: "A" }, panel: at },
  { from: "heracles", id: FOE, state: { factionId: "B" }, panel: { i: 12, j: 12 } },
];
const stone = () => fieldsOf([{
  ability: "quetz-piedra-del-sol", owner: QZ, faction: "A", panels: squareAround({ i: 6, j: 6 }, 7),
}]);

const INSIDE = { i: 6, j: 6 };
const OUTSIDE = { i: 0, j: 0 };

/** The stage rows a hit breakdown holds, keyed by the source each names. */
const rows = (result) => result.breakdown.flatMap((stage) => stage.contributors ?? []);

/** One hit between `attacker` and `defender`, from the real projections of both. */
function hit({ attacker, defender, kind = "normal" }) {
  const attack = { kind, component: "str" };
  return computeDamage({
    attacker, defender, attack,
    base: { fixedValue: 200 },
    rolls: { attackMinus: 0 },
    crit: { isCrit: false },
    options: rollOptionsFor({ attacker, defender, attack }),
  });
}

/** Run `fn` on a board where the stone is open (`stood`) or never was (`null`). */
async function board(at, withStone, fn) {
  const fields = withStone ? await stone() : [];
  return withSubjects(subjects(at), ({ unit }) => fn(unit(QZ), unit(FOE)), { settings: { fields } });
}

describe("what the stone gives her is authored on her, not on the field's interior", () => {
  it("has no interior rules: the +180 and the -50% are not tied to standing in the 7x7", async () => {
    const field = (await compiled("quetz-piedra-del-sol")).system.field;
    expect(field.interior ?? []).toEqual([]);
  });

  it("is two passive rules gated on the stone existing", async () => {
    const { passiveRules } = (await compiled("quetz-piedra-del-sol")).system;
    expect(passiveRules.map((r) => r.key).sort()).toEqual(["FlatDamage", "Ward"]);
    for (const rule of passiveRules) {
      expect(JSON.stringify(rule.predicate), rule.key).toContain("fieldActive:quetz-piedra-del-sol");
    }
  });
});

describe("the +180 on everything she deals, Noble Phantasms included", () => {
  /** Whether the stone's 180 is among the rows of her hit at `at`, with the stone open or not. */
  const has180 = (at, withStone, kind) => board(at, withStone, (self, foe) => {
    const result = hit({ attacker: self, defender: foe, kind });
    return rows(result).some((r) => r.source === "divinity" && r.value === 180 && r.side === "attacker");
  });

  it("applies inside the 7x7, as it always did", async () => {
    expect(await has180(INSIDE, true, "normal")).toBe(true);
  });

  it("applies when she has Moved OUT of her own area, which is the point", async () => {
    expect(await has180(OUTSIDE, true, "normal")).toBe(true);
  });

  it("applies to a Noble Phantasm too: *including NP*", async () => {
    expect(await has180(OUTSIDE, true, "np")).toBe(true);
  });

  it("is not there when the stone is not", async () => {
    expect(await has180(INSIDE, false, "normal")).toBe(false);
    expect(await has180(OUTSIDE, false, "normal")).toBe(false);
  });

  it("carries supersedes, so it replaces Divine Core's 120 rather than adding to it", async () => {
    const supersedes = await board(OUTSIDE, true, (self) => self.modifiers
      .filter((m) => m.value === 180 && m.key === "divinity").flatMap((m) => m.supersedes ?? []));
    expect(supersedes).toEqual(["quetz-goddesses-divine-core"]);
  });
});

describe("the -50% on everything she takes, Noble Phantasms included", () => {
  /** Whether the stone's ward is among the rows of a Servant's hit on her at `at`. */
  const warded = (at, withStone, kind) => board(at, withStone, (self, foe) => (
    rows(hit({ attacker: foe, defender: self, kind }))
      .filter((r) => r.source === "ward" && r.side === "defender").map((r) => r.value)
  ));

  it("applies inside the 7x7, and OUTSIDE it, which is the point", async () => {
    expect(await warded(INSIDE, true, "normal")).toEqual([-50]);
    expect(await warded(OUTSIDE, true, "normal")).toEqual([-50]);
  });

  it("is not reduced against a Noble Phantasm: `npValue` equals `value`", async () => {
    expect(await warded(OUTSIDE, true, "np")).toEqual([-50]);
  });

  it("is not there when the stone is not", async () => {
    expect(await warded(INSIDE, false, "normal")).toEqual([]);
    expect(await warded(OUTSIDE, false, "normal")).toEqual([]);
  });

  it("is hers alone: her Master standing in the stone is not warded", async () => {
    // The sheet's subject is Quetz, which `relations: [self]` was. A rule on HER
    // passives reaches nobody else.
    const fields = await stone();
    const onMaster = await withSubjects([
      ...subjects(OUTSIDE),
      { from: "master-advanced", id: "masterOfQz00001", state: { factionId: "A" }, panel: { i: 6, j: 7 } },
    ], ({ unit }) => rows(hit({ attacker: unit(FOE), defender: unit("masterOfQz00001") }))
      .filter((r) => r.source === "ward"), { settings: { fields } });
    expect(onMaster).toEqual([]);
  });
});
