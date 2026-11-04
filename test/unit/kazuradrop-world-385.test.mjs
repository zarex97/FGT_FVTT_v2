/**
 * @file Kazuradrop's gates, asked in a real world (#385), each found pressing her.
 *
 * Gilgamesh's Master could not pay Enuma Elish, the prompt offered it anyway, and the
 * press emptied Bug Space, then threw with no line. Pressing the Form while in it took
 * 7 Tokens and every stolen Skill for nothing, under a tooltip reading "Needs undefined".
 */

import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { prepareSubjects, withSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 120_000);

const GI = "gilgameshInside0", KZ = "kazuradropHolder", MA = "masterOfGilgames";
const WAR = {
  tokens: true,
  combat: { round: 6, started: true, system: { globalTurn: 18, difficulty: "intermediate", npGateRound: 1 }, actingFactionId: "A" },
};

const inside = (masterHealth, check) => withSubjects([
  { from: "gilgamesh", id: GI, state: { factionId: "A", masterId: MA, heldIn: KZ, heldSince: 15 } },
  { from: "kazuradrop", id: KZ, panel: { i: 5, j: 5 }, state: { factionId: "B" } },
  {
    from: { type: "master", id: MA, name: "Master of Gilgamesh" },
    id: MA,
    panel: { i: 9, j: 9 },
    state: { factionId: "A", health: { value: masterHealth, max: 131 } },
  },
], async ({ world: w }) => {
  const item = w.actor(GI).items.find((i) => i.system.contentId === "gilgamesh-enuma-elish");
  return check(w, item);
}, WAR);

describe("using an ability from inside Bug Space", () => {
  it("is refused by the gate while the Master cannot pay, for its own reason", async () => {
    await inside(5, async (w, item) => {
      const { pressGate } = await import("../../module/engine/press-gate.mjs");
      const gate = pressGate(w.actor(GI), item, { asAttack: true, billsBudget: true });
      expect(gate.ok).toBe(false);
      expect(gate.usage.reason).toBe("masterHealth");
    });
  });

  it("keeps everyone inside and says why when the press is refused", async () => {
    await inside(5, async (w, item) => {
      const { useFromInside } = await import("../../module/engine/bug-space.mjs");
      const before = game.messages.size;
      await useFromInside(w.actor(GI), item);
      expect(w.actor(GI).system.heldIn).toBe(KZ);
      const line = [...game.messages].slice(before).map((m) => m.content).join(" ");
      expect(line).toContain("FGT.BugSpace.FromInsideRefused");
    });
  });

  it("passes the gate from inside once the Master can pay, so the refusal is the price's", async () => {
    await inside(131, async (w, item) => {
      const { pressGate } = await import("../../module/engine/press-gate.mjs");
      expect(pressGate(w.actor(GI), item, { asAttack: true, billsBudget: true }).ok).toBe(true);
    });
  });
});

describe("Atomicros Form's own press", () => {
  const form = (active, tokens, check) => withSubjects([
    {
      from: "kazuradrop", id: KZ, panel: { i: 5, j: 5 },
      state: { factionId: "A", resources: { eaterTokens: { value: tokens, max: 7 }, kinDefeated: { value: 0, max: 99 }, atomicrosDue: { value: 0, max: 1 } } },
    },
  ], async ({ world: w }) => {
    const item = w.actor(KZ).items.find((i) => i.system.contentId === "kazuradrop-atomicros-form");
    await item.update({ "system.active": active });
    const { pressGate } = await import("../../module/engine/press-gate.mjs");
    return check(pressGate(w.actor(KZ), item, {}));
  }, WAR);

  it("cannot be pressed again in Form, whatever Tokens she holds", async () => {
    await form(true, 7, (gate) => {
      expect(gate.ok).toBe(false);
      expect(gate.usage.reason).toBe("modeInactive");
    });
  });

  it("is still door 1 out of Form with 7 Tokens, and names the pool below them", async () => {
    await form(false, 7, (gate) => expect(gate.ok).toBe(true));
    await form(false, 6, (gate) => {
      expect(gate.usage.reason).toBe("resourceAtLeast");
      expect(gate.usage.detail).toMatchObject({ amount: 7, held: 6 });
    });
  });
});

describe("the sheet's refusal lines", () => {
  const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
  const template = readFileSync("templates/actor/ability-card.hbs", "utf8");
  const calls = [...template.matchAll(/\{\{localize state\.label([\s\S]*?)\}\}/g)].map((m) => m[1]);

  it("passes every placeholder a refusal prints, on the tooltip and on the line", () => {
    const placeholders = new Set(Object.entries(lang)
      .filter(([key]) => key.startsWith("FGT.Ability.Refused.") || ["FGT.Ability.NegatedBy", "FGT.Ability.FromRound", "FGT.Ability.CoolingNamed"].includes(key))
      .flatMap(([, text]) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])));
    expect(placeholders.size).toBeGreaterThan(10);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      for (const name of placeholders) expect(call, name).toContain(`${name}=state.detail.${name}`);
    }
  });
});
