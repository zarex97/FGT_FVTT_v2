# Summer Habetrot (Pretender) — the Clause list

*Habetrot, Shisa*, the Pretender, built from `char_orig_sheets/by-class/Pretender/Summer Habetrot.md`. Started by the
user 2026-10-30.

**Audit opened 2026-10-30 (#359).**
**Read by hand, line by line.** No generated draft was used. No older `Copia de` sheet exists to compare with. The
sheet prints no Class line (the folder's: Pretender), no `N.Atk Type` and no `{R}`/`{M}`/`{S}` tags. *Habetrot*
(Rider) is another Servant with her own sheet and is not read here; *Bryn (Summer)* and *Brynhildr* only name her.

**Re-read 2026-10-30 from the coloured sheet** the user exported (`SummerHabetrot.html`, Google Docs HTML). Its
words match the repo copy exactly, word for word; the colours are what the Markdown lost. Three colours besides black:

- **Pink** (`#e380cd`) is *"this colour"* of SF.4, the Shisarot Form's. It marks the Form's name wherever it is
  printed, and four values: Decoy *(1◈)*, Dmged NP Regen *(1◈)*, Max HpUp *(2◈)*, and Yanamun Reversal's *(4x4)*.
  Nothing else is pink: no other value changes with the Form.
- **Blue** (`#0000ff`) and **purple** (`#9900ff`) are read as black (ruling 40). Purple holds the two *"(e.g. …)"*
  examples, in Guardian Faerie 2 and Great Decisive Battle 3.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own. A pink value is its own Clause, ending `.up`.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Pretender/Summer Habetrot"`, each confirmed by
reading:

- **Shisarot Form** is Sieg's Fafnir (`sieg-akafiloga-fafnir`) nearly letter for letter: `MaxDelta` with the current
  paid once (`percentOfCurrent`), `StatDelta attributes: [large]`, `SizeStep`, `ForbidReaction block`,
  `CheckModifier rollFactor: 2` on agility and evade, `GrantedAbility ignoresOccupancy` with `Knockback arrival`. Its
  range bands are Bridal Chest's `NormalAttackComponent`. It is a mode held for a duration, not an Activation NP.
- **Pretender: The One who Wears a Role** is shared word for word by Hephaestion, Kumonryuu Eliza, Lady Avalon, Oberon
  and others: it becomes a `class-pretender` template, as Alter Ego's did the day a second Alter Ego arrived. Its
  passive is `class-alter-ego` with the signs flipped on one half (`target:skill:alterEgo`; `defer: true` for the
  incoming half). *"A standard Servant Class"* is `STANDARD_CLASSES` (U-Olga Marie, #328); the Class pick is a
  `Predicate.option = class`.
- **Riding A** is the `class-riding` template at A: +5 MOV, 3◈, its three Passives unlocked by the Active
  (`riding-unlocks`), the MOV Up not a buff.
- **Item Construction E-** is the Item Construction table at E−5: 5%, Instakill and Death 0 (Van Gogh's
  `item-construction-gogh` shape, an `Aura` radius 2 `highestOnly` in group `itemConstruction`).
- **Swimsuit!** is Anastasia (Summer)'s `anastasia-summer-swimsuit`, word for word: the element-scoped Total cut
  (stage 15).
- **The Evade −1d12** is Penthesilea's `CheckModifier` with a die (`penthesilea-goddess-of-war`).
- **Glam Sight** is the `critResUp` effect's rule, held as a passive.
- **Sacred Guardian Beast**: Decoy is `decoy.yml`; Guts is `guts.yml` at 30%; S.Crit Up is the #132 aura
  (`s-crit-up.yml`); Dmged NP Regen is Appendix A's row (*"NP cooldown −X at the end of a Damage Step in which this
  unit was successfully attacked"*), not yet an effect file.
- **Yanamun Reversal**: Dmg Up (Demonic/Undead) are Yan Qing's attribute Dmg Ups; Volatile Debuff Immune is
  `v-debuff-immune.yml`; Max HpUp is Sieg's `max-hp-up.yml` sized off `@self.baseHealth`; Debuff ResDwn is
  Scáthach's; Skill Seal is `skill-seal.yml`; the area in front of her is Excalibur's `selfEdgeAdjacent`.
- **Great Decisive Battle**: *"Restores 3 Agility"* is EMIYA's `resource` phase; Atk Up and NP DmUp are the built ones.
- **Chibirā Sanu**: *"further increased by 150%"* against Large is Antares Snipe's `conditionalMultipliers` ×2.5.
- **Ocean Stirring Lion's Roar**'s *"NP Cooldown is Reset"* is U-Olga Marie's Flawlessness (`restart: true`), a reading
  ruled for her (#328 ruling 13) and carried here only by the user's word (reading 34).
- **Divine Beast's Rage**: E.Atk Up is U-Olga Marie's `eAtkUp`; NP DmUp *"for 1 time"* is Scáthach's/Nemo's charge.
- **Great Tropical Fireball**: Burn is `burn.yml`; *"50% extra damage"* is the ability's own ×1.5 (#193 reading 12).
- **Shiisaa Beam**: the area is a `selfEdgeAdjacent` rectangle; Def Dwn (Total) is a stage-15 cut, new as a named effect.
- **The Command Spell transforms** are Danzō's `additionalCosts: commandSpell` paid by her Master, or a catalogue
  Command Spell gated on her (reading 7).

What she needs that nobody has yet, each to be built as a generic piece:

- **A mode held for a duration that several doors open** (SF.*): the NP, a Command Spell, and extended by the NP, by a
  Command Spell at its end and by a passive.
- **A Servant-specific Command Spell** (SH.3, SF.11): one only her Master is offered, for her.
- **A prompt to a Master as a mode is about to end** (SF.11.when), with a way to pass.
- **Values that change with a mode** (SF.4): Durations and an area's size read off the bearer's mode.
- **Allied-area actives narrowed to herself by a mode** (SF.5), the S.Crit Up aura among them.
- **An Injury Roll threshold per Unit** (SF.6): #310, open.
- **A Normal Attack that hits an area and knocks its DUs back** (SF.9.area, SF.9.kb).
- **Damage modifiers keyed on a Skill or Class negated for the DU** (GF.2).
- **Guardian Faerie's "nearest allied Unit"** (GF.who): an aura that reaches the nearest ally only.
- **Atk Up stacks counted off her Crit Chance** (GD.3), **NP DmUp per 300 Max Health** (GD.4), **NP DmUp per enemy in
  an area** (NP.1), **Atk Up per ally in an area** (NP.2).
- **A counter gained on each non-Attack Skill, spent at 3** (DB.*).
- **A passive that fires at her Turn's start while her NP is ready** (OS.when).
- **A Crit Up whose figure falls as its stacks are spent** (OS.4).
- **A charge on her next Attack, granted by an extension** (SF.11.next).
- **Dmged NP Regen** (SG.2) and **Def Dwn (Total)** (BM.def) as effect files.
- **The Regions of her sheet** (ST.region): neither Fairy Britain nor Scotland is in the graph.

**194 Clauses** across 14 Abilities, the NP with its Shisarot Form passive, and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- The **Note** under the statblock: it restates SH.1 word for word and is read there.
- *"(Shisarot)"* before every Ability's name: the bearer's label, as *"(Dante)"*, *"(Faker)"* and *"(Eliza)"* are on
  their sheets (reading 1). Each Ability's own gate is a Clause.
- *"Has the following effects-"*, *"First, has the following effects-"*, *"Next,"*, *"The next two effects are applied
  to…"*, *"Habetrot gains the following effects while in Shisarot Form-"*: headings. *"The next two effects"* gives
  YR.6 and YR.7 their subject and area and is read there.
- *"Swimsuit!"*, *"A Strange Giant Shadow was Sighted on Majimun Island"*, *"The Lion's Gallant Figure that Stirs the
  Seas"*: titles.
- SF.4 (*"The effects of some Skills are upgraded to the values in this colour"*) and SF.5 as rules of their own: each
  is carried by the Clauses it changes, which fail one by one: SF.4 by the four pink values (SG.1.up, SG.2.up,
  YR.4.up, YR.geom.up), SF.5 by SG.4.form and YR.form.
- The two purple examples: *"(e.g. deals extra damage to Units with 'Existence outside the Domain'.)"* under GF.2, and
  *"(e.g. Crit Chance is 65%, 65%-50%=15%, Atk Up is applied 3 times.)"* under GD.3. Each is a figure GF.2 and GD.3
  are pressed against, not a rule of its own.
- `Items held:`: an empty slot.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6); here they agree with the sheet: BA(STR) 115
at STR B− (125 − 10), BA(MAG) 150 at MAG C, Health 1000 at END C++ (the `++` on the display, Asterios's) · Riding A
is +5 MOV and 3◈ by its table · Item Construction E− is 5% by its table (E 10 − 5), Instakill and Death 0 ·
*"a standard Servant Class"* is one of the seven (`STANDARD_CLASSES`, #328) · *"N% extra damage"* is the ability's
own ×(1 + N%) (#193 reading 12) · *"further increased by 150%"* against an Attribute is a ×2.5 conditional multiplier
(Antares Snipe) · *"Total damage"* is stage 15 (Appendix A) · durations count from the Turn after the Turn of use
(#187 reading 5) · *"all allied Units"* includes the user unless the sheet says *"other"* · *"within a N panel area
of herself"* includes her unless the sheet says *"other"* (#132) · S.Crit Up is an aura its holder carries, reaching
allies within 2 (#132) · two different effects of one family stack (#230 reading 4) · *"Inflicts"* with no chance is
the effect's base 100%, resisted as usual (Ch. 15) · riders land on a hit, not a hurt (§46.4-LI) · *"restores"* stops
at the maximum · a Servant's Normal Attack band by distance is EMIYA's (`rules/normal-attack.mjs`) · *"NP Cooldown"*
naming no NP reaches every NP (#197 reading 6) · *"Skill Cooldown"* reaches every Skill, Class Skills included, and
no NP · Crit Up and its kin do not touch an NP's Crit Chance unless stated (Ch. 13) · a mode's maximum Health falls
when it ends and the current only to fit (Sieg #345 ruling 14) · the class affinity table does not exist: no
damage modifier is keyed on Class unless an effect authors it · a sheet binds only its owner.

## Readings to settle

Asked by grilling 2026-10-30; asked again after the coloured re-read, with reading 13 narrowed and reading 40 added.

**Round 1, ruled 2026-10-30 (the user): 39 of 40 as recommended.** Reading 19: the purple figure is an example only.
Reading 40: blue and purple are read as black; pink is the one colour that carries a rule. Reading 13 was not
answered in round 1.

**Round 2, ruled 2026-10-30 (the user): reading 13 as recommended.** The frontier is empty: every reading is ruled.
**40 readings ruled.**

| # | Ruling | Clauses |
|---|---|---|
| 1 | *"(Shisarot)"* before each Ability's name is the bearer's label, as *"(Dante)"* is on Dante's: every Ability holds in both forms unless it states its own gate (Divine Beast's Rage, Ocean Stirring, the two Attack Skills). | SW.both, every Ability |
| 2 | *"Habetrot, Shisa"* is one True Name as printed: one Notebook page reveals both names. | ST.name |
| 3 | Her Regions are two new ones, `fairyBritain` and `scotland`: Scotland borders England, Fairy Britain borders nothing (the Moon's way). The other reading is `[england, scotland]`. | ST.region |
| 4 | Outside the Form, Water only at Range 2 or more; in the Form her Normal Attack carries no element (SF.9 drops the word). | SH.1.water, SF.9.mag |
| 5 | Glam Sight's −5% reaches every Attack on her, but not an NP's Crit Chance (Ch. 13: Crit kin touch no NP unless stated). | GL.crit |
| 6 | The Command Spell transform is one only her Master is offered, for her, in her side's Turn (`ownTurn`, Full Cooldown's window). The other reading is `anyTime`. | SH.3, SH.3.when |
| 7 | It is refused while she is in the Form; it costs one Command Spell and nothing else: no NP use, no NP Cooldown, no Master Health. It still brings SF.10's Pretender. | SH.3.inform, SH.3.cost |
| 8 | Skill Seal inflicted on her removes every Pretender effect she holds, the Form's included; the Form goes on, and the Active may be used again. A transform while she is Skill Sealed brings no Pretender. | PR.seal, SF.10 |
| 9 | Transforming while she holds the Active's Pretender (>X): the Form's replaces it, so she holds one Pretender at a time, as the Active's gate keeps her. The other readings: both stand; or the Form's is skipped. | SF.10.both |
| 10 | Riding Attack in the Form: her path is two panels wide, each Unit in it struck once; the Form's 2×2 and knockback do not add to it. | RD.ra.form |
| 11 | Guardian Faerie's second Unit is the allied Unit nearest her footprint other than her Master, a Master or a summon included; at a tie every tied Unit gains it; re-read as Units move. Both must stand within 2 of her. | GF.who, GF.range |
| 12 | GF.2 negates the AU's damage-dealt effects keyed on the DU's Skill or Class: Alter Ego's, Pretender's passive and (>X), Dmg Up (Standard). Not one keyed on an Attribute, Alignment, Region or element. | GF.2 |
| 13 | The four pink values are the Form's (the coloured sheet settles which). Each is read at the use: in the Form then, the pink one; an effect keeps the duration it landed with if she then leaves or enters the Form. | SG.1.up, SG.2.up, YR.4.up, YR.geom.up |
| 14 | Dmged NP Regen: at the end of each Damage Step in which she was hit (not Evaded, not missed), every cooling NP −1◈; 0 damage counts; an area Attack catching her is one. | SG.2.hit |
| 15 | Guts revives her at 30% of her Max Health then (600 in the Form); the Form survives the revival with what remains of it. The other reading: the Form ends at her defeat. | SG.3.revive, SF.defeat |
| 16 | In the Form, Sacred Guardian Beast's S.Crit Up is an aura reaching herself only (a sibling of `sCritUp`, as `sCritUpOthers` is), and Yanamun Reversal's effects 1–5 land on herself only. | SG.4.form, YR.form |
| 17 | Max HpUp's *"30% of its original value"* is 30% of each Unit's base Max Health (`@self.baseHealth`): hers is 300 in either form. | YR.4.max |
| 18 | Yanamun Reversal's area is Excalibur's `selfEdgeAdjacent`: a 3×3 (4×4 in the Form) against one of her four sides, touching her, centred on her; a 4×4 against her two-wide side overhangs one panel each way. | YR.geom |
| 19 | Great Decisive Battle 3 reads her Crit Chance for a non-NP Attack at the use: ⌊(C − 50) / 5⌋ Atk Ups, 0 to 10. | GD.3 |
| 20 | *"Every 300 Max Health on Shisarot"* is her own live Max Health at the use, in either form: ⌊max / 300⌋ × 10% (1000 → 30%, 2000 → 60%). | GD.4 |
| 21 | NP 1 counts enemy Units, Masters and summons included, within 3 of her at the use, before she transforms. | NP.1 |
| 22 | NP 2's X counts allied Units within 2 of her, herself included (#132), before she transforms: alone, Atk Up 20%, NP 10%. The other reading: herself excluded, alone 10%, NP 0%. | NP.2, NP.2.x |
| 23 | The NP's order is buffs, then the transform, then the hit: the hit is struck from her 2×2 (its Range from there), as Large, with SF.10's Pretender picked first. | NP.form, NP.area |
| 24 | Used in the Form, the NP adds 3◈ to what remains; it brings no new Pretender, as it is no transform. | NP.extend |
| 25 | The NP, her Form's Normal Attack, Great Tropical Fireball and Shiisaa Beam catch every Unit in their area but herself, allies included (Caladbolg's, Raitei's #353 reading 8). The other reading: enemies only. | NP.area, SF.9.area, TF.area, BM.area |
| 26 | She grows to 2×2, from her panel into one of the four 2×2 squares that hold it, her player's pick, with Units there knocked back as SF.8 says; leaving the Form, she shrinks onto one of her four panels, her player's pick. | SF.1 |
| 27 | Her current Health doubles as she transforms (Sieg's `percentOfCurrent`). | SF.3.cur |
| 28 | *"Agility Roll"* is the Injury Roll; its threshold is 200 in the Form. #310 says her sheet reads *"Injury Roll"*: this copy reads *"Agility Roll"*, like Tamamo Cat's. | SF.6 |
| 29 | *"When she performs an Agility Check, double the roll"* includes her Evade, as Sieg's two `CheckModifier`s do. | SF.7.evade |
| 30 | The Form's Normal Attack: the 2×2 has a panel within her Range; STR or MAG is read per DU, by its distance from her nearest panel; each DU hit (not Evaded) is pushed 1 panel straight away from her, and a blocked push stops. | SF.9.band, SF.9.area, SF.9.kb |
| 31 | The extension is a prompt to her Master at the end of the Turn the Form would end, before it ends, with a Pass, offered every time. Extended: every cooling Skill −1◈, no NP; her next Attack ×2 (NP ×1.5), a charge spent by one declaration and all its Processes, kept past the Form until spent. | SF.11.* |
| 32 | A non-Attack Skill is a Skill or Class Skill she uses by its press: Pretender, Riding, Sacred Guardian Beast, Yanamun Reversal, Great Decisive Battle. Not an NP, an Attack Skill, a Command Spell, or Ocean Stirring firing by itself. | DB.p1 |
| 33 | Shiisaa Counters are lost when the Form ends. | DB.keep |
| 34 | DB 4 and SF.11's cut reach every cooling Skill, the one that brought the third Counter included. | DB.4, SF.11.cd |
| 35 | *"NP Cooldown is Reset"* puts her NP on its full Cooldown, 8◈, as U-Olga Marie's Flawlessness (#328 ruling 13, ruled for her alone): so Ocean Stirring fires once per NP cycle. The other reading, Cooldown to 0, does nothing when its gate holds. | OS.1 |
| 36 | Ocean Stirring fires at the start of her own side's Turn, by itself, no prompt, with its line on the card. | OS.when |
| 37 | S.Crit Up (Shiisa) gives her +5% per stack left, held by herself only (no aura); each Attack she makes, one declaration, spends one stack. The other readings: a stack per Crit; a stack per Process. | OS.4.crit, OS.4.spend |
| 38 | Shiisaa Beam is two wide and five deep, or five wide and two deep, against any of her sides and touching it, her player's pick of shape, side and slide along it. | BM.area |
| 39 | Great Tropical Fireball's 4×4 has a panel within her Range, 3, read from her footprint. | TF.area |
| 40 | Blue text is rule text like black: no rule of its own, and nothing about the Form. Riding's blue Passives are the template's, usable only on a Turn the Active was used; Yanamun Reversal's blue sentence is effects 6–7's area; *"(i.e. 200)"* is SF.6's figure. | RD.*, YR.geom, SF.6 |

## Statblock

- [ ] **ST.name** · True Name: Habetrot, Shisa (Q) · *Untouched*
- [ ] **ST.class** · Class: Pretender (the sheet's folder; no Class line is printed) · *Untouched*
- [ ] **ST.region** · Region: Fairy Country: Britain; Scotland (Q) · *Untouched*
- [ ] **ST.align** · Alignment: Neutral Good · *Untouched*
- [ ] **ST.param** · STR B−, END C++, AGI C, MAG C, LUC C · *Untouched*
- [ ] **ST.attr** · Attributes: Female, Servant, [Earth], Fae, Humanoid, Fairytale, Non-Hominidae, Animalistic · *Untouched*
- [ ] **ST.hp** · Base Health 1000 · *Untouched*
- [ ] **ST.mov** · MOV 5 · *Untouched*
- [ ] **ST.range** · Range 2 panels, 1 target · *Untouched*
- [ ] **ST.ba** · Base Attack STR 115, MAG 150 · *Untouched*
- [ ] **ST.sus** · Sustainability 2◈ · *Untouched*
- [ ] **ST.items** · Items held: none · *Untouched*

## Swimsuit! *(Passive)*

- [ ] **SW.water** · All Total Water damage she receives −50% · *Untouched*
- [ ] **SW.np** · …including NP · *Untouched*
- [ ] **SW.both** · …in both forms (Q) · *Untouched*

## A Strange Giant Shadow was Sighted on Majimun Island *(Passive)*

- [ ] **SH.gate** · Its effects hold only while she is not in Shisarot Form · *Untouched*
- [ ] **SH.1.str** · At a Range of 1, her Normal Attacks use BA(STR) · *Untouched*
- [ ] **SH.1.mag** · At a Range of 2 or higher, her Normal Attacks use BA(MAG) · *Untouched*
- [ ] **SH.1.water** · …and deal Water damage (Q) · *Untouched*
- [ ] **SH.2** · Her Evade rolls −1d12 · *Untouched*
- [ ] **SH.2.die** · …the d12 rolled at each Evade and shown on the card · *Untouched*
- [ ] **SH.2.other** · …no other Agility Check roll is touched · *Untouched*
- [ ] **SH.3** · Her Master can spend one Command Spell to transform her into Shisarot Form (Q) · *Untouched*
- [ ] **SH.3.dur** · …for 3◈ · *Untouched*
- [ ] **SH.3.when** · …offered in the window the reading settles, to her Master only (Q) · *Untouched*
- [ ] **SH.3.inform** · …not offered while she is already in Shisarot Form (Q) · *Untouched*
- [ ] **SH.3.cost** · …one Command Spell from her Master's pool, and nothing else: no NP use, no NP Cooldown, no Master Health (Q) · *Untouched*

## Pretender: The One who Wears a Role *(Passive + Active)*

- [ ] **PR.ae.dealt** · *(Passive)* Damage she deals to Units with the 'Alter Ego' Skill +50% · *Untouched*
- [ ] **PR.ae.taken** · …damage she takes from them −50% · *Untouched*
- [ ] **PR.ae.np** · …both including NP · *Untouched*
- [ ] **PR.out.dealt** · Damage she deals to Units with the 'Outsider' Attribute and/or the 'Existence Outside the Domain' Skill −50% · *Untouched*
- [ ] **PR.out.taken** · …damage she takes from them +50% · *Untouched*
- [ ] **PR.out.np** · …both including NP · *Untouched*
- [ ] **PR.out.or** · …a Unit with both the Attribute and the Skill is counted once · *Untouched*
- [ ] **PR.negate** · While she has any 'Pretender' effect, the Passive is negated · *Untouched*
- [ ] **PR.when** · *(Active)* Used during her Turn · *Untouched*
- [ ] **PR.pick** · First she chooses a standard Servant Class · *Untouched*
- [ ] **PR.apply** · Applies 'Pretender (>X)' to herself, X the chosen Class · *Untouched*
- [ ] **PR.dur** · …for 2◈ · *Untouched*
- [ ] **PR.dealt** · Pretender (>X): damage she deals to Servants of Class X +50% · *Untouched*
- [ ] **PR.taken** · …damage she takes from them −50% · *Untouched*
- [ ] **PR.np** · …both including NP · *Untouched*
- [ ] **PR.status** · The 'Pretender' effect is neither a buff nor a debuff · *Untouched*
- [ ] **PR.unrem** · …and Unremovable · *Untouched*
- [ ] **PR.seal** · …unless she is inflicted with Skill Seal: then it is removed from her (Q) · *Untouched*
- [ ] **PR.cd** · Cooldown 4◈ · *Untouched*
- [ ] **PR.gate** · Cannot be used while she has a 'Pretender' effect · *Untouched*

## Riding — Class Skill, Rank A *(Active + Passive 1–3)*

- [ ] **RD.when** · *(Active)* Used during her Turn · *Untouched*
- [ ] **RD.mov** · MOV +5 for this Turn · *Untouched*
- [ ] **RD.unlock** · Double Move, Riding Attack and Passenger Seat can be used this Turn, and only on a Turn it was used · *Untouched*
- [ ] **RD.cd** · Cooldown 3◈ · *Untouched*
- [ ] **RD.notbuff** · The MOV Up is not a buff: no buff removal removes it · *Untouched*
- [ ] **RD.notbuff.prevent** · …no effect that prevents buffs prevents it · *Untouched*
- [ ] **RD.dm** · *(P1)* Double Move: she can Move twice in her Turn, once before and once after Attacking · *Untouched*
- [ ] **RD.dm.cap** · …the two Moves together no further than her MOV · *Untouched*
- [ ] **RD.ra** · *(P2)* Riding Attack: as her Normal Attack, she Attacks every Unit in her path while Moving in a straight line · *Untouched*
- [ ] **RD.ra.stop** · …she cannot Attack or Move after she stops · *Untouched*
- [ ] **RD.ra.moved** · …if she has Moved this Turn, its distance is her MOV less the panels already Moved · *Untouched*
- [ ] **RD.ra.ps** · …it can be combined with Passenger Seat · *Untouched*
- [ ] **RD.ra.form** · …in Shisarot Form, her path is as wide as she is (Q) · *Untouched*
- [ ] **RD.ps** · *(P3)* Passenger Seat: her Master can Move together with her · *Untouched*
- [ ] **RD.ps.pos** · …after the Move both stand as they stood to each other before · *Untouched*
- [ ] **RD.ps.one** · …it counts as Moving one Unit · *Untouched*

## Item Construction — Class Skill, Rank E− *(Passive 1 + 2)*

- [ ] **IC.area** · It affects every allied Unit within 2 panels of her, herself included · *Untouched*
- [ ] **IC.p1** · *(P1)* Their chance of inflicting debuffs +5% · *Untouched*
- [ ] **IC.p1.excl** · …not Instakill or Death · *Untouched*
- [ ] **IC.p2** · *(P2)* Their chance of being inflicted with debuffs −5% · *Untouched*
- [ ] **IC.p2.excl** · …not Instakill or Death · *Untouched*
- [ ] **IC.stack** · A Unit under several Item Constructions takes only the highest Rank's · *Untouched*

## Glam Sight: Fairy Eyes — Rank E− *(Passive)*

- [ ] **GL.crit** · When she is Attacked, the AU's Crit Chance −5% (Q) · *Untouched*

## Guardian Faerie — Rank EX *(Passive)*

- [ ] **GF.master** · It affects her Master · *Untouched*
- [ ] **GF.who** · …and the allied Unit nearest to her, other than her Master (Q) · *Untouched*
- [ ] **GF.self** · …and not herself · *Untouched*
- [ ] **GF.range** · Each must be within 2 panels of her to gain it (Q) · *Untouched*
- [ ] **GF.1** · Damage they take −10% · *Untouched*
- [ ] **GF.1.np** · …including NP · *Untouched*
- [ ] **GF.2** · When one of them is Attacked, the AU's effects raising damage dealt to Units with a specific Skill or Servant Class are negated for that Unit, when it has that Skill or Class (Q) · *Untouched*
- [ ] **GF.2.only** · …for that Unit only: the AU's other DUs still take them · *Untouched*

## Sacred Guardian Beast — Rank A *(Active)*

- [ ] **SG.when** · Used during her Turn · *Untouched*
- [ ] **SG.1** · Applies Decoy to herself for ⅓◈ · *Untouched*
- [ ] **SG.1.up** · …1◈ in Shisarot Form (Q) · *Untouched*
- [ ] **SG.2** · Applies Dmged NP Regen to herself for ⅓◈ · *Untouched*
- [ ] **SG.2.up** · …1◈ in Shisarot Form · *Untouched*
- [ ] **SG.2.hit** · Dmged NP Regen: her NP Cooldown −1◈ when she is successfully hit by an Attack (Q) · *Untouched*
- [ ] **SG.3** · Applies Guts to herself for 1◈ · *Untouched*
- [ ] **SG.3.revive** · …defeated, she revives with 30% of her Max Health (Q) · *Untouched*
- [ ] **SG.4** · Applies S.Crit Up for ⅓◈ to every allied Unit within 2 panels of her · *Untouched*
- [ ] **SG.4.crit** · …Crit Chance +5% · *Untouched*
- [ ] **SG.4.form** · …in Shisarot Form, to herself only (Q) · *Untouched*
- [ ] **SG.cd** · Cooldown 4◈ · *Untouched*

## Yanamun Reversal — Rank A *(Active)*

- [ ] **YR.when** · Used during her Turn · *Untouched*
- [ ] **YR.area** · Effects 1–5 reach every allied Unit within 2 panels of her, herself included · *Untouched*
- [ ] **YR.form** · …in Shisarot Form, herself only · *Untouched*
- [ ] **YR.1** · Applies Dmg Up (Demonic) for 1◈: damage dealt to Units with the 'Demonic' Attribute +30% · *Untouched*
- [ ] **YR.2** · Applies Dmg Up (Undead) for 1◈: damage dealt to Units with the 'Undead' Attribute +30% · *Untouched*
- [ ] **YR.3** · Applies Volatile Debuff Immune for 1◈ · *Untouched*
- [ ] **YR.4** · Applies Max HpUp for 1◈ · *Untouched*
- [ ] **YR.4.up** · …2◈ in Shisarot Form · *Untouched*
- [ ] **YR.4.max** · …Max Health +30% of its original value (Q) · *Untouched*
- [ ] **YR.4.cur** · …and current Health by the same · *Untouched*
- [ ] **YR.5** · Applies S.Crit Up for ⅓◈: Crit Chance +5% · *Untouched*
- [ ] **YR.geom** · Effects 6–7 reach every enemy Unit in a 3×3 area in any non-diagonal direction next to her (Q) · *Untouched*
- [ ] **YR.geom.up** · …4×4 in Shisarot Form · *Untouched*
- [ ] **YR.6** · Inflicts Debuff ResDwn for 1◈: chance of being inflicted with debuffs +15% · *Untouched*
- [ ] **YR.7** · Inflicts Skill Seal for ⅓◈ · *Untouched*
- [ ] **YR.cd** · Cooldown 4◈ · *Untouched*

## Great Decisive Battle at the Southern Sea — Rank EX *(Active)*

- [ ] **GD.when** · Used during her Turn · *Untouched*
- [ ] **GD.1** · Restores 3 Agility · *Untouched*
- [ ] **GD.2** · Applies Atk Up for 1◈: all damage dealt +40% · *Untouched*
- [ ] **GD.2.np** · …if NP, 30% · *Untouched*
- [ ] **GD.3** · For every 5% of her Crit Chance above 50%, Atk Up for ⅓◈: all damage dealt +5% (Q) · *Untouched*
- [ ] **GD.3.np** · …not NP · *Untouched*
- [ ] **GD.3.max** · …at most 10 stacks · *Untouched*
- [ ] **GD.4** · Applies NP DmUp for ⅓◈: NP damage dealt +10% for every 300 of her Max Health (Q) · *Untouched*
- [ ] **GD.cd** · Cooldown 4◈ · *Untouched*

## Chibirā Sanu・Habetrot: The Lion's Gallant Figure that Stirs the Seas — Rank EX *(NP, Anti-Kaiju)*

- [ ] **NP.rank** · Rank EX, Anti-Kaiju · *Untouched*
- [ ] **NP.ba** · BA(MAG) · *Untouched*
- [ ] **NP.range** · Range +2 for the Combat Process · *Untouched*
- [ ] **NP.1** · First, applies NP DmUp to herself for ⅓◈: NP damage +10% for every enemy Unit within 3 panels of her (Q) · *Untouched*
- [ ] **NP.2** · …and Atk Up for 1◈: all damage dealt +(X+1)0% (Q) · *Untouched*
- [ ] **NP.2.np** · …if NP, X0% · *Untouched*
- [ ] **NP.2.x** · …X the number of allied Units within 2 panels of her (Q) · *Untouched*
- [ ] **NP.form** · Next, she transforms into Shisarot Form for 3◈ (Q) · *Untouched*
- [ ] **NP.extend** · …used in Shisarot Form, its duration is extended (Q) · *Untouched*
- [ ] **NP.area** · Hits a 2×2 area within Range (Q) · *Untouched*
- [ ] **NP.dmg** · …for 5× damage · *Untouched*
- [ ] **NP.large** · …damage to Units with the 'Large' Attribute further +150% (×2.5) · *Untouched*
- [ ] **NP.cd** · Cooldown 8◈ · *Untouched*
- [ ] **NP.cost** · Her Master pays the Rank EX NP's Health · *Untouched*

## Shisarot Form — the NP's Passive

- [ ] **SF.1** · Her size grows from 1 panel to 2 panels (Q) · *Untouched*
- [ ] **SF.2** · She gains the 'Large' Attribute · *Untouched*
- [ ] **SF.3.max** · Max Health +100% of its original value · *Untouched*
- [ ] **SF.3.cur** · …current Health +100% of its value as she transforms (Q) · *Untouched*
- [ ] **SF.3.end** · …when it ends, her maximum falls and her current only to fit · *Untouched*
- [ ] **SF.6** · The damage taken needed to trigger her Injury Roll is doubled: 200 (Q) · *Untouched*
- [ ] **SF.7.block** · She cannot Block · *Untouched*
- [ ] **SF.7.agi** · …her Agility Check rolls are doubled · *Untouched*
- [ ] **SF.7.evade** · …her Evade rolls among them (Q) · *Untouched*
- [ ] **SF.8.move** · She can Move to any panel, occupied ones included · *Untouched*
- [ ] **SF.8.kb** · …each Unit on a panel she Moves into is knocked back 1 panel, until she can stand there · *Untouched*
- [ ] **SF.9.str** · Her Normal Attacks at a Range of 1 use BA(STR) · *Untouched*
- [ ] **SF.9.mag** · …at a Range of 2 or higher, BA(MAG) · *Untouched*
- [ ] **SF.9.band** · …the band read per DU (Q) · *Untouched*
- [ ] **SF.9.area** · Her Normal Attacks hit a 2×2 area (Q) · *Untouched*
- [ ] **SF.9.kb** · …and knock each DU back 1 panel (Q) · *Untouched*
- [ ] **SF.10** · Whenever she transforms into Shisarot Form, she gains a 'Pretender (>X)' effect (Q) · *Untouched*
- [ ] **SF.10.pick** · …she picks X, a standard Servant Class, as she transforms · *Untouched*
- [ ] **SF.10.dur** · …it lasts until she leaves Shisarot Form · *Untouched*
- [ ] **SF.10.both** · …with the Active's Pretender (>X) already held, the reading settles which stands (Q) · *Untouched*
- [ ] **SF.11.when** · When Shisarot Form is about to end at a Turn's end, her Master is offered a Command Spell to extend it (Q) · *Untouched*
- [ ] **SF.11.pass** · …the offer can be passed, and the Form then ends · *Untouched*
- [ ] **SF.11.ext** · …spent, the Form lasts 3◈ more · *Untouched*
- [ ] **SF.11.cd** · …extended so, her Skill Cooldowns −1◈ · *Untouched*
- [ ] **SF.11.next** · …and her next Attack deals 100% extra damage (Q) · *Untouched*
- [ ] **SF.11.next.np** · …if NP, 50% · *Untouched*
- [ ] **SF.11.again** · …offered again every time the Form is about to end (Q) · *Untouched*
- [ ] **SF.dur** · Shisarot Form ends at the end of the Turn its duration runs out · *Untouched*
- [ ] **SF.defeat** · …held through a Guts revival, the reading settles (Q) · *Untouched*

## Divine Beast's Rage *(Passive 1 + 2)*

- [ ] **DB.gate** · In effect only while she is in Shisarot Form · *Untouched*
- [ ] **DB.p1** · *(P1)* Whenever she uses a non-Attack Skill, she gains 1 Shiisaa Counter (Q) · *Untouched*
- [ ] **DB.keep** · …Counters held when the Form ends, the reading settles (Q) · *Untouched*
- [ ] **DB.p2** · *(P2)* At 3 Shiisaa Counters, all are removed at once · *Untouched*
- [ ] **DB.1** · …NP DmUp for 1 use: NP damage +15% · *Untouched*
- [ ] **DB.2** · …Dmg Up (Kaiju) for 1◈: damage dealt to Units with the 'Large' Attribute +30% · *Untouched*
- [ ] **DB.2.giant** · …a DU that is also 'Giant', +30% more (60% in all) · *Untouched*
- [ ] **DB.3** · …E.Atk Up for 1◈: non-NP area damage dealt +30% · *Untouched*
- [ ] **DB.4** · …her Skill Cooldowns −1◈ (Q) · *Untouched*
- [ ] **DB.4.gd** · …Great Decisive Battle's −1◈ more · *Untouched*

## Ocean Stirring Lion's Roar *(Passive)*

- [ ] **OS.gate** · In effect only while she is in Shisarot Form · *Untouched*
- [ ] **OS.when** · At the start of her Turn, if her NP is not on Cooldown, it activates by itself (Q) · *Untouched*
- [ ] **OS.1** · Her NP Cooldown is Reset (Q) · *Untouched*
- [ ] **OS.2** · Applies Atk Up for 2◈: all damage dealt +50% · *Untouched*
- [ ] **OS.2.np** · …if NP, 30% · *Untouched*
- [ ] **OS.3** · Applies Dmg Up (Large) for 2◈: damage dealt to Units with the 'Large' Attribute +50% · *Untouched*
- [ ] **OS.4** · Applies S.Crit Up (Shiisa) for 2◈, 10 stacks · *Untouched*
- [ ] **OS.4.crit** · …Crit Chance +(5 × X)%, X the stacks left (Q) · *Untouched*
- [ ] **OS.4.spend** · …a stack spent as the reading settles (Q) · *Untouched*
- [ ] **OS.5** · Shisarot Form's duration +1◈ · *Untouched*

## Great Tropical Fireball *(Attack Skill)*

- [ ] **TF.atk** · An Attack Skill · *Untouched*
- [ ] **TF.gate** · Only usable in Shisarot Form · *Untouched*
- [ ] **TF.ba** · BA(MAG) · *Untouched*
- [ ] **TF.range** · Range +1 for the Combat Process · *Untouched*
- [ ] **TF.area** · Hits a 4×4 area within Range (Q) · *Untouched*
- [ ] **TF.dmg** · …for 50% extra damage (×1.5) · *Untouched*
- [ ] **TF.burn** · …and inflicts Burn for 2◈ · *Untouched*
- [ ] **TF.fire** · Fire damage · *Untouched*
- [ ] **TF.cd** · Cooldown 3◈ · *Untouched*

## Shiisaa Beam *(Attack Skill)*

- [ ] **BM.atk** · An Attack Skill · *Untouched*
- [ ] **BM.gate** · Only usable in Shisarot Form · *Untouched*
- [ ] **BM.ba** · BA(MAG) · *Untouched*
- [ ] **BM.area** · Hits a 2×5 or 5×2 area in any non-diagonal direction next to her (Q) · *Untouched*
- [ ] **BM.def** · …inflicts Def Dwn (Total) for 1◈: Total damage taken +25% · *Untouched*
- [ ] **BM.nostack** · …it does not stack · *Untouched*
- [ ] **BM.cd** · Cooldown 3◈ · *Untouched*
