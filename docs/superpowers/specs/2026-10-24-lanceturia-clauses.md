# Arturia (Lancer) — the Clause list

*Arturia (Lancer)*, Lanceturia, built from `char_orig_sheets/by-class/Lancer/Lanceturia.md`. Started by the user
2026-10-24.

**Audit opened 2026-10-24 (#336).** **Read by hand, line by line.** No generated draft was used. The older copy `char_orig_sheets/Copia de Lanceturia.md`
was compared with it: the by-class copy adds `N.Atk Type: STR, Melee`, the `{R}` and `{S}` delivery tags, and a
`(Turn?)` after "the same Round" in Mana Burst's and Torrent of Light's exclusions. The by-class copy is the one read.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Most of her is other Servants' pieces, and her own new pieces are shared with three sheets
still to come:

- **Magic Resistance B** is `class-magic-resistance` at B (negates up to B, 40%, debuffs 20%), as the table gives it.
- **Riding A** is `class-riding` at A and 3◈, Mannanán's: the three Passives always held, the Active +5 MOV, not a
  buff. Lanceturia (Alter) prints the same Riding word for word.
- **Vivian's Blessing** and **Charisma B** are Arturia (Saber)'s files word for word: `arturia-vivians-blessing`
  (#230 reading 20) and `arturia-charisma` (#230 reading 23).
- **Mana Burst A** is Arturia (Saber)'s without the Evade rider: the combined Base Attack 325 (#230 reading 1), not
  affected by Magic Resistance, the use on Cooldown inside the ZON for 20 of her Master's Health (#230 reading 2).
- **Torrent of Light**'s Dmg Up (Evil) is Yan Qing's `dmgUpEvil`; Dmg Up (Chaotic) is a new effect in
  `dmgUpLawful`'s shape.
- **Wild Hunt**'s Atk Up is Atk Up (Charisma), as Knight of Utopia's (#230 reading 23); NP DmUp is `npDmUp`.
- **Blessings from the Ends of the World** is a `cooldown` phase on every NP (#197 reading 6) and a debuff removal.
- **Invisible Air**'s AGL Up is Hundred-Faced Hassan's `aglUp`; MOV Up is `movUp`; Strike Air's figure that her own
  modifiers do not touch is Nemo's and Arturia (Saber)'s `bypassModifiers.attacker`.
- **Rhongomyniad**'s six criteria are the Count module's `criteria` (#283, #319): counted once per declaration over
  its DUs, read by the multiplier, the Master's cost and the Cooldown. Built for Arthur's Excalibur Proto and pressed
  only on `test-count-criteria`; she is its first Servant. The area within Range is the Range wall (#234).

What she needs that nobody has yet, each a generic piece:

- **An ability used together with another one** (IA.u1.with): Invisible Air's Usage 1 rides a Mana Burst. Lanceturia
  (Alter) prints the same Usage, and Fionn's Mac an Luin and EMIYA's Broken Phantasm read "used together with".
- **Damage divided among the Units affected** (IA.u2.split): Strike Air's 300. Lanceturia (Alter) prints it too.
- **An NP DmUp spent by one NP** (WH.round): NP DmUp (Round), "for 1 time", Overcharge's spend on another effect.
- **A cooldown cut per criterion met** (RH.cdcut): `cooldown.countBonus` with a negative step.
- **The Chaldea Faction of a Grand Order War** (RH.go): Gray's Rhongomyniad and Arthur's Excalibur Proto print the
  same note.
- **An attack's delivery** (ST.na, IA.u2.ranged, RH.special): Melee, `{R}` and `{S}` as the sheet states them, #281.

**100 Clauses** across 10 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Dun Stallion."*: the name of her mount, under Riding. No rule.
- *"Has the following effects-"*, *"Can be used in 2 different ways-"*, *"as follows-"*: headings.
- *"(BA=325)"*, *"(e.g. 5 criteria met, damage=5.5x)"*: glosses of the rule beside them.
- The six quoted lines under the criteria, and the two after the Grand Order note (*"One's comrades-in-arms must be
  courageous."*, *"The battle must save the world."*): the Seals the criteria and the note stand for. Gray's and
  Arthur's sheets print the same two after the same note.
- `Items held:`: an empty slot.

## Readings to settle

Asked by grilling, 2026-10-24. Rulings are written here as they land. None is built.

**Rounds 1 and 2, ruled 2026-10-24 (the user).**

| # | Ruling |
|---|---|
| 1 | Mana Burst and Torrent of Light exclude each other for the **Round** (MB.excl, TL.excl). The older copy says Round, and so does Invisible Air's note on the same sheet. |
| 2 | Usage 1 is offered when she declares a Mana Burst, as one press. AGL Up and MOV Up land on her at the declaration, hit or miss. It works with a Mana Burst used on Cooldown (her Master pays the 20), and never on a Riding Attack (#206) (IA.u1.with). |
| 3 | Usage 1 is held by the NP Round gate, as every NP (IA.u1.with). |
| 4 | Strike Air's 300 is divided by the Units in the area at the declaration, every relation (#191 r11), rounded down; a Unit that later Evades still counts (IA.u2.split). |
| 5 | NP DmUp (Round) has no time limit and holds one charge. The holder's next damaging NP spends it once that NP is over, hit or miss (Overcharge, #260 r8). A second Wild Hunt adds no second charge (WH.round, WH.round.nostack). |
| 6 | The Chaldea Faction is **not built**; the note is recorded only (RH.go). Gray and Arthur print the same note. |
| 7 | When it is built, Chaldea's 4x is the multiplier's start only: the Master's cost stays 30 + 10 per criterion and the Cooldown cut ⅓◈ per criterion (RH.go). |
| 8 | An attack's delivery, Ranged, Melee or Special, is built now as a **universal** system, the stated tag winning over the measured distance (#281) (ST.na, IA.u2.ranged, RH.special). Its shape is round 2. |
| 9 | Rhongomyniad's area names no relation: allies in it are hit and are DUs for all six criteria, "only one DU" included (#191 r11). |
| 10 | Carried: Region England; Mana Burst's 325 (#230 r1), ZON (#230 r2), never on a Riding Attack (#206); Charisma and Vivian's Blessing are the Saber's files (#230 r20, r23); Wild Hunt's Atk Up is Atk Up (Charisma), so her +20 aura is off while she holds it (r23); "all allied Units" includes her; Torrent's Dmg Ups at full value against an NP (#204 r5); Blessings' cut reaches every NP, both Invisible Air usages and Rhongomyniad (#197 r6), and its cleanse leaves Unremovable debuffs; Strike Air bypasses her side only (Nemo), is not MAG (#230 r11) and pays the Rank C NP cost; Rhongomyniad's area is walled by Range 5 (#234), the one-DU and empty-area readings stand (#283), "two Ranks below" is at least two whole grades (#283 Q13), and its stated cost replaces the Rank table. |
| 11 | Delivery is held at three levels, the closest winning: a hit's own tag (Bradamante's *"normal {Ranged} damage… 2.5x {Melee} damage"*), else its Normal Attack band's (Trung Sisters' *"STR, Melee (1pan); MAG, Ranged (2+pan)"*), else the attack's (*"{S} Base Attack (MAG) is used"*, *"N.Atk Type: STR, Melee"*), else the distance (ruling 12). |
| 12 | An attack with no tag is decided by distance, as today: Range at or above the War Rule `rangedMinimumRange` is Ranged, below it Melee. A stated tag always wins (#281). |
| 13 | Special is neither Ranged nor Melee: it passes no rule that asks for either (#281). |
| 14 | Mana Burst, a Riding Attack and a Counter take the Normal Attack's delivery at the distance struck; her Mana Burst is Melee. |
| 15 | One reader, `deliveryOf(attack, board)`, answers for every attack; content asks it as `attack:delivery:ranged\|melee\|special`. The platforms' check (`rules/platforms.mjs#crossLevelLegal`) and Olga's Gravity Manipulation clause 3 move to it. |
| 16 | The attack card names the delivery; the sheet shows the Normal Attack's delivery and each attack's tag. |
| 17 | Delivery is its own branch and PR first, closing #281, with Karna's and Arturia (Saber)'s tags; Arturia (Lancer) follows on a second branch. |

## Statblock

- [x] **ST.name** · True Name: Arturia Pendragon, King of Storms, shown as Arturia (Lancer)
- [x] **ST.class** · Class: Lancer
- [x] **ST.region** · Region: Britain, England
- [x] **ST.align** · Alignment: Lawful Good
- [x] **ST.param** · STR B, END A, AGI A, MAG A, LUC C
- [x] **ST.attr** · Attributes: Female, Servant, [Sky], Saberface, Dragon, King, Humanoid, Round Table
- [x] **ST.hp** · Base Health 1500
- [x] **ST.mov** · MOV 8
- [x] **ST.range** · Range 2 panels, 1 target
- [x] **ST.ba** · Base Attack STR 125, MAG 200
- [x] **ST.na** · Normal Attack: STR, Melee
- [x] **ST.sus** · Sustainability 2◈
- [x] **ST.items** · Items held: none

## Magic Resistance — Rank B *(Class Skill)*

- [x] **MR.1** · Passive 1: MAG damage from a MAG Rank of up to B is negated
- [x] **MR.1.over** · …otherwise MAG damage taken is reduced by 40%
- [x] **MR.1.np** · …also affects NP
- [x] **MR.2** · Passive 2: chance of being inflicted by debuffs −20%
- [x] **MR.2.death** · …also affects Instakill and Death
- [x] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance
- [x] **MR.2.erase** · Erase is completely unaffected
- [x] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced

## Riding — Rank A *(Class Skill)*

- [x] **RI.p1** · Passive 1, Double Move: Move twice in her Turn, once before and once after Attacking; total within MOV
- [x] **RI.p2** · Passive 2, Riding Attack: Attack every Unit in her path while Moving in a straight line, as her Normal Attack in her Turn
- [x] **RI.p2.stop** · …cannot Attack or Move after she has stopped
- [x] **RI.p2.left** · …having Moved already this Turn, the ride is MOV minus the panels already Moved
- [x] **RI.p2.seat** · …can be combined with Passenger Seat
- [x] **RI.p3** · Passive 3, Passenger Seat: her Master Moves with her, ending in the same relative position; counts as one Unit Moving
- [x] **RI.when** · Active: used during her Turn
- [x] **RI.mov** · MOV +5 for this Turn
- [x] **RI.cd** · Cooldown 3◈
- [x] **RI.notbuff** · The MOV Up is not a buff: no buff removal, no buff prevention

## Vivian's Blessing *(Passive)*

- [x] **VB.1** · She receives no negative effects from being within a Waterside area

## Mana Burst — Rank A

- [x] **MB.when** · Used when she performs a Normal Attack
- [x] **MB.ba** · For that Combat Phase her Base Attack is BA(STR) and BA(MAG) combined
- [x] **MB.mr** · Not affected by Magic Resistance
- [x] **MB.oncd** · Usable while on Cooldown, if she is within her Master's ZON…
- [x] **MB.oncd.cost** · …her Master loses 20 Health
- [x] **MB.oncd.noreset** · …and the Cooldown is not reset
- [x] **MB.cd** · Cooldown 3◈
- [x] **MB.excl** · Not on the same Round (Turn?) as Torrent of Light

## Torrent of Light — Rank A+

- [x] **TL.when** · Used during her Turn
- [x] **TL.atk** · Atk Up for ⅓◈: all damage dealt +60%
- [x] **TL.atk.np** · …if NP, 40%
- [x] **TL.chaotic** · Dmg Up (Chaotic) for ⅓◈: all damage dealt to Units with the 'Chaotic' Alignment +50%
- [x] **TL.evil** · Dmg Up (Evil) for ⅓◈: all damage dealt to Units with the 'Evil' Alignment +50%
- [x] **TL.cd** · Cooldown 3◈−⅓◈
- [x] **TL.excl** · Not on the same Round (Turn?) as Mana Burst

## Charisma — Rank B *(Passive)*

- [x] **CH.1** · All damage dealt by other allied Units within 2 panels of her +20, NP included
- [x] **CH.1.self** · …not her own damage (*"other"*)
- [x] **CH.neg.atk** · Negated while she has Atk Up (Charisma)
- [x] **CH.neg.seal** · Negated while she is Skill Sealed

## Wild Hunt — Rank B+

- [x] **WH.when** · Used during her Turn
- [x] **WH.area** · Affects all allied Units within 2 panels of herself
- [x] **WH.atk** · Atk Up for 1◈: all damage dealt +20%
- [x] **WH.atk.np** · …if NP, 10%
- [x] **WH.np** · NP DmUp for 1◈: NP damage dealt +20%
- [x] **WH.round** · NP DmUp (Round) for 1 time to the affected Units with the 'Round Table' Attribute: NP damage dealt +30%
- [x] **WH.round.nostack** · …does not stack
- [x] **WH.cd** · Cooldown 4◈−⅓◈
- [x] **WH.cat** · Categorized as 'Charisma'

## Blessings from the Ends of the World — Rank EX

- [x] **BL.when** · Used during her Turn
- [x] **BL.np** · Reduces NP Cooldown by 2◈
- [x] **BL.cleanse** · Removes all debuffs from herself
- [x] **BL.cd** · Cooldown 3◈

## Invisible Air: Bounded Field of the Wind King — Rank C *(NP, Anti-Unit)*

- [x] **IA.two** · Can be used in 2 different ways
- [x] **IA.u1.with** · Usage 1: used together with Mana Burst
- [x] **IA.u1.agl** · …AGL Up for 1◈: Agility Check rolls −3
- [x] **IA.u1.mov** · …MOV Up for 1◈: MOV +3
- [x] **IA.u1.cd** · …Cooldown 5◈
- [x] **IA.u1.nocost** · …no Master Health cost when used this way
- [x] **IA.u2.ranged** · Usage 2, Strike Air: Hammer of the Wind King, `{R}` Ranged
- [x] **IA.u2.area** · …hits a 3x3 area in any non-diagonal direction next to her
- [x] **IA.u2.dmg** · …deals 300 damage
- [x] **IA.u2.split** · …divided by the number of affected Units, to each affected Unit
- [x] **IA.u2.flat** · …not affected by any damage modifying effects on her
- [x] **IA.u2.wind** · …Wind damage
- [x] **IA.u2.notmag** · …*"Affected by Magic Resistance (deals MAG damage)"* struck out: not MAG damage
- [x] **IA.u2.cd** · …Cooldown 5◈
- [x] **IA.excl** · Usage 1 cannot be used on the same Round as Usage 2, and vice versa
- [x] **IA.clocks** · …but Usage 1 can be used while Usage 2 is on Cooldown, and vice versa

## Rhongomyniad: The Lance That Shines To The Ends Of The Earth — Rank A++ *(NP, Anti-Fortress)*

- [x] **RH.special** · `{S}` Special
- [x] **RH.ba** · Base Attack (MAG)
- [x] **RH.range** · Range 5
- [x] **RH.area** · Hits a 5x5 area within Range
- [x] **RH.pierce** · Has the Pierce effect
- [x] **RH.c1** · Criterion 1: at least two DUs have at least 3 Parameters each equal to or higher than hers
- [x] **RH.c2** · Criterion 2: there is only one DU in the NP area
- [x] **RH.c3** · Criterion 3: at least two DUs have the 'Evil' Alignment
- [x] **RH.c4** · Criterion 4: her Health is less than at least two of the DUs'
- [x] **RH.c5** · Criterion 5: none of the DUs have at least 3 Parameters each two Ranks below hers
- [x] **RH.c6** · Criterion 6: none of the DUs have the 'Elemental' Attribute
- [x] **RH.one** · With Criterion 2 met, Criteria 1, 3, 4 and 5 are met when the single DU meets them
- [x] **RH.dmg** · None met: 3x damage plus 200
- [x] **RH.per** · …+0.5x per criterion met
- [x] **RH.light** · Light damage
- [x] **RH.cost** · None met: her Master loses 30 Health as the NP's cost
- [x] **RH.cost.per** · …10 more per criterion met
- [x] **RH.cdcut** · Then its Cooldown −⅓◈ per criterion met
- [x] **RH.cd** · Cooldown 7◈+⅔◈
- [ ] **RH.go** · Summoned in a Grand Order War on the Chaldea Faction: the multiplier begins at 4x

## Pressed live (2026-10-24/25, Rounds 7–9 on *Vlad Berserker Audit*)

Summoned into the running War with a Master of her own, both Faction 1's, Player1 driving her sheet and the
attack and Skill requests the sheet sends; the GM drove the defenders. Olga Marie and Vlad III (Lancer) stood in
for enemies. Staging between presses: the Turn budget and her Turn record reset, a Noble Phantasm's clock zeroed,
a debuff and a charge placed by hand, and an enemy Master moved into reach.

- **ST.\***: Player1's sheet: Lancer · Lawful Good · England; *Arturia Pendragon, King of Storms*; B A A A C;
  1500; BA 125/200; MOV 8; Range 2, 1 target; Sustainability 2◈; *"Normal Attack: fixed component · STR · Melee"*;
  no Items. Ability cards: Strike Air RANGED, Rhongomyniad SPECIAL.
- **MB.\***, **IA.u1.\***: Mana Burst on Olga at 2: *"Ride the Normal Attack? ... can be used together with this
  Attack"*, taken; *"Invisible Air ... 2 effect(s) applied"*: AGL Up 3 and MOV Up 3, Invisible Air's clock 15,
  her Master's Health untouched. The card *"Mana Burst (A) · Melee"*, stage 1 *"BA(STR) +125, BA(MAG) +200, 325"*,
  stage 11 *"bypassed: attack is not affected by Magic Resistance"*. On its Cooldown (2), on an enemy Master: her
  Master 100 → 80, the clock left at 2, Invisible Air not offered on its own clock.
- **MB.excl**, **TL.excl**: after Mana Burst, Torrent *"sameRoundExclusive"*, the sheet *"Cannot be used on the
  same Round as Mana Burst"*; after Torrent, Mana Burst *"Cannot be used on the same Round as Torrent of Light"*
  (it printed the content id: fixed, a Surprise).
- **TL.\***: Atk Up 60 / NP 40 for one Turn, Dmg Up (Chaotic) 50, Dmg Up (Evil) 50; a later NP's breakdown read
  *"Atk Up +40%"* and *"Dmg Up (Evil) +50%"* on Olga.
- **IA.excl**, **IA.clocks**, **IA.u2.\***: after Usage 1, the sheet *"Strike Air: Cannot be used on the same Round as
  Invisible Air"*; the next Round, Strike Air south over Olga and Vlad: two cards *"Ranged"*, stage 1 *"fixed damage,
  300 ÷ 2 Units +150"*, Olga 150 under her own Atk Up 60%; her Master paid the Rank C cost, 250 → 220.
- **CH.1**, **CH.1.self**, **CH.neg.atk**, **WH.\***: her Master within 2 carried *"Charisma +20"*; after Wild Hunt
  it carried Atk Up (Charisma) and NP DmUp, and the +20 was gone; she held Atk Up (Charisma) 20/10, NP DmUp 20 and
  NP DmUp (Round) 30 with no clock, the Master (no Round Table) none.
- **BL.\***: Invisible Air 12 → 6, Strike Air 15 → 9; a placed Atk Dwn removed.
- **RH.\***: over Olga and Vlad, *"criteria met 3 of 6 (1, 5, 6)"*, her Master 220 → 160, the clock 23 → 20; *"(A++)
  Special"*; stage 3 *"4.5× damage, plus 200"*; the stored attack `pierce: true`, `element: light`. With the charge
  held, both hits read *"NP DmUp (Round)"*, and it was gone once the Phase closed. Over one DU, an enemy Master:
  *"criteria met 3 of 6 (2, 5, 6)"*, the "at least two" criteria judged on him alone (RH.one). Re-pressed after the
  step became `{ticks: ⅓◈, direction: down}` (a signed `-⅓◈` is no ◈ span): the clock 20 again, the Master −60.
- **RI.when**, **RI.mov**, **RI.cd**, **RI.notbuff**: the sheet's switch: Riding ON, MOV 8 → 13, no MOV Up effect,
  Cooldown 9.

Not pressed at first, each a shared file or a unit-tested Clause; pressed after the merge (2026-10-25, Round 9, same
board), once the user asked why 19 were missing (a Surprise):

- **RI.p1**, **RI.p3**: moved 1, Normal Attack on an enemy Master, moved 2 more (3 of 13); her Master carried a panel
  west of her each time; the budget *"Servant moves 1/4, Master moves 0/3"*.
- **RI.p2.left**: after moving 6, the ride reached 7 panels, 13 less 6, where the board allowed 10.
- **RI.p2**, **RI.p2.seat**, **RI.p2.stop**: the ride south through two enemy Masters hit both (`hit: [2]`), her
  Master rode along to the panel beside her; then a move *"This path is 1 panels; 0 remain of MOV 13."* and an attack
  *"this unit has already attacked this turn"*.
- **VB.1**: a Waterside area under her and Karna: hers `movDelta 0, evadeDelta 0`, Water Atk Up and Fire Def Up only;
  Karna's −1 MOV, +1 Evade, Lightning and Ice Def Dwn.
- **CH.neg.seal**: her Master's *"Charisma +20"* gone under a Skill Seal on her, back when it was removed.
- **WH.round.nostack**: a second Wild Hunt: *"NP DmUp (Round) — already present, does not refresh"*, one charge of 30.
- **IA.u2.notmag**: Strike Air on Karna, who holds Magic Resistance: stage 11 *"—"*.
- **MR.1**, **MR.1.np**, **MR.1.over**: Karna, an enemy for the press, Normal Attack staged MAG at MAG B: *"Negated by
  Magic Resistance"*, *"negated: MR B ≥ attack B"*; his Brahmastra, an NP, met it at its own Rank: *"Magic Resistance
  −40% MAG (MR B < attack A+)"*.
- **MR.2**, **MR.2.other**, **MR.2.death**, **MR.2.str**, **MR.2.erase**: through the live engine's landing door
  (`landEffect`, decided and not written), at 100%: Stun from MAG and from STR 80%; Death and Instakill from MAG 80%;
  Instakill from STR and from an Attack not affected by Magic Resistance 100%; Erase 100%.

99 of 100 Pressed or Observed; RH.go is not built (ruling 6).

Three findings, each a Surprise, all fixed: the attack path named an exclusion's partner by id; a charge spent by an
NP whose Phase closed after the charge was gained (now spent only by an NP declared holding it,
`attack:heldAtDeclaration`); a `useSkill` request for a toggle announced *"Switched on"* and switched nothing (now
`useSkill` writes the switch with the price).

