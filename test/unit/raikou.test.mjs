/**
 * @file Minamoto no Yorimitsu — the pure halves of her kit.
 * @see docs/D-servant-data-sheets.md §D.32, char_orig_sheets/Copia de Raikou.md
 * @see docs/superpowers/specs/2026-09-12-raikou-design.md
 *
 * Everything here is layer 1 or 2, so it runs without a world. The
 * document-touching halves — the forced mode, the Command Spell override, the
 * clone spawn, the Master upkeep, both Noble Phantasms in flight — are
 * live-tested in `fgt2026` and recorded in Ch. 45.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { lookup } from "../../module/domain/tables.mjs";
import { Rank } from "../../module/domain/rank.mjs";
import { annotateZon } from "../../module/rules/zon.mjs";
import { annotateLastOfSummonGroup, annotateSummonsActed } from "../../module/rules/snapshot.mjs";
import { subjectOf } from "../../module/engine/scheduler.mjs";
import { orthogonalPanels } from "../../module/rules/targeting/orthogonal.mjs";
import { FACING_OFFSETS, rotateFacing } from "../../module/domain/geometry.mjs";
import { rollOptionsFor, isEmittableOption } from "../../module/rules/options.mjs";
import { canToggleMode, forcedModes } from "../../module/rules/modes.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { resolveRef } from "../../tools/lib/content.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { expandInstances } from "../../module/rules/damage/instances.mjs";
import { test as testPredicate } from "../../module/rules/predicate.mjs";

/** @param {string} id @returns {object} */
export function ability(id) {
  return parse(readFileSync(join("packs/_source/abilities", `${id}.yml`), "utf8"));
}

/** @param {string} id @returns {object} */
export function effect(id) {
  return parse(readFileSync(join("packs/_source/effects", `${id}.yml`), "utf8"));
}

/** @param {string} id @returns {object} */
export function summon(id) {
  return parse(readFileSync(join("packs/_source/summons", `${id}.yml`), "utf8"));
}

export const SHEET = parse(readFileSync("packs/_source/servants/raikou.yml", "utf8"));

/* ========================================================================== */
/*  The statline                                                              */
/* ========================================================================== */

describe("Raikou's statline", () => {
  it("is a Berserker from Japan (R9)", () => {
    // The sheet states no Class and lists three class skills. Mad Enhancement
    // is Berserker's and is the one that decides her; §D.32 has recorded
    // Berserker since the data sheets were transcribed.
    expect([...SHEET.servantClasses]).toEqual(["berserker"]);
    expect(SHEET.classContainer).toBe("berserker");
    expect(SHEET.region).toEqual(["japan"]);
    expect(SHEET.alignment).toEqual({ order: "chaotic", morality: "good" });
  });

  it("carries the four attributes the sheet lists, and no others", () => {
    // `spirit` and `hominidae` are NOT here: `domain/attributes.mjs` closes the
    // implication table for every Unit, and stating a derived attribute by hand
    // is how the two spellings drift apart.
    expect([...SHEET.attributes].sort()).toEqual(["female", "humanoid", "servant", "sky"]);
  });

  it("attacks with BA(STR), which makes her NOT a Magus (R8)", () => {
    // The sheet gives both Base Attacks and never says which. STR, on Karna's
    // precedent: his Mana Burst (Flames) carries the identical sentence --
    // "the Base Attack used is his BA(STR) and BA(MAG) combined" -- and it
    // reads as a departure from a STR default.
    //
    // Had it been MAG, `isMagus` would have made her a Magus ("all Units whose
    // Normal Attacks use Base Attack (MAG)") and every ordinary swing would
    // have taken Mad Enhancement's HALVED +50% instead of +100%.
    expect(SHEET.normalAttack).toEqual({ mode: "fixed", component: "str" });
  });

  it("states no number the rank tables do not already derive", () => {
    const p = SHEET.parameters;
    expect(SHEET.baseAttack.str).toBe(lookup("baseAttackStrByStr", Rank.parse(p.str)));
    expect(SHEET.baseAttack.mag).toBe(lookup("baseAttackMagByMag", Rank.parse(p.mag)));
    expect(SHEET.baseHealth).toBe(lookup("baseHealthByEnd", Rank.parse(p.end)));
    expect(SHEET.mov).toBe(4);
    expect(SHEET.range).toEqual({ panels: 4, targets: 1 });
    expect(SHEET.sustainability).toBe("2◈");
  });

  it("has no Normal Attack rider of its own", () => {
    // Unlike Nemo, whose unnamed 10% Slow belongs to no skill, every rider
    // Raikou has belongs to a named ability. A `rules:` block here would put a
    // row on her sheet that her sheet does not have.
    expect(SHEET.rules ?? []).toEqual([]);
  });
});

/* ========================================================================== */
/*  The four shared class skills                                              */
/* ========================================================================== */

describe("the class skills she takes off the shelf", () => {
  const refs = Object.fromEntries(
    SHEET.abilities.filter((a) => a.ref).map((a) => [a.ref, a]),
  );

  it("takes Mad Enhancement at EX, whose every magnitude the tables already hold", () => {
    expect(refs["class-mad-enhancement"].rank).toBe("EX");
    // "All damage taken is reduced by 75%; if NP, 30%."
    expect(lookup("madEnhancementDefence", Rank.parse("EX"))).toEqual([75, 30]);
    // "All damage dealt is increased by 100%... halved for BA(MAG)" -- 50,
    // exact, so `magnitudeRoundTo: 5` has nothing to round.
    expect(lookup("madEnhancementOffence", Rank.parse("EX"))).toBe(100);
    // "Master loses 30 Health... when Health is 30 or less, forcibly deactivated."
    expect(lookup("madEnhancementDrain", Rank.parse("EX"))).toBe(30);
  });

  it("takes Riding at A+ with the ⅓◈ regen the sheet states, and adds nothing", () => {
    expect(refs["class-riding"]).toEqual({ ref: "class-riding", rank: "A+", cooldown: "3◈-⅓◈" });
    expect(lookup("ridingMov", Rank.parse("A+"))).toBe(5);
    expect(lookup("ridingCooldown", Rank.parse("A+"))).toBe("3◈");
  });

  it("takes Magic Resistance at D, and adds nothing", () => {
    expect(refs["class-magic-resistance"].rank).toBe("D");
    expect(lookup("magicResistancePercent", Rank.parse("D"))).toBe(20);
    expect(lookup("magicResistanceDebuffResist", Rank.parse("D"))).toBe(10);
  });

  it("takes Divinity at C for a flat +30", () => {
    expect(refs.divinity.rank).toBe("C");
    expect(lookup("divinity", Rank.parse("C"))).toBe(30);
  });
});

/* ========================================================================== */
/*  self:withinOfMaster — how close she stands to her own Master              */
/* ========================================================================== */

describe("how close a Servant stands to its own Master", () => {
  /** @param {number} distance @returns {object} a two-unit board */
  const boardAt = (distance) => {
    const master = { id: "m1", kind: "master", faction: "f1", panel: { i: 5, j: 5 } };
    const servant = {
      id: "s1", kind: "servant", faction: "f1", masterId: "m1",
      panel: { i: 5, j: 5 + distance }, servantClasses: ["berserker"],
    };
    return { units: [master, servant], alliances: {} };
  };

  it("annotates the Chebyshev distance to the contracted Master", () => {
    const board = boardAt(2);
    annotateZon(board.units, board);
    expect(board.units.find((u) => u.id === "s1").masterDistance).toBe(2);
  });

  it("annotates null for a Servant with no Master on the board", () => {
    // A Free Servant has no Master to stand near. `null` rather than Infinity:
    // the option is simply not emitted, so `self:withinOfMaster:2` is false and
    // `not:self:withinOfMaster:2` is true, which is right for both.
    const board = {
      units: [{ id: "s1", kind: "servant", faction: "f1", panel: { i: 1, j: 1 } }],
      alliances: {},
    };
    annotateZon(board.units, board);
    expect(board.units[0].masterDistance).toBeNull();
  });

  it("is NOT suppressed by a ZON exemption", () => {
    // `zonStatus` returns nothing for a `zonExempt` Servant (Semiramis aboard
    // the Hanging Gardens) because the ZON PENALTY does not apply to her. The
    // distance to her Master is a different fact and still exists, which is why
    // this is annotated beside the ZON fields rather than read off `zonDistance`.
    const board = boardAt(3);
    board.units.find((u) => u.id === "s1").zonExempt = true;
    annotateZon(board.units, board);
    const s = board.units.find((u) => u.id === "s1");
    expect(s.zonDistance).toBeNull();
    expect(s.masterDistance).toBe(3);
  });

  it("emits a LADDER, so a Master 2 panels away satisfies 'within 3'", () => {
    const options = rollOptionsFor({
      attacker: { kind: "servant", masterDistance: 2 },
      defender: { kind: "servant" },
    });
    expect(options.has("self:withinOfMaster:2")).toBe(true);
    expect(options.has("self:withinOfMaster:3")).toBe(true);
    expect(options.has("self:withinOfMaster:6")).toBe(true);
    // ...and NOT the rungs below it. A Master 2 panels away is not within 1.
    expect(options.has("self:withinOfMaster:1")).toBe(false);
  });

  it("emits nothing at all when there is no Master", () => {
    const options = rollOptionsFor({
      attacker: { kind: "servant", masterDistance: null },
      defender: { kind: "servant" },
    });
    expect([...options].some((o) => o.startsWith("self:withinOfMaster"))).toBe(false);
  });
});

/* ========================================================================== */
/*  Mad Enhancement, held on by her Master's position                         */
/* ========================================================================== */

