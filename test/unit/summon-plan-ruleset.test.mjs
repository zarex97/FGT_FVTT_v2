/**
 * A Servant is rolled on its own ruleset's plan. The wizard rolls before its
 * war exists, and `prepareSummon` used to ask the match or the world setting:
 * a Normal war set up in an Advanced world rolled every Normal Servant on the
 * Advanced plan, Health flat and Agility 1d2 (found live, 2026-10-18).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { withWorld, prepareWorld } from "../helpers/world.mjs";

beforeAll(prepareWorld, 60_000);

/** A one-Servant Actor pack, shaped as `servantFromPacks` reads it. */
function normalPack(saber) {
  return {
    collection: "fgt.servants-normal",
    metadata: { type: "Actor" },
    getIndex: async () => Object.assign([{ _id: saber.id, system: { contentId: "normal-saber" } }], { get: () => null }),
    getDocument: async () => saber,
  };
}

describe("prepareSummon", () => {
  it("rolls a Normal Servant on the Normal plan in an Advanced world", async () => {
    await withWorld({
      settings: { ruleset: "advanced" },
      actors: [{ id: "saber", name: "Saber", type: "servant",
        system: { contentId: "normal-saber", classContainer: "saber", baseHealth: 1250 } }],
    }, async (w) => {
      // The real Actor document, as a compendium hands it over: in its pack.
      const doc = w.actor("saber").doc;
      const source = { id: "saber", name: doc.name, pack: "fgt.servants-normal", system: doc.system,
        items: [], toObject: () => doc.toObject() };
      game.packs = [normalPack(source)];
      const { prepareSummon } = await import("../../module/engine/summon.mjs");
      const prepared = await prepareSummon({ contentId: "normal-saber" });
      const formula = (id) => prepared.plan.lines.find((l) => l.id === id).roll?.formula ?? null;
      // The Normal plan's dice, not the Advanced plan's flat Health and 1d2.
      expect(formula("maxHealth")).toBe("10d20");
      expect(formula("maxAgility")).toBe("1d10");
      expect(formula("maxLuck")).toBe("1d20");
    });
  });
});
