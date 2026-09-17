/**
 * @file `io.setMode`, and the clock it has to restart.
 * @see module/engine/io.mjs, module/rules/modes.mjs, Ch. 46 §46.4
 *
 * `rules/modes.mjs#canToggleMode` has read the two-way lockout correctly since
 * it was written, and `test/unit/modes.test.mjs` proves it refuses either
 * direction inside the window. The defect was never in the gate — it was that
 * **nothing restarted the clock the gate reads**. Both writers stamped
 * `toggledAt` on the way ON only:
 *
 *   ...(active ? { "system.toggledAt": tick } : {})
 *
 * so *"it can only be deactivated 2◈ Turns after it was activated, **and vice
 * versa**"* enforced the first half and not the second. Measured live: Mad
 * Enhancement on since tick 10, switched off at tick 40 — permitted, thirty
 * Turns elapsed — with `toggledAt` still reading 10, and `canToggleMode` then
 * answering `{ok: true}` to switching it straight back on in the same Turn.
 * Past its first 2◈, the mode was a free toggle for the rest of the match.
 *
 * The gate's own unit tests could not catch this: they hand `canToggleMode` a
 * `toggledAt` directly, which is the one thing the writer was getting wrong.
 * This runs the writer.
 */

import { describe, it, expect } from "vitest";
import { withWorld } from "../helpers/world.mjs";
import { canToggleMode } from "../../module/rules/modes.mjs";

const madEnhancement = (over = {}) => ({
  id: "me",
  name: "Mad Enhancement",
  type: "ability",
  system: {
    slug: "madEnhancement", isMode: true, toggleLock: "2◈",
    active: true, toggledAt: 10, ...over,
  },
});

const world = (item = madEnhancement()) => ({
  actors: [{
    id: "asterios", name: "Asterios", type: "servant",
    system: { parameters: { str: "A++", end: "A++", agi: "C", mag: "D", luc: "E" } },
    items: [item],
  }],
  tokens: [{ id: "t1", actorId: "asterios" }],
  combat: { round: 14, system: { globalTurn: 40, turnsPerRound: 3 } },
});

async function io() {
  const { worldIO } = await import("../../module/engine/io.mjs");
  return worldIO();
}

/** The gate, asked exactly as the sheet's toggle asks it. */
const mayToggle = (item, { active, tick = 40 }) =>
  canToggleMode(item, { id: "asterios" }, { active, tick, turnsPerRound: 3, clockRunning: true });

describe("io.setMode stamps the lockout in both directions", () => {
  it("restarts the clock when the mode is switched OFF", async () => {
    await withWorld(world(), async (w) => {
      await (await io()).setMode("asterios", "madEnhancement", false);

      const item = w.actors.get("asterios").items.find((i) => i.id === "me");
      expect(item.system.active).toBe(false);
      // 40, not the 10 it was activated at.
      expect(item.system.toggledAt).toBe(40);
      expect(mayToggle(item, { active: true }))
        .toMatchObject({ ok: false, reason: "toggleLock", detail: { remaining: 6 } });
    });
  });

  it("restarts it when the mode is switched ON", async () => {
    await withWorld(world(madEnhancement({ active: false, toggledAt: 10 })), async (w) => {
      await (await io()).setMode("asterios", "madEnhancement", true);

      const item = w.actors.get("asterios").items.find((i) => i.id === "me");
      expect(item.system.active).toBe(true);
      expect(item.system.toggledAt).toBe(40);
      expect(mayToggle(item, { active: false }))
        .toMatchObject({ ok: false, reason: "toggleLock" });
    });
  });

  it("writes nothing at all when the mode is already in that state", async () => {
    // The early return above the stamp: a no-op must not silently restart a
    // lockout the player is waiting out.
    await withWorld(world(), async (w) => {
      await (await io()).setMode("asterios", "madEnhancement", true);

      const item = w.actors.get("asterios").items.find((i) => i.id === "me");
      expect(item.system.toggledAt).toBe(10);
    });
  });

  it("still refuses to deactivate a mode that says it never deactivates", async () => {
    // `cannotDeactivate` outranks the stamp, and must keep doing so: Heracles's
    // clause is NEVER, and a lockout is HOW LONG YOU WAIT.
    const held = madEnhancement({ cannotDeactivate: true });
    await withWorld(world(held), async (w) => {
      await (await io()).setMode("asterios", "madEnhancement", false);

      const item = w.actors.get("asterios").items.find((i) => i.id === "me");
      expect(item.system.active).toBe(true);
      expect(item.system.toggledAt).toBe(10);
    });
  });
});
