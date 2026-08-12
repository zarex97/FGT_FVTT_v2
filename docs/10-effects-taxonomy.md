# 10 — Effects Taxonomy

There are roughly 120 named effects in F/GT, plus per-Servant unique ones. They are not a flat
list — they are classified along several axes that other rules key off, and getting the
classification wrong breaks rules that never mention the effect by name.

This chapter defines the classification. Chapter 11 defines the runtime machinery. Appendix A
is the full catalogue with formal semantics for each.

---

## 10.1 Why classification is load-bearing

Consider `Off.Debuff Immune`: *"The Unit is Immune to Offensive Debuffs."* To evaluate it, the
engine must know, for every debuff in the game, whether it is offensive. The source gives a
list, but it ends with "any other debuffs that reduce damage dealt" — an open-ended definition.
So classification is not metadata; it is **semantics**, and every effect must carry it
explicitly rather than relying on a hardcoded list.

Four separate rules depend on classification alone:

| Rule | Needs to know |
|---|---|
| `nvDebuff Immune` / `vDebuff Immune` | volatile vs non-volatile |
| `Men.Debuff Immune` | mental |
| `Off.Debuff Immune` / `Def.Debuff Immune` | offensive vs defensive |
| `Dragonblight` | which debuffs are volatile (it blocks inflicting them) |

Plus `Bind` (a named union of ten debuffs), the Sleep-family exclusivity rule, and the
Curse/Poison staging rules.

---

## 10.2 The classification axes

```ts
interface EffectClassification {
  polarity:  "buff" | "debuff" | "status";        // status = neither
  volatility: "volatile" | "nonVolatile" | null;  // debuffs only
  mental:     boolean;                            // debuffs only
  valence:    "offensive" | "defensive" | "neither";
  families:   string[];                           // "atkUp", "bind", "sleep", "critUp"…
  stacking:   StackingRule;
  removability: Removability;
}
```

### Axis 1 — Polarity

**Buff** — a positive effect. Removable by `Dispel`. Blocked by `No Buff`. Its application
chance is modified by `Buff ChUp` (attacker side) and `Buff Up`/`Buff Down` (target side).

**Debuff** — a negative effect. Removable by `Cure`. Its application chance is modified by
`Debuff ChUp`/`Debuff ChDwn` (attacker side) and `Debuff ResUp`/`Debuff ResDwn` (target side).
Blocked by the `Debuff Immune` family.

**Status** — *neither a buff nor a debuff*. The source uses this phrase explicitly and
repeatedly. Members:

