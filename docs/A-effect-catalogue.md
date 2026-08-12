# Appendix A — Effect Catalogue

Every named effect in F/GT, with its classification (Ch. 10), its mechanism, its stacking rule,
and its implementation note. This is the authoritative reference the compendium is built from.

**Column key:**
- **Pol** — polarity: `B` buff, `D` debuff, `S` status (neither).
- **Vol** — volatility: `nv` non-volatile, `v` volatile, `M` mental, `T` terminal, `—` n/a.
- **Val** — valence: `O` offensive, `D` defensive, `OD` both, `—` neither.
- **Stack** — `mag` magnitudeStacks, `nnr` noneNoRefresh, `nr` noneRefresh, `st` stage,
  `cnt` count, `hi` highestOnly, `ext` noneExtend.
- **Stage** — damage pipeline stage (Ch. 13 §13.2) where it acts, if applicable.

---

## A.1 Buffs — damage output

| Effect | Pol | Val | Stack | Stage | Semantics |
|---|---|---|---|---|---|
| `Atk Up` | B | O | mag | 4 | Damage dealt +X%. Reduced magnitude for NP. Family: `atkUp`. Named variants (`N.Atk Up`, `Atk Up (STR)`, `Atk Up (Charisma)`, `Atk Up (Magus)`, `Atk Up (GreekMale)`) all count as `atkUp`. |
| `Dmg Up` | B | O | mag | 4 | Damage dealt to units matching a category +X%, **including NP** (no reduced magnitude). Carries a predicate. |
| `Dmg Boost` | B | O | mag | 7 | Damage dealt +X **flat**. Affects NP only if stated. |
| `NP DmUp` | B | O | mag | 4 | NP damage +X%. Also affects abilities *categorized as NP*. Not passive NPs. |
| `Overcharge` | B | O | mag | — | Magnitude of all **non-damage** NP effects increased. Explicitly excludes direct damage. |
| `Crit DmUp` | B | O | mag | 3 | Crit damage +X%. Not NP unless stated. |
| `Over Crit` | B | O | nr | 3 | While crit chance > 100%, crit damage +（chance − 100)%. |
| `Ignore Def` | B | O | nr | 4 | Attacks ignore `Def Up` on the DU. **Does not ignore `Dmg Cut`.** |
| `Break` | B | O | nr | 14 | Chance to ignore Block; extra damage if the attack was Blocked. Default chance 100% if unstated. |

## A.2 Buffs — damage intake

| Effect | Pol | Val | Stack | Stage | Semantics |
|---|---|---|---|---|---|
| `Def Up` | B | D | mag | 4 | Damage taken −X%. Reduced magnitude vs NP. Family: `defUp`. Sums additively with attacker `Atk Up` (Ch. 13 §13.4). |
| `Ward` | B | D | mag | 4 | Damage from a matching category −X%, **including NP**. Predicated. |
| `Dmg Cut` | B | D | mag | 12 | Damage taken −X **flat**, including NP. Not bypassed by `Pierce`. |
| `Crit ResUp` | B | D | mag | 3 | Crit damage taken −X%. Not NP. |
| `Crit Guard` | B | D | mag | — | AU's crit chance −X% when attacking this unit. Not NP unless stated. |
| `Shield (X)` | B | D | nr | 16 | Separate pool absorbing damage; excess passes through. **A Master with Shield cannot be Overpowered.** |
| `Invuln` | B | D | nr | 16 | No damage. Vs NP: 50% reduction instead. "Reduce Health to 0" becomes "halve current Health". Cannot Block. `Pierce` ignores it. Does **not** prevent rider debuffs. Masters with it cannot be Overpowered. |
| `Anti-Purge` | B | D | nr | 0 | No damage from anything, including NP and Fixed, even against `Pierce`. Beats `Invuln`. |
| `Endure` | B | D | nr | 16 | Lethal damage leaves the unit at 1 Health, if it had >1. |
| `Max HpUp` | B | D | mag | — | Max Health +X **and current Health restored by the same amount**. |
| `Block Up` | B | D | mag | 14 | Block roll +X. |

