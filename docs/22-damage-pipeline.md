# 22 — The damage pipeline: sixteen stages

## What it is

The system computes damage through a precondition gate and **sixteen strictly ordered stages**, each transforming the damage value through a specific rule category. The order is the mechanism — applying a multiplier at stage 4 instead of stage 3 silently produces the wrong number. Every number in the attack card is auditable: each stage records its contributions in a breakdown array, capturing the source of every modifier and why it was included or excluded (`module/rules/damage/pipeline.mjs:2-22`).

The pipeline is deterministic: every random value (Attack+/Attack−, crits) is rolled by the caller and passed into `ctx.rolls`, allowing the same computation to run in a pure rules layer without Foundry, in the targeting UI for speculative damage, and in chat with an identical result (`module/rules/damage/pipeline.mjs:5-9`).

## Where it lives

| File | Role |
|---|---|
| `module/rules/damage/pipeline.mjs` | The precondition gate and the sixteen stages, ordered and deterministic |
| `module/rules/damage/instances.mjs` | Expanding repeat/instances declarations into N damage specs |
| `module/rules/damage/dice-count.mjs` | Damage as a dice-count threshold (Nemo's Quickfire) |
| `module/rules/damage/riders.mjs` | Whether a resolved Damage Step fires its on-hit effects |
| `module/rules/explain.mjs` | Rendering the breakdown into displayable rows |
| `module/engine/shield.mjs` | A second Health pool between attack and target |

## How it works

### The precondition, then sixteen stages

Each stage runs in order, capturing what it changed into the `breakdown` array. Stages 0–16 are:

0. **Precondition** (`module/rules/damage/pipeline.mjs:153`): Early exits in fixed precedence — Substitution, Anti-Purge, invulnerable-by-nature, element-to-heal conversion, Freeze broken by Fire, Dragonblight, Reflect. Any match halts the pipeline.

1. **Base** (line 194): Select base attacks and their multipliers. `diceTotal` (Quickfire's counted dice), `fixedValue` (Barrel Bombing's flat 150), or sources from the ability's own `base` block.

2. **Crit** (line 295): Apply Attack+/Attack−. The `5d10` roll is applied to Base Attack **before** the multiplier, per the author's reference calculation placing it inside the bracket `[(200+35)×4×2+100]×…` — applying it after gives the wrong total.

3. **Ability Multiplier** (line 349): The ability's declared multiplier and its conditional multipliers (text conditions, not buffs). Conditional multipliers stated in the description land inside the bracket here; buff percentages land at stage 4.

4. **Combined Percent** (line 384): The one additive bucket—Atk Up, Def Up, Dmg Cut, etc.—summed before application. *"If AU has 30% Atk Up and DU has 100% Def Up: (100+30−100)% = 30% damage."*

4.5. **Elements** (line 472): Element-based resistance and amplification. Run as a substage of stage 4, scaling damage by the element percent.

5. **Component Amplification** (line 561): Component-scoped modifiers (STR-only, MAG-only). Applied separately to the physical and magical shares.

6. **Band** (line 588): Banded AoE multipliers (Nemo's *Triton's Conch*: 1.5× adjacent, 0.5× at range 2).

7. **Flat Attack Bonuses** (line 602): Flat +damage modifiers and flat +taken (Castor's Avenger increases all damage he takes). Elemental bonuses (Raikou's Lightning +40) are scaled through their element separately.

8. **Environment** (line 689): Board-state modifiers (terrain, field effects).

9. **ZON Penalty** (line 720): Zone-of-negation damage reduction.

10. **Luck: Increased Damage** (line 742): Luck checks that increase outgoing damage.

11. **Resistance** (line 763): Magic Resistance and physical Def scales the surviving damage multiplicatively. Applied as `1 + rank / 100` after both positive and negative modifiers sum.

12. **Flat Reductions** (line 805): Dmg Cut and other flat defences.

13. **Luck: Reduced Damage** (line 860): Luck checks that reduce incoming damage.

14. **Block** (line 880): A reaction that reduces damage by 25% (or higher with Block Up / Strengthen Block). Base 25% is a flat percentage applied here, undiminished against Noble Phantasms.

15. **Total-Damage Modifiers** (line 919): Modifiers whose text explicitly says *"Total Damage"* — applied multiplicatively to the finished number, each independently.

16. **Absorption and Clamp** (line 959): Shields absorb damage before it reaches Health. Freeze and Crystalfreeze negate attacks under 150 damage. Invuln negates all non-NP damage (NP halved at stage 15, then checked here). Petrify defeats outright if damage exceeds 200 in one attack.

### Audit trail capture

Every stage calls `begin(index)` on entry, records contributions via `contribute(source, value, note, side)`, and calls `end(index)` on exit. The `side` field (`"attacker"`, `"defender"`, or `null`) enables card visibility: viewers see only their own modifiers unless explicitly shared (`module/rules/damage/pipeline.mjs:1354-1375`, `module/rules/explain.mjs:48-79`). A stage with no contributions still appears in the breakdown, marked with `"—"`, so a reader can ask "was stage 9 even considered?" and get a truthful answer.

Fixed damage bypasses stages 2–15 entirely and goes straight to stage 16 (`module/rules/damage/pipeline.mjs:91-95`). One-sided bypass (e.g., Nemo's Quickfire) zeroes its side's modifiers at collection points (stage 4, 4b, 7 for attacker; stage 4, 11, 12, 14 for defender) rather than skipping the stage, so the breakdown explains which modifiers were excluded.

## Invariants & edge cases

1. **The `5d10` roll belongs to stage 2, not stage 1.** It is not a base-attack factor; it scales the base before the ability multiplier. Placing it after the multiplier reverses the author's reference calculation (`module/rules/damage/pipeline.mjs:284-287`).

2. **Crit-damage percentages scale the roll only.** Attack− is never scaled by `critDmUp`, because a non-crit has no crit damage to modify (`module/rules/damage/pipeline.mjs:289-291`).

3. **Component-scoped modifiers contribute asymmetrically.** The shared part contributes to stage 4; the differential (STR vs MAG) contributes to stage 5 (`module/rules/damage/pipeline.mjs:409-414`).

4. **Fixed damage is independent of fixed values.** `base.fixedValue` says where the number comes from; `attack.isFixedDamage` says who may modify it. They are two questions, not one (`module/rules/damage/pipeline.mjs:240-241`).

5. **Block is flat 25%, undiminished against NP.** Block Up adds to the percentage; Strengthen Block adds another 25%. The cap is 100% (`module/rules/damage/pipeline.mjs:31`, line 893, line 903).

6. **Injury Threshold is 100.** Damage exceeding this requires an Injury Roll, checked at stage 16 before shields and Freeze apply (`module/rules/damage/pipeline.mjs:34`, line 966).

## Traps and anti-patterns

**Confusing fixed damage with fixed values.** `base.fixedValue` and `attack.isFixedDamage` are independent. Nemo's Barrel Bombing states *"150 Fire damage"* and *"not affected by damaging modifying effects **on Nemo**"* — a flat value with a one-sided bypass. Gating fixed values on `isFixedDamage` meant a stated number could only be used by attacks that bypassed both sides, so Barrel Bombing dealt ZERO because stage 1 fell through to a `sources` list it did not have. Found in a live world. **Decouple the two: `base.fixedValue` specifies the number; `attack.isFixedDamage` specifies the scope** (`module/rules/damage/pipeline.mjs:229-246`).

**Component-scoped crit damage without carrying the component through.** Nemo's Poseidon's Protection is *"Crit Damage of Attacks which use Base Attack (MAG)"*, and an earlier implementation took every `critDmUp` the bearer held regardless of component. **Pass the component context to every modifier lookup** — `sumCritMods` now reads component-scoped modifiers at the call site (`module/rules/damage/pipeline.mjs:312-318`).

## Open questions

- **Resolved: sixteen stages, plus a precondition.** `STAGE_NAMES` holds 17 entries, but index 0 is
  named `"precondition"` and runs before the attack is measured — it is the outright-negation gate
  (Substitution and similar), not a step in the arithmetic. Indices 1-16, `base` through
  `absorptionAndClamp`, are the sixteen stages the file header names
  (`module/rules/damage/pipeline.mjs:37-42`).

- **Confirmed live: the sign cannot reverse, and an over-100% resistance cannot heal.** The pipeline
  was run against a 200-damage baseline with a Lightning attack:

  | defender | full element | half element (`elementFraction: 0.5`) |
  |---|---|---|
  | none | 200 | -- |
  | `elementDefUp` 50 (resist) | **100** (x0.50) | **150** (x0.75) |
  | `elementDefDwn` 50 (weakness) | **300** (x1.50) | **250** (x1.25) |
  | `elementDefUp` 150 (extreme) | **0** (clamped) | **50** (x0.25) |

  Halving multiplies the percentage by a positive fraction, so the sign is preserved by arithmetic --
  a halved weakness stays a weakness and a halved resistance stays a resistance; both move *toward*
  1.0 and never past it. The `Math.max(0, 1 + scaled / 100)` clamp
  (`module/rules/damage/pipeline.mjs:483`) is what stops a resistance above 100% from inverting into
  healing: it floors the factor at zero rather than going negative.

- **Confirmed structurally: the pool is ability-keyed, which is what makes overflow mean anything.**
  The write is `shieldDelta(owner.id, item.id, -lost)` -- `owner` is the ability's owner and `item`
  is the ability document, so the pool hangs off **one** Rho Aias rather than off each protected
  unit's effect instance. The intent carries that shape too: `{t, unitId, abilityId, delta}`. Four
  protected units therefore draw down one 1400 in resolution order, exactly as the file's header
  claims -- *"an area Noble Phantasm hitting four protected Units draws all four down one 1400 in
  resolution order, rather than meeting four fresh barriers"* (`module/engine/shield.mjs:23-27`).
  What remains unexercised is the ordering under a genuine four-target NP, which needs that board.