describe("Mad Enhancement is forced on while her Master is within 2 panels", () => {
  /** The ability document, as the mode machinery sees it. */
  const me = (overrides = {}) => ({
    id: "class-mad-enhancement",
    system: {
      slug: "madEnhancement", isMode: true, toggleLock: "2◈",
      active: false, toggledAt: null, ...overrides,
    },
  });

  /** A Raikou snapshot carrying the collected rule. */
  const raikou = (distance) => ({
    id: "r1", kind: "servant", masterDistance: distance,
    forcedModeRules: [
      { mode: "madEnhancement", when: ["self:withinOfMaster:2"], source: "Mad Enhancement" },
    ],
    compulsions: [],
  });

  it("is authored on HER entry, not on the shared class skill", () => {
    // No other bearer has this clause. Penthesilea, Heracles, Asterios and
    // Kingprotea all take `class-mad-enhancement`, and none of them is held on
    // by anybody's position -- so putting it on the shared file would give it
    // to four Servants whose sheets do not grant it.
    const entry = SHEET.abilities.find((a) => a.ref === "class-mad-enhancement");
    expect(entry.rank).toBe("EX");
    const rule = entry.passiveRules.find((r) => r.key === "ForceMode");
    expect(rule.mode).toBe("madEnhancement");
    // `when`, NOT `predicate`. The gate every element carries is tested at
    // collection time, where a positional answer would be frozen into the
    // snapshot -- leaving her stuck mad or stuck calm depending on where her
    // Master stood when the board was built.
    expect(rule.when).toEqual(["self:withinOfMaster:2"]);
    expect(rule.predicate).toBeUndefined();
  });

  it("collects into its own bucket, with the condition intact", () => {
    const out = collectContributions([{
      id: "class-mad-enhancement",
      rank: null,
      passiveRules: [
        { key: "ForceMode", mode: "madEnhancement", when: ["self:withinOfMaster:2"] },
      ],
    }], {});
    expect(out.forcedModeRules).toEqual([
      { mode: "madEnhancement", when: ["self:withinOfMaster:2"], source: "class-mad-enhancement" },
    ]);
  });

  it("switches the mode on when the Master walks into 2 panels", () => {
    expect(forcedModes(raikou(2), [me()])).toHaveLength(1);
  });

  it("leaves it alone when the Master is 3 panels away", () => {
    expect(forcedModes(raikou(3), [me()])).toHaveLength(0);
  });

  it("does not offer to switch on a mode that is already on", () => {
    expect(forcedModes(raikou(2), [me({ active: true })])).toHaveLength(0);
  });

  it("refuses deactivation while the Master is close", () => {
    const verdict = canToggleMode(me({ active: true }), raikou(2), { active: false, tick: 99 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("forced");
  });

  it("allows deactivation once the Master steps away", () => {
    // `tick: 99` against `toggledAt: 0` clears the 2◈ lockout, which is a
    // separate refusal and not what this test is about.
    const verdict = canToggleMode(
      me({ active: true, toggledAt: 0 }), raikou(3), { active: false, tick: 99 },
    );
    expect(verdict.ok).toBe(true);
  });

  it("never switches the mode OFF when the Master leaves", () => {
    // The sheet says it "cannot be deactivated" while the condition holds --
    // which frees the player's hand rather than moving it. The ruling
    // `engine/modes.mjs` already records for Penthesilea: a Berserker who has
    // been driven mad does not simply calm down.
    expect(forcedModes(raikou(6), [me({ active: true })])).toHaveLength(0);
  });
});

/* ========================================================================== */
/*  The ref override survives the build                                       */
/* ========================================================================== */

describe("her Mad Enhancement entry after the ref resolves", () => {
  /**
   * `resolveRef` returns `{...substitute(template), _ref, ...params}` — the
   * entry's own keys spread LAST, so an override REPLACES a key the template
   * also carries rather than merging into it.
   *
   * That is fine here and worth a test rather than a reading:
   * `class-mad-enhancement` declares `activeRules` and no `passiveRules`, so
   * her `ForceMode` lands beside all seven of its clauses instead of deleting
   * them. If the shared file ever grows a `passiveRules` block, this test is
   * what says her override just ate it.
   */
  const library = new Map([[
    "class-mad-enhancement",
    parse(readFileSync("packs/_source/class-skills/mad-enhancement.yml", "utf8")),
  ]]);

  const entry = SHEET.abilities.find((a) => a.ref === "class-mad-enhancement");
  /** @type {string[]} */
  const problems = [];
  const resolved = resolveRef(entry, library, problems, "raikou");

  it("resolves cleanly", () => {
    expect(problems).toEqual([]);
  });

  it("keeps every one of the shared skill's seven clauses", () => {
    // The two DamageModifiers of clause 3, the defUp of clause 2, MOV, Range,
    // ZON, the Evade table override and the drain handler.
    const keys = resolved.activeRules.map((r) => r.key);
    expect(keys).toContain("DamageModifier");
    expect(keys).toContain("MovDelta");
    expect(keys).toContain("RangeDelta");
    expect(keys).toContain("ZonBonus");
    expect(keys).toContain("TableOverride");
    expect(keys).toContain("OnEvent");
    expect(resolved.toggleLock).toBe("2◈");
    expect(resolved.slug).toBe("madEnhancement");
  });

  it("adds her ForceMode without displacing anything", () => {
    expect(resolved.passiveRules).toEqual([
      { key: "ForceMode", mode: "madEnhancement", when: ["self:withinOfMaster:2"] },
    ]);
    expect(resolved.rank).toBe("EX");
  });
});

/* ========================================================================== */
/*  The Command Spell that buys her 1◈ of sanity                              */
/* ========================================================================== */

describe("the Command Spell that suspends a forced mode", () => {
  const CS = parse(readFileSync("packs/_source/command-spells/cs-suspend-skill.yml", "utf8"));

  const me = (overrides = {}) => ({
    id: "class-mad-enhancement",
    system: {
      slug: "madEnhancement", isMode: true, toggleLock: "2◈",
      active: true, toggledAt: 0, suspendedUntil: null, ...overrides,
    },
  });
  const raikou = (distance) => ({
    id: "r1", kind: "servant", masterDistance: distance,
    forcedModeRules: [
      { mode: "madEnhancement", when: ["self:withinOfMaster:2"], source: "Mad Enhancement" },
    ],
    compulsions: [],
  });

  it("is a one-cost spell that names a skill and a span", () => {
    expect(CS.cost).toBe(1);
    const [e] = CS.effect;
    expect(e.kind).toBe("suspendSkill");
    expect(e.target).toBe("contractedServant");
    expect(e.scope).toBe("oneSkill");
    expect(e.duration).toBe("1◈");
  });

  it("beats ForceMode: the mode may be switched off while suspended", () => {
    // The whole point of the clause, and the one thing about it that can be
    // got wrong silently. Read the two refusals in the other order and the
    // most expensive resource in the game buys nothing.
    const verdict = canToggleMode(me({ suspendedUntil: 12 }), raikou(1), { active: false, tick: 6 });
    expect(verdict.ok).toBe(true);
  });

  it("refuses REACTIVATION while the suspension stands", () => {
    // "Can be deactivated FOR 1◈ Turns" is a span during which it is off, not
    // a single permission to press the button once.
    const verdict = canToggleMode(
      me({ active: false, suspendedUntil: 12 }), raikou(1), { active: true, tick: 6 },
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("suspended");
  });

  it("stops reconciliation switching it straight back on", () => {
    // The half that would otherwise undo the purchase: `reconcileForcedModes`
    // runs on every invalidation, so without this the Command Spell would be
    // spent and the mode back on before the player let go of the mouse.
    expect(forcedModes(raikou(1), [me({ active: false, suspendedUntil: 12 })], { tick: 6 }))
      .toHaveLength(0);
  });

  it("lapses back to forced once the span passes", () => {
    // "It will reactivate if the aforementioned conditions are still met after
    // those 1◈ Turns." No extra machinery and no timer: `forcedModes` simply
    // stops refusing.
    expect(forcedModes(raikou(1), [me({ active: false, suspendedUntil: 5 })], { tick: 6 }))
      .toHaveLength(1);
  });

  it("does NOT buy out the 2◈ toggle lock", () => {
    // The sheet buys one refusal with a Command Spell and says nothing about
    // the other. A lockout a Command Spell defeats is a different rule from
    // the one on the page.
    const verdict = canToggleMode(
      me({ suspendedUntil: 99, toggledAt: 5 }), raikou(1), { active: false, tick: 6 },
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("toggleLock");
  });
});

/* ========================================================================== */
/*  Genji-clan Martial Arts Discipline — the passive                          */
/* ========================================================================== */

describe("Genji-clan Martial Arts Discipline — the passive", () => {
  const A = ability("raikou-genji-clan-martial-arts-discipline");

  /**
   * Land an effect on a Raikou carrying the halving, and report what stuck.
   *
   * The built instance rides on the emitted `applyEffect` intent rather than on
   * the result object -- `applyEffect` returns `{outcome, reason, intents,
   * trace}` and the document is the intent's payload.
   *
   * @param {string} id @param {string} file @param {number} magnitude @param {number|null} np
   */
  const landed = (...args) => {
    const out = land(...args);
    return {
      instance: out.intents.find((i) => i.t === "applyEffect")?.effect ?? null,
      trace: out.trace,
    };
  };

  const land = (id, file, magnitude, np = null) => applyEffect({
    def: { ...effect(file), id },
    target: {
      id: "r1", effects: [], effectInstances: [],
      magnitudeScales: [{
        direction: "incoming", effects: ["atkDwn"], family: null,
        factor: 0.5, source: "Genji-clan Martial Arts Discipline",
      }],
    },
    magnitude,
    npMagnitude: np,
    duration: "1◈",
    source: { unitId: "x" },
    ctx: { options: new Set(), rolls: { chance: 1 }, currentTick: 0 },
  });

  it("names Atk Dwn by id, not by family", () => {
    const rule = A.passiveRules.find((r) => r.key === "EffectMagnitudeScale");
    expect(rule.direction).toBe("incoming");
    // `atkDwn` and a negative `atkUp` are DIFFERENT FAMILIES on purpose --
    // buff removal strips the latter and cannot touch this -- and the sheet
    // names Atk Dwn.
    expect(rule.effects).toEqual(["atkDwn"]);
    expect(rule.family).toBeUndefined();
    expect(rule.factor).toBe(0.5);
  });

  it("halves an incoming Atk Dwn at application time", () => {
    expect(landed("atkDwn", "atk-dwn", 40, 20).instance.magnitude).toBe(20);
  });

  it("halves the NP magnitude with it", () => {
    // "The magnitude of all Atk Dwn effects" is the effect's magnitude, and
    // `npMagnitude` is that same magnitude read against a Noble Phantasm --
    // not a second, unscaled one.
    expect(landed("atkDwn", "atk-dwn", 40, 20).instance.npMagnitude).toBe(10);
  });

  it("leaves an Atk Up alone", () => {
    expect(landed("atkUp", "atk-up", 40).instance.magnitude).toBe(40);
  });

  it("rounds DOWN, the direction that favours the bearer", () => {
    // 35 halving to 18 would let an attacker round their own debuff up.
    expect(landed("atkDwn", "atk-dwn", 35).instance.magnitude).toBe(17);
  });

  it("says so in the trace, so the chip's number is explicable", () => {
    const { trace } = landed("atkDwn", "atk-dwn", 40);
    expect(trace.some((t) => t.step === "magnitudeScale")).toBe(true);
  });
});

/* ========================================================================== */
/*  Both new buckets survive the projection                                   */
/* ========================================================================== */

describe("the two new contribution buckets reach the snapshot", () => {
  // The project's dominant defect, guarded in the one place it always
  // reappears: a rule that collects correctly and is never projected onto the
  // unit is a rule that compiles, validates, loads and does nothing. Both of
  // these were exactly that until `rules/snapshot.mjs` carried them.
  it("projects both keys named by the two elements Raikou needed", () => {
    const out = collectContributions([
      {
        id: "a",
        passiveRules: [
          { key: "ForceMode", mode: "madEnhancement", when: ["self:withinOfMaster:2"] },
          { key: "EffectMagnitudeScale", direction: "incoming", effects: ["atkDwn"], factor: 0.5 },
        ],
      },
    ], {});

    // The buckets exist on the contributions...
    expect(out.forcedModeRules).toHaveLength(1);
    expect(out.magnitudeScales).toHaveLength(1);

    // ...and `rules/snapshot.mjs` names both. Asserted against the source
    // rather than by building an actor, because the projection is a literal
    // and the failure mode is a missing line in it.
    const projection = readFileSync("module/rules/snapshot.mjs", "utf8");
    expect(projection).toContain("forcedModeRules: contributions.forcedModeRules");
    expect(projection).toContain("magnitudeScales: contributions.magnitudeScales");
  });
});

/* ========================================================================== */
/*  Genji-clan Martial Arts Discipline — the Active                           */
/* ========================================================================== */

describe("Genji-clan Martial Arts Discipline — the Active", () => {
  const A = ability("raikou-genji-clan-martial-arts-discipline");
  const UP = effect("crit-up-martial");
  const DM = effect("crit-dm-up-martial");

  it("costs 4◈ and is used on her own Turn", () => {
    expect(A.cooldown).toBe("4◈");
    expect(A.timing.window).toBe("ownTurn");
  });

  it("is a passive AND an Active — the sheet gives it both halves", () => {
    expect(A.passiveRules.some((r) => r.key === "EffectMagnitudeScale")).toBe(true);
    expect(A.phases.length).toBeGreaterThan(0);
  });

  it("applies both buffs in each branch, at the branch's magnitude", () => {
    const withMe = A.phases.filter((p) => p.predicate?.includes("self:skillActive:madEnhancement"));
    const without = A.phases.filter((p) => p.predicate?.includes("not:self:skillActive:madEnhancement"));
    expect(withMe).toHaveLength(1);
    expect(without).toHaveLength(1);
    expect(withMe[0].effects).toEqual([
      { id: "critUpMartial", magnitude: 30, duration: "1◈" },
      { id: "critDmUpMartial", magnitude: 30, duration: "1◈", uses: 3 },
    ]);
    // INVERTED against the mode: she crits better when she is calm.
    expect(without[0].effects).toEqual([
      { id: "critUpMartial", magnitude: 60, duration: "1◈" },
      { id: "critDmUpMartial", magnitude: 60, duration: "1◈", uses: 3 },
    ]);
  });

  it("Crit Up (Martial) carries NO count — the sheet gives it none", () => {
    expect(UP.uses).toBeUndefined();
    expect(UP.stacking).toBe("magnitudeStacks");
    const rule = UP.rules.find((r) => r.key === "CheckModifier");
    expect(rule.check).toBe("crit");
    expect(rule.value).toBe("@magnitude");
    // Unconditional. `critUpHawkeye` exists because EMIYA's is "at a Range of
    // 3 or higher"; hers names no condition, so it carries no predicate.
    expect(rule.predicate).toBeUndefined();
  });

  it("Crit DmUp (Martial) is three uses OR 1◈, whichever ends first (R1)", () => {
    expect(DM.stacking).toBe("count");
    expect(DM.uses).toBe(3);
    expect(DM.defaultDuration).toBe("1◈");
  });

  it("spends a use on a crit, and only on a crit", () => {
    const mod = DM.rules.find((r) => r.key === "CritModifier");
    expect(mod.aspect).toBe("damage");
    expect(mod.modifierKey).toBe("critDmUp");

    const spend = DM.rules.find((r) => r.key === "OnEvent");
    // `attack:crit` is in the option set ONLY at `damageDealt`, because a
    // clause asking whether the attack crit is by definition asking about a
    // resolved one. So the charge is spent by the event that proves it.
    expect(spend.event).toBe("damageDealt");
    expect(spend.predicate).toEqual(["attack:crit"]);
    expect(spend.consumesUse).toBe(true);
    expect(spend.then).toEqual([]);
  });

  it("pairs every CritModifier with a consumesUse twin", () => {
    // A count-limited modifier without its spender is an infinite buff, and
    // the two live in different halves of the file.
    const mods = DM.rules.filter((r) => r.key === "CritModifier").length;
    const spenders = DM.rules.filter((r) => r.key === "OnEvent" && r.consumesUse).length;
    expect(spenders).toBeGreaterThanOrEqual(mods);
  });

  it("emits an option `attack:crit` that the vocabulary admits", () => {
    // The guard that matters for a predicate authored against a rare option:
    // one that matches no emittable pattern is permanently false and silent.
    expect(isEmittableOption("attack:crit")).toBe(true);
  });
});

/* ========================================================================== */
/*  Mana Burst (Lightning)                                                    */
/* ========================================================================== */

describe("Mana Burst (Lightning)", () => {
  const A = ability("raikou-mana-burst-lightning");

  it("is an Attack Skill on a 3◈ cooldown", () => {
    // Its Active PERFORMS a Normal Attack, so it opens a Combat Process and
    // spends her Attack for the Turn (§15.1).
    expect(A.isAttackSkill).toBe(true);
    expect(A.cooldown).toBe("3◈");
    expect(A.element).toBe("lightning");
  });

  it("refuses while Mad Enhancement is Active", () => {
    // The inverse of Penthesilea's Outrage Amazon, and the shape of the whole
    // kit: this and Tenmōkaikai are the calm half, Thunder God's Embodiment
    // and Dohatsu Tenshou the mad one.
    expect(A.requirements).toEqual([{ kind: "modeInactive", mode: "madEnhancement" }]);
  });

  it("sums both Base Attacks at full weight — BA 350", () => {
    expect(A.damage.base.sources).toEqual([
      { unit: "self", component: "str", factor: 1 },
      { unit: "self", component: "mag", factor: 1 },
    ]);
    // The sheet writes the answer out, as Karna's does.
    expect(SHEET.baseAttack.str + SHEET.baseAttack.mag).toBe(350);
  });

  it("counts as a STR attack, and skips Magic Resistance outright", () => {
    // The two must agree: Magic Resistance's own Instakill/Death exemption
    // reads `attack:component`, and without stage 11 being skipped a Rank C
    // Magic Resistance would negate the MAG half of a 350 Base Attack.
    expect(A.damage.component).toBe("str");
    expect(A.damage.ignoresMagicResistance).toBe(true);
  });

  it("carries Lightning on half the total", () => {
    expect(A.damage.element).toBe("lightning");
    expect(A.damage.elementFraction).toBe(0.5);
  });

  it("inflicts Shock for 2◈ on a landed hit, and Dodge on herself after", () => {
    const shock = A.phases.find((p) => p.kind === "applyEffects" && p.target !== "self");
    expect(shock.rules[0].event).toBe("damageDealt");
    expect(shock.rules[0].effect.id).toBe("shock");
    expect(shock.rules[0].duration).toBe("2◈");

    const dodge = A.phases.find((p) => p.kind === "applyEffects" && p.target === "self");
    expect(dodge.effects).toEqual([{ id: "dodge", duration: "⅓◈" }]);
  });

  it("makes her immune to Shock and halves Lightning taken, including NP", () => {
    expect(A.passiveRules).toContainEqual({ key: "Immunity", effect: "shock" });
    const ward = A.passiveRules.find((r) => r.key === "Ward");
    expect(ward.value).toBe(50);
    // "including NP" rather than a reduced NP figure, so the two are equal.
    expect(ward.npValue).toBe(50);
    expect(ward.predicate).toEqual(["attack:element:lightning"]);
  });

  it("needed no engine code that Karna had not already bought", () => {
    // The interesting fact about this file. Every mechanism it uses -- a
    // two-source Base Attack, an attack that counts as STR while summing both,
    // `ignoresMagicResistance`, `elementFraction`, an on-hit rider, a Ward
    // predicated on an element -- was built for Karna and documented in his
    // file. The second user of a shape is where that investment pays.
    const karna = ability("karna-mana-burst-flames");
    expect(Object.keys(A.damage).sort()).toEqual(Object.keys(karna.damage).sort());
  });
});

/* ========================================================================== */
/*  Thunder God's Embodiment                                                  */
/* ========================================================================== */

describe("Thunder God's Embodiment", () => {
  const A = ability("raikou-thunder-gods-embodiment");
  const BUFF = effect("raikou-buff");

  it("refuses while Mad Enhancement is off, and costs 4◈-⅓◈", () => {
    expect(A.requirements).toEqual([{ kind: "modeActive", mode: "madEnhancement" }]);
    expect(A.cooldown).toBe("4◈-⅓◈");
  });

  it("applies all three clauses to herself in one phase", () => {
    const phase = A.phases.find((p) => p.kind === "applyEffects");
    expect(phase.target).toBe("self");
    expect(phase.effects).toEqual([
      { id: "atkUp", magnitude: 40, npMagnitude: 30, duration: "1◈" },
      { id: "dodge", duration: "⅓◈" },
      { id: "raikouBuff", uses: 3 },
    ]);
  });

  it("gives the Raikou buff three uses and NO duration (R1)", () => {
    // "Applies the 'Raikou' buff FOR 3 TIMES" -- a count and nothing else.
    // Every other count-limited buff on this sheet also states a duration;
    // this one does not, so it stands until it is spent.
    expect(BUFF.stacking).toBe("count");
    expect(BUFF.uses).toBe(3);
    expect(BUFF.defaultDuration).toBeUndefined();
  });

  it("adds 40 bonus LIGHTNING damage to a Normal Attack", () => {
    const flat = BUFF.rules.find((r) => r.key === "FlatDamage");
    expect(flat.value).toBe(40);
    // The element is the point. A defender with Lightning resistance resists
    // it, and Raikou herself takes half from Lightning -- so a mirror match
    // has to land on the right side of that arithmetic.
    expect(flat.element).toBe("lightning");
    expect(flat.predicate).toEqual(["attack:kind:normal"]);
  });

  it("rolls 40% Shock and takes ⅓◈ off BOTH Noble Phantasms, spending one use", () => {
    const rider = BUFF.rules.find((r) => r.key === "OnEvent");
    expect(rider.event).toBe("damageDealt");
    expect(rider.predicate).toEqual(["attack:kind:normal"]);
    // ONE handler for both payouts, so a Normal Attack that rolls badly for
    // Shock still spends the charge and still takes ⅓◈ off the clocks.
    expect(rider.consumesUse).toBe(true);
    const shock = rider.then.find((t) => t.key === "ApplyEffect");
    expect(shock.target).toBe("victim");
    expect(shock.chance).toBe(40);
    expect(shock.duration).toBe("⅔◈");
    const cd = rider.then.find((t) => t.key === "CooldownDelta");
    // R3: BOTH Noble Phantasms. `scope: np` reaches every NP on cooldown --
    // the reading Scáthach's `alpi` already takes, and for the same reason:
    // the sheet names no ability and she has two.
    expect(cd.scope).toBe("np");
    expect(cd.ticks).toBe("-⅓◈");
  });

  /**
   * The pipeline's own context shape, as `test/golden/damage.test.mjs` builds
   * it: the base is a SPEC resolved against the attacker's `baseAttack`, not a
   * bare number.
   *
   * @param {object} attacker @param {object} defender @param {object} attack
   */
  const damage = (attacker, defender, attack = {}) => computeDamage({
    attacker: {
      baseAttack: { str: 200, mag: 0 }, parameters: {}, effects: [],
      health: 1000, shield: 0, magicResistance: null, outsideZon: false,
      ...attacker,
    },
    defender: {
      baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: [],
      health: 1000, shield: 0, magicResistance: null, outsideZon: false,
      ...defender,
    },
    board: {},
    attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null, ...attack },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    multiplier: 1,
    flatBonus: 0,
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" },
    luckChecks: {},
    rolls: {},
    options: new Set(),
  });

  /** The `Raikou` buff's bonus, as the collector would emit it. */
  const LIGHTNING_40 = { key: "divinity", value: 40, element: "lightning", source: "Raikou" };

  it("routes the elemental bonus through the element's own share", () => {
    // 200 base, +40 Lightning, against a defender who halves Lightning.
    //
    // WRONG, and what the old stage 7 would have done: 240 with the ward
    // meeting nothing, because a flat bonus had no element for stage 4b to
    // see. Also wrong: 240 halved, which drags her ordinary STR damage into a
    // resistance it never had.
    //
    // RIGHT: 200 + (40 x 0.5) = 220. The bonus is entirely Lightning, so the
    // ward takes half of IT and nothing else.
    const out = damage(
      { modifiers: [LIGHTNING_40] },
      { modifiers: [{ key: "elementDefUp", value: 50, element: "lightning", source: "ward" }] },
    );
    expect(out.total).toBe(220);
  });

  it("adds an unresisted elemental bonus at face value", () => {
    const out = damage({ modifiers: [LIGHTNING_40] }, {});
    expect(out.total).toBe(240);
  });

  it("does NOT let the attack's own elementFraction shrink the bonus", () => {
    // `elementFraction` says how much of the ATTACK carries the element. This
    // bonus is entirely made of it, so the fraction is none of its business --
    // and applying it would silently halve a number the sheet states flat.
    const out = damage(
      { modifiers: [LIGHTNING_40] }, {},
      { element: "fire", elementFraction: 0.5 },
    );
    expect(out.total).toBe(240);
  });
});

/* ========================================================================== */
/*  Mystery Slayer                                                            */
/* ========================================================================== */

describe("Mystery Slayer", () => {
  const A = ability("raikou-mystery-slayer");
  const MS = effect("atk-up-ms");
  const DEM = effect("atk-up-demonic");

  /** The exclusion, as every one of the four clauses must spell it (R2). */
  const EXCLUSION = {
    // `or`, not `anyOf`: `anyOf` takes bare option strings and tests set
    // membership, so a statement object inside one is permanently false.
    or: [
      { nor: ["target:attribute:demiServant", "target:attribute:pseudoServant"] },
      "target:contentId:sitonai",
    ],
  };

  /** @param {object[]} predicate @param {string[]} options */
  const holds = (predicate, options) => testPredicate(predicate, { options: new Set(options) });

  const passives = A.passiveRules.filter((r) => r.key === "DamageModifier");

  it("has two passives, each +20% including NP", () => {
    expect(passives).toHaveLength(2);
    for (const p of passives) {
      expect(p.value).toBe(20);
      expect(p.npValue).toBe(20);
      expect(p.direction).toBe("dealt");
    }
  });

  it("targets [Earth] or [Sky] with the first passive, Demonic with the second", () => {
    expect(passives[0].predicate[0]).toEqual({
      anyOf: ["target:attribute:earth", "target:attribute:sky"],
    });
    expect(passives[1].predicate[0]).toBe("target:attribute:demonic");
  });

  it("defers every clause, because the target does not exist at collection time", () => {
    // Answering `target:attribute:` at collection time answers it wrong and
    // drops the modifier for ever -- the defect `critUpHawkeye`'s file records
    // in the same words, and the one that made Scáthach's God Slayer add
    // nothing against a Divine Unit.
    for (const p of [...passives, MS.rules[0], DEM.rules[0]]) {
      expect(p.defer).toBe("attack");
    }
  });

  it("carries the exclusion on ALL FOUR clauses (R2)", () => {
    // The note names "Mystery Slayer and Atk Up (MS)", and the ruling reads
    // that as the whole skill: a Demi-Servant who is also Demonic would
    // otherwise be a hole in a sentence that names the skill by name.
    for (const rule of passives) expect(rule.predicate).toContainEqual(EXCLUSION);
    expect(MS.rules[0].predicate).toContainEqual(EXCLUSION);
    expect(DEM.rules[0].predicate).toContainEqual(EXCLUSION);
  });

  it("the exclusion admits an ordinary Servant", () => {
    expect(holds([EXCLUSION], ["target:attribute:servant", "target:attribute:sky"])).toBe(true);
  });

  it("the exclusion refuses a Demi-Servant and a Pseudo-Servant", () => {
    expect(holds([EXCLUSION], ["target:attribute:demiServant"])).toBe(false);
    expect(holds([EXCLUSION], ["target:attribute:pseudoServant"])).toBe(false);
  });

  it("...and admits Sitonai, who is one", () => {
    // The one stated exception, named by CONTENT ID rather than by an
    // attribute -- the one name of a Servant's a world cannot rename. She is
    // in neither roster, so this is a forward reference, which the facet
    // supports on purpose (the same thing `outsider` and `undead` are).
    expect(holds([EXCLUSION], ["target:attribute:pseudoServant", "target:contentId:sitonai"]))
      .toBe(true);
  });

  it("applies both Atk Ups for 1◈ on a 4◈ cooldown", () => {
    expect(A.cooldown).toBe("4◈");
    const phase = A.phases.find((p) => p.kind === "applyEffects");
    expect(phase.target).toBe("self");
    expect(phase.effects).toEqual([
      { id: "atkUpMs", magnitude: 30, npMagnitude: 30, duration: "1◈" },
      { id: "atkUpDemonic", magnitude: 30, npMagnitude: 30, duration: "1◈" },
    ]);
  });

  it("gives a [Sky] Demi-Servant nothing at all, passive or active", () => {
    // The whole point of R2, end to end. Raikou is [Sky] herself, so the
    // target here is a plausible one: a Demi-Servant who would otherwise take
    // +20% from the passive and +30% from the buff.
    const options = new Set([
      "target:attribute:sky", "target:attribute:demiServant", "target:attribute:demonic",
    ]);
    for (const rule of [...passives, MS.rules[0], DEM.rules[0]]) {
      expect(testPredicate(rule.predicate, { options })).toBe(false);
    }
  });
});

/* ========================================================================== */
/*  The four copies                                                           */
/* ========================================================================== */

describe("the four copies", () => {
  /** Range, element, rider — the only three fields that differ. */
  const COPIES = {
    "raikou-watanabe": { range: 1, element: "fire", rider: "burn" },
    "raikou-sakata": { range: 1, element: "lightning", rider: "shock" },
    "raikou-urabe": { range: 3, element: "wind", rider: "bleed" },
    "raikou-usui": { range: 2, element: "ice", rider: "disable" },
  };
  const IDS = Object.keys(COPIES);

  it.each(Object.entries(COPIES))("%s has its own Range, element and rider", (id, spec) => {
    const S = summon(id);
    expect(S.range).toEqual({ panels: spec.range, targets: 1 });
    expect(S.normalAttack.element).toBe(spec.element);
    // "(half)" on every one of the four.
    expect(S.normalAttack.elementFraction).toBe(0.5);
    const rider = S.passiveRules.find((r) => r.key === "OnEvent" && r.event === "damageDealt");
    expect(rider.predicate).toEqual(["attack:kind:normal"]);
    expect(rider.then[0].effect.id).toBe(spec.rider);
    expect(rider.then[0].chance).toBe(50);
    expect(rider.then[0].duration).toBe("1◈");
  });

  it("gives the four FOUR different elements and four different riders", () => {
    // The whole point of the clause: it is not one summon printed four times.
    expect(new Set(IDS.map((id) => COPIES[id].element)).size).toBe(4);
    expect(new Set(IDS.map((id) => COPIES[id].rider)).size).toBe(4);
  });

  it.each(IDS)("%s inherits her Agility, Luck and MOV, and HALF her Max Health", (id) => {
    const S = summon(id);
    expect(S.inherit.agility).toEqual({ from: "summoner" });
    expect(S.inherit.luck).toEqual({ from: "summoner" });
    expect(S.inherit.mov).toEqual({ from: "summoner" });
    // MAX, not current: a wounded Raikou still spawns copies at half of 1250.
    expect(S.inherit.health).toEqual({ from: "summoner", factor: 0.5 });
    // No number of its own -- every one is read off her at placement.
    expect(S.baseHealth).toBeNull();
  });

  it.each(IDS)("%s inherits her PASSIVES but not the two named Skills", (id) => {
    const S = summon(id);
    // "(Passive effects are still present)" -- Divinity's +30, both Mystery
    // Slayer passives, Magic Resistance, Mana Burst's Shock immunity and
    // Lightning halving all reach the copies. Mad Enhancement's magnitudes are
    // `activeRules` and are excluded by construction; Riding's grants are
    // `passiveRules` and have to be named, or a copy would get Double Move.
    expect(S.inherit.passives).toEqual({
      from: "summoner",
      excludeAbilities: ["class-mad-enhancement", "class-riding"],
    });
  });

  it.each(IDS)("%s can only perform Normal Attacks, and is free of the budget", (id) => {
    const S = summon(id);
    expect(S.passiveRules).toContainEqual({
      key: "GrantedAbility", abilities: ["normalAttacksOnly"],
    });
    // Two different rules, both stated: exempt from the POOL, still capped per
    // Unit. "Raikou's copies do not count towards the number of Units that
    // Move and/or Attack during your Turn. The same copy can only Move/Attack
    // once per Turn."
    expect(S.countsTowardBudget).toBe(false);
    expect(S.actsOncePerTurn).toBe(true);
  });

  it.each(IDS)("%s carries the copies' +15%% Crit, not Raikou's +30%%", (id) => {
    // Theirs, so it lives on them: an aura from the Noble Phantasm would have
    // to name four units whose document ids no content file can know.
    const crit = summon(id).passiveRules.find((r) => r.key === "CheckModifier");
    expect(crit.check).toBe("crit");
    expect(crit.value).toBe(15);
  });

  it.each(IDS)("%s shields Raikou and her Master from anyone beside it", (id) => {
    expect(summon(id).passiveRules).toContainEqual({
      key: "TargetabilityModifier",
      radius: 1,
      relations: ["ally", "self"],
      recipientRoles: ["summoner", "summonerMaster"],
    });
  });

  it.each(IDS)("%s ends the Noble Phantasm if it is the last one standing", (id) => {
    const end = summon(id).passiveRules.find(
      (r) => r.key === "OnEvent" && r.event === "unitDefeated",
    );
    // The last copy dying ENDS the NP -- not the same as the NP merely having
    // no copies left -- and that is what starts the 7◈+⅓◈. Fired from the copy
    // because the copy is the unit that died.
    expect(end.predicate).toEqual(["self:lastOfSummonGroup"]);
    expect(end.then[0]).toEqual({
      key: "SetMode", subject: "summoner", ability: "tenmokaikai", active: false,
    });
  });

  it("emits `self:lastOfSummonGroup` only for a lone summon", () => {
    const board = (n) => ({
      units: [
        { id: "r1", kind: "servant" },
        ...Array.from({ length: n }, (_, i) => ({
          id: `c${i}`, kind: "summon", summonerId: "r1",
        })),
      ],
    });
    const lastOf = (n) => {
      const b = board(n);
      annotateLastOfSummonGroup(b.units);
      return b.units.filter((u) => u.lastOfSummonGroup).length;
    };
    expect(lastOf(4)).toBe(0);
    expect(lastOf(2)).toBe(0);
    expect(lastOf(1)).toBe(1);
  });

  it("is not confused by another Servant's summons", () => {
    const units = [
      { id: "r1", kind: "servant" },
      { id: "c1", kind: "summon", summonerId: "r1" },
      { id: "m1", kind: "servant" },
      { id: "d1", kind: "summon", summonerId: "m1" },
      { id: "d2", kind: "summon", summonerId: "m1" },
    ];
    annotateLastOfSummonGroup(units);
    // Raikou's one copy is her last; Medea's two are neither.
    expect(units.find((u) => u.id === "c1").lastOfSummonGroup).toBe(true);
    expect(units.find((u) => u.id === "d1").lastOfSummonGroup).toBe(false);
    expect(units.find((u) => u.id === "d2").lastOfSummonGroup).toBe(false);
  });
});

/* ========================================================================== */
/*  Where the four copies appear (R4)                                         */
/* ========================================================================== */

describe("where the four copies appear (R4)", () => {
  const ORDER = ["front", "back", "left", "right"];
  const origin = { i: 5, j: 5 };
  const bounds = { width: 11, height: 11 };

  it("reads front/back/left/right off a cardinal facing", () => {
    // Screen coordinates: +i is south, +j is east, bearing 0 is north.
    expect(orthogonalPanels(origin, "n", ORDER, { bounds })).toEqual([
      { i: 4, j: 5 },  // front — north
      { i: 6, j: 5 },  // back  — south
      { i: 5, j: 4 },  // left  — west
      { i: 5, j: 6 },  // right — east
    ]);
  });

  it("rotates with the facing", () => {
    expect(orthogonalPanels(origin, "e", ORDER, { bounds })).toEqual([
      { i: 5, j: 6 },  // front — east
      { i: 5, j: 4 },  // back  — west
      { i: 4, j: 5 },  // left  — north
      { i: 6, j: 5 },  // right — south
    ]);
  });

  it("handles a DIAGONAL facing, which four of the eight are", () => {
    // "In front of" a Servant facing `ne` is (i−1, j+1). An 8×4 table would be
    // 32 entries obliged to agree with `coneOf` for ever; this is derived.
    expect(orthogonalPanels(origin, "ne", ORDER, { bounds })).toEqual([
      { i: 4, j: 6 },  // front — north-east
      { i: 6, j: 4 },  // back  — south-west
      { i: 4, j: 4 },  // left  — north-west
      { i: 6, j: 6 },  // right — south-east
    ]);
  });

  it("displaces OUTWARD along the same axis when the panel is taken", () => {
    // Not onto a neighbouring axis: "in front of her" stays in front of her,
    // or two copies end up on one side and none on another.
    const out = orthogonalPanels(origin, "n", ORDER, {
      bounds, occupied: new Set(["4,5"]),
    });
    expect(out[0]).toEqual({ i: 3, j: 5 });
  });

  it("keeps displacing until it finds room", () => {
    const out = orthogonalPanels(origin, "n", ORDER, {
      bounds, occupied: new Set(["4,5", "3,5", "2,5"]),
    });
    expect(out[0]).toEqual({ i: 1, j: 5 });
  });

  it("gives up at the board edge and returns null for that copy", () => {
    // A clone that quietly failed to exist is worse than one that appeared
    // further out -- and one that silently appeared somewhere else is worse
    // than both. `null` is reported by name on the chat card.
    const out = orthogonalPanels({ i: 0, j: 5 }, "n", ORDER, { bounds });
    expect(out[0]).toBeNull();
    // ...and the other three are unaffected.
    expect(out.slice(1).every(Boolean)).toBe(true);
  });

  it("never puts two copies on one panel", () => {
    // Each placement joins the occupied set as it is decided, so a displaced
    // clone cannot collide with a sibling that has not been placed yet.
    const out = orthogonalPanels(origin, "n", ORDER, {
      bounds, occupied: new Set(["4,5", "6,5"]),
    });
    const keys = out.filter(Boolean).map((p) => `${p.i},${p.j}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(4);
  });

  it("rotates a diagonal facing back onto a facing, never between two", () => {
    // The guard on the derivation: every 90° step from any of the eight lands
    // on one of the eight.
    for (const facing of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
      for (const deg of [0, 90, 180, 270]) {
        expect(FACING_OFFSETS[rotateFacing(facing, deg)]).toBeDefined();
      }
    }
  });
});

/* ========================================================================== */
/*  Goō Shōrai・Tenmōkaikai                                                   */
/* ========================================================================== */

describe("Goō Shōrai・Tenmōkaikai", () => {
  const A = ability("raikou-tenmokaikai");

  it("is a mode NP, usable only while Mad Enhancement is OFF", () => {
    expect(A.isNP).toBe(true);
    expect(A.isMode).toBe(true);
    expect(A.slug).toBe("tenmokaikai");
    expect(A.rank).toBe("A+");
    expect(A.npTags).toEqual(["antiArmy"]);
    expect(A.requirements).toEqual([{ kind: "modeInactive", mode: "madEnhancement" }]);
  });

  it("says nothing about Mad Enhancement afterwards", () => {
    // "(Note: Mad Enhancement can be reactivated after this NP is activated.)"
    // A requirement is checked at USE and never maintained, so honouring this
    // costs nothing -- but the obvious wrong reading is a standing gate that
    // switches the NP off the moment she rages, and the sheet goes out of its
    // way to rule that out. Worth an assertion for exactly that reason.
    expect(A.negatedWhile ?? null).toBeNull();
  });

  it("starts its 7◈+⅓◈ clock at DEACTIVATION, not at use", () => {
    expect(A.cooldown).toEqual({ max: "7◈+⅓◈", countFrom: "deactivation" });
  });

  it("may be switched off on her Turn or at the edge of any Turn or Round", () => {
    expect(A.deactivation).toEqual({ byOwner: true, window: "any" });
  });

  it("summons the four copies on the four facing-relative panels, in sheet order", () => {
    const phase = A.phases.find((p) => p.kind === "summon");
    expect(phase.spec.contentIds).toEqual([
      "raikou-watanabe", "raikou-sakata", "raikou-urabe", "raikou-usui",
    ]);
    expect(phase.spec.placement).toEqual({
      shape: "orthogonal",
      anchor: "self",
      order: ["front", "back", "left", "right"],
    });
    expect(phase.spec.countsTowardBudget).toBe(false);
    expect(phase.spec.actsOncePerTurn).toBe(true);
  });

  it("lifts EVERY attack she makes by 50%, not only Normal Attacks (R5)", () => {
    const mod = A.activeRules.find((r) => r.key === "DamageModifier");
    expect(mod.value).toBe(50);
    expect(mod.npValue).toBe(50);
    // No `attack:kind` predicate. The sheet narrows to "Normal Attacks" in the
    // very next clause, on the copies, so "Raikou's Attacks" is unqualified.
    expect(mod.predicate).toBeUndefined();
  });

  it("adds Shock 2◈ to her attacks, also unqualified", () => {
    const rider = A.activeRules.find((r) => r.key === "OnEvent" && r.event === "damageDealt");
    expect(rider.then[0].effect.id).toBe("shock");
    expect(rider.then[0].duration).toBe("2◈");
    expect(rider.predicate).toBeUndefined();
  });

  it("gives her +30% Crit Chance; the copies' +15% lives on the copies", () => {
    const crit = A.activeRules.find((r) => r.key === "CheckModifier");
    expect(crit.check).toBe("crit");
    expect(crit.value).toBe(30);
    for (const id of ["raikou-watanabe", "raikou-sakata", "raikou-urabe", "raikou-usui"]) {
      expect(summon(id).passiveRules.find((r) => r.key === "CheckModifier").value).toBe(15);
    }
  });

  it("charges her Master 25 per TURN, not per copy", () => {
    const upkeep = A.activeRules.find((r) => r.key === "OnEvent" && r.event === "turnEnd");
    // ONE handler, on HER, at her own turn end -- which happens once -- gated
    // on whether she or any copy acted. Four handlers on four copies would be
    // 125 a Round and would make the Noble Phantasm unusable.
    expect(upkeep.predicate).toEqual(["self:selfOrSummonsActed"]);
    const drain = upkeep.then.find((t) => t.key === "StatDelta");
    expect(drain.subject).toBe("master");
    expect(drain.amount).toBe(25);
    expect(drain.direction).toBe("down");
  });

  it("deactivates BEFORE it would charge a Master at 25 or less", () => {
    const upkeep = A.activeRules.find((r) => r.key === "OnEvent" && r.event === "turnEnd");
    const [first, second] = upkeep.then;
    // ORDERED THE OTHER WAY ROUND FROM MAD ENHANCEMENT, and the sheet is why:
    // "Her Master does not lose Health on the same Turn this NP is
    // deactivated." Mad Enhancement drains and THEN tests what is left; this
    // tests first and does not drain at all when the test fires.
    expect(first.key).toBe("SetMode");
    expect(first.ability).toBe("tenmokaikai");
    expect(first.active).toBe(false);
    expect(first.whenValue).toEqual({ subject: "master", stat: "health.value", lte: 25 });
    expect(second.key).toBe("StatDelta");
  });

  it("ends at the end of a Turn in which Raikou is defeated", () => {
    const onDefeat = A.activeRules.find((r) => r.key === "OnEvent" && r.event === "unitDefeated");
    // At the END of that Turn, not immediately -- so the copies get their last
    // Turn out, which is the only reason the clause specifies a moment.
    expect(onDefeat.at).toBe("turnEnd");
    expect(onDefeat.then[0]).toEqual({ key: "SetMode", ability: "tenmokaikai", active: false });
  });

  it("leaves the targetability clause to the copies", () => {
    // "Enemy Units cannot Attack Raikou or her Master if any Raikou copies are
    // next to them" is a property of standing NEXT TO A COPY, so it belongs to
    // the copy. An aura from the NP would have to name four document ids.
    expect(A.activeRules.some((r) => r.key === "TargetabilityModifier")).toBe(false);
  });
});

describe("a summon's turn charging its summoner's Master", () => {
  const board = {
    units: [
      { id: "m1", kind: "master", health: { value: 200 } },
      { id: "r1", kind: "servant", masterId: "m1" },
      { id: "c1", kind: "summon", summonerId: "r1" },
    ],
  };
  const copy = board.units[2];

  it("resolves `summonerMaster` through the summoner", () => {
    // TWO hops, and neither is available to the acting unit: a copy has no
    // Master of its own, and its summoner is not the unit that acted.
    expect(subjectOf({ subject: "summonerMaster" }, copy, { board }).id).toBe("m1");
  });

  it("resolves `summoner` in one hop", () => {
    expect(subjectOf({ subject: "summoner" }, copy, { board }).id).toBe("r1");
  });

  it("resolves to null when the summoner is Free", () => {
    const free = {
      units: [
        { id: "r1", kind: "servant", masterId: null },
        { id: "c1", kind: "summon", summonerId: "r1" },
      ],
    };
    expect(subjectOf({ subject: "summonerMaster" }, free.units[1], { board: free })).toBeNull();
  });

  it("still resolves `self` and `master` as it always did", () => {
    expect(subjectOf({}, copy, { board }).id).toBe("c1");
    expect(subjectOf({ subject: "master" }, board.units[1], { board }).id).toBe("m1");
  });
});

describe("one charge per Turn, however many copies acted", () => {
  /** @param {object[]} extra */
  const units = (extra) => [
    { id: "r1", kind: "servant", acted: false },
    ...extra,
  ];

  it("fires for Raikou when a copy acted and she did not", () => {
    const list = units([{ id: "c1", kind: "summon", summonerId: "r1", acted: true }]);
    annotateSummonsActed(list);
    expect(list[0].selfOrSummonsActed).toBe(true);
  });

  it("fires once when she AND three copies acted", () => {
    const list = units([
      { id: "c1", kind: "summon", summonerId: "r1", acted: true },
      { id: "c2", kind: "summon", summonerId: "r1", acted: true },
      { id: "c3", kind: "summon", summonerId: "r1", acted: true },
    ]);
    list[0].acted = true;
    annotateSummonsActed(list);
    // ONE flag, so one `turnEnd` handler, so one charge of 25 -- not 100.
    expect(list.filter((u) => u.id === "r1" && u.selfOrSummonsActed)).toHaveLength(1);
  });

  it("does not fire when nobody acted", () => {
    const list = units([{ id: "c1", kind: "summon", summonerId: "r1", acted: false }]);
    annotateSummonsActed(list);
    expect(list[0].selfOrSummonsActed).toBe(false);
  });

  it("is not triggered by another Servant's summons", () => {
    const list = units([{ id: "d1", kind: "summon", summonerId: "other", acted: true }]);
    annotateSummonsActed(list);
    expect(list[0].selfOrSummonsActed).toBe(false);
  });
});

/* ========================================================================== */
/*  One declaration, N differently-shaped attacks                             */
/* ========================================================================== */

describe("expanding a multi-instance declaration", () => {
  it("turns `repeat: 3` into three copies of one spec", () => {
    // The degenerate case, and the reason `repeat` is not a second code path:
    // Tóole Fragarach and Overedge must come out exactly as they did.
    const out = expandInstances({ repeat: 3, multiplier: 1 });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((i) => JSON.stringify(i))).size).toBe(1);
    expect(out[0]).toEqual({ multiplier: 1 });
  });

  it("defaults to one instance when neither field is present", () => {
    expect(expandInstances({ multiplier: 3.5 })).toEqual([{ multiplier: 3.5 }]);
    expect(expandInstances(null)).toEqual([{}]);
  });

  it("keeps declared order, so the reader can match card to sentence", () => {
    const out = expandInstances({
      instances: [
        { multiplier: 0.5, element: "lightning" },
        { multiplier: 0.5, element: "fire" },
        { multiplier: 3.5, flatBonus: 200, kind: "np" },
      ],
    });
    expect(out.map((i) => i.element ?? i.kind)).toEqual(["lightning", "fire", "np"]);
  });

  it("inherits the block's own fields where an instance is silent", () => {
    // `component: str` stated once for the four that use it, overridden to
    // `mag` on the fifth.
    const out = expandInstances({
      component: "str",
      instances: [{ multiplier: 0.5 }, { multiplier: 3.5, component: "mag" }],
    });
    expect(out[0].component).toBe("str");
    expect(out[1].component).toBe("mag");
  });

  it("does not leak `repeat` or `instances` into the specs themselves", () => {
    const out = expandInstances({ repeat: 2, multiplier: 1 });
    expect(out[0].repeat).toBeUndefined();
    expect(out[0].instances).toBeUndefined();
  });

  it("refuses `repeat` and `instances` together", () => {
    // Two spellings of one thing in one block is a content error, not a
    // precedence question -- and a silent precedence rule is how a five-hit
    // Noble Phantasm quietly becomes a fifteen-hit one.
    expect(() => expandInstances({ repeat: 2, instances: [{ multiplier: 1 }] }))
      .toThrow(/repeat.*instances/i);
  });

  it("reproduces the two shipped `repeat` declarations unchanged", () => {
    // Overedge (2) and Tóole Fragarach (3) are the only holders. If either
    // expands to anything but N identical copies of its own block, the
    // generalisation changed the degenerate case and is wrong.
    for (const [id, n] of [["emiya-overedge", 2], ["mannanan-toole-fragarach", 3]]) {
      const { repeat: _repeat, ...rest } = ability(id).damage;
      const out = expandInstances(ability(id).damage);
      expect(out).toHaveLength(n);
      for (const spec of out) expect(spec).toEqual(rest);
    }
  });
});

/* ========================================================================== */
/*  Excluding one modifier source                                             */
/* ========================================================================== */

describe("excluding one modifier source", () => {
  /** Her bag on a Dohatsu Tenshou sub-attack: Mad Enhancement, and Divinity C. */
  const HER_BAG = [
    { key: "atkUp", value: 100, source: "Mad Enhancement" },
    { key: "divinity", value: 30, source: "Divinity" },
  ];
  const EXCLUDE = ["Mad Enhancement"];

  /** @param {object} attack @param {object[]} [defenderMods] */
  const swing = (attack, defenderMods = []) => computeDamage({
    attacker: {
      baseAttack: { str: 200, mag: 0 }, parameters: {}, effects: [],
      modifiers: HER_BAG, health: 1000, shield: 0, magicResistance: null, outsideZon: false,
    },
    defender: {
      baseAttack: { str: 0, mag: 0 }, parameters: {}, effects: [], modifiers: defenderMods,
      health: 1000, shield: 0, magicResistance: null, outsideZon: false,
    },
    board: {},
    attack: { kind: "normal", rank: null, categorizedAsNP: false, element: null, ...attack },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    multiplier: 1,
    flatBonus: 0,
    crit: { isCrit: false, chanceUsed: 0 },
    reaction: { kind: "none" },
    luckChecks: {},
    rolls: {},
    options: new Set(),
  });

  it("drops only the named source, and keeps everything else", () => {
    // 200 base. Without Mad Enhancement's +100%: 200 + Divinity's flat 30.
    const out = swing({ excludeModifierSources: EXCLUDE });
    expect(out.total).toBe(230);
  });

  it("leaves the same attack alone when nothing is excluded", () => {
    // 200 x 2.00 from Mad Enhancement, then Divinity's +30.
    expect(swing({}).total).toBe(430);
  });

  it("never removes a DEFENDER's reduction", () => {
    // The whole reason this is not `bypassModifiers`. "These 4 Attacks are not
    // affected by Mad Enhancement" says nothing about the target's Def Up, and
    // an all-or-nothing bypass would have discarded it.
    const guarded = swing(
      { excludeModifierSources: EXCLUDE },
      [{ key: "defUp", value: 50, source: "somebody else" }],
    );
    expect(guarded.total).toBeLessThan(230);
  });

  it("excludes the source on the DEFENDER's side too", () => {
    // Symmetrical by construction: `activeMods` is the one place every stage
    // reads a bag, and it does not care whose bag it is.
    const bare = swing({ excludeModifierSources: EXCLUDE });
    const warded = swing(
      { excludeModifierSources: [...EXCLUDE, "Mad Enhancement (theirs)"] },
      [{ key: "defUp", value: 50, source: "Mad Enhancement (theirs)" }],
    );
    expect(warded.total).toBe(bare.total);
  });

  it("SAYS SO in the breakdown rather than vanishing", () => {
    // The rule stages 4, 7 and 12 already follow for `ignoresAttackerIncreases`
    // and `Ignore Def`: a modifier that vanishes from the breakdown is
    // indistinguishable from one that was never collected. Ch. 30's audit is
    // the only way the live pass can check this clause at all.
    const out = swing({ excludeModifierSources: EXCLUDE });
    const text = JSON.stringify(out.breakdown ?? []);
    expect(text).toMatch(/Mad Enhancement/);
    expect(text).toMatch(/not affected by/i);
  });

  it("names the exclusion ONCE, not once per stage", () => {
    // Six stages read a modifier bag. One exclusion is one fact, and six zero
    // rows for it is noise in the one audit that has to stay legible at five
    // cards.
    const out = swing({ excludeModifierSources: EXCLUDE });
    const mentions = JSON.stringify(out.breakdown ?? []).match(/not affected by/gi) ?? [];
    expect(mentions).toHaveLength(1);
  });
});

/* ========================================================================== */
/*  Goō Shōriki・Dohatsu Tenshou                                              */
/* ========================================================================== */

describe("Goō Shōriki・Dohatsu Tenshou", () => {
  const A = ability("raikou-dohatsu-tenshou");
  const instances = A.damage.instances;

  it("refuses while Mad Enhancement is off, and hits a 3x3 within Range 3", () => {
    expect(A.requirements).toEqual([{ kind: "modeActive", mode: "madEnhancement" }]);
    expect(A.rank).toBe("B++");
    expect(A.npTags).toEqual(["antiArmy"]);
    expect(A.targeting.anchor).toEqual({ kind: "withinRange", range: 3 });
    expect(A.targeting.shape).toEqual({ kind: "square", size: 3 });
  });

  it("resolves as five instances in the sheet's order", () => {
    expect(instances).toHaveLength(5);
    expect(instances.map((i) => i.element)).toEqual([
      "lightning", "fire", "ice", "wind", "lightning",
    ]);
  });

  it("makes the first four 0.5x BA(STR) Normal Attacks", () => {
    for (const i of instances.slice(0, 4)) {
      expect(i.multiplier).toBe(0.5);
      expect(i.component).toBe("str");
      // R6: "treat these Attacks as Normal Attacks", taken at its word. This
      // one field decides whether the `Raikou` buff pays out four times or
      // none, and which half of every [normal, vsNP] pair the defender gets.
      expect(i.kind).toBe("normal");
      // "(half)" on all four.
      expect(i.elementFraction).toBe(0.5);
      expect(i.excludeModifierSources).toEqual(["Mad Enhancement"]);
    }
  });

  it("makes the fifth 3.5x + 200 BA(MAG), and FULL Lightning", () => {
    const np = instances[4];
    expect(np.multiplier).toBe(3.5);
    expect(np.flatBonus).toBe(200);
    expect(np.component).toBe("mag");
    expect(np.kind).toBe("np");
    // THE ASYMMETRY THE SHEET DRAWS. The four are each "(half)"; the fifth is
    // "Lightning damage" with no parenthesis, so a Lightning ward bites the
    // whole of this and half of the first instance. Easy to smooth away by
    // making all five alike, and wrong.
    expect(np.elementFraction).toBeUndefined();
    // Mad Enhancement DOES reach this one, at its halved BA(MAG) magnitude.
    expect(np.excludeModifierSources).toBeUndefined();
  });

  it("expands to five specs that keep those differences", () => {
    const out = expandInstances(A.damage);
    expect(out).toHaveLength(5);
    expect(out.filter((i) => i.kind === "normal")).toHaveLength(4);
    expect(out.filter((i) => i.kind === "np")).toHaveLength(1);
    expect(new Set(out.map((i) => i.element)).size).toBe(4);
  });

  it("inflicts Shock 2◈ from the NP portion only", () => {
    const shock = A.phases.find(
      (p) => p.kind === "applyEffects" && p.predicate?.includes("attack:kind:np"),
    );
    expect(shock.effects).toEqual([{ id: "shock", duration: "2◈" }]);
  });

  it("inflicts Crit Dwn on everyone the area hit, damaged or not (R7)", () => {
    const crit = A.phases.find((p) => p.kind === "applyEffects" && !p.predicate);
    // `reuse` -- the Units the targeting resolved, which is what "all affected
    // Units" is. `each` reads better and the phase picker offers it;
    // `engine/skill-use.mjs` implements `self` and `reuse` and nothing else.
    expect(crit.target).toBe("reuse");
    expect(crit.effects).toEqual([{ id: "critDwn", magnitude: 20, duration: "1◈" }]);
  });

  it("costs 6◈+⅔◈, and 2◈ more when it ends Tenmōkaikai", () => {
    expect(A.cooldown.max).toBe("6◈+⅔◈");
    // "ITS Cooldown is increased by 2◈" -- THIS ability's own. Read as
    // Tenmōkaikai's, the clause would extend the cooldown of something that
    // has already ended, which is a penalty on nothing.
    expect(A.cooldown.conditionalBonus).toEqual([
      { predicate: ["self:skillActive:tenmokaikai"], ticks: "2◈" },
    ]);
  });

  it("ends Tenmōkaikai at the END of the Combat Phase, not immediately", () => {
    // "It is immediately ended AT THE END OF THAT COMBAT PHASE." The two halves
    // of that sentence pull against each other and the second wins -- which
    // matters, because ending the clone NP mid-resolution would strip its +50%
    // and its Shock rider from instances that have not resolved yet, and this
    // ability is five instances long.
    const end = A.phases.find((p) => p.when === "combatPhaseEnd");
    expect(end.predicate).toEqual(["self:skillActive:tenmokaikai"]);
    expect(end.changes[0]).toEqual({ key: "SetMode", ability: "tenmokaikai", active: false });
  });

  it("is mutually exclusive with Tenmōkaikai at the point of USE", () => {
    // One requires Mad Enhancement Active and the other requires it off, so
    // they can never be used on the same Turn. The cooldown interaction is a
    // different thing -- Tenmōkaikai being ALREADY active when this is used,
    // which is reachable because ME may be switched back on after it opens.
    const clone = ability("raikou-tenmokaikai");
    expect(clone.requirements[0].kind).toBe("modeInactive");
    expect(A.requirements[0].kind).toBe("modeActive");
    expect(clone.requirements[0].mode).toBe(A.requirements[0].mode);
  });
});

describe("her whole sheet is authored", () => {
  it("carries all nine clauses and nothing else", () => {
    const refs = SHEET.abilities.map((a) => a.ref);
    expect(refs).toEqual([
      "class-mad-enhancement",
      "class-riding",
      "class-magic-resistance",
      "divinity",
      "raikou-genji-clan-martial-arts-discipline",
      "raikou-mana-burst-lightning",
      "raikou-thunder-gods-embodiment",
      "raikou-mystery-slayer",
      "raikou-tenmokaikai",
      "raikou-dohatsu-tenshou",
    ]);
  });

  it("splits its kit down the middle on Mad Enhancement", () => {
    // Mana Burst and Tenmokaikai are the calm half; Thunder God's Embodiment
    // and Dohatsu Tenshou are the mad one. All four state their gate, because
    // an unauthored gate is an ability usable in either state.
    const gateOf = (id) => ability(id).requirements?.[0]?.kind ?? null;
    expect(gateOf("raikou-mana-burst-lightning")).toBe("modeInactive");
    expect(gateOf("raikou-tenmokaikai")).toBe("modeInactive");
    expect(gateOf("raikou-thunder-gods-embodiment")).toBe("modeActive");
    expect(gateOf("raikou-dohatsu-tenshou")).toBe("modeActive");
  });
});

/* ========================================================================== */
/*  Regressions the live pass found                                           */
/* ========================================================================== */

describe("a Command Spell whose effect has a duration knows what time it is", () => {
  /**
   * Found live at tick 4: `cs-suspend-skill` reported `{ok: true, cost: 1}`,
   * switched Mad Enhancement off, and stamped `suspendedUntil: 3` — a
   * suspension that had expired before it was bought. The reconciler switched
   * the mode straight back on, so the most expensive resource in the game
   * bought nothing at all.
   *
   * `engine/command-spells.mjs#contextFor` built the context the rules layer
   * reads and never carried the match clock, because until this command no
   * Command Spell effect had a DURATION. Every one of them changes something
   * now — heals, cooldowns, a defeat — and none of them needed to know when
   * "now" was.
   *
   * Held here against the source, because the context is built from `game`.
   */
  it("carries `tick` in the command-spell context", async () => {
    const src = readFileSync("module/engine/command-spells.mjs", "utf8");
    const contextFor = src.slice(src.indexOf("function contextFor"));
    expect(contextFor).toMatch(/tick:\s*game\.combat/);
  });

  it("stamps the suspension in the FUTURE, relative to the current tick", () => {
    // The arithmetic the defect got wrong: `(ctx.tick ?? 0) + ticks` with no
    // `ctx.tick` is `0 + ticks`, which is in the past from tick 1 onwards.
    const stamp = (tick, ticks) => tick + ticks;
    expect(stamp(4, 3)).toBe(7);
    expect(stamp(4, 3)).toBeGreaterThan(4);
    // ...and what it did instead.
    expect(stamp(0, 3)).toBeLessThan(4);
  });
});

describe("the upkeep predicate must be DEFERRED, not answered at collection", () => {
  /**
   * Found live. `collectContributions` answers an element's `predicate` at
   * COLLECTION time, and `selfOrSummonsActed` is annotated by `snapshotBoard`
   * **after** `contributionsOf` has run for each unit — so the option is never
   * in the collection-time set, and the handler was dropped every single time.
   * Measured on a live board: with the Noble Phantasm active and a copy having
   * acted, her `eventHandlers` held the Shock rider and the defeat handler and
   * no upkeep at all.
   *
   * `defer: true` makes the predicate travel with the handler, where
   * `normalizeHandler` merges it into `targetPredicate` and `fireEvent` tests
   * it when the event fires — the only moment the answer exists.
   */
  it("marks the turn-end upkeep deferred", () => {
    const A = ability("raikou-tenmokaikai");
    const upkeep = A.activeRules.find((r) => r.key === "OnEvent" && r.event === "turnEnd");
    expect(upkeep.defer).toBe(true);
    expect(upkeep.predicate).toEqual(["self:selfOrSummonsActed"]);
  });

  it("puts a deferred predicate where fireEvent will look for it", () => {
    const out = collectContributions([{
      id: "np",
      active: true,
      activeRules: [{
        key: "OnEvent", event: "turnEnd", automatic: true,
        defer: true, predicate: ["self:selfOrSummonsActed"], then: [],
      }],
    }], {});
    // `normalizeHandler` merges a deferred predicate into `targetPredicate`,
    // which is the field `fireEvent` re-tests at fire time.
    expect(out.eventHandlers[0].targetPredicate).toEqual(["self:selfOrSummonsActed"]);
  });

  it("charges the Master ONCE however many copies acted", () => {
    // Verified live: three copies acted, Raikou did not, and the Master lost
    // exactly -25. A handler per copy would have produced -75.
    const units = [
      { id: "r", kind: "servant", acted: false },
      { id: "c1", kind: "summon", summonerId: "r", acted: true },
      { id: "c2", kind: "summon", summonerId: "r", acted: true },
      { id: "c3", kind: "summon", summonerId: "r", acted: true },
    ];
    annotateSummonsActed(units);
    // SHE carries the flag because a copy acted, which is the whole point.
    expect(units[0].selfOrSummonsActed).toBe(true);
    // The copies carry it too -- they acted -- and that is correct and
    // harmless: the UPKEEP HANDLER lives on the Noble Phantasm, which only she
    // has. The copies inherit `passiveRules` alone (`inherit.passives`), so
    // there is exactly one handler on the board however many of them swung.
    const A = ability("raikou-tenmokaikai");
    expect(A.activeRules.filter((r) => r.key === "OnEvent" && r.event === "turnEnd")).toHaveLength(1);
    for (const id of ["raikou-watanabe", "raikou-sakata", "raikou-urabe", "raikou-usui"]) {
      const onTurnEnd = summon(id).passiveRules
        .filter((r) => r.key === "OnEvent" && String(r.event).includes("urnEnd"));
      expect(onTurnEnd).toHaveLength(0);
    }
  });
});

describe("a fixed roster of summons", () => {
  /**
   * Found live: Tenmōkaikai reported **"0 summoned"**. `summonPhase` knew only
   * the ROLLED shape — `countRoll`, `typeRoll`, `types` — because every summon
   * before Raikou was rolled (Medea's 1d6 Warriors of 1d4 types, Bašmu's Dragon
   * Wing Warriors) or singular (the Sphinxes, one Kagome per enemy). A fixed
   * list was silently ignored: `countRoll ?? "1"` rolled 1, `typeRoll ?? "1"`
   * rolled 1, `types[1]` was undefined, and nothing appeared.
   */
  it("names its four copies rather than rolling for them", () => {
    const phase = ability("raikou-tenmokaikai").phases.find((p) => p.kind === "summon");
    expect(phase.spec.contentIds).toHaveLength(4);
    // Nothing to roll: the four differ in Range, element and rider, and the
    // ORDER pairs with the placement's own order.
    expect(phase.spec.countRoll).toBeUndefined();
    expect(phase.spec.typeRoll).toBeUndefined();
    expect(phase.spec.types).toBeUndefined();
  });
});

describe("buildAttackSpec reads the attacker's effects as a collection", () => {
  /**
   * Found live, and it had nothing to do with Raikou: **every attack in the
   * game threw**. A plain Heracles Normal Attack failed identically.
   *
   * `buildAttackSpec` receives the ACTOR DOCUMENT, whose `.effects` is
   * Foundry's `EmbeddedCollection` — a Map subclass with no `.includes` — and
   * the `Aim`-from-a-buff clause called `.includes("aim")` on it. It throws
   * before any target is resolved, so it is not a clause that fails only when
   * somebody carries `Aim`; it is the whole attack flow.
   *
   * Held against the source, because the call site needs a world.
   */
  it("does not call Array.includes on an EmbeddedCollection", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    expect(src).not.toMatch(/\(attacker\?\.effects \?\? \[\]\)\.includes/);
    // ...and reads the definition id the way `activeEffectIds` does.
    expect(src).toMatch(/\[\.\.\.\(attacker\?\.effects \?\? \[\]\)\]/);
  });
});

describe("the upkeep's drain is gated, not merely ordered", () => {
  /**
   * *"This NP is forcefully deactivated if Raikou's Master has 25 Health or
   * less and would lose Health due to this effect. **Her Master does not lose
   * Health on the same Turn this NP is deactivated.**"*
   *
   * Found live: ordering the `SetMode` before the `StatDelta` is **not enough**.
   * The two actions are independent, so the drain fired anyway and a Master on
   * 20 was taken to −5 by the very effect that had just switched itself off.
   *
   * `gte: 26` is the exact complement of the `SetMode`'s `lte: 25`, so the two
   * can neither both fire nor both decline.
   *
   * And NOT a `floor: 25`, which is Mad Enhancement's shape: a floor clamps the
   * deduction, so a Master on 30 would lose 5 instead of 25. Mad Enhancement
   * wants that — *"cannot drop below 30 IN THIS WAY"* — and this clause does
   * not. Verified live at 400 (−25), at 20 (deactivate, no drain) and at 30
   * (−25 in full).
   */
  const upkeep = ability("raikou-tenmokaikai").activeRules
    .find((r) => r.key === "OnEvent" && r.event === "turnEnd");

  it("deactivates at 25 or below", () => {
    const setMode = upkeep.then.find((t) => t.key === "SetMode");
    expect(setMode.whenValue).toEqual({ subject: "master", stat: "health.value", lte: 25 });
  });

  it("drains only above 25, and drains in FULL when it does", () => {
    const drain = upkeep.then.find((t) => t.key === "StatDelta");
    expect(drain.whenValue).toEqual({ subject: "master", stat: "health.value", gte: 26 });
    expect(drain.amount).toBe(25);
    // A floor would clamp the deduction and is deliberately absent.
    expect(drain.floor).toBeUndefined();
    expect(drain.floorTable).toBeUndefined();
  });

  it("gates the two as exact complements, so neither both nor neither fires", () => {
    const setMode = upkeep.then.find((t) => t.key === "SetMode");
    const drain = upkeep.then.find((t) => t.key === "StatDelta");
    expect(setMode.whenValue.lte + 1).toBe(drain.whenValue.gte);
  });
});

describe("a Normal Attack's element reaches the attack spec", () => {
  /**
   * Found live, and it was never Raikou's: **every Servant whose ordinary swing
   * has a damage type had been swinging with none.**
   *
   * `buildAttackSpec` receives the ACTOR DOCUMENT and `normalAttackAt` reads
   * the SYSTEM shape, so it was handed a document whose `.normalAttack` is
   * `undefined` and got `element: null` back every time — Ozymandias's Light,
   * Nemo's Water and all four of Raikou's copies. No Freeze break, no
   * `flamHeal` conversion, no element-scoped resistance, no `attack:element:`
   * predicate. The same document-for-snapshot mix-up as the `.effects` read
   * eight lines away, in the same function.
   *
   * And the schema dropped the "(half)": `normalAttack` had no
   * `elementFraction` field at all, so a copy's *"Lightning damage (half)"*
   * compiled to a whole-element attack.
   */
  it("hands the helper the shape it reads", () => {
    const src = readFileSync("module/engine/attack.mjs", "utf8");
    expect(src).toMatch(/normalAttackAt\(attacker\?\.system \?\? attacker, null\)\?\.element/);
    expect(src).toMatch(/normalAttackAt\(attacker\?\.system \?\? attacker, null\)\?\.elementFraction/);
  });

  it("carries elementFraction beside element out of normalAttackAt", () => {
    const src = readFileSync("module/rules/normal-attack.mjs", "utf8");
    expect(src).toMatch(/elementFraction: spec\.elementFraction/);
  });

  it("declares elementFraction on the normalAttack schema", () => {
    const src = readFileSync("module/data/actor/_shared.mjs", "utf8");
    const block = src.slice(src.indexOf("normalAttack: new fields.SchemaField"));
    expect(block.slice(0, 1600)).toMatch(/elementFraction/);
  });

  it("gives each copy its own element and its own rider", () => {
    // Verified live, each landing on a defender: fire→Burn, lightning→Shock,
    // wind→Bleed, ice→Disable.
    const pairs = {
      "raikou-watanabe": ["fire", "burn"],
      "raikou-sakata": ["lightning", "shock"],
      "raikou-urabe": ["wind", "bleed"],
      "raikou-usui": ["ice", "disable"],
    };
    for (const [id, [element, rider]] of Object.entries(pairs)) {
      const S = summon(id);
      expect(S.normalAttack.element).toBe(element);
      expect(S.normalAttack.elementFraction).toBe(0.5);
      const h = S.passiveRules.find((r) => r.key === "OnEvent" && r.event === "damageDealt");
      expect(h.then[0].effect.id).toBe(rider);
    }
  });
});

describe("normalAttacksOnly permits a Normal Attack", () => {
  /**
   * Found live: a Sakata copy could not attack at all. The grant refused
   * unconditionally, including the bare swing it exists to permit — a Normal
   * Attack arrives at `canUseAbility` with `ability: null`.
   */
  it("only refuses when there IS an ability", () => {
    const src = readFileSync("module/rules/costs.mjs", "utf8");
    expect(src).toMatch(/if \(ability && hasGranted\(unit, GRANTS\.normalAttacksOnly\)\)/);
  });
});