| Status | Source |
|---|---|
| Presence Concealment (active) | "neither a buff or a debuff, and are Unremovable" |
| Mad Enhancement (active) | "neither a buff or a debuff … cannot be removed except by their own effect/duration" |
| Riding's Active MOV Up | "not a buff and cannot be removed by buff removal effects, or prevented by an effect that prevents buffs from being applied" |
| Queen's Poison (Semiramis's item effect) | "neither a buff or a debuff and is Unremovable" |
| Dove (Semiramis's familiar mark) | "neither a buff nor a debuff, is Unremovable" |
| Fragarach (Mannanán) | "neither a buff or a debuff and is Unremovable" |
| Construction (Semiramis) | "neither a buff or debuff and is Unremovable" |

Statuses are invisible to `Dispel`, `Cure`, `No Buff`, `Debuff Immune`, and to "remove 1 buff"
counting. This is a genuinely distinct third category and modelling it as "a buff with the
unremovable flag" would break `No Buff` and buff-counting effects.

### Axis 2 — Volatility (debuffs only)

The source's own section headings: **Debuffs (Non-volatile)**, **Debuffs (Mental)**,
**Debuffs (Volatile)**, **Debuffs (Other)**.

**Non-volatile** — stat and rule modifiers with no ongoing damage or action denial:
`Atk Dwn`, `Def Dwn` (+A/B/C variants), `Crit Dwn`, `Crit DmDwn`, `No Crit`, `Crit ResDwn`,
`NP DmDwn`, `NP Seal`, `Skill Seal`, `Debuff ChDwn`, `Debuff ResDwn`, `Buff ChDwn`,
`Buff Down`, `No Buff`, `Heal Down`, `No Heal`, `Max HpDwn`, `NP Degen`, `NP Lock`, `NP Lag`,
`Dmg Loss`, `Def Crk`, `AGL Dwn`, `LUC Dwn`, `Agility Loss`, `Luck Loss`, `MOV Down`,
`TEC Dwn/Distracted`, `Balance Down`, `Decoy`, `Delay`.

**Mental** — `Charm`, `Berserk`, `Confuse`, `Terror`, `Disorder`. All five have mutual
exclusivity rules (§10.5).

**Volatile** — ongoing damage or action denial: `Curse`, `Burn`, `Shock`, `Poison`, `Stun`,
`Stop`, `Freeze`, `Petrify`, `Slow`, `Immobilize`, `Disable`, `Seal`, `Sap/Bleed`, `Sleep`,
`Nightmare`, `Coma`, `Blind`, `Evil Curse`, `Severe Burn`, `Deadly Poison`, `Silence`,
`Deafen`, `Gashed`, `Addle`, `Dragonblight`, `Crystallize`, `Crystalfreeze`, `Webbed`,
`Drowning`, `Seared`, `Scald`, `Pigify`, `Toad`.

**Other** — the terminal ones: `Instakill`, `Death`, `Erase`, `Sacrifice`. These sit outside
the immunity system almost entirely (see §10.6).

**RISK.** `Mental` debuffs are listed under their own heading, separate from Volatile and
Non-volatile. Are they *also* volatile or non-volatile? The source does not say. This matters
for `nvDebuff Immune` (Kingprotea has it at 60%+60%) — does it block Charm?

**DECISION.** Mental debuffs are classified as **non-volatile** *and* mental. Rationale: they
apply no damage-over-time and are conceptually closer to the non-volatile set; and Kingprotea's
Self-Suggestion (a mental-resistance-flavoured skill) granting `nvDebuff` resistance reads
naturally if mental ⊆ non-volatile. Recorded in Ch. 41 as needing confirmation.

### Axis 3 — Valence

The source gives explicit lists, both ending with an open clause:

> **Offensive Buffs** — Atk Up, Dmg Up, Crit Up, Crit DmUp, G.Crit, Over Crit, NP DmUp, Aim,
> Pierce, Debuff ChUp, Dmg Boost, Ignore Def, DblAtkUp, TrplAtkUp, Dodge Counter, Guard
> Counter, Auto Counter, Accel, Break, Insight, **any other buffs that increase damage dealt**

> **Defensive Buffs** — Def Up, Dmg Cut, Ward, Debuff ResUp, Invuln, Dodge, Max HpUp, Block Up,
> Shield, Repel, STR Reflect, MAG Reflect, Dodge Counter, Guard Counter, Crit Guard,
> Anti-Purge, Endure, **any other buffs that reduce damage taken**

Note `Dodge Counter` and `Guard Counter` appear in **both** lists. So valence is not a
partition — it is a set of tags, and an effect may carry both.

```ts
valence: Array<"offensive" | "defensive">;      // may be empty, may be both
```

The `Off.Debuff Immune` check is therefore `effect.valence.includes("offensive")`, and an
effect tagged both is blocked by either immunity.

### Axis 4 — Families

A **family** is a name that other rules refer to collectively. The source is explicit about
several:

> *"Any type of buff that has 'Atk Up' in its name (e.g. N.Atk Up, Atk Up (STR)) all count as
> Atk Up."*
> *"Any type of buff that has 'Def Up' in its name (e.g. Def Up (Dragon)) all count as Def Up."*
> *"Any type of debuff that has 'Atk Dwn' in its name all count as Atk Dwn."*
> *"Any type of debuff that has 'Def Dwn' in its name all count as Def Dwn."*
> *"Def Crk … Categorized as Def Dwn."*
> *"Note: DblAtk Up and TrplAtk Up are **not** categorized as Atk Up buffs."*

And the `Bind` keyword:

> *"'Bind' refers to the following effects — Stun, Disable, Immobilize, Slow, Petrify, Shock,
> Webbed, Seal, Freeze, Crystalfreeze."*

**DECISION.** Family membership is **explicit data**, not derived from the name string.
Deriving it from names ("contains 'Atk Up'") is what the source describes for human readers,
but it is fragile — `TrplAtk Up` contains "Atk Up" and is explicitly excluded. Every effect
declares its families:

```yaml
id: atkUpStr
name: "Atk Up (STR)"
families: [atkUp]

id: trplAtkUp
name: "TrplAtk Up"
families: []            # explicitly NOT atkUp

id: defCrk
name: "Def Crk"
families: [defDwn]      # "Categorized as Def Dwn"

id: freeze
families: [bind]
```

Families in use: `atkUp`, `atkDwn`, `defUp`, `defDwn`, `critUp`, `critDwn`, `npDmUp`,
`npDmDwn`, `bind`, `sleep`, `debuffImmune`, `guts`, `counter`, `reflect`, `elementalHeal`.

---

## 10.3 The buff catalogue by mechanism

Grouping by *what they do to the engine*, which is how the rules layer consumes them. Full
semantics in Appendix A.

### Group B1 — Damage output modifiers
`Atk Up`, `Dmg Up` (conditional on target category), `Dmg Boost` (flat), `NP DmUp`,
`Crit DmUp`, `Over Crit`, `Ignore Def`.

Characteristic: they feed the damage pipeline's attacker-side stages. Almost all carry a
**reduced NP magnitude** ("all damage dealt is increased by 30%; if NP, 15%"), which means the
magnitude is not a scalar:

```ts
interface Magnitude { base: number; np?: number; }
```

`Dmg Up` is different from `Atk Up`: *"All damage dealt to a Unit who matches the specified
category is increased **including NP**"* — no NP reduction, and it is conditional on the
target. So it carries a predicate.

### Group B2 — Damage intake modifiers
`Def Up`, `Ward` (conditional), `Dmg Cut` (flat), `Crit ResUp`, `Crit Guard`, `Shield`,
`Invuln`, `Anti-Purge`, `Endure`, `Max HpUp`.

The source gives a critical worked example for `Def Up` that constrains the pipeline design:

> *"100% Def Up does not always mean no damage is taken. For example, if the AU has 30% Atk Up
> and uses a Normal Attack on a Unit who has 100% Def Up, then the damage calculation would be
> (100+30−100)%, so it would deal 30% damage only, not 0."*

So `Atk Up` and `Def Up` are **summed into a single additive multiplier**, not applied as two
independent multiplications. This is exactly what the prototype did
(`combinedMultiplier = multiplierAttack − multiplierDefense`) and it is correct — for this
class of modifier. Chapter 13 shows which modifiers join that sum and which do not.

### Group B3 — Hit/avoid modifiers
`Dodge`, `Aim`, `Pierce`, `Substitution`, `Insight`, `Accel`, `Break`, `AGL Up`,
`Agility Boost`, `TEC Up/Focus`, `Block Up`.

These modify the *reaction ladder*, not the damage pipeline. Several are explicitly
anti-symmetric pairs with a stated precedence:

```
Substitution  beats  Aim        (target cannot be hit at all)
Substitution  beats  Dodge      (if both, Substitution applies)
Aim           beats  Dodge      (and beats the Evade action)
Anti-Purge    beats  Pierce     (target takes no damage regardless)
Anti-Purge    beats  Invuln     (if both, Anti-Purge applies)
Pierce        beats  Invuln     (and beats the Block action)
Pierce        does NOT beat     Def Up, Dmg Cut
```

This forms a small precedence lattice that Chapter 12 encodes explicitly.

### Group B4 — Crit modifiers
`Crit Up`, `S.Crit Up`, `Crit DmUp`, `G.Crit`, `Over Crit`, `Area CritUp`, `Clarity`.

`S.Crit Up` is `Crit Up` whose *application cannot be prevented and which is Unremovable* —
a different removability, same mechanism. It appears constantly in the reference set
(Mannanán, Castor, Pollux, Karna, Kiritsugu, Drake) because it is party-buff-proof.

`Area CritUp` is positional: it lives on one unit and confers crit chance on allies *while they
remain within range*. So it is an **aura**, not an applied buff — the difference is that
leaving the radius removes the benefit without removing an effect. Modelled as an aura rule
element (Ch. 24), not as an `ActiveEffect` on the recipients.

`Clarity` doubles the magnitude of `Area CritUp` buffs affecting this unit — a
**modifier-of-modifiers**. It requires the aura evaluation to consult the recipient's effects,
which the aura design must support.

### Group B5 — Regeneration and economy
`Regen`, `NP Regen`, `Dmged NP Regen`, `Drain`, `Heal Up`, `PoisHeal`/`CursHeal`/`FlamHeal`.

`Drain` is *"Health restored by X% of the damage dealt, there may be a maximum"* — reads the
damage result, so it fires post-pipeline.

The `*Heal` family converts a damage type into healing. Note this must run *before* the
"volatile damage ignores modifiers" rule strips modifiers, or it never fires. Chapter 13
places it at stage 0.

### Group B6 — Reaction automation
`Dodge Counter`, `Guard Counter`, `Auto Counter`, `Repel`, `STR Reflect`, `MAG Reflect`.

These insert *automatic* behaviour into the Combat Process. All of them are negated by `Addle`
(*"Negates all Skills and effects which activate automatically"*), which is the cleanest
example of why effects need a suppression mechanism and not just modifiers.

### Group B7 — Protection and immunity
`Debuff Immune` and its six variants, `Buff Removal ResUp`, `Debuff ResUp`, `Guts`.

`Debuff Immune` variants: `nvDebuff Immune`, `vDebuff Immune`, `Men.Debuff Immune`,
`Off.Debuff Immune`, `Def.Debuff Immune`, `(Name) Immune`. None stack with themselves.
All exclude `Instakill`, `Death`, `Erase` unless stated.

`Guts` has an explicit priority chain and an explicit non-removal clause:
> *"When a Unit is defeated and revived through any effect; any buffs, debuffs, and other
> effects on the Unit are not removed."*

### Group B8 — Multi-hit
`DblAtk Up`, `TrplAtk Up`, and the `Multihit` keyword (which is an attack property, not a buff).

The interaction rule is explicit: roll triple first; if it fires, double does not. And the
defender reaction rule: *"the DU can separately Evade or Block each hit. If an Evade fails, the
DU cannot Evade the remaining hits. If Block is used, damage is reduced from the Total Damage
taken."* — so Block applies once to the sum, Evade applies per hit until the first failure.

---

## 10.4 The debuff catalogue by mechanism

### Group D1 — Mirror-image stat modifiers
`Atk Dwn`, `Def Dwn`, `Crit Dwn`, `Crit DmDwn`, `NP DmDwn`, `Debuff ChDwn`, `Debuff ResDwn`,
`Buff ChDwn`, `Buff Down`, `Heal Down`, `Max HpDwn`, `Dmg Loss`, `Def Crk`, `AGL Dwn`,
`LUC Dwn`, `MOV Down`, `TEC Dwn`.

Symmetric with their buff counterparts, same pipeline stages, opposite sign.

The three `Def Dwn` variants deserve highlighting because they appear constantly in the
reference set:

| Variant | Extra effect |
|---|---|
| `Def Dwn (A)` | Luck −1 at end of Damage Step whenever **successfully Attacked** |
| `Def Dwn (B)` | NP Damage taken further increased |
| `Def Dwn (C)` | Agility −1 at end of Damage Step whenever **successfully Attacked** |

And the source clarifies the trigger explicitly: *"the secondary effect activates when
successfully Attacked, not when damaged by an Attack"* — so a successful attack that dealt zero
damage still drains the stat.

### Group D2 — Action denial
`Stun`, `Stop`, `Freeze`, `Petrify`, `Immobilize`, `Disable`, `Seal`, `Sleep`, `Nightmare`,
`Coma`, `Webbed`, `Crystalfreeze`.

All prevent Acting, but with important differences:

| Debuff | Cannot | Special |
|---|---|---|
| `Stun` | Act | — |
| `Stop` | Act | **All durations frozen**, cooldowns frozen, Regen suppressed |
| `Freeze` | Act | <150 dmg does nothing; ≥150 breaks it and passes excess; **any** Fire damage breaks it with no damage |
| `Petrify` | Act | **Buffs/debuffs have no effect**; >200 dmg in one attack = instant defeat; cure requires Gold Needle or an equal/higher-ranked removal |
| `Immobilize` | Move | Agility Checks +4 |
| `Disable` | anything but Move | — |
| `Seal` | STR normal attacks, Skills, Attack Skills, NP | **Spells still usable** |
| `Sleep` | Act | Damage taken +100%, then removed; cannot Counter that phase |
| `Nightmare` | Act | Sleep + 10% current HP loss per turn |
| `Coma` | Act | Sleep + on removal, 20% of BA(STR) as fixed STR damage |
| `Webbed` | Act | Struggle roll to escape (10% base, +5% per failure, 20% if STR≥B); removed by damage |
| `Crystalfreeze` | Act | Freeze-like, but Fire does not break it |

`Stop` is the most architecturally significant: it freezes **all** durations on the unit,
including newly applied ones, and stops cooldown movement in both directions. That means
`isActive(duration, now)` cannot be a pure comparison against `now` for a Stopped unit — the
unit needs a **local clock**.

**DECISION.** Each unit carries `pausedTicks: number`, incremented on every turn end while
Stopped. Duration checks use `now − unit.pausedTicks` as the effective time. This preserves
the absolute-expiry design (Ch. 07 D7.3) while supporting Stop, at the cost of one field.

### Group D3 — Damage over time
`Curse`, `Poison`, `Burn`, `Sap/Bleed`, `Nightmare`, `Crystallize`, `Freeze`, `Crystalfreeze`,
`Drowning`.

The staging debuffs are the interesting ones:

**Curse.** Stage 1 = 25 damage, at end of turn, every ⅓◈ turns. Re-application adds a stage.
Stage N = 25N. Linear.

**Poison.** Stage 1 = 20 damage at end of Round. Stage increments at Round *start* if still
poisoned. Stage N = 20 × 2^(N−1). **Exponential** — stage 5 is 320 damage per round. This is a
genuine threat and the UI must show the stage prominently.

Both ignore all damage modifiers, per the section note.

**Van Gogh's curse economy** is built on this: she inflicts Curse on *herself* 3 times (at
"500% chance", i.e. guaranteed after resistance) and converts stages into NP cooldown
reduction, with a passive halving her Curse damage and a skill preventing Curse from ever
killing her. See Chapter 35.

