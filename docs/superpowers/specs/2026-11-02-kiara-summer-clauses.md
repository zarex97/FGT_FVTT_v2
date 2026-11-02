# Sessyoin Kiara (Summer) (Moon Cancer) — the Clause list

*Sessyoin Kiara (Summer)*, built from `char_orig_sheets/by-class/Mooncancer/Sessyoin Kiara (Summer).md`. Started by
the user 2026-11-02.

**Audit opened 2026-11-02 (#372).** **Read by hand, line by line.** No generated draft was used. No older `Copia de` sheet
exists to compare with. The sheet prints no Class line (the folder's: Moon Cancer, as Gray's and Summer Habetrot's
were the folder's). She is the first Moon Cancer audited. Her Alter Ego self, `Alter Ego/Sessyoin Kiara.md`, is a
different sheet and is not this audit.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own. A bracketed figure — *"(25%) (30%)"* — is its own Clause, because it is read only when a
Mermaid Token is spent, and that door can fail on its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Mooncancer/Sessyoin Kiara (Summer)"`, each
confirmed by reading the built piece:

- **Her Normal Attack** is Summer Habetrot's word for word: `mode: rangeBanded`, BA(STR) at Range 1, a band
  `{ from: 2, component: mag, element: water }` (`summer-habetrot.yml`, her ruling 4).
- **Swimsuit!** is the same sentence as Anastasia (Summer)'s and Summer Habetrot's: a `DamageModifier` with
  `modifierKey: elementTotalDefUp`, `element: water`, `direction: taken`, 50 and `npValue` 50
  (`anastasia-summer-swimsuit.yml`, `habetrot-swimsuit.yml`). A third copy is the moment to make it one shared Skill.
- **Territory Creation EX** is `class-territory-creation` at EX: 6d20 by `territoryCreationOffence` and 3d10+30 by
  `territoryCreationDefence`, the aura `stacking: highestOnly` in group `territoryCreation`. Every figure on her sheet
  is the table's.
- **Independent Manifestation E** is U-Olga Marie's: `class-independent-action` carried at a Rank under its own name
  (`u-olga-marie.yml`), Sustainability 4◈, ZON +1 and 2 Contract rolls by the E bands of
  `independentActionSustainability`, `independentActionZon` and `independentActionContract`, all three as printed.
  Her fourth passive is Olga's four `ApplicationChance` rules (`volatility: mental`, `severity: instakill`, `death`,
  `erase`) at 40 instead of 100.
- **Spiritual World Creation**'s NP DmUp 10% is the passive NP DmUp Arturia, Scáthach and Summer Habetrot carry.
- **Mermaid's Flesh**: Guts with a revive percent is Sita's (`guts.yml`); Regen's three timings are `regen.yml`'s
  `[turnEnd, actedTurnEnd, roundEnd]` at a magnitude of 15; NP DmUp is `np-dm-up.yml`; *"Removes all debuffs from
  herself"* is a `removeEffect` phase.
- **Jintsūriki**'s NP Cooldown cut is a `CooldownDelta` with `scope: np` (Gray's Blessings); S.Crit Up is
  `s-crit-up.yml`.
