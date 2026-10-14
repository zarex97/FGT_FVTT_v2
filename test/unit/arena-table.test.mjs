/**
 * @file The test world's table: real dice, chat cards, and questions put to the right person.
 * @see test/helpers/world.mjs, test/helpers/client-api.mjs, docs/44-testing.md
 *
 * The model is only worth trusting where it behaves like Foundry, so each piece
 * it adds is held here to the behaviour the engine leans on: a die's face, a
 * flag written and read back through the real schema, and a question shown to
 * the user it was routed to.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withWorld, prepareWorld } from "../helpers/world.mjs";

beforeAll(prepareWorld, 60_000);

describe("dice", () => {
  it("are Foundry's real Roll, with the faces the test set", async () => {
    await withWorld({}, async (w) => {
      w.dice.set("d6", 6, 3);
      const roll = await new Roll("2d6+3").evaluate();
      expect(roll.total).toBe(12);
      expect(roll.formula).toBe("2d6 + 3");
      expect(roll.dice[0].results.map((r) => r.result)).toEqual([6, 3]);
      expect(w.rolls).toEqual([{ formula: "2d6 + 3", total: 12, faces: [{ faces: 6, result: 6 }, { faces: 6, result: 3 }] }]);
    });
  });

  it("a die nobody set is the same on every run", async () => {
    const roll = () => withWorld({}, async () => (await new Roll("5d10").evaluate()).dice[0].results.map((r) => r.result));
    expect(await roll()).toEqual(await roll());
  });

  it("a set die that is never rolled fails the test", async () => {
    await expect(withWorld({}, async (w) => { w.dice.set("d100", 95); }))
      .rejects.toThrow(/A scripted die was never rolled: d100 = 95/);
  });
});

describe("chat", () => {
  it("a card is a real ChatMessage, and its flags go through the schema", async () => {
    await withWorld({}, async (w) => {
      const message = await ChatMessage.create({ content: "<p>hi</p>", flags: { fgt: { kind: "attack" } } });
      expect(game.messages.get(message.id)).toBe(message);
      await message.setFlag("fgt", "process", JSON.stringify({ state: "react" }));
      expect(JSON.parse(message.getFlag("fgt", "process"))).toEqual({ state: "react" });
      expect(message.getFlag("fgt", "kind")).toBe("attack");
      await message.unsetFlag("fgt", "kind");
      expect(message.getFlag("fgt", "kind")).toBeUndefined();
      expect(w.wrote("flags.fgt.process")).toHaveLength(1);
    });
  });
});

describe("questions", () => {
  const servant = (extra = {}) => ({ id: "serenity", name: "Serenity", type: "servant", ...extra });
  const spec = { title: "FGT.WeakPoint.Title", count: 1, min: 0, options: [{ id: "heel", name: "Heel" }] };

  it("a Unit's question is shown to the player who owns it", async () => {
    await withWorld({ actors: [servant({ owner: "p1" })] }, async (w) => {
      const { chooseFor } = await import("../../module/engine/ask.mjs");
      w.answer({ title: "FGT.WeakPoint.Title", by: "p1", pick: ["heel"] });
      expect(await chooseFor(w.actor("serenity"), spec)).toEqual(["heel"]);
      expect(w.asked).toEqual([{ title: "FGT.WeakPoint.Title", kind: "choose", by: "p1", options: ["heel"] }]);
    });
  });

  it("an unowned Unit's question is shown to the GM", async () => {
    await withWorld({ actors: [servant()] }, async (w) => {
      const { chooseFor } = await import("../../module/engine/ask.mjs");
      w.answer({ title: "FGT.WeakPoint.Title", by: "u1", pick: ["heel"] });
      expect(await chooseFor(w.actor("serenity"), spec)).toEqual(["heel"]);
    });
  });

  it("a question shown to the wrong person fails the test", async () => {
    await expect(withWorld({ actors: [servant({ owner: "p1" })] }, async (w) => {
      const { ChoiceDialog } = await import("../../module/apps/choice-dialog.mjs");
      w.answer({ title: "FGT.WeakPoint.Title", by: "p1", pick: ["heel"] });
      await ChoiceDialog.pick(spec);
    })).rejects.toThrow(/"FGT.WeakPoint.Title" was shown to u1; the script expected p1/);
  });

  it("a question nobody scripted fails the test, and the engine reads it as declined", async () => {
    let answer;
    await expect(withWorld({ actors: [servant()] }, async (w) => {
      const { chooseFor } = await import("../../module/engine/ask.mjs");
      answer = await chooseFor(w.actor("serenity"), spec);
    })).rejects.toThrow(/A question nobody scripted was shown to u1: "FGT.WeakPoint.Title"/);
    expect(answer).toBeNull();
  });

  it("an optional question can be declined", async () => {
    await withWorld({ actors: [servant({ owner: "p1" })] }, async (w) => {
      const { chooseFor } = await import("../../module/engine/ask.mjs");
      w.answer({ title: "FGT.WeakPoint.Title", by: "p1", decline: true });
      expect(await chooseFor(w.actor("serenity"), spec)).toBeNull();
    });
  });

  it("the dialog's own count rule still holds", async () => {
    await expect(withWorld({ actors: [servant()] }, async (w) => {
      const { chooseFor } = await import("../../module/engine/ask.mjs");
      w.answer({ title: "Pick two", pick: ["a"] });
      await chooseFor(w.actor("serenity"), { title: "Pick two", count: 2, options: [{ id: "a" }, { id: "b" }] });
    })).rejects.toThrow(/"Pick two" refused the scripted answer \["a"\]/);
  });
});
