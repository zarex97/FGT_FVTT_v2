# Katō Danzō — the Clause list

**Draft, 2026-10-17.** The build issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Katō Danzō.md`. The generated draft (`node tools/extract-clauses.mjs "Katō Danzō"`)
was read beside it and not used: it bundled whole Skills into one line each, left eleven lines unnamed and
gave Dongyū two `KG5.cd`.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Nothing is built.** No `packs/_source/servants/` file exists for her; every Clause is `Untouched`.
Appendix D §D.20 sketches her and is wrong twice: the `Mechanical` Attribute halves nothing of Sap or
Bleed (it halves Pale Rider's Contagion, `engine/fields.mjs`), and the three Karakuri Genpō Skills do not
gate each other all ways (Kirihanasu states no gate).

**135 Clauses** across 11 Abilities and the statblock.

**Built to be reused.** Most of her is already other Servants' pieces:

- Presence Concealment A is the shared class skill (`class-presence-concealment`). The rank tables give her
  10%, +4 and 2◈, all as printed.
- *"Cannot be used on the same Turn as"* is `sameTurnExclusive` (Arturia, Arjuna, Karna).
- *"Cannot be used if X is on Cooldown"* is `requirements: abilityOffCooldown` (Scáthach, Van Gogh, Karna).
- *"Health must have been restored back to above N%"* is `healthRestoredSince` (Rho Aias, Achilles).
- *"Can be used when PC is Active, a 50% chance of deactivating it"* is `usableWhileConcealed` with
  `concealmentBreakChance` (Serenity's Shapeshift).
- *"N times"* is the effect's `uses` (Pale Rider's Dmg Cut).
- *"When an allied Unit within 2 is Attacked"* is `whenAllyAttacked` with a radius (Kiritsugu's Scapegoat), and
  *"the Combat Process continues as normal"* is `reactionFree` (#193 reading 8).
- The 1×5 line, 1×4 on the diagonal, is `shape: line` with `diagonalLength` (the Normal Lancer's NP).
- The 3×3 *"in any non-diagonal direction next to"* is Zabaniya's (#226 reading 26).
- The 3×3 at Range 4 is the square at Range (Medea, Quetzalcoatl).
- A fixed figure her own modifiers do not touch is `bypassModifiers.attacker` (Strike Air, Barrel Bombing).
- Lucky Evasion is the Combat Process's rung after a failed Evade (Ch. 21, step 2.4).
- Pierce, Ignore Def, Instakill, Disable, Slow, Burn, Dodge, Invuln, Crit Up, Atk Up, Atk Dwn and Def Dwn are
  Appendix A's.
- Sap and Bleed immunity is Karna's and Raikou's shape.

What she needs that nobody has yet, each a generic piece:

- **`SwapPositions`**, a reaction that trades two Units' panels inside a Combat Process (Kawarimi).
- **A feigned defeat**: a defeat other players see while the Unit lives on, hidden (Kirihanasu).
- **A Command Spell cost** on an ability (Yuugao).
- **Damage read from the defender's own state**, its current Health (Yuugao).
- **Evade only by Lucky Evasion** (Yuugao).
- **Presence Concealment granted at a Rank** to Units without the Skill (Dongyū). Today
  `rules/identity.mjs#discoverChance` reads only the Skill, and copies the table by hand: a second reader.

### Already ruled