### Group D4 — Mental
`Charm`, `Berserk`, `Confuse`, `Terror`, `Disorder`. See §10.5.

### Group D5 — Perception and capability
`Blind`, `Silence`, `Deafen`, `Addle`, `Dragonblight`, `Gashed`, `Pigify`, `Toad`.

`Blind` is unusually detailed — five numbered clauses, including interactions with three named
skills (`Mystic Eye`, `Glam Sight`, `Clairvoyance`, `Eye of the Mind`). It is the best example
of an effect that must be able to *query the target's skill list*, not just its stats.

`Addle` is the suppression debuff: *"Negates all Skills and effects which activate
automatically (e.g. Auto Counter, Instant Counter, automatically Evade)."* Its implementation
is a suppression predicate over rule elements tagged `automatic: true`.

`Pigify`/`Toad` are the "polymorph" debuffs and they *negate passive skill effects entirely* —
the second suppression case. Both also *set* MOV, Range, and base attack rather than modifying
them, exercising the `set` operator from Ch. 06 §6.11.

### Group D6 — Positional and structural
`Decoy`, `Delay`.

`Decoy` constrains the *opponent's legal actions*, which no other debuff does:
> *"that enemy Unit cannot Move away from the Unit with Decoy, and can only Move in its
> direction; and can only Attack and use enemy-Unit-affecting Skills on the Unit with Decoy;
> and **has** to Attack the Unit with Decoy if it is able to."*

