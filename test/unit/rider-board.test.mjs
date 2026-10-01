/**
 * @file Which Units an attack's riders are applied to.
 * @see module/engine/attack.mjs, module/engine/effect-applier.mjs, docs/15-effect-application.md, #157
 *
 * `applyAbilityEffects` built the defender with `unitSnapshot(defenderDoc)` and
 * the attacker with `unitSnapshot(game.actors.get(state.attackerId))`, and
 * `applyEffect` reads `target.applicationChances` (the resistance and
 * vulnerability sum) and `target.suppressions` (the immunity downgrade). A
 * bounded field's interior, and an aura, write both onto the Units standing in
 * it, but only in `snapshotBoard`'s pass: a snapshot is not a board. It is the
 * shape §46.4-AF fixed at `fireDamageStepEnd` and §46.4-AG at the intent path;
 * this call site was not fixed and was not recorded.
 *
 * Two halves. The first is behavioural and says why it matters: the SAME effect
 * lands differently on the board's Unit and on its bare snapshot, in a field
 * that raises the chance of a debuff. The second reads the engine, because
 * `applyAbilityEffects` needs a live world, in the style of
 * `damage-step-end-board.test.mjs`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";
import { snapshotUnit } from "../../module/rules/snapshot.mjs";

beforeAll(prepareSubjects, 60_000);

/**
 * Pale Rider's Doomsday Come plague, *"chance of being inflicted by debuffs
 * +50%"*, as a field a board can hold: the interior rule is the authored one
 * (`pale-rider-doomsday-come.yml`), without its predicate, which asks which
 * Parameter of the victim is highest and is not what this is about.
 */
const plague = {
  id: "doomsday", ownerId: "owner", ownerFaction: "red",
  geometry: { kind: "fixedArea", shape: { kind: "square", size: 9 }, anchor: { i: 6, j: 6 } },
  membership: { enemyEntry: "free", enemyExit: "sealed", allyEntry: "free", allyExit: "free" },
  isolation: {},
  interior: [{
    key: "ApplicationChance", direction: "incoming", severity: "normal", value: -50, relations: ["enemy"],
    source: "Doomsday Come",
  }],
  vulnerabilities: [],
  state: {},
};

describe("a rider is applied to the board's Unit, not to its bare snapshot", () => {
  const press = (target, def) => applyEffect({
    def, target, chance: 50, source: { unitId: "owner" },
    ctx: { roll: 60, currentTick: 0, turnsPerRound: 3, turnsPerRoundSetting: 3, options: new Set() },
  });

  const both = () => withSubjects(
    [
      { from: "quetzalcoatl", id: "owner", state: { factionId: "red" }, panel: { i: 6, j: 6 } },
      { from: "heracles", id: "victim", state: { factionId: "blue" }, panel: { i: 6, j: 8 } },
    ],
    ({ unit, world }) => {
      const def = EffectRegistry.get("shock");
      // Projected AGAIN, alone: `units` are the very objects `snapshotBoard`
      // then annotated, so they are no longer bare.
      const bare = snapshotUnit(world.actor("victim"), { panel: { i: 6, j: 8 } });
      return { bare: press(bare, def), board: press(unit("victim"), def), field: unit("victim").applicationChances, own: bare.applicationChances };
    },
    { settings: { fields: [plague] } },
  );

  it("the field's contribution exists only on the board's Unit", async () => {
    const { field, own } = await both();
    expect(field.some((c) => c.source === "doomsday")).toBe(true);
    expect(own.some((c) => c.source === "doomsday")).toBe(false);
  });

  it("a 50% rider rolled at 60 is resisted on the bare snapshot, and lands on the board's Unit", async () => {
    const { bare, board } = await both();
    expect(bare.outcome).toBe("resisted");
    expect(board.outcome).toBe("applied");
  });
});

describe("the attack path builds both subjects from the board", () => {
  const attack = readFileSync("module/engine/attack.mjs", "utf8").replaceAll("\r\n", "\n");
  const body = (signature) => {
    const from = attack.indexOf(signature);
    expect(from, `${signature} exists`).toBeGreaterThan(-1);
    return attack.slice(from, attack.indexOf("\n}\n", from));
  };

  it("has the one helper, which asks the board once", () => {
    const helper = body("function riderSubjects");
    expect(helper).toMatch(/boardSnapshot\(\)/);
    expect(helper).toMatch(/unitFrom\(board, attackerDoc\)/);
    expect(helper).toMatch(/unitFrom\(board, defenderDoc\)/);
    expect((helper.match(/boardSnapshot\(\)/g) ?? []).length).toBe(1);
  });

  it("applyAbilityEffects takes its attacker and defender from it", () => {
    const fn = body("async function applyAbilityEffects");
    expect(fn).toMatch(/riderSubjects\(/);
    expect(fn).not.toMatch(/unitSnapshot\(/);
  });

  it("applyDeclaredEffects takes its attacker from the board", () => {
    const fn = body("async function applyDeclaredEffects");
    expect(fn).toMatch(/unitFrom\(boardSnapshot\(\), /);
    expect(fn).not.toMatch(/unitSnapshot\(/);
  });

  it("builds the subjects once per call, not once per rider", () => {
    // `applyAbilityEffects` loops over riders: the subjects are made above the
    // loop. (Its cooldown phase reads the board for its own reason.)
    expect((body("async function applyAbilityEffects").match(/riderSubjects\(/g) ?? []).length).toBe(1);
    expect((body("async function applyDeclaredEffects").match(/boardSnapshot\(\)/g) ?? []).length).toBe(1);
  });
});
