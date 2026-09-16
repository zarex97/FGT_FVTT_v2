/**
 * @file A damage resolution that reads TWO units.
 * @see docs/13-damage-pipeline.md, docs/34-case-dioscuri.md §34.6
 *
 * Two mechanisms, and the pipeline was half ready for both. Stage 1 has
 * resolved `ctx.units[src.unit]` since it was written, with `mountUnits` as its
 * only supplier — so *"half of Castor's BA(STR) and half of Pollux's"* could
 * not be authored at all. And `excludeModifierSources` has dropped a named
 * source from the bag for just as long, with no mirror that adds one.
 */

import { describe, it, expect } from "vitest";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

const bag = (mods) => mods;

/** Stage 1's row of the breakdown, by name rather than by index. */
const baseOf = (out) => out.breakdown.find((b) => b.name === "base");

/** Castor and Pollux both swing a Base Attack (STR) of 150 (R1). */
const twin = (id, modifiers = [], str = 150) => ({
  id, name: id, baseAttack: { str, mag: 150 }, modifiers: bag(modifiers),
});

const atkUp = (sourceUnitId) => ({
  key: "atkUp", modifierKey: "atkUp", direction: "dealt", value: 15,
  source: "Guardians of Navigation", sourceUnitId,
});

/** @param {object} over @returns {object} */
function ctx(over = {}) {
  return {
    attacker: twin("castor"),
    defender: { id: "enemy", health: 9999, modifiers: [] },
    attack: { kind: "np", component: "str" },
    base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
    rolls: { attackMinus: 0 },
    crit: { isCrit: false },
    options: rollOptionsFor({ attacker: {}, defender: {}, attack: { kind: "np", component: "str" } }),
    ...over,
  };
}

/* ── N4 — the partner as a named Base Attack source ───────────────────────── */

describe("N4 — a Base Attack source may name the linked partner", () => {
  it("reads the PARTNER's Base Attack, not the attacker's twice", () => {
    // The partner is given 250 rather than her real 150 deliberately: with two
    // equal twins, a silent fallback to the attacker produces the same total
    // and the test proves nothing. 75 + 125 = 200 can only come from Pollux.
    const out = computeDamage(ctx({
      units: { partner: twin("pollux", [], 250) },
      base: {
        sources: [
          { unit: "self", component: "str", factor: 0.5 },
          { unit: "partner", component: "str", factor: 0.5 },
        ],
      },
    }));
    expect(baseOf(out).after.phys).toBe(200);
  });

  it("gives the joint NP a Base Attack of 150 at the twins' real figures", () => {
    // Castor 150, Pollux 150 (the rank table, not her sheet's 200 — R1).
    // Half of each: 75 + 75 = 150. The sheet prints 175, computed from the
    // 200 the table overrules.
    const out = computeDamage(ctx({
      units: { partner: twin("pollux") },
      base: {
        sources: [
          { unit: "self", component: "str", factor: 0.5 },
          { unit: "partner", component: "str", factor: 0.5 },
        ],
      },
    }));
    expect(baseOf(out).after.phys).toBe(150);
  });

  it("attributes each half to the twin it came from", () => {
    const out = computeDamage(ctx({
      units: { partner: twin("pollux") },
      base: {
        sources: [
          { unit: "self", component: "str", factor: 0.5 },
          { unit: "partner", component: "str", factor: 0.5 },
        ],
      },
    }));
    const stage1 = JSON.stringify(baseOf(out));
    expect(stage1).toMatch(/self/);
    expect(stage1).toMatch(/partner/);
  });

  it("falls back to the attacker when no partner is supplied", () => {
    // Existing stage-1 behaviour, pinned so it does not change: a twin
    // fighting alone still swings its own Base Attack rather than zero.
    const out = computeDamage(ctx({
      units: {},
      base: { sources: [{ unit: "partner", component: "str", factor: 0.5 }] },
    }));
    expect(baseOf(out).after.phys).toBe(75);
  });
});

/* ── N9 / R6 — the union of two modifier bags ─────────────────────────────── */

