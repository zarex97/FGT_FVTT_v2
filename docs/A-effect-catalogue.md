# Appendix A — Effect Catalogue

> **Authored so far (Ch. 45).** **157 of 154** effect definitions exist as content in
> `packs/_source/effects/`. This block previously claimed 70 while §A.20 claimed 34 and the
> directory held 126 — three tallies that disagreed with each other and with the disk, which is
> why the count is now stated once, here, and derived from `ls packs/_source/effects/`.
>
> The count exceeds the catalogue's own 154 because several rows are families whose members are
> separate documents — `Atk Up` alone has eight, and the per-Servant variants (`kiritsuguMark`,
> `raikouBuff`, `castorBuff`) are ids in the same namespace. §A.20's 154 counts **named rows**;
> this counts **files**.
>
> The most recent **thirty-one** are a group rather than a Servant's kit, and they share a defect:
> **`substitution`, `endure`, `accel`, `overCrit`, `gCrit`, `noCrit`, `ward`, `defCrk`,
> `critResUp`, `critResDwn` and `blockUp` each had a working engine reader and no document able
> to reach it.** Stage 0's halt, stage 16's Health clamp, stage 2's four-term crit sum, stage 4's
> `ward` bucket, `critChance`'s two short-circuits and `canCounter`'s Accel flag were all
> implemented, tested by their neighbours, and unreachable, because the id each one tests for by
> name belonged to no effect. Authoring the eleven documents is the whole of the fix for nine of
> them; see §A.21.
>
> An effect an ability references but which is **not** in that directory fails the content
> build — `validate-content.mjs` refuses an unknown effect id, which is how the five added
> during the Asterios and Penthesilea conversions were found. A missing definition cannot
> therefore reach a compendium and silently do nothing.
>
> `bleed` is worth a note: `scheduler.PERIODICS` has always known how to *tick* it, and there
> was no definition able to *inflict* it until D1.

Every named effect in F/GT, with its classification (Ch. 10), its mechanism, its stacking rule,
and its implementation note. This is the authoritative reference the compendium is built from.

**Column key:**
- **Pol** — polarity: `B` buff, `D` debuff, `S` status (neither).
- **Vol** — volatility: `nv` non-volatile, `v` volatile, `M` mental, `T` terminal, `—` n/a.
- **Val** — valence: `O` offensive, `D` defensive, `OD` both, `—` neither.
- **Stack** — `mag` magnitudeStacks, `nnr` noneNoRefresh, `nr` noneRefresh, `st` stage,
  `cnt` count, `hi` highestOnly, `ext` noneExtend.
- **Stage** — damage pipeline stage (Ch. 13 §13.2) where it acts, if applicable.
  Crit-damage effects act at **stage 2**, on the `5d10` roll only — not on the attack.

---

## A.1 Buffs — damage output

| Effect | Pol | Val | Stack | Stage | Semantics |
|---|---|---|---|---|---|
| `Atk Up` | B | O | mag | 4 | Damage dealt +X%. Reduced magnitude for NP. Family: `atkUp`. Named variants (`N.Atk Up`, `Atk Up (STR)`, `Atk Up (Charisma)`, `Atk Up (Magus)`, `Atk Up (GreekMale)`) all count as `atkUp`. |
| `Dmg Up` | B | O | mag | 4 | Damage dealt to units matching a category +X%, **including NP** (no reduced magnitude). Carries a predicate. |
| `Dmg Boost` | B | O | mag | 7 | Damage dealt +X **flat**. Affects NP only if stated. |
| `NP DmUp` | B | O | mag | 4 | NP damage +X%. Also affects abilities *categorized as NP*. Not passive NPs. |
| `Overcharge` | B | O | mag | — | Magnitude of all **non-damage** NP effects increased. Explicitly excludes direct damage. |
| `Crit DmUp` | B | O | mag | 2 | Crit damage +X%. Not NP unless stated. |
| `Over Crit` | B | O | nr | 2 | While crit chance > 100%, crit damage +（chance − 100)%. **Built** (`overCrit`), `rules: []` — `overCritBonus` has computed `max(0, chanceUsed − 100)` off the attacker's held effects since stage 2 was written. |
| `Ignore Def` | B | O | nr | 4 | Attacks ignore `Def Up` on the DU. **Does not ignore `Dmg Cut`.** **Built** (`ignoreDef`, Drake) as `AttackProperty: ignoresDefUp` **alone**. Kiritsugu's `penetration` is the two-clause version — Ignore Def *and* a halved Invuln — and Achilles's `ignoresDefensiveBuffs` is wider still, so the set has three strengths of "gets past defences" and this is the mildest. |
| `Break` | B | O | nr | 14 | Chance to ignore Block; extra damage if the attack was Blocked. Default chance 100% if unstated. |
| `Uncharted` | B | — | nr | — | **Built** (`uncharted`, Drake). Detect +3 panels. Detect is **read-time**, not stored: `rules/identity.mjs#detectRangeOf` derives it from a class table whose Caster entry depends on where the unit is standing, so a Servant's stored `detect` is null. A delta written there starts from **zero** — throwing the class base away — and, because that null makes `restoreModifiable` skip the field, is never reset: Drake's read 6, 9, 12, 15, 18 across five preparations. So nothing writes it; `applyStatDeltas` skips `detect` and `detectRangeOf` sums the deltas onto the base it already resolves. |

