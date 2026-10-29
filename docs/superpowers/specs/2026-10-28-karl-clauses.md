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

- [x] **ST.name** · True Name: Karl de Große — Observed live 2026-10-29: sheet as Player1: Karl de Große
- [x] **ST.class** · Class: Ruler (the sheet's folder; no Class line is printed) — Observed live 2026-10-29: sheet: RULER
- [x] **ST.region** · Region: France, Italy, Germany, Austria — Observed live 2026-10-29: sheet: FRANCE, ITALY, GERMANY, AUSTRIA
- [x] **ST.align** · Alignment: none printed (Q) — Observed live 2026-10-29: projection: alignment empty
- [x] **ST.param** · STR B, END A+, AGI C, MAG A+, LUC A+ — Observed live 2026-10-29: sheet: B A+ C A+ A+
- [x] **ST.attr** · Attributes: Male, Servant, [Man], Humanoid — Observed live 2026-10-29: projection: male, servant, man, humanoid (+ implied)
- [x] **ST.hp** · Base Health 1600 (the table at END A+; the sheet prints 1500) — Observed live 2026-10-29: sheet: 1600/1600
- [x] **ST.mov** · MOV 5 — Observed live 2026-10-29: sheet: MOV 5
- [x] **ST.range** · Range 1 panel, 1 target — Observed live 2026-10-29: sheet: Range 1, Targets 1
- [x] **ST.ba** · Base Attack STR 125, MAG 210 — Observed live 2026-10-29: sheet: BA 125 / 210
- [x] **ST.na** · Normal Attack: STR (no type printed), its delivery measured by distance — Pressed live 2026-10-29: NA on Asterios: BA(STR), card MELEE at 1
- [x] **ST.sus** · Sustainability 2◈ — Observed live 2026-10-29: sheet: 2◈
- [x] **ST.items** · Items held: none — Observed live 2026-10-29: no held Items

## Magic Resistance — Class Skill, Rank EX *(Passive 1 + 2)*

- [x] **MR.1** · All MAG damage taken is negated — Pressed live 2026-10-29: Pashupata on Karl: magicResistance −210, 40 left is Arjuna's Divinity flat
- [x] **MR.1.np** · …including NP — Pressed live 2026-10-29: Pashupata and Excalibur (NPs) on Karl: MAG negated
- [x] **MR.2** · Chance of being inflicted by debuffs is reduced by 30% — Pressed live 2026-10-29: Def Dwn from Pashupata: 100 − 30 − 50 (Item Construction) = 20%
- [x] **MR.2.death** · …also affects Instakill and Death — Pressed live 2026-10-29: Death from Pashupata (MAG): 30 − 30 − 10 = −10%
- [x] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance — Pressed live 2026-10-29: landEffect Death/Instakill on a STR attack: 40% / 25%, MR not applied
- [x] **MR.2.erase** · Erase is completely unaffected — Pressed live 2026-10-29: landEffect Erase: 50%, untouched
- [x] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced — Pressed live 2026-10-29: landEffect Stun on a STR attack: still −30 (MR)

## True Name Discernment — Class Skill, Rank C *(Passive 1 + 2, Active)*

- [x] **TD.p1** · *(P1)* When he meets an enemy Servant for the first time, all of its Notebook page is recorded to his player's Notebook (Q) — Pressed live 2026-10-29: Karl moved as Player1: Hassan's and Asterios's pages copied to Notebook: Player1
- [x] **TD.p1.first** · …the first time only (Q) — Pressed live 2026-10-29: moved back over Hassan: no second page; double Arjuna page found and fixed (claim in vision.mjs)
- [x] **TD.p1.enemy** · …an enemy Servant: no ally, no Master, no summon — Pressed live 2026-10-29: Medea and the Masters in Detect: no page
- [x] **TD.p1.hidden** · …if it has Skills or effects that hide its information, only on a successful Luck Check (Q) — Pressed live 2026-10-29: Hassan (Presence Concealment): Luck Check 15 vs 18, 1 Luck spent
- [x] **TD.p2** · *(P2)* All NP damage taken −15% — Pressed live 2026-10-29: Pashupata on Karl: defUp −15 True Name Discernment
- [x] **TD.p2.np** · …NP damage only — Pressed live 2026-10-29: Arjuna's Normal Attack on Karl: no −15
- [x] **TD.a.when** · *(Active)* Used during his Turn — Pressed live 2026-10-29: used on his Turn as Player1
- [x] **TD.a.range** · Range 2, on an enemy Unit — Pressed live 2026-10-29: on Arturia's Master at 4: out of Range (2)
- [x] **TD.a.dmdwn** · NP DmDwn for 1◈: NP damage dealt −20% — Pressed live 2026-10-29: NP DmDwn 20 on Hassan, expiry +3
- [x] **TD.a.chance** · …its chance +20% for every NP the DU has (Q) — Pressed live 2026-10-29: 170% = 100 + 20 × 1 NP + 50 Item Construction
- [x] **TD.a.cd** · Cooldown 4◈ — Pressed live 2026-10-29: cooldown 12 = 4◈

## God's Resolution — Class Skill, Rank B *(Active)*

- [x] **GR.when** · Used during his Turn — Pressed live 2026-10-29: used on his Turn as Player1
- [x] **GR.range** · Range 2, on an enemy Unit — Pressed live 2026-10-29: Hassan and Arturia at 2
- [x] **GR.stun** · 80% chance of Stun for 1◈ — Pressed live 2026-10-29: Stun landed on Hassan
- [x] **GR.ignore** · Ignores Stun Resist, Stun Immune and any other effect that specifically reduces the chance of Stun (Q) — Pressed live 2026-10-29: Stun Resist 50 staged on Hassan: 130% (80 + 50), the 50 not counted
- [x] **GR.keep** · …a cut not specific to Stun still applies (Q) — Pressed live 2026-10-29: on Arturia: 80 − 25 Magic Resistance = 55%, the named 50 not counted
- [x] **GR.cd** · Cooldown 4◈ — Pressed live 2026-10-29: cooldown 12

## Charisma — Rank B *(Passive + Active)*

- [x] **CH.p** · *(Passive)* All damage dealt by other allied Units within a 2 panel area of himself +20 — Pressed live 2026-10-29: Medea's attack beside Karl: flat +20 Charisma
- [x] **CH.p.np** · …including NP — Observed live 2026-10-29: Charisma's flat modifier carries no NP exclusion
- [x] **CH.p.other** · …not his own (*"other"*) — Pressed live 2026-10-29: Karl Cannons: no +20 on his own attack
- [x] **CH.p.off.charisma** · …negated while he has Atk Up (Charisma) — Pressed live 2026-10-29: Medea's attack with Atk Up (Charisma) held: no flat +20
- [x] **CH.p.off.seal** · …negated while he is inflicted with Skill Seal — Pressed live 2026-10-29: Skill Seal staged on Karl: Medea's attack had no +20
- [x] **CH.when** · *(Active)* Used during his Turn — Pressed live 2026-10-29: used on his Turn
- [x] **CH.atk** · Atk Up (Charisma) on himself for 1◈: all damage dealt by allied Units within a 2 panel area +20% — Pressed live 2026-10-29: Medea's attack: Atk Up (Charisma) +20%
- [x] **CH.atk.np** · …if NP, +10% — Observed live 2026-10-29: Atk Up (Charisma) landed at magnitude 20, NP 10
- [x] **CH.atk.self** · …himself included — Pressed live 2026-10-29: Karl's NA on Asterios: Atk Up +20%
- [x] **CH.cd** · Cooldown 4◈ — Pressed live 2026-10-29: cooldown 12

## Ceremonial Reformation — Rank A *(Passive)*

- [x] **CR.who** · Affects all allied Units other than himself (Q) — Pressed live 2026-10-29: grant card: Medea, both allied Masters
- [x] **CR.self** · …never himself — Pressed live 2026-10-29: Karl holds no Ceremonial Reformation
- [x] **CR.board** · …as long as he is on the board (Q) — Pressed live 2026-10-29: Karl's fall: card takes it back from all three; his return grants it again
- [x] **CR.1** · All damage dealt +10% — Pressed live 2026-10-29: Medea's attack: Atk Up Ceremonial Reformation +10%
- [x] **CR.1.np** · …including NP — Observed live 2026-10-29: the effect's dealt modifier: NP figure equal to its figure
- [x] **CR.2** · All damage taken −10% — Pressed live 2026-10-29: Medea under Pashupata: defUp −20 (home)
- [x] **CR.2.np** · …including NP — Pressed live 2026-10-29: same, an NP
- [x] **CR.3** · Max Health +100 (Q) — Pressed live 2026-10-29: Medea's max Health 850 = 750 + 100
- [x] **CR.4** · Max Agility +1 — Pressed live 2026-10-29: Medea's max Agility 16 = 15 + 1, current not raised
- [x] **CR.5** · Max Luck +1 — Pressed live 2026-10-29: Medea's max Luck 16 = 15 + 1
- [x] **CR.6** · At the end of every Turn an allied Unit Acts, its Health restored by 5% of its maximum — Pressed live 2026-10-29: Medea regains 42 after acting
- [x] **CR.6.acted** · …only a Turn it Acts — Pressed live 2026-10-29: Karl's Master, wounded, idle: no heal; acting later: 21
- [x] **CR.home** · Effects 1, 2 and 6 doubled while the affected Unit is in its Home Base: 20%, 20%, 10% — Pressed live 2026-10-29: aboard the Carolus: +20% dealt, regains 85 (10%)
- [x] **CR.home.only** · …3, 4 and 5 not doubled — Pressed live 2026-10-29: in the Home Base: max Health 850, Agility 16, Luck 16
- [x] **CR.home.carolus** · …the Carolus counts, as a second Home Base (CP.home) — Pressed live 2026-10-29: the doubled figures were aboard the Carolus

## Great Emperor Privilege — Rank A+ *(Active)*

- [x] **GE.when** · Used during his Turn — Pressed live 2026-10-29: used on his Turn
- [x] **GE.heal** · Restores his Health by 30% of its maximum — Pressed live 2026-10-29: 900 → 1380 (+480)
- [x] **GE.atk** · 60% chance of Atk Up for 1◈: +40%; if NP, +20% — Pressed live 2026-10-29: Atk Up 40: rolled 63 vs 60%, missed, on the card
- [x] **GE.def** · 60% chance of Def Up for 1◈: −40%; if NP, −20% — Pressed live 2026-10-29: Def Up 40: rolled 19 vs 60%, landed; −40% on Arturia's swing
- [x] **GE.dice** · …each its own die (Q) — Pressed live 2026-10-29: two dice, 63 and 19
- [x] **GE.np** · NP Cooldown reduced by ⅔◈ — Pressed live 2026-10-29: Carolus Patricius cooling 19 → 17
- [x] **GE.cd** · Cooldown 4◈−⅓◈ — Pressed live 2026-10-29: cooldown 11 = 4◈ − ⅓◈

## Holy King — Rank A *(Passive + Active)*

- [x] **HK.p1** · *(P1)* All damage dealt to Demonic Units, or Divine Units without Christian, +25% (Q) — Pressed live 2026-10-29: NA on Asterios (Demonic Beast) +25%; NA on Arjuna (Divine) +25%
- [x] **HK.p1.np** · …including NP — Pressed live 2026-10-29: Karl Cannons (an NP by category) on Asterios: +25%
- [x] **HK.p2** · *(P2)* All damage received from Demonic Units, or Divine Units without Christian, −25% — Pressed live 2026-10-29: Arjuna's NA on Karl: ward −25%
- [x] **HK.p2.np** · …including NP — Pressed live 2026-10-29: Pashupata on Karl: ward −25%
- [x] **HK.christian** · Christian is Saint George, Saint Martha and David, as his sheet lists (Q) — Observed live 2026-10-29: the live ward's predicate spares christian; Christian on the nine by ruling
- [x] **HK.demonic** · Demonic is the Attribute and its kin (Q) — Pressed live 2026-10-29: Asterios, Demonic Beast, took +25%
- [x] **HK.neither** · Against a Unit neither Demonic nor Divine, nothing — Pressed live 2026-10-29: Arturia's NA on Karl: no ward
- [x] **HK.a.when** · *(Active)* Used during his Turn — Pressed live 2026-10-29: used on his Turn
- [x] **HK.a.dealt** · Dmg Up (Holy) for 1◈: damage dealt to those Units further +50%; if NP, +25% — Pressed live 2026-10-29: NA on Asterios: Dmg Up (Holy) +50%
- [x] **HK.a.taken** · Dmg Up (Holy) for 1◈: damage taken from those Units further −50%; if NP, −25% — Pressed live 2026-10-29: Arjuna's NA on Karl: ward −50%
- [x] **HK.a.further** · …summed with Passive 1 and 2 (Q) — Pressed live 2026-10-29: summed: +25% and +50%, −25% and −50%
- [x] **HK.a.cd** · Cooldown 4◈ — Pressed live 2026-10-29: cooldown 12

## Joyeuse: Peerless Sword — Rank A *(NP, Passive)* [Anti-Unit]

- [x] **JO.rank** · Rank A, Anti-Unit, an NP with a passive only — Observed live 2026-10-29: sheet: Rank A, Anti-Unit, passive
- [x] **JO.p** · All Normal Attack damage dealt by Karl to Dark or Demonic Units +100 — Pressed live 2026-10-29: NA on Asterios: flat +100
- [x] **JO.p.normal** · …Normal Attacks only — Pressed live 2026-10-29: Karl Cannons on Asterios: no +100
- [x] **JO.p.attr** · …Dark or Demonic only — Pressed live 2026-10-29: NA on Arjuna: no +100
- [x] **JO.seal** · NP Seal does not stop it (Appendix A) — Observed live 2026-10-29: NP Seal staged: the Joyeuse modifier still held

## Carolus Patricius — Rank A *(NP, Non-damaging)* [Fortress]

- [x] **CP.when** · Used during his Turn (Q) — Pressed live 2026-10-29: used on his Turn as Player1
- [x] **CP.place** · Places the Carolus Patricius token, its middle panel the panel Karl stood on — Pressed live 2026-10-29: top-left (10,10) round Karl at (14,14)
- [x] **CP.size** · 9×9 panels — Pressed live 2026-10-29: 81 panels
- [x] **CP.aboard** · All Units within the 9×9 area of Karl are moved onto it (Q) — Pressed live 2026-10-29: Asterios, Hassan, Medea, his Master carried aboard
- [x] **CP.home** · *(1)* It is a second Home Base for Karl's faction — Pressed live 2026-10-29: Medea inHomeBase aboard; Home Base −10% and Round heals aboard
- [x] **CP.zon** · *(2)* Karl's Master's ZON is ignored when he Attacks while within it: no damage reduction — Pressed live 2026-10-29: Karl Cannons and NA on Arjuna 3 to 4 from his Master: no ZON penalty
- [x] **CP.zon.only** · …his Attacks only, while within — Pressed live 2026-10-29: Medea's attacks aboard kept their ZON penalty
- [x] **CP.escape** · *(3)* An enemy Servant leaves only by Succeeding a Luck Check against Karl (Q) — Pressed live 2026-10-29: Hassan: Luck Check 10 vs 4, failed; Asterios staged: 1 vs 2, escaped
- [x] **CP.escape.where** · …made anywhere on the Carolus — Pressed live 2026-10-29: from (13,14), mid-deck
- [x] **CP.escape.land** · …on a success, moved to the nearest panel just outside the Carolus — Pressed live 2026-10-29: landed (9,14), the nearest panel outside
- [x] **CP.escape.who** · …enemy Servants; others (Q) — Pressed live 2026-10-29: offered to Hassan, Asterios, Arturia; not to Medea, his Master, Arturia's Master; a Stunned Hassan was let try, fixed
- [x] **CP.entry** · *(4)* An enemy Unit may try to enter: its STR or AGI at Rank A (Q) — Pressed live 2026-10-29: Arjuna (STR A) entered; Arturia (B, B) refused entryParameter
- [x] **CP.entry.reach** · …and the nearest panel of the Carolus within its MOV − 2 — Pressed live 2026-10-29: Arjuna walked 3 under the deck, then entered
- [x] **CP.entry.mov** · …its MOV −2 while entering — Pressed live 2026-10-29: Arjuna's movedPanels 3 + 2 = 5
- [x] **CP.entry.ally** · An allied Unit enters freely (Q) — Pressed live 2026-10-29: Medea boarded freely, 1 panel
- [x] **CP.def** · *(5)* All damage received by allied Units within −15% — Pressed live 2026-10-29: Karl and Medea: defUp −15% Carolus Patricius
- [x] **CP.def.np** · …including NP — Pressed live 2026-10-29: Medea under Pashupata: −15%
- [x] **CP.iso** · *(6)* Units within cannot be targeted by Attacks from outside, and vice versa — Pressed live 2026-10-29: Arturia and Asterios from under the deck: refused, and none could reach out
- [x] **CP.iso.aoe** · …but the Patricius can be Attacked with an AoE NP: every Servant within takes its damage (Q) — Pressed live 2026-10-29: Excalibur: Karl, Medea, Arjuna aboard caught
- [x] **CP.iso.aoe.cut** · …Total Damage received −50% — Pressed live 2026-10-29: platformAoe ×0.5 on each
- [x] **CP.iso.aoe.master** · …Masters undamaged and unaffected by its other effects — Pressed live 2026-10-29: Karl's Master aboard: no Process
- [x] **CP.iso.antifortress** · An Anti-Fortress or higher NP so used ends the Carolus at the end of the Combat Process (Q) — Pressed live 2026-10-29: Excalibur (Anti-Fortress): Carolus ends after its Processes
- [x] **CP.atk** · *(7)* All damage dealt by allied Units within +15% — Pressed live 2026-10-29: Medea and Karl aboard: Atk Up Carolus Patricius +15%
- [x] **CP.atk.np** · …except Noble Phantasms — Pressed live 2026-10-29: Karl Cannons (NP by category): +0%
- [x] **CP.under** · *(8)* Units may Move under the Carolus: onto its panels, the token on top of them (Q) — Pressed live 2026-10-29: Arturia, Asterios under the deck on the ground; Karl Cannons hit Asterios there
- [x] **CP.dur** · *(9)* Lasts 2◈ Turns — Pressed live 2026-10-29: asked at 4 + 6 = end of tick 10
- [x] **CP.ext** · …after the initial period, Karl may extend it by 1◈ for 200 of his Health (Q) — Pressed live 2026-10-29: paid 200: lasts 1◈ more
- [x] **CP.ext.floor** · …not while his Health is less than 200 (Q) — Pressed live 2026-10-29: at 200 he paid, fell, and the Carolus ended that Turn (fixed live)
- [x] **CP.ext.repeat** · …again and again — Pressed live 2026-10-29: paid again at the second period
- [x] **CP.end** · *(10)* Forcefully ended at the end of the Turn if Karl or his Master is defeated — Pressed live 2026-10-29: Karl's fall and his Master's fall each ended it at the Turn's end (Master's fixed live)
- [x] **CP.lock** · Cannot be used while Carolus Patricius Auctoritas is on Cooldown — Pressed live 2026-10-29: refused while Auctoritas cooled, naming it
- [x] **CP.cd** · Cooldown 7◈ after the NP ends — Pressed live 2026-10-29: 21 after the Excalibur ended it
- [x] **CP.end.scatter** · When it ends, those aboard come down (Q) — Pressed live 2026-10-29: everyone aboard came down to the ground beneath

