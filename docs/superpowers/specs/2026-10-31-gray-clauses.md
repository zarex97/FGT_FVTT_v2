# Gray (Assassin) — the Clause list

*Gray*, built from `char_orig_sheets/by-class/Assassin/Gray.md`. Started by the user 2026-10-31.

**Audit opened 2026-10-31 (#362).** **Read by hand, line by line.** No generated draft was used. No older `Copia de` sheet exists to compare with. The
sheet prints no Class line (the folder's: Assassin, as Summer Habetrot's was the folder's), no `N.Atk Type` and no
`{R}`/`{M}`/`{S}` tags. She carries no Presence Concealment Class Skill: her Class Skills are Independent Action and
Magic Resistance, and *Face of the King* is an ordinary Skill that brings Presence Concealment E.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Assassin/Gray"`, each confirmed by reading:

- **Independent Action A+** is `class-independent-action` at A+: ZON +3 by `independentActionZon` (A band), no
  contract at all by `independentActionContract`'s top band, and `sustainability: null` as Proto Gil's and Sieg's.
- **Magic Resistance C** is `class-magic-resistance` at C: negates up to C, 30% by `magicResistancePercent`, debuffs
  15% by `magicResistanceDebuffResist`. Every number on her sheet is the table's.
- **Face of the King**'s *"same effects as 'Presence Concealment — Rank: E'"* is the `presenceConcealment` effect
  carried at a Rank, as Danzō's Dongyū grants C+ (`params: {rank}`): discovery 80% by
  `presenceConcealmentDiscover`, the Evade +2 by `presenceConcealmentEvade`, the Cooldown 1◈ by
  `presenceConcealmentCooldown` (C to E band). All three agree with her sheet. *"Cooldown … after the 'Hoodie' effect
  is removed"* is the class skill's `countFrom: deactivation`.
- **Rhongomyniad**'s six criteria are Lanceturia's word for word (`lanceturia-rhongomyniad`, the Count module's
  `criteria`, #283, #319, #336): the multiplier, the Master's cost and the Cooldown read `count: {of: criteria}`. Her
  line is Danzō's Dongyū Storm's `{ kind: line, length, diagonalLength }`. Pierce is `pierce.yml`. *"Cooldown …
  increases by ½◈ for every criteria"* is Chronos Rose's `direction: up` on a `countBonus`.
- **Def Dwn (C)** is `def-dwn-c.yml`, its Agility −1 once per Attack (#239).
- **Anti-Spirit Combat**'s Atk Up is the built one; its passive is Dmg Up (Gods)'s shape on two Attributes
  (`target:attribute:spirit` or `undead`). *Spirit* is implied by *Servant* (`domain/attributes.mjs`).
- **Sealing Mystic Code Release**: *"Restores 4 Agility"* is EMIYA's `resource` phase; Invuln *"1 time"* is Danzō's
  and Sita's `uses: 1`; Atk Up is the built one.
- **Blessings from the End of the World**: Lanceturia's *Blessings from the Ends of the World* is a `cooldown` phase
  on every NP (#197 reading 6); Debuff ResUp is `debuff-res-up.yml`.
- **King's Reflection**'s gain on a Normal Attack is Proto Gil's Golden Rule shape (`damageDealt` with `attack:crit`).
  Mythos Counters are a `resources` pool, as Summer Habetrot's Shiisaa Counters and Mannanán's Fragarach Tokens are.
- **Rhongomyniad Mythos**: *"ignores Debuff Resist & Immune"* is Kiritsugu's `ignoresResistanceFrom`; *"Divinity
  negated"* is Tamamo's whole-Skill negation (#353 reading 1, `ability.negated`); the use gate on Spells and NPs is
  the `Suppress scope: abilityUse` Sieg and Yan Qing carry; *"If this NP is not successfully Evaded"* with no damage
  is Kazikli Bey's Evade-only step.

What she needs that nobody has yet, each to be built as a generic piece:

- **A named Presence Concealment from an ordinary Skill** (FK.*): the engine keys on the effect id
  `presenceConcealment`, and a Rank carried on the instance marks it *granted*, which starts no Cooldown
  (`engine/concealment.mjs#onConcealmentRemoved`). Hoodie must start Face of the King's clock, and be named *Hoodie*
  on every card. *"Not affected by Skill Seal"* is new on a concealment Skill.
- **A natural Cooldown tick replaced on some Turns** (KR.1): ⅓◈ instead of 1 Turn, on her own Turn and the Turns
  she Acts. Rheingold's `CooldownCutOverride` lengthens a cut; this lengthens the Turn's own tick.
- **A counter pool fed from four doors** (ST.mythos): a successful Normal Attack (1, 2 on a Crit), every
  Spirit/Undead Unit hit, a 1d6, and every Unit her NP hits; capped at 40.
- **Logos** (SM.4.*): a status with no duration when a count stands at its application, and a lockout on
  re-application that only its natural expiry starts.
- **An NP gated on a held effect and on a full pool** (RH.gate, MY.gate).
- **NP Def Dwn** and **Dmg Up (Grave)** as effect files (RH.npdef, AS.2).
- **The Mythos debuff** (MY.*): Attacks using MAG refused, a combined Base Attack read as STR alone, Spells and NPs
  refused with their Passives negated, two NP tags exempt (`[Anti-Unit Mystic Sword]`, `[Anti-Unit Secret
  Technique]`, Sasaki's and Okita's), Divinity negated, removable only by a Rank EX source.
- **The Chaldea Faction** (RH.go), if reading 21 builds it.

**139 Clauses** across 9 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields. `Mythos Counters: 0/40` is read as
  ST.mythos.
- *"(Gray)"* before every Ability's name: the bearer's label.
- *"Has the following effects-"*: a heading.
- *"Gray hides her face with her hoodie."*: flavour.
- The criteria's italic mottos (*"The enemy must be more powerful than oneself."* and the rest), and the two after
  the Note (*"One's comrades-in-arms must be courageous."*, *"The battle must save the world."*): flavour. They are
  two of Excalibur Proto's thirteen seals and are no criteria of Rhongomyniad's.
- *"(e.g. 4 criteria met, damage=3.8x)"*: a figure RH.dmg.per is pressed against.
- The struck text (`~~to Servants~~`, `~~Def Dwn (B)~~`, `~~20%; if NP,~~`): read as deleted (reading 8). The
  Clauses quote what remains.
- `Items held:`: an empty slot.
- Rhongomyniad prints no element and no delivery tag: it deals untyped damage and its delivery is measured, as
  every untagged NP's is (#281). Lanceturia's *"Light damage"* is hers alone.

### Already ruled

**Elsewhere:** Base Attack derives from the tables and beats the sheet (§46.6, *"choose the value of this table
instead of what is on the character sheet"*): BA(STR) is **125** at STR B, not the printed 105; BA(MAG) 150 at MAG C
agrees · Max Health is 1000 at END C, as printed · Magic Resistance C, Independent Action A+ and Presence
Concealment E are their tables · durations count from the Turn after the Turn of use (#187 reading 5) · *"NP
Cooldown"* naming no NP reaches every NP (#197 reading 6): Blessings, King's Reflection and Rhongomyniad's cut each
reach both her NPs · *"a successful Attack"* is a Block, a hit for 0 and an Instakill that skipped the damage count;
an Evade, a complete negation and a concealment coin are not (#239) · riders land on a hit, not a hurt (§46.4-LI) ·
*"restores"* stops at the maximum · Rhongomyniad's criteria are counted once per declaration over its DUs; with one
DU the *"at least two"* criteria hold when it passes; none over an empty area; *"two Ranks below"* is at least two
whole grades (#283, #319) · Def Dwn (C) drains once per Attack (#239) · Atk Up's NP figure is its own · Dmg Up
reaches an NP at its full figure (Appendix A) · a gain past a pool's maximum is lost · a sheet binds only its owner.

## Readings

Grilled 2026-10-31. Round 1: readings 1–5 and 7–26 ruled as written below. Reading 6 overruled (row rewritten).
Round 2: reading 16 and the follow-ups 27–29 ruled as written. The frontier is empty.

| # | Reading (recommended) | Clauses |
|---|---|---|
| 1 | Her Normal Attack is STR, fixed, its delivery measured as Karl (#351) and Sita (#348) were built with no type printed: their shape, carried, never a ruling of theirs. | ST.na |
| 2 | She is both *Spirit* (implied by *Servant*) and *Living Human* (printed): the implication's exemption names only Demi- and Pseudo-Servants. | ST.attr |
| 3 | Anti-Spirit Combat reaches every Unit holding *Spirit* or *Undead*, implied ones included: nearly every enemy Servant. | AS.p.dmg, AS.2 |
| 4 | Anti-Spirit Combat's *"1 additional Mythos Counter for every Unit … hit by a successful Attack"* is paid by every Attack she makes (Normal, Skill, NP), per Spirit/Undead Unit hit, on top of any other gain. | AS.p.mythos |
| 5 | King's Reflection replaces her NPs' natural tick of 1 with ⅓◈ (1 at 3 Turns a Round, 2 at 8, 5 at 15) on her own side's Turn and on any Turn she Acted; once a Turn when both hold; other Turns tick 1. NP Lock, Lag and Degen still win; NP Regen still adds. | KR.1, KR.1.acted, KR.1.other |
| 6 | **Ruled 2026-10-31, against the recommendation:** *"Any Turns she Acts"* includes Evading, Blocking and Countering on an enemy Turn, as Raikou's #195 reading 12. The engine already marks them (`attack.mjs` `reaction:acted`, `counter:declared`, `autoCounter:declared`). | KR.1.acted |
| 7 | Hoodie's clause 2, *"unless the DU's current Agility is equal to or higher than it"*, is PC's AGI Rank comparison (60 sheets print *"AGI Rank"*; Hoodie *"has the same effects as"* PC E). The other reading: her Agility pool against the DU's. | HD.2 |
| 8 | Struck text is deleted: Hoodie's +100% reaches every Unit but a Master; Rhongomyniad inflicts *NP Def Dwn* (NP damage taken +30%), no Def Dwn (B). | HD.4, RH.npdef |
| 9 | *"This Skill is not affected by Skill Seal"*: Face of the King may be used while she is Skill Sealed, and Skill Seal never ends Hoodie, even in a War playing the Revised clause 8. | FK.seal |
| 10 | Logos's *"30 Mythos Counters or more when the 'Logos' effect is applied"* is counted at effect 4, before effect 5's 1d6. | SM.4.perm |
| 11 | Using Sealing Mystic Code Release while she holds Logos: a timed Logos is refreshed to 2◈, or made permanent if she has 30 then; a permanent one stays. During the lockout the other four effects land and Logos is refused with a line. | SM.4.held, SM.4.lock |
| 12 | Rhongomyniad does not spend Logos. | RH.logos |
| 13 | Pierce lands on her before the hit: the NP itself pierces, and so does every Attack she makes for ⅓◈ after. | RH.pierce |
| 14 | The line starts on a panel next to her and runs straight out in any of the eight directions: 6 long orthogonally, 5 diagonally. | RH.area, RH.area.diag |
| 15 | The line names no relation: allies in it are hit and are DUs for every criterion (Lanceturia's ruling 9, #336, carried); only enemies take the two debuffs, as printed. The other reading: enemies only. | RH.who, RH.enemy |
| 16 | *"2 Mythos Counters for every Unit hit"*: every Unit hit, allies included. A Block is a hit; an Evade is not. | RH.mythos |
| 17 | The Master's 30 + 10 per criterion replaces the NP's Rank table cost (Lanceturia's `supersedes: [npCost]`, carried). | RH.cost |
| 18 | Her Cooldown starts at 5◈ + ½◈ per criterion, then every NP clock she holds, this one included, falls 1 Turn per criterion (#197 reading 6): at 3 Turns a Round, each criterion nets +1 Turn on Rhongomyniad and −1 on Mythos. | RH.cd, RH.cd.per, RH.cdcut |
| 19 | *"40 Mythos Tokens"* are her Mythos Counters; the NP's gate reads them and spends none. The other reading: it spends all 40. | MY.gate, MY.spend |
| 20 | Rhongomyniad Mythos may be Evaded only, no Block or Counter (Kazikli Bey's); it counts as her Attack for the Turn (Ch. 17), so it ends Hoodie at its Combat Process's end. | MY.evade, MY.hoodie |
| 21 | The Grand Order note is built now: a War setting marks one faction *Chaldea*, read only in a Grand Order War; there Rhongomyniad's multiplier starts at 4x, and Lanceturia's and Arthur's too. The cost and the Cooldown are untouched (Lanceturia's ruling 7). The other reading: recorded only, as Lanceturia's ruling 6. | RH.go |
| 22 | The Mythos debuff has no duration: it stands until a Rank EX Skill or NP removes it, or its bearer is defeated. | MY.dur, MY.4 |
| 23 | Mythos 1 refuses every Attack whose damage is MAG, a Normal Attack's band included (a MAG band cannot be used, the STR band can); an Attack combining both components deals with its BA(STR) part alone. | MY.1, MY.1.na, MY.1.both |
| 24 | Mythos 2's *"Spells"* are abilities of kind `spell`, a Master's included; *"their Passive effects are negated"* is every passive rule of the bearer's Spells and NPs. The two exempt tags are new NP tags. | MY.2, MY.2.np, MY.2.passive, MY.2.except |
| 25 | Mythos 3 negates Divinity whole, as Tamamo's is outside Yata no Kagami: no passive, and no predicate sees Divinity, a Skill that counts as one included. | MY.3 |
| 26 | Dmg Up (Grave)'s *"(further) increased by 60%"* is an ordinary Dmg Up that adds to the passive's 40 (100% in all against Spirit or Undead), not a ×1.6 multiplier. | AS.2 |
| 27 | Anti-Spirit Combat names no relation: an allied Spirit or Undead hit by her line takes the +40% and pays her the extra Mythos Counter. | AS.p.dmg, AS.p.mythos, RH.who |
| 28 | Mythos 2's exceptions are two new `npTags`, `mysticSword` and `secretTechnique`, worn beside a scale tag. Only `antiUnit` with one of them is exempt: Ushiwakamaru's *Anti-Army Secret Technique* stays sealed. | MY.2.except |
| 29 | *"Summoned … on the Chaldea Faction"* is read at the NP's declaration, from her current faction. | RH.go |
| 30 | **Ruled 2026-11-01.** A sum of ◈ spans (`countBonus`, `perUnit`) is added up in ◈ and converted once. Rhongomyniad's five ½◈ at 3 Turns a Round are 2½◈, 7 Turns: 15 + 7 = 22. This replaces the per-criterion figure reading 18 gave. | RH.cd.per |
| 31 | **Ruled 2026-11-01.** Every ◈ span rounds down and never to 0 (a span that would be 0 is 1 Turn). The published exception is gone: ½◈ at 3 Turns a Round is 1, not 2, everywhere, and `TICK_OVERRIDES` is removed. Blessings' *"Reduce Gray's NP Cooldown by ½◈ Turns"* cuts 1 at 3 Turns a Round. | BL.1, RH.cd.per |
| 32 | **Ruled 2026-11-01.** One rule for every `countBonus` (Lanceturia's ⅓◈ down too) and for `perUnit` (Dragon Tooth Warriors, Trump Soldiers, Summoning: Horrors). | RH.cd.per |
| 33 | **Ruled 2026-11-01.** `MY.2.except` is pressed on three test NPs (`test-mythos-*`), `[antiUnit, mysticSword]`, `[antiUnit, secretTechnique]` and `[antiArmy, secretTechnique]`, as `test-count-criteria` stood in for Arthur. Each tagged Servant's own audit presses it again. | MY.2.except |

## Live presses (in progress, 2026-11-01)

War "Gray Audit" (scene `50ZJJWLyVTRXGyP4`): Gray and Tamamo for Faction 1 (Player1), Medea, Arjuna, Summer Habetrot
and Mannanán for Faction 2. Staged where the board would not produce a case: the NP gates at Round 1, Turns per Round
8 for Turns 3 to 8 (King's Reflection), revivals of Arjuna and Medea, a Skill Seal, cooldowns and Mythos set by hand,
Master Health refilled.

**Pressed or Observed live (about 109):** ST.name, ST.class, ST.region, ST.align, ST.hp, ST.mov, ST.range, ST.ba,
ST.na, ST.mythos · IA.zon · MR.neg, MR.red · FK.when, FK.apply, FK.dur, FK.same, FK.cd, FK.cd.held, FK.seal ·
HD.1.target, HD.1.aoe, HD.1.heads, HD.2.react, HD.2.evade, HD.3.masters, HD.4, HD.4.np, HD.4.master, HD.5, HD.6 ·
KR.1, KR.1.acted, KR.1.once, KR.1.other, KR.2, KR.2.crit, KR.2.miss, KR.max · AS.p.dmg, AS.p.np, AS.p.other,
AS.p.mythos, AS.when, AS.1, AS.1.np, AS.2, AS.2.other, AS.cd · SM.when, SM.1, SM.2, SM.2.np, SM.3, SM.3.once, SM.4,
SM.4.lock, SM.4.perm, SM.4.held, SM.5, SM.cd · BL.when, BL.1, BL.2, BL.3, BL.cd · RH.gate, RH.logos, RH.pierce,
RH.mag, RH.area, RH.area.diag, RH.who, RH.c1 to RH.c6, RH.c.single, RH.dmg, RH.dmg.per, RH.cost, RH.cost.per,
RH.npdef, RH.defdwn, RH.enemy, RH.cdcut, RH.mythos, RH.cd · MY.nondmg, MY.when, MY.gate, MY.spend, MY.range,
MY.target, MY.target.ally, MY.evade, MY.hoodie, MY.ignore, MY.dur, MY.1, MY.1.na, MY.1.both, MY.2, MY.2.np, MY.3,
MY.4.other, MY.cd.

**Open:** ST.param, ST.attr, ST.sus, ST.items · IA.sus, IA.contract · MR.np, MR.debuff, MR.ik, MR.ik.str, MR.erase,
MR.note · HD.1.tails, HD.1.tails.end, HD.3.move, HD.7, HD.7.except, HD.8, HD.8.unrem · SM.4.status, SM.4.unrem,
SM.4.lock.only · RH.cd.per (a question: #283 rounds the sum once, so five criteria gave 23, not 25), RH.defdwn.agi,
RH.go · MY.evaded, MY.2.passive, MY.2.except (no built NP carries the two tags), MY.4.

**Fixed live:** Logos's natural end named on the Turn card; a blocked effect's reason by name; Hoodie's coin on the
breakdown with its die; `categorizedAs` read as a Set; the bar honours `unaffectedBy`; a non-damaging Process offers
no reaction abilities; refusals name Mythos, Logos and the Mythos pool.

## Statblock

- [ ] **ST.name** · True Name: Gray
- [ ] **ST.class** · Class: Assassin (the sheet's folder; no Class line is printed)
- [ ] **ST.region** · Region: England
- [ ] **ST.align** · Alignment: Lawful Good
- [ ] **ST.param** · STR B, END C, AGI B, MAG C, LUC C
- [ ] **ST.attr** · Attributes: Female, Servant, [Man], Saberface, Humanoid, Round Table, Living Human (Q)
- [ ] **ST.hp** · Base Health 1000
- [ ] **ST.mov** · MOV 6
- [ ] **ST.range** · Range 3 panels, 1 target
- [ ] **ST.ba** · Base Attack STR 125 by the table (the sheet prints 105), MAG 150
- [ ] **ST.na** · Normal Attack: STR (no type printed), its delivery measured (Q)
- [ ] **ST.sus** · Sustainability: N/A
- [ ] **ST.mythos** · Mythos Counters: a pool from 0, at most 40
- [ ] **ST.items** · Items held: none

## Independent Action — Class Skill, Rank A+ *(Passive 1–3)*

- [ ] **IA.sus** · *(Passive 1)* Sustainability does not apply: no clock runs while she is Free
- [ ] **IA.zon** · *(Passive 2)* Her Master's ZON is increased by 3 panels
- [ ] **IA.contract** · *(Passive 3)* She cannot be contracted by enemy Casters and Masters

## Magic Resistance — Class Skill, Rank C *(Passive 1 + 2)*

- [ ] **MR.neg** · MAG damage from a MAG Rank of up to C is negated
- [ ] **MR.red** · …otherwise MAG damage taken is reduced by 30%
- [ ] **MR.np** · …also NP
- [ ] **MR.debuff** · *(Passive 2)* Chance of being inflicted by debuffs is reduced by 15%
- [ ] **MR.ik** · …also Instakill and Death
- [ ] **MR.ik.str** · …unless the Instakill or Death is from an Attack, Attack Skill, Spell or NP that deals STR damage or is not affected by Magic Resistance
- [ ] **MR.erase** · Erase is completely unaffected
- [ ] **MR.note** · Other debuffs from STR or *"not affected"* sources still have their chance reduced

## Face of the King *(Active)*

- [ ] **FK.when** · Used during her Turn
- [ ] **FK.apply** · Applies the 'Hoodie' effect to herself
- [ ] **FK.dur** · …for 2◈
- [ ] **FK.same** · Hoodie has the same effects as Presence Concealment Rank E (HD.*), and every card names it *Hoodie*
- [ ] **FK.cd** · Cooldown: 1◈, counted from when Hoodie is removed from her, whichever way
- [ ] **FK.cd.held** · …no clock runs while Hoodie is held
- [ ] **FK.seal** · Not affected by Skill Seal (Q)

### Hoodie — Presence Concealment Rank E

- [ ] **HD.1.target** · She cannot be targeted for an Attack
- [ ] **HD.1.skill** · …or by an enemy Unit's Skill
- [ ] **HD.1.aoe** · Caught in an AoE Attack and failing to Evade, a Coin is flipped
- [ ] **HD.1.heads** · …Heads: no damage and no effects are received
- [ ] **HD.1.tails** · …Tails: Total Damage taken from that Attack −50%
- [ ] **HD.1.tails.end** · …and Hoodie is removed
- [ ] **HD.2.react** · Her Attacks cannot be Blocked or Countered unless the DU's Agility (Q) is equal to or higher than hers
- [ ] **HD.2.evade** · If the DU Evades, its Evade Roll is increased by 2
- [ ] **HD.3.masters** · She may Attack Masters regardless of enemy Master-Servant positions
- [ ] **HD.3.move** · She may Move to any panel regardless of enemy Master-Servant positions
- [ ] **HD.4** · All damage she deals is increased by 100% (Q)
- [ ] **HD.4.np** · …if NP, 50%
- [ ] **HD.4.master** · …not against Masters
- [ ] **HD.5** · After she performs an Attack while hooded, Hoodie is removed at the end of the Combat Process
- [ ] **HD.6** · Moving into an enemy Servant's Range (or Detect, if in use), she has an 80% chance of being discovered
- [ ] **HD.7** · Active Skills targeting or affecting an enemy Unit cannot be used while hooded
- [ ] **HD.7.except** · …Attack Skills and Spells that deal damage are not refused
- [ ] **HD.8** · Hoodie is neither a buff nor a debuff
- [ ] **HD.8.unrem** · …and is Unremovable

## King's Reflection — Rank A *(Passive 1 + 2)*

- [ ] **KR.1** · At the end of her Turn, her NP Cooldown is reduced by ⅓◈ instead of 1 Turn (Q)
- [ ] **KR.1.acted** · …and at the end of any Turn she Acts (Q)
- [ ] **KR.1.once** · …once a Turn when both hold
- [ ] **KR.1.other** · …a Turn she neither owns nor Acts in ticks 1 Turn as usual (Q)
- [ ] **KR.2** · A successful Normal Attack gains her 1 Mythos Counter
- [ ] **KR.2.crit** · …2 if it Crits
- [ ] **KR.2.miss** · …none on an Evaded or missed Normal Attack
- [ ] **KR.max** · The maximum number of Mythos Counters is 40

## Anti-Spirit Combat — Rank B *(Passive + Active)*

- [ ] **AS.p.dmg** · *(Passive)* All damage she deals to Units with the 'Spirit' or 'Undead' Attribute +40% (Q)
- [ ] **AS.p.np** · …including NP
- [ ] **AS.p.other** · …no bonus against a Unit with neither
- [ ] **AS.p.mythos** · She gains 1 additional Mythos Counter for every Unit with those Attributes hit by a successful Attack (Q)
- [ ] **AS.when** · *(Active)* Used during her Turn
- [ ] **AS.1** · Applies Atk Up for 1◈, all damage dealt +30%
- [ ] **AS.1.np** · …if NP, 15%
- [ ] **AS.2** · Applies Dmg Up (Grave) for 1◈: damage dealt to Spirit or Undead Units further +60% (Q)
- [ ] **AS.2.other** · …no bonus against a Unit with neither
- [ ] **AS.cd** · Cooldown: 4◈

## Sealing Mystic Code Release — Rank C *(Active)*

- [ ] **SM.when** · Used during her Turn
- [ ] **SM.1** · Restores 4 Agility
- [ ] **SM.2** · Applies Atk Up for ⅓◈, all damage dealt +50%
- [ ] **SM.2.np** · …if NP, 30%
- [ ] **SM.3** · Applies Invuln for ⅓◈
- [ ] **SM.3.once** · …1 time: spent by the first hit it stops
- [ ] **SM.4** · Applies the 'Logos' effect for 2◈
- [ ] **SM.4.status** · Logos is neither a buff nor a debuff
- [ ] **SM.4.unrem** · …and is Unremovable
- [ ] **SM.4.lock** · After Logos naturally expires, it cannot be re-applied to her for the next 2◈ (Q)
- [ ] **SM.4.lock.only** · …a Logos that ends any other way starts no lockout
- [ ] **SM.4.perm** · If she had 30 Mythos Counters or more when Logos is applied, it has no duration (Q)
- [ ] **SM.4.held** · Used while she holds Logos (Q)
- [ ] **SM.5** · Gains 1d6 Mythos Counters, the die on the card
- [ ] **SM.cd** · Cooldown: 2◈

## Blessings from the End of the World — Rank B *(Active)*

- [ ] **BL.when** · Used during her Turn
- [ ] **BL.1** · Reduces her NP Cooldown by ½◈, each NP's
- [ ] **BL.2** · Applies Debuff ResUp for 1◈, chance of being inflicted by debuffs −30%
- [ ] **BL.3** · Gains 4 Mythos Counters
- [ ] **BL.cd** · Cooldown: 4◈

## Rhongomyniad: The Spear That Shines To The Ends Of The World — Rank A+ *(NP, Anti-Fortress)*

- [ ] **RH.gate** · Can only be used while she has the 'Logos' effect
- [ ] **RH.logos** · …and using it leaves Logos held (Q)
- [ ] **RH.pierce** · Applies Pierce to herself for ⅓◈ (Q)
- [ ] **RH.mag** · Base Attack (MAG) is used
- [ ] **RH.area** · Hits a 1x6 or 6x1 area in any direction next to her (Q)
- [ ] **RH.area.diag** · …1x5 or 5x1 on the diagonal
- [ ] **RH.who** · Who the area catches, and who counts as a DU (Q)
- [ ] **RH.c1** · Criterion 1: at least two DUs have at least 3 Parameters each equal to or higher than hers
- [ ] **RH.c2** · Criterion 2: there is only one DU in the NP area
- [ ] **RH.c3** · Criterion 3: at least two DUs have the 'Evil' Alignment
- [ ] **RH.c4** · Criterion 4: her Health is less than at least two DUs'
- [ ] **RH.c5** · Criterion 5: none of the DUs have at least 3 Parameters each two Ranks below hers
- [ ] **RH.c6** · Criterion 6: none of the DUs have the 'Elemental' Attribute
- [ ] **RH.c.single** · With Criterion 2 met, Criteria 1, 3, 4 and 5 are met when the single DU meets them
- [ ] **RH.dmg** · With no criteria met, it deals 3x damage plus 100
- [ ] **RH.dmg.per** · …+0.2x for every criterion met (4 met: 3.8x)
- [ ] **RH.cost** · With no criteria met, her Master loses 30 Health as its cost (Q)
- [ ] **RH.cost.per** · …and 10 more for every criterion met
- [ ] **RH.npdef** · Then every affected enemy Unit is inflicted with NP Def Dwn for 1◈: all NP damage received +30% (Q)
- [ ] **RH.defdwn** · …and Def Dwn (C) for 1◈: all damage received +20%
- [ ] **RH.defdwn.agi** · …and Agility −1 whenever damage is received from an Attack
- [ ] **RH.enemy** · …an ally the area catches takes neither debuff (Q)
- [ ] **RH.cdcut** · Then her NP Cooldown is reduced by 1 Turn for each criterion met (Q)
- [ ] **RH.mythos** · …and she gains 2 Mythos Counters for every Unit hit (Q)
- [ ] **RH.cd** · Cooldown: 5◈ with no criteria met (Q)
- [ ] **RH.cd.per** · …increased by ½◈ for every criterion met
- [ ] **RH.go** · In a Grand Order War on the Chaldea Faction, the multiplier begins at 4x instead of 3x (Q)

## Rhongomyniad Mythos: Tower of Dreams Founding the Ends of the World — Rank EX *(NP, Anti-World)*

- [ ] **MY.nondmg** · Non-damaging
- [ ] **MY.when** · Used during her Turn
- [ ] **MY.gate** · Can only be used when she has 40 Mythos Counters (Q)
- [ ] **MY.spend** · …and spends none of them (Q)
- [ ] **MY.range** · Range 2
- [ ] **MY.target** · Used on one enemy Unit within Range
- [ ] **MY.target.ally** · …not on an ally
- [ ] **MY.evade** · If it is not successfully Evaded, the DU is inflicted with the 'Mythos' debuff (Q)
- [ ] **MY.evaded** · …an Evaded Mythos inflicts nothing
- [ ] **MY.hoodie** · Used while hooded, it is her Attack for the Turn (Q)
- [ ] **MY.ignore** · The debuff ignores Debuff Resist and Immune effects
- [ ] **MY.dur** · …and has no duration printed (Q)
- [ ] **MY.1** · Mythos 1: Attacks which use Base Attack (MAG) or deal MAG damage cannot be used (Q)
- [ ] **MY.1.na** · …a Normal Attack among them (Q)
- [ ] **MY.1.both** · …an Attack using Base Attack (STR) and (MAG) combined deals its damage with Base Attack (STR) alone (Q)
- [ ] **MY.2** · Mythos 2: Spells cannot be used (Q)
- [ ] **MY.2.np** · …nor NPs
- [ ] **MY.2.passive** · …and their Passive effects are negated (Q)
- [ ] **MY.2.except** · …except [Anti-Unit Mystic Sword] and [Anti-Unit Secret Technique] NPs
- [ ] **MY.3** · Mythos 3: the effects of Divinity are negated (Q)
- [ ] **MY.4** · Mythos 4: the debuff is Unremovable except by an effect from a Rank EX Skill or NP
- [ ] **MY.4.other** · …a removal from any other source leaves it
- [ ] **MY.cd** · Cooldown: 8◈
