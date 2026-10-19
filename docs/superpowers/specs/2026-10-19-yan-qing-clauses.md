# Yan Qing — the Clause list

**Draft, 2026-10-19.** The build issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Yan Qing.md`. The generated draft (`node tools/extract-clauses.mjs "Yan Qing"`)
was read beside it and not used: it bundled each passive and each Presence Concealment rule into one line,
gave Doppelganger two `DO.cd`, and listed the Rank A and B+ concealment blocks as sixteen lines that repeat
the Class Skill's.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Built 2026-10-19** on `claude/yan-qing-build` (`packs/_source/servants/yan-qing.yml` and eight
`abilities/yan-qing-*.yml`), tested in `test/unit/yan-qing-253-rulings.test.mjs` and `yan-qing-253-arena.test.mjs`.
Pressed live 2026-10-19 (PC world `fgt2026`, scenes *Yan Qing Build* and *Yan Qing ◈8*, as Player1, Player2 on the
other side): **all 75 Clauses `Pressed` or `Observed`** (65 Pressed, 10 Observed). Each Clause below carries its
evidence. Four defects found by the presses, all fixed. Ch. 46 §46.41. Appendix D §D.19 sketches him, and two of its claims are
questions here, not facts: that Yan Qing Fist's Lawful clause is *"deliberately"* a flat 30 (Q1), and
that the Disguise needs no Fog of War this system lacks (Q5: Foundry's fog is live, `engine/token-vision.mjs`).

**75 Clauses** across 8 Abilities and the statblock (78 drafted; reading 5 dropped the no-fog fallback's
five, reading 2 added `RF.p2.when`, reading 10 added `DP.size`).

**Built to be reused.** Most of him is already other Servants' pieces:

- Presence Concealment C is the shared class skill (`class-presence-concealment`). The rank tables give him
  40%, +3 and 1◈, all as printed (B §PC).
- PC raised to another Rank is `concealmentProfile` (`rules/concealment.mjs`), the one reader of the
  three numbers, which Danzō's Dongyū grant already feeds from an instance's `params` (#249 reading 2).
- *"Cannot be used if X is Active"* is the mode system's exclusion group (Ch. 15 §15.6) or a
  `requirements` entry on the other ability's effect.
- *"Spend X Agility to increase the damage"* is an `OptionalCost` (Mannanán's Tradition Carrier,
  `engine/optional-costs.mjs`), here paying Agility at the damage step.
- *"Reduce his NP Cooldown"* is a cooldown phase with `scope: np` (Arturia, Arjuna, Drake).
- *"Roll N dice and apply the effects depending on the numbers rolled"* is `rollTable` (Scáthach's
  Primordial Rune; `engine/attack.mjs#rollTableAgainst` on the attack path).
- Def Dwn (C) and its Agility −1 are Van Gogh's and Mannanán's (`effects/def-dwn-c.yml`). It drains on
  "hit, not hurt" for every Def Dwn (C), whatever its wording (Van Gogh reading 3c).