## Carolus Patricius: Karl Cannons *(Attack Skill)*

- [x] **KC.only** · Only usable while Carolus Patricius is Active — Pressed live 2026-10-29: after it ended: Only while Carolus Patricius stands
- [x] **KC.range** · Range 5, measured from the edge of the Carolus — Pressed live 2026-10-29: column 23 (5 past the edge) legal, 24 refused
- [x] **KC.under** · …and the area directly under the Carolus (Q) — Pressed live 2026-10-29: 3×3 under the deck: Asterios hit, Karl, Hassan, Arjuna aboard not
- [x] **KC.mag** · Base Attack (MAG) — Pressed live 2026-10-29: BA(MAG) 210
- [x] **KC.area** · Hits a 3×3 area within Range — Pressed live 2026-10-29: 9 panels
- [x] **KC.dmg** · 2x damage — Pressed live 2026-10-29: ×2
- [x] **KC.np** · Categorized as Noble Phantasm — Pressed live 2026-10-29: categorizedAsNP on the Process
- [x] **KC.iso** · …fires across the Carolus's isolation (Q) — Pressed live 2026-10-29: fired off the deck at the ground
- [x] **KC.atk** · An Attack Skill: spends his Attack — Pressed live 2026-10-29: his Attack spent
- [x] **KC.cd** · Cooldown 2◈ — Pressed live 2026-10-29: cooldown 6

