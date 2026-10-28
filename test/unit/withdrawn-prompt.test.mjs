/**
 * A question its asker stopped waiting for closes on the player's screen.
 *
 * Found live pressing Sieg (#345): a Prevention Luck Check timed out on the GM,
 * its effect landed, and the window *"Contest with a Luck Check? … (1 left)"*
 * stayed open on Player1's screen a Turn later, two more stacked behind it.
 * `FGTSocket.ask` now withdraws the question when it times out, and Player1's
 * client closes every window it opened (`apps/prompt.mjs#withdrawPrompt`).
 */

import { describe, expect, it } from "vitest";
import { withSubjects } from "../helpers/subject.mjs";

const SIEG = "sieg";

describe("a question that times out is withdrawn (#345, found live)", () => {
  it("closes Player1's Luck Check window, which a held answer left open", async () => {
    await withSubjects([{ from: "sieg", id: SIEG, owner: "p1" }], async ({ world: w }) => {
      // Player1 is still reading: the window stays open until it is closed.
      w.answer({ title: "FGT.Prompt.luckCheck", kind: "confirm", by: "p1", hold: true });
      const { FGTSocket } = await import("../../module/net/socket.mjs");
      const asked = FGTSocket.ask("p1", { kind: "luckCheck", check: "prevention", unitId: SIEG, defId: "bleed" },
        { timeout: 20 });
      await expect(asked).rejects.toThrow(/did not answer within 20ms/);
      await w.settle();
      expect(w.held.map((h) => [h.title, h.by])).toEqual([["FGT.Prompt.luckCheck", "p1"]]);
      // Closed by the withdrawal, not by anything the player did.
      expect(w.held[0].app.rendered).toBe(false);
      expect(w.events.filter((e) => e.kind === "withdraw").map((e) => e.targetUserId)).toEqual(["p1"]);
    });
  });

  it("an answered question is not withdrawn", async () => {
    await withSubjects([{ from: "sieg", id: SIEG, owner: "p1" }], async ({ world: w }) => {
      w.answer({ title: "FGT.Prompt.luckCheck", kind: "confirm", by: "p1", value: true });
      const { FGTSocket } = await import("../../module/net/socket.mjs");
      const answer = await FGTSocket.ask("p1", { kind: "luckCheck", check: "prevention", unitId: SIEG, defId: "bleed" },
        { timeout: 5000 });
      expect(answer).toEqual({ accepted: true });
      expect(w.events.filter((e) => e.kind === "withdraw")).toEqual([]);
    });
  });

  it("a withdrawal that arrives before the window draws closes it as it opens", async () => {
    const { renderPrompt, withdrawPrompt } = await import("../../module/apps/prompt.mjs");
    const closed = [];
    await withdrawPrompt("early");
    // A renderer of a kind that opens one window, standing in for a dialog
    // still being imported when the withdrawal came.
    const spec = { kind: "choose", title: "t", count: 1, options: [{ id: "a", name: "A" }] };
    const { ChoiceDialog } = await import("../../module/apps/choice-dialog.mjs");
    const pick = ChoiceDialog.pick;
    ChoiceDialog.pick = (_spec, opened) => new Promise((resolve) => {
      opened?.({ close: async () => { closed.push("closed"); resolve(null); } });
    });
    try {
      expect(await renderPrompt(spec, { askId: "early" })).toBe(null);
    } finally {
      ChoiceDialog.pick = pick;
    }
    expect(closed).toEqual(["closed"]);
  });
});
