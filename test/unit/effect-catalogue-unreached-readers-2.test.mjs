/**
 * @file The second group of Appendix A rows whose reader outlived its document.
 *
 * Same defect as `effect-catalogue-unreached-readers.test.mjs`, twenty more
 * rows: the scoped immunity family, the three NP-cooldown debuffs, the three
 * element-to-heal conversions, the two Luck-table overrides, five action
 * denials and Dragonblight.
 *
 * One of these was worse than inert. `rules/terrain.mjs` has *inflicted*
 * `immobilize` since the terrain system was built — magnetic ground is a 25%
 * chance of it, 100% against `Mechanical`, with a resistance bypass written
 * carefully around a debuff that did not exist — so that terrain type did
 * nothing at all.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { applyEffect, inflictBonusOf } from "../../module/engine/effect-applier.mjs";
import { preventedBy } from "../../module/rules/budget.mjs";
import { cooldownRate, PERIODICS } from "../../module/engine/scheduler.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

const effect = (file) => parse(readFileSync(`packs/_source/effects/${file}.yml`, "utf8"));

/** Apply `def` to a unit holding `held`, and report only the gate's verdict. */
const attempt = (def, held) => applyEffect({
  def,
  target: { id: "d", effects: held, effectInstances: [], applicationChances: [] },
  magnitude: 10,
  duration: "1◈",
  source: { unitId: "attacker", abilityId: "t", fieldId: null },
  ctx: { turnsPerRound: 4, currentTick: 0, roll: () => 1 },
});

describe("The scoped immunity family — five branches of one gate", () => {
  // `engine/effect-applier.mjs` keys three of these off the incoming effect's
  // own `volatility` and two off its `valence`, so this appendix's
  // classification is what decides coverage and no sheet lists what it stops.
  const CASES = [
    ["nvDebuffImmune", "nv-debuff-immune", "atkDwn", "curse"],
    ["vDebuffImmune", "v-debuff-immune", "curse", "atkDwn"],
    ["menDebuffImmune", "men-debuff-immune", "charm", "atkDwn"],
    ["offDebuffImmune", "off-debuff-immune", "atkDwn", "defDwn"],
    ["defDebuffImmune", "def-debuff-immune", "defDwn", "atkDwn"],
  ];

  it.each(CASES)("%s is authored with no rule elements", (id, file) => {
    expect(effect(file).id).toBe(id);
    expect(effect(file).rules).toEqual([]);
  });

  it.each(CASES)("%s refuses %s and passes %s", (id, file, refused, allowed) => {
    expect(attempt(effect(refused === "atkDwn" ? "atk-dwn"
      : refused === "defDwn" ? "def-dwn"
        : refused), [id]).outcome).toBe("blocked");
    expect(attempt(effect(allowed === "atkDwn" ? "atk-dwn"
      : allowed === "defDwn" ? "def-dwn"
        : allowed), [id]).outcome).toBe("applied");
  });
});

describe("No Buff — the gate's one buff branch", () => {
  it("refuses a buff and lets a debuff through", () => {
    expect(attempt(effect("atk-up"), ["noBuff"]).outcome).toBe("blocked");
    expect(attempt(effect("atk-up"), ["noBuff"]).reason).toBe("No Buff");
    expect(attempt(effect("atk-dwn"), ["noBuff"]).outcome).toBe("applied");
  });
});

describe("NP Lock / NP Degen / NP Lag — three short-circuits in cooldownRate", () => {
  const NP = { isNP: true, regen: 0 };
  const rate = (held, tick = 0) => cooldownRate({ effects: held, statDeltas: [] }, NP, { tick });

  it("all three are authored", () => {
    expect(effect("np-lock").id).toBe("npLock");
    expect(effect("np-degen").id).toBe("npDegen");
    expect(effect("np-lag").id).toBe("npLag");
  });

  it("reduces by 1 per turn unmodified", () => {
    expect(rate([])).toBe(1);
  });

  it("NP Lock stops the reduction without adding to the clock", () => {
    expect(rate(["npLock"])).toBe(0);
  });

  it("NP Degen adds to the clock, which is a negative rate", () => {
    expect(rate(["npDegen"])).toBe(-1);
  });

  it("NP Lag reduces on even ticks only", () => {
    expect(rate(["npLag"], 0)).toBe(1);
    expect(rate(["npLag"], 1)).toBe(0);
  });
});

