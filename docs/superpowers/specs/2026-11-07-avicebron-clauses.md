# Avicebron (Caster) — the Clause list

*Avicebron*, built from `char_orig_sheets/by-class/Caster/Avicebron.md`. Started by the user 2026-11-07.

**Audit opened 2026-11-07 (#394).** **Read by hand, line by line.** No generated draft was used, and no older
`Copia de` sheet exists to compare with. The sheet prints no Class line: Caster is its folder and his two Caster
Class Skills, Item Construction and Territory Creation. At the audit's start nothing of his was authored; he is
now built (`avicebron.yml`, six abilities, the Golem, GKM) and every Clause below is ticked live.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own. Each Construction source is its own Clause, since each has its own trigger and its own
count. A summon with a statblock of its own is its own group with **one** statblock Clause: the Golem and GKM.
GKM's six growth lines are each a Clause, since each has its own clock, step and ceiling.

**Struck text is superseded** (Drake, Nursery Rhyme R1): the struck *"(1◈ Turns)"*, *"(3◈ Turns)"* and GKM's
struck *Mechanical* are not rules. The unstruck *"(5◈ Turns)"* is read as a gloss on *"5 full Rounds"* (Q).

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Caster/Avicebron"`, each confirmed by reading
the built piece:

- **Territory Creation B** is `class-territory-creation` at B: `territoryCreationOffence` gives 5d10 and
  `territoryCreationDefence` 3d10+15, both as printed, highest Rank only (`group: territoryCreation`).
- **Item Construction B+** is word for word Nitocris's (45 / 25 / 15, 2 panels, highest Rank only), on
  `class-item-construction-gogh`'s aura (radius 2, `[ally, self]`, `group: itemConstruction`) with his figures and
  sheet text given beside the ref, as U-Olga Marie and Summer Habetrot carry theirs. Medea's file stays her own.
- **The Golems' summon** is Medea's Dragon Tooth Warriors' `summon` phase: `countRoll`, `actsOncePerTurn`,
  `placement`, `leavesWithSummoner` (`engine/summoning.mjs`).
- **"An allied Unit cannot be targeted for an Attack if there is a Golem within 2"** is `TargetabilityModifier`,
  as the Bašmu and the three Dragon Tooth Warriors carry it, read at step 8b of `rules/targeting/resolve.mjs`,
  which names the protector on the refusal (§46.4-O). Radius 2 where theirs is 1.
- **Construction Points** are a resource, as Semiramis's `hgobConstruction` (`value 0, max 100`) and Kazuradrop's
  Eater Tokens. **+1 at the end of every Round** is her `OnEvent roundEnd` + `ResourceDelta`.
  **"+N per Golem"** is `ResourceDelta`'s `count` (Mythos Counters per Unit hit, #362).
  **A gain riding the same roll that made the summons** is her Item Construction's `alsoGrantsResource`.
- **Gather** is `engine/gather.mjs`, Semiramis's. It is written for her alone: the owner is the first ally with
  `hgobConstruction`, the amounts 5 / 4 / 3 are in code and the Region scale is hers. #298 is the open issue
  for an Action a sheet defines, and names Avicebron's Gather.
- **GKM is a platform**, nearest kin Karl's Carolus Patricius Auctoritas (`carolus-patricius-auctoritas.yml`, #351):
  a 2x2 Giant its owner drives (`replacesRiderAction`), whose rider no Attack reaches (`crossLevel`), that walks onto
  occupied panels and knocks their Units back, and whose Normal Attack knocks the DU back. Its Luck is its owner's
  pool (`inherit.luck`; #162, Ch. 27), and its fall sets its rider down (Ch. 27). Its growth is Bridal Chest's
  shape (#345): counters in `resources` read by `MaxDelta`, `BaseAttackModifier` and `MovDelta`.
- **"Can only be used when Construction reaches 50"** is HGoB's `resourceAtLeast` requirement.
- **Moving onto occupied panels and knocking their Units back** is `movesOntoOccupiedPanels` and
  `knockBackOccupants` (`engine/movement-hooks.mjs`), the Bašmu's; **a Normal Attack that knocks the DU back** is
  `Knockback` on a landing (Akhilleus Kosmos, Jabberwock).
- **High-Speed Incantation** is Medea's High-Speed Divine Words' shape: `requirements: notHasEffect silence`,
  `negatedBy: [silence]`, a `cooldown` phase. **"The Cooldown of all Skills by 1◈"** is Olga's
  `{ scope: skills, excludeSelf: true, direction: down }` (#328 ruling 11).
- **"2 Turns if ◈ is greater than 4"** is Yan Qing's `{ gt: ["@turnsPerRound", 4] }`.
- **"At the end of any Turn this Unit Acts"** is the `actedTurnEnd` event.
- **"Defeated and not revived"** is `unitDefeated`, which fires after the revival chain (Appendix E, §E.9).
- **Invuln "for 3 times"** is `charges`, as Guts and `np-dm-up-gao.yml` carry them.

What he needs that nobody has yet, each to be built as a generic piece:

- **A summon's weight on the budget below a half** (#291). `rules/budget.mjs` counts in halves:
  `Math.round(unitWeight(unit) * 2)` makes a 0.2 Golem cost **0**, Babbage's 0.33 and Edison's 0.25 cost 0.5. And
  the `actsOncePerTurn` branch returns `pool: null, free: true` before any pool is read, so a Unit that both acts
  once and counts is charged nothing. Both have to change.
- **A cap on how many of one summon stand on the field** (30). `noAliveSummon` refuses at one; nothing caps at N.
- **Gather as authored content**: who may Gather, for how much, into whose pool. Semiramis's moves onto it.
- **A platform that grows**: Max and current Health, Agility and MOV, Base Attack, and its Normal Attack's area,
  each on its own Round clock from the Round it was raised, each to a ceiling.
- **A platform's own Turn start**: GKM heals 500 and restores 1 Agility at the start of its Turn.
- **A platform's Normal Attack that is an area** (2x2 within 1 panel, later 3x3) and knocks each DU back.
- **A tally that pays every fifth** (Golems defeated by enemies), keeping the remainder.
- **A summon that refuses while a platform stands** (no Golems while GKM is active).
- **A resource that resets when a platform falls** (Construction to 0).

**139 Clauses** across 7 Abilities, the statblock, the Golem and GKM.

## Live audit — 2026-11-08, all 139 ticked

Pressed or observed live on the Gilgamesh Audit board (`fgt2026`, cloud session), from tick 80 to Round 43:

- **75 Pressed** as Player1 through the bar, the targeting preview and the windows.
- **16 Pressed (engine)**: what the engine fires and no button reaches, such as a boundary, a defeat or a revival.
- **48 Observed**, each with a differential.

None is Traced or Untouched.

Defects found live, each fixed and its fix pressed again:

- **Gather:**
  - Gather as Player1 wrote the War from the player's client. It now goes through the GM by socket, with a card.
  - A full pool still offered Gather lit. It is now greyed, with the reason as its tooltip.
- **Cards:**
  - A Round's end said nothing of the pools its handlers moved; it now gives before → after and whose rule.
  - A Round's start had no card.
  - Territory Creation's dice were not on the card.
  - The Turn card printed GKM's true NP name.
  - Numerology's Luck line read GKM's own Luck, not the owner's pool it shares.
- **GKM's content:**
  - Light of Wisdom's `@turnsPerRound` predicate threw from every board snapshot. It is now `defer`.
  - GKM's Turn-start heal was dropped at collection. It is now `defer`.
- **GKM's engine:**
  - Dragging GKM's own token billed nobody. Its rider pays now.
  - Its aura measured from its anchor and did not re-sync on a move. It now measures footprint to footprint and
    re-syncs on every move.
  - Its Normal Attack aimed with its rider's one-panel shape. It now aims with its own 2x2.
  - A sync racing its teardown left Light of Wisdom on a Unit after GKM was gone. A write heard during a sync now
    runs one more.
- **GKM's fall (GK.reset):** Construction stayed at 50.
  - The platform's actor was deleted before its rule ran.
  - The board read off the canvas had lost its rider mid-teardown.
  - `finalDefeat` now fires on the Unit and the board as they stood. That board drops the Units that left with the
    fall: Fig Tree had healed the departed Golems and GKM by raw id.
  - The lines go on a card of their own: *"As a Unit falls"*.
- **Fig Tree:**
  - It fired again at a second fall. Its `self:resource:` predicate named an option no reader builds and was never
    false. *Once* is now a `whenValue` gate on each action.
  - Its heal was said twice on the card.

**Ruled after the press (reading 30):** his bar offered *Jump Off* from GKM's deck. He may not leave it. GKM now
authors `lockAboard: [owner]`; the slot is gone from his bar (GK.nojump).

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields. `Construction Points: 0/50` is
  not one of them: it states the pool and its maximum (`SB.cp`).
- *"(Avicebron)"* before every Ability's name: the bearer's label.
- *"Avicebron has incredibly low combat abilities. His main form of combat is by creating Golems and having them
  fight."*: flavour. The Normal Attack cut is the rule (`SB.na.cut`).
- *"The number summoned is dependant on the situation-"*, *"A Golem's Stats are as follows-"*, *"There are several
  ways to gain Construction Points-"*, *"GKM has the following Stats-"*, *"the following effect-"*: headings.
- The struck *"(1◈ Turns)"*, *"(3◈ Turns)"* and *Mechanical* on GKM: superseded.
- `Items held:` holds nothing.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables and beat the sheet (§46.6): END E 500, BA(STR) 50 at
STR E and BA(MAG) 200 at MAG A all agree with what is printed · a Caster attacks with MAG unless the sheet says
otherwise (Medea) · *"within a N panel area of himself"* includes himself unless the sheet says *"except"* (#132) ·
*"all allied Units"* include the user unless the sheet says *"other"* (#204) · *"NP Cooldown"* naming no NP reaches
every NP (#197 reading 6) · *"Skill Cooldown"* reaches every Skill, Class Skills included, and no NP (Summer
Habetrot) · an effect with no NP figure applies its full value against an NP (#204 reading 5) · two different Atk
Ups stack (#230 reading 4) · durations count from the Turn after the Turn of use (#187 reading 5) · a platform's
*"Luck: Shared with"* is one pool with its owner (#162) · struck text is superseded (Drake; Nursery Rhyme R1) · a
summon's panels can be its owner's pick, and it leaves with its summoner only where stated (#193 readings 13, 15;
Ch. 31) · *"Move/Attack once per Turn"* is `actsOncePerTurn`: one Move, one Attack, no Move after the Attack
(§46.4-BK) · a sheet binds only its owner.

## Readings

Round 1 ruled by the user 2026-11-08, as recommended but 4, 7a and 8. Round 2 the same day, as recommended but 28, which the user's *"no golem guard the GAME"* rules as *no Golem guards GKM*. 24 the same day, as recommended: every reading is ruled.

| # | Question | Ruling | Clauses |
|---|---|---|---|
| 1 | GKM prints no NP tag, and Avicebron has no other NP. Is GKM a Noble Phantasm (Master's Health cost, Round gate, NP Seal, NP Cooldown) or an Active gated only by Construction? | An NP: his only one, named as NPs are, Rank EX. Master's Health cost and NP Seal apply; no Cooldown, since Construction is the gate (as HGoB, which states none). | GK.kind |
| 2 | Who drives GKM: Avicebron from on top, as the Quetzalcoatlus is driven, or GKM as a Unit of its own with its own Move and Attack? What does it weigh on the budget? | Avicebron drives, as the Quetzalcoatlus: his Move and his Attack become GKM's. GKM weighs as he does, one Servant. | GK.drive, GK.budget |
| 3 | Does summoning GKM spend the 50 Construction, or do they stay at 50 until GKM falls (*"its Construction is reduced to 0"* after)? | They stay at 50 while GKM stands, and fall to 0 when it falls. | GK.gate, GK.reset |
| 4 | Where are the Golems placed? The sheet says nothing. | **Within his Range.** His pick, one free panel each within his Range (2), footprint to footprint. | GO.place |
| 5 | Item Construction: Golems prints no *"Used during your Turn"* and no *"counts as his Attack"*. | His own Turn, as every Active. It is not his Attack. | GO.when |
| 6 | At the cap of 30, a roll that would pass it summons up to 30. Construction counts the Golems actually created. | Yes to both. | GO.max, GK.cp.golems |
| 7 | The Golem's guard: which Units, against which Attacks? Does a Golem guard other Golems and itself? Does an AoE still catch a guarded Unit, as the Bašmu's guard does today? | **A Golem guards no Golem**, itself included: every other Unit allied to Avicebron within 2 of a Golem, against enemy Attacks, an AoE included, as the Bašmu's guard runs. | GL.guard.* |
| 8 | Do the Golems stay when Avicebron falls? | **They disappear** at his final defeat, after the revival chain (`leavesWithSummoner`); they do not count for Source 4. | GL.leave |
| 9 | Numerology's *"all Golems on the field"*: his own Golems, or any Golem? | His own Golems. | NU.luck, NU.atk |
| 10 | Numerology's *"if NP, 30%"*: no Golem has an NP, nor GKM. A Clause no board reaches. | Authored as printed; no board reaches it, so it is recorded Observed on the element, and the audit says so. | NU.atk.np |
| 11 | GKM counts as a Golem for Numerology, and its Luck is Avicebron's pool: does Numerology then restore 3 to Avicebron's Luck? | Yes: GKM's Luck is his pool, so 3 is restored to it. | NU.gkm |
| 12 | Gather: Avicebron and his Master only. Gather while aboard GKM? A Unit allied to both Semiramis and Avicebron: whose pool? | Refused while his pool is full, the refusal saying *"Construction is full (50/50)"*, which covers aboard GKM. A Unit that may Gather for two pools picks one on the button. | GK.gather.* |
| 13 | Construction past 50 is lost. Do gains still count while GKM stands? | Lost past 50, and gains still count while GKM stands, to no effect. | SB.cp, GK.cp.* |
| 14 | *"Destroyed/defeated by enemy Units"*: by any enemy Attack, Skill or effect; a Golem dismissed, or felled by an ally, does not count. GKM is not a Golem here. | Yes. | GK.cp.felled |
| 15 | GKM's footprint is not printed. | 2x2, its Normal Attack's area and the Quetzalcoatlus's, Giant kin. | GK.sb |
| 16 | *"Avicebron cannot be targeted by Attacks while GKM is active"*: does an AoE that covers his panel hit him? GKM itself? | An AoE does not reach him, as the Quetzalcoatlus's riders are protected against attacks; GKM takes it. | GK.untarget |
| 17 | When Avicebron falls aboard GKM: does GKM stay? Fig Tree's 7x7 is around which panel? | GKM falls with him. The 7x7 is around his last panel, on top of GKM. | FT.area, GK.owner.fall |
| 18 | GKM's growth clocks: the first step at the first Round start after the Round it was raised? *"Every 3 full Rounds"*: Rounds 3, 6, 9 after? The 3x3 at 5? | Every Round start after the Round it was raised; the 3-Round steps at the 3rd, 6th and 9th; the 3x3 at the 5th. | GK.grow.* |
| 19 | *"At the start of its Turn"*: GKM's Turn is its side's Turn (each Turn of its Player in the Round)? | Each Turn of its side's Player. | GK.turn.* |
| 20 | GKM's aura: Avicebron aboard and GKM inside it? *"Reduced by 1 Turn"*: one Turn (a tick), not 1◈. | Both inside. One Turn, a tick. | GK.aura.* |
| 21 | GKM may Move to any panel: past terrain, walls and Units, as the Bašmu? *"Knocked back by 1 panel until the space is free"*: pushed one panel at a time outward until GKM fits? | Any panel, as the Bašmu: terrain and walls still bind its path; Units are pushed one panel at a time, outward from its footprint, until it fits. | GK.move.* |
| 22 | High-Speed Incantation: *"all Skills"* includes his Class Skills and Item Construction: Golems, not itself, not GKM. | As written. | HS.cd.* |
| 23 | Fig Tree: *"allied Units"* include Golems, GKM and Masters. Invuln 3 charges, no duration. *"Can only be used once"* holds across revivals. | As written; a second revival after the first final defeat does not fire it again. | FT.* |
| 24 | The Normal Attack cut of 75%: does it reach GKM's Normal Attacks, if he drives them? | **No.** The swing is GKM's own (BA(STR) 150 to 300); the cut is his own Normal Attack's. | SB.na.cut, GK.na |
| 25 | *"(5◈ Turns)"* beside *"5 full Rounds"* is not struck: a gloss, the Round count rules. | Yes. | GK.grow.range |
| 26 | *"Within Range"* (4): his Range at use? | His Range at the moment of use, a buff included, from his footprint. | GO.place |
| 27 | When do the Golems disappear (8)? | At his final defeat, after the revival chain. They do not count for Source 4. | GL.leave, GK.cp.felled |
| 28 | Does a Golem guard GKM? | **No Golem guards GKM.** | GL.guard.gkm |
| 29 | Golems already standing when GKM is raised? | They stay and act. Numerology reaches them and GKM. | GK.nogolems, NU.gkm |
| 30 | May Avicebron Jump Off GKM's deck? | No: he is not allowed to leave it (the user, 2026-11-08). `lockAboard: [owner]`; his Move drives GKM. | GK.nojump |

## Statblock

- [x] **SB.name** · True Name: Avicebron, Solomon ibn Gabirol · *Observed live 2026-11-08 (Player1's board): Avicebron, Solomon ibn Gabirol*
- [x] **SB.class** · Class: Caster (the sheet's folder and his Class Skills) · *Observed: [caster]*
- [x] **SB.region** · Region: Europe · *Observed: [europe]*
- [x] **SB.align** · Alignment: Lawful Neutral · *Observed: lawful / neutral*
- [x] **SB.param** · STR E, END E, AGI D, MAG A, LUC B · *Observed: STR E, END E, AGI D, MAG A, LUC B*
- [x] **SB.attr** · Attributes: Male, Servant, [Man], Humanoid · *Observed: male, servant, man, humanoid (+ hominidae, magus, spirit by closure)*
- [x] **SB.hp** · Base Health 500 (END E, the table agrees) · *Observed: 500 / 500*
- [x] **SB.mov** · MOV 4 · *Observed: 4*
- [x] **SB.range** · Range 2 panels, 1 target · *Observed: 2, 1 target*
- [x] **SB.ba** · Base Attack STR 50, MAG 200 (the tables agree) · *Observed: STR 50, MAG 200*
- [x] **SB.sus** · Sustainability: 4◈ · *Observed: with his Master's contract lifted, the board's Sustainability 12 Turns (4◈ at ◈ 3); restored*
- [x] **SB.na** · Normal Attacks use Base Attack (MAG) · *Observed: Normal Attack component mag*
- [x] **SB.na.cut** · Total damage dealt by his Normal Attacks is reduced by 75% (Q24) · *Pressed as Player1: his Normal Attack on Nursery Rhyme, stage 15 *"totalDealt ×0.25 (Avicebron)"*, 41 dealt*
- [x] **SB.na.cut.gkm** · …and not GKM's Normal Attacks, which he drives (Q24) · *Pressed: GKM's swing, stage 1 *"mount BA(STR) 160"*, no `totalDealt` on its card*
- [x] **SB.cp** · Construction Points: 0, maximum 50 (Q13) · *Observed: Construction 0/50 on his bar and resources, the gain lost past 50 (GK.cp.max)*
- [x] **SB.items** · Items held: none · *Observed: no Item held*

## Item Construction — Class Skill, Rank B+ *(Passive 1 + 2)*

- [x] **IC.area** · Affects all allied Units within a 2 panel area of him, himself included · *Observed live (applyEffect on the board, base 50%): he inflicts Stun at 95; Nursery Rhyme on him or on a Golem 2 panels off, 5*
- [x] **IC.area.out** · …and no Unit outside it, nor an enemy inside it · *Observed: Kazuradrop, 5 panels off, inflicts at 50 and resists only her own Magic Resistance (25); Nursery Rhyme, an enemy 2 off, gets no resistance (his Stun on her at 95)*
- [x] **IC.1** · Chance of inflicting debuffs +45% · *Observed: Stun 50 → 95 by him, 50 by an ally outside*
- [x] **IC.1.ik** · …+25% for Instakill · *Observed: Instakill 50 → 75*
- [x] **IC.1.death** · …+15% for Death · *Observed: Death 50 → 65*
- [x] **IC.2** · Chance of being inflicted by debuffs −45% · *Observed: Stun on him 50 → 5*
- [x] **IC.2.ik** · …−25% for Instakill · *Observed: Instakill on him 50 → 25*
- [x] **IC.2.death** · …−15% for Death · *Observed: Death on him 50 → 35*
- [x] **IC.stack** · Several instances on one Unit: only the highest Rank takes effect · *Observed: Medea (Item Construction A) summoned beside Golem 2: Nursery Rhyme on the Golem 0 / 25 / 40, hers whole; his B+ neither added nor mixed by tier*

## Item Construction: Golems *(Active)*

- [x] **GO.when** · Used during his Turn, and not his Attack (Q5) · *Pressed live 2026-11-08 as Player1: the bar's slot on his side's Turn (Gilgamesh Audit, tick 80)*
- [x] **GO.home** · In his Home Base: 1d10 Golems · *Pressed: in his base, *"(1d10 → 6)"**
- [x] **GO.away** · Not in his Home Base: 1d6 Golems · *Pressed: off his Home Base, card *"2 summoned (1d6 → 2)"**
- [x] **GO.die** · The die rolled is on the card, and the count equals it · *Pressed: the die on the card, two Golems on the board*
- [x] **GO.place** · Each Golem on a free panel he picks within his Range at use (Q4, Q26) · *Pressed: the owner's pick offered within Range 2; placed at (12,7) and (12,8) from (14,9)*
- [x] **GO.max** · At most 30 Golems on the field (Q6) · *Pressed: 28 standing (26 staged), *"2 summoned (1d10 → 6); 4 over the limit of 30 on the field"*, 30 standing*
- [x] **GO.gkm** · Refused while GKM is active (also GK.nogolems) · *Pressed as Player1 with GKM standing: the slot greyed *"Not while Golem Keter Malkuth stands."*, the press refused with that line*
- [x] **GO.cd** · Cooldown 3◈−⅓◈ · *Pressed: Cooldown 8 ticks, *"2⅔◈"* on the bar at ◈ 3*

## Golem — summon

- [x] **GL.sb** · Health 500, Agility 12, Luck 6, MOV 3, Range 1 panel 1 target, BA(STR) 100, Attributes [Sky] and · *Observed: each Golem 500/500, Agility 12, Luck 6, MOV 3, Range 1, BA(STR) 100, [mechanical, sky, summon], Detect 3, STR Normal Attack*
  Mechanical, Detect 3, Normal Attacks with STR
- [x] **GL.weight** · On the Move/Attack count, one Golem is 0.2 of a Servant: five Golems are one Servant · *Pressed as Player1: a Golem's Move took Servant moves 1 → 1.2 (a part-pip), its Normal Attack Servant attacks 0 → 0.2*
- [x] **GL.weight.edge** · A sixth Golem's Move past a full Servant pool is refused · *Pressed: Servant moves staged at 4/4, the second Golem's Move refused *"Servant moves exhausted (4/4)"*, token unmoved; restored to 1.2*
- [x] **GL.once** · The same Golem may Move once and Attack once per Turn, and not Move after its Attack · *Pressed: Golem 1 moved then attacked Nursery Rhyme (527/600); its bar then *"this unit has already acted this Turn"* on Move and Attack*
- [x] **GL.guard** · An allied Unit within 2 panels of a Golem cannot be targeted for an Attack (Q7) · *Observed live (GM board, Faction 2's Turn): Nursery Rhyme's Normal Attack aimed at Avicebron, Golem 2 at 2 panels: *"No legal targets: Caster is protected by a nearby Golem."**
- [x] **GL.guard.enemy** · …by an enemy: an ally may still aim at it · *Observed: Kazuradrop, his ally, aims at him while he is guarded: reached*
- [x] **GL.guard.name** · The refusal names the Golem · *Observed: the refusal names the Golem (*"A Unit protected by Golem was excluded."*)*
- [x] **GL.guard.out** · Beyond 2 panels, no guard · *Observed: Golem 2 moved to (10,8), 4 panels away: the same aim reaches him*
- [x] **GL.guard.aoe** · …an area Attack included: the guarded Unit is left out of it (Q7) · *Observed: a 3x3 area on his panel from Nursery Rhyme left him out while guarded, and caught him with Golem 2 away*
- [x] **GL.guard.golem** · …but no Golem: a Golem beside another Golem can still be aimed at (Q7) · *Observed: each Golem, 2 from the other, still a legal target for her*
- [x] **GL.guard.gkm** · …nor GKM: GKM beside a Golem can still be aimed at (Q28) · *Observed: GKM beside three Golems holds no guard and is a legal target*
- [x] **GL.leave** · Every Golem disappears at Avicebron's final defeat (Q8, Q27) · *Pressed (engine): his final defeat: *"10 × Golem leave the field with Caster."*; 0 Golems on the board after*
- [x] **GL.leave.revived** · …and none when a revival brings him back (Q27) · *Pressed: the same revival, all 9 Golems stayed*

## Territory Creation — Class Skill, Rank B *(Passive 1 + 2)*

- [x] **TC.1** · In his Home Base, damage dealt by him is +5d10 · *Pressed: the same attack from inside his base, stage 7 *"Territory Creation"* +26 (5d10; the die now printed on the line)*
- [x] **TC.1.np** · …including NP · *Observed (the live pipeline, him in his base): an NP and a Normal Attack each take *"Territory Creation (5d10 = 27)"*; his own NP deals no damage*
- [x] **TC.1.out** · Outside it, nothing · *Pressed as Player1: his Normal Attack on Achilles from outside his base: no Territory Creation line (inside it, +26)*
- [x] **TC.2** · While he is on the field, damage taken by allied Units in their Home Base is further −(3d10+15) · *Observed live: Golem 2 in Faction 1's base, Achilles's Normal Attack: stage 12 *"Territory Creation"* −29, the Golem's negation 3d10+15 (B)*
- [x] **TC.2.np** · …including NP · *Observed (the live pipeline): Achilles's NP on a Golem in its base, *"Territory Creation (3d10+15 = 30)"**
- [x] **TC.2.out** · …and an ally outside its Home Base takes no cut · *Observed: Kazuradrop outside the base held no Territory Creation negation; the Golems and he inside did*
- [x] **TC.2.gone** · …and none once he is off the field · *Observed live: Avicebron down, Drake's Normal Attack on Proto Gil in Faction 1's base: stage 4 Home Base −10%, no Territory Creation stage (differential: TC.2's −29 while he stood)*
- [x] **TC.stack** · Several allied Territory Creations: only the highest Rank takes effect · *Observed: with Kazuradrop (Territory Creation EX) on the field the Golem and he held 3d10+30; her token lifted, 3d10+15. Medea's A beaten by her EX too*

## Numerology — Rank B *(Active)*

- [x] **NU.when** · Used during his Turn · *Pressed live 2026-11-08 as Player1, his side's Turn*
- [x] **NU.luck** · All Golems on the field restore 3 Luck (Q9) · *Pressed: two Golems at Luck 2: *"Golem: Luck 2 → 5"**
- [x] **NU.luck.max** · …up to their maximum · *Pressed: both Golems at 6/6, card *"Golem: Luck 6 (no change)"**
- [x] **NU.order** · Then: the Luck first, the Atk Up after · *Pressed: every Luck line, then every Atk Up line, on one card*
- [x] **NU.atk** · Atk Up on all Golems on the field: all damage dealt +40% (Q9) · *Pressed: Atk Up 40 on both Golems' token actors*
- [x] **NU.atk.np** · …+30% if NP (Q10) · *Observed: NP magnitude 30 on the instance (ruling 10: no Golem has an NP)*
- [x] **NU.dur** · …for 1◈ · *Pressed: expiry tick 83 from tick 80, 1◈ at ◈ 3*
- [x] **NU.gkm** · GKM counts as a Golem for this Skill (Q11) · *Pressed as Player1 with GKM standing: GKM's Atk Up 40/30; *"Golem Keter Malkuth: Luck 7 → 10"*, his own pool (the line fixed live to read it)*
- [x] **NU.cd** · Cooldown 4◈ · *Pressed: Numerology's clock 12 after the use, 4◈ at ◈ 3*

## High-Speed Incantation — Rank B+ *(Active)*

- [x] **HS.when** · Used during his Turn · *Pressed live 2026-11-08 as Player1, his side's Turn (tick 80)*
- [x] **HS.cd** · The Cooldown of all his Skills is reduced by 1◈ (Q22) · *Pressed: card *"Item Construction: Golems: Cooldown 8 → 5; Numerology: Cooldown 12 → 9"**
- [x] **HS.cd.class** · …his Class Skills and Item Construction: Golems included · *Pressed: Item Construction: Golems cut 8 → 5; his Class Skills are passives with no clock*
- [x] **HS.cd.self** · …not itself · *Pressed: High-Speed Incantation itself at 8 after the use, uncut*
- [x] **HS.cd.np** · …not an NP · *Pressed: GKM's staged NP clock 5 left at 5*
- [x] **HS.cp** · Then he gains 5 Construction Points · *Pressed: card *"Construction 1 → 6"**
- [x] **HS.order** · The Cooldowns first, the Construction after · *Pressed: the Cooldown lines first, the Construction line after, on one card*
- [x] **HS.silence.use** · Cannot be used while inflicted with Silence · *Pressed: Silence staged, the slot disabled *"Negated by Silence"*; a press refused with that line, no card, Construction 6 unchanged; pressed with no Silence just before*
- [x] **HS.silence.neg** · …and its effects are negated while inflicted with Silence · *Pressed: under Silence the press applies none of its effects (no Cooldown cut, no Construction)*
- [x] **HS.clock** · Cooldown 3◈−⅓◈ · *Pressed: Cooldown 8 ticks, 3◈−⅓◈ at ◈ 3*

## Fig Tree of Tranquility — Rank EX *(Passive)*

- [x] **FT.when** · Activates by itself when he is defeated · *Pressed (engine): his final defeat aboard GKM: a card *"As a Unit falls"* with Fig Tree's lines*
- [x] **FT.revived** · …and not when a revival brings him back · *Pressed (engine): Guts staged, Achilles's Normal Attack: *"Caster is defeated and revived by Guts, with 135 Health"*; no Invuln on any ally, figTreeSpent 0*
- [x] **FT.area** · All allied Units within a 7x7 area of himself (Q17) · *Pressed (engine): his Master 2 panels from his last panel (on GKM's deck): *"Master of Archer of Faction 1: Invuln"**
- [x] **FT.area.out** · …and no Unit outside it, nor an enemy inside it · *Pressed (engine): Arturia 4 away and Achilles (enemy) 1 away: no Invuln, Health unchanged (588 → 588, 800 → 800)*
- [x] **FT.invuln** · Invuln on each, for 3 times · *Pressed (engine): the Master's Invuln holds 3 uses*
- [x] **FT.heal** · Each restores 20% of its Max Health · *Pressed (engine): *"Master of Archer of Faction 1 regains 50 Health (Fig Tree of Tranquility)"*, 20% of 250; 100 → 150*
- [x] **FT.heal.who** · …only the Units it gave Invuln · *Pressed (engine): only the Master healed; Arturia and Achilles unchanged*
- [x] **FT.once** · Can only be used once (Q23) · *Pressed (engine): revived and defeated again with figTreeSpent 1: only *"Caster is defeated by Rider."*, no Invuln, Health 60 → 60 (live defect fixed: the `self:resource:` predicate no reader builds was never false)*
- [x] **FT.card** · Its lines name each ally and what it gave · *Pressed (engine): *"As a Unit falls — Master of Archer of Faction 1: Invuln; Caster: Fig Tree Spent 0 → 1; Master of Archer of Faction 1 regains 50 Health (Fig Tree of Tranquility)"* (live defects fixed: departed Golems and GKM healed by raw id, the heal said twice)*

## Golem Keter Malkuth: Royal Crown, the Light of Wisdom — Rank EX (Q1)

### Construction Points

- [x] **GK.gate** · Usable only when Construction reaches 50 (Q3) · *Pressed: at 50 the NP slot lit; pressed as Player1, GKM rose; Construction stayed 50 (ruling 3)*
- [x] **GK.gate.refuse** · …refused at 49, with the reason · *Observed: the bar's NP slot disabled, *"Needs 50 Construction; 0 held."**
- [x] **GK.cp.round** · Source 1: +1 at the end of every Round · *Observed live: the Round 27 → 28 boundary, Construction 10 → 11*
- [x] **GK.cp.golems** · Source 2: Item Construction: Golems gives +1 for every 3 Golems created (Q6) · *Pressed: *"6 summoned (1d10 → 6)"*, *"Construction +2 (6 created, 1 per 3)"*, 11 → 13*
- [x] **GK.cp.golems.floor** · …rounded down: 2 Golems give 0 · *Pressed: card *"Construction +0 (2 created, 1 per 3)"**
- [x] **GK.cp.numer** · Source 3: Numerology gives +1 for every 2 Golems on the field · *Pressed: card *"Construction 0 → 1"* with two Golems*
- [x] **GK.cp.numer.max** · …at most +10 · *Pressed: 22 Golems (12 staged): Construction 13 → 23, +10 not 11*
- [x] **GK.cp.numer.gkm** · …GKM counted among them · *Pressed: 9 Golems and GKM, Construction 30 → 35*
- [x] **GK.cp.felled** · Source 4: every 5 Golems destroyed or defeated by enemy Units give +1 (Q14) · *Pressed (engine): Felled staged at 4, Achilles's Normal Attack fell a Golem: *"5 of them felled by the enemy: Construction +1."*, 40 → 41, Felled 4 → 0*
- [x] **GK.cp.felled.carry** · …the count of a part five carries to the next · *Pressed: the count held across fells (4 carried, the fifth paid and reset); a Golem hit for 0 counted none*
- [x] **GK.cp.max** · Past 50, the gain is lost (Q13) · *Pressed: staged 49, his Master's Gather *"Construction 49 → 50"*; the next Round's +1 at 50 wrote nothing and no card claimed it*

### Gather

- [x] **GK.gather.who** · During his Turn, Avicebron and/or his Master can perform Gather (Q12) · *Pressed as Player1: Avicebron's Gather 6 → 8 and his Master's 8 → 10, card *"Master of Archer of Faction 1 Gathers: Caster's Construction 8 → 10."**
- [x] **GK.gather.only** · …and no other Unit, ally or not · *Observed: Gilgamesh, an ally, has no Gather on his bar (no Semiramis on the board)*
- [x] **GK.gather.amt** · +2 Construction per Unit that performs it · *Pressed: +2 each*
- [x] **GK.gather.both** · …so both on one Turn give +4 · *Pressed: both on one Turn, 6 → 10*
- [x] **GK.gather.move** · Gather counts as that Unit's Move for the Turn · *Pressed: after it his Move slot reads *"this unit gathered and cannot move again"**
- [x] **GK.gather.attack** · That Unit cannot Attack on the same Turn · *Pressed: his Attack slot *"this unit has already attacked this turn"*, GKM's too*
- [x] **GK.gather.once** · …and cannot Gather twice in one Turn · *Pressed: a second Gather refused *"this unit has already gathered this turn"**

### The use

- [x] **GK.kind** · Its kind and its costs (Q1) · *Pressed: his Master paid 250 → 175 (the NP's Master cost); the NP spent his Attack for the Turn*
- [x] **GK.place** · Summoned directly next to Avicebron · *Pressed: raised at (14..15, 10..11), beside his panel (14,9), not on it*
- [x] **GK.board** · Avicebron then moves onto the top of GKM · *Pressed: he moved onto its deck at (14,10), level 20, `platformId` GKM*
- [x] **GK.untarget** · Avicebron cannot be targeted by Attacks while GKM is active (Q16) · *Observed (Nursery Rhyme's targeting): an aim at his panel lands on GKM; a 3x3 there catches the Golems and GKM, never him*
- [x] **GK.drive** · Who Moves and Attacks with GKM (Q2) · *Pressed as Player1: his Move carried GKM a panel; dragging GKM moved him with it*
- [x] **GK.budget** · …and what it spends (Q2) · *Pressed: a drag of GKM billed him one Servant move (0 → 1); GKM's swing spent his Servant attack*

### GKM — platform

- [x] **GK.sb** · Health 2000, Max 4000; Agility 6, Max 12; MOV 3, Max 6; Range 1 panel, a 2x2 area (3x3); BA(STR) · *Observed: 2000/2000, Agility 6, MOV 3, Range 1, a 2x2 hitting every Unit, BA(STR) 150, Giant (no Mechanical), Detect 5, a 2x2 footprint*
  150, Max 300; Attribute Giant; Detect 5; Normal Attacks with STR (Q15)
- [x] **GK.luck** · Luck shared with Avicebron: one pool · *Observed: its Luck read 12, his own pool's*
- [x] **GK.move.any** · GKM can Move to any panel (Q21) · *Pressed: GKM moved onto his Master's panel*
- [x] **GK.move.knock** · Moving onto occupied panels knocks every Unit on them back 1 panel, until GKM can stand there · *Pressed: his Master knocked back (14,12) → (13,12) until GKM stood there*
- [x] **GK.na.area** · Its Normal Attack hits a 2x2 area within 1 panel · *Pressed as Player1: the Attack slot's targeting *"1 target(s) · 4 panel(s)"*, the 2x2*
- [x] **GK.na.knock** · Its Normal Attacks knock each DU back 1 panel · *Pressed: Nursery Rhyme knocked back (16,13) → (17,13)*

### Growth (Q18)

- [x] **GK.grow.hp** · At the start of every Round since it was summoned, Max and current Health +200 · *Observed live: Max and current Health +200 at that Round start (2000 → 2175 net of a Nameless Forest token's −25)*
- [x] **GK.grow.hp.max** · …to a maximum of 4000 · *Pressed: Health steps staged at 9: Max 3775 → 3975 (4000 less a forest token's 25), and at 10 the next Round start added none*
- [x] **GK.grow.agi** · Every 3 full Rounds, Max and current Agility +2 · *Pressed: the cycle staged due: Max Agility 10 → 12 and current 5 → 7, *"Agility 5 → 7"**
- [x] **GK.grow.agi.max** · …to a maximum of 12 · *Pressed: at 3 steps the next Round start raised none (12)*
- [x] **GK.grow.mov** · Every 3 full Rounds, MOV +1 · *Pressed: MOV 5 → 6 on the same step*
- [x] **GK.grow.mov.max** · …to a maximum of 6 · *Pressed: 6 held at the next Round start*
- [x] **GK.grow.range** · At the start of the Round 5 full Rounds after, its area grows from 2x2 to 3x3 (Q25) · *Pressed: Rounds Raised staged at 4, the fifth Round start: *"Golem Keter Malkuth: Royal Crown Grown"*, its Normal Attack area 2x2 → 3x3*
- [x] **GK.grow.ba** · At the start of every Round, BA(STR) +10 · *Observed live: the first Round start after its rise, BA(STR) 150 → 160*
- [x] **GK.grow.ba.6** · …+20 instead from the sixth activation on · *Pressed: +20 from the sixth step, 280 → 300*
- [x] **GK.grow.ba.max** · …to a maximum of 300 · *Pressed: 300 held at the next Round start*

### Its Turn (Q19)

- [x] **GK.turn.hp** · At the start of its Turn, GKM restores 500 Health · *Pressed (engine) at Faction 1's Turn start: *"Start of the Turn: Golem Keter Malkuth regains 500 Health"*, 1000 → 1500*
- [x] **GK.turn.agi** · …and 1 Agility · *Pressed: same card *"Golem Keter Malkuth: Agility 3 → 4"**

### Aura (Q20)

- [x] **GK.aura** · All allied Units within 2 panels of GKM gain the effect · *Observed: Light of Wisdom granted to allies within 2 of GKM's footprint (his Master, Avicebron, the Golems); Gilgamesh moved to 2: *"Golem Keter Malkuth's Light of Wisdom reaches Archer."**
- [x] **GK.aura.out** · …and no Unit outside it, nor an enemy inside it · *Observed: Gilgamesh at 4 *"Light of Wisdom no longer reaches Archer."*; Nursery Rhyme, an enemy adjacent, held none*
- [x] **GK.aura.end** · At the end of that Unit's own Turn, its NP Cooldown is reduced by 1 Turn · *Pressed at Faction 1's Turn end: *"Archer's Enuma Elish: Cooldown −1 Turn(s) (Light of Wisdom)"* and his NP's, 6 → 4 and 5 → 3 with the Turn's own tick*
- [x] **GK.aura.acts** · …and at the end of any Turn it Acts · *Pressed (engine): Gilgamesh holding Light of Wisdom, staged as having Acted on the GM's Turn: Enuma Elish 5 → 3 (tick and aura), Avicebron's NP 5 → 4 (tick only); card *"Archer's NP-P3XX5: Cooldown −1 Turn(s) (Light of Wisdom)"**
- [x] **GK.aura.4** · …by 2 Turns if ◈ is greater than 4 · *Pressed: the War's ◈ staged at 5: *"Cooldown −2 Turn(s) (Light of Wisdom)"* on both; restored to 3*
- [x] **GK.aura.4.not** · …and by 1 at ◈ of 4 · *Pressed: at ◈ 3, one Turn*

### While it stands, and after

- [x] **GK.nogolems** · Avicebron cannot create Golems while GKM is active · *Pressed: as GO.gkm*
- [x] **GK.golems.stay** · …and the Golems already standing stay and act (Q29) · *Observed: the 10 Golems standing when GKM rose stayed on the board and kept their Turns*
- [x] **GK.fall.place** · When GKM is defeated, Avicebron returns to a panel within the area GKM last stood on · *Pressed (engine): GKM defeated by Achilles: *"Golem Keter Malkuth ends. It was destroyed."*, Avicebron set down at (14,12) on the ground, inside its last footprint*
- [x] **GK.reset** · …and his Construction is reduced to 0 (Q3) · *Pressed (engine): GKM raised by Player1, then defeated by Achilles: *"As a Unit falls — Caster: Construction 50 → 0"* (two live defects fixed: the platform's actor was gone before its rule ran, and the board read off the canvas had lost its owner)*
- [x] **GK.rebuild** · He can build GKM again from scratch · *Pressed as Player1: at 50 again the NP raised a fresh GKM: 2000, BA 150, every counter at 0, his Master paying again 175 → 100*
- [x] **GK.owner.fall** · GKM when Avicebron falls aboard it (Q17) · *Pressed (engine): Avicebron defeated aboard GKM: *"Golem Keter Malkuth ends. Its owner was defeated."*; no platform left on the board*
- [x] **GK.nojump** · He may not leave GKM: no Jump Off from its deck (reading 30) · *Pressed live 2026-11-08 as Player1: aboard GKM on its edge panel (14,16) with his Move unspent, the bar shows attack, move, gather, facing and his abilities, and no Jump; `canUnboard` → `lockedAboard`*
- [x] **GK.numer** · For Numerology, GKM counts as a Golem (NU.gkm) · *Pressed: as NU.gkm*
- [x] **GK.notgolem** · …and for nothing else: not the cap of 30, the weight, the guard nor Source 4 · *Observed: GKM drew no Golem's guard, carries no felled tally, weighs nothing of its own on the budget (its drag billed him, 0 → 1), and the cap counts Golems by content only*
