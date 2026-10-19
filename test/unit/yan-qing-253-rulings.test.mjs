/**
 * @file Yan Qing's build (#253): his Clauses and the readings the grill ruled, slice by slice.
 * @see docs/superpowers/specs/2026-10-19-yan-qing-clauses.md, docs/D-servant-data-sheets.md §D.19
 *
 * Built through `test/helpers/subject.mjs`: every figure below is authored content reaching the
 * engine through the real compile and projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { concealmentProfile } from "../../module/rules/concealment.mjs";
import { discoverChance } from "../../module/rules/identity.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { critChance } from "../../module/rules/checks.mjs";
import { rollFaces, entriesFor, choicesIn } from "../../module/rules/roll-table.mjs";
import { canToggleMode } from "../../module/rules/modes.mjs";
import { processOpenIn } from "../../module/engine/combat-process.mjs";
import { disguiseOf, seesTruth } from "../../module/rules/disguise.mjs";

beforeAll(prepareSubjects, 120_000);

const YAN = "yanQingSubject01";
const TICK = 12;

const yan = (fn, { state = {}, effects = [] } = {}) => withSubjects(
  [{ from: "yan-qing", id: YAN, state: { factionId: "red", ...state }, effects }],
  ({ world, unit }) => fn({ world, unit: unit(YAN) }),
  { tick: TICK },
);

/* ========================================================================== */
/*  Slice 1: the statblock, PC C, the alignment options                        */
/* ========================================================================== */

describe("his statblock (SB, SB.attr, SB.class)", () => {
  it("is an Assassin of China, Neutral Evil, with the Attributes his sheet prints", async () => {
    await yan(({ unit }) => {
      expect(unit.region).toEqual(["china"]);
      expect(unit.alignment).toEqual({ order: "neutral", morality: "evil" });
      expect(unit.attributes).toEqual(expect.arrayContaining(["male", "servant", "man", "humanoid", "liangshan"]));
      expect(unit.mov).toBe(7);
      expect(unit.range).toBe(1);
    });
  });

  it("takes BA(STR) 125 from the STR table, not the printed 105 (§46.6), and BA(MAG) 125", async () => {
    await yan(({ unit }) => {
      expect(unit.baseAttack).toMatchObject({ str: 125, mag: 125 });
    });
  });
});

describe("Presence Concealment at Rank C (PC.2.evade, PC.6, PC.cd)", () => {
  const PC = { defId: "presenceConcealment", unremovable: true };

  it("reads 40% discovery, +3 Evade and 1◈ from the tables, as his sheet prints them", async () => {
    await yan(({ unit }) => {
      expect(concealmentProfile(unit)).toEqual({ rank: "C", evade: 3, discover: 40, cooldown: "1◈", granted: false });
      expect(discoverChance(unit)).toBe(40);
    }, { effects: [PC] });
  });
});

describe("the alignment options (YF.lawful, YF.evil, #253 reading 1)", () => {
  const unit = (alignment) => ({ id: "u", kind: "servant", attributes: [], effects: [], alignment });

  it("emits each half of an Alignment on its own, lowercased", () => {
    const options = rollOptionsFor({ attacker: unit({ order: "Lawful", morality: "Good" }) });
    expect(options.has("self:order:lawful")).toBe(true);
    expect(options.has("self:morality:good")).toBe(true);
  });

  it("emits neither for a Unit with no Alignment, so a Master matches neither", () => {
    const options = [...rollOptionsFor({ attacker: unit(null) })];
    expect(options.filter((o) => /:(order|morality):/.test(o))).toEqual([]);
  });

  it("reads the Alignment off the live shape his sheet authors", async () => {
    await yan(({ unit: u }) => {
      const options = rollOptionsFor({ attacker: u });
      expect(options.has("self:order:neutral")).toBe(true);
      expect(options.has("self:morality:evil")).toBe(true);
    });
  });
});

/* ========================================================================== */
/*  Slice 3: Espionage raises PC's Rank while it lasts                         */
/* ========================================================================== */

describe("Espionage: Presence Concealment C raised to A while the buff stands (ES.*, PC.cd, #253 reading 4)", () => {
  const PC = { defId: "presenceConcealment", unremovable: true };
  const ESPIONAGE = { defId: "espionage" };

  it("reads A's 10% and +4 while Espionage stands, PC already Active", async () => {
    await yan(({ unit }) => {
      const profile = concealmentProfile(unit);
      expect(profile.rank).toBe("A");
      expect(profile.discover).toBe(10);
      expect(profile.evade).toBe(4);
      expect(discoverChance(unit)).toBe(10);
    }, { effects: [PC, ESPIONAGE] });
  });

  it("keeps the cooldown his own C's 1◈, not A's 2◈", async () => {
    await yan(({ unit }) => {
      expect(concealmentProfile(unit).cooldown).toBe("1◈");
    }, { effects: [PC, ESPIONAGE] });
  });

  it("reads C again once the buff is gone, PC still Active", async () => {
    await yan(({ unit }) => {
      expect(concealmentProfile(unit)).toMatchObject({ rank: "C", discover: 40, evade: 3 });
    }, { effects: [PC] });
  });
});

/* ========================================================================== */
/*  Slice 4: Skillful Star                                                     */
/* ========================================================================== */

