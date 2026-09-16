/**
 * @file Anastasia & Viy, against her sheet.
 * @see char_orig_sheets/Copia de Anastasia & Viy.md
 *
 * Pinned to the SHEET and to the documentation rather than to the
 * implementation. Every `it` names the clause it holds.
 */

import { describe, it, expect } from "vitest";
import { chanceFromDistance } from "../../module/rules/miss.mjs";

describe("a distance-scaled chance (R3)", () => {
  // *"a 5% chance of inflicting Instakill for each panel between Anastasia and
  // the DU."* The corpus's only other use of "panels between" is the Dioscuri
  // sheet's *"the maximum distance between the two is 2 panels between them"*,
  // which means Chebyshev 2 and is implemented as such -- so this is the
  // DISTANCE, not the gap.
  it("scales with the distance", () => {
    expect(chanceFromDistance(5, 1)).toBe(5);
    expect(chanceFromDistance(5, 3)).toBe(15);
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("reaches 30% at her maximum reach -- Range 3 plus the NP's +3", () => {
    // Not a clamp in the function; a fact about her, recorded so a later reach
    // change shows up as a test failure rather than as a silent buff.
    expect(chanceFromDistance(5, 6)).toBe(30);
  });

  it("is zero at no distance at all", () => {
    expect(chanceFromDistance(5, 0)).toBe(0);
  });

  it("never exceeds 100", () => {
    expect(chanceFromDistance(5, 40)).toBe(100);
  });

  it("answers zero when the distance is unknown", () => {
    // A snapshot taken off the board has no panel. Guessing would be worse than
    // declining -- the same reading `normalAttackAt` takes of an unknown range.
    expect(chanceFromDistance(5, null)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

const effect = (id) => parse(readFileSync(`packs/_source/effects/${id}.yml`, "utf8"));

const hit = (over = {}) => computeDamage({
  attacker: { id: "a", baseAttack: { str: 200, mag: 200 }, modifiers: [] },
  defender: { id: "d", health: 9999, modifiers: [], effects: [] },
  attack: { kind: "normal", component: "str" },
  base: { fixedValue: 200 },
  rolls: { attackMinus: 0 },
  crit: { isCrit: false },
  options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "normal" } }),
  ...over,
});

const frozen = (over = {}) => hit({
  defender: { id: "d", health: 9999, modifiers: [], effects: ["freeze"] }, ...over,
});

describe("Freeze — the pipeline has carried its behaviour unexercised", () => {
  it("is authored at all", () => {
    expect(effect("freeze").id).toBe("freeze");
  });

  it("prevents the bearer acting", () => {
    // `rules/budget.mjs#preventedBy` reads `freeze` in its blanket list, and
    // has since it was written.
    expect(effect("freeze").preventsAction).toBe(true);
  });

  it("absorbs an attack under 150 entirely", () => {
    const out = frozen({ base: { fixedValue: 120 } });
    expect(out.total).toBe(0);
    expect(out.flags.negatedBy).toBe("Freeze");
  });

  it("passes the excess of an attack at or over 150, and breaks", () => {
    const out = frozen({ base: { fixedValue: 200 } });
    expect(out.total).toBe(200);
    expect(out.flags.removeFreeze).toBe(true);
  });

  it("is broken by ANY Fire damage, with no damage and no effects", () => {
    const out = frozen({
      attack: { kind: "normal", component: "str", element: "fire" },
      base: { fixedValue: 500 },
    });
    expect(out.total).toBe(0);
    expect(out.flags.removeFreeze).toBe(true);
  });

  it("ticks 100 Ice at the end of each Round", () => {
    const rule = effect("freeze").rules[0];
    expect(rule.event).toBe("roundEnd");
    expect(rule.then[0]).toMatchObject({ stat: "health.value", delta: -100 });
  });
});

describe("Invuln — likewise", () => {
  const invulnerable = (over = {}) => hit({
    defender: { id: "d", health: 9999, modifiers: [], effects: ["invuln"] }, ...over,
  });

  it("is authored at all", () => {
    expect(effect("invuln").id).toBe("invuln");
  });

  it("negates an ordinary attack", () => {
    expect(invulnerable({ base: { fixedValue: 300 } }).total).toBe(0);
  });

  it("is ignored by Pierce", () => {
    const out = invulnerable({
      attack: { kind: "normal", component: "str", pierce: true },
      base: { fixedValue: 300 },
    });
    expect(out.total).toBeGreaterThan(0);
  });

  it("forbids the Block rung", () => {
    expect(effect("invuln").rules[0]).toMatchObject({ key: "ForbidReaction", reactions: ["block"] });
  });
});
