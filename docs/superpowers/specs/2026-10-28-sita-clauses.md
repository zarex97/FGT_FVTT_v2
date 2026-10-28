# Sita (Archer) — the Clause list

*Sita*, the Archer, built from `char_orig_sheets/by-class/Archer/Sita.md`. Started by the user 2026-10-28.

**Audit opened 2026-10-28 (#348).**
**Read by hand, line by line.** No generated draft was used. No older `Copia de Sita.md` exists to compare with. The
sheet prints no `N.Atk Type` and no `{R}`/`{M}`/`{S}` tag on its NP.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Archer/Sita"`, each confirmed by reading:

- **Magic Resistance A** is `class-magic-resistance` at A, as Arturia's and Rama's.
- **Independent Action D** is `class-independent-action` at D: the tables give 5◈, ZON +1 and 2 rolls, the figures
  the sheet prints.
- **Goddess's Divine Core**'s +60 and its *"counts as 'Divinity'"* are Kingprotea's and Quetzalcoatl's Skill: the
  `divineCore` table at C (twice Divinity C, 60), the `divinity` category and the `divine` Attribute. Its −20% is a
  literal `ApplicationChance`, as theirs.
- **Janaka**'s Normal Attack is EMIYA's blend (`sources`: STR 1, MAG 0.2) and Arjuna's Agni Gandiva's
  `magicResistanceFactor`. Its *"for each 'Janaka' buff"* is Proliferation's count of instances (`magnitudeStacks`,
  `perStack`). Its trigger is `abilityUsed`, as EMIYA's and Kiritsugu's Magecraft.
- **Jewel of the Earth**'s Def Up is `defUp` with an NP figure; its Debuff Immune is `debuffImmune`.
- **Pilgrimage**'s Decoy is `decoy`, its Invuln *"3 times"* Danzo's counted Invuln (`uses: 3`, `stacking: count`), its
  Burn Immune Karna's `Immunity` on `burn`.
- **Curse of Separation** is Rama's Dream of Reunion (#347): `gutsHealth` at 100 and a `heal` phase at 25% of the
  maximum, plus `regen` at 5%.
