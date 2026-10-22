/**
 * @file A standing Effect's one reader: polarity, magnitude, time, admission (#315).
 * @see module/rules/effect-instance.mjs
 *
 * Closes #303 (a debuff on enemies and a buff on allies), #296 (a magnitude that
 * falls while it stands), #305 (a duration that pauses) and #304 (one instance on
 * the whole board). The shapes are the sheets': Romulus Quirinus, Prelati,
 * Merlin, Tomoe (Summer), Santa Suzuka, Nezha and Summer Passionlip. None is
 * built yet, so the definitions here are fixtures in their authored shape, loaded
 * into the real registry and landed through the real door.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { admit, advance, landedPolarity, magnitudeOf, polarityOf } from "../../module/rules/effect-instance.mjs";
import { EffectRegistry } from "../../module/rules/registry.mjs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(async () => { await prepareSubjects(); }, 120_000);

describe("landedPolarity and polarityOf", () => {
  const roma = { id: "romaStack", polarity: "debuff", polarityByRelation: { ally: "buff", enemy: "debuff" } };

  it("reads the bearer's side: Romulus's Roma Stacks", () => {
    expect(landedPolarity(roma, { relation: "enemy" })).toBe("debuff");
    expect(landedPolarity(roma, { relation: "ally" })).toBe("buff");
    expect(landedPolarity(roma, { relation: "self" })).toBe("buff");
    expect(landedPolarity(roma, { relation: null })).toBe("debuff");
  });

  it("takes the entry's own first: Prelati's Blessing of Folly", () => {
    expect(landedPolarity({ polarity: "debuff" }, { relation: "ally", entryPolarity: "buff" })).toBe("buff");
    expect(landedPolarity({ polarity: "debuff" }, { entryPolarity: "nonsense" })).toBe("debuff");
  });

  it("reads what an instance landed with, and its definition's when it stored none", () => {
    expect(polarityOf({ polarity: "buff" }, { polarity: "debuff" })).toBe("buff");
    expect(polarityOf({ system: { polarity: "buff" } }, { polarity: "debuff" })).toBe("buff");
    expect(polarityOf({ polarity: null }, { polarity: "debuff" })).toBe("debuff");
  });
});

describe("magnitudeOf", () => {
  it("steps by the ◈ Turn and holds the last: Tomoe's Crit DmUp (Nightowl)", () => {
    const def = { decay: { on: "turn", steps: [100, 75, 50] } };
    const at = (tick) => magnitudeOf({ magnitude: 100, appliedTick: 6 }, def, { tick, turnsPerRound: 3 });
    expect([6, 8, 9, 11, 12, 20].map(at)).toEqual([100, 100, 75, 75, 50, 50]);
  });

  it("falls by the count and never below 0: Merlin's Crit DmUp (Illusion)", () => {
    const def = { decay: { on: "damageDealt", when: ["attack:crit"], by: 5 } };
    expect(magnitudeOf({ magnitude: 30, decayCount: 2 }, def)).toBe(20);
    expect(magnitudeOf({ magnitude: 10, decayCount: 3 }, def)).toBe(0);
  });

  it("is the landed magnitude without decay, or the definition's default", () => {
    expect(magnitudeOf({ magnitude: 40 }, {})).toBe(40);
    expect(magnitudeOf({ magnitude: 0 }, { defaultMagnitude: 10 })).toBe(10);
  });
});

describe("advance", () => {
  const seiya = { pausedWhile: ["war:phase:night"] };

  it("pauses while its condition holds: Santa Suzuka's Seiya in a Night Round", () => {
    expect(advance({ expiry: 9 }, seiya, { options: new Set(["war:phase:night"]) })).toEqual({ extend: 1 });
    expect(advance({ expiry: 9 }, seiya, { options: new Set(["war:phase:day"]) })).toEqual({});
  });

  it("pauses inside an area that pauses every duration: Bug Space", () => {
    expect(advance({ expiry: 9 }, {}, { paused: true })).toEqual({ extend: 1 });
  });

  it("has nothing to pause without an expiry", () => {
    expect(advance({ expiry: null }, seiya, { options: new Set(["war:phase:night"]), paused: true })).toEqual({});
  });
});

describe("admit", () => {
  const defs = { prince: { id: "prince", boardUnique: "royal" }, princess: { id: "princess", boardUnique: "royal" }, other: { id: "other" } };
  const board = { units: [
    { id: "a", effectInstances: [{ id: "i1", defId: "prince" }, { id: "i2", defId: "other" }] },
    { id: "b", effectInstances: [{ id: "i3", defId: "princess" }] },
  ] };

  it("removes every other member of the group on the board: Passionlip's Prince or Princess", () => {
    expect(admit(defs.princess, { target: { id: "c" }, board, defOf: (id) => defs[id] }))
      .toEqual([{ unitId: "a", instanceId: "i1", defId: "prince" }, { unitId: "b", instanceId: "i3", defId: "princess" }]);
  });

  it("leaves the same definition on the same target to its own stacking", () => {
    expect(admit(defs.princess, { target: { id: "b" }, board, defOf: (id) => defs[id] }))
      .toEqual([{ unitId: "a", instanceId: "i1", defId: "prince" }]);
  });

  it("admits anything without a group", () => {
    expect(admit(defs.other, { target: { id: "c" }, board, defOf: (id) => defs[id] })).toEqual([]);
  });
});

/* ── Through the real door ─────────────────────────────────────────────── */

