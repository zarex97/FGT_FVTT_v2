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

## Readings

To be grilled.

| # | Reading (recommended) | Clauses |
|---|---|---|
| 1 | Gate of Babylon's passive is **+50%** on his Normal Attack damage. *"(100%?)"* is the author's doubt, and Ko-Gil prints the same passive as 50% with none. Added like an Atk Up, NP Seal switching it off. The other reading: +100%. | GB.p |
| 2 | The Rank is chosen when he declares the Active, before the area, from E, D, C, B, A, each with none, one or two +: fifteen choices. The choice sets the multiplier, the flat sum, the dice, the Cooldown and the NP's Rank for that use (Kiara reading 10: the Rank in force). The sheet and the bar show *"E~A++"*. | GB.rank, GB.plus, GB.cd.* |
| 3 | A + adds 100 damage and ⅓◈ Cooldown and **no die**: *"a twenty-sided die for each Rank of NP used"* counts the grade, E 1 to A 5. Ko-Gil's B++ (3.5x + 200, 6◈+⅔◈) agrees on the damage and the Cooldown. The other reading: each + is a Rank too, A++ rolling 7. | GB.dice, GB.plus |
| 4 | His Master pays the NP cost of the chosen Rank, + included, as `npCostAt` prices *"B++"*. The sheet says nothing of the cost, so the normal NP rule applies at the Rank in force. The other reading: always the top Rank, A++. | GB.cost |
| 5 | The 5x3 names no relation: every Unit in it is hit, allies too. Only *"affected enemy Units"* roll the dice; an ally hit rolls none. | GB.who, GB.enemy |
| 6 | Each affected enemy rolls its own dice, as Bab-ilu's DUs do. | GB.dice |
| 7 | Rows that print no Turns (Curse, Poison, Freeze, Sleep, and Crystalfreeze or Nightmare in their place) last until their own rule ends them: Curse and Poison stages until removed, Freeze until broken, Sleep until a hit wakes it. The other reading: 1◈ like the rows around them. | GB.1, GB.4, GB.6, GB.12 |
| 8 | Three or more 6s land **Crystalfreeze in place of Freeze**, once a 6, so the extra 6s extend it as a non-stacking debuff; no Freeze lands. The same for three or more 12s: Nightmare in place of Sleep. Two 6s are two Freezes (one, extended). | GB.6.cf, GB.12.nm, GB.same.ext |
| 9 | Gate of Babylon's Deafen is Appendix A's **Deafen(Y)** (*"Own Evade rolls +Y; enemies evading this unit's attacks roll −Y"*), Y the number of 18s rolled, for 1◈. It is a new effect beside Nemo's fixed Deafen, which stays as his sheet states it (Appendix A's Deafen note: *"the two are different effects and want different ids"*). The other reading: Nemo's Deafen, its magnitude ignored. | GB.18, GB.18.mag |
| 10 | *"Seal (1◈ Turns)"* is the Bind-family `seal` (no Normal Attack with BA(STR), no Skill, no NP; Spells still usable), not Skill Seal or NP Seal. | GB.13 |
| 11 | The five debuffs nobody inflicts yet are built **in full, as Appendix A's rows**: Sleep (cannot Act; a hit's damage +100% Total, then it ends, and that hit cannot be Countered), Nightmare (Sleep's effects and −10% of current Health at the end of its Turn, a derivative that replaces Sleep), Addle (no Active Skills or Spells; every automatically-activating Skill and effect negated), Gashed (Health and Agility cannot be restored), Crystallize (MOV −3, Agility Checks +1d6, 50 Fixed damage at the end of any Turn it Acts, all damage taken −10% including NP). Each is pressed live once from the table. | GB.12, GB.12.nm, GB.16, GB.17, GB.20 |
| 12 | The Note is EMIYA's `sameRoundExclusive`: Gate of Babylon's **Active** and Enuma Elish are never both used in one Round. The passive is untouched. The struck *"on Cooldown"* wording is not a rule. | GB.round, EE.round |
| 13 | Enuma Elish's 3x6 is **beside him**, turnable, as Excalibur's and Ko-Gil's *"next to"* areas are. The sheet leaves *"next to Gilgamesh"* out, and every other area of his says it. | EE.area |
| 14 | *"Damage dealt to Servants … is further increased by 100%"* is a **factor of 2** on a DU that is a Servant, Rama's shape: 5x becomes 10x. Masters, Summons that are not Servants, and Civilians take 5x. A summoned Servant (Sita) is a Servant. The other reading: +100% added like an Atk Up. | EE.servant |
| 15 | The exempt list lives on Enuma Elish and is matched on the **Servant's name as its sheet titles it**. *"(both)"* and *"(all)"* reach every sheet of that name; *"Romulus (normal)"* is `Romulus.md`, not Romulus Quirinus. Each name is checked by the build against a sheet in `char_orig_sheets`, so a misspelling fails the build. Two are built today: Francis Drake and U-Olga Marie. | EE.except |
| 16 | The struck *"Karl der Große"* is **not exempt**: Karl de Große takes the +100%. | EE.except.karl |
| 17 | *"Affected by Enuma Elish"* means **hit** by it: a DU who Evades is not affected; one who Blocks is. Its seal and removals land at the end of the Damage Step. | EE.rm.when, EE.np.*, EE.bug.*, EE.nf.*, EE.other.seal |
| 18 | *"Used within"* an area means he **stands inside it when he declares** Enuma Elish. The area ends at the end of the Damage Step, as its own end does, with what that end does (Units inside are returned). The damage lands first. | EE.rm.end.* |
| 19 | Seal (Ea) is **one new effect**, `sealEa`, with the ability it seals as its parameter: Skill Seal (Ea) and NP Seal (Ea) are its two names. That ability cannot be used, and every passive rule it carries is negated. It is Unremovable, lands whatever the DU's Debuff Immune, and Debuff Resist cannot lower it. 3◈. | EE.ea.* |
| 20 | *"Remove all effects caused by this Skill/NP from all Units on the field"* removes **every effect instance whose source is that ability**, on any Unit, either side, buffs and debuffs alike, and any area or Token it placed. A card line names each. | EE.bug.remove, EE.np.remove, EE.muryan.remove |
| 21 | **Unbuilt bearers.** Enuma Elish's lists are built generic and keyed by name. Each list is pressed live on its built members: Unlimited Blade Works (EMIYA), Chaos Labyrinthos (Asterios), Diatrekhōn Astēr Lonkhē (Achilles), Ramesseum Tentyris (Ozymandias), Airavata King Size (Kingprotea), De Sterrennacht (Van Gogh) and Nameless Forest (Nursery Rhyme). The members with no built bearer are pressed with a stand-in ability of that name on a test Unit, as Noah was for Enki (#232 reading 21): Bug Space, an NP from the NP list, and an area and a non-area *"Reality Marble"*. | EE.rm.end.rest, EE.np.rest, EE.bug.*, EE.other.* |
| 22 | **Gully Trap Funny Muryan** is moved to Kazuradrop's audit. Its five Clauses need her Bug Space, which captures Units as Special Items, pauses their clocks and releases them; none of that exists, and it is her sheet's mechanism. Gilgamesh's side is kept and keyed (EE seals a DU who carries it), and his audit closes without it. The other reading: build Bug Space's capture now, from her sheet, to press these five. | EE.muryan.* |
| 23 | Nameless Forest's *"remove all Nameless Forest Tokens from all Units on the board"* removes the Token effect from every Unit, either side, then NP Seal (Ea) lands on Nursery Rhyme. | EE.nf.* |
| 24 | *"Other abilities with Reality Marble in its name"*: an ability **whose name holds the words "Reality Marble"**. One that deploys an area ends as reading 18. One that does not seals its bearer, with Skill Seal (Ea) for a Skill and NP Seal (Ea) for an NP. Unlimited Blade Works is on the first list by name and is not read again here. | EE.other.* |
| 25 | **The One Who Saw It All** reaches him (*"all allies"*, no *"other"*), so its Atk Up (Charisma) switches his own Charisma passive off for 1◈. It reaches every ally within 2, Servants or not. NP DmUp reaches only those with the Sky Attribute, him included. | OS.who, OS.atk, OS.sky, CH.neg.atk |
| 26 | Golden Rule's fallback cuts Treasury of Babylon's Cooldown by 1 Turn only while **none of his three NPs** is on Cooldown (Gate of Babylon, Enuma Elish, Enkidu), once a Crit. With Treasury off its Cooldown too, it cuts nothing and says so. | GR.p, GR.p.tb |
| 27 | **Gilgamesh refs Proto Gil's files** for Treasury of Babylon and Enkidu as they stand, and a new passive-only Charisma template takes Arturia's and his (`charisma-passive`, `rank` and `flat`). Renaming Enkidu and Treasury to shared ids waits for Ko-Gil, the third copy. The other reading: rename them now. | TB.*, EC.*, CH.* |
| 28 | Golden Armor is a Skill, not part of Gate of Babylon the NP: **NP Seal does not touch it**, and Skill Seal does not either, since it is passive. Magic Resistance stays at C in every case the board offers, so the E block is never in force; MR.rank is read off the sheet. | GA.*, MR.rank |

## Statblock

- [ ] **ST.name** · True Name: Gilgamesh · *Untouched*
- [ ] **ST.class** · Class: Archer (the sheet's folder; no Class line is printed) · *Untouched*
- [ ] **ST.region** · Region: Ancient Mesopotamia, Middle East · *Untouched*
- [ ] **ST.align** · Alignment: Chaotic Good · *Untouched*
- [ ] **ST.param** · STR B, END C, AGI C, MAG B, LUC A · *Untouched*
- [ ] **ST.attr** · Attributes: Male, Servant, [Sky], King, Humanoid (Divine from Divinity) · *Untouched*
- [ ] **ST.hp** · Base Health 1000 (END C, the table agrees) · *Untouched*
- [ ] **ST.mov** · MOV 4 · *Untouched*
- [ ] **ST.range** · Range 4 panels, 1 target · *Untouched*
- [ ] **ST.ba** · Base Attack STR 125, MAG 175 (the tables agree) · *Untouched*
- [ ] **ST.sus** · Sustainability: N/A · *Untouched*
- [ ] **ST.items** · Items held: none · *Untouched*

## Independent Action — Class Skill, Rank A+ *(Passive 1–3)*

- [ ] **IA.1** · *(Passive 1)* Sustainability does not apply · *Untouched*
- [ ] **IA.2** · *(Passive 2)* His Master's ZON is increased by 3 panels · *Untouched*
- [ ] **IA.3** · *(Passive 3)* He cannot be contracted by enemy Casters and Masters · *Untouched*

## Magic Resistance — Class Skill, Rank E *(Passive 1 + 2)*

- [ ] **MR.rank** · Rank E: MAG damage up to MAG E negated, otherwise −10%; debuffs −5%. Raised to C by GA.3 (Q) · *Untouched*
- [ ] **MR.2.death** · The debuff reduction also affects Instakill and Death · *Untouched*
- [ ] **MR.2.str** · …unless the Instakill or Death is from an Attack, Attack Skill, Spell or NP that deals STR damage or is not affected by Magic Resistance · *Untouched*
- [ ] **MR.2.erase** · Erase is completely unaffected · *Untouched*
- [ ] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Untouched*

## Divinity — Rank B *(Passive)*

- [ ] **DI.1** · All damage he deals is increased by 40 · *Untouched*
- [ ] **DI.1.np** · …including NP · *Untouched*
- [ ] **DI.fixed** · The extra damage is dealt as Fixed Divine Damage · *Untouched*
- [ ] **DI.injury** · …and does not count towards the amount required for an Injury Roll · *Untouched*

## Gate of Babylon: Golden Armor *(Passive 1–3)*

- [ ] **GA.1** · *(Passive 1)* All damage taken is reduced by 50% · *Untouched*
- [ ] **GA.1.np** · …if NP, 30% · *Untouched*
- [ ] **GA.2** · *(Passive 2)* He is Immune to Petrify · *Untouched*
- [ ] **GA.3** · *(Passive 3)* His Magic Resistance Rank is increased from E to C (Q) · *Untouched*
- [ ] **GA.mr.neg** · MAG damage from a MAG Rank of up to C is negated · *Untouched*
- [ ] **GA.mr.over** · …otherwise MAG damage taken is reduced by 30% · *Untouched*
- [ ] **GA.mr.np** · …also affects NP · *Untouched*
- [ ] **GA.mr.debuff** · Chance of being inflicted by debuffs is reduced by 15% · *Untouched*

## Charisma — Rank A+ *(Passive)*

- [ ] **CH.1** · All damage dealt by other allied Units within a 2 panel area of himself is increased by 27 · *Untouched*
- [ ] **CH.1.np** · …including NP · *Untouched*
- [ ] **CH.1.self** · …not his own damage (*"other"*) · *Untouched*
- [ ] **CH.neg.atk** · Negated while he has Atk Up (Charisma) (Q) · *Untouched*
- [ ] **CH.neg.seal** · Negated while he is inflicted with Skill Seal · *Untouched*

## The One Who Saw It All — Rank EX *(Active)*

- [ ] **OS.when** · Used during his Turn · *Untouched*
- [ ] **OS.who** · Affects all allies within a 2 panel area of himself, him included (Q) · *Untouched*
- [ ] **OS.atk** · 1. Atk Up for 1◈: all damage dealt +20% · *Untouched*
- [ ] **OS.atk.np** · …if NP, 10% · *Untouched*
- [ ] **OS.sky** · 2. NP DmUp for 1◈ to affected Units with the [Sky] Attribute: NP damage dealt +20% (Q) · *Untouched*
- [ ] **OS.sky.only** · …an affected Unit without [Sky] gets none · *Untouched*
- [ ] **OS.scrit** · 3. S.Crit Up for ⅓◈: Crit Chance +10% · *Untouched*
- [ ] **OS.cd** · Cooldown 4◈ · *Untouched*
- [ ] **OS.cat** · Categorized as 'Charisma': its Atk Up is Atk Up (Charisma) (Q) · *Untouched*

## Golden Rule — Rank A *(Passive + Active)*

- [ ] **GR.p** · Whenever he performs a Crit, his NP Cooldown is reduced by 1 Turn · *Untouched*
- [ ] **GR.p.tb** · …if none of his NPs is on Cooldown, Treasury of Babylon's Cooldown is reduced by 1 Turn instead (Q) · *Untouched*
- [ ] **GR.when** · The Active is used during his Turn · *Untouched*
- [ ] **GR.a** · NP Regen for 1◈: NP Cooldown −2 Turns at the end of every Turn · *Untouched*
- [ ] **GR.cd** · Cooldown 4◈ · *Untouched*

## Treasury of Babylon — Rank EX *(Active)*

- [ ] **TB.when** · Used during his Turn · *Untouched*
- [ ] **TB.1** · His NP Cooldown is reduced by 1◈ · *Untouched*
- [ ] **TB.2** · …then Crit Up for 1◈ on himself: Crit Chance +60% · *Untouched*
- [ ] **TB.cd** · Cooldown 4◈ · *Untouched*

## Gate of Babylon: King's Treasure — Rank E~A++, NP, Anti-Unit *(Passive + Active)*

- [ ] **GB.tag** · [Anti-Unit] · *Untouched*
- [ ] **GB.p** · *(Passive)* Normal Attack damage dealt is increased by 50% (Q) · *Untouched*
- [ ] **GB.p.seal** · …negated while he is inflicted with NP Seal · *Untouched*
- [ ] **GB.dmg** · *(Active)* Base Attack (STR) is used · *Untouched*
- [ ] **GB.area** · Hits a 5x3 or 3x5 panel area in any non-diagonal direction next to him · *Untouched*
- [ ] **GB.who** · Every Unit in the area is hit, allies too (Q) · *Untouched*
- [ ] **GB.rank** · He chooses the NP's Rank (Q) · *Untouched*
- [ ] **GB.A** · Rank A: 4x · *Untouched*
- [ ] **GB.B** · Rank B: 3.5x · *Untouched*
- [ ] **GB.C** · Rank C: 3x · *Untouched*
- [ ] **GB.D** · Rank D: 2.5x · *Untouched*
- [ ] **GB.E** · Rank E: 2x · *Untouched*
- [ ] **GB.plus** · He can add up to two + to the Rank: +100 damage for each (Q) · *Untouched*
- [ ] **GB.cost** · His Master pays the NP cost at the chosen Rank (Q) · *Untouched*
- [ ] **GB.dice** · Each affected enemy rolls a d20 for each Rank of NP used (Q) · *Untouched*
- [ ] **GB.enemy** · …only enemies roll; an ally hit rolls none (Q) · *Untouched*
- [ ] **GB.1** · 1: Curse (Q) · *Untouched*
- [ ] **GB.2** · 2: Burn for 2◈ · *Untouched*
- [ ] **GB.3** · 3: Shock for 2◈ · *Untouched*
- [ ] **GB.4** · 4: Poison (Q) · *Untouched*
- [ ] **GB.5** · 5: Stun for 1◈ · *Untouched*
- [ ] **GB.6** · 6: Freeze (Q) · *Untouched*
- [ ] **GB.6.cf** · …three or more 6s: Crystalfreeze instead (Q) · *Untouched*
- [ ] **GB.7** · 7: Slow for 1◈ · *Untouched*
- [ ] **GB.8** · 8: Immobilize for 1◈ · *Untouched*
- [ ] **GB.9** · 9: Disable for 1◈ · *Untouched*
- [ ] **GB.10** · 10: NP Seal for 1◈ · *Untouched*
- [ ] **GB.11** · 11: Bleed for 1◈ · *Untouched*
- [ ] **GB.12** · 12: Sleep (Q) · *Untouched*
- [ ] **GB.12.nm** · …three or more 12s: Nightmare instead (Q) · *Untouched*
- [ ] **GB.13** · 13: Seal for 1◈ (Q) · *Untouched*
- [ ] **GB.14** · 14: Blind for 1◈ · *Untouched*
- [ ] **GB.15** · 15: Silence for 1◈ · *Untouched*
- [ ] **GB.16** · 16: Addle for 1◈ (Q) · *Untouched*
- [ ] **GB.17** · 17: Gashed for 1◈ (Q) · *Untouched*
- [ ] **GB.18** · 18: Deafen for 1◈ (Q) · *Untouched*
- [ ] **GB.18.mag** · …its magnitude starts at 1 and rises by 1 for every extra 18 (Q) · *Untouched*
- [ ] **GB.19** · 19: Dragonblight for 1◈ · *Untouched*
- [ ] **GB.20** · 20: Crystallize for 1◈ (Q) · *Untouched*
- [ ] **GB.same** · A number rolled more than once lands its debuff that many times · *Untouched*
- [ ] **GB.same.ext** · …a debuff that does not stack has its duration extended instead · *Untouched*
- [ ] **GB.cd** · Cooldown 3◈ at Rank E · *Untouched*
- [ ] **GB.cd.rank** · …+1◈ for every increase in Rank (Q) · *Untouched*
- [ ] **GB.cd.plus** · …+⅓◈ for every + added (Q) · *Untouched*
- [ ] **GB.round** · The Active cannot be used on the same Round as Enuma Elish (Q) · *Untouched*

## Enuma Elish: The Star of Creation that Split Heaven and Earth — Rank EX, NP, Anti-World

- [ ] **EE.tag** · [Anti-World] · *Untouched*
- [ ] **EE.dmg** · Base Attack (MAG) is used · *Untouched*
- [ ] **EE.area** · Hits a 3x6 or 6x3 panel area in any non-diagonal direction (Q) · *Untouched*
- [ ] **EE.who** · Every Unit in the area is hit, allies too · *Untouched*
- [ ] **EE.x5** · 5x damage · *Untouched*
- [ ] **EE.servant** · Damage dealt to Servants is further increased by 100% (Q) · *Untouched*
- [ ] **EE.except** · …except the Servants on the list (Q) · *Untouched*
- [ ] **EE.except.karl** · …the struck Karl der Große is not exempt (Q) · *Untouched*
- [ ] **EE.cd** · Cooldown 8◈ · *Untouched*
- [ ] **EE.round** · Cannot be used on the same Round as Gate of Babylon's Active (Q) · *Untouched*
- [ ] **EE.rm.when** · Its Reality Marble effects land at the end of the Damage Step (Q) · *Untouched*
- [ ] **EE.rm.end.ubw** · Used while he is inside Unlimited Blade Works: it is forcefully ended (Q) · *Untouched*
- [ ] **EE.rm.end.chaos** · …inside Chaos Labyrinthos · *Untouched*
- [ ] **EE.rm.end.duel** · …inside Diatrekhōn Astēr Lonkhē: Duel Field · *Untouched*
- [ ] **EE.rm.end.ramesseum** · …inside Ramesseum Tentyris · *Untouched*
- [ ] **EE.rm.end.rest** · …inside Depletion Garden, Golem Keter Malkuth, Ionioi Hetairoi, Papiyas, Puppet Playground, Shimabara Jigoku, Overload, Aestus Domus Aurea or Hakuro Jyou no Hyakki Hachitendou-sama (Q) · *Untouched*
- [ ] **EE.bug.seal** · A DU with Bug Space who is affected: Skill Seal (Ea) for 3◈ (Q) · *Untouched*
- [ ] **EE.bug.remove** · …and every effect Bug Space caused is removed from all Units (Q) · *Untouched*
- [ ] **EE.ea.unremovable** · Skill Seal (Ea) and NP Seal (Ea) are Unremovable (Q) · *Untouched*
- [ ] **EE.ea.ignores** · …ignore Debuff Immune and Resist effects on the DU (Q) · *Untouched*
- [ ] **EE.ea.only** · …affect only the ability listed; the DU's other Skills and NPs stay usable (Q) · *Untouched*
- [ ] **EE.ea.passive** · …negate all its effects, its Passive effects included (Q) · *Untouched*
- [ ] **EE.np.airavata** · A DU with Airavata King Size who is affected: NP Seal (Ea) for 3◈ (Q) · *Untouched*
- [ ] **EE.np.sterrennacht** · …with De Sterrennacht · *Untouched*
- [ ] **EE.np.rest** · …with Alf Layla wa-Layla, Chariot My Love, Cursed Cupid Cleanser, Dimension of Steam, Emotional Engine - Full Drive, Metabole Piglets, Tsumukari Muramasa, Unlimited Lost Works or Lai Rhyme Goodfellow (Q) · *Untouched*
- [ ] **EE.np.remove** · …and every effect that NP caused is removed from all Units (Q) · *Untouched*
- [ ] **EE.muryan.use** · Caught within Bug Space, during his Player's Turn, he can use Enuma Elish if it is not on Cooldown (Q) · *Untouched*
- [ ] **EE.muryan.count** · …it counts towards the number of Units which Attack during this Turn (Q) · *Untouched*
- [ ] **EE.muryan.release** · …every Unit in Bug Space is released onto random panels within a 2 panel area of the DU (Q) · *Untouched*
- [ ] **EE.muryan.seal** · …the DU is inflicted with NP Seal (Ea) for 3◈ (Q) · *Untouched*
- [ ] **EE.muryan.remove** · …and every effect the NP caused is removed from all Units (Q) · *Untouched*
- [ ] **EE.nf.tokens** · A DU with Nameless Forest who is affected: every Nameless Forest Token is removed from all Units (Q) · *Untouched*
- [ ] **EE.nf.seal** · …then the DU is inflicted with NP Seal (Ea) for 3◈ · *Untouched*
- [ ] **EE.other.area** · Another ability with "Reality Marble" in its name that deploys an area: ended if he uses Enuma Elish within it (Q) · *Untouched*
- [ ] **EE.other.seal** · …one that does not: its bearer, if affected, gets Skill Seal (Ea) and/or NP Seal (Ea) for 3◈ (Q) · *Untouched*

## Enkidu: Chains of Heaven — Rank ???, Anti-Unit/Anti-Divine

- [ ] **EC.target** · Range 3, one DU · *Untouched*
- [ ] **EC.dmg** · Base Attack (STR), normal damage · *Untouched*
- [ ] **EC.stun** · 50% chance of Stun for 1◈ · *Untouched*
- [ ] **EC.EX** · Against a DU with Divinity EX: damage +150%, Stun chance +100% · *Untouched*
- [ ] **EC.A** · …Divinity A: damage +100%, Stun chance +50% · *Untouched*
- [ ] **EC.B** · …Divinity B: damage +80%, Stun chance +40% · *Untouched*
- [ ] **EC.C** · …Divinity C: damage +60%, Stun chance +30% · *Untouched*
- [ ] **EC.D** · …Divinity D: damage +40%, Stun chance +20% · *Untouched*
- [ ] **EC.E** · …Divinity E: damage +20%, Stun chance +10% · *Untouched*
- [ ] **EC.divine** · A DU with the 'Divine' Attribute but no Divinity Skill counts as Rank A · *Untouched*
- [ ] **EC.immune** · Against a 'Divine' DU, Debuff Immune effects cannot prevent the Stun, even Stun-specific ones · *Untouched*
- [ ] **EC.resist** · …Debuff Resist still reduces its chance · *Untouched*
- [ ] **EC.free** · Does not decrease his Master's Health · *Untouched*
- [ ] **EC.cd** · Cooldown 5◈ · *Untouched*
