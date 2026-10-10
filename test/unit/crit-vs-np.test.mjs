/**
 * @file Crit Up, S.Crit Up and Crit DmUp do not affect a Noble Phantasm (#131).
 * @see module/rules/checks.mjs#critChance, module/rules/damage/pipeline.mjs stage 2, docs/A-effect-catalogue.md
 *
 * > Appendix A: Crit Up, Crit DmUp, Crit Guard, G.Crit and No Crit are *"Not NP
 * > unless stated"*; Crit ResUp, Crit ResDwn and Bal Dwn are *"Not NP"*. The
 * > game's author has ruled it for the first three buffs.
 *
 * Both readers fell back to the clause's full value against an NP when it stated
 * no NP figure: `critModifiers` returned `npValue` only when stated, else `value`,
 * and stage 2's `sumCritMods` went through `magnitudeOf`, which does the same. After
 * Lucha Libre Xiuhcoatl crit automatically and with +50% crit damage. The chance
 * half is held in `checks.test.mjs`; this holds the damage half, the one
 * definition of "is an NP", and the clause that does state a figure.
 *
 * Quetzalcoatl is built through the real projection with the buffs as real
 * effect instances.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { withSubjects, prepareSubjects } from "../helpers/subject.mjs";
import { computeDamage, isNPAttack } from "../../module/rules/damage/pipeline.mjs";
import { critChance } from "../../module/rules/checks.mjs";
import { rollOptionsFor } from "../../module/rules/options.mjs";

beforeAll(prepareSubjects, 60_000);

/** Quetzalcoatl holding `effects`, and what `fn` makes of her. */
const holding = (effects, fn) => withSubjects(
  [{ from: "quetzalcoatl", id: "quetzalcoatl", effects }],
  ({ unit }) => fn(unit("quetzalcoatl")),
);

/** Stage 2's lines for a FORCED crit by `attacker`, the 5d10 coming up 30. */
const stage2 = (attacker, attack) => computeDamage({
  attacker,
  defender: { id: "d", health: 99999, modifiers: [], effects: [] },
  attack: { component: "str", ...attack },
  base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
  rolls: { attackPlus: 30 },
  crit: { isCrit: true, chanceUsed: 100 },
  options: rollOptionsFor({ attacker, defender: null, attack }),
}).breakdown.find((s) => s.index === 2).contributors.map((c) => c.note);

describe("Crit DmUp in stage 2", () => {
  const critDmUp = [{ defId: "critDmUp", magnitude: 50 }];

  it("raises a Normal Attack's crit damage: x1.50", async () => {
    expect(await holding(critDmUp, (u) => stage2(u, { kind: "normal" }))).toEqual(["5d10 = 30, ×1.50 crit damage"]);
  });

  it("does not raise a Noble Phantasm's: the roll stands as rolled", async () => {
    expect(await holding(critDmUp, (u) => stage2(u, { kind: "np" }))).toEqual(["5d10 = 30"]);
  });

  it("counts an attack the sheet categorizes as an NP as one, though its kind is normal", async () => {
    expect(await holding(critDmUp, (u) => stage2(u, { kind: "normal", categorizedAsNP: true }))).toEqual(["5d10 = 30"]);
  });
});

describe("the defender's side is not an NP's either", () => {
  it("Crit ResUp does not soften a Noble Phantasm's crit damage ('Not NP'), and does a Normal Attack's", async () => {
    // Crit ResUp is the DEFENDER's: it sits in `modifiers` under `critResUp`.
    const attacker = await holding([{ defId: "critDmUp", magnitude: 50 }], (u) => u);
    const defender = { id: "d", health: 99999, effects: [], modifiers: [{ key: "critResUp", value: 20, source: "Crit ResUp" }] };
    const note = (attack) => computeDamage({
      attacker, defender, attack: { component: "str", ...attack }, base: { sources: [{ unit: "self", component: "str", factor: 1 }] },
      rolls: { attackPlus: 30 }, crit: { isCrit: true, chanceUsed: 100 },
      options: rollOptionsFor({ attacker, defender, attack }),
    }).breakdown.find((s) => s.index === 2).contributors.map((c) => c.note);
    expect(note({ kind: "normal" })).toEqual(["5d10 = 30, ×1.30 crit damage"]);
    expect(note({ kind: "np" })).toEqual(["5d10 = 30"]);
  });
});

describe("a crit clause that STATES an NP figure still wins", () => {
  it("Crit Up (Viy), 50% and 20% if NP, reads 70 against an NP and 100 against a Normal Attack", async () => {
    const spec = (kind) => holding([{ defId: "critUpViy", magnitude: 50, npMagnitude: 20 }], (u) => critChance(u, null, {
      options: rollOptionsFor({ attacker: u, defender: null, attack: { kind, component: "mag" } }),
    }));
    expect((await spec("normal")).percent).toBe(100);
    expect((await spec("np")).percent).toBe(70);
  });
});

describe("one definition of 'is an NP'", () => {
  it("is kind np, or categorized as one", () => {
    expect(isNPAttack({ kind: "np" })).toBe(true);
    expect(isNPAttack({ kind: "normal", categorizedAsNP: true })).toBe(true);
    expect(isNPAttack({ kind: "normal" })).toBe(false);
    expect(isNPAttack(undefined)).toBe(false);
  });

  it("is the one the chance reader is handed: the resolver passes it", async () => {
    const buffed = [{ defId: "critUp", magnitude: 60 }];
    const percent = (attack) => holding(buffed, (u) => critChance(u, null, {
      options: rollOptionsFor({ attacker: u, defender: null, attack }), isNP: isNPAttack(attack),
    }).percent);
    expect(await percent({ kind: "normal", categorizedAsNP: true })).toBe(50);
    expect(await percent({ kind: "normal" })).toBe(110);
  });
});
