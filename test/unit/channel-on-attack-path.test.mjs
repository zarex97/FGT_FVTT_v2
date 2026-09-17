/**
 * @file A channelled Noble Phantasm declared as an attack.
 * @see module/engine/attack.mjs, module/engine/skill-use.mjs, docs/46 §46.4-Z
 *
 * *"[The Hanging Gardens of Babylon] cannot Act for 3◈ Turns... if Attacked
 * during this period, it is interrupted and has to restart... the Master only
 * loses Health as per NP usage rules **ONLY WHEN HGoB SUCCESSFULLY ACTIVATES**,
 * not at the start."*
 *
 * `useSkill` honours both halves: a `channel` phase runs, and when it starts,
 * the cost and cooldown intents are skipped so `completeChannel` can pay them
 * three Turns later. `resolveAttack` honoured neither — `channel` is not a
 * `CASTER_PHASES` kind, so no channel began at all, and the cost block charged
 * Semiramis's Master the full 100 immediately. The same Noble Phantasm, two use
 * paths, opposite outcomes.
 *
 * The channel cannot simply join `CASTER_PHASES`: that pass runs *after* the
 * damage, and the whole point is that the price is not paid yet. It needs its
 * own pass, before the cost block — which is what `runCasterChannel` is.
 */

import { describe, it, expect } from "vitest";
import { CASTER_PHASES } from "../../module/engine/skill-use.mjs";
import { hasChannelPhase, interruptedByDeclaration } from "../../module/rules/ability-use.mjs";

describe("which pass owns a channel", () => {
  it("is not the late caster pass, which runs after the damage and the cost", () => {
    expect(CASTER_PHASES.has("channel")).toBe(false);
  });
});

describe("hasChannelPhase", () => {
  it("sees the Hanging Gardens' channel", () => {
    const ability = { system: { phases: [{ kind: "channel", ticks: "3◈" }, { kind: "statChange" }] } };
    expect(hasChannelPhase(ability)).toBe(true);
  });

  it("is false for an ordinary Noble Phantasm", () => {
    expect(hasChannelPhase({ system: { phases: [{ kind: "damage" }, { kind: "applyEffects" }] } })).toBe(false);
  });

  it("is false for an ability with no phases at all, and for nothing", () => {
    expect(hasChannelPhase({ system: {} })).toBe(false);
    expect(hasChannelPhase(null)).toBe(false);
  });
});

describe("a declaration does not interrupt its own caster", () => {
  // *"If Semiramis is **Attacked** during this period... it is interrupted and
  // she has to restart."* The Hanging Gardens targets `{ anchor: self, shape:
  // unit, selection: { relations: [self], includeSelf: true } }`, so Semiramis
  // is always in her own `targetIds` — and `resolveAttack` fires
  // `interruptChannels(targetIds)` at line 375, a hundred lines AFTER
  // `payAbilityPrice` started the channel at line 268. So the channel began and
  // was destroyed by the very declaration that began it, every single time.
  //
  // Being the subject of your own Noble Phantasm is not being Attacked.
  it("drops the attacker from the interrupt list", () => {
    expect(interruptedByDeclaration(["semiramis"], "semiramis")).toEqual([]);
  });

  it("still interrupts everybody else the declaration is aimed at", () => {
    expect(interruptedByDeclaration(["semiramis", "medea", "emiya"], "semiramis"))
      .toEqual(["medea", "emiya"]);
  });

  it("leaves an ordinary attack on somebody else untouched", () => {
    expect(interruptedByDeclaration(["medea"], "heracles")).toEqual(["medea"]);
  });

  it("is empty for an empty declaration", () => {
    expect(interruptedByDeclaration([], "heracles")).toEqual([]);
    expect(interruptedByDeclaration(undefined, "heracles")).toEqual([]);
  });
});
