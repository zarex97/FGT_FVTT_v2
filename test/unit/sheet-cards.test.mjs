/**
 * @file The actor sheet's ability cards gate on the board's Unit, not a bare snapshot.
 * @see module/apps/actor-sheet/context.mjs, docs/35-sheets-and-editor.md, #158
 *
 * `buildContext` projects `unitSnapshot(actor)` and `abilitiesContext` handed it
 * to every card as `unit`, and the card gates with `canUseAbility` and a
 * `testPredicate` over `rollOptionsFor({attacker: unit})`. A bare projection
 * carries none of the board's annotations -- `platformContentId`, `inHomeBase`,
 * `fields`, `ownedFields`, `terrain` are written only by `snapshotBoard`'s
 * passes -- so `self:onPlatform:<id>`, `self:inHomeBase`, `self:fieldActive:<id>`
 * and `self:terrain:<type>` were never emitted on the sheet, and a requirement
 * that reads one was answered wrongly in BOTH directions. §46.4-AX supplied the
 * evaluator at the bar and the sheet and applied the board's unit to the bar
 * only.
 *
 * Seven abilities are named by an annotation: the three Quetzalcoatlus Spells
 * (`self:onPlatform`, `self:fieldActive`), Xiuhcoatl (`{not: self:onPlatform}`),
 * Summoning: Bašmu, the Hanging Gardens (`self:inHomeBase`) and Jack's Maria the
 * Ripper (`self:inField`).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { importAttack } from "../helpers/engine.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { snapshotUnit } from "../../module/rules/snapshot.mjs";

beforeAll(async () => { await prepareSubjects(); await importAttack(); }, 60_000);

/** Quetzalcoatl riding the Quetzalcoatlus: one Level above the ground, on its panel. */
const riding = (fn) => withSubjects([
  { from: "quetzalcoatl", id: "quetz", state: { factionId: "red" }, panel: { i: 6, j: 6, k: 20 } },
  { from: "quetzalcoatlus", id: "mount", state: { factionId: "red" }, panel: { i: 6, j: 6, k: 20 } },
], async ({ world, board, unit }) => {
  // Past the Noble Phantasm gate: a card gated on the Round says so before it
  // says anything about a predicate.
  await world.combat.update({ round: 7 });
  const { abilitiesContext } = await import("../../module/apps/actor-sheet/context.mjs");
  const actor = world.actor("quetz");
  // What `buildContext` hands over: a projection of the actor ALONE.
  const bare = snapshotUnit(actor, { panel: { i: 6, j: 6, k: 20 } });
  const cards = abilitiesContext(actor, bare, 3, board);
  const all = [...cards.classSkills, ...cards.skills, ...cards.noblePhantasms];
  const card = (name) => all.find((c) => c.name === name);
  return fn({ card, bare, boardUnit: unit("quetz") });
});

describe("a card reads the board's annotations (#158)", () => {
  it("the bare snapshot never emits `self:onPlatform`, and the board's Unit does", async () => {
    const [bare, board] = await riding(({ bare, boardUnit }) => [
      rollOptionsFor({ attacker: bare }), rollOptionsFor({ attacker: boardUnit }),
    ]);
    expect(bare.has("self:onPlatform:quetzalcoatlus")).toBe(false);
    expect(board.has("self:onPlatform:quetzalcoatlus")).toBe(true);
  });

  it("while she rides, the three Spells read usable", async () => {
    const states = await riding(({ card }) => ["Tlahuitequiliztli", "Ehecatle", "Tlaelquiyahuitl"]
      .map((name) => card(name).state));
    for (const state of states) expect(state.ok, JSON.stringify(state)).toBe(true);
  });

  it("while she rides, Xiuhcoatl reads refused, for its own requirement", async () => {
    const state = await riding(({ card }) => card("Xiuhcoatl: O Flame, Burn the Gods Themselves").state);
    expect(state.ok, JSON.stringify(state)).toBe(false);
    expect(state.label).toBe("FGT.Ability.Refused.predicate");
  });

  it("on the ground, the board's Unit and the bare snapshot agree: the Spells wait, Xiuhcoatl is ready", async () => {
    const states = await withSubjects([
      { from: "quetzalcoatl", id: "quetz", state: { factionId: "red" }, panel: { i: 6, j: 6 } },
    ], async ({ world, board }) => {
      await world.combat.update({ round: 7 });
      const { abilitiesContext } = await import("../../module/apps/actor-sheet/context.mjs");
      const cards = abilitiesContext(world.actor("quetz"), snapshotUnit(world.actor("quetz"), { panel: { i: 6, j: 6 } }), 3, board);
      const all = [...cards.classSkills, ...cards.skills, ...cards.noblePhantasms];
      return Object.fromEntries(all.map((c) => [c.name, c.state?.ok ?? null]));
    });
    expect(states.Tlahuitequiliztli).toBe(false);
    expect(states["Xiuhcoatl: O Flame, Burn the Gods Themselves"]).toBe(true);
  });
});

describe("the sheet's own context takes the caster from the board", () => {
  const context = readFileSync("module/apps/actor-sheet/context.mjs", "utf8").replaceAll("\r\n", "\n");
  const from = context.indexOf("function abilitiesContext");
  const body = context.slice(from, context.indexOf("\n}\n", from));

  it("`abilitiesContext` builds the unit with `unitFrom` over the board", () => {
    expect(body).toMatch(/unitFrom\(boardNow, actor\)/);
  });

  it("and no longer hands the bare snapshot to a card as `unit`", () => {
    expect(body).not.toMatch(/unit: snapshot\b/);
  });
});
