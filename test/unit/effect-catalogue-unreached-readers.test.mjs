/**
 * @file Appendix A entries whose ENGINE READER already existed and whose
 * document did not.
 *
 * This project's dominant defect is a rule that is right and inert, and this
 * group is the purest instance of it in the corpus: eleven catalogue rows whose
 * behaviour was already implemented -- a pipeline stage, a crit short-circuit,
 * a reaction flag -- and which no Unit could ever be given, because the effect
 * document the reader tests for by name did not exist.
 *
 * Every assertion below therefore has two halves: the document is authored, and
 * the reader it was written for actually moves.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";
import { critChance } from "../../module/rules/checks.mjs";
import { canCounter } from "../../module/engine/combat-process.mjs";

const effect = (file) => parse(readFileSync(`packs/_source/effects/${file}.yml`, "utf8"));

const ATTACKER = { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [], effects: [] };
const DEFENDER = { id: "d", health: 9999, modifiers: [], effects: [] };

const hit = (over = {}) => computeDamage({
  attacker: ATTACKER,
  defender: DEFENDER,
  attack: { kind: "normal", component: "str" },
  base: { fixedValue: 200 },
  rolls: { attackMinus: 0 },
  crit: { isCrit: false },
  options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
  ...over,
});

/** Stage 4's contributor list, which is where a percentage bucket is auditable. */
const stage4 = (res) => res.breakdown.find((b) => b.name === "combinedPercent")?.contributors ?? [];

describe("Substitution — the top rung of the Dodge/Aim ladder", () => {
  it("is authored, and carries no rule elements", () => {
    const def = effect("substitution");
    expect(def.id).toBe("substitution");
    expect(def.rules).toEqual([]);
  });

  it("halts the pipeline at stage 0", () => {
    const out = hit({ defender: { ...DEFENDER, effects: ["substitution"] } });
    expect(out.total).toBe(0);
    expect(out.flags.negatedBy).toBe("Substitution");
  });

  it("refuses a Noble Phantasm carrying Fixed damage too", () => {
    // "Cannot be hit by ANYTHING, including NP and Fixed" -- stage 0 is before
    // the attack is measured, which is what makes the clause absolute.
    const out = hit({
      defender: { ...DEFENDER, effects: ["substitution"] },
      attack: { kind: "np", component: "str" },
      base: { fixedValue: 500, fixed: 500 },
    });
    expect(out.total).toBe(0);
  });
});

describe("Endure — lethal damage leaves the unit at 1 Health", () => {
  it("is authored", () => {
    expect(effect("endure").id).toBe("endure");
  });

  it("clamps a lethal total to one short of the defender's Health", () => {
    const out = hit({
      defender: { ...DEFENDER, health: 300, effects: ["endure"] },
      base: { fixedValue: 5000 },
    });
    expect(out.total).toBe(299);
  });

  it("does NOT save a unit already at 1 Health", () => {
    // The pipeline's own guard is `d.health > 1`. Endure prevents the drop TO
    // zero; it is not a revival, and a unit with nothing left to lose keeps
    // losing it.
    const out = hit({
      defender: { ...DEFENDER, health: 1, effects: ["endure"] },
      base: { fixedValue: 5000 },
    });
    expect(out.total).toBeGreaterThan(1);
  });
});

describe("Ward — a predicated Def Up that does NOT take the NP reduction", () => {
  it("is authored, and states its magnitude once", () => {
    const def = effect("ward");
    expect(def.rules).toHaveLength(1);
    expect(def.rules[0].key).toBe("Ward");
    expect(def.rules[0].value).toBe("@magnitude");
  });

  it("omits npValue, which is how 'including NP' is asserted", () => {
    // An absent npValue makes the pipeline fall back to `value` against a
    // Noble Phantasm. Writing `npValue: "@magnitude"` reads as the same
    // assertion and is not one -- that token is only substituted into `value`,
    // so it resolved to null and the field was dropped. Six content files
    // carried the dead line; `tools/lib/content.mjs` now refuses it.
    expect(effect("ward").rules[0].npValue).toBeUndefined();
  });

  it("applies at full magnitude against a Noble Phantasm", () => {
    const defender = {
      ...DEFENDER,
      modifiers: [
        { key: "ward", value: 50, source: "ward" },
        // Beside a Def Up that DOES reduce, so the two readings are told apart
        // by the same run rather than by two separate expectations.
        { key: "defUp", value: 40, npValue: 20, source: "Def Up" },
      ],
    };
    const normal = stage4(hit({ defender }));
    const np = stage4(hit({ defender, attack: { kind: "np", component: "str" } }));

    expect(normal.find((c) => c.source === "ward").value).toBe(-50);
    expect(np.find((c) => c.source === "ward").value).toBe(-50);
    expect(normal.find((c) => c.source === "defUp").value).toBe(-40);
    expect(np.find((c) => c.source === "defUp").value).toBe(-20);
  });
});

