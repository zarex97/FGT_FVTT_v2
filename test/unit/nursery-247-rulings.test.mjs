/**
 * @file Nursery Rhyme's audit (#247): the readings the grill ruled against the build, and what
 * reading the code found.
 * @see docs/superpowers/specs/2026-10-17-nursery-rhyme-clauses.md, docs/46-roster-re-audit.md §46.39
 *
 * Built through `test/helpers/subject.mjs`: every figure below is authored content reaching the
 * engine through the real compile and projection.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { endRound } from "../../module/engine/scheduler.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { acquisitionTarget, itemPickupIntents } from "../../module/rules/items.mjs";
import { deserialize } from "../../module/engine/combat-process.mjs";

beforeAll(prepareSubjects, 120_000);

const SOURCE = "packs/_source";
const sourceOf = (dir, id) => readFileSync(`${SOURCE}/${dir}/${id}.yml`, "utf8");

/* ========================================================================== */

describe("her statblock (#247 D5)", () => {
  it("carries the Region her sheet prints, England, and nothing it does not", async () => {
    const region = await withSubjects([{ from: "nursery-rhyme", id: "nurseryRegion001" }],
      ({ unit }) => unit("nurseryRegion001").region);
    expect(region).toEqual(["england"]);
  });
});

describe("A Tale for Somebody's Sake hits every Unit in its 3x3 but her (#247 reading 1)", () => {
  it("is authored as the Normal NPs that say the same words are", async () => {
    const targeting = await withSubjects([{ from: "nursery-rhyme", id: "nurseryTale00001" }], ({ world }) =>
      world.actor("nurseryTale00001").items.find((i) => i.system.contentId === "nursery-a-tale-for-somebodys-sake").system.targeting);
    expect(targeting.selection.relations).toEqual(expect.arrayContaining(["enemy", "ally", "neutral"]));
    expect(targeting.selection.includeSelf).toBe(false);
    expect(targeting.isDamagingAoE).toBe(true);
  });
});

describe("the Jabberwock guards her and her Master (#247 D2)", () => {
  it("carries the Trump Soldier's guard, word for word", () => {
    expect(sourceOf("summons", "jabberwock")).toMatch(/key: TargetabilityModifier\s+radius: 1\s+relations: \[ally, self\]\s+recipientRoles: \[summoner, summonerMaster\]/);
  });
});

/* ========================================================================== */
/*  The Vorpal Blade                                                          */
/* ========================================================================== */

describe("the Vorpal Blade in Medea's hand (#247 readings 12, 14; D4)", () => {
  // Medea: a Caster whose own Normal Attacks use MAG, so the Blade's STR shows.
  const holder = async (fn) => {
    const { loadSource } = await import("../../tools/lib/load.mjs");
    const { files } = await loadSource(SOURCE);
    const medea = files.find((f) => f.doc?.id === "medea").doc;
    return withSubjects([
      { from: "medea", id: "medeaBlade000001", with: { abilities: [...medea.abilities, { ref: "vorpal-blade" }] } },
      { from: "medea", id: "medeaBare0000001" },
    ], fn);
  };

  it("raises her BA(STR) itself by 50, and leaves BA(MAG) alone", async () => {
    await holder(({ unit }) => {
      const armed = unit("medeaBlade000001");
      const bare = unit("medeaBare0000001");
      expect(armed.baseAttack.str).toBe(bare.baseAttack.str + 50);
      expect(armed.baseAttack.mag).toBe(bare.baseAttack.mag);
    });
  });

  it("gives the +50 back for a Noble Phantasm, which the boost does not reach", async () => {
    await holder(({ unit }) => {
      expect(unit("medeaBlade000001").npBaseAttackOffset).toEqual({ str: -50 });
      expect(unit("medeaBare0000001").npBaseAttackOffset).toBeUndefined();
    });
  });

  it("makes her Normal Attacks use BA(STR), where her own use MAG", async () => {
    await holder(({ unit }) => {
      expect(unit("medeaBare0000001").normalAttack.component).toBe("mag");
      expect(unit("medeaBlade000001").normalAttack.component).toBe("str");
    });
  });

  it("works once held: picking it up equips it", () => {
    expect(sourceOf("abilities", "vorpal-blade")).toMatch(/^worksWhenHeld: true$/m);
  });

  it("is refused to a summon walking onto it, and handed to a Servant or a Master", () => {
    const item = { barredFrom: { ofUnit: "nursery-rhyme", roles: ["self", "master"], onlyKinds: ["servant", "master"] } };
    const board = { units: [] };
    // Its own reason, not the bar against her: the line a player reads says
    // which (#247, live: both refusals said nothing at all).
    expect(acquisitionTarget({ id: "s", kind: "summon" }, board, item)).toMatchObject({ ok: false, reason: "notItsKind" });
    expect(acquisitionTarget({ id: "v", kind: "servant" }, board, item)).toMatchObject({ ok: true, unitId: "v" });
    expect(acquisitionTarget({ id: "m", kind: "master" }, board, item)).toMatchObject({ ok: true, unitId: "m" });
  });
});

