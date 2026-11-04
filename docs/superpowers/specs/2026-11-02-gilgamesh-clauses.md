# Gilgamesh (Archer) — the Clause list

*Gilgamesh*, built from `char_orig_sheets/by-class/Archer/Gilgamesh.md`. Started by the user 2026-11-02.

**Audit opened 2026-11-02 (#374).** **Read by hand, line by line.** No generated draft was used. No older
`Copia de` sheet exists to compare with. The sheet prints no Class line: Archer is the sheet's folder and the
user's word (*"Gilgamesh (Archer)"*), as Kiara's Moon Cancer was her folder's. He is not Proto Gil
(`by-class/Archer/Proto Gil.md`, audited in #232) nor Ko-Gil (`by-class/Archer/Ko-Gil.md`, not started): three
sheets of one True Name, each its own Servant.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own. Each row of Gate of Babylon's die table is its own Clause, because each lands its own debuff
and can fail on its own. Each built bearer named in Enuma Elish's lists is its own Clause, because each ends or
seals a different mechanism.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Archer/Gilgamesh"`, each confirmed by reading
the built piece:

- **Proto Gil is his nearest kin** (`proto-gil.yml`, #232): the same True Name, Region, Attributes and Base Health.
  - **Independent Action A+** is his word for word: `class-independent-action` at A+.
  - **Divinity B** is his word for word, the revised Fixed Divine sentence (`divinity`, `printedRevision: revised`).
    It grants the Divine Attribute (`divinity.yml`), so `[Sky]` is printed and Divine is not.
  - **Charisma A+'s Passive** is his Passive word for word: the aura +27 to other allies within 2, off under Atk Up
    (Charisma) or Skill Seal (`proto-gil-charisma.yml`). Gilgamesh has no Active. Arturia's Charisma is the other
    passive-only copy (`arturia-charisma.yml`, at 20).
  - **Treasury of Babylon** is his word for word (`proto-gil-treasury-of-babylon.yml`).
  - **Enkidu: Chains of Heaven** is his word for word (`proto-gil-enkidu.yml`), its readings 6 and 7 with it. Ko-Gil
    prints it a third time.
  - **Golden Rule**'s Active and its Crit cut are his (`proto-gil-golden-rule.yml`). The fallback differs: Proto
    Gil's moves Enki, Gilgamesh's cuts Treasury of Babylon's Cooldown. A `CooldownDelta` with a named `ability`
    is Quetzalcoatl's *Lucha Libre* shape (`scheduler.mjs`, `named`). The shared `golden-rule.yml` carries
    `overriddenBy: goldenRule` (#341); Proto Gil's does not.
  - **Gate of Babylon's die table** is Bab-ilu's shape (`proto-gil-bab-ilu.yml`): a `rollTable` every DU rolls for
    itself, a number rolled twice landing twice, a non-stacking debuff extended instead (#232 reading 5).
- **Magic Resistance E, raised to C** by Golden Armor's Passive 3: `class-magic-resistance` at E with a
  `RankShift` of two grades, Tiwaz's shape (`tiwaz.yml`, Cú Chulainn's Rune Magic). The tables give E 10% / 5% and
  C 30% / 15%, as both printed blocks say (`magicResistancePercent`, `magicResistanceDebuffResist`).
- **Golden Armor**'s *"All damage taken is reduced by 50%; if NP, 30%"* is a `Resistance` element, Heracles's and
  Asterios's shape; *"Immune to Petrify"* is an `Immunity`.
- **The One Who Saw It All** is Arturia's Knight of Utopia: allies within 2 of himself, Atk Up (Charisma) because
  the Skill is *"categorized as 'Charisma'"* (#230 reading 23, `atkUpCharismaUnit`), a phase filtered on an
  Attribute (`attributes: ["target:attribute:sky"]`, her Round Table phase). NP DmUp is `np-dm-up.yml`, S.Crit Up
  `s-crit-up.yml`.
- **Gate of Babylon's passive** is Ko-Gil's sentence, which prints *"All Normal Attack damage dealt is increased by
  50%"* with no question mark.
- **Gate of Babylon's 5x3** is a turnable `orientedRect` beside him (`anchor: selfEdgeAdjacent`), Arturia's
  Excalibur and Summer Habetrot's Shiisaa Beam. **Enuma Elish's 3x6** is Excalibur's exactly.
- **Gate of Babylon's chosen Rank** sets its multiplier, its flat sum, its dice, its Cooldown and its Rank: Kiara's
  `tiers` (`rules/tiers.mjs`, #372), where a tier sets `rank`, `cooldown` and `@tier.` refs. Ko-Gil's B++ (3.5x +
  200, Cooldown 6◈+⅔◈) is Gilgamesh's formula at B++, so the arithmetic is confirmed by a second sheet.
- **The Round exclusion** is EMIYA's Caladbolg and Hrunting: `sameRoundExclusive`.
- **Enuma Elish's +100% against Servants** is Rama's Brahmastra shape, `conditionalMultipliers`, a factor of 2.

What he needs that nobody has yet, each to be built as a generic piece:

- **A Rank the player chooses** (GB.rank, GB.plus): `tiers` chosen at the declaration, not bought by tokens. Read on
  the attack path, its `damage` block included, where Kiara's were read on the Skill path and in phases only.
- **Dice counted by the tier** (GB.dice): a `rollTable`'s `count` from a tier ref.
- **A row that changes at three or more** (GB.6.cf, GB.12.nm): three 6s land Crystalfreeze in place of Freeze; three
  12s, Nightmare in place of Sleep.
- **A row whose magnitude is its count** (GB.18.mag): Deafen 1, +1 for every extra 18.
- **Rows only the enemy rolls** (GB.enemy): the area hits every Unit; only enemies roll.
- **Five debuffs nobody inflicts yet**: Sleep, Nightmare, Addle, Gashed, Crystallize, each Appendix A's row.
- **Seal (Ea)** (EE.ea.*): Skill Seal (Ea) and NP Seal (Ea), a debuff that seals one named ability, its passives
  included; Unremovable; Debuff Immune and Resist cannot stop it. With it, *"remove all effects caused by this
  ability from all Units on the field"*.
- **Enuma Elish against a Reality Marble** (EE.rm.*): an area Gilgamesh stands in, ended at the end of the Damage
  Step; a DU who carries a listed ability, sealed. Keyed by the ability's name, as the sheet lists them.
- **A list of exempt Servants** (EE.except): forty sheet names, two of them built (Francis Drake, U-Olga Marie).

**149 Clauses** across 11 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"(Gilgamesh)"* before every Ability's name: the bearer's label.
- *"Has the following effects-"*, *"as follows-"*: headings.
- *"Magic Resistance — Rank: C"* under Golden Armor: the heading of the C block GA.3 makes his; its two passives are
  GA.mr.*.
- *"Sword of Rupture, Ea."*: Enuma Elish's epithet. *"Ea"* in Skill Seal (Ea) and NP Seal (Ea) is that sword's name.
- *"~~if Enuma Elish is on Cooldown, and vice versa~~"* and *"~~Karl der Große,~~"*: struck through, not rules. The
  struck name is read by EE.except.karl.
- `Items Held:`: an empty slot.
- The Normal Attack: the sheet prints no note, so it is BA(STR) at his Range, as every Archer's without one.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables and beat the sheet (§46.6; #328 ruling 18): END C
1000, BA(STR) 125 at STR B and BA(MAG) 175 at MAG B all agree with what is printed · *"NP Cooldown"* naming no NP
reaches every NP (#197 reading 6) · an area that names no relation hits every Unit in it (#191 reading 11; Gray 15;
Kiara 17) · *"all allied Units"* and *"all allies"* include the user unless the sheet says *"other"* (#204) · an
effect with no NP figure applies its full value against an NP (#204 reading 5) · Crit Up reaches an NP only when an
NP figure is stated (#131) · an NP used on its owner's Turn consumes his Attack (§46.4-AZ) · a Charisma passive is
off while its holder has Atk Up (Charisma), from any source (#230 reading 23) · a Skill *"categorized as
'Charisma'"* applies Atk Up (Charisma) (#230 reading 23) · two different Atk Ups stack (#230 reading 4) · NP Seal does
not affect a passive NP unless stated, and Gate of Babylon's passive states it · each Crit counts once (#232 reading
8) · NP Regen is on top of the natural 1 (#232 reading 17) · Enkidu is an NP that costs no Master Health (#232
reading 6), its Divinity bonus an Atk Up and its Stun chance in points (#232 reading 7) · Fixed Divine Damage is
added after everything (#232 reading 16) · a number rolled twice lands twice; a non-stacking debuff is extended
(#232 reading 5) · durations count from the Turn after the Turn of use (#187 reading 5) · riders land on a hit, not a
hurt (§46.4-LI) · every ◈ span rounds down, never to 0, and sums convert once (Gray readings 30–32) · a sheet binds
only its owner · a shared file's Clause is pressed on the Servant under audit.

**Live, 2026-11-04.** A War of his own (*Gilgamesh Audit*), pressed as Player1: the bar, the Rank dialog and the targeting once, then
the same socket call for each row. Fixed dice were staged on the GM page. **144 Clauses closed, 5 left to Kazuradrop.**

Found pressing, each fixed: the preview under the cursor read Rank E after A++ was chosen; Nameless Forest's Token pool stayed at its count
when its marker left; a Sleep woken left no line; Gashed's line named its id. **An Enuma Elish with no Unit in its area is refused today**, as every damaging area is, so he
cannot yet end an area with an empty swing. **Ruled 2026-11-04:** the sheet says *"uses"*, where its seals say *"affected"*, and the rule is
general, the Empty Aim of `CONTEXT.md`: its own issue and branch, where his empty Enuma Elish is pressed.

## Readings

Ruled by the user 2026-11-04, every one as recommended but 7, 13 and 22. Readings 29 to 32 came from the second round,
when the names were run against the corpus.

| # | Ruling | Clauses |
|---|---|---|
| 1 | Gate of Babylon's passive is **+50%** on his Normal Attack damage, added like an Atk Up. NP Seal switches it off. *"(100%?)"* is the author's doubt. | GB.p |
| 2 | He chooses the Rank when he declares the Active: E, D, C, B or A, each with none, one or two +. That is fifteen choices, and the choice is the Rank in force for that use. | GB.rank, GB.plus, GB.cd.* |
| 3 | A + adds 100 damage and ⅓◈ Cooldown and **no die**. E rolls 1, A and A++ roll 5. | GB.dice, GB.plus |
| 4 | His Master pays at the chosen Rank, + included, through `npCostAt`: E 10 or 20, A++ 56 or 66. | GB.cost |
| 5 | Every Unit in the 5x3 is hit, allies too. Only *"affected enemy Units"* roll. | GB.who, GB.enemy |
| 6 | Each affected enemy rolls its own dice, and every die is on the card. | GB.dice |
| 7 | **Freeze and Sleep last 1◈.** The sheet leaving their Turns out is a typo. Crystalfreeze and Nightmare in their place last 1◈ too. Curse and Poison stay untimed stages. | GB.1, GB.4, GB.6, GB.12 |
| 8 | Three or more 6s in one target's roll land Crystalfreeze **instead of** Freeze, and three or more 12s Nightmare instead of Sleep. Each such die is one application, extended. Two 6s are one Freeze for 2◈. | GB.6.cf, GB.12.nm, GB.same.ext |
| 9 | Row 18 is a new effect, Appendix A's **Deafen(Y)**, Y the number of 18s. Extra 18s raise Y and do not extend its 1◈. Nemo's Deafen is unchanged. | GB.18, GB.18.mag |
| 10 | Row 13 is the Bind-family `seal`. | GB.13 |
| 11 | Sleep, Nightmare, Addle, Gashed and Crystallize are built in full from Appendix A. Addle negates anything authored `automatic: true`. | GB.12, GB.12.nm, GB.16, GB.17, GB.20 |
| 12 | `sameRoundExclusive` on the Active and Enuma Elish. The passive is untouched, and the struck words are no rule. | GB.round, EE.round |
| 13 | **The missing *"next to"* is a typo.** Enuma Elish's 3x6 sits beside him and turns. | EE.area |
| 14 | *"Further increased by 100%"* is a factor of 2, Rama's shape: 5x becomes 10x. Masters, Civilians and Summons that are not Servants take 5x. | EE.servant |
| 15 | The exempt list lives on Enuma Elish as a map from the printed name to its sheet. The build checks each mapped sheet exists. A name with no sheet stays recorded as one. | EE.except |
| 16 | The struck Karl der Große is not exempt: Karl de Große takes 10x. | EE.except.karl |
| 17 | Affected means hit: an Evade is not affected, a Block is. Seals land at the end of the Damage Step, on any bearer hit, ally or enemy. | EE.rm.when, EE.np.*, EE.bug.*, EE.nf.*, EE.other.seal |
| 18 | He stands inside at declaration. The damage lands first, then `endField` runs at the end of the Damage Step, whoever owns the area. Units stay where they stand. `endField` moves no Unit. | EE.rm.end.* |
| 19 | One effect, `sealEa`, naming its ability, for 3◈. Unremovable. It ignores Debuff Immune and Resist, Magic Resistance included. | EE.ea.* |
| 20 | Removal takes every instance on a Unit sourced from that ability, Tokens included, on either side, each a card line. Areas fall outside *"from all Units"*: they stay, and do nothing while the seal holds. | EE.bug.remove, EE.np.remove, EE.muryan.remove |
| 21 | Every built bearer is pressed. One stand-in on a test Unit presses each unbuilt group, as Noah did for Enki (#232 reading 21). Each Servant's own audit presses its own later. | EE.rm.end.rest, EE.np.rest, EE.bug.*, EE.other.* |
| 22 | **Gully Trap Funny Muryan's five Clauses stay unpressed.** They are tested when Kazuradrop is built. | EE.muryan.* |
| 23 | All Nameless Forest Tokens leave all Units, then the seal lands, as a Luck Check takes them: the marker and the pool. **Ruled again 2026-11-04, the first ruling having rested on a false sentence:** nothing comes back. Max Health, Base Attack and Max Luck stay lowered (#247 reading 5, *"the lowered maximum is what is not restored"*). A Unit that loses its Tokens this way gets no 10% off gaining them again: only *"successfully removes … from itself"* earns that. | EE.nf.* |
| 24 | *"Reality Marble in its name"* counts the printed tag, since no ability's name holds the words. Bradamante's *Angelica Cathay* `[Anti-Unit/Reality Marble]` is the one member today, and it takes NP Seal (Ea) if hit. A stand-in presses it. | EE.other.* |
| 25 | The One Who Saw It All reaches him and every ally within 2. Its Atk Up (Charisma) switches his own +27 off for 1◈, and another ally's Charisma passive too (#230 reading 23). NP DmUp reaches Sky Units only. | OS.who, OS.atk, OS.sky, CH.neg.atk |
| 26 | Golden Rule's fallback fires only when Gate of Babylon, Enuma Elish and Enkidu are all clear, once per Crit. If Treasury is clear too, the card says it cut nothing. | GR.p, GR.p.tb |
| 27 | He refs Proto Gil's Treasury and Enkidu as they stand. A new `charisma-passive` template serves Arturia and him. Renames wait for Ko-Gil. | TB.*, EC.*, CH.* |
| 28 | Golden Armor is no NP and is passive, so no Seal touches it and C is always in force. The E block's Instakill, Death and Erase lines still apply at C. | GA.*, MR.rank |
| 29 | The exempt map is below. An unmarked name reaches one sheet, so Altera (Saber), Gyokuto and Ecchan are not exempt. Aoko is exempt only once she has transformed. | EE.except |
| 30 | Ability names are matched by listed ability id, never by words inside a name. Papiyas is Nobunaga's NP alone, Lai Rhyme is Oberon's Wry Rhyme, Overload ends nothing today and a stand-in presses it. Babbage's Note waits for his audit. | EE.rm.end.rest, EE.np.rest |
| 31 | No Skill is headed Bug Space. Two Clauses are pressed on a stand-in Skill of that name, so Skill Seal (Ea) is pressed live. Kazuradrop's audit decides what having it means for her. | EE.bug.* |
| 32 | EMIYA's Unlimited Blade Works charges Rank B where his sheet strikes B for A. A separate issue, out of this branch. | none |

**The exempt map (29).** Printed name, then its sheet, where the two differ: 「 」 `「　」`, Nikola Tesla `Tesla`, Altera the
San(ta) `Attila the San(ta)`, Asagami Fujino `Fujino`, Ryougi Shiki `Ryougi`, Shizuki Soujuurou `Soujuurou`, Sherlock
Holmes `Holmes`, Ranmaru X `Mysterious Ranmaru X`, Archetype:Earth `Archetype_Earth`, Sodom's Beast/Draco/Harlot `Draco`,
Space Ereshkigal `Summer Ereshkigal`, Beast III/R `Rapture`, Beast III/L `Lapse`, Beast IV/L `Yaskaya`, Beast VII
`President`, Melusine (both) `Melusine` and `Melusine Ondine`, Tiamat (both) `Tiamat` and `Larva_Tiamat`, Abigail Williams
(all) `Abigail` and `Abby (Summer)`, Leonardo da Vinci (Young) `da Vinci (Summer)`, Mysterious Heroine X (both) `MHX` and
`MHXX`, Super Aoko `Aozaki Aoko` once transformed. **No sheet yet:** Demeter (Erinyes), BB Dubai, Azumi no Isora.

## Statblock

- [x] **ST.name** · True Name: Gilgamesh · *Observed: Sheet, as Player1*
- [x] **ST.class** · Class: Archer (the sheet's folder; no Class line is printed) · *Observed: Sheet*
- [x] **ST.region** · Region: Ancient Mesopotamia, Middle East · *Observed: Sheet*
- [x] **ST.align** · Alignment: Chaotic Good · *Observed: Sheet*
- [x] **ST.param** · STR B, END C, AGI C, MAG B, LUC A · *Observed: Sheet*
- [x] **ST.attr** · Attributes: Male, Servant, [Sky], King, Humanoid (Divine from Divinity) · *Observed: Board: Divine from Divinity*
- [x] **ST.hp** · Base Health 1000 (END C, the table agrees) · *Observed: Sheet*
- [x] **ST.mov** · MOV 4 · *Observed: Sheet*
- [x] **ST.range** · Range 4 panels, 1 target · *Observed: Sheet*
- [x] **ST.ba** · Base Attack STR 125, MAG 175 (the tables agree) · *Observed: Sheet*
- [x] **ST.sus** · Sustainability: N/A · *Observed: Board: null*
- [x] **ST.items** · Items held: none · *Observed: Sheet*

## Independent Action — Class Skill, Rank A+ *(Passive 1–3)*

- [x] **IA.1** · *(Passive 1)* Sustainability does not apply · *Observed: Board: no Sustainability*
- [x] **IA.2** · *(Passive 2)* His Master's ZON is increased by 3 panels · *Observed: Board: ZON 6*
- [x] **IA.3** · *(Passive 3)* He cannot be contracted by enemy Casters and Masters · *Pressed: Enemy Master and enemy Caster: `immune`; his own Master passes*

## Magic Resistance — Class Skill, Rank E *(Passive 1 + 2)*

- [x] **MR.rank** · Rank E: MAG damage up to MAG E negated, otherwise −10%; debuffs −5%. Raised to C by GA.3 (Q) · *Observed: Board: E shifted to C*
- [x] **MR.2.death** · The debuff reduction also affects Instakill and Death · *Pressed: Test Bolt (MAG): Instakill 40 → 25*
- [x] **MR.2.str** · …unless the Instakill or Death is from an Attack, Attack Skill, Spell or NP that deals STR damage or is not affected by Magic Resistance · *Pressed: Test Bolt (STR): Instakill stays 40*
- [x] **MR.2.erase** · Erase is completely unaffected · *Pressed: Erase stays 40 on both*
- [x] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Pressed: Test Bolt (STR): Stun 40 → 25*

## Divinity — Rank B *(Passive)*

- [x] **DI.1** · All damage he deals is increased by 40 · *Pressed: +40 on his Normal Attack*
- [x] **DI.1.np** · …including NP · *Pressed: +40 on Gate of Babylon and Enuma Elish*
- [x] **DI.fixed** · The extra damage is dealt as Fixed Divine Damage · *Pressed: Added after every modifier*
- [x] **DI.injury** · …and does not count towards the amount required for an Injury Roll · *Pressed: Total 133, 93 without the 40: no Injury Roll*

## Gate of Babylon: Golden Armor *(Passive 1–3)*

- [x] **GA.1** · *(Passive 1)* All damage taken is reduced by 50% · *Pressed: Drake's Normal Attack: −50%*
- [x] **GA.1.np** · …if NP, 30% · *Pressed: An NP from Drake: −30%*
- [x] **GA.2** · *(Passive 2)* He is Immune to Petrify · *Pressed: Petrify does not land*
- [x] **GA.3** · *(Passive 3)* His Magic Resistance Rank is increased from E to C (Q) · *Observed: Board: Magic Resistance at C*
- [x] **GA.mr.neg** · MAG damage from a MAG Rank of up to C is negated · *Pressed: MAG E NP: 0, a Fixed Divine aside*
- [x] **GA.mr.over** · …otherwise MAG damage taken is reduced by 30% · *Pressed: Ozymandias's MAG A: ×0.7*
- [x] **GA.mr.np** · …also affects NP · *Pressed: The MAG NP is negated too*
- [x] **GA.mr.debuff** · Chance of being inflicted by debuffs is reduced by 15% · *Pressed: Stun 40 → 25*

## Charisma — Rank A+ *(Passive)*

- [x] **CH.1** · All damage dealt by other allied Units within a 2 panel area of himself is increased by 27 · *Pressed: Arturia's Normal Attack: +27*
- [x] **CH.1.np** · …including NP · *Pressed: Proto Gil's Bab-ilu: +27*
- [x] **CH.1.self** · …not his own damage (*"other"*) · *Pressed: His own attack: no +27 from himself*
- [x] **CH.neg.atk** · Negated while he has Atk Up (Charisma) (Q) · *Pressed: He holds Atk Up (Charisma): none*
- [x] **CH.neg.seal** · Negated while he is inflicted with Skill Seal · *Pressed: He holds Skill Seal: none*

## The One Who Saw It All — Rank EX *(Active)*

- [x] **OS.when** · Used during his Turn · *Pressed: Off his Turn: `notOwnTurn`*
- [x] **OS.who** · Affects all allies within a 2 panel area of himself, him included (Q) · *Pressed: Him, Proto Gil, Arturia*
- [x] **OS.atk** · 1. Atk Up for 1◈: all damage dealt +20% · *Pressed: +20% on his Normal Attack*
- [x] **OS.atk.np** · …if NP, 10% · *Pressed: +10% on Gate of Babylon*
- [x] **OS.sky** · 2. NP DmUp for 1◈ to affected Units with the [Sky] Attribute: NP damage dealt +20% (Q) · *Pressed: Him and Proto Gil, +20% on Gate of Babylon*
- [x] **OS.sky.only** · …an affected Unit without [Sky] gets none · *Pressed: Arturia gets none*
- [x] **OS.scrit** · 3. S.Crit Up for ⅓◈: Crit Chance +10% · *Pressed: Tick 4 → 5*
- [x] **OS.cd** · Cooldown 4◈ · *Pressed: 12*
- [x] **OS.cat** · Categorized as 'Charisma': its Atk Up is Atk Up (Charisma) (Q) · *Pressed: Proto Gil's +27 off him while held*

## Golden Rule — Rank A *(Passive + Active)*

- [x] **GR.p** · Whenever he performs a Crit, his NP Cooldown is reduced by 1 Turn · *Pressed: Crit with Enkidu cooling: 9 → 8; no Crit, no cut*
- [x] **GR.p.tb** · …if none of his NPs is on Cooldown, Treasury of Babylon's Cooldown is reduced by 1 Turn instead (Q) · *Pressed: Crit, no NP cooling: Treasury 9 → 8; Treasury clear: the card says so*
- [x] **GR.when** · The Active is used during his Turn · *Pressed: Off his Turn: `notOwnTurn`*
- [x] **GR.a** · NP Regen for 1◈: NP Cooldown −2 Turns at the end of every Turn · *Pressed: End of his Turn: 20 → 17, natural 1 and Regen 2*
- [x] **GR.cd** · Cooldown 4◈ · *Pressed: 12*

## Treasury of Babylon — Rank EX *(Active)*

- [x] **TB.when** · Used during his Turn · *Pressed: Off his Turn: `notOwnTurn`*
- [x] **TB.1** · His NP Cooldown is reduced by 1◈ · *Pressed: Gate of Babylon 20 → 17, Enkidu 10 → 7*
- [x] **TB.2** · …then Crit Up for 1◈ on himself: Crit Chance +60% · *Pressed: Crit Up 60*
- [x] **TB.cd** · Cooldown 4◈ · *Pressed: 12*

## Gate of Babylon: King's Treasure — Rank E~A++, NP, Anti-Unit *(Passive + Active)*

- [x] **GB.tag** · [Anti-Unit] · *Observed: Document*
- [x] **GB.p** · *(Passive)* Normal Attack damage dealt is increased by 50% (Q) · *Pressed: Normal Attack: +50%*
- [x] **GB.p.seal** · …negated while he is inflicted with NP Seal · *Pressed: Under NP Seal: 197 → 148, no row*
- [x] **GB.dmg** · *(Active)* Base Attack (STR) is used · *Pressed: BA(STR)*
- [x] **GB.area** · Hits a 5x3 or 3x5 panel area in any non-diagonal direction next to him · *Pressed: East 3 wide 5 deep, and turned 5 wide 3 deep; (12,18) out of it*
- [x] **GB.who** · Every Unit in the area is hit, allies too (Q) · *Pressed: Proto Gil hit in the area*
- [x] **GB.rank** · He chooses the NP's Rank (Q) · *Pressed: The bar dialog, fifteen choices*
- [x] **GB.A** · Rank A: 4x · *Pressed: 4x*
- [x] **GB.B** · Rank B: 3.5x · *Pressed: 3.5x*
- [x] **GB.C** · Rank C: 3x · *Pressed: 3x*
- [x] **GB.D** · Rank D: 2.5x · *Pressed: 2.5x*
- [x] **GB.E** · Rank E: 2x · *Pressed: 2x*
- [x] **GB.plus** · He can add up to two + to the Rank: +100 damage for each (Q) · *Pressed: +100, +200 on the card*
- [x] **GB.cost** · His Master pays the NP cost at the chosen Rank (Q) · *Pressed: E 10, D 20, C 30, B 40, A 50, A++ 56, each read off his Master*
- [x] **GB.dice** · Each affected enemy rolls a d20 for each Rank of NP used (Q) · *Pressed: E 1, D 2, C 3, B 4, A and A++ 5, each its own roll*
- [x] **GB.enemy** · …only enemies roll; an ally hit rolls none (Q) · *Pressed: Proto Gil: "rolls no dice"*
- [x] **GB.1** · 1: Curse (Q) · *Pressed: Curse stage*
- [x] **GB.2** · 2: Burn for 2◈ · *Pressed: 2◈*
- [x] **GB.3** · 3: Shock for 2◈ · *Pressed: 2◈*
- [x] **GB.4** · 4: Poison (Q) · *Pressed: Poison stage*
- [x] **GB.5** · 5: Stun for 1◈ · *Pressed: Stun*
- [x] **GB.6** · 6: Freeze (Q) · *Pressed: Freeze 1◈ each*
- [x] **GB.6.cf** · …three or more 6s: Crystalfreeze instead (Q) · *Pressed: Three 6s: Crystalfreeze, tick 4 → 13*
- [x] **GB.7** · 7: Slow for 1◈ · *Pressed: Slow*
- [x] **GB.8** · 8: Immobilize for 1◈ · *Pressed: Immobilize*
- [x] **GB.9** · 9: Disable for 1◈ · *Pressed: Disable*
- [x] **GB.10** · 10: NP Seal for 1◈ · *Pressed: NP Seal*
- [x] **GB.11** · 11: Bleed for 1◈ · *Pressed: Bleed*
- [x] **GB.12** · 12: Sleep (Q) · *Pressed: Sleep; damage ×2, then off, no Counter*
- [x] **GB.12.nm** · …three or more 12s: Nightmare instead (Q) · *Pressed: Three 12s: Nightmare; −10% on its own Turn*
- [x] **GB.13** · 13: Seal for 1◈ (Q) · *Pressed: Seal*
- [x] **GB.14** · 14: Blind for 1◈ · *Pressed: Blind*
- [x] **GB.15** · 15: Silence for 1◈ · *Pressed: Silence*
- [x] **GB.16** · 16: Addle for 1◈ (Q) · *Pressed: Addle: Treasury refused; an automatic Golden Rule held, with a line*
- [x] **GB.17** · 17: Gashed for 1◈ (Q) · *Pressed: Gashed: a heal and Agility held, with a line*
- [x] **GB.18** · 18: Deafen for 1◈ (Q) · *Pressed: Deafen(Y): Evade +4 on the DU*
- [x] **GB.18.mag** · …its magnitude starts at 1 and rises by 1 for every extra 18 (Q) · *Pressed: Three 18s: Y 3 at 1◈; an evader of the bearer rolls −3*
- [x] **GB.19** · 19: Dragonblight for 1◈ · *Pressed: Dragonblight*
- [x] **GB.20** · 20: Crystallize for 1◈ (Q) · *Pressed: Crystallize: Evade +d6, −10% taken, −50 on a Turn it Acts*
- [x] **GB.same** · A number rolled more than once lands its debuff that many times · *Pressed: Curse to stage 2, Poison to stage 2*
- [x] **GB.same.ext** · …a debuff that does not stack has its duration extended instead · *Pressed: Burn tick 16, Stun 2◈, Freeze 2◈*
- [x] **GB.cd** · Cooldown 3◈ at Rank E · *Pressed: E 9*
- [x] **GB.cd.rank** · …+1◈ for every increase in Rank (Q) · *Pressed: C 15, A 21*
- [x] **GB.cd.plus** · …+⅓◈ for every + added (Q) · *Pressed: E+ 10, A+ 22, A++ 23*
- [x] **GB.round** · The Active cannot be used on the same Round as Enuma Elish (Q) · *Pressed: Refused, by name, after Enuma Elish*

## Enuma Elish: The Star of Creation that Split Heaven and Earth — Rank EX, NP, Anti-World

- [x] **EE.tag** · [Anti-World] · *Observed: Document*
- [x] **EE.dmg** · Base Attack (MAG) is used · *Pressed: BA(MAG)*
- [x] **EE.area** · Hits a 3x6 or 6x3 panel area in any non-diagonal direction (Q) · *Pressed: East 3 wide 6 deep: (12,18) and the panel beside him*
- [x] **EE.who** · Every Unit in the area is hit, allies too · *Pressed: Arturia, an ally, hit*
- [x] **EE.x5** · 5x damage · *Pressed: 5× row*
- [x] **EE.servant** · Damage dealt to Servants is further increased by 100% (Q) · *Pressed: Kingprotea: ×2 row*
- [x] **EE.except** · …except the Servants on the list (Q) · *Pressed: Drake, U-Olga Marie: "not against"*
- [x] **EE.except.karl** · …the struck Karl der Große is not exempt (Q) · *Pressed: Karl de Große: ×2 row*
- [x] **EE.cd** · Cooldown 8◈ · *Pressed: 24*
- [x] **EE.round** · Cannot be used on the same Round as Gate of Babylon's Active (Q) · *Pressed: Refused, by name, after Gate of Babylon*
- [x] **EE.rm.when** · Its Reality Marble effects land at the end of the Damage Step (Q) · *Pressed: Damage first, then the closing card*
- [x] **EE.rm.end.ubw** · Used while he is inside Unlimited Blade Works: it is forcefully ended (Q) · *Pressed: Forcefully ended*
- [x] **EE.rm.end.chaos** · …inside Chaos Labyrinthos · *Pressed: Ended, its 8◈ started, Units in place*
- [x] **EE.rm.end.duel** · …inside Diatrekhōn Astēr Lonkhē: Duel Field · *Pressed: Ended*
- [x] **EE.rm.end.ramesseum** · …inside Ramesseum Tentyris · *Pressed: Ended, Sphinxes gone*
- [x] **EE.rm.end.rest** · …inside Depletion Garden, Golem Keter Malkuth, Ionioi Hetairoi, Papiyas/Dairokuten Maou Hajun, Puppet Playground/Kugutsu Yūen, Shimabara Jigoku, Overload, Aestus/Nuptiae Domus Aurea or Hakuro Jyou no Hyakki Hachitendou-sama (Q) · *Pressed: Stand-in `iskandar-ionioi-hetairoi`*
- [x] **EE.bug.seal** · A DU with Bug Space who is affected: Skill Seal (Ea) for 3◈ (Q) · *Pressed: Stand-in: Skill Seal (Ea), its passive MOV gone*
- [x] **EE.bug.remove** · …and every effect Bug Space caused is removed from all Units (Q) · *Pressed: Stand-in: Def Dwn off Arturia, a line*
- [x] **EE.ea.unremovable** · Skill Seal (Ea) and NP Seal (Ea) are Unremovable (Q) · *Pressed: Cure Servant took Def Dwn and left the seal*
- [x] **EE.ea.ignores** · …ignore Debuff Immune and Resist effects on the DU (Q) · *Pressed: Debuff Immune held: no die, no use spent*
- [x] **EE.ea.only** · …affect only the ability listed; the DU's other Skills and NPs stay usable (Q) · *Pressed: Golden Hind still gated by the Turn alone*
- [x] **EE.ea.passive** · …negate all its effects, its Passive effects included (Q) · *Pressed: Stand-in passive Base Attack +77 gone*
- [x] **EE.np.airavata** · A DU with Airavata King Size who is affected: NP Seal (Ea) for 3◈ (Q) · *Pressed: NP Seal (Ea); on a Block too, not on an Evade*
- [x] **EE.np.sterrennacht** · …with De Sterrennacht · *Pressed: NP Seal (Ea)*
- [x] **EE.np.rest** · …with Alf Layla wa-Layla, Chariot My Love, Cursed Cupid Cleanser, Dimension of Steam, Emotional Engine - Full Drive, Metabole Piglets, Tsumukari Muramasa, Unlimited Lost Works or Lai Rhyme Goodfellow (Q) · *Pressed: Stand-ins `babbage-dimension-of-steam`, `medb-chariot-my-love` on an ally*
- [x] **EE.np.remove** · …and every effect that NP caused is removed from all Units (Q) · *Pressed: Terror and Crit DmUp off both sides; Insanity's Atk Up stays*
- [ ] **EE.muryan.use** · Caught within Bug Space, during his Player's Turn, he can use Enuma Elish if it is not on Cooldown (Q) · *Unpressed: waits for Kazuradrop (ruling 22)*
- [ ] **EE.muryan.count** · …it counts towards the number of Units which Attack during this Turn (Q) · *Unpressed: waits for Kazuradrop (ruling 22)*
- [ ] **EE.muryan.release** · …every Unit in Bug Space is released onto random panels within a 2 panel area of the DU (Q) · *Unpressed: waits for Kazuradrop (ruling 22)*
- [ ] **EE.muryan.seal** · …the DU is inflicted with NP Seal (Ea) for 3◈ (Q) · *Unpressed: waits for Kazuradrop (ruling 22)*
- [ ] **EE.muryan.remove** · …and every effect the NP caused is removed from all Units (Q) · *Unpressed: waits for Kazuradrop (ruling 22)*
- [x] **EE.nf.tokens** · A DU with Nameless Forest who is affected: every Nameless Forest Token is removed from all Units (Q) · *Pressed: Marker and pool off Proto Gil and Arturia; maxima stay*
- [x] **EE.nf.seal** · …then the DU is inflicted with NP Seal (Ea) for 3◈ · *Pressed: NP Seal (Ea), after the Tokens*
- [x] **EE.other.area** · Another ability with "Reality Marble" in its name that deploys an area: ended if he uses Enuma Elish within it (Q) · *Pressed: Stand-in with the tag: ended*
- [x] **EE.other.seal** · …one that does not: its bearer, if affected, gets Skill Seal (Ea) and/or NP Seal (Ea) for 3◈ (Q) · *Pressed: Stand-in with the tag: NP Seal (Ea)*

## Enkidu: Chains of Heaven — Rank ???, Anti-Unit/Anti-Divine

- [x] **EC.target** · Range 3, one DU · *Pressed: Distance 4 refused, 3 lands*
- [x] **EC.dmg** · Base Attack (STR), normal damage · *Pressed: BA(STR)*
- [x] **EC.stun** · 50% chance of Stun for 1◈ · *Pressed: 50 less his Resist: 40*
- [x] **EC.EX** · Against a DU with Divinity EX: damage +150%, Stun chance +100% · *Pressed: Damage and a certain Stun*
- [x] **EC.A** · …Divinity A: damage +100%, Stun chance +50% · *Pressed: +50 points*
- [x] **EC.B** · …Divinity B: damage +80%, Stun chance +40% · *Pressed: +40*
- [x] **EC.C** · …Divinity C: damage +60%, Stun chance +30% · *Pressed: +30*
- [x] **EC.D** · …Divinity D: damage +40%, Stun chance +20% · *Pressed: +20*
- [x] **EC.E** · …Divinity E: damage +20%, Stun chance +10% · *Pressed: +10*
- [x] **EC.divine** · A DU with the 'Divine' Attribute but no Divinity Skill counts as Rank A · *Pressed: Divine, no Skill: "as A"*
- [x] **EC.immune** · Against a 'Divine' DU, Debuff Immune effects cannot prevent the Stun, even Stun-specific ones · *Pressed: Debuff Immune did not stop it; not Divine, it did*
- [x] **EC.resist** · …Debuff Resist still reduces its chance · *Pressed: Drake 90 for 100*
- [x] **EC.free** · Does not decrease his Master's Health · *Pressed: His Master unchanged*
- [x] **EC.cd** · Cooldown 5◈ · *Pressed: 15*
