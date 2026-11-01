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
| 34 | **Ruled 2026-11-01.** A non-damaging NP's Process that lands is no successful Attack: it is her Attack for the Turn and ends Hoodie (reading 20), but no Unit was hit and none received damage. Def Dwn (C) does not drain, Anti-Spirit Combat pays nothing, and no hit counter counts it. | MY.nondmg, AS.p.mythos |
| 35 | **Ruled 2026-11-01.** `HD.7` and `HD.7.except` are unreachable for her kit: her four Active Skills are self-only. Pressed as far as it goes: a self Skill used while hooded is not refused. The shared gate (`canUseWhileConcealed`) was pressed on Kiritsugu and Danzō. | HD.7, HD.7.except |
| 36 | **Ruled 2026-11-01, overturning Q48.** Rule Breaker ignores Independent Action: *"they are not being contracted in the traditional way of the word... Rolling dice or by conquest"*. Medea takes Gray as she takes anyone. `IA.contract` is the roll and the conquest. | IA.contract |
| 37 | **Ruled 2026-11-01.** `HD.8` and `HD.8.unrem` are Observed: Hoodie is a status, so no buff removal selects it, and a hooded Gray can't be targeted by one. The live press of the same shape is Logos under Rule Breaker. | HD.8, HD.8.unrem |

## Live presses (done, 2026-11-01)