describe("the pipeline's stage 1 and an NP's own Base Attack (#247 reading 12)", () => {
  it("draws the Base Attack without the Blade's +50 for an NP, and with it otherwise", async () => {
    const { computeDamage } = await import("../../module/rules/damage/pipeline.mjs");
    const unit = (o = {}) => ({
      baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: [], health: 1000,
      shield: 0, magicResistance: null, outsideZon: false, ...o,
    });
    // BA(STR) 125 with the Blade's +50 in it, and the 50 an NP gives back.
    const total = (kind) => computeDamage({
      attacker: unit({ baseAttack: { str: 125, mag: 0 }, npBaseAttackOffset: { str: -50 } }), defender: unit(), board: {},
      attack: { kind, rank: null, categorizedAsNP: false, element: null },
      base: { sources: [{ unit: "self", component: "str", factor: 1 }] }, multiplier: 1, flatBonus: 0,
      crit: { isCrit: false, chanceUsed: 0 }, reaction: { kind: "none" }, luckChecks: {}, rolls: {}, options: new Set(),
    }).total;
    expect(total("normal")).toBe(125);
    expect(total("np")).toBe(75);
  });
});

/* ========================================================================== */
/*  Enigma                                                                    */
/* ========================================================================== */

describe("Enigma plants Def Dwn (MAG) only when damage was dealt (#247 reading 2)", () => {
  it("asks `attack:dealtDamage`, which a Damage Step that dealt nothing does not hold", () => {
    expect(sourceOf("effects", "enigma")).toMatch(/predicate: \["attack:kind:normal", "attack:component:str", "attack:dealtDamage"\]/);
    const opts = (dealtDamage) => rollOptionsFor({ attacker: { id: "a" }, defender: { id: "d" }, attack: { kind: "normal", dealtDamage } });
    expect(opts(true).has("attack:dealtDamage")).toBe(true);
    expect(opts(false).has("attack:dealtDamage")).toBe(false);
  });
});

/* ========================================================================== */
/*  Effects that prevent Acting                                               */
/* ========================================================================== */

describe("an effect that prevents Acting takes Block, Evade and Counter off the rung (#247 readings 4, 17, 18)", () => {
  const rungsUnder = (defId) => withSubjects(
    [{ from: "medea", id: "medeaRungs000001", effects: defId ? [{ defId }] : [] }],
    ({ unit }) => unit("medeaRungs000001").forbiddenReactions,
  );

  it.each(["stun", "disable", "petrify", "cannotAct"])("%s forbids all three", async (defId) => {
    expect(await rungsUnder(defId)).toEqual(expect.arrayContaining(["evade", "block", "counter"]));
  });

  it("and nothing forbids them without such an effect", async () => {
    expect(await rungsUnder(null)).toEqual([]);
  });

  it("an effect that prevents only some actions leaves them: Silence", async () => {
    expect(await rungsUnder("silence")).toEqual([]);
  });
});

/* ========================================================================== */
/*  The Nameless Forest                                                       */
/* ========================================================================== */

