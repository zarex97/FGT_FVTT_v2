# Nursery Rhyme — the Clause list

**Draft, 2026-10-17.** The audit issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Nursery Rhyme.md`. The generated draft was not used.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Built 2026-09-16** in four parts (designs `docs/superpowers/specs/2026-09-16-nursery-1-core-design.md`
to `-4-glass-game-design.md`). Never audited against the board. **118 Clauses** across 15 sheet
entries and the statblock.

**Built to be reused.** Territory Creation is the shared class skill Medea and Semiramis carry
(`class-territory-creation`, by rank). Trump Soldiers is Medea's Dragon Tooth Warriors' sentence word
for word, and its guard is the `TargetabilityModifier` Bašmu carries. The rewind is the corpus's
first `Script`, over the state history (`engine/state-history.mjs`). Her own pieces became generic:
`Disable`, `Enigma`, `Def Dwn (MAG)`, `CooldownDelta` that reaches a target and adds, a summon's stay
(`duration`, `DurationDelta`), an Item lying on a panel, a rule switched off by slug, an Item barred
from named holders, and a rank table read off the target's own parameter (`rankFrom`).

### Already ruled

**Her design (2026-09-16):** Enigma is hers alone: Alice is Nursery (Part 1 R1, ruled by the user) ·
her two damage Spells deal 1× BA(MAG) (1 R2) · *A Tale*'s cooldown clause adds, it does not set
(1 R5) · Disable permits Move and nothing else (1 R6) · `1d8+4` is one die plus four, 5 to 12 soldiers
(2 R1) · the lifesteal reads damage that landed (2 R2), from Servants only (2 R3) · the Blade's 3× is
*instead of* the ×1.5, +200% in the same bucket (2 R4) · its three consequences fire together, once
(2 R5), and the blow that removes the lifesteal heals nothing (ruled 2026-10-17, §46.4-QV) · summoning the Jabberwock is her Attack; its own attacks are outside the budget (2 R6) · its
cooldown starts when it disappears (2 R7) · Alice Eater adds to the stay (2 R8) · 25 and 10, not the
struck-through 50 and 20 (3 R1) · the forest's losses are permanent writes; only the tokens are
removed (3 R2) · the MAG ladder's signs as written: a high Rank escapes more easily (3 R3) · the Home
Base −3 stacks with it (3 R4) · the death roll is at the end of the affected Unit's own Turn (3 R5);
at home it still rolls and is refused the outcome (3 R6) · the 10% escape resistance is the Unit's,
permanent, and stacks (3 R7) · tokens are gained at the end of every Round (3 R8) · the rewind
restores no position, facing, Turn budget or Contract (4 R1, Q45) · it never restores Nameless
Forest Tokens (4 R2) · *"enters Combat"* is the first Turn end with an enemy in her 3-panel ring, and
the Round-end reset keys on the same ring (4 R3, R4) · effect 2 fires on her final defeat, after the
revival chain (4 R5), restores her and leaves her defeated (4 R6), once per game across revivals
(4 R7) · an effect whose source is gone is dropped, loudly (4 R8).

**Elsewhere:** Base Attack derives from the tables (§46.6): her printed 50 and 200 agree · a silent
sheet's Normal Attacks use BA(STR), and hers says so (Semiramis) · Territory Creation as pressed on
Medea and Semiramis: the dice add at stage 7, the ward is a negation, only the highest Rank's aura
holds (§46.4-AD) · Medea's Dragon Tooth Warriors carry Trump Soldiers' sentences word for word:
outside the budget, one Move and one Attack each per Turn, and *"cannot Attack … if … directly next
to"* is a guard on the summoner and her Master (Bašmu, BS.guard) · a damage Spell that states no
Range reaches as far as its caster's statblock Range (Medea's Aero) · *"NP Cooldown"* naming no NP
reaches every NP (#197 reading 6) · riders land on a hit, not a hurt (§46.4-LI) · *"Inflicts"* with
no chance is the effect's base 100%, resisted as usual (Ch. 15) · *"all allied Units"* includes the
user unless the sheet says *"other"* · Crit Up and Crit DmUp reach an NP only when an NP figure is
stated (#131) · NP Seal stops a passive NP only when the sheet says so (Appendix A): the Forest says
so, the Glass Game does not · a Spell is refused by Silence and Skill Seal (Ch. 17) · an NP used on
its owner's own Turn consumes the Attack (§46.4-AZ) · a sheet binds only its owner.

### Found reading the code

Not readings: the sheet is plain and the build does not do it.

- **D1 — The Glass Game's effect 1 has no clock and no condition.** Its `Script` handler runs
  `rewindScript` at every Turn end she hears, rewinding every Unit within 3 by 3◈. The params that
  carry the condition (`afterTicks`, `requiresEnemyInRing`, `resetWhenRingEmpty`) are read by
  nothing, and `rules/glass-game.mjs#glassGameClock` is tested and never called. To press first.
- **D2 — The Jabberwock guards nobody.** *"Enemy Units cannot Attack Nursery or her Master if the
  Jabberwock are directly next to them."* The Trump Soldier carries the `TargetabilityModifier`; the
  Jabberwock's statblock carries none. Part 2's inventory planned it (J17).
- **D3 — The escape resistance gates the marker only.** The forest's six actions are dispatched one
  by one: `ApplicationChance` can refuse the `namelessForest` marker, and the token and the four
  stat losses land anyway, on a Unit that then has no escape check and no death roll.
- **D4 — The Blade's *"Normal Attacks … use Base Attack (STR)"* is not authored.** Part 2 planned
  it (B5); `vorpal-blade.yml` has no rule for it, so a Unit whose Normal Attacks use MAG keeps MAG.