const FIXTURES = [
  { id: "romaStack", name: "Roma", polarity: "debuff", polarityByRelation: { ally: "buff", enemy: "debuff" }, stacking: "noneRefresh" },
  { id: "follyBerserk", name: "Berserk (Folly)", polarity: "debuff", stacking: "noneRefresh" },
  { id: "illusionCritDmUp", name: "Crit DmUp (Illusion)", polarity: "buff", stacking: "noneRefresh",
    decay: { on: "damageDealt", when: ["attack:crit"], by: 5 } },
  { id: "seiyaBuff", name: "Seiya", polarity: "buff", stacking: "noneRefresh", pausedWhile: ["war:phase:night"] },
  { id: "princeBuff", name: "Prince", polarity: "buff", stacking: "noneRefresh", boardUnique: "passionlipRoyal" },
  { id: "princessBuff", name: "Princess", polarity: "buff", stacking: "noneRefresh", boardUnique: "passionlipRoyal" },
];

/** Add the fixtures to the registry the test world loaded. */
function withFixtures() {
  const loaded = EffectRegistry.all().map((d) => ({ name: d.name, img: d.img, system: { ...d, contentId: d.id } }));
  EffectRegistry.load([...loaded, ...FIXTURES.map((f) => ({ name: f.name, system: { rules: [], ...f, contentId: f.id } }))]);
}