So it feeds three separate systems: movement legality (Ch. 08), target selection (Ch. 09), and
a *forced-action* requirement (Ch. 18). And it is exempt from resistance when self-applied or
ally-applied — because it is used defensively (Kiritsugu's *Scapegoat* puts Decoy on an ally
deliberately).

`Delay` mutates turn order (Ch. 07 §7.8).

### Group D7 — Terminal
`Instakill`, `Death`, `Erase`, `Sacrifice`. §10.6.

---

## 10.5 Mutual exclusivity rules

Several effect families cannot coexist. The rules are stated per-effect in the source; here
they are collected because the engine needs them as a single table.

### Mental exclusivity

```
Charmed  ⇒ immune to Confuse, Berserk
Berserk  ⇒ immune to Charm, Confuse
Confused ⇒ immune to Charm, Berserk
```

A clean three-way mutual exclusion. Terror and Disorder are outside it and stack with all
three.

### Sleep family

> *"Sleep and derivatives of Sleep (e.g. Nightmare, Coma) do not stack with each other unless
> stated. A Unit inflicted with a Sleep derivative **cannot** be inflicted with Sleep. However,
> if a Unit inflicted with Sleep is inflicted with a Sleep derivative, the Sleep debuff is
> **replaced** with the new debuff, using the duration of the Sleep derivative. A Unit already
> inflicted with a Sleep derivative cannot be inflicted with a different one."*

