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

To be grilled.

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

## Statblock

- [ ] **ST.name** · True Name: Sessyoin Kiara
- [ ] **ST.class** · Class: Moon Cancer (the sheet's folder; no Class line is printed)
- [ ] **ST.region** · Region: (Japan) (Q)
- [ ] **ST.align** · Alignment: Lawful Evil
- [ ] **ST.param** · STR C, END A+, AGI C, MAG A+, LUC B
- [ ] **ST.attr** · Attributes: Female, Servant, [Earth], Humanoid, Anti-Hero (Spirit implied)
- [ ] **ST.hp** · Base Health 1600 by the table (the sheet prints 1500)
- [ ] **ST.mov** · MOV 5
- [ ] **ST.range** · Range 3 panels, 1 target
- [ ] **ST.ba** · Base Attack STR 100, MAG 210
- [ ] **ST.sus** · Sustainability: 4◈ Turns
- [ ] **ST.tokens** · Mermaid Tokens: 0, the count of her Token buffs (Q)
- [ ] **ST.items** · Items held: none

## Normal Attack — the Note

- [ ] **NA.str** · At a Range of 1, her Normal Attacks use Base Attack (STR)
- [ ] **NA.mag** · At a Range of 2 or higher, they use Base Attack (MAG)
- [ ] **NA.water** · …and deal Water damage

## Swimsuit! *(Passive)*

- [ ] **SW.water** · All Total Water damage taken is reduced by 50%
- [ ] **SW.np** · …including NP

## MoonCancer *(Passive)*

- [ ] **MC.count** · The count: every different enemy Servant Class on the field other than Moon Cancer (Q)
- [ ] **MC.dealt** · All damage dealt is increased by 5% for each
- [ ] **MC.dealt.np** · …including NP
- [ ] **MC.taken** · All damage taken is reduced by 5% for each
- [ ] **MC.taken.np** · …including NP
- [ ] **MC.region** · If she was summoned in her Region, both magnitudes are doubled (10% a Class) (Q)

## Territory Creation — Class Skill, Rank EX *(Passive 1 + 2)*

- [ ] **TC.p1** · *(Passive 1)* In her Home Base, all damage she deals is increased by 6d20 after calculation
- [ ] **TC.p1.np** · …including NP
- [ ] **TC.p2** · *(Passive 2)* While she is on the field, damage taken by allied Units in their Home Base is further reduced by (3d10+30)
- [ ] **TC.p2.np** · …including NP
- [ ] **TC.stack** · With several allied Territory Creations, only the highest Rank takes effect

## Independent Manifestation — Class Skill, Rank E *(Passive 1–4)*

- [ ] **IM.sus** · *(Passive 1)* A high Sustainability: 4◈ Turns
- [ ] **IM.zon** · *(Passive 2)* Her Master's ZON is increased by 1 panel
- [ ] **IM.contract** · *(Passive 3)* Enemy Masters and Casters need 2 successful 'Contract Servant' rolls to contract her
- [ ] **IM.mental** · *(Passive)* Chance of being inflicted with Mental Debuffs is reduced by 40%
- [ ] **IM.ik** · …Instakill, reduced by 40%
- [ ] **IM.death** · …Death, reduced by 40%
- [ ] **IM.erase** · …Erase, reduced by 40%
- [ ] **IM.counts** · This Skill counts as 'Independent Action — Rank: E'

## Spiritual World Creation — Rank EX *(Passive)*

- [ ] **SP.np** · NP damage dealt is increased by 10%

## Logos Eater — Rank D *(Passive)*

- [ ] **LE.1** · All damage received from 'Humanoid' Units is reduced by 10% (Q)
- [ ] **LE.np** · …including NP

## Mermaid's Flesh — Rank EX *(Active)*

- [ ] **MF.when** · Used during her Turn
- [ ] **MF.guts** · 1. Applies Guts for 1◈+⅔◈ Turns
- [ ] **MF.guts.rev** · …when she is defeated she revives with 25% of her Max Health
- [ ] **MF.cleanse** · 2. Removes all debuffs from herself
- [ ] **MF.regen** · 3. Applies Regen for 1◈ Turns
- [ ] **MF.regen.heal** · …her Health is restored by 15% of its maximum at the end of her Turn, at the end of any Turn she Acts, and at the end of the Round
- [ ] **MF.npup** · 4. Applies NP DmUp for 1◈ Turns, NP damage dealt is increased by 20%
- [ ] **MF.nour** · 5. Applies the 'Mermaid's Nourishment' buff for 1◈ Turns
- [ ] **MF.cd** · Cooldown: 4◈ Turns

### Mermaid's Nourishment *(the buff)*

- [ ] **MN.gain.first** · At the end of the Turn the buff was applied, she gains one Mermaid Token (Q)
- [ ] **MN.gain.every** · …and at the end of the Turn after every ⅓◈ Turns (Q)
- [ ] **MN.token.dur** · Each Mermaid Token lasts 1◈+⅓◈ Turns
- [ ] **MN.token.buff** · Each Mermaid Token counts as a separate buff (Q)
- [ ] **MN.spend** · Using a Skill while she holds any Mermaid Tokens removes them from her (Q)
- [ ] **MN.spend.mf** · …a Skill other than Mermaid's Flesh: Mermaid's Flesh spends none (Q)
- [ ] **MN.boost** · …and that Skill's effects are boosted: its first bracket for one Token, its second for two
- [ ] **MN.max** · At most two Mermaid Tokens are consumed by one Skill use (Q)

## Jintsūriki (Sumi) — Rank B (B+) (A) *(Active)*

- [ ] **JS.when** · Used during her Turn
- [ ] **JS.rank** · Its Rank is B; B+ with one Token, A with two (Q)
- [ ] **JS.npcd** · Reduces her NP Cooldown by 1◈ Turns
- [ ] **JS.npcd.1** · …by 1◈+⅓◈ Turns with one Token
- [ ] **JS.npcd.2** · …by 1◈+⅔◈ Turns with two
- [ ] **JS.crit** · Then applies S.Crit Up for ⅓◈ Turns to all allied Units within a 2 panel area of her, herself included
- [ ] **JS.crit.val** · …Crit Chance is increased by 20%
- [ ] **JS.crit.1** · …25% with one Token
- [ ] **JS.crit.2** · …30% with two
- [ ] **JS.cd** · Cooldown: 4◈ Turns
- [ ] **JS.cd.1** · …4◈-⅓◈ Turns with one Token
- [ ] **JS.cd.2** · …4◈-⅔◈ Turns with two

## Clam Palace — Rank A (A+) (A++) *(Active)*

- [ ] **CP.when** · Used during her Turn
- [ ] **CP.rank** · Its Rank is A; A+ with one Token, A++ with two (Q)
- [ ] **CP.dodge** · First, applies Dodge for 1◈ Turns, 1 time, to all allied Units within a 2 panel area of her, herself included
- [ ] **CP.area** · Then affects every enemy Unit within a 3x3 panel area in any non-diagonal direction next to her
- [ ] **CP.enemy** · …enemies only: an ally in the 3x3 is untouched
- [ ] **CP.aim** · 1. Removes all 'Aim' buffs from the affected Units (Q)
- [ ] **CP.bew** · 2. Inflicts the 'Bewitchment' Mental Debuff for 1◈ Turns, Crit Chance is reduced by 10% (Q)
- [ ] **CP.bew.1** · …inflicted twice with one Token (Q)
- [ ] **CP.bew.2** · …three times with two (Q)
- [ ] **CP.bew.mental** · Bewitchment is a Mental Debuff
- [ ] **CP.dd** · 3. Inflicts Def Dwn for 1◈ Turns, all damage taken is increased by 20% (Q)
- [ ] **CP.dd.1** · …25% with one Token
- [ ] **CP.dd.2** · …30% with two
- [ ] **CP.dda** · 4. Inflicts Def Dwn (A) for 1◈ Turns, all damage taken is increased by 20% (Q)
- [ ] **CP.dda.1** · …25% with one Token
- [ ] **CP.dda.2** · …30% with two
- [ ] **CP.dda.luck** · …and Luck is reduced by 1 whenever damage is received from an Attack
- [ ] **CP.cd** · Cooldown: 4◈ Turns
- [ ] **CP.cd.1** · …4◈-⅓◈ Turns with one Token
- [ ] **CP.cd.2** · …4◈-⅔◈ Turns with two

## Nirmānnarati - Heaven's Form: Paradise of Pleasure - Mandala — Rank A (NP) [Anti-World]

- [ ] **NM.tag** · An [Anti-World] Noble Phantasm of Rank A
- [ ] **NM.ba** · Base Attack (MAG) is used
- [ ] **NM.area** · Hits a 5x5 panel area in any non-diagonal direction next to her
- [ ] **NM.who** · …every Unit in it is a DU (Q)
- [ ] **NM.dmg** · Deals 4x damage
- [ ] **NM.mental** · If the DU has any Mental Debuffs, damage dealt is increased by 100% (Q)
- [ ] **NM.mental.per** · …plus 20% for every Mental Debuff on the DU (Q)
- [ ] **NM.mental.max** · …counted at most 10 times (Q)
- [ ] **NM.ik** · Then, an X% chance of inflicting Instakill on the DU, X = 20 × its Mental Debuffs (Q)
- [ ] **NM.ik.zero** · …a DU with no Mental Debuff is never rolled for (Q)
- [ ] **NM.cd** · Cooldown: 7◈ Turns