### The `Gogh` buff

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Gogh` | B | O | nr | **Built**, and it belongs to one Servant. Whenever its bearer lands an Attack it removes one stage of `Curse` **from the bearer** and grants `Atk Up` (+10%, 5% NP) once per stage actually removed; a Crit removes two and grants two. `noneRefresh` — *"does not stack, but reset its duration"*. The conditional *"if a stage of Curse was removed"* is answered by arithmetic: `RemoveEffect` with `stages` reports what it **took**, so at Stage 0 it takes nothing and grants nothing, and at Stage 1 a Crit asks for two, gets one and grants one. Its two `damageDealt` handlers must **partition** on the Crit (`{not: "attack:crit"}` on the ordinary one), or both fire and a Crit pays three times. `cause: gogh` on the removal is what lets *Channel Marker Soul* pay for it (App. E, `curseStageChanged`) while a Cure pays nothing. |

## A.2 Buffs — damage intake

| Effect | Pol | Val | Stack | Stage | Semantics |
|---|---|---|---|---|---|
| `Def Up` | B | D | mag | 4 | Damage taken −X%. Reduced magnitude vs NP. Family: `defUp`. Sums additively with attacker `Atk Up` (Ch. 13 §13.4). |
| `Ward` | B | D | mag | 4 | Damage from a matching category −X%, **including NP**. Predicated. **Built** (`ward`). *"Including NP"* is asserted by **omitting** `npValue`, which makes stage 4 fall back to `value`; writing `npValue: "@magnitude"` reads as the same assertion and is not one (§A.21). |
| `Dmg Cut` | B | D | mag | 12 | Damage taken −X **flat**, including NP. Not bypassed by `Pierce`. **Built** (`dmgCut`), and the first effect to carry `uses` on a `DamageNegation`: Guidance of the Netherworld applies it "3 times", and a charge is spent only when the negation stage had damage to reduce. `mode: flat` was the executor's default and the attack flow skipped it outright — every negation in the corpus was dice-mode — so a flat cut authored cleanly and reduced nothing until this was built. |
| `Crit ResUp` | B | D | mag | 2 | Crit damage taken −X%. Not NP. **Built** (`critResUp`) — stage 2 has summed it off the defender since it was written. |
| `Crit Guard` | B | D | mag | — | AU's crit chance −X% when attacking this unit. Not NP unless stated. |
| `Shield (X)` | B | D | nr | 16 | Separate pool absorbing damage; excess passes through. **A Master with Shield cannot be Overpowered.** |
| `Invuln` | B | D | nr | 16 | No damage. Vs NP: 50% reduction instead. "Reduce Health to 0" becomes "halve current Health". Cannot Block. `Pierce` ignores it. Does **not** prevent rider debuffs. Masters with it cannot be Overpowered. |
| `Anti-Purge` | B | D | nr | 0 | No damage from anything, including NP and Fixed, even against `Pierce`. Beats `Invuln`. |
| `Endure` | B | D | nr | 16 | Lethal damage leaves the unit at 1 Health, if it had >1. **Built** (`endure`), `rules: []`. Stage 16 carried the arithmetic **twice** — Gogh's *"cannot be defeated due to Curse"* is the same subtraction with a source, written directly beneath an `endure` test nothing could satisfy. The `health > 1` guard is the pipeline's: a Unit already at 1 is not saved, because Endure prevents the drop **to** zero rather than the defeat. |
| `Max HpUp` | B | D | mag | — | Max Health +X **and current Health restored by the same amount**. |
| `Block Up` | B | D | mag | 14 | Block roll +X. **Built** (`blockUp`). `BlockModifier` exists solely to produce this key, stage 14 sums it and `explain.mjs` names it in the breakdown — an element, a reader and a log entry for an effect with no document. Percentage **points** onto the flat 25%. |

## A.3 Buffs — hit and avoid

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Dodge` | B | D | nr | Automatic successful Evade for the duration/count. **Cannot use the Evade action.** `Aim` ignores it. Fires on Evade rolls but **not** on other Agility Checks. |
| `Aim` | B | O | nr | Ignores `Dodge` and the Evade action. Beaten by `Substitution`. |
| `Pierce` | B | O | nr | Ignores `Invuln` and the Block action. **Does not ignore `Def Up` or `Dmg Cut`.** Beaten by `Anti-Purge`. |
| `Substitution` | B | D | nr | Cannot be hit by anything, including NP and Fixed, even against `Aim`. Beats `Dodge`. **Built** (`substitution`), `rules: []` — stage 0 halts on it before the attack is measured, which is what makes the clause absolute. `aim.yml` withheld a `blockedBy` for it; that note is now corrected rather than fulfilled, because `blockedBy` gates *application* and these two ride opposite Units. |
| `Insight` | B | OD | nr | 50% chance of automatically Evading any attack including NP; crit chance +25%. |
| `Accel` | B | O | nr | Opponents cannot React to this unit's attacks. **Built** (`accel`), `rules: []` — and it needed engine work, because only the **Counter** rung was closed. See §A.21. |
| `AGL Up` | B | D | mag | Agility Check rolls −X (easier). |
| `AGL Dwn` | D | — | mag | Agility Check rolls +X (harder). |
| `Agility Boost` | B | D | nr | Always uses the favourable Agility table. |
| `Luck Boost` | B | — | nr | Always uses the favourable Luck table (`1d20` rather than `1d20+4`), regardless of whose Luck is higher. Worth a flat 4 on every Luck Check. |
| `LUC Up` | B | — | mag | Luck Check rolls −X. |
| `TEC Up` / `Focus` | B | O | mag | Enemies evading this unit's attacks roll +X. |

