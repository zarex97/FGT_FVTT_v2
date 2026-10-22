/**
 * @file A Mode that ends after a tally of events (#288, #319).
 * @see module/rules/modes.mjs (`tallyHandler`), module/engine/scheduler.mjs (`TallyMode`)
 *
 * Saitou Hajime's Chikai no Haori: *"These effects lasts for 2◈ Turns, or after
 * Saitou has performed a total of seven successful Attacks while Chikai no Haori
 * is Active ... it will still be forcefully ended after he performs a successful
 * seventh Attack for the duration of that activation."* Shinpachi's ends after
 * five Crits. Each activation counts from 0.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { loadSource } from "../../tools/lib/load.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { countOf } from "../../module/rules/count.mjs";

beforeAll(prepareSubjects, 120_000);

const S = "tallyHolder00001";
const mode = (id, endsAfter) => ({
  id, slug: id, name: id, kind: "skill", isMode: true, timing: { window: "ownTurn" },
  activeRules: [{ key: "FlatDamage", value: 10 }], endsAfter,
});
const SAITOU = mode("test-tally", { event: "attackLanded", count: 3 });
const SHINPACHI = mode("test-tally-crit", { event: "attackLanded", when: ["attack:crit"], count: 2 });

async function scene(fn) {
  const { files } = await loadSource("packs/_source");
  const jeanne = files.find((f) => f.doc?.id === "test-jeanne-d-arc").doc;
  return withSubjects([{
    from: "test-jeanne-d-arc", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 },
    with: { abilities: [...(jeanne.abilities ?? []), SAITOU, SHINPACHI] },
  }], async ({ world: w }) => {
    const { worldIO } = await import("../../module/engine/io.mjs");
    const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
    const { fireEvent } = await import("../../module/engine/scheduler.mjs");
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    const item = (contentId) => w.actor(S).items.find((i) => i.system?.contentId === contentId);
    const toggle = (contentId, on) => worldIO().setMode(S, item(contentId).id, on);
    const landed = async (options) => {
      const me = unitOf(w.actor(S), currentBoard());
      const intents = fireEvent("attackLanded", [me], { tick: 7, turnsPerRound: 3, board: currentBoard(), options });
      return applyWorldIntents(intents, "test:landed", { lines: true });
    };
    return fn({ w, item, toggle, landed });
  }, { tokens: true, combat: { round: 3, started: true, system: { globalTurn: 7 }, actingFactionId: "A" } });
}

const HIT = new Set(["attack:kind:normal"]);
const CRIT = new Set(["attack:kind:normal", "attack:crit"]);
const names = (out) => (out.lines ?? []).map((l) => l.summary.name);

describe("a Mode's tally", () => {
  it("survives the DataModel, and starts at 0 on activation", async () => {
    await scene(async ({ item, toggle }) => {
      expect(item("test-tally").system.endsAfter).toEqual({ event: "attackLanded", count: 3 });
      await toggle("test-tally", true);
      expect(item("test-tally").system.tally).toBe(0);
    });
  });

  it("counts each event, says so, and ends the Mode at its count with a line", async () => {
    await scene(async ({ item, toggle, landed }) => {
      await toggle("test-tally", true);
      const first = await landed(HIT);
      expect(item("test-tally").system.tally).toBe(1);
      expect(names(first)).toContain("FGT.Mode.Tally");
      await landed(HIT);
      expect(item("test-tally").system.tally).toBe(2);
      const third = await landed(HIT);
      expect(item("test-tally").system.active).toBe(false);
      expect(item("test-tally").system.endedBy).toBe("tally");
      expect(names(third)).toContain("FGT.Mode.TallyEnded");
    });
  });

  it("hears only the events its `when` names: a hit without a Crit is not counted", async () => {
    await scene(async ({ item, toggle, landed }) => {
      await toggle("test-tally-crit", true);
      await landed(HIT);
      expect(item("test-tally-crit").system.tally).toBe(0);
      await landed(CRIT);
      expect(item("test-tally-crit").system.tally).toBe(1);
      await landed(CRIT);
      expect(item("test-tally-crit").system.active).toBe(false);
    });
  });

  it("hears nothing while the Mode is off", async () => {
    await scene(async ({ item, landed }) => {
      await landed(HIT);
      expect(item("test-tally").system.tally).toBe(0);
    });
  });

  it("starts again from 0 on the next activation", async () => {
    await scene(async ({ item, toggle, landed }) => {
      await toggle("test-tally", true);
      await landed(HIT);
      await landed(HIT);
      await toggle("test-tally", false);
      await toggle("test-tally", true);
      expect(item("test-tally").system.tally).toBe(0);
    });
  });

  it("is a Count of kind tally", () => {
    expect(countOf({ of: "tally" }, { ability: { tally: 4 } })).toBe(4);
  });
});

describe("the build refuses an endsAfter it cannot run", () => {
  it("with no event, or a count that is not a positive whole number", async () => {
    const { validateAll } = await import("../../tools/lib/content.mjs");
    const errors = (endsAfter) => validateAll([{ path: "m.yml", dir: "abilities", doc: {
      schema: 1, id: "m", name: "M", kind: "skill", isMode: true, timing: { window: "ownTurn" }, endsAfter,
    } }]).problems;
    expect(errors({ event: "attackLanded", count: 7 })).toEqual([]);
    expect(errors({ count: 7 }).join()).toContain("endsAfter has no event");
    expect(errors({ event: "attackLanded", count: 0 }).join()).toContain("endsAfter.count");
    expect(errors({ event: "attackLanded", count: 2.5 }).join()).toContain("endsAfter.count");
  });
});

describe("the bar shows it", () => {
  it("as tally/count on an active Mode", async () => {
    const { slotFor } = await import("../../module/apps/hud/present.mjs");
    const s = slotFor({ id: "m", name: "Chikai no Haori", active: true, isMode: true, tally: 4, endsAfter: { count: 7 } },
      { verdict: { ok: true } });
    expect(s.tally).toEqual({ tally: 4, count: 7 });
    const off = slotFor({ id: "m", name: "Chikai no Haori", active: false, isMode: true, tally: 0, endsAfter: { count: 7 } },
      { verdict: { ok: true } });
    expect(off.tally).toBeNull();
  });
});
