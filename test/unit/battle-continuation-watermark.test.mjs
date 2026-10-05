/**
 * @file Battle Continuation's half-Health crossing is recorded (#184).
 * @see module/engine/io.mjs#watchedFractions, module/rules/revival.mjs
 *
 * *"...the Unit's Health must have been restored back to above half its
 * maximum value at least once since the last activation of this effect."*
 * Ruled 2026-10-04 (#184 reading 12): the first revive is free; after it his
 * Health must rise above half again.
 *
 * The gate reads `healthWatermarks["0.5"]`, and the writer stamped it only for
 * fractions it was told to watch -- which it read off `revive.healthRestoredSince`,
 * a key no content writes -- and under it, the key itself: `0.5` has a dot,
 * and Foundry expanded it into `{0: {5: tick}}`. Battle Continuation authors `requiresHealthRestoredSince`
 * on its `RevivalSource`, so nothing was ever stamped and every revive after
 * the first was refused.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { withWorld } from "../helpers/world.mjs";

const BC = parse(readFileSync("packs/_source/class-skills/battle-continuation.yml", "utf8"));

const achilles = (value) => ({
  id: "achilles",
  name: "Achilles",
  type: "servant",
  system: { health: { value, max: 1500 }, parameters: { str: "B+", end: "A", agi: "A+", mag: "C", luc: "D" } },
  items: [{ id: "bc", name: "Battle Continuation", type: "ability", system: { contentId: "class-battle-continuation", passiveRules: BC.passiveRules } }],
});

async function io() {
  const { worldIO } = await import("../../module/engine/io.mjs");
  return worldIO();
}

describe("the half-Health watermark", () => {
  it("the content authors it on the RevivalSource", () => {
    const source = BC.passiveRules.find((r) => r.key === "RevivalSource");
    expect(source.requiresHealthRestoredSince).toBe(0.5);
  });

  it("is stamped when he is restored above half", async () => {
    await withWorld({ actors: [achilles(60)], combat: { round: 3, system: { globalTurn: 8 } } }, async (w) => {
      await (await io()).adjustHealth("achilles", 700);
      expect(w.actor("Achilles").system.healthWatermarks?.["50"]).toBe(8);
    });
  });

  it("is keyed by percent: Foundry expands a dotted key like 0.5", async () => {
    const { watermarkKey } = await import("../../module/domain/health.mjs");
    expect(watermarkKey(0.5)).toBe("50");
    await withWorld({ actors: [achilles(60)], combat: { round: 3, system: { globalTurn: 8 } } }, async (w) => {
      await (await io()).adjustHealth("achilles", 700);
      expect(w.actor("Achilles").system.healthWatermarks).toEqual({ 50: 8 });
    });
  });

  it("not at exactly half: the sheet says above it", async () => {
    await withWorld({ actors: [achilles(50)], combat: { round: 3, system: { globalTurn: 8 } } }, async (w) => {
      await (await io()).adjustHealth("achilles", 700);
      expect(w.actor("Achilles").system.healthWatermarks?.["50"] ?? null).toBe(null);
    });
  });
});
