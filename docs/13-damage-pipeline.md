# 13 — The Damage Pipeline

> **Implementation notes (Ch. 45).** Two additions and one repair since this chapter was written.
>
> - **Rolled modifiers.** A modifier may carry `roll: {key, formula, multiplier, npMultiplier}`
>   instead of a fixed `value`, for magnitudes rolled *per damage event* — Penthesilea's *Goddess
>   of War* is the reference case. The pipeline stays pure: the caller rolls and the total arrives
>   in `ctx.rolls`, exactly as the crit and negation rolls do. Resolved in `magnitudeOf`, the one
>   place a modifier's magnitude is read.
> - **A Command Spell damage factor.** Damage Block, Damage Up, Halve NP and NP Max multiply the
>   **finished total**, after every stage, because each is phrased against "Total Damage"
>   (Ch. 17 §17.2). Factors compose multiplicatively, so Halve NP followed by NP Max returns to
>   x1 in either order.
> - **A `NaN` guard.** A modifier with no numeric magnitude used to produce `NaN`, which survived
>   every stage and clamped the final total to **zero** — one malformed rule element silently
>   deleted an attack. `magnitudeOf` never returns a non-number now.

One attack can touch thirty modifiers from a dozen sources. The order they apply in changes the
answer, sometimes by hundreds of points. This chapter specifies the pipeline as a fixed,
numbered sequence of stages, states which modifiers belong to which stage, and works through
real examples from the reference Servants.

The pipeline is a **pure function**. It reads a `DamageContext` and returns a `DamageResult`
with a full breakdown. It performs no writes and has no Foundry dependency. This is what makes
it testable and what makes the targeting preview possible.

---

## 13.1 The signature

```ts
function computeDamage(ctx: DamageContext): DamageResult;

interface DamageContext {
  attacker: UnitSnapshot;
  defender: UnitSnapshot;
  board: BoardSnapshot;

  attack: {
    kind: "normal" | "attackSkill" | "damageSpell" | "np" | "magicCrest" | "counter";
    abilityId: string | null;
    rank: Rank | null;
    categorizedAsNP: boolean;
    isAoE: boolean;
    isFixedDamage: boolean;
    bypassModifiers: boolean;          // volatile-debuff damage
    element: Element | null;
    hitIndex: number;                  // for multihit
    hitCount: number;
  };

  base: BaseAttackSpec;                // which BA, what factors
  multiplier: number;                  // "3.5x damage"
  flatBonus: number;                   // "plus 100"

  crit: { isCrit: boolean; chanceUsed: number };
  reaction: { kind: "none"|"block"|"evade"; blockValue: number };
  luckChecks: { increasedDamage: number; reducedDamage: number };

  band: number;                        // banded AoE
  bandMultiplier: number;
}

interface DamageResult {
  total: number;
  magical: number;
  physical: number;
  fixed: number;
  breakdown: Stage[];                  // ordered, for the audit trail
  flags: {
    negatedBy: string | null;          // "Anti-Purge", "Invuln", "Magic Resistance"
    shieldAbsorbed: number;
    exceededInjuryThreshold: boolean;  // pre-Def Crk
  };
}

interface Stage {
  index: number;
  name: string;
  before: { mag: number; phys: number };
  after:  { mag: number; phys: number };
  contributors: Array<{ source: string; value: number; note?: string }>;
}
```

Every stage records its contributors. That array **is** the damage explainer in Chapter 30.

---

## 13.2 The stage list

Sixteen stages. The numbering is stable and referenced from effect definitions
(`stage: 7` in a rule element).

| # | Stage | What happens |
|---|---|---|
| 0 | **Precondition** | Substitution / Anti-Purge / element-to-heal conversion; early exits |
| 1 | **Base** | Select BA(STR)/BA(MAG) and their factors; produce `mag` and `phys` |
| 2 | **Crit** | `± 5d10`, applied to Base Attack; the `+` branch scaled by crit-damage % |
| 3 | **Ability multiplier** | `× multiplier × conditionalMultipliers`, `+ flatBonus` |
| 4 | **Combined percent** | ΣAtk Up − ΣDef Up, applied once (see §13.4) |
| 5 | **Component amplification** | STR-only / MAG-only percentage modifiers |
| 6 | **Band** | Distance-band multiplier for banded AoE |
| 7 | **Flat attack bonuses** | Divinity, Dmg Boost, Avenger's counter bonus |
| 8 | **Environment** | Day/Night, Home Base attack bonus, Territory Creation |
| 9 | **ZON penalty** | −5d10 if the Servant is outside its Master's ZON |
| 10 | **Luck: Increased Damage** | +Damage Modifier roll if the AU's Luck Check succeeded |
| 11 | **Resistance** | Magic Resistance on the MAG portion; strength resistance |
| 12 | **Flat reductions** | Dmg Cut, Battle Continuation, Territory Creation defence, Home Base |
| 13 | **Luck: Reduced Damage** | −Damage Modifier roll if the DU's Luck Check succeeded |
| 14 | **Block** | ×(1 − blockPercent); 25% base, same value vs NP |
| 15 | **Total-damage modifiers** | Effects that explicitly say "Total Damage": Underpower, Cover, CS Halve NP, PC AoE tails, Mad Enhancement NP reduction |
| 16 | **Absorption and clamp** | Invuln, Endure, Def Crk addition, floor at 0, integer floor |
| — | **Barrier** | A second Health pool in front of the defender; **after** every stage and every Command Spell interrupt (see §13.8a) |

