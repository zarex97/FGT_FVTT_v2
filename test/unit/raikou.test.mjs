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
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { canToggleMode, forcedModes } from "../../module/rules/modes.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { resolveRef } from "../../tools/lib/content.mjs";
import { applyEffect } from "../../module/engine/effect-applier.mjs";

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
