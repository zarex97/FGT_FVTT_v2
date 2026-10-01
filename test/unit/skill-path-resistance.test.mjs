/**
 * @file A debuff a Skill applies is resisted by its target, as an attack's is (#123).
 * @see module/engine/skill-use.mjs#skillEffectContext, module/engine/effect-applier.mjs, docs/15-effect-application.md
 *
 * > Magic Resistance: *"... the chance of being inflicted by debuffs is reduced by 25%."*
 *
 * `applyPhaseEffects` handed `applyEffect` a context with `resist: 0`, and the
 * applier reads the target's own resistance with `ctx.resist ?? resistanceOf(...)`.
 * `0 ?? x` is `0`, so for every non-damaging Skill the target's incoming
 * `ApplicationChance` was skipped and only the Skill's own `chanceModifiers`
 * counted: Jack's Information Erasure was `100% (automatic)` on Quetzalcoatl.
 * `engine/attack.mjs` had documented and fixed exactly this for the attack path
 * and the Skill path was missed.
 *
 * The context under test is the one the Skill path builds, through the real
 * projection of both Units, and the effect specs are the real abilities'.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";

beforeAll(prepareSubjects, 60_000);

/** The first effect an ability's first `applyEffects` phase states, as the real item holds it. */
const effectSpecOf = (world, actorId, contentId) => {
  const item = world.actor(actorId).items.find((i) => i.system.contentId === contentId);
  const phase = item.system.phases.find((p) => p.kind === "applyEffects");
  const rule = (phase.rules ?? phase.effects)[0];
  return rule.effect ?? rule;
};

/**
 * What the Skill path says about one application: `caster` applies the effect
 * `contentId` states to `victim`, the d100 coming up `roll`.
 */
const chanceLine = (caster, victim, contentId, roll) => withSubjects(
  [...new Set([caster, victim])].map((id) => ({ from: id, id })),
  async ({ unit, world }) => {
    const { skillEffectContext } = await import("../../module/engine/skill-use.mjs");
    const { applyEffect } = await import("../../module/engine/effect-applier.mjs");
    const { EffectRegistry } = await import("../../module/rules/registry.mjs");
    const { rollOptionsFor } = await import("../../module/rules/options.mjs");

    const spec = effectSpecOf(world, caster, contentId);
    const def = EffectRegistry.get(spec.id);
    const attacker = unit(caster);
    const target = unit(victim);
    const outcome = applyEffect({
      def,
      target,
      magnitude: spec.magnitude ?? def.defaultMagnitude ?? 0,
      duration: spec.duration ?? def.defaultDuration,
      source: { unitId: caster, abilityId: contentId },
      chanceModifiers: spec.chanceModifiers ?? [],
      chance: spec.chance ?? null,
      ctx: skillEffectContext({
        attacker, def, roll, turnsPerRound: 3, currentTick: 0,
        options: rollOptionsFor({ attacker, defender: target }),
      }),
    });
    return outcome.trace.find((t) => t.step === "chance").detail;
  },
);

describe("the Skill path reads the target's resistance", () => {
  // Each figure is the whole line `applyEffect` logs for the chance step: the
  // Skill's base, plus the caster's own outgoing bonus, minus the target's
  // incoming resistance. Before the fix the last term was missing and the line
  // read `115% (automatic)` and `100% (automatic)`.

  it("Jack's Information Erasure (Crit Dwn, 100) on Quetzalcoatl: 100 + 15 (Mental Pollution) - 75 (Magic Resistance 25, Goddess's Divine Core 50)", async () => {
    expect(await chanceLine("jack-the-ripper", "quetzalcoatl", "jack-information-erasure", 99)).toBe("rolled 99 vs 40%");
  });

  it("Medea's Atlas (Stun, 100 - 25 - 25) on Quetzalcoatl: + 50 (Item Construction) - 75, so a 99 does not land", async () => {
    expect(await chanceLine("medea", "quetzalcoatl", "medea-atlas", 99))
      .toBe("rolled 99 vs 25% [target MAG B+ -25, Magic Resistance B+ -25]");
  });

  it("Jack's Crit Dwn on Van Gogh: 100 + 15 - 60 (Item Construction 35, Existence Outside the Domain 25)", async () => {
    expect(await chanceLine("jack-the-ripper", "van-gogh", "jack-information-erasure", 99)).toBe("rolled 99 vs 55%");
  });

  it("a target with nothing resisting is unchanged: Jack's Crit Dwn on Heracles is still automatic", async () => {
    expect(await chanceLine("jack-the-ripper", "heracles", "jack-information-erasure", 99)).toBe("115% (automatic)");
  });

  it("a debuff a Skill puts on its own caster meets her resistance too, and Anastasia's Blind still lands: 100 + 5 - 5 (Fae Contract, both ways)", async () => {
    // The sheet says she "gains Blind", with no chance to resist; her Fae Contract is +5 outgoing
    // and +5 incoming, so the two cancel and the Active is not wasted one use in twenty.
    expect(await chanceLine("anastasia", "anastasia", "anastasia-watermelon", 99)).toBe("100% (automatic)");
  });
});

describe("no caller of applyEffect forces the target's resistance", () => {
  /** Does this source write a `resist:` key, in code? A comment that names `resist: 0` is not a use of it. */
  const writesResist = (source) => /\bresist\s*:/.test(
    source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:"'])\/\/.*$/gm, "$1"),
  );

  it("no engine file but the applier writes a `resist:` key", () => {
    // `applyEffect` is where the resistance is READ (`ctx.resist ?? resistanceOf(target)`), so any
    // literal `resist:` on a context built elsewhere is a zero that defeats the fallback.
    const offenders = readdirSync("module/engine")
      .filter((f) => f.endsWith(".mjs") && f !== "effect-applier.mjs")
      .filter((f) => writesResist(readFileSync(`module/engine/${f}`, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the guard fails when `resist: 0` is put back, and ignores a comment that names it", () => {
    expect(writesResist("ctx: { options, resist: 0, sourceFactionId }")).toBe(true);
    expect(writesResist("applyEffect({ def, ctx: { resist: 0 } })")).toBe(true);
    expect(writesResist("// NOT `resist: 0`. `applyEffect` falls back to `resistanceOf(target)`")).toBe(false);
    expect(writesResist("/* NOT `resist: 0` */ const x = 1;")).toBe(false);
  });
});
