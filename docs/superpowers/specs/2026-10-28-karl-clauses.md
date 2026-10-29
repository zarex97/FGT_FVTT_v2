# Karl de Große (Ruler) — the Clause list

*Karl de Große*, the Ruler, built from `char_orig_sheets/by-class/Ruler/Karl de Große.md`. Started by the user
2026-10-28.

**Audit opened 2026-10-28 (#351).**
**Read by hand, line by line.** No generated draft was used. No older `Copia de` sheet exists to compare with. The
sheet prints no `N.Atk Type` and no `{R}`/`{M}`/`{S}` tags. *Charlemagne* (Saber) is another Servant with his own sheet
and is not read here.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Ruler/Karl de Große"`, each confirmed by
reading:

- **Magic Resistance EX** is `class-magic-resistance` at EX: the table negates all MAG (100%) and cuts debuffs by 30.
- **Charisma B** is the `charisma` template Rama's is (+20 to the other allies, Atk Up (Charisma) 20%, NP 10%, 4◈).
- **True Name Discernment**'s Notebook is `engine/notebook.mjs`, which Appreciation of the Arts writes
  (`LearnsTrueNames`); its NP damage cut is a `DamageModifier` on NP damage taken; its NP DmDwn is the built `npDmDwn`.
- **God's Resolution**'s pass through Stun Immune is Enkidu's `bypassesImmunity` (#232), narrowed to Stun.
- **Ceremonial Reformation** is a field-wide aura (`Aura`, `scope: field`, Medea's Territory Creation) with Atk Up,
  Def Up, `MaxDelta`s and a heal on `actedTurnEnd` (Avalon's, one heal at one Turn's end); its Home Base doubling reads
  the Home Base the board knows (`self:inHomeBase`).
- **Great Emperor Privilege** is Dream of Reunion's heal and NP Cooldown phase, with Atk Up and Def Up on their own dice.
- **Holy King**'s ±25% against an Attribute is Balmung's and Brahmastra's `conditionalMultipliers` and Armor of Fafnir's
  received side (`DamageModifier` with a `target:`/`attacker:` predicate); Dmg Up (Holy) is a named Dmg Up.
- **Joyeuse**'s +100 is `FlatDamage` with an `attack:kind:normal` and Attribute predicate, as Raikou's buff.
- **Carolus Patricius** is a platform (Ch. 27): a 9×9 deck as the Hanging Gardens of Babylon (`countsAsHomeBase`,
  `crossLevel` isolation, `aoePassengerFactor`, `aoeMastersImmune`), Units able to stand under it, with Chaos
  Labyrinthos's field pieces (an escape check, an entry rule, a Health-paid extension, an end on its owner's defeat).
- **Karl Cannons** is an Attack Skill categorized as NP (`categorizedAsNP`), measured from a platform's edge as the
  Golden Hind's swing.
- **Carolus Patricius Auctoritas**'s two methods are Sieg's two-usage NP (`choose`); usage 1's two hits are Dohatsu
  Tenshou's `instances`, each its own Process; usage 2's mount is the Quetzalcoatlus and the Golden Hind (seats for its
  owner and his Master, `replacesRiderAction`, an `upkeep` that `supersedes` the NP's cost, `endWhenUnaffordable`), with
  EMIYA's range-banded Normal Attack and Semiramis's knockback.

What he needs that nobody has yet, each to be built as a generic piece:

- **A Notebook page learned on first sight** (TD.p1): the whole page of an enemy Servant, a Luck Check when it hides.
- **A debuff chance raised per NP the DU holds** (TD.a.chance): a Count of the target's Noble Phantasms.
- **A Stun-only bypass** (GR.ignore): Stun Resist, Stun Immune and Stun-specific cuts ignored, the rest kept.
- **A predicate on an Attribute pair with an exception list** (HK.*): Demonic, or Divine and not Christian, where
  Christian is the list Karl's sheet prints.
- **An entry rule on a platform's deck** (CP.entry): a Parameter at Rank A and a reach of MOV − 2.
- **A platform raised around its owner that carries everyone in its area aboard** (CP.place, CP.aboard).
- **A platform's escape by a Luck Check against its owner** (CP.escape).
- **A ZON waiver for the owner's Attacks while aboard** (CP.zon).
- **A mount that replaces a platform, scattering its deck** (U2.ontop, U2.scatter).
- **A mount's upkeep that depends on whether it Acted** (U2.upkeep).
- **A usage that raises its own Master cost and ends its other usage** (U2.u1.cost, U2.u1.end).
- **Two NPs that lock each other's use while either cools** (CP.lock, U.lock).

**169 Clauses** across 9 Abilities, 3 NPs and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"Can be used in 2 different methods, as follows-"*, *"The Carolus Patricius
  Auctoritas has the following Stats-"*: headings.
- *"Peerless Sword"*, *"Sanctus, Now the Authority is Replenishing the Earth"*: titles.
- `Items held:`: an empty slot.
- *"Christian Servants with Divinity: Saint George, Saint Martha, David"*: the list Holy King reads (HK.christian).

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6): BA(STR) 125 at STR B and BA(MAG) 210 at
MAG A+ agree with the sheet; **Base Health is 1600 at END A+, not the printed 1500** · *"all allied Units"* includes the
user unless the sheet says *"other"* · an effect with no NP figure applies its full value against an NP (#204 reading
5) · a debuff with no printed chance lands, cut only by debuff resistance (#345 ruling 13) · an attack with no delivery
tag is measured by its distance (#281) · NP Seal stops no passive NP unless stated, and Skill Seal no passive Skill
(Appendix A) · a handler on the end of a Turn a Unit Acts heals once at one Turn's end (#198 reading 12, Avalon reading
17) · a Combined BA(STR)/BA(MAG) Normal Attack by distance is EMIYA's range band (`rules/normal-attack.mjs`) · a
platform's passengers scatter to the ground when it goes (Ch. 27) · a Master leaves a platform only carried or knocked
off (Ch. 27).

## Readings to settle

Asked by grilling, 2026-10-28.

**Round 1, ruled 2026-10-29 (the user).** Q9 went against the recommendation and opens Round 2.

| # | Ruling |
|---|---|
| 1 | No Alignment is printed: none. A Good, Evil or Lawful predicate never matches him (ST.align). |
| 2 | He meets an enemy Servant the first time it stands within his Detect, unconcealed: its whole page (True Name, Parameters, Skills, NPs) is copied to his player's Notebook, once per Servant (TD.p1, TD.p1.first). |
| 3 | Hiding is what the engine treats as hiding identity (Presence Concealment, Disguise, Feigned Defeat): one Luck Check against that Servant, a failure final for it (TD.p1.hidden). |
| 4 | NP DmDwn's chance is 100 plus 20 per NP the DU holds, passive NPs included and a Skill only categorized as NP not, then cut by debuff resistance (TD.a.chance). |
| 5 | God's Resolution ignores only what names Stun; general debuff resistance, Magic Resistance among it, Debuff Immune and the volatility immunities still apply (GR.ignore, GR.keep). |
| 6 | Ceremonial Reformation reaches every allied Servant, Master and summon on the board, no platform, while he is alive on the board (CR.who, CR.board). |
| 7 | Max Health +100, Agility +1 and Luck +1 raise the maximums alone; when the aura goes, the current values fall to the maximums (CR.3, CR.4, CR.5). |
| 8 | Great Emperor Privilege's Atk Up and Def Up roll their own 60% dice (GE.dice). |
| 10 | Demonic, for Holy King and Joyeuse, is Demonic, Demonic Beast and Demonic (Oni), as #347 ruling 17 read it on Brahmastra (HK.demonic, JO.p.attr). |
| 11 | Dmg Up (Holy)'s 50% sums with Passive 1's 25%: +75% dealt, −75% taken (HK.a.further). |
| 12 | Carolus Patricius is used on his own Turn (CP.when). |
| 13 | Every Unit on the ground within the 9×9 is moved aboard, any side, Masters and summons included (CP.aboard). |
| 14 | The escape is an action on the Servant's own Turn, once a Turn, in place of its Move: a Luck Check contested against Karl's Luck, 1 Luck spent; a success lands on the nearest free panel just outside (CP.escape). |
| 15 | Enemy Masters and summons aboard cannot escape; allies leave by the platform's own jump (CP.escape.who). |
| 16 | Entry: STR or AGI at A or higher, no die; a qualifying enemy Moves on at MOV − 2 when the nearest deck panel is in reach; allies board freely (CP.entry, CP.entry.ally). |
| 17 | An AoE NP on the Patricius hits every Servant aboard, any side, whatever its own area, Total −50%, Masters untouched; an AoE Skill does not (CP.iso.aoe). |
| 18 | Anti-Fortress or higher is `rules/np-scale.mjs`'s order (CP.iso.antifortress). |
| 19 | Units under the Carolus stand on the ground below, not within it: no isolation and no effects 5 and 7 (CP.under). |
| 20 | The extension is asked at the end of each period; at exactly 200 he may pay, falls to 0 and is defeated, and the Carolus ends at the end of the Turn (CP.ext, CP.ext.floor). |
| 21 | When the Carolus ends, everyone aboard comes down as a platform's passengers scatter, no fall damage (CP.end.scatter). |
| 22 | Karl Cannons is the isolation's exception: its 3×3 within 5 of the deck's edge or under the deck, ground-level Units only, fired wherever Karl stands while the Carolus is Active (KC.under, KC.iso). |
| 23 | Auctoritas is one NP with a clock per usage; either running locks the other usage and Carolus Patricius, whose clock locks both (U.lock, U.cp, CP.lock). |
| 24 | The CPA is 2×2, the Quetzalcoatlus's Giant size (U2.place). |
| 25 | Usage 2 while the Carolus is Active ends the Carolus; everyone aboard but his Master comes down beneath it (U2.cp, U2.scatter). |
| 26 | Riding the CPA, its Move and Normal Attack replace Karl's; he keeps his Skills; the CPA Acted if it Moved or Attacked (U2.acts). |
| 27 | Summoning the CPA costs no Master Health; the upkeep falls at the end of every Turn, any side's, 30 if it Acted, 10 if not (U2.upkeep, U2.upkeep.instead). |
| 28 | Usage 1 from the CPA costs the Master the NP's normal cost × 1.5 + 30 at use, that Turn's upkeep of 30 is paid too, and the NP ends (U2.u1.cost). |
| 29 | The CPA lasts until its upkeep cannot be paid, Usage 1 is fired from it, or it falls to 0; Karl may dismiss it on his Turn (U2.dur). |
| 30 | The CPA at 0 Health ends the NP; Karl and his Master drop to the ground beneath (U2.down). |
| 31 | No Attack reaches Karl or his Master on the CPA, area damage included (U2.safe). |
| 9 | **The user:** a **Christian Attribute** on several Servants, not a list on Karl's element: *"all Marthas, George, All Jeannes (not alter), and Jacques de Molay (Saber)"* (HK.christian). |

**Round 2, ruled 2026-10-29 (the user).** The frontier is empty: every reading is ruled. **35 readings ruled.**

| # | Ruling |
|---|---|
| 32 | **The user:** David too. Christian is nine Servants (HK.christian). |
| 33 | The nine: Saint Martha, Santa Martha, Martha (Summer), George, David, Jeanne (Ruler), Jeanne (Summer), Metatron Jeanne, and Jacques de Molay (Saber) — not Jeanne (Alter), Summer Jalter, Santa Lily or the Foreigner *Molay* (HK.christian). |
| 34 | The list is a roster ruling (Appendix A, `CONTEXT.md`); `christian` is added to each Servant as its audit builds it, the `test-jeanne-d-arc` fixture now. Holy King reads `target:attribute:christian` / `attacker:attribute:christian` (HK.christian). |
| 35 | Jeanne's and Amakusa's Magic Resistance read the same Attribute when they are built. |

## Statblock

- [ ] **ST.name** · True Name: Karl de Große
- [ ] **ST.class** · Class: Ruler (the sheet's folder; no Class line is printed)
- [ ] **ST.region** · Region: France, Italy, Germany, Austria
- [ ] **ST.align** · Alignment: none printed (Q)
- [ ] **ST.param** · STR B, END A+, AGI C, MAG A+, LUC A+
- [ ] **ST.attr** · Attributes: Male, Servant, [Man], Humanoid
- [ ] **ST.hp** · Base Health 1600 (the table at END A+; the sheet prints 1500)
- [ ] **ST.mov** · MOV 5
- [ ] **ST.range** · Range 1 panel, 1 target
- [ ] **ST.ba** · Base Attack STR 125, MAG 210
- [ ] **ST.na** · Normal Attack: STR (no type printed), its delivery measured by distance
- [ ] **ST.sus** · Sustainability 2◈
- [ ] **ST.items** · Items held: none

## Magic Resistance — Class Skill, Rank EX *(Passive 1 + 2)*

- [ ] **MR.1** · All MAG damage taken is negated
- [ ] **MR.1.np** · …including NP
- [ ] **MR.2** · Chance of being inflicted by debuffs is reduced by 30%
- [ ] **MR.2.death** · …also affects Instakill and Death
- [ ] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance
- [ ] **MR.2.erase** · Erase is completely unaffected
- [ ] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced

## True Name Discernment — Class Skill, Rank C *(Passive 1 + 2, Active)*

- [ ] **TD.p1** · *(P1)* When he meets an enemy Servant for the first time, all of its Notebook page is recorded to his player's Notebook (Q)
- [ ] **TD.p1.first** · …the first time only (Q)
- [ ] **TD.p1.enemy** · …an enemy Servant: no ally, no Master, no summon
- [ ] **TD.p1.hidden** · …if it has Skills or effects that hide its information, only on a successful Luck Check (Q)
- [ ] **TD.p2** · *(P2)* All NP damage taken −15%
- [ ] **TD.p2.np** · …NP damage only
- [ ] **TD.a.when** · *(Active)* Used during his Turn
- [ ] **TD.a.range** · Range 2, on an enemy Unit
- [ ] **TD.a.dmdwn** · NP DmDwn for 1◈: NP damage dealt −20%
- [ ] **TD.a.chance** · …its chance +20% for every NP the DU has (Q)
- [ ] **TD.a.cd** · Cooldown 4◈

## God's Resolution — Class Skill, Rank B *(Active)*

- [ ] **GR.when** · Used during his Turn
- [ ] **GR.range** · Range 2, on an enemy Unit
- [ ] **GR.stun** · 80% chance of Stun for 1◈
- [ ] **GR.ignore** · Ignores Stun Resist, Stun Immune and any other effect that specifically reduces the chance of Stun (Q)
- [ ] **GR.keep** · …a cut not specific to Stun still applies (Q)
- [ ] **GR.cd** · Cooldown 4◈

## Charisma — Rank B *(Passive + Active)*

- [ ] **CH.p** · *(Passive)* All damage dealt by other allied Units within a 2 panel area of himself +20
- [ ] **CH.p.np** · …including NP
- [ ] **CH.p.other** · …not his own (*"other"*)
- [ ] **CH.p.off.charisma** · …negated while he has Atk Up (Charisma)
- [ ] **CH.p.off.seal** · …negated while he is inflicted with Skill Seal
- [ ] **CH.when** · *(Active)* Used during his Turn
- [ ] **CH.atk** · Atk Up (Charisma) on himself for 1◈: all damage dealt by allied Units within a 2 panel area +20%
- [ ] **CH.atk.np** · …if NP, +10%
- [ ] **CH.atk.self** · …himself included
- [ ] **CH.cd** · Cooldown 4◈

## Ceremonial Reformation — Rank A *(Passive)*

- [ ] **CR.who** · Affects all allied Units other than himself (Q)
- [ ] **CR.self** · …never himself
- [ ] **CR.board** · …as long as he is on the board (Q)
- [ ] **CR.1** · All damage dealt +10%
- [ ] **CR.1.np** · …including NP
- [ ] **CR.2** · All damage taken −10%
- [ ] **CR.2.np** · …including NP
- [ ] **CR.3** · Max Health +100 (Q)
- [ ] **CR.4** · Max Agility +1
- [ ] **CR.5** · Max Luck +1
- [ ] **CR.6** · At the end of every Turn an allied Unit Acts, its Health restored by 5% of its maximum
- [ ] **CR.6.acted** · …only a Turn it Acts
- [ ] **CR.home** · Effects 1, 2 and 6 doubled while the affected Unit is in its Home Base: 20%, 20%, 10%
- [ ] **CR.home.only** · …3, 4 and 5 not doubled
- [ ] **CR.home.carolus** · …the Carolus counts, as a second Home Base (CP.home)

## Great Emperor Privilege — Rank A+ *(Active)*

- [ ] **GE.when** · Used during his Turn
- [ ] **GE.heal** · Restores his Health by 30% of its maximum
- [ ] **GE.atk** · 60% chance of Atk Up for 1◈: +40%; if NP, +20%
- [ ] **GE.def** · 60% chance of Def Up for 1◈: −40%; if NP, −20%
- [ ] **GE.dice** · …each its own die (Q)
- [ ] **GE.np** · NP Cooldown reduced by ⅔◈
- [ ] **GE.cd** · Cooldown 4◈−⅓◈

## Holy King — Rank A *(Passive + Active)*

- [ ] **HK.p1** · *(P1)* All damage dealt to Demonic Units, or Divine Units without Christian, +25% (Q)
- [ ] **HK.p1.np** · …including NP
- [ ] **HK.p2** · *(P2)* All damage received from Demonic Units, or Divine Units without Christian, −25%
- [ ] **HK.p2.np** · …including NP
- [ ] **HK.christian** · Christian is Saint George, Saint Martha and David, as his sheet lists (Q)
- [ ] **HK.demonic** · Demonic is the Attribute and its kin (Q)
- [ ] **HK.neither** · Against a Unit neither Demonic nor Divine, nothing
- [ ] **HK.a.when** · *(Active)* Used during his Turn
- [ ] **HK.a.dealt** · Dmg Up (Holy) for 1◈: damage dealt to those Units further +50%; if NP, +25%
- [ ] **HK.a.taken** · Dmg Up (Holy) for 1◈: damage taken from those Units further −50%; if NP, −25%
- [ ] **HK.a.further** · …summed with Passive 1 and 2 (Q)
- [ ] **HK.a.cd** · Cooldown 4◈

## Joyeuse: Peerless Sword — Rank A *(NP, Passive)* [Anti-Unit]

- [ ] **JO.rank** · Rank A, Anti-Unit, an NP with a passive only
- [ ] **JO.p** · All Normal Attack damage dealt by Karl to Dark or Demonic Units +100
- [ ] **JO.p.normal** · …Normal Attacks only
- [ ] **JO.p.attr** · …Dark or Demonic only
- [ ] **JO.seal** · NP Seal does not stop it (Appendix A)

## Carolus Patricius — Rank A *(NP, Non-damaging)* [Fortress]

- [ ] **CP.when** · Used during his Turn (Q)
- [ ] **CP.place** · Places the Carolus Patricius token, its middle panel the panel Karl stood on
- [ ] **CP.size** · 9×9 panels
- [ ] **CP.aboard** · All Units within the 9×9 area of Karl are moved onto it (Q)
- [ ] **CP.home** · *(1)* It is a second Home Base for Karl's faction
- [ ] **CP.zon** · *(2)* Karl's Master's ZON is ignored when he Attacks while within it: no damage reduction
- [ ] **CP.zon.only** · …his Attacks only, while within
- [ ] **CP.escape** · *(3)* An enemy Servant leaves only by Succeeding a Luck Check against Karl (Q)
- [ ] **CP.escape.where** · …made anywhere on the Carolus
- [ ] **CP.escape.land** · …on a success, moved to the nearest panel just outside the Carolus
- [ ] **CP.escape.who** · …enemy Servants; others (Q)
- [ ] **CP.entry** · *(4)* An enemy Unit may try to enter: its STR or AGI at Rank A (Q)
- [ ] **CP.entry.reach** · …and the nearest panel of the Carolus within its MOV − 2
- [ ] **CP.entry.mov** · …its MOV −2 while entering
- [ ] **CP.entry.ally** · An allied Unit enters freely (Q)
- [ ] **CP.def** · *(5)* All damage received by allied Units within −15%
- [ ] **CP.def.np** · …including NP
- [ ] **CP.iso** · *(6)* Units within cannot be targeted by Attacks from outside, and vice versa
- [ ] **CP.iso.aoe** · …but the Patricius can be Attacked with an AoE NP: every Servant within takes its damage (Q)
- [ ] **CP.iso.aoe.cut** · …Total Damage received −50%
- [ ] **CP.iso.aoe.master** · …Masters undamaged and unaffected by its other effects
- [ ] **CP.iso.antifortress** · An Anti-Fortress or higher NP so used ends the Carolus at the end of the Combat Process (Q)
- [ ] **CP.atk** · *(7)* All damage dealt by allied Units within +15%
- [ ] **CP.atk.np** · …except Noble Phantasms
- [ ] **CP.under** · *(8)* Units may Move under the Carolus: onto its panels, the token on top of them (Q)
- [ ] **CP.dur** · *(9)* Lasts 2◈ Turns
- [ ] **CP.ext** · …after the initial period, Karl may extend it by 1◈ for 200 of his Health (Q)
- [ ] **CP.ext.floor** · …not while his Health is less than 200 (Q)
- [ ] **CP.ext.repeat** · …again and again
- [ ] **CP.end** · *(10)* Forcefully ended at the end of the Turn if Karl or his Master is defeated
- [ ] **CP.lock** · Cannot be used while Carolus Patricius Auctoritas is on Cooldown
- [ ] **CP.cd** · Cooldown 7◈ after the NP ends
- [ ] **CP.end.scatter** · When it ends, those aboard come down (Q)

## Carolus Patricius: Karl Cannons *(Attack Skill)*

- [ ] **KC.only** · Only usable while Carolus Patricius is Active
- [ ] **KC.range** · Range 5, measured from the edge of the Carolus
- [ ] **KC.under** · …and the area directly under the Carolus (Q)
- [ ] **KC.mag** · Base Attack (MAG)
- [ ] **KC.area** · Hits a 3×3 area within Range
- [ ] **KC.dmg** · 2x damage
- [ ] **KC.np** · Categorized as Noble Phantasm
- [ ] **KC.iso** · …fires across the Carolus's isolation (Q)
- [ ] **KC.atk** · An Attack Skill: spends his Attack
- [ ] **KC.cd** · Cooldown 2◈

## Carolus Patricius Auctoritas — Rank A++ *(NP)* [Anti-Army/Anti-Fortress/Fortress]

- [ ] **U.rank** · Rank A++, Anti-Army, Anti-Fortress and Fortress
- [ ] **U.two** · Two methods, one chosen per use
- [ ] **U.lock** · Usage 1 cannot be used while Usage 2 is on Cooldown, and the reverse (Q)
- [ ] **U.cp** · Cannot be used while Carolus Patricius is on Cooldown

### Usage 1

- [ ] **U1.range** · Range 7
- [ ] **U1.area** · Hits a 5×5 area within Range
- [ ] **U1.str** · First 2x damage plus 100 with BA(STR)
- [ ] **U1.mag** · Then 2x damage plus 100 with BA(MAG)
- [ ] **U1.react** · Each hit separately Blocked and/or Evaded
- [ ] **U1.notcp** · Cannot be used while Carolus Patricius is Active
- [ ] **U1.cd** · Cooldown 7◈+⅔◈

### Usage 2

- [ ] **U2.when** · Used during his Turn
- [ ] **U2.place** · Summons the CPA on the panel he stood on (Q: its size)
- [ ] **U2.ontop** · …Karl moves onto it
- [ ] **U2.cp** · May be used while Carolus Patricius is Active (Q)
- [ ] **U2.scatter** · …then every Unit on the Carolus but his Master is scattered below the Carolus
- [ ] **U2.master** · …his Master is placed with Karl on the CPA
- [ ] **U2.hp** · CPA Health 3000
- [ ] **U2.agi** · CPA Agility 8
- [ ] **U2.luc** · CPA Luck shared with Karl's
- [ ] **U2.mov** · CPA MOV 3
- [ ] **U2.range** · CPA Range 4 panels, 1 target
- [ ] **U2.ba** · CPA Base Attack STR 200, MAG 200
- [ ] **U2.attr** · CPA Attributes: Giant, Mechanical
- [ ] **U2.na** · CPA Normal Attack: BA(STR) at a Range of 1 to 2, BA(MAG) at 3 or more
- [ ] **U2.move** · CPA may Move onto any panel; Units on it are knocked back 1 panel until it can stand there
- [ ] **U2.kb** · CPA's Normal Attacks at a Range of 1 to 2 knock the DU back 1 panel
- [ ] **U2.safe** · Karl and his Master cannot be Attacked while on the CPA
- [ ] **U2.acts** · Who acts: the CPA, Karl, or both (Q)
- [ ] **U2.upkeep** · At the end of every Turn it is Active, his Master loses 30 Health if the CPA Acted, 10 if not
- [ ] **U2.upkeep.instead** · …instead of the NP's normal Master Health loss (Q)
- [ ] **U2.upkeep.end** · If the Master's Health is at or below that loss, the NP ends at the end of the Turn and he loses nothing
- [ ] **U2.u1** · While Usage 2 is Active, Usage 1 may be used from the CPA
- [ ] **U2.u1.range** · …its Range from the CPA's edge
- [ ] **U2.u1.ba** · …the CPA's Base Attack
- [ ] **U2.u1.cost** · …his Master's NP Health loss +50% plus 30 (Q)
- [ ] **U2.u1.end** · …and the NP ends at the end of the Turn
- [ ] **U2.dur** · Lasts until it ends (Q)
- [ ] **U2.down** · The CPA at 0 Health (Q)
- [ ] **U2.cd** · Cooldown 7◈+⅔◈ after it ends