- S.Crit Up is an aura its caster holds, reaching allies within 2 (#132): Kiritsugu, Mannanán, Karna, Drake.
- *"For this Turn"* is the duration `this turn` (Achilles' Runner Comet).
- Crit Up, Crit Dwn, Crit DmUp, Atk Up and Dmg Up are Appendix A's.

What he needs that nobody has yet, each a generic piece:

- **An alignment predicate**, `target:order:<value>` and `target:morality:<value>`, on the option set
  (`rules/predicate.mjs`). Today only Attributes reach it (`side:attribute:x`), so *"Units with the
  'Lawful' Alignment"* has no word to be written in.
- **A Rank raised by a buff** on a Unit's own Presence Concealment (Espionage). `RankShift` exists for
  parameters (Penthesilea, Kiritsugu); here it reaches a Skill's Rank and `concealmentProfile` reads it.
- **A cooldown delta that reads the War's ◈** (*"2 Turns if ◈ is greater than 4"*): the first magnitude
  that compares `turnsPerRound` rather than multiplying by it.
- **Duplicate rule `reroll`** on `rollTable`, beside Scáthach's "apply twice", and a **"wildcard face"**
  that applies every row (*"If a 4 is rolled on any of the dice, apply all three effects"*). Rows that land
  on different Units: two on the DU, one on himself.
- **A self-state ended by its owner**, with effects that depend on how it ended: by hand, by a hit of
  10% of his Max Health or more, by an Attack, or by expiry (Doppelganger).
- **Disguise** (reading 5). `rules/elements.mjs#Disguise` emits a `presentation` suppression and
  **nothing reads it** (grep `"presentation"`): a producer without a consumer. Appendix A defines it as
  *"a per-viewer presentation override — name, image and disposition colour only. No state change"*, and
  cites Ch. 44 §44.4, which no longer exists (Ch. 44 is Testing now).

### Already ruled

**Elsewhere:** Base Attack derives from the STR/MAG tables (§46.6): BA(STR) **125** at STR B, not the
printed 105; BA(MAG) 125 at MAG D, as printed · Class Assassin, by his class skill, as Danzō (#249 reading
1) · Presence Concealment as pressed on Jack (#185), Serenity (#199), Hassan (#226) and Danzō (#249):
cooldown from deactivation, the coin, the six ways it ends, PC.5 per declaration · Crit Up and Crit DmUp
reach an NP only when an NP figure is stated (#131) · *"Inflicts"* with no chance is the effect's base 100%,
resisted as usual (Ch. 15) · two different Atk Ups stack (#230 reading 4) · a Def Dwn (C) drains Agility on
a hit, not only on damage (Van Gogh reading 3c) · an NP used on its owner's own Turn consumes his Attack
(§46.4-AZ) · a reach the sheet does not state is the Unit's own, never a frozen number (§46 audit,
"Absolute where the sheet is silent"): the NP aims at one target within his Range, today 1 · a sheet binds
only its owner.

### Readings to settle

Asked by grilling, 2026-10-19. Rulings are written here as they land. All 15 are built.

**Round 1, ruled 2026-10-19.**

3. **Zhōng Guó Quán Fǎ's trigger** (`ZG.np`, `ZG.np.big`). **Ruled:** only a Normal Attack whose damage
   dealt is above 0. A Counter made with a Normal Attack counts. "Turns" are plain Turns, not ◈. *"◈
   greater than 4"* is the War's `turnsPerRound` at 5 or more, read when the Combat Process ends.
5. **Doppelganger's version** (`DP.*`). **Ruled:** the Disguise only. This system has Fog of War
   (`engine/token-vision.mjs`), so the sheet's no-fog fallback is not built: `DP.fb*` move to *Not Clauses*.
   Disguise details in Round 2.
6. **What he may do while disguised** (`DP.lock`, `DP.end.manual`). **Ruled:** Normal Attacks and passives
   work. *"Can be deactivated at any time"* is a button he may press whenever he could act, other sides'
   Turns included, but not inside a Combat Process.
7. **"After calculation"** (`DP.atk`, `DP.critdm`). **Ruled:** ordinary Atk Up and Crit DmUp, summed in the
   bracket with every other bonus. No separate stage.

**Round 2, ruled 2026-10-19** (1, 2, 4, 8 and 9 asked again with quotations).

1. **Yan Qing Fist's Lawful figure** (`YF.lawful`). **Ruled:** 30%, as the Evil clause. The missing `%` is
   a typo: it is the only *"increased by N"* without one in 46 sheets, and the corpus writes a flat bonus
   as *"deal 40 bonus Lightning damage"* (Raikou). Appendix D §D.19's *"flat 30 … deliberately different
   kinds"* is corrected when he is built.
2. **Ruffian's Agility spend** (`RF.p2.*`). **Ruled:** no cap, overriding the sheet's own *"(maximum 5
   Agility?)"*: he may spend any amount up to his current Agility, +5% damage dealt per point. Asked
   privately after the DU's reaction and before damage is computed; nothing is paid on an Evade. Normal
   Attacks and Counters; never a Noble Phantasm. He has no area Attack it can ride, so per-Process is moot.
4. **Espionage and Presence Concealment** (`ES.buff`, `PC.cd`). **Ruled:** the Rank is live. Espionage
   raises a PC already Active and one switched on later within its 1◈. When the buff ends while PC runs,
   PC reads C again (40%, +3). The cooldown after deactivation is always the Skill's printed 1◈, never the
   table's 2◈ for A.
8. **Skillful Star's figure** (`SS.ally`). **Ruled:** S.Crit Up for 1◈, Crit Chance +15%. The sheet's
   *"increased by ⅓◈ Turns"* is a typo.
9. **When the NP's dice are rolled** (`NP.roll`). **Ruled:** only when its riders fire: a hit, not hurt
   (a Block or an Invuln to 0 still rolls; an Evade or a complete negation does not). His own Crit DmUp
   from a 3 follows the same rule.
11. **Who the Disguise fools** (`DP.look`). **Ruled:** everyone but his owner and the GM, teammates
    included, as Danzō's Feigned Defeat (#249 reading 34).
12. **What the Disguise changes** (`DP.look`, `DP.stats`). **Ruled:** his token's image and name, his
    border's disposition colour (the copied Unit's), and every card line and list that names him, through
    `publicIdentityOf`. His footprint and every rule stay his.
13. **The 10% hit** (`DP.end.hit`). **Ruled:** the Health he actually loses from one Attack, summed over its
    hits, at 10% of his Max Health or more (75 at 750). The Disguise ends the moment that damage lands: no
    rewards, and the 4◈−⅓◈ cooldown starts.
14. **How long the Disguise lasts** (`DP.end.*`). **Ruled:** until he ends it by hand or the 10% hit ends
    it. No expiry, and his own Attacks do not end it.

**Round 3, ruled 2026-10-19.**

10. **Who he can look like** (`DP.look`, `DP.size`). **Ruled:** any Unit on his War's board, of any side,
    himself excluded: Servants, Masters, Civilians and summons. Only a Unit of his own size: its footprint
    equals his, one panel, so Bašmu is excluded. *"Character (figurine)"* names characters, so Platforms
    and structures are not offered. If the copied Unit is later defeated or leaves the board, the Disguise
    stays; only his hand or the 10% hit ends it (reading 14).

**Round 4, ruled 2026-10-19** (asked after the presses).

15. **An enemy's look while concealed** (`DP.look`, `PC.7`). **Ruled:** allowed. The look is a target, but nothing
    reaches the copied Unit, so PC.7's bar on Skills *"targeting/affecting an enemy Unit(s)"* does not apply.
    Doppelganger is `usableWhileConcealed`.

**The frontier is empty** (2026-10-19): 15 rulings, every Clause read.

### Found while reading

- `rules/targeting/resolve.mjs:391` reads `caster.alignment?.moral`. The field is `alignment.morality`
  (`data/actor/servant.mjs:75`, `rules/snapshot.mjs:406`). No content authors `forbidCivilians`, so the
  path is dead today; the alignment predicate above must not copy it.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"apply the following effects to himself-"*: headings.
- *"Chinese Boxing."*, *"Ambushed from Ten Sides - As If There Was No Shadow."*: translations.
- *"(Presence Concealment — Rank: A)"* and *"(Presence Concealment — Rank: B+)"* lines 1, 3, 4, 5, 7 and 8:
  the Class Skill's own rules, unchanged. Each block's Clauses are only the figures that differ.
- `Items Held:`: an empty slot.
- Doppelganger's *"Note: … if Fog of War is not implemented, it would have the same effect as Presence
  Concealment — Rank: B+"* and its B+ block: ruled out by reading 5. They were `DP.fb`, `DP.fb.evade`,
  `DP.fb.discover`, `DP.fb.rewards` and `DP.fb.cd`.

## Statblock

- [x] **SB** · True Name Yan Qing, Doppelganger, Region China, Neutral Evil, STR B, END D, AGI A+, MAG D, LUC B, Base Health 750, MOV 7, Range 1 panel / 1 target, BA(STR) 125 by the table (printed 105), BA(MAG) 125, Sustainability 2◈ · *Observed* · Player1 sheet: "ASSASSIN · NEUTRAL EVIL · CHINA", STR B END D AGI A+ MAG D LUC B, BA(STR) 125 (table, printed 105), BA(MAG) 125, MOV 7, Range 1, Targets 1, Health 750/750, Agility 20/20, Sustainability 2◈
- [x] **SB.attr** · Attributes Male, Servant, [Man], Humanoid, Liangshan · *Observed* · board unit attributes [hominidae, humanoid, liangshan, male, man, servant, spirit]; alignment {order: neutral, morality: evil}
- [x] **SB.class** · Class Assassin, by his class skill; the sheet names none · *Observed* · Player1 sheet: "ASSASSIN · NEUTRAL EVIL · CHINA", STR B END D AGI A+ MAG D LUC B, BA(STR) 125 (table, printed 105), BA(MAG) 125, MOV 7, Range 1, Targets 1, Health 750/750, Agility 20/20, Sustainability 2◈

## Presence Concealment — Class Skill, Rank C *(Active)*

- [x] **PC.when** · Used during his Turn · *Pressed* · Player1 switched Presence Concealment on after Espionage (tick 5): presenceConcealment expiry 11 (2◈)
- [x] **PC.dur** · Its effects last 2◈ · *Pressed* · Player1 switched Presence Concealment on after Espionage (tick 5): presenceConcealment expiry 11 (2◈)
- [x] **PC.1** · He cannot be targeted for an Attack or an enemy Unit's Skill · *Pressed* · Blue's Turn (Round 3), GM: Arturia's Normal Attack aimed at him, concealed: 'Illegal attack: No legal targets: Assassin is concealed — it cannot be targeted directly.'
- [x] **PC.1.aoe** · Caught in an AoE Attack and failing to Evade, a coin is flipped · *Pressed* · Round 7, Blue's Turn: Player2 switched Invisible Air off and declared Excalibur west from Arturia; one declaration, Processes for him and Asterios. His (caughtConcealed, reaction 'nothing' at the rung's timeout): concealmentVeil {heads: true, factor 0, effects: false}, card 'Saber ⚔ Assassin Excalibur … 0'; Health 518 unchanged, presenceConcealment kept
- [x] **PC.1.heads** · …Heads: no damage and no effects · *Pressed* · Round 7, Blue's Turn: Player2 switched Invisible Air off and declared Excalibur west from Arturia; one declaration, Processes for him and Asterios. His (caughtConcealed, reaction 'nothing' at the rung's timeout): concealmentVeil {heads: true, factor 0, effects: false}, card 'Saber ⚔ Assassin Excalibur … 0'; Health 518 unchanged, presenceConcealment kept
- [x] **PC.1.tails** · …Tails: Total Damage −50% and PC is deactivated · *Pressed* · Round 10, concealed and disguised: Player2's Excalibur caught him, the coin (staged d2 face 2) came up Tails: 'Presence Concealment: Tails — Total Damage halved' 892 → 446; presenceConcealment gone, Cooldown 3 (1◈); the blow also ended Doppelganger (endedBy hit)
- [x] **PC.2** · His Attacks cannot be Blocked or Countered unless the DU's current AGI Rank is equal or higher · *Pressed* · Player1, concealed, Normal Attack on EMIYA (AGI C): forbiddenReactions [block, counter]; EMIYA offered nothing, evade, Eye of the Mind (True)
- [x] **PC.2.evade** · If the DU Evades, its Evade Roll +3 · *Pressed* · Round 6: Player1 used Presence Concealment (no Espionage): Player2's canvas no longer drew his token; concealmentProfile on Player2's board {rank C, evade 3, discover 40, cooldown 1◈} · Round 9, concealed: Player1 dragged him to (5,9) and attacked the unguarded Master of Archer (its Servant defeated); Player2 pressed Evade: roll 'evade 1d20 = 5, total 12' with 'Presence Concealment C +3' among its modifiers, failed; Player2 accepted; breakdown 'base:str 125; attack+ 24.15 (crit); defUp −10 (Home Base)', no Presence Concealment +100% = 134; 'Overpower: Heads (34 ≤ 50) — Master defeated'
- [x] **PC.3.masters** · He may Attack Masters · *Pressed* · same Turn: Player1's Normal Attack aimed at Master of Saber was legal; the guard rule (Ch. 32 case 3) moved Arturia in: "Saber steps in beside Master of Saber of Blue and takes the Attack. Saber Agility Check 1d20 → 6, 6 against 15: success", as Serenity's (#199 KT); Arturia's Instinct then evaded it; PC gone at the Process's end (PC.5)
- [x] **PC.3.move** · …and Move to any panel regardless of enemy Master-Servant positions · *Pressed* · Round 8, concealed: Player1 dragged him (6,6) → (8,7), past Arturia beside her Master (9,7): accepted; his discoverBudget recorded one attempt by Arturia at the profile's 40%, failed silently, PC held
- [x] **PC.4** · All damage dealt +100% · *Pressed* · Same Attack: breakdown 'base:str 125; attack+ 36.8 (crit); atkUp 100 (Presence Concealment); dmgUp 35; zonPenalty −24' = 356; presenceConcealment gone at the Process's end
- [x] **PC.4.np** · …if NP, 50% · *Pressed* · Round 7, concealed, Player1's NP on EMIYA (Player2 declined Reinforcement, answered 'nothing'; Block and Counter forbidden): breakdown 'base:str 125; attack+ 29; multiplier 5; atkUp 50 (PC's NP figure)' = 1155, EMIYA defeated ('Archer is defeated by Assassin.'); 'Archer rolls 2, 1.': Crit Dwn and Def Dwn (C) on EMIYA, no Crit DmUp on him; PC gone at the Process's end, Cooldown 3
- [x] **PC.4.master** · …not against Masters · *Pressed* · Round 9, concealed: Player1 dragged him to (5,9) and attacked the unguarded Master of Archer (its Servant defeated); Player2 pressed Evade: roll 'evade 1d20 = 5, total 12' with 'Presence Concealment C +3' among its modifiers, failed; Player2 accepted; breakdown 'base:str 125; attack+ 24.15 (crit); defUp −10 (Home Base)', no Presence Concealment +100% = 134; 'Overpower: Heads (34 ≤ 50) — Master defeated'
- [x] **PC.5** · After an Attack while PC is Active, PC is deactivated at the end of the Combat Process · *Pressed* · Same Attack: breakdown 'base:str 125; attack+ 36.8 (crit); atkUp 100 (Presence Concealment); dmgUp 35; zonPenalty −24' = 356; presenceConcealment gone at the Process's end
- [x] **PC.6** · Moving into an enemy Servant's Range (or Detect), a 40% chance of being discovered · *Pressed* · Round 6: Player1 used Presence Concealment (no Espionage): Player2's canvas no longer drew his token; concealmentProfile on Player2's board {rank C, evade 3, discover 40, cooldown 1◈} · Round 8, concealed: Player1 dragged him (6,6) → (8,7), past Arturia beside her Master (9,7): accepted; his discoverBudget recorded one attempt by Arturia at the profile's 40%, failed silently, PC held
- [x] **PC.7** · Active Skills targeting or affecting enemy Units cannot be used unless stated · *Pressed* · Round 8, concealed: Player1 switched Doppelganger on and clicked Arturia: the session said "✓ Legal" and Use refused "Doppelganger cannot be used: Presence Concealment forbids this while concealed." (Surprise pc7-preview-called-enemy-legal, fixed); after the fix the same session outlined Arturia and the Blue Masters red, his allies blue, and right-click cancelled
- [x] **PC.7.x** · …Attack Skills and Spells that deal damage are not included · *Pressed* · concealed, his Normal Attacks and NP on enemies went ahead (Rounds 3, 6, 7): an Attack is no Skill PC.7 bars
- [x] **PC.8.nb** · PC's effects are neither buff nor debuff · *Observed* · his live presenceConcealment instance: unremovable true; definition polarity status, valence neither
- [x] **PC.8.unrem** · …and are Unremovable · *Observed* · his live presenceConcealment instance: unremovable true; definition polarity status, valence neither
- [x] **PC.cd** · Cooldown 1◈ after PC is deactivated · *Pressed* · Same Attack, Espionage still standing: PC's Cooldown 3 = 1◈, C's, not A's 2◈ (reading 4)

## Zhōng Guó Quán Fǎ — Rank EX *(Passive)*

- [x] **ZG.crit** · Crit Chance +15% · *Observed* · same read: 'Zhōng Guó Quán Fǎ:15' in his Crit Chance
- [x] **ZG.np** · Whenever he deals damage with a Normal Attack, his NP Cooldown −1 Turn at the end of the Combat Process · *Pressed* · Same Attack (dealt 356) at ◈ 3: his NP Cooldown 10 → 9 at the Process's end
- [x] **ZG.np.big** · …−2 Turns if ◈ is greater than 4 · *Pressed* · second War on scene 'Yan Qing ◈8' (Holy Grail War, turnsPerRound 8): Player1's Normal Attack on Medea dealt 133; his NP Cooldown 10 → 8 at the Process's end

## Yan Qing Fist — Rank EX *(Active)*

- [x] **YF.when** · Used during his Turn · *Pressed* · Player1, his Turn (Round 1, tick 1): card 'Yan Qing Fist EX — Crit Up, Dmg Up (Lawful), Dmg Up (Evil)'; Crit Up 60 expiry 2 (⅓◈), Dmg Up (Lawful) 30 and Dmg Up (Evil) 30 expiry 4 (1◈); Cooldown 12 (4◈)
- [x] **YF.crit** · Applies Crit Up for ⅓◈, Crit Chance +60% · *Pressed* · Player1, his Turn (Round 1, tick 1): card 'Yan Qing Fist EX — Crit Up, Dmg Up (Lawful), Dmg Up (Evil)'; Crit Up 60 expiry 2 (⅓◈), Dmg Up (Lawful) 30 and Dmg Up (Evil) 30 expiry 4 (1◈); Cooldown 12 (4◈)
- [x] **YF.lawful** · Applies Dmg Up (Lawful) for 1◈, all damage dealt to Units with the 'Lawful' Alignment +30% (printed *"30\."*, reading 1) · *Pressed* · Player1, his Turn (Round 1, tick 1): card 'Yan Qing Fist EX — Crit Up, Dmg Up (Lawful), Dmg Up (Evil)'; Crit Up 60 expiry 2 (⅓◈), Dmg Up (Lawful) 30 and Dmg Up (Evil) 30 expiry 4 (1◈); Cooldown 12 (4◈) · Round 6, concealed, Player1's Normal Attack on Arturia (Lawful Good) with the Fist's buffs up (dice staged high so Arturia's Instinct failed, then restored): breakdown 'base:str 125; attack− −50; dmgUp 30 (Dmg Up (Lawful)); atkUp 100 (PC)' = 172; Ruffian offered and declined; PC gone at the Process's end, Cooldown 3 (1◈); NP Cooldown 22 → 21 (ZG.np again)
- [x] **YF.evil** · Applies Dmg Up (Evil) for 1◈, all damage dealt to Units with the 'Evil' Alignment +30% · *Pressed* · Player1, his Turn (Round 1, tick 1): card 'Yan Qing Fist EX — Crit Up, Dmg Up (Lawful), Dmg Up (Evil)'; Crit Up 60 expiry 2 (⅓◈), Dmg Up (Lawful) 30 and Dmg Up (Evil) 30 expiry 4 (1◈); Cooldown 12 (4◈) · same NP: Asterios (Chaotic Evil) took 'dmgUp 30' from Dmg Up (Evil), on a Noble Phantasm; Dmg Up (Lawful) did not apply
- [x] **YF.cd** · Cooldown 4◈ · *Pressed* · Player1, his Turn (Round 1, tick 1): card 'Yan Qing Fist EX — Crit Up, Dmg Up (Lawful), Dmg Up (Evil)'; Crit Up 60 expiry 2 (⅓◈), Dmg Up (Lawful) 30 and Dmg Up (Evil) 30 expiry 4 (1◈); Cooldown 12 (4◈)

## Ruffian — Rank A *(Passive 1 + Passive 2)*

- [x] **RF.p1** · *(Passive 1)* Crit Damage dealt +15% · *Observed* · his first concealed Attack (Round 3): 'attack+ 36.8' = the crit's 5d10 32 × 1.15, Ruffian's Crit Damage +15%
- [x] **RF.p2** · *(Passive 2)* Whenever he deals damage with an Attack, he may spend X Agility to raise it · *Pressed* · Same Attack, after EMIYA's reaction: Player1's dialog 'Ruffian — Yan Qing may spend up to 20 × Agility …' offering 1..20 (no cap); Player1 picked 7 and confirmed; Agility 20 → 13; 'dmgUp 35' in the breakdown; card 'Ruffian — Assassin spends 7 × Agility: +35% damage dealt this Combat Process.' · that Attack: Player1's dialog now 'Yan Qing may spend up to 13 × Agility for +5% damage dealt this Combat Process, per point spent' (fixed live, Surprise ruffian-prompt-printed-placeholder); Player1 confirmed with none picked: Agility unchanged
- [x] **RF.p2.cap** · …any amount up to his current Agility; the sheet's *"(maximum 5 Agility?)"* is overruled (reading 2) · *Pressed* · Same Attack, after EMIYA's reaction: Player1's dialog 'Ruffian — Yan Qing may spend up to 20 × Agility …' offering 1..20 (no cap); Player1 picked 7 and confirmed; Agility 20 → 13; 'dmgUp 35' in the breakdown; card 'Ruffian — Assassin spends 7 × Agility: +35% damage dealt this Combat Process.'
- [x] **RF.p2.when** · …asked after the DU's reaction, before damage; nothing paid on an Evade · *Pressed* · Same Attack, after EMIYA's reaction: Player1's dialog 'Ruffian — Yan Qing may spend up to 20 × Agility …' offering 1..20 (no cap); Player1 picked 7 and confirmed; Agility 20 → 13; 'dmgUp 35' in the breakdown; card 'Ruffian — Assassin spends 7 × Agility: +35% damage dealt this Combat Process.'
- [x] **RF.p2.dmg** · …+5% damage dealt per point spent · *Pressed* · Same Attack, after EMIYA's reaction: Player1's dialog 'Ruffian — Yan Qing may spend up to 20 × Agility …' offering 1..20 (no cap); Player1 picked 7 and confirmed; Agility 20 → 13; 'dmgUp 35' in the breakdown; card 'Ruffian — Assassin spends 7 × Agility: +35% damage dealt this Combat Process.'
- [x] **RF.p2.np** · …not with a Noble Phantasm · *Pressed* · same NP: no Ruffian dialog on Player1's screen; Agility unchanged by it

## Espionage — Rank A *(Active)*

- [x] **ES.when** · Used during his Turn · *Pressed* · Player1, Round 2 his Turn (tick 5): card 'Espionage A — 2 effect(s) applied'; Crit Up 40 and 'espionage' expiry 8 (1◈); Cooldown 12 (4◈)
- [x] **ES.crit** · Applies Crit Up for 1◈, Crit Chance +40% · *Pressed* · Player1, Round 2 his Turn (tick 5): card 'Espionage A — 2 effect(s) applied'; Crit Up 40 and 'espionage' expiry 8 (1◈); Cooldown 12 (4◈)
- [x] **ES.buff** · Applies the 'Espionage' buff for 1◈: his Presence Concealment Rank rises from C to A · *Pressed* · Player1, Round 2 his Turn (tick 5): card 'Espionage A — 2 effect(s) applied'; Crit Up 40 and 'espionage' expiry 8 (1◈); Cooldown 12 (4◈)
- [x] **ES.pc.evade** · …at A, the DU's Evade Roll +4 · *Observed* · live board, PC Active under Espionage: concealmentProfile {rank A, evade 4, discover 10, cooldown 1◈}; discoverChance 10; abilityRankShifts [{ability: presenceConcealment, to: A, source: espionage}] (reading 4: PC switched on within the buff reads A)
- [x] **ES.pc.discover** · …at A, a 10% chance of being discovered · *Observed* · live board, PC Active under Espionage: concealmentProfile {rank A, evade 4, discover 10, cooldown 1◈}; discoverChance 10; abilityRankShifts [{ability: presenceConcealment, to: A, source: espionage}] (reading 4: PC switched on within the buff reads A)
- [x] **ES.excl** · Cannot be used while Doppelganger is Active · *Pressed* · Player1 asked for Espionage and Skillful Star while disguised: both refused 'abilityLocked'; Presence Concealment used (effect applied); his Normal Attack on EMIYA hit for 281
- [x] **ES.cd** · Cooldown 4◈ · *Pressed* · Player1, Round 2 his Turn (tick 5): card 'Espionage A — 2 effect(s) applied'; Crit Up 40 and 'espionage' expiry 8 (1◈); Cooldown 12 (4◈)

## Doppelganger — Rank B+ *(Active)*

- [x] **DP.when** · Used during his Turn · *Pressed* · Player1, Round 4 his Turn: switched Doppelganger on from the bar; a targeting session opened ('Doppelganger: choose a target'); Player1 clicked EMIYA's token, the dialog listed 'Archer', Player1 pressed Use. Disguise params {as: EMIYA, name: 'Archer', img: classes/archer.webp, disposition −1}; the activation card whispered to the GMs and Player1 only. (Size and kinds: arena test 'offers any Unit … never himself or Bašmu'.)
- [x] **DP.look** · He disguises himself as any other character (figurine), Masters and Servants included: any Unit on his War's board, Civilians and summons too (reading 10) · *Pressed* · Player1, Round 4 his Turn: switched Doppelganger on from the bar; a targeting session opened ('Doppelganger: choose a target'); Player1 clicked EMIYA's token, the dialog listed 'Archer', Player1 pressed Use. Disguise params {as: EMIYA, name: 'Archer', img: classes/archer.webp, disposition −1}; the activation card whispered to the GMs and Player1 only. (Size and kinds: arena test 'offers any Unit … never himself or Bašmu'.) · the same pick took an ally's look: Player1 clicked Medea; params {as: Medea, name: 'Caster', img: classes/caster.webp} · Round 9, concealed (reading 15): Player1 took Arturia's look ('Saber'), PC kept
- [x] **DP.size** · …only a Unit of his own size (reading 10) · *Observed* · Round 9, a staged Bašmu (summon, 3x3): Player1's Doppelganger pick drew its 3x3 in the illegal red, reason 'No legal targets: Bašmu is not the caster's size.'; clicking it took nothing; Arturia (1 panel) offered 'Legal'
- [x] **DP.stats** · …appearance only: his Parameters and Stats stay his · *Pressed* · Player2's canvas: his token drawn as 'Archer' with the archer face, beside EMIYA's own; Player2's tracker listed him as 'Archer'; Player1 (owner) still saw 'Yan Qing'. His next attack card read 'Archer ⚔ Archer', BA(STR) 125 his own
- [x] **DP.lock** · While Active, Skills and Noble Phantasms cannot be used, except Presence Concealment · *Pressed* · Player1 asked for Espionage and Skillful Star while disguised: both refused 'abilityLocked'; Presence Concealment used (effect applied); his Normal Attack on EMIYA hit for 281
- [x] **DP.end.manual** · He can deactivate it at any time · *Pressed* · Player1 switched Doppelganger off from the bar after that Process: endedBy manual; Agility 13 → 16; Atk Up 30 / NP 20, Crit Up 30, Crit DmUp 30 expiry 14 (1◈ from tick 11); disguise gone; Cooldown 11 (4◈−⅓◈); public line "Assassin's disguise drops: it was Archer."; payout card 'Doppelganger B+ — 4 effect(s) applied' · Blue's Turn, Arturia's attack on him open at the react rung: Player1 pressed Doppelganger off: 'Doppelganger cannot be switched off during a Combat Process.'; still Active
- [x] **DP.end.hit** · It ends on its own when one Attack deals him 10% of his Max Health or more · *Pressed* · Round 5, Blue's Turn, disguised as Medea ('Caster'): Player2's Arturia, card 'Saber ⚔ Caster', hit him for 74 (9.9% of 750): disguise held, mode Active. Player2's Asterios, card 'Berserker ⚔ Caster', hit him for 158: disguise gone, endedBy hit, Cooldown 11 (4◈−⅓◈), no rewards (Agility 16 unchanged, no new buffs); public line "Assassin's disguise drops under the blow: it was Caster."; Player2's canvas named him 'Yan Qing' again
- [x] **DP.agi** · Deactivated by hand: restores 3 Agility · *Pressed* · Player1 switched Doppelganger off from the bar after that Process: endedBy manual; Agility 13 → 16; Atk Up 30 / NP 20, Crit Up 30, Crit DmUp 30 expiry 14 (1◈ from tick 11); disguise gone; Cooldown 11 (4◈−⅓◈); public line "Assassin's disguise drops: it was Archer."; payout card 'Doppelganger B+ — 4 effect(s) applied'
- [x] **DP.atk** · …applies Atk Up for 1◈, all damage dealt +30% after calculation · *Pressed* · Player1 switched Doppelganger off from the bar after that Process: endedBy manual; Agility 13 → 16; Atk Up 30 / NP 20, Crit Up 30, Crit DmUp 30 expiry 14 (1◈ from tick 11); disguise gone; Cooldown 11 (4◈−⅓◈); public line "Assassin's disguise drops: it was Archer."; payout card 'Doppelganger B+ — 4 effect(s) applied'
- [x] **DP.atk.np** · …if NP, 20% · *Pressed* · Player1 switched Doppelganger off from the bar after that Process: endedBy manual; Agility 13 → 16; Atk Up 30 / NP 20, Crit Up 30, Crit DmUp 30 expiry 14 (1◈ from tick 11); disguise gone; Cooldown 11 (4◈−⅓◈); public line "Assassin's disguise drops: it was Archer."; payout card 'Doppelganger B+ — 4 effect(s) applied' · same NP: the manual end's Atk Up gave 'atkUp 20', its NP figure
- [x] **DP.crit** · …applies Crit Up for 1◈, Crit Chance +30% · *Pressed* · Player1 switched Doppelganger off from the bar after that Process: endedBy manual; Agility 13 → 16; Atk Up 30 / NP 20, Crit Up 30, Crit DmUp 30 expiry 14 (1◈ from tick 11); disguise gone; Cooldown 11 (4◈−⅓◈); public line "Assassin's disguise drops: it was Archer."; payout card 'Doppelganger B+ — 4 effect(s) applied'
- [x] **DP.critdm** · …applies Crit DmUp for 1◈, Crit Damage dealt +30% after calculation · *Pressed* · Player1 switched Doppelganger off from the bar after that Process: endedBy manual; Agility 13 → 16; Atk Up 30 / NP 20, Crit Up 30, Crit DmUp 30 expiry 14 (1◈ from tick 11); disguise gone; Cooldown 11 (4◈−⅓◈); public line "Assassin's disguise drops: it was Archer."; payout card 'Doppelganger B+ — 4 effect(s) applied'
- [x] **DP.cd** · Cooldown 4◈−⅓◈ after deactivation · *Pressed* · Player1 switched Doppelganger off from the bar after that Process: endedBy manual; Agility 13 → 16; Atk Up 30 / NP 20, Crit Up 30, Crit DmUp 30 expiry 14 (1◈ from tick 11); disguise gone; Cooldown 11 (4◈−⅓◈); public line "Assassin's disguise drops: it was Archer."; payout card 'Doppelganger B+ — 4 effect(s) applied'
- [x] **DP.excl** · Cannot be used while Espionage is Active · *Pressed* · Player1 asked for Doppelganger on Medea while 'espionage' stood: refused 'notHasEffect'

## Skillful Star — Rank A+ *(Active)*

- [x] **SS.when** · Used during his Turn · *Pressed* · Player1, concealed, Skillful Star: card 'Skillful Star A+ — 2 effect(s) applied'; on him Crit Dwn 50 expiry 5 (this Turn) then sCritUpOthers 15 expiry 8 (1◈); Cooldown 8 (3◈-⅓◈). Live critChance: Medea (ally, 2 panels) 65 'sCritUpOthers:15'; Yan Qing 115 'Zhōng Guó Quán Fǎ:15, critUp:60, critUp:40, critDwn:-50' (no S.Crit Up on himself); EMIYA (enemy) 50, none
- [x] **SS.self** · Inflicts Crit Dwn on himself for this Turn, Crit Chance −50% · *Pressed* · Player1, concealed, Skillful Star: card 'Skillful Star A+ — 2 effect(s) applied'; on him Crit Dwn 50 expiry 5 (this Turn) then sCritUpOthers 15 expiry 8 (1◈); Cooldown 8 (3◈-⅓◈). Live critChance: Medea (ally, 2 panels) 65 'sCritUpOthers:15'; Yan Qing 115 'Zhōng Guó Quán Fǎ:15, critUp:60, critUp:40, critDwn:-50' (no S.Crit Up on himself); EMIYA (enemy) 50, none
- [x] **SS.order** · …then the allies' buff · *Pressed* · Player1, concealed, Skillful Star: card 'Skillful Star A+ — 2 effect(s) applied'; on him Crit Dwn 50 expiry 5 (this Turn) then sCritUpOthers 15 expiry 8 (1◈); Cooldown 8 (3◈-⅓◈). Live critChance: Medea (ally, 2 panels) 65 'sCritUpOthers:15'; Yan Qing 115 'Zhōng Guó Quán Fǎ:15, critUp:60, critUp:40, critDwn:-50' (no S.Crit Up on himself); EMIYA (enemy) 50, none
- [x] **SS.ally** · Applies S.Crit Up for 1◈ to every allied Unit within 2 panels of himself, himself excepted · *Pressed* · Player1, concealed, Skillful Star: card 'Skillful Star A+ — 2 effect(s) applied'; on him Crit Dwn 50 expiry 5 (this Turn) then sCritUpOthers 15 expiry 8 (1◈); Cooldown 8 (3◈-⅓◈). Live critChance: Medea (ally, 2 panels) 65 'sCritUpOthers:15'; Yan Qing 115 'Zhōng Guó Quán Fǎ:15, critUp:60, critUp:40, critDwn:-50' (no S.Crit Up on himself); EMIYA (enemy) 50, none
- [x] **SS.ally.mag** · …Crit Chance +15% (the sheet prints *"⅓◈ Turns"*, reading 8) · *Pressed* · Player1, concealed, Skillful Star: card 'Skillful Star A+ — 2 effect(s) applied'; on him Crit Dwn 50 expiry 5 (this Turn) then sCritUpOthers 15 expiry 8 (1◈); Cooldown 8 (3◈-⅓◈). Live critChance: Medea (ally, 2 panels) 65 'sCritUpOthers:15'; Yan Qing 115 'Zhōng Guó Quán Fǎ:15, critUp:60, critUp:40, critDwn:-50' (no S.Crit Up on himself); EMIYA (enemy) 50, none
- [x] **SS.cd** · Cooldown 3◈−⅓◈ · *Pressed* · Player1, concealed, Skillful Star: card 'Skillful Star A+ — 2 effect(s) applied'; on him Crit Dwn 50 expiry 5 (this Turn) then sCritUpOthers 15 expiry 8 (1◈); Cooldown 8 (3◈-⅓◈). Live critChance: Medea (ally, 2 panels) 65 'sCritUpOthers:15'; Yan Qing 115 'Zhōng Guó Quán Fǎ:15, critUp:60, critUp:40, critDwn:-50' (no S.Crit Up on himself); EMIYA (enemy) 50, none

## Shí Miàn Mái Fú: Xíng Rú Wú Yǐng — Rank EX *(Noble Phantasm, Anti-Unit)*

- [x] **NP.kind** · An Anti-Unit Noble Phantasm, BA(STR) · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.range** · One target within his own Range; the sheet states none · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.dmg** · Deals 5x damage · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.roll** · …then two four-sided dice are rolled · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.1** · A 1: Def Dwn (C) on the DU for 1◈, all damage taken +20% · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.1.agi** · …and Agility −1 whenever it receives damage from an Attack · *Pressed* · next Red Turn, Player1's Normal Attack on Medea under that Def Dwn (C) dealt 110: card row 'Agility 12 → 11', log event 'attackReceived' from defDwnC
- [x] **NP.2** · A 2: Crit Dwn on the DU for 1◈, Crit Chance −40% · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.3** · A 3: Crit DmUp on himself for 1◈, Crit Damage dealt +50% · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.dup** · A second die equal to the first is rerolled until it differs · *Pressed* · 'Yan Qing ◈8', Round 4, d4 faces staged 1, 1, 3: Player1's NP on Medea, card 'Shí Miàn Mái Fú — Caster rolls 1, 3.': the second 1 rerolled to 3; Def Dwn (C) 20 on Medea, Crit DmUp 50 on him
- [x] **NP.four** · A 4 on either die applies all three effects instead · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
- [x] **NP.cd** · Cooldown 8◈ · *Pressed* · Round 5, his Turn: Player1 dragged him (6,6) → (5,6), beside Asterios; his Master staged into ZON (refused first: 'the Servant is outside its Master's ZON'); Player1 pressed the NP on Asterios (one target, Range 1); Player2 answered 'nothing'. Card 'Assassin ⚔ Berserker Shí Miàn Mái Fú (EX) 1237', breakdown 'base:str 125; attack+ 40; multiplier 5; atkUp 20 (Doppelganger's NP figure); dmgUp 30'; then 'Shí Miàn Mái Fú — Berserker rolls 2, 4.': Def Dwn (C) 20 and Crit Dwn 40 on Asterios, Crit DmUp 50 on him, each expiry 17 (1◈); NP Cooldown 24 (8◈)
