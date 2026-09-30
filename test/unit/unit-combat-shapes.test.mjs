/**
 * @file A Unit's attack and its size survive the DataModel (#99).
 * @see module/data/actor/simple.mjs, module/data/actor/_shared.mjs, module/rules/snapshot.mjs
 *
 * Four Units authored a combat stat their model did not keep:
 *
 * - the Golden Hind and the Quetzalcoatlus, a `normalAttack` on a Platform,
 *   whose model had none -- so the ship that *"replaces Drake's Normal
 *   Attacks"* swung with the default STR;
 * - Kagome: Famine, a `normalAttack.shape` the shared schema had no field for,
 *   so her 3x3 swing hit one Unit;
 * - Bašmu, a `footprint` on a Summon, whose model had none -- a 3x3 token that
 *   was one panel to the rules.
 *
 * Each goes through the real compile, the real model and the real projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

const project = (from, read) => withSubjects([{ from, id: "subjectUnit00001" }], ({ unit }) => read(unit("subjectUnit00001")));

describe("a Platform's Normal Attack", () => {
  it("the Golden Hind attacks with its MAG", async () => {
    expect(await project("platform-golden-hind", (u) => u.normalAttack.component)).toBe("mag");
  });

  // STR is also the default, so this one only says the model did not refuse it.
  it("the Quetzalcoatlus attacks with its STR", async () => {
    expect(await project("quetzalcoatlus", (u) => u.normalAttack.component)).toBe("str");
  });
});

describe("a Normal Attack's shape", () => {
  it("Kagome: Famine swings over a 3x3 square", async () => {
    expect(await project("kagome-famine", (u) => u.normalAttack.shape)).toEqual({ kind: "square", size: 3 });
  });
});

describe("a Summon's size", () => {
  it("Bašmu is 3x3 to the rules, as its token is", async () => {
    expect(await project("basmu", (u) => u.footprint)).toEqual({ w: 3, h: 3 });
  });
});

// #100. The Hanging Gardens *"does not Normal Attack"*: only its two named
// Attacks exist. The file said it as `range.targets: 0`, which the model
// clamps to 1 and nothing reads anyway, so the platform was offered a Normal
// Attack like any other acting Unit. The engine's word for "cannot perform
// Normal Attacks" is the `noNormalAttack` grant -- Pale Rider's Riding EX.
describe("a Unit with no Normal Attack", () => {
  it("the Hanging Gardens is not offered one", async () => {
    const { UNIT_ACTIONS } = await import("../../module/rules/actions.mjs");
    const attack = UNIT_ACTIONS.find((a) => a.id === "attack");
    expect(await project("hanging-gardens-of-babylon", (u) => attack.available(u))).toBeNull();
  });
});
