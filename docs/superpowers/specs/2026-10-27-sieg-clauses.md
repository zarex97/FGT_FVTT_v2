# Sieg (Caster) — the Clause list

*Sieg*, the Caster, built from `char_orig_sheets/by-class/Caster/Sieg.md`. Started by the user 2026-10-27.

**Audit opened 2026-10-27 (#345).**
**Read by hand, line by line.** No generated draft was used. The older copy `char_orig_sheets/Copia de Sieg.md`
was compared with it. The two differ in one line, Akafiloga Argrise 2.i: the by-class copy adds *"(increased by
50%?)"* after *"the amount of Health lost is doubled"*. The by-class copy is the one read; the query goes to the
grill (Q12).

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Caster/Sieg"`, each confirmed by reading:

- **Siegfried himself** is built (#341, `servants/siegfried.yml`). Dead Count Shapeshifter's usage 2 turns Sieg into
  that sheet, *"with all Skills and NP available"*. `dmgUpDragon` is his Dragon Slayer's effect.
- **Independent Action EX** is `class-independent-action-viy`'s three passives word for word, without her fourth
  (Anastasia (Summer)). The ZON is the table's, 3 at EX; the contract refusal is `rules/contract.mjs`'s EX branch.
- **Magecraft**'s one Spell a Turn is Kiritsugu's `CategoryUseLimit` on a category, `strasseGehen`.
- **Range-banded Normal Attack** is EMIYA's and Mannanán's `normalAttack.mode: rangeBanded`: STR at 1, MAG from 2.
- **Max HpUp** is Appendix A's: *"Max Health +X and current Health restored by the same amount"*. No document yet.
- **NP Regen**, **Atk Up** (with its NP figure), **Def Dwn**, **Shock**, **NP Seal** are built effects.
- **Heilen's *"within a 3 panel area of himself"*** is `chebyshevRadius: 3`, as Katō Danzō's Tobikato reads a 2
  panel area of herself.
- **The DRCS** are a Resource pool, as EMIYA's Aria and Scáthach's PRS Tokens are (`resources:`).
- **Akafiloga Argrise usage 1** is Balmung's frame: `selfEdgeAdjacent`, an `orientedRect` 5×5 turnable, BA(MAG).
- **Fafnir's Master upkeep** is Raikou's Tenmōkaikai: `anyTurnEnd`, the test before the drain, `selfOrSummonsActed`.
  Its end by hand at any Turn or Round is Tenmōkaikai's `deactivation.window: any`; its 8◈ after it ends is
  `countFrom: deactivation`.
- **Fafnir cannot Block; his Agility Checks double** is Bunyan's, Darius III's and Tamamo Cat's clause (none built).
- **Fafnir's knockback into an occupied panel** is Semiramis's `Knockback`.
- **Galvanism** is a granted skill (`GrantedAbility`).

What he needs that nobody has yet, each built as a generic piece:

- **A timed form that comes back** (DC.2.*). `engine/transform.mjs` takes a form *"for good"*: Gilles's Gigantic
  Horror never returns. Sieg takes Siegfried's whole sheet for X Turns and returns with his own Stats and cooldowns as
  they were. Fafnir is a second form, an Activation NP's, ended by hand or by its Master's Health.
- **A form that is another Servant's sheet** (DC.2.kit): every Skill and the NP of `siegfried`, not overrides on Sieg.
- **A duration rolled on a die** (DC.2.die): 1◈ + ½◈ × d4.
- **A cooldown that adds the Turns a form lasted** (DC.2.cd).
- **A magnitude that falls at the end of the Turn it was given** (KN.decay): Def Dwn (Knacken), 50% then 25%.
- **A growth every 3 full Rounds** (BC.p2): Fran's clause, not built.
- **A cooldown cut on one random member of a category** (BC.p3.spell).
- **A Range that falls to 1 under NP Seal** (BC.p1.seal).
- **A use that ends its own form at the Turn's end and costs a doubled NP price** (AA.2.i).
- **Two usages that lock each other's cooldown** (AA.lock).

**119 Clauses** across 11 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields. `DRCS: 3/3` is not one of them: it is
  the pool's size, read as ST.drcs.
- *"Has the following effects-"*, *"Can be used in 2 different ways, as follows-"*, *"Can be used in 2 different
  methods, as follows-"*, *"As Fafnir, the following effects are applied to him-"*: headings.
- *"(quadrupled)"*: the gloss of AA.2.a's +300%, read there.
- *"~~value is 16~~"*: struck, so superseded by *"increase = 4"* (Nursery Rhyme R1, Arjuna). Read as BC.p2.agi.
- *"A Maiden's Chastity"*, *"The Lightning Tree of Crucifixion"*, *"Incandescent Dragon's Breath・Earth
  Liquefaction"*: the NPs' titles.
- `Items held:`: an empty slot.

## Readings to settle

Asked by grilling, 2026-10-27. Rulings are written here as they land.

**Round 1, ruled 2026-10-27 (the user).** Q7 and Q16 are asked again in round 2 (Q16's answer arrived labelled Q6), Q8
with the quotations.

| # | Ruling |
|---|---|
| 1 | Transformed, he is Siegfried's whole sheet: Saber, Parameters, BA, MOV 5, Range 1, Attributes, Region, Sustainability 2◈ and his seven abilities. Of Sieg's own, Galvanism alone stays (*"in effect even while Sieg is transformed"*) (DC.2.form, DC.2.kit). |
| 2 | He enters at Siegfried's full Health, 1500; Agility and Luck rolled as at summon, by AGI B and LUC E. A Parameter shift Sieg holds carries onto Siegfried's Ranks (DC.2.stats, DC.2.param). |
| 3 | Sieg's own cooldowns are frozen while he is Siegfried. Siegfried's start fresh, all available, every transformation. Effects gained as Siegfried come back with him: one Unit (DC.2.back). |
| 4 | Siegfried brought to 0 is the Unit defeated. The sheet prints no rescue (DC.2.fall). |
| 5 | Usage 1 and usage 2 keep two clocks; the sheet prints a lock where it means one (Akafiloga's note). At 0 DRCS the 25% die is still on the card and consumes nothing (DC.lock, DC.1.empty.die). |
| 6 | Fafnir is Sieg with effects applied, not another sheet: Independent Action, Homunculus, Magecraft's cap and Bridal Chest P1 to P3 all hold (AA.2.passives). |
| 9 | Growth counts full Rounds since his summon, at the end of Rounds 3, 6, 9...: Agility +1 max and current, +4 at most; BA both +10, no cap (BC.p2.*). |
| 10 | NP Seal does only what is printed: Range 1, Galvanism negated. P2 still grows, and NP Seal does not end Fafnir (`engine/seal-ends.mjs` ends two Revised Skills under Skill Seal) (BC.seal). |
| 11 | Blasted Tree: the DU takes 2.5× only. Every other Unit in the 3×3 around it, Sieg excepted and allies included, takes 1.5×, may Evade or Block, not Counter; the DU reacts as usual. The 25% Shock is a die on every Unit hit (BT.area, BT.shock). |
| 12 | Usage 1 as Fafnir costs the NP's Master Health doubled (the older copy's plain word), charged at use. The 40/20 upkeep also charges at that Turn's end: the NP is Active through it (AA.2.i.cost). |
| 13 | Akafiloga usage 1 hits every Unit in the 5×5, allies included, as Balmung (#191 reading 11). The Def Dwn has no printed chance, so it lands, cut only by debuff resistance, and before the damage: its +30% counts on this hit (AA.1.*). |
| 14 | When Fafnir ends, Max Health returns to his own and current Health clamps to it: the system's one rule for a Max Health raise ending (AA.2.a.end). |
| 15 | *"Can Move to any panel"* is within his MOV, occupied panels included; the occupants are pushed (AA.2.e.*). |
| 17 | As Fafnir the three Spells and both Dead Count usages are refused. Normal Attacks, Evade and his Master's Command Spells stay; passives hold (AA.2.h). |
| F | **Added by the user:** Fafnir has a size of 3×3 (AA.2.size). |

**Round 2, ruled 2026-10-27 (the user).** Q22 was asked again in round 3; Q23 revises Q18.

| # | Ruling |
|---|---|
| 7 | Galvanism fires once per MAG hit that deals more than 0. Its Spell is drawn from the Spells on cooldown; with none, that half says "nothing to cut" on the card (BC.p3.*). |
| 8 | Schwert and Dead Count usage 2: any Combat Phase he is in, attacking or attacked, as Karna's identical words (#206 reading 4) and EMIYA's Reinforcement (#208 reading 8): `[ownTurn, combatPhaseStart, defendingPhaseStart]`. Knacken: his own attack's DU only, `[ownTurn, combatPhaseStart]` (KN.combat, SW.when, DC.2.when). |
| 16 | Fafnir's upkeep: "Acted" is Fafnir himself that Turn, the switch included (#194 ruling 2). No NP cost on activation. Health below what is due, or equal to it, ends the NP at that Turn's end and the Master pays nothing (#189 reading 4) (AA.2.g.*). |
| 18 | Growing to 3×3 is Kingprotea's cascade, occupants pushed (`knockBackOccupants`); where it grows from is Q23. Usage 1's 5×5 sits against a whole side of the 3×3, with a shift (AA.2.size, AA.1.area). |
| 19 | When Fafnir ends he shrinks to the centre panel of his 3×3 (the user) (AA.2.size). |
| 20 | Moving as Fafnir pushes with `direction: arrival`, on along his last step, as Kingprotea (AA.2.e.push). |
| 21 | Galvanism while he is Siegfried cuts Balmung's clock and one of Sieg's frozen Spell clocks; the Spell cut survives the return, the one exception to *"the same as they were"* (BC.p3.form). |

**Round 3, ruled 2026-10-27 (the user).** The frontier is empty: every reading is ruled.

| # | Ruling |
|---|---|
| 22 | A 3-Round growth that falls while he is Siegfried goes on Sieg's own figures and shows when he returns; Siegfried's stay his. As Fafnir, +150 and +125 stack on Sieg's grown BA (BC.p2.*). |
| 23 | He grows to 3×3 centred on his own panel, the cascade pushing occupants, so with Q19 he ends where he began. At a board edge with no room, his owner picks a corner, as Kingprotea (AA.2.size). |

## Statblock

- [ ] **ST.name** · True Name: Sieg
- [ ] **ST.class** · Class: Caster (the sheet's folder; no Class line is printed)
- [ ] **ST.region** · Region: Europe
- [ ] **ST.align** · Alignment: Neutral Good
- [ ] **ST.param** · STR E, END E, AGI E, MAG D, LUC B
- [ ] **ST.attr** · Attributes: Male, Servant, [Man], Dragon, Humanoid
- [ ] **ST.hp** · Base Health 500
- [ ] **ST.mov** · MOV 3
- [ ] **ST.range** · Range 3 panels, 1 target
- [ ] **ST.ba** · Base Attack STR 50, MAG 125 (the tables' both: STR E 50, MAG D 125)
- [ ] **ST.sus** · Sustainability: N/A (IA.p1)
- [ ] **ST.drcs** · DRCS 3/3: he is summoned holding three Dragon Revelation Command Spells
- [ ] **ST.items** · Items held: none

## Independent Action — Class Skill, Rank EX *(3 Passives)*

- [ ] **IA.p1** · *"Sustainability does not apply."*: no Sustainability clock runs on him
- [ ] **IA.p2** · *"Master's ZON is increased by 3 panels."*
- [ ] **IA.p3** · *"Cannot be contracted by enemy Casters and Masters."*

## Homunculus — Rank C+ *(Passive)*

- [ ] **HM.str** · All STR damage dealt +5%
- [ ] **HM.mag** · All MAG damage dealt +10%
- [ ] **HM.debuff** · Chance of being inflicted with debuffs −5%

## Man-made Hero (False) — Rank B+ *(Active)*

- [ ] **MH.when** · Used during your Turn
- [ ] **MH.regen** · NP Regen for 1◈ Turns: NP Cooldown −1 Turn at the end of every Turn
- [ ] **MH.hp** · Max HpUp for 1◈ Turns: Max Health +20% of its original value (current Health restored by the same, Appendix A)
- [ ] **MH.cd** · Cooldown 4◈−⅓◈ Turns

## Magecraft — Rank C

- [ ] **MC.allow** · Allows the use of Straße/gehen Spells
- [ ] **MC.once** · Only one Straße/gehen Spell can be used per Turn

## Straße/gehen: Knacken *(Spell)*

- [ ] **KN.range** · Range 3
- [ ] **KN.turn** · Used during your Turn, on an enemy Unit
- [ ] **KN.combat** · Or at the start of a Combat Phase, on the DU, within Range (Q8)
- [ ] **KN.def** · Def Dwn (Knacken) for 1◈ Turns: all damage taken +50%, NP included, on the Turn the Spell is used
- [ ] **KN.decay** · At the end of the Turn the Spell was used, its magnitude falls to 25% for the rest of its 1◈
- [ ] **KN.cd** · Cooldown 3◈ Turns

## Straße/gehen: Schwert *(Spell)*

- [ ] **SW.when** · Used during your Turn or at the start of a Combat Phase (Q8)
- [ ] **SW.atk** · Atk Up on himself for ⅓◈ Turns: all damage dealt +35%; if NP, 25%
- [ ] **SW.cd** · Cooldown 2◈ Turns

## Straße/gehen: Heilen *(Spell)*

- [ ] **HE.when** · Used during your Turn
- [ ] **HE.target** · On an allied Unit within a 3 panel area of himself (`chebyshevRadius: 3`), himself included
- [ ] **HE.ally** · On another Unit: Health +15% of its maximum, Agility +1
- [ ] **HE.self** · On himself: Health +30% of his maximum, Agility +2, instead
- [ ] **HE.cap** · Neither restore passes its maximum
- [ ] **HE.cd** · Cooldown 2◈ Turns

## Dead Count Shapeshifter: Dragon Revelation Command Spells — Rank EX *(Active, 2 usages)*

Usage 1:

- [ ] **DC.1.when** · Used during your Turn
- [ ] **DC.1.np** · NP Cooldown −1◈ Turns
- [ ] **DC.1.dmg** · Dmg Up (Dragon) for ⅓◈ Turns: damage dealt to Dragon Units +100%; if NP, 50%
- [ ] **DC.1.die** · Then a 25% chance of consuming one DRCS
- [ ] **DC.1.cd** · Cooldown 3◈ Turns
- [ ] **DC.1.empty** · Usable with no DRCS left
- [ ] **DC.1.empty.np** · With none left: NP Cooldown −½◈ Turns instead
- [ ] **DC.1.empty.dmg** · With none left: Dmg Up (Dragon) +50%; if NP, 25%, instead
- [ ] **DC.1.empty.die** · With none left: the 25% die consumes nothing (Q5)

Usage 2:

- [ ] **DC.2.when** · Used during your Turn or at the start of a Combat Phase (Q8)
- [ ] **DC.2.req** · Requires 1 DRCS; refused with none
- [ ] **DC.2.pay** · DRCS −1 when used
- [ ] **DC.2.form** · Then Sieg is transformed into Siegfried (Q1)
- [ ] **DC.2.kit** · With all of Siegfried's Skills and NP available and usable
- [ ] **DC.2.npgate** · Balmung still only when the Rounds passed meet the game's conditions
- [ ] **DC.2.die** · Roll a d4: the transformation lasts 1◈ + ½◈ × the roll Turns, the die on the card
- [ ] **DC.2.keep** · He keeps every buff, debuff and other effect he held
- [ ] **DC.2.stats** · New Stats are rolled for the transformed Sieg (Q2)
- [ ] **DC.2.param** · Any + or − to Sieg's Parameters carries over to Siegfried
- [ ] **DC.2.end** · When it ends, he becomes Sieg again
- [ ] **DC.2.back** · His Stats and his Skill, Spell and NP cooldowns are as they were before he transformed (Q3)
- [ ] **DC.2.toll** · Then his Health −100, never below 1
- [ ] **DC.2.cd** · Cooldown 3◈ Turns plus the Turns he was transformed, counted from the end
- [ ] **DC.2.fall** · Siegfried brought to 0 while transformed (Q4)
- [ ] **DC.lock** · Usage 1 and usage 2: one clock or two (Q5)

## Bridal Chest: A Maiden's Chastity — Rank C *(NP, Anti-Unit, 3 Passives)*

- [ ] **BC.p1.str** · At Range 1, his Normal Attacks use BA(STR)
- [ ] **BC.p1.mag** · At Range 2 or more, his Normal Attacks use BA(MAG)
- [ ] **BC.p1.elem** · At Range 2 or more, Lightning damage
- [ ] **BC.p1.shock** · At Range 2 or more, a 10% chance of Shock for 1◈ Turns
- [ ] **BC.p1.seal** · Under NP Seal, his Range is 1 for its duration
- [ ] **BC.p2.when** · After every 3 full Rounds, at the end of the Round (Q9)
- [ ] **BC.p2.agi** · Max and current Agility +1, at most +4 in all
- [ ] **BC.p2.ba** · Base Attack, STR and MAG, +10, no limit
- [ ] **BC.p3.grant** · He gains the Skill 'Galvanism'
- [ ] **BC.p3.when** · Whenever he takes MAG damage (Q7)
- [ ] **BC.p3.np** · His NP Cooldown −⅓◈ Turns
- [ ] **BC.p3.spell** · One random Straße/gehen Spell's Cooldown −⅓◈ Turns (Q7)
- [ ] **BC.p3.form** · In effect while he is Siegfried (Q3)
- [ ] **BC.p3.seal** · Negated while he holds NP Seal
- [ ] **BC.seal** · What else NP Seal does to Bridal Chest (Q10)

## Blasted Tree: The Lightning Tree of Crucifixion — Rank D *(NP, Anti-Army)*

- [ ] **BT.ba** · Base Attack (MAG)
- [ ] **BT.range** · Range 1
- [ ] **BT.du** · 2.5× damage to the DU
- [ ] **BT.area** · Then every Unit within the 3×3 around the DU, Sieg excepted, takes 1.5× (Q11)
- [ ] **BT.react** · Those Units may Evade or Block, not Counter
- [ ] **BT.shock** · A 25% chance of Shock for 2◈ Turns (Q11)
- [ ] **BT.elem** · Lightning damage
- [ ] **BT.cd** · Cooldown 4◈ Turns

## Akafiloga Argrise: Incandescent Dragon's Breath・Earth Liquefaction — Rank EX *(NP, Anti-Unit (Self), 2 usages)*

Usage 1:

- [ ] **AA.1.ba** · Base Attack (MAG)
- [ ] **AA.1.area** · A 5×5 in any non-diagonal direction next to Sieg, every Unit in it (Q13)
- [ ] **AA.1.def** · First Def Dwn for 1◈ Turns on every Unit hit: damage taken +30%
- [ ] **AA.1.dmg** · Then 5× damage
- [ ] **AA.1.elem** · Fire damage
- [ ] **AA.1.cd** · Cooldown 8◈ Turns

Usage 2 (Activation, non-damaging): Sieg transforms into Fafnir.

- [ ] **AA.2.form** · Used, he becomes Fafnir until it ends
- [ ] **AA.2.passives** · His own passives as Fafnir: Independent Action, Homunculus, Magecraft, Bridal Chest (Q6)
- [ ] **AA.2.a** · Max and current Health +300%
- [ ] **AA.2.a.end** · What his Health is when Fafnir ends (Q14)
- [ ] **AA.2.b.ba** · BA(STR) +150, BA(MAG) +125
- [ ] **AA.2.b.na** · Normal Attacks at Range 1 use BA(STR), at Range 2 or more BA(MAG)
- [ ] **AA.2.c.cut** · All damage taken −75%; if NP, 50%
- [ ] **AA.2.c.injury** · No Injury Roll when damaged by an Attack, unless by an NP
- [ ] **AA.2.d.block** · Cannot Block
- [ ] **AA.2.d.agi** · An Agility Check's roll is doubled
- [ ] **AA.2.e.move** · Can Move to any panel (Q15)
- [ ] **AA.2.e.push** · Moving into an occupied panel knocks its Units back 1 panel until the space is free
- [ ] **AA.2.f** · Gains the Large Attribute
- [ ] **AA.2.size** · Fafnir is 3×3 (the user, 2026-10-27; not on the sheet) (Q18)
- [ ] **AA.2.g.acted** · At the end of every Turn it is Active, his Master loses 40 Health if Fafnir Acted
- [ ] **AA.2.g.idle** · And 20 if he did not
- [ ] **AA.2.g.nonp** · Instead of the Master's usual NP Health loss (Q16)
- [ ] **AA.2.g.end** · A Master with less Health than is due: the NP is forcibly ended at that Turn's end, and the Master loses nothing (Q16)
- [ ] **AA.2.h** · Cannot use any Skill or NP but usage 1 while Active (Q17)
- [ ] **AA.2.i.use** · Can use usage 1, its Def Dwn 50%
- [ ] **AA.2.i.end** · The transformation ends at the end of the Turn usage 1 was used
- [ ] **AA.2.i.cost** · His Master loses the NP's Health cost, doubled (Q12)
- [ ] **AA.2.j** · Sieg can end it during his Turn, or at the start or end of any Turn or Round
- [ ] **AA.2.cd** · Cooldown 8◈ Turns after it ends
- [ ] **AA.lock** · Usage 1 cannot be used while usage 2 is on Cooldown, and usage 2 not while usage 1 is
