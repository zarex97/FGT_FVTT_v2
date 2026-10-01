/**
 * @file An aftermath is a second resolution inside one declaration, not a second use.
 * @see module/engine/attack.mjs, docs/21-combat-process.md, test/unit/caster-phase-ownership.test.mjs, #137
 *
 * `declareAftermath` handed `declareProcesses` the same `ability`, and
 * `declareProcesses` runs the ability's caster phases and raises `abilityUsed`
 * whenever an ability is set. `resolveAttack` had already done both through its
 * own call, so one Xiuhcoatl use ran both twice: her `zone` phase (Burning
 * beside a [Fortress] NP) painted twice, and `abilityUsed` was raised twice.
 * Same shape as §46.4-X, where a `cooldown` phase ran twice on the attack path.
 *
 * The splash also skipped what `resolveAttack` does before it declares
 * anything. The Hanging Gardens' *"If Semiramis is Attacked during this period,
 * the period is interrupted"* was not raised for a Semiramis the splash caught.
 *
 * `declareProcesses` needs a live world, so this reads the engine, in the style
 * of `damage-step-end-board.test.mjs` and `caster-phase-ownership.test.mjs`.
 * The press (Quetzalcoatl on a board beside Ramesseum Tentyris with a
 * channelling Semiramis in the 5x5) is the other half and is recorded in the
 * audit.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const attack = readFileSync("module/engine/attack.mjs", "utf8").replace(/\r\n/g, "\n");

/** The text of one top-level function, from its signature to its closing brace. */
const body = (signature) => {
  const from = attack.indexOf(signature);
  expect(from, `${signature} exists`).toBeGreaterThan(-1);
  return attack.slice(from, attack.indexOf("\n}\n", from));
};

describe("declareProcesses declares a use only when it is told to", () => {
  const declare = body("async function declareProcesses");

  it("takes `declaresUse`, true unless said otherwise", () => {
    expect(declare).toMatch(/declaresUse = true/);
  });

  it("gates the caster phases on it", () => {
    expect(declare).toMatch(/if \(ability && declaresUse\) \{\s*const \{ runCasterPhases \}/);
  });

  it("gates `abilityUsed` on it", () => {
    expect(declare).toMatch(/if \(ability && declaresUse\) \{\s*const \{ fireAbilityUsed \}/);
  });

  it("still runs the fan-out, the cards and the declaration events for every resolution", () => {
    // The splash is a resolution: its defenders get a Combat Process, a card,
    // and `attackDeclared` / `attacked`. Only the USE is not repeated.
    expect(declare).toMatch(/beginFanOut/);
    expect(declare).toMatch(/fireAttackDeclared\(advanced\)/);
    expect(declare).toMatch(/fireAttacked\(advanced\)/);
  });
});

describe("declareAftermath is a second resolution, not a second declaration", () => {
  const aftermath = body("async function declareAftermath");

  it("passes `declaresUse: false`, so the use is declared once", () => {
    expect(aftermath).toMatch(/declaresUse: false/);
  });

  it("interrupts the Gardens for a Unit the splash caught, as the primary path does", () => {
    expect(aftermath).toMatch(/interruptedByDeclaration\(caughtIds, attackerId\)/);
    expect(aftermath).toMatch(/interruptChannels\(/);
  });

  it("interrupts before it declares the splash's defenders", () => {
    expect(aftermath.indexOf("interruptChannels(")).toBeLessThan(aftermath.indexOf("declareProcesses("));
  });

  it("is the only caller that turns the declaration off", () => {
    expect((attack.match(/declaresUse: false/g) ?? []).length).toBe(1);
  });
});

describe("the primary path still declares the use", () => {
  it("resolveAttack's own call does not pass `declaresUse`", () => {
    const resolve = body("export async function resolveAttack");
    expect(resolve).not.toMatch(/declaresUse/);
  });
});
