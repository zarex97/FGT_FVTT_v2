/**
 * @file The targeting preview is built from the attack the resolution builds (#124).
 * @see module/engine/attack.mjs#previewContext, #attackIdentityOf, #counterfactualAttack, docs/20-targeting.md
 *
 * > *"A Noble Phantasm is compared by its own Rank"* -- the ruling on Magic Resistance.
 *
 * Stage 11 takes the attack's Rank as `ctx.attack.rank ?? attacker.parameters.mag`.
 * The resolution sets `attack.rank` to the ability's own Rank; the preview built
 * its attack through `attackFacts` with no `rank` at all, so it fell back to the
 * attacker's MAG. A player aimed Karna's Brahmastra (Rank A+, Karna MAG B) at
 * Quetzalcoatl (Magic Resistance A), read "negated: MR A >= attack B", and the
 * card then dealt half. It also sent no `npTags`, so the `attack:npScale:gte:*`
 * options the resolver carries were absent from the preview's option set.
 *
 * Both Units are built through the real projection, and the contexts are the ones
 * the preview and the counterfactual really build.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { installClientNamespace } from "../helpers/client-namespace.mjs";
import { computeDamage } from "../../module/rules/damage/pipeline.mjs";
import { rollsFor } from "../../module/rules/preview.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

beforeAll(prepareSubjects, 60_000);

/**
 * `owner` aims `abilityId` at `defender`, on the board the projection builds.
 * `fn` gets the preview's context, and the counterfactual's attack beside it.
 */
const aim = (owner, abilityId, defender, fn) => withSubjects(
  [{ from: owner, id: owner, panel: { i: 5, j: 5 } }, { from: defender, id: defender, panel: { i: 5, j: 6 } }],
  async ({ unit, board, world }) => {
    installClientNamespace();
    const { previewContext, counterfactualAttack } = await import("../../module/engine/attack.mjs");
    const ability = world.actor(owner).items.find((i) => i.system.contentId === abilityId);
    const caster = unit(owner);
    const target = unit(defender);
    const isNP = ability.type === "noblePhantasm";
    const preview = previewContext({ caster, defender: target, ability, board, isNP });
    const resolution = counterfactualAttack({
      attackerDoc: world.actor(owner), ability,
      options: rollOptionsFor({ attacker: caster, defender: target, attack: { kind: "np", range: 1 } }),
      range: 1,
    });
    return fn({ preview, resolution, ability });
  },
);

/** What stage 11 says of the preview's own context, every die at its top. */
const stage11 = (preview) => computeDamage({ ...preview, rolls: rollsFor("max", { isCrit: false }) })
  .breakdown.find((s) => s.index === 11).contributors.map((c) => c.note);

describe("Magic Resistance in the preview, as in the resolution", () => {
  it("Brahmastra (Rank A+, Karna MAG B) on Quetzalcoatl (MR A): halved by the NP's own Rank, not negated by Karna's MAG", async () => {
    const notes = await aim("karna", "karna-brahmastra", "quetzalcoatl", ({ preview }) => stage11(preview));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/50% MAG \(MR A < attack A\+\)$/);
  });

  it("A Tale for Somebody's Sake (Rank C, Nursery MAG A) on Karna (MR C): negated by the NP's own Rank, not halved by her MAG", async () => {
    const notes = await aim("nursery-rhyme", "nursery-a-tale-for-somebodys-sake", "karna", ({ preview }) => stage11(preview));
    expect(notes).toEqual(["negated: MR C ≥ attack C"]);
  });

  it("carries the NP's scale, so the attack:npScale options the resolution sees are in the preview's set", async () => {
    await aim("karna", "karna-brahmastra", "quetzalcoatl", ({ preview, ability }) => {
      expect(preview.attack.npTags).toEqual([...ability.system.npTags]);
      expect(preview.attack.npTags.length).toBeGreaterThan(0);
      const scaled = [...preview.options].filter((o) => o.startsWith("attack:npScale:"));
      expect(scaled.length).toBeGreaterThan(0);
    });
  });
});

describe("Achilles's Magic Resistance C (#184, MR.p1, MR.p1.over, MR.np)", () => {
  // Nobody on the audit board had a MAG attack of Rank C or lower, so the
  // negation is pressed here, through the real projection.
  it("A Tale for Somebody's Sake (Rank C): negated -- up to C is nothing", async () => {
    const notes = await aim("nursery-rhyme", "nursery-a-tale-for-somebodys-sake", "achilles", ({ preview }) => stage11(preview));
    expect(notes).toEqual(["negated: MR C ≥ attack C"]);
  });

  it("Brahmastra (Rank A+): reduced by 30%, and it is a Noble Phantasm", async () => {
    const notes = await aim("karna", "karna-brahmastra", "achilles", ({ preview }) => stage11(preview));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/30% MAG \(MR C < attack A\+\)$/);
  });
});

describe("the preview's attack and the counterfactual's are one identity", () => {
  // The nine abilities a scan over the projected Servants found preview and resolution disagreeing on
  // (44 ability-and-defender pairs), and the Servant each belongs to.
  const SCANNED = [
    ["anastasia", "anastasia-snegleta"],
    ["emiya", "emiya-caladbolg"],
    ["karna", "karna-brahmastra"],
    ["karna", "karna-brahmastra-kundala"],
    ["karna", "karna-vasavi-shakti"],
    ["ozymandias", "ozymandias-mesektet"],
    ["ozymandias", "ozymandias-pyramid-drop"],
    ["scathach", "scathach-gate-of-skye"],
    ["nursery-rhyme", "nursery-a-tale-for-somebodys-sake"],
  ];

  it.each(SCANNED)("%s's %s", async (owner, abilityId) => {
    await aim(owner, abilityId, "quetzalcoatl", ({ preview, resolution }) => {
      const identity = (a) => ({
        rank: a.rank === null ? null : String(a.rank),
        npTags: a.npTags,
        categorizedAsNP: a.categorizedAsNP,
        element: a.element ?? null,
        elementFraction: a.elementFraction,
      });
      expect(identity(preview.attack)).toEqual(identity(resolution));
    });
  });
});

describe("one builder of an ability's identity", () => {
  // The resolution, the counterfactual and the preview all put an ability into the pipeline. Three
  // hand-built copies of its Rank and category are how the preview came to build none of it.
  const source = readFileSync("module/engine/attack.mjs", "utf8");

  it("reads the ability's Rank and NP category in exactly one place", () => {
    expect(source.match(/Rank\.parseOrNull\(ability/g)).toHaveLength(1);
    expect(source.match(/categorizedAsNP: Boolean\(/g)).toHaveLength(1);
  });
});
