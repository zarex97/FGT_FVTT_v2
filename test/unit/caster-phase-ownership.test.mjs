/**
 * @file Which pass owns a `cooldown` phase on the attack path.
 * @see module/engine/skill-use.mjs, docs/46-roster-re-audit.md §46.4-X
 *
 * `resolveAttack` runs an ability's caster-side phases **once, at declaration**,
 * through `runCasterPhases` — *"everything the ability does to its USER, which
 * the Combat Process has no rung for"*. The post-damage loop in
 * `engine/attack.mjs` then handles what `CASTER_PHASES` deliberately excludes.
 *
 * `cooldown` was in **both**. The loop's handling is the richer one: it splits a
 * phase's changes with `splitCooldownRider` into those aimed at the defender
 * (once per Process) and the caster's own (once per Combat Phase, gated on
 * `isFirstOfGroup`) — a distinction the declaration pass cannot make, because no
 * defender exists yet. So the caster's own changes ran twice.
 *
 * The comment beside that loop already records the same bug being fixed for
 * `summon`: *"Adding a second `case "summon"` here double-conjured Bašmu."*
 *
 * Measured live on Semiramis's *Familiar Doves*, whose cooldown change is
 * `{ scope: np, countMatching: …, maxTicks: "1◈" }`: two enemies carried the
 * Dove effect, so X = 2 — and her Noble Phantasm's cooldown fell by **2 at
 * declaration and 2 more on the first advance**, a total of 4, with no Turn
 * boundary and no fan. Through `useSkill` the same ability reduced it by
 * exactly 2.
 */

import { describe, it, expect } from "vitest";
import { CASTER_PHASES } from "../../module/engine/skill-use.mjs";
import { splitCooldownRider } from "../../module/rules/cooldown-riders.mjs";

describe("the declaration pass does not own cooldown phases", () => {
  it("excludes `cooldown`, which the post-damage loop handles with its split", () => {
    expect(CASTER_PHASES.has("cooldown")).toBe(false);
  });

  it("still owns everything the Combat Process has no rung for", () => {
    for (const kind of ["resource", "summon", "createField", "heal", "statChange", "summonPlatform"]) {
      expect(CASTER_PHASES.has(kind)).toBe(true);
    }
  });

  it("still excludes the two the loop was always for", () => {
    // `damage` IS the Combat Process; `applyEffects` is its per-defender rider.
    expect(CASTER_PHASES.has("damage")).toBe(false);
    expect(CASTER_PHASES.has("applyEffects")).toBe(false);
  });
});

describe("the split the loop makes, which declaration cannot", () => {
  it("sends a change aimed at the target to the per-defender pass", () => {
    const phase = { kind: "cooldown", changes: [{ unit: "target", ticks: "1◈" }] };
    expect(splitCooldownRider(phase).perDefender).toHaveLength(1);
    expect(splitCooldownRider(phase).oncePerPhase).toHaveLength(0);
  });

  it("keeps the caster's own clock to once per Combat Phase", () => {
    // Familiar Doves: no `unit`, so it is Semiramis's own — and it must not
    // turn once per Unit an area caught.
    const phase = { kind: "cooldown", target: "self", changes: [{ scope: "np", countMatching: {}, maxTicks: "1◈" }] };
    expect(splitCooldownRider(phase).oncePerPhase).toHaveLength(1);
    expect(splitCooldownRider(phase).perDefender).toHaveLength(0);
  });
});
