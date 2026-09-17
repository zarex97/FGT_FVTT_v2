/**
 * @file What "using it" means at an attacker's timing window.
 * @see module/rules/ability-use.mjs, docs/46-roster-re-audit.md §46.4-P
 *
 * `engine/attack.mjs#offerAttackerWindow` offers the attacker its own abilities
 * at the Combat Phase Start and the Damage Step, and its comment names **two**
 * answers for what taking one means:
 *
 *   - Monstrous Strength CONTRIBUTES rules to the attack in progress.
 *   - Uncrowned Arms Mastership is a MODE, and using it is the switch.
 *
 * There is a third. EMIYA's *Thaumaturgy: Reinforcement* is neither: its whole
 * effect is an `applyEffects` phase, and the window charged its Cooldown,
 * recorded the use, announced it in chat and **ran nothing**. Kiritsugu's
 * Reinforcement and Achilles's Runner Comet are the same shape, and Anastasia's
 * Watermelon loses its phase while its four rules still land.
 *
 * Measured live: taking Reinforcement at its own stated window left EMIYA with
 * no `nAtkUp` and a cooldown of 3; the same Spell through `useSkill` applied
 * `nAtkUp: 30` correctly.
 */

import { describe, it, expect } from "vitest";
import { windowUseKind } from "../../module/rules/ability-use.mjs";

const ability = (system) => ({ id: "a", name: "A", system });

describe("the three answers a window use can have", () => {
  it("a MODE is switched, and its rules are read off the new state", () => {
    // Karna's Uncrowned Arms Mastership: no phases, `isMode`.
    expect(windowUseKind(ability({
      isMode: true, slug: "uncrownedArmsMastership",
      passiveRules: [{ key: "CheckModifier" }, { key: "CritModifier" }],
    }))).toBe("mode");
  });

  it("an ability with RULES and no phases contributes to the attack", () => {
    // Asterios's Monstrous Strength.
    expect(windowUseKind(ability({
      slug: "asterios-monstrous-strength",
      activeRules: [{ key: "DamageModifier" }],
    }))).toBe("contribute");
  });

  it("an ability whose effect is a PHASE is cast", () => {
    // EMIYA's and Kiritsugu's Reinforcement.
    expect(windowUseKind(ability({
      slug: "emiya-reinforcement",
      phases: [{ kind: "applyEffects", target: "self", effects: [{ id: "nAtkUp", magnitude: 30 }] }],
    }))).toBe("cast");
  });

  it("an ability with BOTH is cast — its rules are carried separately", () => {
    // Anastasia's Watermelon: one phase and four rules. Casting runs the phase;
    // the window's own `carried` list still contributes the rules, so routing
    // it here does not cost it anything.
    expect(windowUseKind(ability({
      slug: "anastasia-watermelon",
      phases: [{ kind: "applyEffects" }],
      passiveRules: [{ key: "DamageModifier" }, { key: "DamageModifier" }],
    }))).toBe("cast");
  });

  it("a MODE with phases is still a mode — the switch is the whole use", () => {
    // Switching runs its own entry price through `useSkill` already; treating
    // it as a cast here would pay twice.
    expect(windowUseKind(ability({ isMode: true, phases: [{ kind: "applyEffects" }] }))).toBe("mode");
  });

  it("an ability with neither contributes nothing and is not cast", () => {
    expect(windowUseKind(ability({ slug: "bare" }))).toBe("contribute");
  });

  it("tolerates a missing item", () => {
    expect(windowUseKind(null)).toBe("contribute");
  });
});
