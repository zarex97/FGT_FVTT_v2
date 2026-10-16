# Hundred-Faced Hassan — the Clause list

**Draft, 2026-10-16.** The audit issue's body, before it is opened. Built by hand, line by line, from
`char_orig_sheets/Copia de Hassan (Hundred-Face).md` as it stands in the working copy (Librarian B
with five effects, Expert's new Active, shared cooldowns, the brackets removed). The generated draft
(`node tools/extract-clauses.mjs "Hassan (Hundred-Face)"`) was read beside it and not used: it
bundled them into 35 lines and left five unnamed.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a
die or a condition of its own. A Clause stating *"if NP"* needs a Noble Phantasm reading.

**Nothing is built.** No `packs/_source/servants/` file exists for him; every Clause is `Untouched`,
and every reading below is open. Appendix D §D.21 describes an older sheet (Librarian C, a passive
that reached allies, a choose-or-roll Expert, the bracketed *"ten (twenty?)"* and *"0.5 (0.25?)"*).

**82 Clauses** across 5 Abilities and the statblock.

**His Presence Concealment is the shared A+ block plus one Clause on trial**, `PC.8.seal`: Skill
Seal ends it at once. The user is testing that Clause on him (said 2026-10-16); nothing in the engine
reads Skill Seal against PC yet. The other 20 PC Clauses carry Jack's and Serenity's rulings.

### Already ruled

**Elsewhere:** Base Attack derives from the STR/MAG tables (§46.6): BA(STR) 100 at STR C, not the
printed 85, as for Jack (#185) · Presence Concealment A+ as pressed on Jack (#185) and Serenity
(#199): Evade +4, discovery 5%, cooldown 2◈ from deactivation · *"NP Cooldown"* naming no NP
reaches every NP (#197 reading 6) · an area that names no relation hits every Unit in it (#191
reading 11) · Def Dwn (A) drains Luck only on damage from an Attack (#223) · an effect with no NP
figure applies its full value against an NP (#204 reading 5) · Crit Up and Crit DmUp reach an NP
only when an NP figure is stated (#131) · a shared cooldown is one clock per name (#209 reading 2,
the Dioscuri) · a linked Unit weighs 0.5 in the action budget (Ch. 19, Ch. 32).

### Readings to settle

Asked by grilling, 2026-10-16. Rulings are written here as they land. None is built.

**Round 1, ruled 2026-10-16.**

1. **One body falls** (`ZA.defeat`). **Ruled:** the body is removed and the count drops by 1. It is
   a defeat for every other rule: Guts, revivals and other Units' *"when defeated"* Clauses fire for
   one body. Only the last body defeats the Servant.
2. **What "remaining" counts** (`ZA.gate`, `ZA.track`). **Ruled:** every living Hassan, on the
   field and off.
3. **The opening count** (`ZA.start`). **Ruled:** 1 to 10 in the Home Base, the Master's pick at war
   setup.
4. **Where a body deploys** (`ZA.deploy`, `ZA.deploy.base`). **Ruled:** by war type. A Great Holy
   Grail War (`warType: greatHolyGrailWar`) deploys onto the Master's half of the field. Every
   other war type (`holyGrailWar`, `custom`) deploys within 2 panels of the Home Base's border. A
   body deployed at a Round's start may act in that Round.
5. **A body's Agility and Luck** (`ZA.stats`, `SB`). **Ruled:** rolled once, at war setup. Every
   body gets that same roll. They are not rolled per body.
6. **Move/Attack once** (`ZA.once`). **Ruled:** one Move and one Attack per body per Turn, like any
   Servant. No second Move.
7. **The weight** (`ZA.weight`). **Ruled:** 0.5 everywhere, the multi-Servant tax included, as for
   the Dioscuri. Two bodies acting pay no tax.
8. **Male/Female** (`SB.attr`). **Ruled:** every body carries both. A gender gate sees both.
9. **Shared cooldowns** (`ZA.cd.shared`, `ZA.cd.own`). **Ruled:** one clock per name, like the
   Dioscuri (#209 reading 2): Librarian, Expert, Zabaniya. PC and Battle Retreat keep one clock per
   body.
10. **Expert's Passive 1** (`EMS.p1`, `EMS.p1.not`). **Ruled:** any roll made outside a Combat
    Process. It cannot move the rolls of this Skill's own Active.
11. **Expert's 70% rolls** (`EMS.1.buff`, `EMS.2.buff`, `EMS.3`, `EMS.4.dur`). **Ruled:** all four
    are buff chances, the Dodge length included. Buff ChUp raises 70 to 90; No Buff stops them.
12. **Battle Retreat** (`BR.*`). **Ruled:** used at the reaction rung. Against a targeted Attack it
    cancels the Attack. Against an AoE it only takes him out of the targets, as if he had teleported
    away before it hit; the Attack goes on for everyone else. The Move is up to 7, his pick. PC is
    no buff, so it stays.
13. **Librarian's "up to two"** (`LSK.p2.cap`). **Ruled:** the player picks, from bodies within 2.
14. **Zabaniya hits his own** (`ZA.area`). **Ruled:** yes, every Unit in the 3x3, other bodies
    included (#191 reading 11).
15. **NP type** (`ZA.army`). **Ruled:** the Active is Anti-Army, and scale checks read that. Anti-Unit
    (Self) names the Passive.
16. **Skill Seal on PC** (`PC.8.seal`). **Ruled:** the 2◈ cooldown starts the moment the seal ends
    PC, as on Tails.
17. **One Servant or a hundred** (`ZA.unit`). **Ruled:** a Command Spell acts on the one body its
    Master names. A contract, a Conquest and Sustainability act on the whole hundred. ZON is checked
    per body.

**Round 2, ruled 2026-10-16.**

18. **The shared roll, per body** (`ZA.stats`). **Ruled:** the war-setup roll is every body's Max
    Agility and Max Luck. Each body spends its own current value. A new body arrives full.
19. **Paying the 4d6** (`ZA.cost`). **Ruled:** from the reserve first, then field bodies the player
    picks. They are removed, not defeated: no Guts, no *"when defeated"* Clause.
20. **The NP can end him** (`ZA.cost`, `ZA.defeat`). **Ruled:** a count of 0 defeats Hassan, through
    the normal defeat chain. The gate allows 11; 4d6 rolls up to 24.
21. **A revived body** (`ZA.defeat`). **Ruled:** the count drops only for a body that stays down.
    Guts that saves it saves the count.
22. **None left on the field** (`ZA.defeat`, `ZA.deploy`). **Ruled:** with bodies in reserve he is
    alive, off the board, and comes back at the next Round's deploy.
23. **Deploy limits** (`ZA.deploy`). **Ruled:** free panels only, from Round 2 on. A body arrives
    without PC.
24. **Battle Retreat's rest** (`BR.heal`, `BR.strip`, `BR.cancel`). **Ruled:** the heal and the strip
    happen against an AoE too. A canceled Attack is still spent by the attacker.
25. **Expert's ±3** (`EMS.p1`). **Ruled:** a prompt after the roll is seen, −3 to +3. His own setup
    rolls of Agility and Luck count.
26. **Zabaniya's 3x3** (`ZA.area`). **Ruled:** touching his side, centred on his row or column, one
    of four directions. It does not slide.
27. **Numbers** (`ZA.number`). **Ruled:** a revived body keeps its number. No number is reused.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX` — play-time tracking fields.
- *"Has the following effects-"* (Presence Concealment, Librarian, Expert) — headings.
- `Held items:` — an empty slot.
- *"(e.g. Hassan 1, Hassan 16, Hassan 47)"* — an example of `ZA.number`, not a rule of its own.
- *"(i.e. not shared across Hassans)"*, *"(i.e. 2 Hassans are equal to 1 Unit)"* — glosses.

## Statblock

- [ ] **SB** · True Name Hassan-i-Sabbah, Region Middle East, Lawful Evil, STR C, END D, AGI A, MAG C, LUC E, Base Health 750, MOV 7, Range 3 panels / 1 target, BA(STR) 100 and BA(MAG) 150 by the tables (printed 85 / 150), Sustainability 2◈ · *Untouched*
- [ ] **SB.attr** · Attributes Male/Female, Servant, [Man], Humanoid, Anti-Hero · *Untouched*

## Presence Concealment — Class Skill, Rank A+ *(Active)*

- [ ] **PC.when** · Used during his Turn · *Untouched*
- [ ] **PC.dur** · Its effects last 2◈ · *Untouched*
- [ ] **PC.1** · He cannot be targeted for an Attack or an enemy Unit's Skill · *Untouched*
- [ ] **PC.1.aoe** · Caught in an AoE Attack and failing to Evade, a coin is flipped · *Untouched*
- [ ] **PC.1.heads** · …Heads: no damage and no effects · *Untouched*
- [ ] **PC.1.tails** · …Tails: Total Damage −50% and PC is deactivated · *Untouched*
- [ ] **PC.2** · His Attacks cannot be Blocked or Countered unless the DU's current AGI Rank is equal or higher · *Untouched*
- [ ] **PC.2.evade** · If the DU Evades, its Evade Roll +4 · *Untouched*
- [ ] **PC.3.masters** · He may Attack Masters · *Untouched*
- [ ] **PC.3.move** · …and Move to any panel regardless of enemy Master-Servant positions · *Untouched*
- [ ] **PC.4** · All damage dealt +100% · *Untouched*
- [ ] **PC.4.np** · …if NP, 50% · *Untouched*
- [ ] **PC.4.master** · …not against Masters · *Untouched*
- [ ] **PC.5** · After an Attack while PC is Active, PC is deactivated at the end of the Combat Process · *Untouched*
- [ ] **PC.6** · Moving into an enemy Servant's Range (or Detect), a 5% chance of being discovered · *Untouched*
- [ ] **PC.7** · Active Skills targeting or affecting enemy Units cannot be used unless stated · *Untouched*
- [ ] **PC.7.x** · …Attack Skills and Spells that deal damage are not included · *Untouched*
- [ ] **PC.8.nb** · PC's effects are neither buff nor debuff · *Untouched*
- [ ] **PC.8.unrem** · …and are Unremovable · *Untouched*
- [ ] **PC.8.seal** · Inflicted with Skill Seal while PC is Active, PC is deactivated at once · *Untouched*
- [ ] **PC.cd** · Cooldown 2◈ after PC is deactivated · *Untouched*

## Librarian of Stored Knowledge — Rank B *(Passive 1 + Active + Passive 2 — three records)*

- [ ] **LSK.p1** · *(Passive 1)* Crit Chance +20% · *Untouched*
- [ ] **LSK.when** · Used during his Turn · *Untouched*
- [ ] **LSK.1** · NP Cooldown −1◈ · *Untouched*
- [ ] **LSK.2** · Applies NP Regen for 1◈ · *Untouched*
- [ ] **LSK.2.tick** · …NP Cooldown −1 Turn at the end of every Turn · *Untouched*
- [ ] **LSK.3** · Applies Crit Up for 1◈, Crit Chance +20% · *Untouched*
- [ ] **LSK.4** · Applies Buff ChUp for 1◈, chance of applying buffs +20% · *Untouched*
- [ ] **LSK.5** · Applies Crit DmUp for 1◈, Crit Damage +30% · *Untouched*
- [ ] **LSK.cd** · Cooldown 4◈ · *Untouched*
- [ ] **LSK.p2** · *(Passive 2)* When used, Effects 3, 4 and 5 also go to other Hundred-Faced Hassans within 2 panels of the user · *Untouched*
- [ ] **LSK.p2.cap** · …to two of them at most · *Untouched*
- [ ] **LSK.p2.only** · …Effects 1 and 2 stay with the user · *Untouched*

## Expert of Many Specializations — Rank A+ *(Passive 1 + Active + Passive 2 — three records)*

- [ ] **EMS.p1** · *(Passive 1)* A dice roll Hassan makes outside of Combat may be raised or lowered by up to 3 · *Untouched*
- [ ] **EMS.p1.not** · …not together with this Skill's Active effect · *Untouched*
- [ ] **EMS.when** · Used during his Turn · *Untouched*
- [ ] **EMS.1** · 70% chance to restore 3 Agility · *Untouched*
- [ ] **EMS.1.buff** · …treated as applying a buff · *Untouched*
- [ ] **EMS.1.up** · …on success, AGL Up for 1◈: Agility Check rolls −3 · *Untouched*
- [ ] **EMS.2** · 70% chance to restore 3 Luck · *Untouched*
- [ ] **EMS.2.buff** · …treated as applying a buff · *Untouched*
- [ ] **EMS.2.up** · …on success, LUC Up for 1◈: Luck Check rolls −3 · *Untouched*
- [ ] **EMS.3** · 70% chance of Atk Up for 1◈, all damage dealt +40% · *Untouched*
- [ ] **EMS.3.np** · …if NP, 30% · *Untouched*
- [ ] **EMS.4** · Applies Dodge, every time · *Untouched*
- [ ] **EMS.4.dur** · …a 70% chance it lasts ⅔◈, otherwise ⅓◈ · *Untouched*
- [ ] **EMS.cd** · Cooldown 4◈−⅓◈ · *Untouched*
- [ ] **EMS.p2** · *(Passive 2)* When used, its effects go to every other Hundred-Faced Hassan within 2 panels of the user · *Untouched*
- [ ] **EMS.p2.rolls** · …each Hassan rolls its own chances · *Untouched*

## Battle Retreat — Rank B *(Active)*

- [ ] **BR.when** · Used when Hassan is Attacked by an enemy Unit · *Untouched*
- [ ] **BR.cancel** · The enemy Unit's Attack is canceled · *Untouched*
- [ ] **BR.move** · Hassan may Move 7 panels · *Untouched*
- [ ] **BR.heal** · Hassan restores 40% of his Max Health · *Untouched*
- [ ] **BR.strip** · …then every buff on Hassan is removed · *Untouched*
- [ ] **BR.cd** · Cooldown 3◈ · *Untouched*

## Zabaniya: Delusional Illusion — Rank B++, NP, Anti-Unit (Self) *(Passive + Active — two records)*

### The hundred

- [ ] **ZA.pool** · His Master has 100 Hassans in all · *Untouched*
- [ ] **ZA.track** · …counted on the Master's page as `Hassans: 100/100` · *Untouched*
- [ ] **ZA.defeat** · Hassan is defeated only when all 100 are defeated · *Untouched*
- [ ] **ZA.start** · At the start of the game, the Master may start with more than one Hassan in its Home Base · *Untouched*
- [ ] **ZA.deploy** · At the start of a Round, the Master may deploy more Hassans onto its half of the field · *Untouched*
- [ ] **ZA.deploy.base** · …or within 2 panels of its Home Base's border · *Untouched*
- [ ] **ZA.cap** · At most ten Hundred-Faced Hassans on the field · *Untouched*
- [ ] **ZA.unit** · Each Hassan is a separate Unit · *Untouched*
- [ ] **ZA.stats** · …with its own Stats, not shared · *Untouched*
- [ ] **ZA.number** · Each is numbered in ascending order as it is deployed · *Untouched*
- [ ] **ZA.cd.shared** · Skill and NP Cooldowns are shared between all Hassans · *Untouched*
- [ ] **ZA.cd.own** · …except Presence Concealment and Battle Retreat, which each Hassan keeps · *Untouched*
- [ ] **ZA.regen** · With NP Regen on more than one Hassan, only the strongest takes effect · *Untouched*
- [ ] **ZA.weight** · Counting the Units that Move or Attack in a Turn, one Hassan is 0.5 of a Unit · *Untouched*
- [ ] **ZA.once** · The same Hassan can Move or Attack only once per Turn · *Untouched*

### The Noble Phantasm

- [ ] **ZA.army** · The Active is \[Anti-Army\] · *Untouched*
- [ ] **ZA.str** · BA(STR) is used · *Untouched*
- [ ] **ZA.gate** · Cannot be used with 10 or fewer Hassans remaining · *Untouched*
- [ ] **ZA.area** · A 3x3 area in any non-diagonal direction next to Hassan · *Untouched*
- [ ] **ZA.dmg** · 3.5x damage plus 200 · *Untouched*
- [ ] **ZA.critdwn** · …then Crit Dwn for 1◈, Crit Chance −25% · *Untouched*
- [ ] **ZA.defdwn** · …and Def Dwn (A) for 1◈, all damage received +20% · *Untouched*
- [ ] **ZA.defdwn.luck** · …Luck −1 whenever damage is received from an Attack · *Untouched*
- [ ] **ZA.cost** · Then the number of Hassans is reduced by 4d6 · *Untouched*
- [ ] **ZA.cd** · Cooldown 6◈+⅔◈ · *Untouched*