## A.4 Buffs — crit

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Crit Up` | B | O | mag | Crit chance +X%. Not NP unless stated. |
| `S.Crit Up` | B | O | mag | As `Crit Up`, but **application cannot be prevented** and it is **Unremovable**. |
| `G.Crit` | B | O | nr | Attacks always crit. Not NP unless stated. **Built** (`gCrit`), `rules: []` — `critChance` returns `{percent: 100, automatic: true}` on the line below `noCrit`'s. A short-circuit, not a +100% modifier, which is what makes "always" absolute. |
| `Area CritUp` | B | O | mag | **Aura.** Crit chance +X% for allies within range. Only while within range. **Built** (`areaCritUp`) for Van Gogh's *De Sterrennacht*, radius 2, `relations: [ally, self]` — the bearer benefits, because "all allied Units" includes itself unless the text says otherwise. Written in the aura's **nested** form (`elements:`), which is what made its `@magnitude` the first in the corpus to need resolving at that depth; before that it reached every correct recipient carrying the literal string. Resolution at evaluation time is what makes "only while within range" true without a position-watcher. |
| `Clarity` | B | O | nr | Doubles the magnitude of `Area CritUp` buffs affecting this unit. Evaluated in the aura-consumer band. |

## A.5 Buffs — regeneration and economy

| Effect | Pol | Val | Stack | Semantics |
|---|---|---|---|---|
| `Regen` | B | — | mag | Restores Health at declared intervals. **Does not fire on the turn it ends.** **Built** (`regen`): an `OnEvent` on `turnEnd`/`actedTurnEnd`/`roundEnd` healing `percentOfMax`. The final-turn exclusion holds — an effect-borne handler now carries its instance's expiry and `fireEvent` skips it on the tick it runs out (Ch. 11 §11.9), which had been true of `periodic:` effects and of nothing else. Regen is also the corpus's **first multi-event handler**, which is how a second defect surfaced: the field is `event`, holding an array. Authored as `events:` it compiled, loaded, and subscribed to `undefined` — the validator now refuses an `OnEvent` that names no event. |
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
| `Death ChUp` | B | O | mag | Chance of inflicting **Instakill and Death** +X%. The counterpart the exclusion above requires: one modifier cannot do both jobs, and Serenity states both at every size — 10% each from Silent Dance, 40% each from Danse Macabre. |
| `Buff ChUp` | B | S | mag | Chance of applying buffs to others +X%. **The only entry in this table whose contribution is about buffs**, which the document has to say outright: an `ApplicationChance` that names no polarity means debuffs (§11.3). Ozymandias's *Protection from Ra* is the first content to apply it. |
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
| `Def Dwn (MAG)` | D | nv | D | mag | 4 | As `Def Dwn`, but **only against MAG-component damage**. A distinct effect rather than a stronger one: the parenthesis names what is scoped, and content that strips "one Def Dwn" must be able to take this without taking an unscoped one instead. **Built 2026-09-16** (`packs/_source/effects/def-dwn-mag.yml`) for `Enigma`, which is the only thing that inflicts it. |
| `Def Crk` | D | nv | D | mag | 16 | Damage taken +X **flat**, including NP. Categorized as `defDwn`. **Its addition does not count toward the Injury Roll threshold.** **Built** (`defCrk`). The subtle half was already enforced — stage 16 takes the injury snapshot *before* the addition, quoting this row — so only the effect that triggers it was missing. Needs an explicit `modifierKey`, because the default for a flat *taken* modifier is `flatReduction`, which subtracts. |
| `Dmg Loss` | D | nv | O | mag | 7 | Damage dealt −X flat. **Not** categorized as `atkDwn`. |
| `Crit Dwn` | D | nv | O | mag | — | Crit chance −X%. |
| `Crit DmDwn` | D | nv | O | mag | 2 | Crit damage −X%. |
| `No Crit` | D | nv | O | nr | — | Cannot crit. Not NP unless stated. **Built** (`noCrit`), `rules: []` — `critChance` short-circuits on the id **before** summing any modifier, so no `Crit Up` can outbid it. A `CritModifier` of −100 could be. |
| `Crit ResDwn` | D | nv | D | mag | 2 | Crit damage taken +X%. Not NP. **Built** (`critResDwn`), the debuff half of the pair stage 2 already sums. |
| `NP DmDwn` | D | nv | O | mag | 4 | NP damage −X%. |
| `Bal Dwn (X%)` | D | nv | D | mag | — | Attacks against this unit have crit chance +X%. Not NP. |
| `Max HpDwn` | D | nv | D | mag | — | Max Health −X. Health is **not** restored when it ends. |
| `Heal Down` | D | nv | — | mag | — | Healing received −X%. |
| `No Heal` | D | nv | — | nr | — | Health cannot be restored. |
| `MOV Down` | D | nv | — | mag | — | MOV −X. **Cannot reduce MOV below 1.** |
| `AGL Dwn` / `LUC Dwn` | D | nv | — | mag | — | Check rolls +X. |
| `Agility Loss` / `Luck Loss` | D | nv | — | nr | — | Always uses the unfavourable table (`1d20+4`), regardless of whose stat is higher. |
| `TEC Dwn` / `Distracted` | D | nv | O | mag | — | Enemies evading this unit's attacks roll −X. |

## A.10 Debuffs — non-volatile capability

| Effect | Pol | Semantics |
|---|---|---|
| `NP Seal` | D | Cannot use Noble Phantasms. Not passive NPs unless stated. Affects *categorized as NP* abilities. Does **not** delay or stop NPs that fire on a timer. |
| `Skill Seal` | D | Cannot use Skills or Spells. Not passive skills unless stated. **Authored** for Serenity's Zabaniya; carries no rule element, because what refuses a Skill is `rules/budget.mjs`'s prevention table, which has listed `skillSeal` since it was written with no document to name. |
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
| `Charm` | Control switches to the inflicter's player for X turns. Removed at the end of the Combat Phase if the unit takes damage from an attack. **Immune to Confuse and Berserk while charmed.** **Built** (`charm`), `volatility: mental` — this appendix's own classification, so Heracles' Bravery and Jack's Mental Pollution already resist it without either sheet naming it. All three clauses hold. **Control transfer** is wired for the first time (Ch. 25 §25.7: `rules/control.mjs` had no consumer, and two defects underneath it). **Removal** is an `OnEvent combatPhaseEnd` with `requiresDamagedThisPhase` — the Phase, not the Process, so a Charm broken by the opening attack is not broken again by the counter it provoked, and an Evade or a fully-absorbed Block leaves it standing. **Immunity** to Berserk and Confuse is declared; neither of those two is authored yet (Ch. 18 §18.5 lists Confuse's random selector as open), so it is inert today and correct the moment either exists. |
| `Berserk` | (1) Only moves toward and attacks the **nearest** enemy, only with BA(STR) Normal Attacks; a MAG-only attacker's Range drops to 1. (2) Damage dealt +50% including NP. (3) Cannot Block or Evade. (4) **Must** move and attack if able. (5) Immune to Charm and Confuse. |
| `Confuse` | Cannot be controlled. Performs random actions at the end of its player's turn. Removed at the end of the Damage Step if it takes damage. Immune to Charm and Berserk. |
| `Terror` | At the end of every turn, X% chance (default 50) of `Stun 1◈`, then Terror is removed. **The chance is not modified by debuff chance/resist effects.** **Built** (`terror`) for Van Gogh's *De Sterrennacht*, which states its own 60. The chance rides `@magnitude` on a flat action roll and nothing shifts it — including her own Item Construction, which is exactly what the non-modifiable clause is protecting against. Both halves are one handler: the Stun attempt and the self-removal fire on the same `turnEnd`, so Terror cannot outlive the roll it exists to make. |
| `Disorder` | At the start of every turn, X% chance (default 50) of `Skill Seal` for that turn. Same non-modifiable chance. |

## A.12 Debuffs — volatile, damage over time

| Effect | Stack | Semantics |
|---|---|---|
| `Curse` | st | Stage N deals **25 × N** Curse damage at the end of the turn, every ⅓◈. Reapplication adds a stage. |
| `Poison` | st | Stage N deals **20 × 2^(N−1)** Poison damage at the end of the Round. **Stage increments at Round start if still poisoned.** Reapplication adds a stage. |
| `Burn` | nnr | Lasts 2◈ default. BA(STR & MAG) −30 (Q4). 50 Burn damage at the end of every Round. |
| `Sap` / `Bleed` | nnr | −50 Health at the end of the unit's turn **and** at the end of any turn it Acts. Chance of inflicting on `Mechanical` units −50%. Two names, one rule, and now two documents — `sap` had a periodic entry in `engine/scheduler.mjs` from the day the scheduler was written and **no effect document at all**, so anything inflicting it inflicted nothing. Quetzalcoatl's *Ehecatle* is what noticed. The `Mechanical` clause is unmodelled on **both**, for want of a per-attribute application-chance vocabulary. |
| `Nightmare` | nnr | Sleep effects, plus −10% of **current** Health at the end of its turn. |
| `Drowning` | nnr | Health cannot be restored; −50 Health per own/acted turn end; 80% chance of attacks and enemy-affecting abilities failing (no cooldown on failure); MOV −1. `Swimsuit` reduces the inflict chance by 20%. |
| `Crystallize` | nnr | MOV −3; Agility Checks +1d6; 50 Fixed damage at the end of any turn it Acts; **all damage taken −10%** including NP. |
| `Evil Curse` | nnr | Curse damage received increased. |
| `Severe Burn` | nnr | Burn damage received increased. |
| `Deadly Poison` | nnr | Poison damage received increased — **doubled**, per every sheet that inflicts it. Carries no rule element: its subject is another effect's periodic tick, which is authored `bypassModifiers` precisely so the damage pipeline cannot touch it, so the multiplier lives beside the tick in `scheduler.AMPLIFIERS`. |
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
| `Disable` ✦ | Can only use the Move action. **Built 2026-09-16** (`packs/_source/effects/disable.yml`) for *Plains of Winter*. `rules/budget.mjs`'s own table had listed only attack/skill/np, so a Disabled Unit could still cast a Spell, make a Riding Attack, Gather and Mark; it is now the complement of Move over the whole action vocabulary, which is what this row says. |
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
| `Deafen(Y)` | Own Evade rolls +Y; enemies evading **this unit's** attacks roll −Y. **See the note below — the one Servant who inflicts it states something else.** |
| `Gashed` | Health **and Agility** cannot be restored. |
| `Addle` | (1) Cannot use Active Skills or Spells. (2) **Negates all automatically-activating skills and effects.** |
| `Dragonblight` | (1) All Elemental damage dealt reduced to 0. (2) Cannot inflict volatile debuffs. |
| `Pigify` | MOV → 2; BA(STR & MAG) → 10%; Range → 1; Evade only with Evade−, cannot Block; damage taken +50% including NP; cannot use Skills/Spells/NP; **passive Skill/NP effects negated**. |
| `Toad` | MOV → 1; BA → 5%; Range → 1; Evade rolls −3, cannot Block; damage taken +50%; cannot use Skills or NP (**Spells remain usable**); passive effects negated. |

> **`Soaked` — built 2026-09-16, and not one of its three clauses needed a new
> mechanism.**
>
> Anastasia's *Ice Bucket Challenge* applies it. The clauses read as though they
> need bespoke machinery and do not:
>
> - *"a 25% chance of being inflicted with Freeze, **this is additive** to any
>   Freeze chance the Attack might have"* is a **negative** incoming
>   `ApplicationChance`. `rules/checks.mjs#applicationChance` computes
>   `base + inflictBonus − resist`, so −25 raises the chance by 25 and lands on
>   whatever the attack already carried. `chanceContribution` already scoped by
>   `effectId` and by an attack-time predicate.
> - *"Total Fire Damage taken is reduced by 50%, then 'Soaked' is removed"* is an
>   element-scoped `Ward` plus an `OnEvent damageTaken`. And because
>   `damageTaken` fires once the Damage Step has resolved **including at a total
>   of zero**, it fires even when stage 0 halted on *"Freeze broken by Fire"* — so
>   a Unit that is both Soaked and Frozen loses **both** to one Fire attack
>   without taking a point. That was expected to need a carve-out in stage 0 and
>   needed nothing.
> - *"At the end of a Day Round"* is `roundEnd` predicated on `self:phase:day`,
>   which is emitted **per panel**: a Unit standing in `sunlight` terrain dries
>   off at night.

