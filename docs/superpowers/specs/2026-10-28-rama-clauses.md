# Rama (Saber) — the Clause list

*Rama*, the Saber, built from `char_orig_sheets/by-class/Saber/Rama.md`. Started by the user 2026-10-28.

**Audit opened 2026-10-28 (#347).**
**Read by hand, line by line.** No generated draft was used. The older copy `char_orig_sheets/Copia de Rama.md`
was compared with it. The by-class copy adds `N.Atk Type: STR, Melee` and the delivery tags: `{R}` on Brahmastra,
Sudarshana, Trishula and Pinaka, `{M}` on Shuuravara and Modhaki and Shikhari. No rule text differs. The by-class copy
is the one read.

One Clause per rule that can fail on its own. A rider stays with the hit it rides on unless it has a die or a
condition of its own.

**Built to be reused.** Kin found with `node tools/sheet-kin.mjs kin "Saber/Rama"`, each confirmed by reading:

- **Magic Resistance A** is `class-magic-resistance` at A, as Arturia's (#230).
- **Riding A+** is Raikou's line word for word: `class-riding-unlocks` at A+, `3◈-⅓◈`, MOV 5 (Karna's at A).
- **Divinity A** is `divinity` at A with `printedRevision: revised`: Rama is one of the five sheets that print the
  Revised text (Appendix B, #260 reading 3), as Arjuna, Proto Gil and Cú do.
- **Charisma B**'s Passive is Arturia's (`arturia-charisma`, +20 to the other allies); its Active is Proto Gil's
  (`atkUpCharisma` carried by him, here 20% / NP 10% at 4◈).
- **Martial Blessing**'s Crit Up and Crit DmUp are the generic `critUp` and `critDmUp`.
- **Dream of Reunion**'s S.Crit Up is the `sCritUp` aura its caster holds (#132), Arturia's Radiant Road at 15%. Its
  heal is a `heal` phase by percent of maximum. Its passive listens to `fgt.unitRevived`, as Heracles's Indomitable
  (*"whenever Heracles is defeated and revived through any effect"*). The Reunion Counter is a Resource pool, as
  Sieg's DRCS (`resources:`).
- **Brahmastra**'s +200% against Demonic is Balmung's `conditionalMultipliers` row against an Attribute (#341). Its
  Def Dwn (B) is the built `defDwnB`. The Demonic DU's NP Cooldown +1◈ is Kiritsugu's Chronos Rose and Nursery Rhyme's
  `cooldown` change, `unit: target`, `direction: up`.
- **Vishnu Bhuja**'s summon roll is a setup-plan line beside Semiramis's coin (`summonVariant`) and Arturia's d8 for
  Avalon (`summonItems`).
- **Modhaki and Shikhari**'s splash around the DU is Blasted Tree's 3×3 around the DU (#345 ruling 11).
- **Trishula**'s 3×3 next to him is Akafiloga usage 1's and Balmung's frame: `selfEdgeAdjacent`, an `orientedRect`.
- **Bleed**, **Slow**, **Immobilize**, **Shock**, **Burn**, **Def Dwn** and the half elements (`elementFraction`) are
  built.
- **Demonic** Units to press against: Asterios and the Jabberwock carry the Attribute.

What he needs that nobody has yet, each to be built as a generic piece:

- **A summon roll that grants Abilities** (VB.*): a coin picks one or two d6; each face grants one of five NPs; a 6 is
  the player's pick among those not yet held.
- **A Normal Attack variant once per Round** (SU.p, SH.p, MS.p, TR.p, PI.p): a passive that offers his Normal Attack
  at another Range or with a damage change, spent once a Round.
- **A Skill a passive requires** (MB.allow): Vishnu Bhuja is usable only while Martial Blessing is his.
- **Guts that revives with a flat figure** (DR.guts): 100 Health, not a percent. Sita, Flora, Nightingale (Santa) and
  Chloe (Summer) print the same shape.
- **A total cut on the attacker's own damage, keyed on the DU's Attribute** (BR.nondemonic): Armor of Fafnir's Total
  cut is the defender's.
- **A die that breaks an NP for the rest of the game** (PI.die, PI.p.die).
- **An Attack cancelled when its target would be defeated, by a chance per counter, once a game** (CS.*), and a
  **Servant summoned by an effect onto the board, contracted to its Master** (CS.sita): Sita.

**156 Clauses** across 14 Abilities and the statblock.

### Not Clauses

- `Health: XXX/XXX`, `Agility: XX/XX`, `Luck: XX/XX`: play-time tracking fields.
- *"Has the following effects-"*, *"This NP has the following effects depending on the DU-"*, *"Then, has the
  following effects-"*: headings. *"Then"* is read as the order in BR.order.
- *"Rakshasa-Piercing Immortal"*, *"Arms of the Great One"*, *"Shiva Dhanush: Bow of Shiva"*: titles.
- `Items held:`: an empty slot.

### Already ruled

**Elsewhere:** Base Attack and Max Health derive from the tables (§46.6), so BA(STR) is 150 at STR A, not the
printed 200 · *"NP Cooldown"* naming no NP reaches every NP (#197 reading 6) · an area that names no relation hits
every Unit in it (#191 reading 11) · *"all allied Units"* includes the user unless the sheet says *"other"* · an
effect with no NP figure applies its full value against an NP (#204 reading 5) · Crit Up and Crit DmUp reach an NP
only when an NP figure is stated (#131) · S.Crit Up is an aura held by its caster (#132) · `{R}`, `{M}`, `{S}` are
Ranged, Melee, Special, and a stated Melee Attack is Melee whatever its Range (#281) · NP Seal stops no passive NP
unless stated, and Skill Seal no passive Skill (Appendix A) · a debuff with no printed chance lands, cut only by
debuff resistance (#345 ruling 13).

## Readings to settle

Asked by grilling, 2026-10-28. Rulings are written here as they land. None is built.

## Statblock

- [ ] **ST.name** · True Name: Rama · *Untouched*
- [ ] **ST.class** · Class: Saber (the sheet's folder; no Class line is printed) · *Untouched*
- [ ] **ST.region** · Region: India · *Untouched*
- [ ] **ST.align** · Alignment: Lawful Good · *Untouched*
- [ ] **ST.param** · STR A, END B, AGI A+, MAG B, LUC B · *Untouched*
- [ ] **ST.attr** · Attributes: Male, Servant, [Sky], Humanoid, King · *Untouched*
- [ ] **ST.hp** · Base Health 1250 (the table at END B) · *Untouched*
- [ ] **ST.mov** · MOV 6 · *Untouched*
- [ ] **ST.range** · Range 1 panel, 1 target · *Untouched*
- [ ] **ST.ba** · Base Attack STR 150 by the table (printed 200), MAG 175 · *Untouched*
- [ ] **ST.na** · Normal Attack: STR, Melee · *Untouched*
- [ ] **ST.sus** · Sustainability 2◈ · *Untouched*
- [ ] **ST.items** · Items held: none · *Untouched*

## Magic Resistance — Class Skill, Rank A *(Passive 1 + 2)*

- [ ] **MR.1** · MAG damage from a MAG Rank of up to A is negated · *Untouched*
- [ ] **MR.1.over** · …otherwise MAG damage taken is reduced by 50% · *Untouched*
- [ ] **MR.1.np** · …also affects NP · *Untouched*
- [ ] **MR.2** · Chance of being inflicted by debuffs is reduced by 25% · *Untouched*
- [ ] **MR.2.death** · …also affects Instakill and Death · *Untouched*
- [ ] **MR.2.str** · …unless the Instakill or Death is from an Attack/Attack Skill/Spell/NP that deals STR damage or is not affected by Magic Resistance · *Untouched*
- [ ] **MR.2.erase** · Erase is completely unaffected · *Untouched*
- [ ] **MR.2.other** · Other debuffs from STR or *"not affected"* sources still have their chance reduced · *Untouched*

## Riding — Class Skill, Rank A+ *(Active + Passive 1 + 2 + 3)*

- [ ] **RD.when** · *(Active)* Used during his Turn · *Untouched*
- [ ] **RD.mov** · MOV +5 for this Turn · *Untouched*
- [ ] **RD.notbuff** · …not a buff: not removed by buff removal, not prevented by an effect that prevents buffs · *Untouched*
- [ ] **RD.unlock** · Double Move, Riding Attack and Passenger Seat usable on this Turn only · *Untouched*
- [ ] **RD.dm** · *(P1)* Double Move: Move twice, once before and once after Attacking; total ≤ his MOV · *Untouched*
- [ ] **RD.ra** · *(P2)* Riding Attack: Attack every Unit in his path moving in a straight line, as his Normal Attack · *Untouched*
- [ ] **RD.ra.stop** · …cannot Attack or Move after he has stopped · *Untouched*
- [ ] **RD.ra.left** · …if he already Moved, its panels are his MOV minus the panels Moved · *Untouched*
- [ ] **RD.ps** · *(P3)* Passenger Seat: his Master Moves with him, same orientation and position after; counts as Moving one Unit · *Untouched*
- [ ] **RD.ps.ra** · Passenger Seat and Riding Attack combine · *Untouched*
- [ ] **RD.cd** · Cooldown 3◈−⅓◈ · *Untouched*

## Divinity — Rank A *(Passive)*

- [ ] **DV.dmg** · All damage dealt +50, NP included · *Untouched*
- [ ] **DV.fixed** · …dealt as Fixed Divine Damage (the Revised text, under the War's `divinityRevision`) · *Untouched*
- [ ] **DV.injury** · …does not count towards the amount required for an Injury Roll · *Untouched*

## Martial Blessing — Rank A *(Passive + Active)*

- [ ] **MB.allow** · *(Passive)* Allows the use of Vishnu Bhuja (Q) · *Untouched*
- [ ] **MB.when** · *(Active)* Used during his Turn · *Untouched*
- [ ] **MB.crit** · Crit Up on himself for 1◈: Crit Chance +50% · *Untouched*
- [ ] **MB.critdm** · Crit DmUp on himself for 1◈: Crit Damage +100% · *Untouched*
- [ ] **MB.np** · Neither reaches an NP: no NP figure is printed (#131) · *Untouched*
- [ ] **MB.cd** · Cooldown 4◈ · *Untouched*

## Charisma — Rank B *(Passive + Active)*

- [ ] **CH.p** · *(Passive)* All damage dealt by other allied Units within a 2 panel area of himself +20, NP included · *Untouched*
- [ ] **CH.p.other** · …not his own damage (*"other"*) · *Untouched*
- [ ] **CH.p.off.charisma** · …negated while he has Atk Up (Charisma) · *Untouched*
- [ ] **CH.p.off.seal** · …negated while he is inflicted with Skill Seal · *Untouched*
- [ ] **CH.when** · *(Active)* Used during his Turn · *Untouched*
- [ ] **CH.atk** · Atk Up (Charisma) on himself for 1◈: all damage dealt by allied Units within a 2 panel area of himself +20% · *Untouched*
- [ ] **CH.atk.np** · …if NP, +10% · *Untouched*
- [ ] **CH.atk.self** · …himself included (*"allied Units"*, no *"other"*) · *Untouched*
- [ ] **CH.cd** · Cooldown 4◈ · *Untouched*

## Curse of Separation — Rank A *(Passive)*

- [ ] **CS.when** · When Rama would be defeated and is not revived by any effect: after the revival chain, Guts included · *Untouched*
- [ ] **CS.attack** · …by an Attack: a defeat by no Attack (Q) · *Untouched*
- [ ] **CS.chance** · A 3% chance for every Reunion Counter on himself, the die on the card · *Untouched*
- [ ] **CS.zero** · …with no Reunion Counter, no chance · *Untouched*
- [ ] **CS.cancel** · On a success, that Attack is cancelled (Q) · *Untouched*
- [ ] **CS.sita** · Then Sita is summoned on a panel directly next to him (Q) · *Untouched*
- [ ] **CS.contract** · …contracted to Rama's Master · *Untouched*
- [ ] **CS.panel** · …with no free panel directly next to him (Q) · *Untouched*
- [ ] **CS.once** · Can only activate once per game (Q) · *Untouched*

## Dream of Reunion — Rank EX *(Passive + Active)*

- [ ] **DR.p** · *(Passive)* Whenever Rama is defeated and revived by any effect: +1 Reunion Counter · *Untouched*
- [ ] **DR.pool** · The Reunion Counters are shown on his bar and sheet · *Untouched*
- [ ] **DR.when** · *(Active)* Used during his Turn · *Untouched*
- [ ] **DR.guts** · 1. Guts for 1◈: when defeated, revived with 100 Health · *Untouched*
- [ ] **DR.heal** · 2. Health +25% of his maximum · *Untouched*
- [ ] **DR.np** · 3. NP Cooldown −1◈, every NP he holds (#197 reading 6) · *Untouched*
- [ ] **DR.scrit** · 4. S.Crit Up for ⅓◈ to all allied Units within a 2 panel area of himself, himself included: Crit Chance +15% · *Untouched*
- [ ] **DR.counter** · 5. +1 Reunion Counter · *Untouched*
- [ ] **DR.cd** · Cooldown 4◈ · *Untouched*

## Brahmastra: Rakshasa-Piercing Immortal — Rank EX *(NP, Anti-Demon)*

- [ ] **BR.np** · A Noble Phantasm, Rank EX, Anti-Demon · *Untouched*
- [ ] **BR.when** · Used during his Turn; the Master pays the EX price · *Untouched*
- [ ] **BR.ranged** · `{R}`: a Ranged Attack · *Untouched*
- [ ] **BR.ba** · Base Attack (STR) · *Untouched*
- [ ] **BR.range** · Range 3 · *Untouched*
- [ ] **BR.dmg** · 5× damage · *Untouched*
- [ ] **BR.demonic** · A DU with the Demonic Attribute: damage further +200% · *Untouched*
- [ ] **BR.nondemonic** · A DU without it: Total damage dealt −20% (Q) · *Untouched*
- [ ] **BR.order** · *"Then"*: the effects below land after the damage · *Untouched*
- [ ] **BR.def** · 1. Def Dwn (B) for 1◈: all damage taken +20% · *Untouched*
- [ ] **BR.def.np** · …if NP, +30% · *Untouched*
- [ ] **BR.npcd** · 2. A Demonic DU: its NP Cooldown +1◈ (Q) · *Untouched*
- [ ] **BR.npcd.not** · …a DU without it: no change · *Untouched*
- [ ] **BR.cd** · Cooldown 8◈ · *Untouched*

## Vishnu Bhuja: Arms of the Great One — Rank A *(NP, Anti-Army)*

- [ ] **VB.np** · A Noble Phantasm, Rank A, Anti-Army, with no use of its own: it names the five below · *Untouched*
- [ ] **VB.coin** · When Rama is summoned, flip a coin, on the summon's card · *Untouched*
- [ ] **VB.heads** · Heads: roll 2d6 · *Untouched*
- [ ] **VB.tails** · Tails: roll 1d6 · *Untouched*
- [ ] **VB.grant** · Each number rolled, 1 to 5, gives him that NP for the game · *Untouched*
- [ ] **VB.none** · An NP no die named is not his · *Untouched*
- [ ] **VB.six** · A 6: the player chooses any of the five not yet chosen · *Untouched*
- [ ] **VB.double** · Two dice showing the same number (Q) · *Untouched*
- [ ] **VB.p.once** · Each passive below is spent once per Round (Q: one passive or each) · *Untouched*
- [ ] **VB.p.which** · …it is his Normal Attack, offered at declaration, the player's pick (Q) · *Untouched*
- [ ] **VB.p.delivery** · …its delivery: Melee as his `N.Atk Type`, or Ranged (Q) · *Untouched*

### Vishnu Bhuja: Sudarshana *(on a 1)*

- [ ] **SU.get** · Obtained when a 1 is rolled · *Untouched*
- [ ] **SU.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 4 · *Untouched*
- [ ] **SU.p.cut** · …its damage −30% · *Untouched*
- [ ] **SU.ranged** · *(Active)* `{R}`: a Ranged Attack · *Untouched*
- [ ] **SU.ba** · Base Attack (STR) · *Untouched*
- [ ] **SU.range** · Range 3 · *Untouched*
- [ ] **SU.two** · Targets 2 enemy Units within Range (Q) · *Untouched*
- [ ] **SU.dmg** · 3× damage to both · *Untouched*
- [ ] **SU.bleed** · A 20% chance of Bleed for 1◈+⅓◈ on each, its own die · *Untouched*
- [ ] **SU.elem** · Wind damage (half) · *Untouched*
- [ ] **SU.cd** · Cooldown 5◈ · *Untouched*
- [ ] **SU.rank** · Treated as a Rank A NP: the Master pays the A price · *Untouched*

### Vishnu Bhuja: Shuuravara *(on a 2)*

- [ ] **SH.get** · Obtained when a 2 is rolled · *Untouched*
- [ ] **SH.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 3 · *Untouched*
- [ ] **SH.p.cut** · …its damage −20% · *Untouched*
- [ ] **SH.melee** · *(Active)* `{M}`: a Melee Attack, at Range 4 · *Untouched*
- [ ] **SH.ba** · Base Attack (STR) · *Untouched*
- [ ] **SH.range** · Range 4 · *Untouched*
- [ ] **SH.dmg** · 3.5× damage · *Untouched*
- [ ] **SH.slow** · A 50% chance of Slow for 2◈ · *Untouched*
- [ ] **SH.def** · Then Def Dwn for 1◈: all damage received +10%, no chance printed · *Untouched*
- [ ] **SH.elem** · Water damage (half) · *Untouched*
- [ ] **SH.cd** · Cooldown 5◈ · *Untouched*
- [ ] **SH.rank** · Treated as a Rank A NP · *Untouched*

### Vishnu Bhuja: Modhaki and Shikhari *(on a 3)*

- [ ] **MS.get** · Obtained when a 3 is rolled · *Untouched*
- [ ] **MS.p** · *(Passive)* Once per Round, a Normal Attack that deals 20% extra damage · *Untouched*
- [ ] **MS.melee** · *(Active)* `{M}`: a Melee Attack · *Untouched*
- [ ] **MS.ba** · Base Attack (STR) · *Untouched*
- [ ] **MS.range** · Range 1 · *Untouched*
- [ ] **MS.dmg** · 4× damage to the DU · *Untouched*
- [ ] **MS.imm** · …and Immobilize for 1◈+⅓◈, no chance printed · *Untouched*
- [ ] **MS.elem** · …Earth damage (half) · *Untouched*
- [ ] **MS.area** · Every Unit except Rama directly around the DU (1 panel), allies included · *Untouched*
- [ ] **MS.area.dmg** · …takes 2× damage · *Untouched*
- [ ] **MS.area.imm** · …a 50% chance of Immobilize for ⅔◈, its own die on each · *Untouched*
- [ ] **MS.area.elem** · …Earth damage, whole · *Untouched*
- [ ] **MS.area.react** · …what those Units may react with (Q) · *Untouched*
- [ ] **MS.cd** · Cooldown 7◈ · *Untouched*
- [ ] **MS.rank** · Treated as a Rank A NP · *Untouched*

### Vishnu Bhuja: Trishula *(on a 4)*

- [ ] **TR.get** · Obtained when a 4 is rolled · *Untouched*
- [ ] **TR.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 2 · *Untouched*
- [ ] **TR.ranged** · *(Active)* `{R}`: a Ranged Attack · *Untouched*
- [ ] **TR.ba** · Base Attack (MAG) · *Untouched*
- [ ] **TR.area** · A 3×3 panel area in any non-diagonal direction next to Rama · *Untouched*
- [ ] **TR.hit** · …every Unit in it, allies included (#191 reading 11) · *Untouched*
- [ ] **TR.dmg** · 3× damage · *Untouched*
- [ ] **TR.shock** · A 30% chance of Shock for 2◈, its own die on each · *Untouched*
- [ ] **TR.elem** · Lightning damage · *Untouched*
- [ ] **TR.cd** · Cooldown 6◈ · *Untouched*
- [ ] **TR.rank** · Treated as a Rank A NP · *Untouched*

### Vishnu Bhuja: Pinaka *(on a 5)*

- [ ] **PI.get** · Obtained when a 5 is rolled · *Untouched*
- [ ] **PI.p** · *(Passive)* Once per Round, a Normal Attack at a Range of 5 · *Untouched*
- [ ] **PI.p.die** · …then a d12 at the end of the Damage Step: on a 5 the Shiva Dhanush breaks (Q) · *Untouched*
- [ ] **PI.ranged** · *(Active)* `{R}`: a Ranged Attack · *Untouched*
- [ ] **PI.ba** · Base Attack (STR) · *Untouched*
- [ ] **PI.range** · Range 5 · *Untouched*
- [ ] **PI.dmg** · 5× damage · *Untouched*
- [ ] **PI.burn** · A 50% chance of Burn for 2◈ · *Untouched*
- [ ] **PI.die** · A d6 at the end of the Damage Step: on a 5 the Shiva Dhanush breaks (Q) · *Untouched*
- [ ] **PI.broken** · Broken: Vishnu Bhuja: Pinaka can no longer be used for the rest of the game (Q) · *Untouched*
- [ ] **PI.elem** · Fire damage (half) · *Untouched*
- [ ] **PI.cd** · Cooldown 7◈ · *Untouched*
- [ ] **PI.rank** · Treated as a Rank A NP · *Untouched*