describe("the forest's Token and losses ride the marker's one landing (#247 D3)", () => {
  const NURSERY = "nurseryForest001";
  const FOE = "drakeInForest001";
  /** One Round's end, applied to the world: what the enemy beside her holds after it. */
  const roundEnd = (foeEffects = []) => withSubjects([
    { from: "nursery-rhyme", id: NURSERY, state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    // Her Luck pool, as a war fills it: a subject's is empty until then, and a Max
    // Luck of 0 cannot fall (Wave B).
    { from: "drake", id: FOE, state: { factionId: "B", luck: { value: 15, max: 15 } }, panel: { i: 5, j: 6 }, effects: foeEffects },
  ], async ({ board, world: w }) => {
    const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
    const before = w.actor(FOE).system;
    const was = { hp: before.health.max, luck: before.luck.max, str: before.baseAttackPenalty?.str ?? 0 };
    await applyWorldIntents(endRound(board, { tick: 9, round: 3, turnsPerRound: 3, rolls: {} }), "roundEnd");
    const after = w.actor(FOE);
    return {
      marked: [...after.effects].some((e) => e.system.defId === "namelessForest"),
      tokens: after.system.resources?.namelessForestTokens?.value ?? 0,
      caught: after.system.resources?.namelessForestCaught?.value ?? 0,
      hp: after.system.health.max - was.hp,
      luck: after.system.luck.max - was.luck,
      str: (after.system.baseAttackPenalty?.str ?? 0) - was.str,
    };
  }, { tokens: true, combat: { round: 3, started: true } });

  it("lands the marker, a Token, the count of times caught, and the four losses", async () => {
    expect(await roundEnd()).toEqual({ marked: true, tokens: 1, caught: 1, hp: -25, luck: -1, str: 10 });
  });

  it("lands none of them on a Unit whose escapes have put the chance at 0", async () => {
    expect(await roundEnd([{ defId: "namelessForestResistance", magnitude: 100 }]))
      .toEqual({ marked: false, tokens: 0, caught: 0, hp: 0, luck: 0, str: 0 });
  });
});

describe("a Round's end lands nothing on a body (#247, live)", () => {
  // Live: Heracles was defeated on tick 25, his body stood one Turn as bodies
  // do, and the Round's end rolled the forest on it: "Berserker: Nameless
  // Forest: resisted, rolled 97 vs 90%".
  it("leaves a defeated enemy within 2 out of the forest", async () => {
    await withSubjects([
      { from: "nursery-rhyme", id: "nurseryForest003", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "drake", id: "drakeBody0000001", state: { factionId: "B", defeated: true, health: { value: 0, max: 1000 }, luck: { value: 15, max: 15 } }, panel: { i: 5, j: 6 } },
      { from: "drake", id: "drakeAlive000001", state: { factionId: "B", luck: { value: 15, max: 15 } }, panel: { i: 6, j: 5 } },
    ], ({ board }) => {
      const out = endRound(board, { tick: 9, round: 3, turnsPerRound: 3, rolls: {} });
      const hit = new Set(out.filter((i) => i.t === "applyEffect" && i.effect?.defId === "namelessForest").map((i) => i.unitId));
      expect(board.units.find((u) => u.id === "drakeBody0000001").defeated).toBe(true);
      expect([...hit]).toEqual(["drakeAlive000001"]);
    }, { tokens: true, combat: { round: 3, started: true } });
  });
});

describe("the forest's Base Attack loss reaches a Master and a summon too (#247, live)", () => {
  // Live: Master of Berserker took the Token, the Max Health and the Max Luck,
  // and kept BA 100/100: a Master declared no penalty field, so the write was
  // dropped; a summon stored it and nothing subtracted it.
  it("lowers each one's projected Base Attack by 10, both components", async () => {
    await withSubjects([
      { from: "nursery-rhyme", id: "nurseryForest002", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "master-advanced", id: "masterInForest01", state: { factionId: "B", luck: { value: 15, max: 15 }, baseAttack: { str: 50, mag: 100 } }, panel: { i: 5, j: 6 } },
      { from: "trump-soldier", id: "soldierForest001", state: { factionId: "B", luck: { value: 6, max: 6 } }, panel: { i: 6, j: 5 } },
    ], async ({ board, unit }) => {
      const before = { master: unit("masterInForest01").baseAttack, soldier: unit("soldierForest001").baseAttack };
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      await applyWorldIntents(endRound(board, { tick: 9, round: 3, turnsPerRound: 3, rolls: {} }), "roundEnd");
      const { currentBoard } = await import("../../module/engine/board.mjs");
      const now = (id) => currentBoard().units.find((u) => u.id === id).baseAttack;
      expect(now("masterInForest01")).toEqual({ str: before.master.str - 10, mag: before.master.mag - 10 });
      expect(now("soldierForest001")).toEqual({ str: before.soldier.str - 10, mag: Math.max(0, before.soldier.mag - 10) });
    }, { tokens: true, combat: { round: 3, started: true } });
  });
});

describe("an escape from the forest is said on a card (#247, live)", () => {
  // Live: Heracles escaped, his Tokens went to 0 and the Resistance landed,
  // and no player read a word of it, roll or outcome.
  it("words the roll, each modifier, the target and the outcome", async () => {
    const { escapeLine } = await import("../../module/engine/nameless-forest.mjs");
    const t = (key, data) => `${key}|${JSON.stringify(data)}`;
    const won = escapeLine({ unitId: "h", roll: 7, total: 4, target: 18, success: true,
      modifiers: [{ source: "Home Base", value: -3 }] }, () => "Berserker", t);
    expect(won).toContain("FGT.Forest.Escaped");
    expect(won).toContain("Berserker");
    expect(won).toContain("Home Base −3");
    const lost = escapeLine({ unitId: "h", roll: 19, total: 19, target: 18, success: false, modifiers: [] }, () => "Berserker", t);
    expect(lost).toContain("FGT.Forest.EscapeFailed");
  });

  it("is posted by the log that files it", () => {
    expect(readFileSync("module/engine/io.mjs", "utf8")).toMatch(/kind === "namelessForestEscape"[\s\S]{0,200}postEscape/);
  });

  it("words the death roll too, each of its three outcomes", async () => {
    // Logged, *"a player who watches a 1 come up and survives it has been told
    // something true"*, and read by nothing (#247, live).
    const { deathRollLine } = await import("../../module/engine/nameless-forest.mjs");
    const t = (key, data) => `${key}|${JSON.stringify(data)}`;
    const line = (deleted, reason) => deathRollLine({ unitId: "m", roll: 1, tokens: 3, deleted, reason }, () => "Master", t);
    expect(line(false, "inHomeBase")).toContain("FGT.Forest.DeathRoll.inHomeBase");
    expect(line(false, "survived")).toContain("FGT.Forest.DeathRoll.survived");
    expect(line(true, null)).toContain("FGT.Forest.DeathRoll.deleted");
    expect(readFileSync("module/engine/io.mjs", "utf8")).toMatch(/kind === "namelessForestDeathRoll"[\s\S]{0,200}postDeathRoll/);
  });
});

describe("the escape's ladder is counted once, and on the escape alone (#247, live)", () => {
  // Live: Arturia's escape read "(MAG A −2, namelessForest −2)": the engine's
  // `escapeModifiers` and the marker's own CheckModifier both added the
  // ladder. The marker's modifier is `check: luck`, so it also eased every
  // other Luck Check a caught Unit made.
  it("leaves a caught Unit's other Luck Checks alone", async () => {
    const { checkPlan } = await import("../../module/rules/checks.mjs");
    await withSubjects([{ from: "arturia", id: "arturiaCaught001", state: { factionId: "B" },
      effects: [{ defId: "namelessForest", magnitude: 0, expiry: null, unremovable: true }] }], ({ unit }) => {
      const caught = unit("arturiaCaught001");
      expect(caught.effects).toContain("namelessForest");
      expect(checkPlan(caught, "luck", { options: new Set() }).modifiers.filter((m) => /forest/i.test(m.source ?? ""))).toEqual([]);
    });
  });
});

/* ========================================================================== */
/*  The Queen's Glass Game                                                    */
/* ========================================================================== */

describe("the Glass Game's effect 1 runs on its clock (#247 D1, readings 7, 8)", () => {
  const NURSERY = "nurseryGlass0001";
  const FOE = "drakeInGlass0001";
  const ALLY = "medeaByNursery01";
  const turnEnd = (clock, { foeAt = { i: 5, j: 7 }, event = "turn" } = {}) => withSubjects([
    { from: "nursery-rhyme", id: NURSERY, state: { factionId: "A", glassGameClock: clock }, panel: { i: 5, j: 5 } },
    { from: "medea", id: ALLY, state: { factionId: "A" }, panel: { i: 5, j: 4 } },
    { from: "drake", id: FOE, state: { factionId: "B" }, panel: foeAt },
  ], async ({ board }) => {
    const { endTurn, endRound: roundEnded } = await import("../../module/engine/scheduler.mjs");
    const { recordTurn } = await import("../../module/engine/state-history.mjs");
    const history = recordTurn(board, 0, {}, 3);
    // An ENEMY faction's Turn: 3◈ is nine Turns of the match, not three of hers.
    const ctx = { tick: 9, round: 3, turnsPerRound: 3, activeFactionId: "B", history, rolls: {} };
    return event === "round" ? roundEnded(board, ctx) : endTurn(board, ctx);
  }, { tokens: true, combat: { round: 3, started: true } });

  const clockOf = (intents) => intents.filter((i) => i.unitId === NURSERY && i.t === "statDelta" && i.stat === "glassGameClock")
    .reduce((n, i) => n + i.delta, 0);
  const rewound = (intents) => intents.filter((i) => i.t === "rewind").map((i) => i.unitId).sort();

  it("counts a Turn's end with an enemy within 3, whoever's Turn it was, and rewinds nothing yet", async () => {
    const out = await turnEnd(3);
    expect(clockOf(out)).toBe(1);
    expect(rewound(out)).toEqual([]);
  });

  it("fires at the ninth such Turn end, rewinding every Unit within 3 but her, and starts again", async () => {
    const out = await turnEnd(8);
    expect(rewound(out)).toEqual([ALLY, FOE].sort());
    expect(clockOf(out)).toBe(-8);
  });

  it("does not count a Turn's end with no enemy within 3", async () => {
    const out = await turnEnd(3, { foeAt: { i: 5, j: 12 } });
    expect(clockOf(out)).toBe(0);
    expect(rewound(out)).toEqual([]);
  });

  it("resets at a Round's end with no enemy within 3, and keeps its count with one there", async () => {
    expect(clockOf(await turnEnd(5, { foeAt: { i: 5, j: 12 }, event: "round" }))).toBe(-5);
    expect(clockOf(await turnEnd(5, { event: "round" }))).toBe(0);
  });
});

describe("the Glass Game is handed the match's history (#247, live)", () => {
  // Live: effect 1 fired at tick 31 ("glassGameRewind" logged), and Arturia
  // kept her 900 Health and her Def Dwn: `ctx.history` was never set at a
  // boundary or a defeat, so `stateAt` found nothing and nothing rewound.
  it("is in the Turn's end, the Round's end and the defeat contexts", () => {
    const hooks = readFileSync("module/engine/scheduler-hooks.mjs", "utf8");
    const turnEnd = hooks.slice(hooks.indexOf("const activeFactionId = factionOf(combat, { combatantId: endedCombatantId });"));
    expect(turnEnd.slice(0, turnEnd.indexOf("rolls: await gatherRolls"))).toMatch(/history: historyOf\(combat\)/);
    const roundEnd = hooks.slice(hooks.indexOf("async function endRoundSequence"));
    expect(roundEnd.slice(0, roundEnd.indexOf("rolls: await gatherRolls"))).toMatch(/history: historyOf\(combat\)/);
    const attack = readFileSync("module/engine/attack.mjs", "utf8");
    const defeat = attack.slice(attack.indexOf("const remaining = currentHealth(defender) - damage;"));
    expect(defeat.slice(0, defeat.indexOf("overkill:"))).toMatch(/history: historyOf\(combat\)/);
  });
});

describe("the Glass Game says whom it turned back (#247, live)", () => {
  // Live: "glassGameRewind" was logged and no card said so.
  it("names each Unit rewound and how far, and is posted by the log", async () => {
    const { glassGameLine } = await import("../../module/engine/glass-game.mjs");
    const t = (key, data) => `${key}|${JSON.stringify(data)}`;
    const names = { n: "Caster", a: "Saber", v: "Foreigner" };
    const line = glassGameLine({ unitId: "n", effect: 1, rewound: ["a", "v"], turns: 9 }, (id) => names[id], t);
    expect(line).toContain("FGT.GlassGame.Rewound");
    expect(line).toContain("Saber, Foreigner");
    expect(glassGameLine({ unitId: "n", effect: 1, rewound: [], turns: 9 }, (id) => names[id], t)).toBeNull();
    expect(readFileSync("module/engine/io.mjs", "utf8")).toMatch(/kind === "glassGameRewind"[\s\S]{0,200}postGlassGame/);
  });
});

describe("a recorded state writes back as the sheet stores it (#247, live)", () => {
  // Live: the Glass Game rewound Arturia's Def Dwn and left her Health at 900.
  // The buffer held her Parameters as projected Ranks, which a flag clones to
  // {}: the rewind's update carried "system.parameters": {str: {}, ...}, and
  // Foundry dropped the whole update, Health with it.
  it("records the sheet's own Parameter letters, not the projection's Ranks", async () => {
    const { snapshotUnit } = await import("../../module/rules/history.mjs");
    await withSubjects([{ from: "arturia", id: "arturiaRecord001", state: { factionId: "B" } }], ({ unit, world: w }) => {
      // As recorded, before any serialisation: a flag's write clones it, and
      // a clone of a Rank is {} (JSON alone would have hidden that, by toJSON).
      const recorded = snapshotUnit(unit("arturiaRecord001"), 23);
      expect(Object.values(recorded.parameters).map((v) => typeof v)).toEqual(["string", "string", "string", "string", "string"]);
      expect(recorded.parameters).toEqual(w.actor("arturiaRecord001")._source.system.parameters);
    });
  });

  it("records each pool's maximum as its maximum, not as what is left", async () => {
    // Live: Van Gogh at 299 of 1250 was recorded as {value: 299, max: 299} --
    // the board flattens a pool to its value -- and the Glass Game wrote him
    // back to a Max Health of 299.
    const { snapshotUnit } = await import("../../module/rules/history.mjs");
    await withSubjects([{ from: "van-gogh", id: "vanGoghRecord001",
      state: { factionId: "A", health: { value: 299, max: 1250 }, luck: { value: 3, max: 8 }, agility: { value: 4, max: 16 } } }], ({ unit }) => {
      const recorded = snapshotUnit(unit("vanGoghRecord001"), 24);
      expect(recorded.stats.health).toEqual({ value: 299, max: 1250 });
      expect(recorded.stats.luck).toEqual({ value: 3, max: 8 });
      expect(recorded.stats.agility).toEqual({ value: 4, max: 16 });
    });
  });
});

describe("a defeated Unit rolls no Injury, whatever its Health reads (#247, live)", () => {
  // Live: Excalibur defeated her, the Glass Game's effect 2 wrote her Health
  // back to 350 (*"she stays defeated"*), and the card then read "635 Injury
  // Roll required" and logged an injury of 2 on a dead Unit.
  it("asks whether the defender is defeated, not only what is left", async () => {
    const { injuryCheck } = await import("../../module/rules/injury.mjs");
    expect(injuryCheck({ exceededThreshold: true, damage: 635, healthAfter: 350, defender: { defeated: true }, isNP: true }))
      .toEqual({ roll: false, reason: "defeated" });
  });
});

describe("a rewind keeps what the forest took since then (#247 reading 6)", () => {
  it("leaves Max Health, both Base Attacks and Max Luck where the forest's landings put them", async () => {
    const { rewindIntents } = await import("../../module/engine/state-history.mjs");
    await withSubjects([{ from: "nursery-rhyme", id: "nurseryLoss00001" }], () => {
      const then = {
        stats: { health: { value: 900, max: 1000 }, agility: { value: 10, max: 10 }, luck: { value: 9, max: 10 } },
        baseAttackPenalty: { str: 0, mag: 0 }, effects: [], cooldowns: {}, modes: {},
        resources: { namelessForestCaught: { value: 0, max: 0 } },
      };
      const history = { foe: { entries: [{ globalTurn: 0, full: then }] } };
      // Caught twice since: 50 Max Health, 20 off both Base Attacks, 2 Max Luck.
      const board = { units: [{ id: "foe", resources: { namelessForestCaught: { value: 2, max: 0 } } }] };
      const [rewind] = rewindIntents(board, history, ["foe"], 0).filter((d) => d.kind === "rewind");
      expect(rewind.state.stats.health).toEqual({ value: 900, max: 950 });
      expect(rewind.state.stats.luck).toEqual({ value: 8, max: 8 });
      expect(rewind.state.baseAttackPenalty).toEqual({ str: 20, mag: 20 });
      expect(rewind.state.resources).not.toHaveProperty("namelessForestCaught");
    });
  });

  it("keeps the forest's marker and Resistance as they stand, and drops the rest to then", async () => {
    // Live: Arturia, caught at Round 9's end, was rewound to tick 23 and lost
    // the marker while her Token stayed: a Token nothing reads (no escape, no
    // death die). The forest's state is outside the rewind whole (reading 6).
    const { rewindIntents } = await import("../../module/engine/state-history.mjs");
    const then = {
      stats: { health: { value: 1250, max: 1250 }, agility: { value: 18, max: 18 }, luck: { value: 21, max: 21 } },
      baseAttackPenalty: { str: 0, mag: 0 }, cooldowns: {}, modes: {}, resources: {},
      effects: [{ defId: "atkUp", magnitude: 20, expiry: 30 }],
    };
    const history = { foe: { entries: [{ globalTurn: 0, full: then }] } };
    const marker = { defId: "namelessForest", magnitude: 0, expiry: null, unremovable: true };
    const resist = { defId: "namelessForestResistance", magnitude: 10, expiry: null };
    const board = { units: [{ id: "foe", effectInstances: [marker, resist, { defId: "defDwn", magnitude: 20, expiry: 40 }],
      resources: { namelessForestCaught: { value: 1, max: 0 }, namelessForestTokens: { value: 1, max: 0 } } }] };
    const [rewind] = rewindIntents(board, history, ["foe"], 0).filter((d) => d.kind === "rewind");
    expect(rewind.state.effects.map((e) => e.defId).sort()).toEqual(["atkUp", "namelessForest", "namelessForestResistance"]);
  });
});

/* ========================================================================== */
/*  The Jabberwock                                                            */
/* ========================================================================== */

describe("the Jabberwock knocks a Unit 1 panel straight away from it (#247 reading 10, live)", () => {
  // Live: it moved (9,11) to Heracles at (9,12) and he went UP to (8,12), the
  // nearest free panel of a fan, where the ruling says on along its travel.
  it("pushes along its own travel, as Kingprotea's arrival does", async () => {
    const { clearFootprintPlan } = await import("../../module/rules/movement.mjs");
    await withSubjects([
      { from: "jabberwock", id: "jabberwockPush01", state: { factionId: "A" }, panel: { i: 3, j: 3 } },
      { from: "heracles", id: "heraclesPushed01", state: { factionId: "B" }, panel: { i: 3, j: 4 } },
    ], ({ unit, board }) => {
      const jw = unit("jabberwockPush01");
      expect(jw.knockback?.direction).toBe("arrival");
      const plan = clearFootprintPlan(jw, [{ i: 3, j: 4 }], () => ({ i: 0, j: 1 }), board);
      expect(plan).toEqual([{ unitId: "heraclesPushed01", landing: { panel: { i: 3, j: 5 }, sidestepped: false } }]);
    });
  });
});

describe("a card reads an unlinked summon's own Health (#247, live)", () => {
  // Live: the Jabberwock healed 1000 -> 745 -> 936 off Heracles, and the card
  // said "Health 1500 (no change)": the world actor's, not its token's.
  it("finds the token's actor before the world actor of the same id", async () => {
    const { unitActor } = await import("../../module/engine/board.mjs");
    const world = { id: "jabberwockCard01", system: { health: { value: 1500 } } };
    const token = { id: "jabberwockCard01", system: { health: { value: 936 } } };
    const saved = { game: globalThis.game, canvas: globalThis.canvas };
    globalThis.game = { actors: { get: (id) => (id === world.id ? world : null) } };
    globalThis.canvas = { tokens: { get: () => null, placeables: [{ actor: token }] } };
    try {
      expect(unitActor("jabberwockCard01").system.health.value).toBe(936);
      globalThis.canvas = { tokens: { get: () => null, placeables: [] } };
      expect(unitActor("jabberwockCard01")).toBe(world);
    } finally {
      Object.assign(globalThis, saved);
    }
  });

  it("is what every engine read of a Unit's document goes through", async () => {
    // A dead Jabberwock was offered a Counter and an Injury Roll: the Counter
    // rung read the statblock, alive at 1500 (#247, live). Only the resolver
    // itself, and deleting a summon's world statblock, name the world actor.
    const { readdirSync } = await import("node:fs");
    const files = [...readdirSync("module/engine").map((f) => `module/engine/${f}`), "module/net/operations.mjs"]
      .filter((f) => f.endsWith(".mjs") && f !== "module/engine/board.mjs");
    const raw = files.flatMap((f) => readFileSync(f, "utf8").split(/\r?\n/)
      .filter((l) => /game\.actors\??\.get\(/.test(l) && !/^\s*(\/\/|\*)/.test(l) && !l.includes(".delete("))
      .map((l) => `${f}: ${l.trim()}`));
    expect(raw).toEqual([]);
  });
});

describe("walking onto the Blade is said on a card, taken or refused (#247, live)", () => {
  // Live: a Trump Soldier and her Master stood on it and nothing happened that
  // a player could read; Heracles took it and no card said so either.
  const barredFrom = { ofUnit: "nursery-rhyme", roles: ["self", "master"], onlyKinds: ["servant", "master"] };
  const cache = { id: "cache", name: "[Vorpal Blade]", kind: "structure", panel: { i: 6, j: 0 },
    carriesItemId: "vorpal-blade", carriesItem: { contentId: "vorpal-blade", barredFrom } };
  const nursery = { id: "n", contentId: "nursery-rhyme", kind: "servant", masterId: "m", panel: { i: 9, j: 9 } };

  it("logs who took it, by the cache's name", () => {
    const herc = { id: "h", kind: "servant", panel: { i: 6, j: 0 } };
    expect(itemPickupIntents(herc, { units: [herc, cache, nursery] })).toContainEqual(
      expect.objectContaining({ kind: "log", event: "itemPickedUp", by: "h", itemName: "[Vorpal Blade]" }));
  });

  it("logs a refusal with its reason, and grants nothing", () => {
    const soldier = { id: "s", kind: "summon", panel: { i: 6, j: 0 } };
    const master = { id: "m", kind: "master", servantId: "n", panel: { i: 6, j: 0 } };
    for (const [unit, reason] of [[soldier, "notItsKind"], [master, "barred"]]) {
      const out = itemPickupIntents(unit, { units: [unit, cache, nursery] });
      expect(out.filter((d) => d.kind !== "log")).toEqual([]);
      expect(out).toEqual([expect.objectContaining({ event: "itemRefused", by: unit.id, itemName: "[Vorpal Blade]", reason })]);
    }
  });

  it("words each one for the table", async () => {
    const { itemLine } = await import("../../module/engine/item-report.mjs");
    const t = (key, data) => `${key}|${data.name}|${data.item}`;
    const name = (id) => ({ h: "Berserker", s: "Trump Soldier" })[id];
    expect(itemLine({ event: "itemPickedUp", by: "h", itemName: "[Vorpal Blade]" }, name, t)).toContain("FGT.Item.PickedUp|Berserker|[Vorpal Blade]");
    expect(itemLine({ event: "itemRefused", by: "s", itemName: "[Vorpal Blade]", reason: "notItsKind" }, name, t)).toContain("FGT.Item.Refused.notItsKind|Trump Soldier");
    expect(itemLine({ event: "somethingElse" }, name, t)).toBeNull();
  });
});

describe("the Blade's blow says what it took (#247, live)", () => {
  // Live: Heracles' Blade hit the Jabberwock, the sword left his hands and the
  // lifesteal was suppressed, and the card said neither.
  it("prints the Blade breaking and the lifesteal going, on the attack's card", async () => {
    const { loadSource } = await import("../../tools/lib/load.mjs");
    const { files } = await loadSource(SOURCE);
    const medea = files.find((f) => f.doc?.id === "medea").doc;
    await withSubjects([
      { from: "medea", id: "medeaBreaks00001", with: { abilities: [...medea.abilities, { ref: "vorpal-blade" }] } },
      { from: "jabberwock", id: "jabberwockLoses1", state: { factionId: "B" } },
    ], async ({ world: w }) => {
      const I = await import("../../module/engine/intents.mjs");
      const { applyWorldIntents } = await import("../../module/engine/applier.mjs");
      const blade = w.actor("medeaBreaks00001").items.find((i) => i.system.contentId === "vorpal-blade");
      // The words are the sheet's, keyed by the rule and the Item, when the
      // language file has them: answered from en.json, not the stub's false.
      const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));
      const has = game.i18n.has;
      game.i18n.has = (key) => key in lang;
      let out;
      try {
        out = await applyWorldIntents([
          I.suppressRule("jabberwockLoses1", "jabberwockLifesteal"),
          I.itemQuantity("medeaBreaks00001", "vorpal-blade", -1),
        ], "test", { lines: true });
      } finally {
        game.i18n.has = has;
      }
      const said = out.lines.map((l) => [l.unitId, l.summary.name]);
      expect(said).toContainEqual(["jabberwockLoses1", "FGT.Suppressed.jabberwockLifesteal"]);
      expect(said).toContainEqual(["medeaBreaks00001", "FGT.Item.Gone.vorpal-blade"]);
      expect(blade).toBeTruthy();
    });
  });
});