## Carolus Patricius Auctoritas — Rank A++ *(NP)* [Anti-Army/Anti-Fortress/Fortress]

- [x] **U.rank** · Rank A++, Anti-Army, Anti-Fortress and Fortress — Observed live 2026-10-29: card: A++; tags Anti-Army, Anti-Fortress, Fortress
- [x] **U.two** · Two methods, one chosen per use — Pressed live 2026-10-29: Usage 1 and Usage 2 each pressed
- [x] **U.lock** · Usage 1 cannot be used while Usage 2 is on Cooldown, and the reverse (Q) — Pressed live 2026-10-29: Usage 2 refused while Usage 1 cooled, naming it
- [x] **U.cp** · Cannot be used while Carolus Patricius is on Cooldown — Pressed live 2026-10-29: both refused while Carolus Patricius cooled

### Usage 1

- [x] **U1.range** · Range 7 — Pressed live 2026-10-29: Range 7 from Karl
- [x] **U1.area** · Hits a 5×5 area within Range — Pressed live 2026-10-29: 5×5: Arturia, her Master, Arjuna
- [x] **U1.str** · First 2x damage plus 100 with BA(STR) — Pressed live 2026-10-29: BA(STR) 125 × 2 + 100
- [x] **U1.mag** · Then 2x damage plus 100 with BA(MAG) — Pressed live 2026-10-29: BA(MAG) 210 × 2 + 100
- [x] **U1.react** · Each hit separately Blocked and/or Evaded — Pressed live 2026-10-29: six Processes, Arturia evaded each
- [x] **U1.notcp** · Cannot be used while Carolus Patricius is Active — Observed live 2026-10-29: the use gate with the Carolus up: platformInactive, naming it
- [x] **U1.cd** · Cooldown 7◈+⅔◈ — Pressed live 2026-10-29: cooldown 23