> **`Freeze` and `Invuln` — built 2026-09-16, and the pipeline had been carrying
> both of them unexercised.**
>
> Two of the most load-bearing statuses in this appendix, catalogued since it
> was written, and until now **no Unit could receive either**. Everything about
> how they meet damage was already in `rules/damage/pipeline.mjs`: stage 0 halts
> on *"Freeze broken by Fire"*; stage 16 holds Freeze's `<150` absorption and
> its excess pass-through, Invuln's negation and its `Pierce` bypass; stage 15
> already halves Invuln against a Noble Phantasm. `rules/budget.mjs#preventedBy`
> has carried `freeze` in its blanket list just as long.
>
> Neither document restates any of that — a second implementation is a second
> thing to drift. They carry only what had no reader: Freeze's Round-end 100 Ice
> and Invuln's *"cannot Block"*.
>
> They arrived with Anastasia, whose *Ice Bucket Challenge* sets up the first and
> whose *Freezing Summertime* applies the second. **They are not hers.** Both are
> now live for the whole roster.

> **`Blind` — built 2026-09-16, and clause 1 needed a new Combat Process step.**
>
> *"80% chance of Missing"* had nowhere to live. An Evade is the **defender's**
> roll answering a swing that happened, resolved at step 2 with a Luck ladder
> hanging off it; a Miss is the swing **not happening at all**. No pipeline
> stage and no check bucket could hold that, which is why this row sat here
> catalogued and unauthored for as long as it did.
>
> **Step 1.5** is where it went (`docs/12-combat-process.md` §12.2), and
> `module/rules/miss.mjs` is the chance ladder — 80%, 40% with `Clairvoyance`,
> exempt with `Eye of the Mind` — **ordered, not summed**: clause 5 exempts 1, 2
> and 4 together, so a Unit carrying both Skills is simply exempt rather than
> 20%. A miss ends the Process: no reaction, no damage, no Injury Roll, no
> Counter. The attack budget is still spent, because the swing was declared.
>
> Clauses 2 and 3 are on the effect (`packs/_source/effects/blind.yml`). Clause
> 3 is keyed on an ability's `categorizedAs: [mysticEye]` tag rather than on
> named slugs, because it names a family of Skills.
>
> **`Def Dwn (A)` — built 2026-09-16** (`packs/_source/effects/def-dwn-a.yml`),
> the mirror of `Def Dwn (C)`, for the Dioscuri's Noble Phantasm, which inflicts
> both.

> **`Enigma` — built 2026-09-16, and this row was wrong about whose attack it
> reads.**
>
> It said *"when the bearer's **ally** performs a STR-component Normal Attack"*.
> Nursery Rhyme's sheet says: *"Applies the 'Enigma' buff to Nursery… Whenever
> **Alice** performs a Normal Attack which deals STR damage, **Nursery** inflicts
> the Def Dwn (MAG) debuff for 1◈ Turns on the DU."*
>
> Alice **is** Nursery. Her True Name is "Nursery Rhyme, Alice"; the sheet labels
> her Skills `(Alice)` and her last Noble Phantasm `(Nursery)`, and the two names
> alternate throughout. Reading the second name as a second person is what turned
> a self-buff into an ally-buff in this table.
>
> The self reading is also the only one that makes her coherent. Her Note pins
> her Normal Attacks to BA(STR) **50** while her Noble Phantasm swings BA(MAG)
> **200**, and `Enigma` is what makes the feeble swing worth taking — the
> `Def Dwn (MAG)` it plants raises MAG damage taken by 60%. Aimed at an ally it
> would buff somebody else's kit and do nothing for hers.

