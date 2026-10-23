# Gilles (Caster) — the Clause list

*Gilles* on his sheet: the Caster form of Gilles de Rais, set apart from Gilles de Rais (Saber) (#260 reading
1; #269). Started by the user 2026-10-22.

**Audit opened 2026-10-22 (#323); every reading ruled.** Built by hand, line by line, from `char_orig_sheets/Copia de Gilles.md`
(identical to `by-class/Caster/Gilles.md`). No generated draft was used.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**154 Clauses** across 10 Abilities and the statblock.

**Unbuilt, ids ruled.** The Servant is `gilles`, his abilities `gilles-*` (#260 reading 1). The two Spells
and both Horrors are already built and shared (`summoning-horrors`, `summoning-elder-horror`, `horror`,
`elder-horror`); their requirements already name `gilles-prelatis-spellbook`.

**Built to be reused.** Most of him is already other Servants' pieces:

- **Territory Creation B** is `class-territory-creation` at B: the tables give 5d10 and 3d10+15, as printed.
- **Summoning: Horrors** and **Summoning: Elder Horror** are #260's, word for word. On the Caster the
  Spells' *"cannot be used if Prelati's Spellbook is on Cooldown"* finally holds: his Active has an 8◈ clock.
- **Mental Pollution A** is Jack's shape (`ApplicationChance`, `volatility: mental`). Three sheets print it
  with three different figures (Jack C 15/60, Phantom of the Opera A 25-mental/50, Gilles A 25/100), so it
  is no rank table: it becomes one shared skill with its figures as parameters, and Jack's file a ref.
- **Appreciation of the Arts** is Mozart's too (B: 80%, 20%). One shared skill, its chance and cut as
  parameters.
- **"A 3×3 area in any non-diagonal direction next to"** is Danzō's and Zabaniya's targeting; **3×4 or
  4×3** is Excalibur's.
- **NP DmDwn**, **Def Dwn (A)** (Luck −1 per damage from an Attack), **Def Dwn (B)**, **Def Dwn**,
  **Terror**, **Curse** (a stage), **Atk Dwn** are existing effects. **Dmg Up (Curse)** is the Dmg Up
  family gated `target:effect:curse`, as Dmg Up (Evil) is gated on an Alignment.
- **Class options** (`target:class:foreigner`, `target:attribute:outsider`, `target:skill:existenceOutsideTheDomain`)
  exist since the War options branch; Van Gogh's De Sterrennacht reads the last one.
- **Aiming at the Spellbook** is Achilles' Heel's shape: a weak point offered to the attacker at declaration,
  per Process (`engine/weak-point.mjs`).
- **A count of Servants on the board** is the Count module (`rules/count.mjs`).

What he needs that nobody has yet, each a generic piece (gaps checked with `tools/capability.mjs`):

- **A weak point that is an object, with the defender's own ladder.** Achilles' Heel resolves one roll; the
  Spellbook offers Gilles four answers (Evade, Block, Substitution, Luck Check), and a hit destroys it.
- **A thing that can be destroyed and stays destroyed**, closing three abilities and clearing his Horrors.
- **A reaction that moves its user and summons in his place** (Substitution), paying with another
  ability's Cooldown.
- **Summons that outlive their summoner** (the Elder Horrors on his defeat), against #260 reading 14.
- **A transformation**: fixed new stats and Attributes, named skills switched off, two abilities changed
  (`transform`: nothing authored matches).
- **A Unit the GM controls** (#293), acting in a GM's Turn at the end of the Round, attacking the nearest
  Unit (`chooser.nearest` exists, used by 0).
- **A Range that grows** while nothing is in reach, and resets after an Attack (`RangeModifier`: none).
- **A player who learns an NP's True Name** (#297), and the **Artistic** NP tag (none today).

### Already ruled

**Elsewhere:** the Servant `gilles` and the shared Spells and Horrors (#260 reading 1) · Max Health and
Base Attack derive from the tables, and the table wins (§46.6): 500 at END E, 75 at STR D, 150 at MAG C, all
as printed · a Caster attacks with MAG unless the sheet says otherwise (Medea; Nursery's sheet says so) ·
durations count from the Turn after the Turn of use (#187 reading 5) · *"within a N panel area of himself"*
includes himself unless the sheet says *"except"* (#132) · *"NP Cooldown"* naming no NP reaches every NP
(#197 reading 6) · two different effects of one family stack (#230 reading 4) · a Curse with no duration is
one stage (Appendix A) · *"directly next to"* is Chebyshev 1 · a Horror splits as #260 reading 12 rules ·
*"Dark (Outsider)"* is two Attributes (#260 reading 15) · *"his Horrors"* means Horrors and Elder Horrors
alike (#260 reading 13) · the Classic and Revised War Rules touch none of his skills · a sheet binds only
its owner.

### Readings to settle

Asked by grilling, 2026-10-22. Rulings are written here as they land.

**Round 1, 2026-10-22:** readings 1 to 10 and 13 to 20 ruled as recommended; 11 and 12 opened into
sub-readings (Round 2).
**Round 2, 2026-10-22:** 11a to 11g and 12a to 12h ruled, 11f the other way; 11h opened, and 11f opened 11i (Round 3).
**Round 3, 2026-10-22:** 11h ruled reading B, 11i as recommended. Every reading ruled.
**After the live pass, 2026-10-23:** two readings the presses opened. 11h-2: inside a Storm Border his fall rolls no
die, and the *"Otherwise"* Elder Horrors still appear. 11a-2: in his form the ZON penalty still applies to his
Attacks, as built.

1. **Who may aim at the Spellbook** (`PS.aim`). **Ruled 2026-10-22:** the AU chooses at declaration, per
   Process, as with Achilles' Heel; an Attack only, and only while the Spellbook stands. Its current AGI
   Rank counts, shifts included. A Unit with no AGI Rank (a Master, a Horror) never may.
2. **What Gilles's four options answer** (`PS.opt`). **Ruled 2026-10-22:** only an Attack aimed at the
   Spellbook, in place of his ordinary reaction. An Attack on him keeps his ordinary reactions, so
   Substitution is not offered then. No option taken: the Spellbook is destroyed.
3. **What a hit on the Spellbook does** (`PS.hit`). **Ruled 2026-10-22:** any hit that lands destroys it,
   whatever its damage. Gilles takes no damage, and the Attack's riders land on nobody.
4. **The order after a failed Evade** (`PS.ev.*`, `PS.lc.after`). **Ruled 2026-10-22:** an Evade that
   succeeds hits nothing. One that fails rolls the 20%: on it he takes the damage and the Spellbook is
   safe. A miss offers the Luck Check: success saves the Spellbook with no one hurt, failure destroys it.
5. **Block** (`PS.bl`). **Ruled 2026-10-22:** the damage goes to Gilles and an ordinary Block cuts it; the
   Spellbook is safe.
6. **Substitution's price** (`PS.sub.gate`, `PS.sub.cost`). **Ruled 2026-10-22:** *"not not on Cooldown"*
   is a typo for *"not on Cooldown"*. The chosen ability starts its full clock: Elder Horror 3◈, the
   Active 8◈, Horrors ⅔◈ per Horror this Substitution summons. It is no use of that ability: no cost, no
   same-Turn lock, no Counter.
7. **Substitution's move and its Horrors** (`PS.sub.move` to `PS.sub.take`). **Ruled 2026-10-22:** a free
   Move that spends no MOV, and he must leave his panel. He leaves this Process, even if he lands inside
   the same area. His owner places 1d4 Horrors within 1 of the panel he left, one on it, and that one takes
   the hit with no reaction. They are ordinary Horrors: they split and they guard.
8. **"All Horrors on the board are immediately destroyed"** (`PS.d.horrors`). **Ruled 2026-10-22:** his
   own Horrors and Elder Horrors, never another Gilles's, removed without splitting.
9. **His defeat with the Spellbook whole** (`PS.f.*`), against #260 reading 14. **Ruled 2026-10-22:** his
   summons on the board still leave with him (reading 14). The X new Elder Horrors stay: his Master
   controls them, and they keep their split and their guard of the Master. X counts every Servant on the
   War's board, any side, Gilles not included. His Master places them within 1 of his panel, then on the
   nearest free panels.
10. **Whether the transformation replaces the defeat** (`GH.save`). **Ruled 2026-10-22:** yes. On the 10%
    he is not defeated: no defeat events, and his Master still has a Servant.
11. **Who the Gigantic Horror is** (`GH.self`, `GH.attr`, `GH.keep`). Opened into 11a to 11h, Round 2.
    - **11a. Ruled 2026-10-22:** the same Unit and token, still his Master's Servant; only control moves.
      The Gigantic Horror's defeat is Gilles's defeat.
    - **11b. Ruled 2026-10-22:** still a Caster: Class matchups and `class:caster` read it.
    - **11c. Ruled 2026-10-22:** its Attributes are exactly Dark, Outsider and Large, the old set gone.
      It stays a Servant: *"number of Servants"* and *"Servant Units"* read what the Unit is, not an Attribute.
    - **11d. Ruled 2026-10-22:** his buffs and debuffs stay, with their durations.
    - **11e. Ruled 2026-10-22:** Health 2000 of 2000, Agility 0 of 0; his own Luck maximum, refilled.
    - **11f. Ruled 2026-10-22, the other way:** everything the sheet does not name goes away: Appreciation
      of the Arts, Item Construction, and Prelati's Spellbook's Passive and Active. What stays is what it
      names: Summoning: Horrors and Summoning: Elder Horror (doubled) and Evil Gaze of the Abyss (5×5,
      *"Evil Eye"* a misprint). So the Spellbook can no longer be aimed at, Vital Spot goes with it, and his
      defeat as the Gigantic Horror is final: no 10%, no Elder Horrors. The Spells' gate is 11i.
    - **11g. Ruled 2026-10-22:** his Normal Attack is a 3×3 square centred within his Range, hitting every
      Unit in it but himself. Large is an Attribute; he fills one panel.
    - **11h. Ruled 2026-10-22, reading B:** inside a Storm Border he cannot become the Gigantic Horror at
      all. Nemo's *"cannot use Skills, NP, or any other ability that creates a Unit/Item/object that has
      the 'Large' or 'Giant' Attribute"* refuses his own use, and the two 10% dice do not roll there.
    - **11h-2. Ruled 2026-10-23:** a fall inside a Storm Border rolls no die and still brings the *"Otherwise"* Elder
      Horrors: *"Otherwise"* is his not transforming. They appear around him, inside it. The card says the die is
      barred (`RevivalSource.chanceBarredWhen`).
    - **11a-2. Ruled 2026-10-23:** his form keeps the contract, so the ZON penalty applies to its Attacks, as built.
    - **11i. Ruled 2026-10-22:** the Spells keep reading the Spellbook itself. Transformed with it whole,
      they are open, unless the Active's 8◈ clock is still running, which blocks them until it ends.
      Transformed because it was destroyed, they stay locked, and the doubling never applies.
12. **The Gigantic Horror's side and its GM** (`GH.ctrl`, `GH.near`). Opened into 12a to 12h, Round 2.
    - **12a. Ruled 2026-10-22:** he acts in the GM slot the engine already runs, the last of every Round,
      driven by the GM. No Turn is added and ◈ is unchanged. He no longer acts in his Master's Turn.
    - **12b. Ruled 2026-10-22:** a side of his own, an enemy to every other Unit.
    - **12c. Ruled 2026-10-22:** *"the nearest Unit"* is any Unit on the board, Masters and summons
      included, at the board's own distance; on a tie the GM picks; his 3×3 centres on it.
    - **12d. Ruled 2026-10-22:** he Attacks on every GM's Turn a Unit is within his Range.
    - **12e. Ruled 2026-10-22:** the GM uses his skills freely in his Turn, within the usual budget. A
      Summoning counts as his Attack and replaces that Turn's Normal Attack. (After 11f: the two Spells and
      Evil Gaze.)
    - **12f. Ruled 2026-10-22:** a Command Spell aimed at him is refused at the gate, with a line saying
      why; one he already holds ends when he transforms.
    - **12g. Ruled 2026-10-22:** his Horrors on the board, and those he summons, join his side and the GM
      drives them. Their guard covers him only, not Gilles's Master.
    - **12h. Ruled 2026-10-22:** the Master keeps taking Turns with no Servant to command. The contract
      stands, his defeat counts for the Master, and the Master's death does not end him.
13. **The Gigantic Horror's own use** (`GH.gate`). **Ruled 2026-10-22:** used during his own Turn; it
    spends no Attack and has no clock, being one-way.
14. **Artistic NPs** (`AA.tag`). **Ruled 2026-10-22:** an `artistic` tag authored on each NP. Of the built
    roster, Nursery Rhyme's five NPs and Van Gogh's two carry it.
15. **Learning a True Name** (`AA.learn`, `AA.note`). **Ruled 2026-10-22:** the NP's user stands within 3
    of him, any side. The die and the result go to Gilles's player alone, on a whispered card. He learns
    the NP's name and text, not its user's identity.
16. **Vital Spot** (`SB.attr`). **Ruled 2026-10-22:** his Attribute while the Spellbook stands, lost when
    it is destroyed. Chiron's half waits for Chiron's build.
17. **The shared Spells' Clauses** (`HO.*`, `EH.*`). **Ruled 2026-10-22:** pressed again on the Caster:
    his gate differs, because his Spellbook has a clock and can be destroyed.
18. **Which Base Attack the Gigantic Horror swings** (`GH.ba.*`). **Ruled 2026-10-22:** *"Range"* there is
    the distance to the struck area's centre: STR at 1 or 2, MAG at 3 or more.
19. **How its Range grows** (`GH.grow*`, `GH.reset`). **Ruled 2026-10-22:** at a Round's end, if no Unit
    was within its Range during its Turn, its Range +1 from the next Round's start. It stacks, and resets
    to 3 after its next Attack. Detect follows Range.
20. **Doubled summons and their clock** (`GH.sum`). **Ruled 2026-10-22:** Horrors 2×1d4, Elder Horror 2.
    The Horrors' clock counts every Horror summoned, the doubled ones included.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Has the following effects-"*, *"its new Stats are as follows-"* — headings.
- *"(Passive)"*, *"(Active)"* — headings.
- `Items held:` — an empty slot.
- *"(Gilles)"* before each ability's name — the sheet's ownership mark.
- The Ranks' `+++`, `-` and `EX (NP)` marks beyond the letter — printed, read by no rule.

## Statblock

- [ ] **SB** · True Name Gilles de Rais, Region France, STR D, END E, AGI D, MAG C, LUC E
- [ ] **SB.class** · Caster, by his class skills (Territory Creation, Item Construction) and #269
- [ ] **SB.align** · Chaotic Evil
- [ ] **SB.attr** · Attributes Male, Servant, [Man], Humanoid (reading 16)
- [ ] **SB.hp** · Base Health 500
- [ ] **SB.mov** · MOV 4
- [ ] **SB.range** · Range 3 panels, 1 target
- [ ] **SB.ba** · BA(STR) 75, BA(MAG) 150
- [ ] **SB.na** · Normal Attacks use BA(MAG)
- [ ] **SB.sus** · Sustainability 4◈

## Territory Creation — Class Skill, Rank B *(Passive)*

- [ ] **TC.dealt** · *(P1)* In his Home Base, all damage he deals +5d10
- [ ] **TC.dealt.np** · …including NP
- [ ] **TC.dealt.out** · …not while he stands outside it
- [ ] **TC.taken** · *(P2)* While he is on the field, damage taken by allied Units in their Home Base −(3d10+15)
- [ ] **TC.taken.np** · …including NP
- [ ] **TC.taken.gone** · …not once he has left the field
- [ ] **TC.stack** · Several allied Territory Creations: only the highest Rank applies

## Item Construction — Class Skill, Rank — *(none)*

- [ ] **IC** · No effect of its own: the sheet points to Prelati's Spellbook

## Mental Pollution — Rank A *(Passive)*

- [ ] **MP.inflict** · *(P1)* Chance of inflicting debuffs +25%
- [ ] **MP.resist** · *(P2)* Chance of being inflicted by Mental debuffs −100%
- [ ] **MP.resist.other** · …a debuff that is not Mental is not resisted

## Appreciation of the Arts — Rank E- *(Passive)*

- [ ] **AA.learn** · *(P1)* An Artistic NP used within 3 of him: 15% chance he learns its True Name (reading 15)
- [ ] **AA.note** · …the NP's information is copied to his player's Notebook
- [ ] **AA.roll** · …the die is on a card, a miss included
- [ ] **AA.far** · …an Artistic NP used 4 away: no die
- [ ] **AA.plain** · …an NP without the Artistic Attribute: no die
- [ ] **AA.taken** · *(P2)* Damage taken from an Artistic NP −5%
- [ ] **AA.tag** · Artistic: an NP involving or related to artistic, literary or musical creations (reading 14)

## Blasphemy Aesthetic — Rank C+++ *(Active)*

- [ ] **BL.when** · Used during his Turn
- [ ] **BL.area** · All enemy Units in a 3×3 area in a non-diagonal direction next to him
- [ ] **BL.ally** · …an ally in the area is not affected
- [ ] **BL.1** · *1.* NP DmDwn for 1◈: NP damage dealt −20%
- [ ] **BL.2** · *2.* Def Dwn (A) for 1◈: damage received +10%
- [ ] **BL.2.luck** · …Luck −1 whenever damage is received from an Attack
- [ ] **BL.3** · *3.* Def Dwn (B) for 1◈: damage received +10%
- [ ] **BL.3.np** · …if NP, +20%
- [ ] **BL.stack** · Def Dwn (A) and Def Dwn (B) both hold: +20% from a non-NP Attack
- [ ] **BL.cd** · Cooldown 2◈

## Evil Gaze of the Abyss — Rank B+++ *(Active)*

- [ ] **EG.when** · Used during his Turn
- [ ] **EG.area** · All enemy Units in a 3×3 area in a non-diagonal direction next to him
- [ ] **EG.1** · *1.* Terror for 1◈+⅔◈: 40% chance of Stun
- [ ] **EG.2** · *2.* Curse
- [ ] **EG.3** · *3.* Def Dwn for 1◈+⅔◈: damage taken +20%
- [ ] **EG.4** · *4.* Dmg Up (Curse) for 1◈ on himself: damage dealt to Units with Curse +30%
- [ ] **EG.4.not** · …a Unit without Curse: no bonus
- [ ] **EG.5** · *5.* Gazing for 1◈ on himself: his Normal Attacks inflict Curse
- [ ] **EG.5.horrors** · …Normal Attacks of his Horrors within 2 of him: 50% chance of Curse
- [ ] **EG.5.far** · …a Horror 3 away: no chance
- [ ] **EG.cd** · Cooldown 3◈

## Summoning: Horrors *(Spell)*

- [ ] **HO.when** · A Spell, used during his Turn
- [ ] **HO.counter** · …or as a Counter
- [ ] **HO.count** · Roll 1d4: that many Horrors
- [ ] **HO.place** · …within a 5×5 area around him
- [ ] **HO.attack** · Counts as his Attack for the Turn
- [ ] **HO.stats** · Horror: 100 Health, 10 Agility, 5 Luck, Range 1, MOV 3, BA(STR) 100, Detect 2
- [ ] **HO.attr** · …Attributes Dark (Outsider)
- [ ] **HO.budget** · Horrors do not count toward the Units that Move or Attack in his Turn
- [ ] **HO.once** · …each Horror Moves and Attacks once per Turn
- [ ] **HO.split** · A Horror defeated: Gilles flips a coin; Heads, two new Horrors
- [ ] **HO.split.light** · …not when defeated with Light damage
- [ ] **HO.split.vs** · …not when defeated by an Attack that deals extra damage to Dark or Outsider Units
- [ ] **HO.guard** · Enemy Units cannot Attack Gilles while a Horror is directly next to him
- [ ] **HO.guard.m** · …nor his Master while a Horror is directly next to the Master
- [ ] **HO.excl** · Cannot be used on the same Turn as Summoning: Elder Horror
- [ ] **HO.book** · Cannot be used while Prelati's Spellbook is on Cooldown
- [ ] **HO.cd** · Cooldown ⅔◈ per Horror summoned

## Summoning: Elder Horror *(Spell)*

- [ ] **EH.when** · A Spell, used during his Turn
- [ ] **EH.counter** · …or as a Counter
- [ ] **EH.place** · One Elder Horror on a panel next to him
- [ ] **EH.attack** · Counts as his Attack for the Turn
- [ ] **EH.stats** · Elder Horror: 300 Health, 13 Agility, 7 Luck, Range 2, MOV 4, BA(STR) 125, Detect 3
- [ ] **EH.attr** · …Attributes Dark (Outsider)
- [ ] **EH.budget** · Elder Horrors do not count toward the Units that Move or Attack in his Turn
- [ ] **EH.once** · …each Moves and Attacks once per Turn
- [ ] **EH.split** · An Elder Horror defeated: Gilles rolls 1d4; on a 3, three new Horrors
- [ ] **EH.split.light** · …not when defeated with Light damage
- [ ] **EH.split.vs** · …not when defeated by an Attack that deals extra damage to Dark or Outsider Units
- [ ] **EH.guard** · Enemy Units cannot Attack Gilles while an Elder Horror is directly next to him
- [ ] **EH.guard.m** · …nor his Master while one is directly next to the Master
- [ ] **EH.book** · Cannot be used while Prelati's Spellbook is on Cooldown
- [ ] **EH.excl** · Cannot be used on the same Turn as Summoning: Horrors
- [ ] **EH.cd** · Cooldown 3◈

## Prelati's Spellbook: Textbook of the Sunken Spiral Castle — Rank EX *(Noble Phantasm)*

### The Passive: the Spellbook as a target

- [ ] **PS.basis** · The basis of all his Spells
- [ ] **PS.aim** · Whenever Gilles is Attacked, an AU of AGI Rank C or higher may target the Spellbook instead (reading 1)
- [ ] **PS.aim.low** · …an AU of AGI Rank D or lower may not
- [ ] **PS.opt** · Aimed at, Gilles picks one of four options (reading 2)
- [ ] **PS.hit** · A hit on the Spellbook destroys it (reading 3)
- [ ] **PS.ev** · *1. Evade:* he Evades as usual
- [ ] **PS.ev.fail** · …failed: 20% chance he takes the damage instead of the Spellbook (reading 4)
- [ ] **PS.ev.lost** · …otherwise the Spellbook is destroyed
- [ ] **PS.ev.roll** · …the 20% die is on the card, a miss included
- [ ] **PS.bl** · *2. Block:* he takes the damage instead of the Spellbook (reading 5)
- [ ] **PS.sub.gate** · *3. Substitution:* only while Summoning: Horrors, Summoning: Elder Horror or the Spellbook's Active is off Cooldown (reading 6)
- [ ] **PS.sub.cost** · …he picks one of those, and it enters Cooldown
- [ ] **PS.sub.move** · …instead of receiving the Attack, he Moves up to 4 panels (reading 7)
- [ ] **PS.sub.roll** · …then rolls 1d4: that many Horrors around the panel he left
- [ ] **PS.sub.on** · …one of them on the panel he left
- [ ] **PS.sub.take** · …that Horror receives the AU's Attack
- [ ] **PS.lc** · *4. Luck Check:* success, the Spellbook is not destroyed
- [ ] **PS.lc.fail** · …failure, it is destroyed
- [ ] **PS.lc.after** · …can be used after a failed Evade

### The Spellbook destroyed

- [ ] **PS.d.spells** · Summoning: Horrors, Summoning: Elder Horror and the Spellbook's Active can no longer be used
- [ ] **PS.d.forever** · …for the rest of the War
- [ ] **PS.d.horrors** · All Horrors on the board are destroyed at once (reading 8)
- [ ] **PS.d.gh** · 10% chance he transforms into the Gigantic Horror
- [ ] **PS.d.roll** · …the die is on the card, a miss included

### Gilles defeated

- [ ] **PS.f.gh** · Defeated with the Spellbook whole: 10% chance he transforms into the Gigantic Horror (reading 10)
- [ ] **PS.f.roll** · …the die is on the card, a miss included
- [ ] **PS.f.eh** · …otherwise X Elder Horrors appear on the panels around him (reading 9)
- [ ] **PS.f.x** · …X is the number of Servants on the board
- [ ] **PS.f.none** · Defeated with the Spellbook destroyed: no die, no Elder Horrors

### The Active *(Anti-Army)*

- [ ] **PS.a.tag** · [Anti-Army] Noble Phantasm
- [ ] **PS.a.ba** · BA(MAG) is used
- [ ] **PS.a.area** · Hits a 3×4 or 4×3 area in any non-diagonal direction next to him
- [ ] **PS.a.dmg** · 5× damage
- [ ] **PS.a.1** · *1.* Allied Foreigner Servants within 3 of him: NP Cooldown −1◈
- [ ] **PS.a.1.half** · …a non-Foreigner Servant with Existence outside the Domain or the Outsider Attribute: −½◈ instead
- [ ] **PS.a.1.not** · …not an enemy Foreigner, not a Servant 4 away, not a Horror (an Outsider, no Servant)
- [ ] **PS.a.2** · *2.* Atk Dwn for 1◈ on the DUs: damage dealt −40%
- [ ] **PS.a.2.np** · …if NP, −20%
- [ ] **PS.a.3** · *3.* Def Dwn for 1◈ on the DUs: damage taken +30%
- [ ] **PS.a.cd** · Cooldown 8◈

## Prelati's Spellbook: Gigantic Horror

### Becoming it

- [ ] **GH.gate** · Usable only while his Health is below 25% of its maximum (reading 13)
- [ ] **GH.gate.no** · …at 25% or more, refused
- [ ] **GH.auto** · Activates by itself on the 10% dice of `PS.d.gh` and `PS.f.gh`
- [ ] **GH.storm** · Inside a Storm Border: his use refused, and the 10% dice do not roll (reading 11h)
- [ ] **GH.storm.eh** · …a fall there brings the Elder Horrors all the same, inside it (reading 11h-2)
- [ ] **GH.spells** · Transformed, the Spells read the Spellbook: open if it stands and its Active is off Cooldown, locked if it was destroyed (reading 11i)
- [ ] **GH.save** · Transformed on defeat, he is not defeated (reading 10)
- [ ] **GH.self** · Gilles is replaced with the Gigantic Horror (reading 11)
- [ ] **GH.restore** · Its stats are fully restored to its new values

### Its stats

- [ ] **GH.hp** · Health 2000
- [ ] **GH.agi** · Agility 0
- [ ] **GH.luck** · Luck the same as Gilles's
- [ ] **GH.mov** · MOV 0
- [ ] **GH.range** · Range 3 panels, a 3×3 area
- [ ] **GH.ba.str** · BA(STR) 200 when its Range is under 3
- [ ] **GH.ba.mag** · BA(MAG) 200 when its Range is over 2
- [ ] **GH.sus** · No Sustainability
- [ ] **GH.attr** · Attributes Dark (Outsider), Large
- [ ] **GH.detect** · Detect the same as its Range

### What changes in him

- [ ] **GH.tc** · Territory Creation inactive
- [ ] **GH.mp** · Mental Pollution inactive
- [ ] **GH.bl** · Blasphemy Aesthetic unusable
- [ ] **GH.sum** · Summoning: the number of Horrors summoned is doubled
- [ ] **GH.eg** · Evil Gaze of the Abyss hits a 5×5 area in any non-diagonal direction next to it
- [ ] **GH.keep** · …everything the sheet does not name goes away: Appreciation of the Arts, Item Construction, the Spellbook's Passive and Active (reading 11f)
- [ ] **GH.final** · …so his defeat as the Gigantic Horror is final: no 10% die, no Elder Horrors

### Who drives it

- [ ] **GH.ctrl** · No longer controlled by Gilles's Master (reading 12)
- [ ] **GH.cs** · Command Spells have no effect on it
- [ ] **GH.turn** · It takes its Turn during the GM's Turn, the last Turn of the Round
- [ ] **GH.near** · When it Attacks, it always Attacks the nearest Unit
- [ ] **GH.grow** · No Unit within its Range for 1 full Round: Range +1 at the start of the next Round
- [ ] **GH.grow.more** · …and again each such Round, until it has Attacked a Unit
- [ ] **GH.reset** · …then its Range resets
