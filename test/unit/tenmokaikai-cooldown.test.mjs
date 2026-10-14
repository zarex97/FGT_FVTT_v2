/**
 * @file Tenmōkaikai's cooldown starts when it is switched off (#195).
 * @see module/engine/scheduler-hooks.mjs#onModeEnded, docs/surprises/2026-10-11-mode-deactivation-cooldown-unwritten.md
 *
 * Pressed live: Tenmōkaikai, forced off at tick 16, read `remaining: 0`, though
 * its sheet says "Cooldown: 7◈+⅓◈ Turns after this NP is deactivated" -- 22 at
 * three Turns a Round. Its clock counts from deactivation, and a plain mode had
 * no writer for it. The fix is a listener on `updateItem` (`b9884b9`), and the
 * only test of it read the source for the `Hooks.on` line, because the test
 * world never fired a hook. Now it does, and binds the game's own listeners, so
 * this switches the mode off the way any rule does and watches the cooldown.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import * as I from "../../module/engine/intents.mjs";

beforeAll(prepareSubjects, 120_000);

const RAIKOU = "raikouMinamoto01";

describe("a mode that counts its cooldown from deactivation", () => {
  it("starts it when the mode is switched off", async () => {
    await withSubjects([{ from: "raikou", id: RAIKOU, state: { factionId: "A" } }], async ({ world: w }) => {
      const raikou = w.actor(RAIKOU);
      const np = [...raikou.items].find((i) => i.system.slug === "tenmokaikai");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      await applyWorldIntents([I.setMode(RAIKOU, np.id, true, "test")], "test:on");
      await w.settle();
      expect(np.system.cooldown.remaining ?? 0).toBe(0);

      await applyWorldIntents([I.setMode(RAIKOU, np.id, false, "forcedDeactivation")], "test:off");
      await w.settle();
      // 7◈+⅓◈ at three Turns a Round.
      expect(np.system.cooldown.remaining).toBe(22);
    }, { combat: { round: 6, started: true, system: { globalTurn: 16 } } });
  });
});