Stages 0 and 16 are bookends. Stages 1–3 build the bracketed term of the author's formula
(`[(Base Attack ± 5d10) × multiplier + flat]`), 4–10 are attacker-favouring,
11–14 are defender-favouring, 15–16 are the final adjustments.

---

## 13.3 Stage-by-stage

### Stage 0 — Precondition

Early exits, evaluated in this order:

```
1. Substitution on DU        → result = 0, negatedBy = "Substitution"   (beats Aim)
2. Anti-Purge on DU          → result = 0, negatedBy = "Anti-Purge"     (beats Pierce, Invuln)
3. Element→heal conversion   → PoisHeal / CursHeal / FlamHeal convert this packet to healing
4. Freeze + Fire             → Freeze removed, no damage or effects
5. Freeze + damage < 150     → no damage or effects
6. STR Reflect / MAG Reflect → damage and effects negated here, redirected to the AU
7. Dragonblight on AU        → elemental damage reduced to 0
```

Note 6 is a *redirection*, not a cancellation: the pipeline re-runs with roles reversed at
`global` range, and the original defender takes nothing.

Note 5 is Freeze's absorption clause: *"If a Frozen Unit is Attacked and receives less than 150
damage, it receives no damage or effects."* But this needs the damage *total*, which is not
known at stage 0. **DECISION.** Freeze's threshold test is deferred to stage 16, where the
total exists; stage 0 only handles the Fire-breaks-Freeze case, which is element-based and
knowable up front. The stage table notes this.

### Stage 1 — Base

```ts
let mag = 0, phys = 0;
for (const src of ctx.base.sources) {
  const unit = resolveUnit(src.unit, ctx);          // "self" | "partner" | explicit
  const v = unit.stats.baseAttack[src.component] * src.factor;
  if (src.component === "mag") mag += v; else phys += v;
}
```

Component selection follows Chapter 06 §6.7: fixed, combined, or range-banded.

`Silence` intervenes here: it strips the MAG component from normal attacks, and for a
MAG-only attacker reduces range to 1 and forces BA(STR).

### Stage 2 — Crit

**Both `Attack+` and `Attack−` are `5d10`** (Ch. 41 Q1). The `+` and `−` in the names are the
operators: a crit **adds** the roll, a non-crit **subtracts** it.

**Which branch is taken is a percentage roll, not a coin** (Ch. 14 §14.6). It was a literal `1d2`
until Scáthach was authored, and the consequence was larger than it sounds: `Crit Up` and
`Crit Dwn` had **no reader at all**, in either direction. The effects applied, showed on the
sheet, and every attack was still an even coin. `critChance` now reads the attacker's outgoing
crit modifiers and the defender's incoming ones, from a base of 50.

**The roll applies to Base Attack, before the ability multiplier.** The author's reference
calculation brackets it explicitly:

```
[(Base Attack ± 5d10) × (Skill/Spell/NP multiplier) ± … ] × …
```

with the worked case `[(200+35) × 4 × 2 + 100] × 190% = 3762`. Only that placement reproduces
the stated 1,980 inside the bracket; applying the roll *after* the multiplier gives 1,735.

```
crit:     total = (base + roll("attack+") × critFactor)
non-crit: total = (base − roll("attack-"))            // floored at 0
```

This also matches the Beginner difficulty rule — *"To play without damage modifiers, just use
Base Attack for damage calculation instead of Attack+/Attack−"* — which only makes sense if both
are adjustments **to Base Attack** rather than to the finished number. And it matches the
`Damage Modifier` roll being `5d10`, the same pool used for the ZON penalty and the Luck Check
damage adjustments.

**Crit *damage* percentages scale the roll, and only the roll** (Ch. 41 **Q39**, answered in
`0.2.1`):

```ts
if (ctx.isCrit) {
  const critPct = sumOf(au, "critDmUp")   - sumOf(au, "critDmDwn")
                - sumOf(du, "critResUp")  + sumOf(du, "critResDwn")
                + overCritBonus(au, ctx);            // (critChance − 100) when > 100
  total += ctx.rolls["attack+"] * Math.max(0, 1 + critPct / 100);
} else {
  total -= ctx.rolls["attack-"];                     // never scaled
}
```

Three things follow, and all three are worth stating because `0.2.0` had them wrong:

**The `Attack−` subtraction is never scaled.** Crit-damage effects govern *crit damage*, and a
non-crit has none. Only the `+` branch reads the multiplier.

**Crit-damage effects are far weaker than `0.2.0` assumed.** `Crit DmUp +100%` turns a mean
27.5-point roll into 55 — a 27.5-point gain *before* the multiplier, which then scales it. It
does not double the attack.

**`Crit ResUp` can drive the factor to zero but not below.** The `max(0, …)` clamp is what stops
a defensive buff from turning a crit into a penalty.

> **Superseded reading.** `0.2.0` placed the roll at stage 3, *after* the ability multiplier,
> and put the crit percentages in the **stage-4 bucket** gated on `attack:crit`. Both were
> wrong, and they compounded. If you implemented `predicate: ["attack:crit"]` `DamageModifier`
> rule elements for crit damage, delete them.

`Over Crit` adds `(critChance − 100)%` to the same stage-2 factor when the chance exceeded 100,
not to the bucket.