describe("Def Crk — flat damage taken, exempt from the Injury threshold", () => {
  it("is categorized as defDwn", () => {
    expect(effect("def-crk").families).toContain("defDwn");
  });

  it("adds its magnitude flat at stage 16", () => {
    const plain = hit().total;
    const cracked = hit({
      defender: { ...DEFENDER, modifiers: [{ key: "defCrk", value: 75, source: "Def Crk" }] },
    }).total;
    expect(cracked).toBe(plain + 75);
  });

  it("does not push the total over the Injury threshold", () => {
    // The snapshot is taken BEFORE the addition, which is the clause this row
    // of Appendix A exists to state.
    const out = hit({
      base: { fixedValue: 30 },
      defender: { ...DEFENDER, modifiers: [{ key: "defCrk", value: 500, source: "Def Crk" }] },
    });
    expect(out.flags.exceededInjuryThreshold).toBe(false);
  });
});

describe("Crit ResUp / Crit ResDwn — the incoming half of the crit-damage family", () => {
  const crit = (mods) => hit({
    defender: { ...DEFENDER, modifiers: mods },
    crit: { isCrit: true, chanceUsed: 50 },
    rolls: { attackPlus: 100 },
  }).total;

  it("both are authored", () => {
    expect(effect("crit-res-up").id).toBe("critResUp");
    expect(effect("crit-res-dwn").id).toBe("critResDwn");
  });

  it("reduces and increases the crit roll respectively", () => {
    const plain = crit([]);
    expect(crit([{ key: "critResUp", value: 40, source: "Crit ResUp" }])).toBeLessThan(plain);
    expect(crit([{ key: "critResDwn", value: 40, source: "Crit ResDwn" }])).toBeGreaterThan(plain);
  });

  it("does nothing on a non-crit, because stage 2 acts on the 5d10 only", () => {
    const plain = hit().total;
    const warded = hit({
      defender: { ...DEFENDER, modifiers: [{ key: "critResUp", value: 40, source: "Crit ResUp" }] },
    }).total;
    expect(warded).toBe(plain);
  });
});

describe("Over Crit — crit chance past 100% becomes crit damage", () => {
  const at = (chance, effects) => hit({
    attacker: { ...ATTACKER, effects },
    crit: { isCrit: true, chanceUsed: chance },
    rolls: { attackPlus: 100 },
  }).total;

  it("is authored with no rule elements", () => {
    expect(effect("over-crit").rules).toEqual([]);
  });

  it("pays nothing while crit chance is at or below 100%", () => {
    expect(at(80, ["overCrit"])).toBe(at(80, []));
    expect(at(100, ["overCrit"])).toBe(at(100, []));
  });

  it("pays the excess above 100% as crit damage", () => {
    // 160% chance -> +60% on the 5d10 roll of 100, i.e. +60 damage.
    expect(at(160, ["overCrit"])).toBe(at(160, []) + 60);
  });
});

describe("G.Crit / No Crit — the two short-circuits in critChance", () => {
  it("both are authored with no rule elements", () => {
    expect(effect("g-crit").rules).toEqual([]);
    expect(effect("no-crit").rules).toEqual([]);
  });

  it("G.Crit is automatic rather than a +100% modifier", () => {
    const out = critChance({ ...ATTACKER, effects: ["gCrit"] }, { kind: "normal" });
    expect(out.percent).toBe(100);
    expect(out.automatic).toBe(true);
  });

  it("No Crit blocks outright, so no Crit Up can outbid it", () => {
    const out = critChance({
      ...ATTACKER,
      effects: ["noCrit"],
      modifiers: [{ key: "critUp", value: 500, source: "Crit Up" }],
    }, { kind: "normal" });
    expect(out.percent).toBe(0);
    expect(out.blocked).toBe(true);
  });
});

describe("Accel — opponents cannot React", () => {
  it("is authored with no rule elements", () => {
    expect(effect("accel").rules).toEqual([]);
  });

  it("closes the Counter rung", () => {
    const base = {
      defenderAlive: true, attackerInRange: true, defenderCanAct: true,
      defenderForbids: [], chainMode: "single",
    };
    expect(canCounter({ evaded: true }, base)).toBe(true);
    expect(canCounter({ evaded: true }, { ...base, attackerHasAccel: true })).toBe(false);
  });
});