describe("Skillful Star: S.Crit Up for his allies, never himself (SS.*, #253 reading 8)", () => {
  const ALLY = "yanQingAlly00001";
  const FAR = "yanQingAllyFar01";
  const FOE = "yanQingFoe000001";
  const field = (yanEffects) => [
    { from: "yan-qing", id: YAN, panel: { i: 5, j: 5 }, state: { factionId: "A" }, effects: yanEffects },
    { from: "medusa", id: ALLY, panel: { i: 5, j: 7 }, state: { factionId: "A" } },
    { from: "medusa", id: FAR, panel: { i: 5, j: 9 }, state: { factionId: "A" } },
    { from: "medusa", id: FOE, panel: { i: 6, j: 5 }, state: { factionId: "B" } },
  ];
  const pct = (u) => critChance(u).percent;
  const read = (effects) => withSubjects(field(effects), ({ unit }) => ({
    yan: pct(unit(YAN)), ally: pct(unit(ALLY)), far: pct(unit(FAR)), foe: pct(unit(FOE)),
  }), { tokens: true });

  it("gives +15% to an ally within 2, nothing to one at 4, to an enemy, or to himself", async () => {
    const base = await read([]);
    const star = await read([{ defId: "sCritUpOthers", magnitude: 15 }]);
    expect(star.ally - base.ally).toBe(15);
    expect(star.far - base.far).toBe(0);
    expect(star.foe - base.foe).toBe(0);
    expect(star.yan - base.yan, "except himself").toBe(0);
  });

  it("costs him 50% Crit Chance for this Turn", async () => {
    const base = await read([]);
    const paid = await read([{ defId: "critDwn", magnitude: 50 }]);
    expect(base.yan - paid.yan).toBe(Math.min(50, base.yan));
  });
});

/* ========================================================================== */
/*  Slice 5: the dice table's new keys                                         */
/* ========================================================================== */

describe("rollTable's duplicates, all-rows and self rows (NP.dup, NP.four, NP.3, #253 reading 9)", () => {
  /** A roller that hands out these faces in order. */
  const faces = (...seq) => async () => seq.shift();

  it("rerolls a later die until it differs, under `duplicates: reroll`", async () => {
    expect(await rollFaces({ count: 2, faces: 4, duplicates: "reroll" }, faces(1, 1, 1, 3), { faces: 4, count: 2 }))
      .toEqual([1, 3]);
  });

  it("keeps a duplicate by default: Scáthach's apply-twice is unchanged", async () => {
    expect(await rollFaces({ count: 2, faces: 8 }, faces(6, 6), { faces: 8, count: 2 })).toEqual([6, 6]);
  });

  it("refuses a duplicates word it does not know, never falling to a default", async () => {
    await expect(rollFaces({ duplicates: "ignore" }, faces(1), { faces: 4, count: 1 })).rejects.toThrow(/duplicates/);
  });

  const TABLE = {
    1: { effects: [{ id: "defDwnC" }] },
    2: { effects: [{ id: "critDwn" }] },
    3: { target: "self", effects: [{ id: "critDmUp" }] },
    4: { all: true },
  };
  const ids = (picked) => picked.map(({ entry }) => entry.effects[0].id);

  it("applies the rows rolled", () => {
    expect(ids(entriesFor(TABLE, [1, 3]))).toEqual(["defDwnC", "critDmUp"]);
  });

  it("applies all three, once each, when either die is a 4: instead, not as well", () => {
    expect(ids(entriesFor(TABLE, [2, 4]))).toEqual(["defDwnC", "critDwn", "critDmUp"]);
    expect(ids(entriesFor(TABLE, [4, 1]))).toEqual(["defDwnC", "critDwn", "critDmUp"]);
  });

  it("never offers the all-row as a choice of its own", () => {
    expect(choicesIn(TABLE).map((c) => c.roll)).toEqual([1, 2, 3]);
  });
});

/* ========================================================================== */
/*  Slice 6: Doppelganger's switch                                             */
/* ========================================================================== */

describe("a mode switched off at any time, never inside a Combat Process (DP.end.manual, #253 reading 6)", () => {
  const mode = (window) => ({ system: { isMode: true, active: true, deactivation: { window } } });

  it("switches off on another side's Turn, at once", () => {
    expect(canToggleMode(mode("anyTime"), {}, { active: false, ownTurn: false })).toEqual({ ok: true });
  });

  it("refuses inside a Combat Process", () => {
    expect(canToggleMode(mode("anyTime"), {}, { active: false, ownTurn: true, inCombatProcess: true }))
      .toEqual({ ok: false, reason: "inCombatProcess" });
  });

  it("still switches on only on his own Turn", () => {
    const off = { system: { isMode: true, active: false, deactivation: { window: "anyTime" } } };
    expect(canToggleMode(off, {}, { active: true, ownTurn: false }).reason).toBe("notOwnTurn");
  });

  it("knows an open Combat Process from the chat", () => {
    const msg = (state) => ({ getFlag: (scope, key) => (key === "process" ? JSON.stringify({ state, history: [] }) : null) });
    expect(processOpenIn([msg("done")])).toBe(false);
    expect(processOpenIn([msg("done"), msg("react")])).toBe(true);
  });
});

describe("the Disguise's readers (DP.look, #253 readings 11-12)", () => {
  const worn = { effectInstances: [{ defId: "disguise", params: { as: "x", name: "Saber", img: "a.webp", disposition: 1 } }] };

  it("reads the look off the instance", () => {
    expect(disguiseOf(worn)).toEqual({ as: "x", name: "Saber", img: "a.webp", disposition: 1 });
    expect(disguiseOf({ effectInstances: [] })).toBeNull();
  });

  it("lets only his owner and the GM see through it", () => {
    expect(seesTruth({ isGM: true })).toBe(true);
    expect(seesTruth({ isTrueOwner: true })).toBe(true);
    expect(seesTruth({ isGM: false, isTrueOwner: false })).toBe(false);
  });
});
