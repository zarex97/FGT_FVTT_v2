/**
 * @file Magic Resistance's second passive, which had no reader.
 * @see packs/_source/class-skills/magic-resistance.yml, module/engine/effect-applier.mjs
 *
 * *"Chance of being inflicted by debuffs is reduced by 25%"* was authored as a
 * `CheckModifier`, which lands in `unit.checkModifiers`. The effect applier
 * reads resistance off `unit.applicationChances`. So the most common defensive
 * class skill in the game reduced nobody's debuff chance by anything, in every
 * Servant that has it.
 *
 * The severity clause is the half that needed new machinery: *"also affects
 * Instakill and Death **unless** ... from an Attack/Attack Skill/Spell/NP that
 * deals STR damage or that is not affected by Magic Resistance. Erase is
 * completely unaffected."*
 */

import { describe, it, expect } from "vitest";
import { applyEffect } from "../../module/engine/effect-applier.mjs";
import { collectContributions } from "../../module/rules/elements.mjs";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { substitute } from "../../tools/lib/content.mjs";

/** Magic Resistance at a given rank, as a Servant carries it. */
function magicResistance(rank) {
  const template = parse(readFileSync("packs/_source/class-skills/magic-resistance.yml", "utf8"));
  return { id: "mr", slug: "magicResistance", ...substitute(template, { rank }) };
}

/** Everything Magic Resistance contributes to a unit at `rank`. */
function contributionsAt(rank) {
  return collectContributions([magicResistance(rank)], { options: new Set() });
}

const debuff = (over = {}) => ({
  id: "stun", name: "Stun", polarity: "debuff", volatility: "volatile",
  valence: "offensive", baseChance: 100, severity: "normal", ...over,
});

const bearer = (rank = "A") => ({
  id: "scathach", effects: [], effectInstances: [],
  applicationChances: contributionsAt(rank).applicationChances,
});

describe("the debuff clause", () => {
  it("reaches applicationChances, which is what the applier reads", () => {
    // Not `checkModifiers`. That is where it went for the whole life of the
    // project, and nothing there is ever consulted for an effect application.
    expect(contributionsAt("A").applicationChances.length).toBeGreaterThan(0);
  });

  it("reduces an ordinary debuff by the rank table", () => {
    // Rank A → 25%. A 100% Stun becomes 75%, so a roll of 80 now misses.
    const out = applyEffect({
      def: debuff(), target: bearer("A"), source: {},
      ctx: { roll: 80, currentTick: 0, turnsPerRound: 3, options: new Set() },
    });

    expect(out.outcome).toBe("resisted");
    expect(out.trace.find((t) => t.step === "chance").detail).toContain("75%");
  });

  it("scales with rank", () => {
    // C → 15%. The same roll of 80 lands, because 85% covers it.
    const out = applyEffect({
      def: debuff(), target: bearer("C"), source: {},
      ctx: { roll: 80, currentTick: 0, turnsPerRound: 3, options: new Set() },
    });
    expect(out.outcome).toBe("applied");
  });
});

describe("the severity ladder", () => {
  const instakill = debuff({ id: "instakill", severity: "instakill", terminal: { kind: "reduceToZero" } });

  it("covers Instakill from a MAG source", () => {
    const out = applyEffect({
      def: instakill, target: { ...bearer("A"), health: 500 }, source: {},
      ctx: { roll: 80, currentTick: 0, turnsPerRound: 3, options: new Set(["attack:component:mag"]) },
    });
    expect(out.outcome).toBe("resisted");
  });

  it("does NOT cover Instakill from a STR source", () => {
    // Scáthach's own Gáe Bolg Alternative is exactly this: a 75% Instakill on
    // an NP that "uses Base Attack (STR)". A Magic Resistance that reduced it
    // would be reading the wrong half of its own text.
    const out = applyEffect({
      def: instakill, target: { ...bearer("A"), health: 500 }, source: {},
      ctx: { roll: 80, currentTick: 0, turnsPerRound: 3, options: new Set(["attack:component:str"]) },
    });
    expect(out.outcome).toBe("applied");
  });

  it("does NOT cover an attack declared unaffected by Magic Resistance", () => {
    const out = applyEffect({
      def: instakill, target: { ...bearer("A"), health: 500 }, source: {},
      ctx: {
        roll: 80, currentTick: 0, turnsPerRound: 3,
        options: new Set(["attack:component:mag", "attack:ignoresMagicResistance"]),
      },
    });
    expect(out.outcome).toBe("applied");
  });

  it("leaves Erase completely unaffected", () => {
    // "Erase is completely unaffected" — so the tier is absent from the
    // contribution rather than present at a reduced magnitude.
    const erase = debuff({ id: "erase", severity: "erase", terminal: { kind: "defeat" } });
    const out = applyEffect({
      def: erase, target: bearer("A"), source: {},
      ctx: { roll: 100, currentTick: 0, turnsPerRound: 3, options: new Set(["attack:component:mag"]) },
    });
    expect(out.outcome).toBe("applied");
  });
});
