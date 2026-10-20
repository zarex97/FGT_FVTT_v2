# Gilles de Rais (Saber) — the Clause list

*Gilles de Rais* on his sheet: the Saber form of the Caster on `Copia de Gilles.md`. Named by the user
2026-10-20.

**Draft, 2026-10-20; every reading ruled.** Built by hand, line by line, from `char_orig_sheets/Copia de Gilles de Rais.md`.
No generated draft was used.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**152 Clauses** across 12 Abilities, the statblock and three War Rules (137 from the sheet, 15 from reading 3i).

**Unbuilt.** Nothing of his is in `packs/_source`. Both Gilles sheets are new to the roster; the Caster
is set apart, as the Caster *Anastasia* was (#258 reading 1).

**Built to be reused.** Most of him is already other Servants' pieces:

- **Magic Resistance B** is the shared class skill (`class-magic-resistance`): the tables give 40% and
  20%, as printed (B §B.3).
- **Riding B** is `class-riding-unlocks` (Karna, Raikou): the Active gates all three passives *"on this
  Turn"*. The tables give +4 MOV and 2◈, as printed.
- **Mad Enhancement EX** is `class-mad-enhancement` at EX: 75/30, +100 halved for BA(MAG) and drain 30
  match the tables Penthesilea and Raikou verified. Clause 1 is Heracles's shape: the floor, no forced
  deactivation. Clauses 4, 6 and 7 are the template's.
- **Summoning: Horrors** is Medea's *Dragon Tooth Warriors* (`summon` phase, `perUnit` cooldown from
  `summonCount`, 5×5 placement, `chooser: owner`). Nursery's *Trump Soldiers* supplies the Unit-side
  rules: `countsTowardBudget: false`, `actsOncePerTurn`, and the guard (`TargetabilityModifier`,
  `recipientRoles: [summoner, summonerMaster]`). `detect` is a summon's override (Ch. 05).
- **The split's exemption** (*"Light damage or Attack that deals extra damage to 'Dark' or
  'Outsider'"*) is the Kagome Spirits' predicate: `attack:element:light`, `attack:vsAttribute:<x>`.