War "Gray Audit" (scene `50ZJJWLyVTRXGyP4`): Gray and Tamamo for Faction 1 (Player1); Medea, Arjuna, Summer Habetrot,
Mannanán, and later Anastasia (Summer) and Kingprotea, for Faction 2. Staged where the board would not produce a
case: NP gates at Round 1, Turns per Round 8 for Turns 3 to 8 (King's Reflection), revivals (Arjuna, Medea, Gray),
a Skill Seal, cooldowns, Mythos and Agility set by hand, Master Health refilled, fixed dice for coins and Evades,
Gray made Free for Independent Action, the Grand Order rule with Faction 1 as Chaldea.

**All 139 Clauses closed.** Pressed live as Player1, the enemy side answered from the GM.

**Observed, not pressed** (no press reaches them, said in each reading): `HD.7`, `HD.7.except` (reading 35: her
Skills are self-only; a self Skill used hooded is not refused); `HD.8`, `HD.8.unrem` (reading 37: Logos's press of
the same shape); `MR.ik.str`, `MR.erase` (her contributions read live: Magic Resistance's 15 on Instakill and Death
carries `not attack:component:str` and `not attack:ignoresMagicResistance`, and lists no Erase; no STR Instakill or
Erase source is built in this War); `MY.2.passive` (every Spell and NP of Medea, Arjuna and Kingprotea read
`negated`, so their rules are collected from nothing; none of them carries a passive to watch drop).

**Fixed from the board:** Logos's natural end named on the Turn card; a blocked effect's reason by name; Hoodie's
coin on the breakdown with its die; `categorizedAs` read as a Set; the bar honours `unaffectedBy`; a non-damaging
Process offers no reaction abilities and is no successful Attack (reading 34); refusals name Mythos, Logos and the
pool; every ◈ span rounds down, sums converted once (readings 30 to 32).

**Overturned on the way:** Q48 (reading 36), Rule Breaker takes an Independent Action A+ Servant.

## Statblock

- [x] **ST.name** · True Name: Gray
- [x] **ST.class** · Class: Assassin (the sheet's folder; no Class line is printed)
- [x] **ST.region** · Region: England
- [x] **ST.align** · Alignment: Lawful Good
- [x] **ST.param** · STR B, END C, AGI B, MAG C, LUC C
- [x] **ST.attr** · Attributes: Female, Servant, [Man], Saberface, Humanoid, Round Table, Living Human (Q)
- [x] **ST.hp** · Base Health 1000
- [x] **ST.mov** · MOV 6
- [x] **ST.range** · Range 3 panels, 1 target
- [x] **ST.ba** · Base Attack STR 125 by the table (the sheet prints 105), MAG 150
- [x] **ST.na** · Normal Attack: STR (no type printed), its delivery measured (Q)
- [x] **ST.sus** · Sustainability: N/A
- [x] **ST.mythos** · Mythos Counters: a pool from 0, at most 40
- [x] **ST.items** · Items held: none

## Independent Action — Class Skill, Rank A+ *(Passive 1–3)*

- [x] **IA.sus** · *(Passive 1)* Sustainability does not apply: no clock runs while she is Free
- [x] **IA.zon** · *(Passive 2)* Her Master's ZON is increased by 3 panels
- [x] **IA.contract** · *(Passive 3)* She cannot be contracted by enemy Casters and Masters

## Magic Resistance — Class Skill, Rank C *(Passive 1 + 2)*

- [x] **MR.neg** · MAG damage from a MAG Rank of up to C is negated
- [x] **MR.red** · …otherwise MAG damage taken is reduced by 30%
- [x] **MR.np** · …also NP
- [x] **MR.debuff** · *(Passive 2)* Chance of being inflicted by debuffs is reduced by 15%
- [x] **MR.ik** · …also Instakill and Death
- [x] **MR.ik.str** · …unless the Instakill or Death is from an Attack, Attack Skill, Spell or NP that deals STR damage or is not affected by Magic Resistance
- [x] **MR.erase** · Erase is completely unaffected
- [x] **MR.note** · Other debuffs from STR or *"not affected"* sources still have their chance reduced

## Face of the King *(Active)*

- [x] **FK.when** · Used during her Turn
- [x] **FK.apply** · Applies the 'Hoodie' effect to herself
- [x] **FK.dur** · …for 2◈
- [x] **FK.same** · Hoodie has the same effects as Presence Concealment Rank E (HD.*), and every card names it *Hoodie*
- [x] **FK.cd** · Cooldown: 1◈, counted from when Hoodie is removed from her, whichever way
- [x] **FK.cd.held** · …no clock runs while Hoodie is held
- [x] **FK.seal** · Not affected by Skill Seal (Q)

### Hoodie — Presence Concealment Rank E

- [x] **HD.1.target** · She cannot be targeted for an Attack
- [x] **HD.1.skill** · …or by an enemy Unit's Skill
- [x] **HD.1.aoe** · Caught in an AoE Attack and failing to Evade, a Coin is flipped
- [x] **HD.1.heads** · …Heads: no damage and no effects are received
- [x] **HD.1.tails** · …Tails: Total Damage taken from that Attack −50%
- [x] **HD.1.tails.end** · …and Hoodie is removed
- [x] **HD.2.react** · Her Attacks cannot be Blocked or Countered unless the DU's Agility (Q) is equal to or higher than hers
- [x] **HD.2.evade** · If the DU Evades, its Evade Roll is increased by 2
- [x] **HD.3.masters** · She may Attack Masters regardless of enemy Master-Servant positions
- [x] **HD.3.move** · She may Move to any panel regardless of enemy Master-Servant positions
- [x] **HD.4** · All damage she deals is increased by 100% (Q)
- [x] **HD.4.np** · …if NP, 50%
- [x] **HD.4.master** · …not against Masters
- [x] **HD.5** · After she performs an Attack while hooded, Hoodie is removed at the end of the Combat Process
- [x] **HD.6** · Moving into an enemy Servant's Range (or Detect, if in use), she has an 80% chance of being discovered
- [x] **HD.7** · Active Skills targeting or affecting an enemy Unit cannot be used while hooded
- [x] **HD.7.except** · …Attack Skills and Spells that deal damage are not refused
- [x] **HD.8** · Hoodie is neither a buff nor a debuff
- [x] **HD.8.unrem** · …and is Unremovable

## King's Reflection — Rank A *(Passive 1 + 2)*

- [x] **KR.1** · At the end of her Turn, her NP Cooldown is reduced by ⅓◈ instead of 1 Turn (Q)
- [x] **KR.1.acted** · …and at the end of any Turn she Acts (Q)
- [x] **KR.1.once** · …once a Turn when both hold
- [x] **KR.1.other** · …a Turn she neither owns nor Acts in ticks 1 Turn as usual (Q)
- [x] **KR.2** · A successful Normal Attack gains her 1 Mythos Counter
- [x] **KR.2.crit** · …2 if it Crits
- [x] **KR.2.miss** · …none on an Evaded or missed Normal Attack
- [x] **KR.max** · The maximum number of Mythos Counters is 40

## Anti-Spirit Combat — Rank B *(Passive + Active)*

- [x] **AS.p.dmg** · *(Passive)* All damage she deals to Units with the 'Spirit' or 'Undead' Attribute +40% (Q)
- [x] **AS.p.np** · …including NP
- [x] **AS.p.other** · …no bonus against a Unit with neither
- [x] **AS.p.mythos** · She gains 1 additional Mythos Counter for every Unit with those Attributes hit by a successful Attack (Q)
- [x] **AS.when** · *(Active)* Used during her Turn
- [x] **AS.1** · Applies Atk Up for 1◈, all damage dealt +30%
- [x] **AS.1.np** · …if NP, 15%
- [x] **AS.2** · Applies Dmg Up (Grave) for 1◈: damage dealt to Spirit or Undead Units further +60% (Q)
- [x] **AS.2.other** · …no bonus against a Unit with neither
- [x] **AS.cd** · Cooldown: 4◈

## Sealing Mystic Code Release — Rank C *(Active)*

- [x] **SM.when** · Used during her Turn
- [x] **SM.1** · Restores 4 Agility
- [x] **SM.2** · Applies Atk Up for ⅓◈, all damage dealt +50%
- [x] **SM.2.np** · …if NP, 30%
- [x] **SM.3** · Applies Invuln for ⅓◈
- [x] **SM.3.once** · …1 time: spent by the first hit it stops
- [x] **SM.4** · Applies the 'Logos' effect for 2◈
- [x] **SM.4.status** · Logos is neither a buff nor a debuff
- [x] **SM.4.unrem** · …and is Unremovable
- [x] **SM.4.lock** · After Logos naturally expires, it cannot be re-applied to her for the next 2◈ (Q)
- [x] **SM.4.lock.only** · …a Logos that ends any other way starts no lockout
- [x] **SM.4.perm** · If she had 30 Mythos Counters or more when Logos is applied, it has no duration (Q)
- [x] **SM.4.held** · Used while she holds Logos (Q)
- [x] **SM.5** · Gains 1d6 Mythos Counters, the die on the card
- [x] **SM.cd** · Cooldown: 2◈

## Blessings from the End of the World — Rank B *(Active)*

- [x] **BL.when** · Used during her Turn
- [x] **BL.1** · Reduces her NP Cooldown by ½◈, each NP's
- [x] **BL.2** · Applies Debuff ResUp for 1◈, chance of being inflicted by debuffs −30%
- [x] **BL.3** · Gains 4 Mythos Counters
- [x] **BL.cd** · Cooldown: 4◈

## Rhongomyniad: The Spear That Shines To The Ends Of The World — Rank A+ *(NP, Anti-Fortress)*

- [x] **RH.gate** · Can only be used while she has the 'Logos' effect
- [x] **RH.logos** · …and using it leaves Logos held (Q)
- [x] **RH.pierce** · Applies Pierce to herself for ⅓◈ (Q)
- [x] **RH.mag** · Base Attack (MAG) is used
- [x] **RH.area** · Hits a 1x6 or 6x1 area in any direction next to her (Q)
- [x] **RH.area.diag** · …1x5 or 5x1 on the diagonal
- [x] **RH.who** · Who the area catches, and who counts as a DU (Q)
- [x] **RH.c1** · Criterion 1: at least two DUs have at least 3 Parameters each equal to or higher than hers
- [x] **RH.c2** · Criterion 2: there is only one DU in the NP area
- [x] **RH.c3** · Criterion 3: at least two DUs have the 'Evil' Alignment
- [x] **RH.c4** · Criterion 4: her Health is less than at least two DUs'
- [x] **RH.c5** · Criterion 5: none of the DUs have at least 3 Parameters each two Ranks below hers
- [x] **RH.c6** · Criterion 6: none of the DUs have the 'Elemental' Attribute
- [x] **RH.c.single** · With Criterion 2 met, Criteria 1, 3, 4 and 5 are met when the single DU meets them
- [x] **RH.dmg** · With no criteria met, it deals 3x damage plus 100
- [x] **RH.dmg.per** · …+0.2x for every criterion met (4 met: 3.8x)
- [x] **RH.cost** · With no criteria met, her Master loses 30 Health as its cost (Q)
- [x] **RH.cost.per** · …and 10 more for every criterion met
- [x] **RH.npdef** · Then every affected enemy Unit is inflicted with NP Def Dwn for 1◈: all NP damage received +30% (Q)
- [x] **RH.defdwn** · …and Def Dwn (C) for 1◈: all damage received +20%
- [x] **RH.defdwn.agi** · …and Agility −1 whenever damage is received from an Attack
- [x] **RH.enemy** · …an ally the area catches takes neither debuff (Q)
- [x] **RH.cdcut** · Then her NP Cooldown is reduced by 1 Turn for each criterion met (Q)
- [x] **RH.mythos** · …and she gains 2 Mythos Counters for every Unit hit (Q)
- [x] **RH.cd** · Cooldown: 5◈ with no criteria met (Q)
- [x] **RH.cd.per** · …increased by ½◈ for every criterion met
- [x] **RH.go** · In a Grand Order War on the Chaldea Faction, the multiplier begins at 4x instead of 3x (Q)

## Rhongomyniad Mythos: Tower of Dreams Founding the Ends of the World — Rank EX *(NP, Anti-World)*

- [x] **MY.nondmg** · Non-damaging
- [x] **MY.when** · Used during her Turn
- [x] **MY.gate** · Can only be used when she has 40 Mythos Counters (Q)
- [x] **MY.spend** · …and spends none of them (Q)
- [x] **MY.range** · Range 2
- [x] **MY.target** · Used on one enemy Unit within Range
- [x] **MY.target.ally** · …not on an ally
- [x] **MY.evade** · If it is not successfully Evaded, the DU is inflicted with the 'Mythos' debuff (Q)
- [x] **MY.evaded** · …an Evaded Mythos inflicts nothing
- [x] **MY.hoodie** · Used while hooded, it is her Attack for the Turn (Q)
- [x] **MY.ignore** · The debuff ignores Debuff Resist and Immune effects
- [x] **MY.dur** · …and has no duration printed (Q)
- [x] **MY.1** · Mythos 1: Attacks which use Base Attack (MAG) or deal MAG damage cannot be used (Q)
- [x] **MY.1.na** · …a Normal Attack among them (Q)
- [x] **MY.1.both** · …an Attack using Base Attack (STR) and (MAG) combined deals its damage with Base Attack (STR) alone (Q)
- [x] **MY.2** · Mythos 2: Spells cannot be used (Q)
- [x] **MY.2.np** · …nor NPs
- [x] **MY.2.passive** · …and their Passive effects are negated (Q)
- [x] **MY.2.except** · …except [Anti-Unit Mystic Sword] and [Anti-Unit Secret Technique] NPs
- [x] **MY.3** · Mythos 3: the effects of Divinity are negated (Q)
- [x] **MY.4** · Mythos 4: the debuff is Unremovable except by an effect from a Rank EX Skill or NP
- [x] **MY.4.other** · …a removal from any other source leaves it
- [x] **MY.cd** · Cooldown: 8◈