> **`Deafen` — built 2026-09-11, and the catalogue and the sheet disagree.**
>
> Nemo's *Triton's Conch* is the only source of `Deafen` in either roster, and it defines the
> debuff inline as *"all Evade rolls are increased by 2, MOV is reduced by 1, and Detect is
> reduced by 1 panel."* That is **not** the row above: it drops the "enemies evading this unit's
> attacks roll −Y" clause and adds two the row does not have.
>
> **The engine had already sided with the sheet.** `rules/identity.mjs#detectRangeOf` has
> subtracted exactly one panel for an effect literally called `deafen` since it was written —
> "Class container first, then an explicit sheet value, then Deafen" — and the catalogue row has
> no Detect clause at all for that to have come from. The hard-wiring anticipated this Servant.
>
> So `packs/_source/effects/deafen.yml` is authored **as the sheet states it**, with a fixed
> magnitude rather than the row's `(Y)`. The row stays as written because nothing has been
> checked against its second clause and silently rewriting a catalogue entry to match the first
> content that arrives is how a reference stops being one. If a Servant is ever written who
> inflicts the parameterized form, the two are different effects and want different ids — the
> same call `Indomitable`/`Indomited` makes.
>
> Note also that the Detect clause carries **no rule element**: the −1 arrives by name from
> `detectRangeOf`, and a `DetectOverride` beside it would both double-count and be the wrong
> element, since that one pushes a `{scope: "detect", maximum}` **cap** (Jack's Mist reducing
> Detect *"to 1 panel"*) rather than a delta.

> **`Indomited` — built 2026-09-11.** Nemo's, and a near-twin of Heracles's `Indomitable` that is
> deliberately a **separate effect**: his pays out for a revival *"through any effect"* and grants
> `Atk Up`; Nemo's pays out only for one *"due to Guts"* and reduces his Noble Phantasm's Cooldown.
> Same shape, different rule, and collapsing them would make one of the two sheets wrong.
>
> Building it found that `revival:source:<id>` — emitted by `resolveDefeat` since revival
> priorities were built — was **not in the facet vocabulary**, so no predicate could have named it
> without failing the build. Heracles's is `automatic: true` with no predicate, which is why
> nothing had ever tried.

## A.15 Debuffs — terminal

| Effect | Resistible by | Semantics |
|---|---|---|
| `Instakill` | Magic Resistance (if the source is MAG-based); skills with an explicit ladder. **Not** `Debuff Immune` unless stated. | Health reduced to 0. |
| `Death` | Same, at a further-halved magnitude. | Unit is defeated. **Ignores all revival effects.** |
| `Erase` | Almost nothing. | Removed from existence. **Does not count toward the Grail materialization counter.** |
| `Sacrifice` | **Nothing** — no Resist or Immunity applies. | Health reduced to 0. |

**Implementation.** A terminal effect is a **consequence, not a condition**: nothing is left
behind for the Unit to carry, so the definition declares an action (`terminal: {kind}`) rather
than rule elements, and the applier returns before any document is constructed (Ch. 11 §11.5).

`Instakill` and `Death` differ in more than degree, and the difference is why they are separate
effects rather than one with a magnitude. Instakill empties the pool and lets the ordinary defeat
chain run, so `Guts` and God Hand still answer; Death defeats outright, because damage would be
caught by `Endure`. Neither is damage, so neither feeds a damage-keyed trigger (Ch. 06).

Magic Resistance's coverage of the tier is authored as a **severity list** with an
`attackPredicate`, for *"also affects Instakill and Death **unless** the … source deals STR damage
or is not affected by Magic Resistance. Erase is completely unaffected."* Erase is absent from the
list rather than present at a reduced magnitude — that is what "completely unaffected" means.
Scáthach's own *Gáe Bolg Alternative* is exactly the exemption: it uses Base Attack (STR), so her
A-rank Magic Resistance would not save a target from her own spear.

Authored so far: `Instakill`, `Death`. `Erase` and `Sacrifice` have no content yet.

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

## A.17 Effects added in `0.2.0`

The expanded roster (Ch. 44) and the terrain system (Ch. 42) introduced the following. They are
listed separately from A.1–A.16 so that the original catalogue stays traceable to its sources,
but they are ordinary catalogue entries in every other respect and are counted in §A.20.

### A.17.1 New buffs

| Effect | Pol | Val | Stack | Stage | Semantics | Source |
|---|---|---|---|---|---|---|
| `Off.Debuff ResUp` | B | D | mag | — | Chance of being inflicted by **Offensive** debuffs −X%. Completes the valence-scoped family alongside `Off.Debuff Immune`. | Asterios |
| `Def.Debuff ResUp` | B | D | mag | — | Same, for Defensive debuffs. Added for symmetry; no content uses it yet. | — |
| `Men.Debuff ResUp` | B | D | mag | — | Same, for Mental debuffs. | Jack, Achilles |
| `Bleed Atk` | B | O | cnt | — | Normal Attacks have an X% chance of inflicting `Bleed`. An **on-attack rider** rather than a modifier. Was inert **twice over** until Serenity: nothing raised `damageDealt`, and the `effect:` shorthand it is written in desugared to no action at all. It also needed `target: victim` added — without it the shorthand inflicted Bleed on the *attacker*. | Asterios |
| `Macabre` | B | O | nr | — | Normal Attack **crits** inflict an additional **stage** of `Poison`. The first effect whose subject is another effect's stage counter — and cheap once staging exists, because "an additional stage" is one more application of the same Poison. Needed two things that did not exist: the `damageDealt` event, and `attack:crit` as a roll option. | Serenity |
| `Raikou` (id `raikouBuff`) | B | O | cnt | — | Count-limited (**3 uses, no duration** — R1): Normal Attacks deal **+40 Lightning**, roll 40% `Shock` for ⅔◈, and reduce **both** NP cooldowns by ⅓◈. One handler pays out both halves and spends the charge, so an attack that rolls badly for `Shock` still costs a use and still moves the clocks. The +40 is the first flat bonus in the corpus made of a damage type the attack itself is not, and stage 7 routes it through that element's own share (Ch. 13). The id is `raikouBuff` because content ids are one namespace and `raikou` names the Servant. | Raikou |
| `Atk Up (MS)` | B | O | mag | — | All damage dealt to `[Earth]` / `[Sky]` Units +X% including NP. Carries Mystery Slayer's Demi-/Pseudo-Servant exclusion with its one named exception (Sitonai, by content id). | Raikou |
| `Atk Up (Demonic)` | B | O | mag | — | All damage dealt to `Demonic` Units +X% including NP. Carries the **same** exclusion, though the sheet's note names only `Atk Up (MS)` — R2 reads the note as naming the skill, and a Demi-Servant who is also Demonic would otherwise be a hole in it. | Raikou |
| `Enigma` | B | O | nr | — | When **the bearer itself** performs a **STR-component** Normal Attack, the DU gains `Def Dwn (MAG)` at +60% / NP +40%. Gated on which base attack the attack used. **Built 2026-09-16** (`packs/_source/effects/enigma.yml`); this row said *"the bearer's ally"* until then — see the note below. | Nursery Rhyme |
| `Espionage` | B | — | nr | — | Raises the bearer's own `Presence Concealment` rank. A `RankShift` delivered as a buff. | Yan Qing |
| `Sol` | B | — | nr | — | The 5×5 around the bearer counts as **Day** regardless of the Round's phase (Ch. 42 §42.6). **Built**, and the document carries `rules: []` — which is the finished state, not an unfinished one. Terrain is not an effect (§42.1), so every mechanical consequence of `Sol` is `phaseAt` reading the ground its ability painted; the buff is the marker whose expiry erases that ground. The first content to set `followsSource`. | Quetzalcoatl |
| `Charity`-style named `Atk Up` variants | B | O | mag | 4 | `Atk Up (Trace)`, `Atk Up (MS)`, `Atk Up (Demonic)`, `Atk Up (Charisma)` — all `atkUp` family members with predicates. | several |
| `Crit Up (Viy)` | B | O | mag | — | Crit chance +X% **scoped to attacks that use BA(MAG)**, with a separate NP magnitude. The first component-scoped crit buff. | Anastasia |
| `Crit Up (Hawkeye)` / `Crit DmUp (Hawkeye)` | B | O | mag | — / 2 | Crit chance / crit damage +X% **at Range 3 or higher**. Range-predicated. | EMIYA |
| `Crit Up (Martial)` | B | O | mag | — | Crit Chance +X%, **unconditionally** — unlike the Hawkeye pair it carries no predicate, because the sheet names no condition. Magnitude is inverted against Mad Enhancement: 30% with it, 60% without. | Raikou |
| `Crit DmUp (Martial)` | B | O | cnt | 2 | Crit Damage +X%, **three uses or 1◈ Turns, whichever ends first** (R1). The first count-limited modifier in the corpus that fires inside the damage pipeline rather than on an event rung, so its charge is spent by a paired `damageDealt` handler predicated on `attack:crit` — the one moment that option is in the set. A `CritModifier` without that twin is an infinite buff. | Raikou |
| `Dmg Up (Gods)` | B | O | mag | 4 | Damage dealt to Units with the `Undead` or `Divine` Attribute +X%, **including NP** — `dmgUp`, not `atkUp`, precisely because it takes no reduced NP magnitude. | Scáthach |
| `Alpi` | B | O | cnt | — | Count-limited (3): at the **end of the Damage Step** of a successful Attack, NP cooldown −½◈ — or −1◈ if the DU is `Undead` or `Divine`. The first content to use §E's `damageStepEnd`, and the first handler with a `targetPredicate`. | Scáthach |

