/**
 * @file A charmed Unit is its charmer's ally and its own side's enemy (#180).
 * @see module/rules/relations.mjs#sideOf, module/rules/control.mjs#annotateControl
 *
 * Ruled 2026-10-04: Charm's *"The Unit is controlled by the inflicter's Faction
 * for the duration"* moves the Unit to its charmer's side for every rule at
 * once. Contagion and Innocent World skip it, a Kagome Spirit's chase lifts,
 * Doomsday Come lets it out, it guards nobody, and its own Turn is its
 * charmer's.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { fieldsOf, squareAround, prepareFields } from "../helpers/field.mjs";
import { relationOf, guardsOf } from "../../module/rules/relations.mjs";
import { membershipVerdict, unitIdsOfTurn } from "../../module/rules/bounded-fields.mjs";
import { pursuitVerdict } from "../../module/rules/movement.mjs";

beforeAll(async () => { await prepareSubjects(); await prepareFields(); }, 120_000);

const ID = {
  pr: "paleRiderCharm01", prm: "paleRiderMastr01", medea: "medeaCharm000001",
  medeaMaster: "medeaMasterCharm", achilles: "achillesCharm001", sword: "swordCharm000001",
};
const DC = "pale-rider-doomsday-come";

/** Doomsday Come (rows and columns 1-7) over Medea, charmed by Pale Rider, and Achilles, not charmed. */
async function board(fn) {
  const saved = game.settings;
  game.settings = { get: () => 3 };
  let fields;
  try {
    fields = await fieldsOf([{
      ability: DC, owner: ID.pr, ownerMaster: ID.prm, faction: "A",
      panels: squareAround({ i: 4, j: 4 }, 7), shape: { kind: "square", size: 7, radius: 3 },
    }]);
  } finally {
    game.settings = saved;
  }
  return withSubjects([
    { from: "pale-rider", id: ID.pr, state: { factionId: "A", masterId: ID.prm }, panel: { i: 4, j: 5 } },
    { from: "master-advanced", id: ID.prm, state: { factionId: "A" }, panel: { i: 4, j: 4 } },
    {
      from: "medea", id: ID.medea, state: { factionId: "B", masterId: ID.medeaMaster }, panel: { i: 6, j: 6 },
      effects: [{ defId: "charm", sourceUnitId: ID.pr }],
    },
    { from: "master-advanced", id: ID.medeaMaster, state: { factionId: "B" }, panel: { i: 7, j: 7 } },
    { from: "achilles", id: ID.achilles, state: { factionId: "B" }, panel: { i: 6, j: 3 } },
    { from: "kagome-sword", id: ID.sword, state: { factionId: "A", pursuitTargetId: ID.medea, boundToFieldId: DC }, panel: { i: 2, j: 6 } },
  ], fn, { settings: { fields } });
}

describe("a charmed Unit's side", () => {
  it("is its charmer's", async () => {
    const out = await board(({ unit, board: b }) => ({
      toCharmer: relationOf(unit(ID.pr), unit(ID.medea), b),
      toOwnSide: relationOf(unit(ID.achilles), unit(ID.medea), b),
      uncharmed: relationOf(unit(ID.pr), unit(ID.achilles), b),
    }));
    expect(out).toEqual({ toCharmer: "ally", toOwnSide: "enemy", uncharmed: "enemy" });
  });

  it("takes no Innocent World inside Doomsday Come", async () => {
    const out = await board(({ unit }) => [ID.medea, ID.achilles].map((id) =>
      [...(unit(id).modifiers ?? []), ...(unit(id).checkModifiers ?? []),
        ...(unit(id).applicationChances ?? []), ...(unit(id).vulnerabilityAmplifiers ?? [])]
        .some((m) => m.source === DC && !m.predicate)));
    expect(out).toEqual([false, true]);
  });

  it("may leave Doomsday Come; its own side may not", async () => {
    const out = await board(({ unit, board: b }) => {
      const field = b.fields.find((f) => f.id === DC);
      return [membershipVerdict(field, unit(ID.medea), "exit", b).ok, membershipVerdict(field, unit(ID.achilles), "exit", b).ok];
    });
    expect(out).toEqual([true, false]);
  });

  it("acts on its charmer's Turn", async () => {
    const out = await board(({ board: b }) => [unitIdsOfTurn(b, "A").includes(ID.medea), unitIdsOfTurn(b, "B").includes(ID.medea)]);
    expect(out).toEqual([true, false]);
  });

  it("guards nobody", async () => {
    const out = await board(({ unit, board: b }) => guardsOf(unit(ID.medeaMaster), b).map((u) => u.id));
    expect(out).not.toContain(ID.medea);
  });

  it("lifts a Kagome Spirit's chase", async () => {
    const out = await board(({ unit, board: b }) => pursuitVerdict(unit(ID.sword), [{ i: 2, j: 6 }, { i: 1, j: 6 }], b).ok);
    expect(out).toBe(true);
  });
});
