/**
 * @file The test world fires Foundry's document hooks, and binds the engine's own listeners.
 * @see test/helpers/world.mjs, module/engine/listeners.mjs, docs/44-testing.md
 *
 * Behaviour wired to a document hook ran only on a live board: the test world's
 * `Hooks.on` did nothing, so a listener was never bound and a write was never
 * heard. Five Surprises lived there. The world now runs Foundry's own `Hooks`,
 * fires the hooks Foundry's client backend fires on each write, and binds the
 * list `fgt.mjs` binds at `ready`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withWorld, prepareWorld } from "../helpers/world.mjs";
import { ENGINE_LISTENERS } from "../../module/engine/listeners.mjs";

beforeAll(prepareWorld, 60_000);

const servant = { id: "heracles", name: "Heracles", type: "servant" };

describe("hooks fire as Foundry fires them", () => {
  it("in registration order, with the diff and the document's id", async () => {
    await withWorld({ actors: [servant] }, async (w) => {
      const heard = [];
      Hooks.on("updateActor", (_a, changes) => heard.push(["first", changes]));
      Hooks.on("updateActor", () => heard.push(["second"]));
      await w.actor("heracles").update({ "system.facing": "w" });
      expect(heard).toEqual([
        ["first", { system: { facing: "w" }, _stats: { modifiedTime: expect.any(Number) }, _id: "heracles" }],
        ["second"],
      ]);
    });
  });

  it("not at all for a write that changed nothing", async () => {
    await withWorld({ actors: [servant] }, async (w) => {
      const heard = [];
      Hooks.on("updateActor", () => heard.push(1));
      await w.actor("heracles").update({ "system.facing": w.actor("heracles").system.facing });
      expect(heard).toEqual([]);
    });
  });

  it("not for a write Foundry refused", async () => {
    await withWorld({ actors: [servant] }, async (w) => {
      const heard = [];
      Hooks.on("updateActor", () => heard.push(1));
      await expect(w.actor("heracles").update({ "system.notAField": 1 })).rejects.toThrow(/Silent Drop/);
      expect(heard).toEqual([]);
    });
  });

  it("`call` stops at a listener's false", async () => {
    await withWorld({}, async () => {
      const heard = [];
      Hooks.on("preThing", () => false);
      Hooks.on("preThing", () => heard.push(1));
      expect(Hooks.call("preThing")).toBe(false);
      expect(heard).toEqual([]);
    });
  });

  it("an embedded create and delete reach their listeners after the parent is re-prepared", async () => {
    await withWorld({ actors: [servant] }, async (w) => {
      const heard = [];
      Hooks.on("createActiveEffect", (e) => heard.push(["create", e.parent.id, e.documentName]));
      Hooks.on("deleteActiveEffect", (e) => heard.push(["delete", e.parent.id]));
      const [effect] = await w.actor("heracles").createEmbeddedDocuments("ActiveEffect", [{ name: "Poison", type: "fgtEffect", system: { defId: "poison" } }]);
      await effect.delete();
      expect(heard).toEqual([["create", "heracles", "ActiveEffect"], ["delete", "heracles"]]);
    });
  });
});

describe("a token write that moves it is a movement", () => {
  const placed = { actors: [servant], tokens: [{ id: "t1", actorId: "heracles", x: 0, y: 0 }] };

  it("fires preMoveToken, updateToken, then moveToken with the path passed", async () => {
    await withWorld({ ...placed, skipListeners: ["movement"] }, async (w) => {
      const heard = [];
      Hooks.on("preMoveToken", () => { heard.push("pre"); });
      Hooks.on("updateToken", () => { heard.push("update"); });
      Hooks.on("moveToken", (_t, movement) => { heard.push(["move", movement.passed.spaces]); });
      await w.tokens.get("t1").update({ x: 200, y: 100 });
      expect(heard).toEqual(["pre", "update", ["move", 2]]);
    });
  });

  it("a false from preMoveToken keeps the token where it was", async () => {
    await withWorld({ ...placed, skipListeners: ["movement"] }, async (w) => {
      Hooks.on("preMoveToken", () => false);
      await w.tokens.get("t1").update({ x: 200 });
      expect(w.tokens.get("t1").x).toBe(0);
    });
  });
});

describe("listener work is waited for, and its failures are loud", () => {
  it("settle() waits for work a listener started", async () => {
    await withWorld({ actors: [servant] }, async (w) => {
      Hooks.on("updateActor", async (actor, changes) => {
        if (changes.system?.facing !== "w") return;
        await new Promise((r) => { setTimeout(r, 5); });
        await actor.update({ "system.facing": "e" });
      });
      await w.actor("heracles").update({ "system.facing": "w" });
      await w.settle();
      expect(w.actor("heracles").system.facing).toBe("e");
    });
  });

  it("a listener that rejects fails the test", async () => {
    await expect(withWorld({ actors: [servant] }, async (w) => {
      Hooks.on("updateActor", async () => { throw new Error("boom"); });
      await w.actor("heracles").update({ "system.facing": "w" });
    })).rejects.toThrow(/A listener rejected: Error: boom/);
  });
});

describe("the engine's listeners are bound in every world", () => {
  it("in the order the game binds them", async () => {
    await withWorld({}, async (w) => {
      expect(w.listeners).toEqual(ENGINE_LISTENERS.map((l) => l.id));
    });
  });
});