Beginner difficulty skips this stage entirely.

**Worked micro-example.** Karna, BA(STR) 125, *Uncrowned Arms Mastership* toggled to crit damage
`+40%`, crits with a `5d10` of 31 on a `4×` NP.

| | `0.2.1` (correct) | `0.2.0` (wrong) |
|---|---|---|
| Stage 2 — crit | `125 + 31 × 1.40 = 168.4` | `125 × 4 = 500` (multiplier first) |
| Stage 3 — multiplier | `168.4 × 4 = 673.6` | `500 + 31 = 531` (roll after) |
| Stage 4 — bucket | `+0` → `673.6` | `+40` → `743.4` |

**673 against 743** — a 70-point divergence on a single small attack, growing with the
multiplier. This is the correction with the largest numerical consequence so far.

### Stage 3 — Ability multiplier, conditional multipliers, and the flat bonus

```
total = (mag + phys) × multiplier × Π(conditionalMultipliers) + flatBonus
mag  = total × (mag / (mag + phys))
phys = total × (phys / (mag + phys))
```

The flat bonus is distributed proportionally so that later component-scoped modifiers
(Magic Resistance) see the right share. This is the prototype's approach and it is correct.

Examples: `4x damage plus 100` (Heracles's *Nine Lives*), `3.5x damage` (Penthesilea's
*Outrage Amazon*), `2.5x` (Fragarach Counter), `5x` (Karna's *Vasavi Shakti*).

**Conditional multipliers stated in the ability's own description also land here**, inside the
bracket. The `× 2` in the author's `[(200+35) × 4 × 2 + 100]` is the NP's own *"deals 100% extra
damage on Units with the [Sky] Attribute"* clause.

So an ability that says *"deals X% extra damage to units matching P"* multiplies at stage 3,
while a **buff** that says *"damage dealt is increased by X%"* joins the bucket at stage 4. The
distinction is where the text lives — on the ability, or on an effect — and the content
validator checks it.

**Q49** records one unresolved detail in that reference calculation: its outer percentage bucket
reads `(100 + 100 + 20 − 30)%`, and the second `+100` has no stated source once the `× 2` is
accounted for as the `[Sky]` clause. We implement it as written above — the clause multiplies
once, at stage 3 — and have asked whether the bucket term is a second, separate bonus.

### Stage 4 — The combined percent bucket

This is the stage the rulebook constrains most explicitly:

> *"100% Def Up does not always mean no damage is taken. For example, if the AU has 30% Atk Up
> and uses a Normal Attack on a Unit who has 100% Def Up, then the damage calculation would be
> (100+30−100)%, so it would deal 30% damage only, not 0."*

So `Atk Up` and `Def Up` **sum additively into one bucket** and are applied once:

```ts
const bucket = sumAtkUp(au, ctx) - sumDefUp(du, ctx);
const factor = Math.max(0, 1 + bucket * 0.01);
mag *= factor; phys *= factor;
```

**What joins the bucket:**

| Attacker side | Defender side |
|---|---|
| `Atk Up` family (incl. `Atk Up (STR)`, `Atk Up (Charisma)`, `N.Atk Up`) | `Def Up` family (incl. `Def Up (Dragon)`) |
| `Atk Dwn` family (negative) | `Def Dwn` family (negative), incl. `Def Crk`'s classification |
| `NP DmUp` / `NP DmDwn` (when the attack is an NP) | `Ward` (conditional on category) |
| `Dmg Up` (conditional on target category) | Master essence damage reduction (`Steel Training` −20%/−15% NP) |
| Mad Enhancement's damage increase | Mad Enhancement's damage reduction |
| Presence Concealment's +100% / +50% NP | Kingprotea's NP-damage reduction per Proliferation stock |
| Berserk's +50% | Karna's *Kavacha and Kundala* −90% |
| Master essence damage bonuses (`Antumbra` +20%, etc.) | Penthesilea's *Goddess of War* d4×10% reduction |
| Penthesilea's *Goddess of War* d4×10% bonus | |
| Kingprotea's *Monstrous Strength* +150%/+75% NP | |
| Van Gogh's *Existence Outside The Domain* clauses 2/3 | Van Gogh's *Existence Outside The Domain* clause 2 |
| Alter Ego's ±50% vs Outsiders | Alter Ego's ±50% from Outsiders |
| Scáthach's *God Slayer* +30%/+70% | |
| Nemo's *Great Ram Nautilus* +150% vs Large | |

**What does NOT join the bucket** (and why):

| Modifier | Why not | Stage |
|---|---|---|
| `Dmg Boost` / `Dmg Cut` | Flat values, not percentages | 7 / 12 |
| Divinity | Flat | 7 |
| Day/Night ±25% | Environmental, applies to Total including NP | 8 |
| Home Base ±10%/+20% | Environmental | 8 / 12 |
| Territory Creation | Dice-rolled flat | 8 / 12 |
| Magic Resistance % | Component-scoped, applies after everything | 11 |
| Block | A reaction, not an effect; applied as its own multiplicative step | 14 |
| Underpower | Explicitly "Total Damage … reduced by 50%" | 15 |
| Cover's +100% | Explicitly "Total Damage the Servant takes … increased by 100%" | 15 |
| CS: Halve Noble Phantasm | Explicitly "Total Damage taken … reduced by 50%" | 15 |

The dividing line is the phrase **"Total Damage"**. When an effect says it, the effect operates
at stage 15 on the finished number. When it says "damage dealt is increased by X%" it joins the
bucket. This is a rule you can apply mechanically while authoring content, and the validator
checks it against the effect's description text.

**RISK.** The bucket sums modifiers that are conceptually multiplicative. Mad Enhancement EX
(+100%), Presence Concealment (+100%), and Berserk (+50%) summing to +250% rather than
multiplying to +900% is a large balance difference. The rulebook's Def Up example proves
*additive* for the Atk Up/Def Up pair specifically. **DECISION.** Additive for everything in
the bucket, per the one worked example we have. Flagged in Ch. 41 as the second-most-important
open question after the Attack+ tables.

### Stage 5 — Component amplification

Modifiers that apply to only one component:

> Mad Enhancement: *"All damage dealt … is increased by X% including NP; X is **halved** for
> damage which uses Base Attack (MAG)."*

So Mad Enhancement contributes its full value to the STR portion and half to the MAG portion.
That cannot live in a single shared bucket, so it splits: the STR share joins stage 4, the
differential joins stage 5.

**DECISION.** A modifier with different STR and MAG magnitudes contributes
`min(strVal, magVal)` to stage 4 and the difference to stage 5 on the larger component. This
keeps the additive-bucket semantics while supporting asymmetric modifiers. The breakdown shows
both contributions attributed to the same source, so the audit trail stays readable.

Also here: Karna's *Mana Burst (Flames)* declaring `Fire Damage (half)` — an element applying
to half the damage.

### Stage 6 — Band

`× bandMultiplier` for banded AoE (Nemo's *Triton's Conch*: 1.5× adjacent, 0.5× at range 2).

### Stage 7 — Flat attack bonuses

```
+ Divinity           (Van Gogh +45, Karna +50, Kingprotea +100, Mannanán +40, Semiramis +30)
+ Dmg Boost
+ Avenger's counter bonus  (Castor: +80 when countering)
+ Vasavi Shakti's per-Divinity-rank bonus vs the DU
+ Penthesilea's Charisma passive (+20 for other allies in range)
```

All *"including NP"* by their own text — Divinity's phrasing is uniformly *"All damage dealt is
increased by N including NP"*, so it is not NP-reduced.

Distribution across components is proportional, same as stage 2.

### Stage 8 — Environment

```
Day/Night:      ±25% for units with the [Dark] attribute, including NP
Home Base atk:  +20% (10% NP) when BOTH combatants are in the AU's home base
Territory Creation (offence): + Nd20 / Nd10 / Nd8 / Nd6 / Nd4 by rank, when the AU is in
                              its home base — even attacking outside it
```

Territory Creation's offensive passive is a **dice roll inside the damage pipeline**. That
breaks purity unless rolls are pre-supplied. **DECISION.** All random values consumed by the
pipeline are rolled *before* it runs and passed in `ctx.rolls`, a pre-populated map keyed by
roll purpose. The pipeline is pure; the caller is responsible for the dice. This also makes
golden-file testing trivial — fix the roll map, assert the output.

```ts
interface DamageContext {
  // …
  rolls: {
    critMultiplier?: number;
    territoryCreationAtk?: number;
    territoryCreationDef?: number;
    battleContinuation?: number;
    zonPenalty?: number;              // 5d10
    damageModifierUp?: number;        // Luck Check: Increased Damage
    damageModifierDown?: number;      // Luck Check: Reduced Damage
    block?: number;
    penthesileaGoddessAtk?: number;   // 1d4
    penthesileaGoddessDef?: number;
  };
}
```

### Stage 9 — ZON penalty

> *"When a Servant deals damage with an Attack while outside of its Master's ZON, damage dealt
> is reduced by 5d10 (i.e. the Damage Modifier roll)."*

A flat subtraction. Applies to Servants only, and not to Free Servants (no Master ⇒ no ZON ⇒
the rule cannot apply — an inference, Ch. 41).

Dioscuri exception: satisfied if *either* twin is in ZON.

### Stage 10 — Luck Check: Increased Damage

> *"When the AU successfully Attacks, do a Luck Check. If Successful … use the 'Damage Modifier'
> roll and increase damage dealt by value rolled."*
> *"Note: Cannot be used to increase damage of NP and Attacks categorized as NP."*

Flat addition, blocked for NPs.

### Stage 11 — Resistance

```ts
if (!ctx.attack.ignoresMagicResistance && mag > 0) {
  const mr = magicResistanceOf(du);
  if (mr) {
    const atkRank = ctx.attack.rank ?? au.parameters.mag;    // Ch. 05 §5.5
    if (compare(mr.rank, atkRank) >= 0) mag = 0;             // complete negation
    else mag *= (1 - mr.percent / 100);
  }
}
```

Only the MAG portion. `"the effect of Magic Resistance is halved"` clauses reduce the amount
*negated*, not the incoming damage — a subtle inversion the source spells out:
*"the reduction is applied to the Total Damage originally reduced by Magic Resistance."*

### Stage 12 — Flat reductions

```
− Dmg Cut
− Battle Continuation  (2d10+N by rank; N-dice DOUBLED for NP damage)
− Territory Creation (defence)  (3d10+N by rank, for allies in the home base)
− Nemo's Poseidon's Protection  (−50, −100 vs NP, in Waterside/Imaginary Numbers)
```

Applied proportionally across components, clamped so the total cannot go below 0 at this stage.

Note Battle Continuation's NP clause: *"For Noble Phantasm damage received, the Total value of
the roll is doubled."* Doubling the *total of the roll*, not the dice count — the rank table
says "2d10+20" for A and the doubling applies to the sum, giving 2×(2d10+20). Heracles's sheet
says *"if NP, the number of dice rolled is doubled"* — which is 4d10+20, a different number.
**DECISION.** Follow the per-Servant sheet where it conflicts with the generic skill (Heracles:
double the dice). Ch. 41.

### Stage 13 — Luck Check: Reduced Damage

> *"When your Unit takes damage, do a Luck Check. If Successful, use the Damage Modifier roll
> and reduce damage by value rolled."*

Flat subtraction. No NP exclusion stated, unlike stage 10.

### Stage 14 — Block

```
blockPercent = 25                              // base, per Ch. 41 Q1
             + Σ blockUp                       // percentage points
             + (strengthenBlockSucceeded ? 25 : 0)
total *= (1 − min(blockPercent, 100) / 100)
```

**Block is a flat percentage reduction, not a roll, and it is the same against Noble Phantasms
as against anything else.** This replaces the rulebook's dice-based Block and its NP doubling.

Consequences of the change, all of which are improvements:
- Block no longer needs a roll, so it is one fewer round trip in the reaction ladder.
- Block scales with the attack rather than being a fixed subtraction, so it stays relevant
  against large Noble Phantasms without the doubling rule.
- `Luck Check: Strengthen Block` — *"use the Block roll again and further reduce damage"* —
  becomes a second 25 percentage points, i.e. 50% total.

Bypassed by `Pierce` and (chance-based) by `Break`. If `Break` fires, the attack deals its
extra damage instead.

### Stage 15 — Total-damage modifiers

Multiplicative on the finished total, in this order:

```
1. Mad Enhancement's NP reduction, if the incoming attack is an NP  (X/2%)
2. Cover: ×(1 + 1.00/N) for the covering Servant(s)
3. Underpower: ×0.5 on Tails
4. Presence Concealment AoE tails: ×0.5
5. CS: Halve Noble Phantasm: ×0.5
6. CS: Damage Block: ×0 for normal attacks, ×0.5 for attack skills/damage spells
7. CS: Damage Up: ×2.0   /  CS: NP Max: ×2.0
8. Invuln vs NP: ×0.5
```

Multiplicative here, unlike stage 4, because each is stated as operating on the finished
"Total Damage" independently.

### Stage 16 — Absorption and clamp

```
1. Def Crk: + flat  (AFTER the injury-threshold snapshot is taken)
2. Freeze: if total < 150 → 0 and no effects; else remove Freeze and pass the excess
3. Crystalfreeze: same, without the Fire clause
4. Petrify: if total > 200 → the unit is immediately defeated
5. Invuln: → 0 (unless Pierce; NP already halved at stage 15)
6. Shield: absorb up to the shield's remaining HP; the excess passes through
7. Endure: if lethal and health > 1 → reduce total so health lands at exactly 1
8. Guts/Battle Continuation/God Hand: evaluated by the defeat handler, not here
9. floor(total), clamp ≥ 0
```

The **injury-threshold snapshot** is taken before step 1: `exceededInjuryThreshold = total > 100`
*before* Def Crk's addition, per *"Additional damage taken from an Attack due to the Def Crk
debuff does not count towards the amount required for an Injury Roll."*

---

## 13.4 Why one additive bucket and several multiplicative points

A reasonable objection: why not make everything multiplicative, which is more common in games?

Because the source proves otherwise for the most common case. `(100 + 30 − 100)% = 30%` is
unambiguous — it is a single additive expression, not `1.30 × 0.00`. And the game's design
depends on it: `100% Def Up` is meant to be *strong but not absolute*, and a multiplicative
reading would make it absolute.

The multiplicative points at stage 15 exist because the source uses a different phrase there
("Total Damage"), and because those modifiers are all conditional one-offs (a coin flip, a
Command Spell, a Cover failure) that stack rarely.

The practical consequence for content authors is a simple rule:

> If the card says *"damage dealt/taken is increased/reduced by X%"* → stage 4.
> If the card says *"**Total Damage** is increased/reduced by X%"* → stage 15.

---

## 13.5 Worked example 1 — Penthesilea normal-attacks Heracles

**Setup.** Penthesilea: `STR A+`, BA(STR) 160, Divinity B (+40), Mad Enhancement EX active
(forced by *Hatred of Achilles* — Heracles is a Greek Male within 4 panels), *Howl of the War
God* used last turn granting `Atk Up (GreekMale)` +100% and `Atk Up (STR)` +30%. She is inside
her Master's ZON, on open ground, at night, neither has the [Dark] attribute.

**Heracles:** Mad Enhancement B permanently active (−40% taken), Battle Continuation A
(−2d10+20), no Def Up. Attacked from the front. Chooses to do nothing.

**Rolls supplied:** crit = Attack− (`5d10` → 22), Battle Continuation = `2d10` → 11, so −31.

```
Stage 0   No preconditions.
Stage 1   phys = 160, mag = 0
Stage 2   Attack−  − 5d10 (22)                              → 138
Stage 3   × 1.0, + 0                                        → 138
Stage 4   BUCKET
            Penthesilea:
              Mad Enhancement EX  +100%  (STR portion)
              Atk Up (GreekMale)  +100%
              Atk Up (STR)         +30%
            Heracles:
              Mad Enhancement B    −40%
            bucket = 100 + 100 + 30 − 40 = +190
            factor = 2.90                                   → 400.2
Stage 5   Mad Enhancement's MAG halving: no MAG portion, no-op
Stage 6   no band                                           → 400.2
Stage 7   + Divinity B (40)                                 → 440.2
Stage 8   night, neither is [Dark]; not in a home base      → 440.2
Stage 9   in ZON                                            → 440.2
Stage 10  no Luck Check                                     → 440.2
Stage 11  no MAG portion                                    → 440.2
Stage 12  − Battle Continuation A (2d10+20 = 31)            → 409.2
Stage 13  no Luck Check                                     → 409.2
Stage 14  no Block (Heracles did nothing)                   → 409.2
Stage 15  no Total Damage modifiers                         → 409.2
Stage 16  injury snapshot: 409 > 100 → TRUE
          floor                                             → 409

RESULT   409 physical damage, Injury Roll required.

Had Penthesilea critted instead (Attack+ 5d10 → 22), stage 2 would give 182, and the same
chain would land at 536 — a 127-point swing, amplified from the raw 44-point roll difference by
the ×2.90 bucket. This is why the ±5d10 sits at stage 2 and not later: it is multiplied by
everything downstream, which is what makes a flat roll behave like a meaningful crit.
```

Note how much of the number comes from the bucket: base 160 becomes 464 at stage 4 alone. This
is why the additive-vs-multiplicative question in §13.3 Stage 4 matters so much — the
multiplicative reading would give `160 × 2.0 × 2.0 × 1.3 × 0.6 = 499`, close here but wildly
divergent as modifiers pile up.

---

## 13.6 Worked example 2 — Karna's *Brahmastra Kundala* into a home base

**Setup.** Karna: BA(STR) 125 + BA(MAG) 175 combined = 300. NP `A+`, *"Hits a 7×7 panel area
within Range for 4x damage plus 100"*. Divinity A (+50). *Flash of the Sun God* active:
`Atk Up` +40% (30% NP), `NP DmUp` +20%. He is in ZON. Day round.

**Target:** an enemy Servant with `Magic Resistance B` (negates MAG rank ≤ B, else −40%),
standing in its own home base with an ally who has `Territory Creation B` on the field. Blocks.

**Rolls:** crit = Attack+ (`5d10` → 31), Territory Creation B defence = `3d10+15` → 32,
Block = flat 25%.

```
Stage 0   No preconditions.
Stage 1   phys = 125, mag = 175                              total 300
Stage 2   Attack+  + 5d10 (31), distributed proportionally
            → mag 193.1   phys 137.9                         total 331
Stage 3   × 4 + 100 → 1424
            split proportionally: mag = 1424 × (175/300) = 830.7
                                  phys = 1424 × (125/300) = 593.3
Stage 4   BUCKET (NP, so NP magnitudes apply)
            Karna: Atk Up (NP value)     +30%
                   NP DmUp               +20%
            Target: Home Base            −10%   ← a percentage on damage TAKEN
            bucket = +40 → factor 1.40   → mag 1162.9  phys 830.7
Stage 5   none
Stage 6   none
Stage 7   + Divinity A (50), proportional  → mag 1192.1  phys 851.5
Stage 8   Day, neither [Dark]; Karna not in a home base     (no change)
Stage 9   in ZON                                            (no change)
Stage 10  Luck Check: Increased Damage is BLOCKED for NP     (no change)
Stage 11  Magic Resistance B vs NP rank A+
            compare(B, A+) = B(300) vs A+(401) → -1, NOT negated
            → mag × 0.60 = 715.3             phys 851.5
Stage 12  − Territory Creation B (32), proportional
            total 1566.8 → 1534.8            mag 700.7   phys 834.1
Stage 13  no Luck Check                                     → 1534.8
Stage 14  Block: × 0.75                      mag 525.5   phys 625.6
Stage 15  no Total Damage modifiers                         → 1151.1
Stage 16  floor                                             → 1151

RESULT   1,151 damage (525 magical + 626 physical), plus Burn 3◈ and Def Dwn (B) 1◈.
```

Two things in that trace are worth calling out, because both are mistakes a first implementation
makes:

**Home Base's −10% belongs in the stage 4 bucket, not among the flat reductions at stage 12.**
It is phrased as a percentage on damage *taken*, which is the `Def Up` shape. Putting it at
stage 12 would apply it to a much larger number and over-reduce.

**Block is now multiplicative at stage 14, so its value scales with the attack.** Under the old
dice-based Block this attack lost 28 points; under the flat 25% it loses 384. That is a large
balance shift in the defender's favour against big Noble Phantasms, and it is precisely why the
rule was changed.

**The crit roll is inside the bracket, so it is multiplied by 4.** A `5d10` of 31 contributes
124 to the pre-bucket total, not 31. `0.2.0` applied it after the multiplier and produced 1,076
for this same attack; the corrected figure is 1,151. That 75-point gap is entirely the roll's
placement.

Then the same computation runs for every other unit in the 7×7 area, with different resistance
profiles, in one batch.

---

## 13.7 Fixed damage

> **Keyword: Fixed damage.** *"Fixed damage is not affected by any damage modifying effects on
> both the AU and DU **including Block** unless stated. However, Fixed damage **is** affected by
> Invuln."*

So a fixed-damage packet skips stages 2–15 entirely and runs only stages 0, 1 (as a literal
value), and 16 (for Invuln, Shield, Endure, and the clamp).

Sources: HGoB's *Dragon Wing Warriors* (50 fixed STR × N), `Repel`, `Crystallize`'s 50/turn,
`Crystalfreeze`'s 100/round, `Coma`'s removal damage, the HGoB knock-off damage.

Volatile-debuff damage (`Curse`, `Burn`, `Poison`) is *"ignores all effects that modify the
amount of damage dealt and/or received"* — the same treatment, but it is still *damage* for
trigger purposes and can be converted by `PoisHeal`/`CursHeal`/`FlamHeal` at stage 0.

---

### The context has to carry what the stages read

Three fields the pipeline reads by name — `component`, `pierce` and `ignoresMagicResistance` —
were **never set**. Four separate call sites each rebuilt `ctx.attack` from scratch and each
dropped a different subset, so `Pierce` ignored nothing, Magic Resistance could not be bypassed,
and Magic Resistance's own Instakill exemption — which is written against exactly those two
properties of the attack — had no way to be true.

There is now one builder, `attackFacts`, and every call site spreads it. It also computes the
**distance**, which nothing had ever put in the context at all.

### A Normal Attack that changes shape with distance

`normalAttack.mode` has offered `rangeBanded` since the actor schema was written and nothing
implemented it: a Servant authored with it attacked with its flat `component` at every distance,
silently, because the fallback is a legal answer.

EMIYA is the Servant it was declared for:

> *"At a Range of 1 or 2, EMIYA's Normal Attacks use Base Attack (STR). At a Range of 3 or higher,
> EMIYA's Normal Attacks use Base Attack (STR) and 20% of his Base Attack (MAG) combined
> (i.e. 75+35=110); not affected by Magic Resistance."*

Three things move together at the band edge, which is why `normalAttackAt` returns all three:

| | Melee (1–2) | Ranged (3+) |
|---|---|---|
| `sources` | STR ×1 | STR ×1 **+ MAG ×0.2** |
| `component` (what it counts *as*) | `str` | `str` |
| `ignoresMagicResistance` | false | **true** |

The third is not decoration. Measured live against Scáthach's Magic Resistance A, the ranged shot
deals **80** with the exemption and **54** without it — the MAG fifth is negated outright, because
a Rank A Magic Resistance negates MAG damage from a MAG Rank of up to A. Without that flag EMIYA's
signature attack is worse at range than in melee against half the roster.

An unknown distance falls back rather than guessing: a snapshot taken off the board has no panel,
and reading that as range 0 would put him in his melee band while previewing a shot across the map.

---

## 13.8 Multi-hit

Attacks that hit N times run the pipeline N times, with these shared elements:

| Element | Per hit or shared? |
|---|---|
| Crit determination | **Per hit** — "perform two Attack rolls to calculate damage for each hit" |
| Evade | **Per hit**, until the first failure, after which the rest cannot be evaded |
| Block | **Shared** — "damage is reduced from the Total Damage taken" |
| Injury Roll | **Shared** — one roll on the total |
| Use-limited buff consumption | **Shared** — counts as one Attack |
| Rider effects | **Shared** — applied once at the end of the Damage Step |

So the correct implementation runs N pipelines, sums, then applies Block once to the sum, then
runs stages 15–16 on the sum. **DECISION.** `computeDamage` takes `hitIndex`/`hitCount` and a
wrapper `computeAttack` orchestrates: run stages 0–13 per hit, sum, run 14–16 once.

### Repeated *attacks* are not multi-hit

EMIYA's *Overedge* is *"EMIYA performs **2 Normal Attacks in a row**"* — two whole Combat
Processes against the same defender, each with its own reaction ladder and its own Evade, inside
**one** Combat Phase. That is a different thing from a multi-hit attack, which is one Process
resolving several hits, and `damage.repeat` says so:

```yaml
damage:
  repeat: 2
```

The Phase boundary is what matters and it is easy to get wrong in a way that looks fine. A Combat
Phase is what pays EMIYA his Aria, so two Phases would pay twice for one action; and `isAoE` is
derived from **distinct defenders** rather than the process count, or the two swings would emit
`attack:isAoE` and suppress the defender's facing change into the bargain.

Multi-hit sources in the reference set: Mannanán's *Toole Fragarach* (3), Nemo's *Quickfire*
(up to 6 conditional 25-damage hits), HGoB's *Dragon Wing Warriors* (d6+4), `DblAtk Up`,
`TrplAtk Up`.

Nemo's *Quickfire* is unusual: *"Roll 6 six-sided die, this Attack Skill deals 25 STR damage
for each die that rolls X or higher"*, with X modified by five conditions. And *"Damage of this
Attack Skill is not affected by damage modifying effects on Nemo"* — so it is attacker-side
fixed but defender-side normal. `bypassModifiers` needs to be a two-sided flag:

```ts
bypassModifiers: { attacker: boolean; defender: boolean };
```

---

## 13.8a Barriers — a second Health pool

Every other defensive effect in the game is a percentage (`Def Up`), a flat subtraction
(`Dmg Cut`), a refusal (`Invuln`) or an evasion (`Dodge`). A **barrier** is none of those: it has
a bar, the bar persists between attacks, several Units stand behind one of them, and it charges
its owner for what it absorbs.

EMIYA's *Rho Aias* is the only one in the reference set, and four clauses interlock:

> *"Rho Aias has 1400 Health, and it will take the damage of the enemy's NP. For every 200 Health
> Rho Aias loses, EMIYA loses 100 Health. If the AU's NP deals more than 1400 damage, the
> remaining damage is dealt to the DUs accordingly. However, if the NP is a 'thrown weapon', Rho
> Aias' Health cannot drop below 1. EMIYA's Health cannot drop below 1 due to Rho Aias being
> damaged by the AU's NP."*

Four decisions follow from those four sentences:

- **The pool lives on the ability, not on the effect instance.** *"The remaining damage is dealt
  to the DUs accordingly"* only means something against **one** pool. An area Noble Phantasm over
  a protected 3×3 draws all of them down one 1400 in resolution order, rather than meeting a fresh
  barrier at each panel. The marker effect on each bearer carries `absorbs`, which points back at
  the source ability.
- **It runs last**, after every stage and after the Command Spell interrupts, because the sheet
  says it *"will take the damage of the enemy's NP"* — the finished number, not an intermediate.
- **The owner's share is per completed unit, not pro rata.** *"For **every** 200"* — 199 costs him
  nothing, which makes a chip attack free. It is a `statDelta` rather than damage, because he is
  not being attacked: his barrier is, and damage would trigger an Injury Roll and every on-damage
  effect he has.
- **A floored pool absorbs everything.** *"If the NP is a 'thrown weapon', Rho Aias' Health cannot
  drop below 1"* — a barrier that cannot break stops the attack however large it is, and still
  only spends what it had above the floor.

`scope: np` is the whole restriction on it, and easy to get wrong in the generous direction: an
ordinary Attack passes straight through a standing Rho Aias. Without that, it is a permanent
1400-point buffer.

The pool **decays** rather than refilling: *"restored by half of its current Health"* on each use
after the first, so 1400, then 700 + 350, then less again. Refilling to the maximum would leave
the 8◈ cooldown as its only limit, and the sheet is explicit that it is not.

---

## 13.9 Damage application

The pipeline returns a number; applying it is a separate, permission-checked step.

```
applyDamage(result, defender) → Intent[]
 1. Shield absorption (already computed at stage 16, recorded in flags)
 2. health -= total
 3. if health ≤ 0 → run the defeat chain (revival priority, Ch. 04 §4.13)
 4. if survived and exceededInjuryThreshold → Injury Roll
 5. fire onDamageTaken / onDamageDealt
 6. Drain: heal the AU by X% of damage dealt
 7. Repel: queue fixed damage to the AU at end of Combat Process
 8. Def Dwn (A)/(C) secondary stat drains
```

Step 3's ordering matters: revival happens *before* the injury roll is considered, and a
revived unit does not take an injury roll for the killing blow (it "survived" only by revival).
**DECISION.** A unit revived by Guts/Battle Continuation/God Hand does **not** perform an
Injury Roll for that attack, because Step 4 of Combat requires the DU to have "survived", and
revival is explicitly a post-defeat event. Ch. 41.

---

## 13.10 Testing the pipeline

The pipeline is the highest-value test target in the system.

**Golden-file tests.** A fixture directory of `(context.json, expected.json)` pairs, one per
scenario, with the roll map fixed. The two worked examples above are the first two fixtures.
Every bug fix adds a fixture.

**Property tests.**
- Monotonicity: increasing any `Atk Up` never decreases the result.
- Zero-floor: no input produces a negative result.
- Determinism: same context, same roll map ⇒ byte-identical result including the breakdown.
- Component conservation: `magical + physical + fixed === total` at every stage.

**Differential tests.** For attacks with no modifiers at all, the pipeline must return exactly
`base × multiplier + flat`, verifying the stages are genuinely no-ops when empty.

**Breakdown completeness.** Every modifier present on either unit must appear in exactly one
stage's `contributors` array, or be explicitly listed as inapplicable. A modifier that silently
does nothing is the failure mode principle P4 exists to prevent, and this test enforces it.

---

## 13.11 Summary of decisions

| # | Decision |
|---|---|
| D13.1 | Sixteen numbered stages, stable, referenced by rule elements. |
| D13.2 | `Atk Up` and `Def Up` sum into one additive bucket applied once at stage 4, per the rulebook's worked example. |
| D13.3 | "Total Damage" in an effect's text means stage 15, multiplicative. Everything else percentage-based means stage 4, additive. |
| D13.4 | All random values are rolled before the pipeline and passed in, keeping it pure. |
| D13.5 | Asymmetric STR/MAG modifiers split across stages 4 and 5. |
| D13.6 | The injury threshold is snapshotted before `Def Crk`'s addition. |
| D13.7 | Fixed damage skips stages 2–15; `bypassModifiers` is two-sided. |
| D13.8 | Multi-hit runs stages 0–13 per hit, then 14–16 once on the sum. |
| D13.9 | A revived unit performs no Injury Roll for the killing attack. |
| D13.10 | Attack+/Attack− multipliers are dice-registry entries with placeholder defaults, pending the missing source table. |

---

**Next:** [14 — Checks and Randomness](14-checks-and-randomness.md)
