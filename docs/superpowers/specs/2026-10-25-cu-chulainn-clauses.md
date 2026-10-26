# Cú Chulainn (Lancer) — the Clause list

*Cú Chulainn*, the Lancer, built from `char_orig_sheets/by-class/Lancer/Cú Chulainn.md`. Started by the user
2026-10-25.

**Audit opened 2026-10-25 (#339).** **Read by hand, line by line.** No generated draft was used. The older copy `char_orig_sheets/Copia de Cú Chulainn.md`
was compared with it. The by-class copy:

- adds `N.Atk Type: STR, Melee`, and the `{M}` and `{R}` delivery tags on the two Gáe Bolgs;
- adds Barbed Spear's *"The Master's Health cost of using this NP is treated as if a Rank D Noble Phantasm was used"*;
- reads Protection from Arrows as *"any {Ranged} Attacks"* where the older read *"any Attack from a Ranged weapon"*,
  adds *"(with a few possible exceptions?)"*, and narrows nothing to Ranged in *"Does not apply to AoE Attacks"*
  where the older read *"Ranged AoE Attacks/Noble Phantasms"*;
- drops a stray *"the"* before Atk Up (Redbranch).

The by-class copy is the one read.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Most of him is other Servants' pieces:

- **Magic Resistance C** is `class-magic-resistance` at C (negates up to C, 30%, debuffs 15%), as the table gives it.
- **Divinity B** is `divinity` at B (40). He prints the Revised text, and the template's own comment already names him
  (#260 reading 3): the War's `divinityRevision` decides, *As printed* plays his.
- **Battle Continuation A** is `class-battle-continuation` at A: 2d10+20, the NP dice doubled, 5d20, 3◈, the
  half-Health condition. Heracles's and Achilles's at the same Rank.
- **Shoal of Four Branches**' Guts is `guts`, as Van Gogh's Imaginary Number Arts lands it for 1◈+⅔◈. Its *"if NP,
  this value is halved"* is Van Gogh's `npMagnitudeFactor: 0.5`.
- **Disengage** is Hundred-Faced Hassan's Battle Retreat in shape: a `move`, a `heal` and a removal, cancelling the
  Attack (#226 readings 12, 24). Its window, *"at the start of a Combat Phase when Cú is Attacked"*, is Vlad III's
  `defendingPhaseStart` (#206, #330).
- **Rune Magic** is Scáthach's Primordial Rune `rollTable` with one die and four rows; Def Up, Atk Up and Crit Up are
  the common effects with their NP figures. Tiwaz's *"Rank of Magic Resistance is increased by 1 Rank"* is
  `RankShift` on an ability, as Penthesilea's Goddess of War shifts her Divinity.
- **Ansuz** is a Damage Spell as Nursery Rhyme's and Medea's are, with Burn.
- **Gáe Bolg: Barbed Spear** is Scáthach's Gate of Skye `check: luck` before the damage, with `onFail`, and Gáe Bolg
  Alternative's `skipIf: { effectApplied: instakill }`. Its Instakill chance against Invuln and Anti-Purge is Medea's
  Atlas's `chanceModifiers`. Its Rank D cost is EMIYA's Rho Aias's `masterHealthByNPRank`.
- **Gáe Bolg: Soaring Spear**'s Base Attack is Mana Burst's `base.sources` at factors 1 and 0.5; its 5x5 within
  Range is Rhongomyniad's `withinRange` and the Range wall (#234).
- **The note between the two Gáe Bolgs** is Gate of Skye's `abilityOffCooldown` requirement, on each.

What he needs that nobody has yet, each built as a generic piece:

- **Disengage as a ranked template** (DE.*): Hector (B: 4 panels, 20%, 2 debuffs, 3◈), Siegfried and Darius III
  (A: 5, 25%, all, 3◈) print the same Skill. Cú Caster prints his at C.
- **Protection from Arrows** (PA.*): an automatic Evade against a Ranged Attack, by the cone it came from. Proto Cú
  prints his word for word at B; Cú Caster at A (no cone, the AoE penalty ignored); Tawara Touta and Cú Alter at C
  (75%). Arturia's Instinct is the `AutoSucceed` it builds on; what it lacks is a predicate over the attack (its
  delivery, AoE, cone). The cone needs an option: `attack:cone:front|side|back` from the Process's stamp (#184).
- **A magnitude from missing Health** (SF.atk.x): Atk Up (Redbranch)'s X.
- **Rune Magic's second pick** (RM.choose): *"then apply one more effect of your choice other than the one selected
  by the die"*, a `rollTable` option.
- **An effect that ends when its inflicter is defeated** (GB.cb.end): Curse (Bolg). Proto Cú's Def Crk (Bolg) prints
  the same rule.
- **Ath nGabla** (AG.*): a duel of several Combat Phases between two Units. No other sheet on the roster prints it.

**112 Clauses** across 11 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"X is as follows-"*: headings.
- *"(e.g. Cú's Health is 457/1000, so X=50)"*, *"(e.g. BA=200)"*: glosses of the rule beside them. They are read for
  the rounding (SF.atk.x) and the figure (GS.ba).
- *"(arrows, firearms, thrown weapons, magic projectiles, etc)"*: examples of a Ranged Attack, not a list.
- *"(clueless on how to make this work properly, but leaving it in anyway)"*: the author's note on Ath nGabla.
- *"(with a few possible exceptions?)"*: the author's doubt; no exception is named (ruling 10).
- The *"Magic Resistance — Rank: B"* block under Rune Magic: the text Tiwaz turns his Magic Resistance into, read as
  RM.1.b.
- *"ᚨ"* and *"ᛉᚾᚨᛝ"*: the runes the two Spells are named by.
- `Items Held:`: an empty slot.

## Readings to settle

Asked by grilling, 2026-10-25. Rulings are written here as they land. **Built 2026-10-26** on `claude/cu-chulainn`
(`test/unit/cu-chulainn-339.test.mjs`, 25 tests) and pressed as Player1 in a War of its own, `FwdFxnFteJ3xFCax` on the
scene *Cú Chulainn Audit*, apart from the match being played. 95 of the 96 Clauses built end Pressed, Observed or
Tested; PA.np is built and not yet seen against an NP. Ath nGabla's 16 are deferred.

**Round 1, ruled 2026-10-25 (the user).**

| # | Ruling |
|---|---|
| 1 | Atk Up (Redbranch)'s X is read once, from his Health when Shoal is used, and kept for the 1◈; each whole 10% missing adds 10, rounded down: 457/1000 gives 50 (SF.atk.x). |
| 2 | Disengage is used at `defendingPhaseStart`, Vlad III's window (#206, #330). Against a targeted Attack the whole Attack is cancelled; against an AoE he alone leaves it; the attacker's Attack is spent either way (Hassan's Battle Retreat, #226 readings 12, 24) (DE.when, DE.cancel). |
| 3 | Disengage's debuff is his pick, never an Unremovable one. Disengage is one ranked template: C 3 panels, 15%, 1 debuff, 2◈ (Cú, Cú Caster); B 4, 20%, 2, 3◈ (Hector); A 5, 25%, all, 3◈ (Siegfried, Darius III) (DE.*). |
| 4 | Rune Magic's second pick is optional, any one of the three rows the die did not choose; every row lands on him (RM.choose, RM.self). |
| 5 | Tiwaz's *"1 Rank"* is a whole grade: Magic Resistance C becomes B, as the block printed under Rune Magic shows (RM.1, RM.1.b). |
| 6 | Carried from Nursery Rhyme's R2 (2026-09-16): a Damage Spell that prints no figure deals 1× BA(MAG). Ansuz deals 150, Fire. The reading holds for every such Damage Spell (AN.dmg). |
| 7 | One Ath nGabla Combat Phase is two Attacks: the higher Agility attacks the other, then the other attacks back; each an ordinary Combat Process with its reactions; a tie is a coin flip, once per Combat Phase (AG.phases, AG.order, AG.tie). |
| 8 | *"Facing Cú Chulainn"* is his panel in that enemy's front cone, three panels wide (#184 reading 10, Medusa's). Any enemy; the DU need not be the one facing him (AG.facing). |
| 9 | Protection from Arrows asks `deliveryOf` (#281 readings 12, 15): a stated `{R}`, or an untagged attack from 2 panels or more (`rangedMinimumRange`). An untagged Range-2 Normal Attack from 2 panels is evaded; Melee and Special are not (PA.auto). |
| 10 | From Behind there is no automatic Evade: his Evade roll takes −2, offsetting the +2 behind. The cone is the one stamped at the declaration (#184). Every AoE is excluded, as the by-class copy reads. No exception is built (PA.cone, PA.back, PA.aoe). |
| 11 | Barbed Spear's DU makes Gate of Skye's `check: luck`, no modifier. Failed and Instakill landed: Instakill and Curse (Bolg), no damage. Passed, or the Instakill resisted: 3.5x and Curse (Bolg). Curse (Bolg) lands once on either path (GB.luck to GB.curse). |
| 12 | Against Invuln the Instakill's chance is 50%, and a landed one takes Health to 0: Invuln's *"instead halves"* does not apply, this clause rules Invuln itself (and that halving has no reader today). Against Anti-Purge the chance is 0 (GB.invuln, GB.antipurge). |
| 13 | Curse (Bolg) deals Curse's 25 at the end of the holder's Turn, always stage 1; a second hit adds nothing. No duration: it lasts until his defeat removes it (GB.cb.*). |
| 14 | Curse (Bolg) comes off only when he **stays down**: a defeat that Guts or Battle Continuation answers with a revival removes nothing (GB.cb.end). |
| 15 | Soaring Spear hits every Unit in the 5x5, his allies too (Rhongomyniad ruling 9, #191 reading 11); the area is placed within Range 4 (#234) (GS.area). |

**Round 2, ruled 2026-10-25 (the user).** The duel spends each side's budget: *"the units are moving and attacking after all"*. How is round 3.

| # | Ruling |
|---|---|
| 16 | A duel Attack is any Attack the Unit could make in its own Turn, aimed at the other duelist only: a Normal Attack, an Attack Skill, a Damage Spell or an NP. Cooldowns, Seals and the NP Round gate (`npGateRound`) hold. It spends budget (round 3) (AG.phases). |
| 17 | No Counter is offered in a duel Process; Evade, Block and Cover stay (AG.phases). |
| 18 | Between Combat Phases, except after the last, each duelist may Move, in the next Combat Phase's Agility order, ending within 4 panels of the other as Pollux's leash measures (`leashBreakAt`). It spends budget (round 3) (AG.move, AG.leash). |
| 19 | A duelist whose Attack cannot reach the other loses that Attack; the duel goes on (AG.phases). |
| 20 | The duel ends after the Combat Phase the d6 counted, or when either duelist stays down (ruling 14) or leaves the board; a revival mid-duel lets it go on. Ath nGabla's X◈ starts then (AG.cd, AG.cdstart). |
| 21 | Ath nGabla is a Spell: Silence and Skill Seal hold it; no debuff, so Magic Resistance does not resist it. The duel runs at once, inside his Turn (AG.spell, AG.when). |
| 22 | A Barbed Spear used during the duel is Rank A, 4x, Cooldown 7◈; its Master cost stays Rank D; the exclusion with Soaring Spear holds (AG.rank, AG.4x, AG.gbcd). |
| 23 | He stays down when no revival answers his defeat at that moment; Curse (Bolg) then comes off everyone at once, and a later return does not restore it (GB.cb.end). |

**Round 3, withdrawn 2026-10-26 (the user).** Ruling 24, Ath nGabla as a compulsion across Turns, is withdrawn:
*"Forget my previous answer ... For now we won't be coding Ath nGabla."* Ath nGabla is **deferred**: the AG.* Clauses
are not built and he is authored without it. Rulings 7, 8 and 16–22 stay on file for when it is built; the budget
part of round 2 is open with it.

**Round 4, ruled 2026-10-26 (the user).** Rulings 25 to 33 answer the round's Q24 to Q32.

| # | Ruling |
|---|---|
| 25 | Protection from Arrows is offered, never forced: he still picks his reaction, and an Evade he picks against a Ranged Attack succeeds with no roll, Arturia's Instinct in shape. He may Block instead (PA.auto). |
| 26 | Carried: Aim beats every Evade, his automatic one too (Ch. 13), and `unavoidable` closes the Evade rung at declaration (Ch. 21). A Ranged Aim Attack gets through him (PA.auto). |
| 27 | Barbed Spear is Aim, not `unavoidable`: Evade is closed, Block may cut the 3.5x after a passed check. The Luck Check runs `beforeDamage`, as Gate of Skye's (GB.aim, GB.luck). |
| 28 | Where the War removes Luck Checks (Beginner, Intermediate), the NP's check is not rolled and counts as passed: 3.5x and Curse (Bolg), never Instakill; the card prints the reason. Gate of Skye follows the same reading: `runCheckPhase` asks `closedLuckRung`'s reason too (GB.luck). |
| 29 | A DU with 0 Luck rolls against 0 and fails; its Luck stays at 0 (GB.luck, GB.fail). |
| 30 | Carried: Barbed Spear deals STR damage, so Magic Resistance does not cut the Instakill chance (MR.2.str); Instakill is terminal, so no Prevention Luck Check (Ch. 13) (GB.fail). |
| 31 | Atk Up (Redbranch) is its own effect and stacks with Rune Magic's Atk Up; the NP halving covers the whole 20+X: 457/1000 gives 70%, 35% on an NP (SF.atk, SF.atk.np). |
| 32 | Soaring Spear is Mana Burst's shape: `component: str`, `ignoresMagicResistance`, `flatBonus: 100` after the multiplier: 3.5 × 200 + 100 = 800, Divinity's 40 on top (GS.ba, GS.dmg, GS.flat, GS.mr). |
| 33 | Carried from Vlad III (`guts.yml`): one revival answers each defeat, Guts first. Shoal's Guts, 250, goes before Battle Continuation's 5d20 (SF.guts, BC.2). |

**Round 5, ruled 2026-10-26 (the user).** After the live press. Ruling 34 replaces ruling 28; ruling 35 rewords ruling 13.

| # | Ruling |
|---|---|
| 34 | *"Intermediate: Luck Check removed"* removes the rulebook's own Luck Checks: the Contest, Lucky Evasion and the Prevention Luck Check. A Luck Check an ability's sheet prints is the ability's and still rolls on every difficulty: Barbed Spear's and Gate of Skye's alike. A field that blocks Luck Checks is ruling 38 (GB.luck). Replaces ruling 28. |
| 35 | Curse (Bolg) deals its 25 at every Turn's end, whoever's Turn, as Curse does (Appendix A: *"at the end of the turn, every ⅓◈"*). Rewords ruling 13; no code changes (GB.cb.*). |
| 36 | The Prevention Luck Check reads its target's live document: a Unit with no Luck left, or at 0 Health, is offered nothing. Found live: offered to Medusa after Barbed Spear's check spent her Luck and its Instakill emptied her. |
| 37 | *"Removed from all affected Units"* is every holder in the War, the defeated too; the card names each (GB.cb.end). |
| 38 | *"Luck Check cannot be used by the involved Units"* (Achilles's Diatrekhōn Astēr Lonkhē, `BlockLuckChecks`) closes the Luck Checks a Unit chooses: the Contest, Lucky Evasion, Prevention. A Luck Check an NP imposes is never "used" and is still rolled inside the field (GB.luck). |

## Statblock

- [x] **ST.name** · True Name: Cú Chulainn · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.class** · Class: Lancer · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.region** · Region: Ireland · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.align** · Alignment: Lawful Neutral · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.param** · STR B, END C, AGI A, MAG C, LUC E · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.attr** · Attributes: Male, Servant, [Sky], Humanoid · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.hp** · Base Health 1000 · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.mov** · MOV 7 · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.range** · Range 2 panels, 1 target · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.ba** · Base Attack STR 125, MAG 150 · *Observed live* — Ansuz's card: BA(MAG) 150; Soaring Spear's: BA(STR) 125 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **ST.na** · Normal Attack: STR, Melee · *Observed live* — his Normal Attack offered as a Counter, Melee (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **ST.sus** · Sustainability 2◈ · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`
- [x] **ST.items** · Items held: none · *Observed live* — Player1's bar and sheet (War FwdFxnFteJ3xFCax, 2026-10-26); projected in `cu-chulainn-339.test.mjs`

## Magic Resistance — Rank C *(Class Skill)*

- [x] **MR.1** · Passive 1: MAG damage from a MAG Rank of up to C is negated · *Observed live* — Magic Resistance read at C, 30% (War FwdFxnFteJ3xFCax, 2026-10-26); template pressed on earlier audits
- [x] **MR.1.over** · …otherwise MAG damage taken is reduced by 30% · *Observed (template)* — `class-magic-resistance` C, 30%
- [x] **MR.1.np** · …also affects NP · *Observed (template)* — `includesNP: true` read live
- [x] **MR.2** · Passive 2: chance of being inflicted by debuffs −15% · *Observed (template)* — debuffs −15% at C
- [x] **MR.2.death** · …also affects Instakill and Death · *Observed (template)* — `class-magic-resistance`, pressed on Scáthach's and Medea's audits
- [x] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance · *Observed (template)* — `class-magic-resistance`, pressed on Scáthach's audit (#204)
- [x] **MR.2.erase** · Erase is completely unaffected · *Observed (template)* — `class-magic-resistance`
- [x] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Observed (template)* — `class-magic-resistance`

## Divinity — Rank B *(Passive)*

- [x] **DV.1** · All damage dealt is increased by 40 · *Pressed* — +40 on Soaring Spear's and Ansuz's cards (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DV.np** · …including NP · *Pressed* — +40 on Soaring Spear, an NP (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DV.fixed** · The extra damage is dealt as Fixed Divine Damage · *Pressed* — "Divinity (Fixed Divine, added after every modifier)" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DV.injury** · …and does not count towards the amount required for an Injury Roll · *Observed (template)* — `fixedFlat` outside the Injury snapshot; Revised text, `printedRevision: revised`

## Battle Continuation — Rank A *(Passive)*

- [x] **BC.1** · Passive 1: all damage received is reduced by 2d10+20 · *Observed (template)* — `class-battle-continuation` A, Heracles's and Achilles's
- [x] **BC.1.np** · …if NP, the number of dice rolled is doubled · *Observed (template)* — `npDiceDoubled`
- [x] **BC.2** · Passive 2: when defeated, he is automatically revived with 5d20 Health · *Observed (template)* — the revival chain asked it at his defeat
- [x] **BC.2.cd** · …Cooldown 3◈ · *Pressed* — "Battle Continuation cannot bring Lancer back: its Cooldown has 9 Turn(s) left." (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **BC.2.half** · …and his Health must have been restored above half its maximum at least once since the last activation · *Observed (template)* — Vlad III (Berserker)'s press, "has not been restored above 50%"

## Shoal of Four Branches — Rank A

- [x] **SF.when** · Used during his Turn · *Pressed* — from Player1's bar on his Turn (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **SF.guts** · Applies Guts for 1◈+⅔◈ · *Pressed* — Guts 25 on him, expiry 1◈+⅔◈ (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **SF.guts.25** · …when he is defeated, he is revived with 25% of his Max Health · *Pressed* — magnitude 25 landed; a Guts revival is ruling 33's order, unit-tested
- [x] **SF.atk** · Applies Atk Up (Redbranch) for 1◈: all damage dealt +(20+X)% · *Pressed* — Atk Up (Redbranch) on his card (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **SF.atk.np** · …if NP, the value is halved · *Pressed* — Soaring Spear's breakdown: "Atk Up (Redbranch) +35%" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **SF.atk.x** · …X rises by 10 for every whole 10% of his Health missing (457/1000 gives 50) · *Pressed* — at 457/1000: magnitude 70, NP 35 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **SF.cd** · Cooldown 4◈ · *Observed* — the slot greyed with its clock after the press

## Disengage — Rank C

- [x] **DE.when** · Used at the start of a Combat Phase in which he is Attacked · *Pressed* — "Start of the Combat Phase you are attacked in" offered to Player1 on each Attack on him (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DE.cancel** · The enemy Unit's Attack is cancelled · *Pressed* — EMIYA's Normal Attack: "Archer's Attack is cancelled by Disengage.", "Moved to (4, 5)", "Health 407 → 557 (+150)", "Burn removed" by his pick, Atk Dwn kept (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DE.move** · He may Move 3 panels · *Pressed* — EMIYA's Normal Attack: "Archer's Attack is cancelled by Disengage.", "Moved to (4, 5)", "Health 407 → 557 (+150)", "Burn removed" by his pick, Atk Dwn kept (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DE.heal** · …then restores 15% of his maximum Health · *Pressed* — EMIYA's Normal Attack: "Archer's Attack is cancelled by Disengage.", "Moved to (4, 5)", "Health 407 → 557 (+150)", "Burn removed" by his pick, Atk Dwn kept (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DE.debuff** · …and removes 1 debuff from himself · *Pressed* — EMIYA's Normal Attack: "Archer's Attack is cancelled by Disengage.", "Moved to (4, 5)", "Health 407 → 557 (+150)", "Burn removed" by his pick, Atk Dwn kept (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DE.order** · Move first, then the heal and the removal · *Pressed* — EMIYA's Normal Attack: "Archer's Attack is cancelled by Disengage.", "Moved to (4, 5)", "Health 407 → 557 (+150)", "Burn removed" by his pick, Atk Dwn kept (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **DE.cd** · Cooldown 2◈ · *Observed* — its slot on Cooldown after the press

## Rune Magic — Rank B

- [x] **RM.when** · Used during his Turn · *Pressed* — from Player1's bar (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **RM.roll** · Roll a four-sided die and apply the effect of that row · *Pressed* — "Rune Magic on Lancer: rolled 1." (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **RM.choose** · Then he may apply one more effect of his choice, other than the one the die chose · *Pressed* — "You rolled 1. You may apply one more effect the dice did not choose, or none." offered 2, 3, 4; picked Crit Up; declined once (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **RM.1** · 1: Tiwaz for 1◈: his Magic Resistance Rank +1 · *Pressed* — Tiwaz landed (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **RM.1.b** · …Magic Resistance B while it holds: MAG up to B negated, otherwise −40%, also NP; debuffs −20% · *Pressed* — Magic Resistance read B, 40%, while Tiwaz held (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **RM.2** · 2: Def Up for 1◈: damage received −25%; if NP, −15% · *Observed live* — offered as "2. Def Up 25%"; landed in `cu-chulainn-339.test.mjs`
- [x] **RM.3** · 3: Atk Up for 1◈: damage dealt +25%; if NP, +15% · *Observed live* — offered as "3. Atk Up 25%"; landed in `cu-chulainn-339.test.mjs`
- [x] **RM.4** · 4: Crit Up for 1◈: Crit Chance +20% · *Pressed* — Crit Up 20 landed by his pick (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **RM.self** · Every row lands on him · *Pressed* — every row on him (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **RM.cd** · Cooldown 4◈ · *Observed* — its slot on Cooldown after the press

## Rune Magic: ᚨ — Ansuz *(Damage Spell)*

- [x] **AN.spell** · A Damage Spell · *Pressed* — on Master of Archer: "BA(MAG) × 1 +150", Fire, "Burn rolled 26 vs 50%", 163 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **AN.range** · Range 3 · *Pressed* — on Master of Archer: "BA(MAG) × 1 +150", Fire, "Burn rolled 26 vs 50%", 163 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **AN.target** · On one enemy Unit · *Pressed* — on Master of Archer: "BA(MAG) × 1 +150", Fire, "Burn rolled 26 vs 50%", 163 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **AN.dmg** · Deals damage (no figure printed) · *Pressed* — on Master of Archer: "BA(MAG) × 1 +150", Fire, "Burn rolled 26 vs 50%", 163 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **AN.burn** · 50% chance of Burn for 2◈ · *Pressed* — on Master of Archer: "BA(MAG) × 1 +150", Fire, "Burn rolled 26 vs 50%", 163 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **AN.fire** · Fire damage · *Pressed* — on Master of Archer: "BA(MAG) × 1 +150", Fire, "Burn rolled 26 vs 50%", 163 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **AN.cd** · Cooldown 2◈ · *Observed* — its slot on Cooldown after the press

## Rune Magic: ᛉᚾᚨᛝ — Ath nGabla *(Spell)*

- [ ] **AG.spell** · A Spell · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.range** · Range 2 · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.when** · Used during his Turn · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.target** · On one enemy Unit · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.facing** · Only when at least one enemy Unit is facing him · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.d6** · The DU rolls a six-sided die · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.phases** · …and performs that many Combat Phases with him · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.order** · In each, the Unit with the higher Agility goes first · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.tie** · …equal Agility: a coin flip decides · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.move** · Both may Move between the Combat Phases · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.leash** · …but the two must stay within 4 panels of each other · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.rank** · While Ath nGabla is Active, Barbed Spear is Rank A, not B · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.4x** · …it deals 4x damage instead · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.gbcd** · …and its Cooldown is 7◈ · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.cd** · Cooldown X◈, X the number the DU rolled · *Deferred* — Ath nGabla is not built (2026-10-26)
- [ ] **AG.cdstart** · …counted from when Ath nGabla ends · *Deferred* — Ath nGabla is not built (2026-10-26)

## Protection from Arrows — Rank B *(Passive)*

- [x] **PA.auto** · He automatically Evades any {Ranged} Attack · *Pressed* — EMIYA's Ranged Normal Attack from his Front: "Protection from Arrows automatic success" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [ ] **PA.np** · …Noble Phantasms included · *Built* — the same `AutoSucceed`, no NP exclusion; not seen live against an NP
- [x] **PA.cone** · …from his Front and Sides · *Pressed* — Front: automatic; Behind: rolled (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **PA.back** · From Behind (the 3 panels behind him), when he Evades, the Evade roll is reduced by 2 · *Pressed* — Medusa from Behind: "attacked from behind +2 / Protection from Arrows -2" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **PA.aoe** · Does not apply to AoE Attacks · *Tested* — `checkPlan` with `attack:isAoE` grants nothing (`cu-chulainn-339.test.mjs`)
- [x] **PA.seal** · No effect while he is affected by Skill Seal · *Tested* — under Skill Seal the Evade is rolled (`cu-chulainn-339.test.mjs`)

## Gáe Bolg: Barbed Spear that Pierces with Death — Rank B *(NP, Anti-Unit)*

- [x] **GB.np** · A Noble Phantasm, Rank B, Anti-Unit · *Pressed* — Player1's bar, Rank B (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.melee** · `{M}`: a Melee Attack · *Pressed* — card "MELEE" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.range** · Range 3 · *Pressed* — targeted at Range 1 within 3 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.ba** · Base Attack (STR) is used · *Observed* — preview 302–460 on BA(STR); breakdown unit-tested
- [x] **GB.aim** · Has the Aim effect · *Pressed* — Medusa offered Do nothing and Block, no Evade (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.luck** · The DU performs a Luck Check when it is used · *Pressed* — "Luck Check 15 vs 1: failure" on the GM's card (War FwdFxnFteJ3xFCax, 2026-10-26); Closed Information hides it from Player1; on Intermediate it still rolled, *"Luck Check 5 vs 1: failure"* (ruling 34); on Expert, after *"18 vs 1: failure"* and Instakill, no Prevention was offered (ruling 36)
- [x] **GB.fail** · Failed: the DU is inflicted with Instakill · *Pressed* — Instakill: "Rider is defeated by Lancer." (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.fail.curse** · …and with Curse (Bolg) · *Pressed* — Curse (Bolg) on Medusa, source Cú (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.dmg** · Succeeded, or Instakill not inflicted: 3.5x damage · *Tested* — a passed check: 3.5x and Curse (Bolg), Luck spent (`cu-chulainn-339.test.mjs`)
- [x] **GB.curse** · …and Curse (Bolg) · *Tested* — Curse (Bolg) lands on the pass path too
- [x] **GB.cb.own** · Curse (Bolg) is separate from Curse · *Pressed* — its own effect, "Curse (Bolg)" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.cb.nostack** · …does not stack · *Tested* — `noneNoRefresh`, no stage
- [x] **GB.cb.unrem** · …is Unremovable · *Tested* — `unremovable: true`; removed by its rule only
- [x] **GB.cb.end** · …and is removed from every Unit that has it when he is defeated · *Pressed* — "Lancer stays down, and Curse (Bolg) comes off Archer." (War FwdFxnFteJ3xFCax, 2026-10-26); a revival removes nothing (tested); a defeated holder off the board loses it too: *"Lancer stays down, and Curse (Bolg) comes off Archer, Master of Rider of Faction 2, Rider."*, Medusa with no token (ruling 37, pressed)
- [x] **GB.invuln** · Its chance of inflicting Instakill on a Unit with Invuln is reduced by 50% · *Tested* — `chanceModifiers` −50 on `target:effectFamily:invuln`
- [x] **GB.antipurge** · …on a Unit with Anti-Purge, by 100% · *Tested* — Anti-Purge: no Instakill on a failed check
- [x] **GB.cost** · His Master's Health cost is a Rank D Noble Phantasm's · *Pressed* — log: npCost superseded by barbedSpearRankD, Master −20 (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GB.cd** · Cooldown 6◈ · *Observed* — "Cooldown 5◈ (15 turns)" on his bar the next Turn
- [x] **GB.excl** · Cannot be used while Soaring Spear is on Cooldown · *Tested* — `pressGate` refuses it while Soaring Spear cools

## Gáe Bolg: Soaring Spear that Strikes with Death — Rank B+ *(NP, Anti-Army)*

- [x] **GS.np** · A Noble Phantasm, Rank B+, Anti-Army · *Pressed* — Player1's bar, Rank B+ (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.ranged** · `{R}`: a Ranged Attack · *Pressed* — card "RANGED" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.range** · Range 4 · *Pressed* — placed within Range 4, the area clipped to it (#234) (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.ba** · Base Attack is BA(STR) plus half of BA(MAG): 125 + 75 = 200 · *Pressed* — "BA(STR) +125, BA(MAG) × 0.5 +75 … 200" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.area** · Hits a 5x5 panel area within Range · *Pressed* — 5x5 placed, him excluded as "the attacker itself" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.dmg** · 3.5x damage · *Pressed* — "3.5× damage" (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.flat** · …plus 100 · *Pressed* — "Flat bonus plus 100"; 943 on EMIYA (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.mr** · Not affected by Magic Resistance · *Pressed* — Resistance row empty for the MAG half (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.cd** · Cooldown 6◈+⅓◈ · *Pressed* — Cooldown 19 = 6◈+⅓◈ (War FwdFxnFteJ3xFCax, 2026-10-26)
- [x] **GS.excl** · Cannot be used while Barbed Spear is on Cooldown · *Pressed* — Player1's bar: "Not while Gáe Bolg: Barbed Spear that Pierces with Death is on Cooldown." (War FwdFxnFteJ3xFCax, 2026-10-26)
