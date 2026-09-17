/**
 * @file Flattening an `applyEffects` rule without losing what sits beside it.
 * @see module/rules/ability-use.mjs, docs/46-roster-re-audit.md §46.4-M
 *
 * Two authoring shapes are live at once and both ship:
 *
 *   - `{ id, magnitude, duration }`               — a bare spec
 *   - `{ effect: { id, magnitude }, duration }`   — a wrapper, with the
 *     duration and any chance/predicate/times **beside** the effect, not in it
 *
 * `engine/attack.mjs` flattened the second with `r.effect ?? r`, which returns
 * the inner object and silently discards every sibling. `applyDeclaredEffects`
 * then read `spec.duration` as `undefined`, and `effect-applier.mjs` treats an
 * unstated duration as INFINITE — so the buff never expired.
 *
 * Measured on a live board: Karna's *Flash of the Sun God* is authored
 * `{ effect: { id: atkUp, ... }, duration: "1◈" }` with `target: self`, and its
 * Atk Up and NP DmUp both landed with `expiry: null` — permanent, where the
 * sheet says one Turn. The same ability through `useSkill`, which reads
 * `rule.duration` separately, expired correctly at tick 11.
 */

import { describe, it, expect } from "vitest";
import { effectSpecsOf } from "../../module/rules/ability-use.mjs";

describe("the wrapper shape keeps what sits beside the effect", () => {
  it("carries the duration down onto the spec", () => {
    const phase = { rules: [{ effect: { id: "atkUp", magnitude: 40, npMagnitude: 30 }, duration: "1◈" }] };
    expect(effectSpecsOf(phase)).toEqual([
      { id: "atkUp", magnitude: 40, npMagnitude: 30, duration: "1◈" },
    ]);
  });

  it("carries a stated chance, predicate and count too", () => {
    const phase = {
      rules: [{
        effect: { id: "burn", magnitude: 10 },
        duration: "2◈", chance: 25, predicate: ["target:kind:servant"], times: 2,
      }],
    };
    expect(effectSpecsOf(phase)[0]).toMatchObject({
      id: "burn", magnitude: 10, duration: "2◈", chance: 25, times: 2,
      predicate: ["target:kind:servant"],
    });
  });

  it("leaves a bare spec exactly as it is", () => {
    const phase = { rules: [{ id: "defUp", magnitude: 40, duration: "1◈" }] };
    expect(effectSpecsOf(phase)).toEqual([{ id: "defUp", magnitude: 40, duration: "1◈" }]);
  });

  it("lets the inner effect win where both name the same field", () => {
    // The inner object is the effect's own description of itself; an outer key
    // of the same name is the phase talking about something else.
    const phase = { rules: [{ effect: { id: "bleed", magnitude: 30 }, magnitude: 5 }] };
    expect(effectSpecsOf(phase)[0].magnitude).toBe(30);
  });

  it("reads the older `effects` key as well as `rules`", () => {
    // Both shapes ship; reading only `rules` dropped every rider on the other
    // one, which is how Medea's Aero lost its Bleed.
    const phase = { effects: [{ effect: { id: "bleed" }, duration: "3◈" }] };
    expect(effectSpecsOf(phase)).toEqual([{ id: "bleed", duration: "3◈" }]);
  });

  it("is empty for a phase that declares nothing", () => {
    expect(effectSpecsOf({})).toEqual([]);
    expect(effectSpecsOf(null)).toEqual([]);
  });

  it("does not leave an `effect` key behind on the flattened spec", () => {
    const [spec] = effectSpecsOf({ rules: [{ effect: { id: "atkUp" }, duration: "1◈" }] });
    expect("effect" in spec).toBe(false);
  });
});