State machine:

```
       ┌──────────────────────────────────┐
       │             (none)               │
       └──┬───────────┬──────────┬────────┘
   Sleep  │     Nightmare │   Coma │
          ▼           ▼          ▼
      ┌───────┐  ┌──────────┐ ┌──────┐
      │ Sleep │  │Nightmare │ │ Coma │
      └───┬───┘  └──────────┘ └──────┘
          │  Nightmare/Coma applied →  replace, use new duration
          │  Sleep applied → no-op
          └─────────────────────────────▶
      Nightmare/Coma: Sleep is refused; the other derivative is refused
```

### Fire/Ice interaction

`Freeze` is removed by **any** amount of Fire damage, and the attack deals no damage or effects
in that case. `Crystalfreeze` explicitly lacks this clause.

`Seared` combines Burn and Shock, *is treated as both*, and replaces existing Burn/Shock while
**extending its duration by theirs**:
> *"If Seared is applied to a Unit who is already inflicted with Burn and/or Shock, remove
> Burn/Shock from the affected Unit and replace it with Seared, the duration of Seared will
> then be extended by the duration of Burn & Shock on the Unit."*

`Scald` is "treated as Burn but ignores Burn resistance including Burn Immune", and a unit with
Scald cannot be inflicted with Burn.

These three form the most intricate replacement logic in the game, and they are implemented as
**declarative replacement rules** on the effect definitions:

```yaml
id: seared
families: [burn, shock]
replaces:
  - { ids: [burn, shock], mode: absorbDuration }
id: scald
families: [burn]
blocks: [burn]
ignoresResistanceFor: [burn]
```

### Non-stacking, non-refreshing

The overwhelmingly common clause is:

> *"Does not stack and will not reset the duration if reapplied unless stated."*

This is the **default** for nearly every volatile and mental debuff. It means reapplication is
a **no-op**, not a refresh. That is unusual — most systems refresh — and getting it wrong makes
control effects far stronger than intended.

**DECISION.** `StackingRule.NONE_NO_REFRESH` is the default for debuffs unless the effect
declares otherwise. `Webbed` is the one explicit exception in the catalogue:
*"Does not stack. Duration will be extended if reapplied."*

---

## 10.6 Terminal effects and the immunity boundary

`Instakill`, `Death`, `Erase`, `Sacrifice` sit outside the normal resistance system, and the
boundary is stated repeatedly and precisely:

| Effect | Semantics | Resistible? |
|---|---|---|
| `Instakill` | Health reduced to 0 | Yes, by Magic Resistance and some skills — but **not** by `Debuff Immune` unless stated |
| `Death` | Unit is defeated; **ignores revival** | Partially — at reduced magnitude |
| `Erase` | Removed from existence; **does not count toward the Grail counter** | Almost never |
| `Sacrifice` | Health to 0; **cannot be prevented by any Resist or Immunity** | No |

The recurring formula, from Item Construction:

> *"The above effects are halved for the Instakill debuff, and is further halved for the Death
> debuff, and does not affect the Erase debuff."*

So a 50% debuff resistance becomes 25% vs Instakill, 12.5% (stated as 10%) vs Death, 0% vs
Erase. Van Gogh's *Existence Outside The Domain* uses the same ladder: 25% / 10% / 5%.

Note the published numbers are **not** exact halvings (50 → 25 → 10, not 12.5; 35 → 15 → 5,
not 17.5/8.75). **DECISION.** The ladder is authored explicitly per effect rather than computed,
because the source's own numbers are rounded inconsistently. The effect declares:

```yaml
debuffResist:
  general: 35
  instakill: 15
  death: 5
  erase: 0
```

Magic Resistance's clause is subtler:

> *"Also affects Instakill and Death **unless** the Instakill or Death debuffs are from an
> Attack/Attack Skill/NP that deals STR damage or that is not affected by Magic Resistance.
> Erase is completely unaffected."*

So Magic Resistance's terminal protection is conditional on the *source* being MAG-based.
Scáthach's *Gáe Bolg Alternative* inflicts Instakill and uses BA(STR) — Magic Resistance does
not protect against it. Her *Gate of Skye* inflicts Death and uses BA(MAG) — it does.