### A.17.2 New statuses

Statuses are neither buffs nor debuffs: never removable by `Cure` or `Dispel`, never counted by
"remove N buffs", never blocked by `No Buff` or `Debuff Immune`.

| Status | Source | Semantics |
|---|---|---|
| `Soaked` | Anastasia | (1) Ice damage carries an **additive** +25% `Freeze` chance. (2) Fire damage taken −50% Total, then `Soaked` is consumed. (3) Removed from every affected unit at the end of a **Day Round**. Explicitly neither buff nor debuff and Unremovable. |
| `Secret Poison` | Serenity | `Poison`, applied and ticking normally, whose **cause** is hidden from the victim's controller until Presence Concealment deactivates. Damage lands immediately; only the attribution is deferred (Ch. 44 §44.4, **Q47**). |
| `Nameless Forest Token` | Nursery Rhyme | A **counter**, not a duration. Each token: Max Health −50, both Base Attacks −20, Max Luck −1. Lost Health and Luck are **not** restored on removal. At ≥3 tokens the bearer rolls `1d12` at its own turn end and is **defeated** on a roll ≤ the token count, unless inside its Home Base. |
| `GotN` | Pale Rider | Stores an **unapplied effect bundle**. Discharges — applying `Atk Up`, `Regen` and `Dmg Cut` — when the bearer enters `Doomsday Come`, then removes itself. |
| `AC` (Activated Circuits) | EMIYA | NP-cooldown economy. Mutually exclusive with `BC`. **Cascading removal**: dies when `Atk Up (Trace)` is removed. |
| `BC` (Blazing Circuits) | EMIYA | Damage economy. Mutually exclusive with `AC`. Same cascading removal. |
| `heelWounded` | Achilles | **Permanent and incurable.** Suppresses `Andreias Amarantos` outright and re-parameterizes `Dromeus Komētēs` and `Runner Comet` (MOV −1, Evade +1, buff magnitudes → 10%). The only effect in the corpus that rewrites its bearer's other abilities and cannot be undone. |
| `Utnapishtim` mark | Proto Gil | A **panel** marker, not a unit effect. Anchors `Enki`'s detonation 7◈ later; survives the caster leaving, but not the caster dying. |
| `Bloodmark` | Medusa | A panel marker placed as a turn action. Four of them at the corners of a 5×5/7×7/9×9 complete `Blood Fort Andromeda`. Visible only within 3 panels; destroyable **only by Masters**. |
| `Disguise` | Yan Qing | A per-viewer **presentation override** — name, image and disposition colour only. No state change (Ch. 44 §44.4). |
| `Fake Defeat` | Katō Danzō | The GM-mediated shadow state (Ch. 44 §44.1). Carries `requiresGmComfort: true` and a per-world disable. |
| Active `Independent Action` (A+/EX) | class skill | Absolute: Sustainability does not apply **and** the bearer cannot be contracted by enemy Masters or Casters at all — not "requires N rolls". Not overridden by Rule Breaker (**Q48**). |
| `Levitating` | Proto Gil | An **attribute**, granted by an ability and **negated by `NP Seal`**. Move through obstacles; Evade −3; exempt from ground-anchored effects such as `Enki`. |

### A.17.3 New resources

| Resource | Source | Semantics |
|---|---|---|
| `Aria` | EMIYA | `0/6`. +1 at the end of every Combat Phase he was in; blocked by `Silence`; spent **entirely** to activate Unlimited Blade Works. A per-Servant `Resource` (Ch. 06 §6.2), not a counter. |
| `Hassans` | Hundred-Faced Hassan | `100/100`, tracked on the **Master's** sheet. Deployment draws from it; defeat decrements it; the NP costs `4d6`. The Servant is defeated at zero. |
| `HGoB Construction` | Semiramis | (Existing.) Listed here because `Hassans` and `Aria` establish the pattern it was the sole instance of. |

### A.17.4 New elements

Damage elements referenced by content, beyond the `fire` and `water` the original twelve used:

| Element | Introduced by | Interactions |
|---|---|---|
| `ice` | Nursery, Anastasia, Raikou | Carries `Freeze`; amplified by `Soaked` |
| `wind` | Nursery, Medea, Danzō, Quetzalcoatl, Raikou | Carries `Sap` / `Bleed` |
| `lightning` | Scáthach, Quetzalcoatl, Raikou | Carries `Shock`; Raikou is immune |
| `light` | Ozymandias | ×2 vs `Dark`; banishes `Spirit` summons |
| `nature` | terrain (Ch. 42) | Forest and Meadow |
| `water` | (existing) | Carries `Slow`, `Drowning` |
| `fire` | (existing) | Carries `Burn`; removes `Freeze`; consumes `Soaked` |

Elements are tags on a damage instance, not a resistance chart. There is no element wheel in
F/GT; every interaction is stated per-effect, which is why this table lists *interactions* rather
than a matrix.

