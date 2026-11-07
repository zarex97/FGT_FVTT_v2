# Avicebron (Caster) — the Clause list

*Avicebron*, built from `char_orig_sheets/by-class/Caster/Avicebron.md`. Started by the user 2026-11-07.

**Audit opened 2026-11-07 (#394).** **Read by hand, line by line.** No generated draft was used, and no older
`Copia de` sheet exists to compare with. The sheet prints no Class line: Caster is its folder and his two Caster
Class Skills, Item Construction and Territory Creation. **Nothing of his is authored yet**: no `avicebron.yml`,
no ability, no Golem, no GKM.

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
- **Item Construction B+** is word for word Nitocris's (45 / 25 / 15, 2 panels, highest Rank only). The shape is
  `class-item-construction-gogh` (an `Aura`, radius 2, `[ally, self]`, `group: itemConstruction`, six
  `ApplicationChance` rows), whose figures are written in. The figures become parameters, so Van Gogh, Nitocris
  and Avicebron are one template, and Medea's file stays her own (her Death figure is 10, not half of 25).
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
- **GKM is a platform**, nearest kin the Quetzalcoatlus (`packs/_source/platforms/quetzalcoatlus.yml`): a giant
  summon its owner boards (`boarding`, `sharesPanel`), drives (`replacesRiderAction`), whose passengers cannot
  be targeted (`crossLevel.protectedAgainst: attacks`), whose Luck is its owner's pool (`inherit.luck`; one pool,
  #162, Ch. 27), and whose fall sets its passengers down (Ch. 27).
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

**134 Clauses** across 7 Abilities, the statblock, the Golem and GKM.

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

## Readings to settle

To be grilled. Each names the reading the build would take without a ruling.

| # | Question | Default reading | Clauses |
|---|---|---|---|
| 1 | GKM prints no NP tag, and Avicebron has no other NP. Is GKM a Noble Phantasm (Master's Health cost, Round gate, NP Seal, NP Cooldown) or an Active gated only by Construction? | An NP: his only one, named as NPs are, Rank EX. Master's Health cost and NP Seal apply; no Cooldown, since Construction is the gate (as HGoB, which states none). | GK.kind |
| 2 | Who drives GKM: Avicebron from on top, as the Quetzalcoatlus is driven, or GKM as a Unit of its own with its own Move and Attack? What does it weigh on the budget? | Avicebron drives, as the Quetzalcoatlus: his Move and his Attack become GKM's. GKM weighs as he does, one Servant. | GK.drive, GK.budget |
| 3 | Does summoning GKM spend the 50 Construction, or do they stay at 50 until GKM falls (*"its Construction is reduced to 0"* after)? | They stay at 50 while GKM stands, and fall to 0 when it falls. | GK.gate, GK.reset |
| 4 | Where are the Golems placed? The sheet says nothing. | His pick, one free panel each within a 5x5 around him, as Medea's Warriors. | GO.place |
| 5 | Item Construction: Golems prints no *"Used during your Turn"* and no *"counts as his Attack"*. | His own Turn, as every Active. It is not his Attack. | GO.when |
| 6 | At the cap of 30, a roll that would pass it summons up to 30. Construction counts the Golems actually created. | Yes to both. | GO.max, GK.cp.golems |
| 7 | The Golem's guard: which Units, against which Attacks? Does a Golem guard other Golems and itself? Does an AoE still catch a guarded Unit, as the Bašmu's guard does today? | Every Unit allied to Avicebron within 2 of a Golem, other Golems included and not the Golem itself, against enemy Attacks, an AoE included, as the Bašmu's guard runs. | GL.guard.* |
| 8 | Do the Golems stay when Avicebron falls? | They stay: the sheet does not say they leave. | GL.leave |
| 9 | Numerology's *"all Golems on the field"*: his own Golems, or any Golem? | His own Golems. | NU.luck, NU.atk |
| 10 | Numerology's *"if NP, 30%"*: no Golem has an NP, nor GKM. A Clause no board reaches. | Authored as printed; no board reaches it, so it is recorded Observed on the element, and the audit says so. | NU.atk.np |
| 11 | GKM counts as a Golem for Numerology, and its Luck is Avicebron's pool: does Numerology then restore 3 to Avicebron's Luck? | Yes: GKM's Luck is his pool, so 3 is restored to it. | NU.gkm |
| 12 | Gather: Avicebron and his Master only. Gather while aboard GKM? A Unit allied to both Semiramis and Avicebron: whose pool? | Only those two. Aboard GKM he may Gather, his Move being spent. An ally of both picks the pool on the button. | GK.gather.* |
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
| 24 | The Normal Attack cut of 75%: does it reach GKM's Normal Attacks, if he drives them? | Yes: the cut is on his Normal Attacks, and GKM's are his while he drives. | SB.na.cut, GK.na |
| 25 | *"(5◈ Turns)"* beside *"5 full Rounds"* is not struck: a gloss, the Round count rules. | Yes. | GK.grow.range |

## Statblock

- [ ] **SB.name** · True Name: Avicebron, Solomon ibn Gabirol
- [ ] **SB.class** · Class: Caster (the sheet's folder and his Class Skills)
- [ ] **SB.region** · Region: Europe
- [ ] **SB.align** · Alignment: Lawful Neutral
- [ ] **SB.param** · STR E, END E, AGI D, MAG A, LUC B
- [ ] **SB.attr** · Attributes: Male, Servant, [Man], Humanoid
- [ ] **SB.hp** · Base Health 500 (END E, the table agrees)
- [ ] **SB.mov** · MOV 4
- [ ] **SB.range** · Range 2 panels, 1 target
- [ ] **SB.ba** · Base Attack STR 50, MAG 200 (the tables agree)
- [ ] **SB.sus** · Sustainability: 4◈
- [ ] **SB.na** · Normal Attacks use Base Attack (MAG)
- [ ] **SB.na.cut** · Total damage dealt by his Normal Attacks is reduced by 75% (Q24)
- [ ] **SB.cp** · Construction Points: 0, maximum 50 (Q13)
- [ ] **SB.items** · Items held: none

## Item Construction — Class Skill, Rank B+ *(Passive 1 + 2)*

- [ ] **IC.area** · Affects all allied Units within a 2 panel area of him, himself included
- [ ] **IC.area.out** · …and no Unit outside it, nor an enemy inside it
- [ ] **IC.1** · Chance of inflicting debuffs +45%
- [ ] **IC.1.ik** · …+25% for Instakill
- [ ] **IC.1.death** · …+15% for Death
- [ ] **IC.2** · Chance of being inflicted by debuffs −45%
- [ ] **IC.2.ik** · …−25% for Instakill
- [ ] **IC.2.death** · …−15% for Death
- [ ] **IC.stack** · Several instances on one Unit: only the highest Rank takes effect

## Item Construction: Golems *(Active)*

- [ ] **GO.when** · Used during his Turn (Q5)
- [ ] **GO.home** · In his Home Base: 1d10 Golems
- [ ] **GO.away** · Not in his Home Base: 1d6 Golems
- [ ] **GO.die** · The die rolled is on the card, and the count equals it
- [ ] **GO.place** · Where each Golem is placed (Q4)
- [ ] **GO.max** · At most 30 Golems on the field (Q6)
- [ ] **GO.gkm** · Refused while GKM is active (also GK.nogolems)
- [ ] **GO.cd** · Cooldown 3◈−⅓◈

## Golem — summon

- [ ] **GL.sb** · Health 500, Agility 12, Luck 6, MOV 3, Range 1 panel 1 target, BA(STR) 100, Attributes [Sky] and
  Mechanical, Detect 3, Normal Attacks with STR
- [ ] **GL.weight** · On the Move/Attack count, one Golem is 0.2 of a Servant: five Golems are one Servant
- [ ] **GL.weight.edge** · A sixth Golem's Move past a full Servant pool is refused
- [ ] **GL.once** · The same Golem may Move once and Attack once per Turn, and not Move after its Attack
- [ ] **GL.guard** · An allied Unit within 2 panels of a Golem cannot be targeted for an Attack (Q7)
- [ ] **GL.guard.enemy** · …by an enemy: an ally may still aim at it
- [ ] **GL.guard.name** · The refusal names the Golem
- [ ] **GL.guard.out** · Beyond 2 panels, no guard
- [ ] **GL.guard.aoe** · …against an area Attack (Q7)
- [ ] **GL.guard.golem** · …whether a Golem guards other Golems and itself (Q7)
- [ ] **GL.leave** · Golems at Avicebron's defeat (Q8)

## Territory Creation — Class Skill, Rank B *(Passive 1 + 2)*

- [ ] **TC.1** · In his Home Base, damage dealt by him is +5d10
- [ ] **TC.1.np** · …including NP
- [ ] **TC.1.out** · Outside it, nothing
- [ ] **TC.2** · While he is on the field, damage taken by allied Units in their Home Base is further −(3d10+15)
- [ ] **TC.2.np** · …including NP
- [ ] **TC.2.out** · …and an ally outside its Home Base takes no cut
- [ ] **TC.2.gone** · …and none once he is off the field
- [ ] **TC.stack** · Several allied Territory Creations: only the highest Rank takes effect

## Numerology — Rank B *(Active)*

- [ ] **NU.when** · Used during his Turn
- [ ] **NU.luck** · All Golems on the field restore 3 Luck (Q9)
- [ ] **NU.luck.max** · …up to their maximum
- [ ] **NU.order** · Then: the Luck first, the Atk Up after
- [ ] **NU.atk** · Atk Up on all Golems on the field: all damage dealt +40% (Q9)
- [ ] **NU.atk.np** · …+30% if NP (Q10)
- [ ] **NU.dur** · …for 1◈
- [ ] **NU.gkm** · GKM counts as a Golem for this Skill (Q11)
- [ ] **NU.cd** · Cooldown 4◈

## High-Speed Incantation — Rank B+ *(Active)*

- [ ] **HS.when** · Used during his Turn
- [ ] **HS.cd** · The Cooldown of all his Skills is reduced by 1◈ (Q22)
- [ ] **HS.cd.class** · …his Class Skills and Item Construction: Golems included
- [ ] **HS.cd.self** · …not itself
- [ ] **HS.cd.np** · …not an NP
- [ ] **HS.cp** · Then he gains 5 Construction Points
- [ ] **HS.order** · The Cooldowns first, the Construction after
- [ ] **HS.silence.use** · Cannot be used while inflicted with Silence
- [ ] **HS.silence.neg** · …and its effects are negated while inflicted with Silence
- [ ] **HS.clock** · Cooldown 3◈−⅓◈

## Fig Tree of Tranquility — Rank EX *(Passive)*

- [ ] **FT.when** · Activates by itself when he is defeated
- [ ] **FT.revived** · …and not when a revival brings him back
- [ ] **FT.area** · All allied Units within a 7x7 area of himself (Q17)
- [ ] **FT.area.out** · …and no Unit outside it, nor an enemy inside it
- [ ] **FT.invuln** · Invuln on each, for 3 times
- [ ] **FT.heal** · Each restores 20% of its Max Health
- [ ] **FT.heal.who** · …only the Units it gave Invuln
- [ ] **FT.once** · Can only be used once (Q23)
- [ ] **FT.card** · Its lines name each ally and what it gave

## Golem Keter Malkuth: Royal Crown, the Light of Wisdom — Rank EX (Q1)

### Construction Points

- [ ] **GK.gate** · Usable only when Construction reaches 50 (Q3)
- [ ] **GK.gate.refuse** · …refused at 49, with the reason
- [ ] **GK.cp.round** · Source 1: +1 at the end of every Round
- [ ] **GK.cp.golems** · Source 2: Item Construction: Golems gives +1 for every 3 Golems created (Q6)
- [ ] **GK.cp.golems.floor** · …rounded down: 2 Golems give 0
- [ ] **GK.cp.numer** · Source 3: Numerology gives +1 for every 2 Golems on the field
- [ ] **GK.cp.numer.max** · …at most +10
- [ ] **GK.cp.numer.gkm** · …GKM counted among them
- [ ] **GK.cp.felled** · Source 4: every 5 Golems destroyed or defeated by enemy Units give +1 (Q14)
- [ ] **GK.cp.felled.carry** · …the count of a part five carries to the next
- [ ] **GK.cp.max** · Past 50, the gain is lost (Q13)

### Gather

- [ ] **GK.gather.who** · During his Turn, Avicebron and/or his Master can perform Gather (Q12)
- [ ] **GK.gather.only** · …and no other Unit, ally or not
- [ ] **GK.gather.amt** · +2 Construction per Unit that performs it
- [ ] **GK.gather.both** · …so both on one Turn give +4
- [ ] **GK.gather.move** · Gather counts as that Unit's Move for the Turn
- [ ] **GK.gather.attack** · That Unit cannot Attack on the same Turn
- [ ] **GK.gather.once** · …and cannot Gather twice in one Turn

### The use

- [ ] **GK.kind** · Its kind and its costs (Q1)
- [ ] **GK.place** · Summoned directly next to Avicebron
- [ ] **GK.board** · Avicebron then moves onto the top of GKM
- [ ] **GK.untarget** · Avicebron cannot be targeted by Attacks while GKM is active (Q16)
- [ ] **GK.drive** · Who Moves and Attacks with GKM (Q2)
- [ ] **GK.budget** · …and what it spends (Q2)

### GKM — platform

- [ ] **GK.sb** · Health 2000, Max 4000; Agility 6, Max 12; MOV 3, Max 6; Range 1 panel, a 2x2 area (3x3); BA(STR)
  150, Max 300; Attribute Giant; Detect 5; Normal Attacks with STR (Q15)
- [ ] **GK.luck** · Luck shared with Avicebron: one pool
- [ ] **GK.move.any** · GKM can Move to any panel (Q21)
- [ ] **GK.move.knock** · Moving onto occupied panels knocks every Unit on them back 1 panel, until GKM can stand there
- [ ] **GK.na.area** · Its Normal Attack hits a 2x2 area within 1 panel
- [ ] **GK.na.knock** · Its Normal Attacks knock each DU back 1 panel

### Growth (Q18)

- [ ] **GK.grow.hp** · At the start of every Round since it was summoned, Max and current Health +200
- [ ] **GK.grow.hp.max** · …to a maximum of 4000
- [ ] **GK.grow.agi** · Every 3 full Rounds, Max and current Agility +2
- [ ] **GK.grow.agi.max** · …to a maximum of 12
- [ ] **GK.grow.mov** · Every 3 full Rounds, MOV +1
- [ ] **GK.grow.mov.max** · …to a maximum of 6
- [ ] **GK.grow.range** · At the start of the Round 5 full Rounds after, its area grows from 2x2 to 3x3 (Q25)
- [ ] **GK.grow.ba** · At the start of every Round, BA(STR) +10
- [ ] **GK.grow.ba.6** · …+20 instead from the sixth activation on
- [ ] **GK.grow.ba.max** · …to a maximum of 300

### Its Turn (Q19)

- [ ] **GK.turn.hp** · At the start of its Turn, GKM restores 500 Health
- [ ] **GK.turn.agi** · …and 1 Agility

### Aura (Q20)

- [ ] **GK.aura** · All allied Units within 2 panels of GKM gain the effect
- [ ] **GK.aura.out** · …and no Unit outside it, nor an enemy inside it
- [ ] **GK.aura.end** · At the end of that Unit's own Turn, its NP Cooldown is reduced by 1 Turn
- [ ] **GK.aura.acts** · …and at the end of any Turn it Acts
- [ ] **GK.aura.4** · …by 2 Turns if ◈ is greater than 4
- [ ] **GK.aura.4.not** · …and by 1 at ◈ of 4

### While it stands, and after

- [ ] **GK.nogolems** · Avicebron cannot create Golems while GKM is active
- [ ] **GK.fall.place** · When GKM is defeated, Avicebron returns to a panel within the area GKM last stood on
- [ ] **GK.reset** · …and his Construction is reduced to 0 (Q3)
- [ ] **GK.rebuild** · He can build GKM again from scratch
- [ ] **GK.owner.fall** · GKM when Avicebron falls aboard it (Q17)
- [ ] **GK.numer** · For Numerology, GKM counts as a Golem (NU.gkm)
- [ ] **GK.notgolem** · …and for nothing else: not the cap of 30, the weight, the guard nor Source 4
