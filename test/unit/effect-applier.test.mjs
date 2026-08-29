/**
 * @file The terminal tier of Appendix A — Instakill and Death.
 * @see module/engine/effect-applier.mjs, docs/A-effect-catalogue.md
 *
 * The rest of the seven-step pipeline is covered by `effect-flow.test.mjs`.
 * These two are separate because they are the only effects that are a
 * **consequence** rather than a condition: nothing is left behind for the Unit
 * to carry, so the emit step returns before the document is ever constructed.
 *
 * Scáthach is the first content to have either, one on each Noble Phantasm.
 */

import { describe, it, expect } from "vitest";
import { applyEffect } from "../../module/engine/effect-applier.mjs";

describe("bypassChanceModifiers (Queen's Poison's extra Stage)", () => {
  // Poison-like, non-terminal, so the chance path is exercised without the
  // terminal short-circuit `applyEffect` takes for Instakill/Death.
  const poison = { id: "poison", name: "Poison", polarity: "debuff", volatility: "volatile", baseChance: 50 };
  const victim = (over = {}) => ({ id: "v", health: 800, effects: [], effectInstances: [], ...over });

  it("an inflict bonus normally raises the roll's chance of success", () => {
    // Base 50 + a 40 inflict bonus clears a roll of 80; the same roll without
    // the bonus does not.
    const withBonus = applyEffect({
      def: poison, target: victim(), source: {},
      ctx: { roll: 80, currentTick: 0, turnsPerRound: 3, inflictBonus: 40 },
    });
    expect(withBonus.outcome).toBe("applied");
  });

  it("bypassChanceModifiers ignores the SAME inflict bonus", () => {
    const bypassed = applyEffect({
      def: poison, target: victim(), source: {}, bypassChanceModifiers: true,
      ctx: { roll: 80, currentTick: 0, turnsPerRound: 3, inflictBonus: 40 },
    });
    expect(bypassed.outcome).toBe("resisted");
  });

  it("bypassChanceModifiers also ignores the target's own resist", () => {
    const resisted = applyEffect({
      def: poison, target: victim(), source: {},
      ctx: { roll: 45, currentTick: 0, turnsPerRound: 3, resist: 40 },
    });
    expect(resisted.outcome).toBe("resisted");

    const bypassed = applyEffect({
      def: poison, target: victim(), source: {}, bypassChanceModifiers: true,
      ctx: { roll: 45, currentTick: 0, turnsPerRound: 3, resist: 40 },
    });
    expect(bypassed.outcome).toBe("applied");
  });

  it("still honours an explicit chance override while bypassed", () => {
    // The flat "50%" IS the stated chance, not the effect's own `baseChance` --
    // this asserts the two are independent: bypass skips MODIFIERS, not the
    // caller's own stated number.
    const out = applyEffect({
      def: poison, target: victim(), source: {}, chance: 50, bypassChanceModifiers: true,
      ctx: { roll: 50, currentTick: 0, turnsPerRound: 3, inflictBonus: 999 },
    });
    expect(out.outcome).toBe("applied");
  });
});

describe("Immunity Downgrade (Ch. 32, Sikera Ušum clause d)", () => {
  const poison = { id: "poison", name: "Poison", polarity: "debuff", volatility: "volatile", baseChance: 100 };
  const immune = (over = {}) => ({
    id: "v", health: 800, effects: ["immune:poison"], effectInstances: [],
    suppressions: [{ scope: "immunity", effectId: "poison", downgradeTo: "poisonResist", resistPercent: 75 }],
    ...over,
  });

  it("blocks outright with no downgrade in effect", () => {
    const out = applyEffect({
      def: poison, target: { ...immune(), suppressions: [] }, source: {},
      ctx: { roll: 1, currentTick: 0, turnsPerRound: 3 },
    });
    expect(out.outcome).toBe("blocked");
  });

  it("downgrades to a 75-point resist instead of blocking, inside the field", () => {
    const passes = applyEffect({
      def: poison, target: immune(), source: {},
      ctx: { roll: 20, currentTick: 0, turnsPerRound: 3 },
    });
    expect(passes.outcome).toBe("applied");

    const fails = applyEffect({
      def: poison, target: immune(), source: {},
      ctx: { roll: 90, currentTick: 0, turnsPerRound: 3 },
    });
    expect(fails.outcome).toBe("resisted");
  });

  it("halves a Poison Resist contribution for a unit that was never immune", () => {
    const resistant = {
      id: "v", health: 800, effects: [], effectInstances: [],
      applicationChances: [{ direction: "incoming", effectId: "poison", value: 60 }],
      suppressions: [{ scope: "immunity", effectId: "poison", downgradeTo: "poisonResist", resistPercent: 75 }],
    };
    // Unhalved, 60 resist against a roll of 50 (base 100) resists; halved to
    // 30, the same roll succeeds.
    const out = applyEffect({
      def: poison, target: resistant, source: {},
      ctx: { roll: 50, currentTick: 0, turnsPerRound: 3 },
    });
    expect(out.outcome).toBe("applied");
  });

  it("does not halve a Poison resist when the field's downgrade is scoped to a different effect", () => {
    const other = {
      id: "v", health: 800, effects: [], effectInstances: [],
      applicationChances: [{ direction: "incoming", effectId: "poison", value: 60 }],
      // Some OTHER field's downgrade, scoped to Burn -- must not touch this
      // unit's Poison resist.
      suppressions: [{ scope: "immunity", effectId: "burn", downgradeTo: "burnResist", resistPercent: 75 }],
    };
    const out = applyEffect({
      def: poison, target: other, source: {},
      ctx: { roll: 50, currentTick: 0, turnsPerRound: 3 },
    });
    // Unhalved resist (60) beats a roll of 50 against base 100.
    expect(out.outcome).toBe("resisted");
  });
});