---

## A.18 Effect visibility

Added in `0.2.0` for Serenity's Secret Poison and Jack's Information Erasure.

| Field | Values | Meaning |
|---|---|---|
| `visibility` | `public` (default), `ownerOnly`, `gmOnly` | Who sees the effect on the token and in the tooltip |
| `deferredUntil` | an event id, or `null` | Hide the effect **and its attribution in the log** until the event fires; then disclose retroactively |
| `attributionHidden` | `true` / `false` | Apply the mechanical result immediately but show the *cause* as unattributed |

**Secret Poison uses `attributionHidden`, not deferred damage.** Health drops on schedule; the
log entry says *"−80 (source hidden)"*. This preserves state integrity at the cost of a weaker
secret, which is the correct trade (Ch. 44 §44.4, **D44.10**).

**All three fields now have readers.** `visibility` and `attributionHidden` shipped on the
instance schema in `0.2.0` and **nothing anywhere read or wrote either** — `io.createEffects`
did not mention them, so an effect could be constructed hidden and was always created public, and
`canSeeEffect` (which has been in `rules/effect-flow.mjs` since the effect engine was written)
had no caller at all. Built for Serenity:

- `applyEffect` accepts and stamps both, and `io.createEffects` persists them.
- The token HUD filters its effect list on the **explicit** settings — `gmOnly` and `ownerOnly`.
  §11.10's polarity *default* is deliberately not applied there: it would hide every ordinary buff
  from everyone but its bearer, which is a far larger change than the field asks for and one no
  sheet in the reference set wants.
- `deferredUntil` is still **unread**. Secret Poison does not need it — its disclosure is driven
  by the concealment ending, which is one function rather than an event subscription — and adding
  a second, half-wired disclosure path would be the exact defect this appendix keeps recording.

The tally the sheet promises to reveal (*"total Poison Damage taken"*) is `system.hiddenDamage`,
keyed by cause, accumulated by `io.adjustHealth` from the intents of the write that takes the
Health.

---

## A.19 Keywords

| Keyword | Meaning |
|---|---|
| `Bind` | Umbrella for Stun, Disable, Immobilize, Slow, Petrify, Shock, Webbed, Seal, Freeze, Crystalfreeze. **Built as a family** (Ch. 11): declared on each member, projected as `effectFamilies`, asked as `target:effectFamily:bind`. Medusa's `Dmg Up (Bind)` is its first reader; the members without definitions yet cannot carry it. |
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
| `Instinct` | A **category asserted at the bottom of a character sheet**, not a property of the ability. Five named skills count as Instinct for the purpose of Jack's Mist exemptions. Modelled as `categorizedAs: [instinct]` in the content pack. |
| `Normal Human` | A unit class below Master. Several fields kill them outright on contact (The Mist, Blood Fort Andromeda, Ramesseum Tentyris). |
| `Weapon-type` NP | An NP classification EMIYA can copy. Unordered qualifier; disjoint from `Divine Construct`. |
| `Divine Construct` | An NP classification that **cannot** be copied, with a per-NP `copyableException` (black Arondight). |
| `Broken Phantasm` | A modifier applied to a *copied* NP's use: Range +1 (or AoE +1 each direction), Total Damage +100%, all applied effect magnitudes **doubled**, and the copy can never be created again. |
| `Thrown weapon` | An NP sub-classification. Rho Aias cannot be broken by one. |
| `Heel Attack` | A declared sub-attack resolved **after** a failed Evade, with its own hit table. See `weakPoint`, Ch. 44 §44.2. |

---

## A.20 Counts

| Category | `0.1.0` | `0.2.0` | Total |
|---|---|---|---|
| Buffs | 48 | +14 | **62** |
| Debuffs — non-volatile | 32 | — | 32 |
| Debuffs — mental | 5 | — | 5 |
| Debuffs — volatile | 30 | — | 30 |
| Debuffs — terminal | 4 | — | 4 |
| Statuses | 7 | +12 | **19** |
| Resources | (1) | +2 | **3** |
| **Total named effects** | **126** | **+28** | **154** |
| Keywords | 18 | +8 | **26** |
| Families | 15 | +3 | **18** |
| Elements | 2 in content | +5 | **7** |

Each becomes one YAML file under `packs/_source/effects/` (Ch. 37 §37.1).

**Authored so far: 157 files against 154 named rows** — the count lives in this appendix's header block and is read
off the directory rather than incremented by hand, because three hand-kept tallies had already
drifted apart. Scáthach brought fifteen at once, which is more than any other
Servant and not a coincidence: her *Primordial Rune* is a sixteen-row table of ordinary buffs and
debuffs, so she needed the crit and debuff-chance families completed in **both** directions —
`Crit DmUp` / `Crit Dwn` / `Crit DmDwn`, `NP DmUp` / `NP DmDwn`, and all four of
`Debuff ResUp` / `Debuff ChUp` / `Debuff ResDwn` / `Debuff ChDwn`. Plus `Shock`, `Slow`, the two
terminal effects, and her own `Dmg Up (Gods)` and `Alpi`.

**Note that no new debuffs were needed.** Twenty-six additions across seventeen Servants and a
twenty-one-type terrain system, and every one of them is a buff, a status or a resource — the
debuff vocabulary catalogued from the source documents in `0.1.0` turned out to be complete.
That is a useful signal about where the game's authors did their systematisation, and about
which half of Appendix A is likely to keep growing.

---

## A.21 The thirty-one readers with no document — built 2026-09-16

Thirty-one rows of this catalogue shared one defect, and it is this project's dominant one stated
as plainly as it ever gets: **the behaviour was implemented and no Unit could be given the effect
that triggers it.** Each reader tests for an effect **by id**, and each id belonged to no
document.

| Effect | The reader that was already there |
|---|---|
| `Substitution` | `damage/pipeline.mjs` stage 0 halts on it, before the attack is measured |
| `Endure` | stage 16's clamp to `health − 1`, written twice — Gogh's Curse clause sits beneath it |
| `Ward` | stage 4's `DEFENDER_BUCKET_KEYS`, the `Ward` element, and a row in `explain.mjs` |
| `Def Crk` | stage 16, with the Injury-threshold snapshot taken above it |
| `Crit ResUp` / `Crit ResDwn` | stage 2's four-term crit-damage sum |
| `Over Crit` | `overCritBonus`, `max(0, chanceUsed − 100)` |
| `G.Crit` / `No Crit` | the two short-circuits at the top of `checks.mjs#critChance` |
| `Block Up` | the `BlockModifier` element, stage 14's sum, and a row in `explain.mjs` |
| `Accel` | `combat-process.mjs#canCounter`'s `attackerHasAccel` flag |

Nine of the eleven needed **only** the document — six of those carry `rules: []`, which is the
finished state and not an unfinished one, because the pipeline recognises them by id and a rule
element beside that would be a second, weaker implementation of a halt that already exists.