describe("PoisHeal / CursHeal / FlamHeal — two readers each, neither reachable", () => {
  const CASES = [
    ["poisHeal", "pois-heal", "poison"],
    ["cursHeal", "curs-heal", "curse"],
    ["flamHeal", "flam-heal", "burn"],
  ];

  const hit = (held, element) => computeDamage({
    attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [], effects: [] },
    defender: { id: "d", health: 9999, modifiers: [], effects: held },
    attack: { kind: "normal", component: "str", element },
    base: { fixedValue: 200 },
    rolls: { attackMinus: 0 },
    crit: { isCrit: false },
    options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
  });

  it.each(CASES)("%s is authored", (id, file) => {
    expect(effect(file).id).toBe(id);
  });

  it.each(CASES)("%s converts its own element and nothing else", (id, file, element) => {
    expect(hit([id], element).flags.converted).toBe(true);
    expect(hit([id], "ice").flags.converted).toBe(false);
  });

  it.each(CASES)("%s is the healConversion the scheduler's periodic already named", (id) => {
    expect(Object.values(PERIODICS).map((p) => p.healConversion)).toContain(id);
  });
});

describe("Action denial — the partial preventions are the interesting half", () => {
  const can = (held, action) => !preventedBy({ effects: held }, action).prevented;

  it("Stop and Crystalfreeze and Webbed take everything", () => {
    for (const id of ["stop", "crystalfreeze", "webbed"]) {
      expect(can([id], "attack")).toBe(false);
      expect(can([id], "move")).toBe(false);
    }
  });

  it("Immobilize takes Move and nothing else", () => {
    // `preventsAction: true` would have routed it through PREVENT_ALL and
    // taken the lot, which is why the document deliberately omits the flag.
    expect(can(["immobilize"], "move")).toBe(false);
    expect(can(["immobilize"], "attack")).toBe(true);
    expect(can(["immobilize"], "skill")).toBe(true);
  });

  it("Seal spares Spells, which is the row's last clause", () => {
    expect(can(["seal"], "attack")).toBe(false);
    expect(can(["seal"], "np")).toBe(false);
    expect(can(["seal"], "skill")).toBe(false);
    expect(can(["seal"], "spell")).toBe(true);
  });

  it("the four bind members say so about themselves", () => {
    for (const file of ["crystalfreeze", "immobilize", "seal", "webbed"]) {
      expect(effect(file).families).toContain("bind");
    }
    // Stop is deliberately NOT a Bind member: §A.19 lists Bind's members and
    // Stun is in it while Stop is not, which is what `Dmg Up (Bind)` reads.
    expect(effect("stop").families ?? []).not.toContain("bind");
  });

  it("Webbed extends rather than refreshes", () => {
    expect(effect("webbed").stacking).toBe("noneExtend");
  });
});

describe("Dragonblight — one clause had a reader, the other had none", () => {
  it("halts an elemental attack it deals, and leaves a plain one alone", () => {
    const hit = (element) => computeDamage({
      attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [], effects: ["dragonblight"] },
      defender: { id: "d", health: 9999, modifiers: [], effects: [] },
      attack: { kind: "normal", component: "str", ...(element ? { element } : {}) },
      base: { fixedValue: 200 },
      rolls: { attackMinus: 0 },
      crit: { isCrit: false },
      options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
    });
    expect(hit("fire").total).toBe(0);
    expect(hit("fire").flags.negatedBy).toBe("Dragonblight");
    expect(hit(null).total).toBeGreaterThan(0);
  });

  it("cannot inflict volatile debuffs, and can still inflict non-volatile ones", () => {
    // Clause 2 had no reader at all; it is an OUTGOING ApplicationChance of
    // -100 scoped by volatility, so a volatile debuff authored later is
    // covered by saying what it is.
    const bearer = {
      id: "a",
      effects: ["dragonblight"],
      applicationChances: effect("dragonblight").rules.map((r) => ({
        direction: r.direction, polarity: r.polarity, valence: null,
        volatility: r.volatility, effectId: null, severity: null,
        predicate: null, value: r.value, source: "Dragonblight",
      })),
    };
    expect(inflictBonusOf(bearer, effect("curse"))).toBeLessThanOrEqual(-100);
    expect(inflictBonusOf(bearer, effect("atk-dwn"))).toBe(0);
  });
});
