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

   **The two element rules are one function, shared with damage that never runs the pipeline.** *"Any Fire damage removes Freeze with no damage or effects"* and *"Burn, Poison and Curse damage is converted to healing by Flame Heal, Poison Heal and Curse Heal"* are `elementalEarlyExit(defender, element)` (`module/rules/damage/pipeline.mjs`), which stage 0 asks and so does the applier for a **bare** damage intent — one with an `element` and no `breakdown`: a field's `Damage` action (Piedra Del Sol's *"50 Fire damage"*) and the terrain's Burning toll. `engine/applier.mjs#resolveElements` runs before the batch is planned and replaces such an intent with a heal, or with `removeEffect(freeze)` and no damage. Before #154 a bare damage intent carried no element and nothing read one, so a Frozen enemy in the stone took the 50 and stayed Frozen. Two readers of "what does a damage of element X do" would drift (Ch. 46 §46.3), so there is one. Periodic effect ticks keep their own authored `healConversion`.

1. **Base** (line 194): Select base attacks and their multipliers. `diceTotal` (Quickfire's counted dice), `fixedValue` (Barrel Bombing's flat 150), or sources from the ability's own damage block, through one reader (`damageBaseOf`, `module/rules/damage/instances.mjs`): `base` when the block states one (`base: { sources: [...] }`, the long spelling), otherwise the block's own `sources: [...]` (the short one, which an aftermath has always used), otherwise one source built from `component`, and failing all three the Normal Attack's. The resolution, the card, the actor-sheet preview and the NP ranking all read it, so they cannot disagree. Every damage key is read off the block the resolution is under, through `damageBlockFor` in `engine/attack.mjs`: the aftermath's own block for a splash, otherwise the primary's resolved for whichever `branches` entry fires — so an aftermath's element fraction, Magic Resistance flag, multiplier, flat bonus and Total Damage modifiers are its own and never the primary's (#136). A block that declares both `base` and `sources`, or a key that is not in `DAMAGE_BLOCK_KEYS`, is refused by `validate:content`: the top-level `sources` of Xiuhcoatl's primary was dropped for `component: str`, so she dealt 500 where her sheet says 1000, and `damage` is one untyped `ObjectField` that no Silent Drop guard could see into (#135).

2. **Crit** (line 295): Apply Attack+/Attack−. The `5d10` roll is applied to Base Attack **before** the multiplier, per the author's reference calculation placing it inside the bracket `[(200+35)×4×2+100]×…` — applying it after gives the wrong total.

1a. **A range-banded Normal Attack re-sources its base** (`rules/normal-attack.mjs#normalAttackAt`, #189). A band that names only a component, as the Sphinx Wehem-Mesut's `{from: 2, component: mag}`, takes its base from that component; it fell back to the flat STR sources, so the swing was labelled MAG and dealt as STR and Magic Resistance never saw it. Stage 11 names an attacker with no MAG Rank as such, where it read *"attack null"*.
3. **Ability Multiplier** (line 349): The ability's declared multiplier and its conditional multipliers (text conditions, not buffs). Conditional multipliers stated in the description land inside the bracket here; buff percentages land at stage 4. A Normal Attack carries its own (`normalAttack.conditionalMultipliers`, through `normalAttackAt` and `attackFacts`), because it has no damage block: Mesektet makes Ozymandias's Normal Attacks *"+100% against Dark"*, a ×2 of its own, not an Atk Up summed with his others. Mesektet's NP doubles inside the bracket too, before its +100, as the reference calculation does (ruled 2026-10-06, #189 readings 3 and 18).

4. **Combined Percent** (line 384): The one additive bucket—Atk Up, Def Up, Dmg Cut, etc.—summed before application. *"If AU has 30% Atk Up and DU has 100% Def Up: (100+30−100)% = 30% damage."*

4.5. **Elements** (line 472): Element-based resistance and amplification. Run as a substage of stage 4, scaling damage by the element percent.

5. **Component Amplification** (line 561): Component-scoped modifiers (STR-only, MAG-only). Applied separately to the physical and magical shares.

6. **Band** (line 588): Banded AoE multipliers (Nemo's *Triton's Conch*: 1.5× adjacent, 0.5× at range 2).

7. **Flat Attack Bonuses** (line 602): Flat +damage modifiers and flat +taken (Castor's Avenger increases all damage he takes). Elemental bonuses (Raikou's Lightning +40) are scaled through their element separately.

8. **Environment** (line 689): Board-state modifiers (terrain, field effects).

9. **ZON Penalty** (line 720): Zone-of-negation damage reduction.

10. **Luck: Increased Damage** (line 742): Luck checks that increase outgoing damage.

11. **Resistance** (line 763): Magic Resistance and physical Def scales the surviving damage multiplicatively. Applied as `1 + rank / 100` after both positive and negative modifiers sum. **Magic Resistance in rank mode compares against the attack's own Rank** (`ctx.attack.rank`): a Noble Phantasm is compared by its own Rank, Karna's Brahmastra (A+) against Quetzalcoatl's Magic Resistance A is halved (`−50% MAG (MR A < attack A+)`) whatever Karna's MAG is. Only an *unranked* attack (a Normal Attack) falls back to the attacker's MAG parameter, unless the Normal Attack states its own Rank: `normalAttack.attackRank`, which the Golden Hind authors as A+, its Noble Phantasm's Rank, because its sheet gives the ship no MAG Rank and at Drake's MAG E any Magic Resistance of E or better negated the swing outright (ruled 2026-10-05, #187 reading 8). It travels through the projection, `normalAttackAt` and `attackFacts` as `attackRank`. Every caller must therefore put the ability's Rank on the attack, and they do it through `attackIdentityOf` in `module/engine/attack.mjs` (the resolution, the counterfactual and the targeting preview); the preview once built none of it and read the caster's MAG, so a player aimed Brahmastra at her, read "negated", and the card dealt half (#124).

12. **Flat Reductions** (line 805): Dmg Cut and other flat defences.

13. **Luck: Reduced Damage** (line 860): Luck checks that reduce incoming damage.

14. **Block** (line 880): A reaction that reduces damage by 25% (or higher with Block Up / Strengthen Block). Base 25% is a flat percentage applied here, undiminished against Noble Phantasms.

15. **Total-Damage Modifiers** (line 919): Modifiers whose text explicitly says *"Total Damage"* — applied multiplicatively to the finished number, each independently. Its producers are Cover (Ch. 32), an ability's own Total Damage clauses (Drake's broadside), and a platform's area tier: a Unit caught aboard a platform by an enemy area takes the platform's `aoePassengerFactor` here — Quetz's *"50% Total Damage"* — with a breakdown row naming the platform (`rules/platforms.mjs#platformTierModifiers`, Ch. 27 *Cross-level targeting*, #138).

16. **Absorption and Clamp** (line 959): Shields absorb damage before it reaches Health. Freeze and Crystalfreeze negate attacks under 150 damage. Invuln negates all non-NP damage (NP halved at stage 15, then checked here). Petrify defeats outright if damage exceeds 200 in one attack.

### Audit trail capture

Every stage calls `begin(index)` on entry, records contributions via `contribute(source, value, note, side)`, and calls `end(index)` on exit. The `side` field (`"attacker"`, `"defender"`, or `null`) enables card visibility: viewers see only their own modifiers unless explicitly shared (`module/rules/damage/pipeline.mjs:1354-1375`, `module/rules/explain.mjs:48-79`). A stage with no contributions still appears in the breakdown, marked with `"—"`, so a reader can ask "was stage 9 even considered?" and get a truthful answer. An adjustment made after the pipeline — God Hand's *"survives at 1"* against an attack it has recorded, Underpower, a Command Spell's factor — is a `{stage, label, from, to}` row, and `explainDamage` renders it under its own label (#184); it had printed "Stage undefined".

Fixed damage bypasses stages 2–15 entirely and goes straight to stage 16 (`module/rules/damage/pipeline.mjs:91-95`). One-sided bypass (e.g., Nemo's Quickfire) zeroes its side's modifiers at collection points (stage 4, 4b, 7 for attacker; stage 4, 11, 12, 14 for defender) rather than skipping the stage, so the breakdown explains which modifiers were excluded.

## Invariants & edge cases

1. **The `5d10` roll belongs to stage 2, not stage 1.** It is not a base-attack factor; it scales the base before the ability multiplier. Placing it after the multiplier reverses the author's reference calculation (`module/rules/damage/pipeline.mjs:284-287`).

2. **Crit-damage percentages scale the roll only.** Attack− is never scaled by `critDmUp`, because a non-crit has no crit damage to modify (`module/rules/damage/pipeline.mjs:289-291`). **And they are *"Not NP unless stated"*** (Appendix A: Crit DmUp; plain *"Not NP"* for Crit ResUp and Crit ResDwn): `sumCritMods` reads `critMagnitudeOf`, which against a Noble Phantasm is the clause's `npValue` and 0 where it states none, where `magnitudeOf` would fall back to the full `value` as it does for every other family. "Against a Noble Phantasm" is `isNPAttack` (`kind: "np"` or `categorizedAsNP`), exported once and shared with crit chance. After Lucha Libre Xiuhcoatl had been critting automatically and with +50% crit damage (#131).

3. **Component-scoped modifiers contribute asymmetrically.** The shared part contributes to stage 4; the differential (STR vs MAG) contributes to stage 5 (`module/rules/damage/pipeline.mjs:409-414`).

4. **Fixed damage is independent of fixed values.** `base.fixedValue` says where the number comes from; `attack.isFixedDamage` says who may modify it. They are two questions, not one (`module/rules/damage/pipeline.mjs:240-241`).

5. **Block is flat 25%, undiminished against NP.** Block Up adds to the percentage; Strengthen Block adds another 25%. The cap is 100% (`module/rules/damage/pipeline.mjs:31`, line 893, line 903).

6. **Injury Threshold is 100.** Damage exceeding this requires an Injury Roll, checked at stage 16 before shields and Freeze apply (`module/rules/damage/pipeline.mjs:34`, line 966).

7. **Damage from outside an attack can defeat.** A Poison tick, a fall, a drain: any damage intent without a breakdown runs `io.defeatIfLethal` after it lands, which offers revivals through the attack path's own `resolveDefeatOf` (`attack.mjs#defeatFromDamage`), with nobody as the killer. Only the attack path ever resolved a defeat, so such damage left Units standing at 0 Health (§46.4-CE).

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