describe("N9/R6 — the joint NP combines both twins' modifiers, double-counting", () => {
  it("counts both twins' Atk Up rather than one", () => {
    // Ch. 41 Q12, answered by the game's author: "yes, they double-count."
    // One Guardians of Navigation cast that buffed both twins gives this NP
    // +30%, not +15%, and that is what a 6◈ cooldown buys.
    const both = computeDamage(ctx({
      attacker: twin("castor", [atkUp("castor")]),
      units: { partner: twin("pollux", [atkUp("pollux")]) },
      attack: { kind: "np", component: "str", modifierSources: ["partner"] },
    }));
    const alone = computeDamage(ctx({
      attacker: twin("castor", [atkUp("castor")]),
      units: { partner: twin("pollux", [atkUp("pollux")]) },
    }));
    expect(both.total).toBeGreaterThan(alone.total);
  });

  it("names which twin each unioned modifier came from", () => {
    // A doubled figure looks like a bug in the explainer unless the breakdown
    // says whose it was. The audit line is part of the feature.
    const out = computeDamage(ctx({
      attacker: twin("castor", [atkUp("castor")]),
      units: { partner: twin("pollux", [atkUp("pollux")]) },
      attack: { kind: "np", component: "str", modifierSources: ["partner"] },
    }));
    const text = JSON.stringify(out.breakdown);
    expect(text).toMatch(/pollux/i);
  });

  it("changes nothing for an attack that names no extra sources", () => {
    const withPartnerAvailable = computeDamage(ctx({
      attacker: twin("castor", [atkUp("castor")]),
      units: { partner: twin("pollux", [atkUp("pollux")]) },
    }));
    const withNoPartnerAtAll = computeDamage(ctx({
      attacker: twin("castor", [atkUp("castor")]),
      units: {},
    }));
    expect(withPartnerAvailable.total).toBe(withNoPartnerAtAll.total);
  });

  it("does not union the attacker into itself", () => {
    // A `modifierSources` entry resolving to the attacker would double every
    // modifier it already has, which is the one way this could silently
    // inflate an ordinary attack.
    const once = computeDamage(ctx({ attacker: twin("castor", [atkUp("castor")]) }));
    const named = computeDamage(ctx({
      attacker: twin("castor", [atkUp("castor")]),
      units: { partner: twin("castor", [atkUp("castor")]) },
      attack: { kind: "np", component: "str", modifierSources: ["partner"] },
    }));
    expect(named.total).toBe(once.total);
  });
});

/* ── Avenger: the only class skill that hurts its own bearer ──────────────── */

describe("C6/C7 — Avenger's drawback and its offset", () => {
  const avenger = (id) => ({
    id, name: id, baseAttack: { str: 150, mag: 150 }, modifiers: [],
  });
  const taken80 = {
    key: "avenger", modifierKey: "avenger", direction: "taken",
    value: 80, includesNP: true, source: "Avenger",
  };

  it("adds 80 to what the bearer takes", () => {
    const bare = computeDamage(ctx({ defender: { id: "castor", health: 9999, modifiers: [] } }));
    const hurt = computeDamage(ctx({ defender: { id: "castor", health: 9999, modifiers: [taken80] } }));
    expect(hurt.total - bare.total).toBe(80);
  });

  it("adds it to a Noble Phantasm too", () => {
    const np = { kind: "np", component: "str" };
    const bare = computeDamage(ctx({ attack: np, defender: { id: "c", health: 9999, modifiers: [] } }));
    const hurt = computeDamage(ctx({ attack: np, defender: { id: "c", health: 9999, modifiers: [taken80] } }));
    expect(hurt.total - bare.total).toBe(80);
  });

  it("is NOT a defence a Heel Attack bypasses", () => {
    // Authored as a negative `flatReduction` it would have landed at stage 12,
    // which `bypassesDefence` drops wholesale -- and Avenger is a
    // vulnerability, not a resistance. A Pierce must not switch off the
    // drawback its bearer is stuck with.
    const pierced = computeDamage(ctx({
      attack: { kind: "np", component: "str", pierce: true },
      defender: { id: "castor", health: 9999, modifiers: [taken80] },
    }));
    const plain = computeDamage(ctx({
      attack: { kind: "np", component: "str", pierce: true },
      defender: { id: "castor", health: 9999, modifiers: [] },
    }));
    expect(pierced.total - plain.total).toBe(80);
  });

  it("names itself in the breakdown, on the DEFENDER's side", () => {
    const out = computeDamage(ctx({ defender: { id: "castor", health: 9999, modifiers: [taken80] } }));
    const stage7 = out.breakdown.find((b) => b.name === "flatAttackBonuses");
    // `source` is the modifier KEY and `note` is the human label -- the shape
    // every other stage's contributors use.
    const entry = stage7.contributors.find((c) => c.note === "Avenger");
    expect(entry).toBeDefined();
    expect(entry.source).toBe("avenger");
    expect(entry.side).toBe("defender");
  });
});