And:

> *"Other debuffs from Attacks that are 'not affected by Magic Resistance' will still have their
> inflict chance reduced from Magic Resistance."*

The non-terminal debuffs *are* still resisted even from a STR source. Only the terminal ones
lose the protection. This asymmetry must be encoded explicitly.

---

## 10.7 Application chance

Every effect application is a probability. The source's default:

> *"When a buff is applied or a debuff is inflicted, if no percentage (%) chance is stated, it
> is assumed that the percentage chance is 100%."*

But chances above 100% are common — Van Gogh has `150%` and `500%` clauses, Scáthach's
*Gáe Bolg Alternative* has `500%` Stun. These exist to **overcome resistance**, and the
resolution is:

```
finalChance = baseChance
            + inflicterModifiers      (Debuff ChUp, Item Construction, Queen's Poison)
            − targetModifiers         (Debuff ResUp, Magic Resistance, Item Construction,
                                       Master essences, Self-Suggestion)
```

then a roll against `finalChance`, clamped to `[0, 100]` at roll time but *not* during
accumulation — a 500% base minus 60% resistance is still 440%, i.e. guaranteed.

Two per-target rules from the General Notes that are easy to miss:

> *"Whenever a Unit is inflicted with multiple debuffs with one Attack/Skill/Spell/NP, roll
> Resistance for **each debuff separately**."*
> *"Whenever multiple Units receive an effect from the same Attack/Skill/Spell/NP that has less
> than a 100% chance of being applied, roll **separately for each Unit**."*
> *"Example: 70% chance of inflicting Curse on two different Units. Do **not** roll once for the
> 70% chance, each affected Unit rolls their own dice."*

So the roll count for an AoE applying 3 debuffs to 5 units is **15**, not 1 and not 5. The
engine batches these into one deterministic roll sequence for auditability, but they are
genuinely independent.

`Luck Check: Prevention` sits on top: after a failed resistance, the target may spend a Luck
Check to negate **one** debuff. Not usable for Instakill, Death, or Erase.

---

## 10.8 Effect metadata schema

Every effect in the catalogue is authored against this schema:

```yaml
id: defDwnC                       # stable identifier
name: "Def Dwn (C)"
polarity: debuff
volatility: nonVolatile
mental: false
valence: [defensive]
families: [defDwn]
stacking: { rule: magnitudeStacks }
removability: { cure: true, dispel: false, unremovable: false }
magnitude:
  kind: percent
  hasNpVariant: true
description: "All damage taken is increased. Agility is reduced by 1 at the end of the
  Damage Step whenever this Unit is successfully Attacked."
rules:
  - key: DamageTakenModifier
    value: "@magnitude"
    npValue: "@npMagnitude"
  - key: OnEvent
    event: damageStepEnd
    predicate: ["self:wasSuccessfullyAttacked"]
    then: [{ key: StatDelta, stat: agility, delta: -1 }]
terminalLadder: null
icon: "icons/svg/downgrade.svg"
```

Appendix A contains ~120 of these. They are the single largest piece of content in the system
and they are authored once, validated by the build, and referenced by id from every ability.

---

## 10.9 Summary of decisions

| # | Decision |
|---|---|
| D10.1 | "Status" (neither buff nor debuff) is a first-class third polarity, not a flagged buff. |
| D10.2 | Valence is a **set** of tags; `Dodge Counter` and `Guard Counter` are both offensive and defensive. |
| D10.3 | Family membership is explicit data, never derived from the effect's name string. |
| D10.4 | Mental debuffs are classified as non-volatile *and* mental (pending confirmation, Ch. 41). |
| D10.5 | Debuff default stacking is `NONE_NO_REFRESH`; refreshing requires an explicit declaration. |
| D10.6 | Terminal-effect resistance ladders are authored per effect, not computed by halving. |
| D10.7 | `Stop` is implemented with a per-unit `pausedTicks` counter offsetting the global clock. |
| D10.8 | Sleep-family, Seared, and Scald replacement logic is declarative (`replaces`/`blocks`). |
| D10.9 | Resistance rolls are per-(unit, debuff) pairs, never batched into one roll. |

---

**Next:** [11 — The Effect Engine](11-effect-engine.md)