## A.3 Buffs — hit and avoid

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Dodge` | B | D | nr | Automatic successful Evade for the duration/count. **Cannot use the Evade action.** `Aim` ignores it. Fires on Evade rolls but **not** on other Agility Checks. |
| `Aim` | B | O | nr | Ignores `Dodge` and the Evade action. Beaten by `Substitution`. |
| `Pierce` | B | O | nr | Ignores `Invuln` and the Block action. **Does not ignore `Def Up` or `Dmg Cut`.** Beaten by `Anti-Purge`. |
| `Substitution` | B | D | nr | Cannot be hit by anything, including NP and Fixed, even against `Aim`. Beats `Dodge`. |
| `Insight` | B | OD | nr | 50% chance of automatically Evading any attack including NP; crit chance +25%. |
| `Accel` | B | O | nr | Opponents cannot React to this unit's attacks. |
| `AGL Up` | B | D | mag | Agility Check rolls −X (easier). |
| `AGL Dwn` | D | — | mag | Agility Check rolls +X (harder). |
| `Agility Boost` | B | D | nr | Always uses the favourable Agility table. |
| `Luck Boost` | B | — | nr | Always uses the favourable Luck table. |
| `LUC Up` | B | — | mag | Luck Check rolls −X. |
| `TEC Up` / `Focus` | B | O | mag | Enemies evading this unit's attacks roll +X. |

## A.4 Buffs — crit

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Crit Up` | B | O | mag | Crit chance +X%. Not NP unless stated. |
| `S.Crit Up` | B | O | mag | As `Crit Up`, but **application cannot be prevented** and it is **Unremovable**. |
| `G.Crit` | B | O | nr | Attacks always crit. Not NP unless stated. |
| `Area CritUp` | B | O | hi | **Aura.** Crit chance +X% for allies within range. Only while within range. |
| `Clarity` | B | O | nr | Doubles the magnitude of `Area CritUp` buffs affecting this unit. Evaluated in the aura-consumer band. |

## A.5 Buffs — regeneration and economy

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Regen` | B | — | mag | Restores Health at declared intervals. **Does not fire on the turn it ends.** |
| `NP Regen` | B | — | mag | NP cooldown −X per interval, **in addition to** the natural reduction. Does not fire on its final turn. Affects *categorized as NP* abilities. |
| `Dmged NP Regen` | B | — | mag | NP cooldown −X at the end of a Damage Step in which this unit was successfully attacked. |
| `Drain` | B | O | mag | Restores Health by X% of damage dealt on a successful attack. May carry a cap. |
| `Heal Up` | B | — | mag | Healing received +X%. Does **not** apply to Home Base or Command Spell healing unless stated. Does not change the source effect's stated magnitude. |
| `PoisHeal` | B | D | nr | Poison damage becomes healing. |
| `CursHeal` | B | D | nr | Curse damage becomes healing. |
| `FlamHeal` | B | D | nr | Burn damage becomes healing. |

## A.6 Buffs — reaction automation

All are `automatic: true` and therefore negated by `Addle`.

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Repel (X)` | B | D | mag | AU takes X Fixed damage at the end of the Combat Process, **regardless of Range**. Cannot be Blocked or Evaded. |
| `STR Reflect` | B | D | nr | Damage **and effects** from a BA(STR) attack are negated and dealt to the AU instead, regardless of Range. Includes NP. |
| `MAG Reflect` | B | D | nr | Same, for BA(MAG) attacks. |
| `Dodge Counter` | B | OD | nr | Automatically Evades a **non-AoE** attack, then performs an Instant Counter. Moves into range if needed, within MOV. |
| `Guard Counter` | B | OD | nr | Automatically Blocks, then Instant Counters. Same movement clause. |
| `Auto Counter` | B | O | nr | Automatically Instant Counters any attack. Same movement clause. |