- **"Cannot be used on the same Turn as"** is `sameTurnExclusive` (Arjuna, Arturia).
- **Alignment-gated recipients** use the alignment options built for Yan Qing
  (`target:order:lawful`, `target:morality:good`, #253).
- **"Anti-Army" NPs** are `attack:tag:antiArmy`.
- **NP Regen**, **Crit DmUp**, **NP DmUp**, **Atk Up**, **Def Dwn**, **S.Crit Up** (an aura its holder
  carries, #132), **Area CritUp** and **Dmg Boost** are existing effects.
- **Heal Up** is `HealingReceived` (Heal Dwn's element) with a positive value.
- **Golden Rule** is Proto Gil's passive (`OnEvent damageDealt`, `attack:crit`, `CooldownDelta scope:
  np`) plus a chance. Siegfried's C- (55%) is the same sentence, so it becomes one Rank-keyed shared
  skill, as Fae Contract did (#258 reading 10).

What he needs that nobody has yet, each a generic piece:

- **A mode only an ability may switch on, and never off.** Mad Enhancement *"cannot be
  used/Activated unless specific conditions are met"*: Prelati's Encouragement's die is the only
  switch.
- **A chance that grows with each use** (Prelati's: 15%, +15% per later use, at most 90%). It needs a
  per-War use count on the ability.
- **An Alignment changed by a mode** (Lawful Good → Neutral Evil while Mad Enhancement is Active).
  Every reader of `unit.alignment` must see it.
- **Mad Enhancement clause 5, his own shape.** *"ME cannot be deactivated and its STN is reduced by 1
  additional Turn at the end of every Turn."* The −2◈ is hard-coded in `rules/relationships.mjs`, and
  the clock ticks in `engine/scheduler.mjs#checkRemovals`. Both become a parameter of the template.
- **Overcharge** (Appendix A, catalogued, unbuilt): *"the magnitude of all non-damage effects of NP are
  increased by 20%"*, 1 time. `EffectMagnitudeScale` is the nearest element.
- **NP DmUp (nonAA)**, an NP DmUp gated `not:attack:tag:antiArmy`.
- **A named Servant on the field** (*"an allied non-Alter Jeanne d'Arc"*, *"Jeanne d'Arc Alter"*). No
  Jeanne sheet is in the repo. `self:contentId:` names one build; this names a Heroic Spirit (Q6).
- **A summon that splits on defeat**: a coin or a die, then new summons where it fell. Today a summon
  phase runs only from an ability's `phases`.
- **A buff that reaches its holder's summons** (*"all damage dealt by Gilles and his Horrors"*).
- **A Spell usable as a Counter that summons.** `answersACounter` takes an Attack; a summon that
  *"counts as Gilles' Attack"* must classify as one, and a summoning Counter catches nobody.

### Already ruled

**Elsewhere:** Max Health derives from END and Base Attack from the STR/MAG tables, and the table wins
(§46.6, quoting the rulebook): Max Health 1000 at END C and BA(MAG) 125 at MAG D, as printed, and
**BA(STR) 125 at STR B, not the printed 175** (175 is no STR Rank's figure; it is MAG B's) · durations
count from the Turn after the Turn of use (#187 reading 5) · *"within a N panel area of himself"*
includes himself unless the sheet says *"except"* (S.Crit Up #132; Quetzalcoatl writes *"except
herself"* when she means it) · S.Crit Up *"applied to all allied Units within 2"* is an aura on its
user that an ally walking in gets (#132; Anastasia FS.3) · Crit DmUp and Crit Up reach an NP only
when an NP figure is stated (#131) · *"NP Cooldown"* naming no NP reaches every NP (#197 reading 6)
· two different Atk Ups stack (#230 reading 4) · an NP used on its owner's own Turn consumes his
Attack, and a non-damaging NP may be a Counter (§46.4-AZ; Semiramis) · a Counter is an Act, stamps
`acted` and not `attacked` (#107) · *"directly next to"* is Chebyshev 1 (Castor's
`self:withinOfPartner:1`) · Riding's Active gates its three passives to that Turn (#206) · the
Trump Soldiers' guard: *"cannot Attack Nursery or her Master if any Trump Soldiers are directly next
to them"* (#247) · Heal Up does not reach Home Base or Command Spell healing unless stated
(Appendix A) · a mode's state locks as it stands when its Master dies (Ch. 32) · a sheet binds only
its owner.

### Readings to settle

Asked by grilling, 2026-10-20. Rulings are written here as they land.

**Round 1, 2026-10-20:** readings 1 and 2 ruled as recommended; reading 3 opened the Classic and Revised War Rules (3a to 3g).
**Round 2, 2026-10-20:** 3a to 3i ruled, 3c's default Revised; readings 4 to 16 ruled, 7 and 8 as recommended, 9 the other way.
**Round 3, 2026-10-20:** 3j ruled a reading not offered, which corrected 3d; 9a as recommended.

1. **His name and ids** (`SB`). You named him *Gilles de Rais (Saber)*. The Caster on `Copia de
   Gilles.md` prints the same two Spells word for word. **Recommended:** the Servant `gilles-saber`,
   his abilities `gilles-saber-*`; the plain `gilles` left to the Caster; the two Spells and two
   summons authored once under neutral ids (`summoning-horrors`, `summoning-elder-horror`, `horror`,
   `elder-horror`) for both sheets. **Ruled 2026-10-20:** as recommended.
2. **Mad Enhancement's switch** (`ME.gate`, `ME.5.lock`). *"Cannot be used/Activated unless specific
   conditions are met"*, and Prelati's *"permanently activating"* it. **Recommended:** it starts off;
   no button turns it on or off; only Prelati's die turns it on, and nothing turns it off for the
   rest of the War. The template's 2◈ toggle lock never applies. **Ruled 2026-10-20:** as recommended.
3. **Clause 5** (`ME.5.stn`). The template, from five other sheets: *"Sustainability is reduced by 2◈
   if its Master is defeated while ME is Active."* His: *"ME cannot be deactivated and its STN is
   reduced by 1 additional Turn at the end of every Turn."* **Recommended:** his replaces the
   template's. No 2◈ is charged at the death. While he is Free and Mad Enhancement is Active, his clock
   loses 2 at each Turn's end instead of 1.
   **Ruled 2026-10-20, a reading not offered:** his clause 5 is the **Revised** Mad Enhancement, a new
   wording the game's author is testing; Divinity (Cú Chulainn's sheet, already Arjuna's and Proto Gil's)
   and Presence Concealment (Sasaki's, already Hundred-Faced Hassan's) have one too. A War Rule picks
   which text every bearer follows (`CONTEXT.md`, *Classic and Revised*):
   - **3a.** Three War Rules, one per Skill.
   - **3b.** Every bearer follows the War's pick, whatever its sheet prints.
   - **3c.** Three choices: *Classic*, *Revised*, *As printed* (each sheet's own text). The default is
     **Revised**.
   - **3d.** Revised is: Mad Enhancement clause 5 (the mode locks when the Master falls, and
     Sustainability loses 1 more at every Turn's end; no 2◈ at the death) and clause 7's Skill Seal
     ending it at once (*Corrected by 3j:* Darius III's sheet prints the Revised clause 7, *"if this Unit
     is inflicted with Skill Seal while ME is Active, it is immediately deactivated"*), clause 1 staying
     each sheet's own; Divinity's flat bonus dealt as Fixed
     Divine Damage, outside the Injury count; Presence Concealment ended at once by Skill Seal.
   - **3e.** The three rules lock once the War starts.
   - **3f.** The sheet and the card print the text the War picked.
   - **3g.** *Classic* and *Revised* are glossary terms.
   - **3h.** A War started before these rules existed reads *As printed*, and plays on as it began.
   - **3i.** This issue carries the three War Rules' Clauses (`WR.*`): each Revised and each Classic piece
     pressed live, Mad Enhancement on Gilles, Presence Concealment on Jack, Divinity on Heracles. Closed
     audits stay closed.
   - **3j.** Gilles's *"cannot be negated once Activated"* means **unsealable**: Skill Seal does not end
     his Mad Enhancement. It is his sheet's own sentence against Revised clause 7, and like clause 1 it
     stays his under every pick (under Classic, Skill Seal ends nobody's). A generic parameter of the
     template, not a Gilles branch. Darius III (not in the roster) prints the plain Revised clause.
4. **His Alignment while Mad Enhancement is Active** (`ME.align`). **Recommended:** Neutral Evil for
   every reader: Yan Qing's Dmg Up (Lawful) stops reaching him, Dmg Up (Evil) starts; his own
   Triumphal Return's Lawful and Good clauses stop reaching him; By the Holy Maiden's Side's *"Evil"*
   Heal Up reaches him. **Ruled 2026-10-20:** as recommended.
5. **"All Units" in By the Holy Maiden's Side** (`HM.n2`, `HM.n3`, `HM.m2`, `HM.m3`). Triumphal Return
   says *"allied Units"*; this Skill says *"all Units with the 'Lawful' Alignment"*. **Recommended:**
   all Units, enemies included, himself included. So while Lawful he holds two NP Regens, effect 1's
   and effect 2's, and his NP clock drops 2 per Turn. **Ruled 2026-10-20:** as recommended.
6. **Who is "Jeanne d'Arc"** (`TR.p.*`, `HM.n4.*`, `HM.m4.*`). No Jeanne sheet is in the repo.
   **Recommended:** a generic `<side>:trueName:<slug>` option. A non-Alter Jeanne is any allied
   Servant whose True Name is *Jeanne d'Arc*; the Alter's True Name is *Jeanne d'Arc (Alter)*. Pressed
   with a staged stand-in: a world-only Servant given that True Name. **Ruled 2026-10-20:** as recommended.
7. **Triumphal Return beside Jeanne** (`TR.p.jeanne`). *"Effects 1 to 4 affect all allied Units
   within a 3 panel area of himself instead."* Effect 4 asks for a [Star] ally *"within a 2 panel
   area"* too. **Recommended:** both become 3: the recipients and the [Star] search. Effect 5 stays 2. **Ruled 2026-10-20:** as recommended.
8. **Overcharge** (`TR.3*`). *"The magnitude of all non-damage effects of NP are increased by 20%"*,
   1 time, for 1◈. **Recommended:** the holder's next NP multiplies each numeric effect magnitude by
   1.2, rounded down; never its damage, a chance or a duration. That NP consumes it, even with nothing
   to raise. Unused, it ends after 1◈. **Ruled 2026-10-20:** as recommended.
9. **"[Anti-Army] Noble Phantasms"** (`MT.p.*`, `MT.a.aa`). **Recommended:** the tag exactly, not
   *"Anti-Army or higher"*; the corpus says *"or higher"* when it means the ladder. The Active's
   *"other than [Anti-Army]"* is every NP not tagged Anti-Army. **Ruled 2026-10-20, the other reading:** Anti-Army **or higher**
   (`attack:npScale:gte:antiArmy`).
   **9a. Ruled 2026-10-20:** the Active's *"other than [Anti-Army]"* is the exact complement: an NP below
   Anti-Army, or with no scale tag. An Anti-Fortress NP takes the Passive's +25 and never the Active's +15.
10. **Saint War Order's Def Dwn on himself** (`SW.3`). *"Inflicts Def Dwn on himself."* His own Magic
    Resistance cuts debuff chances by 20%. **Recommended:** it lands with no roll, as Anastasia's
    Watermelon Blind (#258 reading 6). **Ruled 2026-10-20:** as recommended.
11. **Prelati's Spellbook** (`PS.*`, `HO.book`, `EH.book`). The Saber's prints no Active and no
    cooldown; the Spells say *"Cannot be used if Prelati's Spellbook is on Cooldown"*, the Caster's
    sentence. **Recommended:** it is not used. While Mad Enhancement is Active both Spells are
    offered. *"On Cooldown"* never holds for him; the Caster's Active will make it hold for the
    Caster. **Ruled 2026-10-20:** as recommended.
12. **How a Horror splits** (`HO.split*`, `EH.split*`). **Recommended:** the new Horrors appear one on
    the fallen Unit's panel and the rest on free panels next to it, placed by Gilles's owner. They
    are new Horrors: they may split in turn, and they may act if the Turn allows. A defeat by no
    Attack (a Poison tick) still splits. The Spell's cooldown does not change. **Ruled 2026-10-20:** as recommended.
13. **"His Horrors"** (`HM.m4.horrors`). **Recommended:** Horrors and Elder Horrors alike. **Ruled 2026-10-20:** as recommended.
14. **His summons when he falls** (`HO.leave`, `EH.leave`). The sheet is silent. **Recommended:** they
    go with him, as Medea's Dragon Tooth Warriors (#193 reading 15). **Ruled 2026-10-20:** as recommended.
15. **"Dark (Outsider)"** (`HO.attr`, `EH.attr`). **Recommended:** two Attributes, `dark` and
    `outsider`. The split's own exemption names them apart. **Ruled 2026-10-20:** as recommended.
16. **Vital Spot** (`SB.attr`). Chiron's sheet lists *"Gilles, Prelati (with the Spellbook)"* among
    Units with the 'Vital Spot' Attribute. **Recommended:** not the Saber. His sheet prints none and
    has no weak point; it is the Caster's, whose Spellbook is one. **Ruled 2026-10-20:** as recommended.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Has the following effects-"*, *"Gilles gains the following effects-"* — headings.
- *"ME not Activated"*, *"ME Activated"* — headings; their condition is `HM.mode`.
- `Items held:` — an empty slot.
- *"(Gilles)"* before each ability's name — the sheet's ownership mark.

## Statblock

- [ ] **SB** · True Name Gilles de Rais, Region France, STR B, END C, AGI C, MAG D, LUC D
- [ ] **SB.class** · Saber, by his class skills (Magic Resistance, Riding); the sheet names none
- [ ] **SB.align** · Lawful Good while Mad Enhancement is not Active
- [ ] **SB.attr** · Attributes Male, Servant, [Man], Humanoid (reading 16)
- [ ] **SB.hp** · Base Health 1000
- [ ] **SB.mov** · MOV 4
- [ ] **SB.range** · Range 1 panel, 1 target
- [ ] **SB.ba** · BA(STR) 125 by the table, printed 175; BA(MAG) 125
- [ ] **SB.sus** · Sustainability 2◈

## Magic Resistance — Class Skill, Rank B *(Passive)*

- [ ] **MR.neg** · *(P1)* MAG damage from a MAG Rank of up to B is negated
- [ ] **MR.red** · …otherwise MAG damage taken −40%
- [ ] **MR.np** · …also NP
- [ ] **MR.debuff** · *(P2)* Chance of being inflicted by debuffs −20%
- [ ] **MR.ik** · …also Instakill and Death, unless from an Attack, Attack Skill, Spell or NP dealing STR damage or not affected by Magic Resistance
- [ ] **MR.erase** · Erase is unaffected
- [ ] **MR.note** · Other debuffs from a STR or not-affected Attack are still reduced

## Riding — Class Skill, Rank B *(Active + 3 Passives)*

- [ ] **RD.when** · *(Active)* Used during his Turn
- [ ] **RD.mov** · MOV +4 for this Turn
- [ ] **RD.notbuff** · …not a buff: not removed by buff removal, not prevented by an effect that prevents buffs
- [ ] **RD.unlock** · Double Move, Riding Attack and Passenger Seat usable on this Turn only
- [ ] **RD.dm** · *(P1)* Double Move: Move twice, once before and once after Attacking; total ≤ his MOV
- [ ] **RD.ra** · *(P2)* Riding Attack: Attack every Unit in his path moving in a straight line, as his Normal Attack
- [ ] **RD.ra.stop** · …cannot Attack or Move after he has stopped
- [ ] **RD.ra.left** · …if he already Moved, its panels are his MOV minus the panels Moved
- [ ] **RD.ps** · *(P3)* Passenger Seat: his Master Moves with him, same orientation and position after; counts as Moving one Unit
- [ ] **RD.ps.ra** · Passenger Seat and Riding Attack combine
- [ ] **RD.cd** · Cooldown 2◈

## Mad Enhancement — Class Skill, Rank EX *(Mode)*

- [ ] **ME.gate** · Cannot be Activated except through Prelati's Encouragement (reading 2)
- [ ] **ME.align** · On Activation his Alignment becomes Neutral Evil (reading 4)
- [ ] **ME.1** · *1.* His Master loses 30 Health at the end of every Turn he Acts
- [ ] **ME.1.floor** · …the Master's Health cannot drop below 30 this way
- [ ] **ME.2** · *2.* All damage taken −75%
- [ ] **ME.2.np** · …if NP, −30%
- [ ] **ME.3** · *3.* All damage dealt +100%, including NP
- [ ] **ME.3.mag** · …halved for Attacks using BA(MAG)
- [ ] **ME.4.mov** · *4.* MOV +2
- [ ] **ME.4.range** · …Range +1
- [ ] **ME.4.zon** · …his Master's ZON +2 panels
- [ ] **ME.5.lock** · *5.* His Master defeated while Active: Mad Enhancement cannot be deactivated
- [ ] **ME.5.stn** · …and his Sustainability loses 1 additional Turn at the end of every Turn (reading 3)
- [ ] **ME.6** · *6.* He can only Evade with Evade−
- [ ] **ME.7** · *7.* Neither buff nor debuff, Unremovable
- [ ] **ME.7.seal** · …cannot be negated once Activated: Skill Seal does not end it (reading 3j)

## Military Tactics — Rank C *(Passive + Active)*

- [ ] **MT.p.taken** · *(Passive)* Allied Units within 2 of him: damage received from [Anti-Army] or higher NPs −25% (reading 9)
- [ ] **MT.p.dealt** · …damage dealt by [Anti-Army] or higher NPs +25%
- [ ] **MT.p.reach** · …himself included; an ally 3 away is not reached; one walking in is
- [ ] **MT.p.scale** · …an Anti-Fortress NP counts; an Anti-Unit NP does not
- [ ] **MT.a.when** · *(Active)* Used during his Turn
- [ ] **MT.a** · NP DmUp (nonAA) for ⅓◈ to allied Units within 2: NP damage +15%
- [ ] **MT.a.aa** · …not for an [Anti-Army] or higher NP; an Anti-Unit NP and one with no scale tag are reached (reading 9a)
- [ ] **MT.cd** · Cooldown 2◈
- [ ] **MT.excl** · Cannot be used on the same Turn as Triumphal Return

## Triumphal Return of the Holy Maiden — Rank EX *(Active + Passive)*

- [ ] **TR.when** · Used during his Turn
- [ ] **TR.1** · *1.* NP DmUp for ⅓◈ to allied Units within 2: NP damage +15%
- [ ] **TR.2** · *2.* Crit DmUp for 1◈ to allied Lawful Units within 2: Crit Damage +50%
- [ ] **TR.2.align** · …not to an ally of another Order
- [ ] **TR.3** · *3.* Overcharge for 1◈, 1 time, to allied Good Units within 2: non-damage NP effect magnitudes +20% (reading 8)
- [ ] **TR.3.align** · …not to an ally of another Morality
- [ ] **TR.3.once** · …consumed by one NP
- [ ] **TR.4** · *4.* An allied [Star] Unit within 2: S.Crit Up for ⅓◈ to allied Units within 2, Crit Chance +10%
- [ ] **TR.4.none** · …no [Star] ally within 2: no S.Crit Up
- [ ] **TR.5** · *5.* Area CritUp for 1◈ on himself: allied Units within 2, Crit Chance +5%
- [ ] **TR.cd** · Cooldown 4◈
- [ ] **TR.excl** · Cannot be used on the same Turn as Military Tactics
- [ ] **TR.p.jeanne** · *(Passive)* An allied non-Alter Jeanne d'Arc on the field: effects 1 to 4 reach 3 panels (readings 6, 7)
- [ ] **TR.p.alter** · …once Mad Enhancement is Active, only an allied Jeanne d'Arc Alter does this
- [ ] **TR.p.5** · …effect 5 stays at 2

## Golden Rule — Rank B *(Passive)*

- [ ] **GR** · Each Crit he performs: 80% chance his NP Cooldown −1 Turn
- [ ] **GR.roll** · …the die is on the card, a miss included
- [ ] **GR.np** · …every NP on Cooldown

## By the Holy Maiden's Side — Rank A *(Active)*

- [ ] **HM.when** · Used during his Turn
- [ ] **HM.mode** · Its effects depend on whether Mad Enhancement is Active
- [ ] **HM.n1** · *(ME not Active) 1.* NP Regen for 1◈ on himself: NP Cooldown −1 each Turn's end
- [ ] **HM.n2** · *2.* NP Regen for 1◈ to all Lawful Units within 2 (reading 5)
- [ ] **HM.n3** · *3.* Heal Up for 1◈ to all Good Units within 2: Health restored +80%
- [ ] **HM.n4.field** · *4.* An allied non-Alter Jeanne d'Arc on the field: his NP Cooldown −2◈
- [ ] **HM.n4.near** · …within 3 of him: −4◈ instead
- [ ] **HM.n4.adj** · …directly next to him: −6◈ instead
- [ ] **HM.m1** · *(ME Active) 1.* NP Regen for 1◈ on himself
- [ ] **HM.m2** · *2.* NP Regen for 1◈ to all Chaotic Units within 2
- [ ] **HM.m3** · *3.* Heal Up for 1◈ to all Evil Units within 2: Health restored +80%
- [ ] **HM.m4.field** · *4.* An allied Jeanne d'Arc Alter on the field: Dmg Boost (Gilles) for 1◈ on himself, damage dealt +30
- [ ] **HM.m4.near** · …within 3 of him: +60 instead
- [ ] **HM.m4.adj** · …directly next to him: +90 instead
- [ ] **HM.m4.horrors** · …his Horrors' damage dealt too (reading 13)
- [ ] **HM.cd** · Cooldown 4◈

## Prelati's Encouragement — Rank B *(Active + Passive)*

- [ ] **PE.when** · Used during his Turn
- [ ] **PE.atk** · Atk Up for 1◈ on himself: damage dealt +50%
- [ ] **PE.atk.np** · …if NP, +30%
- [ ] **PE.cd** · Cooldown 4◈
- [ ] **PE.me** · *(Passive)* On use: 15% chance Mad Enhancement is Activated for good
- [ ] **PE.esc** · …+15% for each use after the first, at most 90%
- [ ] **PE.roll** · …the die is on the card, a miss included

## Saint War Order: Rally Upon the Holy Banner and Roar — Rank B *(Noble Phantasm, Anti-Unit (Self))*

- [ ] **SW.gate** · Usable only while Mad Enhancement is not Active
- [ ] **SW.self** · Anti-Unit (Self): aimed at nobody else
- [ ] **SW.1** · *1.* Atk Up for 2◈ on himself: damage dealt +100%
- [ ] **SW.1.np** · …if NP, +50%
- [ ] **SW.2** · *2.* S.Crit Up for ⅔◈ to allied Units within 2: Crit Chance +15%
- [ ] **SW.3** · *3.* Def Dwn for 2◈ on himself: damage received +50% (reading 10)
- [ ] **SW.cd** · Cooldown 6◈

## Prelati's Spellbook: Textbook of the Sunken Spiral Castle — Rank A+ *(Noble Phantasm)*

- [ ] **PS.gate** · Only while Mad Enhancement is Active (reading 11)
- [ ] **PS.spells** · …Summoning: Horrors and Summoning: Elder Horror are usable

## Summoning: Horrors *(Spell)*

- [ ] **HO.when** · A Spell, used during his Turn
- [ ] **HO.counter** · …or as a Counter
- [ ] **HO.count** · Roll 1d4: that many Horrors
- [ ] **HO.place** · …within a 5×5 area around him
- [ ] **HO.attack** · Counts as his Attack for the Turn
- [ ] **HO.stats** · Horror: 100 Health, 10 Agility, 5 Luck, Range 1, MOV 3, BA(STR) 100, Detect 2
- [ ] **HO.attr** · …Attributes Dark (Outsider) (reading 15)
- [ ] **HO.budget** · Horrors do not count toward the Units that Move or Attack in his Turn
- [ ] **HO.once** · …each Horror Moves and Attacks once per Turn
- [ ] **HO.split** · A Horror defeated: Gilles flips a coin; Heads, two new Horrors (reading 12)
- [ ] **HO.split.light** · …not when defeated with Light damage
- [ ] **HO.split.vs** · …not when defeated by an Attack that deals extra damage to Dark or Outsider Units
- [ ] **HO.guard** · Enemy Units cannot Attack Gilles while a Horror is directly next to him
- [ ] **HO.guard.m** · …nor his Master while a Horror is directly next to the Master
- [ ] **HO.leave** · Horrors go when he is defeated (reading 14)
- [ ] **HO.excl** · Cannot be used on the same Turn as Summoning: Elder Horror
- [ ] **HO.book** · Cannot be used while Prelati's Spellbook is on Cooldown (reading 11)
- [ ] **HO.cd** · Cooldown ⅔◈ per Horror summoned

## Summoning: Elder Horror *(Spell)*

- [ ] **EH.when** · A Spell, used during his Turn
- [ ] **EH.counter** · …or as a Counter
- [ ] **EH.place** · One Elder Horror on a panel next to him
- [ ] **EH.attack** · Counts as his Attack for the Turn
- [ ] **EH.stats** · Elder Horror: 300 Health, 13 Agility, 7 Luck, Range 2, MOV 4, BA(STR) 125, Detect 3
- [ ] **EH.attr** · …Attributes Dark (Outsider)
- [ ] **EH.budget** · Elder Horrors do not count toward the Units that Move or Attack in his Turn
- [ ] **EH.once** · …each Moves and Attacks once per Turn
- [ ] **EH.split** · An Elder Horror defeated: Gilles rolls 1d4; on a 3, three new Horrors
- [ ] **EH.split.light** · …not when defeated with Light damage
- [ ] **EH.split.vs** · …not when defeated by an Attack that deals extra damage to Dark or Outsider Units
- [ ] **EH.guard** · Enemy Units cannot Attack Gilles while an Elder Horror is directly next to him
- [ ] **EH.guard.m** · …nor his Master while one is directly next to the Master
- [ ] **EH.leave** · Elder Horrors go when he is defeated
- [ ] **EH.excl** · Cannot be used on the same Turn as Summoning: Horrors
- [ ] **EH.book** · Cannot be used while Prelati's Spellbook is on Cooldown
- [ ] **EH.cd** · Cooldown 3◈

## The Classic and Revised War Rules *(reading 3)*

- [ ] **WR.rules** · Three War Rules, Mad Enhancement, Divinity and Presence Concealment, each *Classic*, *Revised* or *As printed*
- [ ] **WR.default** · A new War starts at *Revised* for all three
- [ ] **WR.legacy** · A War started before the rules existed reads *As printed*
- [ ] **WR.lock** · The three rules cannot change once the War has started
- [ ] **WR.text** · The sheet and the card print the text the War picked
- [ ] **WR.me.rev** · Revised Mad Enhancement: the Master defeated while it is Active, it cannot be deactivated and Sustainability loses 1 more at every Turn's end; no 2◈ at the death (Gilles)
- [ ] **WR.me.seal** · Revised Mad Enhancement: Skill Seal while it is Active ends it at once (Asterios; reading 3j)
- [ ] **WR.me.seal.own** · …not Gilles's: his sheet's *"cannot be negated"* holds under Revised (reading 3j)
- [ ] **WR.me.cls** · Classic Mad Enhancement: Sustainability −2◈ at the Master's death, nothing per Turn, and Skill Seal leaves it Active (Gilles, Asterios)
- [ ] **WR.me.c1** · Clause 1 stays each sheet's own under every pick
- [ ] **WR.dv.rev** · Revised Divinity: the flat bonus is Fixed Divine Damage, outside the Injury count (Heracles)
- [ ] **WR.dv.cls** · Classic Divinity: the flat bonus is ordinary damage and counts toward the Injury (Arjuna)
- [ ] **WR.pc.rev** · Revised Presence Concealment: Skill Seal ends it at once (Jack)
- [ ] **WR.pc.cls** · Classic Presence Concealment: Skill Seal leaves it Active (Hundred-Faced Hassan)
- [ ] **WR.printed** · *As printed*: each bearer follows its own sheet (Arjuna Revised beside Heracles Classic)
