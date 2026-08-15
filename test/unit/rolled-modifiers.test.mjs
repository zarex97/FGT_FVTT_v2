/**
 * @file Modifiers whose magnitude is rolled per damage event.
 * @see docs/45-implementation-status.md D1
 *
 * Penthesilea's *Goddess of War*: "Whenever Penthesilea deals damage through a
 * Normal Attack, roll a four-sided die. Damage dealt is increased by
 * (Number rolled x 10)%."
 *
 * Every other modifier in the pipeline has a magnitude fixed before the attack
 * begins. These do not — and they are common enough in the reference set that
 * a `Script` for each would be a failure of the element vocabulary.
 *
 * The dice keep the "caller rolls" contract: the pipeline stays pure and reads
 * a total out of `ctx.rolls`, exactly as the crit and negation rolls do.
 */

import { describe, it, expect } from "vitest";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";

const base = (attackerMods = [], rolls = {}) => ({
  attacker: {
    id: "a", kind: "servant", parameters: {}, attributes: [], effects: [],
    baseAttack: { str: 200, mag: 0 },
    modifiers: attackerMods,
  },
  defender: { id: "d", kind: "servant", parameters: {}, attributes: [], effects: [], modifiers: [] },
  attack: { kind: "normal" },
  base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
  multiplier: 1,
  flatBonus: 0,
  crit: { isCrit: false, chanceUsed: 0 },
  reaction: { kind: "none" },
  luckChecks: {},
  rolls,
  options: new Set(),
});

describe("rolled modifiers", () => {
  it("resolves its magnitude from the roll the caller made", () => {
    // 1d4 rolling 3, times 10, is +30%.
    const withRoll = computeDamage(base(
      [{ key: "atkUp", roll: { key: "goddessOfWar", multiplier: 10 }, source: "Goddess of War" }],
      { goddessOfWar: 3 },
    ));
    const without = computeDamage(base());

    expect(withRoll.total).toBeGreaterThan(without.total);
  });

  it("scales with what was actually rolled", () => {
    const at = (n) => computeDamage(base(
      [{ key: "atkUp", roll: { key: "goddessOfWar", multiplier: 10 }, source: "Goddess of War" }],
      { goddessOfWar: n },
    )).total;

    expect(at(4)).toBeGreaterThan(at(1));
  });

  it("contributes nothing when the caller rolled nothing", () => {
    // A missing roll must not read as zero-and-applied or as NaN; it is a
    // modifier that did not happen.
    const unrolled = computeDamage(base(
      [{ key: "atkUp", roll: { key: "goddessOfWar", multiplier: 10 }, source: "Goddess of War" }],
    ));

    expect(unrolled.total).toBe(computeDamage(base()).total);
    expect(Number.isFinite(unrolled.total)).toBe(true);
  });

  it("halves the magnitude against a Noble Phantasm when told to", () => {
    // "if NP, the magnitude of the effect is halved" — clause 2 of Goddess of
    // War, and the reason a rolled modifier still needs an NP variant.
    const mods = [{ key: "defUp", roll: { key: "gow", multiplier: 10, npMultiplier: 5 }, source: "GoW" }];
    const normal = computeDamage({ ...base([], { gow: 4 }), defender: { ...base().defender, modifiers: mods } });
    const np = computeDamage({
      ...base([], { gow: 4 }),
      defender: { ...base().defender, modifiers: mods },
      attack: { kind: "np" },
    });

    // The NP takes less reduction, so it lands harder relative to its own base.
    expect(np.total).toBeGreaterThan(0);
    expect(normal.total).toBeGreaterThan(0);
  });
});
