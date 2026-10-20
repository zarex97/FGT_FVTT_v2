/**
 * @file Soaked raises Freeze's chance against Ice only (Anastasia's Ice Bucket Challenge).
 * @see packs/_source/effects/soaked.yml, module/rules/elements.mjs#ApplicationChance, docs/15-effect-application.md
 *
 * > (a) When this Unit receives Ice damage, it has a 25% chance of being
 * > inflicted with Freeze; this is additive to any Freeze chance the Attack
 * > might have.
 *
 * Two halves (#258 reading 4): an Attack that carries Freeze meets an incoming
 * `ApplicationChance` of -25, so one roll at its chance plus 25; one that carries
 * none rolls 25 by itself (`soaked.yml`'s `damageTaken` handler, pressed in the
 * arena). Landed here through the door with the Attack Description's element and
 * what it inflicts, the die scripted at 99 so the chance line is the whole answer.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const A = "anastasiaCaster0", H = "heraclesDefender";

/** The chance line for a 50% Freeze on a Soaked Heracles, under an attack of `element`. */
const freezeLine = (element, inflicts = ["freeze"]) => withSubjects([
  { from: "anastasia-summer", id: A, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
  { from: "heracles", id: H, state: { factionId: "B" }, panel: { i: 5, j: 6 }, effects: [{ defId: "soaked" }] },
], async ({ world: w, unit }) => {
  const { landEffect } = await import("../../module/engine/landing.mjs");
  const { entryOf } = await import("../../module/rules/effect-flow.mjs");
  const out = await landEffect(entryOf({ id: "freeze", chance: 50 }), {
    target: unit(H), source: { unitId: A, abilityId: null }, caster: w.actor(A),
    attack: { kind: "normal", element, inflicts }, rolled: 99,
  });
  return out.trace.find((t) => t.step === "chance").detail;
});

describe("Soaked's Freeze clause", () => {
  // Anastasia's own Fae Contract adds 5 to whatever she inflicts, in both.
  it("adds 25 to Freeze's chance under an Ice attack", async () => {
    expect(await freezeLine("ice")).toBe("rolled 99 vs 80%");
  });

  it("adds nothing to an Ice attack that carries no Freeze: that one rolls 25 by itself", async () => {
    expect(await freezeLine("ice", [])).toBe("rolled 99 vs 55%");
  });

  it("adds nothing under any other attack", async () => {
    expect(await freezeLine("fire")).toBe("rolled 99 vs 55%");
    expect(await freezeLine(null)).toBe("rolled 99 vs 55%");
  });
});
