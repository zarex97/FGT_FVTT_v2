/**
 * @file Which bucket a `DamageModifier` lands in.
 * @see module/rules/elements.mjs, docs/46-roster-re-audit.md §46.4-AD
 *
 * Territory Creation clause 1 is *"when this Unit is in its Home Base, all
 * damage dealt by it is increased by 6d20, including NP"* — dice **added** to
 * the damage, which is stage 7 of the pipeline, where Divinity's +50 lands.
 * Every Territory Creation in the corpus authors it as
 * `DamageModifier` + `stage: flat` + a `rollTable`/`roll`.
 *
 * `stage` had no reader. `DamageModifier` always pushed `atkUp`, which the
 * pipeline reads at stage 4 as a **percentage** — so the roll was made, and
 * then applied as a percent. Measured live on Semiramis in her Home Base at
 * rank C (`5d8`), four Normal Attacks in a row:
 *
 * ```
 * Atk Up Territory Creation +25%, +15%, +17%, +16%
 * ```
 *
 * — a varying 5d8 in the percentage bucket. At EX it is `6d20`, so a Servant
 * in her own Territory dealt up to **+120% damage** where the sheet grants a
 * flat +120. The error scales with Base Attack instead of being constant, and
 * it is worth roughly double at a 200 Base Attack.
 *
 * It had never been caught because the clause needs a Home Base, and §46.11
 * records Medea's two Territory Creation passives as untested for exactly that
 * reason.
 */

import { describe, it, expect } from "vitest";
import { collectContributions } from "../../module/rules/elements.mjs";

const ability = (over = {}) => ({ id: "a", name: "Territory Creation", rank: null, active: true, ...over });
const only = (out) => out.modifiers[0];

describe("`stage: flat` routes a DamageModifier to stage 7", () => {
  it("uses a key the pipeline's FLAT_ATTACK_KEYS actually reads", () => {
    const out = collectContributions([
      ability({ rank: "C", passiveRules: [{ key: "DamageModifier", stage: "flat", value: 20 }] }),
    ]);
    expect(only(out).key).toBe("flatDamage");
    expect(only(out).value).toBe(20);
  });

  it("carries the roll with it, so the dice still reach the pipeline", () => {
    const out = collectContributions([
      ability({
        rank: "C",
        passiveRules: [{
          key: "DamageModifier", stage: "flat",
          roll: { key: "territoryCreationBonusC", formula: "5d8" },
        }],
      }),
    ]);
    expect(only(out).key).toBe("flatDamage");
    expect(only(out).roll).toEqual({ key: "territoryCreationBonusC", formula: "5d8" });
  });

  it("makes a flat REDUCTION when the clause is about damage taken", () => {
    const out = collectContributions([
      ability({ rank: "C", passiveRules: [{ key: "DamageModifier", stage: "flat", direction: "taken", value: 30 }] }),
    ]);
    expect(only(out).key).toBe("flatReduction");
  });

  it("still lets an explicit `modifierKey` win", () => {
    const out = collectContributions([
      ability({ rank: "C", passiveRules: [{ key: "DamageModifier", stage: "flat", modifierKey: "dmgBoost", value: 10 }] }),
    ]);
    expect(only(out).key).toBe("dmgBoost");
  });
});

describe("without `stage`, nothing moves", () => {
  it("is still a percentage in the stage-4 bucket", () => {
    const out = collectContributions([
      ability({ rank: "C", passiveRules: [{ key: "DamageModifier", value: 40 }] }),
    ]);
    expect(only(out).key).toBe("atkUp");
  });

  it("and a `direction: taken` percentage is still Def Up", () => {
    const out = collectContributions([
      ability({ rank: "C", passiveRules: [{ key: "DamageModifier", direction: "taken", value: 40 }] }),
    ]);
    expect(only(out).key).toBe("defUp");
  });
});