## A.7 Buffs — protection and immunity

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Debuff ResUp` | B | D | mag | Chance of being inflicted with debuffs −X%. |
| `Debuff ChUp` | B | O | mag | Chance of inflicting debuffs +X%. Does not affect Instakill/Death/Erase unless stated. |
| `Buff ChUp` | B | — | mag | Chance of applying buffs to others +X%. |
| `Buff Up` | B | — | mag | Chance of receiving buffs +X%. |
| `Debuff Immune` | B | D | nr | Immune to debuffs. Excludes Instakill/Death/Erase unless stated. |
| `nvDebuff Immune` | B | D | nr | Immune to non-volatile debuffs. |
| `vDebuff Immune` | B | D | nr | Immune to volatile debuffs. |
| `Men.Debuff Immune` | B | D | nr | Immune to Mental debuffs. |
| `Off.Debuff Immune` | B | D | nr | Immune to Offensive debuffs. |
| `Def.Debuff Immune` | B | D | nr | Immune to Defensive debuffs. |
| `(Name) Immune` | B | D | nr | Immune to one named effect. |
| `Buff Removal ResUp` | B | D | mag | Chance of buffs being removed −X%. **Does not affect natural expiry.** Also called `Dispel ResUp`. |
| `Guts` | B | D | nr | Revive on defeat with X Health/Agility/Luck. Consumed on use. Priority: Special Guts > Guts > passive revival. Buffs and debuffs are **not** removed on revival. |

## A.8 Buffs — multi-hit

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `DblAtk Up` | B | O | mag | Normal Attacks have a chance of hitting twice. **Not** categorized as `atkUp`. |
| `TrplAtk Up` | B | O | mag | Chance of hitting three times. Rolled **before** `DblAtk Up`; if it fires, `DblAtk` does not. |

For both: the DU Evades each hit separately (a failure ends evasion for the rest); Block applies
once to the total; one Injury Roll on the total; use-limited buffs consume one charge for the
whole attack.

---

## A.9 Debuffs — non-volatile stat modifiers

| Effect | Pol | Vol | Val | Stack | Stage | Semantics |
|---|---|---|---|---|---|---|
| `Atk Dwn` | D | nv | O | mag | 4 | Damage dealt −X%. Family `atkDwn`. |
| `Def Dwn` | D | nv | D | mag | 4 | Damage taken +X%. Family `defDwn`. |
| `Def Dwn (A)` | D | nv | D | mag | 4 | As `Def Dwn`, plus **Luck −1** at the end of the Damage Step whenever **successfully Attacked** (not "damaged"). |
| `Def Dwn (B)` | D | nv | D | mag | 4 | As `Def Dwn`, with NP damage taken further increased. |
| `Def Dwn (C)` | D | nv | D | mag | 4 | As `Def Dwn`, plus **Agility −1** on the same trigger as (A). |
| `Def Crk` | D | nv | D | mag | 16 | Damage taken +X **flat**, including NP. Categorized as `defDwn`. **Its addition does not count toward the Injury Roll threshold.** |
| `Dmg Loss` | D | nv | O | mag | 7 | Damage dealt −X flat. **Not** categorized as `atkDwn`. |
| `Crit Dwn` | D | nv | O | mag | — | Crit chance −X%. |
| `Crit DmDwn` | D | nv | O | mag | 3 | Crit damage −X%. |
| `No Crit` | D | nv | O | nr | — | Cannot crit. Not NP unless stated. |
| `Crit ResDwn` | D | nv | D | mag | 3 | Crit damage taken +X%. Not NP. |
| `NP DmDwn` | D | nv | O | mag | 4 | NP damage −X%. |
| `Bal Dwn (X%)` | D | nv | D | mag | — | Attacks against this unit have crit chance +X%. Not NP. |
| `Max HpDwn` | D | nv | D | mag | — | Max Health −X. Health is **not** restored when it ends. |
| `Heal Down` | D | nv | — | mag | — | Healing received −X%. |
| `No Heal` | D | nv | — | nr | — | Health cannot be restored. |
| `MOV Down` | D | nv | — | mag | — | MOV −X. **Cannot reduce MOV below 1.** |
| `AGL Dwn` / `LUC Dwn` | D | nv | — | mag | — | Check rolls +X. |
| `Agility Loss` / `Luck Loss` | D | nv | — | nr | — | Always uses the unfavourable table. |
| `TEC Dwn` / `Distracted` | D | nv | O | mag | — | Enemies evading this unit's attacks roll −X. |

## A.10 Debuffs — non-volatile capability

| Effect | Pol | Semantics |
|---|---|---|
| `NP Seal` | D | Cannot use Noble Phantasms. Not passive NPs unless stated. Affects *categorized as NP* abilities. Does **not** delay or stop NPs that fire on a timer. |
| `Skill Seal` | D | Cannot use Skills or Spells. Not passive skills unless stated. |
| `Debuff ChDwn` | D | Chance of inflicting debuffs −X%. |
| `Debuff ResDwn` | D | Chance of being inflicted with debuffs +X%. |
| `Buff ChDwn` | D | Chance of applying buffs to others −X%. |
| `Buff Down` | D | Chance of receiving buffs −X%. |
| `No Buff` | D | Cannot receive buffs. A single effect applying multiple buffs fails **entirely**. |
| `NP Degen` | D | NP cooldown +X per interval, and natural reduction stops. |
| `NP Lock` | D | Natural NP cooldown reduction stops. **Not** NP Seal — the NP is still usable. |
| `NP Lag` | D | Natural NP cooldown reduction is halved in rate (every other turn). |
| `Decoy` | D | Enemies within `max(3, their Range)` cannot move away, may only attack/target this unit, and **must** attack it if the player attacks at all. Not stacked. **Bypasses resistance when self- or ally-applied.** Inert while the bearer is concealed. |
| `Delay+X` | D | The affected **player's** turn moves X later in the order. **Unremovable.** Applies next round if they have already acted. Never past the GM. Removed at the end of the round it fires in. |

## A.11 Debuffs — mental

All five are `nnr` (no stack, no refresh).

| Effect | Semantics |
|---|---|
| `Charm` | Control switches to the inflicter's player for X turns. Removed at the end of the Combat Phase if the unit takes damage from an attack. **Immune to Confuse and Berserk while charmed.** |
| `Berserk` | (1) Only moves toward and attacks the **nearest** enemy, only with BA(STR) Normal Attacks; a MAG-only attacker's Range drops to 1. (2) Damage dealt +50% including NP. (3) Cannot Block or Evade. (4) **Must** move and attack if able. (5) Immune to Charm and Confuse. |
| `Confuse` | Cannot be controlled. Performs random actions at the end of its player's turn. Removed at the end of the Damage Step if it takes damage. Immune to Charm and Berserk. |
| `Terror` | At the end of every turn, X% chance (default 50) of `Stun 1◈`, then Terror is removed. **The chance is not modified by debuff chance/resist effects.** |
| `Disorder` | At the start of every turn, X% chance (default 50) of `Skill Seal` for that turn. Same non-modifiable chance. |

## A.12 Debuffs — volatile, damage over time

| Effect | Stack | Semantics |
|---|---|---|
| `Curse` | st | Stage N deals **25 × N** Curse damage at the end of the turn, every ⅓◈. Reapplication adds a stage. |
| `Poison` | st | Stage N deals **20 × 2^(N−1)** Poison damage at the end of the Round. **Stage increments at Round start if still poisoned.** Reapplication adds a stage. |
| `Burn` | nnr | Lasts 2◈ default. BA(STR & MAG) −30 (Q4). 50 Burn damage at the end of every Round. |
| `Sap` / `Bleed` | nnr | −50 Health at the end of the unit's turn **and** at the end of any turn it Acts. Chance of inflicting on `Mechanical` units −50%. |
| `Nightmare` | nnr | Sleep effects, plus −10% of **current** Health at the end of its turn. |
| `Drowning` | nnr | Health cannot be restored; −50 Health per own/acted turn end; 80% chance of attacks and enemy-affecting abilities failing (no cooldown on failure); MOV −1. `Swimsuit` reduces the inflict chance by 20%. |
| `Crystallize` | nnr | MOV −3; Agility Checks +1d6; 50 Fixed damage at the end of any turn it Acts; **all damage taken −10%** including NP. |
| `Evil Curse` | nnr | Curse damage received increased. |
| `Severe Burn` | nnr | Burn damage received increased. |
| `Deadly Poison` | nnr | Poison damage received increased. |
| `Scald` | nnr | Treated as `Burn` but **ignores Burn resistance including Burn Immune**. Blocks `Burn` from being applied. 50 damage at the end of every Round. |
| `Seared` | nnr | Combines and **is treated as both** `Burn` and `Shock`. Removal chance −50%. Replaces existing Burn/Shock, **absorbing their remaining duration**. |

## A.13 Debuffs — volatile, action denial

All `nnr`. Members of the `bind` family are marked ✦.

| Effect | Semantics |
|---|---|
| `Stun` ✦ | Cannot Act. |
| `Stop` | Cannot Act. **All durations on the unit freeze**, including newly applied ones. Cooldowns freeze in both directions. `Regen` has no effect. (Implemented via `pausedTicks`.) |
| `Freeze` ✦ | Cannot Act. Attacks dealing <150 damage do nothing at all. ≥150 removes Freeze and passes the excess. **Any Fire damage** removes Freeze with no damage or effects. 100 Ice damage at Round end. |
| `Crystalfreeze` ✦ | As Freeze, but **no Fire clause**. 100 Fixed damage at Round end. |
| `Petrify` ✦ | Cannot Act. **Buffs, debuffs and other effects have no effect.** >200 damage in one attack ⇒ immediate defeat. Cured only by `[Gold Needle]` or a removal effect of equal-or-higher Rank (Rank A+ if the source was unranked). |
| `Slow` ✦ | MOV halved (round down). Evade rolls +2. |
| `Immobilize` ✦ | Cannot Move. **All** Agility Checks +4. |
| `Disable` ✦ | Can only use the Move action. |
| `Seal` ✦ | Cannot: perform BA(STR) Normal Attacks; use Skills or Attack Skills; use NP. **Spells remain usable.** |
| `Shock` ✦ | Max **and current** Agility −3. At the start of every turn, roll d6; on 3 or 4 the unit cannot act. On removal, current Agility +1 when max is restored. |
| `Webbed` ✦ | Cannot Act. `Struggle` at each turn end: 10% base (20% if STR ≥ B in Advanced), +5% per failure. Removed by damage from an attack. Reapplication resets the escape chance and **extends** the duration (`ext`). |
| `Sleep` | Cannot Act. Damage from an attack is **+100% Total Damage**, then Sleep is removed; the unit **cannot Counter** that phase. |
| `Coma` | Sleep effects. On removal, takes Fixed STR damage equal to **20% of its BA(STR)**. |

Sleep-family exclusivity: a unit with a derivative cannot receive `Sleep`; `Sleep` is *replaced*
by a derivative (using the derivative's duration); a derivative cannot be replaced by another.

## A.14 Debuffs — volatile, perception and capability

| Effect | Semantics |
|---|---|
| `Blind` | (1) 80% chance of Missing on attacks and enemy-affecting abilities. (2) Evade rolls +3. (3) `Mystic Eye` and `Glam Sight` skills cannot be used. (4) With `Clairvoyance`: 40% miss, +2 Evade. (5) Effects 1, 2 and 4 do not apply to units with `Eye of the Mind` active. |
| `Silence` | Cannot use Spells or perform BA(MAG) attacks/skills/NPs. A MAG-only attacker drops to Range 1 and BA(STR). A dual attacker keeps BA(STR) at full range. A combined attacker loses the MAG portion. |
| `Deafen(Y)` | Own Evade rolls +Y; enemies evading **this unit's** attacks roll −Y. |
| `Gashed` | Health **and Agility** cannot be restored. |
| `Addle` | (1) Cannot use Active Skills or Spells. (2) **Negates all automatically-activating skills and effects.** |
| `Dragonblight` | (1) All Elemental damage dealt reduced to 0. (2) Cannot inflict volatile debuffs. |
| `Pigify` | MOV → 2; BA(STR & MAG) → 10%; Range → 1; Evade only with Evade−, cannot Block; damage taken +50% including NP; cannot use Skills/Spells/NP; **passive Skill/NP effects negated**. |
| `Toad` | MOV → 1; BA → 5%; Range → 1; Evade rolls −3, cannot Block; damage taken +50%; cannot use Skills or NP (**Spells remain usable**); passive effects negated. |

## A.15 Debuffs — terminal

| Effect | Resistible by | Semantics |
|---|---|---|
| `Instakill` | Magic Resistance (if the source is MAG-based); skills with an explicit ladder. **Not** `Debuff Immune` unless stated. | Health reduced to 0. |
| `Death` | Same, at a further-halved magnitude. | Unit is defeated. **Ignores all revival effects.** |
| `Erase` | Almost nothing. | Removed from existence. **Does not count toward the Grail materialization counter.** |
| `Sacrifice` | **Nothing** — no Resist or Immunity applies. | Health reduced to 0. |

---

## A.16 Statuses (neither buff nor debuff)

Never removable by `Cure` or `Dispel`; never counted by "remove N buffs"; never blocked by
`No Buff` or `Debuff Immune`.

| Status | Source | Semantics |
|---|---|---|
| Active `Presence Concealment` | Class skill | Seven clauses — untargetable, unblockable/uncounterable attacks, free movement past Master protection, +100%/+50% damage, deactivation on attacking, Discover rolls, no enemy-targeting Active Skills. |
| Active `Mad Enhancement` | Class skill | Six clauses — Master drain, damage reduction, damage increase (halved for MAG), MOV/Range/ZON bonuses, Sustainability penalty, forced Evade−. |
| Riding's Active MOV Up | Class skill | MOV +X for the turn. Explicitly not a buff; unremovable; unpreventable by `No Buff`. |
| `Queen's Poison` | Semiramis's item | Volatile-debuff inflict +30% / resist −15%; BA(STR) Normal Attacks inflict Poison with a flat 50% extra-stage chance; then self-removes. |
| `Dove` | Semiramis's familiar | Permanent position-reveal mark. |
| `Fragarach` | Mannanán's NP | Replaces the normal counter with an automatic 2.5× NP-damage counter triggered by attacks **or debuffs**. |
| `Construction` | Semiramis's Double Summon | HGoB Construction +1d6 per turn end. |

