# Heracles — the Clause list

**Audited 2026-10-19 (#256).** Built by hand, line by line, from
`char_orig_sheets/Copia de Heracles.md`. No generated draft was used.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**71 Clauses: all `Pressed` or `Observed`, none left to tests** (live, PC world `fgt2026`, War *Heracles Audit*, Player1 his side, Player2 the other; the log in Ch. 46 §46.42). Eight defects the presses found, all fixed: §46.4-RT to RZ and the recorded Instakill (§46.42).

**He is built, all eight abilities** (`packs/_source/servants/heracles.yml`, Appendix D §D.13, Ch. 45).
This is an audit of what is there: each Clause is held against its reader, then pressed live.

**Built to be reused.** Every piece is already on the generic path: Mad Enhancement is the
parameterized `class-mad-enhancement` six Servants share, Divinity and Battle Continuation are the
class templates, his four revivals are `RevivalSource`s in one priority-ordered query, Eye of the
Mind (False) shares EMIYA's `evadeSucceeded` cut, and Nine Lives is an ordinary damaging NP. A fix
found here goes into the shared piece, never into a Heracles-only branch.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6); his printed 160, 175 and
1500 agree · durations count from the Turn after the Turn of use (#187 reading 5) · an Act includes
an Evade, a Block and switching a mode on (#194) · his drain floor is unconditional and he has no
forced deactivation (§46.4-C) · a Dodge evades the next Attack and is spent (#204), and its Evade
counts as a successful one (#208 reading 15) · an Aim Attack cannot be Evaded, so no Dodge is offered
(§46.4, `BR.aim`) · overkill reaches only a cascading revival, which is God Hand alone (#172) ·
Battle Continuation's NP dice are doubled, 4d10+20, its first revive is free, and *"above half"*
means strictly above (#184 reading 12) · NP Seal does not touch a passive NP (Appendix A) · Death
ignores every revival, and an Instakill lets the chain run (Appendix A §A.15) · a chance *"reduced
by X%"* is X points off (Ch. 13, §46.4-J) · Atk Up (STR) reaches an Attack whose base is BA(STR)
(#190 `HW.str`) · Crit DmUp does not reach an NP (#131) · an NP that states no Range swings at its
user's, 2 under Mad Enhancement (§46.10) · an effect with no NP figure applies in full against an NP
(#204 reading 5) · a debuff an NP inflicts after its damage lands only when the hit deals damage
(#190 reading 9) · a Servant whose Sustainability reaches 0 follows the ordinary rule (#190 `ME.sus`).

### Readings to settle

Asked by grilling, 2026-10-19. Rulings are written here as they land.

**Round 1, 2026-10-19:** readings 1, 2, 5, 6 and 8 ruled as recommended; 4 and 7 asked again with quotations.
**Round 2, 2026-10-19:** readings 3, 4 and 7 ruled. Every reading is ruled.

1. **"Constantly Active. Cannot be deactivated"** against the Active's switch (`ME.on`, `ME.never`,
   `ME.act`). The Passive line says he never leaves it. The Active below it is the shared template's
   text: *"Used during your Turn … can only be deactivated 2◈ Turns after it was activated and vice
   versa."* The content: on from the War's start, `cannotDeactivate`, so his player has no switch and
   the 2◈ lock never comes into play. **Ruled 2026-10-19:** as built. On from the start, no switch, the lock never applies.
2. **The Command Spell** (`ME.cs`, `ME.cs.off`, `ME.cs.re`). *"Can be deactivated for 1◈ Turns by
   spending a Command Spell (it will reactivate if the aforementioned conditions are still met after
   those 1◈ Turns)."* For him the only condition is *"Constantly Active"*. The content: Suspend Skill
   switches it off for 1◈. Nothing I read switches it back on: `rules/modes.mjs#forcedModes` re-arms
   a mode held by a compulsion or a `ForceMode`, and he has neither. Suspected, to be pressed first. **Ruled 2026-10-19:** off for 1◈ with every effect gone (no drain, no −2◈, no Evade−), then on again by itself, lock or no lock.
3. **Bravery during the Command Spell's 1◈** (`BR.me`, `BR.me.p`, `BR.p`). *"Bravery cannot be used
   and has no effects when Mad Enhancement is Active."* The content: both halves come alive while Mad
   Enhancement is off. Open: whether an Atk Up (STR) Bravery gave him keeps running once Mad
   Enhancement returns, as Penthesilea's Atk Up (Charisma) did (#190 reading 7). **Ruled 2026-10-19:** during the 1◈ Bravery is usable and its resistance holds. An Atk Up (STR) already on him runs out its span after Mad Enhancement returns; only new uses and the resistance stop.
4. **God Hand's cascade against its own record** (`GH.1.cascade`, `GH.2.rec`). Passive 1: *"the excess
   damage is reduced from his newly restored Health, and so on."* Passive 2: the Attack that took him
   to 0 is recorded, and *"whenever a recorded Attack would reduce his Health to 0, his Health will
   remain at 1 instead."* Read together, the killing Attack is recorded at once and could never burn a
   second charge, so *"and so on"* would be dead text. The content: the cascade runs its course within
   that Attack, and the record holds from the next one. **Ruled 2026-10-19:** as built. The cascade spends as many charges as the killing Attack needs; the record holds from the next Attack.
5. **What "that Attack" is** (`GH.2.rec`, `GH.2.floor`, `GH.2.other`). The content (Ch. 45): the ability,
   and for a Normal Attack the attacker. Karna's Normal Attack, once recorded, never kills him again,
   while each of his NPs keeps its own chance. Open: a Mana Burst, a Riding Attack and a Counter count
   as their user's Normal Attack (#206, #230 reading 25). The content names an ability-carrying Attack
   by that ability, so a Mana Burst may read as a different Attack from her plain Normal Attack. **Ruled 2026-10-19, overturning the recommendation:** wherever the board can tell them apart, each is its own record. A plain Normal Attack is one per attacker; a Mana Burst, a Riding Attack and a Counter are each a separate one, so a recorded plain Normal Attack does not hold back that attacker's Mana Burst, and the other way round.
6. **An Instakill from an Attack** (`GH.1`, `GH.2.rec`). Appendix A: Instakill is *"Health reduced to
   0"*. Is that an Attack reducing his Health to 0, so God Hand revives him, records it, and the next
   time that Attack's Instakill leaves him at 1? The content empties his Health and runs the revival
   chain. Whether it records the Attack is to be read live. **Ruled 2026-10-19:** yes. God Hand revives him, the Attack is recorded, and its next Instakill leaves him at 1.
7. **Undying's single use** (`IN.1`). *"When Herc is defeated he is revived with 25% of his Max
   Health."* The sheet calls it a Guts buff (*"stacks with other Guts buffs"*), and Guts is consumed
   on use (Appendix A). The content: one revival, then it is gone, though its 1◈+⅔◈ may still be running. **Ruled 2026-10-19:** as built. One revival, as every Guts (Cú Chulainn's identical wording; Nemo's, Van Gogh's, Quetzalcoatl's built). A second Undying restarts the span and still holds one revival.
8. **Indomitable's Atk Up, twice** (`IN.2.any`, `IN.2.atk`). *"Whenever Herc is defeated and revived
   through any effect, Atk Up is applied."* The content: one Atk Up per revival, and a God Hand cascade
   that spends three charges on one Attack is one revival. Two revivals inside its 1◈+⅔◈ give two Atk
   Ups that stack, +60%, because Atk Up stacks by magnitude. **Ruled 2026-10-19:** as built.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Has the following effects while Active-"*, *"Has the following effects-"*, *"Its effects are as
  follows-"* — headings.
- `Items Held/Extra Notes:` — an empty slot.
- *"(Heracles)"* before each ability's name — the sheet's ownership mark.

## Statblock

- [x] **SB** · True Name Heracles, Region Greece, Chaotic Mad, STR A+, END A, AGI A, MAG B, LUC A, Base Health 1500, MOV 6, Range 1 panel / 1 target, BA(STR) 160, BA(MAG) 175, Sustainability 2◈ · *Observed* — the War's build imported him fresh from the pack (tick 1): Heracles, Region greece, Chaotic Mad, STR A+ END A AGI A MAG B LUC A, Health 1500/1500, MOV 6, Range 1 / 1 target, BA 160/175, Sustainability 2◈; setup rolled Agility 19, Luck 19
- [x] **SB.attr** · Attributes Male, Servant, [Earth], Humanoid · *Observed* — …attributes male, servant, earth, humanoid, divine (+ derived hominidae, spirit); `divine` is also Divinity's · *Differs:* `heracles.yml` authors `divine` too, which the sheet does not print; Divinity adds it to every holder anyway

## Mad Enhancement — Class Skill, Rank B *(Passive + Active)*

- [x] **ME.on** · *(Passive)* Constantly Active: he starts the War with it on (reading 1) · *Observed* — tick 1, before anyone pressed anything: Mad Enhancement `active: true`; board MOV 8, Range 2
- [x] **ME.never** · Cannot be deactivated, by his player or by any forced path (reading 1) · *Pressed (interface)* — Player1's bar, tick 1: the slot read "Mad Enhancement cannot be deactivated."; clicked: the same refusal as a notification, still active
- [x] **ME.act** · The Active's own switch, used during his Turn with a 2◈ lock both ways, never moves it (reading 1) · *Pressed (interface)* — …the same press: no switch is offered him; the 2◈ lock never came into play (reading 1)
- [x] **ME.drain** · *1.* His Master loses 20 Health at the end of every Turn he Acts · *Pressed (interface)* — Player1's End Turn, tick 1, after Indomitable and an Attack: "End of the Turn — Master of Berserker of Red loses 20 Health (Mad Enhancement).", 174 → 154; and Player2's End Turn, tick 2, after he Evaded on Blue's Turn: 154 → 134 (#194)
- [x] **ME.drain.idle** · …and nothing at the end of a Turn he did not Act · *Pressed (interface)* — Round 2, Blue's Turn (tick 4): Heracles Stunned, did nothing (`acted: false`); Player2's End Turn: no line, his Master stayed at 25
- [x] **ME.floor** · …his Master's Health cannot drop below 20 this way · *Pressed (interface)* — tick 8, his Master at 25 (staged), Heracles Evaded Arturia: "… loses 5 Health (Mad Enhancement).", 25 → 20; tick 10, at 20, he Attacked: no line, still 20
- [x] **ME.floor.dmg** · …*"in this way"*: other damage may still take the Master below 20 · *Pressed (interface)* — tick 17, his Master at 20: Arturia's Normal Attack on the Master, 156, "Master of Berserker of Red is defeated by Saber.", 20 → 0
- [x] **ME.dt** · *2.* All damage taken −40% · *Observed* — Karna's Normal Attack, tick 2: "defUp -40 (Mad Enhancement) → ×0.60"; none on the Command Spell's tick-5 projection
- [x] **ME.dt.np** · …if NP, −20% · *Observed* — Karna's Brahmastra, tick 2: "defUp -20 (Mad Enhancement) → ×0.80", the NP figure
- [x] **ME.dd** · *3.* All damage dealt +60% · *Pressed (interface)* — Heracles' Normal Attack on Karna, tick 1: "atkUp 60 (Mad Enhancement)"; none on his tick-5 Attack under the Command Spell
- [x] **ME.dd.np** · …including NP · *Pressed (interface)* — Nine Lives on Karna, tick 5: "atkUp 60 (Mad Enhancement)" on the NP
- [x] **ME.dd.mag** · …halved, +30%, for an Attack using BA(MAG) · *Pressed (engine)* — his live projection (previewContext → computeDamage), tick 8: a BA(STR) Normal Attack "atkUp 60 (Mad Enhancement)", the same built on BA(MAG) "atkUp 30"; he has no MAG attack of his own
- [x] **ME.mov** · *4.* MOV +2 · *Observed* — board MOV 8 under Mad Enhancement (ticks 1–5, from tick 8), 6 while the Command Spell held it off (tick 5)
- [x] **ME.rng** · …Range +1 · *Observed* — …Range 2 and 1 the same way; Nine Lives fired at an adjacent Karna at Range 2
- [x] **ME.zon** · …his Master's ZON +2 panels · *Pressed (engine)* — his Master's ZON through the live zonRadius(Heracles, Master): 5 with Mad Enhancement's stacking ZonBonus +2, 3 without
- [x] **ME.sus** · *5.* His Sustainability −2◈ if his Master is defeated while it is Active · *Pressed (interface)* — tick 17, his Master restored at 20 and Conquest's sparing off (staged): Arturia's Normal Attack, "Overpower: Heads … Master defeated"; his Sustainability null → 3 = 6 (2◈) + 3 (High Rank Master's +1◈) − 6 (−2◈)
- [x] **ME.ev** · *6.* He can only Evade with Evade− · *Pressed (interface)* — tick 2, Karna's Normal Attack, Player1 pressed Evade: "Berserker evades Lancer evade- 1d20 → 1, unfavourable table +4 …"
- [x] **ME.nb** · *7.* Its effects are neither a buff nor a debuff · *Pressed (engine)* — No Buff staged on him (tick 11): his live unit still carries atkUp 60/30 and defUp 40 (Mad Enhancement), MOV 8, Range 2, the Evade table forced unfavourable
- [x] **ME.unrem** · …and are Unremovable · *Pressed (engine)* — …and no buff instance on him for a removal to take: the mode's own rules
- [x] **ME.cs** · Deactivated for 1◈ by spending a Command Spell (reading 2) · *Pressed (interface)* — tick 5, his Master's bar: Command Spell → Suspend Skill → Mad Enhancement: "Master of Berserker of Red spends 1 Command Spell(s): Suspend Skill, on Berserker's Mad Enhancement.", 3 → 2, off to tick 8
- [x] **ME.cs.off** · …and for that span none of its effects apply: no drain, no −2◈, no Evade− (reading 2) · *Pressed (interface)* — …MOV 6, Range 1, no Mad Enhancement line on his Attack, Charm at 50%; he Acted and Player1's End Turn drained nothing (81 stayed)
- [x] **ME.cs.re** · …and it reactivates after the 1◈ (reading 2) · *Pressed (interface)* — suspended again at tick 13 to 16 from the Master's bar; at tick 16's start "Mad Enhancement is active again on Berserker: the Command Spell's span is over." Before the fix it stayed off at tick 8 (§46.4-RY)

## Divinity — Rank A *(Passive)*

- [x] **DV** · All damage dealt +50 · *Pressed (interface)* — tick 1, his Normal Attack: "flatAttackBonuses divinity 50 (Divinity)"
- [x] **DV.np** · …including NP · *Pressed (interface)* — Nine Lives, tick 5: "divinity 50 (Divinity)"

## Battle Continuation — Class Skill, Rank A *(Passive 1 + 2)*

- [x] **BC.p1** · *(Passive 1)* All damage received is reduced by 2d10+20 · *Observed* — Karna's Normal Attack, tick 2: "damageNegation -28 (Battle Continuation)" (22–40)
- [x] **BC.p1.np** · …if NP, the dice are doubled: 4d10+20 · *Observed* — Brahmastra, tick 2: "damageNegation -46", past 2d10+20's 40: 4d10+20
- [x] **BC.p2** · *(Passive 2)* Defeated, he is revived with 5d20 Health · *Pressed (interface)* — tick 2, at 5 (staged), no Guts left: Scáthach's Normal Attack, "revived by Battle Continuation, with 71 Health."
- [x] **BC.p2.cd** · …Cooldown 3◈ · *Pressed (interface)* — …its cooldown 9 = 3◈
- [x] **BC.p2.half** · …and his Health must have been restored above half its maximum at least once since the last revival · *Pressed (interface)* — tick 11, healed above half through io.adjustHealth, killed: "revived by Battle Continuation … Rolled: 32."; its cooldown cleared, killed again that Turn: "revived by God Hand". Before the fix BC fired twice (§46.4-RX)

## Indomitable — Rank A *(Active)*

- [x] **IN.when** · Used during his Turn · *Pressed (interface)* — Player1's bar, tick 1: "Indomitable A Berserker 2 effect(s) applied"
- [x] **IN.1** · *1.* Undying on him for 1◈+⅔◈: defeated, he is revived with 25% of his Max Health, 375 (reading 7) · *Pressed (interface)* — tick 2, at 50 (staged): Karna's Normal Attack, "Berserker is defeated and revived by Undying, with 375 Health."; Undying gone after (reading 7)
- [x] **IN.1.guts** · …it stacks with other Guts buffs: both are held, and Undying is spent first · *Pressed (interface)* — …a staged Guts held beside it stayed; Undying was spent first
- [x] **IN.1.self** · …it does not stack with itself · *Pressed (interface)* — tick 5, pressed twice (cooldown and Turn record cleared, staged): one Undying (uses 1), one Indomitable
- [x] **IN.2** · *2.* Indomitable on him for 1◈+⅔◈ · *Pressed (interface)* — tick 1: indomitable on him to tick 6 (1◈+⅔◈)
- [x] **IN.2.any** · …whenever he is defeated and revived through any effect, Atk Up on him for 1◈+⅔◈ (reading 8) · *Pressed (interface)* — an Atk Up 30 on each revival: Undying, Guts, Battle Continuation, God Hand (cascade or not, one each), nine in all (reading 8)
- [x] **IN.2.atk** · …all damage dealt +30% · *Observed* — tick 5, his Normal Attack: "atkUp 30 (atkUp)" ×9, +270%, beside Mad Enhancement's 60
- [x] **IN.2.np** · …if NP, +20% · *Observed* — Nine Lives, tick 5: "atkUp 20 (atkUp)" ×9
- [x] **IN.cd** · Cooldown 4◈ · *Pressed (interface)* — Indomitable's cooldown 12 = 4◈

## Bravery — Rank A+ *(Passive + Active)*

- [x] **BR.me** · Cannot be used while Mad Enhancement is Active (reading 3) · *Pressed (interface)* — tick 17, Mad Enhancement on: the slot "Bravery — Only while that mode is switched off."; clicked: the same refusal, nothing applied
- [x] **BR.me.p** · …and has no effects while it is Active (reading 3) · *Observed* — Charm on him through the live applier: 100% under Mad Enhancement (tick 8), 50% while suspended (tick 5)
- [x] **BR.p** · *(Passive)* Chance of being inflicted with Mental Debuffs −50% (reading 3) · *Observed* — …50% with Bravery's passive in force; Burn (volatile) 100% either way
- [x] **BR.when** · *(Active)* Used during his Turn · *Pressed (interface)* — tick 5, Mad Enhancement suspended: "Bravery A+ Berserker 1 effect(s) applied"
- [x] **BR.a** · Atk Up (STR) on him for 1◈: STR damage dealt +25% · *Pressed (interface)* — …Atk Up (STR) 25 to tick 8; his Normal Attack "atkUp 25 (atkUpStr (STR only))"; still running under Mad Enhancement at tick 8 (reading 3)
- [x] **BR.a.np** · …if NP, +15% · *Pressed (engine)* — the live projection: Nine Lives "atkUp 15 (atkUpStr (STR only))"
- [x] **BR.a.str** · …nothing for an Attack using BA(MAG) · *Pressed (engine)* — …a BA(MAG) attack's mag 536.5 → 536.5 at that stage, a BA(STR) one's phys 481 → 601.25
- [x] **BR.cd** · Cooldown 4◈-⅓◈ · *Pressed (interface)* — Bravery's cooldown 11 = 4◈-⅓◈

## Eye of the Mind (False) — Rank B *(Passive + Active)*

- [x] **EM.p** · *(Passive)* A successful Evade cuts this Skill's Cooldown by ⅓◈ · *Pressed (interface)* — tick 2: the Dodge's Evade cut its cooldown 12 → 11, a rolled Evade 11 → 10
- [x] **EM.when** · *(Active)* Used at the start of a Combat Process when he is Attacked · *Pressed (interface)* — tick 2, Arturia's Normal Attack: Player1's reaction card offered "Eye of the Mind (False)"; clicked: "2 effect(s) applied"
- [x] **EM.dodge** · Dodge on him for ⅔◈ · *Pressed (interface)* — …"react → evade, evadeRoll → success", Dodge spent
- [x] **EM.cdu** · Crit DmUp on him for 1◈: Crit Damage dealt +35% · *Pressed (interface)* — …critDmUp 35 on him to tick 5; a crit at tick 5 "×1.35 crit damage"
- [x] **EM.cd** · Cooldown 4◈ · *Pressed (interface)* — its cooldown 12 = 4◈

## God Hand: Twelve Labors — Rank B, NP *[Anti-Unit (Self)]* *(Passive 1 + 2)*

- [x] **GH.hdr** · A Rank B Noble Phantasm, [Anti-Unit (Self)], passive · *Observed* — the live item: "God Hand: Twelve Labors", B, a passive Noble Phantasm, [antiUnitSelf], maxUses 11, no slot
- [x] **GH.1** · *(Passive 1)* His Health reduced to 0: roll 10d20 and restore that much Health (reading 6) · *Pressed (interface)* — tick 2, at 1, Battle Continuation on cooldown: Arturia's Mana Burst, "revived by God Hand: Twelve Labors, with 47 Health."
- [x] **GH.1.any** · …whatever took him to 0, an Attack or not: Poison, a fall · *Pressed (engine)* — Round 1's end, at 1: "Berserker takes 50 from Burn", "revived by God Hand … Uses spent: 1; 1 left."; the ledger unchanged
- [x] **GH.1.cascade** · …the defeating Attack's excess damage is taken off the restored Health, and so on (reading 4) · *Pressed (interface)* — the Mana Burst spent two uses on 151 left over (reading 4); Brahmastra at 5: "… with 114 Health. Uses spent: 4; 5 left."
- [x] **GH.1.max** · …only 11 times · *Pressed (interface)* — tick 11, the eleventh use: Strike Air into him at 1, "God Hand: Twelve Labors could not bring Berserker back: 197 damage was left over. Rolled: 111. Uses spent: 1; 0 left.", then "Berserker is defeated by Saber."
- [x] **GH.2.rec** · *(Passive 2)* An Attack reducing his Health to 0 for the first time is recorded (readings 4, 5, 6) · *Pressed (interface)* — each killing Attack joined the ledger: normal, Mana Burst, Brahmastra, Gáe Bolg's Instakill (reading 6), the ride and the Counter
- [x] **GH.2.rec.any** · …whichever revival then saves him · *Pressed (interface)* — Karna's Normal Attack recorded though Undying saved him
- [x] **GH.2.floor** · A recorded Attack that would reduce his Health to 0 leaves him at 1 instead (reading 5) · *Pressed (interface)* — tick 2, Karna's recorded Normal Attack at 71: "God Hand: Twelve Labors: survives at 1", 94 → 70; the recorded Gáe Bolg's Instakill: "… a recorded Attack, survives at 1" (after §46.42's fix)
- [x] **GH.2.other** · …and an Attack not recorded is not held at 1 (reading 5) · *Pressed (interface)* — Arturia's plain Normal Attack recorded: her Mana Burst and her Riding Attack each killed him; Karna's Counter killed him past his recorded Normal Attack (reading 5)

## Nine Lives: Shooting the Hundred Heads — Rank A+, NP *[Anti-Unit]*

- [x] **NL.hdr** · A Rank A+ Noble Phantasm, [Anti-Unit], 1 target at his Range · *Observed* — the live item after the rename: "Nine Lives: Shooting the Hundred Heads", A+, NP, [antiUnit]; fired at Range 2 · *Differs:* `heracles-nine-lives.yml` is named "Nine Lives"
- [x] **NL.ba** · BA(STR) is used · *Pressed (interface)* — tick 5, Nine Lives on Karna: "base:str (self BA(STR) × 1)"
- [x] **NL.dmg** · 4× damage plus 100 · *Pressed (interface)* — …"multiplier 4 (4× damage); flatBonus 100 (plus 100)"
- [x] **NL.dd** · Def Dwn on the target for 1◈: all damage taken +30% · *Pressed (interface)* — …Def Dwn 30 on Karna to tick 8 (1◈)
- [x] **NL.cd** · Cooldown 7◈+⅓◈ · *Pressed (interface)* — …its cooldown 22 = 7◈+⅓◈

## Revival priority *(Extra Notes)*

- [x] **RV.1** · Undying before normal Guts · *Pressed (interface)* — tick 2, Undying and a Guts held: Undying took the defeat
- [x] **RV.2** · Normal Guts before Battle Continuation · *Pressed (interface)* — …next defeat: "revived by Guts, with 150 Health.", Battle Continuation unused
- [x] **RV.3** · Battle Continuation before God Hand · *Pressed (interface)* — …next: Battle Continuation, God Hand unused
- [x] **RV.next** · A source that cannot fire (spent, on Cooldown, the half-Health gate) passes to the next · *Pressed (interface)* — Battle Continuation on cooldown or gated: God Hand took the defeat (Mana Burst, tick 2; Scáthach, tick 11)