Two needed more.

### The second twenty

| Effect | The reader that was already there |
|---|---|
| `nvDebuff Immune` / `vDebuff Immune` / `Men.Debuff Immune` | the `scoped` table in `effect-applier.mjs`, keyed on the incoming effect's own **volatility** |
| `Off.Debuff Immune` / `Def.Debuff Immune` | the same gate's two **valence** branches |
| `No Buff` | that gate's one buff branch — `polarity === "buff"`, the single line in the function that asks about a buff |
| `NP Lock` / `NP Degen` / `NP Lag` | three short-circuits at the top of `scheduler.cooldownRate` |
| `PoisHeal` / `CursHeal` / `FlamHeal` | **two** readers each: stage 0's element conversion *and* `PERIODICS[…].healConversion` |
| `Luck Boost` / `Luck Loss` | four call sites, each `held.includes(id) \|\| plan.forceTable === …` |
| `Stop` | `PREVENT_ALL`, plus **two** scheduler sweeps — durations and cooldowns are different passes |
| `Crystalfreeze` | stage 16 iterates `[["freeze", …], ["crystalfreeze", …]]`; only one had a document |
| `Immobilize` | the partial-prevention table, an Agility `+4` in `attack.mjs` — **and terrain inflicting it** |
| `Seal` | `seal: ["attack", "skill", "np"]`, whose omission of `spell` *is* the row's last clause |
| `Webbed` | `PREVENT_ALL` and `invalidation.mjs` |
| `Dragonblight` | stage 0's halt on an elemental attack (clause 1 only) |

Three of these are worth singling out.

**`Immobilize` was worse than inert.** `rules/terrain.mjs` has *inflicted* it since the terrain
system was built — `magnetic` ground is *"25% chance of Immobilize for 1◈ — 100% for units with
the Mechanical attribute"*, carrying a resistance bypass written carefully around a debuff that
did not exist. The clause could not land, so magnetic terrain did nothing at all. This is the
first entry in this appendix where the missing document silently disabled a **shipped feature**
rather than only a catalogue row.

**The partial preventions are the half that can go wrong quietly.** `Immobilize` and `Seal` must
**not** carry `preventsAction: true`: that flag routes an effect through `PREVENT_ALL`, which
takes everything. Immobilize would then stop an Attack it is not supposed to stop, and Seal would
stop the Spells its row explicitly spares. Both documents omit the flag deliberately, and the
tests assert the permitted action rather than only the refused ones — a denial test that checks
only refusals passes just as happily when the effect denies too much.

**`Dragonblight` clause 2 had no reader at all.** *"Cannot inflict volatile debuffs"* is an
**outgoing** `ApplicationChance` of −100 scoped by `volatility` — the same field Heracles's
Bravery uses — so a volatile debuff authored later is covered by saying what it is, and no list
of ids has to be kept in this file.

`Levitating` is **not** in the table above and is deliberately not a document: §A.17.2 calls it
an *attribute*, and `rules/platforms.mjs` and `rules/terrain.mjs` both read it off
`unit.attributes`. An effect of the same id would be a second, divergent answer to one question.

### `Accel` was a strictly weaker effect than this catalogue describes

The row says *"opponents cannot **React**"*. `canCounter` had taken an `attackerHasAccel` flag
since the Counter rung was written and `engine/attack.mjs` had passed it — so the **third** rung
was closed and the first two were not. A defender could still Block and Evade an Accel attack.

Nothing had noticed because nothing could apply `accel`; authoring the document is what first put
a Unit on the near side of the gap. The fix went where the ladder is narrowed for every other
reason — `forbiddenReactions`, assembled once at declaration alongside concealment's refusals, an
AGI comparison and an attack's own `unblockable` — rather than beside the counter flag, because a
rung closed in two places is a rung that can be reopened in one.

Pressed in a live world against a real declared Normal Attack, the Process now halts at the
`react` rung carrying `forbiddenReactions: []` normally and `["block", "evade"]` when the attacker
holds Accel.

### `npValue: "@magnitude"` is a dangling expression, and it bit six files

`Ward` is *"including NP"* — full magnitude against a Noble Phantasm, unlike `Def Up`. The obvious
way to say so is `npValue: "@magnitude"`, and it does nothing at all.

`rules/snapshot.mjs#resolveRuleValues` substitutes the two instance tokens **by field**: `value` is
matched against `"@magnitude"`, `npValue` against `"@npMagnitude"`. A `npValue` holding
`"@magnitude"` therefore matches nothing, survives as a literal string into the executor, resolves
against a `@` ref tree that publishes no `magnitude`, and comes back `null` — so every executor
drops the field.

The resulting behaviour is the pipeline's default (`isNP && m.npValue !== undefined ? m.npValue :
m.value`), which is **exactly what the author wanted**. That is precisely why it went unnoticed in
`atk-up-demonic`, `atk-up-magus`, `atk-up-ms`, `def-dwn-a` and `def-dwn-c`: right answer, dead
line. The assertion is the **omission**, and `tools/lib/content.mjs` now refuses the dead spelling
in either direction.

---

**Next:** [B — Rank Tables](B-rank-tables.md)

### Six effects Kiritsugu added

| Id | Polarity | Notes |
|---|---|---|
| `pierce` | buff | **The first Pierce document in the corpus.** `Pierce` was in this catalogue and read by the damage pipeline in three places, and no content could produce it: `attack.pierce` came only from an ability's own `damage:` block. It rides `AttackProperty` (Ch. 13). |
| `penetration` | buff | Ignore Def **and** a halved Invuln. `invulnFactor: 0.5` is how much damage SURVIVES — the first clause that weakens a defence rather than bypassing it, and deliberately **not** Pierce, which would be a total bypass the sheet withholds. |
| `critUpFamiliar` | buff | Range-conditional Crit Up, beside `critUpHawkeye` and for the same reason: a plain `critUp` would sharpen him in melee where the sheet gives him nothing. Its predicate is DEFERRED. |
| `decoyScapegoat` | debuff | Its own document rather than the shared `decoy`, because Lethal Gunfire Suppression triggers on **this** one — sharing it would make Mannanán's self-applied Decoy fire Kiritsugu's gun from across the board. Keeps `allySelfBypassesResistance`: it is applied to an ally on purpose. |
| `suppression` | buff | **Two clocks that are not the same clock**: `uses: 5` and a 1◈ duration, ending on whichever runs out first. A use is spent by a SUCCESSFUL strip only. `noneExtend`, so Magecraft's `DurationExtension` lengthens the clock without refilling the uses. |
| `kiritsuguMark` | debuff | Halves BOTH Base Attack components; unremovable, non-stacking, past Debuff Resist *and* Debuff Immune. Named `kiritsuguMark`, never `kiritsugu` — an effect sharing a content id with its Servant is a build-breaking collision, which `raikou` hit. Its display NAME is still "Kiritsugu", as the sheet has it, which makes the content linter flag every mention of the man; those are incidental. |