- **Haradhanu Janaka**'s cleanse is Kingprotea's Self-Suggestion (`removeEffect`, `selector: {polarity: debuff}`); its
  Heal Up is `healUp` (#260).

What she needs that nobody has yet, each to be built as a generic piece:

- **A counted Debuff Immune** (JE.di.two): *"2 times"*. Sixteen sheets print it (Passionlip, Monte Cristo,
  Nightingale …). Dioscuri's `applications: 1` is one application, not one charge.
- **A buff that changes the Normal Attack's Base Attack by its count** (JA.na, JA.na.per, JA.mr): Euryale's Glitter
  and Kiichi Hougen print the same shape at a fixed half.
- **A buff whose new instance resets its siblings' clocks** (JA.reset).
- **A `Burn Immune` effect** (PA.burn): the generic *"(Name) Immune"*; Summer Nagiko prints it too.

Rama's Curse of Separation summons her (#347, CS.sita, CS.contract, CS.panel). Those three are Rama's Clauses and stay
on his list; they are built and pressed under this audit, on his sheet.

**80 Clauses** across 6 Abilities, the NP and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"its effects are as follows-"*: headings.
- *"Peerless Bow of Reminiscence"*: a title.
- `Items held:`: an empty slot.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6); here they agree with the sheet: BA(STR) 75 at
STR D, BA(MAG) 200 at MAG A, Health 1000 at END C · *"all allied Units"* includes the user unless the sheet says
*"other"* · a Base Attack that combines STR with a share of MAG is a STR attack with a MAG top-up (EMIYA,
`rules/normal-attack.mjs`) · *"the effect of Magic Resistance is halved"* is the DU's Magic Resistance against that
hit, damage only: a negation takes the share off the MAG part, a cut takes the share of its percent (#234 reading
10) · an attack with no delivery tag is measured by its distance (#281) · *"removes all debuffs"* leaves an
Unremovable one (Self-Suggestion) · a counted Invuln spends a charge on every hit it touches, a halved NP included,
none on a pierced hit (#249 reading 40) · Heal Up does not reach Home Base or Command Spell healing (Appendix A) · a
handler on the end of her Turn and the end of a Turn she Acts heals once at one Turn's end (#198 reading 12, Avalon
reading 17).

## Readings to settle

Asked by grilling, 2026-10-28.

## Statblock

- [ ] **ST.name** · True Name: Sita
- [ ] **ST.class** · Class: Archer (the sheet's folder; no Class line is printed)
- [ ] **ST.region** · Region: India
- [ ] **ST.align** · Alignment: Lawful Good
- [ ] **ST.param** · STR D, END C, AGI A, MAG A, LUC EX
- [ ] **ST.attr** · Attributes: Female, Servant, [Sky], Humanoid
- [ ] **ST.hp** · Base Health 1000 (the table at END C)
- [ ] **ST.mov** · MOV 7
- [ ] **ST.range** · Range 4 panels, 1 target
- [ ] **ST.ba** · Base Attack STR 75, MAG 200
- [ ] **ST.na** · Normal Attack: STR (no type printed), its delivery measured by distance
- [ ] **ST.items** · Items held: none

## Magic Resistance — Class Skill, Rank A *(Passive 1 + 2)*

- [ ] **MR.1** · MAG damage from a MAG Rank of up to A is negated
- [ ] **MR.1.over** · …otherwise MAG damage taken is reduced by 50%
- [ ] **MR.1.np** · …also affects NP
- [ ] **MR.2** · Chance of being inflicted by debuffs is reduced by 25%
- [ ] **MR.2.death** · …also affects Instakill and Death
- [ ] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance
- [ ] **MR.2.erase** · Erase is completely unaffected
- [ ] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced

## Independent Action — Class Skill, Rank D *(Passive 1 + 2 + 3)*

- [ ] **IA.sus** · *(P1)* High Sustainability, 5◈
- [ ] **IA.zon** · *(P2)* Her Master's ZON +1 panel
- [ ] **IA.contract** · *(P3)* 2 successful Contract Servant rolls to be contracted by an enemy Master
- [ ] **IA.contract.caster** · …or by an enemy Caster

## Goddess's Divine Core — Rank C *(Passive 1 + 2 + 3)*

- [ ] **DC.1** · *(P1)* All damage dealt +60
- [ ] **DC.1.np** · …including NP
- [ ] **DC.2** · *(P2)* Chance of being inflicted by debuffs −20%
- [ ] **DC.div** · This Skill counts as 'Divinity': a clause that names the Divinity Skill finds it
- [ ] **DC.div.attr** · …and she is Divine to a predicate on the Attribute
- [ ] **JA.when** · *(P3)* Whenever Sita uses a Skill, the 'Janaka' buff on herself (Q)
- [ ] **JA.notskill** · …a Noble Phantasm or a Normal Attack is no Skill: no Janaka (Q)
- [ ] **JA.dur** · …for 1◈ Turns
- [ ] **JA.buff** · Janaka is a buff: buff removal takes it, an effect that prevents buffs refuses it
- [ ] **JA.stack** · Each use adds a Janaka: she holds several at once (Q)
- [ ] **JA.reset** · Whenever a Janaka is applied, every Janaka on her has its duration reset (Q)
- [ ] **JA.na** · Her Normal Attack uses BA(STR) and 20% of BA(MAG) combined (75+40=115) (Q)
- [ ] **JA.na.per** · …the share of BA(MAG) +20% for each Janaka on her (Q)
- [ ] **JA.na.none** · …with no Janaka, BA(STR) alone
- [ ] **JA.na.only** · …her Normal Attack only: her NP and her Skills are unchanged
- [ ] **JA.mr** · The effect of Magic Resistance is reduced to X% (Q)
- [ ] **JA.mr.x** · …X% = the share of BA(MAG) used (Q)

## Jewel of the Earth — Rank A *(Active)*

- [ ] **JE.when** · Used during her Turn
- [ ] **JE.area** · Affects all allied Units within a 2 panel area of herself
- [ ] **JE.self** · …herself included
- [ ] **JE.enemy** · …no enemy Unit (*"allied"*)
- [ ] **JE.defup** · Def Up for 1◈: all damage taken −20%
- [ ] **JE.defup.np** · …if NP, −10%
- [ ] **JE.di** · Debuff Immune for 1◈
- [ ] **JE.di.two** · …2 times (Q)
- [ ] **JE.di.except** · …does not affect Instakill, Death and Erase
- [ ] **JE.cd** · Cooldown 4◈

## Pilgrimage in Agni Pariksha — Rank B *(Active)*

- [ ] **PA.when** · Used during her Turn
- [ ] **PA.decoy** · Decoy on herself for ⅔◈ (Q)
- [ ] **PA.invuln** · Invuln on herself for 1◈
- [ ] **PA.invuln.three** · …3 times
- [ ] **PA.burn** · Burn Immune on herself for 1◈
- [ ] **PA.order** · The three in the sheet's order: Decoy, Invuln, Burn Immune
- [ ] **PA.cd** · Cooldown 4◈

## Curse of Separation — Rank EX *(Active)*

- [ ] **CO.when** · Used during her Turn
- [ ] **CO.guts** · Guts for 1◈: when defeated she is revived
- [ ] **CO.guts.flat** · …with 100 Health, not a percent
- [ ] **CO.heal** · Restores her Health by 25% of its maximum
- [ ] **CO.regen** · Regen on herself for 1◈: 5% of her maximum Health
- [ ] **CO.regen.turn** · …at the end of her Turn
- [ ] **CO.regen.acted** · …at the end of a Turn she Acts, once at one Turn's end
- [ ] **CO.regen.round** · …at the end of the Round
- [ ] **CO.cd** · Cooldown 4◈

## Haradhanu Janaka: Peerless Bow of Reminiscence — Rank B *(NP)* [Anti-Unit]

- [ ] **NP.rank** · Rank B, Anti-Unit
- [ ] **NP.range** · Range 7
- [ ] **NP.target** · One Unit
- [ ] **NP.delivery** · No tag printed: Ranged at a distance of 2 or more, Melee next to her
- [ ] **NP.mag** · Base Attack (MAG) is used
- [ ] **NP.cleanse** · First, removes all debuffs from Sita (Q)
- [ ] **NP.cleanse.unremovable** · …an Unremovable debuff stays
- [ ] **NP.dmg** · …then deals 3.5x damage
- [ ] **NP.healup** · Next, Heal Up on Sita for 1◈ (Q)
- [ ] **NP.healup.50** · …the amount of Health restored to her +50%
- [ ] **NP.healup.reach** · …her Curse of Separation's heal and her Regen included
- [ ] **NP.healup.guts** · …her Guts's 100 Health (Q)
- [ ] **NP.cd** · Cooldown 6◈