describe("summoning the Jabberwock again places no second Blade, and says nothing of it (#247, live)", () => {
  // Live: the second summoning's card read "vorpal-blade-cache — couldNotPlace",
  // a failure that was the clause working, in raw keys.
  it("leaves the first-time-only phase off the card", async () => {
    await withSubjects([
      { from: "nursery-rhyme", id: "nurseryAgain0001", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const np = w.actor("nurseryAgain0001").items.find((i) => i.system.contentId === "nursery-jabberwock");
      await np.update({ "system.placedStructures": ["vorpal-blade-cache"] });
      const out = await useSkill({ actorId: "nurseryAgain0001", abilityId: np.id });
      const rows = (out.applied ?? []).map((r) => r.summary ?? r);
      // It was used, and summoned: not refused at the gate, which passed this for nothing.
      expect(out.ok).not.toBe(false);
      expect(rows.some((r) => r.id === "summon" || /summon/i.test(String(r.name)))).toBe(true);
      expect(rows.filter((r) => r.id === "createStructure")).toEqual([]);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
  });
});

describe("a Jabberwock that is killed has disappeared (#247 reading 11)", () => {
  it("starts the 5◈ cooldown and is remembered at full Health, keeping what the Blade took", async () => {
    await withSubjects([
      { from: "nursery-rhyme", id: "nurseryKilled001", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "jabberwock", id: "jabberwockDies01",
        state: { factionId: "A", summonerId: "nurseryKilled001", health: { value: 0, max: 1500 }, suppressedScopes: ["jabberwockLifesteal"] },
        panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      const { worldIO } = await import("../../module/engine/io.mjs");
      await worldIO().defeat("jabberwockDies01", "damage");
      const nursery = w.actor("nurseryKilled001");
      expect(nursery.system.fieldSummonStats.jabberwock).toMatchObject({
        health: { value: 1500, max: 1500 }, suppressedScopes: ["jabberwockLifesteal"],
      });
      const np = nursery.items.find((i) => i.system.contentId === "nursery-jabberwock");
      expect(np.system.cooldown.remaining).toBe(15);
    }, { tokens: true, combat: { round: 3, started: true } });
  });
});

/* ========================================================================== */
/*  One driver per Process (#247, live)                                       */
/* ========================================================================== */

describe("a Process is driven by one run at a time (#247, live)", () => {
  // Live: A Tale for Somebody's Sake hit a Drake it had already defeated a
  // second time, 699 and then 1070. Its run was held at a question with the
  // card still at the rung it was answering, and a re-armed timeout answered
  // that rung again from the stale read.
  it("queues two runs of one message, and lets two messages run side by side", async () => {
    await withSubjects([], async () => {
      const { serialized } = await import("../../module/engine/attack.mjs");
      const order = [];
      const step = (tag, ms) => async () => { order.push(`${tag}+`); await new Promise((r) => setTimeout(r, ms)); order.push(`${tag}-`); };
      await Promise.all([serialized("m1", step("a", 30)), serialized("m1", step("b", 1)), serialized("m2", step("c", 1))]);
      expect(order.indexOf("a-")).toBeLessThan(order.indexOf("b+"));
      expect(order.indexOf("c+")).toBeLessThan(order.indexOf("a-"));
    });
  });

  it("answers nothing for a rung the Process has since left, and the defender is hit once", async () => {
    await withSubjects([
      { from: "nursery-rhyme", id: "nurseryTaleOnce1", owner: "p1", state: { factionId: "A" }, panel: { i: 10, j: 10 } },
      { from: "van-gogh", id: "vanGoghTaleOnce1", owner: "p1", state: { factionId: "A" }, panel: { i: 10, j: 11 } },
      { from: "drake", id: "drakeTaleOnce001", state: { factionId: "B", health: { value: 100, max: 1000 } }, panel: { i: 8, j: 10 } },
    ], async ({ world: w }) => {
      const { resolveAttack, advanceAttack } = await import("../../module/engine/attack.mjs");
      const tale = w.actor("nurseryTaleOnce1").items.find((i) => i.system.contentId === "nursery-a-tale-for-somebodys-sake");
      const declared = await resolveAttack({ attackerId: "nurseryTaleOnce1", abilityId: tale.id, placement: { panel: { i: 9, j: 11 }, unitId: null } });
      const at = (who) => declared.processes.map((p) => p.messageId)
        .find((id) => deserialize(w.messages.get(id).getFlag("fgt", "process")).defenderId === who);
      const drake = at("drakeTaleOnce001");
      const first = advanceAttack({ messageId: drake, event: "nothing" });
      // The timeout, firing while the answer runs, and again once it is over:
      // the late one threw "done:nothing" (live: "Uncaught (in promise)").
      const during = advanceAttack({ messageId: drake, event: "nothing", timedOut: true });
      await advanceAttack({ messageId: at("vanGoghTaleOnce1"), event: "nothing" });
      await first;
      await expect(during).resolves.toMatchObject({ state: "done" });
      await expect(advanceAttack({ messageId: drake, event: "nothing", timedOut: true })).resolves.toMatchObject({ state: "done" });
      const hits = (w.combat?.getFlag?.("fgt", "log") ?? []).filter((e) => e.kind === "damage" && e.defenderId === "drakeTaleOnce001");
      expect(hits).toHaveLength(1);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
  }, 120_000);
});

describe("Alice Eater extends the Jabberwock's stay when used (#247, live)", () => {
  // Live: the card read "1 effect(s) applied" and the stay stayed at 27. The
  // `DurationDelta` sits in an applyEffects phase's `rules`, which the use path
  // read as an effect with no id and landed as nothing.
  it("adds 3◈ to what remains, and buffs it", async () => {
    await withSubjects([
      { from: "nursery-rhyme", id: "nurseryEater0001", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "jabberwock", id: "jabberwockEats01", state: { factionId: "A", summonerId: "nurseryEater0001", expiresAt: 27 }, panel: { i: 5, j: 6 } },
    ], async ({ world: w }) => {
      const { useSkill } = await import("../../module/engine/skill-use.mjs");
      const eater = w.actor("jabberwockEats01").items.find((i) => i.system.slug === "aliceEater");
      const out = await useSkill({ actorId: "jabberwockEats01", abilityId: eater.id });
      expect(out.ok).toBe(true);
      expect(w.actor("jabberwockEats01").system.expiresAt).toBe(36);
      // Said in words: the card read "Atk UpDurationDelta" (live).
      expect(out.applied.map((r) => r.name ?? r.summary?.name)).toContainEqual(expect.stringContaining("FGT.Skill.StayExtended"));
      expect([...w.actor("jabberwockEats01").effects].map((e) => [e.system.defId, e.system.magnitude])).toContainEqual(["atkUp", 50]);
    }, { tokens: true, combat: { round: 6, started: true, system: { globalTurn: 18 }, actingFactionId: "A" } });
  });
});

describe("the Jabberwock leaves when its stay runs out (#247, live)", () => {
  // The board never carried `expiresAt`, so the Round end's dismissal never
  // named it: the monster stayed for good.
  it("is dismissed at the Round's end once its stay has passed, and not before", async () => {
    const dismissed = (expiresAt) => withSubjects([
      { from: "nursery-rhyme", id: "nurseryStays0001", state: { factionId: "A" }, panel: { i: 5, j: 5 } },
      { from: "jabberwock", id: "jabberwockStay01", state: { factionId: "A", summonerId: "nurseryStays0001", expiresAt }, panel: { i: 5, j: 6 } },
    ], ({ board }) => endRound(board, { tick: 27, round: 9, turnsPerRound: 3, rolls: {} })
      .some((i) => i.t === "dismissSummon" && i.unitId === "jabberwockStay01"),
    { combat: { round: 9, started: true } });
    expect(await dismissed(27)).toBe(true);
    expect(await dismissed(36)).toBe(false);
  });
});