- **Clam Palace**'s *"3x3 panel area in any non-diagonal direction next to herself"* is Gilles's Evil Gaze of the
  Abyss: `anchor: selfEdgeAdjacent`, `shape: orientedRect 3x3`. Dodge *"1 time"* is `dodge.yml` with `uses: 1`. Def
  Dwn is `def-dwn.yml`; Def Dwn (A) is `def-dwn-a.yml`, whose Luck drain hears `attackReceived` (Anastasia (Summer)'s
  reading 5, #209, #239). *"Removes all 'Aim' buffs"* is a `removeEffect` of `aim`.
- **Nirmānnarati**'s 5x5 is Gilles's Gigantic Horror's branch shape at 5x5. Its *"damage dealt is increased by
  100% …"* against a condition on the DU is Rama's Brahmastra shape: `conditionalMultipliers`, where *"+200%"* is a
  factor of 3 (`rama-brahmastra.yml`). Instakill is `instakill.yml`.
- **MoonCancer**'s *"If this Servant was summoned in their Region"* reads the War's Region as Tamamo's Dainisshō
  does (`war:region:japan`).

What she needs that nobody has yet, each to be built as a generic piece:

- **The MoonCancer Class passive** (MC.*): eight Moon Cancer sheets print it word for word (Archetype: Earth, BB, BB
  Pele, C.I.E.L, Giant Statue God, Gyokuto, Kishinami Hakuno, Summer Tenochtitlan). One shared template
  `class-mooncancer`, its count *"every different enemy Servant Class on the field other than MoonCancer"* a
  generic count (`countOf: distinctEnemyClasses`), its doubling a `war:region` predicate on the bearer's own Region.
- **Damage taken keyed on the attacker's Attribute** (LE.*): *"received from 'Humanoid' Units"*. Two sheets print
  the shape; none is built.
- **Tokens that are buffs, spent to boost a Skill** (MN.*): a counted buff gained on a ⅓◈ cadence, each Token its
  own buff instance with its own clock, spent automatically by her next Skill to pick a bracketed tier of that
  Skill's figures, its Rank and its Cooldown. No sheet built so far spends a resource for a stronger tier.
- **Bewitchment** (CP.bew.*): a new Mental Debuff, Crit Chance −10%, inflicted more than once as separate
  instances.
- **A count of Mental Debuffs on a Unit** (NM.mental.*, NM.ik.*): the NP's multiplier and its Instakill chance both
  read it.

**100 Clauses** across 9 Abilities, the Normal Attack note and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields. `Mermaid Tokens: 0` is read as
  ST.tokens.
- *"(Sessyoin)"* before every Ability's name: the bearer's label.
- *"Has the following effects-"*: a heading, twice.
- *"Supernatural Power (Ink)."* before Jintsūriki's text: a label. Oei (Summer) prints the same words and no sheet
  reads them as a category (`grep -r "Supernatural Power" char_orig_sheets`: four labels, no reader).
- *"Note: The boosted effects of the Skills will be placed in brackets like so- (1 SRU used) (2 SRU used)"*: the key
  to the brackets. The first bracket is one Mermaid Token spent, the second two. *SRU* is printed nowhere else.
- `Items held:`: an empty slot.
- Nirmānnarati prints no element and no delivery tag: it deals untyped damage and its delivery is measured, as every
  untagged NP's is (#281). Her Normal Attack's Water band is the Normal Attack's alone.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables and beat the sheet (§46.6; #328 ruling 18): Max
Health is **1600** at END A+, not the printed 1500; BA(STR) 100 at STR C and BA(MAG) 210 at MAG A+ agree ·
durations count from the Turn after the Turn of use (#187 reading 5) · an effect's handler does not fire on the Turn
it ends (`regen.yml`'s note) · *"NP Cooldown"* naming no NP reaches every NP (#197 reading 6) · `relations` naming
`ally` include the caster (`resolveIncludeSelf`, #204): Jintsūriki's S.Crit Up and Clam Palace's Dodge reach her ·
Def Dwn (A)'s Luck drain hears the Attack whose damage lands, a hit for 0 and a Block included (#209, #239,
Anastasia (Summer) reading 5) · a debuff's chance is the inflicter's, less the target's resistance · Instakill on a
MAG NP is reduced by Magic Resistance as any MAG Instakill is · riders land on a hit, not a hurt (§46.4-LI) ·
*"restores"* stops at the maximum · every ◈ span rounds down, never to 0, and sums convert once (Gray readings 30–32)
· a sheet binds only its owner.

## Readings

Grilled 2026-11-02. Round 1: readings 1–22 ruled as written, all as recommended. The frontier is empty.

| # | Reading (recommended) | Clauses |
|---|---|---|
| 1 | *"Region: (Japan)"* is Japan for every Region rule: the War Region's +1 to all Parameters (`regionBonusFor`) and MoonCancer's doubling. The parentheses are typographic. The other reading: Japan for MoonCancer's *"summoned in their Region"* only, and no Parameter bonus in a Japan War. Three sheets print a parenthesised Region, all three Kiara (this one, her Alter Ego, Rapture). | ST.region, MC.region |
| 2 | MoonCancer counts the distinct Classes among enemy Servants on the War's board when the damage is computed, Moon Cancer excluded. A defeated Servant off the board does not count; a concealed one shows its Class, so it does. Masters, Summons and Civilians never count. | MC.count |
| 3 | A Servant whose sheet names two Classes counts each one it holds. The other reading: it counts only the first, as the tracker files it. | MC.count |
| 4 | MoonCancer is built once, as a Class template every Moon Cancer sheet references (`class-mooncancer`), not as her own Skill. | MC.* |
| 5 | Mermaid's Nourishment gains a Token at the end of the Turn she used Mermaid's Flesh, then at the end of every Turn ⅓◈ after the last gain while Nourishment stands, never on the Turn it ends (Curse's *"every ⅓◈ from the Turn it lands, which ticks first"*, carried). At 3 Turns a Round that is three Tokens; at 8, four (⅓◈ is 2 Turns); at 15, three (⅓◈ is 5). | MN.gain.first, MN.gain.every |
| 6 | The spend reads her Tokens, not Nourishment: a Token outliving the buff (1◈+⅓◈ against 1◈) still boosts the next Skill. | MN.spend |
| 7 | The spend is automatic: using Jintsūriki or Clam Palace while she holds Tokens spends them, with no choice. With three or more, two are spent and the rest stay. The other reading: every Token is removed and only two count. | MN.spend, MN.max |
| 8 | *"A Skill other than Mermaid's Flesh"* is any Active Skill she uses. One with no brackets would still spend the Tokens and boost nothing; her kit has none. Her NP, her Normal Attack and a Command Spell spend nothing. | MN.spend, MN.spend.mf |
| 9 | The Tokens are spent when the Skill's cost is paid, before its effects, so the boosted tier is the one resolved. A Skill refused before its cost (no target, a Skill Seal) spends none. | MN.spend |
| 10 | A boosted Rank (*"B (B+) (A)"*, *"A (A+) (A++)"*) is the Skill's Rank in force for that use: anything reading the Skill's Rank during it reads the boosted one. The sheet and the bar show the base Rank. | JS.rank, CP.rank |
| 11 | A boosted Cooldown (*"4◈ (4◈-⅓◈) (4◈-⅔◈)"*) is the Cooldown that use sets. | JS.cd.*, CP.cd.* |
| 12 | *"Each Mermaid Token counts as a separate buff"*: each Token is one buff to every count and every removal. A *"remove 1 buff"* takes one Token, a *"remove all buffs"* takes them all, and a count of her buffs counts each. Mermaid's Flesh's own *"Removes all debuffs"* does not touch them. | MN.token.buff |
| 13 | `Mermaid Tokens: 0` in the statblock is the count of her Token buffs, shown on the sheet and the bar: no separate pool. | ST.tokens |
| 14 | Bewitchment *"(Inflict twice) (Inflict three times)"* is two or three separate instances, each −10% Crit Chance (−20%, −30% together), each with its own roll and its own 1◈, each one Mental Debuff to the NP's count. A Bewitchment landing on one already held adds an instance; the held ones keep their clocks. The other reading: one instance at −20% or −30%. | CP.bew.* |
| 15 | Clam Palace's Def Dwn and Def Dwn (A) are two debuffs that both land: +40% damage taken at the base tier. | CP.dd, CP.dda |
| 16 | *"Removes all 'Aim' buffs"* removes every effect of the Aim family, ahead of the three debuffs. | CP.aim |
| 17 | Nirmānnarati's 5x5 names no relation: allies in it are hit, and each is a DU for the multiplier and the Instakill (Gray's reading 15, Lanceturia's ruling 9, #336, carried). The other reading: enemies only. | NM.who |
| 18 | *"Increased by 100% plus 20% for every Mental Debuff (max. 10 times)"* is a multiplier on the 4x, as Rama's *"+200%"* is a factor of 3: ×(2 + 0.2n), n capped at 10. One Mental Debuff: 4x × 2.2 = 8.8x; ten: 4x × 4 = 16x. The other reading: the 100% is the first debuff's, ×(2 + 0.2(n−1)). | NM.mental, NM.mental.per, NM.mental.max |
| 19 | The Instakill counts the same n after the damage, without the *"max. 10"*, which belongs to the damage: 20% a debuff, certain at 5. A DU with no Mental Debuff rolls nothing. Its chance is reduced as any Instakill's is (Independent Action, Magic Resistance on a MAG NP). | NM.ik, NM.ik.zero |
| 20 | A Mental Debuff is an effect of `volatility: mental`, counted per instance. Terror is one: Appendix A §A.11 lists it among the five Mental debuffs, while `terror.yml` says `volatile` with no reason given. The fix moves Terror to `mental`, so Men.Debuff Immune, Olga's and Jack's resistances and Kiara's own 40% start to cover it. | NM.mental, IM.mental |
| 21 | Logos Eater's *"Humanoid' Units"* are those whose Attributes hold Humanoid, implied ones included (Human ⟹ Humanoid); a Master who is Human counts. | LE.1 |
| 22 | MoonCancer's two modifiers stack as an Atk Up and a Def Up do, alongside her other damage modifiers, never multiplied in. The doubling makes them 10% a Class. | MC.dealt, MC.taken |

## Live presses (done, 2026-11-02)

War "Kiara Audit" (scene `aLapqUrTVbcipEua`, fought in Japan, 3 Turns a Round): Kiara and Gray for Faction 1
(Player1); Cú Chulainn, Medea, Arjuna and Kingprotea for Faction 2, Anastasia (Summer) brought in for Water.
Staged where the board would not produce a case: Home Bases painted (the custom War had none), cooldowns reset and
Mermaid Tokens placed for each bracket, her attack flag and the faction's attack pool reset between presses, Health
set for Guts and for her Master's NP cost, Bewitchments placed for the ×4 ceiling, fixed dice for the debuff rolls,
Units moved into areas. Pressed as Player1 through the sheet and the action bar, the enemy side answered from the GM.

**All 100 Clauses closed: 74 Pressed, 26 Observed.** Observed, not pressed, each with what was read: the statblock
lines read off her sheet; `SW.np` (no Water NP in this War); `TC.p2.np` and `TC.stack` (no enemy NP left; no second
Territory Creation on her side); `IM.contract`, `IM.mental`, `IM.ik`, `IM.death`, `IM.erase`, `IM.counts` (the
engine's live answers off her board unit); `MN.token.buff` (each Token one buff instance); `NM.tag`.

**Fixed from the board:** the Instakill rolled against a DU with no Mental Debuff (`chanceBonus.countedOnly`,
`docs/surprises/2026-11-02-instakill-rolled-with-no-mental-debuff.md`); the bar's strip read "∞" for an effect on its
last Turn (`docs/surprises/2026-11-02-bar-strip-says-infinite-on-last-turn.md`); the spend line's wording.

## Statblock

- [x] **ST.name** · True Name: Sessyoin Kiara — Observed live 2026-11-02: her sheet as Player1
- [x] **ST.class** · Class: Moon Cancer (the sheet's folder; no Class line is printed) — Observed live 2026-11-02: the portrait card reads Moon Cancer
- [x] **ST.region** · Region: (Japan) (Q) — Observed live 2026-11-02: Japan; in the Japan War every Parameter reads +1 (C→C+, A+→A++)
- [x] **ST.align** · Alignment: Lawful Evil — Observed live 2026-11-02: Lawful Evil on the sheet
- [x] **ST.param** · STR C, END A+, AGI C, MAG A+, LUC B — Observed live 2026-11-02: C A+ C A+ B written, the Region's step beside each
- [x] **ST.attr** · Attributes: Female, Servant, [Earth], Humanoid, Anti-Hero (Spirit implied) — Observed live 2026-11-02: board attributes female, servant, earth, humanoid, antiHero, spirit, hominidae
- [x] **ST.hp** · Base Health 1600 by the table (the sheet prints 1500) — Observed live 2026-11-02: 1700 in the Japan War (END A++ with the Region's step; 1600 at A+, unit-tested)
- [x] **ST.mov** · MOV 5 — Observed live 2026-11-02: MOV 5
- [x] **ST.range** · Range 3 panels, 1 target — Observed live 2026-11-02: Range 3, 1 target
- [x] **ST.ba** · Base Attack STR 100, MAG 210 — Observed live 2026-11-02: BA 100→110 / 210→220 (the Region's step)
- [x] **ST.sus** · Sustainability: 4◈ Turns — Observed live 2026-11-02: 4◈, 12 turns left
- [x] **ST.tokens** · Mermaid Tokens: 0, the count of her Token buffs (Q) — Observed live 2026-11-02: the bar's strip shows each Mermaid Token with its own clock
- [x] **ST.items** · Items held: none — Observed live 2026-11-02: none

## Normal Attack — the Note

- [x] **NA.str** · At a Range of 1, her Normal Attacks use Base Attack (STR) — Pressed live 2026-11-02: as Player1 at Range 1 on Arjuna, BA(STR) 110
- [x] **NA.mag** · At a Range of 2 or higher, they use Base Attack (MAG) — Pressed live 2026-11-02: as Player1 at Range 2 on Arjuna, BA(MAG) 220
- [x] **NA.water** · …and deal Water damage — Pressed live 2026-11-02: at Range 2 on Anastasia (Summer), her 'Swimsuit! (Total water) ×0.5' read it (declared GM-side)

## Swimsuit! *(Passive)*

- [x] **SW.water** · All Total Water damage taken is reduced by 50% — Pressed live 2026-11-02: Anastasia's Ice Bucket Challenge (Water) on Kiara, 'Swimsuit! (Total water) ×0.5'
- [x] **SW.np** · …including NP — Observed live 2026-11-02: the modifier's npValue 50 on her board unit; no Water NP in this War

## MoonCancer *(Passive)*

- [x] **MC.count** · The count: every different enemy Servant Class on the field other than Moon Cancer (Q) — Pressed live 2026-11-02: −40 at four enemy Classes, −20/+20 at two, 0 with none standing; +30 on the NP Process after Medea fell
- [x] **MC.dealt** · All damage dealt is increased by 5% for each — Pressed live 2026-11-02: Kiara's Normal Attacks +20
- [x] **MC.dealt.np** · …including NP — Pressed live 2026-11-02: her NP +40, then +30
- [x] **MC.taken** · All damage taken is reduced by 5% for each — Pressed live 2026-11-02: Cú's Normal Attack −40
- [x] **MC.taken.np** · …including NP — Pressed live 2026-11-02: Kingprotea's NP −20
- [x] **MC.region** · If she was summoned in her Region, both magnitudes are doubled (10% a Class) (Q) — Pressed live 2026-11-02: 10% a Class in the Japan War; observed live 2026-11-02 5% a Class on the Gray Audit board (no Region)

## Territory Creation — Class Skill, Rank EX *(Passive 1 + 2)*

- [x] **TC.p1** · *(Passive 1)* In her Home Base, all damage she deals is increased by 6d20 after calculation — Pressed live 2026-11-02: her Normal Attack from her Home Base, 'Territory Creation = 68'
- [x] **TC.p1.np** · …including NP — Pressed live 2026-11-02: her NP from her Home Base, 'Territory Creation = 59'
- [x] **TC.p2** · *(Passive 2)* While she is on the field, damage taken by allied Units in their Home Base is further reduced by (3d10+30) — Pressed live 2026-11-02: Gray in his Home Base hit by a Master, 'Territory Creation = −51'
- [x] **TC.p2.np** · …including NP — Observed live 2026-11-02: the aura's dice reduction carries no NP exclusion; no enemy NP was left to throw
- [x] **TC.stack** · With several allied Territory Creations, only the highest Rank takes effect — Observed live 2026-11-02: her aura is group territoryCreation, highestOnly; no second Territory Creation on her side

## Independent Manifestation — Class Skill, Rank E *(Passive 1–4)*

- [x] **IM.sus** · *(Passive 1)* A high Sustainability: 4◈ Turns — Observed live 2026-11-02: 4◈ on the sheet
- [x] **IM.zon** · *(Passive 2)* Her Master's ZON is increased by 1 panel — Observed live 2026-11-02: her Master's ZON 3 with +1 Independent Manifestation
- [x] **IM.contract** · *(Passive 3)* Enemy Masters and Casters need 2 successful 'Contract Servant' rolls to contract her — Observed live 2026-11-02: rollsRequired 2 by an enemy, 1 by an ally
- [x] **IM.mental** · *(Passive)* Chance of being inflicted with Mental Debuffs is reduced by 40% — Observed live 2026-11-02: applicationChances 40 (mental)
- [x] **IM.ik** · …Instakill, reduced by 40% — Observed live 2026-11-02: applicationChances 40 (instakill)
- [x] **IM.death** · …Death, reduced by 40% — Observed live 2026-11-02: applicationChances 40 (death)
- [x] **IM.erase** · …Erase, reduced by 40% — Observed live 2026-11-02: applicationChances 40 (erase)
- [x] **IM.counts** · This Skill counts as 'Independent Action — Rank: E' — Observed live 2026-11-02: slug independentAction at Rank E

## Spiritual World Creation — Rank EX *(Passive)*

- [x] **SP.np** · NP damage dealt is increased by 10% — Pressed live 2026-11-02: 'Spiritual World Creation = 10' on her NP

## Logos Eater — Rank D *(Passive)*

- [x] **LE.1** · All damage received from 'Humanoid' Units is reduced by 10% (Q) — Pressed live 2026-11-02: 'Logos Eater = −10' against Cú's and Anastasia's attacks
- [x] **LE.np** · …including NP — Pressed live 2026-11-02: −10 on Kingprotea's NP

## Mermaid's Flesh — Rank EX *(Active)*

- [x] **MF.when** · Used during her Turn — Pressed live 2026-11-02: as Player1 on her Turn
- [x] **MF.guts** · 1. Applies Guts for 1◈+⅔◈ Turns — Pressed live 2026-11-02: Guts 25, expiry 6 (1◈+⅔◈)
- [x] **MF.guts.rev** · …when she is defeated she revives with 25% of her Max Health — Pressed live 2026-11-02: Kingprotea's NP felled her at 1 Health: 'revived by Guts, with 425 Health'
- [x] **MF.cleanse** · 2. Removes all debuffs from herself — Pressed live 2026-11-02: 'Def Dwn removed'
- [x] **MF.regen** · 3. Applies Regen for 1◈ Turns — Pressed live 2026-11-02: Regen 15, expiry 4
- [x] **MF.regen.heal** · …her Health is restored by 15% of its maximum at the end of her Turn, at the end of any Turn she Acts, and at the end of the Round — Pressed live 2026-11-02: +255 at the end of her Turn, of a Turn she Evaded, and of the Round; +18 to the cap
- [x] **MF.npup** · 4. Applies NP DmUp for 1◈ Turns, NP damage dealt is increased by 20% — Pressed live 2026-11-02: NP DmUp 20, read on her NP
- [x] **MF.nour** · 5. Applies the 'Mermaid's Nourishment' buff for 1◈ Turns — Pressed live 2026-11-02: Mermaid's Nourishment, expiry 4
- [x] **MF.cd** · Cooldown: 4◈ Turns — Pressed live 2026-11-02: 12

### Mermaid's Nourishment *(the buff)*

- [x] **MN.gain.first** · At the end of the Turn the buff was applied, she gains one Mermaid Token (Q) — Pressed live 2026-11-02: a Token at the end of Turn 1
- [x] **MN.gain.every** · …and at the end of the Turn after every ⅓◈ Turns (Q) — Pressed live 2026-11-02: at the end of Turns 2 and 3: three at 3 Turns a Round
- [x] **MN.token.dur** · Each Mermaid Token lasts 1◈+⅓◈ Turns — Pressed live 2026-11-02: each 1◈+⅓◈ (expiry 5, 6, 7)
- [x] **MN.token.buff** · Each Mermaid Token counts as a separate buff (Q) — Observed live 2026-11-02: each Token one buff instance, six counted with three others
- [x] **MN.spend** · Using a Skill while she holds any Mermaid Tokens removes them from her (Q) — Pressed live 2026-11-02: Clam Palace spent 2 of 3
- [x] **MN.spend.mf** · …a Skill other than Mermaid's Flesh: Mermaid's Flesh spends none (Q) — Pressed live 2026-11-02: Mermaid's Flesh with 2 Tokens kept both
- [x] **MN.boost** · …and that Skill's effects are boosted: its first bracket for one Token, its second for two — Pressed live 2026-11-02: 'Mermaid Token ×2 spent: Clam Palace at Rank A++'
- [x] **MN.max** · At most two Mermaid Tokens are consumed by one Skill use (Q) — Pressed live 2026-11-02: the third Token kept

## Jintsūriki (Sumi) — Rank B (B+) (A) *(Active)*

- [x] **JS.when** · Used during her Turn — Pressed live 2026-11-02: as Player1
- [x] **JS.rank** · Its Rank is B; B+ with one Token, A with two (Q) — Pressed live 2026-11-02: card B, B+, A
- [x] **JS.npcd** · Reduces her NP Cooldown by 1◈ Turns — Pressed live 2026-11-02: 21→18
- [x] **JS.npcd.1** · …by 1◈+⅓◈ Turns with one Token — Pressed live 2026-11-02: 21→17
- [x] **JS.npcd.2** · …by 1◈+⅔◈ Turns with two — Pressed live 2026-11-02: 21→16
- [x] **JS.crit** · Then applies S.Crit Up for ⅓◈ Turns to all allied Units within a 2 panel area of her, herself included — Pressed live 2026-11-02: her aura gives Gray +25 Crit Chance
- [x] **JS.crit.val** · …Crit Chance is increased by 20% — Pressed live 2026-11-02: 20
- [x] **JS.crit.1** · …25% with one Token — Pressed live 2026-11-02: 25
- [x] **JS.crit.2** · …30% with two — Pressed live 2026-11-02: 30
- [x] **JS.cd** · Cooldown: 4◈ Turns — Pressed live 2026-11-02: 12
- [x] **JS.cd.1** · …4◈-⅓◈ Turns with one Token — Pressed live 2026-11-02: 11
- [x] **JS.cd.2** · …4◈-⅔◈ Turns with two — Pressed live 2026-11-02: 10

## Clam Palace — Rank A (A+) (A++) *(Active)*

- [x] **CP.when** · Used during her Turn — Pressed live 2026-11-02: as Player1
- [x] **CP.rank** · Its Rank is A; A+ with one Token, A++ with two (Q) — Pressed live 2026-11-02: card A, A+, A++
- [x] **CP.dodge** · First, applies Dodge for 1◈ Turns, 1 time, to all allied Units within a 2 panel area of her, herself included — Pressed live 2026-11-02: Dodge on her, Gray and her Master
- [x] **CP.area** · Then affects every enemy Unit within a 3x3 panel area in any non-diagonal direction next to her — Pressed live 2026-11-02: the east 3x3; Arjuna outside untouched
- [x] **CP.enemy** · …enemies only: an ally in the 3x3 is untouched — Pressed live 2026-11-02: 'NOT TARGETED Assassin — an ally' inside the 3x3
- [x] **CP.aim** · 1. Removes all 'Aim' buffs from the affected Units (Q) — Pressed live 2026-11-02: 'Lancer: Aim removed'
- [x] **CP.bew** · 2. Inflicts the 'Bewitchment' Mental Debuff for 1◈ Turns, Crit Chance is reduced by 10% (Q) — Pressed live 2026-11-02: once; Cú's Crit Chance read 30 with two
- [x] **CP.bew.1** · …inflicted twice with one Token (Q) — Pressed live 2026-11-02: twice
- [x] **CP.bew.2** · …three times with two (Q) — Pressed live 2026-11-02: three rolls, one landed, two resisted; then three landed
- [x] **CP.bew.mental** · Bewitchment is a Mental Debuff — Pressed live 2026-11-02: counted by her NP as a Mental Debuff
- [x] **CP.dd** · 3. Inflicts Def Dwn for 1◈ Turns, all damage taken is increased by 20% (Q) — Pressed live 2026-11-02: 20
- [x] **CP.dd.1** · …25% with one Token — Pressed live 2026-11-02: 25
- [x] **CP.dd.2** · …30% with two — Pressed live 2026-11-02: 30
- [x] **CP.dda** · 4. Inflicts Def Dwn (A) for 1◈ Turns, all damage taken is increased by 20% (Q) — Pressed live 2026-11-02: 20
- [x] **CP.dda.1** · …25% with one Token — Pressed live 2026-11-02: 25
- [x] **CP.dda.2** · …30% with two — Pressed live 2026-11-02: 30
- [x] **CP.dda.luck** · …and Luck is reduced by 1 whenever damage is received from an Attack — Pressed live 2026-11-02: Gray's hit on Cú: Luck 4→3
- [x] **CP.cd** · Cooldown: 4◈ Turns — Pressed live 2026-11-02: 12
- [x] **CP.cd.1** · …4◈-⅓◈ Turns with one Token — Pressed live 2026-11-02: 11
- [x] **CP.cd.2** · …4◈-⅔◈ Turns with two — Pressed live 2026-11-02: 10

## Nirmānnarati - Heaven's Form: Paradise of Pleasure - Mandala — Rank A (NP) [Anti-World]

- [x] **NM.tag** · An [Anti-World] Noble Phantasm of Rank A — Observed live 2026-11-02: npTags antiWorld
- [x] **NM.ba** · Base Attack (MAG) is used — Pressed live 2026-11-02: BA(MAG) 220
- [x] **NM.area** · Hits a 5x5 panel area in any non-diagonal direction next to her — Pressed live 2026-11-02: the east 5x5, 25 panels, three targets
- [x] **NM.who** · …every Unit in it is a DU (Q) — Pressed live 2026-11-02: Gray, her ally, hit for 840
- [x] **NM.dmg** · Deals 4x damage — Pressed live 2026-11-02: '4× damage'
- [x] **NM.mental** · If the DU has any Mental Debuffs, damage dealt is increased by 100% (Q) — Pressed live 2026-11-02: Cú 'Mental Debuffs ×2.2'
- [x] **NM.mental.per** · …plus 20% for every Mental Debuff on the DU (Q) — Pressed live 2026-11-02: one debuff ×2.2
- [x] **NM.mental.max** · …counted at most 10 times (Q) — Pressed live 2026-11-02: Kingprotea with 11, '×4'
- [x] **NM.ik** · Then, an X% chance of inflicting Instakill on the DU, X = 20 × its Mental Debuffs (Q) — Pressed live 2026-11-02: Cú 'rolled 29 vs 5%' (20 less his resistance)
- [x] **NM.ik.zero** · …a DU with no Mental Debuff is never rolled for (Q) — Pressed live 2026-11-02: 'not applied, nothing to count' on Gray and Anastasia (after the fix)
- [x] **NM.cd** · Cooldown: 7◈ Turns — Pressed live 2026-11-02: 21