### Usage 2

- [x] **U2.when** · Used during his Turn — Pressed live 2026-10-29: used on his Turn
- [x] **U2.place** · Summons the CPA on the panel he stood on (Q: its size) — Pressed live 2026-10-29: 2×2 at the panel he stood on
- [x] **U2.ontop** · …Karl moves onto it — Pressed live 2026-10-29: Karl on the CPA (seat fixed live)
- [x] **U2.cp** · May be used while Carolus Patricius is Active (Q) — Pressed live 2026-10-29: used with the Carolus up: it ended, "raised another in its place"
- [x] **U2.scatter** · …then every Unit on the Carolus but his Master is scattered below the Carolus — Pressed live 2026-10-29: Medea and Arturia's Master came down beneath
- [x] **U2.master** · …his Master is placed with Karl on the CPA — Pressed live 2026-10-29: his Master seated beside him on the CPA (fixed live)
- [x] **U2.hp** · CPA Health 3000 — Pressed live 2026-10-29: 3000
- [x] **U2.agi** · CPA Agility 8 — Pressed live 2026-10-29: 8
- [x] **U2.luc** · CPA Luck shared with Karl's — Pressed live 2026-10-29: 17, Karl's
- [x] **U2.mov** · CPA MOV 3 — Pressed live 2026-10-29: 3
- [x] **U2.range** · CPA Range 4 panels, 1 target — Pressed live 2026-10-29: 4, 1 target
- [x] **U2.ba** · CPA Base Attack STR 200, MAG 200 — Pressed live 2026-10-29: 200 / 200
- [x] **U2.attr** · CPA Attributes: Giant, Mechanical — Pressed live 2026-10-29: giant, mechanical
- [x] **U2.na** · CPA Normal Attack: BA(STR) at a Range of 1 to 2, BA(MAG) at 3 or more — Pressed live 2026-10-29: at 1: mount BA(STR) 200; at 4: mount BA(MAG) 200
- [x] **U2.move** · CPA may Move onto any panel; Units on it are knocked back 1 panel until it can stand there — Pressed live 2026-10-29: moved onto Medea: knocked back 1
- [x] **U2.kb** · CPA's Normal Attacks at a Range of 1 to 2 knock the DU back 1 panel — Pressed live 2026-10-29: NA at 1: Arturia knocked back 1, card (mount's handler fixed live)
- [x] **U2.safe** · Karl and his Master cannot be Attacked while on the CPA — Pressed live 2026-10-29: Arturia beside: Karl refused, aboard a platform that cannot be attacked into
- [x] **U2.acts** · Who acts: the CPA, Karl, or both (Q) — Pressed live 2026-10-29: his Move drives the CPA; his NA is its swing; one Attack shared
- [x] **U2.upkeep** · At the end of every Turn it is Active, his Master loses 30 Health if the CPA Acted, 10 if not — Pressed live 2026-10-29: −30 after acting, −10 idle, on a card
- [x] **U2.upkeep.instead** · …instead of the NP's normal Master Health loss (Q) — Pressed live 2026-10-29: raising it cost his Master 0
- [x] **U2.upkeep.end** · If the Master's Health is at or below that loss, the NP ends at the end of the Turn and he loses nothing — Pressed live 2026-10-29: Master at 10: it ended, he kept 10
- [x] **U2.u1** · While Usage 2 is Active, Usage 1 may be used from the CPA — Pressed live 2026-10-29: Usage 1 fired from the CPA
- [x] **U2.u1.range** · …its Range from the CPA's edge — Pressed live 2026-10-29: row 22: 8 from Karl, 7 from the CPA's edge, legal
- [x] **U2.u1.ba** · …the CPA's Base Attack — Pressed live 2026-10-29: BA 200 / 200 from the CPA
- [x] **U2.u1.cost** · …his Master's NP Health loss +50% plus 30 (Q) — Pressed live 2026-10-29: Master 266 → 152: 56 + 28 + 30
- [x] **U2.u1.end** · …and the NP ends at the end of the Turn — Pressed live 2026-10-29: toll 30, then it ended
- [x] **U2.dur** · Lasts until it ends (Q) — Pressed live 2026-10-29: dismissed on his Turn
- [x] **U2.down** · The CPA at 0 Health (Q) — Pressed live 2026-10-29: at 0: it ended, Karl down beneath, unhurt
- [x] **U2.cd** · Cooldown 7◈+⅔◈ after it ends — Pressed live 2026-10-29: cooldown 23 after it ended
