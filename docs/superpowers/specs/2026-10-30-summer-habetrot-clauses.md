# Summer Habetrot (Pretender) — the Clause list

*Habetrot, Shisa*, the Pretender, built from `char_orig_sheets/by-class/Pretender/Summer Habetrot.md`. Started by the
user 2026-10-30.

**Audit opened 2026-10-30 (#359).**
**Pressed live 2026-10-30, 194 of 194** in the War *Habetrot Audit* (Player1 her side, the GM the other), nine
defects fixed live: the band and Decoy read from her anchor corner, Command Spells spent off the Master's Turn, a
Turn's start said nowhere, her ride one row wide and pushing, Def Dwn (Total) named by id, her shrink kept top-left,
one clock said twice, the extension's cuts unsaid (`docs/surprises/2026-10-31-*`). Open, reported: the Shiisaa Counter,
an arrival or growth push, Guardian Faerie's negation, the Form's end and the Crit roll are not said on any card.
Staged where the board would not: Cooldowns, the NP clock, the Form's expiry, Health, positions, a Pretender (>Caster)
on an enemy. SW.np and GF.2.only rest on the data and a second Attacker, not a press of their own.
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

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6): BA(STR) 115 at STR B− (125 − 10) and
BA(MAG) 150 at MAG C agree with the sheet; Max Health is 1200 at END C++, the table beating the sheet's printed 1000
(as Asterios's A++ is 1700; corrected while building, `docs/surprises/2026-10-30-claimed-plus-plus-is-display.md`), and
her *"original"* Max Health is that 1200 (SF.3.max, YR.4.max) · Riding A
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

- [x] **ST.name** · True Name: Habetrot, Shisa (Q) — Observed live 2026-10-30: Player1's sheet: Habetrot, Shisa (concealed)
- [x] **ST.class** · Class: Pretender (the sheet's folder; no Class line is printed) — Observed live 2026-10-30: Player1's sheet: PRETENDER
- [x] **ST.region** · Region: Fairy Country: Britain; Scotland (Q) — Observed live 2026-10-30: Player1's sheet: FAIRY BRITAIN, SCOTLAND
- [x] **ST.align** · Alignment: Neutral Good — Observed live 2026-10-30: Player1's sheet: NEUTRAL GOOD
- [x] **ST.param** · STR B−, END C++, AGI C, MAG C, LUC C — Observed live 2026-10-30: sheet: B- C++ C C C
- [x] **ST.attr** · Attributes: Female, Servant, [Earth], Fae, Humanoid, Fairytale, Non-Hominidae, Animalistic — Observed live 2026-10-30: projection: animalistic, earth, fae, fairytale, female, humanoid, nonHominidae, servant (+ spirit)
- [x] **ST.hp** · Base Health 1000 — Observed live 2026-10-30: baseHealth 1000; sheet 1200 / 1200 (END C++ by the table, as ruled)
- [x] **ST.mov** · MOV 5 — Observed live 2026-10-30: sheet: MOV 5
- [x] **ST.range** · Range 2 panels, 1 target — Observed live 2026-10-30: sheet: RANGE 2, TARGETS 1
- [x] **ST.ba** · Base Attack STR 115, MAG 150 — Observed live 2026-10-30: sheet: BA (STR) 115, BA (MAG) 150
- [x] **ST.sus** · Sustainability 2◈ — Observed live 2026-10-30: sheet: SUSTAINABILITY 2◈
- [x] **ST.items** · Items held: none — Observed live 2026-10-30: sheet: no held Items

## Swimsuit! *(Passive)*

- [x] **SW.water** · All Total Water damage she receives −50% — Pressed live 2026-10-30: Anastasia's Ice Bucket (Water) on her (tick 3): stage 15 'Swimsuit! (Total water) ×0.50'
- [x] **SW.np** · …including NP — Observed live 2026-10-30: her `elementTotalDefUp` carries the NP figure; no enemy on the board had a Water NP to press it with
- [x] **SW.both** · …in both forms (Q) — Pressed live 2026-10-30: same press, in the Shisarot Form

## A Strange Giant Shadow was Sighted on Majimun Island *(Passive)*

- [x] **SH.gate** · Its effects hold only while she is not in Shisarot Form — Pressed live 2026-10-30: Asterios's NA on her in the Form, Player1 Evade (tick 3): no Strange Giant Shadow line on the roll; back after the Form ended (board, tick 24)
- [x] **SH.1.str** · At a Range of 1, her Normal Attacks use BA(STR) — Pressed live 2026-10-30: Player1's NA at Range 1 outside the Form (tick 27): 'Base BA(STR) +115'
- [x] **SH.1.mag** · At a Range of 2 or higher, her Normal Attacks use BA(MAG) — Pressed live 2026-10-30: Player1's NA on Asterios at 2 (tick 1): 'Base BA(MAG) +150'
- [x] **SH.1.water** · …and deal Water damage (Q) — Pressed live 2026-10-30: same NA: the band resolves Water at 2 (`normalAttackAt` water); in the Form none (Fireball's process element fire shows elements are carried)
- [x] **SH.2** · Her Evade rolls −1d12 — Pressed live 2026-10-30: Asterios's NA on her, Player1 Evade (tick 2): 'A Strange Giant Shadow was Sighted on Majimun Island -10' on the evade- roll
- [x] **SH.2.die** · …the d12 rolled at each Evade and shown on the card — Pressed live 2026-10-30: same: the d12 is printed as a flat −10 beside the 1d20, its die not named (noted to the user)
- [x] **SH.2.other** · …no other Agility Check roll is touched — Observed live 2026-10-30: her checkModifiers carry the −1d12 on `evade` only, none on `agility`
- [x] **SH.3** · Her Master can spend one Command Spell to transform her into Shisarot Form (Q) — Pressed live 2026-10-30: Player1's Master bar (tick 3): 'Shisarot Form — Transforms Summer Habetrot into Shisarot Form for 3◈ Turns', spent
- [x] **SH.3.dur** · …for 3◈ — Pressed live 2026-10-30: same: shisarotForm expiry 12 from tick 3
- [x] **SH.3.when** · …offered in the window the reading settles, to her Master only (Q) — Pressed live 2026-10-30: FOUND (tick 3: offered and spent on Faction 2's Turn), FIXED; pressed again on Faction 2's Turn (tick 7): 'A Command Spell is spent from the bar in its Master's own Turn.'; Tamamo's Master never offered it
- [x] **SH.3.inform** · …not offered while she is already in Shisarot Form (Q) — Pressed live 2026-10-30: in the Form her Master's offers (tick 4) list no Shisarot Form
- [x] **SH.3.cost** · …one Command Spell from her Master's pool, and nothing else: no NP use, no NP Cooldown, no Master Health (Q) — Pressed live 2026-10-30: Command Spells 3 → 2, Master Health 288 unchanged, NP cooldown untouched

## Pretender: The One who Wears a Role *(Passive + Active)*

- [x] **PR.ae.dealt** · *(Passive)* Damage she deals to Units with the 'Alter Ego' Skill +50% — Pressed live 2026-10-30: Form NA on Kingprotea, no Pretender held (tick 18): 'Atk Up Pretender: The One who Wears a Role +50%'
- [x] **PR.ae.taken** · …damage she takes from them −50% — Pressed live 2026-10-30: Kingprotea's NA on her, no Pretender held (tick 15): 'Def Up Pretender: The One who Wears a Role −50%'
- [x] **PR.ae.np** · …both including NP — Pressed live 2026-10-30: her NP on Kingprotea (tick 20): 'Atk Up Pretender: The One who Wears a Role +50%'
- [x] **PR.out.dealt** · Damage she deals to Units with the 'Outsider' Attribute and/or the 'Existence Outside the Domain' Skill −50% — Pressed live 2026-10-30: Form NA on Van Gogh (EOTD) (tick 18): 'Atk Dwn Pretender: … −50%'
- [x] **PR.out.taken** · …damage she takes from them +50% — Pressed live 2026-10-30: Van Gogh's NA on her (tick 26): 'Def Dwn Pretender: … +50%'
- [x] **PR.out.np** · …both including NP — Observed live 2026-10-30: the passive's four halves carry npValue 50 (board); no Outsider's NP met her
- [x] **PR.out.or** · …a Unit with both the Attribute and the Skill is counted once — Observed live 2026-10-30: one `or` predicate per half (`target:attribute:outsider` or `target:skill:existenceOutsideTheDomain`): one modifier, counted once
- [x] **PR.negate** · While she has any 'Pretender' effect, the Passive is negated — Pressed live 2026-10-30: Kingprotea (Alter Ego) on her while Pretender (>Berserker) held (tick 2): 'Combined percent +0%'
- [x] **PR.when** · *(Active)* Used during her Turn — Pressed live 2026-10-30: Player1 used it on her Turn (tick 1)
- [x] **PR.pick** · First she chooses a standard Servant Class — Pressed live 2026-10-30: ChoiceDialog: Saber, Archer, Lancer, Rider, Caster, Assassin, Berserker
- [x] **PR.apply** · Applies 'Pretender (>X)' to herself, X the chosen Class — Pressed live 2026-10-30: card 'Pretender (>Berserker)'
- [x] **PR.dur** · …for 2◈ — Pressed live 2026-10-30: expiry 7 from tick 1 (2◈)
- [x] **PR.dealt** · Pretender (>X): damage she deals to Servants of Class X +50% — Pressed live 2026-10-30: NA on Asterios (tick 1): 'Pretender (>Berserker) +50% ×1.50'
- [x] **PR.taken** · …damage she takes from them −50% — Pressed live 2026-10-30: Ice Bucket (tick 3) and Snegleta (tick 15) on her: 'Def Up Pretender (>Archer) −50%'
- [x] **PR.np** · …both including NP — Pressed live 2026-10-30: Snegleta, an NP: 'Def Up Pretender (>Archer) −50%'
- [x] **PR.status** · The 'Pretender' effect is neither a buff nor a debuff — Observed live 2026-10-30: pretenderBerserker polarity status
- [x] **PR.unrem** · …and Unremovable — Observed live 2026-10-30: unremovable true
- [x] **PR.seal** · …unless she is inflicted with Skill Seal: then it is removed from her (Q) — Pressed live 2026-10-30: Snegleta's Skill Seal (tick 15): card 'Skill Seal — Pretender's Pretender (>Archer) is removed by Skill Seal.', the Form held on; the Active used again after (tick 27)
- [x] **PR.cd** · Cooldown 4◈ — Pressed live 2026-10-30: Pretender cooldown 12 (4◈)
- [x] **PR.gate** · Cannot be used while she has a 'Pretender' effect — Pressed live 2026-10-30: cooldown staged 0, held (>Berserker): refused 'Pretender: The One who Wears a Role cannot be used: Its conditions are not met right now.' (generic wording, noted)

## Riding — Class Skill, Rank A *(Active + Passive 1–3)*

- [x] **RD.when** · *(Active)* Used during her Turn — Pressed live 2026-10-30: Player1 used Riding on her Turn (tick 1)
- [x] **RD.mov** · MOV +5 for this Turn — Pressed live 2026-10-30: MOV 5 → 10, ridingActive expiry 1, gone at tick 2
- [x] **RD.unlock** · Double Move, Riding Attack and Passenger Seat can be used this Turn, and only on a Turn it was used — Pressed live 2026-10-30: tick 12 (no Riding): Move, Shiisaa Beam, then Move refused 'This Unit Moved and then Attacked; it cannot Move again this Turn.'
- [x] **RD.cd** · Cooldown 3◈ — Pressed live 2026-10-30: Riding cooldown 9 (3◈)
- [x] **RD.notbuff** · The MOV Up is not a buff: no buff removal removes it — Observed live 2026-10-30: ridingActive polarity status, not a buff
- [x] **RD.notbuff.prevent** · …no effect that prevents buffs prevents it — Observed live 2026-10-30: same: a buff prevention never reads a status
- [x] **RD.dm** · *(P1)* Double Move: she can Move twice in her Turn, once before and once after Attacking — Pressed live 2026-10-30: tick 1: Move, Attack, two more drags allowed
- [x] **RD.dm.cap** · …the two Moves together no further than her MOV — Pressed live 2026-10-30: then an 8-panel drag refused 'This path is 8 panels; 7 remain of MOV 10.'
- [x] **RD.ra** · *(P2)* Riding Attack: as her Normal Attack, she Attacks every Unit in her path while Moving in a straight line — Pressed live 2026-10-30: Riding Attack (tick 6): Kingprotea in her path struck with BA(STR)
- [x] **RD.ra.stop** · …she cannot Attack or Move after she stops — Pressed live 2026-10-30: after it: Move refused 'Riding Attack ends this Unit's Turn; it cannot Move again.'; NA 'Cannot attack: this unit has already attacked this turn'
- [x] **RD.ra.moved** · …if she has Moved this Turn, its distance is her MOV less the panels already Moved — Pressed live 2026-10-30: tick 14: moved 1, the ride's destinations reach 9 panels (MOV 10 − 1)
- [x] **RD.ra.ps** · …it can be combined with Passenger Seat — Pressed live 2026-10-30: rides carried her Master (13,10)→(13,14) and (14,14)→(14,6)
- [x] **RD.ra.form** · …in Shisarot Form, her path is as wide as she is (Q) — Pressed live 2026-10-30: FOUND (tick 6: second row unstruck; the Form's push rode along), FIXED; pressed again (tick 14): Kingprotea and Asterios both struck, no push
- [x] **RD.ps** · *(P3)* Passenger Seat: her Master can Move together with her — Pressed live 2026-10-30: her Move (tick 1) carried her Master (15,9)→(15,10), no Master move spent
- [x] **RD.ps.pos** · …after the Move both stand as they stood to each other before — Pressed live 2026-10-30: each carry kept her Master's offset from her anchor
- [x] **RD.ps.one** · …it counts as Moving one Unit — Pressed live 2026-10-30: Master moves stayed 0 / 3 on the bar

## Item Construction — Class Skill, Rank E− *(Passive 1 + 2)*

- [x] **IC.area** · It affects every allied Unit within 2 panels of her, herself included — Pressed live 2026-10-30: board (tick 1): Item Construction on her, her Master and Tamamo within 2; not Tamamo's Master at 3, nor anyone at 3+ (tick 6)
- [x] **IC.p1** · *(P1)* Their chance of inflicting debuffs +5% — Observed live 2026-10-30: ApplicationChance outgoing 5
- [x] **IC.p1.excl** · …not Instakill or Death — Observed live 2026-10-30: severity normal: Instakill and Death excluded
- [x] **IC.p2** · *(P2)* Their chance of being inflicted with debuffs −5% — Observed live 2026-10-30: ApplicationChance incoming 5
- [x] **IC.p2.excl** · …not Instakill or Death — Observed live 2026-10-30: severity normal
- [x] **IC.stack** · A Unit under several Item Constructions takes only the highest Rank's — Observed live 2026-10-30: aura group itemConstruction, highestOnly; no ally with a second Item Construction stood in reach

## Glam Sight: Fairy Eyes — Rank E− *(Passive)*

- [x] **GL.crit** · When she is Attacked, the AU's Crit Chance −5% (Q) — Pressed live 2026-10-30: crit chance read live: Kingprotea on her 45 (Glam Sight −5), on Tamamo 50, an NP 50 (0); her own 60. The crit roll is not printed on any card (noted)

## Guardian Faerie — Rank EX *(Passive)*

- [x] **GF.master** · It affects her Master — Pressed live 2026-10-30: board (tick 1): her Master at 1 carries defUp 10 and negateKeyedDealt
- [x] **GF.who** · …and the allied Unit nearest to her, other than her Master (Q) — Pressed live 2026-10-30: Tamamo (nearest) carries it (tick 1, tick 9)
- [x] **GF.self** · …and not herself — Pressed live 2026-10-30: she carries neither
- [x] **GF.range** · Each must be within 2 panels of her to gain it (Q) — Pressed live 2026-10-30: tick 6/9: her Master at 3 carries nothing; Tamamo at 6 nothing
- [x] **GF.1** · Damage they take −10% — Pressed live 2026-10-30: Van Gogh's NA on Tamamo (tick 9): 'Def Up Guardian Faerie −10%'
- [x] **GF.1.np** · …including NP — Observed live 2026-10-30: npValue 10 on the aura's defUp
- [x] **GF.2** · When one of them is Attacked, the AU's effects raising damage dealt to Units with a specific Skill or Servant Class are negated for that Unit, when it has that Skill or Class (Q) — Pressed live 2026-10-30: same: Van Gogh's staged Pretender (>Caster) absent under Guardian Faerie; out of its reach Anastasia's (staged) read 'Atk Up Pretender (>Caster) +50%'. The card does not name the negation (noted)
- [x] **GF.2.only** · …for that Unit only: the AU's other DUs still take them — Pressed live 2026-10-30: approximated: the same Class-keyed effect applied to Tamamo out of reach (a second AU); no single area Attack caught a Guardian Faerie holder and another Caster

## Sacred Guardian Beast — Rank A *(Active)*

- [x] **SG.when** · Used during her Turn — Pressed live 2026-10-30: Player1 used it on her Turn (tick 1)
- [x] **SG.1** · Applies Decoy to herself for ⅓◈ — Pressed live 2026-10-30: decoy expiry 2 (⅓◈); Kingprotea refused 'Caster is barred: the attacker must attack Pretender.'
- [x] **SG.1.up** · …1◈ in Shisarot Form (Q) — Pressed live 2026-10-30: in the Form (tick 4): decoy expiry 7 (1◈)
- [x] **SG.2** · Applies Dmged NP Regen to herself for ⅓◈ — Pressed live 2026-10-30: dmgedNpRegen expiry 2
- [x] **SG.2.up** · …1◈ in Shisarot Form — Pressed live 2026-10-30: in the Form: expiry 7
- [x] **SG.2.hit** · Dmged NP Regen: her NP Cooldown −1◈ when she is successfully hit by an Attack (Q) — Pressed live 2026-10-30: Kingprotea's hit (tick 2): card 'Chibirā Sanu…: Cooldown 23 → 20'; an evaded attack cut nothing
- [x] **SG.3** · Applies Guts to herself for 1◈ — Pressed live 2026-10-30: guts 30, 1 use, expiry 4 / 7
- [x] **SG.3.revive** · …defeated, she revives with 30% of her Max Health (Q) — Pressed live 2026-10-30: Health staged 50, Kingprotea's hit (tick 7): 'Pretender is defeated and revived by Guts, with 828 Health.' (30% of 2760)
- [x] **SG.4** · Applies S.Crit Up for ⅓◈ to every allied Unit within 2 panels of her — Pressed live 2026-10-30: sCritUp aura: crit +5 on her, her Master and Tamamo within 2
- [x] **SG.4.crit** · …Crit Chance +5% — Pressed live 2026-10-30: checkModifier crit 5
- [x] **SG.4.form** · …in Shisarot Form, to herself only (Q) — Pressed live 2026-10-30: in the Form: sCritUpSelf on her only, Master and Tamamo none
- [x] **SG.cd** · Cooldown 4◈ — Pressed live 2026-10-30: cooldown 12

## Yanamun Reversal — Rank A *(Active)*

- [x] **YR.when** · Used during her Turn — Pressed live 2026-10-30: Player1 used it on her Turn (tick 1)
- [x] **YR.area** · Effects 1–5 reach every allied Unit within 2 panels of her, herself included — Pressed live 2026-10-30: card: her, 'Master of Extra of Faction 1:' and 'Caster:' each Dmg Up (Demonic), (Undead), vDebuff Immune, Max HpUp
- [x] **YR.form** · …in Shisarot Form, herself only — Pressed live 2026-10-30: in the Form (tick 4): effects 1-5 on her only
- [x] **YR.1** · Applies Dmg Up (Demonic) for 1◈: damage dealt to Units with the 'Demonic' Attribute +30% — Pressed live 2026-10-30: dmgUpDemonic 30, expiry 4 (1◈)
- [x] **YR.2** · Applies Dmg Up (Undead) for 1◈: damage dealt to Units with the 'Undead' Attribute +30% — Pressed live 2026-10-30: dmgUpUndead 30, expiry 4
- [x] **YR.3** · Applies Volatile Debuff Immune for 1◈ — Pressed live 2026-10-30: vDebuffImmune expiry 4; it blocked Ice Bucket's Slow ('Slow: blocked, vDebuffImmune')
- [x] **YR.4** · Applies Max HpUp for 1◈ — Pressed live 2026-10-30: maxHpUp expiry 4
- [x] **YR.4.up** · …2◈ in Shisarot Form — Pressed live 2026-10-30: in the Form: expiry 10 (2◈)
- [x] **YR.4.max** · …Max Health +30% of its original value (Q) — Pressed live 2026-10-30: 'Health 1200 → 1560', 'Master 213 → 288', 'Caster 500 → 650' (30% of each original)
- [x] **YR.4.cur** · …and current Health by the same — Pressed live 2026-10-30: same lines: current Health raised by the same
- [x] **YR.5** · Applies S.Crit Up for ⅓◈: Crit Chance +5% — Pressed live 2026-10-30: S.Crit Up on her (an aura, #132)
- [x] **YR.geom** · Effects 6–7 reach every enemy Unit in a 3×3 area in any non-diagonal direction next to her (Q) — Pressed live 2026-10-30: north 3x3 caught Anastasia (tick 1)
- [x] **YR.geom.up** · …4×4 in Shisarot Form — Pressed live 2026-10-30: in the Form: four 4x4 placements, north rows 8-11 cols 10-13 (overhang), Anastasia caught
- [x] **YR.6** · Inflicts Debuff ResDwn for 1◈: chance of being inflicted with debuffs +15% — Pressed live 2026-10-30: 'Archer: Debuff ResDwn', 15, expiry 4
- [x] **YR.7** · Inflicts Skill Seal for ⅓◈ — Pressed live 2026-10-30: 'Archer: Skill Seal', expiry 2 (⅓◈)
- [x] **YR.cd** · Cooldown 4◈ — Pressed live 2026-10-30: cooldown 12

## Great Decisive Battle at the Southern Sea — Rank EX *(Active)*

- [x] **GD.when** · Used during her Turn — Pressed live 2026-10-30: Player1 used it on her Turn (tick 1)
- [x] **GD.1** · Restores 3 Agility — Pressed live 2026-10-30: Agility staged 10: 'Agility 10 → 13'
- [x] **GD.2** · Applies Atk Up for 1◈: all damage dealt +40% — Pressed live 2026-10-30: atkUp 40, expiry 4
- [x] **GD.2.np** · …if NP, 30% — Pressed live 2026-10-30: npMagnitude 30
- [x] **GD.3** · For every 5% of her Crit Chance above 50%, Atk Up for ⅓◈: all damage dealt +5% (Q) — Pressed live 2026-10-30: crit 60 (50 + two S.Crit Up): two Atk Up 5, expiry 2
- [x] **GD.3.np** · …not NP — Pressed live 2026-10-30: their npMagnitude 0
- [x] **GD.3.max** · …at most 10 stacks — Observed live 2026-10-30: `times.max: 10` on the Count
- [x] **GD.4** · Applies NP DmUp for ⅓◈: NP damage dealt +10% for every 300 of her Max Health (Q) — Pressed live 2026-10-30: NP DmUp 50 at Max Health 1560; 100 at 3120 in the Form
- [x] **GD.cd** · Cooldown 4◈ — Pressed live 2026-10-30: cooldown 12

## Chibirā Sanu・Habetrot: The Lion's Gallant Figure that Stirs the Seas — Rank EX *(NP, Anti-Kaiju)*

- [x] **NP.rank** · Rank EX, Anti-Kaiju — Observed live 2026-10-30: card '(EX)'; npTags antiKaiju
- [x] **NP.ba** · BA(MAG) — Pressed live 2026-10-30: NP (tick 20, 30): 'Base BA(MAG) +150'
- [x] **NP.range** · Range +2 for the Combat Process — Pressed live 2026-10-30: 2x2 placements reached Range 4 from her (Range +2)
- [x] **NP.1** · First, applies NP DmUp to herself for ⅓◈: NP damage +10% for every enemy Unit within 3 panels of her (Q) — Pressed live 2026-10-30: 'NP DmUp +40%' (4 enemies within 3, a Master among them, tick 20); +20% (2, tick 30)
- [x] **NP.2** · …and Atk Up for 1◈: all damage dealt +(X+1)0% (Q) — Pressed live 2026-10-30: atkUp 30 (X=2: her and Tamamo), expiry 1◈
- [x] **NP.2.np** · …if NP, X0% — Pressed live 2026-10-30: 'Atk Up +20%' on the NP
- [x] **NP.2.x** · …X the number of allied Units within 2 panels of her (Q) — Pressed live 2026-10-30: X=2: her and Tamamo within 2
- [x] **NP.form** · Next, she transforms into Shisarot Form for 3◈ (Q) — Pressed live 2026-10-30: used out of the Form (tick 30): Class prompt, corner prompt, then the hit; card lists 'Shisarot Form'; 2x2, 816 → 1632
- [x] **NP.extend** · …used in Shisarot Form, its duration is extended (Q) — Pressed live 2026-10-30: used in the Form (tick 20): 'Shisarot Form: 7 → 16 Turns left', no Pretender prompt
- [x] **NP.area** · Hits a 2×2 area within Range (Q) — Pressed live 2026-10-30: a 2x2 on Anastasia and Kingprotea: two Processes
- [x] **NP.dmg** · …for 5× damage — Pressed live 2026-10-30: 'Ability multiplier 5× damage'
- [x] **NP.large** · …damage to Units with the 'Large' Attribute further +150% (×2.5) — Pressed live 2026-10-30: Kingprotea: 'Ability clause Large (+150%) +2.5'
- [x] **NP.cd** · Cooldown 8◈ — Pressed live 2026-10-30: cooldown 24 (8◈)
- [x] **NP.cost** · Her Master pays the Rank EX NP's Health — Pressed live 2026-10-30: her Master's Health 213 → 138, 138 → 63

## Shisarot Form — the NP's Passive

- [x] **SF.1** · Her size grows from 1 panel to 2 panels (Q) — Pressed live 2026-10-30: transform (tick 3): 'Summer Habetrot grows' corner prompt, top-left; 2x2. Leaving it: FOUND (tick 24: kept her top-left, no pick), FIXED; pressed again (tick 30): 'Summer Habetrot shrinks', bottom-right picked, she stands on (11,9)
- [x] **SF.2** · She gains the 'Large' Attribute — Pressed live 2026-10-30: attributes + large
- [x] **SF.3.max** · Max Health +100% of its original value — Pressed live 2026-10-30: Max Health 1560 → 2760 (+1200)
- [x] **SF.3.cur** · …current Health +100% of its value as she transforms (Q) — Pressed live 2026-10-30: 'Shisarot Form; Health 1259 → 2518'
- [x] **SF.3.end** · …when it ends, her maximum falls and her current only to fit — Pressed live 2026-10-30: Form ended (tick 24): 2000/2400 → 1200/1200 (not said on a card, noted)
- [x] **SF.6** · The damage taken needed to trigger her Injury Roll is doubled: 200 (Q) — Pressed live 2026-10-30: Asterios's 114 on her in the Form: no 'Injury Roll required'; 243 required one
- [x] **SF.7.block** · She cannot Block — Pressed live 2026-10-30: in the Form the reaction offers Do nothing and Evade, no Block
- [x] **SF.7.agi** · …her Agility Check rolls are doubled — Observed live 2026-10-30: checkModifier agility rollFactor 2
- [x] **SF.7.evade** · …her Evade rolls among them (Q) — Pressed live 2026-10-30: Player1 Evade in the Form: 'shisarotForm +13' on 1d20 13
- [x] **SF.8.move** · She can Move to any panel, occupied ones included — Pressed live 2026-10-30: Player1's Move onto Kingprotea's panel allowed (tick 4)
- [x] **SF.8.kb** · …each Unit on a panel she Moves into is knocked back 1 panel, until she can stand there — Pressed live 2026-10-30: Kingprotea (12,14) → (12,15); the growth pushed Kingprotea and Asterios 1 each. No card says either (noted)
- [x] **SF.9.str** · Her Normal Attacks at a Range of 1 use BA(STR) — Pressed live 2026-10-30: FOUND (tick 4: BA(MAG) on a Unit beside her), FIXED; pressed again (tick 18): Kingprotea at 1 'Base BA(STR) +115'
- [x] **SF.9.mag** · …at a Range of 2 or higher, BA(MAG) — Pressed live 2026-10-30: Van Gogh at 2 'Base BA(MAG) +150'
- [x] **SF.9.band** · …the band read per DU (Q) — Pressed live 2026-10-30: one 2x2, two bands (tick 18)
- [x] **SF.9.area** · Her Normal Attacks hit a 2×2 area (Q) — Pressed live 2026-10-30: aimed at Kingprotea (tick 4): two Processes, not herself
- [x] **SF.9.kb** · …and knock each DU back 1 panel (Q) — Pressed live 2026-10-30: 'AlterEgo is knocked back 1 panel by Pretender.'; blocked: 'AlterEgo holds its ground against Pretender: no free panel behind it.'
- [x] **SF.10** · Whenever she transforms into Shisarot Form, she gains a 'Pretender (>X)' effect (Q) — Pressed live 2026-10-30: Command Spell (tick 3) and NP (tick 30): Class prompt, Pretender (>Archer) / (>Saber)
- [x] **SF.10.pick** · …she picks X, a standard Servant Class, as she transforms — Pressed live 2026-10-30: seven Classes offered as she transforms
- [x] **SF.10.dur** · …it lasts until she leaves Shisarot Form — Pressed live 2026-10-30: pretenderSaber expiry null, removed as the Form ended (tick 30)
- [x] **SF.10.both** · …with the Active's Pretender (>X) already held, the reading settles which stands (Q) — Pressed live 2026-10-30: Pretender (>Berserker) replaced by (>Archer) (tick 3) and by (>Saber) (tick 30)
- [x] **SF.11.when** · When Shisarot Form is about to end at a Turn's end, her Master is offered a Command Spell to extend it (Q) — Pressed live 2026-10-30: end of tick 18: Player1 'Extend Shisarot Form? … ends at the end of this Turn. Spend 1 Command Spell to extend it by 3◈ Turns?'
- [x] **SF.11.pass** · …the offer can be passed, and the Form then ends — Pressed live 2026-10-30: end of tick 24: confirmed with nothing: 'Master of Extra of Faction 1 does not extend Pretender's Shisarot Form: it ends.'
- [x] **SF.11.ext** · …spent, the Form lasts 3◈ more — Pressed live 2026-10-30: '… Shisarot Form is extended by 3◈ Turns.', expiry 18 → 27
- [x] **SF.11.cd** · …extended so, her Skill Cooldowns −1◈ — Pressed live 2026-10-30: Riding 5 → 1, Shiisaa Beam 3 → 0 (−1◈), NP untouched; the card did not say so: FOUND, FIXED (rows whispered to her side), unit-tested, not re-seen live
- [x] **SF.11.next** · …and her next Attack deals 100% extra damage (Q) — Pressed live 2026-10-30: Form NA on Van Gogh (tick 24): 'damageMultiplier shisarotCharge ×2', 'Shisarot's Charge: removed'
- [x] **SF.11.next.np** · …if NP, 50% — Pressed live 2026-10-30: NP (tick 20): 'shisarotCharge ×1.5' on both Processes, removed once
- [x] **SF.11.again** · …offered again every time the Form is about to end (Q) — Pressed live 2026-10-30: offered again at the end of tick 20 and of tick 24
- [x] **SF.dur** · Shisarot Form ends at the end of the Turn its duration runs out — Pressed live 2026-10-30: the Form's clock ends it at its Turn's end (ticks 24, 30, staged)
- [x] **SF.defeat** · …held through a Guts revival, the reading settles (Q) — Pressed live 2026-10-30: after Guts (tick 7): 2x2, pretenderArcher and shisarotForm kept

## Divine Beast's Rage *(Passive 1 + 2)*

- [x] **DB.gate** · In effect only while she is in Shisarot Form — Pressed live 2026-10-30: out of the Form her Skills at tick 1 gained no Counter (Shiisaa 0)
- [x] **DB.p1** · *(P1)* Whenever she uses a non-Attack Skill, she gains 1 Shiisaa Counter (Q) — Pressed live 2026-10-30: in the Form: Sacred Guardian Beast, Yanamun Reversal and Riding each +1 (0→1→2). No card says it (noted)
- [x] **DB.keep** · …Counters held when the Form ends, the reading settles (Q) — Pressed live 2026-10-30: Form ended with 2 Counters (tick 24): Shiisaa 0
- [x] **DB.p2** · *(P2)* At 3 Shiisaa Counters, all are removed at once — Pressed live 2026-10-30: Great Decisive Battle the third (tick 4): Counters 0, payout at once
- [x] **DB.1** · …NP DmUp for 1 use: NP damage +15% — Pressed live 2026-10-30: npDmUpOnce 15, spent by the NP: 'NP DmUp: removed'
- [x] **DB.2** · …Dmg Up (Kaiju) for 1◈: damage dealt to Units with the 'Large' Attribute +30% — Pressed live 2026-10-30: dmgUpKaiju 30, 1◈
- [x] **DB.2.giant** · …a DU that is also 'Giant', +30% more (60% in all) — Pressed live 2026-10-30: Form NA (tick 4): 'Dmg Up (Kaiju) +30%' twice on Giant Kingprotea and Asterios
- [x] **DB.3** · …E.Atk Up for 1◈: non-NP area damage dealt +30% — Pressed live 2026-10-30: same NA (an area): 'E.Atk Up +30%'; the ride (single) did not read it
- [x] **DB.4** · …her Skill Cooldowns −1◈ (Q) — Pressed live 2026-10-30: 'Pretender 8 → 5', 'Riding 5 → 2', 'Sacred Guardian Beast 12 → 9', 'Yanamun Reversal 12 → 9'; NP untouched
- [x] **DB.4.gd** · …Great Decisive Battle's −1◈ more — Pressed live 2026-10-30: 'Great Decisive Battle 12 → 6' (printed twice: FOUND, FIXED to one line, unit-tested)

## Ocean Stirring Lion's Roar *(Passive)*

- [x] **OS.gate** · In effect only while she is in Shisarot Form — Pressed live 2026-10-30: NP ready at the start of her Turn out of the Form (tick 1): nothing fired
- [x] **OS.when** · At the start of her Turn, if her NP is not on Cooldown, it activates by itself (Q) — Pressed live 2026-10-30: NP staged ready, in the Form: it fired at her Turn's start (tick 6) with no card: FOUND, FIXED; pressed again (tick 8): 'Start of the Turn' card
- [x] **OS.1** · Her NP Cooldown is Reset (Q) — Pressed live 2026-10-30: 'Chibirā Sanu…: Cooldown set to 24 Turn(s) (Ocean Stirring Lion's Roar)'
- [x] **OS.2** · Applies Atk Up for 2◈: all damage dealt +50% — Pressed live 2026-10-30: atkUp 50, expiry 12 (2◈); read on the ride and Fireball
- [x] **OS.2.np** · …if NP, 30% — Observed live 2026-10-30: its npMagnitude 30
- [x] **OS.3** · Applies Dmg Up (Large) for 2◈: damage dealt to Units with the 'Large' Attribute +50% — Pressed live 2026-10-30: dmgUpLarge 50; 'Dmg Up (Large) +50%' on Kingprotea
- [x] **OS.4** · Applies S.Crit Up (Shiisa) for 2◈, 10 stacks — Pressed live 2026-10-30: sCritUpShiisa 10 charges, expiry 12
- [x] **OS.4.crit** · …Crit Chance +(5 × X)%, X the stacks left (Q) — Pressed live 2026-10-30: 9 left: her crit +45
- [x] **OS.4.spend** · …a stack spent as the reading settles (Q) — Pressed live 2026-10-30: the ride 10 → 9, Fireball (two Processes) 19 → 18, Shiisaa Beam 18 → 17
- [x] **OS.5** · Shisarot Form's duration +1◈ — Pressed live 2026-10-30: Form expiry 12 → 15 and 15 → 18 (not said on the card, noted)

## Great Tropical Fireball *(Attack Skill)*

- [x] **TF.atk** · An Attack Skill — Pressed live 2026-10-30: Player1 (tick 8): an Attack, its CS window and reactions
- [x] **TF.gate** · Only usable in Shisarot Form — Pressed live 2026-10-30: out of the Form (tick 27): greyed 'Its conditions are not met right now.'; the press refused
- [x] **TF.ba** · BA(MAG) — Pressed live 2026-10-30: 'Base BA(MAG) +150'
- [x] **TF.range** · Range +1 for the Combat Process — Pressed live 2026-10-30: 4x4 placements from Range 3, her footprint
- [x] **TF.area** · Hits a 4×4 area within Range (Q) — Pressed live 2026-10-30: rows 10-13 cols 15-18: Kingprotea and Asterios, her Master outside it untouched
- [x] **TF.dmg** · …for 50% extra damage (×1.5) — Pressed live 2026-10-30: 'Ability multiplier 1.5×'
- [x] **TF.burn** · …and inflicts Burn for 2◈ — Pressed live 2026-10-30: Asterios 'Burn' expiry 14 (2◈); Kingprotea 'Burn: resisted, rolled 100 vs 75%'
- [x] **TF.fire** · Fire damage — Pressed live 2026-10-30: the Process's element fire
- [x] **TF.cd** · Cooldown 3◈ — Pressed live 2026-10-30: cooldown 9

## Shiisaa Beam *(Attack Skill)*

- [x] **BM.atk** · An Attack Skill — Pressed live 2026-10-30: tick 12, through the socket request (the canvas picker did not take the synthetic click)
- [x] **BM.gate** · Only usable in Shisarot Form — Pressed live 2026-10-30: out of the Form greyed as Fireball
- [x] **BM.ba** · BA(MAG) — Pressed live 2026-10-30: 'Base BA(MAG) +150', no multiplier
- [x] **BM.area** · Hits a 2×5 or 5×2 area in any non-diagonal direction next to her (Q) — Pressed live 2026-10-30: per side a 2x5 and two 5x2 slides offered; the west 5x2 caught Kingprotea and Asterios (slides: Q to the user)
- [x] **BM.def** · …inflicts Def Dwn (Total) for 1◈: Total damage taken +25% — Pressed live 2026-10-30: Asterios 'Def Dwn (Total) (rolled 61 vs 70%)', 25, expiry 15; his next hit: stage 15 ×1.25 (printed by id: FOUND, FIXED, unit-tested)
- [x] **BM.nostack** · …it does not stack — Observed live 2026-10-30: stacking noneRefresh
- [x] **BM.cd** · Cooldown 3◈ — Pressed live 2026-10-30: cooldown 9
