/**
 * @file An effect an event rider delivers is tested against the attack that triggered it (#127).
 * @see module/engine/applier.mjs#riderOptions, module/engine/scheduler.mjs (ApplyEffect), docs/11-predicates.md
 *
 * > Magic Resistance: *"Also affects Instakill and Death UNLESS the Instakill or
 * > Death debuffs are from an Attack/Attack Skill/Spell/NP that deals STR damage
 * > or that is not affected by Magic Resistance."*
 *
 * That exemption is an `attackPredicate` -- `[{not: attack:component:str}, {not:
 * attack:ignoresMagicResistance}]` -- tested by `chanceContribution` against
 * `ctx.options`. `resolveEffects`, the path every `OnEvent`, scheduler and field
 * `ApplyEffect` takes, built that set as `new Set()`, so both `not:` tests passed
 * whatever the attack was and the exemption could never apply. The event is
 * raised with the attack's options in hand; the `ApplyEffect` action dropped them
 * on the way to the intent, because an intent has nowhere to put them.
 *
 * Latent: the only rider-delivered Death today is the Kagome Spirits', all with a
 * MAG Normal Attack, so today's outcome is right by coincidence. Pollux's partner
 * aura carries the same clause.
 *
 * The Units are built through the real projection, the event is fired through the
 * real `fireEvent`, and the effect is applied by the real `applyEffect`.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/** The Kagome Death spirit, its rider's chance stated as 100 so no die decides anything but Magic Resistance. */
const SPIRIT = {
  from: "kagome-death", id: "spirit", panel: { i: 5, j: 5 },
  with: {
    passiveRules: [{
      key: "OnEvent", event: "damageDealt", automatic: true, predicate: ["attack:kind:normal"],
      then: [{ key: "ApplyEffect", target: "victim", effect: { id: "death" }, chance: 100 }],
    }],
  },
};

/**
 * The spirit lands a hit on Quetzalcoatl with `attackOptions` in the event's option set,
 * and what the rider's Death says about its chance once applied.
 */
const hit = (attackOptions, fn) => withSubjects(
  [SPIRIT, { from: "quetzalcoatl", id: "quetz", panel: { i: 5, j: 6 } }],
  async ({ unit, board }) => {
    const { fireEvent, pendingRolls } = await import("../../module/engine/scheduler.mjs");
    const spirit = unit("spirit");
    const rolls = {};
    for (const spec of pendingRolls(spirit, "damageDealt")) rolls[spec.key] = 1;
    const intents = fireEvent("damageDealt", [spirit], {
      tick: 0, turnsPerRound: 3, board, rolls,
      // What `fireDamageDealt` hands the event: the whole option set of the attack.
      options: new Set(["attack:kind:normal", "self:attribute:summon", "target:attribute:servant", ...attackOptions]),
      victim: { unitId: "quetz" },
    });
    const death = intents.find((i) => i.t === "applyEffect" && i.effect.defId === "death");
    return fn({ death, quetz: unit("quetz") });
  },
);

/** The line `applyEffect` logs for the chance step, with the options the rider path would use. */
const chanceLine = async ({ death, quetz }) => {
  const { riderOptions } = await import("../../module/engine/applier.mjs");
  const { applyEffect } = await import("../../module/engine/effect-applier.mjs");
  const { EffectRegistry } = await import("../../module/rules/registry.mjs");
  const outcome = applyEffect({
    def: EffectRegistry.get("death"),
    target: quetz,
    magnitude: 0,
    chance: death.effect.chance,
    source: { unitId: "spirit", abilityId: null },
    ctx: { turnsPerRound: 3, currentTick: 0, roll: 99, inflictBonus: 0, options: riderOptions(death.effect) },
  });
  return outcome.trace.find((t) => t.step === "chance").detail;
};

describe("the ApplyEffect action carries the attack's options", () => {
  it("copies the attack:* options onto the effect, and only those", async () => {
    await hit(["attack:component:str", "attack:range:1"], ({ death }) => {
      expect(death.effect.attackOptions).toEqual(expect.arrayContaining(["attack:component:str", "attack:kind:normal"]));
      expect(death.effect.attackOptions.every((o) => o.startsWith("attack:"))).toBe(true);
      expect(Array.isArray(death.effect.attackOptions)).toBe(true);
    });
  });

  it("carries none when the event carries none: a Turn boundary has no attack", async () => {
    await hit([], ({ death }) => {
      // `attack:kind:normal` is the handler's own gate, present in every damageDealt set.
      expect(death.effect.attackOptions).toEqual(["attack:kind:normal"]);
    });
  });
});

describe("Magic Resistance's STR and ignores-MR exemption reaches a rider-delivered Death", () => {
  it("a STR attack's Death is not resisted: 100% (automatic), where it read vs 75%", async () => {
    expect(await hit(["attack:component:str"], chanceLine)).toBe("100% (automatic)");
  });

  it("an attack that is not affected by Magic Resistance: 100% (automatic)", async () => {
    expect(await hit(["attack:component:mag", "attack:ignoresMagicResistance"], chanceLine)).toBe("100% (automatic)");
  });

  it("the control: a MAG attack's Death is still resisted, vs 75%", async () => {
    expect(await hit(["attack:component:mag"], chanceLine)).toBe("rolled 99 vs 75%");
  });
});

describe("riderOptions", () => {
  it("is the set the effect carries, and an empty one for an effect that carries none", async () => {
    const { riderOptions } = await import("../../module/engine/applier.mjs");
    expect([...riderOptions({ attackOptions: ["attack:component:str"] })]).toEqual(["attack:component:str"]);
    expect(riderOptions({}).size).toBe(0);
    expect(riderOptions(undefined).size).toBe(0);
  });
});
