/**
 * @file The test world is Foundry's real data layer, and it throws on a Silent Drop.
 * @see test/helpers/world.mjs, docs/adr/0006-tests-and-build-run-real-foundry.md, docs/44-testing.md
 *
 * The harness used to imitate Foundry's field classes, and a probe against it
 * confirmed four places the imitation let a write through that Foundry drops.
 * Each test here is one of those shapes, or one of the silent mechanisms
 * measured in `foundryVTT_copy` (`common/data/fields.mjs`), and each asserts the
 * **loud prune**: the write, or the seed, throws — naming the path — instead of
 * landing as something other than what was asked for.
 */

import { describe, it, expect } from "vitest";
import { withWorld, KNOWN_DROPS } from "../helpers/world.mjs";

const servant = (system = {}, items = []) => ({
  id: "probe",
  name: "Probe",
  type: "servant",
  system: { parameters: { str: "B", end: "B", agi: "B", mag: "B", luc: "B" }, mov: 5, ...system },
  items,
});
const master = { id: "m", name: "Master", type: "master", system: {} };

describe("a write the test world used to accept, and Foundry drops", () => {
  it("throws on a write beneath a scalar field (abf8ac2)", async () => {
    await withWorld({ actors: [master] }, async (w) => {
      await expect(w.actor("Master").update({ "system.commandSpells.value": 1 })).rejects.toThrow(/commandSpells/);
    });
  });

  it("throws on an object written to a SchemaField carrying a key it does not declare", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await expect(w.actor("Probe").update({ "system.health": { value: 3, max: 10, overflow: 2 } }))
        .rejects.toThrow(/system\.health\.overflow/);
    });
  });

  it("throws on a seeded key no schema declares", async () => {
    await expect(withWorld({ actors: [servant({ bogusSeed: 5 })] }, async () => {}))
      .rejects.toThrow(/system\.bogusSeed/);
  });

  it("throws on a seeded Item key no schema declares", async () => {
    const items = [{ name: "Riding", type: "ability", system: { notAnAbilityField: true } }];
    await expect(withWorld({ actors: [servant({}, items)] }, async () => {}))
      .rejects.toThrow(/system\.notAnAbilityField/);
  });

  it("throws on an Item update to an undeclared path", async () => {
    const items = [{ id: "riding", name: "Riding", type: "ability", system: {} }];
    await withWorld({ actors: [servant({}, items)] }, async (w) => {
      const item = w.actor("Probe").items.get("riding");
      await expect(item.update({ "system.notAnAbilityField": 1 })).rejects.toThrow(/notAnAbilityField/);
    });
  });

  it("throws on an ActiveEffect created with an undeclared system key", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await expect(w.actor("Probe").createEmbeddedDocuments("ActiveEffect", [
        { name: "burn", type: "fgtEffect", system: { defId: "burn", notAnEffectField: 1 } },
      ])).rejects.toThrow(/notAnEffectField/);
    });
  });

  it("throws on a Token update to an undeclared path", async () => {
    await withWorld({ actors: [servant()], tokens: [{ id: "t1", actorId: "probe", x: 0, y: 0 }] }, async (w) => {
      await expect(w.tokens.get("t1").update({ notATokenField: 1 })).rejects.toThrow(/notATokenField/);
    });
  });

  it("throws on a Combat update to an undeclared system path", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await expect(w.combat.update({ "system.notAMatchField": 1 })).rejects.toThrow(/notAMatchField/);
    });
  });
});

describe("a write Foundry silently changes into something else", () => {
  it("throws when one bad element would void a whole SetField write", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await expect(w.actor("Probe").update({ "system.zonPartnerIds": ["alpha", "beta"] }))
        .rejects.toThrow(/zonPartnerIds/);
    });
  });

  it("throws when a NumberField would clamp the value written", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await expect(w.actor("Probe").update({ "system.mov": -5 })).rejects.toThrow(/system\.mov/);
    });
  });

  it("throws when an integer NumberField would round the value written", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await expect(w.actor("Probe").update({ "system.mov": 6.5 })).rejects.toThrow(/system\.mov/);
    });
  });
});

describe("a write Foundry keeps", () => {
  it("lands, and reads back through the prepare chain", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await w.actor("Probe").update({ "system.mov": 7 });
      expect(w.actor("Probe").system.mov).toBe(7);
    });
  });

  it("reads a SetField back as a Set", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      await w.actor("Probe").update({ "system.zonPartnerIds": ["aaaaaaaaaaaaaaaa"] });
      expect(w.actor("Probe").system.zonPartnerIds).toBeInstanceOf(Set);
    });
  });
});

describe("the known drops", () => {
  it("only shrinks: each is a Silent Drop in production code, owned by an issue", () => {
    // Raise this number only by filing an issue for the new entry. Lower it
    // whenever an entry's issue is fixed.
    expect(KNOWN_DROPS.length).toBeLessThanOrEqual(1);
    for (const d of KNOWN_DROPS) expect(d.issue).toMatch(/^#\d+$/);
  });
});
