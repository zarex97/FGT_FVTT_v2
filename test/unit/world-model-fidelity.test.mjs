/**
 * @file What the world model gets right because it runs on Foundry's own fields.
 * @see test/helpers/world.mjs, test/helpers/foundry-common.mjs
 * @see docs/adr/0006-the-world-model-borrows-foundry-and-stays-harsher.md
 *
 * The model used to hand-write its `DataField` classes and said so in its own
 * header: *"validation is coercion only."* Those classes are gone, replaced by
 * the real ones from Foundry's `common/` layer. This file is the guard on that
 * swap, because the swap is invisible from the tests that motivated it — all 45
 * of them passed before and after, which is exactly the proof it was faithful
 * and exactly why nothing else would notice it being undone.
 *
 * Every assertion here is a behaviour a hand-written fake got wrong or could
 * not have.
 */

import { describe, it, expect } from "vitest";
import { withWorld } from "../helpers/world.mjs";

const servant = (system = {}) => ({
  id: "semiramis",
  name: "Semiramis",
  type: "servant",
  system: { parameters: { str: "C", end: "C", agi: "C", mag: "A", luc: "B" }, mov: 5, ...system },
});

describe("storage and runtime are different shapes", () => {
  it("stores a SetField as an array and reads it back as a Set", async () => {
    // Foundry keeps `_source` JSON-serializable and builds the runtime value in
    // `initialize`. The old fake collapsed the two by coercing to a `Set` inside
    // `clean`, which got the storage side wrong in order to get the runtime side
    // right — and left the model unable to represent the distinction at all.
    await withWorld({ actors: [servant()] }, async (w) => {
      const a = w.actor("Semiramis");
      await a.update({ "system.zonPartnerIds": ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"] });

      expect(Array.isArray(a._source.system.zonPartnerIds)).toBe(true);
      expect(a.system.zonPartnerIds).toBeInstanceOf(Set);
      expect(a.system.zonPartnerIds.size).toBe(2);
    });
  });

  it("gives a Set to the sheet reader that asks for `.size`", async () => {
    // `apps/actor-sheet/context.mjs:292` gates a Servant's class line on
    // `system.servantClasses?.size`. An Array does not answer that, so a model
    // that handed one back would report the line missing when it is present.
    await withWorld({ actors: [servant()] }, async (w) => {
      const a = w.actor("Semiramis");
      await a.update({ "system.servantClasses": ["assassin", "caster"] });
      expect(a.system.servantClasses?.size).toBe(2);
    });
  });

  it("initializes a SetField nested inside a SchemaField", async () => {
    // `linkedGroup.memberIds` is one level down, and three engine files spread it.
    await withWorld({ actors: [servant()] }, async (w) => {
      const a = w.actor("Semiramis");
      await a.update({ "system.linkedGroup.memberIds": ["aaaaaaaaaaaaaaaa"] });
      expect(a.system.linkedGroup.memberIds).toBeInstanceOf(Set);
    });
  });
});

describe("real fields, and where the model stops asking them", () => {
  it("still keeps a SetField element that Foundry would drop — the model CLEANS, it does not VALIDATE", async () => {
    // Pinned because it is the divergence most likely to be assumed away.
    // `tools/check-world.mjs` found it on the model's first run: `zonPartnerIds`
    // is a SetField of DocumentIdField, so a live Foundry drops `"alpha"` and
    // this model keeps it.
    //
    // Borrowing the real field classes did NOT close it, and the reason is worth
    // stating rather than rediscovering. Foundry splits the write path in two:
    // `clean()` casts, and `validate()` rejects. Element-dropping lives in the
    // second, and this model's `applyPatch` runs only the first. So the real
    // `DocumentIdField` is present and is being asked the wrong question.
    //
    // Closing it means running real validation on every write, which is a
    // separate change with its own blast radius across 5,000 tests. Until then
    // this is measured, not assumed.
    await withWorld({ actors: [servant()] }, async (w) => {
      const a = w.actor("Semiramis");
      await a.update({ "system.zonPartnerIds": ["alpha", "beta"] });
      expect(a.system.zonPartnerIds.size).toBe(2);
    });
  });

  it("clamps a NumberField to its declared minimum", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      const a = w.actor("Semiramis");
      await a.update({ "system.mov": -5 });
      expect(a.system.mov).toBe(0);
    });
  });
});

describe("the model stays harsher than Foundry in exactly one place", () => {
  it("throws on a write no schema declares, where Foundry discards it silently", async () => {
    // ADR 0006 calls this the model's most valuable property and the first thing
    // a future contributor would plausibly "fix". It is how `io.defeat` was
    // caught writing `system.defeated` to a schema that never declared it,
    // leaving every defeated Unit a legal target still taking its Turn.
    //
    // Adopting real documents brings Foundry's silence with them, so the throw is
    // re-applied on top. This test is what stops the swap from taking it away.
    await withWorld({ actors: [servant()] }, async (w) => {
      await expect(
        w.actor("Semiramis").update({ "system.__conformanceProbe": 42 }),
      ).rejects.toThrow(/no schema declares/);
    });
  });
});
