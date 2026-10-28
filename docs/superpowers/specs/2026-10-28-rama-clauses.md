# Rama (Saber) — the Clause list

*Rama*, the Saber, built from `char_orig_sheets/by-class/Saber/Rama.md`. Started by the user 2026-10-28.

**Audit opened 2026-10-28 (#347).**
**Read by hand, line by line.** No generated draft was used. The older copy `char_orig_sheets/Copia de Rama.md`
was compared with it. The by-class copy adds `N.Atk Type: STR, Melee` and the delivery tags: `{R}` on Brahmastra,
Sudarshana, Trishula and Pinaka, `{M}` on Shuuravara and Modhaki and Shikhari. No rule text differs. The by-class copy
is the one read.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Saber/Rama"`, each confirmed by reading:

- **Magic Resistance A** is `class-magic-resistance` at A, as Arturia's (#230).
- **Riding A+** is Raikou's line word for word: `class-riding-unlocks` at A+, `3◈-⅓◈`, MOV 5 (Karna's at A).
- **Divinity A** is `divinity` at A with `printedRevision: revised`: Rama is one of the five sheets that print the
  Revised text (Appendix B, #260 reading 3), as Arjuna, Proto Gil and Cú do.
- **Charisma B**'s Passive is Arturia's (`arturia-charisma`, +20 to the other allies); its Active is Proto Gil's
  (`atkUpCharisma` carried by him, here 20% / NP 10% at 4◈).
- **Martial Blessing**'s Crit Up and Crit DmUp are the generic `critUp` and `critDmUp`.
- **Dream of Reunion**'s S.Crit Up is the `sCritUp` aura its caster holds (#132), Arturia's Radiant Road at 15%. Its
  heal is a `heal` phase by percent of maximum. Its passive listens to `fgt.unitRevived`, as Heracles's Indomitable
  (*"whenever Heracles is defeated and revived through any effect"*). The Reunion Counter is a Resource pool, as
  Sieg's DRCS (`resources:`).
- **Brahmastra**'s +200% against Demonic is Balmung's `conditionalMultipliers` row against an Attribute (#341). Its
  Def Dwn (B) is the built `defDwnB`. The Demonic DU's NP Cooldown +1◈ is Kiritsugu's Chronos Rose and Nursery Rhyme's
  `cooldown` change, `unit: target`, `direction: up`.
- **Vishnu Bhuja**'s summon roll is a setup-plan line beside Semiramis's coin (`summonVariant`) and Arturia's d8 for
  Avalon (`summonItems`).
- **Modhaki and Shikhari**'s splash around the DU is Blasted Tree's 3×3 around the DU (#345 ruling 11).
- **Trishula**'s 3×3 next to him is Akafiloga usage 1's and Balmung's frame: `selfEdgeAdjacent`, an `orientedRect`.
- **Bleed**, **Slow**, **Immobilize**, **Shock**, **Burn**, **Def Dwn** and the half elements (`elementFraction`) are
  built.
- **Demonic** Units to press against: Asterios and the Jabberwock carry the Attribute.

What he needs that nobody has yet, each to be built as a generic piece:

- **A summon roll that grants Abilities** (VB.*): a coin picks one or two d6; each face grants one of five NPs; a 6 is
  the player's pick among those not yet held.
- **A Normal Attack variant once per Round** (SU.p, SH.p, MS.p, TR.p, PI.p): a passive that offers his Normal Attack
  at another Range or with a damage change, spent once a Round.
- **A Skill a passive requires** (MB.allow): Vishnu Bhuja is usable only while Martial Blessing is his.
- **Guts that revives with a flat figure** (DR.guts): 100 Health, not a percent. Sita, Flora, Nightingale (Santa) and
  Chloe (Summer) print the same shape.
- **A total cut on the attacker's own damage, keyed on the DU's Attribute** (BR.nondemonic): Armor of Fafnir's Total
  cut is the defender's.
- **A die that breaks an NP for the rest of the game** (PI.die, PI.p.die).
- **An Attack cancelled when its target would be defeated, by a chance per counter, once a game** (CS.*), and a
  **Servant summoned by an effect onto the board, contracted to its Master** (CS.sita): Sita.

**156 Clauses** across 14 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"This NP has the following effects depending on the DU-"*, *"Then, has the
  following effects-"*: headings. *"Then"* is read as the order in BR.order.
- *"Rakshasa-Piercing Immortal"*, *"Arms of the Great One"*, *"Shiva Dhanush: Bow of Shiva"*: titles.
- `Items held:`: an empty slot.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6), so BA(STR) is 150 at STR A, not the
printed 200 · *"NP Cooldown"* naming no NP reaches every NP (#197 reading 6) · an area that names no relation hits
every Unit in it (#191 reading 11) · *"all allied Units"* includes the user unless the sheet says *"other"* · an
effect with no NP figure applies its full value against an NP (#204 reading 5) · Crit Up and Crit DmUp reach an NP
only when an NP figure is stated (#131) · S.Crit Up is an aura held by its caster (#132) · `{R}`, `{M}`, `{S}` are
Ranged, Melee, Special, and a stated Melee Attack is Melee whatever its Range (#281) · NP Seal stops no passive NP
unless stated, and Skill Seal no passive Skill (Appendix A) · a debuff with no printed chance lands, cut only by
debuff resistance (#345 ruling 13).

## Readings to settle

Asked by grilling, 2026-10-28. **22 readings ruled** in four rounds.

**Built 2026-10-28** on `claude/rama` (`test/unit/rama-347.test.mjs`) and pressed as Player1 in a War of its own,
`At2JWRQAbMeTxd4Z` on the scene *Rama Audit*, apart from the match being played. **153 of 156** Clauses end Pressed or
Observed live. The three left, CS.sita, CS.contract and CS.panel, wait on Sita's own audit (ruling 13). A case the
board does not produce by chance was staged: dice on the GM page, a Unit restored, an attack budget reset, a clock
set to 0, Martial Blessing or Skill Seal staged.

Found live and fixed, each with a test that fails without it:

- A custom War's hand-placed tokens never got Rama's owed Vishnu Bhuja picks: the War's start now asks every
  opening choice still owed (`engine/opening-choice.mjs`, `combatStart`).
- The ten Vishnu Bhuja slots read "Requires a Skill this Unit does not have.": the refusal names Martial Blessing
  (`rules/items.mjs#requirementDetail`, `hasSkill.name`).
- Pinaka's die read "... It holds (breaks on 5).: not applied": a handler's card line is its own words
  (`engine/applier.mjs#noteLines`, outcome `note`).
- Sudarshana's `targetUnit` anchor confirmed after one click: two picks among the enemies within its Range
  (`anchor: self`, `shape: attackRange`).

**Asked after the presses** (not yet ruled): a Vishnu Bhuja Normal Attack is offered as a Counter, "Available as a
Counter" on the bar, and spends its once per Round there (VB.p.once was pressed that way).

**Round 1, ruled 2026-10-28 (the user).** Q2 and Q3 are asked again with the quotations; Q1's reroll is Q14.

| # | Ruling |
|---|---|
| 1 | **The user:** *"on a Double he rerolls (except on 6, obviously)"*. Two dice showing the same number 1 to 5 are rolled again; a double 6 stands, two picks among the five, both different. A 6 beside another number picks any NP but that one (VB.double, VB.six). |
| 4 | Every use of Pinaka rolls its die, the passive's d12 and the Active's d6, an Evaded or 0-damage hit included, the die on the card. Broken, both halves are gone for the game: the Active and the passive's Range 5 Normal Attack (PI.p.die, PI.die, PI.broken). |
| 5 | Sudarshana takes one or two enemy Units within Range, never the same one twice (SU.two). |
| 6 | The Units around Modhaki's DU may Evade or Block, not Counter; the DU reacts as usual; a 50% Immobilize die on each, as Blasted Tree (#345 ruling 11) (MS.area.react). |
| 7 | Against a non-Demonic DU the −20% is a Total cut: Divinity's +50 Fixed Divine Damage (Revised) is added after it, whole (#341 ruling 4). Under the War's Classic Divinity the +50 is ordinary damage and is cut with the rest (BR.nondemonic). |
| 8 | A Demonic DU's every NP takes +1◈, a ready one too: 0 becomes 1◈ (BR.npcd). |
| 9 | Vishnu Bhuja's five NPs, Actives and passives, are his only while Martial Blessing is: losing it or a negation of it takes them. Skill Seal stops no passive Skill (Appendix A), so it does not (MB.allow). |
| 10 | Curse of Separation reads a defeat by an Attack only: a Burn tick, a Health cost or a Command Spell does not reach it (CS.attack). |
| 11 | A success cancels Rama's own Process: he takes no damage or effect from it. Every other Unit the Attack hit is hit as usual (CS.cancel). |
| 12 | Sita comes on a success only, and the success spends the once. A failure: he is defeated and the curse is unspent. With no Reunion Counter nothing is rolled (CS.sita, CS.once, CS.zero). |
| 13 | Sita is built and pressed under her own audit (Archer tracker #266) before CS.sita is pressed. With no free panel directly next to him she arrives on the nearest free panel, his owner's pick (CS.sita, CS.panel). |

**Round 2, ruled 2026-10-28 (the user).** Q2d opens Q15 and Q16.

| # | Ruling |
|---|---|
| 2a | *"At a Range of 4"* is his Range for that swing: any distance 1 to 4. Shuuravara's 3, Trishula's 2 and Pinaka's 5 the same (SU.p, SH.p, TR.p, PI.p). |
| 2b | The passive is his one Normal Attack of that Turn, never a second one (VB.p.which). |
| 2c | Each passive keeps its own once per Round: Sudarshana's and Pinaka's may both be used in one Round, on two Turns (VB.p.once). |
| 2d | **The user:** *"he can use both at the same time"*. Modhaki's +20% may ride the same swing as a Range passive, spending both (VB.p.which, MS.p). |
| 2e | Sudarshana's −30%, Shuuravara's −20% and Modhaki's +20% are ordinary damage-dealt figures, summed with Atk Up and Charisma; the sheet keeps *"Total"* for Brahmastra alone (SU.p.cut, SH.p.cut, MS.p). |
| 2f | Plain Normal Attacks only, never a Riding Attack (Excalibur, #230 ruling 12); a passive applies, and is spent, only when the player picks it at declaration (VB.p.which). |
| 3 | Each passive swing takes its NP's own tag: Sudarshana, Trishula and Pinaka Ranged; Shuuravara Melee at any distance; Modhaki Melee (VB.p.delivery). |
| 14 | On a double only the second die is rolled again, until it differs; its result stands, a 6 included (VB.double). |

**Round 3, ruled 2026-10-28 (the user).** The frontier is empty: every reading is ruled.

| # | Ruling |
|---|---|
| 2d | **Revised by the user:** *"let's go back on our decision allowing them to be used at the same time."* One passive per Normal Attack: Modhaki's +20% never rides a Range passive's swing (VB.p.which, MS.p). |
| 15 | Answered by 2d: no swing carries two tags (VB.p.delivery). |
| 16 | Answered by 2d: two Range passives never share a swing (VB.p.which). |

**Round 4, ruled 2026-10-28 (the user), asked while building.**

| # | Ruling |
|---|---|
| 17 | Brahmastra's *"'Demonic' Attribute"* is any of three the roster prints: 'Demonic', 'Demonic Beast' (Asterios) and 'Demonic (Oni)'. Read on Brahmastra's own predicates, so no other sheet's 'Demonic' widens (BR.demonic, BR.nondemonic, BR.npcd). |

## Statblock

- [x] **ST.name** · True Name: Rama · *Observed live* — Player1's sheet "Servant: Rama" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.class** · Class: Saber (the sheet's folder; no Class line is printed) · *Observed live* — his sheet "SABER · LAWFUL GOOD · INDIA"; the bar "Rama SABER" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.region** · Region: India · *Observed live* — his sheet "… INDIA" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.align** · Alignment: Lawful Good · *Observed live* — his sheet "LAWFUL GOOD" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.param** · STR A, END B, AGI A+, MAG B, LUC B · *Observed live* — his sheet STR A, END B, AGI A+, MAG B, LUC B (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.attr** · Attributes: Male, Servant, [Sky], Humanoid, King · *Observed live* — his sheet's Details: male, servant, sky, humanoid, king (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.hp** · Base Health 1250 (the table at END B) · *Observed live* — Health 1250 / 1250 on Player1's bar and sheet (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.mov** · MOV 6 · *Observed live* — his sheet MOV 6; 11 under Riding (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.range** · Range 1 panel, 1 target · *Observed live* — his sheet RANGE 1, TARGETS 1 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.ba** · Base Attack STR 150 by the table (printed 200), MAG 175 · *Observed live* — his sheet BA (STR) 150, BA (MAG) 175; Brahmastra's breakdown base:str 150 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.na** · Normal Attack: STR, Melee · *Observed live* — his sheet "Normal Attack: fixed component · STR · Melee" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.sus** · Sustainability 2◈ · *Observed live* — his sheet SUSTAINABILITY 2◈ (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **ST.items** · Items held: none · *Observed live* — no Item on his sheet (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Magic Resistance — Class Skill, Rank A *(Passive 1 + 2)*

- [x] **MR.1** · MAG damage from a MAG Rank of up to A is negated · *Pressed* — Cú's Ansuz (MAG C) on him: "negated: MR A ≥ attack C", card "Negated by Magic Resistance", only Cú's Fixed Divinity 40 through (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.1.over** · …otherwise MAG damage taken is reduced by 50% · *Pressed* — Medea's Aero (MAG A+): "−50% MAG (MR A < attack A+)", 179 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.1.np** · …also affects NP · *Pressed* — Medea's Rain of Light (NP, MAG A+) over him: "−50% MAG (MR A < attack A+)", 283 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2** · Chance of being inflicted by debuffs is reduced by 25% · *Pressed* — Ansuz's 50% Burn met "resisted, rolled 56 vs 25%"; board applicationChances incoming 25 (Magic Resistance) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.death** · …also affects Instakill and Death · *Observed live* — board applicationChances incoming 25 for [instakill, death] (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance · *Observed live* — that 25's predicate: not attack:component:str, not attack:ignoresMagicResistance (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.erase** · Erase is completely unaffected · *Observed live* — no erase severity among his applicationChances (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Observed live* — the normal-severity 25 carries no predicate: STR attacks' debuffs are cut too (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Riding — Class Skill, Rank A+ *(Active + Passive 1 + 2 + 3)*

- [x] **RD.when** · *(Active)* Used during his Turn · *Pressed* — Riding from Player1's bar on his Turn (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.mov** · MOV +5 for this Turn · *Pressed* — MOV 6 → 11 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.notbuff** · …not a buff: not removed by buff removal, not prevented by an effect that prevents buffs · *Observed live* — ridingActive: polarity status, unremovable (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.unlock** · Double Move, Riding Attack and Passenger Seat usable on this Turn only · *Pressed* — the actions row gains Riding Attack and Passenger Seat after the Active (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.dm** · *(P1)* Double Move: Move twice, once before and once after Attacking; total ≤ his MOV · *Pressed* — moved 2 panels, Brahmastra, then 1 more: movedPanels 6 of 11, moveSegments 2 (rectilinear grid) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.ra** · *(P2)* Riding Attack: Attack every Unit in his path moving in a straight line, as his Normal Attack · *Pressed* — Riding Attack (6,4)→(6,9) east through Cú: a Normal Attack Process on Cú, 236, ride {panels 5, hitCount 1} (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.ra.stop** · …cannot Attack or Move after he has stopped · *Pressed* — a Move after the ride: "Riding Attack ends this Unit's Turn; it cannot Move again." (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.ra.left** · …if he already Moved, its panels are his MOV minus the panels Moved · *Pressed* — after 4 panels moved the ride's ends reach 7 east, MOV 11 − 4; the 8th, in bounds, not offered (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.ps** · *(P3)* Passenger Seat: his Master Moves with him, same orientation and position after; counts as Moving one Unit · *Pressed* — Passenger Seat: his Master carried (9,5)→(7,3) with him, same offset (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.ps.ra** · Passenger Seat and Riding Attack combine · *Pressed* — the ride above carried his Master (8,4)→(8,9) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **RD.cd** · Cooldown 3◈−⅓◈ · *Observed live* — its clock 8 after the press (3◈−⅓◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Divinity — Rank A *(Passive)*

- [x] **DV.dmg** · All damage dealt +50, NP included · *Observed live* — board modifier divinity 50; every hit's "Divinity 50" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DV.fixed** · …dealt as Fixed Divine Damage (the Revised text, under the War's `divinityRevision`) · *Observed live* — "Divinity (Fixed Divine, added after every modifier)" on every hit (Revised) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DV.injury** · …does not count towards the amount required for an Injury Roll · *Observed live* — result flag fixedExtra 50, out of the Injury count (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Martial Blessing — Rank A *(Passive + Active)*

- [x] **MB.allow** · *(Passive)* Allows the use of Vishnu Bhuja (Q) · *Pressed* — Martial Blessing staged away: all ten greyed "Requires Martial Blessing, which this Unit does not have." (after the fix below); under Skill Seal all ten lit (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MB.when** · *(Active)* Used during his Turn · *Pressed* — from Player1's bar on his Turn (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MB.crit** · Crit Up on himself for 1◈: Crit Chance +50% · *Pressed* — "Crit Up" 50 for 1◈; board crit +50 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MB.critdm** · Crit DmUp on himself for 1◈: Crit Damage +100% · *Pressed* — a crit under it: "5d10 = 19, ×2.00 crit damage" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MB.np** · Neither reaches an NP: no NP figure is printed (#131) · *Observed live* — Crit Up held: crit chance 100% on a Normal Attack, 50% on an NP (critUp 0) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MB.cd** · Cooldown 4◈ · *Observed live* — its clock 12 (4◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Charisma — Rank B *(Passive + Active)*

- [x] **CH.p** · *(Passive)* All damage dealt by other allied Units within a 2 panel area of himself +20, NP included · *Observed live* — EMIYA beside him: flatDamage 20 (Charisma) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.p.other** · …not his own damage (*"other"*) · *Observed live* — none on Rama himself (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.p.off.charisma** · …negated while he has Atk Up (Charisma) · *Observed live* — EMIYA's flat 20 gone while he holds Atk Up (Charisma) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.p.off.seal** · …negated while he is inflicted with Skill Seal · *Pressed* — Skill Seal staged on him: EMIYA's flat 20 gone; lifted, back (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.when** · *(Active)* Used during his Turn · *Pressed* — from Player1's bar on his Turn (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.atk** · Atk Up (Charisma) on himself for 1◈: all damage dealt by allied Units within a 2 panel area of himself +20% · *Pressed* — "Atk Up (Charisma)" 20/10; board atkUp 20 on EMIYA within 2 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.atk.np** · …if NP, +10% · *Pressed* — Brahmastra's breakdown "atkUpCharisma 10" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.atk.self** · …himself included (*"allied Units"*, no *"other"*) · *Pressed* — atkUp 20 on Rama himself; his Sudarshana swing "atkUpCharisma +20" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CH.cd** · Cooldown 4◈ · *Observed live* — its clock 12 (4◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Curse of Separation — Rank A *(Passive)*

- [x] **CS.when** · When Rama would be defeated and is not revived by any effect: after the revival chain, Guts included · *Pressed* — a lethal hit his Guts revived: no curse die, timesUsed 0 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CS.attack** · …by an Attack: a defeat by no Attack (Q) · *Pressed* — Medea's and Cú's Normal Attacks rolled it; Bleed staged on him at 30 Health with 2 Reunion Counters: "End of the Turn Saber takes 50 from Bleed", "Saber is defeated.", no curse die, timesUsed 0 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CS.chance** · A 3% chance for every Reunion Counter on himself, the die on the card · *Pressed* — "Curse of Separation: 1d100 → 3 against 6% (2 Reunion Counters). The Attack is cancelled."; another "→ 95 against 6% … The Attack stands." (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CS.zero** · …with no Reunion Counter, no chance · *Pressed* — Reunion 0, a lethal hit: no curse row, "Saber is defeated by Caster." (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **CS.cancel** · On a success, that Attack is cancelled (Q) · *Pressed* — that success: the card 0, his Health 30 kept, not defeated (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [ ] **CS.sita** · Then Sita is summoned on a panel directly next to him (Q) · *Waits on Sita's audit (ruling 13)*
- [ ] **CS.contract** · …contracted to Rama's Master · *Waits on Sita's audit (ruling 13)*
- [ ] **CS.panel** · …with no free panel directly next to him (Q) · *Waits on Sita's audit (ruling 13)*
- [x] **CS.once** · Can only activate once per game (Q) · *Pressed* — the success spent it (timesUsed 1); a failure left 0; spent, a lethal hit with 2 counters rolled nothing, "Saber is defeated by Lancer." (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Dream of Reunion — Rank EX *(Passive + Active)*

- [x] **DR.p** · *(Passive)* Whenever Rama is defeated and revived by any effect: +1 Reunion Counter · *Pressed* — Cú's lethal hit, "Saber is defeated and revived by Guts, with 100 Health": Reunion Counters 1 → 2 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.pool** · The Reunion Counters are shown on his bar and sheet · *Observed live* — Player1's bar and sheet "Reunion Counters" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.when** · *(Active)* Used during his Turn · *Pressed* — from Player1's bar on his Turn (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.guts** · 1. Guts for 1◈: when defeated, revived with 100 Health · *Pressed* — card "Guts"; that revival with 100 Health (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.heal** · 2. Health +25% of his maximum · *Pressed* — "Health 981 → 1250 (+269)" (25% of 1250, capped) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.np** · 3. NP Cooldown −1◈, every NP he holds (#197 reading 6) · *Pressed* — "Brahmastra: Cooldown 22 → 19" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.scrit** · 4. S.Crit Up for ⅓◈ to all allied Units within a 2 panel area of himself, himself included: Crit Chance +15% · *Pressed* — "S.Crit Up"; board crit +15 on EMIYA (2 panels) and Rama, none on Cú (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.counter** · 5. +1 Reunion Counter · *Pressed* — "Reunion Counters 0 → 1" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **DR.cd** · Cooldown 4◈ · *Observed live* — its clock 12 (4◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Brahmastra: Rakshasa-Piercing Immortal — Rank EX *(NP, Anti-Demon)*

- [x] **BR.np** · A Noble Phantasm, Rank EX, Anti-Demon · *Observed live* — his sheet "Brahmastra … EX NP RANGED" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.when** · Used during his Turn; the Master pays the EX price · *Pressed* — from Player1's bar on his Turn; his Master 214 → 139 (EX 75) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.ranged** · `{R}`: a Ranged Attack · *Pressed* — card "RANGED" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.ba** · Base Attack (STR) · *Pressed* — base:str 150 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.range** · Range 3 · *Pressed* — on Asterios 2 panels away; "Legal" in the preview (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.dmg** · 5× damage · *Pressed* — 5× (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.demonic** · A DU with the Demonic Attribute: damage further +200% · *Pressed* — on Asterios (Demonic Beast, ruling 17): "Demonic (+200%)" ×3, 3069 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.nondemonic** · A DU without it: Total damage dealt −20% (Q) · *Pressed* — on Cú: "Brahmastra: not Demonic (−20% Total)" ×0.8 at stage 15, Divinity's Fixed 50 added after (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.order** · *"Then"*: the effects below land after the damage · *Pressed* — its riders after the damage, on the card below it (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.def** · 1. Def Dwn (B) for 1◈: all damage taken +20% · *Pressed* — "Def Dwn (B)" 20/30 on Asterios (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.def.np** · …if NP, +30% · *Pressed* — magnitude 20, NP 30 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.npcd** · 2. A Demonic DU: its NP Cooldown +1◈ (Q) · *Pressed* — "Chaos Labyrinthos: Cooldown 0 → 3", a ready NP (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.npcd.not** · …a DU without it: no change · *Pressed* — on Cú: Gáe Bolg clocks 0 and 0 unchanged (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **BR.cd** · Cooldown 8◈ · *Observed live* — its clock 24 (8◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)

## Vishnu Bhuja: Arms of the Great One — Rank A *(NP, Anti-Army)*

- [x] **VB.np** · A Noble Phantasm, Rank A, Anti-Army, with no use of its own: it names the five below · *Observed live* — his sheet "Vishnu Bhuja: Arms of the Great One A NP PASSIVE" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.coin** · When Rama is summoned, flip a coin, on the summon's card · *Observed live* — the War wizard's line "Vishnu Bhuja · Tails: 2 → Shuuravara · 1d2 → 2d6 / 1d6" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.heads** · Heads: roll 2d6 · *Pressed* — re-rolled, staged: "Heads: 3, 5 (rolled again: 3) → Modhaki and Shikhari, Pinaka" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.tails** · Tails: roll 1d6 · *Observed live* — "Tails: 2 → Shuuravara", one die (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.grant** · Each number rolled, 1 to 5, gives him that NP for the game · *Observed live* — Tails 2 → Shuuravara; Heads 1, 4 → Sudarshana, Trishula (Summon dialog) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.none** · An NP no die named is not his · *Observed live* — Player1's bar after the picks: Brahmastra, Sudarshana, Pinaka only (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.six** · A 6: the player chooses any of the five not yet chosen · *Pressed* — "Heads: 6, 6 → 2 to choose"; Player1 asked "Vishnu Bhuja: choose … Choose 2 not yet held", picked: "Rama chooses Sudarshana, Pinaka (Vishnu Bhuja)." (after the fix below) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.double** · Two dice showing the same number (Q) · *Pressed* — the 3, 3 above: the second die rolled again (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.p.once** · Each passive below is spent once per Round (Q: one passive or each) · *Pressed* — a Sudarshana Counter in Faction 2's Turn of Round 5, then on his Turn "Vishnu Bhuja: Sudarshana (Normal Attack) — Already used this Round", the other four lit (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.p.which** · …it is his Normal Attack, offered at declaration, the player's pick (Q) · *Pressed* — after a passive swing: Attack and the rest greyed "this unit has already attacked this turn"; each picked from the bar (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **VB.p.delivery** · …its delivery: Melee as his `N.Atk Type`, or Ranged (Q) · *Pressed* — Sudarshana, Trishula, Pinaka swings RANGED; Shuuravara's at 3 panels and Modhaki's MELEE (War At2JWRQAbMeTxd4Z, 2026-10-28)

### Vishnu Bhuja: Sudarshana *(on a 1)*

- [x] **SU.get** · Obtained when a 1 is rolled · *Observed live* — Summon dialog, staged: "Heads: 1, 4 → Sudarshana, Trishula" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 4 · *Pressed* — its Normal Attack on Medea 4 panels away, and on Cú at 1 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.p.cut** · …its damage −30% · *Pressed* — "Sudarshana (−30%)" −30 in the bucket beside atkUpCharisma (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.ranged** · *(Active)* `{R}`: a Ranged Attack · *Pressed* — both cards "RANGED" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.ba** · Base Attack (STR) · *Pressed* — base:str 150 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.range** · Range 3 · *Pressed* — the review lists the enemies within 3 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.two** · Targets 2 enemy Units within Range (Q) · *Pressed* — "CHOOSE UP TO 2 TARGETS · Lancer · Caster", allies and himself not targeted; two Processes (after the fix below) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.dmg** · 3× damage to both · *Pressed* — 3× on each (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.bleed** · A 20% chance of Bleed for 1◈+⅓◈ on each, its own die · *Pressed* — "Bleed (rolled 52 vs -45%)", "Bleed (rolled 72 vs -30%)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.elem** · Wind damage (half) · *Pressed* — wind ×0.5 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.cd** · Cooldown 5◈ · *Observed live* — its clock 15 (5◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SU.rank** · Treated as a Rank A NP: the Master pays the A price · *Pressed* — Master 214 → 164 (A 50) (War At2JWRQAbMeTxd4Z, 2026-10-28)

### Vishnu Bhuja: Shuuravara *(on a 2)*

- [x] **SH.get** · Obtained when a 2 is rolled · *Observed live* — "Tails: 2 → Shuuravara" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 3 · *Pressed* — its Normal Attack on Medea 3 panels away (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.p.cut** · …its damage −20% · *Pressed* — "Shuuravara (−20%)" −20 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.melee** · *(Active)* `{M}`: a Melee Attack, at Range 4 · *Pressed* — delivery melee, card "MELEE" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.ba** · Base Attack (STR) · *Pressed* — base:str 150 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.range** · Range 4 · *Pressed* — on Cú; Range 4 on his sheet (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.dmg** · 3.5× damage · *Pressed* — 3.5× (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.slow** · A 50% chance of Slow for 2◈ · *Pressed* — "Slow (rolled 62 vs 35%)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.def** · Then Def Dwn for 1◈: all damage received +10%, no chance printed · *Pressed* — "Def Dwn" 10 on Cú, no die (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.elem** · Water damage (half) · *Pressed* — water ×0.5 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.cd** · Cooldown 5◈ · *Observed live* — its clock 15 (5◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **SH.rank** · Treated as a Rank A NP · *Pressed* — Master 214 → 164 (A 50) (War At2JWRQAbMeTxd4Z, 2026-10-28)

### Vishnu Bhuja: Modhaki and Shikhari *(on a 3)*

- [x] **MS.get** · Obtained when a 3 is rolled · *Observed live* — "Heads: 3, 5 … → Modhaki and Shikhari, Pinaka" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.p** · *(Passive)* Once per Round, a Normal Attack that deals 20% extra damage · *Pressed* — its Normal Attack on Cú: "Modhaki and Shikhari (+20%)" +20 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.melee** · *(Active)* `{M}`: a Melee Attack · *Pressed* — card "MELEE" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.ba** · Base Attack (STR) · *Pressed* — base:str 150 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.range** · Range 1 · *Pressed* — on Cú beside him (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.dmg** · 4× damage to the DU · *Pressed* — 4×, 525 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.imm** · …and Immobilize for 1◈+⅓◈, no chance printed · *Pressed* — "Immobilize (rolled 44 vs 35%)": no printed chance, debuff resistance only (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.elem** · …Earth damage (half) · *Pressed* — earth ×0.5 on the DU (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.area** · Every Unit except Rama directly around the DU (1 panel), allies included · *Pressed* — Processes on EMIYA (his ally) and Medea in the ring; none on Rama (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.area.dmg** · …takes 2× damage · *Pressed* — 2× on each, 240 and 280 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.area.imm** · …a 50% chance of Immobilize for ⅔◈, its own die on each · *Pressed* — "Immobilize (rolled 15 vs 40%)", "Immobilize (rolled 40 vs 0%)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.area.elem** · …Earth damage, whole · *Pressed* — earth, whole (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.area.react** · …what those Units may react with (Q) · *Pressed* — the ring's ladder "nothing / block / evade", forbidden [counter]; EMIYA Blocked, the Counter rung skipped (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.cd** · Cooldown 7◈ · *Observed live* — its clock 21 (7◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **MS.rank** · Treated as a Rank A NP · *Pressed* — Master 214 → 164 (A 50) (War At2JWRQAbMeTxd4Z, 2026-10-28)

### Vishnu Bhuja: Trishula *(on a 4)*

- [x] **TR.get** · Obtained when a 4 is rolled · *Observed live* — Summon dialog, staged: "Heads: 1, 4 → Sudarshana, Trishula" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 2 · *Pressed* — its Normal Attack on Cú, no damage change, RANGED (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.ranged** · *(Active)* `{R}`: a Ranged Attack · *Pressed* — cards "RANGED" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.ba** · Base Attack (MAG) · *Pressed* — base:mag 175 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.area** · A 3×3 panel area in any non-diagonal direction next to Rama · *Pressed* — Player1 aimed the 3×3 east beside him: "3 target(s) · 9 panel(s)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.hit** · …every Unit in it, allies included (#191 reading 11) · *Pressed* — Archer (his ally EMIYA), Lancer and Caster all hit (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.dmg** · 3× damage · *Pressed* — 3× (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.shock** · A 30% chance of Shock for 2◈, its own die on each · *Pressed* — "Shock (rolled 82 vs 20%)", "(45 vs 30%)", "(48 vs 15%)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.elem** · Lightning damage · *Pressed* — lightning (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.cd** · Cooldown 6◈ · *Observed live* — its clock 18 (6◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **TR.rank** · Treated as a Rank A NP · *Pressed* — Master 164 → 114 (A 50); Magic Resistance read it at "attack A" (War At2JWRQAbMeTxd4Z, 2026-10-28)

### Vishnu Bhuja: Pinaka *(on a 5)*

- [x] **PI.get** · Obtained when a 5 is rolled · *Observed live* — "Heads: 3, 5 … → Modhaki and Shikhari, Pinaka" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 5 · *Pressed* — its Normal Attack on Medea, RANGED (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.p.die** · …then a d12 at the end of the Damage Step: on a 5 the Shiva Dhanush breaks (Q) · *Pressed* — Medea Evaded: "Shiva Dhanush: 1d12 → 10. It holds (breaks on 5)."; staged 5: "… 1d12 → 5. It breaks, and can no longer be used for the rest of the game." (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.ranged** · *(Active)* `{R}`: a Ranged Attack · *Pressed* — card "RANGED" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.ba** · Base Attack (STR) · *Pressed* — base:str 150 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.range** · Range 5 · *Pressed* — preview "Lancer 490 – 751"; Range 5 on his sheet (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.dmg** · 5× damage · *Pressed* — 5×, 964 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.burn** · A 50% chance of Burn for 2◈ · *Pressed* — "Burn (rolled 76 vs -15%)" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.die** · A d6 at the end of the Damage Step: on a 5 the Shiva Dhanush breaks (Q) · *Pressed* — "Shiva Dhanush: 1d6 → 6. It holds (breaks on 5)."; staged 5: "It breaks …" (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.broken** · Broken: Vishnu Bhuja: Pinaka can no longer be used for the rest of the game (Q) · *Pressed* — both items expended; Player1's bar "Vishnu Bhuja: Pinaka — Spent for the rest of the game." on both (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.elem** · Fire damage (half) · *Pressed* — fire ×0.5 (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.cd** · Cooldown 7◈ · *Observed live* — its clock 21 (7◈) (War At2JWRQAbMeTxd4Z, 2026-10-28)
- [x] **PI.rank** · Treated as a Rank A NP · *Pressed* — Master 214 → 164 (A 50) (War At2JWRQAbMeTxd4Z, 2026-10-28)
