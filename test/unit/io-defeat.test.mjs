/**
 * @file `io.defeat`, and the guard that would have caught it.
 * @see module/engine/io.mjs, test/helpers/world.mjs, test/unit/actor-fields.test.mjs
 *
 * This is the method the whole schema-drift machine was built for.
 * `test/unit/actor-fields.test.mjs` opens with it:
 *
 *   > `io.defeat` wrote `system.defeated` from the day it was written and no
 *   > actor schema had the field. Every defeat in the game put a skull on the
 *   > token, incremented the Grail counter, freed the contracted Servants, and
 *   > left the Unit unmarked: still a legal target, still taking its turn,
 *   > still alive to anything that asked.
 *
 * That guard is a regex over `io.mjs` **as text**, because there was no way to
 * execute the file. It cannot see a path built by template string, which is
 * most of them. The last test here is the point of the harness: with a world to
 * run against, the same defect is caught at runtime, by any test that defeats
 * anything, without anyone having written a test that looks for it.
 *
 * Scoped to a **Servant** deliberately. `freeContractedServants` returns early
 * unless the Unit is a Master, so this exercises the write that was wrong
 * without dragging in Conquest, `onMasterDefeated` and the Sustainability clock.
 */

import { describe, it, expect } from "vitest";
import { withWorld } from "../helpers/world.mjs";

const servant = (over = {}) => ({
  id: "heracles",
  name: "Heracles",
  type: "servant",
  system: {
    parameters: { str: "A", end: "A", agi: "A", mag: "C", luc: "B" },
    ...(over.system ?? {}),
  },
  items: over.items ?? [],
});

const world = (over = {}) => ({
  actors: [servant(over.actor ?? {})],
  tokens: [{ id: "t1", actorId: "heracles" }],
  combat: { round: 2, system: { globalTurn: 4, grailCounter: 0, grailThreshold: 9 }, ...(over.combat ?? {}) },
  ...over.rest,
});

async function io() {
  const { worldIO } = await import("../../module/engine/io.mjs");
  return worldIO();
}

describe("io.defeat", () => {
  it("marks the Unit defeated, with its cause", async () => {
    await withWorld(world(), async (w) => {
      await (await io()).defeat("heracles", "damage");

      const a = w.actor("Heracles");
      expect(a.system.defeated).toBe(true);
      expect(a.system.defeatCause).toBe("damage");
    });
  });

  it("puts the skull on the token", async () => {
    await withWorld(world(), async (w) => {
      await (await io()).defeat("heracles", "damage");
      expect(w.tokens.get("t1").overlayEffect).toBe("icons/svg/skull.svg");
    });
  });

  it("counts the defeat towards the Grail", async () => {
    await withWorld(world(), async (w) => {
      await (await io()).defeat("heracles", "damage");
      expect(w.combat.system.grailCounter).toBe(1);
    });
  });

  it("materialises the Grail when the threshold is reached, and says so once", async () => {
    await withWorld(world({ combat: { round: 2, system: { globalTurn: 4, grailCounter: 8, grailThreshold: 9 } } }), async (w) => {
      await (await io()).defeat("heracles", "damage");

      expect(w.combat.system.grailCounter).toBe(9);
      expect(w.combat.system.grailMaterialized).toBe(true);
      expect(w.hooks.filter(([name]) => name === "fgtGrailMaterialized")).toHaveLength(1);
    });
  });

  it("does not announce a Grail that had already materialised", async () => {
    // The other half of the guard, and the reason it cannot simply be dropped.
    // It was read AFTER the write that set the flag, so `next.materialized &&
    // !combat.system.grailMaterialized` was `true && false` on every defeat and
    // the hook had never fired at all. Reading it before the write restores the
    // question it was asking: was it already true when we got here?
    await withWorld(world({ combat: { round: 2, system: { globalTurn: 4, grailCounter: 9, grailThreshold: 9, grailMaterialized: true } } }), async (w) => {
      await (await io()).defeat("heracles", "damage");

      expect(w.combat.system.grailCounter).toBe(10);
      expect(w.hooks.filter(([name]) => name === "fgtGrailMaterialized")).toEqual([]);
    });
  });

  it("survives a Unit with no token on the board", async () => {
    await withWorld({ ...world(), tokens: [] }, async (w) => {
      await (await io()).defeat("heracles", "damage");
      expect(w.actor("Heracles").system.defeated).toBe(true);
    });
  });
});

describe("the guard that a text scan cannot be", () => {
  it("refuses a write to a field no schema declares", async () => {
    // Foundry discards it and returns successfully. `docs/07-schemas.md:99`
    // records the live test: *"absent from the re-read, from `_source`, and
    // from `toObject()`"*. A fake that stored it would make every such test
    // pass green on a write the real world throws away, so this model throws
    // instead — less faithful, and the only version worth having.
    await withWorld(world(), async (w) => {
      await expect(w.actor("Heracles").update({ "system.totallyUndeclared": 42 }))
        .rejects.toThrow(/no schema declares/);
    });
  });

  it("names the path, so the failure says what to declare", async () => {
    await withWorld(world(), async (w) => {
      await expect(w.actor("Heracles").update({ "system.notAThing": 1 }))
        .rejects.toThrow(/system\.notAThing/);
    });
  });

  it("allows a declared path, including one reaching into an untyped bag", async () => {
    // `resources` is an ObjectField by design — `system.resources.mana` is
    // legal because `resources` is declared, not because `mana` is.
    await withWorld(world(), async (w) => {
      await w.actor("Heracles").update({ "system.resources.mana": 3 });
      expect(w.actor("Heracles").system.resources.mana).toBe(3);
    });
  });

  it("would have caught the original defect: drop the field, and defeat fails", async () => {
    // The proof. `system.defeated` is declared today; if it were removed, this
    // is what the suite would do about it — and what it did about it for the
    // whole life of the bug is nothing, because nothing executed io.mjs.
    await withWorld(world(), async (w) => {
      const actor = w.actor("Heracles");
      const saved = actor.schema.defeated;
      delete actor.schema.defeated;
      try {
        await expect((await io()).defeat("heracles", "damage")).rejects.toThrow(/system\.defeated/);
      } finally {
        actor.schema.defeated = saved;
      }
    });
  });
});

describe("the world restores what it installed", () => {
  it("leaves no globals behind", async () => {
    const before = ["game", "canvas", "foundry", "Hooks", "ui"].map((k) => globalThis[k]);
    await withWorld(world(), async () => { expect(globalThis.game).toBeDefined(); });
    const after = ["game", "canvas", "foundry", "Hooks", "ui"].map((k) => globalThis[k]);
    expect(after).toEqual(before);
  });

  it("restores them even when the body throws", async () => {
    const before = globalThis.game;
    await expect(withWorld(world(), async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(globalThis.game).toBe(before);
  });
});