const S = "scathachCaster00", A = "heraclesAlly0000", E = "heraclesEnemy000", F = "heraclesFoe00000";
const three = [
  { from: "scathach", id: S, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
  { from: "heracles", id: A, state: { factionId: "A" }, panel: { i: 5, j: 6 } },
  { from: "heracles", id: E, state: { factionId: "B" }, panel: { i: 5, j: 8 } },
];
const at = (round, phase = "day") => ({ tokens: true, combat: { round, started: true, system: { globalTurn: round * 3, phase }, actingFactionId: "A" } });

async function land(w, id, targetId, extra = {}) {
  const { landEffect } = await import("../../module/engine/landing.mjs");
  const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
  const { entryOf } = await import("../../module/rules/effect-flow.mjs");
  const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
  const out = await landEffect(entryOf({ id, chance: 100, ...extra }), {
    target: unitOf(w.actor(targetId), currentBoard()), source: { unitId: S, abilityId: null }, caster: w.actor(S),
  });
  await applyWorldIntents(out.intents, "test:land");
  return out;
}
const instanceOf = (w, unitId, defId) => [...w.actor(unitId).effects].find((e) => e.system.defId === defId) ?? null;

describe("polarity decided on landing (#303)", () => {
  it("lands Roma as a debuff on an enemy and a buff on an ally, and stores it", async () => {
    await withSubjects(three, async ({ world: w }) => {
      withFixtures();
      await land(w, "romaStack", E);
      await land(w, "romaStack", A);
      expect(instanceOf(w, E, "romaStack").system.polarity).toBe("debuff");
      expect(instanceOf(w, A, "romaStack").system.polarity).toBe("buff");
    }, at(3));
  });

  it("reaches an ally under Debuff Immune, since on the ally it is a buff", async () => {
    await withSubjects([
      three[0],
      { ...three[1], effects: [{ defId: "debuffImmune", expiry: null }] },
      three[2],
    ], async ({ world: w }) => {
      withFixtures();
      expect((await land(w, "romaStack", A)).outcome).toBe("applied");
      expect((await land(w, "follyBerserk", A)).outcome).not.toBe("applied");
    }, at(3));
  });

  it("lands an entry's own polarity: Prelati's Berserk (Folly) treated as a buff", async () => {
    await withSubjects(three, async ({ world: w }) => {
      withFixtures();
      await land(w, "follyBerserk", A, { polarity: "buff" });
      expect(instanceOf(w, A, "follyBerserk").system.polarity).toBe("buff");
    }, at(3));
  });

  it("files the ally's Roma under buffs on the sheet", async () => {
    await withSubjects(three, async ({ world: w }) => {
      withFixtures();
      await land(w, "romaStack", A);
      const { groupEffects } = await import("../../module/apps/actor-sheet/present.mjs");
      const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
      const ally = unitOf(w.actor(A), currentBoard());
      const grouped = groupEffects(ally.effectInstances, (id) => EffectRegistry.get(id), ally);
      expect(grouped.buffs.map((r) => r.defId)).toContain("romaStack");
      expect(grouped.debuffs.map((r) => r.defId)).not.toContain("romaStack");
    }, at(3));
  });
});

describe("a magnitude that falls per event (#296)", () => {
  it("loses 5 per successful Crit, says so, and ends at 0", async () => {
    await withSubjects(three, async ({ world: w }) => {
      withFixtures();
      await land(w, "illusionCritDmUp", S, { magnitude: 10 });
      const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
      const { fireEvent } = await import("../../module/engine/scheduler.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const crit = async (options) => {
        const me = unitOf(w.actor(S), currentBoard());
        const intents = fireEvent("damageDealt", [me], { tick: 9, turnsPerRound: 3, board: currentBoard(), options });
        return applyWorldIntents(intents, "test:crit");
      };
      const miss = await crit(new Set(["attack:kind:normal"]));
      expect(instanceOf(w, S, "illusionCritDmUp").system.decayCount).toBe(0);
      expect(miss.lines ?? []).toEqual([]);
      const first = await crit(new Set(["attack:kind:normal", "attack:crit"]));
      expect(instanceOf(w, S, "illusionCritDmUp").system.decayCount).toBe(1);
      // The test world prints a line as its key (`FGT.Effect.Decayed`).
      expect(first.lines.map((l) => l.summary.name)).toContain("FGT.Effect.Decayed");
      const second = await crit(new Set(["attack:kind:normal", "attack:crit"]));
      expect(second.lines.map((l) => l.summary.name)).toContain("FGT.Effect.DecayedOut");
      expect(instanceOf(w, S, "illusionCritDmUp")).toBeNull();
    }, at(3));
  });
});

describe("a duration that pauses (#305)", () => {
  it("does not count down in a Night Round, and does in a Day Round", async () => {
    const { advanceEffects } = await import("../../module/engine/scheduler.mjs");
    const run = (phase, round) => withSubjects(three, async ({ world: w }) => {
      withFixtures();
      await land(w, "seiyaBuff", A, { duration: "1◈" });
      const { currentBoard, unitOf } = await import("../../module/engine/board.mjs");
      const ally = unitOf(w.actor(A), currentBoard());
      return advanceEffects([ally], { tick: round * 3, turnsPerRound: 3 }).intents.filter((i) => i.t === "extendEffect");
    }, at(round, phase));
    // Opening Day: Round 2 is Night, Round 3 Day.
    expect(await run("day", 2)).toHaveLength(1);
    expect(await run("day", 3)).toHaveLength(0);
  });
});

describe("one instance on the board (#304)", () => {
  it("takes the Prince off one Unit when the Princess lands on another, and says so", async () => {
    await withSubjects([...three, { from: "heracles", id: F, state: { factionId: "B" }, panel: { i: 6, j: 8 } }], async ({ world: w }) => {
      withFixtures();
      await land(w, "princeBuff", E);
      expect(instanceOf(w, E, "princeBuff")).not.toBeNull();
      const out = await land(w, "princessBuff", F);
      expect(instanceOf(w, E, "princeBuff")).toBeNull();
      expect(instanceOf(w, F, "princessBuff")).not.toBeNull();
      expect(out.chance).toMatch(/FGT.Effect.BoardUniqueReplaced/);
    }, at(3));
  });
});
