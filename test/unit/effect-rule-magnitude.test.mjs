/**
 * @file `@magnitude` where it is not a modifier's size.
 * @see module/rules/snapshot.mjs, docs/14-effect-taxonomy.md, Ch. 46 §46.4
 *
 * `resolveRuleValues` substituted `value` and `npValue` and nothing else, so an
 * effect that hangs its magnitude off a CHANCE kept the literal string
 * `"@magnitude"` all the way to the scheduler — which gates on a number and
 * refuses what it cannot read.
 *
 * Two shipped effects are written that way, and both were inert:
 *
 *   - **Bleed Atk** — *"Normal Attacks have an X% chance of inflicting Bleed
 *     for 1◈ Turns"*, authored as the one-line rider
 *     `effect: { id: bleed, chance: "@magnitude" }`.
 *   - **Terror** — a `then` list whose `ApplyEffect` carries
 *     `chance: "@magnitude"`, so the Stun it threatens could never land.
 *
 * Measured live on Asterios with the chance staged to **100**: the
 * `damageDealt` event fired, the handler was present with its
 * `attack:kind:normal` predicate satisfied, and `fireEvent` returned a log
 * entry and **no intent at all**. `engine/attack.mjs#fireDamageDealt` exists
 * precisely so that *"every on-hit rider in the catalogue"* works, and it was
 * raising the event for handlers that could not act.
 */

import { describe, it, expect } from "vitest";
import { resolveRuleValues } from "../../module/rules/snapshot.mjs";

/** Bleed Atk, exactly as `packs/_source/effects/bleed-atk.yml` authors it. */
const bleedAtk = () => ({
  key: "OnEvent",
  event: "damageDealt",
  predicate: ["attack:kind:normal"],
  target: "victim",
  effect: { id: "bleed", chance: "@magnitude" },
  duration: "1◈",
});

/** Terror, which puts the same reference on a `then` action instead. */
const terror = () => ({
  key: "OnEvent",
  event: "turnStart",
  then: [{ key: "ApplyEffect", effect: { id: "stun" }, duration: "1◈", chance: "@magnitude" }],
});

describe("@magnitude on a chance", () => {
  it("resolves the rider's nested effect chance against the instance", () => {
    const resolved = resolveRuleValues(bleedAtk(), 10, null);
    expect(resolved.effect.chance).toBe(10);
    // The rest of the rider is untouched: an id that merely contains text is
    // not a number waiting to be substituted.
    expect(resolved.effect.id).toBe("bleed");
    expect(resolved.duration).toBe("1◈");
    expect(resolved.target).toBe("victim");
    expect(resolved.predicate).toEqual(["attack:kind:normal"]);
  });

  it("resolves a chance on a `then` action", () => {
    const resolved = resolveRuleValues(terror(), 35, null);
    expect(resolved.then[0].chance).toBe(35);
    expect(resolved.then[0].effect).toEqual({ id: "stun" });
  });

  it("does not stamp a value onto an action that never carried one", () => {
    // The docstring's own warning, kept true for `then`: an action is not a
    // rule element, and a `value: 0` on one would read as a real contribution.
    const resolved = resolveRuleValues(terror(), 35, null);
    expect(resolved.then[0]).not.toHaveProperty("value");
  });

  it("still resolves the ordinary value and its negation", () => {
    expect(resolveRuleValues({ key: "CheckModifier", check: "crit", value: "@magnitude" }, 60, null).value)
      .toBe(60);
    expect(resolveRuleValues({ key: "CheckModifier", check: "crit", value: "-@magnitude" }, 25, null).value)
      .toBe(-25);
  });

  it("leaves a chance that is already a number alone", () => {
    const fixed = { key: "OnEvent", event: "damageDealt", effect: { id: "bleed", chance: 15 } };
    expect(resolveRuleValues(fixed, 10, null).effect.chance).toBe(15);
  });
});
