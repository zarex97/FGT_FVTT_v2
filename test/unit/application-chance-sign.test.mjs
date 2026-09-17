/**
 * @file The SIGN of an incoming `ApplicationChance`, across the whole corpus.
 * @see module/engine/effect-applier.mjs, docs/46-roster-re-audit.md §46.4-J
 *
 * `rules/checks.mjs#applicationChance` computes `base + inflictBonus - resist`,
 * so for an **incoming** contribution a POSITIVE value resists and a NEGATIVE
 * one is a vulnerability. `effects/soaked.yml` states that convention outright
 * and `effects/nameless-forest-resistance.yml` restates it — and four authored
 * clauses still landed on the wrong side of it, in both directions.
 *
 * The failure is silent by construction: the effect applies, the sheet shows
 * it, and the only evidence is a percentage nobody reads. Heracles's Bravery
 * says *"Chance of being inflicted with Mental Debuffs is reduced by 50%"* and
 * measured **150%** on a live board — twice as likely as carrying nothing.
 *
 * These are behavioural rather than source assertions on purpose: the sign is
 * only wrong relative to what the applier does with it, so the applier is what
 * has to be asked.
 */

import { describe, it, expect } from "vitest";
import { applyEffect } from "../../module/engine/effect-applier.mjs";

/** A mental debuff, the tier Bravery and Mental Pollution both name. */
const charm = {
  id: "charm", name: "Charm", polarity: "debuff",
  volatility: "mental", baseChance: 100,
};
/** A plain debuff, for the clauses that name no volatility. */
const atkDwn = {
  id: "atkDwn", name: "Atk Dwn", polarity: "debuff",
  volatility: "nonVolatile", baseChance: 100,
};

const target = (applicationChances) => ({
  id: "t", health: 800, effects: [], effectInstances: [], applicationChances,
});

/** The percentage the chance step actually resolved to. */
const percentOf = (result) => {
  const step = (result.trace ?? []).find((t) => t.step === "chance");
  return Number(String(step?.detail ?? "").match(/(-?\d+)%/)?.[1]);
};

const press = (def, chances) => percentOf(applyEffect({
  def, target: target(chances), source: {},
  ctx: { roll: 1, currentTick: 0, turnsPerRound: 3, options: new Set() },
}));

describe("a clause that RESISTS subtracts from the chance", () => {
  it("Bravery: 'inflicted with Mental Debuffs is reduced by 50%' lands at 50, not 150", () => {
    expect(press(charm, [
      { direction: "incoming", volatility: "mental", value: 50, source: "Bravery" },
    ])).toBe(50);
  });

  it("Jack's Mental Pollution: 'reduced by 60%' lands at 40", () => {
    expect(press(charm, [
      { direction: "incoming", volatility: "mental", value: 60, source: "Mental Pollution" },
    ])).toBe(40);
  });

  it("the same magnitude with the sign flipped is a VULNERABILITY, not a resist", () => {
    // The defect's shape, stated as the thing it is: -50 does not halve the
    // chance, it raises it by half again.
    expect(press(charm, [
      { direction: "incoming", volatility: "mental", value: -50 },
    ])).toBe(150);
  });
});

describe("a clause that makes a Unit MORE susceptible adds to the chance", () => {
  it("Doomsday Come: 'chance of being inflicted by debuffs +50%' lands at 150", () => {
    expect(press(atkDwn, [
      { direction: "incoming", severity: "normal", value: -50, source: "Doomsday Come" },
    ])).toBe(150);
  });
});

describe("the corpus's authored values sit on the right side of the convention", () => {
  // Read from the source rather than restated, so a future edit that flips a
  // sign is caught here and not on a board six months later. Only the clauses
  // whose prose is unambiguous about direction are judged; the rest are the
  // author's call and this test has no business guessing at them.
  it("every clause whose prose says 'being inflicted ... reduced by' resists", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { parse } = await import("yaml");

    /** @type {string[]} */
    const wrong = [];
    const judge = (doc, file) => {
      const prose = String(doc?.description ?? "");
      if (!/being inflicted[^.]*reduced by/i.test(prose)) return;
      const rules = [...(doc.passiveRules ?? []), ...(doc.rules ?? [])];
      for (const rule of rules) {
        if (rule?.key !== "ApplicationChance") continue;
        if ((rule.direction ?? "incoming") !== "incoming") continue;
        const value = Number(rule.value);
        if (Number.isFinite(value) && value < 0) {
          wrong.push(`${file}: prose says "reduced by", authored ${value}`);
        }
      }
    };

    for (const dir of readdirSync("packs/_source")) {
      const p = join("packs/_source", dir);
      if (!statSync(p).isDirectory()) continue;
      for (const f of readdirSync(p)) {
        if (!f.endsWith(".yml")) continue;
        const file = join(p, f);
        try { judge(parse(readFileSync(file, "utf8")), file); } catch { /* not a doc */ }
      }
    }
    expect(wrong).toEqual([]);
  });
});
