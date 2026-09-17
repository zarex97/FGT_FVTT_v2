/**
 * @file Who fills a barrier's pool.
 * @see module/engine/skill-use.mjs, module/engine/shield.mjs, docs/46 §46.4-AE
 *
 * *"Semiramis or an allied Unit within a 2 panel area of herself is Attacked;
 * the Unit gains the Shield (200) buff for 2◈ Turns."*
 *
 * Everything about it was right except who called it. `scalesShield` declares
 * `absorbs: { poolFrom: sourceAbility }`, the ability declares
 * `shield: { health: 200 }`, `barrierOn` finds the item, and `refreshShield`
 * has a tested default — *"a fresh 200 on every cast"* — that was **added for
 * this Servant**. But `refreshShield` was called from exactly one place,
 * `engine/attack.mjs`'s `payAbilityPrice`, and Scales of the Sacred Fish is
 * `countsAsAttack: false` on a `whenAllyAttacked` window, so it goes through
 * `useSkill` and the pool was never filled.
 *
 * Measured live: Semiramis cast it on herself, took an ordinary Normal Attack,
 * and went **750 → 733** while holding the buff — with `system.shieldHealth: 0`
 * against a declared `shield.health: 200`. The Shield (200) was a Shield of
 * nothing.
 *
 * The sixth member of §46.4-M/P/T/Z/AB's family: *the two use paths do not do
 * the same thing*.
 *
 * Order matters and is the reason this is a wiring test rather than a unit one:
 * `refreshShield` reads `timesUsed` to tell a first projection from a later
 * one, so it has to run **before** `recordUse` increments it — which is exactly
 * where the attack path puts it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const skillUse = readFileSync("module/engine/skill-use.mjs", "utf8");
const attack = readFileSync("module/engine/attack.mjs", "utf8");
const shield = readFileSync("module/engine/shield.mjs", "utf8");

describe("the Skill path fills a barrier's pool", () => {
  it("calls refreshShield for an ability that declares a shield", () => {
    expect(skillUse).toMatch(/refreshShield\(ability\)/);
  });

  it("does so BEFORE recording the use, which is what `timesUsed` distinguishes", () => {
    const fn = skillUse.slice(skillUse.indexOf("export async function useSkill"));
    const body = fn.slice(0, fn.indexOf("I.log("));
    expect(body.indexOf("refreshShield")).toBeGreaterThan(-1);
    expect(body.indexOf("refreshShield")).toBeLessThan(body.indexOf("I.recordUse"));
  });
});

describe("the attack path still does it too", () => {
  it("has not lost its own call", () => {
    expect(attack).toMatch(/refreshShield\(ability\)/);
  });
});

describe("what made the pool reachable at all", () => {
  it("barrierOn reads the pool from the source ability, not the instance", () => {
    // `scalesShield` and `rhoAias` both declare `poolFrom: sourceAbility`, so
    // an effect instance carrying `magnitude: 0` is not evidence of anything.
    expect(shield).toMatch(/i\.system\?\.shield/);
  });
});