describe("terminal effects", () => {
  const instakill = {
    id: "instakill", name: "Instakill", polarity: "debuff", volatility: "terminal",
    severity: "instakill", baseChance: 100, terminal: { kind: "reduceToZero" },
  };
  const death = {
    id: "death", name: "Death", polarity: "debuff", volatility: "terminal",
    severity: "death", baseChance: 100, terminal: { kind: "defeat" },
  };
  const victim = (over = {}) => ({ id: "v", health: 800, effects: [], effectInstances: [], ...over });

  it("empties the Health pool rather than creating a document", () => {
    // "Instakill" is a consequence, not a condition. A created document would
    // leave a badge on the corpse while the Health it was meant to remove
    // stayed where it was.
    const out = applyEffect({
      def: instakill, target: victim(), source: {}, ctx: { roll: 1, currentTick: 0, turnsPerRound: 3 },
    });

    expect(out.outcome).toBe("applied");
    expect(out.intents.some((i) => i.t === "applyEffect")).toBe(false);
    expect(out.intents.find((i) => i.t === "statDelta")).toMatchObject({
      stat: "health.value", delta: -800,
    });
  });

  it("uses statDelta rather than damage, so it feeds no damage triggers", () => {
    // Health *loss* is not damage (Ch. 06): an Instakill must not pay out a
    // `Dmged NP Regen` or provoke an Injury Roll.
    const out = applyEffect({
      def: instakill, target: victim(), source: {}, ctx: { roll: 1, currentTick: 0, turnsPerRound: 3 },
    });
    expect(out.intents.some((i) => i.t === "damage")).toBe(false);
  });

  it("defeats outright for Death, which ignores revival", () => {
    // A `defeat` intent rather than a very large amount of damage: damage
    // would be caught by `Endure`, and Endure has no business surviving Death.
    const out = applyEffect({
      def: death, target: victim(), source: {}, ctx: { roll: 1, currentTick: 0, turnsPerRound: 3 },
    });

    expect(out.intents).toEqual([{ t: "defeat", unitId: "v", cause: "death" }]);
  });

  it("is still refused by the chance roll", () => {
    // Terminal is about the consequence, not about certainty: Gate of Skye's
    // Death lands only on a failed Luck Check, and Gáe Bolg's Instakill is 75%.
    const out = applyEffect({
      def: { ...instakill, baseChance: 75 }, target: victim(), source: {},
      ctx: { roll: 90, currentTick: 0, turnsPerRound: 3 },
    });

    expect(out.outcome).toBe("resisted");
    expect(out.intents).toEqual([]);
  });
});

describe("the reduced NP magnitude", () => {
  const atkUp = {
    id: "atkUp", name: "Atk Up", polarity: "buff", valence: "offensive",
    stacking: "magnitudeStacks", baseChance: 100,
  };

  it("reaches the effect instance", () => {
    // Appendix A gives most of the damage family a second magnitude -- "damage
    // dealt is increased by 25%; **if NP, 15%**" -- and the definitions have
    // referenced `@npMagnitude` since they were written, against an instance
    // that never carried it. Scáthach's Ár is 50/30 and arrived as 50/nothing.
    const out = applyEffect({
      def: atkUp, magnitude: 50, npMagnitude: 30,
      target: { id: "t", effects: [], effectInstances: [] },
      source: {}, ctx: { roll: 1, currentTick: 0, turnsPerRound: 3 },
    });

    const applied = out.intents.find((i) => i.t === "applyEffect");
    expect(applied.effect).toMatchObject({ magnitude: 50, npMagnitude: 30 });
  });

  it("is null when the ability states none, rather than mirroring the magnitude", () => {
    // The Primordial Rune's enemy table says 25% for Def Dwn with no NP
    // figure, where Atk Dwn beside it says 15%. Defaulting to the full
    // magnitude would invent a clause; defaulting to zero would delete one.
    const out = applyEffect({
      def: atkUp, magnitude: 25,
      target: { id: "t", effects: [], effectInstances: [] },
      source: {}, ctx: { roll: 1, currentTick: 0, turnsPerRound: 3 },
    });

    expect(out.intents.find((i) => i.t === "applyEffect").effect.npMagnitude).toBe(null);
  });
});