**Elsewhere:** Base Attack derives from the STR/MAG tables (§46.6): BA(STR) 75 at STR D, not the printed
65, as for Serenity · Presence Concealment as pressed on Jack (#185), Serenity (#199) and Hassan (#226):
cooldown from deactivation, the coin, the six ways it ends · *"Used on an allied Unit within a 2 panel
area of herself"* lets her choose herself (#239 reading 4, as Scáthach) · an area that names no relation
hits every Unit in it (#191 reading 11) · *"Inflicts"* with no chance is the effect's base 100%, resisted
as usual (Ch. 15) · an effect with no NP figure applies its full value against an NP (#204 reading 5) ·
Crit Up reaches an NP only when an NP figure is stated (#131) · two different Atk Ups stack (#230
reading 4) · a conditional multiplier the ability states (*"further increased by 200% (tripled)"*) lands
inside the bracket (Ch. 22 stage 3, as Jack's and Karna's) · an NP used on its owner's own Turn consumes
her Attack (§46.4-AZ) · a sheet binds only its owner.

### Readings to settle

Asked by grilling, 2026-10-17. Rulings are written here as they land. None is built.

**Round 1, ruled 2026-10-17.**

1. **Class** (`SB.class`). **Ruled:** Assassin.
2. **PC C+'s Evade bonus** (`PCC.2.evade`). **Ruled:** the sheet's +2, on Dongyū's grant only. The table's +3
   stays for Semiramis's own PC C+.
3. **Who Method 1 conceals** (`DG1.pc`). **Ruled:** every Unit in the 3x3, enemies and Masters included. The
   sheet writes *"allied"* and *"enemy"* wherever it means them (#191 reading 11).
4. **Method 1 on a Unit with its own PC** (`DG1.pc`, `DG1.lost`). **Ruled:** a Unit whose own PC is Active
   keeps it and the grant skips it. Otherwise it gets C+. When the grant ends, no cooldown starts on the
   Unit's own PC Skill.
5. **Dongyū's cooldown** (`DG1.cd`, `DG2.cd`). **Ruled:** one NP, one clock; either method starts it.
6. **'Demon' or 'Beast'** (`DG2.beast`). **Ruled:** 'Demon' is `demonic` and `demonicBeast`; 'Beast' is
   `beast` and `demonicBeast`. `dark` is neither.
7. **Funshindan's Base Attack** (`FF.dmg`). **Ruled:** BA(STR), as her Normal Attack.
8. **"For 50% extra damage"** (`FF.dmg`). **Ruled:** ×1.5 inside the bracket, the Skill's own multiplier.
   Utopia's *"200% extra damage"* (#230 reading 6) was a buff's.
9. **The 50% PC roll** (`FF.pc.break`, `HS.pc.break`). **Ruled:** rolled on use, before the Combat Process. If
   it breaks PC, the Attack goes without PC. If it succeeds, PC does not end, and PC.5 does not end it
   after Funshindan's Combat Process either (Round 2, Q9b).
10. **Same-Turn exclusion** (`TK.excl`, `HS.excl`). **Ruled (Round 2):** one-way, as written. Each ability
    refuses only the partners it names, so Funshindan may follow Tobikatō or Harisenbon on the same Turn.
    Arjuna's one-way Agni Gandiva stays as built.
11. **"If Disable fails"** (`HS.slow`). **Ruled:** whenever Disable does not land: the roll, resistance,
    Immunity or a Prevention Luck Check.
12. **Who Kawarimi swaps with** (`KW.self`). **Ruled:** any Unit within 2: enemies, allies, Masters,
    summons. Only the AU is excluded.
13. **Who takes the Attack after a swap** (`KW.continue`). **Ruled:** the Unit now on the attacked panel is
    the DU; its Range is not rechecked; it reacts as usual (`reactionFree`). An AoE's panels stay put.
14. **Kawarimi's timing and PC** (`KW.when`). **Ruled:** at the reaction rung, before any Evade, as Battle
    Retreat. While she is concealed, a swap with an enemy is refused (PC.7); with an ally it is allowed.
15. **What triggers Kirihanasu** (`KH.when`). **Ruled:** an Attack's damage that would bring her to 0 after
    every reduction, offered privately before it lands; on a multi-hit Attack, the fatal hit. Not Instakill,
    Death or a damage-over-time tick.
16. **"Instead of taking damage"** (`KH.instead`). **Ruled:** neither the hit's damage nor its riders; the
    Attack ends for her.
17. **What the others see** (`KH.shown`). **Ruled:** a **Feigned Defeat** (`CONTEXT.md`). Every player but
    hers sees the defeat card and her token gone; hers and the GM see the truth. No defeat rule fires, and
    her Contract stands.
18. **How long Kirihanasu's PC lasts** (`KH.until`). **Ruled:** only her Attack ends it. No 2◈ expiry, no
    Discover, no Tails.
19. **The hidden Danzō** (`KH.move`, `KH.secret`, `KH.budget`). **Ruled:** she Moves as before she "died", up
    to her MOV, with every movement condition PC grants. She may share panels with other Units. Nothing
    targets her or catches her but her own abilities. Terrain does not affect her. *"Think of it like she was a
    ghost."* Follow-ups in Round 2, Q22 to Q27.
20. **The cooldown that gates the others** (`KH.cd.health`, `FB.gate`, `KW.gate`). **Ruled:** Kirihanasu is
    *"on Cooldown"* until 3◈−⅓◈ has run **and** her Health has been above 75% since. Until then Fubatsu
    and Kawarimi are barred. Kirihanasu itself is gated by neither.
21. **Yuugao** (`YY.dmg`, `YY.lucky`, `YY.cs`). Asked again with quotations, Round 2, Q21a to Q21c.

**Round 2, ruled 2026-10-17.**

22. **Yuugao's size** (`YY.dmg`, Q21a). **Ruled:** the DU's current Health is the base figure and the whole
    pipeline applies: her PC +50%, Atk Ups and Crit raise it, the DU's reductions but Def Up lower it. The
    sheet states no exemption, as Strike Air's does (*"Not affected by any damage modifying effects on
    Arturia"*). The size matters when Instakill does not land.
23. **What answers Yuugao** (`YY.miss`, `YY.lucky`, `YY.pierce`, Q21b). **Ruled:** no Agility Evade roll; the
    ladder goes straight to Lucky Evasion. Dodge cannot evade it. Block and Invuln are pierced. A Counter
    stays, as the sheet does not name it (Fragarach's does); PC.2 may still refuse it by AGI Rank.
24. **Yuugao's Command Spell** (`YY.cs`, Q21c). **Ruled:** one from her Contract, spent at declaration and
    kept spent on a miss. No Contract or none left: the button stays off. It is a Command Spell use for
    anything that listens.
25. **The escape Move and after** (`KH.move`, `KH.budget`, Q22). **Ruled:** the escape Move already follows
    the ghost's rules. After it, one Move per Turn on her side's Turns, not counted toward the Units that
    Move.
26. **Caught by none but her own** (`KH.secret`, Q23). **Ruled:** allies included, no buffs or heals from
    them. Effects already on her run on; a tick that brings her to 0 defeats her for real, announced. Auras
    and Bounded Fields skip her.
27. **What the ghost may do** (`KH.until`, `KH.reveal`, Q24). **Ruled:** Skills touching only herself, their
    cards to her player and the GM only. A Skill touching another Unit is refused. Any Attack (Normal,
    Funshindan, an NP) ends the ghost state and reveals her.
28. **Terrain** (Q25). **Ruled:** she ignores Terrain and Bounded Fields: effects, movement costs and
    impassable panels. She stays on the board and her Level; Platforms carry her.
29. **Revealed on a shared panel** (`KH.reveal`, Q26). **Ruled:** she goes to the nearest free panel of her
    choice just before her Attack. Not Knockback: she is the one who arrived.
30. **The revealing Attack** (`KH.reveal`, Q27). **Ruled:** it has PC A's benefits (+100%, NP +50%, no Block
    or Counter by a slower AGI Rank). PC ends at the end of that Combat Process; its 2◈ cooldown starts.

**Round 3, ruled 2026-10-17.**

31. **Funshindan as the revealing Attack** (`FF.pc.break`, `KH.reveal`, Q28). **Ruled:** the roll wins. The
    Attack reveals her and ends the ghost state; a successful roll leaves her under ordinary PC A, with its
    2◈ and its usual ends from then on. A failed roll ends PC before the Attack (reading 9).
32. **Kawarimi case 2 while concealed** (`KW.ally`, `PC.1`, Q29). **Ruled:** the Attack lands on her, since
    she stepped in; no coin. PC ends at the end of that Combat Process, as PC.5 ends it after her own Attack.

**Round 4, ruled 2026-10-18** (asked while planning the build, from what the code showed).

33. **A defeat looks the same, real or feigned** (`KH.shown`). **Ruled:** every real defeat gains a public
    card (today `io.defeat` posts none) and keeps its skulled body until Turn end. A feigned one shows the
    others the same card and a skulled decoy where she fell; her real token is hidden from them.
34. **Teammates** (`KH.shown`). **Ruled:** fooled too. Only her owner and the GM see the truth: an OWNER
    check, not the OBSERVER one concealment reads today.
35. **The ghost's budget** (`KH.budget`). **Ruled:** nothing she does as a ghost spends the shared pool, her
    self-only Skills included. Her revealing Attack spends it as usual.
36. **An AoE swap** (`KW.continue`). **Ruled:** a swapped-in Unit already caught by the same AoE trades
    Processes with her by panel. Each Unit is hit once.
37. **The 75% gate** (`KH.cd.health`). **Ruled:** above 75% at any moment after the use, as
    `healthRestoredSince` reads today. No drop is needed first.
38. **Kawarimi's partners** (`KW.self`). **Ruled:** any Unit, large footprints included.
39. **The escape Move** (`KH.move`). **Ruled:** her current MOV, Slow included.
40. **Fubatsu's Invuln charges** (`FB.invuln.times`). **Ruled:** one per hit Invuln touches, a halved NP
    included. A pierced hit spends none.
41. **Kawarimi against her own Attack** (`KW.when.ally`, asked after the live press, 2026-10-18). Her Dongyū
    (Concealment) caught allied Jack, and his card offered her Kawarimi. **Ruled:** yes, she may swap. The
    Process goes on against her where he stood, and its C+ lands on her. PC.5 leaves it: she was not concealed
    when she declared the Attack.

**Defaults, not asked.** A feigned hit pays the attacker nothing: every rule reads 0, and only the card shows
the lethal figure. After Funshindan's held roll at a reveal, the ordinary PC A runs 2◈ from the reveal.

**The frontier is empty** (2026-10-18): 41 rulings, every Clause read.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"Can be used in 2 different methods-"*: headings.
- *"Not just limbs, her whole body is a karakuri doll."*, *"Secret techniques used by ninjas."*,
  *"Mechanical Illusion. Secrets only a karakuri doll can use."*: flavour.
- *Ninjutsu — Rank A* and *Karakuri Genpō — Rank B+*: group headers. Nothing reads their Ranks.
- *"Kite Katō"*, *"Thousand Needles"*, *"Mechanical Illusion: Steadfast / Substitution / Detachment"*,
  *"Bull Swallowing - Evil Wind Death Storm"*, *"Black Arts Decapitation Method: Moonflower"*: translations.
- *"(i.e. Health would be reduced to 0)"*: a gloss on `KH.when`.
- `Items held:`: an empty slot.

## Statblock

- [x] **SB** · True Name Katō Danzō, Region Japan, True Neutral, STR D, END D, AGI A, MAG C, LUC B, Base Health 750, MOV 7, Range 3 panels / 1 target, BA(STR) 75 by the table (printed 65), BA(MAG) 150, Sustainability 2◈ · *Observed* · Player1 sheet: "ASSASSIN · NEUTRAL · JAPAN", STR D END D AGI A MAG C LUC B, BA(STR) 75 (table, printed 65), BA(MAG) 150, MOV 7, Range 3, Targets 1, Health 750/750, Sustainability 2◈
- [x] **SB.attr** · Attributes Female, Servant, [Man], Humanoid, Mechanical · *Observed* · board unit attributes [female, hominidae, humanoid, man, mechanical, servant, spirit]
- [x] **SB.class** · Class Assassin, by her class skill; the sheet names none · *Observed* · Player1 sheet: "ASSASSIN · NEUTRAL · JAPAN", STR D END D AGI A MAG C LUC B, BA(STR) 75 (table, printed 65), BA(MAG) 150, MOV 7, Range 3, Targets 1, Health 750/750, Sustainability 2◈

## Presence Concealment — Class Skill, Rank A *(Active)*

- [x] **PC.when** · Used during her Turn · *Pressed* · Player1, her Turn: 'Presence Concealment A ... 1 effect(s) applied'; expiry tick 8 (2◈ from tick 2); concealmentProfile A: Evade +4, discover 10%, cooldown 2◈
- [x] **PC.dur** · Its effects last 2◈ · *Pressed* · Player1, her Turn: 'Presence Concealment A ... 1 effect(s) applied'; expiry tick 8 (2◈ from tick 2); concealmentProfile A: Evade +4, discover 10%, cooldown 2◈
- [x] **PC.1** · She cannot be targeted for an Attack or an enemy Unit's Skill · *Pressed* · GM, enemy Medea's Normal Attack aimed at her: 'Illegal attack: No legal targets: Assassin is concealed — it cannot be targeted directly.'
- [x] **PC.1.aoe** · Caught in an AoE Attack and failing to Evade, a coin is flipped · *Pressed* · Enemy Medea's Rain of Light centred on her: her Process 'Presence Concealment: Heads — nothing is received', total 0; Jack beside her took 353
- [x] **PC.1.heads** · …Heads: no damage and no effects · *Pressed* · Enemy Medea's Rain of Light centred on her: her Process 'Presence Concealment: Heads — nothing is received', total 0; Jack beside her took 353
- [x] **PC.1.tails** · …Tails: Total Damage −50% and PC is deactivated · *Pressed* · Faction 2's Turn, enemy Medea's Rain of Light centred on her (concealed) with Jack and Kingprotea: her card 'Presence Concealment: Tails — Total Damage halved −353' (707 → 354), PC gone after, Skill Cooldown 6 (2◈)
- [x] **PC.2** · Her Attacks cannot be Blocked or Countered unless the DU's current AGI Rank is equal or higher · *Pressed* · Her Normal Attack on Medea (AGI C) while concealed: forbiddenReactions block, counter (and evade, the Disable's)
- [x] **PC.2.evade** · If the DU Evades, its Evade Roll +4 · *Pressed* · Player1, concealed, Normal Attack on Master of Alter Ego (12,13): legal; the Master's Evade roll listed 'Presence Concealment A +4' (total 18, failed); breakdown 'Combined percent +0%' (no +100% against a Master); 'Overpower: Heads — Master defeated'; PC gone after (PC.5)
- [x] **PC.3.masters** · She may Attack Masters · *Pressed* · Player1, concealed, Normal Attack on Master of Alter Ego (12,13): legal; the Master's Evade roll listed 'Presence Concealment A +4' (total 18, failed); breakdown 'Combined percent +0%' (no +100% against a Master); 'Overpower: Heads — Master defeated'; PC gone after (PC.5)
- [x] **PC.3.move** · …and Move to any panel regardless of enemy Master-Servant positions · *Pressed* · Round 8, Player1 moved her, concealed, from (10,11) straight north through Kingprotea's panel (9,11) to (7,11): accepted, nobody displaced
- [x] **PC.4** · All damage dealt +100% · *Pressed* · Same Attack: breakdown 'presenceConcealment +100%; Def Dwn +10% → ×2.10', 96; PC gone after the Process; Skill Cooldown 6 (2◈ from deactivation)
- [x] **PC.4.np** · …if NP, 50% · *Pressed* · Concealed, Dongyū (Storm) south on enemy Medea: 'presenceConcealment +50%' on the NP (418 → 627); PC gone after; her Atk Up 30 landed
- [x] **PC.4.master** · …not against Masters · *Pressed* · Player1, concealed, Normal Attack on Master of Alter Ego (12,13): legal; the Master's Evade roll listed 'Presence Concealment A +4' (total 18, failed); breakdown 'Combined percent +0%' (no +100% against a Master); 'Overpower: Heads — Master defeated'; PC gone after (PC.5)
- [x] **PC.5** · After an Attack while PC is Active, PC is deactivated at the end of the Combat Process · *Pressed* · Same Attack: breakdown 'presenceConcealment +100%; Def Dwn +10% → ×2.10', 96; PC gone after the Process; Skill Cooldown 6 (2◈ from deactivation)
- [x] **PC.6** · Moving into an enemy Servant's Range (or Detect), a 10% chance of being discovered · *Observed* · Her next Move, (7,11) → (10,12), into Kingprotea's and enemy Medea's Range: her discoverBudget recorded one attempt each ('faction-2': [Kingprotea, Medea]) at the profile's 10%; both failed, silently (GM-only roll, a card only on success); PC held
- [x] **PC.7** · Active Skills targeting or affecting enemy Units cannot be used unless stated · *Unit-tested* · `danzo-249-arena` 'concealed, she may not pick an enemy': `legalSkillTargets` drops the enemy partner while concealed. Live chance missed: no AoE caught her with an enemy within 2 while Kawarimi was ready
- [x] **PC.7.x** · …Attack Skills and Spells that deal damage are not included · *Pressed* · Funshindan, an Attack Skill, used concealed (FF.pc above); Harisenbon and Subversive Activities state their own leave
- [x] **PC.8.nb** · PC's effects are neither buff nor debuff · *Observed* · her live instance unremovable true; definition polarity status, valence neither; `removalIntents` drops unremovable instances
- [x] **PC.8.unrem** · …and are Unremovable · *Observed* · her live instance unremovable true; definition polarity status, valence neither; `removalIntents` drops unremovable instances
- [x] **PC.cd** · Cooldown 2◈ after PC is deactivated · *Pressed* · Same Attack: breakdown 'presenceConcealment +100%; Def Dwn +10% → ×2.10', 96; PC gone after the Process; Skill Cooldown 6 (2◈ from deactivation)

## Synthetic Limbs (Doll) — Rank A++ *(Passive + Active — two records)*

- [x] **SL.p** · *(Passive)* Immune to Sap · *Observed* · GM landed Sap and Bleed on her: 'Sap blocked: sap Immune', 'Bleed blocked: bleed Immune'; the same Sap applied to Jack
- [x] **SL.p.bleed** · …and to Bleed · *Observed* · GM landed Sap and Bleed on her: 'Sap blocked: sap Immune', 'Bleed blocked: bleed Immune'; the same Sap applied to Jack
- [x] **SL.when** · Used during her Turn · *Pressed* · Player1 bar, Round 2 her Turn: card 'Synthetic Limbs (Doll) A++ — Agility 14 → 17, Atk Up'; Atk Up 40 / NP 30 expiry tick 5 (1◈); Cooldown 10 (4◈−⅔◈)
- [x] **SL.agi** · Restores 3 Agility · *Pressed* · Player1 bar, Round 2 her Turn: card 'Synthetic Limbs (Doll) A++ — Agility 14 → 17, Atk Up'; Atk Up 40 / NP 30 expiry tick 5 (1◈); Cooldown 10 (4◈−⅔◈)
- [x] **SL.atk** · Applies Atk Up for 1◈, all damage dealt +40% · *Pressed* · Player1 bar, Round 2 her Turn: card 'Synthetic Limbs (Doll) A++ — Agility 14 → 17, Atk Up'; Atk Up 40 / NP 30 expiry tick 5 (1◈); Cooldown 10 (4◈−⅔◈)
- [x] **SL.atk.np** · …if NP, 30% · *Pressed* · Player1 bar, Round 2 her Turn: card 'Synthetic Limbs (Doll) A++ — Agility 14 → 17, Atk Up'; Atk Up 40 / NP 30 expiry tick 5 (1◈); Cooldown 10 (4◈−⅔◈)
- [x] **SL.cd** · Cooldown 4◈−⅔◈ · *Pressed* · Player1 bar, Round 2 her Turn: card 'Synthetic Limbs (Doll) A++ — Agility 14 → 17, Atk Up'; Atk Up 40 / NP 30 expiry tick 5 (1◈); Cooldown 10 (4◈−⅔◈)

## Ninjutsu: Tobikatō *(Active)*

- [x] **TK.when** · Used on her Turn · *Pressed* · Player1, her Turn, on Jack 1 panel off: Dodge uses 3 expiry 5 (1◈), Crit Up 25 expiry 5; card 'Ninjutsu: Tobikatō ... 2 effect(s) applied'
- [x] **TK.who** · On an allied Unit within 2 panels of herself · *Pressed* · Player1, her Turn, on Jack 1 panel off: Dodge uses 3 expiry 5 (1◈), Crit Up 25 expiry 5; card 'Ninjutsu: Tobikatō ... 2 effect(s) applied' · Player1 used Tobikatō on herself: Dodge and Crit Up on Katō Danzō (#239 reading 4)
- [x] **TK.dodge** · Applies Dodge for 1◈ · *Pressed* · Player1, her Turn, on Jack 1 panel off: Dodge uses 3 expiry 5 (1◈), Crit Up 25 expiry 5; card 'Ninjutsu: Tobikatō ... 2 effect(s) applied'
- [x] **TK.dodge.times** · …3 times · *Pressed* · Player1, her Turn, on Jack 1 panel off: Dodge uses 3 expiry 5 (1◈), Crit Up 25 expiry 5; card 'Ninjutsu: Tobikatō ... 2 effect(s) applied'
- [x] **TK.crit** · Applies Crit Up for 1◈, Crit Chance +25% · *Pressed* · Player1, her Turn, on Jack 1 panel off: Dodge uses 3 expiry 5 (1◈), Crit Up 25 expiry 5; card 'Ninjutsu: Tobikatō ... 2 effect(s) applied'
- [x] **TK.excl** · Cannot be used on the same Turn as Harisenbon or Funshindan · *Pressed* · Player1 pressed Harisenbon after Tobikatō the same Turn: refused 'sameTurnExclusive'; Funshindan after Tobikatō the same Turn was declared (reading 10, one-way)
- [x] **TK.cd** · Cooldown 4◈ · *Pressed* · Player1, her Turn, on Jack 1 panel off: Dodge uses 3 expiry 5 (1◈), Crit Up 25 expiry 5; card 'Ninjutsu: Tobikatō ... 2 effect(s) applied'

## Ninjutsu: Harisenbon *(Active)*

- [x] **HS.when** · Used on her Turn · *Pressed* · Player1, concealed, on enemy Medea 2 panels off: 'Disable rolled 24 vs 50%' applied expiry 10 (1◈+⅓◈ from tick 6), Def Dwn 10 expiry 9; whispered 'Ninjutsu: Harisenbon: rolled 59 vs 50%. Presence Concealment holds.'; Cooldown 12 (4◈)
- [x] **HS.who** · On an enemy Unit within 2 panels of herself · *Pressed* · Player1, concealed, on enemy Medea 2 panels off: 'Disable rolled 24 vs 50%' applied expiry 10 (1◈+⅓◈ from tick 6), Def Dwn 10 expiry 9; whispered 'Ninjutsu: Harisenbon: rolled 59 vs 50%. Presence Concealment holds.'; Cooldown 12 (4◈)
- [x] **HS.disable** · A 50% chance of Disable for 1◈+⅓◈ · *Pressed* · Player1, concealed, on enemy Medea 2 panels off: 'Disable rolled 24 vs 50%' applied expiry 10 (1◈+⅓◈ from tick 6), Def Dwn 10 expiry 9; whispered 'Ninjutsu: Harisenbon: rolled 59 vs 50%. Presence Concealment holds.'; Cooldown 12 (4◈)
- [x] **HS.slow** · If Disable fails, Slow for 1◈+⅓◈ · *Pressed* · Player1 Harisenbon on Kingprotea, second try: Player1's chat 'AlterEgo: Slow (otherwise) / Disable — rolled 78 vs 70% / Def Dwn — rolled 95 vs 60%'; Slow expiry 22 (1◈+⅓◈ from tick 18). (Def Dwn resisted by her own debuff resistance: it rolls as any debuff.) First try: 'Disable rolled 27 vs 70%' applied, no Slow
- [x] **HS.defdwn** · Either way, Def Dwn for 1◈, all damage taken +10% · *Pressed* · Player1, concealed, on enemy Medea 2 panels off: 'Disable rolled 24 vs 50%' applied expiry 10 (1◈+⅓◈ from tick 6), Def Dwn 10 expiry 9; whispered 'Ninjutsu: Harisenbon: rolled 59 vs 50%. Presence Concealment holds.'; Cooldown 12 (4◈)
- [x] **HS.excl** · Cannot be used on the same Turn as Tobikatō or Funshindan · *Pressed* · Player1 pressed Harisenbon after Tobikatō the same Turn: refused 'sameTurnExclusive'; Funshindan after Tobikatō the same Turn was declared (reading 10, one-way)
- [x] **HS.cd** · Cooldown 4◈ · *Pressed* · Player1, concealed, on enemy Medea 2 panels off: 'Disable rolled 24 vs 50%' applied expiry 10 (1◈+⅓◈ from tick 6), Def Dwn 10 expiry 9; whispered 'Ninjutsu: Harisenbon: rolled 59 vs 50%. Presence Concealment holds.'; Cooldown 12 (4◈)
- [x] **HS.pc** · Can be used while Presence Concealment is Active · *Pressed* · Player1, concealed, on enemy Medea 2 panels off: 'Disable rolled 24 vs 50%' applied expiry 10 (1◈+⅓◈ from tick 6), Def Dwn 10 expiry 9; whispered 'Ninjutsu: Harisenbon: rolled 59 vs 50%. Presence Concealment holds.'; Cooldown 12 (4◈)
- [x] **HS.pc.break** · …with a 50% chance of deactivating it when used · *Pressed* · Player1, concealed, on enemy Medea 2 panels off: 'Disable rolled 24 vs 50%' applied expiry 10 (1◈+⅓◈ from tick 6), Def Dwn 10 expiry 9; whispered 'Ninjutsu: Harisenbon: rolled 59 vs 50%. Presence Concealment holds.'; Cooldown 12 (4◈)

## Karakuri Ninpou: Fuuma Funshindan *(Attack Skill)*

- [x] **FF.kind** · An Attack Skill · *Pressed* · Player1, centre (10,13): one declaration, two Processes (Berserker, Caster), Attack budget 1/2; breakdown 'self BA(STR) × 1: 75' → '1.5× damage' → Atk Up 40: 214 and 96; attack element fire; Burn 'rolled 20 vs 50% applied', 'rolled 49 vs 50% applied'; Cooldown 9 (3◈)
- [x] **FF.range** · Range 4 · *Pressed* · Player1 Funshindan centred (6,11), 5 off: 'Illegal attack: Anchor panel is 5 panels away; Range is 4.'; PC untouched by the refusal
- [x] **FF.area** · Hits a 3x3 panel area · *Pressed* · Player1, centre (10,13): one declaration, two Processes (Berserker, Caster), Attack budget 1/2; breakdown 'self BA(STR) × 1: 75' → '1.5× damage' → Atk Up 40: 214 and 96; attack element fire; Burn 'rolled 20 vs 50% applied', 'rolled 49 vs 50% applied'; Cooldown 9 (3◈)
- [x] **FF.dmg** · …for 50% extra damage · *Pressed* · Player1, centre (10,13): one declaration, two Processes (Berserker, Caster), Attack budget 1/2; breakdown 'self BA(STR) × 1: 75' → '1.5× damage' → Atk Up 40: 214 and 96; attack element fire; Burn 'rolled 20 vs 50% applied', 'rolled 49 vs 50% applied'; Cooldown 9 (3◈)
- [x] **FF.burn** · A 50% chance of Burn for 2◈ · *Pressed* · Player1, centre (10,13): one declaration, two Processes (Berserker, Caster), Attack budget 1/2; breakdown 'self BA(STR) × 1: 75' → '1.5× damage' → Atk Up 40: 214 and 96; attack element fire; Burn 'rolled 20 vs 50% applied', 'rolled 49 vs 50% applied'; Cooldown 9 (3◈)
- [x] **FF.fire** · Fire damage · *Pressed* · Player1, centre (10,13): one declaration, two Processes (Berserker, Caster), Attack budget 1/2; breakdown 'self BA(STR) × 1: 75' → '1.5× damage' → Atk Up 40: 214 and 96; attack element fire; Burn 'rolled 20 vs 50% applied', 'rolled 49 vs 50% applied'; Cooldown 9 (3◈)
- [x] **FF.cd** · Cooldown 3◈ · *Pressed* · Player1, centre (10,13): one declaration, two Processes (Berserker, Caster), Attack budget 1/2; breakdown 'self BA(STR) × 1: 75' → '1.5× damage' → Atk Up 40: 214 and 96; attack element fire; Burn 'rolled 20 vs 50% applied', 'rolled 49 vs 50% applied'; Cooldown 9 (3◈)
- [x] **FF.pc** · Can be used while Presence Concealment is Active · *Pressed* · Concealed, centred (8,11): whispered 'Karakuri Ninpou: Fuuma Funshindan : rolled 93 vs 50%. Presence Concealment holds.'; Kingprotea took 'presenceConcealment +100%' (117); PC still Active after the Process (reading 9b)
- [x] **FF.pc.break** · …with a 50% chance of deactivating it when used · *Pressed* · Concealed Funshindan on Kingprotea: public card 'Karakuri Ninpou: Fuuma Funshindan gave Assassin away — rolled 15 vs 50%. Presence Concealment ends.' (no whisper); PC gone before the Process; breakdown has no presenceConcealment row (Atk Up 30 only), Block offered; PC Skill Cooldown 6 (2◈). (A GM evaluate hung on a prevention Luck Check prompt with the 45s timeouts restored; a GM reload and a fresh answer finished the Process. Tooling.)

## Karakuri Genpō: Fubatsu *(Active)*

- [x] **FB.when** · Used on her Turn · *Pressed* · Player1 on herself (#239 r4): Invuln uses 3 expiry 5, Crit Up 25; Cooldown 11 (4◈−⅓◈); Rain of Light's hit 'Invuln: −374' spent one charge, 3 → 2 (reading 40)
- [x] **FB.who** · On an allied Unit within 2 panels of herself · *Pressed* · Player1 on herself (#239 r4): Invuln uses 3 expiry 5, Crit Up 25; Cooldown 11 (4◈−⅓◈); Rain of Light's hit 'Invuln: −374' spent one charge, 3 → 2 (reading 40)
- [x] **FB.invuln** · Applies Invuln for 1◈ · *Pressed* · Player1 on herself (#239 r4): Invuln uses 3 expiry 5, Crit Up 25; Cooldown 11 (4◈−⅓◈); Rain of Light's hit 'Invuln: −374' spent one charge, 3 → 2 (reading 40)
- [x] **FB.invuln.times** · …3 times · *Pressed* · Player1 on herself (#239 r4): Invuln uses 3 expiry 5, Crit Up 25; Cooldown 11 (4◈−⅓◈); Rain of Light's hit 'Invuln: −374' spent one charge, 3 → 2 (reading 40)
- [x] **FB.crit** · Applies Crit Up for 1◈, Crit Chance +25% · *Pressed* · Player1 on herself (#239 r4): Invuln uses 3 expiry 5, Crit Up 25; Cooldown 11 (4◈−⅓◈); Rain of Light's hit 'Invuln: −374' spent one charge, 3 → 2 (reading 40)
- [x] **FB.gate** · Cannot be used while Kawarimi or Kirihanasu is on Cooldown · *Pressed/Observed* · Fubatsu pressed by Player1 while Kirihanasu's clock ran: refused 'abilityOffCooldown', tooltip 'An ability it depends on is still cooling.'; GM press gate with every clock clear: refused while her 75% watermark predated the use, allowed once she had been above 75% since (reading 37)
- [x] **FB.cd** · Cooldown 4◈−⅓◈ · *Pressed* · Player1 on herself (#239 r4): Invuln uses 3 expiry 5, Crit Up 25; Cooldown 11 (4◈−⅓◈); Rain of Light's hit 'Invuln: −374' spent one charge, 3 → 2 (reading 40)

## Karakuri Genpō: Kawarimi *(Active)*

- [x] **KW.when** · Used when Danzō is Attacked · *Pressed* · Kingprotea's Normal Attack on her; Player1 pressed Kawarimi on the card; the pick listed every Unit within 2 but the AU (Masters, allies, Lancer, enemy Caster); Player1 picked Lancer (Scáthach, an enemy): she to (11,12), Scáthach to (10,10); card 'Assassin and Lancer trade places. The Attack goes on against whoever stands where it struck.'; the Process rebound ('react:rebound'), defender 'Lancer', Scáthach answered and took 221 from her own ally (Range not rechecked); Danzō 633 unchanged; Kawarimi Cooldown 8 (3◈−⅓◈)
- [x] **KW.when.ally** · …or when an allied Unit within 2 panels of her is Attacked · *Pressed* · Scáthach's Normal Attack on Jack, 2 panels from her: 'Karakuri Genpō: Kawarimi (Assassin)' offered on Jack's card; Player1 pressed it; card 'Karakuri Genpō: Kawarimi — Two Units trade places.' and 'Assassin and Assassin trade places…'; she to (9,12), Jack to (10,11); the Process rebound to her (card defender 'Assassin'); she answered and took the hit (Fubatsu's Invuln −132, a charge spent 3 → 2); Jack untouched
- [x] **KW.self** · Danzō Attacked: she swaps herself with any other Unit within 2 panels of herself · *Pressed* · Kingprotea's Normal Attack on her; Player1 pressed Kawarimi on the card; the pick listed every Unit within 2 but the AU (Masters, allies, Lancer, enemy Caster); Player1 picked Lancer (Scáthach, an enemy): she to (11,12), Scáthach to (10,10); card 'Assassin and Lancer trade places. The Attack goes on against whoever stands where it struck.'; the Process rebound ('react:rebound'), defender 'Lancer', Scáthach answered and took 221 from her own ally (Range not rechecked); Danzō 633 unchanged; Kawarimi Cooldown 8 (3◈−⅓◈)
- [x] **KW.self.au** · …never with the AU · *Pressed* · Kingprotea's Normal Attack on her; Player1 pressed Kawarimi on the card; the pick listed every Unit within 2 but the AU (Masters, allies, Lancer, enemy Caster); Player1 picked Lancer (Scáthach, an enemy): she to (11,12), Scáthach to (10,10); card 'Assassin and Lancer trade places. The Attack goes on against whoever stands where it struck.'; the Process rebound ('react:rebound'), defender 'Lancer', Scáthach answered and took 221 from her own ally (Range not rechecked); Danzō 633 unchanged; Kawarimi Cooldown 8 (3◈−⅓◈)
- [x] **KW.ally** · An ally Attacked: she swaps herself with that allied Unit · *Pressed* · Scáthach's Normal Attack on Jack, 2 panels from her: 'Karakuri Genpō: Kawarimi (Assassin)' offered on Jack's card; Player1 pressed it; card 'Karakuri Genpō: Kawarimi — Two Units trade places.' and 'Assassin and Assassin trade places…'; she to (9,12), Jack to (10,11); the Process rebound to her (card defender 'Assassin'); she answered and took the hit (Fubatsu's Invuln −132, a charge spent 3 → 2); Jack untouched · Danzō concealed at (11,11); Kingprotea's Normal Attack on Jack (10,11); Player1 declined Jack's 'Attack first?'; Kawarimi offered on Jack's card and pressed by Player1: 'Assassin and Assassin trade places…'; Process 'react:rebound' with steppedIn true; she answered nothing: no coin (no 'Presence Concealment: Heads/Tails' row), 244 taken (750 → 506), PC gone after the Process; Jack 647 untouched. (The run waited on two GM dialogs, Kingprotea's 'Start of the Damage Step' and a Counter offer, the 45s timeouts restored; answered, it finished. Not a defect.)
- [x] **KW.continue** · The Combat Process continues as normal · *Pressed* · Kingprotea's Normal Attack on her; Player1 pressed Kawarimi on the card; the pick listed every Unit within 2 but the AU (Masters, allies, Lancer, enemy Caster); Player1 picked Lancer (Scáthach, an enemy): she to (11,12), Scáthach to (10,10); card 'Assassin and Lancer trade places. The Attack goes on against whoever stands where it struck.'; the Process rebound ('react:rebound'), defender 'Lancer', Scáthach answered and took 221 from her own ally (Range not rechecked); Danzō 633 unchanged; Kawarimi Cooldown 8 (3◈−⅓◈) · Scáthach's Normal Attack on Jack, 2 panels from her: 'Karakuri Genpō: Kawarimi (Assassin)' offered on Jack's card; Player1 pressed it; card 'Karakuri Genpō: Kawarimi — Two Units trade places.' and 'Assassin and Assassin trade places…'; she to (9,12), Jack to (10,11); the Process rebound to her (card defender 'Assassin'); she answered and took the hit (Fubatsu's Invuln −132, a charge spent 3 → 2); Jack untouched
- [x] **KW.gate** · Cannot be used while Fubatsu or Kirihanasu is on Cooldown · *Pressed* · Scáthach's Normal Attack on her while Fubatsu was cooling (4 left): no Kawarimi offered on her rung (reaction offers []); with Fubatsu's clock cleared, offered 'Karakuri Genpō: Kawarimi (Assassin)'
- [x] **KW.cd** · Cooldown 3◈−⅓◈ · *Pressed* · Kingprotea's Normal Attack on her; Player1 pressed Kawarimi on the card; the pick listed every Unit within 2 but the AU (Masters, allies, Lancer, enemy Caster); Player1 picked Lancer (Scáthach, an enemy): she to (11,12), Scáthach to (10,10); card 'Assassin and Lancer trade places. The Attack goes on against whoever stands where it struck.'; the Process rebound ('react:rebound'), defender 'Lancer', Scáthach answered and took 221 from her own ally (Range not rechecked); Danzō 633 unchanged; Kawarimi Cooldown 8 (3◈−⅓◈)

## Karakuri Genpō: Kirihanasu *(Active)*

- [x] **KH.when** · Used when Danzō is Attacked and receives fatal damage · *Pressed* · Scáthach's Normal Attack on her at 60 Health (78 damage): Player1's screen alone showed 'A fatal hit — Katō Danzō is about to take 78 damage, which would defeat her. Use it instead?' listing Kirihanasu; Player1 picked it and confirmed
- [x] **KH.private** · Her player tells the GM privately · *Pressed* · Scáthach's Normal Attack on her at 60 Health (78 damage): Player1's screen alone showed 'A fatal hit — Katō Danzō is about to take 78 damage, which would defeat her. Use it instead?' listing Kirihanasu; Player1 picked it and confirmed
- [x] **KH.instead** · Instead of taking the damage · *Pressed* · The Process read 'damage:feigned withdrawn:done' (no Injury Roll, facing or Counter); her Health stayed 60, not defeated, her Contract and Master unchanged
- [x] **KH.move** · …her player Moves her to another panel, as per her Move · *Pressed* · Kingprotea's fatal hit at 40 Health, Kirihanasu taken by Player1: the escape pick 'Move up to 7 panels, or close to stay' (112 panels, her current MOV) on Player1's canvas; Player1 picked (6,15) and she was moved there; her (whispered) card rows 'Feigned Defeat, Presence Concealment, Moved to (6, 15)'; the GM's canvas shows her token at (6,15) and the skulled body at (9,12) where she fell. (Earlier tries lost the pick to a second, frozen Player1 tab answering first — closed; not a defect.)
- [x] **KH.pc** · …and Presence Concealment is Activated · *Pressed* · presenceConcealment with expiry null beside the feignedDefeat marker
- [x] **KH.pc.cd** · …regardless of its Cooldown · *Pressed* · Second Kirihanasu (Asterios's fatal Normal Attack at 50 Health), her PC Skill cooling (5 left): presenceConcealment landed with no expiry anyway; her Skill card now whispered to Gamemaster and Player1, the defeat card 'Assassin is defeated by Berserker.' to Player2
- [x] **KH.note** · The GM notes the panel she Moved to · *Pressed* · Kingprotea's fatal hit at 40 Health, Kirihanasu taken by Player1: the escape pick 'Move up to 7 panels, or close to stay' (112 panels, her current MOV) on Player1's canvas; Player1 picked (6,15) and she was moved there; her (whispered) card rows 'Feigned Defeat, Presence Concealment, Moved to (6, 15)'; the GM's canvas shows her token at (6,15) and the skulled body at (9,12) where she fell. (Earlier tries lost the pick to a second, frozen Player1 tab answering first — closed; not a defect.)
- [x] **KH.shown** · The opposing player is shown and told that Danzō has been defeated · *Pressed; Observed* · 'Assassin is defeated by Lancer.' whispered to Player2 only; truth card 'Katō Danzō feigns her defeat …' to Gamemaster and Player1; two decoy Tiles at (11,12) — her public portrait and the skull — invisible on Player1's canvas (her owner), her own token visible to Player1 · the decoy Tiles, placed at tick 12, were gone at tick 14 (cleared once a Turn passed, as a body)
- [x] **KH.secret** · From then on her player controls her in secret, telling the GM her Moves · *Pressed* · Kingprotea beside her, Normal Attack aimed at her: 'Illegal attack: No legal targets in the selected area.' (no reason naming her); Kingprotea's radius-2 area listed six Units and neither caught nor excluded her; ally Medea's ally radius caught Jack and not her (reading 26) · Player1 moved her as a ghost (10,11) then onto Scáthach's panel (10,10): she shared it, nobody knocked back; faction budget 'Servant moves 0/4' after both · Player1: Synthetic Limbs (touches herself) used, card whispered to Gamemaster and Player1; Tobikatō on Jack refused 'feignedDefeat', bar tooltip 'Feigning defeat, she may use only Skills that touch herself, or Attack'
- [x] **KH.budget** · …and she does not count toward the Units that Move during a Turn · *Observed; Pressed* · her board unit: exemptFromBudget true, sharesPanel true (grants of feignedDefeat) · Player1 moved her as a ghost (10,11) then onto Scáthach's panel (10,10): she shared it, nobody knocked back; faction budget 'Servant moves 0/4' after both
- [x] **KH.until** · This Presence Concealment stays Active until Danzō Attacks · *Pressed* · Player1's Normal Attack on Kingprotea: 'Where she steps out — Another Unit stands on her panel' offered the seven nearest free panels; picked (10,11); public card 'Assassin was never defeated: she lives.'; marker removed; the Attack carried PC A's +100%; PC gone after the Process, Skill Cooldown 6 (2◈)
- [x] **KH.reveal** · …and then her survival is revealed to every other player · *Pressed* · Player1's Normal Attack on Kingprotea: 'Where she steps out — Another Unit stands on her panel' offered the seven nearest free panels; picked (10,11); public card 'Assassin was never defeated: she lives.'; marker removed; the Attack carried PC A's +100%; PC gone after the Process, Skill Cooldown 6 (2◈)
- [x] **KH.cd** · Cooldown 3◈−⅓◈ · *Observed* · Kirihanasu used at tick 12: Cooldown 8 (3◈−⅓◈), lastUsedTick 12
- [x] **KH.cd.health** · …and her Health must have been restored above 75% of its maximum since she used it · *Pressed/Observed* · Fubatsu pressed by Player1 while Kirihanasu's clock ran: refused 'abilityOffCooldown', tooltip 'An ability it depends on is still cooling.'; GM press gate with every clock clear: refused while her 75% watermark predated the use, allowed once she had been above 75% since (reading 37)

## Subversive Activities — Rank C *(Active)*

- [x] **SA.when** · Used on her Turn · *Pressed* · Player1, direction east: Atk Dwn 10 / NP 5 expiry 5 on Berserker and Caster (enemies in the 3x3); Jack, her ally in the same 3x3, untouched; card 'Subversive Activities C ... on Berserker Caster'; Cooldown 9 (3◈)
- [x] **SA.area** · A 3x3 area in any non-diagonal direction next to Danzō · *Pressed* · Player1, direction east: Atk Dwn 10 / NP 5 expiry 5 on Berserker and Caster (enemies in the 3x3); Jack, her ally in the same 3x3, untouched; card 'Subversive Activities C ... on Berserker Caster'; Cooldown 9 (3◈)
- [x] **SA.enemy** · …every enemy Unit in it · *Pressed* · Player1, direction east: Atk Dwn 10 / NP 5 expiry 5 on Berserker and Caster (enemies in the 3x3); Jack, her ally in the same 3x3, untouched; card 'Subversive Activities C ... on Berserker Caster'; Cooldown 9 (3◈)
- [x] **SA.atkdwn** · Atk Dwn for 1◈, all damage dealt −10% · *Pressed* · Player1, direction east: Atk Dwn 10 / NP 5 expiry 5 on Berserker and Caster (enemies in the 3x3); Jack, her ally in the same 3x3, untouched; card 'Subversive Activities C ... on Berserker Caster'; Cooldown 9 (3◈)
- [x] **SA.atkdwn.np** · …if NP, 5% · *Pressed* · Player1, direction east: Atk Dwn 10 / NP 5 expiry 5 on Berserker and Caster (enemies in the 3x3); Jack, her ally in the same 3x3, untouched; card 'Subversive Activities C ... on Berserker Caster'; Cooldown 9 (3◈)
- [x] **SA.cd** · Cooldown 3◈ · *Pressed* · Player1, direction east: Atk Dwn 10 / NP 5 expiry 5 on Berserker and Caster (enemies in the 3x3); Jack, her ally in the same 3x3, untouched; card 'Subversive Activities C ... on Berserker Caster'; Cooldown 9 (3◈)
- [x] **SA.pc** · Can be used while Presence Concealment is Active · *Pressed* · Round 8, Player1: Presence Concealment, then Subversive Activities south on Kingprotea and the (granted-concealed) enemy Medea: card 'Caster: Atk Dwn' and 'Atk Dwn — rolled 98 vs 10%' (Kingprotea's resistance); her PC still Active after

## Karakuri Genpō: Dongyū — Rank C+, NP, Anti-Beast *(two methods)*

- [x] **DG.np** · A Noble Phantasm, Rank C+, \[Anti-Beast\] · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG.methods** · Used in one of two methods · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)

### Method 1

- [x] **DG1.area** · A 3x3 area in any non-diagonal direction next to Danzō · *Pressed* · Player1, Round 5, direction north from (11,12): Presence Concealment landed on enemy Medea, enemy Asterios and ally Medea, each params {rank: 'C+', evade: 2}, expiry 17 (2◈ from tick 11); card 'Karakuri Genpō: Dongyū (Concealment) C+ … on Caster Berserker Caster 3 effect(s) applied'; the NP consumed her Attack (turnState attacked) · Player1 Dongyū (Concealment) south from (10,12): Jack (ally, no PC of his own now) and enemy Medea each got presenceConcealment params {rank: 'C+', evade: 2}, expiry 26 (2◈); her own PC ended after (an NP is her Attack, PC.5)
- [x] **DG1.pc** · Applies Presence Concealment — Rank C+ to every affected Unit · *Pressed* · Player1, Round 5, direction north from (11,12): Presence Concealment landed on enemy Medea, enemy Asterios and ally Medea, each params {rank: 'C+', evade: 2}, expiry 17 (2◈ from tick 11); card 'Karakuri Genpō: Dongyū (Concealment) C+ … on Caster Berserker Caster 3 effect(s) applied'; the NP consumed her Attack (turnState attacked) · Jack, his own PC A+ Active, in the same 3x3: 'Presence Concealment — already present, does not refresh'; his instance keeps A+ (5%, +4, 2◈) · Player1 Dongyū (Concealment) south from (10,12): Jack (ally, no PC of his own now) and enemy Medea each got presenceConcealment params {rank: 'C+', evade: 2}, expiry 26 (2◈); her own PC ended after (an NP is her Attack, PC.5)
- [x] **DG1.dur** · …for 2◈ · *Pressed* · Player1, Round 5, direction north from (11,12): Presence Concealment landed on enemy Medea, enemy Asterios and ally Medea, each params {rank: 'C+', evade: 2}, expiry 17 (2◈ from tick 11); card 'Karakuri Genpō: Dongyū (Concealment) C+ … on Caster Berserker Caster 3 effect(s) applied'; the NP consumed her Attack (turnState attacked)
- [x] **DG1.lost** · …and the effect is lost when that duration ends · *Observed* · Enemy Medea's granted C+ (expiry 26) present at tick 26, gone at tick 27 at real Turn boundaries; she has no Presence Concealment Skill, so no clock started. Danzō's own PC A (expiry 26) ended the same boundary and its Skill Cooldown 6 (2◈) started
- [x] **DG1.cd** · Cooldown 5◈+⅓◈ · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)

### Method 2

- [x] **DG2.str** · BA(STR) is used · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG2.area** · A 1x5 or 5x1 area in any direction next to Danzō · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG2.diag** · …1x4 or 4x1 on the diagonal · *Observed* · `shape: {kind: line, length: 5, diagonalLength: 4}`, read by `targeting/shapes.mjs` (geometry.test.mjs: 'Danzō's Dongyu: 1x5 cardinal, 1x4 diagonal')
- [x] **DG2.dmg** · 3x damage plus 100 · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG2.beast** · Damage +200% (tripled) against Units with the 'Demon' or 'Beast' Attribute · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG2.wind** · Wind damage · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG2.atk** · Then Atk Up for 1◈, all damage dealt +30% · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG2.atk.np** · …if NP, 20% · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)
- [x] **DG2.cd** · Cooldown 5◈+⅓◈ · *Pressed* · Player1, Round 4 (NP gate), east line from (10,10): caught Asterios (10,13, demonicBeast) and Medea (10,12); Asterios 'Demon or Beast (+200%): 3; 3× damage; plus 100' (75−30)×3×3+100 = 505, 1386 → 881; Medea (75−28)×3+100 ×1.1 Def Dwn = 265; attack element wind; then her Atk Up 30 / NP 20 expiry 11 (1◈); both methods' Cooldown 16 (5◈+⅓◈), one clock (reading 5)

### Presence Concealment — Rank C+, as Method 1 grants it

- [x] **PCC.1** · The Unit cannot be targeted for an Attack or an enemy Unit's Skill · *Pressed* · Kingprotea beside the granted Jack, Normal Attack on him: 'Illegal attack: No legal targets: Assassin is concealed — it cannot be targeted directly.'
- [x] **PCC.1.aoe** · Caught in an AoE Attack and failing to Evade, a coin is flipped · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.1.heads** · …Heads: no damage and no effects · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.1.tails** · …Tails: Total Damage −50% and PC is deactivated · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.2** · Its Attacks cannot be Blocked or Countered unless the DU's current AGI Rank is equal or higher · *Pressed* · Ally Medea, granted C+, Normal Attack on Scáthach (AGI ≥ hers): no reaction refused; Scáthach Evaded with 'Presence Concealment C+ +2' among the modifiers (the sheet's +2, reading 2); Medea's PC gone after the Process, no clock (she has no PC Skill)
- [x] **PCC.2.evade** · If the DU Evades, its Evade Roll +2 · *Pressed* · Ally Medea, granted C+, Normal Attack on Scáthach (AGI ≥ hers): no reaction refused; Scáthach Evaded with 'Presence Concealment C+ +2' among the modifiers (the sheet's +2, reading 2); Medea's PC gone after the Process, no clock (she has no PC Skill)
- [x] **PCC.3.masters** · It may Attack Masters · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.3.move** · …and Move to any panel regardless of enemy Master-Servant positions · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.4** · All damage dealt +100% · *Pressed* · Player1's Jack, granted C+, Normal Attack on Kingprotea: breakdown 'presenceConcealment +100%' (132 → 264); counter declined
- [x] **PCC.4.np** · …if NP, 50% · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.4.master** · …not against Masters · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.5** · After an Attack while PC is Active, PC is deactivated at the end of the Combat Process · *Pressed* · Ally Medea, granted C+, Normal Attack on Scáthach (AGI ≥ hers): no reaction refused; Scáthach Evaded with 'Presence Concealment C+ +2' among the modifiers (the sheet's +2, reading 2); Medea's PC gone after the Process, no clock (she has no PC Skill)
- [x] **PCC.6** · Moving into an enemy Servant's Range (or Detect), a 35% chance of being discovered · *Observed* · concealmentProfile of each granted Unit: rank C+, discover 35%, cooldown null (granted)
- [x] **PCC.7** · Active Skills targeting or affecting enemy Units cannot be used unless stated · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.7.x** · …Attack Skills and Spells that deal damage are not included · *Observed* · one definition, one reader: the instance's `params` change only rank, Evade bonus and Discover (`concealmentProfile`); each rule pressed live on her own PC above (PC.1.aoe/heads/tails, PC.3.*, PC.4.np/master); `danzo-249-arena` 'conceals the enemy too, at C+'
- [x] **PCC.8.nb** · Its effects are neither buff nor debuff · *Observed* · Jack's granted instance unremovable true; the same `presenceConcealment` definition as hers (status, valence neither)
- [x] **PCC.8.unrem** · …and are Unremovable · *Observed* · Jack's granted instance unremovable true; the same `presenceConcealment` definition as hers (status, valence neither)

## Youjutsu Zanhou・Yuugao — Rank C, NP, Anti-Unit

- [x] **YY.np** · A Noble Phantasm, Rank C, \[Anti-Unit\] · *Pressed* · Player1, Round 7, from (8,10) on Scáthach (10,10), 1279 Health: card 'Master of Assassin of Faction 1 spends 1 Command Spell(s) to power Assassin's Noble Phantasm.', Master's Command Spells 3 → 2; breakdown 'Base: the DU's current Health +1279', 'presenceConcealment +50%', 'Def Up Tenacity (ignored by Ignore Def)' → 1882; Scáthach defeated, card 'Lancer is defeated by Assassin.'; PC gone after (PC.5); NP Cooldown 15 (5◈)
- [x] **YY.cs** · Can only be used by expending a Command Spell · *Pressed* · Player1, Round 7, from (8,10) on Scáthach (10,10), 1279 Health: card 'Master of Assassin of Faction 1 spends 1 Command Spell(s) to power Assassin's Noble Phantasm.', Master's Command Spells 3 → 2; breakdown 'Base: the DU's current Health +1279', 'presenceConcealment +50%', 'Def Up Tenacity (ignored by Ignore Def)' → 1882; Scáthach defeated, card 'Lancer is defeated by Assassin.'; PC gone after (PC.5); NP Cooldown 15 (5◈)
- [x] **YY.range** · Range 3 · *Pressed* · Same Turn, Asterios at (10,13): refused 'Berserker is out of Range (3).'
- [x] **YY.who** · On an enemy Unit · *Pressed* · Player1, Round 7, from (8,10) on Scáthach (10,10), 1279 Health: card 'Master of Assassin of Faction 1 spends 1 Command Spell(s) to power Assassin's Noble Phantasm.', Master's Command Spells 3 → 2; breakdown 'Base: the DU's current Health +1279', 'presenceConcealment +50%', 'Def Up Tenacity (ignored by Ignore Def)' → 1882; Scáthach defeated, card 'Lancer is defeated by Assassin.'; PC gone after (PC.5); NP Cooldown 15 (5◈)
- [x] **YY.pierce** · Has the Pierce effect · *Pressed* · Player1 on Asterios (Invuln, Luck 2), CS 2 → 1: no Block button (Invuln's own 'cannot Block'); Evade 'this hit cannot be Evaded'; Lucky Evasion offered 'Contest (costs 1 Luck, have 2)', contested 16+4 lost, Luck 2 → 1; damage 908 = 881 current Health + Crit, no Invuln row (pierced); Instakill applied; 'Berserker is defeated by Assassin.'
- [x] **YY.dmg** · Deals damage equal to the DU's current Health · *Pressed* · Player1, Round 7, from (8,10) on Scáthach (10,10), 1279 Health: card 'Master of Assassin of Faction 1 spends 1 Command Spell(s) to power Assassin's Noble Phantasm.', Master's Command Spells 3 → 2; breakdown 'Base: the DU's current Health +1279', 'presenceConcealment +50%', 'Def Up Tenacity (ignored by Ignore Def)' → 1882; Scáthach defeated, card 'Lancer is defeated by Assassin.'; PC gone after (PC.5); NP Cooldown 15 (5◈)
- [x] **YY.ignoredef** · …with the Ignore Def effect · *Pressed* · Player1, Round 7, from (8,10) on Scáthach (10,10), 1279 Health: card 'Master of Assassin of Faction 1 spends 1 Command Spell(s) to power Assassin's Noble Phantasm.', Master's Command Spells 3 → 2; breakdown 'Base: the DU's current Health +1279', 'presenceConcealment +50%', 'Def Up Tenacity (ignored by Ignore Def)' → 1882; Scáthach defeated, card 'Lancer is defeated by Assassin.'; PC gone after (PC.5); NP Cooldown 15 (5◈)
- [x] **YY.instakill** · Inflicts Instakill if damage is dealt · *Pressed* · 'Instakill: resisted, rolled 99 vs 75%': Medea's Item Construction aura gives Scáthach Instakill resist 25; Magic Resistance A did not apply (STR NP, its predicate held). Arena guard added: Scáthach alone, Instakill automatic · Player1 on Asterios (Invuln, Luck 2), CS 2 → 1: no Block button (Invuln's own 'cannot Block'); Evade 'this hit cannot be Evaded'; Lucky Evasion offered 'Contest (costs 1 Luck, have 2)', contested 16+4 lost, Luck 2 → 1; damage 908 = 881 current Health + Crit, no Invuln row (pierced); Instakill applied; 'Berserker is defeated by Assassin.'
- [x] **YY.miss** · Misses if the DU successfully Evades · *Pressed* · GM answered Evade for Scáthach: 'evade 1d20 → 7, this hit cannot be Evaded, automatic success' for the attacker, ladder 'evadeRoll → fail', then 's24_luckyEvasion' offered (declined by the 0s test timeout)
- [x] **YY.lucky** · …and can be Evaded only with a Luck Check (Lucky Evasion) · *Pressed* · GM answered Evade for Scáthach: 'evade 1d20 → 7, this hit cannot be Evaded, automatic success' for the attacker, ladder 'evadeRoll → fail', then 's24_luckyEvasion' offered (declined by the 0s test timeout) · Player1 on Asterios (Invuln, Luck 2), CS 2 → 1: no Block button (Invuln's own 'cannot Block'); Evade 'this hit cannot be Evaded'; Lucky Evasion offered 'Contest (costs 1 Luck, have 2)', contested 16+4 lost, Luck 2 → 1; damage 908 = 881 current Health + Crit, no Invuln row (pierced); Instakill applied; 'Berserker is defeated by Assassin.'
- [x] **YY.cd** · Cooldown 5◈ · *Pressed* · Player1, Round 7, from (8,10) on Scáthach (10,10), 1279 Health: card 'Master of Assassin of Faction 1 spends 1 Command Spell(s) to power Assassin's Noble Phantasm.', Master's Command Spells 3 → 2; breakdown 'Base: the DU's current Health +1279', 'presenceConcealment +50%', 'Def Up Tenacity (ignored by Ignore Def)' → 1882; Scáthach defeated, card 'Lancer is defeated by Assassin.'; PC gone after (PC.5); NP Cooldown 15 (5◈)