- **D5 — Her Region.** The sheet prints *"England"*; she is authored `[england, europe]`. Drake's
  *"England"* is `[england]`.

### Readings to settle

Asked by grilling, 2026-10-17. All 18 ruled the same day, in two rounds.

1. **A Tale for Somebody's Sake's area** (`TA.area`). *"Hits a 3x3 panel area within Range for 3x
   damage."* Built enemies only. The Normal Archer, Lancer and Saber NPs say the same words and are
   built to hit every Unit in the area but their user. **Ruled:** every Unit in the 3x3 but her, as the Normal NPs. *Differs:* built enemies only.
2. **Enigma's trigger** (`WQ.enigma`). *"Whenever Alice performs a Normal Attack which deals STR
   damage."* (a) any STR Normal Attack that hits, a hit for 0 included (built, hit-not-hurt); or
   (b) only when damage was dealt, as Kiritsugu's *"if damage was dealt"* was ruled (#243 reading 15).
   **Ruled:** (b), only when damage was dealt. *Differs:* built on any hit.
3. **Def Dwn (MAG) twice** (`WQ.ddm`). A second Enigma hit on a Unit still carrying it: the 60% adds
   to 120% (built, as Def Dwn stacks), or refreshes at 60%. **Ruled:** it stacks, as built.
4. **What Disable stops besides Actions** (`PW.disable`). *"Can only use the Move action."* Built:
   it forbids every Action but Move, and it reads as *"prevents Acting"* (no Master guard, no Cover,
   no Counter), but the Unit may still Evade and Block. **Ruled:** as built, but a Disabled Unit can
   neither attack nor Block, nor Evade (reading 17): those are Actions. *Differs:* Block and Evade stay on its rung.
5. **The forest's Health and Luck** (`FO.hp`, `FO.luck`). *"Reduce its Max Health by 25 … and Max
   Luck by 1"*, and *"Health and Luck that are lost from the effects of this NP are not restored."*
   Built: the current value falls only as far as the new ceiling, so a wounded Unit loses nothing.
   Or the current value falls by the same 25 and 1. **Ruled:** (a), as built: the lowered maximum is what is
   not restored.
6. **The Glass Game and the forest's losses** (`GG.1.nft`, `GG.2.nft`). *"Does not affect Nameless
   Forest Tokens."* Built: the tokens stay, and the Max Health, Base Attack and Max Luck the forest
   took are restored with every other Stat. Or the forest's losses stay with its tokens. **Ruled:** (b), the
   forest's losses stay with its tokens. *Differs:* the rewind restores them.
7. **The Glass Game's effect 1 after it fires** (`GG.1.again`). The sheet says *"once"* of effect 2
   only. Does effect 1's clock start again, so it fires every 3◈ while enemies stay in the ring? **Ruled:**
   yes, it starts again and can fire again.
8. **The Glass Game's effect 1 and Nursery herself** (`GG.1.self`). Effect 2 says *"(includes
   herself)"*; effect 1 says *"all Units within a 3 panel area of Nursery"*. Built: effect 1 leaves
   her out. **Ruled:** as built, she is not among them.
9. **The summons' Attributes** (`TS.attr`, `JW.attr`). The sheet prints the Jabberwock's as
   *"Demonic, Giant"* and none for the Trump Soldiers. Built: Trump Soldiers `humanoid, fairytale`,
   the Jabberwock `demonic, giant, fairytale`, each with `summon`. *Fairytale* lets Tommy Thumb's
   NP DmUp reach them. **Ruled:** as built.
