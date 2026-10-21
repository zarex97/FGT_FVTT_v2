/**
 * @file The action bar re-renders when any input a slot verdict reads changes (#261).
 * @see module/apps/hud/action-bar.mjs#BAR_REFRESH_HOOKS, docs/34-action-bar.md
 *
 * A slot's verdict reads other Units: the Master's place decides ZON, another
 * Unit's place decides Range. The bar listened to no Unit's token, so a Master
 * walking back into range left Heracles's Nine Lives refused until his token
 * was reselected. Seen live three times (2026-10-12, -14, -20).
 *
 * Held to behaviour in the test world: a real `Hooks`, a real token write, and
 * the bar's own debounced refresh.
 */

import { describe, it, expect, beforeAll } from "vitest";

import { withWorld, prepareWorld } from "../helpers/world.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";

beforeAll(prepareWorld, 60_000);

const placed = {
  actors: [
    { id: "heracles", name: "Heracles", type: "servant" },
    { id: "master", name: "Master", type: "master" },
  ],
  tokens: [
    { id: "tHeracles", actorId: "heracles", x: 0, y: 0 },
    { id: "tMaster", actorId: "master", x: 500, y: 0 },
  ],
};

/** Past the bar's 60ms debounce. */
const pastDebounce = () => new Promise((resolve) => setTimeout(resolve, 120));

/**
 * Attach the bar in this world, armed so its refresh renders without a canvas
 * selection, and count its renders.
 */
async function armedBar() {
  installClientNamespace();
  const { ActionBar } = await import("../../module/apps/hud/action-bar.mjs");
  ActionBar.instance = null;
  const bar = ActionBar.attach();
  bar.counter = { messageId: "m1", requiredTargetId: "heracles" };
  const renders = { count: 0 };
  bar.render = () => { renders.count += 1; return bar; };
  return { ActionBar, renders };
}

describe("the bar hears another Unit's change (#261)", () => {
  it("re-renders when another Unit's token moves: the Master walking back into ZON", async () => {
    await withWorld({ ...placed, skipListeners: ["movement"] }, async (w) => {
      const { ActionBar, renders } = await armedBar();
      await w.tokens.get("tMaster").update({ x: 100, y: 0 });
      await pastDebounce();
      expect(renders.count).toBe(1);
      ActionBar.instance = null;
    });
  });

  it("re-renders when a token leaves the board: a summon dismissed", async () => {
    await withWorld({ ...placed, skipListeners: ["movement"] }, async (w) => {
      const { ActionBar, renders } = await armedBar();
      await w.tokens.get("tMaster").delete();
      await pastDebounce();
      expect(renders.count).toBe(1);
      ActionBar.instance = null;
    });
  });

  it("names every input it hears, its own Unit's documents still among them", async () => {
    await withWorld({}, async () => {
      installClientNamespace();
      const { BAR_REFRESH_HOOKS } = await import("../../module/apps/hud/action-bar.mjs");
      expect(BAR_REFRESH_HOOKS).toEqual(expect.arrayContaining([
        "controlToken", "updateActor", "updateToken", "createToken", "deleteToken",
        "updateItem", "createItem", "deleteItem",
        "createActiveEffect", "updateActiveEffect", "deleteActiveEffect",
        "updateCombat", "fgtBudgetChanged", "fgtFieldChanged",
      ]));
    });
  });
});