---

## A.17 Keywords

| Keyword | Meaning |
|---|---|
| `Bind` | Umbrella for Stun, Disable, Immobilize, Slow, Petrify, Shock, Webbed, Seal, Freeze, Crystalfreeze. |
| `Multihit (N)` | One Attack hitting N times. Evade per hit until the first failure; Block once on the total; one Injury Roll. |
| `Discovered` | A Presence-Concealed unit found by an enemy's Detect roll. Deactivates PC. |
| `Magnitude` | The numeric strength of an effect. |
| `Expire` | Natural removal by duration. Not blocked by Unremovable or Removal Resist. |
| `Cure` / `Dispel` | Debuff / buff removal by an effect. |
| `Unremovable` | Cure and Dispel cannot remove it; it can still Expire. |
| `Knockback` | Forced movement in the attack's direction. Collision with an occupied panel stops the unit and deals END-rank-scaled STR damage. |
| `Total damage` | Damage after **all** modifiers. Effects naming it act at pipeline stage 15. |
| `Fixed damage` | Unaffected by any damage modifier **including Block**, but **affected by Invuln**. |
| `Reset Cooldown` | Set to maximum, **not** ended. |
| `Instant Counter` | Automatic counter that skips straight to Step 3 (damage). |
| `Natural NP regen` | The default 1-turn-per-turn cooldown reduction. |
| `Party` / `Party Area` | All allied units within 2 panels of the source. |
| `Break` | See A.1. |
| `Reaction` | Any action in response to an enemy action. |
| `Transfer` | Remove from one unit and apply to another, **preserving the remaining duration**. |

---

## A.18 Counts

| Category | Count |
|---|---|
| Buffs | 48 |
| Debuffs — non-volatile | 32 |
| Debuffs — mental | 5 |
| Debuffs — volatile | 30 |
| Debuffs — terminal | 4 |
| Statuses | 7 |
| **Total named effects** | **126** |
| Keywords | 18 |
| Families | 15 |

Each becomes one YAML file under `packs/_source/effects/` (Ch. 37 §37.1).

---

**Next:** [B — Rank Tables](B-rank-tables.md)