10. **The Jabberwock's *"Move to any panel"*** (`JW.move`). Built: it may move onto an occupied
    panel and its occupants are knocked back 1. Which way, and does *"any panel"* also lift the
    other movement rules (an enemy Master's area, walls, terrain)? **Ruled:** knocked 1 panel straight
    away from it; *"any panel"* means occupied ones too, and every other movement rule stands. To press.
11. **A Jabberwock that is killed** (`JW.dies`, `JW.again`). *"When the Jabberwock is summoned again
    after disappearing, its Stats will be the same as when it disappeared."* Is being defeated
    disappearing, starting the 5◈ cooldown? And does a killed Jabberwock come back at 0 Health?
    **Ruled:** (a), killing it is disappearing: the 5◈ cooldown starts, and it returns at full Health,
    still without the lifesteal the Blade took. To press.
12. **The Blade's +50** (`VB.ba`). *"Increase the Unit's Base Attack (STR) by 50"* and *"the above
    Stat boosts do not affect NP & Attacks Categorized as NP."* Built: +50 flat on STR Normal Attacks
    only. Or +50 to BA(STR) itself, for every Attack but an NP's: Attack Skills and Spells using
    BA(STR) too. **Ruled:** +50 to BA(STR) itself, for every Attack but an NP's. *Differs:* built on
    STR Normal Attacks only.
13. **When the Blade breaks** (`VB.break`). *"When the Jabberwock is Attacked by this Equipped
    Item"*: built on a hit (the Damage Step's end). Or on any Attack, an Evade included. **Ruled:** on a
    hit, as built.
14. **Who may take the Blade** (`VB.take`). *"Can be picked up by a Unit walking onto its panel."*
    Built: any Unit but Nursery and her Master, and picking it up equips it. Summons and the
    Jabberwock too? **Ruled:** Servants and Masters only, and picking it up equips it. *Differs:* any Unit.
15. **The forest's *"disappears (i.e. is defeated)"*** (`FO.death`). A defeat like any other, so
    Guts, God Hand and Command Spells may answer it; or a removal no revival answers. **Ruled:** a defeat
    like any other. To press.
16. **The five found in the code** (D1 to D5). **Ruled:** build all five; her Region is `[england]`.
17. **Evade under Disable** (`PW.disable`). *"Evading and Blocking are Acting"* (#232 reading 10).
    **Ruled:** (a), Evade is forbidden too.
18. **Every effect that forbids all Actions** (`PA.rungs`). Stun, Stop, Freeze, Petrify, Sleep,
    Nightmare, Coma, Webbed and Crystalfreeze refuse the Counter (`canAct`) and leave Block and Evade on
    the rung; only `cannotAct` forbids all three, by a line of its own. **Ruled:** one door: any effect
    that prevents Acting, Disable among them, takes Block, Evade and Counter off the rung, for every Unit.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Has the following effects-"* (Tommy Thumb, Meanwhile, the Glass Game) — headings.
- *"One, two! One, two! And through and through…"* — flavour.
- *"Nameless Forest Counter"* — the same thing as its Token.
- `Items held:` — an empty slot.

## Statblock

- [x] **SB** · True Name Nursery Rhyme, Alice; Region England; True Neutral; STR E, END E, AGI C, MAG A, LUC B; Base Health 500; MOV 4; Range 2 panels / 1 target; BA(STR) 50, BA(MAG) 200; Sustainability 4◈ · `Built` · Region differs (D5) · *Observed* · board: trueName "Nursery Rhyme, Alice", region [england] (was [england, europe], D5 fixed), True Neutral, params E/E/C/A/B, health 500, MOV 4, Range 2, BA {str 50, mag 200}, sustainability 12 = 4◈
- [x] **SB.attr** · Attributes Female, Servant, [Man], Humanoid, Fairytale, Non-Hominidae, Child · `Built` · *Observed* · attributes child, fairytale, female, humanoid, man, nonHominidae, servant (+ derived magus, spirit)
- [x] **SB.na** · Her Normal Attacks use BA(STR) · `Built` · *Pressed (interface)* · Player1's Normal Attack on Drake: card stage 1 "Base BA(STR) self BA(STR) × 1 +50"

## Territory Creation — Class Skill, Rank A *(Passive 1 + 2)*

- [x] **TC.1** · In her Home Base, all damage she deals +5d20, NP included · `Built` · *Pressed (interface)* · Nursery in her Home Base (2,10), Player1's Normal Attack on Heracles: stage 7 "Territory Creation +54", rolls "Territory Creation modifier 5d20 → 54"
- [x] **TC.2** · While she is on the field, allied Units in their Home Base take (3d10+20) less, NP included · `Built` · *Pressed (interface)* · Heracles' Normal Attack on Van Gogh in his Home Base, Player1 pressed Do nothing: stage 12 "Territory Creation −39"
- [x] **TC.2.self** · …herself included · `Built` · *Pressed (interface)* · Heracles' Normal Attack on her in her Home Base: stage 12 "Territory Creation −35"
- [x] **TC.stack** · Only the highest-Rank Territory Creation among allies takes effect · `Built` · *Pressed (interface, staged)* · Van Gogh given a second rank-A Territory Creation, Heracles hit him again: one row only, "Territory Creation −40"; the copy removed after

## Self-Modification — Rank A *(Passive + Active)*

- [x] **SM.p** · *(Passive)* Crit Damage dealt +40% · `Built` · *Pressed (interface)* · that card stage 2 "×1.40 crit damage"; Plains of Winter's crit "×1.40 crit damage" too
- [x] **SM.when** · *(Active)* Used during her Turn · `Built` · *Pressed (interface)* · Round 6 tick 18 (her Turn), Player1 pressed Self-Modification: card "Self-Modification A — 1 effect(s) applied"
- [x] **SM.crit** · Crit Up for 1◈: Crit Chance +60% · `Built` · *Pressed (interface)* · critUp 60 on her, expiry 21 (1◈ from 18)
- [x] **SM.cd** · Cooldown 4◈ · `Built` · *Pressed (interface)* · cooldown 12 = 4◈

## Shapeshift — Rank A+ *(Passive)*

- [x] **SS** · All damage taken −30% · `Built` · *Pressed (interface)* · Heracles' Normal Attack on her, Player1 pressed Do nothing: stage 4 "ward Shapeshift −30%", 193 taken (475 → 282)
- [x] **SS.np** · …if NP, −15% · `Built` · *Pressed (interface)* · Arturia's Excalibur on her, Player1 pressed Do nothing: stage 4 "ward Shapeshift −15%"

## Tommy Thumb's Secret Picture Book — Rank A+ *(Active)*

- [x] **TT.when** · Used during her Turn · `Built` · *Pressed (interface)* · Player1 pressed Tommy Thumb on her Turn: card "11 effect(s) applied"
- [x] **TT.1.luck** · Restores 3 Luck · `Built` · *Pressed (interface)* · Luck staged 10/15 → 13/15
- [x] **TT.1.atk** · Atk Up for 1◈: all damage dealt +30%; if NP, 20% · `Built` · *Pressed (interface)* · atkUp 30 expiry 21
- [x] **TT.2** · Def Up for 1◈: all damage taken −30%; if NP, 15% · `Built` · *Pressed (interface)* · defUp 30 expiry 21 · same card: "Def Up defUp −30%", stage 12 "dmgCut −30"
- [x] **TT.3** · Dmg Cut for ⅓◈: all damage taken −30, NP included · `Built` · *Pressed (interface)* · dmgCut 30 expiry 19 (⅓◈) · same card: "Def Up defUp −30%", stage 12 "dmgCut −30"
- [x] **TT.4** · Debuff ResUp for 1◈: chance of being inflicted with debuffs −40% · `Built` · *Pressed (interface)* · debuffResUp 40 expiry 21
- [x] **TT.5** · Allied Units within 2 panels with the 'Child' Attribute: NP Cooldown −⅔◈ · `Built` · *Pressed (interface)* · Van Gogh (ally, Child, 1 away): both NPs 10 → 8 (⅔◈)
- [x] **TT.5.self** · …herself included · `Built` · *Pressed (interface)* · her three NPs 10 → 8
- [x] **TT.6** · Allied Units within 2 panels with the 'Fairytale' Attribute: NP DmUp for 1◈, NP damage +20% · `Built` · *Pressed (interface)* · Van Gogh (Child, not Fairytale): no npDmUp (differential) · the Tale's stage 4 "NP DmUp npDmUp +20%" and "Atk Up atkUp +20%" (TT.1.atk's NP figure)
- [x] **TT.6.self** · …herself included · `Built` · *Pressed (interface)* · npDmUp 20 on her (Fairytale), expiry 21
- [x] **TT.cd** · Cooldown 4◈−⅓◈ · `Built` · *Pressed (interface)* · cooldown 11 = 4◈−⅓◈

## Meanwhile… — Rank A *(Active)*

- [x] **MW.when** · Used during her Turn · `Built` · *Pressed (interface)* · Player1 pressed Meanwhile… on her Turn: card "6 effect(s) applied"
- [x] **MW.1** · NP Cooldown −(1◈+⅓◈), every NP · `Built` · *Pressed (interface)* · her three NPs 8 → 4 (1◈+⅓◈)
- [x] **MW.2** · Restores 15% of her maximum Health · `Built` · *Pressed (interface)* · Health staged 400 → 475 (15% of 500)
- [x] **MW.3** · Removes all debuffs from her · `Built` · *Pressed (interface)* · staged Poison and Burn removed; her six buffs kept
- [x] **MW.cd** · Cooldown 4◈ · `Built` · *Pressed (interface)* · cooldown 12 = 4◈

## Plains of Winter *(Damage Spell)*

- [x] **PW.spell** · A Spell: Silence and Skill Seal refuse it · `Built` · *Observed; Pressed (interface)* · Silence/Skill Seal refuse Spells (Ch. 17; prevention table spell) — to stage · Silence staged on her: the bar read "Frenzied March Hare — prevented by Silence", "Plains of Winter — prevented by Silence", "White Queen's Enigma — Prevented by Silence"; Skill Seal: "Frenzied March Hare — prevented by Skill Seal"
- [x] **PW.dmg** · Deals 1× BA(MAG) to one Unit within her Range · `Built` · *Pressed (interface)* · Player1 pressed Plains of Winter on Drake (2 away): stage 1 "Base BA(MAG) self BA(MAG) × 1 +200", 260 after Atk Up +30% and Drake's MR −20%; Drake 1000 → 740
- [x] **PW.ice** · Ice damage · `Built` · *Pressed (interface)* · the Process's attack.element "ice"
- [x] **PW.disable** · 50% chance of Disable for 1◈: the Unit can only Move; no attack, Block or Evade (readings 4, 17) · `Differs` · *Pressed (interface)* · card "Disable (rolled 70 vs 75%)" (50 + Van Gogh's Item Construction aura +35 − Drake's MR 10); disable on Drake expiry 21 (1◈)
- [x] **PA.rungs** · Any effect that prevents Acting takes Block, Evade and Counter off its bearer's rung (reading 18) · `Differs` · *Pressed (interface)* · Disabled Drake attacked by her Normal Attack: Process forbiddenReactions [evade, block], card drew no "Choose a reaction", ladder "react → nothing … counter → done" (no Counter rung)
- [x] **PW.cd** · Cooldown 2◈ · `Built` · *Pressed (interface)* · Plains of Winter cooldown 6 = 2◈

## Frenzied March Hare *(Damage Spell)*

- [x] **FH.spell** · A Spell: Silence and Skill Seal refuse it · `Built` · *Pressed (interface)* · Silence staged on her: the bar read "Frenzied March Hare — prevented by Silence", "Plains of Winter — prevented by Silence", "White Queen's Enigma — Prevented by Silence"; Skill Seal: "Frenzied March Hare — prevented by Skill Seal"
- [x] **FH.dmg** · Deals 1× BA(MAG) to one Unit within her Range · `Built` · *Pressed (interface)* · Player1 pressed Frenzied March Hare on Heracles (adjacent): stage 1 "Base BA(MAG) self BA(MAG) × 1 +200", 154 dealt
- [x] **FH.wind** · Wind damage · `Built` · *Observed* · the Process's attack.element "wind"; stage 4.5 Element row present
- [x] **FH.sap** · 50% chance of Sap for 1◈ · `Built` · *Pressed (interface)* · card "Sap (rolled 5 vs 85%)": 50% authored + 35% Van Gogh's Item Construction aura (ally, outgoing normal); sap on Heracles expiry 21 = 1◈
- [x] **FH.cd** · Cooldown 2◈ · `Built` · *Pressed (interface)* · cooldown 6 = 2◈

## White Queen's Enigma *(Spell)*

- [x] **WQ.spell** · A Spell: Silence and Skill Seal refuse it · `Built` · *Pressed (interface)* · Silence staged on her: the bar read "Frenzied March Hare — prevented by Silence", "Plains of Winter — prevented by Silence", "White Queen's Enigma — Prevented by Silence"; Skill Seal: "Frenzied March Hare — prevented by Skill Seal"
- [x] **WQ.when** · Used during her Turn · `Built` · *Pressed (interface)* · Player1 pressed White Queen's Enigma on her Turn: card "White Queen's Enigma — Enigma"
- [x] **WQ.buff** · Applies the 'Enigma' buff to herself for 1◈ · `Built` · *Pressed (interface)* · enigma on her, expiry 21 (1◈)
- [x] **WQ.enigma** · While it lasts, each Normal Attack of hers that deals STR damage inflicts Def Dwn (MAG) for 1◈ on the DU, only when damage was dealt (reading 2) · `Differs` · *Pressed (interface)* · her Normal Attack on Drake dealt 94: card "Def Dwn (MAG)"; defDwnMag 60 on Drake, expiry 21 · Invuln staged on Heracles, her Normal Attack: card "0 Negated by Invuln", no Def Dwn (MAG) line, Heracles carries none (reading 2: only when damage was dealt)
- [x] **WQ.ddm** · Def Dwn (MAG): all MAG damage taken +60% (reading 3) · `Built` · *Pressed (interface)* · Def Dwn (MAG) 60 staged on Heracles, Player1's Frenzied March Hare (a non-NP MAG Spell): stage 4 "Def Dwn defDwnMag +60%", 291 dealt (reading 3)
- [x] **WQ.ddm.np** · …if NP, 40% · `Built` · *Pressed (interface)* · Drake (Def Dwn (MAG) 60/40) took the Tale: stage 4 "Def Dwn defDwnMag +40%"
- [x] **WQ.cd** · Cooldown 3◈ · `Built` · *Pressed (interface)* · cooldown 9 = 3◈

## Nursery Rhyme: Trump Soldiers — Rank C NP [Anti-Unit] *(Non-damaging)*

- [x] **TS.when** · Used during her Turn · `Built` · *Pressed (interface)* · her Turn (Round 6 tick 18), Player1 pressed Trump Soldiers: Player1's card "6 summoned (1d8 + 4 → 6 …): Trump Soldier ×6"
- [x] **TS.count** · Rolls 1d8 and adds 4: that many Trump Soldiers, 5 to 12 · `Built` · *Pressed (interface)* · that card "1d8 + 4 → 6"; six trump-soldier actors summoned by her
- [x] **TS.place** · …within a 2-panel area of her · `Built` · *Pressed (interface)* · panels 8,8 8,9 8,11 8,12 9,8 9,10; the farthest 2 from her (10,10)
- [x] **TS.stats** · Each: Health 200, Agility 10, Luck 6, MOV 4, Range 2 / 1 target, BA(STR) 75 · `Built` · *Observed* · each: health 200/200, agility 10, luck 6, MOV 4, Range 2/1, BA {str 75, mag 0}
- [x] **TS.attr** · Their Attributes (reading 9) · `Built` · *Observed* · attributes summon, humanoid, fairytale (reading 9, as built)
- [x] **TS.budget** · They do not count towards the Units that Move or Attack in her Turn · `Built` · *Pressed (interface)* · Player1 moved a Trump Soldier (8,12)→(10,12) and attacked Heracles with it ("Trump Soldier ⚔ Berserker", Base BA(STR) 75): faction-1 pools servantMove 0/4 and servantAttack 1/2 (hers) unchanged
- [x] **TS.once** · Each Trump Soldier may Move once and Attack once per Turn · `Built` · *Pressed (interface)* · the same soldier's bar after: "Attack — this unit has already acted this Turn", "Move — this unit has already acted this Turn"
- [x] **TS.guard** · Enemy Units cannot Attack her or her Master while a Trump Soldier is directly next to them · `Built` · *Pressed (engine)* · Heracles (adjacent to her) declared on her: "No legal targets: Caster is protected by a nearby Trump Soldier."; the soldier at (9,10) moved away: the same declaration legal (differential)
- [x] **TS.attack** · Counts as her Attack for the Turn · `Built` · *Pressed (interface)* · her turnState attacked true after the summon; the bar: "Trump Soldiers — this unit has already attacked this turn"
- [x] **TS.cd** · Cooldown ⅓◈ per Trump Soldier summoned · `Built` · *Pressed (interface)* · cooldown 6 = 6 × ⅓◈

## Nursery Rhyme: Nameless Forest — Rank C NP [Anti-Unit] *(Passive)*

- [x] **FO.when** · At the end of every Round · `Built` · *Observed (boundary)* · GM ended Round 6: "End of the Round Master of Berserker of Faction 2: Nameless Forest Berserker: Nameless Forest"; both enemies within 2 of her caught (Heracles a Servant, Master of Berserker a Master), Van Gogh (ally, adjacent) not; one Token each
- [x] **FO.who** · …affects every enemy Unit within a 2-panel area of her, Masters and summons included · `Built` · *Observed (boundary)* · GM ended Round 6: "End of the Round Master of Berserker of Faction 2: Nameless Forest Berserker: Nameless Forest"; both enemies within 2 of her caught (Heracles a Servant, Master of Berserker a Master), Van Gogh (ally, adjacent) not; one Token each
- [x] **FO.token** · Each time, the Unit gains one Nameless Forest Token · `Built` · *Observed (boundary)* · GM ended Round 6: "End of the Round Master of Berserker of Faction 2: Nameless Forest Berserker: Nameless Forest"; both enemies within 2 of her caught (Heracles a Servant, Master of Berserker a Master), Van Gogh (ally, adjacent) not; one Token each
- [x] **FO.seal** · Not while she is inflicted with NP Seal · `Built` · *Observed (boundary, NP Seal staged on her)* · tick 31: "glassGameRewind" logged with NP Seal on her (effect 1 not stopped); Round 10's end landed no forest (no "Nameless Forest" event at that boundary, Arturia's Tokens stayed 1)
- [x] **FO.hp** · Per Token, Max Health −25 (reading 5) · `Built` · *Observed* · Heracles Max Health 1500 → 1475, Master 161 → 136 (current clamped to the new max, reading 5)
- [x] **FO.ba** · Per Token, both Base Attacks −10 · `Built` · *Observed* · Heracles BA 160/175 → 150/165
- [x] **FO.luck** · Per Token, Max Luck −1 (reading 5) · `Built` · *Observed* · Heracles Max Luck 19 → 18, Master 15 → 14
- [x] **FO.escape** · Once per Turn, on its own Turn, the Unit may attempt a Luck Check to remove every Token · `Built` · *Pressed (interface, GM bar on Faction 2's Turn); Pressed (interface)* · Heracles pressed "Escape the Forest": Tokens 1 → 0, marker removed, namelessForestResistance 10 · Heracles' second press the same Turn: "This unit has already attempted the escape this Turn."
- [x] **FO.escape.keep** · On a success the Tokens go; the Health and Luck lost are not restored · `Built` · *Observed* · after it, Heracles Max Health 1475, Max Luck 18, BA 150/165: nothing restored
- [x] **FO.home** · Its Luck Check die −3 within its Home Base · `Built` · *Pressed (interface)* · that card's "(Home Base −3)"
- [x] **FO.mag** · …and by its MAG Rank: EX −3, A −2, B −1, C 0, D +1, E +2, stacking with the Home Base term · `Built` · *Pressed (interface, GM bar on Faction 2's Turn)* · Arturia (MAG A) pressed "Escape the Forest": card "(MAG A −2)"; first it read "(MAG A −2, namelessForest −2)" (DEFECT, fixed: the ladder is the escape's alone, once)
- [x] **FO.death** · At the end of its Turn, with 3 Tokens or more, it rolls 1d12 and is defeated on a roll at or below its Token count (reading 15) · `Built` · *Observed (boundary, natural die)* · Master of Berserker, 4 Tokens, out of his Home Base at his Turn's end (tick 24): "rolls the Nameless Forest's death die: 3 against 4 Tokens, and disappears."; defeat logged "defeat tvdV 24", "Berserker loses its Master Essence: Tenacity" (reading 15: a normal defeat)
- [x] **FO.death.home** · …but cannot disappear within its Home Base · `Built` · *Observed (boundary, die staged to 1)* · Master with 3 Tokens in his Home Base at his Turn's end: "rolls the Nameless Forest's death die: 1 against 3 Tokens, but cannot disappear within its Home Base."
- [x] **FO.resist** · Each successful escape lowers its chance of gaining Tokens again by 10% from 100%, stacking (D3) · `Differs` · *Observed (boundary)* · Round 7's end: "Berserker: Nameless Forest (rolled 34 vs 90%)" after one escape (D3)

## Nursery Rhyme: A Tale for Somebody's Sake — Rank C NP [Anti-Unit]

- [x] **TA.range** · Range 4 · `Built` · *Pressed (interface)* · Player1 pressed A Tale for Somebody's Sake: "choose a panel inside the highlighted area" (Range 4 ring drawn); aimed at (9,11), 1 away
- [x] **TA.ba** · Uses BA(MAG) · `Built` · *Pressed (interface)* · Drake's card stage 1 "Base BA(MAG) self BA(MAG) × 1 +200"
- [x] **TA.area** · Hits every Unit but her in a 3x3 panel area within Range, for 3× damage (reading 1) · `Differs` · *Pressed (interface)* · the 3x3 named "Foreigner" (Van Gogh, ally) and "Rider" (Drake); "NOT TARGETED Caster — the attacker itself" (reading 1); stage 3 "3× damage"
- [x] **TA.ddw** · Then inflicts Def Dwn for 1◈: all damage taken +20% · `Built` · *Pressed (interface)* · Van Gogh's card "Def Dwn (rolled 22 vs 75%)"; defDwn 20 on Van Gogh expiry 21
- [x] **TA.cd.up** · …and increases the NP Cooldown of every Unit it affected by 1◈ · `Built` · *Pressed (interface)* · Van Gogh's card "De Sterrennacht: Cooldown 8 → 11", "Het Gele Huis: Cooldown 8 → 11" (+1◈, increased, not set)
- [x] **TA.cd** · Cooldown 5◈ · `Built` · *Pressed (interface)* · cooldown 15 = 5◈

## Nursery Rhyme: Jabberwock — Rank C NP [Anti-Unit] *(Non-damaging)*

- [x] **JW.summon** · Summons the Jabberwock on a panel next to her · `Built` · *Pressed (interface)* · Player1 pressed the Jabberwock NP: one Jabberwock at (9,10), next to her (10,10)
- [x] **JW.stats** · Health 1500, Agility 6, Luck 6, MOV 3, Range 2 / 1 target, BA(STR) 200 · `Built` · *Observed* · health 1500/1500, agility 6, luck 6, MOV 3, Range 2/1, BA(STR) 200
- [x] **JW.attr** · Attributes Demonic, Giant (reading 9) · `Built` · *Observed* · attributes demonic, giant (reading 9)
- [x] **JW.stay** · It disappears after 3◈ · `Built` · *Observed* · expiresAt 27 at tick 18 = 3◈
- [x] **JW.blade** · On its first summoning only, the [Vorpal Blade] appears on a random panel · `Built` · *Observed; Pressed (interface); Pressed (interface)* · a vorpal-blade cache on (6,0), first summoning · no second Blade placed; card read "vorpal-blade-cache — couldNotPlace" (DEFECT, fixed: the spent first-time phase is skipped; Skill-card reasons worded) · after the fix, the second summoning's card read only "1 summoned (1 → 1; 1 → 1): Jabberwock"
- [x] **JW.blade.take** · …and a Servant or Master walking onto that panel picks it up, equipped (reading 14) · `Differs` · *Pressed (Player1 client move); Pressed (GM move, faction 2); Pressed (GM move, faction 2)* · a Trump Soldier moved onto it: refused, cache kept; card "Trump Soldier cannot take [Vorpal Blade]: only a Servant or a Master can, and it stays where it lies" (reading 14) · Heracles moved onto it: picked up and equipped (worksWhenHeld), cache gone; card "Berserker picks up [Vorpal Blade], and wields it" · Master of Berserker moved onto a Blade: "Master of Berserker of Faction 2 picks up [Vorpal Blade], and wields it", BA(STR) 50 → 100
- [x] **JW.move** · It may Move to any panel; Units on a panel it moves onto are knocked back 1 (reading 10) · `Built` · *Pressed (Player1 client move)* · Player1 moved the Jabberwock (9,11) → (9,12) onto Heracles: before the fix Heracles went UP to (8,12); after, straight on to (9,13) (reading 10). Mouse drags onto the occupied panel did not register from the drive tool; the move is Player1's own TokenDocument.move, the commit a drag makes
- [x] **JW.steal** · Damage it receives from Servants restores its Health by 75% of the damage received · `Built` · *Pressed (interface)* · Heracles' Normal Attack on the Jabberwock, Player1 pressed Do nothing: 254 dealt, Health 1000 → 746 → 936 (75% = 190 restored); card "Health 746 → 936" · Master of Berserker's Normal Attack on it, Player1 pressed Do nothing: 97 dealt, 1000 → 903, nothing restored (Servants only)
- [x] **JW.budget** · It does not count towards the Units that Move or Attack in her Turn · `Built` · *Pressed (Player1 client move)* · the Jabberwock moved (9,12) → (9,11): faction-1 "Servant moves 0/4" unchanged
- [x] **JW.once** · It may Move once and Attack once per Turn · `Built` · *Pressed (interface)* · its bar after: "Move — this unit has already acted this Turn"
- [x] **JW.guard** · Enemy Units cannot Attack her or her Master while the Jabberwock is directly next to them (D2) · `Differs` · *Pressed (engine)* · Heracles declared on her with the Jabberwock beside her: "No legal targets: Caster is protected by a nearby Jabberwock" (D2, authored this audit)
- [x] **JW.attack** · Summoning it counts as her Attack for the Turn · `Built` · *Pressed (interface)* · her turnState attacked true after the summon
- [x] **JW.again** · Summoned again after disappearing, its Stats are those it disappeared with; killed, it returns at full Health (reading 11) · `Built` · *Pressed (interface)* · Player1 pressed the Jabberwock NP again (cooldown staged 0): it returned at 1500/1500 with suppressedScopes [jabberwockLifesteal] kept; expiresAt 27 = 3◈; fieldSummonStats held health 1500 on the kill
- [x] **JW.cd** · Cooldown 5◈ after the Jabberwock disappears (reading 11) · `Built` · *Observed; Pressed (interface)* · cooldown 0 while it stays (countFrom destroyed) · Heracles' Normal Attack killed it (Health 60, 341 dealt), Player1 pressed Do nothing: her Jabberwock NP cooldown 0 → 15 = 5◈ (reading 11)

## Alice Eater — the Jabberwock's Skill *(Active)*

- [x] **AE.when** · Used during her side's Turn · `Built` · *Pressed (interface)* · Player1 pressed Alice Eater on her Turn: atkUp 50 (np 25) on the Jabberwock, expiry 21 = 1◈
- [x] **AE.atk** · Atk Up to itself for 1◈: all damage dealt +50%; if NP, 25% · `Built` · *Pressed (interface)* · Player1 pressed Alice Eater on her Turn: atkUp 50 (np 25) on the Jabberwock, expiry 21 = 1◈
- [x] **AE.stay** · …and its stay on the board is extended by 3◈ more · `Built` · *Pressed (interface)* · expiresAt 27 → 36; re-pressed after the card fix: 36 → 45, card "Stay on the board: 18 → 27 Turns left"
- [x] **AE.cd** · Cooldown 4◈ · `Built` · *Pressed (interface)* · cooldown 12 = 4◈; bar "Alice Eater — Cooldown 4◈ (12 turns)"

## [Vorpal Blade] — Item

- [x] **VB.ba** · Equipped, the Unit's BA(STR) +50, for every Attack but an NP's (reading 12) · `Differs` · *Observed (differential)* · Heracles BA(STR) 160 → 210 on pickup
- [x] **VB.range** · …but its Range is reduced to 1 panel · `Built` · *Observed (differential)* · Heracles Range 2 → 1 on pickup
- [x] **VB.demonic** · …and its Normal Attack damage to 'Demonic' Units +50% · `Built` · *Pressed (interface)* · same attack, Heracles staged Demonic: stage 4 "Atk Up [Vorpal Blade] +50%"; 257 dealt
- [x] **VB.np** · None of the above affects an NP or an Attack Categorized as NP · `Built` · *Observed* · npBaseAttackOffset {str: −50}: stage 1 of an NP reads 160 (reading 12)
- [x] **VB.str** · Normal Attacks with it Equipped use BA(STR) (D4) · `Differs` · *Pressed (interface)* · Van Gogh (Normal Attack MAG) took a Blade by Player1's move: normalAttack.component mag → str, BA(STR) 50 → 100, Range 3 → 1; card "Foreigner picks up [Vorpal Blade], and wields it"; his Normal Attack on Heracles, pressed on the bar: stage 1 "Base BA(STR) self BA(STR) × 1 +100" (D4)
- [x] **VB.under** · A Master with it Equipped cannot be Underpowered by Servants · `Built` · *Pressed (interface, differential)* · Master of Berserker's Normal Attacks on Van Gogh, Player1 pressed Do nothing each time: without the Blade "Underpower: Heads (52 > 50) — damage as rolled" and "Underpower: Tails (44 ≤ 50) — damage halved"; holding it, no Underpower line at all, 76 dealt
- [x] **VB.jw** · The Jabberwock Attacked with it takes 3× damage instead of the Demonic +50% · `Built` · *Pressed (interface)* · Heracles (Blade held) Normal Attack on the Jabberwock, Player1 pressed Do nothing: stage 4 "Atk Up [Vorpal Blade] +200%" with Mad Enhancement +60% → ×3.60, 905 dealt (2 R4: +200% in the same bucket)
- [x] **VB.jw.steal** · …and its lifesteal is permanently removed, through any re-summoning · `Built` · *Pressed (interface)* · suppressedScopes [] → [jabberwockLifesteal]; card "Its lifesteal is removed for good" · ruled 2026-10-17 that the removing blow heals nothing: re-pressed, Arturia's Blade blow on a fresh Jabberwock dealt 439, Health 1000 → 561 with no heal, card "Its lifesteal is removed for good" then "[Vorpal Blade] breaks and can no longer be used"
- [x] **VB.break** · …then the Blade breaks and can no longer be used (reading 13) · `Built` · *Pressed (interface)* · the Blade left Heracles' items; card "[Vorpal Blade] breaks and can no longer be used"
- [x] **VB.barred** · Nursery and her Master cannot obtain it · `Built` · *Pressed (Player1 client move)* · her Master (Master of Caster) moved onto the Blade's panel (6,0): nothing granted, cache kept; card "Master of Caster of Faction 1 cannot take [Vorpal Blade]: it is barred to them, and it stays where it lies"

## The Queen's Glass Game: Perpetual Engine - Maiden Empire — Rank C NP [Anti-Self/Anti-World] *(Passive)*

- [x] **GG.1.when** · Effect 1 activates at the end of the Turn 3◈ after she enters Combat (D1) · `Differs` · *Observed (boundary); Observed (boundary, clock staged 8, Arturia within 3); Observed (boundary)* · her glassGameClock 0 → 1 → 2 → 3 → 4 → 5 over five Turn ends with Heracles within 3 · tick 33's end: card "Caster's Queen's Glass Game: Foreigner, Saber return to how they stood 9 Turns ago. Nameless Forest Tokens, and what they took, stay."; Arturia 900/1225 → 1225/1225, Def Dwn gone · history cleared at tick 34, Arturia at distance 3: the clock ran 0 → 9 and fired at tick 42 (nothing recorded 9 back, no card) and again at tick 51: "Caster's Queen's Glass Game: Foreigner, Saber return to how they stood 9 Turns ago…"; Van Gogh's Max Health stayed 1250 (the maxima fix live)
- [x] **GG.1.cond** · …only if enemy Units are still within 3 panels of her at the end of that Turn (D1) · `Differs` · *Observed (boundary, clock staged 8, Arturia within 3)* · tick 33's end: card "Caster's Queen's Glass Game: Foreigner, Saber return to how they stood 9 Turns ago. Nameless Forest Tokens, and what they took, stay."; Arturia 900/1225 → 1225/1225, Def Dwn gone
- [x] **GG.1.rewind** · The Stats, Parameters, Buffs, Debuffs, Cooldowns and other existing effects of every Unit within 3 panels return to what they were 3◈ before · `Built` · *Observed (boundary, clock staged 8, Arturia within 3)* · tick 33's end: card "Caster's Queen's Glass Game: Foreigner, Saber return to how they stood 9 Turns ago. Nameless Forest Tokens, and what they took, stay."; Arturia 900/1225 → 1225/1225, Def Dwn gone
- [x] **GG.1.self** · …she is not among them (reading 8) · `Built` · *Observed* · her Health 350 unchanged through it (reading 8)
- [x] **GG.1.nft** · …Nameless Forest Tokens, and the losses they caused, are not affected (reading 6) · `Differs` · *Observed* · Arturia after it: 1 Token, the namelessForest marker, Max Health 1225, Max Luck 20, BA 115/190 all kept (reading 6)
- [x] **GG.1.reset** · At the end of every Round with no enemy Unit within 3 panels, its clock resets (D1) · `Differs` · *Observed (boundary)* · with both enemies gone (the Master by the die, Heracles Masterless at tick 25), Round 8's end reset her clock 7 → 0
- [x] **GG.1.again** · After it fires, its clock starts again (reading 7) · `Differs` · *Observed* · her clock 8 → 0 after firing (reading 7)
- [x] **GG.2.when** · Effect 2 activates when she is defeated · `Built` · *Pressed (interface)* · that Excalibur defeated her (635): card "Caster's Queen's Glass Game: Caster, Foreigner, Saber return to how they stood 18 Turns ago…"; her Health back to 350/500 (her tick-34 state)
- [x] **GG.2.rewind** · Every Unit within 3 panels, herself included, returns to what it was 6◈ before her defeat · `Built` · *Pressed (interface)* · that Excalibur defeated her (635): card "Caster's Queen's Glass Game: Caster, Foreigner, Saber return to how they stood 18 Turns ago…"; her Health back to 350/500 (her tick-34 state)
- [x] **GG.2.stay** · …and she stays defeated · `Built` · *Observed* · she stays defeated: statuses [dead], defeated true
- [x] **GG.2.nft** · …Nameless Forest Tokens, and the losses they caused, are not affected (reading 6) · `Differs` · *Observed* · Arturia rewound 18 Turns and kept her 1 Token, Max Health 1225, Max Luck 20, BA 115/190 (reading 6)
- [x] **GG.2.once** · Effect 2 can be used once in the whole game · `Built` · *Observed* · glassGameSpent true after it
- [x] **GG.seal** · NP Seal does not stop either effect · `Built` · *Observed (boundary, NP Seal staged on her)* · tick 31: "glassGameRewind" logged with NP Seal on her (effect 1 not stopped); Round 10's end landed no forest (no "Nameless Forest" event at that boundary, Arturia's Tokens stayed 1)
