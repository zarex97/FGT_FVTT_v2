# Kazuradrop (Alter Ego) — the Clause list

*Kazuradrop*, built from `char_orig_sheets/by-class/Alter Ego/Kazuradrop.md`. Started by the user 2026-11-04.

**Audit opened 2026-11-04 (#385).** **Read by hand, line by line.** No generated draft was used. No older `Copia de` sheet exists to compare with. The
sheet prints no Class line of its own: Alter Ego is its folder, her first Class Skill's name and her own sentence
*"the 'Alter-Ego' Servant Class"*.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own. Each term of Insect Eater's chance is its own Clause, because each can be wrong alone. The two
methods of Gully Trap Funny Muryan are read as two uses with their own clocks (Q).

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Alter Ego/Kazuradrop"`, each confirmed by
reading the built piece:

- **Alter Ego** is `class-alter-ego`, Kingprotea's and Mannanán's word for word, but for one sentence only her sheet
  prints: *"This effect is negated if Kazuradrop is not the 'Alter-Ego' Servant Class."* It lives on her copy.
- **Magic Resistance A** is `class-magic-resistance` at A.
- **Territory Creation EX** is `kingprotea-territory-creation` word for word: 6d20, 3d10+30, highest Rank only.
- **"The same Servant Class as herself"** is `target:class:same`, already built for her (`rules/options.mjs`,
  `test/unit/war-options.test.mjs`).
- **Def Dwn (C)** is `def-dwn-c.yml`: Agility -1 once per successful Attack (#239). **Crit ResDwn**, **Debuff ChUp**,
  **Debuff ChDwn**, **Atk Dwn**, **Stun** and **Def Dwn** are catalogue effects. She is the first sheet to print Crit
  ResDwn.
- **"For 2 times"** is `charges`, as `np-dm-up-gao.yml` and Guts carry them.
- **NP Cooldown raised on another Unit** is a `cooldown` phase with `unit: target, scope: np, direction: up`
  (`rama-brahmastra.yml`, Kiritsugu's Chronos Rose). **"Skill Cooldown is reduced"** is `scope: skills, excludeSelf`
  (`olga-unparalleled.yml`, ruling 11).
- **The 3x3 and the 5x5 beside her** are a turnable `orientedRect` at `selfEdgeAdjacent`, as Excalibur's.
- **A non-damaging NP that can be Evaded** is `gray-rhongomyniad-mythos.yml`: its own Combat Process with no damage,
  the DU's only reaction an Evade (reading 20 there).
- **An NP that costs its Master nothing** is Enkidu's `noMasterCost`.
- **An allied Unit about to be hit** is the `whenAllyAttacked` window: Rho Aias, Kawarimi, Scapegoat.
- **"All effects, durations, and Cooldowns are paused"** has two readers waiting: `advanceEffects` already extends an
  Effect on a bearer with a `durations` suppression, its comment naming Bug Space (`engine/scheduler.mjs`), and Stop's
  two sweeps freeze the clocks.
- **"Cannot be used by its original owner and has no effects for that Unit"** is what `negatingEffectOf` answers for
  `sealEa`. **What may be taken** starts from `rules/copy.mjs`'s `canCopy`: an NP is no Skill, nor a Spell.
- **Atomicros Form** is a Mode with no way off (`ForceMode`, `cannotDeactivate`), since she keeps every ability.
- **Class is read through one door**, `rules/form.mjs#formSheet`. A form already overrides it.
- **Enuma Elish already lists her**: `kazuradrop-bug-space` in `strikeListedAbilities`, and Gilgamesh's five
  `EE.muryan.*` Clauses wait here (#374 ruling 22).

What she needs that nobody has yet, each to be built as a generic piece:

- **A Unit held out of the board** (Bug Space): no panel, no Turn, its clocks and Effects paused, held by another Unit,
  with a limit, and two ways back.
- **A Skill taken from its owner** (Insect Eater): the use and the passives move, the clock moves with them, a limit
  of three, and a way back.
- **A Skill obtained for good** (Sakura Eater's Passive).
- **A Class changed for a time** (Moon's Pupa).
- **A group of Servants named by a sheet** (BB, Sakura Five): Rapture and Hakuno read the same words.
- **A capture at the start of an ally's Damage Step**, which ends that Process.
- **A tally of defeats by group** (Atomicros's second door).
- **A rolled chance built from a closed list of terms** (Insect Eater).

**166 Clauses** across 10 Abilities and the statblock, 7 of them read from Gilgamesh's sheet.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"(Kazuradrop)"* before every Ability's name: the bearer's label.
- *"Has the following effects-"*, *"as follows-"*: headings.
- `Items held:` holds no Item. Its *"Unused effect for Gully Trap Funny Muryan (1)"* is an earlier draft of Method 1 (Q).
- *"id_es:"* before Insect Eater and *"Expanding World"*, *"Shrinking World"*: part of the names.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables and beat the sheet (§46.6; #328 ruling 18): END E 500,
BA(STR) 50 at STR E and BA(MAG) 175 at MAG B all agree with what is printed · *"NP Cooldown"* naming no NP reaches every
NP (#197 reading 6) · *"Skill Cooldown"* reaches every Skill, Class Skills included, and no NP (Summer Habetrot) · an
area that names no relation hits every Unit in it (#191 reading 11; Gray 15; Kiara 17) · *"all allied Units"* include
the user unless the sheet says *"other"* (#204) · an effect with no NP figure applies its full value against an NP
(#204 reading 5) · an NP used on its owner's Turn consumes the Attack (§46.4-AZ) · two different Atk Ups stack (#230
reading 4) · an author's *"(?)"* is a doubt, the printed figure stands (Gilgamesh reading 1) · Def Dwn (C) drains once
per successful Attack: a Block, a hit for 0 and an Instakill count, an Evade does not (#239) · durations count from
the Turn after the Turn of use (#187 reading 5) · riders land on a hit, not a hurt (§46.4-LI) · the class affinity
table does not exist (Summer Habetrot) · a sheet binds only its owner · an Empty Aim is legal for a damaging area (#381).

## Readings

Ruled by the user 2026-11-04, as recommended but 12, 42, 47 and 48. The user's *"Q22:B"* is read as 12, the question holding A and B.

| # | Ruling | Clauses |
|---|---|---|
| 1 | Alter Ego's negation takes both halves, on her copy only. Kingprotea and Mannanán are untouched. | AE.neg |
| 2 | The Sakura Five are Rapture's list by name, in one shared place: Passionlip, Meltryllis, Kazuradrop, Violet, Kingprotea. She is a member. Violet stays a name until built. | RK.sf, SE.*, IE.bb, AM.door2 |
| 3 | BB is any Unit with True Name BB: `BB.md`, `BB Pele.md`. BB Dubai joins by name once built. | RK.bb, SE.*, IE.bb, AM.door2 |
| 4 | Repulsion reaches either side. Passive 1 and Passive 2 add, to +100% on Kingprotea. | RK.1.ally, RK.stack |
| 5 | *"No effect against"* closes Passive 2 only. A target holding Shielder or Beast in two Classes takes no 70%. Moon's Pupa does not get around it. | RK.shielder, RK.beast |
| 6 | Pixie fires at the start of her own Player's Turn. The bracket is the author's doubt. | PF.5.when |
| 7 | Pixie's area is 2 panels around her, as printed. | PF.5.area |
| 8 | A charge burns at each Turn start, with a line, even with no enemy near. The first fires at her next Turn. | PF.5, PF.5.spent |
| 9 | Effect 1 raises every NP on each enemy, a ready one included. It has no chance and is no debuff. | PF.1 |
| 10 | Written order: the first use's debuffs get no +30%, later Pixie ticks do. | PF.4.order |
| 11 | 2◈ each, as printed. | SE.2 |
| 13 | *"Instead"* replaces Effect 2 only. Effect 1's 2◈ always lands. The ⅓◈ reaches her other Skills, Class Skills, stolen and obtained ones, not this one, not an NP. | SE.3 |
| 14 | *"Successfully defeats"*: her Attack, Attack Skill or NP gives the last blow and the Unit stays down. A debuff tick does not count. | SE.p, AM.door2 |
| 15 | An Obtained Skill is a copy at its source Rank with a clear clock, passives and EX allowed. NPs and Spells are not Skills. It survives her fall and Atomicros's discard. | SE.p.* |
| 16 | Moon's Pupa is usable with no Servant in Range: Effects 3 and 4 say so. With one in Range she must choose. | MP.3 |
| 17 | Every reader sees the new Class: `np-gate.mjs`, `zon.mjs`, `contract.mjs` too. Her seat stays. She keeps her Class Skills and gains none. | MP.3.class, RK.class.now, AE.neg |
| 18 | A two-Class Servant gives both. | MP.3.class |
| 19 | The change is neither buff nor debuff, so no removal touches it. The Class is read at use and holds if that Servant falls. Its end has a line. | MP.3.dur |
| 20 | Insect Eater takes Class Skills and passives too. NPs and Spells are not Skills. | IE.which |
| 21 | She chooses the Skill from a list. | IE.who |
| 22 | One roll per DU per Attack, after that DU's last Damage Step. A Block counts, an Evade does not. Allies count. Method 1 never rolls. | IE.when, IE.step |
| 23 | E 1 to A 5, EX 6, plus and minus ignored, at the Rank in force. | IE.mr |
| 25 | *"The Moon Cell"* is the War's Region `moon`. | IE.moon |
| 26 | The owner loses passives, and a Mode ends. Effects already landed stay. | IE.owner.fx |
| 27 | Source Rank, running clock moved with it, ticking on her Turns. A pool it needs starts at 0 on her. A discard hands the running clock back. | IE.own.*, IE.cd, IE.back |
| 28 | She may discard any of the four, the new one too, and the Token stays. At her final defeat each returns to an owner still standing. | IE.fourth, IE.fallen |
| 29 | The *"Unused effect"* is no rule: no second board, no Teleport out. | ST.items |
| 30 | Inside is off the board, no panel. A held Unit cannot Act, be aimed at or project an aura. Gilgamesh's Enuma Elish is the one exception. | G1.out |
| 31 | *"All effects"* are Effect instances. Passives stay, so Magic Resistance works against Method 2. Guts is an Effect, so a fall inside is final. | G1.fx |
| 32 | Bug Space is a list on her, no Item document, no slot. A test pins that a held Unit is not in her Items. | G1.item, G1.steal |
| 33 | Method 1 takes any Unit, any size, Masters and Summons too. Evade alone stops it. A full Bug Space refuses by name. A mount's riders are set down, as when a platform falls. | G1.adj, G1.evade, G1.max |
| 34 | *"Within herself"* is a typo for *"of"*, and she is excluded. Offered per ally at the start of that Damage Step, so an Evade opens no window. | G1.ally |
| 35 | No Evade roll. That Process ends with no damage and no riders, on the card. It is no successful Attack. Off her Turn it spends no Attack. | G1.ally.ends, G1.ally.turn |
| 36 | Two clocks. Every NP cut, the Round gate and NP Seal reach both. Only Method 1 skips Master's Health. | G1.clock, G2.clock, G2.master |
| 37 | Release: any number, each to a free panel she picks. NP Seal does not stop it, Stun does. A released Unit may still Act if its Turn allows. | G1.rel |
| 38 | At her final defeat all come out, onto random free panels within 2 of her last panel. Guts keeps them in. If she is caught herself, her Bug Space freezes. | G1.fallen |
| 39 | A side with everyone inside has not lost. A captured Master projects no ZON. Its Contract stands, and Sustainability pauses. | G1.out |
| 40 | Units inside are read at declaration, each its own Process, allies too, no Evade or Block. Debuffs land paused and run from the release. Insect Eater can roll on them. An empty area stays a legal Empty Aim. | G2.inside, G2.all, AM.inside |
| 41 | Door one is free, on her Turn, at exactly 7. Door two takes no Tokens and no Skills. Obtained Skills stay either way. The Form lasts the War, and the NP's Round gate still holds. | AM.* |
| 12 | **Every Unit truly there counts, hidden ones too.** The user: *"Hidden is different from unreachable or intangible."* The card's bigger cut may tell her a hidden BB is near. A Unit inside Bug Space is off the board and is not counted. | SE.2, SE.3 |
| 24 | Points, not a multiplier. Sum, then clamp to 0 through 100. X and Y read only effects named Debuff ChUp and Debuff ChDwn. No debuff rule touches it. The card names each term, as Atlas's does (#193), no die at 0 or at 100 or more. The leak goes to its own issue. | IE.base, IE.moon, IE.chup, IE.bb, IE.mr, IE.chdwn |
| 42 | No Skill named Bug Space is built. His row reaches any Unit holding the ability that creates it, by Gully Trap's id, never her name. | EE.bug.* |
| 43 | From inside, the DU is the holder he is inside, no prompt. He hits her alone, no 3x6, for 10x. Release and seal land on the use, even on an Evade, which saves only the damage. | EE.muryan.* |
| 44 | Hit on the board: Seal (Ea) on Method 1 only, everyone inside out at random within 2 of her, Method 2 and Atomicros stay usable and their debuffs stay. Used from inside: NP Seal (Ea) on all three uses, what they caused removed. Both rows on one hit: one line per seal. | EE.bug.*, EE.muryan.seal, EE.muryan.remove |
| 45 | No room within 2: the nearest free panels outward, wide enough for the footprint, with a line. | G1.fallen, G2.rel, AM.rel, EE.muryan.release |
| 46 | She holds both Skills of one name, but same-named passives do not add. The higher Rank governs. Her own comes back if the stolen one goes. | IE.own.fx |
| 47 | **She cannot rob a corpse.** The user: *"She can't rob from a fully dead unit (Basically an unit that will diaspear soon as it is a corpse)"*. A DU at final defeat gets no roll. One that Guts brings back still does. A DU with nothing to take gets no die and a line. | IE.when, IE.fallen |
| 48 | **An ability's name is concealed: it uses a public name**, on the steal list and on every card. Its own issue, fixed and pressed with her. | IE.who |
| 49 | Stun stops door one. NP Seal does not. | AM.door1 |
| 50 | **An ability's public name is an automatic tag:** its kind and five letters and digits, as the user's *"NP-X5R76"*. Nothing is written by hand. (#387) | IE.who |
| 51 | **No name stays real.** Class Skills and shared Skills take a tag too. (#387) | IE.who |
| 52 | The real name follows `identityRevealed`, on new cards. Old cards stay. An NP use reveals nothing by itself. (#387) | IE.who |
| 53 | **The owner has a different view of the card.** (#387) | IE.who |
| 54 | Every line the table reads goes public, the cut-in and damage rows too. Prompts only the owner sees keep the real name. Effect names stay out of #387, a follow-up. | IE.who |
| 55 | **A pick list is the tag, the Rank, Active or Passive, and the text with names removed.** Removal covers the bearer's True Name and sheet name, its other abilities, and every other Servant's name, walked over the roster by a test. The source shows its public name. Once taken, the real name shows on her own sheet and bar. Scáthach's and Chiron's GM stage keeps the truth. | IE.who, SE.p.choose |
| 56 | `check-public-names` reads ability names too, through one reader. A safe line says why. Console text is exempt. | none |
| 57 | #387 lands first as its own commit on `claude/kazuradrop`, and closes when she merges. | none |
| 58 | Two prefixes, `NP-` and `SK-`, Class Skills and Spells under `SK-`. Normal Attack keeps its words. | IE.who |
| 59 | A tag is new per War, per ability, per Unit, the same for that whole War. Two Servants with Magic Resistance get different tags. **Built derived, not stored:** a hash of the War, the Unit and the ability reads the same at every table and has no field to lose. | IE.who |
| 60 | A Stolen Skill keeps its tag. A copy gets a new one. Method 1 and Method 2 share one by `publicTagAs`, and Atomicros has its own. | IE.who, IE.own.use |
| 61 | No Rank on the public card. The owner's view keeps it. | IE.who |
| 62 | Chance term labels stay as written until #386 decides them. That one gap in ruling 51 is on purpose. | IE.* |
| 63 | The owner reads the real ability name and Rank for their own Unit, and that Unit's real name, on attack and Skill cards. The other side stays public, unless the owner holds both. The GM reads everything real. | IE.who |
| 64 | OWNER only, so a teammate reads public names. An open table reads real names for everyone. | IE.who |
| 65 | One door: a card prints the tag, and one `renderChatMessageHTML` hook swaps it for those entitled. The message never holds the real name. **Built on the tag itself as the marker:** the hook walks a card's text, so a line that escaped its string passes too. | none |

## Statblock

- [ ] **ST.name** · True Name: Kazuradrop
- [ ] **ST.class** · Class: Alter Ego (the sheet's folder and her own sentence)
- [ ] **ST.region** · Region: Moon
- [ ] **ST.align** · Alignment: Lawful Good
- [ ] **ST.param** · STR E, END E, AGI C, MAG B, LUC C
- [ ] **ST.attr** · Attributes: Female, Servant, [Earth], Humanoid, Non-Hominidae, Mechanical, Fae, Child
- [ ] **ST.hominidae** · Non-Hominidae withholds Hominidae, on the board
- [ ] **ST.hp** · Base Health 500 (END E, the table agrees)
- [ ] **ST.mov** · MOV 5
- [ ] **ST.range** · Range 3 panels, 1 target
- [ ] **ST.ba** · Base Attack STR 50, MAG 175 (the tables agree)
- [ ] **ST.sus** · Sustainability: 2◈
- [ ] **ST.na** · Normal Attacks use Base Attack (MAG)
- [ ] **ST.tokens** · Eater Tokens: 0, maximum 7
- [ ] **ST.items** · Items held: none (Q)

## Alter Ego — Class Skill *(Passive)*

- [ ] **AE.dealt.attr** · Damage dealt to a Unit with the Outsider Attribute is +50%
- [ ] **AE.dealt.skill** · …or with the Existence Outside the Domain Skill
- [ ] **AE.dealt.np** · …including NP
- [ ] **AE.taken.attr** · Damage received from a Unit with the Outsider Attribute is -50%
- [ ] **AE.taken.skill** · …or with the Existence Outside the Domain Skill
- [ ] **AE.taken.np** · …including NP
- [ ] **AE.neg** · Negated, both halves, if she is not the Alter Ego Class (Q)

## Magic Resistance — Class Skill, Rank A *(Passive 1 + 2)*

- [ ] **MR.1.neg** · MAG damage from a MAG Rank of up to A is negated
- [ ] **MR.1.else** · Otherwise MAG damage taken is -50%
- [ ] **MR.1.np** · Also affects NP
- [ ] **MR.2** · Chance of being inflicted by debuffs is -25%
- [ ] **MR.2.death** · Also affects Instakill and Death
- [ ] **MR.2.str** · …unless from an Attack, Attack Skill, Spell or NP that deals STR damage or is not affected by Magic Resistance
- [ ] **MR.2.erase** · Erase is completely unaffected
- [ ] **MR.2.note** · Other debuffs from those sources still have their chance reduced

## Territory Creation — Class Skill, Rank EX *(Passive 1 + 2)*

- [ ] **TC.1** · In her Home Base, damage dealt is +6d20
- [ ] **TC.1.np** · …including NP
- [ ] **TC.1.out** · Outside it, nothing
- [ ] **TC.2** · While she is on the field, damage taken by allied Units in their Home Base is further -(3d10+30)
- [ ] **TC.2.np** · …including NP
- [ ] **TC.2.out** · An ally outside its Home Base, nothing
- [ ] **TC.note** · Several allied Territory Creations: only the highest Rank

## Repulsion for One's Kin — Rank EX *(Passive 1 + 2)*

- [ ] **RK.bb** · Damage dealt to BB is +30% (Q)
- [ ] **RK.sf** · …and to Sakura Five Units (Q)
- [ ] **RK.1.np** · …including NP
- [ ] **RK.1.ally** · …allied or enemy (Q)
- [ ] **RK.1.out** · Any other Unit, nothing
- [ ] **RK.class** · Damage dealt to Units of her own Servant Class is +70%
- [ ] **RK.class.np** · …including NP
- [ ] **RK.class.now** · Her Class as it stands now, Moon's Pupa's included (Q)
- [ ] **RK.class.other** · Another Class, nothing
- [ ] **RK.shielder** · No effect against the Shielder Class (Q)
- [ ] **RK.beast** · No effect against the Beast Class (Q)
- [ ] **RK.stack** · Passive 1 and Passive 2 on one Unit add (Q)

## Pixie Finger — Rank A *(Active)*

- [ ] **PF.turn** · Used during her Turn
- [ ] **PF.area** · All enemy Units in a 3x3 directly next to her
- [ ] **PF.enemy** · An ally in the area is untouched
- [ ] **PF.1** · 1: NP Cooldown of each is +⅓◈ (Q)
- [ ] **PF.2** · 2: Def Dwn (C) for ⅓◈: damage taken +30%
- [ ] **PF.2.agi** · …and Agility -1 whenever successfully Attacked
- [ ] **PF.3** · 3: Crit ResDwn for ⅓◈: Crit Damage taken +50%
- [ ] **PF.4** · 4: Debuff ChUp on herself for 1◈: chance of inflicting debuffs +30%
- [ ] **PF.4.order** · …after Effects 2 and 3 of this use (Q)
- [ ] **PF.5** · 5: the Pixie buff on herself, 2 times (Q)
- [ ] **PF.5.when** · At the start of her Turn it inflicts (Q)
- [ ] **PF.5.area** · …on all enemy Units within a 2 panel area of herself (Q)
- [ ] **PF.5.what** · …Effects 2 and 3, and not Effect 1
- [ ] **PF.5.spent** · A charge goes each time; none left, the buff ends (Q)
- [ ] **PF.cd** · Cooldown 4◈

## Sakura Eater — Rank A *(Active + Passive)*

- [ ] **SE.turn** · Used during her Turn
- [ ] **SE.1** · 1: NP Cooldown -2◈
- [ ] **SE.2** · 2: For every BB and other Sakura Five Unit within a 3 panel area of herself, NP Cooldown further -2◈ (Q)
- [ ] **SE.2.other** · …she does not count herself (Q)
- [ ] **SE.3** · 3: If there are none, Skill Cooldown -⅓◈ instead (Q)
- [ ] **SE.cd** · Cooldown 3◈
- [ ] **SE.p** · Passive: whenever she successfully defeats a BB or Sakura Five Unit (Q)
- [ ] **SE.p.choose** · …she can choose one of the non-Class Skills on it (Q)
- [ ] **SE.p.keep** · …and obtains it for the rest of the game (Q)
- [ ] **SE.p.limit** · It does not count towards Insect Eater's limit

## Moon's Pupa — Rank A *(Active)*

- [ ] **MP.turn** · Used during her Turn
- [ ] **MP.1** · 1: Removes all debuffs from herself
- [ ] **MP.2.hp** · 2: Restores her Health by 35% of maximum
- [ ] **MP.2.agi** · …and her Agility by 35% of maximum
- [ ] **MP.3** · 3: She chooses an enemy Servant within Range (Q)
- [ ] **MP.3.class** · Her Servant Class becomes that Servant's (Q)
- [ ] **MP.3.dur** · …for 1◈, then back, with a line (Q)
- [ ] **MP.4** · 4: Def Dwn for 1◈ on that Servant: damage taken +50%
- [ ] **MP.cd** · Cooldown 4◈

## id_es: Insect Eater *(Passive 1 + 2)*

- [ ] **IE.when** · Whenever she performs a successful Attack (Q)
- [ ] **IE.step** · …at the end of the Damage Step (Q)
- [ ] **IE.base** · …a 15% chance
- [ ] **IE.which** · …of stealing one of the DU's Skills (Q)
- [ ] **IE.who** · …the Skill she takes (Q)
- [ ] **IE.owner.use** · The original owner cannot use it
- [ ] **IE.owner.fx** · …and it has no effects for that Unit (Q)
- [ ] **IE.own.use** · She can use it as her own (Q)
- [ ] **IE.own.fx** · …and gains its effects (Q)
- [ ] **IE.moon** · Term 1: the Region is the Moon Cell, +30% (Q)
- [ ] **IE.chup** · Term 2: she has Debuff ChUp, +X% (Q)
- [ ] **IE.bb** · Term 3: the target is BB or a Sakura Five Unit, +30% (Q)
- [ ] **IE.mr** · Term 4: for every Rank in Magic Resistance on the DU, -5% (Q)
- [ ] **IE.chdwn** · Term 5: she has Debuff ChDwn, -Y% (Q)
- [ ] **IE.max** · She holds at most three
- [ ] **IE.fourth** · On a fourth she must choose one to discard (Q)
- [ ] **IE.back** · The discarded one returns: its owner can use it again
- [ ] **IE.cd** · Its Cooldown is carried over (Q)
- [ ] **IE.token** · Passive 2: each steal gains 1 Eater Token
- [ ] **IE.token.max** · …maximum 7
- [ ] **IE.fallen** · A steal held when she falls (Q)

## Gully Trap Funny Muryan: Expanding World — Rank B, NP [Anti-Unit], Method 1 *(Non-damaging)*

- [ ] **G1.attack** · Counts as her Attack for the Turn
- [ ] **G1.adj** · Used on a Unit directly next to her (Q)
- [ ] **G1.evade** · If not successfully Evaded, she captures it (Q)
- [ ] **G1.item** · It is held as a Special Item (Q)
- [ ] **G1.steal** · …which cannot be Stolen (Q)
- [ ] **G1.out** · A captured Unit is off the board (Q)
- [ ] **G1.fx** · Its Effects are paused and have no effect (Q)
- [ ] **G1.dur** · Its durations are paused
- [ ] **G1.cd** · Its Cooldowns are paused
- [ ] **G1.ally** · An allied Unit within a 2 panel area about to receive an Attack: offered at the start of the Damage Step (Q)
- [ ] **G1.ally.ends** · …the capture ends that Process (Q)
- [ ] **G1.ally.turn** · …off her Turn it spends no Attack (Q)
- [ ] **G1.max** · At most three Units inside (Q)
- [ ] **G1.clock** · Cooldown 4◈ (Q)
- [ ] **G1.ex.2** · Not on the same Turn as Method 2
- [ ] **G1.ex.am** · Not on the same Turn as Atomicros Muryan Foot
- [ ] **G1.master** · Does not consume Master's Health
- [ ] **G1.rel** · During her Turn she can release any Units inside (Q)
- [ ] **G1.rel.where** · …onto any panel within a 2 panel area of herself
- [ ] **G1.rel.cd** · …with no Cooldown
- [ ] **G1.fallen** · Units inside when she falls (Q)

## Gully Trap Funny Muryan: Expanding World — Method 2

- [ ] **G2.ba** · Base Attack (MAG)
- [ ] **G2.area** · A 3x3 directly next to her
- [ ] **G2.dmg** · 3.5x damage to all Units in it, allies too
- [ ] **G2.inside** · …and to Units within Bug Space when the NP was used (Q)
- [ ] **G2.a** · a: Atk Dwn for 1◈: damage dealt -20%
- [ ] **G2.a.np** · …if NP, -10%
- [ ] **G2.b** · b: Def Dwn for 1◈: damage taken +30%
- [ ] **G2.c** · c: 40% chance of Stun for ⅓◈
- [ ] **G2.all** · All three on all affected Units, those inside too (Q)
- [ ] **G2.rel** · Then all inside are forcefully released onto random panels within a 2 panel area of her (Q)
- [ ] **G2.clock** · Cooldown 6◈ (Q)
- [ ] **G2.ex** · Not on the same Turn as Method 1
- [ ] **G2.master** · Consumes Master's Health at Rank B (Q)

## Atomicros Muryan Foot: Shrinking World — Rank EX, NP [Anti-Unit]

- [ ] **AM.gate** · Cannot be used outside Atomicros Form (Q)
- [ ] **AM.door1** · During her Turn: remove 7 Eater Tokens (Q)
- [ ] **AM.door1.discard** · …and discard every Skill stolen with Insect Eater, and enter the Form (Q)
- [ ] **AM.door2** · Having defeated a total of two BB and/or Sakura Five Units (Q)
- [ ] **AM.door2.when** · …she enters it automatically at the end of the Combat Phase
- [ ] **AM.keep** · The Form has no end printed (Q)
- [ ] **AM.mov** · In Form: MOV +1
- [ ] **AM.agi** · …Agility Check rolls -3
- [ ] **AM.ie** · …Insect Eater's base chance +15%
- [ ] **AM.space** · …Bug Space holds five
- [ ] **AM.ba** · Base Attack (MAG)
- [ ] **AM.area** · A 5x5 directly next to her
- [ ] **AM.dmg** · 5x damage to all Units in it, allies too
- [ ] **AM.inside** · …and to Units within Bug Space when the NP was used (Q)
- [ ] **AM.a** · a: Atk Dwn for 1◈: damage dealt -30%
- [ ] **AM.a.np** · …if NP, -15%
- [ ] **AM.b** · b: Def Dwn for 1◈: damage taken +40%
- [ ] **AM.c** · c: 60% chance of Stun for 1◈
- [ ] **AM.rel** · Then all inside are forcefully released onto random panels within a 2 panel area of her (Q)
- [ ] **AM.cd** · Cooldown 8◈
- [ ] **AM.ex** · Not on the same Turn as Method 1

## Enuma Elish against Bug Space — Gilgamesh's sheet, pressed on her

- [ ] **EE.bug.real** · Bug Space's bearer affected by Enuma Elish: Skill Seal (Ea) for 3◈ (Q)
- [ ] **EE.bug.lifted** · …and everything that Skill caused is removed from all Units (Q)
- [ ] **EE.muryan.use** · Caught within Bug Space, during his Player's Turn, he can use Enuma Elish if it is not on Cooldown (Q)
- [ ] **EE.muryan.count** · …it counts towards the number of Units which Attack during this Turn (Q)
- [ ] **EE.muryan.release** · …every Unit in Bug Space is released onto random panels within a 2 panel area of the DU (Q)
- [ ] **EE.muryan.seal** · …the DU is inflicted with NP Seal (Ea) for 3◈ (Q)
- [ ] **EE.muryan.remove** · …and every effect the NP caused is removed from all Units (Q)
