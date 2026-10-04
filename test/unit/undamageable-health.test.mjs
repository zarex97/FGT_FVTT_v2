/**
 * @file A Servant who cannot be damaged has no Health, however he reached the board (#180).
 * @see module/rules/derived.mjs#restoreModifiable, module/engine/summon.mjs#sheetPatch
 *
 * Pale Rider: *"Base Health: -"* and *"Pale Rider cannot take damage."* Built
 * live through `commitWar`, he arrived at 1500 / 1500. The war setup wrote the
 * END table's figure to his Health, and preparation then restored that stored
 * figure over the `null` `prepareBaseData` had set, so `isUndamageable` read
 * false and he could be damaged.
 */

import { describe, it, expect } from "vitest";
import { restoreModifiable } from "../../module/rules/derived.mjs";

describe("restoreModifiable", () => {
  it("keeps an undamageable Unit's Health null over a stored figure", () => {
    const system = { undamageable: true, health: { value: null, max: null }, mov: 9 };
    restoreModifiable(system, { health: { value: 1500, max: 1500 }, mov: 6 });
    expect(system).toEqual({ undamageable: true, health: { value: null, max: null }, mov: 6 });
  });

  it("still restores a damageable Unit's Health", () => {
    const system = { undamageable: false, health: { value: 10, max: 10 } };
    restoreModifiable(system, { health: { value: 1500, max: 1500 } });
    expect(system.health).toEqual({ value: 1500, max: 1500 });
  });
});

describe("the war setup's patch", () => {
  it("writes no Health for an undamageable Servant", async () => {
    const { sheetPatch } = await import("../../module/engine/summon.mjs");
    const lines = [{ id: "maxHealth", value: 1500 }, { id: "maxAgility", value: 18 }, { id: "maxLuck", value: 9 }];
    expect(sheetPatch(lines, { undamageable: true }, {}).health).toEqual({ max: null, value: null });
    expect(sheetPatch(lines, { undamageable: false }, {}).health).toEqual({ max: 1500, value: 1500 });
  });
});
